"""
cross_encoder.py
----------------
Re-ranks retrieval candidates using a cross-encoder model.

Bi-encoder (embeddings) vs Cross-encoder:
  - Bi-encoder:    encodes query and doc SEPARATELY → fast, scalable,
                   but loses query-doc interaction signal
  - Cross-encoder: encodes (query, doc) JOINTLY → slower, but sees
                   the full interaction → much higher precision

We use cross-encoder only on the top ~20-40 RRF candidates (not the
full corpus), making it computationally affordable while capturing the
quality gain.

Default model: cross-encoder/ms-marco-MiniLM-L-6-v2
  - Trained on MS MARCO passage ranking
  - Outputs a raw relevance logit (higher = more relevant)
  - ~22M params, runs fine on CPU
"""

from __future__ import annotations

import os
from typing import List

from sentence_transformers import CrossEncoder


class Reranker:
    """
    Cross-encoder re-ranker.

    Takes the fused candidates from HybridRetriever and re-scores
    them against the original query. Returns top_k by cross-encoder
    score.
    """

    def __init__(self, model_name: str | None = None):
        self.model_name = model_name or os.getenv(
            "RERANK_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2"
        )
        self._model: CrossEncoder | None = None  # lazy load

    @property
    def model(self) -> CrossEncoder:
        if self._model is None:
            print(f"[Reranker] Loading model: {self.model_name}")
            self._model = CrossEncoder(self.model_name, max_length=512)
        return self._model

    def rerank(
        self,
        query: str,
        candidates: List[dict],
        top_k: int | None = None,
    ) -> List[dict]:
        """
        Re-rank candidates against query.

        Args:
            query:      The user's search query
            candidates: List of dicts from HybridRetriever (must have 'text')
            top_k:      How many to return (default: RERANK_TOP_K env var or 5)

        Returns:
            Sorted list of candidates with 'rerank_score' added.
        """
        top_k = top_k or int(os.getenv("RERANK_TOP_K", 5))

        if not candidates:
            return []

        # Build (query, passage) pairs for the cross-encoder
        pairs = [(query, c["text"]) for c in candidates]

        # Score all pairs in one batch
        scores = self.model.predict(pairs, show_progress_bar=False)

        # Attach scores and sort
        scored = []
        for candidate, score in zip(candidates, scores):
            entry = dict(candidate)
            entry["rerank_score"] = float(score)
            scored.append(entry)

        scored.sort(key=lambda x: x["rerank_score"], reverse=True)

        return scored[:top_k]


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    from rich import print as rprint

    # Simulate candidates coming out of hybrid retrieval
    mock_candidates = [
        {"chunk_id": "a1", "text": "BM25 ranks documents by term frequency and inverse document frequency.", "source": "ir.txt", "page": 1, "chunk_index": 0, "rrf_score": 0.03},
        {"chunk_id": "a2", "text": "Dense retrieval encodes text into continuous vector spaces.", "source": "ml.txt", "page": 1, "chunk_index": 1, "rrf_score": 0.025},
        {"chunk_id": "a3", "text": "Hybrid search combines sparse and dense methods for better recall.", "source": "rag.txt", "page": 2, "chunk_index": 0, "rrf_score": 0.02},
        {"chunk_id": "a4", "text": "Cross-encoders jointly encode query and document for precise scoring.", "source": "rerank.txt", "page": 1, "chunk_index": 0, "rrf_score": 0.015},
        {"chunk_id": "a5", "text": "The weather in Paris is mild in spring.", "source": "misc.txt", "page": 1, "chunk_index": 0, "rrf_score": 0.01},
    ]

    query = "how does hybrid retrieval work"

    reranker = Reranker()
    results = reranker.rerank(query, mock_candidates, top_k=3)

    rprint(f"\n[bold green]Query:[/bold green] {query}\n")
    rprint("[bold]Re-ranked results:[/bold]")
    for i, r in enumerate(results, 1):
        rprint(f"  {i}. rerank_score={r['rerank_score']:.4f} | rrf_score={r['rrf_score']:.4f}")
        rprint(f"     {r['text'][:90]}")
