"""
Ants RAG layer — retrieval over the curated knowledge base in knowledge/.

BM25 keyword retrieval (rank-bm25): zero external services, deterministic,
good enough to ground a chat assistant on a small curated corpus. The
retrieve() contract is the only thing the rest of the app sees, so swapping
in embeddings (e.g. Voyage + a vector store) later is a one-file change.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from rank_bm25 import BM25Okapi

KNOWLEDGE_DIR = Path(__file__).parent / "knowledge"

_chunks: list[dict[str, Any]] = []
_index: BM25Okapi | None = None


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9₹%&+]+", text.lower())


def _load() -> None:
    global _index
    _chunks.clear()
    for path in sorted(KNOWLEDGE_DIR.glob("*.md")):
        raw = path.read_text(encoding="utf-8")
        # chunk on markdown headings; fall back to whole file
        parts = re.split(r"\n(?=#{1,3} )", raw)
        for part in parts:
            text = part.strip()
            if len(text) < 40:
                continue
            title = text.splitlines()[0].lstrip("# ").strip()
            _chunks.append({"source": path.stem, "title": title, "text": text})
    if _chunks:
        _index = BM25Okapi([_tokenize(c["text"]) for c in _chunks])


def chunk_count() -> int:
    if _index is None:
        _load()
    return len(_chunks)


def retrieve(query: str, k: int = 4) -> list[dict[str, Any]]:
    """Top-k knowledge chunks for a query: [{source, title, text, score}]."""
    if _index is None:
        _load()
    if not _chunks or _index is None:
        return []
    scores = _index.get_scores(_tokenize(query))
    ranked = sorted(zip(scores, range(len(_chunks))), reverse=True)[:k]
    return [
        {**_chunks[i], "score": round(float(s), 3)}
        for s, i in ranked
        if s > 0
    ]


_load()
