"""
chunker.py
----------
Loads documents (PDF, TXT, DOCX) and splits them into overlapping
token-aware chunks. Each chunk carries full source metadata so the
agent can cite exactly where an answer came from.
"""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass, field
from pathlib import Path

import tiktoken

# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class Chunk:
    """A single text chunk with provenance metadata."""
    id: str                      # deterministic SHA-256 of (source + start)
    text: str
    source: str                  # filename
    page: int | None             # page number if available
    chunk_index: int             # position in document
    token_count: int
    metadata: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Core chunker
# ---------------------------------------------------------------------------

class DocumentChunker:
    """
    Token-aware sliding-window chunker.

    Uses tiktoken (cl100k_base) for accurate token counting so chunks
    respect context-window limits regardless of language or whitespace.
    """

    def __init__(
        self,
        chunk_size: int = int(os.getenv("CHUNK_SIZE", 512)),
        chunk_overlap: int = int(os.getenv("CHUNK_OVERLAP", 64)),
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self._enc = tiktoken.get_encoding("cl100k_base")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def chunk_file(self, path: str | Path) -> list[Chunk]:
        """Auto-detect file type and return chunks."""
        path = Path(path)
        suffix = path.suffix.lower()

        if suffix == ".pdf":
            pages = self._load_pdf(path)
        elif suffix == ".txt" or suffix == ".md":
            pages = self._load_text(path)
        elif suffix == ".docx":
            pages = self._load_docx(path)
        else:
            raise ValueError(f"Unsupported file type: {suffix}")

        chunks: list[Chunk] = []
        for page_num, text in pages:
            chunks.extend(self._sliding_window(text, path.name, page_num))

        return chunks

    def chunk_text(self, text: str, source: str = "inline") -> list[Chunk]:
        """Chunk a raw string directly (useful for tests / API ingestion)."""
        return self._sliding_window(text, source, page=None)

    # ------------------------------------------------------------------
    # Loaders
    # ------------------------------------------------------------------

    def _load_pdf(self, path: Path) -> list[tuple[int, str]]:
        from pypdf import PdfReader
        reader = PdfReader(str(path))
        pages = []
        for i, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            if text.strip():
                pages.append((i, text))
        return pages

    def _load_text(self, path: Path) -> list[tuple[int, str]]:
        text = path.read_text(encoding="utf-8", errors="replace")
        return [(1, text)]

    def _load_docx(self, path: Path) -> list[tuple[int, str]]:
        from docx import Document
        doc = Document(str(path))
        full_text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        return [(1, full_text)]

    # ------------------------------------------------------------------
    # Sliding window
    # ------------------------------------------------------------------

    def _sliding_window(
        self,
        text: str,
        source: str,
        page: int | None,
    ) -> list[Chunk]:
        """
        Tokenize → slide a window of `chunk_size` tokens with
        `chunk_overlap` tokens of overlap between consecutive chunks.
        """
        tokens = self._enc.encode(text)
        chunks: list[Chunk] = []
        step = self.chunk_size - self.chunk_overlap
        idx = 0

        while idx < len(tokens):
            window = tokens[idx : idx + self.chunk_size]
            chunk_text = self._enc.decode(window)

            chunk_id = hashlib.sha256(
                f"{source}:{page}:{idx}".encode()
            ).hexdigest()[:16]

            chunks.append(
                Chunk(
                    id=chunk_id,
                    text=chunk_text,
                    source=source,
                    page=page,
                    chunk_index=len(chunks),
                    token_count=len(window),
                )
            )

            idx += step
            if idx + self.chunk_size > len(tokens) and idx < len(tokens):
                # Capture final partial window without duplicate
                break

        return chunks


# ---------------------------------------------------------------------------
# Quick smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    from rich import print as rprint

    sample = """
    Retrieval-Augmented Generation (RAG) is a technique that enhances large
    language models by grounding their responses in retrieved documents.
    Instead of relying solely on parametric knowledge baked in during training,
    RAG pulls relevant passages from an external corpus at inference time and
    provides them as context to the model. This reduces hallucination and allows
    the model to cite its sources directly.

    Hybrid RAG combines dense retrieval (embedding similarity) with sparse
    retrieval (BM25 keyword matching). Dense retrieval excels at semantic
    similarity while sparse retrieval captures exact keyword matches. Fusing
    both via Reciprocal Rank Fusion (RRF) produces a more robust result set
    than either method alone.
    """ * 10  # repeat to generate multiple chunks

    chunker = DocumentChunker(chunk_size=128, chunk_overlap=20)
    chunks = chunker.chunk_text(sample, source="test_doc.txt")

    rprint(f"\n[bold green]✓ Generated {len(chunks)} chunks[/bold green]\n")
    for c in chunks[:3]:
        rprint(f"  [cyan]chunk {c.chunk_index}[/cyan] | id={c.id} | tokens={c.token_count}")
        rprint(f"  {c.text[:80]}…\n")
