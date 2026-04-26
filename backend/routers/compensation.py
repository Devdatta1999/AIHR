"""HR-facing compensation & payroll router.

Endpoints:
    GET  /compensation/summary?year&month   tiles + chart data for the dashboard
    GET  /compensation/employees?year&month roster row + last-released status
    POST /compensation/release               release a payslip (employee, year, month)
    GET  /compensation/runs/{id}             fetch a single payslip
    GET  /compensation/runs/{id}/pdf         download the payslip PDF
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel

from db import get_conn
from services import auth as auth_svc
from services import payroll as pr
from services.payslip_pdf import render_payslip_pdf

router = APIRouter()
log = logging.getLogger(__name__)


def _hr(identity=Depends(auth_svc.current_identity)):
    auth_svc.require_hr(identity)
    return identity


def _email(identity: dict[str, Any]) -> Optional[str]:
    return (identity or {}).get("email")


# ============================================================
# Summary — KPI tiles + monthly trend + dept breakdown
# ============================================================

@router.get("/summary")
def summary(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    _=Depends(_hr),
):
    """Tiles + chart data for the HR Compensation dashboard."""
    with get_conn() as conn:
        # Roster shape (active only).
        roster = conn.execute(
            """
            SELECT COUNT(*)::int                           AS active_headcount,
                   COALESCE(SUM(base_salary), 0)::numeric  AS total_annual_payroll,
                   COALESCE(AVG(base_salary), 0)::numeric  AS avg_base_salary
            FROM employees.employees
            WHERE status = 'Active' AND base_salary IS NOT NULL
            """
        ).fetchone()

        # This month's release stats.
        period = conn.execute(
            """
            SELECT COUNT(*)::int                          AS released_count,
                   COALESCE(SUM(monthly_gross), 0)::numeric  AS released_gross,
                   COALESCE(SUM(net_pay), 0)::numeric        AS released_net,
                   COALESCE(SUM(total_deductions), 0)::numeric AS released_deductions
            FROM applicants.payroll_runs
            WHERE pay_period_year = %s AND pay_period_month = %s
            """,
            (year, month),
        ).fetchone()

        # Trailing 6-month payroll trend (gross, by month).
        trend_rows = conn.execute(
            """
            SELECT pay_period_year AS y, pay_period_month AS m,
                   COALESCE(SUM(monthly_gross), 0)::numeric AS gross,
                   COALESCE(SUM(net_pay), 0)::numeric        AS net,
                   COUNT(*)::int                             AS runs
            FROM applicants.payroll_runs
            WHERE (pay_period_year, pay_period_month) <= (%s, %s)
            GROUP BY pay_period_year, pay_period_month
            ORDER BY pay_period_year DESC, pay_period_month DESC
            LIMIT 6
            """,
            (year, month),
        ).fetchall()

        # Department-level monthly payroll snapshot (annual / 12).
        dept_rows = conn.execute(
            """
            SELECT department_name,
                   COUNT(*)::int                          AS headcount,
                   COALESCE(SUM(base_salary), 0)::numeric AS annual_payroll
            FROM employees.employees
            WHERE status = 'Active' AND base_salary IS NOT NULL
            GROUP BY department_name
            ORDER BY annual_payroll DESC
            """
        ).fetchall()

    monthly_payroll = float(roster["total_annual_payroll"]) / 12.0

    trend = list(reversed([
        {
            "year": r["y"], "month": r["m"],
            "label": f"{date(r['y'], r['m'], 1).strftime('%b %Y')}",
            "gross": float(r["gross"]),
            "net": float(r["net"]),
            "runs": r["runs"],
        }
        for r in trend_rows
    ]))

    departments = [
        {
            "department": r["department_name"] or "Unassigned",
            "headcount": r["headcount"],
            "monthly_payroll": float(r["annual_payroll"]) / 12.0,
            "annual_payroll": float(r["annual_payroll"]),
        }
        for r in dept_rows
    ]

    return {
        "period": {
            "year": year, "month": month,
            "label": pr._period_label(year, month),
        },
        "tiles": {
            "active_headcount": roster["active_headcount"],
            "monthly_payroll_target": monthly_payroll,
            "avg_base_salary": float(roster["avg_base_salary"]),
            "released_this_period": period["released_count"],
            "released_gross_this_period": float(period["released_gross"]),
            "released_net_this_period": float(period["released_net"]),
            "released_deductions_this_period": float(period["released_deductions"]),
            "pending_this_period": max(
                roster["active_headcount"] - period["released_count"], 0
            ),
        },
        "trend": trend,
        "departments": departments,
    }


# ============================================================
# Employee roster with release status for a given period
# ============================================================

@router.get("/employees")
def list_employees_for_period(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    q: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="released | pending"),
    limit: int = Query(200, ge=1, le=1000),
    _=Depends(_hr),
):
    """Active roster joined with whatever payroll_run exists for (year, month).

    Used by the HR Compensation table.
    """
    conds = ["e.status = 'Active'", "e.exit_date IS NULL", "e.base_salary IS NOT NULL"]
    params: list[Any] = [year, month]

    if q:
        conds.append(
            "(e.first_name ILIKE %s OR e.last_name ILIKE %s OR e.email ILIKE %s "
            "OR (e.first_name || ' ' || e.last_name) ILIKE %s OR e.job_title ILIKE %s)"
        )
        like = f"%{q.strip()}%"
        params.extend([like, like, like, like, like])
    if department:
        conds.append("e.department_name = %s")
        params.append(department)

    sql = f"""
        SELECT e.employee_id, e.employee_code, e.first_name, e.last_name,
               e.email, e.job_title, e.employee_level, e.department_name,
               e.location, e.base_salary, e.currency, e.bonus_eligible,
               e.join_date,
               pr.payroll_run_id, pr.pay_period_label, pr.monthly_gross,
               pr.total_deductions, pr.net_pay, pr.released_at,
               pr.status AS payroll_status
        FROM employees.employees e
        LEFT JOIN applicants.payroll_runs pr
               ON pr.staff_employee_id = e.employee_id
              AND pr.pay_period_year   = %s
              AND pr.pay_period_month  = %s
        WHERE {' AND '.join(conds)}
        ORDER BY e.department_name NULLS LAST, e.first_name
        LIMIT %s
    """
    params.append(limit)

    with get_conn() as conn:
        rows = conn.execute(sql, tuple(params)).fetchall()

    out = []
    for r in rows:
        is_released = r.get("payroll_run_id") is not None
        if status == "released" and not is_released:
            continue
        if status == "pending" and is_released:
            continue
        out.append({
            "employee_id": r["employee_id"],
            "employee_code": r.get("employee_code"),
            "first_name": r["first_name"],
            "last_name": r["last_name"],
            "email": r.get("email"),
            "job_title": r.get("job_title"),
            "employee_level": r.get("employee_level"),
            "department_name": r.get("department_name"),
            "location": r.get("location"),
            "join_date": r["join_date"].isoformat() if r.get("join_date") else None,
            "base_salary": float(r["base_salary"]) if r.get("base_salary") is not None else None,
            "currency": r.get("currency") or "USD",
            "bonus_eligible": r.get("bonus_eligible"),
            "released": is_released,
            "payroll_run_id": r.get("payroll_run_id"),
            "pay_period_label": r.get("pay_period_label"),
            "monthly_gross": float(r["monthly_gross"]) if r.get("monthly_gross") is not None else None,
            "total_deductions": float(r["total_deductions"]) if r.get("total_deductions") is not None else None,
            "net_pay": float(r["net_pay"]) if r.get("net_pay") is not None else None,
            "released_at": r["released_at"].isoformat() if r.get("released_at") else None,
        })
    return {"period": {"year": year, "month": month}, "employees": out}


# ============================================================
# Release a payslip
# ============================================================

class ReleaseBody(BaseModel):
    employee_id: int
    year: int
    month: int


@router.post("/release")
def release(body: ReleaseBody, identity=Depends(_hr)):
    try:
        return pr.release_payroll(
            staff_employee_id=body.employee_id,
            year=body.year,
            month=body.month,
            released_by=_email(identity),
        )
    except ValueError as e:
        raise HTTPException(409, str(e))
    except Exception as e:
        log.exception("payroll release failed")
        raise HTTPException(500, f"Release failed: {e}")


# ============================================================
# Bulk release — entire roster or a single department
# ============================================================

class BulkReleaseBody(BaseModel):
    year: int
    month: int
    scope: str  # "all" | "department"
    department: Optional[str] = None


@router.post("/release-bulk")
def release_bulk(body: BulkReleaseBody, identity=Depends(_hr)):
    """Release payroll for everyone pending in (year, month).

    Scopes:
      - scope="all"          → entire active roster
      - scope="department"   → only employees whose department_name matches
                                the supplied `department` string

    Anyone already released for that period is skipped (not an error). All
    failures are surfaced in the response, but the request itself returns
    200 unless nothing was attempted at all.
    """
    if body.scope not in ("all", "department"):
        raise HTTPException(400, "scope must be 'all' or 'department'")
    if body.scope == "department" and not body.department:
        raise HTTPException(400, "department is required when scope='department'")

    conds = ["status = 'Active'", "exit_date IS NULL", "base_salary IS NOT NULL"]
    params: list[Any] = []
    if body.scope == "department":
        conds.append("department_name = %s")
        params.append(body.department)

    sql = f"""
        SELECT employee_id, first_name, last_name, department_name
        FROM employees.employees
        WHERE {' AND '.join(conds)}
        ORDER BY department_name NULLS LAST, first_name
    """
    with get_conn() as conn:
        candidates = conn.execute(sql, tuple(params)).fetchall()

    if not candidates:
        raise HTTPException(404, "no eligible employees found for the chosen scope")

    released: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    failed: list[dict[str, Any]] = []
    actor = _email(identity)

    for c in candidates:
        try:
            slip = pr.release_payroll(
                staff_employee_id=c["employee_id"],
                year=body.year,
                month=body.month,
                released_by=actor,
            )
            released.append({
                "employee_id": c["employee_id"],
                "name": f"{c['first_name']} {c['last_name']}",
                "payroll_run_id": slip["payroll_run_id"],
                "net_pay": slip["net_pay"],
            })
        except ValueError as e:
            # The most common ValueError here is "already released" — treat
            # that as a skip rather than a failure so a re-run is harmless.
            msg = str(e)
            if "already released" in msg:
                skipped.append({
                    "employee_id": c["employee_id"],
                    "name": f"{c['first_name']} {c['last_name']}",
                    "reason": msg,
                })
            else:
                failed.append({
                    "employee_id": c["employee_id"],
                    "name": f"{c['first_name']} {c['last_name']}",
                    "reason": msg,
                })
        except Exception as e:
            log.exception("bulk release row failed (employee_id=%s)", c["employee_id"])
            failed.append({
                "employee_id": c["employee_id"],
                "name": f"{c['first_name']} {c['last_name']}",
                "reason": str(e),
            })

    return {
        "period": {
            "year": body.year, "month": body.month,
            "label": pr._period_label(body.year, body.month),
        },
        "scope": body.scope,
        "department": body.department,
        "attempted": len(candidates),
        "released_count": len(released),
        "skipped_count": len(skipped),
        "failed_count": len(failed),
        "released": released,
        "skipped": skipped,
        "failed": failed,
    }


# ============================================================
# Fetch one run + PDF
# ============================================================

def _employee_card_for_run(staff_employee_id: int) -> dict[str, Any]:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT employee_id, employee_code, first_name, last_name, email,
                   job_title, employee_level, department_name, location
            FROM employees.employees
            WHERE employee_id = %s
            """,
            (staff_employee_id,),
        ).fetchone()
    return dict(row) if row else {}


@router.get("/runs/{run_id}")
def get_run(run_id: int, _=Depends(_hr)):
    p = pr.get_payslip(run_id)
    if not p:
        raise HTTPException(404, "payroll run not found")
    p["employee"] = _employee_card_for_run(p["staff_employee_id"])
    return p


@router.get("/runs/{run_id}/pdf")
def download_run_pdf(run_id: int, _=Depends(_hr)):
    p = pr.get_payslip(run_id)
    if not p:
        raise HTTPException(404, "payroll run not found")
    pdf_bytes = render_payslip_pdf(p, employee=_employee_card_for_run(p["staff_employee_id"]))
    fname = f"payslip-{p['pay_period_year']}-{p['pay_period_month']:02d}-{p['staff_employee_id']}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )
