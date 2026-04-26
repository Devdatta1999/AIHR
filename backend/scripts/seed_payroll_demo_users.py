"""Seed 3 extra portal logins linked into the canonical HR roster, so the
Compensation feature can be demoed end-to-end on more than one employee.

Run:
    .venv/bin/python -m scripts.seed_payroll_demo_users

What this does:
- For each demo user, INSERT into applicants.employees if missing, with
  password_hash for `welcome123`.
- Sets staff_employee_id to point at a real employees.employees row.
- Idempotent: re-running just confirms the linkage.

Devdatta (dygandole@gmail.com / Isabella Jones, employee_id 2160) is
already linked by migration 010.
"""
from __future__ import annotations

from db import get_conn
from services.auth import hash_password


# Three more demo users: each gets its own portal login that maps onto
# a real employees.employees row with a wide salary spread (so the
# release/payslip flow shows variety: $95k → $258k base).
DEMO_USERS = [
    {
        "email": "isla.demo@nimbuslabs.ai",
        "password": "welcome123",
        "first_name": "Isla",
        "last_name": "Thomas",
        "staff_employee_id": 2007,        # Staff Software Engineer, $256k
        "job_title": "Staff Software Engineer",
        "department": "Software Engineering",
        "location": "San Francisco",
        "country": "United States",
        "employment_type": "Full-time",
    },
    {
        "email": "abigail.demo@nimbuslabs.ai",
        "password": "welcome123",
        "first_name": "Abigail",
        "last_name": "Miller",
        "staff_employee_id": 2073,        # Staff Software Engineer, $250k
        "job_title": "Staff Software Engineer",
        "department": "Software Engineering",
        "location": "Seattle",
        "country": "United States",
        "employment_type": "Full-time",
    },
    {
        "email": "stella.demo@nimbuslabs.ai",
        "password": "welcome123",
        "first_name": "Stella",
        "last_name": "Johnson",
        "staff_employee_id": 2349,        # Platform Engineer, $205k
        "job_title": "Platform Engineer",
        "department": "DevOps & Cloud",
        "location": "Austin",
        "country": "United States",
        "employment_type": "Full-time",
    },
]


def main() -> None:
    with get_conn() as conn:
        for u in DEMO_USERS:
            existing = conn.execute(
                "SELECT employee_id FROM applicants.employees WHERE LOWER(email) = LOWER(%s)",
                (u["email"],),
            ).fetchone()

            if existing:
                conn.execute(
                    """
                    UPDATE applicants.employees
                       SET staff_employee_id = %s,
                           password_hash = COALESCE(password_hash, %s)
                     WHERE employee_id = %s
                    """,
                    (u["staff_employee_id"], hash_password(u["password"]), existing["employee_id"]),
                )
                print(f"  updated {u['email']} -> staff_employee_id={u['staff_employee_id']}")
            else:
                conn.execute(
                    """
                    INSERT INTO applicants.employees (
                        first_name, last_name, email, password_hash,
                        job_title, department, location, country, employment_type,
                        status, onboarded_at, staff_employee_id
                    ) VALUES (
                        %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        'Active', NOW(), %s
                    )
                    """,
                    (
                        u["first_name"], u["last_name"], u["email"],
                        hash_password(u["password"]),
                        u["job_title"], u["department"], u["location"],
                        u["country"], u["employment_type"],
                        u["staff_employee_id"],
                    ),
                )
                print(f"  inserted {u['email']} -> staff_employee_id={u['staff_employee_id']}")

        conn.commit()

    print()
    print("Demo logins (password = welcome123):")
    print("  dygandole@gmail.com           -> Isabella Jones (Data Engineer I)")
    for u in DEMO_USERS:
        print(f"  {u['email']:30s} -> {u['first_name']} {u['last_name']} ({u['job_title']})")


if __name__ == "__main__":
    main()
