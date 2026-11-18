"""
pipeline.py
-----------
Orchestrates the full ingest flow:
  1. Load & chunk document
  2. Embed chunks (dense)
  3. Upsert to Qdrant (dense index)
  4. Add to BM25 index (sparse index)
  5. Persist BM25 to disk

This is the single entry point called by the FastAPI ingest endpoint
and the CLI ingest script.
"""

from __future__ import annotations

import os
import time
from pathlib import Path
from typing import List

from rich import print as rprint
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn

from ingest.chunker import DocumentChunker, Chunk
from ingest.embedder import Embedder
from ingest.vector_store import VectorStore
from ingest.bm25_index import BM25Index


BM25_INDEX_PATH = Path(os.getenv("BM25_INDEX_PATH", "data/bm25_index.pkl"))


class IngestPipeline:
    """
    Full ingest pipeline.

    Usage:
        pipeline = IngestPipeline()
        result = pipeline.ingest_file("docs/my_doc.pdf")
        result = pipeline.ingest_text("raw text...", source="api_input")
    """

    def __init__(self):
        self.chunker = DocumentChunker()
        self.embedder = Embedder()
        self.vector_store = VectorStore(dimension=self.embedder.dimension)
        self.bm25 = BM25Index()

        # Load existing BM25 index if present
        self.bm25.load(BM25_INDEX_PATH)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def ingest_file(self, path: str | Path) -> dict:
        """Ingest a file from disk."""
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {path}")

        rprint(f"\n[bold]Ingesting:[/bold] {path.name}")
        t0 = time.perf_counter()

        chunks = self._run_with_progress(
            "Chunking document…",
            lambda: self.chunker.chunk_file(path),
        )

        return self._index_chunks(chunks, elapsed_start=t0)

    def ingest_text(self, text: str, source: str = "inline") -> dict:
        """Ingest a raw string (useful for API endpoint / tests)."""
        rprint(f"\n[bold]Ingesting text:[/bold] source={source}")
        t0 = time.perf_counter()

        chunks = self.chunker.chunk_text(text, source=source)
        return self._index_chunks(chunks, elapsed_start=t0)

    def ingest_directory(self, dir_path: str | Path) -> List[dict]:
        """Ingest all supported files in a directory."""
        dir_path = Path(dir_path)
        supported = {".pdf", ".txt", ".md", ".docx"}
        files = [f for f in dir_path.rglob("*") if f.suffix.lower() in supported]

        if not files:
            rprint(f"[yellow]No supported files found in {dir_path}[/yellow]")
            return []

        rprint(f"[bold]Found {len(files)} files to ingest[/bold]")
        results = []
        for f in files:
            try:
                result = self.ingest_file(f)
                results.append(result)
            except Exception as e:
                rprint(f"[red]Error ingesting {f.name}: {e}[/red]")

        return results

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _index_chunks(self, chunks: List[Chunk], elapsed_start: float) -> dict:
        if not chunks:
            return {"status": "empty", "chunks": 0}

        rprint(f"  [dim]→ {len(chunks)} chunks created[/dim]")

        # Dense: embed + upsert to Qdrant
        vectors = self._run_with_progress(
            f"Embedding {len(chunks)} chunks…",
            lambda: self.embedder.embed_chunks(chunks),
        )

        self._run_with_progress(
            "Upserting to vector store…",
            lambda: self.vector_store.upsert(chunks, vectors),
        )

        # Sparse: add to BM25 and persist
        self._run_with_progress(
            "Updating BM25 index…",
            lambda: self.bm25.add(chunks),
        )

        self.bm25.save(BM25_INDEX_PATH)

        elapsed = time.perf_counter() - elapsed_start
        result = {
            "status": "ok",
            "chunks": len(chunks),
            "sources": list({c.source for c in chunks}),
            "elapsed_s": round(elapsed, 2),
            "vector_store_total": self.vector_store.count(),
            "bm25_total": len(self.bm25),
        }

        rprint(f"\n[bold green]✓ Ingest complete[/bold green]")
        rprint(f"  chunks={result['chunks']} | "
               f"qdrant_total={result['vector_store_total']} | "
               f"bm25_total={result['bm25_total']} | "
               f"elapsed={result['elapsed_s']}s")

        return result

    def _run_with_progress(self, label: str, fn):
        with Progress(
            SpinnerColumn(),
            TextColumn(f"  {label}"),
            transient=True,
        ) as progress:
            progress.add_task("", total=None)
            return fn()


# ---------------------------------------------------------------------------
# CLI entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        rprint("[yellow]Usage: python -m ingest.pipeline <path_or_dir>[/yellow]")
        sys.exit(1)

    target = Path(sys.argv[1])
    pipeline = IngestPipeline()

    if target.is_dir():
        pipeline.ingest_directory(target)
    else:
        pipeline.ingest_file(target)
