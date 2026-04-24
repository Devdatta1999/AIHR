"""Thin RAG wrapper: embed query -> Qdrant search -> return top-k payloads.

The embedding model is loaded once per process (lazy). Qdrant is assumed
to already hold the `company_knowledge` collection (see scripts/ingest_knowledge.py).
"""
from __future__ import annotations

from typing import Any, Optional

from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer

from config import EMBEDDING_MODEL, QDRANT_COLLECTION, QDRANT_URL

_model: Optional[SentenceTransformer] = None
_client: Optional[QdrantClient] = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model


def _get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(url=QDRANT_URL)
    return _client


def search(query: str, k: int = 6) -> list[dict[str, Any]]:
    """Return top-k payloads (dicts) from the knowledge collection."""
    if not query.strip():
        return []
    model = _get_model()
    client = _get_client()
    vec = model.encode([query], normalize_embeddings=True)[0].tolist()
    hits = client.search(
        collection_name=QDRANT_COLLECTION,
        query_vector=vec,
        limit=k,
        with_payload=True,
    )
    out: list[dict[str, Any]] = []
    for h in hits:
        payload = dict(h.payload or {})
        payload["_score"] = float(h.score)
        out.append(payload)
    return out


def search_multi(queries: list[str], k_per_query: int = 4, k_total: int = 8) -> list[dict[str, Any]]:
    """Run several queries, dedupe by section, keep top-`k_total` by score."""
    seen: dict[str, dict[str, Any]] = {}
    for q in queries:
        for hit in search(q, k=k_per_query):
            key = f"{hit.get('source')}::{hit.get('section')}"
            if key not in seen or hit["_score"] > seen[key]["_score"]:
                seen[key] = hit
    ranked = sorted(seen.values(), key=lambda h: h["_score"], reverse=True)
    return ranked[:k_total]


def format_context(hits: list[dict[str, Any]]) -> str:
    """Render retrieved chunks as a single prompt-ready context block."""
    if not hits:
        return "(no internal context retrieved)"
    parts = []
    for i, h in enumerate(hits, 1):
        src = h.get("source", "?")
        section = h.get("section", "?")
        content = h.get("content", "")
        parts.append(f"[{i}] ({src} — {section})\n{content}")
    return "\n\n---\n\n".join(parts)
