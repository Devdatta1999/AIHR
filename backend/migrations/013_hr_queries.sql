-- 013 — HR Queries (employee policy ticket system)
--
-- Employees raise a question through the Employee Portal. HR sees a list in
-- the HR Portal under "HR Queries" and can:
--   * Resolve using AI       — RAG over the HR policy doc, send the AI answer
--   * Edit & Send            — same AI answer but edited by HR before sending
--   * Answer Manually        — HR types the response from scratch
--
-- All three paths converge on the same row: status flips to 'resolved',
-- hr_response holds the final text the employee sees, resolution_kind
-- records which path was used, and resolved_at timestamps it. The employee
-- portal reads back hr_response on resolved tickets.
--
-- AI suggestion + retrieved sources are kept on the row so HR can see which
-- policy chunks were grounded against (audit trail), and so re-opening a
-- ticket doesn't require a re-call to the LLM.

CREATE TABLE IF NOT EXISTS applicants.hr_queries (
    query_id            BIGSERIAL PRIMARY KEY,

    -- author identification (snapshot at submit time)
    applicant_id        BIGINT,
    staff_employee_id   BIGINT,
    employee_email      VARCHAR(200) NOT NULL,
    employee_name       VARCHAR(200) NOT NULL,
    employee_role       VARCHAR(200),

    -- the question
    question            TEXT NOT NULL,
    category            VARCHAR(80),
    priority            VARCHAR(20) NOT NULL DEFAULT 'medium'
                            CHECK (priority IN ('low', 'medium', 'high')),

    -- lifecycle
    status              VARCHAR(20) NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open', 'in_progress', 'resolved')),

    -- AI grounded suggestion (cached so we don't re-call the LLM)
    ai_suggestion       TEXT,
    ai_sources          JSONB,             -- [{source, section, score}]
    ai_generated_at     TIMESTAMPTZ,

    -- final HR response that the employee sees
    hr_response         TEXT,
    resolved_by         VARCHAR(200),      -- HR user email
    resolution_kind     VARCHAR(20)        -- ai | edited | manual
                            CHECK (resolution_kind IN ('ai', 'edited', 'manual')),
    resolved_at         TIMESTAMPTZ,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_queries_email
    ON applicants.hr_queries (LOWER(employee_email), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hr_queries_status_created
    ON applicants.hr_queries (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hr_queries_applicant
    ON applicants.hr_queries (applicant_id, created_at DESC);
