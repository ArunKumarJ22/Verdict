"""
hybrid_retriever.py
-------------------
Combines dense (Qdrant) and sparse (BM25) retrieval via
Reciprocal Rank Fusion (RRF).

Why RRF?
  - Doesn't require score normalization (dense and sparse scores
    are on completely different scales)
  - Empirically outperforms simple score averaging
  - O(n) to compute, no extra model needed

RRF formula:
  RRF(d) = Σ 1 / (k + rank(d))
  where k=60 is a smoothing constant (standard from the original paper)
  and rank(d) is the 1-based position of document d in each list.
"""

from __future__ import annotations

import os
from typing import List, Dict

from ingest.embedder import Embedder
from ingest.vector_store import VectorStore
from ingest.bm25_index import BM25Index


RRF_K = 60  # smoothing constant from "Reciprocal Rank Fusion" Cormack et al. 2009


class HybridRetriever:
    """
    Two-stage retriever:
      Stage 1 — Dense search  (Qdrant cosine similarity)
      Stage 1 — Sparse search (BM25 keyword match)
      Stage 2 — RRF fusion    (merge ranked lists)

    The fused candidates are then passed to the re-ranker.
    """

    def __init__(
        self,
        embedder: Embedder,
        vector_store: VectorStore,
        bm25_index: BM25Index,
        dense_top_k: int | None = None,
        sparse_top_k: int | None = None,
    ):
        self.embedder = embedder
        self.vector_store = vector_store
        self.bm25 = bm25_index
        self.dense_top_k = dense_top_k or int(os.getenv("DENSE_TOP_K", 20))
        self.sparse_top_k = sparse_top_k or int(os.getenv("SPARSE_TOP_K", 20))

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    def retrieve(self, query: str) -> List[dict]:
        """
        Run hybrid retrieval and return RRF-fused candidates.

        Each result dict:
          rrf_score, text, source, page, chunk_index, chunk_id,
          dense_rank (None if not in dense results),
          sparse_rank (None if not in sparse results)
        """
        # 1. Dense retrieval
        query_vec = self.embedder.embed_query(query)
        dense_results = self.vector_store.search(query_vec, top_k=self.dense_top_k)

        # 2. Sparse retrieval
        sparse_results = self.bm25.search(query, top_k=self.sparse_top_k)

        # 3. RRF fusion
        fused = self._rrf_fuse(dense_results, sparse_results)

        return fused

    # ------------------------------------------------------------------
    # RRF
    # ------------------------------------------------------------------

    def _rrf_fuse(
        self,
        dense: List[dict],
        sparse: List[dict],
    ) -> List[dict]:
        """
        Merge two ranked lists with Reciprocal Rank Fusion.

        Uses chunk_id as the deduplication key.
        """
        # Map chunk_id → metadata for all candidates
        candidates: Dict[str, dict] = {}

        for rank, item in enumerate(dense, start=1):
            cid = item["chunk_id"]
            if cid not in candidates:
                candidates[cid] = dict(item)
                candidates[cid]["dense_rank"] = rank
                candidates[cid]["sparse_rank"] = None
                candidates[cid]["rrf_score"] = 0.0
            candidates[cid]["rrf_score"] += 1.0 / (RRF_K + rank)
            candidates[cid]["dense_rank"] = rank

        for rank, item in enumerate(sparse, start=1):
            cid = item["chunk_id"]
            if cid not in candidates:
                candidates[cid] = dict(item)
                candidates[cid]["dense_rank"] = None
                candidates[cid]["sparse_rank"] = rank
                candidates[cid]["rrf_score"] = 0.0
            candidates[cid]["rrf_score"] += 1.0 / (RRF_K + rank)
            candidates[cid]["sparse_rank"] = rank

        # Sort by RRF score descending
        fused = sorted(
            candidates.values(),
            key=lambda x: x["rrf_score"],
            reverse=True,
        )

        return fused

    def stats(self, results: List[dict]) -> dict:
        """Return breakdown of how many results came from each source."""
        dense_only = sum(1 for r in results if r.get("sparse_rank") is None)
        sparse_only = sum(1 for r in results if r.get("dense_rank") is None)
        both = sum(
            1 for r in results
            if r.get("dense_rank") is not None and r.get("sparse_rank") is not None
        )
        return {"dense_only": dense_only, "sparse_only": sparse_only, "both": both}
