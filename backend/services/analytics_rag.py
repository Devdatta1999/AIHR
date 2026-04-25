"""RAG over the HR-Analytics knowledge base.

A separate Qdrant collection (`analytics_kpi_knowledge`) holds chunks of
the markdown files in `backend/data/analytics_kb/`:

    - kpi_definitions.md     — custom KPI formulas + reference SQL
    - nl_to_sql_examples.md  — few-shot anchors for the NL→SQL step
    - business_rules.md      — Nimbus-Labs-specific conventions

The agent calls `search()` once per turn and stuffs the top hits into the
NL→SQL prompt. If Qdrant is unreachable or the collection is empty, the
agent silently falls back to schema-only prompting.
"""
from __future__ import annotations

from typing import Any, Optional

from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer

from config import EMBEDDING_MODEL, QDRANT_URL

KB_COLLECTION = "analytics_kpi_knowledge"

_model: Optional[SentenceTransformer] = None
_client: Optional[QdrantClient] = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model


def _get_client() -> Optional[QdrantClient]:
    global _client
    if _client is None:
        try:
            _client = QdrantClient(url=QDRANT_URL, timeout=5.0)
        except Exception:
            _client = None
    return _client


def search(query: str, k: int = 5, min_score: float = 0.30) -> list[dict[str, Any]]:
    """Return top-k KB chunks above a soft relevance floor.

    Each hit is `{source, section, content, _score}`. We keep `min_score`
    permissive (0.30) so KPI lookups still hit even when the user's wording
    is loose; the agent decides whether to actually use a hit.
    """
    if not query.strip():
        return []
    client = _get_client()
    if client is None:
        return []
    try:
        existing = {c.name for c in client.get_collections().collections}
        if KB_COLLECTION not in existing:
            return []
        vec = _get_model().encode([query], normalize_embeddings=True)[0].tolist()
        hits = client.search(
            collection_name=KB_COLLECTION,
            query_vector=vec,
            limit=k,
            with_payload=True,
        )
    except Exception:
        return []
    out: list[dict[str, Any]] = []
    for h in hits:
        if (h.score or 0.0) < min_score:
            continue
        payload = dict(h.payload or {})
        payload["_score"] = float(h.score)
        out.append(payload)
    return out


def format_context(hits: list[dict[str, Any]]) -> str:
    """Render KB hits as a prompt-ready context block."""
    if not hits:
        return "(no analytics knowledge retrieved)"
    parts = []
    for i, h in enumerate(hits, 1):
        src = h.get("source", "?")
        section = h.get("section", "?")
        content = h.get("content", "")
        parts.append(f"[{i}] ({src} — {section})\n{content}")
    return "\n\n---\n\n".join(parts)


def hits_summary(hits: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Compact list for the chat-response payload (no raw content)."""
    return [
        {
            "source": h.get("source"),
            "section": h.get("section"),
            "score": round(float(h.get("_score", 0.0)), 3),
        }
        for h in hits
    ]
