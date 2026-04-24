"""Embed company-knowledge markdown and upsert into Qdrant.

Run from backend/:
    python -m scripts.ingest_knowledge
"""
from __future__ import annotations

import hashlib
import re
import sys
import uuid
from pathlib import Path

from qdrant_client import QdrantClient
from qdrant_client.http import models as qm
from sentence_transformers import SentenceTransformer

from config import EMBEDDING_MODEL, QDRANT_COLLECTION, QDRANT_URL

KNOWLEDGE_DIR = Path(__file__).resolve().parents[1] / "data" / "knowledge"
EMBED_DIM = 384  # all-MiniLM-L6-v2


def chunk_markdown(text: str, source: str) -> list[dict]:
    """Split a markdown doc into section-based chunks.

    One chunk per H2 (##) section. If a section is long (>1200 chars),
    split it on H3 (###) boundaries. Each chunk carries source + section title.
    """
    lines = text.splitlines()
    # Find top-level title (H1) for doc title
    doc_title = source
    for line in lines:
        if line.startswith("# "):
            doc_title = line[2:].strip()
            break

    chunks: list[dict] = []
    current_section = "intro"
    current_sub = None
    buf: list[str] = []

    def flush():
        if not buf:
            return
        body = "\n".join(buf).strip()
        if not body:
            buf.clear()
            return
        title = current_section if not current_sub else f"{current_section} — {current_sub}"
        chunks.append(
            {
                "source": source,
                "doc_title": doc_title,
                "section": title,
                "content": f"[{doc_title} / {title}]\n{body}",
            }
        )
        buf.clear()

    for line in lines:
        if line.startswith("## "):
            flush()
            current_section = line[3:].strip()
            current_sub = None
        elif line.startswith("### "):
            flush()
            current_sub = line[4:].strip()
        elif line.startswith("# "):
            continue
        else:
            buf.append(line)
    flush()

    # If any chunk is over 1800 chars, split on blank lines
    final: list[dict] = []
    for c in chunks:
        body = c["content"]
        if len(body) <= 1800:
            final.append(c)
            continue
        parts = re.split(r"\n\n+", body)
        acc = ""
        for p in parts:
            if len(acc) + len(p) + 2 > 1500 and acc:
                final.append({**c, "content": acc.strip()})
                acc = p
            else:
                acc = acc + "\n\n" + p if acc else p
        if acc.strip():
            final.append({**c, "content": acc.strip()})
    return final


def deterministic_id(source: str, section: str, content: str) -> str:
    digest = hashlib.sha1(f"{source}|{section}|{content}".encode("utf-8")).digest()
    return str(uuid.UUID(bytes=digest[:16]))


def main() -> int:
    files = sorted(KNOWLEDGE_DIR.glob("*.md"))
    if not files:
        print(f"No markdown found in {KNOWLEDGE_DIR}")
        return 1
    print(f"Loading {len(files)} knowledge files from {KNOWLEDGE_DIR}")

    all_chunks: list[dict] = []
    for f in files:
        text = f.read_text(encoding="utf-8")
        chunks = chunk_markdown(text, source=f.name)
        print(f"  {f.name}: {len(chunks)} chunks")
        all_chunks.extend(chunks)

    if not all_chunks:
        print("No chunks produced.")
        return 1

    print(f"Loading embedding model: {EMBEDDING_MODEL}")
    model = SentenceTransformer(EMBEDDING_MODEL)

    texts = [c["content"] for c in all_chunks]
    print(f"Embedding {len(texts)} chunks…")
    vectors = model.encode(texts, normalize_embeddings=True, show_progress_bar=True)

    client = QdrantClient(url=QDRANT_URL)
    existing = {c.name for c in client.get_collections().collections}
    if QDRANT_COLLECTION in existing:
        print(f"Recreating collection '{QDRANT_COLLECTION}'")
        client.delete_collection(QDRANT_COLLECTION)
    client.create_collection(
        collection_name=QDRANT_COLLECTION,
        vectors_config=qm.VectorParams(size=EMBED_DIM, distance=qm.Distance.COSINE),
    )

    points = [
        qm.PointStruct(
            id=deterministic_id(c["source"], c["section"], c["content"]),
            vector=vec.tolist(),
            payload=c,
        )
        for c, vec in zip(all_chunks, vectors)
    ]
    client.upsert(collection_name=QDRANT_COLLECTION, points=points)
    print(f"Upserted {len(points)} points into '{QDRANT_COLLECTION}' at {QDRANT_URL}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
