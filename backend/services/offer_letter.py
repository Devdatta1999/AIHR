"""Renders formal offer-letter emails and persists them."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from html import escape as h
from typing import Optional

from config import COMPANY_NAME, COMPANY_TAGLINE, GOOGLE_ORGANIZER_EMAIL
from db import get_conn

CURRENCY_SYMBOLS = {
    "USD": "$",
    "INR": "₹",
    "EUR": "€",
    "GBP": "£",
    "CAD": "C$",
    "AUD": "A$",
    "SGD": "S$",
}


def format_salary(amount: float, currency: str) -> str:
    sym = CURRENCY_SYMBOLS.get(currency.upper(), "")
    if currency.upper() == "INR":
        # Indian formatting: grouping 1,00,000.
        whole = int(amount)
        s = f"{whole:,}"
        return f"{sym}{s}"
    return f"{sym}{amount:,.0f}"


def _parse_date(start_date: str) -> date:
    return datetime.strptime(start_date, "%Y-%m-%d").date()


def render_offer_letter(
    *,
    candidate_name: str,
    candidate_email: str,
    job_title: str,
    location: Optional[str],
    employment_type: Optional[str],
    base_salary: float,
    currency: str,
    start_date: str,
    expiry_days: int,
    organizer_email: str,
    portal_url: Optional[str] = None,
    portal_password: Optional[str] = None,
) -> tuple[str, str]:
    """Returns (subject, html_body)."""
    first = candidate_name.split(" ")[0] if candidate_name else "there"
    start = _parse_date(start_date)
    start_str = start.strftime("%A, %B %d, %Y")
    expiry = (datetime.now().date() + timedelta(days=expiry_days)).strftime(
        "%B %d, %Y"
    )
    salary_str = format_salary(base_salary, currency)
    emp_type = employment_type or "Full-time"
    loc = location or "Remote"

    subject = f"Offer of Employment — {job_title} at {COMPANY_NAME}"

    html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F4F6;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
      <!-- Header -->
      <tr><td style="padding:26px 36px 20px 36px;border-bottom:1px solid #F3F4F6;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="44" height="44" align="center" valign="middle" bgcolor="#4F46E5" style="color:#FFFFFF;font-size:20px;font-weight:700;border-radius:10px;font-family:Helvetica,Arial,sans-serif;">N</td>
            <td style="padding-left:14px;vertical-align:middle;">
              <div style="font-size:17px;font-weight:700;color:#111827;line-height:1.2;">{h(COMPANY_NAME)}</div>
              <div style="font-size:12px;color:#6B7280;line-height:1.2;margin-top:2px;">{h(COMPANY_TAGLINE)}</div>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:32px 36px 10px 36px;">
        <div style="display:inline-block;font-size:11px;color:#047857;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:#D1FAE5;padding:5px 10px;border-radius:999px;margin-bottom:14px;">Offer of Employment</div>
        <h1 style="font-size:24px;font-weight:700;color:#111827;margin:0 0 10px 0;line-height:1.3;">Welcome to {h(COMPANY_NAME)}, {h(first)}!</h1>
        <p style="font-size:15px;color:#374151;line-height:1.65;margin:18px 0 14px 0;">Dear {h(candidate_name)},</p>
        <p style="font-size:15px;color:#374151;line-height:1.65;margin:0 0 14px 0;">
          We are delighted to offer you the position of <b>{h(job_title)}</b> at <b>{h(COMPANY_NAME)}</b>. After meeting with you, our team is confident that your skills, experience, and energy will be a great addition — and we're excited about what we can build together.
        </p>
        <p style="font-size:15px;color:#374151;line-height:1.65;margin:0 0 20px 0;">
          Please review the key terms of your offer below.
        </p>
      </td></tr>

      <!-- Details card -->
      <tr><td style="padding:0 36px 24px 36px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9FAFB;border:1px solid #F3F4F6;border-radius:12px;">
          <tr><td style="padding:6px 20px 18px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #F3F4F6;color:#6B7280;width:38%;">Position</td>
                <td style="padding:12px 0;border-bottom:1px solid #F3F4F6;color:#111827;font-weight:600;">{h(job_title)}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #F3F4F6;color:#6B7280;">Employment type</td>
                <td style="padding:12px 0;border-bottom:1px solid #F3F4F6;color:#111827;font-weight:600;">{h(emp_type)}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #F3F4F6;color:#6B7280;">Work location</td>
                <td style="padding:12px 0;border-bottom:1px solid #F3F4F6;color:#111827;font-weight:600;">{h(loc)}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #F3F4F6;color:#6B7280;">Base salary</td>
                <td style="padding:12px 0;border-bottom:1px solid #F3F4F6;color:#111827;font-weight:600;">{h(salary_str)} {h(currency.upper())} / year</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#6B7280;">Start date</td>
                <td style="padding:12px 0;color:#111827;font-weight:600;">{h(start_str)}</td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>

      <!-- Benefits note -->
      <tr><td style="padding:0 36px 18px 36px;">
        <p style="font-size:14px;color:#374151;line-height:1.65;margin:0 0 12px 0;">
          In addition to your base salary, you'll be eligible for our standard benefits package, including health and dental insurance, retirement savings, paid time off, and equity participation. Full details will follow in the formal employment packet.
        </p>
      </td></tr>

      <!-- Portal credentials + acceptance -->
      <tr><td style="padding:0 36px 24px 36px;">
        <div style="background:#EFF6FF;border:1px solid #DBEAFE;border-radius:10px;padding:16px 18px;">
          <div style="font-size:13px;font-weight:700;color:#1E40AF;margin-bottom:6px;letter-spacing:.02em;text-transform:uppercase;">Accept your offer in the {h(COMPANY_NAME)} Employee Portal</div>
          <div style="font-size:14px;color:#1E3A8A;line-height:1.6;margin-bottom:12px;">
            Please review &amp; <b>formally accept this offer</b> in your secure employee portal. The same login lets you complete onboarding (paperwork, profile, country-specific forms) without back-and-forth email.
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border:1px solid #DBEAFE;border-radius:8px;font-size:13px;">
            <tr>
              <td style="padding:10px 14px;color:#6B7280;width:34%;border-bottom:1px solid #EFF6FF;">Portal link</td>
              <td style="padding:10px 14px;color:#111827;border-bottom:1px solid #EFF6FF;">
                <a href="{h(portal_url or '#')}" style="color:#1D4ED8;font-weight:600;text-decoration:none;">Open the {h(COMPANY_NAME)} Employee Portal &rarr;</a>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 14px;color:#6B7280;border-bottom:1px solid #EFF6FF;">Username</td>
              <td style="padding:10px 14px;color:#111827;font-weight:600;border-bottom:1px solid #EFF6FF;font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;">{h(candidate_email)}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;color:#6B7280;">Temporary password</td>
              <td style="padding:10px 14px;color:#111827;font-weight:600;font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;">{h(portal_password or '—')}</td>
            </tr>
          </table>
          <div style="font-size:12px;color:#1E3A8A;line-height:1.55;margin-top:10px;">
            On the portal: choose the <b>Employee</b> role, sign in with the credentials above, and click <b>Accept offer</b>. Please do this before <b>{h(expiry)}</b>. Questions? Just reply to this email.
          </div>
        </div>
      </td></tr>

      <!-- Signoff -->
      <tr><td style="padding:8px 36px 30px 36px;border-top:1px solid #F3F4F6;padding-top:22px;">
        <div style="font-size:14px;color:#374151;line-height:1.7;">We're so excited to have you join us, and look forward to your response.</div>
        <div style="font-size:14px;color:#374151;line-height:1.7;margin-top:14px;">Warm regards,</div>
        <div style="font-size:14px;color:#111827;font-weight:700;margin-top:2px;">{h(COMPANY_NAME)} Talent Team</div>
        <div style="font-size:12px;color:#6B7280;margin-top:2px;"><a href="mailto:{h(organizer_email)}" style="color:#6B7280;text-decoration:none;">{h(organizer_email)}</a></div>
      </td></tr>
    </table>
    <div style="font-size:11px;color:#9CA3AF;margin-top:14px;">{h(COMPANY_NAME)} · {h(COMPANY_TAGLINE)}</div>
  </td></tr>
</table>
</body></html>"""
    return subject, html_body


def html_to_text(html_body: str, fallback_intro: str) -> str:
    """Very small HTML → plaintext fallback for the multipart alternative."""
    import re

    text = re.sub(r"<br\s*/?>", "\n", html_body, flags=re.IGNORECASE)
    text = re.sub(r"</p>", "\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</tr>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text.strip()
    return text if text else fallback_intro


def record_offer_letter(
    *,
    applicant_id: int,
    job_id: int,
    base_salary: float,
    currency: str,
    start_date: str,
    subject: str,
    html_body: str,
    status: str,
    error_message: Optional[str] = None,
) -> None:
    # New offers start with response=NULL; the employee flips it via the portal.
    with get_conn() as con, con.cursor() as cur:
        cur.execute(
            """
            INSERT INTO applicants.offer_letters
              (applicant_id, job_id, base_salary, currency, start_date,
               subject, html_body, organizer_email, status, error_message,
               response)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                applicant_id,
                job_id,
                base_salary,
                currency.upper(),
                _parse_date(start_date),
                subject,
                html_body,
                GOOGLE_ORGANIZER_EMAIL,
                status,
                error_message,
                "pending" if status == "sent" else None,
            ),
        )
        con.commit()
