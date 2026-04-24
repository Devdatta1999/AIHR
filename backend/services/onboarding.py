"""Onboarding pipeline service — HR-side + helpers shared with employee portal.

Flow:
  offer accepted -> applicant.status = 'Ready for Onboarding'
  HR starts tracker (picks welcome message; documents auto-filter by country)
  tracker.status = 'documents_sent'
  Employee accepts in portal  -> tracker.status = 'accepted',
                                 employees row created,
                                 applicant.status = 'Active Employee'
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import date
from typing import Any, Optional

from psycopg.types.json import Json

from config import ONBOARDING_DOCS_DIR
from db import get_conn
from services import auth as auth_svc


# ---------- document library ----------

def list_documents(country: Optional[str] = None) -> list[dict[str, Any]]:
    sql = """
        SELECT doc_id, title, description, country, filename, original_name,
               mime_type, size_bytes, uploaded_at
        FROM applicants.onboarding_documents
        ORDER BY uploaded_at DESC
    """
    with get_conn() as conn:
        rows = conn.execute(sql).fetchall()
    if country:
        c = country.strip().lower()
        rows = [r for r in rows if not r["country"] or r["country"].strip().lower() == c]
    for r in rows:
        if r.get("uploaded_at"):
            r["uploaded_at"] = r["uploaded_at"].isoformat()
    return rows


def get_document(doc_id: int) -> Optional[dict[str, Any]]:
    sql = """
        SELECT doc_id, title, description, country, filename, original_name,
               mime_type, size_bytes
        FROM applicants.onboarding_documents
        WHERE doc_id = %s
    """
    with get_conn() as conn:
        return conn.execute(sql, (doc_id,)).fetchone()


def save_document(
    *,
    title: str,
    description: Optional[str],
    country: Optional[str],
    original_name: str,
    mime_type: Optional[str],
    content: bytes,
) -> dict[str, Any]:
    ext = os.path.splitext(original_name)[1] or ""
    stored = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(ONBOARDING_DOCS_DIR, stored)
    with open(path, "wb") as f:
        f.write(content)

    with get_conn() as conn:
        row = conn.execute(
            """
            INSERT INTO applicants.onboarding_documents
              (title, description, country, filename, original_name,
               mime_type, size_bytes)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING doc_id, title, description, country, filename,
                      original_name, mime_type, size_bytes, uploaded_at
            """,
            (title, description, country, stored, original_name, mime_type, len(content)),
        ).fetchone()
        conn.commit()
    if row.get("uploaded_at"):
        row["uploaded_at"] = row["uploaded_at"].isoformat()
    return row


def delete_document(doc_id: int) -> bool:
    doc = get_document(doc_id)
    if not doc:
        return False
    path = os.path.join(ONBOARDING_DOCS_DIR, doc["filename"])
    if os.path.exists(path):
        try:
            os.remove(path)
        except OSError:
            pass
    with get_conn() as conn:
        conn.execute("DELETE FROM applicants.onboarding_documents WHERE doc_id = %s", (doc_id,))
        conn.commit()
    return True


def document_path(doc_id: int) -> Optional[tuple[str, dict[str, Any]]]:
    doc = get_document(doc_id)
    if not doc:
        return None
    return os.path.join(ONBOARDING_DOCS_DIR, doc["filename"]), doc


# ---------- ready-for-onboarding queue ----------

def list_ready_applicants() -> list[dict[str, Any]]:
    sql = """
        SELECT a.applicant_id, a.first_name, a.last_name, a.email, a.status,
               a.country, a.job_id, j.job_title, j.department, j.location,
               t.tracker_id, t.status AS tracker_status
        FROM applicants.applicants a
        LEFT JOIN applicants.job_postings j ON j.job_id = a.job_id
        LEFT JOIN applicants.onboarding_trackers t ON t.applicant_id = a.applicant_id
        WHERE a.status IN ('Ready for Onboarding', 'Onboarding', 'Active Employee')
        ORDER BY a.updated_at DESC
    """
    with get_conn() as conn:
        return conn.execute(sql).fetchall()


# ---------- tracker ----------

def get_tracker(applicant_id: int) -> Optional[dict[str, Any]]:
    sql = """
        SELECT t.*, a.first_name, a.last_name, a.email, a.country, a.job_id,
               j.job_title, j.department, j.location, j.employment_type,
               a.status AS applicant_status
        FROM applicants.onboarding_trackers t
        JOIN applicants.applicants a ON a.applicant_id = t.applicant_id
        LEFT JOIN applicants.job_postings j ON j.job_id = a.job_id
        WHERE t.applicant_id = %s
    """
    with get_conn() as conn:
        row = conn.execute(sql, (applicant_id,)).fetchone()
    if row:
        for k in ("created_at", "updated_at", "accepted_at"):
            if row.get(k):
                row[k] = row[k].isoformat()
    return row


def start_tracker(
    applicant_id: int,
    welcome_message: Optional[str] = None,
    document_ids: Optional[list[int]] = None,
) -> dict[str, Any]:
    """Create (or reset) a tracker and auto-select country-matching docs when
    no explicit document_ids are passed."""
    with get_conn() as conn:
        applicant = conn.execute(
            "SELECT applicant_id, country, status FROM applicants.applicants WHERE applicant_id = %s",
            (applicant_id,),
        ).fetchone()
        if not applicant:
            raise ValueError(f"applicant {applicant_id} not found")

        if document_ids is None:
            doc_rows = list_documents(country=applicant.get("country"))
            document_ids = [d["doc_id"] for d in doc_rows]

        existing = conn.execute(
            "SELECT tracker_id FROM applicants.onboarding_trackers WHERE applicant_id = %s",
            (applicant_id,),
        ).fetchone()

        if existing:
            conn.execute(
                """
                UPDATE applicants.onboarding_trackers
                SET welcome_message = %s,
                    document_ids = %s,
                    status = 'documents_sent',
                    updated_at = NOW()
                WHERE applicant_id = %s
                """,
                (welcome_message, Json(document_ids), applicant_id),
            )
        else:
            conn.execute(
                """
                INSERT INTO applicants.onboarding_trackers
                  (applicant_id, welcome_message, document_ids, status)
                VALUES (%s, %s, %s, 'documents_sent')
                """,
                (applicant_id, welcome_message, Json(document_ids)),
            )
        conn.execute(
            "UPDATE applicants.applicants SET status = 'Onboarding', updated_at = NOW() WHERE applicant_id = %s",
            (applicant_id,),
        )
        conn.commit()
    return get_tracker(applicant_id)


def update_profile(applicant_id: int, fields: dict[str, Any]) -> None:
    """Persist the employee-filled-in profile data onto the applicant row."""
    allowed = {
        "date_of_birth",
        "home_address",
        "emergency_contact_name",
        "emergency_contact_phone",
        "tax_id",
        "bank_account",
        "tshirt_size",
        "phone",
    }
    clean = {k: v for k, v in fields.items() if k in allowed and v not in (None, "")}
    if not clean:
        return
    setters = ", ".join(f"{k} = %s" for k in clean.keys())
    params = list(clean.values()) + [applicant_id]
    with get_conn() as conn:
        conn.execute(
            f"UPDATE applicants.applicants SET {setters}, updated_at = NOW() "
            f"WHERE applicant_id = %s",
            params,
        )
        conn.commit()


def accept_onboarding(applicant_id: int) -> dict[str, Any]:
    """Employee accepts — create employee row, flip statuses, return employee."""
    with get_conn() as conn:
        applicant = conn.execute(
            """
            SELECT a.*, j.job_title, j.department, j.location,
                   j.employment_type
            FROM applicants.applicants a
            LEFT JOIN applicants.job_postings j ON j.job_id = a.job_id
            WHERE a.applicant_id = %s
            """,
            (applicant_id,),
        ).fetchone()
        if not applicant:
            raise ValueError(f"applicant {applicant_id} not found")

        offer = conn.execute(
            """
            SELECT start_date FROM applicants.offer_letters
            WHERE applicant_id = %s AND response = 'accepted'
            ORDER BY responded_at DESC LIMIT 1
            """,
            (applicant_id,),
        ).fetchone()
        start_date: Optional[date] = (offer or {}).get("start_date")

        employee = conn.execute(
            """
            INSERT INTO applicants.employees
              (applicant_id, first_name, last_name, email, password_hash,
               job_title, department, location, country, employment_type,
               start_date, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'active')
            ON CONFLICT (email) DO UPDATE SET
              applicant_id = EXCLUDED.applicant_id,
              password_hash = EXCLUDED.password_hash,
              job_title = EXCLUDED.job_title,
              department = EXCLUDED.department,
              location = EXCLUDED.location,
              country = EXCLUDED.country,
              employment_type = EXCLUDED.employment_type,
              start_date = EXCLUDED.start_date,
              status = 'active',
              onboarded_at = NOW()
            RETURNING employee_id, email
            """,
            (
                applicant["applicant_id"],
                applicant["first_name"],
                applicant["last_name"],
                applicant["email"],
                applicant.get("password_hash"),
                applicant.get("job_title"),
                applicant.get("department"),
                applicant.get("location"),
                applicant.get("country"),
                applicant.get("employment_type"),
                start_date,
            ),
        ).fetchone()

        conn.execute(
            """
            UPDATE applicants.onboarding_trackers
            SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
            WHERE applicant_id = %s
            """,
            (applicant_id,),
        )
        conn.execute(
            "UPDATE applicants.applicants SET status = 'Active Employee', updated_at = NOW() "
            "WHERE applicant_id = %s",
            (applicant_id,),
        )
        conn.commit()
    return employee


def reset_onboarding(applicant_id: int) -> dict[str, Any]:
    """Roll an applicant back to 'Offered' so the demo flow can be re-run.

    - delete the employees row (if any)
    - delete the onboarding tracker (if any)
    - flip the latest sent offer letter back to response='pending', responded_at=NULL
    - set applicant.status = 'Offered'
    """
    with get_conn() as conn:
        applicant = conn.execute(
            "SELECT applicant_id, email FROM applicants.applicants WHERE applicant_id = %s",
            (applicant_id,),
        ).fetchone()
        if not applicant:
            raise ValueError(f"applicant {applicant_id} not found")

        # 1) employees row (matched by applicant_id OR email — covers either upsert path)
        conn.execute(
            "DELETE FROM applicants.employees WHERE applicant_id = %s OR email = %s",
            (applicant_id, applicant["email"]),
        )
        # 2) tracker
        conn.execute(
            "DELETE FROM applicants.onboarding_trackers WHERE applicant_id = %s",
            (applicant_id,),
        )
        # 3) latest sent offer back to pending
        conn.execute(
            """
            UPDATE applicants.offer_letters
            SET response = 'pending', responded_at = NULL, response_note = NULL
            WHERE offer_id = (
                SELECT offer_id FROM applicants.offer_letters
                WHERE applicant_id = %s AND status = 'sent'
                ORDER BY created_at DESC LIMIT 1
            )
            """,
            (applicant_id,),
        )
        # 4) applicant status
        conn.execute(
            "UPDATE applicants.applicants SET status = 'Offered', updated_at = NOW() WHERE applicant_id = %s",
            (applicant_id,),
        )
        conn.commit()
    return {"ok": True, "applicant_id": applicant_id, "status": "Offered"}


def list_employees() -> list[dict[str, Any]]:
    """Union of:
      - applicants.employees: people who walked the app's offer→onboarding flow
      - employees.employees: the existing company directory (potential interviewers)
    Deduped by lower(email); the applicants.employees row wins because it carries
    a portal login. Sorted alphabetically.
    """
    sql_applicants = """
        SELECT employee_id, applicant_id, first_name, last_name, email,
               job_title, department, location, country, start_date, onboarded_at
        FROM applicants.employees
        WHERE status = 'active'
    """
    sql_directory = """
        SELECT employee_id,
               NULL::bigint AS applicant_id,
               first_name, last_name, email,
               job_title, department_name AS department, location, country,
               join_date AS start_date,
               NULL::timestamp AS onboarded_at
        FROM employees.employees
        WHERE status IS NULL OR status NOT IN ('terminated', 'exited')
    """
    with get_conn() as conn:
        a_rows = conn.execute(sql_applicants).fetchall()
        d_rows = conn.execute(sql_directory).fetchall()

    by_email: dict[str, dict[str, Any]] = {}
    for r in d_rows:
        if r.get("email"):
            by_email[r["email"].lower()] = dict(r)
    for r in a_rows:  # applicants flow wins (portal-linked)
        if r.get("email"):
            by_email[r["email"].lower()] = dict(r)

    rows = list(by_email.values())
    for r in rows:
        for k in ("onboarded_at", "start_date"):
            if r.get(k) and not isinstance(r[k], str):
                r[k] = r[k].isoformat()
    rows.sort(key=lambda r: ((r.get("first_name") or "").lower(), (r.get("last_name") or "").lower()))
    return rows
