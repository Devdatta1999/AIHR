"""Generate 3 sample Project Requirement PDFs for the Team Formation feature.

Run once:
    python -m scripts.generate_sample_project_pdfs

Output: backend/data/sample_project_requirements/*.pdf
"""
from __future__ import annotations

from pathlib import Path

from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.lib import colors


OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "sample_project_requirements"

# ---- 3 fictional projects, picked to fit Nimbus Labs' real department/skill mix ----

PROJECTS = [
    {
        "filename": "phoenix_customer_portal.pdf",
        "name": "Project Phoenix",
        "subtitle": "Customer Portal Rebuild — v3.0",
        "summary": (
            "Re-architect the legacy Nimbus Labs customer portal as a modern "
            "single-page application with SSR, OIDC-based SSO, and a redesigned "
            "self-service experience. Targets 99.95% availability, sub-second TTI "
            "globally, and full WCAG 2.2 AA compliance."
        ),
        "duration_months": 6,
        "start": "Q2 FY26",
        "priority": "High",
        "domain": "Customer Experience",
        "objectives": [
            "Replace the AngularJS portal with a React + Next.js stack.",
            "Migrate authentication to corporate OIDC (Okta).",
            "Reduce p95 page load from 4.1s to under 1.2s.",
            "Roll out an accessibility-first design system.",
        ],
        "tech_stack": "React, Next.js, TypeScript, Node.js, REST APIs, AWS (ECS, S3, CloudFront), Postgres",
        "roles": [
            {
                "designation": "Senior Software Engineer",
                "headcount": 2,
                "level": "L4 / L5",
                "department": "Software Engineering",
                "allocation": 100,
                "must_have": ["React", "TypeScript", "Node.js", "REST APIs", "System Design"],
                "good_to_have": ["Next.js", "GraphQL"],
                "min_experience_years": 5,
                "responsibilities": (
                    "Own end-to-end feature delivery, set front-end architecture, "
                    "mentor mid-level engineers, and review PRs."
                ),
            },
            {
                "designation": "Software Engineer II",
                "headcount": 2,
                "level": "L3",
                "department": "Software Engineering",
                "allocation": 100,
                "must_have": ["JavaScript", "React", "REST APIs", "Git"],
                "good_to_have": ["TypeScript", "Node.js"],
                "min_experience_years": 2,
                "responsibilities": (
                    "Implement components, integrate backend APIs, and write unit/E2E tests."
                ),
            },
            {
                "designation": "UX Designer",
                "headcount": 1,
                "level": "L3 / L4",
                "department": "Design",
                "allocation": 75,
                "must_have": ["Figma", "Design Systems", "Accessibility"],
                "good_to_have": ["User Research"],
                "min_experience_years": 3,
                "responsibilities": (
                    "Lead the visual + interaction design, drive accessibility, "
                    "produce Figma specs and an updated design system."
                ),
            },
            {
                "designation": "QA Engineer II",
                "headcount": 2,
                "level": "L3",
                "department": "Quality Assurance",
                "allocation": 100,
                "must_have": ["Test Automation", "Selenium", "REST APIs"],
                "good_to_have": ["Cypress", "Playwright"],
                "min_experience_years": 2,
                "responsibilities": (
                    "Build the automated E2E suite and own release-gating regression."
                ),
            },
            {
                "designation": "Cloud Engineer",
                "headcount": 1,
                "level": "L3 / L4",
                "department": "DevOps & Cloud",
                "allocation": 50,
                "must_have": ["AWS", "Docker", "CI/CD"],
                "good_to_have": ["Terraform", "Kubernetes"],
                "min_experience_years": 3,
                "responsibilities": (
                    "Stand up the new ECS/CloudFront pipeline, configure observability, "
                    "and manage rollout."
                ),
            },
        ],
    },
    {
        "filename": "atlas_data_lakehouse.pdf",
        "name": "Project Atlas",
        "subtitle": "Data Lakehouse Migration",
        "summary": (
            "Migrate the warehouse from on-prem Vertica to a cloud lakehouse "
            "(S3 + Iceberg + Trino) with Airflow-orchestrated ELT, dbt models, "
            "and a unified metric layer. The result powers the new HR Analytics "
            "chatbot and exec dashboards."
        ),
        "duration_months": 9,
        "start": "Q2 FY26",
        "priority": "High",
        "domain": "Data Platform",
        "objectives": [
            "Stand up an S3 + Iceberg + Trino lakehouse in AWS.",
            "Re-platform 120+ Airflow DAGs to managed MWAA.",
            "Migrate 400+ dbt models with parity tests.",
            "Cut warehouse spend by 35% YoY.",
        ],
        "tech_stack": "Python, SQL, Apache Airflow, dbt, Apache Iceberg, Trino, AWS (S3, Glue, MWAA), Pandas, Kafka",
        "roles": [
            {
                "designation": "Senior Data Engineer",
                "headcount": 2,
                "level": "L4 / L5",
                "department": "Data Engineering",
                "allocation": 100,
                "must_have": ["Python", "SQL", "Airflow", "AWS", "Data Modeling"],
                "good_to_have": ["Iceberg", "Trino", "dbt"],
                "min_experience_years": 5,
                "responsibilities": (
                    "Design the lakehouse architecture, lead the Airflow re-platform, "
                    "and own the metric layer."
                ),
            },
            {
                "designation": "Data Engineer II",
                "headcount": 2,
                "level": "L3",
                "department": "Data Engineering",
                "allocation": 100,
                "must_have": ["Python", "SQL", "Airflow", "Pandas"],
                "good_to_have": ["dbt", "Kafka"],
                "min_experience_years": 2,
                "responsibilities": (
                    "Build and migrate ELT pipelines, write parity tests, document datasets."
                ),
            },
            {
                "designation": "Analytics Engineer",
                "headcount": 1,
                "level": "L3 / L4",
                "department": "Data Engineering",
                "allocation": 100,
                "must_have": ["SQL", "dbt", "Data Modeling"],
                "good_to_have": ["Looker", "Python"],
                "min_experience_years": 3,
                "responsibilities": (
                    "Migrate dbt models, codify the semantic layer, partner with HR Analytics."
                ),
            },
            {
                "designation": "ML Engineer",
                "headcount": 1,
                "level": "L3 / L4",
                "department": "AI/ML",
                "allocation": 50,
                "must_have": ["Python", "SQL", "Pandas"],
                "good_to_have": ["LangGraph", "RAG", "Embeddings"],
                "min_experience_years": 3,
                "responsibilities": (
                    "Plug the lakehouse into the existing chatbot's RAG layer; build "
                    "evaluation harnesses for ML features."
                ),
            },
            {
                "designation": "Cloud Engineer",
                "headcount": 1,
                "level": "L3",
                "department": "DevOps & Cloud",
                "allocation": 50,
                "must_have": ["AWS", "Docker", "CI/CD"],
                "good_to_have": ["Terraform", "MWAA"],
                "min_experience_years": 3,
                "responsibilities": (
                    "Provision the AWS footprint, secure IAM/KMS, set up monitoring and FinOps."
                ),
            },
        ],
    },
    {
        "filename": "aurora_ai_sales_copilot.pdf",
        "name": "Project Aurora",
        "subtitle": "AI Sales Copilot",
        "summary": (
            "Ship an internal AI Copilot for the Sales & Operations org that "
            "answers account questions, drafts outreach, and surfaces pipeline "
            "risks. Combines a RAG layer over Salesforce + product docs with a "
            "small NL→SQL agent for revenue analytics."
        ),
        "duration_months": 5,
        "start": "Q3 FY26",
        "priority": "Medium",
        "domain": "AI Productivity",
        "objectives": [
            "Reduce account-research time per AE by 40%.",
            "Auto-summarise pipeline risk for the weekly forecast call.",
            "Hit < 2% hallucination rate on grounded answers.",
            "Integrate with Salesforce, Slack, and Gmail.",
        ],
        "tech_stack": "Python, FastAPI, LangGraph, Qdrant, OpenAI/Llama, REST APIs, AWS, Salesforce API",
        "roles": [
            {
                "designation": "AI Engineer",
                "headcount": 2,
                "level": "L3 / L4",
                "department": "AI/ML",
                "allocation": 100,
                "must_have": ["Python", "LangGraph", "RAG", "Embeddings", "REST APIs"],
                "good_to_have": ["Qdrant", "FastAPI", "LLMs"],
                "min_experience_years": 3,
                "responsibilities": (
                    "Own the agent + RAG layer, run evals, ship the FastAPI serving stack."
                ),
            },
            {
                "designation": "Senior Software Engineer",
                "headcount": 1,
                "level": "L4",
                "department": "Software Engineering",
                "allocation": 75,
                "must_have": ["Python", "REST APIs", "System Design"],
                "good_to_have": ["FastAPI", "Microservices"],
                "min_experience_years": 5,
                "responsibilities": (
                    "Design the integration spine (Salesforce, Slack, Gmail) and lead the API contract."
                ),
            },
            {
                "designation": "Product Analyst",
                "headcount": 1,
                "level": "L3",
                "department": "Product Management",
                "allocation": 50,
                "must_have": ["SQL", "Excel", "Reporting"],
                "good_to_have": ["Looker", "Python"],
                "min_experience_years": 2,
                "responsibilities": (
                    "Define success metrics, set up evaluation dashboards, run the launch readout."
                ),
            },
            {
                "designation": "QA Engineer II",
                "headcount": 1,
                "level": "L3",
                "department": "Quality Assurance",
                "allocation": 75,
                "must_have": ["Test Automation", "REST APIs", "Python"],
                "good_to_have": ["LLM evaluation", "Playwright"],
                "min_experience_years": 2,
                "responsibilities": (
                    "Build automated regression + LLM-output evaluation harnesses."
                ),
            },
            {
                "designation": "Cloud Engineer",
                "headcount": 1,
                "level": "L3",
                "department": "DevOps & Cloud",
                "allocation": 50,
                "must_have": ["AWS", "Docker", "CI/CD"],
                "good_to_have": ["Kubernetes", "Terraform"],
                "min_experience_years": 3,
                "responsibilities": (
                    "Stand up the secure inference path, vector DB, and rollout pipeline."
                ),
            },
        ],
    },
]


def _styles() -> dict:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "title", parent=base["Title"], fontSize=22, leading=26, spaceAfter=4,
            textColor=colors.HexColor("#1f2937"),
        ),
        "subtitle": ParagraphStyle(
            "subtitle", parent=base["Normal"], fontSize=12, leading=15,
            textColor=colors.HexColor("#4f46e5"), spaceAfter=14,
        ),
        "h2": ParagraphStyle(
            "h2", parent=base["Heading2"], fontSize=13, leading=16, spaceBefore=10,
            spaceAfter=6, textColor=colors.HexColor("#111827"),
        ),
        "h3": ParagraphStyle(
            "h3", parent=base["Heading3"], fontSize=11, leading=14, spaceBefore=6,
            spaceAfter=3, textColor=colors.HexColor("#1f2937"),
        ),
        "body": ParagraphStyle(
            "body", parent=base["BodyText"], fontSize=10, leading=14,
            textColor=colors.HexColor("#1f2937"),
        ),
        "kv_label": ParagraphStyle(
            "kv_label", parent=base["Normal"], fontSize=9, leading=11,
            textColor=colors.HexColor("#6b7280"),
        ),
        "kv_val": ParagraphStyle(
            "kv_val", parent=base["Normal"], fontSize=10, leading=12,
            textColor=colors.HexColor("#111827"), fontName="Helvetica-Bold",
        ),
    }


def _build_pdf(spec: dict, out_path: Path) -> None:
    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=LETTER,
        leftMargin=0.7 * inch, rightMargin=0.7 * inch,
        topMargin=0.7 * inch, bottomMargin=0.7 * inch,
        title=f"{spec['name']} — Project Requirements",
        author="Nimbus Labs",
    )
    s = _styles()
    story = []

    story.append(Paragraph(f"{spec['name']}", s["title"]))
    story.append(Paragraph(spec["subtitle"], s["subtitle"]))

    # Meta block
    meta = [
        ["Domain", spec["domain"], "Priority", spec["priority"]],
        ["Start", spec["start"], "Duration", f"{spec['duration_months']} months"],
    ]
    t = Table(meta, colWidths=[0.9 * inch, 2.2 * inch, 0.9 * inch, 2.2 * inch])
    t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#6b7280")),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#6b7280")),
        ("TEXTCOLOR", (1, 0), (1, -1), colors.HexColor("#111827")),
        ("TEXTCOLOR", (3, 0), (3, -1), colors.HexColor("#111827")),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
        ("FONTNAME", (3, 0), (3, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#e5e7eb")),
    ]))
    story.append(t)
    story.append(Spacer(1, 12))

    story.append(Paragraph("Project Summary", s["h2"]))
    story.append(Paragraph(spec["summary"], s["body"]))

    story.append(Paragraph("Objectives", s["h2"]))
    for o in spec["objectives"]:
        story.append(Paragraph(f"• {o}", s["body"]))

    story.append(Paragraph("Tech Stack", s["h2"]))
    story.append(Paragraph(spec["tech_stack"], s["body"]))

    story.append(Paragraph("Team Composition Required", s["h2"]))
    story.append(Spacer(1, 4))

    for role in spec["roles"]:
        title = (
            f"{role['headcount']} × <b>{role['designation']}</b> "
            f"<font color='#6b7280'>({role['department']} · {role['level']} · "
            f"{role['allocation']}% allocation)</font>"
        )
        story.append(Paragraph(title, s["h3"]))
        story.append(Paragraph(role["responsibilities"], s["body"]))
        story.append(Paragraph(
            f"<b>Must-have skills:</b> {', '.join(role['must_have'])}", s["body"]
        ))
        story.append(Paragraph(
            f"<b>Good-to-have:</b> {', '.join(role['good_to_have'])}", s["body"]
        ))
        story.append(Paragraph(
            f"<b>Minimum experience:</b> {role['min_experience_years']}+ years",
            s["body"],
        ))
        story.append(Spacer(1, 6))

    story.append(Spacer(1, 10))
    story.append(Paragraph(
        "<i>Prepared by Nimbus Labs Resource Planning. "
        "This document is the source of truth for AI-assisted team formation.</i>",
        s["kv_label"],
    ))

    doc.build(story)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for spec in PROJECTS:
        out_path = OUT_DIR / spec["filename"]
        _build_pdf(spec, out_path)
        print(f"  wrote {out_path.relative_to(OUT_DIR.parent.parent)}")
    print(f"\nDone. {len(PROJECTS)} sample PDFs in {OUT_DIR}")


if __name__ == "__main__":
    main()
