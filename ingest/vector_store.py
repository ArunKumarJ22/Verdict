"""
vector_store.py
---------------
Qdrant wrapper for storing and searching dense embeddings.

Qdrant is a production-grade vector database with:
  - Persistent storage (not in-memory like FAISS)
  - Payload filtering (filter by source, page, etc.)
  - Easy Docker deployment
  - REST + gRPC API

Collection schema per point:
  id:      str (chunk.id)
  vector:  float32[384]
  payload: { text, source, page, chunk_index, token_count }
"""

from __future__ import annotations

import os
from typing import List

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from ingest.chunker import Chunk


class VectorStore:
    """
    Thin Qdrant client wrapper.

    Handles:
      - Collection creation (idempotent)
      - Batch upsert of chunk embeddings
      - Dense similarity search with optional payload filtering
    """

    def __init__(
        self,
        host: str | None = None,
        port: int | None = None,
        collection: str | None = None,
        dimension: int = 384,
    ):
        self.collection = collection or os.getenv("QDRANT_COLLECTION", "agent_rag_docs")
        self.dimension = dimension

        # Qdrant Cloud: set QDRANT_URL + QDRANT_API_KEY in env
        # Local Docker: set QDRANT_HOST + QDRANT_PORT (defaults: localhost:6333)
        qdrant_url = os.getenv("QDRANT_URL")
        qdrant_api_key = os.getenv("QDRANT_API_KEY")

        if qdrant_url:
            # Cloud mode — URL-based connection with API key
            self._client = QdrantClient(url=qdrant_url, api_key=qdrant_api_key)
            print(f"[VectorStore] Connected to Qdrant Cloud: {qdrant_url}")
        else:
            # Local mode — host/port
            self.host = host or os.getenv("QDRANT_HOST", "localhost")
            self.port = int(port or os.getenv("QDRANT_PORT", 6333))
            self._client = QdrantClient(host=self.host, port=self.port)
            print(f"[VectorStore] Connected to local Qdrant: {self.host}:{self.port}")

        self._ensure_collection()

    # ------------------------------------------------------------------
    # Setup
    # ------------------------------------------------------------------

    def _ensure_collection(self) -> None:
        """Create collection if it doesn't exist. Safe to call multiple times."""
        existing = {c.name for c in self._client.get_collections().collections}
        if self.collection not in existing:
            self._client.create_collection(
                collection_name=self.collection,
                vectors_config=qmodels.VectorParams(
                    size=self.dimension,
                    distance=qmodels.Distance.COSINE,
                ),
            )
            print(f"[VectorStore] Created collection: {self.collection}")
        else:
            print(f"[VectorStore] Using existing collection: {self.collection}")

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def upsert(self, chunks: List[Chunk], vectors: List) -> None:
        """
        Store chunks and their vectors in Qdrant.

        Args:
            chunks:  List of Chunk objects (provides metadata)
            vectors: Parallel list of numpy float32 arrays
        """
        points = [
            qmodels.PointStruct(
                id=abs(hash(chunk.id)) % (2**63),  # Qdrant needs uint64 id
                vector=vector.tolist(),
                payload={
                    "chunk_id": chunk.id,
                    "text": chunk.text,
                    "source": chunk.source,
                    "page": chunk.page,
                    "chunk_index": chunk.chunk_index,
                    "token_count": chunk.token_count,
                },
            )
            for chunk, vector in zip(chunks, vectors)
        ]

        self._client.upsert(collection_name=self.collection, points=points)
        print(f"[VectorStore] Upserted {len(points)} points")

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    def search(
        self,
        query_vector,
        top_k: int = 20,
        source_filter: str | None = None,
    ) -> List[dict]:
        """
        Dense similarity search.

        Returns list of dicts with keys:
          score, text, source, page, chunk_index, chunk_id
        """
        query_filter = None
        if source_filter:
            query_filter = qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="source",
                        match=qmodels.MatchValue(value=source_filter),
                    )
                ]
            )

        results = self._client.search(
            collection_name=self.collection,
            query_vector=query_vector.tolist(),
            limit=top_k,
            query_filter=query_filter,
            with_payload=True,
        )

        return [
            {
                "score": hit.score,
                "text": hit.payload["text"],
                "source": hit.payload["source"],
                "page": hit.payload.get("page"),
                "chunk_index": hit.payload["chunk_index"],
                "chunk_id": hit.payload["chunk_id"],
            }
            for hit in results
        ]

    def count(self) -> int:
        return self._client.count(collection_name=self.collection).count

    def delete_collection(self) -> None:
        """Hard reset — useful during development."""
        self._client.delete_collection(self.collection)
        print(f"[VectorStore] Deleted collection: {self.collection}")