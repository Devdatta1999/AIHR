-- 005 — Employee portal: auth, offer responses, onboarding pipeline, employees,
-- interview-kit assignments.

-- 1. Password + onboarding profile fields on applicants.
ALTER TABLE applicants.applicants
    ADD COLUMN IF NOT EXISTS password_hash TEXT,
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS home_address TEXT,
    ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
    ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
    ADD COLUMN IF NOT EXISTS tax_id TEXT,
    ADD COLUMN IF NOT EXISTS bank_account TEXT,
    ADD COLUMN IF NOT EXISTS tshirt_size VARCHAR(10);

-- 2. Offer response tracking on offer_letters.
ALTER TABLE applicants.offer_letters
    ADD COLUMN IF NOT EXISTS response VARCHAR(20),          -- 'accepted' | 'rejected'
    ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS response_note TEXT;

-- 3. Onboarding document library (HR-uploaded).
CREATE TABLE IF NOT EXISTS applicants.onboarding_documents (
    doc_id         BIGSERIAL PRIMARY KEY,
    title          VARCHAR(200) NOT NULL,
    description    TEXT,
    country        VARCHAR(100),        -- NULL = global / all countries
    filename       VARCHAR(500) NOT NULL,  -- stored filename on disk
    original_name  VARCHAR(500) NOT NULL,
    mime_type      VARCHAR(100),
    size_bytes     INTEGER,
    uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Onboarding tracker (one per applicant admitted into onboarding).
CREATE TABLE IF NOT EXISTS applicants.onboarding_trackers (
    tracker_id      BIGSERIAL PRIMARY KEY,
    applicant_id    BIGINT NOT NULL UNIQUE
                    REFERENCES applicants.applicants(applicant_id) ON DELETE CASCADE,
    status          VARCHAR(30) NOT NULL DEFAULT 'pending',
    -- 'pending' -> 'documents_sent' -> 'accepted' -> 'completed'
    welcome_message TEXT,
    document_ids    JSONB NOT NULL DEFAULT '[]'::jsonb,
    accepted_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Employees master table.
CREATE TABLE IF NOT EXISTS applicants.employees (
    employee_id     BIGSERIAL PRIMARY KEY,
    applicant_id    BIGINT UNIQUE
                    REFERENCES applicants.applicants(applicant_id) ON DELETE SET NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(200) UNIQUE NOT NULL,
    password_hash   TEXT,
    job_title       VARCHAR(200),
    department      VARCHAR(100),
    location        VARCHAR(200),
    country         VARCHAR(100),
    employment_type VARCHAR(50),
    start_date      DATE,
    manager_email   VARCHAR(200),
    status          VARCHAR(30) NOT NULL DEFAULT 'active',
    onboarded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Interview-kit assignments from HR to employees.
CREATE TABLE IF NOT EXISTS applicants.interview_kit_assignments (
    assignment_id  BIGSERIAL PRIMARY KEY,
    kit_id         BIGINT NOT NULL REFERENCES applicants.interview_kits(kit_id) ON DELETE CASCADE,
    employee_id    BIGINT NOT NULL REFERENCES applicants.employees(employee_id) ON DELETE CASCADE,
    assigned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (kit_id, employee_id)
);
