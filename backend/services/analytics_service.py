"""Pre-built dashboard queries for the HR Analytics page.

Each function returns a JSON-serializable dict the frontend can render
directly in Recharts. All queries hit only the `employees` schema and
respect a small shared filter set (department, location, employment_type,
work_mode).
"""
from __future__ import annotations

from typing import Any, Optional

from db import get_conn


# ---------- shared filter helpers ----------

class Filters:
    __slots__ = ("department", "location", "employment_type", "work_mode")

    def __init__(
        self,
        department: Optional[str] = None,
        location: Optional[str] = None,
        employment_type: Optional[str] = None,
        work_mode: Optional[str] = None,
    ):
        self.department = department or None
        self.location = location or None
        self.employment_type = employment_type or None
        self.work_mode = work_mode or None

    def is_empty(self) -> bool:
        return not any(
            (self.department, self.location, self.employment_type, self.work_mode)
        )

    def where(self, alias: str = "e", include_status_active: bool = True) -> tuple[str, list[Any]]:
        """Return (sql_fragment, params). The fragment starts with 'WHERE'."""
        clauses: list[str] = []
        params: list[Any] = []
        if include_status_active:
            clauses.append(f"{alias}.status = 'Active'")
        if self.department:
            clauses.append(f"{alias}.department_name = %s")
            params.append(self.department)
        if self.location:
            clauses.append(f"{alias}.location = %s")
            params.append(self.location)
        if self.employment_type:
            clauses.append(f"{alias}.employment_type = %s")
            params.append(self.employment_type)
        if self.work_mode:
            clauses.append(f"{alias}.work_mode = %s")
            params.append(self.work_mode)
        if not clauses:
            return "", params
        return "WHERE " + " AND ".join(clauses), params


# ---------- KPI cards ----------

def overview_kpis(filters: Filters) -> dict[str, Any]:
    where, params = filters.where("e")
    sql = f"""
        SELECT
            COUNT(*)                                AS headcount,
            ROUND(AVG(e.base_salary)::numeric, 2)   AS avg_base_salary,
            ROUND(
                AVG(EXTRACT(EPOCH FROM AGE(CURRENT_DATE, e.join_date)) / 31557600.0)::numeric,
                2
            )                                       AS avg_tenure_years
        FROM employees.employees e
        {where}
    """
    with get_conn() as conn:
        row = conn.execute(sql, params).fetchone() or {}

    # Attrition uses ALL employees (not just active) because exits are non-active.
    where_all, params_all = filters.where("e", include_status_active=False)
    sql_attr = f"""
        SELECT
            ROUND(
                100.0 * COUNT(*) FILTER (
                    WHERE e.exit_date IS NOT NULL
                      AND e.exit_date >= CURRENT_DATE - INTERVAL '12 months'
                )::numeric / NULLIF(COUNT(*) FILTER (WHERE e.join_date <= CURRENT_DATE), 0),
                2
            ) AS annual_attrition_pct
        FROM employees.employees e
        {where_all}
    """
    with get_conn() as conn:
        attr = conn.execute(sql_attr, params_all).fetchone() or {}

    return {
        "headcount": int(row.get("headcount") or 0),
        "avg_base_salary": float(row.get("avg_base_salary") or 0),
        "avg_tenure_years": float(row.get("avg_tenure_years") or 0),
        "annual_attrition_pct": float(attr.get("annual_attrition_pct") or 0),
    }


# ---------- charts ----------

def headcount_by_department(filters: Filters) -> list[dict[str, Any]]:
    where, params = filters.where("e")
    sql = f"""
        SELECT department_name AS department,
               COUNT(*) AS headcount
        FROM employees.employees e
        {where}
        GROUP BY department_name
        ORDER BY headcount DESC
    """
    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [
        {"department": r.get("department") or "—", "headcount": int(r["headcount"])}
        for r in rows
    ]


def joining_vs_exit_trend(filters: Filters) -> list[dict[str, Any]]:
    """Last 12 months — counts of joiners and leavers per month."""
    where, params = filters.where("e", include_status_active=False)
    # Build dynamic WHERE — months CTE always present, employees join keyed by date.
    sql = f"""
        WITH months AS (
            SELECT generate_series(
                date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
                date_trunc('month', CURRENT_DATE),
                INTERVAL '1 month'
            )::date AS month
        ),
        emp AS (
            SELECT e.* FROM employees.employees e {where}
        )
        SELECT
            to_char(m.month, 'YYYY-MM') AS month,
            COUNT(*) FILTER (WHERE date_trunc('month', emp.join_date) = m.month) AS joined,
            COUNT(*) FILTER (WHERE date_trunc('month', emp.exit_date) = m.month) AS exited
        FROM months m
        LEFT JOIN emp ON
            date_trunc('month', emp.join_date) = m.month
         OR date_trunc('month', emp.exit_date) = m.month
        GROUP BY m.month
        ORDER BY m.month
    """
    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [
        {
            "month": r["month"],
            "joined": int(r.get("joined") or 0),
            "exited": int(r.get("exited") or 0),
        }
        for r in rows
    ]


def work_mode_mix(filters: Filters) -> list[dict[str, Any]]:
    where, params = filters.where("e")
    sql = f"""
        SELECT COALESCE(e.work_mode, 'Unknown') AS work_mode,
               COUNT(*) AS headcount
        FROM employees.employees e
        {where}
        GROUP BY e.work_mode
        ORDER BY headcount DESC
    """
    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [
        {"work_mode": r["work_mode"], "headcount": int(r["headcount"])}
        for r in rows
    ]


def top_skills(filters: Filters, limit: int = 10) -> list[dict[str, Any]]:
    where, params = filters.where("e")
    join_filter = where  # already aliases e
    sql = f"""
        SELECT s.skill_name AS skill,
               COUNT(DISTINCT s.employee_id) AS employees_with_skill
        FROM employees.employee_skills s
        JOIN employees.employees e ON e.employee_id = s.employee_id
        {join_filter}
        GROUP BY s.skill_name
        ORDER BY employees_with_skill DESC
        LIMIT %s
    """
    with get_conn() as conn:
        rows = conn.execute(sql, [*params, limit]).fetchall()
    return [
        {"skill": r["skill"], "employees": int(r["employees_with_skill"])}
        for r in rows
    ]


def salary_by_department(filters: Filters) -> list[dict[str, Any]]:
    where, params = filters.where("e")
    sql = f"""
        SELECT department_name AS department,
               ROUND(AVG(e.base_salary)::numeric, 0) AS avg_salary,
               COUNT(*) AS headcount
        FROM employees.employees e
        {where}
        GROUP BY department_name
        ORDER BY avg_salary DESC
    """
    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [
        {
            "department": r.get("department") or "—",
            "avg_salary": float(r["avg_salary"] or 0),
            "headcount": int(r["headcount"]),
        }
        for r in rows
    ]


# ---------- filter option lookups (dropdowns) ----------

def filter_options() -> dict[str, list[str]]:
    sql = """
        SELECT
            ARRAY(SELECT DISTINCT department_name FROM employees.employees
                  WHERE department_name IS NOT NULL ORDER BY department_name) AS departments,
            ARRAY(SELECT DISTINCT location FROM employees.employees
                  WHERE location IS NOT NULL ORDER BY location) AS locations,
            ARRAY(SELECT DISTINCT employment_type FROM employees.employees
                  WHERE employment_type IS NOT NULL ORDER BY employment_type) AS employment_types,
            ARRAY(SELECT DISTINCT work_mode FROM employees.employees
                  WHERE work_mode IS NOT NULL ORDER BY work_mode) AS work_modes
    """
    with get_conn() as conn:
        row = conn.execute(sql).fetchone() or {}
    return {
        "departments": list(row.get("departments") or []),
        "locations": list(row.get("locations") or []),
        "employment_types": list(row.get("employment_types") or []),
        "work_modes": list(row.get("work_modes") or []),
    }


def dashboard_bundle(filters: Filters) -> dict[str, Any]:
    """One-shot: everything the dashboard needs in a single response."""
    return {
        "kpis": overview_kpis(filters),
        "headcount_by_department": headcount_by_department(filters),
        "joining_vs_exit_trend": joining_vs_exit_trend(filters),
        "work_mode_mix": work_mode_mix(filters),
        "top_skills": top_skills(filters, limit=10),
        "salary_by_department": salary_by_department(filters),
    }
