-- 011 — Payroll & payslips
--
-- One table: applicants.payroll_runs. Each row is a released payslip for
-- (staff_employee_id, pay_period_year, pay_period_month).
--
--   * The staff_employee_id is the canonical link into employees.employees.
--   * employee_email is denormalized so the employee portal can fetch
--     payslips by signed-in email without requiring an applicants.employees
--     row to exist (defensive — the portal currently relies on the bridge).
--   * earnings_json / deductions_json hold itemized line items so the
--     payslip PDF and the employee-portal breakdown stay extensible
--     without further migrations.
--
-- Status lifecycle is intentionally simple:
--     released  -> HR has cut the payslip; visible to employee
--     paid      -> reserved for a future ACH/direct-deposit confirmation
--     void      -> reserved for a reversal/correction flow
--
-- Computation lives in services/payroll.py — this table only stores the
-- result so the math is reproducible and auditable.

CREATE TABLE IF NOT EXISTS applicants.payroll_runs (
    payroll_run_id      BIGSERIAL PRIMARY KEY,
    staff_employee_id   BIGINT NOT NULL,
    employee_email      VARCHAR(200) NOT NULL,

    pay_period_year     INT NOT NULL,
    pay_period_month    INT NOT NULL CHECK (pay_period_month BETWEEN 1 AND 12),
    pay_period_label    VARCHAR(40) NOT NULL,    -- e.g. "April 2026"
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    pay_date            DATE NOT NULL,

    currency            VARCHAR(10) NOT NULL DEFAULT 'USD',
    annual_base_salary  NUMERIC(12, 2) NOT NULL,
    monthly_gross       NUMERIC(12, 2) NOT NULL,

    earnings_json       JSONB NOT NULL,          -- [{label, amount}]
    deductions_json     JSONB NOT NULL,          -- [{label, amount}]
    total_earnings      NUMERIC(12, 2) NOT NULL,
    total_deductions    NUMERIC(12, 2) NOT NULL,
    net_pay             NUMERIC(12, 2) NOT NULL,

    -- YTD aggregates as of this pay date (computed at release time).
    ytd_gross           NUMERIC(14, 2) NOT NULL DEFAULT 0,
    ytd_tax             NUMERIC(14, 2) NOT NULL DEFAULT 0,
    ytd_net             NUMERIC(14, 2) NOT NULL DEFAULT 0,

    status              VARCHAR(20) NOT NULL DEFAULT 'released',
    released_by         VARCHAR(200),
    released_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_payroll_employee_period
        UNIQUE (staff_employee_id, pay_period_year, pay_period_month)
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_employee
    ON applicants.payroll_runs (staff_employee_id, pay_period_year DESC, pay_period_month DESC);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_email
    ON applicants.payroll_runs (LOWER(employee_email), pay_period_year DESC, pay_period_month DESC);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_period
    ON applicants.payroll_runs (pay_period_year, pay_period_month);
