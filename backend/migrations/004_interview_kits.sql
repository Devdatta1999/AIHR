-- Stores generated interview question kits per job posting. One latest kit
-- per job (uniqueness enforced), with full run metadata for debugging.

CREATE TABLE IF NOT EXISTS applicants.interview_kits (
    kit_id           BIGSERIAL PRIMARY KEY,
    job_id           BIGINT NOT NULL REFERENCES applicants.job_postings(job_id) ON DELETE CASCADE,
    model_id         VARCHAR(200) NOT NULL,
    behavioral       JSONB NOT NULL,
    technical        JSONB NOT NULL,
    overall_notes    TEXT,
    rag_sources      JSONB,
    web_sources      JSONB,
    run_log          JSONB,
    status           VARCHAR(30) NOT NULL DEFAULT 'ready',
    error_message    TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_kits_job
    ON applicants.interview_kits(job_id, created_at DESC);
