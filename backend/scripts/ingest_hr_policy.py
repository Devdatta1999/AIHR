"""Embed the HR policy markdown into Qdrant + render a viewable PDF.

Run from backend/:
    python -m scripts.ingest_hr_policy

What this does:
  1. Reads `backend/data/hr_policies/hr_policy.md` (single source of truth).
  2. Section-chunks the markdown by H2 (with H3 sub-splits for long sections).
  3. Embeds every chunk with sentence-transformers/all-MiniLM-L6-v2.
  4. Recreates the Qdrant collection `hr_policy_knowledge` and upserts the
     chunks. This collection is scoped to HR Queries so it stays separate from
     `company_knowledge` (the general company KB) and `analytics_kpi_knowledge`
     (HR-Analytics KB).
  5. Renders a clean PDF version at `backend/data/hr_policies/hr_policy.pdf`
     so HR can download/share the policy as a real document, and so the
     project structure includes a viewable PDF (per product requirement).
"""
from __future__ import annotations

import hashlib
import re
import sys
import uuid
from pathlib import Path

from qdrant_client import QdrantClient
from qdrant_client.http import models as qm
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)
from sentence_transformers import SentenceTransformer

from config import EMBEDDING_MODEL, QDRANT_URL

POLICY_DIR = Path(__file__).resolve().parents[1] / "data" / "hr_policies"
POLICY_MD = POLICY_DIR / "hr_policy.md"
POLICY_PDF = POLICY_DIR / "hr_policy.pdf"
HR_POLICY_COLLECTION = "hr_policy_knowledge"
EMBED_DIM = 384  # all-MiniLM-L6-v2


# ============================================================
# Markdown → chunks (mirrors ingest_knowledge.py / ingest_analytics_kb.py)
# ============================================================

def chunk_markdown(text: str, source: str) -> list[dict]:
    lines = text.splitlines()
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


# ============================================================
# Markdown → PDF (so the user/HR can view the policy as a doc)
# ============================================================

def _md_inline(text: str) -> str:
    """Convert a small subset of markdown inline → reportlab HTML-ish."""
    # **bold**
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    # *italic* / _italic_
    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", text)
    # `code`
    text = re.sub(r"`([^`]+)`", r'<font face="Courier">\1</font>', text)
    return text


def render_pdf(md_text: str, out_path: Path) -> None:
    styles = getSampleStyleSheet()
    base = ParagraphStyle(
        "Base", parent=styles["BodyText"],
        fontName="Helvetica", fontSize=10.5, leading=15,
        alignment=TA_LEFT, spaceAfter=6,
    )
    h1 = ParagraphStyle(
        "H1", parent=styles["Heading1"],
        fontName="Helvetica-Bold", fontSize=20, leading=24,
        textColor="#1f2937", spaceAfter=12, spaceBefore=4,
    )
    h2 = ParagraphStyle(
        "H2", parent=styles["Heading2"],
        fontName="Helvetica-Bold", fontSize=14, leading=18,
        textColor="#111827", spaceAfter=8, spaceBefore=14,
    )
    h3 = ParagraphStyle(
        "H3", parent=styles["Heading3"],
        fontName="Helvetica-Bold", fontSize=11.5, leading=15,
        textColor="#374151", spaceAfter=4, spaceBefore=8,
    )
    bullet = ParagraphStyle(
        "Bullet", parent=base, leftIndent=18, bulletIndent=6, spaceAfter=2,
    )
    meta = ParagraphStyle(
        "Meta", parent=base, fontSize=9, leading=12,
        textColor="#6b7280", spaceAfter=10,
    )

    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=letter,
        leftMargin=0.85 * inch, rightMargin=0.85 * inch,
        topMargin=0.85 * inch, bottomMargin=0.85 * inch,
        title="Nimbus Labs — Employee Handbook & HR Policy",
        author="People Operations",
    )

    flow = []
    in_list = False

    for raw in md_text.splitlines():
        line = raw.rstrip()

        if line.startswith("# "):
            flow.append(Paragraph(_md_inline(line[2:].strip()), h1))
            in_list = False
        elif line.startswith("## "):
            flow.append(Paragraph(_md_inline(line[3:].strip()), h2))
            in_list = False
        elif line.startswith("### "):
            flow.append(Paragraph(_md_inline(line[4:].strip()), h3))
            in_list = False
        elif line.startswith("- ") or line.startswith("* "):
            flow.append(Paragraph(_md_inline(line[2:].strip()), bullet, bulletText="•"))
            in_list = True
        elif re.match(r"^\d+\.\s", line):
            num, rest = line.split(". ", 1)
            flow.append(Paragraph(_md_inline(rest.strip()), bullet, bulletText=f"{num}."))
            in_list = True
        elif line.startswith("**") and line.endswith("**") and ":" not in line:
            flow.append(Paragraph(_md_inline(line), base))
            in_list = False
        elif line.strip() == "---":
            flow.append(Spacer(1, 8))
            in_list = False
        elif not line.strip():
            if not in_list:
                flow.append(Spacer(1, 4))
        else:
            # plain paragraph or "**Effective Date:**" style metadata header
            if line.startswith("**") and "**" in line[2:]:
                flow.append(Paragraph(_md_inline(line), meta))
            else:
                flow.append(Paragraph(_md_inline(line), base))
            in_list = False

    doc.build(flow)


# ============================================================
# Main
# ============================================================

def main() -> int:
    if not POLICY_MD.exists():
        print(f"ERROR: HR policy markdown not found at {POLICY_MD}")
        return 1

    md_text = POLICY_MD.read_text(encoding="utf-8")

    # 1. Chunk
    chunks = chunk_markdown(md_text, source=POLICY_MD.name)
    print(f"Chunked {POLICY_MD.name}: {len(chunks)} chunks")
    if not chunks:
        print("No chunks produced.")
        return 1

    # 2. Embed
    print(f"Loading embedding model: {EMBEDDING_MODEL}")
    model = SentenceTransformer(EMBEDDING_MODEL)
    texts = [c["content"] for c in chunks]
    print(f"Embedding {len(texts)} chunks…")
    vectors = model.encode(texts, normalize_embeddings=True, show_progress_bar=True)

    # 3. Upsert into Qdrant
    client = QdrantClient(url=QDRANT_URL)
    existing = {c.name for c in client.get_collections().collections}
    if HR_POLICY_COLLECTION in existing:
        print(f"Recreating collection '{HR_POLICY_COLLECTION}'")
        client.delete_collection(HR_POLICY_COLLECTION)
    client.create_collection(
        collection_name=HR_POLICY_COLLECTION,
        vectors_config=qm.VectorParams(size=EMBED_DIM, distance=qm.Distance.COSINE),
    )

    points = [
        qm.PointStruct(
            id=deterministic_id(c["source"], c["section"], c["content"]),
            vector=vec.tolist(),
            payload=c,
        )
        for c, vec in zip(chunks, vectors)
    ]
    client.upsert(collection_name=HR_POLICY_COLLECTION, points=points)
    print(f"Upserted {len(points)} points into '{HR_POLICY_COLLECTION}' at {QDRANT_URL}")

    # 4. Render PDF
    print(f"Rendering PDF → {POLICY_PDF}")
    render_pdf(md_text, POLICY_PDF)
    print("PDF written.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
