-- Link an onboarded portal user (applicants.employees) to a row in the
-- canonical HR roster (employees.employees). Lets the employee portal show
-- "My Projects" and teammates without re-keying everything by email.
--
-- The two schemas were seeded independently, so emails don't naturally match.
-- This nullable pointer is the bridge.

ALTER TABLE applicants.employees
    ADD COLUMN IF NOT EXISTS staff_employee_id BIGINT;

COMMENT ON COLUMN applicants.employees.staff_employee_id
    IS 'FK-ish pointer to employees.employees.employee_id (canonical HR roster).';

-- Demo wiring: link the existing test user (Devdatta Gandole, dygandole@gmail.com)
-- to a staff record that has multiple active projects and teammates.
-- Picked Isabella Jones (Data Engineer I, employee_id 2160) — same domain.
UPDATE applicants.employees
   SET staff_employee_id = 2160
 WHERE LOWER(email) = 'dygandole@gmail.com'
   AND staff_employee_id IS NULL;
