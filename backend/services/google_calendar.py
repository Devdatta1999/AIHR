"""Google Calendar + Gmail integration for sending interview invites.

Flow per invitation:
1. Create a Google Calendar event (with a Meet link auto-generated via
   `conferenceData.createRequest`) but suppress Google's own notification
   (`sendUpdates="none"`) so we don't duplicate the email.
2. Send our own branded HTML email via the Gmail API. The email contains
   the Meet link as a button and an ICS (`text/calendar; method=REQUEST`)
   attachment whose UID matches the Calendar event — so Gmail / most
   clients render native "Yes / No / Maybe" RSVP buttons, and accepting
   adds the event to the candidate's calendar.

This gives one cohesive, branded email with calendar integration.
"""
from __future__ import annotations

import base64
import uuid
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import formataddr
from typing import Literal, Optional, TypedDict

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from config import (
    COMPANY_NAME,
    COMPANY_TAGLINE,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_ORGANIZER_EMAIL,
    GOOGLE_REFRESH_TOKEN,
)

SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/gmail.send",
]

Kind = Literal["screening", "technical"]


class InviteResult(TypedDict, total=False):
    event_id: str
    meet_link: str
    html_link: str
    error: str


def _credentials_configured() -> bool:
    return bool(
        GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN
    )


def _creds() -> Credentials:
    return Credentials(
        token=None,
        refresh_token=GOOGLE_REFRESH_TOKEN,
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        token_uri="https://oauth2.googleapis.com/token",
        scopes=SCOPES,
    )


def _calendar_service():
    return build("calendar", "v3", credentials=_creds(), cache_discovery=False)


def _gmail_service():
    return build("gmail", "v1", credentials=_creds(), cache_discovery=False)


# ---------------------------------------------------------------------------
# Calendar event description (plain-ish text — Calendar supports a very
# limited subset of HTML: <b>, <i>, <u>, <a>, <br>, <hr>).
# ---------------------------------------------------------------------------

def _calendar_description(
    *,
    kind: Kind,
    candidate_name: str,
    job_title: str,
    organizer_email: str,
) -> str:
    first = candidate_name.split(" ")[0] if candidate_name else "there"
    if kind == "screening":
        intro = (
            f"Our talent team at <b>{COMPANY_NAME}</b> would like to meet you "
            f"for an initial screening conversation about the <b>{job_title}</b> "
            "role. We'll cover your background, interests, and answer any "
            "questions you have about us."
        )
    else:
        intro = (
            f"Our engineering team at <b>{COMPANY_NAME}</b> would like to invite "
            f"you to a technical interview for the <b>{job_title}</b> role. "
            "Expect a hands-on discussion covering fundamentals, system design, "
            "and problem solving."
        )
    return (
        f"Hi {first},<br><br>"
        f"{intro}<br><br>"
        "The Google Meet link is attached to this event — click "
        "<b>Join with Google Meet</b> at the scheduled time.<br><br>"
        "If the time doesn't work, reply to the invitation email and we'll "
        "find another slot.<br><br>"
        f"— {COMPANY_NAME} Talent Team<br>"
        f"<a href=\"mailto:{organizer_email}\">{organizer_email}</a>"
    )


# ---------------------------------------------------------------------------
# Branded HTML email body (table-based, email-client safe).
# ---------------------------------------------------------------------------

def _email_html(
    *,
    kind: Kind,
    candidate_name: str,
    job_title: str,
    scheduled_at: datetime,
    duration_minutes: int,
    timezone_name: str,
    meet_link: str,
    organizer_email: str,
) -> str:
    title = (
        "Initial Screening Conversation"
        if kind == "screening"
        else "Technical Interview"
    )
    blurb = (
        f"Our talent team at <b>{COMPANY_NAME}</b> would like to meet you for an "
        f"initial screening conversation about the <b>{job_title}</b> role. "
        "We'll cover your background, interests, and answer any questions "
        "you have about us."
        if kind == "screening"
        else f"Our engineering team at <b>{COMPANY_NAME}</b> would like to invite "
        f"you to a technical interview for the <b>{job_title}</b> role. "
        "Expect a hands-on discussion covering fundamentals, system design, "
        "and problem solving."
    )
    signoff_team = (
        f"{COMPANY_NAME} Talent Team"
        if kind == "screening"
        else f"{COMPANY_NAME} Engineering Team"
    )
    first = candidate_name.split(" ")[0] if candidate_name else "there"
    when_str = scheduled_at.strftime("%A, %B %d, %Y · %I:%M %p")
    # Compact TZ label.
    tz_label = scheduled_at.tzname() or timezone_name

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F4F6;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
      <!-- Header -->
      <tr><td style="padding:24px 32px 20px 32px;border-bottom:1px solid #F3F4F6;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="44" height="44" align="center" valign="middle" bgcolor="#4F46E5" style="color:#FFFFFF;font-size:20px;font-weight:700;border-radius:10px;font-family:Helvetica,Arial,sans-serif;">N</td>
            <td style="padding-left:14px;vertical-align:middle;">
              <div style="font-size:17px;font-weight:700;color:#111827;line-height:1.2;">{COMPANY_NAME}</div>
              <div style="font-size:12px;color:#6B7280;line-height:1.2;margin-top:2px;">{COMPANY_TAGLINE}</div>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:28px 32px 8px 32px;">
        <div style="font-size:12px;color:#4F46E5;font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px;">{title}</div>
        <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 18px 0;line-height:1.3;">{job_title}</h1>
        <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 14px 0;">Hi {first},</p>
        <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 22px 0;">{blurb}</p>
      </td></tr>

      <!-- Details card -->
      <tr><td style="padding:0 32px 22px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9FAFB;border:1px solid #F3F4F6;border-radius:10px;">
          <tr><td style="padding:16px 18px;">
            <div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:.06em;font-weight:600;margin-bottom:4px;">When</div>
            <div style="font-size:15px;color:#111827;font-weight:600;line-height:1.4;">{when_str}</div>
            <div style="font-size:13px;color:#6B7280;margin-top:2px;">{tz_label} · {duration_minutes} minutes</div>
          </td></tr>
        </table>
      </td></tr>

      <!-- CTA -->
      <tr><td align="center" style="padding:4px 32px 24px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="center" bgcolor="#2563EB" style="border-radius:10px;">
            <a href="{meet_link}" target="_blank" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;font-family:Helvetica,Arial,sans-serif;">Join with Google Meet</a>
          </td></tr>
        </table>
        <div style="font-size:12px;color:#6B7280;margin-top:10px;word-break:break-all;">
          <a href="{meet_link}" style="color:#2563EB;text-decoration:none;">{meet_link}</a>
        </div>
      </td></tr>

      <!-- Accept-to-calendar hint -->
      <tr><td style="padding:0 32px 22px 32px;">
        <div style="font-size:13px;color:#6B7280;line-height:1.6;">
          A calendar invite is attached — click <b>Yes</b> to add this to your
          calendar. If the time doesn't work, just reply to this email and
          we'll find another slot.
        </div>
      </td></tr>

      <!-- Signoff -->
      <tr><td style="padding:0 32px 28px 32px;border-top:1px solid #F3F4F6;padding-top:20px;">
        <div style="font-size:14px;color:#374151;line-height:1.6;">Looking forward to talking,</div>
        <div style="font-size:14px;color:#111827;font-weight:600;margin-top:2px;">{signoff_team}</div>
        <div style="font-size:12px;color:#6B7280;margin-top:2px;">{organizer_email}</div>
      </td></tr>
    </table>
    <div style="font-size:11px;color:#9CA3AF;margin-top:14px;">{COMPANY_NAME} · {COMPANY_TAGLINE}</div>
  </td></tr>
</table>
</body></html>"""


def _email_plaintext(
    *,
    kind: Kind,
    candidate_name: str,
    job_title: str,
    scheduled_at: datetime,
    duration_minutes: int,
    meet_link: str,
    organizer_email: str,
) -> str:
    first = candidate_name.split(" ")[0] if candidate_name else "there"
    title = (
        "Initial Screening Conversation"
        if kind == "screening"
        else "Technical Interview"
    )
    team = (
        f"{COMPANY_NAME} Talent Team"
        if kind == "screening"
        else f"{COMPANY_NAME} Engineering Team"
    )
    when_str = scheduled_at.strftime("%A, %B %d, %Y · %I:%M %p %Z").strip()
    return (
        f"Hi {first},\n\n"
        f"{title} — {job_title}\n"
        f"When: {when_str}\n"
        f"Duration: {duration_minutes} minutes\n\n"
        f"Join with Google Meet: {meet_link}\n\n"
        "A calendar invite is attached — click Yes to add this to your "
        "calendar. If the time doesn't work, just reply to this email.\n\n"
        f"— {team}\n{organizer_email}\n"
    )


# ---------------------------------------------------------------------------
# ICS (iCalendar) — gives Gmail/Outlook native RSVP buttons.
# ---------------------------------------------------------------------------

def _ics_escape(s: str) -> str:
    return (
        s.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )


def _build_ics(
    *,
    event_uid: str,
    start_at: datetime,
    end_at: datetime,
    summary: str,
    description: str,
    organizer_email: str,
    attendee_email: str,
    attendee_name: str,
    meet_link: str,
) -> str:
    fmt = "%Y%m%dT%H%M%SZ"
    start_utc = start_at.astimezone(timezone.utc).strftime(fmt)
    end_utc = end_at.astimezone(timezone.utc).strftime(fmt)
    dtstamp = datetime.now(timezone.utc).strftime(fmt)
    return "\r\n".join(
        [
            "BEGIN:VCALENDAR",
            "PRODID:-//Nimbus Labs//Hiring//EN",
            "VERSION:2.0",
            "METHOD:REQUEST",
            "CALSCALE:GREGORIAN",
            "BEGIN:VEVENT",
            f"UID:{event_uid}",
            f"DTSTAMP:{dtstamp}",
            f"DTSTART:{start_utc}",
            f"DTEND:{end_utc}",
            f"SUMMARY:{_ics_escape(summary)}",
            f"DESCRIPTION:{_ics_escape(description)}",
            f"LOCATION:{_ics_escape(meet_link)}",
            f"ORGANIZER;CN={_ics_escape(COMPANY_NAME)}:mailto:{organizer_email}",
            (
                f"ATTENDEE;CN={_ics_escape(attendee_name)};"
                "ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:"
                f"mailto:{attendee_email}"
            ),
            "STATUS:CONFIRMED",
            "SEQUENCE:0",
            "TRANSP:OPAQUE",
            "END:VEVENT",
            "END:VCALENDAR",
        ]
    )


# ---------------------------------------------------------------------------
# Sending
# ---------------------------------------------------------------------------

def _send_email(
    *,
    to_email: str,
    to_name: str,
    from_email: str,
    from_name: str,
    subject: str,
    html_body: str,
    text_body: str,
    ics_content: Optional[str] = None,
) -> None:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((from_name, from_email))
    msg["To"] = formataddr((to_name, to_email))
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")
    if ics_content:
        # Attach the iCalendar invite. `method=REQUEST` is what makes Gmail
        # render Yes/No/Maybe buttons inline.
        msg.add_attachment(
            ics_content.encode("utf-8"),
            maintype="text",
            subtype="calendar",
            filename="invite.ics",
            params={"method": "REQUEST", "charset": "UTF-8"},
        )
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii")
    _gmail_service().users().messages().send(
        userId="me", body={"raw": raw}
    ).execute()


def send_raw_email(
    *,
    to_email: str,
    to_name: str,
    subject: str,
    html_body: str,
    text_body: str,
    from_name: Optional[str] = None,
) -> Optional[str]:
    """Send an arbitrary HTML email via Gmail API. Used by offer letters.
    Returns an error string if the send fails, otherwise None."""
    if not _credentials_configured():
        return (
            "Google credentials are not set. Run "
            "`python scripts/gcal_oauth_setup.py` and paste the output into "
            "backend/.env."
        )
    organizer_email = GOOGLE_ORGANIZER_EMAIL or ""
    try:
        _send_email(
            to_email=to_email,
            to_name=to_name,
            from_email=organizer_email,
            from_name=from_name or f"{COMPANY_NAME} Talent Team",
            subject=subject,
            html_body=html_body,
            text_body=text_body,
            ics_content=None,
        )
    except Exception as e:
        return f"Email send failed: {e}"
    return None


def send_interview_invite(
    *,
    candidate_email: str,
    candidate_name: str,
    job_title: str,
    scheduled_at: datetime,
    duration_minutes: int,
    kind: Kind,
    timezone: str = "UTC",
    interviewer_emails: Optional[list[str]] = None,
) -> InviteResult:
    """Creates a Google Calendar event with a Meet link and emails the
    candidate a branded invitation. Returns event/Meet details or an error."""
    if not _credentials_configured():
        return {
            "error": (
                "Google credentials are not set. Run "
                "`python scripts/gcal_oauth_setup.py` and paste the output "
                "into backend/.env."
            )
        }

    organizer_email = GOOGLE_ORGANIZER_EMAIL or ""
    end_at = scheduled_at + timedelta(minutes=duration_minutes)

    summary = (
        f"{COMPANY_NAME}: Screening — {job_title}"
        if kind == "screening"
        else f"{COMPANY_NAME}: Technical Interview — {job_title}"
    )

    description_html = _calendar_description(
        kind=kind,
        candidate_name=candidate_name,
        job_title=job_title,
        organizer_email=organizer_email,
    )

    event_body = {
        "summary": summary,
        "description": description_html,
        "start": {"dateTime": scheduled_at.isoformat(), "timeZone": timezone},
        "end": {"dateTime": end_at.isoformat(), "timeZone": timezone},
        "attendees": [
            {"email": candidate_email, "displayName": candidate_name},
            *[
                {"email": e, "resource": False}
                for e in (interviewer_emails or [])
                if e and e.lower() != candidate_email.lower()
            ],
        ],
        "conferenceData": {
            "createRequest": {
                "requestId": str(uuid.uuid4()),
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        },
        "reminders": {
            "useDefault": False,
            "overrides": [
                {"method": "email", "minutes": 24 * 60},
                {"method": "popup", "minutes": 15},
            ],
        },
    }

    try:
        event = (
            _calendar_service()
            .events()
            .insert(
                calendarId="primary",
                body=event_body,
                conferenceDataVersion=1,
                # We send our own email below; don't let Google duplicate it.
                sendUpdates="none",
            )
            .execute()
        )
    except Exception as e:
        return {"error": f"Calendar API error: {e}"}

    meet_link = ""
    for entry in (event.get("conferenceData", {}).get("entryPoints") or []):
        if entry.get("entryPointType") == "video":
            meet_link = entry.get("uri", "")
            break

    event_id = event.get("id", "") or str(uuid.uuid4())
    html_link = event.get("htmlLink", "")

    # Build ICS + branded email and send via Gmail API.
    subject_prefix = (
        "Screening Interview" if kind == "screening" else "Technical Interview"
    )
    subject = f"{subject_prefix} — {job_title} at {COMPANY_NAME}"

    plain_description = (
        f"Join with Google Meet: {meet_link}\\n\\n"
        f"Interview for {job_title} at {COMPANY_NAME}."
    )
    ics = _build_ics(
        event_uid=event_id,
        start_at=scheduled_at,
        end_at=end_at,
        summary=summary,
        description=plain_description,
        organizer_email=organizer_email,
        attendee_email=candidate_email,
        attendee_name=candidate_name,
        meet_link=meet_link,
    )
    html_body = _email_html(
        kind=kind,
        candidate_name=candidate_name,
        job_title=job_title,
        scheduled_at=scheduled_at,
        duration_minutes=duration_minutes,
        timezone_name=timezone,
        meet_link=meet_link,
        organizer_email=organizer_email,
    )
    text_body = _email_plaintext(
        kind=kind,
        candidate_name=candidate_name,
        job_title=job_title,
        scheduled_at=scheduled_at,
        duration_minutes=duration_minutes,
        meet_link=meet_link,
        organizer_email=organizer_email,
    )

    try:
        _send_email(
            to_email=candidate_email,
            to_name=candidate_name,
            from_email=organizer_email,
            from_name=f"{COMPANY_NAME} Talent Team",
            subject=subject,
            html_body=html_body,
            text_body=text_body,
            ics_content=ics,
        )
    except Exception as e:
        # Calendar event still exists; surface the email error.
        return {
            "event_id": event_id,
            "meet_link": meet_link,
            "html_link": html_link,
            "error": f"Email send failed: {e}",
        }

    return {
        "event_id": event_id,
        "meet_link": meet_link,
        "html_link": html_link,
    }


def send_interviewer_notification(
    *,
    interviewer_email: str,
    candidate_name: str,
    candidate_email: str,
    job_title: str,
    kind: Kind,
    scheduled_at: datetime,
    duration_minutes: int,
    meet_link: str,
    portal_url: Optional[str] = None,
) -> Optional[str]:
    """Emails an employee that they've been added as an interviewer.
    Returns an error string if the send fails, otherwise None."""
    if not _credentials_configured():
        return "Google credentials not configured."
    organizer_email = GOOGLE_ORGANIZER_EMAIL or ""
    when_str = scheduled_at.strftime("%A, %B %d, %Y · %I:%M %p")
    tz_label = scheduled_at.tzname() or ""
    title = "Screening" if kind == "screening" else "Technical Interview"
    portal_href = portal_url or "#"
    subject = f"You're interviewing {candidate_name} — {job_title}"

    html_body = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F4F6;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border-radius:14px;overflow:hidden;">
      <tr><td style="padding:24px 32px 16px 32px;border-bottom:1px solid #F3F4F6;">
        <div style="font-size:17px;font-weight:700;color:#111827;">{COMPANY_NAME}</div>
        <div style="font-size:12px;color:#6B7280;">{COMPANY_TAGLINE}</div>
      </td></tr>
      <tr><td style="padding:24px 32px 8px 32px;">
        <div style="font-size:12px;color:#4F46E5;font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px;">Interview assignment — {title}</div>
        <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 14px 0;line-height:1.3;">You're interviewing {candidate_name}</h1>
        <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 14px 0;">You've been added as an interviewer for the <b>{job_title}</b> role.</p>
      </td></tr>
      <tr><td style="padding:0 32px 16px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9FAFB;border:1px solid #F3F4F6;border-radius:10px;">
          <tr><td style="padding:14px 18px;font-size:13px;color:#374151;line-height:1.7;">
            <div><b>Candidate:</b> {candidate_name} &lt;{candidate_email}&gt;</div>
            <div><b>When:</b> {when_str} {tz_label}</div>
            <div><b>Duration:</b> {duration_minutes} min</div>
            <div style="margin-top:6px;"><b>Meet:</b> <a href="{meet_link}" style="color:#2563EB;text-decoration:none;">{meet_link}</a></div>
          </td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:4px 32px 24px 32px;">
        <a href="{portal_href}" style="display:inline-block;padding:11px 22px;background:#2563EB;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;">Open Employee Portal</a>
        <div style="font-size:12px;color:#6B7280;margin-top:10px;">Full details and your interview kit live under <b>Interview → Upcoming Interviews</b>.</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""
    text_body = (
        f"You're interviewing {candidate_name} — {job_title}\n"
        f"When: {when_str} {tz_label}\n"
        f"Duration: {duration_minutes} min\n"
        f"Candidate: {candidate_email}\n"
        f"Meet: {meet_link}\n"
        f"Portal: {portal_href}\n"
    )
    try:
        _send_email(
            to_email=interviewer_email,
            to_name=interviewer_email.split("@")[0],
            from_email=organizer_email,
            from_name=f"{COMPANY_NAME} Talent Team",
            subject=subject,
            html_body=html_body,
            text_body=text_body,
        )
    except Exception as e:
        return f"Email send failed: {e}"
    return None
