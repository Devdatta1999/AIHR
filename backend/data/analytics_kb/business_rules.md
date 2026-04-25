# Nimbus Labs — Analytics Business Rules

Conventions analysts at Nimbus Labs follow when answering data questions.
The agent should respect these rules when generating SQL.

## Active vs all employees

Unless the user explicitly says "including former employees" or "ever
employed", **always filter by `status = 'Active'`** for headcount, salary,
bandwidth, skills, and project queries.

```sql
WHERE status = 'Active'
```

If the user asks about attrition, exits, or "people who left", then
`exit_date IS NOT NULL` is the right filter.

## Department naming

The canonical column is `department_name` (NOT `department`). Common values
include: `Engineering`, `Data`, `Product`, `Design`, `Sales`, `Marketing`,
`HR`, `Finance`, `Operations`, `Customer Success`. Match case-insensitively
when the user types a department name.

## Currency

`base_salary`, `bonus_amount`, and `variable_pay` are all stored in the
column `currency` (default `'USD'`). Do not cross-aggregate across
currencies without converting; if the demo data is single-currency, you can
ignore conversion and report the dominant currency.

## Time windows

- "Last quarter" = the 3 calendar months preceding the current quarter.
  Use `date_trunc('quarter', CURRENT_DATE) - INTERVAL '3 months'`.
- "Last year" / "annual" = trailing 12 months from `CURRENT_DATE`.
- "This year" / "YTD" = from `date_trunc('year', CURRENT_DATE)` to today.
- "Recently joined" with no qualifier = last 90 days.

## Bench definition

An employee is **on the bench** when `bandwidth_percent < 50`. They are
**fully booked** when `bandwidth_percent >= 90`.

## Manager hierarchy

`employees.manager_id` is a self-FK to `employees.employee_id`. Top-level
managers (e.g. CEO) have `manager_id IS NULL`. When climbing the tree, use
recursive CTEs.

## Date math

Use `AGE(CURRENT_DATE, join_date)` for tenure intervals and
`EXTRACT(EPOCH FROM AGE(...)) / 31557600.0` to convert to fractional years.

## Read-only

The agent may ONLY emit `SELECT` / `WITH` queries against the `employees`
schema. Any `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`,
`CREATE`, `GRANT`, `REVOKE`, or COPY is forbidden and will be rejected by
the validator.
