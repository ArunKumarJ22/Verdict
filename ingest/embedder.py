"""
embedder.py
-----------
Wraps sentence-transformers to produce dense embedding vectors for chunks.

Design decisions:
  - Lazy model load (only downloads on first use)
  - Batch encoding for throughput
  - Returns plain numpy arrays — no framework lock-in
"""

from __future__ import annotations

import os
from typing import List

import numpy as np
from sentence_transformers import SentenceTransformer

from ingest.chunker import Chunk


class Embedder:
    """
    Encodes text chunks into dense float32 vectors.

    Model default: all-MiniLM-L6-v2
      - 384-dim vectors
      - Fast on CPU, good quality for RAG
      - Can swap for larger models (e7b, bge-large) via EMBED_MODEL env var
    """

    def __init__(self, model_name: str | None = None):
        self.model_name = model_name or os.getenv("EMBED_MODEL", "all-MiniLM-L6-v2")
        self._model: SentenceTransformer | None = None  # lazy load

    @property
    def model(self) -> SentenceTransformer:
        if self._model is None:
            print(f"[Embedder] Loading model: {self.model_name}")
            self._model = SentenceTransformer(self.model_name)
        return self._model

    @property
    def dimension(self) -> int:
        return self.model.get_sentence_embedding_dimension()

    def embed_chunks(self, chunks: List[Chunk], batch_size: int = 64) -> List[np.ndarray]:
        """
        Encode a list of Chunk objects → list of float32 numpy arrays.
        Order is preserved.
        """
        texts = [c.text for c in chunks]
        return self.embed_texts(texts, batch_size=batch_size)

    def embed_texts(self, texts: List[str], batch_size: int = 64) -> List[np.ndarray]:
        """
        Encode raw strings. Returns list of numpy float32 vectors.
        Each vector is shape (dimension,).
        """
        vectors = self.model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=len(texts) > 100,
            convert_to_numpy=True,
            normalize_embeddings=True,  # cosine similarity via dot product
        )
        return [v.astype(np.float32) for v in vectors]

    def embed_query(self, query: str) -> np.ndarray:
        """Single query embedding — used at retrieval time."""
        result = self.model.encode(
            [query],
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        return result[0].astype(np.float32)


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    from rich import print as rprint

    embedder = Embedder()
    rprint(f"[bold]Model:[/bold] {embedder.model_name}")
    rprint(f"[bold]Dimension:[/bold] {embedder.dimension}")

    test_texts = [
        "Hybrid RAG combines dense and sparse retrieval.",
        "BM25 is a classic sparse retrieval algorithm.",
        "Cross-encoders re-rank candidates for better relevance.",
    ]

    vectors = embedder.embed_texts(test_texts)
    for text, vec in zip(test_texts, vectors):
        rprint(f"\n  [cyan]{text[:50]}[/cyan]")
        rprint(f"  shape={vec.shape}  |  norm={np.linalg.norm(vec):.4f}")

    # Similarity check — first two should be more similar than 1 and 3
    sim_01 = float(np.dot(vectors[0], vectors[1]))
    sim_02 = float(np.dot(vectors[0], vectors[2]))
    rprint(f"\n[bold green]Similarity checks:[/bold green]")
    rprint(f"  RAG vs BM25:        {sim_01:.4f}")
    rprint(f"  RAG vs cross-enc:   {sim_02:.4f}")
