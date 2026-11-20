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

*Built as a portfolio project demonstrating AI Engineer, Full Stack, and DevOps/CI-CD skills at a production level.*