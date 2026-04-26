"""DB layer for the Team Formation feature.

Responsibilities:
    - Persist project-requirement runs (parsed PDFs).
    - Filter candidate employees per requested role using SQL (cheap, deterministic).
    - Build a compact employee profile bundle for the LLM scorer.
    - Persist per-(role, employee) AI evaluations.
    - Save / list / fetch confirmed teams.

The router stays thin — all SQL lives here.
"""
from __future__ import annotations

import datetime as _dt
import decimal
import json
from typing import Any, Optional

from psycopg.types.json import Json

from db import get_conn

# ---------------- jsonable helper ----------------

def _jsonable(v: Any) -> Any:
    if isinstance(v, decimal.Decimal):
        return float(v)
    if isinstance(v, (_dt.datetime, _dt.date)):
        return v.isoformat()
    if isinstance(v, _dt.timedelta):
        return v.total_seconds()
    if isinstance(v, list):
        return [_jsonable(x) for x in v]
    if isinstance(v, dict):
        return {k: _jsonable(x) for k, x in v.items()}
    return v


def _row(r: dict | None) -> dict:
    return {k: _jsonable(v) for k, v in (r or {}).items()}


# ============================================================
# 1. Runs (uploaded PDFs)
# ============================================================

def create_run(
    *,
    project_name: str,
    project_summary: Optional[str],
    file_name: Optional[str],
    raw_text: Optional[str],
    parsed_requirements: dict[str, Any],
    parser_model_id: Optional[str],
    created_by: Optional[str],
) -> dict[str, Any]:
    sql = """
        INSERT INTO applicants.team_formation_runs
            (project_name, project_summary, file_name, raw_text,
             parsed_requirements, parser_model_id, status, created_by)
        VALUES (%s, %s, %s, %s, %s, %s, 'parsed', %s)
        RETURNING run_id, project_name, project_summary, file_name,
                  parsed_requirements, parser_model_id, status, created_at
    """
    with get_conn() as conn:
        row = conn.execute(sql, (
            project_name, project_summary, file_name, raw_text,
            Json(parsed_requirements), parser_model_id, created_by,
        )).fetchone()
        conn.commit()
    return _row(row)


def get_run(run_id: int) -> Optional[dict[str, Any]]:
    sql = """
        SELECT run_id, project_name, project_summary, file_name,
               parsed_requirements, parser_model_id, status,
               created_by, created_at, updated_at
        FROM applicants.team_formation_runs
        WHERE run_id = %s
    """
    with get_conn() as conn:
        row = conn.execute(sql, (run_id,)).fetchone()
    return _row(row) if row else None


def list_runs(limit: int = 30) -> list[dict[str, Any]]:
    sql = """
        SELECT run_id, project_name, file_name, status, created_at
        FROM applicants.team_formation_runs
        ORDER BY created_at DESC
        LIMIT %s
    """
    with get_conn() as conn:
        rows = conn.execute(sql, (limit,)).fetchall()
    return [_row(r) for r in rows]


def update_run_status(run_id: int, status: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "UPDATE applicants.team_formation_runs SET status=%s, updated_at=NOW() WHERE run_id=%s",
            (status, run_id),
        )
        conn.commit()


def update_run_requirements(run_id: int, parsed: dict[str, Any]) -> None:
    """Used when HR edits the parsed requirements before generating recommendations."""
    proj_name = parsed.get("project_name") or ""
    summary = parsed.get("project_summary") or parsed.get("summary") or ""
    with get_conn() as conn:
        conn.execute(
            """UPDATE applicants.team_formation_runs
                SET parsed_requirements=%s,
                    project_name=COALESCE(NULLIF(%s,''), project_name),
                    project_summary=COALESCE(NULLIF(%s,''), project_summary),
                    updated_at=NOW()
                WHERE run_id=%s""",
            (Json(parsed), proj_name, summary, run_id),
        )
        conn.commit()


# ============================================================
# 2. Candidate filtering
# ============================================================

# Designation buckets. Map a free-text designation in the PDF to a SQL ILIKE
# pattern over `job_title`. Wider patterns mean more candidates flow through
# to the LLM scorer (which then ranks them).
_DESIGNATION_PATTERNS: list[tuple[str, list[str]]] = [
    ("senior software engineer", ["%senior software engineer%", "%staff software engineer%", "%principal software engineer%"]),
    ("software engineer",        ["%software engineer%"]),
    ("developer",                ["%software engineer%", "%developer%"]),
    ("backend engineer",         ["%software engineer%", "%backend%"]),
    ("frontend engineer",        ["%software engineer%", "%frontend%"]),
    ("full stack",               ["%software engineer%", "%full stack%"]),

    ("senior data engineer",     ["%senior data engineer%", "%staff data engineer%", "%principal data engineer%"]),
    ("data engineer",            ["%data engineer%"]),
    ("analytics engineer",       ["%analytics engineer%", "%data engineer%"]),

    ("ml engineer",              ["%ml engineer%", "%ai engineer%", "%machine learning%"]),
    ("ai engineer",              ["%ai engineer%", "%ml engineer%", "%machine learning%"]),
    ("data scientist",           ["%data scientist%", "%ml engineer%"]),

    ("qa engineer",              ["%qa engineer%", "%quality%", "%sdet%", "%test engineer%"]),
    ("quality assurance",        ["%qa engineer%", "%quality%", "%sdet%"]),
    ("test",                     ["%qa engineer%", "%test engineer%", "%sdet%"]),

    ("devops",                   ["%devops%", "%cloud engineer%", "%site reliability%", "%sre%"]),
    ("sre",                      ["%site reliability%", "%sre%", "%devops%"]),
    ("cloud engineer",           ["%cloud engineer%", "%devops%", "%site reliability%"]),
    ("security engineer",        ["%security engineer%"]),
    ("systems administrator",    ["%systems administrator%", "%sysadmin%", "%it %"]),
    ("it",                       ["%systems administrator%", "%it %", "%support engineer%"]),

    ("designer",                 ["%designer%", "%design%"]),
    ("ux",                       ["%ux %", "%designer%", "%product designer%"]),

    ("product manager",          ["%product manager%", "%product owner%"]),
    ("product analyst",          ["%product analyst%", "%business analyst%", "%product manager%"]),
    ("project manager",          ["%project manager%", "%program manager%"]),
    ("engineering manager",      ["%engineering manager%", "%manager%"]),

    ("sales",                    ["%account executive%", "%sales%", "%business operations%"]),
    ("hr",                       ["%hr %", "%hr generalist%", "%recruiter%", "%human resource%"]),
]

_DEPARTMENT_FALLBACK: list[tuple[str, str]] = [
    ("software engineering", "Software Engineering"),
    ("data engineering",     "Data Engineering"),
    ("ai/ml",                "AI/ML"),
    ("ai",                   "AI/ML"),
    ("ml",                   "AI/ML"),
    ("quality",              "Quality Assurance"),
    ("qa",                   "Quality Assurance"),
    ("devops",               "DevOps & Cloud"),
    ("cloud",                "DevOps & Cloud"),
    ("it",                   "IT & Security"),
    ("security",             "IT & Security"),
    ("design",               "Design"),
    ("product",              "Product Management"),
    ("hr",                   "HR"),
    ("sales",                "Sales & Operations"),
]


def _patterns_for_role(role: dict[str, Any]) -> tuple[list[str], Optional[str]]:
    """Return (job_title ILIKE patterns, department fallback) for a role."""
    desig = (role.get("designation") or "").lower().strip()
    dep_hint = (role.get("department") or "").lower().strip()

    patterns: list[str] = []
    for key, pats in _DESIGNATION_PATTERNS:
        if key in desig:
            patterns.extend(pats)
            break

    dep: Optional[str] = None
    for key, val in _DEPARTMENT_FALLBACK:
        if key in dep_hint:
            dep = val
            break

    if not patterns:
        # No designation match — be permissive within the department.
        patterns = [f"%{w}%" for w in desig.split() if len(w) >= 4][:3] or ["%engineer%"]

    return patterns, dep


def candidate_pool_for_role(role: dict[str, Any], pool_limit: int = 25) -> list[dict[str, Any]]:
    """SQL pre-filter for one requested role.

    Filters:
      - status = 'Active'
      - bandwidth_percent >= role.allocation_percent (defaults to 25%)
      - job_title ILIKE one of the patterns (with optional department fallback)
      - exit_date IS NULL
    Sorted by best availability + most experience first.
    """
    patterns, dep = _patterns_for_role(role)
    required_alloc = float(role.get("allocation_percent") or role.get("allocation") or 25)
    min_years = float(role.get("min_experience_years") or 0)

    conds = ["e.status = 'Active'", "e.exit_date IS NULL"]
    params: list[Any] = []

    title_ors = " OR ".join(["LOWER(e.job_title) LIKE %s"] * len(patterns))
    if dep:
        conds.append(f"(({title_ors}) OR e.department_name = %s)")
        params.extend(patterns + [dep])
    else:
        conds.append(f"({title_ors})")
        params.extend(patterns)

    conds.append("e.bandwidth_percent >= %s")
    params.append(required_alloc)

    if min_years > 0:
        # Permissive — keep candidates within 1 year of the floor.
        conds.append("e.total_experience_years >= %s")
        params.append(max(min_years - 1.0, 0))

    sql = f"""
        SELECT e.employee_id, e.employee_code,
               e.first_name, e.last_name, e.email,
               e.job_title, e.employee_level, e.department_name,
               e.location, e.work_mode, e.employment_type,
               e.total_experience_years, e.company_experience_years,
               e.bandwidth_percent, e.current_project_count,
               e.join_date
        FROM employees.employees e
        WHERE {' AND '.join(conds)}
        ORDER BY e.bandwidth_percent DESC, e.total_experience_years DESC
        LIMIT %s
    """
    params.append(pool_limit)
    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [_row(r) for r in rows]


def fetch_employee_profile_bundle(employee_id: int) -> dict[str, Any]:
    """Compact profile of one employee, used as LLM input for scoring."""
    with get_conn() as conn:
        emp = conn.execute(
            """SELECT employee_id, employee_code, first_name, last_name, email,
                      job_title, employee_level, department_name,
                      employment_type, work_mode, location,
                      total_experience_years, company_experience_years,
                      bandwidth_percent, current_project_count,
                      status, join_date
               FROM employees.employees WHERE employee_id = %s""",
            (employee_id,),
        ).fetchone()
        if not emp:
            return {}

        skills = conn.execute(
            """SELECT skill_name, skill_category, proficiency_level,
                      years_of_experience, is_primary_skill
               FROM employees.employee_skills WHERE employee_id = %s
               ORDER BY is_primary_skill DESC, years_of_experience DESC NULLS LAST
               LIMIT 25""",
            (employee_id,),
        ).fetchall()

        certs = conn.execute(
            """SELECT certification_name, issuing_organization, status,
                      issue_date, expiry_date
               FROM employees.employee_certifications WHERE employee_id = %s
               ORDER BY issue_date DESC NULLS LAST LIMIT 12""",
            (employee_id,),
        ).fetchall()

        achievements = conn.execute(
            """SELECT title, category, issuer_or_organization, achievement_date, description
               FROM employees.employee_achievements WHERE employee_id = %s
               ORDER BY achievement_date DESC NULLS LAST LIMIT 8""",
            (employee_id,),
        ).fetchall()

        projects = conn.execute(
            """SELECT p.project_name, p.project_status, p.priority,
                      ep.role_in_project, ep.allocation_percent,
                      ep.assignment_status, ep.start_date, ep.end_date
               FROM employees.employee_projects ep
               JOIN employees.projects p ON p.project_id = ep.project_id
               WHERE ep.employee_id = %s
               ORDER BY ep.start_date DESC NULLS LAST LIMIT 10""",
            (employee_id,),
        ).fetchall()

        education = conn.execute(
            """SELECT degree, field_of_study, institution_name, end_year, grade_gpa
               FROM employees.employee_education WHERE employee_id = %s
               ORDER BY end_year DESC NULLS LAST LIMIT 5""",
            (employee_id,),
        ).fetchall()

    return {
        "employee": _row(emp),
        "skills": [_row(s) for s in skills],
        "certifications": [_row(c) for c in certs],
        "achievements": [_row(a) for a in achievements],
        "projects": [_row(p) for p in projects],
        "education": [_row(e) for e in education],
    }


# ============================================================
# 3. Evaluations
# ============================================================

def upsert_evaluation(
    *,
    run_id: int,
    role_designation: str,
    employee_id: int,
    overall_score: Optional[int],
    skills_score: Optional[int],
    availability_score: Optional[int],
    experience_score: Optional[int],
    projects_score: Optional[int],
    certifications_score: Optional[int],
    summary: Optional[str],
    reasons: dict[str, Any],
    available_bandwidth_percent: Optional[float],
    model_id: Optional[str],
    raw_response: dict[str, Any],
) -> None:
    sql = """
        INSERT INTO applicants.team_formation_evaluations
            (run_id, role_designation, employee_id,
             overall_score, skills_score, availability_score,
             experience_score, projects_score, certifications_score,
             summary, reasons, available_bandwidth_percent,
             model_id, raw_response)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (run_id, role_designation, employee_id) DO UPDATE
        SET overall_score = EXCLUDED.overall_score,
            skills_score = EXCLUDED.skills_score,
            availability_score = EXCLUDED.availability_score,
            experience_score = EXCLUDED.experience_score,
            projects_score = EXCLUDED.projects_score,
            certifications_score = EXCLUDED.certifications_score,
            summary = EXCLUDED.summary,
            reasons = EXCLUDED.reasons,
            available_bandwidth_percent = EXCLUDED.available_bandwidth_percent,
            model_id = EXCLUDED.model_id,
            raw_response = EXCLUDED.raw_response
    """
    with get_conn() as conn:
        conn.execute(sql, (
            run_id, role_designation, employee_id,
            overall_score, skills_score, availability_score,
            experience_score, projects_score, certifications_score,
            summary, Json(reasons), available_bandwidth_percent,
            model_id, Json(raw_response),
        ))
        conn.commit()


def evaluations_for_run(run_id: int) -> list[dict[str, Any]]:
    """All evaluations for a run, joined with the live employee snapshot."""
    sql = """
        SELECT ev.evaluation_id, ev.run_id, ev.role_designation, ev.employee_id,
               ev.overall_score, ev.skills_score, ev.availability_score,
               ev.experience_score, ev.projects_score, ev.certifications_score,
               ev.summary, ev.reasons, ev.available_bandwidth_percent,
               ev.model_id, ev.created_at,
               e.first_name, e.last_name, e.employee_code,
               e.job_title, e.employee_level, e.department_name,
               e.location, e.work_mode, e.bandwidth_percent,
               e.total_experience_years, e.current_project_count
        FROM applicants.team_formation_evaluations ev
        JOIN employees.employees e ON e.employee_id = ev.employee_id
        WHERE ev.run_id = %s
        ORDER BY ev.role_designation ASC, ev.overall_score DESC NULLS LAST
    """
    with get_conn() as conn:
        rows = conn.execute(sql, (run_id,)).fetchall()
    return [_row(r) for r in rows]


# ============================================================
# 4. Teams
# ============================================================

def _is_project_manager_role(role: Optional[str]) -> bool:
    if not role:
        return False
    r = role.strip().lower()
    return r in {"project manager", "pm", "engineering manager", "program manager"}


def _mirror_team_to_canonical(
    conn,
    *,
    team_id: int,
    project_name: str,
    project_summary: Optional[str],
    members: list[dict[str, Any]],
) -> int:
    """Create a row in employees.projects + per-member employees.employee_projects
    so the team is visible in the canonical roster (Compensation, Employee
    Portal "My Projects", etc.). Returns the new project_id.

    Idempotent at the team level — if applicants.teams already has a project_id,
    we update that row instead of inserting a new one.
    """
    pm_id: Optional[int] = next(
        (int(m["employee_id"]) for m in members if _is_project_manager_role(m.get("role_designation"))),
        None,
    )

    existing = conn.execute(
        "SELECT project_id FROM applicants.teams WHERE team_id = %s",
        (team_id,),
    ).fetchone()
    project_id = (existing or {}).get("project_id")

    if project_id:
        conn.execute(
            """UPDATE employees.projects
               SET project_name = %s,
                   description = %s,
                   project_manager_id = %s,
                   project_status = 'Active'
               WHERE project_id = %s""",
            (project_name, project_summary, pm_id, project_id),
        )
        # rebuild the assignments — simplest correct path
        conn.execute(
            "DELETE FROM employees.employee_projects WHERE project_id = %s",
            (project_id,),
        )
    else:
        row = conn.execute(
            """INSERT INTO employees.projects
                (project_name, description, project_manager_id,
                 project_status, start_date)
               VALUES (%s, %s, %s, 'Active', CURRENT_DATE)
               RETURNING project_id""",
            (project_name, project_summary, pm_id),
        ).fetchone()
        project_id = int(row["project_id"])
        conn.execute(
            "UPDATE applicants.teams SET project_id = %s WHERE team_id = %s",
            (project_id, team_id),
        )

    for m in members:
        alloc = m.get("allocation_percent")
        # employee_projects.allocation_percent is NOT NULL; PMs default to 100.
        if alloc is None:
            alloc = 100
        conn.execute(
            """INSERT INTO employees.employee_projects
                (employee_id, project_id, role_in_project,
                 allocation_percent, start_date, assignment_status)
               VALUES (%s, %s, %s, %s, CURRENT_DATE, 'Active')""",
            (int(m["employee_id"]), project_id,
             m.get("role_designation"), alloc),
        )

    return int(project_id)


def create_team(
    *,
    team_name: str,
    project_name: str,
    project_summary: Optional[str],
    run_id: Optional[int],
    requirements: Optional[dict[str, Any]],
    members: list[dict[str, Any]],
    created_by: Optional[str],
) -> dict[str, Any]:
    """members: [{employee_id, role_designation, fit_score, allocation_percent}]"""
    with get_conn() as conn:
        team = conn.execute(
            """INSERT INTO applicants.teams
                (team_name, project_name, project_summary, run_id,
                 requirements, status, created_by)
               VALUES (%s, %s, %s, %s, %s, 'Active', %s)
               RETURNING team_id, team_name, project_name, project_summary,
                         run_id, status, created_at""",
            (team_name, project_name, project_summary, run_id,
             Json(requirements or {}), created_by),
        ).fetchone()
        team_id = team["team_id"]
        for m in members:
            conn.execute(
                """INSERT INTO applicants.team_members
                    (team_id, employee_id, role_designation, fit_score, allocation_percent)
                   VALUES (%s, %s, %s, %s, %s)
                   ON CONFLICT (team_id, employee_id) DO NOTHING""",
                (team_id, int(m["employee_id"]), m["role_designation"],
                 m.get("fit_score"), m.get("allocation_percent")),
            )
        if run_id:
            conn.execute(
                "UPDATE applicants.team_formation_runs SET status='team_created', updated_at=NOW() WHERE run_id=%s",
                (run_id,),
            )

        # Mirror into the canonical employees.projects so that everyone on
        # the team — including the Project Manager — sees the project in
        # their Employee Portal "My Projects" view.
        _mirror_team_to_canonical(
            conn,
            team_id=team_id,
            project_name=project_name or team_name,
            project_summary=project_summary,
            members=members,
        )

        conn.commit()
    return _row(team)


def list_teams(limit: int = 50) -> list[dict[str, Any]]:
    sql = """
        SELECT t.team_id, t.team_name, t.project_name, t.project_summary,
               t.status, t.created_at,
               COUNT(tm.team_member_id) AS member_count
        FROM applicants.teams t
        LEFT JOIN applicants.team_members tm ON tm.team_id = t.team_id
        GROUP BY t.team_id
        ORDER BY t.created_at DESC
        LIMIT %s
    """
    with get_conn() as conn:
        rows = conn.execute(sql, (limit,)).fetchall()
    return [_row(r) for r in rows]


def get_team(team_id: int) -> Optional[dict[str, Any]]:
    with get_conn() as conn:
        team = conn.execute(
            """SELECT team_id, team_name, project_name, project_summary,
                      run_id, requirements, status, created_by,
                      created_at, updated_at
               FROM applicants.teams WHERE team_id = %s""",
            (team_id,),
        ).fetchone()
        if not team:
            return None

        members = conn.execute(
            """SELECT tm.team_member_id, tm.role_designation, tm.fit_score,
                      tm.allocation_percent, tm.added_at,
                      e.employee_id, e.employee_code, e.first_name, e.last_name,
                      e.job_title, e.employee_level, e.department_name,
                      e.location, e.work_mode, e.bandwidth_percent,
                      e.total_experience_years, e.email
               FROM applicants.team_members tm
               JOIN employees.employees e ON e.employee_id = tm.employee_id
               WHERE tm.team_id = %s
               ORDER BY tm.role_designation ASC, tm.fit_score DESC NULLS LAST""",
            (team_id,),
        ).fetchall()

    out = _row(team)
    out["members"] = [_row(m) for m in members]
    return out
