-- Allow assigning interview kits to *any* employee (the company directory in
-- employees.employees, not only people who walked the new applicants→employees
-- onboarding path). Keying assignments by email avoids a cross-schema FK.

ALTER TABLE applicants.interview_kit_assignments
    DROP CONSTRAINT IF EXISTS interview_kit_assignments_employee_id_fkey;

ALTER TABLE applicants.interview_kit_assignments
    ADD COLUMN IF NOT EXISTS employee_email TEXT;

ALTER TABLE applicants.interview_kit_assignments
    ALTER COLUMN employee_id DROP NOT NULL;

ALTER TABLE applicants.interview_kit_assignments
    DROP CONSTRAINT IF EXISTS interview_kit_assignments_kit_id_employee_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS interview_kit_assignments_kit_email_uk
    ON applicants.interview_kit_assignments (kit_id, employee_email);
