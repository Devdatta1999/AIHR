-- AI evaluation results for each (applicant, job) pair.
-- Populated by the LangGraph shortlisting agent. Read by the
-- pipeline UI so candidate cards can render scores instantly
-- without re-running the LLM.

CREATE TABLE IF NOT EXISTS applicants.applicant_ai_evaluations (
    evaluation_id     BIGSERIAL PRIMARY KEY,
    applicant_id      BIGINT NOT NULL REFERENCES applicants.applicants(applicant_id) ON DELETE CASCADE,
    job_id            BIGINT NOT NULL REFERENCES applicants.job_postings(job_id) ON DELETE CASCADE,
    overall_score     INT NOT NULL,
    skills_score      INT,
    skills_reason     TEXT,
    experience_score  INT,
    experience_reason TEXT,
    projects_score    INT,
    projects_reason   TEXT,
    education_score   INT,
    education_reason  TEXT,
    certifications_score  INT,
    certifications_reason TEXT,
    achievements_score    INT,
    achievements_reason   TEXT,
    summary           TEXT,
    model_id          VARCHAR(200),
    raw_response      JSONB,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(applicant_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_eval_job
    ON applicants.applicant_ai_evaluations(job_id, overall_score DESC);
