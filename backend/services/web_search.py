"""Tavily web-search wrapper used by agents for fresh, external context."""
from __future__ import annotations

from typing import Any

from tavily import TavilyClient

from config import TAVILY_API_KEY

_client: TavilyClient | None = None


def _get_client() -> TavilyClient:
    global _client
    if _client is None:
        if not TAVILY_API_KEY:
            raise RuntimeError("TAVILY_API_KEY is not set in backend/.env")
        _client = TavilyClient(api_key=TAVILY_API_KEY)
    return _client


def search(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    """Return a list of {title, url, content} dicts. Safe on failure (returns [])."""
    if not query.strip() or not TAVILY_API_KEY:
        return []
    try:
        resp = _get_client().search(
            query=query,
            search_depth="basic",
            max_results=max_results,
            include_answer=False,
        )
    except Exception:
        return []
    items = resp.get("results", []) if isinstance(resp, dict) else []
    return [
        {
            "title": it.get("title", ""),
            "url": it.get("url", ""),
            "content": (it.get("content") or "")[:600],
        }
        for it in items
    ]


def format_results(results: list[dict[str, Any]]) -> str:
    if not results:
        return "(no web results)"
    lines = []
    for i, r in enumerate(results, 1):
        lines.append(f"[{i}] {r.get('title', '')}\n{r.get('url', '')}\n{r.get('content', '')}")
    return "\n\n".join(lines)
