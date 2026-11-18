"""
bm25_index.py
-------------
Sparse BM25 index for keyword-based retrieval.

BM25 (Best Match 25) is a probabilistic ranking function that scores
documents by term frequency, inverse document frequency, and document
length normalization. It catches exact keyword matches that dense
retrieval often misses (e.g. code identifiers, proper nouns, acronyms).

We persist the index to disk so it survives restarts without re-indexing.
"""

from __future__ import annotations

import json
import pickle
import re
from pathlib import Path
from typing import List

from rank_bm25 import BM25Okapi

from ingest.chunker import Chunk


def _tokenize(text: str) -> List[str]:
    """
    Simple whitespace + lowercase tokenizer.
    For production: add stemming (nltk SnowballStemmer) or
    language-aware tokenization.
    """
    text = text.lower()
    tokens = re.findall(r"\b\w+\b", text)
    return tokens


class BM25Index:
    """
    Wraps rank_bm25.BM25Okapi with:
      - Chunk metadata storage (so we can return full chunk payloads)
      - Disk persistence (pickle)
      - Additive indexing (call .add() as new docs arrive)
    """

    def __init__(self):
        self._chunks: List[dict] = []     # parallel to BM25 corpus
        self._corpus: List[List[str]] = []
        self._bm25: BM25Okapi | None = None

    # ------------------------------------------------------------------
    # Build / update
    # ------------------------------------------------------------------

    def add(self, chunks: List[Chunk]) -> None:
        """Add chunks to the index. Rebuilds BM25 internally."""
        for chunk in chunks:
            self._corpus.append(_tokenize(chunk.text))
            self._chunks.append({
                "chunk_id": chunk.id,
                "text": chunk.text,
                "source": chunk.source,
                "page": chunk.page,
                "chunk_index": chunk.chunk_index,
                "token_count": chunk.token_count,
            })

        # Rebuild BM25 (rank_bm25 doesn't support incremental updates)
        self._bm25 = BM25Okapi(self._corpus)
        print(f"[BM25Index] Index rebuilt — {len(self._chunks)} docs")

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    def search(self, query: str, top_k: int = 20) -> List[dict]:
        """
        BM25 retrieval.

        Returns list of dicts with keys:
          score, text, source, page, chunk_index, chunk_id
        """
        if self._bm25 is None:
            return []

        query_tokens = _tokenize(query)
        scores = self._bm25.get_scores(query_tokens)

        # Pair scores with chunk metadata, sort descending
        ranked = sorted(
            enumerate(scores), key=lambda x: x[1], reverse=True
        )[:top_k]

        results = []
        for idx, score in ranked:
            if score == 0:
                continue  # BM25 returns 0 for completely irrelevant docs
            entry = dict(self._chunks[idx])
            entry["score"] = float(score)
            results.append(entry)

        return results

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def save(self, path: str | Path) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(
                {"chunks": self._chunks, "corpus": self._corpus}, f
            )
        print(f"[BM25Index] Saved to {path}")

    def load(self, path: str | Path) -> None:
        path = Path(path)
        if not path.exists():
            print(f"[BM25Index] No index found at {path}, starting fresh")
            return
        with open(path, "rb") as f:
            data = pickle.load(f)
        self._chunks = data["chunks"]
        self._corpus = data["corpus"]
        self._bm25 = BM25Okapi(self._corpus)
        print(f"[BM25Index] Loaded {len(self._chunks)} docs from {path}")

    def __len__(self) -> int:
        return len(self._chunks)


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    from rich import print as rprint
    from ingest.chunker import DocumentChunker

    sample_docs = [
        "BM25 is a bag-of-words retrieval function used in information retrieval.",
        "Dense retrieval uses neural embeddings to encode semantic meaning.",
        "Hybrid search combines sparse BM25 with dense vector similarity.",
        "Reciprocal Rank Fusion merges multiple ranked lists into one.",
        "Cross-encoders score query-document pairs for precise re-ranking.",
    ]

    chunker = DocumentChunker(chunk_size=64, chunk_overlap=0)
    all_chunks = []
    for i, doc in enumerate(sample_docs):
        all_chunks.extend(chunker.chunk_text(doc, source=f"doc_{i}.txt"))

    index = BM25Index()
    index.add(all_chunks)

    query = "BM25 keyword sparse retrieval"
    results = index.search(query, top_k=3)

    rprint(f"\n[bold green]Query:[/bold green] {query}\n")
    for r in results:
        rprint(f"  score={r['score']:.4f} | {r['text'][:80]}")
