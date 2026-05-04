"""HR landing-dashboard router — one endpoint, real aggregates, no mock.

`GET /dashboard/summary?year&month` returns everything the landing page needs
in a single round-trip: KPI tiles, six-month payroll + headcount trends, a
hiring funnel, department mix, project status mix, a "needs your attention"
list, recent activity, and a small set of heuristic AI insights.

The shape is intentionally chunky so the React side can render the whole page
without chaining requests.
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from db import get_conn
from services import auth as auth_svc

router = APIRouter()
log = logging.getLogger(__name__)


def _hr(identity=Depends(auth_svc.current_identity)):
    auth_svc.require_hr(identity)
    return identity


def _month_label(y: int, m: int) -> str:
    return date(y, m, 1).strftime("%b %Y")


def _prev_month(y: int, m: int) -> tuple[int, int]:
    return (y - 1, 12) if m == 1 else (y, m - 1)


# ============================================================
# Heuristic insights — derived purely from the aggregates we just
# computed, so the dashboard never waits on an LLM. Each insight is
# {kind, title, body, severity}: severity drives the accent color.
# ============================================================

def _build_insights(
    *,
    open_jobs: int,
    pipeline_total: int,
    pipeline_by_status: dict[str, int],
    hr_open: int,
    hr_inprogress: int,
    pending_payroll: int,
    headcount_trend: list[dict[str, Any]],
    top_departments: list[dict[str, Any]],
) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []

    # 1. Hiring momentum
    interview = pipeline_by_status.get("Interview In Progress", 0) \
        + pipeline_by_status.get("Interview", 0)
    shortlisted = pipeline_by_status.get("Shortlisted", 0)
    if open_jobs > 0:
        out.append({
            "kind": "hiring",
            "severity": "info",
            "title": "Hiring pipeline is healthy",
            "body": (
                f"{pipeline_total} active candidates across {open_jobs} open "
                f"role{'s' if open_jobs != 1 else ''} — {shortlisted} shortlisted "
                f"and {interview} in interview stage."
            ),
        })
    elif pipeline_total > 0:
        out.append({
            "kind": "hiring",
            "severity": "warn",
            "title": "Candidates without an open role",
            "body": (
                f"{pipeline_total} candidates are in the pipeline but no roles "
                "are currently open. Reopen a posting or close out applicants."
            ),
        })

    # 2. HR ticket load
    if hr_open + hr_inprogress > 0:
        sev = "warn" if hr_open >= 5 else "info"
        out.append({
            "kind": "hr_queries",
            "severity": sev,
            "title": "Employee questions waiting",
            "body": (
                f"{hr_open} open and {hr_inprogress} in progress in HR Queries. "
                "Use Resolve-with-AI to clear policy questions in seconds."
            ),
        })

    # 3. Payroll readiness
    if pending_payroll > 0:
        out.append({
            "kind": "payroll",
            "severity": "warn",
            "title": "Payroll release pending",
            "body": (
                f"{pending_payroll} active employee{'s' if pending_payroll != 1 else ''} "
                "have not yet been released this period. Use bulk release to clear in one click."
            ),
        })
    else:
        out.append({
            "kind": "payroll",
            "severity": "success",
            "title": "Payroll fully released",
            "body": "Every active employee has a released payslip for the current period.",
        })

    # 4. Headcount growth (compare last vs first point of trend)
    if len(headcount_trend) >= 2:
        first = headcount_trend[0]["headcount"]
        last = headcount_trend[-1]["headcount"]
        if first > 0:
            delta_pct = (last - first) / first * 100.0
            if abs(delta_pct) >= 1:
                arrow = "up" if delta_pct >= 0 else "down"
                out.append({
                    "kind": "headcount",
                    "severity": "info" if delta_pct >= 0 else "warn",
                    "title": f"Headcount {arrow} {abs(delta_pct):.1f}%",
                    "body": (
                        f"Active workforce moved from {first} to {last} over the "
                        f"trailing {len(headcount_trend)} months."
                    ),
                })

    # 5. Department concentration
    if top_departments:
        top = top_departments[0]
        total = sum(d["headcount"] for d in top_departments)
        if total > 0:
            share = top["headcount"] / total * 100.0
            if share >= 25:
                out.append({
                    "kind": "departments",
                    "severity": "info",
                    "title": f"{top['department']} is the largest team",
                    "body": (
                        f"{top['headcount']} employees ({share:.0f}% of the company) "
                        "— consider this your biggest staffing center of gravity."
                    ),
                })

    # Cap at 4 to keep the panel scannable
    return out[:4]


# ============================================================
# Main endpoint
# ============================================================

@router.get("/summary")
def summary(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
    _=Depends(_hr),
):
    today = date.today()
    y = year or today.year
    m = month or today.month
    py, pm = _prev_month(y, m)

    with get_conn() as conn:
        # ---------- tiles: headcount ----------
        roster = conn.execute(
            """
            SELECT
                COUNT(*) FILTER (WHERE status='Active' AND exit_date IS NULL)::int AS active,
                COUNT(*) FILTER (WHERE status='Active' AND exit_date IS NULL
                                   AND join_date >= date_trunc('month', CURRENT_DATE)
                                   AND join_date <  date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::int
                    AS joined_this_month,
                COUNT(*) FILTER (WHERE status='Active' AND exit_date IS NULL
                                   AND join_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
                                   AND join_date <  date_trunc('month', CURRENT_DATE))::int
                    AS joined_last_month,
                COALESCE(SUM(base_salary) FILTER (WHERE status='Active' AND exit_date IS NULL), 0)::numeric
                    AS annual_payroll
            FROM employees.employees
            """
        ).fetchone()

        # ---------- tiles: hiring ----------
        open_jobs = conn.execute(
            "SELECT COUNT(*)::int n FROM applicants.job_postings WHERE status='Open'"
        ).fetchone()["n"]

        # In-flight = anyone not Rejected / Hired / Active Employee
        pipeline_rows = conn.execute(
            """
            SELECT status, COUNT(*)::int n FROM applicants.applicants
            GROUP BY status
            """
        ).fetchall()
        pipeline_by_status = {r["status"] or "Unknown": r["n"] for r in pipeline_rows}
        TERMINAL = {"Rejected", "Hired", "Active Employee", "Withdrawn"}
        pipeline_in_flight = sum(
            n for s, n in pipeline_by_status.items() if s not in TERMINAL
        )

        # ---------- tiles: projects ----------
        proj_rows = conn.execute(
            """
            SELECT project_status, COUNT(*)::int n FROM employees.projects
            GROUP BY project_status
            """
        ).fetchall()
        proj_by_status = {r["project_status"] or "Unknown": r["n"] for r in proj_rows}

        # ---------- tiles: HR queries ----------
        hr_rows = conn.execute(
            "SELECT status, COUNT(*)::int n FROM applicants.hr_queries GROUP BY status"
        ).fetchall()
        hr_by_status = {r["status"]: r["n"] for r in hr_rows}
        hr_resolved_today = conn.execute(
            """SELECT COUNT(*)::int n FROM applicants.hr_queries
               WHERE status='resolved' AND resolved_at::date = CURRENT_DATE"""
        ).fetchone()["n"]

        # ---------- payroll: this period released ----------
        period_payroll = conn.execute(
            """
            SELECT COUNT(*)::int released,
                   COALESCE(SUM(monthly_gross),0)::numeric gross,
                   COALESCE(SUM(net_pay),0)::numeric net
            FROM applicants.payroll_runs
            WHERE pay_period_year=%s AND pay_period_month=%s
            """,
            (y, m),
        ).fetchone()

        # ---------- charts: headcount cumulative trend (12 months) ----------
        # Cumulative count of employees with join_date <= end-of-month and
        # (exit_date IS NULL OR exit_date > end-of-month).
        headcount_trend_rows = conn.execute(
            """
            WITH months AS (
              SELECT generate_series(
                date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
                date_trunc('month', CURRENT_DATE),
                INTERVAL '1 month'
              )::date AS m
            )
            SELECT m::date AS m,
                   (SELECT COUNT(*)::int FROM employees.employees e
                     WHERE e.join_date <= (months.m + INTERVAL '1 month - 1 day')::date
                       AND (e.exit_date IS NULL
                            OR e.exit_date > (months.m + INTERVAL '1 month - 1 day')::date))
                   AS headcount
            FROM months
            ORDER BY m
            """
        ).fetchall()

        # ---------- charts: payroll trend (6 months trailing) ----------
        payroll_trend_rows = conn.execute(
            """
            SELECT pay_period_year y, pay_period_month m,
                   COALESCE(SUM(monthly_gross),0)::numeric gross,
                   COALESCE(SUM(net_pay),0)::numeric        net,
                   COUNT(*)::int                            runs
            FROM applicants.payroll_runs
            WHERE (pay_period_year, pay_period_month) <= (%s, %s)
            GROUP BY pay_period_year, pay_period_month
            ORDER BY pay_period_year DESC, pay_period_month DESC
            LIMIT 6
            """,
            (y, m),
        ).fetchall()

        # ---------- charts: department headcount (top 8) ----------
        dept_rows = conn.execute(
            """
            SELECT department_name, COUNT(*)::int n,
                   COALESCE(SUM(base_salary),0)::numeric annual
            FROM employees.employees
            WHERE status='Active' AND exit_date IS NULL
            GROUP BY department_name
            ORDER BY n DESC
            LIMIT 8
            """
        ).fetchall()

        # ---------- attention: pending payslips ----------
        pending_payroll = conn.execute(
            """
            SELECT COUNT(*)::int n
            FROM employees.employees e
            LEFT JOIN applicants.payroll_runs pr
                   ON pr.staff_employee_id = e.employee_id
                  AND pr.pay_period_year   = %s
                  AND pr.pay_period_month  = %s
            WHERE e.status='Active' AND e.exit_date IS NULL
              AND e.base_salary IS NOT NULL
              AND pr.payroll_run_id IS NULL
            """,
            (y, m),
        ).fetchone()["n"]

        # ---------- attention: stale candidates (Shortlisted >= 7 days, oldest 5) ----------
        stale_candidates = conn.execute(
            """
            SELECT applicant_id, first_name, last_name, status, created_at
            FROM applicants.applicants
            WHERE status IN ('Shortlisted','Interview In Progress','Interview')
              AND created_at < NOW() - INTERVAL '7 days'
            ORDER BY created_at
            LIMIT 5
            """
        ).fetchall()

        # ---------- recent activity (mixed feed) ----------
        recent_hires = conn.execute(
            """
            SELECT first_name, last_name, job_title, department_name, join_date
            FROM employees.employees
            WHERE join_date IS NOT NULL
            ORDER BY join_date DESC
            LIMIT 5
            """
        ).fetchall()
        recent_releases = conn.execute(
            """
            SELECT pr.released_at, e.first_name, e.last_name, pr.pay_period_label
            FROM applicants.payroll_runs pr
            JOIN employees.employees e ON e.employee_id = pr.staff_employee_id
            ORDER BY pr.released_at DESC
            LIMIT 5
            """
        ).fetchall()
        recent_tickets = conn.execute(
            """
            SELECT query_id, employee_name, question, status, created_at, resolved_at
            FROM applicants.hr_queries
            ORDER BY GREATEST(created_at, COALESCE(resolved_at, created_at)) DESC
            LIMIT 5
            """
        ).fetchall()

    # ------------- shape the response -------------

    headcount_trend = [
        {
            "month": r["m"].strftime("%b %Y"),
            "year": r["m"].year,
            "month_num": r["m"].month,
            "headcount": r["headcount"],
        }
        for r in headcount_trend_rows
    ]

    payroll_trend = list(reversed([
        {
            "label": _month_label(r["y"], r["m"]),
            "year": r["y"], "month": r["m"],
            "gross": float(r["gross"]),
            "net":   float(r["net"]),
            "runs":  r["runs"],
        }
        for r in payroll_trend_rows
    ]))

    department_headcount = [
        {
            "department": r["department_name"] or "Unassigned",
            "headcount":  r["n"],
            "annual":     float(r["annual"]),
        }
        for r in dept_rows
    ]

    project_status = [
        {"status": s, "count": n} for s, n in proj_by_status.items()
    ]

    # Hiring funnel — preserve a logical order, hide terminal states
    FUNNEL_ORDER = [
        "Applied", "Shortlisted",
        "Interview In Progress", "Interview",
        "Offered", "Offer", "Hired",
    ]
    hiring_funnel = []
    seen = set()
    for label in FUNNEL_ORDER:
        if label in pipeline_by_status:
            hiring_funnel.append({"stage": label, "count": pipeline_by_status[label]})
            seen.add(label)
    for s, n in pipeline_by_status.items():
        if s not in seen and s not in TERMINAL:
            hiring_funnel.append({"stage": s, "count": n})

    headcount_delta = roster["joined_this_month"] - roster["joined_last_month"]

    tiles = {
        "active_headcount": roster["active"],
        "joined_this_month": roster["joined_this_month"],
        "headcount_delta_vs_last_month": headcount_delta,

        "open_jobs": open_jobs,
        "pipeline_in_flight": pipeline_in_flight,

        "active_projects": proj_by_status.get("Active", 0),
        "planned_projects": proj_by_status.get("Planned", 0),

        "monthly_payroll_target": float(roster["annual_payroll"]) / 12.0,
        "released_this_period": period_payroll["released"],
        "released_gross_this_period": float(period_payroll["gross"]),

        "hr_open": hr_by_status.get("open", 0),
        "hr_in_progress": hr_by_status.get("in_progress", 0),
        "hr_resolved_today": hr_resolved_today,

        "pending_payroll_count": pending_payroll,
    }

    activity: list[dict[str, Any]] = []
    for r in recent_hires:
        activity.append({
            "kind": "hire",
            "title": f"{r['first_name']} {r['last_name']} joined as {r['job_title'] or 'Employee'}",
            "subtitle": r["department_name"] or "",
            "at": r["join_date"].isoformat() if r.get("join_date") else None,
        })
    for r in recent_releases:
        activity.append({
            "kind": "payroll",
            "title": f"Payslip released — {r['first_name']} {r['last_name']}",
            "subtitle": r["pay_period_label"],
            "at": r["released_at"].isoformat() if r.get("released_at") else None,
        })
    for r in recent_tickets:
        if r["status"] == "resolved":
            verb = "Resolved"
            ts  = r["resolved_at"]
        else:
            verb = "Raised"
            ts  = r["created_at"]
        activity.append({
            "kind": "hr_query",
            "title": f"{verb} HR query — {r['employee_name']}",
            "subtitle": (r["question"] or "")[:80],
            "at": ts.isoformat() if ts else None,
        })
    activity.sort(key=lambda x: x["at"] or "", reverse=True)
    activity = activity[:8]

    attention = []
    if pending_payroll > 0:
        attention.append({
            "kind": "payroll",
            "title": f"{pending_payroll} pending payslip{'s' if pending_payroll != 1 else ''} for {_month_label(y, m)}",
            "cta_label": "Open Compensation",
            "cta_path": "/compensation",
            "severity": "warn",
        })
    if hr_by_status.get("open", 0) > 0:
        attention.append({
            "kind": "hr_queries",
            "title": f"{hr_by_status['open']} open HR question{'s' if hr_by_status['open'] != 1 else ''} awaiting reply",
            "cta_label": "Open HR Queries",
            "cta_path": "/hr-queries",
            "severity": "info",
        })
    if stale_candidates:
        attention.append({
            "kind": "hiring",
            "title": f"{len(stale_candidates)} candidate{'s' if len(stale_candidates) != 1 else ''} idle 7+ days in pipeline",
            "subtitle": ", ".join(
                f"{c['first_name']} {c['last_name']}" for c in stale_candidates[:3]
            ),
            "cta_label": "Open Hiring",
            "cta_path": "/hiring",
            "severity": "warn",
        })

    insights = _build_insights(
        open_jobs=open_jobs,
        pipeline_total=pipeline_in_flight,
        pipeline_by_status=pipeline_by_status,
        hr_open=hr_by_status.get("open", 0),
        hr_inprogress=hr_by_status.get("in_progress", 0),
        pending_payroll=pending_payroll,
        headcount_trend=headcount_trend,
        top_departments=department_headcount,
    )

    return {
        "period": {"year": y, "month": m, "label": _month_label(y, m)},
        "tiles": tiles,
        "headcount_trend": headcount_trend,
        "payroll_trend": payroll_trend,
        "hiring_funnel": hiring_funnel,
        "department_headcount": department_headcount,
        "project_status": project_status,
        "attention": attention,
        "activity": activity,
        "insights": insights,
    }
