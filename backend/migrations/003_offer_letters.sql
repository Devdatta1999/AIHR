-- Tracks formal offer letters sent to candidates.

CREATE TABLE IF NOT EXISTS applicants.offer_letters (
    offer_id        BIGSERIAL PRIMARY KEY,
    applicant_id    BIGINT NOT NULL REFERENCES applicants.applicants(applicant_id) ON DELETE CASCADE,
    job_id          BIGINT NOT NULL REFERENCES applicants.job_postings(job_id) ON DELETE CASCADE,
    base_salary     NUMERIC(12, 2) NOT NULL,
    currency        VARCHAR(10) NOT NULL DEFAULT 'USD',
    start_date      DATE NOT NULL,
    subject         TEXT NOT NULL,
    html_body       TEXT NOT NULL,
    organizer_email VARCHAR(200),
    status          VARCHAR(30) NOT NULL DEFAULT 'sent',  -- 'sent' | 'failed'
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offer_letters_applicant_job
    ON applicants.offer_letters(applicant_id, job_id);
