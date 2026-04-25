-- 009 — Team Formation
-- HR uploads a Project Requirements PDF -> agent parses -> recommendations
-- per role -> HR confirms -> team is saved.
--
-- Four tables under the existing `applicants` schema:
--
--   team_formation_runs        : one row per uploaded PDF (parsed reqs, raw text)
--   team_formation_evaluations : per (run, role, candidate) AI fit score
--   teams                      : a confirmed team (1:1 with project name, optional FK to run)
--   team_members               : selected employees on a team
--
-- All FKs to internal employees use employees.employees(employee_id).
-- Deletes cascade so deleting a run also cleans up evaluations.

CREATE TABLE IF NOT EXISTS applicants.team_formation_runs (
    run_id              BIGSERIAL PRIMARY KEY,
    project_name        VARCHAR(200) NOT NULL,
    project_summary     TEXT,
    file_name           VARCHAR(300),
    raw_text            TEXT,                       -- extracted PDF text, for audit
    parsed_requirements JSONB NOT NULL,             -- {project_name, summary, duration_months, roles:[{designation, headcount, must_have_skills, good_to_have_skills, min_experience_years, allocation_percent, department}]}
    parser_model_id     VARCHAR(120),
    status              VARCHAR(30) NOT NULL DEFAULT 'parsed',
                        -- 'parsed' | 'recommended' | 'team_created'
    created_by          VARCHAR(200),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tf_runs_created
    ON applicants.team_formation_runs (created_at DESC);


CREATE TABLE IF NOT EXISTS applicants.team_formation_evaluations (
    evaluation_id   BIGSERIAL PRIMARY KEY,
    run_id          BIGINT NOT NULL REFERENCES applicants.team_formation_runs(run_id) ON DELETE CASCADE,
    role_designation VARCHAR(150) NOT NULL,         -- key into the requested role
    employee_id     BIGINT NOT NULL,                -- employees.employees.employee_id
    overall_score   INT,                            -- 0..100
    skills_score    INT,
    availability_score INT,
    experience_score INT,
    projects_score  INT,
    certifications_score INT,
    summary         TEXT,
    reasons         JSONB,                          -- {skills:{score,reason}, availability:{...}, ...}
    available_bandwidth_percent NUMERIC,            -- snapshot at scoring time
    model_id        VARCHAR(120),
    raw_response    JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (run_id, role_designation, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_tf_evals_run_role
    ON applicants.team_formation_evaluations (run_id, role_designation, overall_score DESC);


CREATE TABLE IF NOT EXISTS applicants.teams (
    team_id         BIGSERIAL PRIMARY KEY,
    team_name       VARCHAR(200) NOT NULL,           -- defaults to project_name
    project_name    VARCHAR(200) NOT NULL,
    project_summary TEXT,
    run_id          BIGINT REFERENCES applicants.team_formation_runs(run_id) ON DELETE SET NULL,
    requirements    JSONB,                           -- frozen snapshot of parsed_requirements
    status          VARCHAR(30) NOT NULL DEFAULT 'Active',  -- 'Active' | 'Completed' | 'Archived'
    created_by      VARCHAR(200),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (team_name)
);

CREATE INDEX IF NOT EXISTS idx_teams_created
    ON applicants.teams (created_at DESC);


CREATE TABLE IF NOT EXISTS applicants.team_members (
    team_member_id   BIGSERIAL PRIMARY KEY,
    team_id          BIGINT NOT NULL REFERENCES applicants.teams(team_id) ON DELETE CASCADE,
    employee_id      BIGINT NOT NULL,                -- employees.employees.employee_id
    role_designation VARCHAR(150) NOT NULL,
    fit_score        INT,
    allocation_percent NUMERIC,
    added_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (team_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team
    ON applicants.team_members (team_id);
