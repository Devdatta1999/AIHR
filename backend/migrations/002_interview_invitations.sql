-- Tracks calendar invites sent to candidates. One row per (applicant, kind,
-- scheduled_at) so HR can see history and we can avoid duplicate sends.

CREATE TABLE IF NOT EXISTS applicants.interview_invitations (
    invite_id          BIGSERIAL PRIMARY KEY,
    applicant_id       BIGINT NOT NULL REFERENCES applicants.applicants(applicant_id) ON DELETE CASCADE,
    job_id             BIGINT NOT NULL REFERENCES applicants.job_postings(job_id) ON DELETE CASCADE,
    kind               VARCHAR(30) NOT NULL,  -- 'screening' | 'technical'
    scheduled_at       TIMESTAMPTZ NOT NULL,
    duration_minutes   INT NOT NULL DEFAULT 30,
    timezone           VARCHAR(100),
    meet_link          VARCHAR(500),
    calendar_event_id  VARCHAR(200),
    organizer_email    VARCHAR(200),
    status             VARCHAR(30) DEFAULT 'Scheduled',
    error_message      TEXT,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invites_applicant_job
    ON applicants.interview_invitations(applicant_id, job_id);
