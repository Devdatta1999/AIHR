"""Render a payslip dict (from services.payroll) as a single-page PDF.

The shape of the input is exactly what `_row_to_payslip` produces, plus the
optional `employee` block from `release_payroll`. Either source works.
"""
from __future__ import annotations

from io import BytesIO
from typing import Any, Optional

from reportlab.lib import colors
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


def _money(amount: Optional[float], currency: str = "USD") -> str:
    if amount is None:
        return "—"
    sign = "$" if currency == "USD" else f"{currency} "
    return f"{sign}{amount:,.2f}"


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "title", parent=base["Title"], fontSize=20, leading=24,
            textColor=colors.HexColor("#111827"), spaceAfter=2,
        ),
        "subtitle": ParagraphStyle(
            "subtitle", parent=base["Normal"], fontSize=10, leading=13,
            textColor=colors.HexColor("#6b7280"), spaceAfter=12,
        ),
        "h2": ParagraphStyle(
            "h2", parent=base["Heading2"], fontSize=11, leading=14,
            textColor=colors.HexColor("#111827"), spaceBefore=10, spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "body", parent=base["BodyText"], fontSize=9.5, leading=12.5,
            textColor=colors.HexColor("#1f2937"),
        ),
        "small": ParagraphStyle(
            "small", parent=base["Normal"], fontSize=8.5, leading=11,
            textColor=colors.HexColor("#6b7280"),
        ),
    }


def render_payslip_pdf(
    payslip: dict[str, Any],
    *,
    employee: Optional[dict[str, Any]] = None,
    employer_name: str = "Nimbus Labs, Inc.",
) -> bytes:
    """Return a PDF byte string for the given payslip dict."""
    s = _styles()
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=LETTER,
        leftMargin=0.7 * inch, rightMargin=0.7 * inch,
        topMargin=0.7 * inch, bottomMargin=0.7 * inch,
        title=f"Payslip — {payslip.get('pay_period_label', '')}",
        author=employer_name,
    )

    story: list[Any] = []
    currency = payslip.get("currency") or "USD"

    # ---- Header ----
    story.append(Paragraph("Payslip", s["title"]))
    story.append(Paragraph(
        f"{employer_name} &nbsp;·&nbsp; Pay period: <b>{payslip.get('pay_period_label', '')}</b> "
        f"&nbsp;·&nbsp; Pay date: {payslip.get('pay_date') or '—'}",
        s["subtitle"],
    ))

    # ---- Employee + period meta ----
    emp = employee or {}
    full_name = " ".join(filter(None, [emp.get("first_name"), emp.get("last_name")])) or "—"
    meta = [
        ["Employee", full_name, "Employee #", emp.get("employee_code") or "—"],
        ["Job title", emp.get("job_title") or "—",
         "Department", emp.get("department_name") or emp.get("department") or "—"],
        ["Period start", payslip.get("period_start") or "—",
         "Period end", payslip.get("period_end") or "—"],
        ["Annual base", _money(payslip.get("annual_base_salary"), currency),
         "Currency", currency],
    ]
    t = Table(meta, colWidths=[0.95 * inch, 2.45 * inch, 0.95 * inch, 2.45 * inch])
    t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#6b7280")),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#6b7280")),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
        ("FONTNAME", (3, 0), (3, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#e5e7eb")),
    ]))
    story.append(t)
    story.append(Spacer(1, 14))

    # ---- Earnings table ----
    earnings = payslip.get("earnings") or []
    earn_rows = [["Earnings", "Amount"]]
    for e in earnings:
        earn_rows.append([e.get("label") or "—", _money(e.get("amount"), currency)])
    earn_rows.append(["Gross earnings (this period)",
                      _money(payslip.get("total_earnings"), currency)])

    et = Table(earn_rows, colWidths=[4.4 * inch, 2.4 * inch])
    et.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#ecfdf5")),
        ("TEXTCOLOR",  (0, 0), (-1, 0), colors.HexColor("#065f46")),
        ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, -2), 0.25, colors.HexColor("#e5e7eb")),
        ("LINEABOVE", (0, -1), (-1, -1), 0.5, colors.HexColor("#9ca3af")),
        ("FONTNAME",   (0, -1), (-1, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(et)
    story.append(Spacer(1, 10))

    # ---- Deductions table ----
    deductions = payslip.get("deductions") or []
    ded_rows = [["Deductions", "Amount"]]
    for d in deductions:
        ded_rows.append([d.get("label") or "—", _money(d.get("amount"), currency)])
    ded_rows.append(["Total deductions",
                     _money(payslip.get("total_deductions"), currency)])

    dt = Table(ded_rows, colWidths=[4.4 * inch, 2.4 * inch])
    dt.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fef2f2")),
        ("TEXTCOLOR",  (0, 0), (-1, 0), colors.HexColor("#7f1d1d")),
        ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, -2), 0.25, colors.HexColor("#e5e7eb")),
        ("LINEABOVE", (0, -1), (-1, -1), 0.5, colors.HexColor("#9ca3af")),
        ("FONTNAME",   (0, -1), (-1, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(dt)
    story.append(Spacer(1, 12))

    # ---- Net pay highlight ----
    net = Table(
        [["Net pay (this period)", _money(payslip.get("net_pay"), currency)]],
        colWidths=[4.4 * inch, 2.4 * inch],
    )
    net.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#1f2937")),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#ffffff")),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(net)
    story.append(Spacer(1, 14))

    # ---- YTD ----
    story.append(Paragraph("Year-to-date", s["h2"]))
    ytd = Table(
        [
            ["YTD gross", _money(payslip.get("ytd_gross"), currency),
             "YTD tax", _money(payslip.get("ytd_tax"), currency),
             "YTD net", _money(payslip.get("ytd_net"), currency)],
        ],
        colWidths=[0.8 * inch, 1.4 * inch, 0.7 * inch, 1.4 * inch, 0.8 * inch, 1.7 * inch],
    )
    ytd.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, 0), colors.HexColor("#6b7280")),
        ("TEXTCOLOR", (2, 0), (2, 0), colors.HexColor("#6b7280")),
        ("TEXTCOLOR", (4, 0), (4, 0), colors.HexColor("#6b7280")),
        ("FONTNAME", (1, 0), (1, 0), "Helvetica-Bold"),
        ("FONTNAME", (3, 0), (3, 0), "Helvetica-Bold"),
        ("FONTNAME", (5, 0), (5, 0), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#e5e7eb")),
    ]))
    story.append(ytd)
    story.append(Spacer(1, 14))

    # ---- Footer ----
    story.append(Paragraph(
        "<i>This is a system-generated payslip. Tax brackets used here are "
        "demo-grade and not a substitute for an official tax computation. "
        "If anything looks off, contact HR.</i>",
        s["small"],
    ))

    doc.build(story)
    return buf.getvalue()
