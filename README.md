# AI Agent with Hybrid RAG + Guardrails

A production-grade AI agent that answers questions over a document corpus using:
- **Hybrid Retrieval** — Dense (Qdrant) + Sparse (BM25) with Reciprocal Rank Fusion
- **Re-ranking** — Cross-encoder for precise relevance scoring
- **Guardrails** — Input (injection, length) + Output (PII, hallucination signals)
- **Agent loop** — Claude with tool use + multi-turn memory
- **FastAPI backend** — REST endpoints for ingest and query
- **CI/CD** — GitHub Actions → Docker → Render

## Stack
| Layer | Technology |
|---|---|
| LLM | Claude (Anthropic) |
| Vector DB | Qdrant |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) |
| Sparse retrieval | rank-bm25 |
| Re-ranker | cross-encoder/ms-marco-MiniLM-L-6-v2 |
| Backend | FastAPI + Uvicorn |
| Infra | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Deploy | Render |

## Quick Start

```bash
# 1. Clone and configure
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env

# 2. Start Qdrant + API
docker-compose up --build

# 3. Ingest a document
curl -X POST http://localhost:8000/ingest \
  -F "file=@docs/my_document.pdf"

# 4. Query the agent
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is hybrid RAG?"}'
```

## Project Structure

```
agent-rag/
├── ingest/
│   ├── chunker.py          # Token-aware sliding window chunker
│   ├── embedder.py         # Dense embedding via sentence-transformers
│   ├── vector_store.py     # Qdrant client wrapper
│   ├── bm25_index.py       # BM25 sparse index with persistence
│   └── pipeline.py         # Orchestrates full ingest flow
├── retrieval/
│   └── hybrid_retriever.py # Dense + Sparse + RRF fusion
├── reranker/
│   └── cross_encoder.py    # Cross-encoder re-ranking
├── guardrails/
│   └── guards.py           # Input + Output guardrails
├── agent/
│   └── core.py             # Claude agent loop with tool use
├── api/
│   └── main.py             # FastAPI endpoints
├── tests/
│   └── test_guards.py      # Guardrail unit tests (CI-safe)
├── .github/workflows/
│   └── ci.yml              # Lint → Test → Build → Deploy
├── docker-compose.yml
├── Dockerfile
└── requirements.txt
```

## Build Order (what we built)
- [x] Build 1: Ingest pipeline (chunker, embedder, vector store, BM25)
- [x] Build 2: Hybrid retriever (dense + sparse + RRF)
- [x] Build 3: Re-ranker (cross-encoder)
- [x] Build 4: Guardrails (input + output)
- [x] Build 5: Agent core (Claude + tools + memory)
- [x] Build 6: FastAPI backend
- [ ] Build 7: React frontend (chat UI + citations panel + guardrail log)
- [x] Build 8: CI/CD pipeline (GitHub Actions + Docker + Render)
