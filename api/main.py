"""
api/main.py
-----------
FastAPI backend exposing three endpoints:

  POST /ingest        — Upload and index a document
  POST /query         — Query the agent
  GET  /health        — Health check + index stats
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

from agent.core import RAGAgent
from api.auth import get_current_user
from app_guardrails.guards import GuardRail
from ingest.pipeline import IngestPipeline
from reranker.cross_encoder import Reranker
from retrieval.hybrid_retriever import HybridRetriever

# ---------------------------------------------------------------------------
# App state (singletons, initialised once at startup)
# ---------------------------------------------------------------------------

class AppState:
    pipeline: IngestPipeline
    agent: RAGAgent


state = AppState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise heavy components once at startup."""
    print("[startup] Initialising components…")

    state.pipeline = IngestPipeline()

    embedder     = state.pipeline.embedder
    vector_store = state.pipeline.vector_store
    bm25         = state.pipeline.bm25

    retriever = HybridRetriever(embedder, vector_store, bm25)
    reranker  = Reranker()
    guardrail = GuardRail()

    state.agent = RAGAgent(retriever, reranker, guardrail)

    print("[startup] Ready ✓")
    yield
    print("[shutdown] Goodbye")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="AI Agent with Hybrid RAG",
    version="0.1.0",
    lifespan=lifespan,
)

# In production set FRONTEND_URL=https://your-app.onrender.com
# In dev it falls back to * so local React works without config
_frontend_url = os.getenv("FRONTEND_URL", "")
_origins = [_frontend_url] if _frontend_url else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class QueryRequest(BaseModel):
    query: str
    reset_history: bool = False


class QueryResponse(BaseModel):
    answer: str
    citations: list
    guard_events: list
    tool_calls: int
    blocked: bool


class IngestResponse(BaseModel):
    status: str
    chunks: int
    sources: list
    elapsed_s: float


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "vector_store_docs": state.pipeline.vector_store.count(),
        "bm25_docs": len(state.pipeline.bm25),
    }


@app.post("/ingest", response_model=IngestResponse)
async def ingest(
    file: Annotated[UploadFile, File(...)],
    user: Annotated[dict, Depends(get_current_user)],
):
    """Upload a PDF, TXT, MD, or DOCX file and index it."""
    suffix = Path(file.filename).suffix.lower()
    if suffix not in {".pdf", ".txt", ".md", ".docx"}:
        raise HTTPException(400, f"Unsupported file type: {suffix}")

    # Save to temp location
    tmp_path = Path(f"/tmp/{file.filename}")
    tmp_path.write_bytes(await file.read())

    try:
        result = state.pipeline.ingest_file(tmp_path)
    finally:
        tmp_path.unlink(missing_ok=True)

    return IngestResponse(**result)


@app.post("/ingest/text")
async def ingest_text(
    text: Annotated[str, Form(...)],
    source: Annotated[str, Form("api_input")],
    user: Annotated[dict, Depends(get_current_user)],
):
    """Ingest raw text directly (useful for testing)."""
    result = state.pipeline.ingest_text(text, source=source)
    return result


@app.post("/query", response_model=QueryResponse)
def query(
    req: QueryRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Query the agent with a natural language question."""
    if req.reset_history:
        state.agent.reset()

    response = state.agent.chat(req.query)

    return QueryResponse(
        answer=response.answer,
        citations=response.citations,
        guard_events=response.guard_events,
        tool_calls=response.tool_calls,
        blocked=response.blocked,
    )


@app.delete("/history")
def clear_history(
    user: Annotated[dict, Depends(get_current_user)],
):
    """Reset agent conversation history."""
    state.agent.reset()
    return {"status": "cleared"}