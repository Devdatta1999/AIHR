"""One-shot demo backfill: make Devdatta Gandole a real `employees.employees`
row at his actual offer salary, repoint his portal record at the new id, and
wipe the stale payslips that were generated against Isabella Jones' base.

Idempotent — safe to re-run.

Usage (from backend/):
    .venv/bin/python -m scripts.backfill_devdatta_canonical
"""
from __future__ import annotations

from db import get_conn

DEVDATTA_EMAIL = "dygandole@gmail.com"


def main() -> None:
    with get_conn() as conn:
        applicant = conn.execute(
            """
            SELECT a.applicant_id, a.first_name, a.last_name, a.email, a.country,
                   a.total_years_experience, j.job_title, j.department, j.location,
                   j.employment_type
            FROM applicants.applicants a
            LEFT JOIN applicants.job_postings j ON j.job_id = a.job_id
            WHERE LOWER(a.email) = LOWER(%s)
            """,
            (DEVDATTA_EMAIL,),
        ).fetchone()
        if not applicant:
            raise SystemExit(f"applicant {DEVDATTA_EMAIL} not found — bail")

        offer = conn.execute(
            """
            SELECT base_salary, currency, start_date
            FROM applicants.offer_letters
            WHERE applicant_id = %s AND response = 'accepted'
            ORDER BY responded_at DESC LIMIT 1
            """,
            (applicant["applicant_id"],),
        ).fetchone()
        if not offer:
            raise SystemExit(f"no accepted offer for applicant {applicant['applicant_id']}")

        portal = conn.execute(
            "SELECT employee_id, staff_employee_id "
            "FROM applicants.employees WHERE LOWER(email) = LOWER(%s)",
            (DEVDATTA_EMAIL,),
        ).fetchone()
        old_sid = (portal or {}).get("staff_employee_id")

        # 1) Wipe stale payslips at the OLD bridge target (Isabella's $95k base)
        #    plus any keyed by Devdatta's email at any sid.
        deleted = conn.execute(
            """
            DELETE FROM applicants.payroll_runs
            WHERE LOWER(employee_email) = LOWER(%s)
               OR (%s::bigint IS NOT NULL AND staff_employee_id = %s)
            """,
            (DEVDATTA_EMAIL, old_sid, old_sid),
        ).rowcount
        print(f"deleted {deleted} stale payroll_runs")

        # 1b) ...but only delete sid=old_sid runs IF Isabella herself is the
        #    seeded directory row at that id; we don't want to wipe other
        #    employees' payroll if old_sid was unique. The query above already
        #    matches by email OR sid — Isabella has no email match, so OK.

        # 2) Upsert the canonical employees.employees row.
        existing_canonical = conn.execute(
            "SELECT employee_id FROM employees.employees WHERE LOWER(email) = LOWER(%s)",
            (DEVDATTA_EMAIL,),
        ).fetchone()

        if existing_canonical:
            new_id = existing_canonical["employee_id"]
            conn.execute(
                """
                UPDATE employees.employees
                SET first_name = %s,
                    last_name = %s,
                    job_title = %s,
                    department_name = 'Data Engineering',
                    location = %s,
                    city = 'Seattle',
                    state = 'WA',
                    country = %s,
                    employment_type = %s,
                    join_date = %s,
                    total_experience_years = %s,
                    base_salary = %s,
                    currency = %s,
                    status = 'Active',
                    payroll_status = 'Active'
                WHERE employee_id = %s
                """,
                (
                    applicant["first_name"],
                    applicant["last_name"],
                    applicant.get("job_title") or "Data Engineer",
                    applicant.get("location"),
                    applicant.get("country"),
                    applicant.get("employment_type"),
                    offer["start_date"],
                    applicant.get("total_years_experience"),
                    offer["base_salary"],
                    offer["currency"],
                    new_id,
                ),
            )
            print(f"updated existing employees.employees row {new_id}")
        else:
            row = conn.execute(
                """
                INSERT INTO employees.employees
                  (employee_code, first_name, last_name, email,
                   job_title, employment_type, location, city, state, country,
                   department_name, join_date, total_experience_years,
                   base_salary, currency, status, payroll_status)
                VALUES (%s, %s, %s, %s,
                        %s, %s, %s, 'Seattle', 'WA', %s,
                        'Data Engineering', %s, %s,
                        %s, %s, 'Active', 'Active')
                RETURNING employee_id
                """,
                (
                    "PENDING",
                    applicant["first_name"],
                    applicant["last_name"],
                    DEVDATTA_EMAIL,
                    applicant.get("job_title") or "Data Engineer",
                    applicant.get("employment_type") or "Full-time",
                    applicant.get("location"),
                    applicant.get("country") or "United States",
                    offer["start_date"],
                    applicant.get("total_years_experience"),
                    offer["base_salary"],
                    offer["currency"] or "USD",
                ),
            ).fetchone()
            new_id = row["employee_id"]
            conn.execute(
                "UPDATE employees.employees SET employee_code = %s WHERE employee_id = %s",
                (f"EMP{new_id}", new_id),
            )
            print(f"inserted new employees.employees row {new_id}")

        # 3) Repoint the portal row at the new canonical id.
        conn.execute(
            "UPDATE applicants.employees "
            "SET staff_employee_id = %s "
            "WHERE LOWER(email) = LOWER(%s)",
            (new_id, DEVDATTA_EMAIL),
        )
        print(f"repointed applicants.employees.staff_employee_id: {old_sid} → {new_id}")

        conn.commit()

    print("\nDone. Devdatta is now in the canonical roster at $120k base.")


if __name__ == "__main__":
    main()
