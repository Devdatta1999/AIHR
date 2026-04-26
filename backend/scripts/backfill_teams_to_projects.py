"""One-shot: mirror every existing applicants.teams row into
employees.projects + employees.employee_projects so previously-saved teams
become visible in the Employee Portal (My Projects) — including for whoever
is the Project Manager.

Idempotent: skips teams that already have applicants.teams.project_id set,
and uses the same upsert-shaped logic as the live create_team path.

Usage (from backend/):
    .venv/bin/python -m scripts.backfill_teams_to_projects
"""
from __future__ import annotations

from db import get_conn
from services.team_formation_service import _mirror_team_to_canonical


def main() -> None:
    with get_conn() as conn:
        teams = conn.execute(
            """SELECT team_id, team_name, project_name, project_summary, project_id
               FROM applicants.teams
               ORDER BY team_id"""
        ).fetchall()

        for t in teams:
            if t.get("project_id"):
                print(f"team {t['team_id']} already linked → project_id={t['project_id']}, skipping")
                continue

            members = conn.execute(
                """SELECT employee_id, role_designation, fit_score, allocation_percent
                   FROM applicants.team_members WHERE team_id = %s""",
                (t["team_id"],),
            ).fetchall()
            if not members:
                print(f"team {t['team_id']} has no members, skipping")
                continue

            pid = _mirror_team_to_canonical(
                conn,
                team_id=t["team_id"],
                project_name=t.get("project_name") or t["team_name"],
                project_summary=t.get("project_summary"),
                members=[dict(m) for m in members],
            )
            print(
                f"team {t['team_id']} ({t['team_name']}) → "
                f"project_id={pid} ({len(members)} members mirrored)"
            )

        conn.commit()
    print("\nDone.")


if __name__ == "__main__":
    main()
