-- When a team is created in Team Formation, we now mirror it into the canonical
-- employees.projects + employees.employee_projects tables so the new project
-- shows up in the Employee Portal (My Projects) for everyone on the team —
-- including the Project Manager. This column links the two records so we can
-- update / dedupe.

ALTER TABLE applicants.teams
    ADD COLUMN IF NOT EXISTS project_id BIGINT;

COMMENT ON COLUMN applicants.teams.project_id
    IS 'FK-ish pointer to employees.projects.project_id created when the team was saved.';
