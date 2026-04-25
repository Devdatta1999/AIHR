"""LangGraph agent for the HR-Analytics chatbot.

Flow (one user turn):

    cache_check ──hit──► respond_from_cache ──► persist ──► END
        │
        miss
        ▼
    rag_retrieve ──► nl_to_sql ──► validate_sql ──► execute_sql
                                                       │
                                                       ▼
                                              pick_chart ──► generate_insight
                                                                  │
                                                                  ▼
                                                            cache_write ──► persist ──► END

Side effects:
    - Reads/writes the `analytics_semantic_cache` Qdrant collection.
    - Reads from the `analytics_kpi_knowledge` Qdrant collection.
    - Writes one user-row + one assistant-row per turn into
      `applicants.analytics_chat_sessions` for audit/replay.
"""
from __future__ import annotations

import datetime as _dt
import decimal
import json
import re
import uuid
from typing import Any, Optional, TypedDict

import httpx
from langgraph.graph import END, StateGraph
from psycopg.types.json import Json

from config import (
    ANALYTICS_CACHE_THRESHOLD,
    ANALYTICS_RAG_HIT_THRESHOLD,
    HF_ANALYTICS_MODEL_ID,
    HF_API_TOKEN,
    HF_MODEL_ID,
)
from db import get_conn
from services import analytics_rag, semantic_cache

HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions"
MAX_RESULT_ROWS = 200
MAX_HISTORY_TURNS = 4  # how many prior (user, assistant) pairs to feed back

# Forbidden tokens — checked as whole words on the lowered, comment-stripped SQL.
FORBIDDEN_KEYWORDS = (
    "insert", "update", "delete", "drop", "alter", "truncate",
    "create", "grant", "revoke", "copy", "vacuum", "reindex", "comment",
    "merge", "call", "do", "execute",
)


# ---------- state ----------

class AnalyticsState(TypedDict, total=False):
    # input
    session_id: str
    question: str
    history: list[dict[str, str]]  # [{"role": "user"|"assistant", "content": "..."}]

    # cache
    cache: dict[str, Any]          # {"hit": bool, "similarity": float, "payload": {...}}

    # rag
    rag_hits: list[dict[str, Any]]
    rag_hit: bool

    # sql + result
    sql: str
    columns: list[str]
    rows: list[dict[str, Any]]
    row_count: int

    # rendering
    chart: dict[str, Any]
    insight: str

    # ops
    used_model: str
    error: Optional[str]
    run_log: list[dict[str, Any]]


# ---------- helpers ----------

def _log(state: AnalyticsState, node: str, **fields: Any) -> list[dict[str, Any]]:
    entry = {
        "node": node,
        "at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
        **fields,
    }
    return [*state.get("run_log", []), entry]


def _jsonable(v: Any) -> Any:
    if isinstance(v, decimal.Decimal):
        return float(v)
    if isinstance(v, (_dt.datetime, _dt.date)):
        return v.isoformat()
    if isinstance(v, _dt.timedelta):
        return v.total_seconds()
    if isinstance(v, (list, tuple)):
        return [_jsonable(x) for x in v]
    if isinstance(v, dict):
        return {k: _jsonable(x) for k, x in v.items()}
    return v


def _extract_json(text: str) -> dict[str, Any]:
    if not text:
        return {}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            return {}
    return {}


def _call_hf(messages: list[dict[str, str]], model: str, max_tokens: int = 900) -> dict[str, Any]:
    if not HF_API_TOKEN:
        raise RuntimeError("HF_API_TOKEN is not set in backend/.env")
    headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
    }
    with httpx.Client(timeout=90.0) as client:
        r = client.post(HF_CHAT_URL, headers=headers, json=payload)
        r.raise_for_status()
        return r.json()


def _strip_sql_comments(sql: str) -> str:
    sql = re.sub(r"--.*?$", "", sql, flags=re.MULTILINE)
    sql = re.sub(r"/\*.*?\*/", "", sql, flags=re.DOTALL)
    return sql.strip()


# ---------- nodes ----------

def _node_cache_check(state: AnalyticsState) -> AnalyticsState:
    res = semantic_cache.lookup(state["question"], threshold=ANALYTICS_CACHE_THRESHOLD)
    if not res:
        return {
            **state,
            "cache": {"hit": False, "similarity": 0.0, "payload": {}},
            "run_log": _log(state, "cache_check", hit=False),
        }
    return {
        **state,
        "cache": {"hit": True, "similarity": res["similarity"], "payload": res["payload"]},
        "run_log": _log(state, "cache_check", hit=True, similarity=round(res["similarity"], 3)),
    }


def _node_respond_from_cache(state: AnalyticsState) -> AnalyticsState:
    p = state["cache"]["payload"]
    return {
        **state,
        "sql": p.get("sql", ""),
        "columns": p.get("columns", []),
        "rows": p.get("rows", []),
        "row_count": p.get("row_count", len(p.get("rows", []))),
        "chart": p.get("chart") or {"type": "table"},
        "insight": p.get("insight", ""),
        "rag_hits": p.get("rag_hits", []),
        "rag_hit": bool(p.get("rag_hit")),
        "used_model": p.get("used_model", "cache"),
        "run_log": _log(state, "respond_from_cache"),
    }


def _node_rag_retrieve(state: AnalyticsState) -> AnalyticsState:
    hits = analytics_rag.search(state["question"], k=6)
    top_score = max((h.get("_score", 0.0) for h in hits), default=0.0)
    rag_hit = top_score >= ANALYTICS_RAG_HIT_THRESHOLD and any(
        h.get("source") in ("kpi_definitions.md", "business_rules.md") for h in hits
    )
    return {
        **state,
        "rag_hits": hits,
        "rag_hit": rag_hit,
        "run_log": _log(
            state, "rag_retrieve",
            hits=len(hits), top_score=round(top_score, 3), rag_hit=rag_hit,
        ),
    }


# ----- NL → SQL prompt -----

_SCHEMA_DDL = """
TABLES (schema = `employees`):

employees.employees(
  employee_id BIGINT PK, employee_code VARCHAR, first_name VARCHAR, last_name VARCHAR,
  email VARCHAR, personal_email VARCHAR, phone VARCHAR, date_of_birth DATE,
  gender VARCHAR, street_address VARCHAR, city VARCHAR, state VARCHAR,
  country VARCHAR, zip_code VARCHAR,
  department_name VARCHAR, manager_id BIGINT (self-FK -> employee_id),
  job_title VARCHAR, employee_level VARCHAR, employment_type VARCHAR,
  work_mode VARCHAR, location VARCHAR, timezone VARCHAR,
  join_date DATE NOT NULL, exit_date DATE,
  total_experience_years DECIMAL, company_experience_years DECIMAL,
  bandwidth_percent DECIMAL DEFAULT 100,  -- 0..100
  current_project_count INT,
  status VARCHAR DEFAULT 'Active',  -- 'Active' | 'Resigned' | 'Terminated' | ...
  payroll_status VARCHAR, base_salary DECIMAL, currency VARCHAR DEFAULT 'USD',
  bonus_eligible BOOLEAN, last_working_date DATE,
  emergency_contact_name VARCHAR, emergency_contact_phone VARCHAR,
  created_at TIMESTAMP, updated_at TIMESTAMP
)

employees.employee_skills(
  employee_skill_id PK, employee_id FK, skill_name, skill_category,
  proficiency_level, years_of_experience, is_primary_skill
)

employees.employee_certifications(
  certification_id PK, employee_id FK, certification_name, issuing_organization,
  issue_date, expiry_date, credential_id, credential_url, status
)

employees.employee_achievements(
  achievement_id PK, employee_id FK, title, category, issuer_or_organization,
  achievement_date, description
)

employees.employee_education(
  education_id PK, employee_id FK, degree, field_of_study, institution_name,
  start_year, end_year, grade_gpa
)

employees.employee_work_history(
  work_history_id PK, employee_id FK, company_name, job_title,
  start_date, end_date, description
)

employees.projects(
  project_id PK, project_name, project_manager_id (-> employees.employee_id),
  start_date, end_date, project_status, priority,
  required_bandwidth_percent, description
)

employees.employee_projects(
  employee_project_id PK, employee_id FK, project_id FK,
  role_in_project, allocation_percent, start_date, end_date,
  assignment_status   -- 'Active' | 'Completed' | ...
)

employees.employee_compensation(
  compensation_id PK, employee_id FK,
  effective_from, effective_to, base_salary, bonus_amount, variable_pay,
  payroll_frequency, currency, compensation_status
)

employees.employee_payroll(
  payroll_id PK, employee_id FK,
  payroll_month INT 1-12, payroll_year INT,
  gross_pay, deductions, net_pay, payment_date, payroll_status
)
""".strip()

_SQL_SYSTEM_PROMPT = """\
You are a senior PostgreSQL analyst at Nimbus Labs answering HR Analytics
questions over the `employees` schema.

YOUR JOB
========
Convert the user's natural-language question into ONE valid PostgreSQL query
that answers it, plus the supporting metadata listed below. Do not chat —
return only the JSON object.

STRICT RULES
============
1. READ-ONLY. Emit a single statement that starts with `SELECT` or `WITH`.
   Never use INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/CREATE/GRANT/REVOKE
   /COPY/MERGE. No semicolons except an optional trailing one.
2. SCHEMA. Reference only tables in the `employees` schema, fully qualified
   (e.g. `employees.employees`). Never use `applicants.*`.
3. ACTIVE FILTER. For headcount, salary, skills, projects, bandwidth, and
   manager queries, default to `WHERE status = 'Active'` unless the user
   explicitly says "including former employees" or asks about exits/attrition.
4. ROW BUDGET. If the natural answer has many rows, add `LIMIT 200`.
5. KNOWLEDGE BASE FIRST. The CONTEXT block may contain custom KPI formulas
   and reference SQL written by Nimbus Labs analysts. If the user asks for a
   named KPI defined there (e.g. bench strength, compa-ratio, attrition
   rate, tenure bucket, manager span of control), use the formula from the
   KB verbatim — do not invent your own.
6. CASE-INSENSITIVE TEXT. When matching department / skill / location strings
   typed by the user, compare via `LOWER(col) = LOWER(...)` or use ILIKE.
7. NO PLACEHOLDERS. Inline the values from the user's question into the SQL.
   The query is parameter-free.
8. RETURN JSON. The JSON object MUST conform to:
{
  "sql": "<the SQL>",
  "intent": "<one short sentence describing what the SQL computes>",
  "used_kb": true|false,   // true if you copied a formula from the CONTEXT
  "chart_hint": "bar|line|pie|kpi|table"   // best fit; the renderer may override
}

If the question cannot be answered from this schema, return:
{ "sql": "", "intent": "", "used_kb": false, "chart_hint": "table",
  "error": "<one-sentence reason>" }
""".strip()


def _node_nl_to_sql(state: AnalyticsState) -> AnalyticsState:
    rag_ctx = analytics_rag.format_context(state.get("rag_hits", []))
    history = state.get("history") or []
    history_str = ""
    if history:
        recent = history[-(MAX_HISTORY_TURNS * 2):]
        history_str = "RECENT CONVERSATION (oldest first):\n" + "\n".join(
            f"{m['role'].upper()}: {m['content']}" for m in recent
        ) + "\n\n"

    user_msg = (
        f"{history_str}"
        f"SCHEMA:\n{_SCHEMA_DDL}\n\n"
        f"CONTEXT (Nimbus Labs analytics knowledge base):\n{rag_ctx}\n\n"
        f"USER QUESTION:\n{state['question']}\n\n"
        "Return ONLY the JSON object described in the system prompt."
    )
    messages = [
        {"role": "system", "content": _SQL_SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]

    model = HF_ANALYTICS_MODEL_ID or HF_MODEL_ID
    try:
        raw = _call_hf(messages, model=model, max_tokens=900)
    except Exception as e:
        return {
            **state, "used_model": model,
            "error": f"LLM call failed: {e}",
            "run_log": _log(state, "nl_to_sql", error=str(e)),
        }

    try:
        content = raw["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        return {
            **state, "used_model": model,
            "error": "LLM returned unexpected shape",
            "run_log": _log(state, "nl_to_sql", error="bad shape"),
        }

    parsed = _extract_json(content)
    sql = (parsed.get("sql") or "").strip()
    if not sql:
        return {
            **state, "used_model": model,
            "error": parsed.get("error") or "LLM did not produce SQL",
            "run_log": _log(state, "nl_to_sql", error="empty sql"),
        }

    chart_hint = parsed.get("chart_hint") or "table"
    return {
        **state,
        "sql": sql,
        "used_model": model,
        "chart": {"type": chart_hint, "data": []},  # placeholder, finalized later
        "run_log": _log(
            state, "nl_to_sql",
            chart_hint=chart_hint,
            used_kb=bool(parsed.get("used_kb")),
            sql_preview=sql[:140],
        ),
    }


def _node_validate_sql(state: AnalyticsState) -> AnalyticsState:
    if state.get("error"):
        return state
    sql_raw = state["sql"]
    sql = _strip_sql_comments(sql_raw).rstrip(";").strip()
    if not sql:
        return {**state, "error": "Empty SQL after stripping comments"}

    # Single-statement only (no `;` left after stripping a single trailer).
    if ";" in sql:
        return {**state, "error": "Multi-statement SQL is not allowed"}

    head = sql.lstrip("(").lower()
    if not (head.startswith("select") or head.startswith("with")):
        return {**state, "error": "Only SELECT / WITH queries are allowed"}

    lower = sql.lower()
    for kw in FORBIDDEN_KEYWORDS:
        if re.search(rf"\b{kw}\b", lower):
            return {**state, "error": f"Forbidden keyword in SQL: {kw}"}

    if "applicants." in lower:
        return {**state, "error": "Queries against the applicants schema are not allowed here"}

    return {
        **state,
        "sql": sql,
        "run_log": _log(state, "validate_sql", ok=True),
    }


def _node_execute_sql(state: AnalyticsState) -> AnalyticsState:
    if state.get("error"):
        return state
    sql = state["sql"]
    try:
        # Wrap in a read-only transaction so even a bug in the validator
        # cannot mutate data, and cap runtime so a runaway query can't DoS.
        with get_conn() as conn:
            with conn.transaction():
                conn.execute("SET LOCAL transaction_read_only = on")
                conn.execute("SET LOCAL statement_timeout = '15s'")
                cur = conn.execute(sql)
                rows = cur.fetchmany(MAX_RESULT_ROWS + 1)
                cols = [d.name for d in cur.description] if cur.description else []
    except Exception as e:
        return {
            **state,
            "error": f"SQL execution failed: {e}",
            "run_log": _log(state, "execute_sql", error=str(e)),
        }

    truncated = len(rows) > MAX_RESULT_ROWS
    rows = rows[:MAX_RESULT_ROWS]
    serial_rows = [{k: _jsonable(v) for k, v in r.items()} for r in rows]
    return {
        **state,
        "columns": cols,
        "rows": serial_rows,
        "row_count": len(serial_rows),
        "run_log": _log(
            state, "execute_sql",
            rows=len(serial_rows), columns=cols, truncated=truncated,
        ),
    }


# ----- chart picker (heuristic) -----

_TIME_KEYS = ("month", "year", "date", "period", "quarter", "week", "day")


def _is_numeric_col(rows: list[dict[str, Any]], col: str) -> bool:
    for r in rows:
        v = r.get(col)
        if v is None:
            continue
        if isinstance(v, bool):
            return False
        if not isinstance(v, (int, float)):
            return False
    # at least one non-null numeric
    return any(isinstance(r.get(col), (int, float)) and not isinstance(r.get(col), bool) for r in rows)


def _is_time_col(col: str, rows: list[dict[str, Any]]) -> bool:
    cl = col.lower()
    if any(k in cl for k in _TIME_KEYS):
        return True
    for r in rows[:5]:
        v = r.get(col)
        if isinstance(v, str) and re.match(r"^\d{4}(-\d{2})?(-\d{2})?$", v):
            return True
    return False


def _pick_chart(columns: list[str], rows: list[dict[str, Any]], hint: str) -> dict[str, Any]:
    if not rows:
        return {"type": "empty", "data": []}

    # Single scalar => KPI card
    if len(columns) == 1 and len(rows) == 1:
        col = columns[0]
        return {"type": "kpi", "label": col, "value": rows[0].get(col), "data": rows}

    # Few-row, many-numeric-cols => KPI grid
    if len(rows) == 1 and len(columns) <= 6:
        all_numeric = all(_is_numeric_col(rows, c) for c in columns)
        if all_numeric:
            return {"type": "kpi_grid", "data": rows}

    # Identify column roles
    time_cols = [c for c in columns if _is_time_col(c, rows)]
    num_cols = [c for c in columns if _is_numeric_col(rows, c) and c not in time_cols]
    cat_cols = [c for c in columns if c not in time_cols and c not in num_cols]

    # Time series → line
    if time_cols and num_cols:
        return {
            "type": "line",
            "x_key": time_cols[0],
            "y_keys": num_cols,
            "data": rows,
        }

    # One categorical + one numeric → bar (or pie if small + hint pie)
    if cat_cols and num_cols:
        x = cat_cols[0]
        y = num_cols[0]
        if hint == "pie" and len(rows) <= 8 and len(num_cols) == 1:
            return {"type": "pie", "name_key": x, "value_key": y, "data": rows}
        # If many rows, prefer horizontal bar; let frontend decide orientation.
        return {
            "type": "bar",
            "x_key": x,
            "y_keys": num_cols[: 3],
            "data": rows,
        }

    # Fallback → table
    return {"type": "table", "columns": columns, "data": rows}


def _node_pick_chart(state: AnalyticsState) -> AnalyticsState:
    if state.get("error"):
        return state
    hint = (state.get("chart") or {}).get("type", "table")
    chart = _pick_chart(state.get("columns", []), state.get("rows", []), hint=hint)
    return {**state, "chart": chart, "run_log": _log(state, "pick_chart", type=chart.get("type"))}


# ----- insight LLM -----

_INSIGHT_SYSTEM = """\
You are an HR Analytics assistant. Given a user question and a tabular SQL
result, write a crisp, factual answer for HR. Rules:

- 2 to 4 sentences. No bullet points, no markdown headers.
- Lead with the direct answer (a number, a name, a comparison).
- If the result is empty, say so plainly.
- If you spot a notable pattern (e.g. one department dominates, or values
  are heavily skewed), call it out in one sentence.
- Do NOT invent values — only refer to numbers present in the result.
- Output JSON: { "insight": "<your 2-4 sentence answer>" }.
""".strip()


def _node_generate_insight(state: AnalyticsState) -> AnalyticsState:
    if state.get("error"):
        return state
    rows = state.get("rows", [])
    sample = rows[:20]
    user_msg = (
        f"USER QUESTION: {state['question']}\n\n"
        f"SQL RUN: {state['sql']}\n\n"
        f"RESULT (first {len(sample)} of {state.get('row_count', len(rows))}):\n"
        f"{json.dumps(sample, default=str)[:3500]}\n\n"
        "Return JSON only."
    )
    messages = [
        {"role": "system", "content": _INSIGHT_SYSTEM},
        {"role": "user", "content": user_msg},
    ]
    model = HF_ANALYTICS_MODEL_ID or HF_MODEL_ID
    try:
        raw = _call_hf(messages, model=model, max_tokens=300)
        content = raw["choices"][0]["message"]["content"]
        parsed = _extract_json(content)
        insight = (parsed.get("insight") or "").strip()
    except Exception as e:
        insight = f"(insight generation failed: {e})"

    if not insight:
        insight = "Result returned — see chart and table for details."
    return {**state, "insight": insight, "run_log": _log(state, "generate_insight")}


def _node_cache_write(state: AnalyticsState) -> AnalyticsState:
    if state.get("error"):
        return state
    payload = {
        "sql": state.get("sql", ""),
        "columns": state.get("columns", []),
        "rows": state.get("rows", []),
        "row_count": state.get("row_count", 0),
        "chart": state.get("chart", {}),
        "insight": state.get("insight", ""),
        "rag_hits": analytics_rag.hits_summary(state.get("rag_hits", [])),
        "rag_hit": bool(state.get("rag_hit")),
        "used_model": state.get("used_model", ""),
    }
    ok = semantic_cache.upsert(state["question"], payload)
    return {**state, "run_log": _log(state, "cache_write", ok=ok)}


def _node_persist(state: AnalyticsState) -> AnalyticsState:
    """Append user + assistant turns to the chat session table.

    Fail-safe: if the table is missing or the DB write fails for any reason,
    we log and continue so the user still sees the answer. The chat just
    won't carry history into the next turn.
    """
    sid = state.get("session_id") or str(uuid.uuid4())
    error = state.get("error")
    cache = state.get("cache") or {}

    sql_persist = """
        SELECT COALESCE(MAX(turn_index), -1) AS max_idx
        FROM applicants.analytics_chat_sessions
        WHERE session_id = %s
    """
    try:
        with get_conn() as conn:
            row = conn.execute(sql_persist, (sid,)).fetchone() or {}
            next_idx = int(row.get("max_idx") or -1) + 1

            conn.execute(
                """
                INSERT INTO applicants.analytics_chat_sessions
                    (session_id, turn_index, role, content)
                VALUES (%s, %s, 'user', %s)
                """,
                (sid, next_idx, state["question"]),
            )
            assistant_content = state.get("insight") or (error or "(no answer)")
            conn.execute(
                """
                INSERT INTO applicants.analytics_chat_sessions
                    (session_id, turn_index, role, content,
                     sql_query, chart_type, cache_hit, cache_similarity,
                     rag_hit, rag_sources)
                VALUES (%s, %s, 'assistant', %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    sid,
                    next_idx + 1,
                    assistant_content,
                    state.get("sql"),
                    (state.get("chart") or {}).get("type"),
                    bool(cache.get("hit")),
                    float(cache.get("similarity") or 0.0),
                    bool(state.get("rag_hit")),
                    Json(analytics_rag.hits_summary(state.get("rag_hits", []))),
                ),
            )
            conn.commit()
        return {**state, "session_id": sid, "run_log": _log(state, "persist", turn=next_idx)}
    except Exception as e:
        msg = str(e)
        if "analytics_chat_sessions" in msg and "does not exist" in msg.lower():
            hint = (
                "Chat history table missing. Apply migration: "
                "psql $SUPABASE_DB_URL -f backend/migrations/008_analytics_chat.sql"
            )
        else:
            hint = f"chat persistence failed: {msg}"
        return {**state, "session_id": sid, "run_log": _log(state, "persist", error=hint)}


# ---------- routing ----------

def _route_after_cache(state: AnalyticsState) -> str:
    return "respond_from_cache" if state.get("cache", {}).get("hit") else "rag_retrieve"


def _route_after_validate(state: AnalyticsState) -> str:
    return "execute_sql" if not state.get("error") else "persist"


def _route_after_execute(state: AnalyticsState) -> str:
    return "pick_chart" if not state.get("error") else "persist"


# ---------- graph ----------

def _build_graph():
    g = StateGraph(AnalyticsState)
    g.add_node("cache_check", _node_cache_check)
    g.add_node("respond_from_cache", _node_respond_from_cache)
    g.add_node("rag_retrieve", _node_rag_retrieve)
    g.add_node("nl_to_sql", _node_nl_to_sql)
    g.add_node("validate_sql", _node_validate_sql)
    g.add_node("execute_sql", _node_execute_sql)
    g.add_node("pick_chart", _node_pick_chart)
    g.add_node("generate_insight", _node_generate_insight)
    g.add_node("cache_write", _node_cache_write)
    g.add_node("persist", _node_persist)

    g.set_entry_point("cache_check")
    g.add_conditional_edges(
        "cache_check",
        _route_after_cache,
        {"respond_from_cache": "respond_from_cache", "rag_retrieve": "rag_retrieve"},
    )
    g.add_edge("respond_from_cache", "persist")
    g.add_edge("rag_retrieve", "nl_to_sql")
    g.add_edge("nl_to_sql", "validate_sql")
    g.add_conditional_edges(
        "validate_sql",
        _route_after_validate,
        {"execute_sql": "execute_sql", "persist": "persist"},
    )
    g.add_conditional_edges(
        "execute_sql",
        _route_after_execute,
        {"pick_chart": "pick_chart", "persist": "persist"},
    )
    g.add_edge("pick_chart", "generate_insight")
    g.add_edge("generate_insight", "cache_write")
    g.add_edge("cache_write", "persist")
    g.add_edge("persist", END)
    return g.compile()


_GRAPH = _build_graph()


# ---------- public API ----------

def load_history(session_id: str) -> list[dict[str, str]]:
    if not session_id:
        return []
    sql = """
        SELECT role, content FROM applicants.analytics_chat_sessions
        WHERE session_id = %s
        ORDER BY turn_index ASC
    """
    try:
        with get_conn() as conn:
            rows = conn.execute(sql, (session_id,)).fetchall()
        return [{"role": r["role"], "content": r["content"]} for r in rows]
    except Exception:
        # Missing table or DB hiccup — treat as no prior history.
        return []


def answer(question: str, session_id: Optional[str] = None) -> dict[str, Any]:
    """Run one chatbot turn end-to-end and return a response payload."""
    sid = session_id or str(uuid.uuid4())
    history = load_history(sid)
    state: AnalyticsState = {
        "session_id": sid,
        "question": question,
        "history": history,
        "run_log": [],
    }
    final = _GRAPH.invoke(state)

    cache = final.get("cache") or {}
    return {
        "session_id": final.get("session_id", sid),
        "question": question,
        "answer": final.get("insight") or final.get("error") or "(no answer)",
        "sql": final.get("sql", ""),
        "columns": final.get("columns", []),
        "rows": final.get("rows", []),
        "row_count": final.get("row_count", 0),
        "chart": final.get("chart") or {"type": "table"},
        "cache_hit": bool(cache.get("hit")),
        "cache_similarity": round(float(cache.get("similarity") or 0.0), 3),
        "rag_hit": bool(final.get("rag_hit")),
        "rag_sources": analytics_rag.hits_summary(final.get("rag_hits", [])),
        "used_model": final.get("used_model") or "",
        "error": final.get("error"),
        "run_log": final.get("run_log", []),
    }


def list_sessions(limit: int = 20) -> list[dict[str, Any]]:
    sql = """
        SELECT session_id,
               MIN(created_at) AS started_at,
               MAX(created_at) AS last_at,
               COUNT(*) FILTER (WHERE role = 'user') AS turns
        FROM applicants.analytics_chat_sessions
        GROUP BY session_id
        ORDER BY last_at DESC
        LIMIT %s
    """
    with get_conn() as conn:
        rows = conn.execute(sql, (limit,)).fetchall()
    out = []
    for r in rows:
        out.append({
            "session_id": r["session_id"],
            "started_at": r["started_at"].isoformat() if r.get("started_at") else None,
            "last_at": r["last_at"].isoformat() if r.get("last_at") else None,
            "turns": int(r.get("turns") or 0),
        })
    return out


def session_messages(session_id: str) -> list[dict[str, Any]]:
    sql = """
        SELECT turn_index, role, content, sql_query, chart_type,
               cache_hit, cache_similarity, rag_hit, rag_sources, created_at
        FROM applicants.analytics_chat_sessions
        WHERE session_id = %s
        ORDER BY turn_index ASC
    """
    with get_conn() as conn:
        rows = conn.execute(sql, (session_id,)).fetchall()
    out = []
    for r in rows:
        out.append({
            "turn_index": r["turn_index"],
            "role": r["role"],
            "content": r["content"],
            "sql": r.get("sql_query"),
            "chart_type": r.get("chart_type"),
            "cache_hit": bool(r.get("cache_hit")),
            "cache_similarity": float(r.get("cache_similarity") or 0.0),
            "rag_hit": bool(r.get("rag_hit")),
            "rag_sources": r.get("rag_sources") or [],
            "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
        })
    return out
