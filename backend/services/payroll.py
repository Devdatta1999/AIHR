"""Payroll service.

Pure computation + persistence for the Compensation feature. No LLM —
this is deterministic so payslips are reproducible and auditable.

Design notes
------------
* The roster lives in `employees.employees` (canonical HR data, ~462 active).
* A "release" produces one row in `applicants.payroll_runs` per employee
  per (year, month). The same period cannot be released twice for the same
  employee — `uq_payroll_employee_period` is the safety net.
* Deductions follow simple, demo-grade US-style brackets. They round to
  whole dollars at the line-item level so the payslip totals are clean.
* YTD aggregates are stored on each row — cheaper to read at the portal
  and lets us correctly show YTD even after corrections (we just resum).
"""
from __future__ import annotations

import calendar
import json
import logging
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Optional

from db import get_conn

log = logging.getLogger(__name__)


# ============================================================
# Deduction model (demo-grade US, single-filer assumptions)
# ============================================================

# Federal income tax — simplified progressive brackets, ANNUAL.
FEDERAL_BRACKETS = [
    (Decimal("11_600"),  Decimal("0.10")),
    (Decimal("47_150"),  Decimal("0.12")),
    (Decimal("100_525"), Decimal("0.22")),
    (Decimal("191_950"), Decimal("0.24")),
    (Decimal("243_725"), Decimal("0.32")),
    (Decimal("609_350"), Decimal("0.35")),
    (None,               Decimal("0.37")),
]

STATE_TAX_RATE = Decimal("0.05")          # flat, demo-grade
SOCIAL_SECURITY_RATE = Decimal("0.062")   # FICA OASDI
SOCIAL_SECURITY_WAGE_BASE_ANNUAL = Decimal("168_600")
MEDICARE_RATE = Decimal("0.0145")
RETIREMENT_401K_RATE = Decimal("0.06")    # employee's pre-tax contribution
HEALTH_INSURANCE_PER_MONTH = Decimal("250")  # employee share, flat


def _q(amount: Decimal) -> Decimal:
    """Round to whole dollars, half-up. Keeps payslip arithmetic readable."""
    return amount.quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def _annual_federal_tax(annual_taxable: Decimal) -> Decimal:
    tax = Decimal("0")
    prev_cap = Decimal("0")
    for cap, rate in FEDERAL_BRACKETS:
        if cap is None or annual_taxable <= cap:
            tax += (annual_taxable - prev_cap) * rate
            return tax
        tax += (cap - prev_cap) * rate
        prev_cap = cap
    return tax


def compute_payslip(annual_base_salary: Decimal) -> dict[str, Any]:
    """Pure: turn an annual base into a single-month payslip breakdown.

    Returns a dict with monthly_gross, earnings list, deductions list,
    total_deductions, net_pay. All amounts are Decimals rounded to whole
    dollars.
    """
    annual = Decimal(annual_base_salary)
    monthly_gross = _q(annual / Decimal("12"))

    # Earnings (single line in the demo; structure leaves room for bonus,
    # overtime, allowances later).
    earnings = [{"label": "Base salary", "amount": monthly_gross}]
    total_earnings = sum((e["amount"] for e in earnings), Decimal("0"))

    # Pre-tax deductions reduce taxable income.
    retirement = _q(monthly_gross * RETIREMENT_401K_RATE)
    health = _q(HEALTH_INSURANCE_PER_MONTH)
    pretax = retirement + health
    monthly_taxable = monthly_gross - pretax

    # Federal: compute on annualized taxable, then divide by 12.
    annual_taxable = monthly_taxable * Decimal("12")
    federal = _q(_annual_federal_tax(annual_taxable) / Decimal("12"))
    state = _q(monthly_taxable * STATE_TAX_RATE)

    # FICA: cap social security at the wage base; medicare uncapped.
    ss_taxable_monthly = min(monthly_gross, SOCIAL_SECURITY_WAGE_BASE_ANNUAL / Decimal("12"))
    social_security = _q(ss_taxable_monthly * SOCIAL_SECURITY_RATE)
    medicare = _q(monthly_gross * MEDICARE_RATE)

    deductions = [
        {"label": "Federal income tax", "amount": federal},
        {"label": "State income tax",   "amount": state},
        {"label": "Social security",    "amount": social_security},
        {"label": "Medicare",           "amount": medicare},
        {"label": "401(k) contribution","amount": retirement},
        {"label": "Health insurance",   "amount": health},
    ]
    total_deductions = sum((d["amount"] for d in deductions), Decimal("0"))
    net_pay = total_earnings - total_deductions

    return {
        "monthly_gross": monthly_gross,
        "earnings": earnings,
        "deductions": deductions,
        "total_earnings": total_earnings,
        "total_deductions": total_deductions,
        "net_pay": net_pay,
    }


# ============================================================
# Persistence
# ============================================================

MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def _period_label(year: int, month: int) -> str:
    return f"{MONTH_NAMES[month - 1]} {year}"


def _period_dates(year: int, month: int) -> tuple[date, date, date]:
    last_day = calendar.monthrange(year, month)[1]
    period_start = date(year, month, 1)
    period_end = date(year, month, last_day)
    pay_date = period_end  # demo: pay on the last calendar day
    return period_start, period_end, pay_date


def _decimal_to_str(obj: Any) -> Any:
    """Convert Decimals to strings for JSON storage (preserves dollars)."""
    if isinstance(obj, Decimal):
        return str(obj)
    if isinstance(obj, list):
        return [_decimal_to_str(x) for x in obj]
    if isinstance(obj, dict):
        return {k: _decimal_to_str(v) for k, v in obj.items()}
    return obj


def _ytd_for(conn, staff_employee_id: int, year: int, through_month: int) -> dict[str, Decimal]:
    """Sum totals for runs up to and including (year, through_month)."""
    row = conn.execute(
        """
        SELECT COALESCE(SUM(monthly_gross), 0)::numeric         AS gross,
               COALESCE(SUM(total_deductions), 0)::numeric      AS total_ded,
               COALESCE(SUM(net_pay), 0)::numeric               AS net,
               COALESCE(SUM(
                   COALESCE((deductions_json->0->>'amount')::numeric, 0) +
                   COALESCE((deductions_json->1->>'amount')::numeric, 0) +
                   COALESCE((deductions_json->2->>'amount')::numeric, 0) +
                   COALESCE((deductions_json->3->>'amount')::numeric, 0)
               ), 0)::numeric AS tax
        FROM applicants.payroll_runs
        WHERE staff_employee_id = %s
          AND pay_period_year = %s
          AND pay_period_month <= %s
        """,
        (staff_employee_id, year, through_month),
    ).fetchone()
    return {
        "gross": Decimal(row["gross"]),
        "tax":   Decimal(row["tax"]),
        "net":   Decimal(row["net"]),
    }


def release_payroll(
    *,
    staff_employee_id: int,
    year: int,
    month: int,
    released_by: Optional[str] = None,
) -> dict[str, Any]:
    """Compute + persist a payroll run for one employee in one period.

    Idempotency: raises ValueError if a run already exists for the period.
    """
    if month < 1 or month > 12:
        raise ValueError("month must be 1..12")

    with get_conn() as conn:
        emp = conn.execute(
            """
            SELECT employee_id, employee_code, first_name, last_name, email,
                   department_name, job_title, base_salary, currency
            FROM employees.employees
            WHERE employee_id = %s
            """,
            (staff_employee_id,),
        ).fetchone()
        if not emp:
            raise ValueError(f"employee {staff_employee_id} not found")
        if emp.get("base_salary") is None:
            raise ValueError(f"employee {staff_employee_id} has no base_salary on file")

        existing = conn.execute(
            """
            SELECT payroll_run_id
            FROM applicants.payroll_runs
            WHERE staff_employee_id = %s AND pay_period_year = %s AND pay_period_month = %s
            """,
            (staff_employee_id, year, month),
        ).fetchone()
        if existing:
            raise ValueError(
                f"payroll already released for {emp['first_name']} {emp['last_name']} "
                f"({_period_label(year, month)})"
            )

        annual = Decimal(emp["base_salary"])
        slip = compute_payslip(annual)

        period_start, period_end, pay_date = _period_dates(year, month)
        prior = _ytd_for(conn, staff_employee_id, year, month - 1) if month > 1 \
                else {"gross": Decimal("0"), "tax": Decimal("0"), "net": Decimal("0")}

        # Tax YTD = sum of the first four deduction items (federal, state, SS, medicare).
        period_tax = sum(
            (d["amount"] for d in slip["deductions"][:4]),
            Decimal("0"),
        )
        ytd_gross = prior["gross"] + slip["monthly_gross"]
        ytd_tax = prior["tax"] + period_tax
        ytd_net = prior["net"] + slip["net_pay"]

        # Prefer the portal-facing email if one is linked; fall back to the
        # corporate email on the HR roster.
        portal_email = conn.execute(
            "SELECT email FROM applicants.employees WHERE staff_employee_id = %s LIMIT 1",
            (staff_employee_id,),
        ).fetchone()
        employee_email = (portal_email or {}).get("email") or emp["email"]

        row = conn.execute(
            """
            INSERT INTO applicants.payroll_runs (
                staff_employee_id, employee_email,
                pay_period_year, pay_period_month, pay_period_label,
                period_start, period_end, pay_date,
                currency, annual_base_salary, monthly_gross,
                earnings_json, deductions_json,
                total_earnings, total_deductions, net_pay,
                ytd_gross, ytd_tax, ytd_net,
                status, released_by
            ) VALUES (
                %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s::jsonb, %s::jsonb,
                %s, %s, %s,
                %s, %s, %s,
                'released', %s
            )
            RETURNING payroll_run_id, released_at, created_at
            """,
            (
                staff_employee_id, employee_email,
                year, month, _period_label(year, month),
                period_start, period_end, pay_date,
                emp.get("currency") or "USD",
                annual, slip["monthly_gross"],
                json.dumps(_decimal_to_str(slip["earnings"])),
                json.dumps(_decimal_to_str(slip["deductions"])),
                slip["total_earnings"], slip["total_deductions"], slip["net_pay"],
                ytd_gross, ytd_tax, ytd_net,
                released_by,
            ),
        ).fetchone()
        conn.commit()

    return {
        "payroll_run_id": row["payroll_run_id"],
        "staff_employee_id": staff_employee_id,
        "employee": {
            "first_name": emp["first_name"],
            "last_name": emp["last_name"],
            "email": employee_email,
            "job_title": emp.get("job_title"),
            "department_name": emp.get("department_name"),
            "employee_code": emp.get("employee_code"),
        },
        "pay_period_year": year,
        "pay_period_month": month,
        "pay_period_label": _period_label(year, month),
        "pay_date": pay_date.isoformat(),
        "currency": emp.get("currency") or "USD",
        "annual_base_salary": float(annual),
        "monthly_gross": float(slip["monthly_gross"]),
        "earnings": [{"label": e["label"], "amount": float(e["amount"])} for e in slip["earnings"]],
        "deductions": [{"label": d["label"], "amount": float(d["amount"])} for d in slip["deductions"]],
        "total_earnings": float(slip["total_earnings"]),
        "total_deductions": float(slip["total_deductions"]),
        "net_pay": float(slip["net_pay"]),
        "ytd_gross": float(ytd_gross),
        "ytd_tax": float(ytd_tax),
        "ytd_net": float(ytd_net),
        "status": "released",
        "released_at": row["released_at"].isoformat(),
    }


# ============================================================
# Read helpers
# ============================================================

def _row_to_payslip(r: dict[str, Any]) -> dict[str, Any]:
    """Convert a payroll_runs row into the JSON shape the UI consumes."""
    earnings = r.get("earnings_json") or []
    deductions = r.get("deductions_json") or []

    def _f(v: Any) -> Optional[float]:
        if v is None:
            return None
        return float(v)

    return {
        "payroll_run_id": r["payroll_run_id"],
        "staff_employee_id": r["staff_employee_id"],
        "employee_email": r["employee_email"],
        "pay_period_year": r["pay_period_year"],
        "pay_period_month": r["pay_period_month"],
        "pay_period_label": r["pay_period_label"],
        "period_start": r["period_start"].isoformat() if r.get("period_start") else None,
        "period_end": r["period_end"].isoformat() if r.get("period_end") else None,
        "pay_date": r["pay_date"].isoformat() if r.get("pay_date") else None,
        "currency": r.get("currency") or "USD",
        "annual_base_salary": _f(r.get("annual_base_salary")),
        "monthly_gross": _f(r.get("monthly_gross")),
        "earnings": [
            {"label": e.get("label"), "amount": float(e.get("amount") or 0)} for e in earnings
        ],
        "deductions": [
            {"label": d.get("label"), "amount": float(d.get("amount") or 0)} for d in deductions
        ],
        "total_earnings": _f(r.get("total_earnings")),
        "total_deductions": _f(r.get("total_deductions")),
        "net_pay": _f(r.get("net_pay")),
        "ytd_gross": _f(r.get("ytd_gross")),
        "ytd_tax": _f(r.get("ytd_tax")),
        "ytd_net": _f(r.get("ytd_net")),
        "status": r.get("status"),
        "released_by": r.get("released_by"),
        "released_at": r["released_at"].isoformat() if r.get("released_at") else None,
    }


def list_payslips_for_employee(staff_employee_id: int) -> list[dict[str, Any]]:
    sql = """
        SELECT * FROM applicants.payroll_runs
        WHERE staff_employee_id = %s
        ORDER BY pay_period_year DESC, pay_period_month DESC
    """
    with get_conn() as conn:
        rows = conn.execute(sql, (staff_employee_id,)).fetchall()
    return [_row_to_payslip(r) for r in rows]


def get_payslip(payroll_run_id: int) -> Optional[dict[str, Any]]:
    sql = "SELECT * FROM applicants.payroll_runs WHERE payroll_run_id = %s"
    with get_conn() as conn:
        row = conn.execute(sql, (payroll_run_id,)).fetchone()
    return _row_to_payslip(row) if row else None
