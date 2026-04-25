"""Semantic cache for the HR-Analytics chatbot.

Layout:
    Qdrant collection `analytics_semantic_cache` — one point per cached
    natural-language query. Vector = embedding of the user question.
    Payload = {query, sql, columns, rows, chart, insight, cached_at}.

Lookup:
    embed(question) -> Qdrant search top-1 by cosine -> if score >= threshold
    return cached payload, else miss.

Both reads and writes degrade gracefully — if Qdrant is unreachable the
agent still answers (just without cache benefits).
"""
from __future__ import annotations

import hashlib
import time
import uuid
from typing import Any, Optional

from qdrant_client import QdrantClient
from qdrant_client.http import models as qm
from sentence_transformers import SentenceTransformer

from config import EMBEDDING_MODEL, QDRANT_URL

CACHE_COLLECTION = "analytics_semantic_cache"
EMBED_DIM = 384  # all-MiniLM-L6-v2
DEFAULT_THRESHOLD = 0.70

_model: Optional[SentenceTransformer] = None
_client: Optional[QdrantClient] = None
_ensured = False


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


def _ensure_collection() -> bool:
    """Create the cache collection on first use. Idempotent."""
    global _ensured
    if _ensured:
        return True
    client = _get_client()
    if client is None:
        return False
    try:
        existing = {c.name for c in client.get_collections().collections}
        if CACHE_COLLECTION not in existing:
            client.create_collection(
                collection_name=CACHE_COLLECTION,
                vectors_config=qm.VectorParams(
                    size=EMBED_DIM, distance=qm.Distance.COSINE
                ),
            )
        _ensured = True
        return True
    except Exception:
        return False


def _embed(text: str) -> list[float]:
    return _get_model().encode([text], normalize_embeddings=True)[0].tolist()


def lookup(query: str, threshold: float = DEFAULT_THRESHOLD) -> Optional[dict[str, Any]]:
    """Return cached payload + similarity if score >= threshold, else None.

    Shape:
        {"similarity": 0.0-1.0, "payload": {...}}
    """
    if not query.strip() or not _ensure_collection():
        return None
    client = _get_client()
    if client is None:
        return None
    try:
        vec = _embed(query)
        hits = client.search(
            collection_name=CACHE_COLLECTION,
            query_vector=vec,
            limit=1,
            with_payload=True,
        )
    except Exception:
        return None
    if not hits:
        return None
    top = hits[0]
    score = float(top.score or 0.0)
    if score < threshold:
        return None
    return {"similarity": score, "payload": dict(top.payload or {})}


def upsert(query: str, payload: dict[str, Any]) -> bool:
    """Store an answered query so paraphrases hit the cache next time."""
    if not query.strip() or not _ensure_collection():
        return False
    client = _get_client()
    if client is None:
        return False
    try:
        vec = _embed(query)
        # Stable id per query so identical questions overwrite, not duplicate.
        digest = hashlib.sha1(query.strip().lower().encode("utf-8")).digest()
        point_id = str(uuid.UUID(bytes=digest[:16]))
        full_payload = {**payload, "query": query, "cached_at": int(time.time())}
        client.upsert(
            collection_name=CACHE_COLLECTION,
            points=[qm.PointStruct(id=point_id, vector=vec, payload=full_payload)],
        )
        return True
    except Exception:
        return False


def clear() -> bool:
    """Demo helper — drop and recreate the cache collection."""
    client = _get_client()
    if client is None:
        return False
    try:
        existing = {c.name for c in client.get_collections().collections}
        if CACHE_COLLECTION in existing:
            client.delete_collection(CACHE_COLLECTION)
        client.create_collection(
            collection_name=CACHE_COLLECTION,
            vectors_config=qm.VectorParams(
                size=EMBED_DIM, distance=qm.Distance.COSINE
            ),
        )
        return True
    except Exception:
        return False
