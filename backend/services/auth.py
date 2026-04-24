"""Demo-grade auth for the HR + employee portals.

- Passwords: PBKDF2-HMAC-SHA256, 200k iters, random salt.
- Tokens: base64url(json).base64url(hmac-sha256 signature). Stateless.
- Roles: 'hr' (single admin, creds from env) or 'employee' (applicant-backed
  by email + password_hash).

This is intentionally light: no session store, no refresh tokens. Good enough
for an internal demo; swap for a hardened flow before prod.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any, Optional

from fastapi import Header, HTTPException

from config import (
    AUTH_SECRET,
    DEFAULT_EMPLOYEE_PASSWORD,
    HR_EMAIL,
    HR_PASSWORD,
    TOKEN_TTL_SECONDS,
)
from db import get_conn

PBKDF_ITERS = 200_000


# ---------- password hashing ----------

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF_ITERS)
    return f"pbkdf2${PBKDF_ITERS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: Optional[str]) -> bool:
    if not stored:
        return False
    try:
        algo, iters_s, salt_hex, dk_hex = stored.split("$")
        if algo != "pbkdf2":
            return False
        iters = int(iters_s)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(dk_hex)
    except (ValueError, AttributeError):
        return False
    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iters)
    return hmac.compare_digest(expected, actual)


# ---------- token mint/verify ----------

def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def mint_token(payload: dict[str, Any], ttl_seconds: int = TOKEN_TTL_SECONDS) -> str:
    body = {**payload, "exp": int(time.time()) + ttl_seconds}
    raw = json.dumps(body, separators=(",", ":"), sort_keys=True).encode("utf-8")
    sig = hmac.new(AUTH_SECRET.encode("utf-8"), raw, hashlib.sha256).digest()
    return f"{_b64url(raw)}.{_b64url(sig)}"


def verify_token(token: str) -> Optional[dict[str, Any]]:
    if not token or "." not in token:
        return None
    raw_b64, sig_b64 = token.split(".", 1)
    try:
        raw = _b64url_decode(raw_b64)
        sig = _b64url_decode(sig_b64)
    except Exception:
        return None
    expected = hmac.new(AUTH_SECRET.encode("utf-8"), raw, hashlib.sha256).digest()
    if not hmac.compare_digest(expected, sig):
        return None
    try:
        body = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if body.get("exp", 0) < int(time.time()):
        return None
    return body


# ---------- login ----------

def login(role: str, email: str, password: str) -> Optional[dict[str, Any]]:
    email_l = (email or "").strip().lower()
    if role == "hr":
        if email_l == HR_EMAIL.lower() and password == HR_PASSWORD:
            return {"role": "hr", "email": HR_EMAIL, "name": "HR Admin"}
        return None

    if role == "employee":
        # Check applicants first (covers offer-accepted / pre-employee phase),
        # then employees table.
        with get_conn() as conn:
            a = conn.execute(
                """
                SELECT applicant_id, first_name, last_name, email,
                       password_hash, status, job_id
                FROM applicants.applicants
                WHERE LOWER(email) = %s
                LIMIT 1
                """,
                (email_l,),
            ).fetchone()
            emp = conn.execute(
                """
                SELECT employee_id, applicant_id, first_name, last_name, email,
                       password_hash, job_title, department
                FROM applicants.employees
                WHERE LOWER(email) = %s
                LIMIT 1
                """,
                (email_l,),
            ).fetchone()

        # Prefer employee row's password if it exists (it's the canonical one
        # post-onboarding); else fall back to applicant password.
        pw_hash = (emp or {}).get("password_hash") or (a or {}).get("password_hash")

        # Lazy-provision the default password for any applicant that hasn't
        # had one set yet. Candidates receive the default in the offer email,
        # so the first login with it should succeed and persist the hash.
        if not pw_hash and a and password == DEFAULT_EMPLOYEE_PASSWORD:
            set_applicant_password(a["applicant_id"], DEFAULT_EMPLOYEE_PASSWORD)
        elif not pw_hash or not verify_password(password, pw_hash):
            return None
        return {
            "role": "employee",
            "email": (emp or a)["email"],
            "applicant_id": (a or {}).get("applicant_id"),
            "employee_id": (emp or {}).get("employee_id"),
            "name": f"{(emp or a)['first_name']} {(emp or a)['last_name']}",
        }

    return None


# ---------- FastAPI dependency helpers ----------

def current_identity(authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    claims = verify_token(token)
    if not claims:
        raise HTTPException(401, "invalid or expired token")
    return claims


def require_hr(identity: dict[str, Any]) -> None:
    if identity.get("role") != "hr":
        raise HTTPException(403, "HR role required")


def require_employee(identity: dict[str, Any]) -> dict[str, Any]:
    if identity.get("role") != "employee":
        raise HTTPException(403, "employee role required")
    return identity


def set_applicant_password(applicant_id: int, plaintext: str) -> None:
    pw_hash = hash_password(plaintext)
    with get_conn() as conn:
        conn.execute(
            "UPDATE applicants.applicants SET password_hash = %s WHERE applicant_id = %s",
            (pw_hash, applicant_id),
        )
        conn.commit()
