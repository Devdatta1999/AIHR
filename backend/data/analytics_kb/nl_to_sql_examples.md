# NL → SQL Examples (employees schema)

Few-shot anchors for the analytics agent. All SQL targets PostgreSQL and reads
ONLY from the `employees` schema. Use `LIMIT` defensively when the result could
be large.

## Schema cheatsheet

```
employees.employees(
    employee_id, employee_code, first_name, last_name, email, gender,
    department_name, manager_id, job_title, employee_level, employment_type,
    work_mode, location, country, timezone, join_date, exit_date,
    total_experience_years, company_experience_years, bandwidth_percent,
    current_project_count, status, payroll_status, base_salary, currency,
    bonus_eligible, last_working_date, date_of_birth
)
employees.employee_skills(employee_id, skill_name, skill_category,
    proficiency_level, years_of_experience, is_primary_skill)
employees.employee_certifications(employee_id, certification_name,
    issuing_organization, issue_date, expiry_date, status)
employees.employee_achievements(employee_id, title, category,
    issuer_or_organization, achievement_date)
employees.employee_education(employee_id, degree, field_of_study,
    institution_name, start_year, end_year, grade_gpa)
employees.employee_work_history(employee_id, company_name, job_title,
    start_date, end_date)
employees.projects(project_id, project_name, project_manager_id,
    start_date, end_date, project_status, priority,
    required_bandwidth_percent)
employees.employee_projects(employee_id, project_id, role_in_project,
    allocation_percent, start_date, end_date, assignment_status)
employees.employee_compensation(employee_id, effective_from, effective_to,
    base_salary, bonus_amount, variable_pay, payroll_frequency, currency,
    compensation_status)
employees.employee_payroll(employee_id, payroll_month, payroll_year,
    gross_pay, deductions, net_pay, payment_date, payroll_status)
```

## Headcount queries

**Q:** How many employees are in Engineering?
```sql
SELECT COUNT(*) AS headcount
FROM employees.employees
WHERE department_name = 'Engineering' AND status = 'Active';
```

**Q:** Headcount by department.
```sql
SELECT department_name, COUNT(*) AS headcount
FROM employees.employees
WHERE status = 'Active'
GROUP BY department_name
ORDER BY headcount DESC;
```

**Q:** Headcount by location.
```sql
SELECT location, COUNT(*) AS headcount
FROM employees.employees
WHERE status = 'Active'
GROUP BY location
ORDER BY headcount DESC
LIMIT 20;
```

**Q:** Gender distribution.
```sql
SELECT gender, COUNT(*) AS headcount
FROM employees.employees
WHERE status = 'Active'
GROUP BY gender
ORDER BY headcount DESC;
```

## Joining / attrition queries

**Q:** Show employees who joined in the last 6 months.
```sql
SELECT employee_id, first_name, last_name, job_title, department_name, join_date
FROM employees.employees
WHERE join_date >= CURRENT_DATE - INTERVAL '6 months'
ORDER BY join_date DESC;
```

**Q:** Joining vs exit trend (last 12 months).
```sql
WITH months AS (
    SELECT generate_series(
        date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
        date_trunc('month', CURRENT_DATE),
        INTERVAL '1 month'
    )::date AS month
)
SELECT
    to_char(m.month, 'YYYY-MM') AS month,
    COUNT(*) FILTER (WHERE date_trunc('month', e.join_date) = m.month) AS joined,
    COUNT(*) FILTER (WHERE date_trunc('month', e.exit_date) = m.month) AS exited
FROM months m
LEFT JOIN employees.employees e ON TRUE
GROUP BY m.month
ORDER BY m.month;
```

**Q:** How many employees exited last quarter?
```sql
SELECT COUNT(*) AS exits
FROM employees.employees
WHERE exit_date IS NOT NULL
  AND exit_date >= date_trunc('quarter', CURRENT_DATE) - INTERVAL '3 months'
  AND exit_date <  date_trunc('quarter', CURRENT_DATE);
```

## Salary queries

**Q:** Top 10 highest paid employees with their job titles.
```sql
SELECT first_name || ' ' || last_name AS employee_name,
       job_title, department_name, base_salary, currency
FROM employees.employees
WHERE status = 'Active'
ORDER BY base_salary DESC
LIMIT 10;
```

**Q:** Average salary by department.
```sql
SELECT department_name,
       ROUND(AVG(base_salary)::numeric, 2) AS avg_base_salary,
       COUNT(*) AS headcount
FROM employees.employees
WHERE status = 'Active'
GROUP BY department_name
ORDER BY avg_base_salary DESC;
```

**Q:** Salary distribution histogram.
```sql
SELECT
    CASE
        WHEN base_salary < 50000  THEN '<50k'
        WHEN base_salary < 80000  THEN '50-80k'
        WHEN base_salary < 120000 THEN '80-120k'
        WHEN base_salary < 180000 THEN '120-180k'
        ELSE '180k+'
    END AS salary_band,
    COUNT(*) AS headcount
FROM employees.employees
WHERE status = 'Active'
GROUP BY salary_band
ORDER BY MIN(base_salary);
```

## Manager / org queries

**Q:** Which managers have the most direct reports?
```sql
SELECT m.employee_id  AS manager_id,
       m.first_name || ' ' || m.last_name AS manager_name,
       m.department_name,
       COUNT(r.employee_id) AS direct_reports
FROM employees.employees m
JOIN employees.employees r ON r.manager_id = m.employee_id
WHERE m.status = 'Active' AND r.status = 'Active'
GROUP BY m.employee_id, m.first_name, m.last_name, m.department_name
ORDER BY direct_reports DESC
LIMIT 15;
```

**Q:** Who reports to {manager_name}?
```sql
SELECT r.employee_id, r.first_name || ' ' || r.last_name AS report_name,
       r.job_title, r.department_name
FROM employees.employees m
JOIN employees.employees r ON r.manager_id = m.employee_id
WHERE LOWER(m.first_name || ' ' || m.last_name) = LOWER('Jane Doe');
```

## Skills / certifications queries

**Q:** Top 10 skills by employee count.
```sql
SELECT skill_name, COUNT(DISTINCT employee_id) AS employees_with_skill
FROM employees.employee_skills
GROUP BY skill_name
ORDER BY employees_with_skill DESC
LIMIT 10;
```

**Q:** Which employees know {skill}?
```sql
SELECT e.first_name || ' ' || e.last_name AS employee_name,
       s.proficiency_level, s.years_of_experience, e.department_name
FROM employees.employee_skills s
JOIN employees.employees e ON e.employee_id = s.employee_id
WHERE LOWER(s.skill_name) = LOWER('Python') AND e.status = 'Active'
ORDER BY s.years_of_experience DESC;
```

**Q:** Employees with certifications expiring in the next 90 days.
```sql
SELECT e.first_name || ' ' || e.last_name AS employee_name,
       c.certification_name, c.expiry_date
FROM employees.employee_certifications c
JOIN employees.employees e ON e.employee_id = c.employee_id
WHERE c.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
ORDER BY c.expiry_date;
```

## Project / allocation queries

**Q:** Project status distribution.
```sql
SELECT project_status, COUNT(*) AS project_count
FROM employees.projects
GROUP BY project_status
ORDER BY project_count DESC;
```

**Q:** Employees with the lowest bandwidth (most loaded).
```sql
SELECT employee_id, first_name || ' ' || last_name AS employee_name,
       department_name, bandwidth_percent, current_project_count
FROM employees.employees
WHERE status = 'Active'
ORDER BY bandwidth_percent ASC
LIMIT 15;
```

## Payroll queries

**Q:** Total payroll for the latest month.
```sql
WITH latest AS (
    SELECT payroll_year, payroll_month
    FROM employees.employee_payroll
    ORDER BY payroll_year DESC, payroll_month DESC
    LIMIT 1
)
SELECT p.payroll_year, p.payroll_month,
       SUM(p.gross_pay) AS gross,
       SUM(p.deductions) AS deductions,
       SUM(p.net_pay)   AS net
FROM employees.employee_payroll p
JOIN latest l USING (payroll_year, payroll_month)
GROUP BY p.payroll_year, p.payroll_month;
```

**Q:** Payroll trend over the last 12 months.
```sql
SELECT
    payroll_year,
    payroll_month,
    SUM(net_pay) AS total_net_pay
FROM employees.employee_payroll
WHERE (payroll_year, payroll_month) >= (
    EXTRACT(YEAR  FROM CURRENT_DATE - INTERVAL '12 months')::int,
    EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '12 months')::int
)
GROUP BY payroll_year, payroll_month
ORDER BY payroll_year, payroll_month;
```
