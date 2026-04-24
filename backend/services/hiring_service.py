from typing import Any, Optional

from db import get_conn


# Pipeline status mapping:
#   Applied column  -> status = 'Applied'
#   Screening       -> status = 'Shortlisted'
#   Interview       -> status = 'Interview In Progress'
#   Offer           -> status = 'Hired'
PIPELINE_STATUSES = {
    "applied": "Applied",
    "screening": "Shortlisted",
    "interview": "Interview In Progress",
    "offer": "Hired",
}

ALLOWED_STATUSES = set(PIPELINE_STATUSES.values()) | {
    "Under Review",
    "Rejected",
    "Offered",
    "Offer Declined",
    "Ready for Onboarding",
    "Onboarding",
    "Active Employee",
    "Withdrawn",
}


def list_job_postings() -> list[dict[str, Any]]:
    sql = """
        SELECT
            j.job_id, j.job_title, j.department, j.location,
            j.employment_type, j.status, j.job_level,
            j.min_years_experience, j.preferred_country,
            (SELECT COUNT(*) FROM applicants.applicants a WHERE a.job_id = j.job_id) AS applicant_count
        FROM applicants.job_postings j
        ORDER BY j.created_at DESC
    """
    with get_conn() as conn:
        return conn.execute(sql).fetchall()


def get_job_posting(job_id: int) -> Optional[dict[str, Any]]:
    sql = "SELECT * FROM applicants.job_postings WHERE job_id = %s"
    with get_conn() as conn:
        return conn.execute(sql, (job_id,)).fetchone()


def list_applicants_for_job(job_id: int) -> list[dict[str, Any]]:
    sql = """
        SELECT
            a.applicant_id, a.first_name, a.last_name, a.email, a.status,
            a.application_date, a.total_years_experience, a.country,
            j.job_title,
            e.overall_score,
            (e.evaluation_id IS NOT NULL) AS evaluated
        FROM applicants.applicants a
        LEFT JOIN applicants.job_postings j ON j.job_id = a.job_id
        LEFT JOIN applicants.applicant_ai_evaluations e
            ON e.applicant_id = a.applicant_id AND e.job_id = a.job_id
        WHERE a.job_id = %s
        ORDER BY COALESCE(e.overall_score, -1) DESC, a.application_date DESC
    """
    with get_conn() as conn:
        rows = conn.execute(sql, (job_id,)).fetchall()
    for r in rows:
        if r.get("application_date"):
            r["application_date"] = r["application_date"].isoformat()
    return rows


def get_applicant_detail(applicant_id: int) -> Optional[dict[str, Any]]:
    with get_conn() as conn:
        applicant = conn.execute(
            "SELECT * FROM applicants.applicants WHERE applicant_id = %s",
            (applicant_id,),
        ).fetchone()
        if not applicant:
            return None

        job = None
        if applicant.get("job_id"):
            job = conn.execute(
                "SELECT * FROM applicants.job_postings WHERE job_id = %s",
                (applicant["job_id"],),
            ).fetchone()

        education = conn.execute(
            "SELECT * FROM applicants.applicant_education WHERE applicant_id = %s ORDER BY end_year DESC NULLS LAST",
            (applicant_id,),
        ).fetchall()
        work = conn.execute(
            "SELECT * FROM applicants.applicant_work_experience WHERE applicant_id = %s ORDER BY start_date DESC NULLS LAST",
            (applicant_id,),
        ).fetchall()
        projects = conn.execute(
            "SELECT * FROM applicants.applicant_projects WHERE applicant_id = %s ORDER BY start_date DESC NULLS LAST",
            (applicant_id,),
        ).fetchall()
        certs = conn.execute(
            "SELECT * FROM applicants.applicant_certifications WHERE applicant_id = %s ORDER BY issue_date DESC NULLS LAST",
            (applicant_id,),
        ).fetchall()
        achievements = conn.execute(
            "SELECT * FROM applicants.applicant_achievements WHERE applicant_id = %s ORDER BY achievement_date DESC NULLS LAST",
            (applicant_id,),
        ).fetchall()
        skills = conn.execute(
            "SELECT * FROM applicants.applicant_skills WHERE applicant_id = %s",
            (applicant_id,),
        ).fetchall()

        evaluation = None
        if applicant.get("job_id"):
            evaluation = conn.execute(
                """
                SELECT * FROM applicants.applicant_ai_evaluations
                WHERE applicant_id = %s AND job_id = %s
                """,
                (applicant_id, applicant["job_id"]),
            ).fetchone()

    return {
        "applicant": applicant,
        "job": job,
        "education": education,
        "work_experience": work,
        "projects": projects,
        "certifications": certs,
        "achievements": achievements,
        "skills": skills,
        "evaluation": evaluation,
    }


def update_applicant_status(applicant_id: int, status: str) -> Optional[dict[str, Any]]:
    if status not in ALLOWED_STATUSES:
        return None
    sql = """
        UPDATE applicants.applicants
        SET status = %s, updated_at = CURRENT_TIMESTAMP
        WHERE applicant_id = %s
        RETURNING applicant_id, status
    """
    with get_conn() as conn:
        row = conn.execute(sql, (status, applicant_id)).fetchone()
        conn.commit()
    return row


def prefilter_applicants(
    job_id: int,
    min_experience: Optional[float],
    country: Optional[str],
    require_work_auth: Optional[bool],
    notice_period_max_days: Optional[int],
) -> list[dict[str, Any]]:
    clauses = ["a.job_id = %s"]
    params: list[Any] = [job_id]
    if min_experience is not None:
        clauses.append("COALESCE(a.total_years_experience, 0) >= %s")
        params.append(min_experience)
    if country:
        clauses.append("LOWER(a.country) = LOWER(%s)")
        params.append(country)
    if require_work_auth is not None:
        clauses.append("a.work_authorization_required = %s")
        params.append(require_work_auth)
    if notice_period_max_days is not None:
        clauses.append("COALESCE(a.notice_period_days, 0) <= %s")
        params.append(notice_period_max_days)

    sql = f"""
        SELECT a.applicant_id, a.first_name, a.last_name, a.email,
               a.status, a.total_years_experience, a.country
        FROM applicants.applicants a
        WHERE {' AND '.join(clauses)}
    """
    with get_conn() as conn:
        return conn.execute(sql, params).fetchall()


def fetch_applicant_bundle_for_llm(applicant_id: int) -> dict[str, Any]:
    detail = get_applicant_detail(applicant_id)
    if not detail:
        return {}
    a = detail["applicant"]
    return {
        "applicant_id": a["applicant_id"],
        "name": f"{a['first_name']} {a['last_name']}",
        "total_years_experience": float(a["total_years_experience"])
            if a.get("total_years_experience") is not None else None,
        "country": a.get("country"),
        "skills": [
            {"name": s["skill_name"], "level": s.get("proficiency_level"),
             "years": float(s["years_of_experience"]) if s.get("years_of_experience") is not None else None}
            for s in detail["skills"]
        ],
        "work_experience": [
            {"company": w["company_name"], "title": w["job_title"],
             "start": str(w.get("start_date")) if w.get("start_date") else None,
             "end": str(w.get("end_date")) if w.get("end_date") else None,
             "description": w.get("description")}
            for w in detail["work_experience"]
        ],
        "education": [
            {"degree": e["degree"], "field": e.get("field_of_study"),
             "institution": e["institution_name"],
             "start_year": e.get("start_year"), "end_year": e.get("end_year"),
             "grade": e.get("grade_gpa")}
            for e in detail["education"]
        ],
        "projects": [
            {"title": p["project_title"], "type": p.get("project_type"),
             "tech": p.get("technologies_used"), "description": p.get("description")}
            for p in detail["projects"]
        ],
        "certifications": [
            {"name": c["certification_name"], "issuer": c.get("issuing_organization")}
            for c in detail["certifications"]
        ],
        "achievements": [
            {"title": ach["title"], "issuer": ach.get("issuer_or_organization"),
             "description": ach.get("description")}
            for ach in detail["achievements"]
        ],
    }


def record_invitation(
    *,
    applicant_id: int,
    job_id: int,
    kind: str,
    scheduled_at: Any,
    duration_minutes: int,
    timezone: Optional[str],
    meet_link: Optional[str],
    calendar_event_id: Optional[str],
    organizer_email: Optional[str],
    status: str = "Scheduled",
    error_message: Optional[str] = None,
    interviewer_emails: Optional[list[str]] = None,
) -> dict[str, Any]:
    sql = """
        INSERT INTO applicants.interview_invitations (
            applicant_id, job_id, kind, scheduled_at, duration_minutes,
            timezone, meet_link, calendar_event_id, organizer_email,
            status, error_message, interviewer_emails
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        RETURNING invite_id, meet_link, status, scheduled_at
    """
    with get_conn() as conn:
        row = conn.execute(
            sql,
            (
                applicant_id, job_id, kind, scheduled_at, duration_minutes,
                timezone, meet_link, calendar_event_id, organizer_email,
                status, error_message,
                [e.lower() for e in (interviewer_emails or []) if e],
            ),
        ).fetchone()
        conn.commit()
    return row


def get_applicants_basic(applicant_ids: list[int]) -> list[dict[str, Any]]:
    if not applicant_ids:
        return []
    sql = """
        SELECT a.applicant_id, a.first_name, a.last_name, a.email,
               a.job_id, j.job_title
        FROM applicants.applicants a
        LEFT JOIN applicants.job_postings j ON j.job_id = a.job_id
        WHERE a.applicant_id = ANY(%s)
    """
    with get_conn() as conn:
        return conn.execute(sql, (applicant_ids,)).fetchall()


def reject_remaining_applied(job_id: int) -> int:
    """After shortlisting, any applicant for this job still in Applied /
    Under Review is moved to Rejected. Returns number rejected."""
    sql = """
        UPDATE applicants.applicants
        SET status = 'Rejected', updated_at = CURRENT_TIMESTAMP
        WHERE job_id = %s
          AND status IN ('Applied', 'Under Review')
        RETURNING applicant_id
    """
    with get_conn() as conn:
        rows = conn.execute(sql, (job_id,)).fetchall()
        conn.commit()
    return len(rows)


def promote_top_to_shortlisted(job_id: int, limit: int = 20) -> int:
    """Move the top `limit` AI-scored candidates for this job (that are still
    Applied / Under Review) into 'Shortlisted'. Returns number promoted.
    Leaves candidates already past Applied untouched so HR curation is
    preserved across re-runs."""
    sql = """
        WITH ranked AS (
            SELECT a.applicant_id
            FROM applicants.applicants a
            JOIN applicants.applicant_ai_evaluations e
              ON e.applicant_id = a.applicant_id AND e.job_id = a.job_id
            WHERE a.job_id = %s
              AND a.status IN ('Applied', 'Under Review')
            ORDER BY e.overall_score DESC NULLS LAST
            LIMIT %s
        )
        UPDATE applicants.applicants a
        SET status = 'Shortlisted', updated_at = CURRENT_TIMESTAMP
        FROM ranked r
        WHERE a.applicant_id = r.applicant_id
        RETURNING a.applicant_id
    """
    with get_conn() as conn:
        rows = conn.execute(sql, (job_id, limit)).fetchall()
        conn.commit()
    return len(rows)


def upsert_evaluation(job_id: int, applicant_id: int, evaluation: dict[str, Any], model_id: str, raw: dict[str, Any]) -> None:
    import json
    sql = """
        INSERT INTO applicants.applicant_ai_evaluations (
            applicant_id, job_id, overall_score,
            skills_score, skills_reason,
            experience_score, experience_reason,
            projects_score, projects_reason,
            education_score, education_reason,
            certifications_score, certifications_reason,
            achievements_score, achievements_reason,
            summary, model_id, raw_response
        ) VALUES (
            %s, %s, %s,
            %s, %s,
            %s, %s,
            %s, %s,
            %s, %s,
            %s, %s,
            %s, %s,
            %s, %s, %s::jsonb
        )
        ON CONFLICT (applicant_id, job_id) DO UPDATE SET
            overall_score = EXCLUDED.overall_score,
            skills_score = EXCLUDED.skills_score,
            skills_reason = EXCLUDED.skills_reason,
            experience_score = EXCLUDED.experience_score,
            experience_reason = EXCLUDED.experience_reason,
            projects_score = EXCLUDED.projects_score,
            projects_reason = EXCLUDED.projects_reason,
            education_score = EXCLUDED.education_score,
            education_reason = EXCLUDED.education_reason,
            certifications_score = EXCLUDED.certifications_score,
            certifications_reason = EXCLUDED.certifications_reason,
            achievements_score = EXCLUDED.achievements_score,
            achievements_reason = EXCLUDED.achievements_reason,
            summary = EXCLUDED.summary,
            model_id = EXCLUDED.model_id,
            raw_response = EXCLUDED.raw_response,
            updated_at = CURRENT_TIMESTAMP
    """
    def facet(name: str):
        f = evaluation.get(name) or {}
        return f.get("score"), f.get("reason")

    s_sc, s_re = facet("skills")
    e_sc, e_re = facet("experience")
    p_sc, p_re = facet("projects")
    ed_sc, ed_re = facet("education")
    c_sc, c_re = facet("certifications")
    a_sc, a_re = facet("achievements")

    with get_conn() as conn:
        conn.execute(
            sql,
            (
                applicant_id, job_id, evaluation.get("overall_score"),
                s_sc, s_re,
                e_sc, e_re,
                p_sc, p_re,
                ed_sc, ed_re,
                c_sc, c_re,
                a_sc, a_re,
                evaluation.get("summary"),
                model_id,
                json.dumps(raw) if raw is not None else None,
            ),
        )
        conn.commit()
