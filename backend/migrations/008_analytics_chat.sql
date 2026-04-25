-- 008 — HR Analytics chatbot: chat session memory.
-- Stores conversation history per session so the agent can carry context
-- across turns. Lightweight; one row per message (user or assistant).

CREATE TABLE IF NOT EXISTS applicants.analytics_chat_sessions (
    session_id      TEXT NOT NULL,
    turn_index      INT  NOT NULL,
    role            VARCHAR(20) NOT NULL,        -- 'user' | 'assistant'
    content         TEXT NOT NULL,
    sql_query       TEXT,                        -- assistant turns only
    chart_type      VARCHAR(40),                 -- assistant turns only
    cache_hit       BOOLEAN DEFAULT FALSE,
    cache_similarity REAL,                       -- 0.0–1.0
    rag_hit         BOOLEAN DEFAULT FALSE,
    rag_sources     JSONB,                       -- list of {source, section, score}
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_id, turn_index)
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_session
    ON applicants.analytics_chat_sessions (session_id, created_at);
