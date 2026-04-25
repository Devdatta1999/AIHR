# Nimbus Labs — HR Analytics KPI Definitions

Custom KPIs the company uses internally. These are not standard SQL aggregates;
the LLM must use the formulas defined here when a user asks for one of them.

## Bench Strength

The percentage of currently active employees whose project allocation has dropped
below the bench threshold (50%). High bench strength = capacity available for
new projects; low bench strength = team is fully booked.

**Formula:**
```
bench_strength = 100.0 * COUNT(employees WHERE bandwidth_percent < 50 AND status = 'Active')
                       / COUNT(employees WHERE status = 'Active')
```

**Reference SQL:**
```sql
SELECT
    ROUND(
        100.0 * SUM(CASE WHEN bandwidth_percent < 50 THEN 1 ELSE 0 END)
              / NULLIF(COUNT(*), 0),
        2
    ) AS bench_strength_pct,
    SUM(CASE WHEN bandwidth_percent < 50 THEN 1 ELSE 0 END) AS bench_count,
    COUNT(*) AS active_headcount
FROM employees.employees
WHERE status = 'Active';
```

**Per-department breakdown SQL:**
```sql
SELECT
    department_name,
    SUM(CASE WHEN bandwidth_percent < 50 THEN 1 ELSE 0 END) AS bench_count,
    COUNT(*) AS active_headcount,
    ROUND(
        100.0 * SUM(CASE WHEN bandwidth_percent < 50 THEN 1 ELSE 0 END)
              / NULLIF(COUNT(*), 0),
        2
    ) AS bench_strength_pct
FROM employees.employees
WHERE status = 'Active'
GROUP BY department_name
ORDER BY bench_strength_pct DESC;
```

## Compa-Ratio

Compares one employee's base salary to the average for their department.
Used to spot under-paid or over-paid individuals.

**Formula:**
```
compa_ratio = 100.0 * employee.base_salary / dept_avg_base_salary
```

**Reference SQL (per-employee):**
```sql
WITH dept_avg AS (
    SELECT department_name, AVG(base_salary) AS avg_salary
    FROM employees.employees
    WHERE status = 'Active'
    GROUP BY department_name
)
SELECT
    e.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.department_name,
    e.base_salary,
    ROUND(d.avg_salary::numeric, 2) AS dept_avg_salary,
    ROUND((100.0 * e.base_salary / NULLIF(d.avg_salary, 0))::numeric, 2) AS compa_ratio
FROM employees.employees e
JOIN dept_avg d USING (department_name)
WHERE e.status = 'Active'
ORDER BY compa_ratio DESC;
```

**Department-level summary SQL:**
```sql
WITH dept_avg AS (
    SELECT department_name, AVG(base_salary) AS avg_salary
    FROM employees.employees
    WHERE status = 'Active'
    GROUP BY department_name
)
SELECT
    e.department_name,
    ROUND(AVG(100.0 * e.base_salary / NULLIF(d.avg_salary, 0))::numeric, 2) AS avg_compa_ratio,
    ROUND(MIN(100.0 * e.base_salary / NULLIF(d.avg_salary, 0))::numeric, 2) AS min_compa_ratio,
    ROUND(MAX(100.0 * e.base_salary / NULLIF(d.avg_salary, 0))::numeric, 2) AS max_compa_ratio
FROM employees.employees e
JOIN dept_avg d USING (department_name)
WHERE e.status = 'Active'
GROUP BY e.department_name
ORDER BY avg_compa_ratio DESC;
```

## Annual Attrition Rate

Percentage of employees who exited the company in the last 12 months,
relative to the average headcount over the same window.

**Formula:**
```
attrition_rate = 100.0 * exits_last_12mo / avg_headcount_last_12mo
```

**Reference SQL:**
```sql
SELECT
    ROUND(
        100.0 * COUNT(*) FILTER (
            WHERE exit_date IS NOT NULL
              AND exit_date >= CURRENT_DATE - INTERVAL '12 months'
        )::numeric
        / NULLIF(COUNT(*) FILTER (WHERE join_date <= CURRENT_DATE), 0),
        2
    ) AS annual_attrition_rate_pct
FROM employees.employees;
```

## Tenure Buckets

Standard tenure groups used in retention reporting.

**Buckets:**
- 0–1 year
- 1–3 years
- 3–5 years
- 5+ years

**Reference SQL:**
```sql
SELECT
    CASE
        WHEN AGE(CURRENT_DATE, join_date) < INTERVAL '1 year'  THEN '0-1 years'
        WHEN AGE(CURRENT_DATE, join_date) < INTERVAL '3 years' THEN '1-3 years'
        WHEN AGE(CURRENT_DATE, join_date) < INTERVAL '5 years' THEN '3-5 years'
        ELSE '5+ years'
    END AS tenure_bucket,
    COUNT(*) AS headcount
FROM employees.employees
WHERE status = 'Active'
GROUP BY tenure_bucket
ORDER BY MIN(join_date) DESC;
```

## Manager Span of Control

Average number of direct reports per manager. High span = flat org;
low span = many layers.

**Formula:**
```
span_of_control = COUNT(reports) / COUNT(DISTINCT managers)
```

**Reference SQL (overall):**
```sql
SELECT
    COUNT(*) FILTER (WHERE manager_id IS NOT NULL)::numeric
        / NULLIF(COUNT(DISTINCT manager_id), 0) AS avg_span_of_control,
    COUNT(DISTINCT manager_id) AS manager_count,
    COUNT(*) FILTER (WHERE manager_id IS NOT NULL) AS reportee_count
FROM employees.employees
WHERE status = 'Active';
```

**Per-manager SQL:**
```sql
SELECT
    m.employee_id            AS manager_id,
    m.first_name || ' ' || m.last_name AS manager_name,
    m.department_name,
    COUNT(r.employee_id)     AS direct_reports
FROM employees.employees m
JOIN employees.employees r ON r.manager_id = m.employee_id
WHERE m.status = 'Active' AND r.status = 'Active'
GROUP BY m.employee_id, m.first_name, m.last_name, m.department_name
ORDER BY direct_reports DESC;
```

## Average Tenure

Average years an active employee has been at Nimbus Labs.

**Reference SQL:**
```sql
SELECT
    ROUND(AVG(EXTRACT(EPOCH FROM AGE(CURRENT_DATE, join_date)) / 31557600.0)::numeric, 2)
        AS avg_tenure_years
FROM employees.employees
WHERE status = 'Active';
```

## Total Monthly Payroll

Sum of net pay across the most recent payroll month.

**Reference SQL:**
```sql
SELECT
    payroll_year,
    payroll_month,
    SUM(net_pay) AS total_net_pay,
    SUM(gross_pay) AS total_gross_pay,
    SUM(deductions) AS total_deductions
FROM employees.employee_payroll
WHERE (payroll_year, payroll_month) = (
    SELECT payroll_year, payroll_month
    FROM employees.employee_payroll
    ORDER BY payroll_year DESC, payroll_month DESC
    LIMIT 1
)
GROUP BY payroll_year, payroll_month;
```

## Project Allocation Efficiency

Total committed allocation across active project assignments. Helpful
for spotting under-utilized teams.

**Formula:**
```
allocation_efficiency = AVG(allocation_percent) over active assignments
```

**Reference SQL:**
```sql
SELECT
    p.project_name,
    p.project_status,
    COUNT(ep.employee_id) AS assigned_count,
    ROUND(AVG(ep.allocation_percent)::numeric, 2) AS avg_allocation_pct,
    ROUND(SUM(ep.allocation_percent)::numeric, 2) AS total_allocation_pct
FROM employees.projects p
LEFT JOIN employees.employee_projects ep
    ON ep.project_id = p.project_id AND ep.assignment_status = 'Active'
GROUP BY p.project_id, p.project_name, p.project_status
ORDER BY total_allocation_pct DESC;
```

## Skill Coverage

Number of distinct skills present in each department. Useful for
team-formation gap analysis.

**Reference SQL:**
```sql
SELECT
    e.department_name,
    COUNT(DISTINCT s.skill_name) AS unique_skills,
    COUNT(s.employee_skill_id) AS total_skill_records
FROM employees.employees e
JOIN employees.employee_skills s ON s.employee_id = e.employee_id
WHERE e.status = 'Active'
GROUP BY e.department_name
ORDER BY unique_skills DESC;
```
