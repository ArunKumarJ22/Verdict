# Verdict — AI Agent with Hybrid RAG + Guardrails

> A production-grade document intelligence platform built with Hybrid Retrieval-Augmented Generation, cross-encoder re-ranking, two-sided guardrails, and an agentic Claude reasoning loop.

![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green?style=flat-square&logo=fastapi)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react)
![Qdrant](https://img.shields.io/badge/Qdrant-1.11-red?style=flat-square)
![Claude](https://img.shields.io/badge/Claude-Sonnet%204.6-orange?style=flat-square)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
  - [Ingest Pipeline](#1-ingest-pipeline)
  - [Hybrid Retrieval](#2-hybrid-retrieval)
  - [Re-ranking](#3-re-ranking)
  - [Guardrails](#4-guardrails)
  - [Agent Loop](#5-agent-loop)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Setup](#environment-setup)
  - [Running with Docker](#running-with-docker)
  - [Running in Development](#running-in-development)
- [API Reference](#api-reference)
- [Frontend](#frontend)
- [CI/CD Pipeline](#cicd-pipeline)
- [Design Decisions](#design-decisions)
- [Interview Talking Points](#interview-talking-points)

---

## Overview

Verdict is a full-stack AI platform that lets you upload documents and have intelligent, cited conversations about them. It is not a wrapper around a chatbot API — it implements a complete RAG pipeline from scratch, combining two retrieval strategies, a cross-encoder re-ranker, production-grade guardrails, and an agentic reasoning loop powered by Claude.

**What makes this different from a basic RAG demo:**

- **Hybrid retrieval** — combines dense vector search (semantic) with BM25 keyword search, fused via Reciprocal Rank Fusion. Neither method alone is used.
- **Cross-encoder re-ranking** — a second-stage model scores (query, passage) pairs jointly for precision that bi-encoders cannot match.
- **Two-sided guardrails** — input validation blocks prompt injection and abuse before the LLM sees the query. Output validation scans for PII and hallucination signals before the user sees the response.
- **Agentic tool use** — Claude decides when to search, what to search for, and when it has enough context. It can rephrase queries and ask clarifying questions.
- **Full production stack** — Dockerized, CI/CD pipeline, persistent vector store, BM25 index that survives restarts.

---

## Architecture

```
User Query
    │
    ▼
┌─────────────────┐
│   Input Guard   │  ← blocks injection, length abuse, jailbreaks
└────────┬────────┘
         │  PASS
         ▼
┌─────────────────┐
│   FastAPI API   │  ← /query  /ingest  /health
└────────┬────────┘
         │
    ┌────┴──────────────────────────┐
    │                               │
    ▼                               ▼
┌────────────┐               ┌──────────────┐
│   Dense    │               │    Sparse    │
│ Retrieval  │               │  Retrieval   │
│  (Qdrant)  │               │    (BM25)    │
└─────┬──────┘               └──────┬───────┘
      │  top-20 by cosine           │  top-20 by TF-IDF
      └──────────┬──────────────────┘
                 ▼
         ┌──────────────┐
         │  RRF Fusion  │  ← rank-based merge, no score normalisation
         └──────┬───────┘
                ▼
         ┌──────────────┐
         │  Cross-Enc.  │  ← joint (query, passage) scoring → top-5
         │   Re-ranker  │
         └──────┬───────┘
                ▼
         ┌──────────────┐
         │ Claude Agent │  ← tool use, sliding memory, citations
         │  (tool loop) │
         └──────┬───────┘
                ▼
         ┌──────────────┐
         │ Output Guard │  ← PII, hallucination signals, refusals
         └──────┬───────┘
                ▼
            Response + Citations
```

**Ingest path (runs at upload time):**

```
Document (PDF / TXT / DOCX / MD)
    ↓
Chunker — token-aware sliding window (512 tokens, 64 overlap)
    ↓                      ↓
Embedder               Tokeniser
(sentence-transformers) (rank-bm25)
    ↓                      ↓
Qdrant (disk)          BM25 index (pickle, disk)
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| LLM | Claude Sonnet 4.6 (Anthropic) | Tool use, instruction following, citations |
| Vector DB | Qdrant 1.11 | Persistent ANN search, payload filtering |
| Embeddings | all-MiniLM-L6-v2 | Fast, 384-dim, good quality for RAG |
| Sparse retrieval | rank-bm25 (BM25Okapi) | Exact keyword matching |
| Re-ranker | cross-encoder/ms-marco-MiniLM-L-6-v2 | Joint query-passage scoring |
| Backend | FastAPI + Uvicorn | Async, typed, fast |
| PDF parsing | pypdf | Lightweight, no Java dependency |
| Token counting | tiktoken (cl100k_base) | LLM-accurate chunk sizing |
| Frontend | React 18 + Vite | Fast HMR, ESM build |
| Containerisation | Docker + Docker Compose | Reproducible, portable |
| CI/CD | GitHub Actions | Lint → Test → Build → Deploy |
| Deployment | Render + Docker Hub | Free tier, deploy-on-push |

---

## Project Structure

```
verdict/
│
├── ingest/                      # Document ingestion pipeline
│   ├── chunker.py               # Token-aware sliding window chunker
│   ├── embedder.py              # Dense embedding via sentence-transformers
│   ├── vector_store.py          # Qdrant client wrapper (upsert + search)
│   ├── bm25_index.py            # BM25 sparse index with disk persistence
│   └── pipeline.py              # Orchestrator — single entry point for ingest
│
├── retrieval/
│   └── hybrid_retriever.py      # Dense + Sparse + RRF fusion
│
├── reranker/
│   └── cross_encoder.py         # Cross-encoder re-ranking on RRF candidates
│
├── app_guardrails/
│   └── guards.py                # Input guard + Output guard
│
├── agent/
│   └── core.py                  # Claude agent loop (tool use + memory + citations)
│
├── api/
│   └── main.py                  # FastAPI app — /ingest, /query, /health
│
├── tests/
│   └── test_guards.py           # Guardrail unit tests (CI-safe, no external deps)
│
├── frontend/                    # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx              # Root — three-column layout, all UI components
│   │   ├── index.css            # Design system (tokens, layout, components)
│   │   ├── components/
│   │   │   └── IngestModal.jsx  # Document upload modal
│   │   ├── hooks/
│   │   │   ├── useAgent.js      # Chat state, citations, guard events
│   │   │   └── useHealth.js     # Backend health polling
│   │   └── lib/
│   │       └── api.js           # Typed fetch wrappers for all endpoints
│   ├── Dockerfile.frontend      # Node build → nginx static serve
│   ├── package.json
│   └── vite.config.js           # Dev proxy to avoid CORS
│
├── data/                        # Runtime data (gitignored)
│   └── bm25_index.pkl           # Persisted BM25 index
│
├── .github/
│   └── workflows/
│       └── ci.yml               # Lint → Test → Docker build → Deploy
│
├── docker-compose.yml           # Qdrant + API + Frontend services
├── Dockerfile                   # API container
├── requirements.txt
└── .env.example
```

---

## How It Works

### 1. Ingest Pipeline

When a document is uploaded, the pipeline runs four steps in sequence:

**Step 1 — Chunking** (`ingest/chunker.py`)

Documents are split into overlapping token-aware chunks using a sliding window. The window is 512 tokens wide with 64 tokens of overlap between consecutive chunks. Overlap prevents key facts from being cut in half at a chunk boundary. tiktoken's `cl100k_base` encoding ensures accurate token counting — not character counting, which is inaccurate for LLMs. Each chunk carries source metadata: filename, page number, chunk index, and a deterministic SHA-256 ID.

**Step 2 — Embedding** (`ingest/embedder.py`)

Each chunk is encoded into a 384-dimensional float32 vector using `all-MiniLM-L6-v2`. Vectors are L2-normalised so dot product equals cosine similarity at retrieval time. The model loads lazily on first use.

**Step 3 — Vector store upsert** (`ingest/vector_store.py`)

Chunk vectors and their metadata payloads are upserted into a Qdrant collection. Qdrant uses HNSW graphs for approximate nearest-neighbour search — O(log n) instead of O(n). Data persists to a Docker volume and survives container restarts.

**Step 4 — BM25 indexing** (`ingest/bm25_index.py`)

The same chunks are added to a BM25Okapi index. BM25 scores documents by term frequency × inverse document frequency with document-length normalisation. The index is rebuilt in memory on each update and pickled to `data/bm25_index.pkl` for persistence.

---

### 2. Hybrid Retrieval

At query time, `retrieval/hybrid_retriever.py` runs two searches in parallel:

**Dense search** — the query is embedded and a cosine similarity search returns the top 20 Qdrant results.

**Sparse search** — the query is tokenised and scored against the BM25 index, returning the top 20 keyword-matched results.

**Reciprocal Rank Fusion (RRF)** merges the two ranked lists using only rank position:

```
RRF_score(d) = Σ  1 / (k + rank(d))
```

Where `k = 60` is the standard smoothing constant from the original 2009 paper. Documents appearing in both lists receive a natural boost. No score normalisation is needed because raw scores are never compared.

---

### 3. Re-ranking

`reranker/cross_encoder.py` takes the ~20–40 RRF candidates and re-scores them with `cross-encoder/ms-marco-MiniLM-L-6-v2`, a model that encodes the full `(query, passage)` pair jointly.

| | Bi-encoder | Cross-encoder |
|---|---|---|
| Encodes | Query and doc separately | Query + doc jointly |
| Speed | Fast (pre-computed docs) | Slow (all pairs at query time) |
| Precision | Lower | Higher |
| Use case | Recall from large corpus | Precision from small candidate set |

Running the cross-encoder only on RRF candidates keeps latency acceptable while delivering the precision gain. This two-stage retrieve-then-rerank pattern is standard in production search systems.

---

### 4. Guardrails

`app_guardrails/guards.py` implements two independent guards.

**Input Guard** — runs before any retrieval or LLM call:

| Check | Action |
|---|---|
| Query length < 3 characters | BLOCK |
| Query length > 500 words | BLOCK |
| Prompt injection patterns | BLOCK |
| Jailbreak signatures | BLOCK |

**Output Guard** — runs before the response reaches the user:

| Check | Action |
|---|---|
| Empty / too short response | BLOCK |
| Email / phone / SSN patterns | WARN |
| Hallucination signal phrases | WARN |
| LLM refusal bleed-through | WARN |

WARN events do not block the response. They are logged to the guard event feed in the UI for review. BLOCK events prevent the response from reaching the user.

---

### 5. Agent Loop

`agent/core.py` implements a tool-use loop with Claude as the reasoning core.

**Tools available:**

- `search_docs(query)` — runs the full hybrid retrieval + re-ranking pipeline and returns formatted top passages.
- `clarify_query(question)` — asks the user a clarifying question when intent is ambiguous.

**Flow:**

1. Claude receives the user query and the system prompt.
2. Claude calls `search_docs` with a reformulated query.
3. The tool handler runs retrieval + re-ranking and returns top-K passages.
4. Claude generates a grounded response with inline citations.
5. The output guard validates the response.

The loop is capped at 5 iterations. Sliding-window memory keeps the last 10 message pairs in context for multi-turn conversations.

---

## Getting Started

### Prerequisites

- Docker and Docker Compose
- An Anthropic API key — [console.anthropic.com](https://console.anthropic.com)
- Git

### Environment Setup

```bash
git clone https://github.com/your-username/verdict.git
cd verdict
cp .env.example .env
```

Add your API key to `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

All other defaults work for local development.

### Running with Docker

```bash
docker-compose up --build
```

This starts three services:

| Service | URL | Description |
|---|---|---|
| Qdrant | http://localhost:6333 | Vector database (dashboard at `/dashboard`) |
| API | http://localhost:8000 | FastAPI backend |
| Frontend | http://localhost:3000 | React UI |

ML models are downloaded automatically on first start (~100 MB). Subsequent starts use cached models.

```bash
# Stop all services
docker-compose down

# Reset all data (removes Qdrant volume)
docker-compose down -v
rm -f data/bm25_index.pkl
```

### Running in Development

```bash
# Start Qdrant
docker-compose up qdrant -d

# Backend (with hot reload)
pip install -r requirements.txt
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (in a new terminal)
cd frontend
npm install
npm run dev        # → http://localhost:3000

# Tests (no external services needed)
pytest tests/ -v
```

The Vite dev server proxies all API routes to `localhost:8000`, so no CORS configuration is needed locally.

---

## API Reference

### `GET /health`

```json
{
  "status": "ok",
  "vector_store_docs": 142,
  "bm25_docs": 142
}
```

### `POST /ingest`

Upload a document file for indexing. Accepts `.pdf`, `.txt`, `.md`, `.docx`.

```bash
curl -X POST http://localhost:8000/ingest \
  -F "file=@my_document.pdf"
```

```json
{
  "status": "ok",
  "chunks": 38,
  "sources": ["my_document.pdf"],
  "elapsed_s": 4.21
}
```

### `POST /ingest/text`

Ingest raw text directly.

```bash
curl -X POST http://localhost:8000/ingest/text \
  -F "text=Your document text here..." \
  -F "source=my-source"
```

### `POST /query`

Query the agent.

```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What are the main findings?", "reset_history": false}'
```

```json
{
  "answer": "The main findings are...",
  "citations": [
    {
      "chunk_id": "a1b2c3d4",
      "source": "my_document.pdf",
      "page": 3,
      "score": 0.8921,
      "text": "The study found that..."
    }
  ],
  "guard_events": [],
  "tool_calls": 1,
  "blocked": false
}
```

### `DELETE /history`

Clear the agent's conversation memory.

---

## Frontend

The frontend is a three-column workspace built with React 18 and Vite — no UI framework, all styles hand-written with CSS custom properties.

**Left sidebar** — Verdict branding, navigation (Home, New Chat, Documents, History, Guardrails, Settings), user profile, and live backend status showing vector count and BM25 index size.

**Centre panel** — welcome screen with action cards and suggested prompts on first load. Transitions to a conversational interface once a query is sent. Persistent composer at the bottom with multiline input, attach button (opens the ingest modal), and send button.

**Right sidebar** — tabbed activity panel:
- **History** — conversation list with new chat button
- **Sources** — retrieved document passages with source file, page number, and relevance score
- **Guards** — live feed of guardrail events with pass/warn/block status pills

The UI automatically switches to Sources when citations arrive and to Guards when a non-pass event fires.

---

## CI/CD Pipeline

Three-stage GitHub Actions pipeline defined in `.github/workflows/ci.yml`:

**Stage 1 — Test** (all branches, runs in < 30 seconds)

```
Ruff lint → pytest (guardrail unit tests, no external services)
```

**Stage 2 — Build** (main branch only)

```
docker build → push to Docker Hub
Tagged: latest + git commit SHA
```

The commit SHA tag enables pinned rollbacks to any previous build.

**Stage 3 — Deploy** (main branch only)

```
Render deploy hook → rolling redeploy
```

**Required GitHub Secrets:**

| Secret | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `DOCKERHUB_USERNAME` | Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |
| `RENDER_DEPLOY_HOOK_URL` | Render service deploy hook URL |

---

## Design Decisions

**Why Qdrant instead of a managed vector DB?**

Qdrant runs in Docker with zero external dependencies — no API keys, no cloud accounts, no cold starts. It supports payload filtering (search within a specific source file), handles millions of vectors, and has a simple local dev story. The same Docker Compose setup runs locally and in production.

**Why BM25 when you already have vector search?**

Dense embeddings generalise — they smooth over specifics. If you search for a function name, an acronym, or a rare proper noun, the embedding model maps it to a semantic neighbourhood and may return related but inexact results. BM25 matches exact strings reliably. Hybrid retrieval captures both signals, and empirical evidence consistently shows it outperforms either method alone.

**Why RRF instead of score normalisation?**

BM25 scores are unbounded and corpus-dependent. Cosine scores are in `[-1, 1]`. Normalising them to the same scale requires assumptions about their distributions that rarely hold. RRF uses only ordinal rank, making the fusion robust and free of tunable parameters.

**Why a cross-encoder only on candidates?**

Cross-encoders cannot pre-compute document representations — they must encode every `(query, document)` pair at query time. Running one over a full corpus would take minutes. Running it over 20–40 RRF candidates takes milliseconds. This two-stage design — fast retrieval for recall, slow re-ranker for precision — is the standard pattern in production search.

**Why is the guardrail folder called `app_guardrails`?**

The pip package `guardrails-ai` claims the `guardrails` namespace in Python's import system. Naming your folder `guardrails/` causes a `ModuleNotFoundError` at startup because Python finds the pip package first. The project-specific prefix `app_guardrails` avoids the collision entirely and removes a dependency that was never actually used.

**Why pickle for BM25?**

The rank-bm25 object is an in-memory Python structure with no built-in persistence. Pickle is the simplest way to make it survive restarts. For production at scale, Elasticsearch or OpenSearch handle incremental BM25 indexing and distributed search natively.

---

## Interview Talking Points

**"Walk me through your architecture."**

> The pipeline has two parallel retrieval paths at query time. Dense retrieval embeds the query and searches Qdrant by cosine similarity. Sparse retrieval scores the query against a BM25 index. Both return ranked lists which are merged with Reciprocal Rank Fusion — a rank-based method that sidesteps the score normalisation problem entirely. The fused candidates go through a cross-encoder re-ranker which encodes query and passage jointly for higher precision. The top results land in Claude's context via tool use, and the response is validated by an output guard before reaching the user.

**"Why not just use embeddings?"**

> Dense retrieval is optimised for semantic similarity and tends to generalise. BM25 is deterministic keyword matching — it handles exact strings, proper nouns, and code identifiers that embeddings smooth over. Neither dominates the other across all query types. Hybrid retrieval captures both signals, and the empirical literature consistently shows it outperforms either method alone.

**"What would you change to productionise this?"**

> Replace the pickle-based BM25 with Elasticsearch for scalable incremental indexing. Replace regex PII detection with a spaCy NER model for higher accuracy. Externalise guardrail rules to a config file so thresholds can be updated without a deploy. Add distributed tracing — LangSmith or a custom spans table — so you can debug why a specific query returned poor results. Add authentication on the API. Set up Qdrant's distributed mode if the corpus exceeds single-node capacity.

**"How does the agent loop work?"**

> Claude decides when to call `search_docs` and what query to pass — that's the agentic part, it can rephrase or decompose the original question. The tool handler runs hybrid retrieval and reranking, formats the passages, and returns them as tool results. Claude then generates a response grounded in those passages with inline citations. There's also a `clarify_query` tool it can call when intent is ambiguous. A sliding-window keeps the last 10 turns in context for multi-turn follow-ups.

---

## Licence

MIT — see `LICENSE` for details.

---

*Built as a portfolio project demonstrating AI Engineer, Full Stack, and DevOps/CI-CD skills at a production level.*