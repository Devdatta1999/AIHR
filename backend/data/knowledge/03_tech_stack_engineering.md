# Nimbus Labs — Tech Stack & Engineering Approach

## Languages
- **Python 3.11+** — all services (FastAPI backends, data pipelines, ML/agent code)
- **TypeScript** — all frontend (React + Vite), Node.js workers
- **SQL** — Postgres dialect, written by hand; we do not use ORMs in the hot path
- Small amount of **Bash** for operational scripts. We do not write Ruby, Java, Go, or Rust.

## Data layer
- **Postgres 15 (Supabase-hosted)** — primary OLTP database for applicants, jobs, invitations, offer letters, evaluations
- **pgvector** — considered for embeddings; currently we use Qdrant
- **Qdrant** — vector database, runs on Docker; used for RAG over the company knowledge base and semantic caching of LLM queries
- **psycopg3** (not SQLAlchemy) — direct SQL with parameterized queries, dict_row for simple dict outputs, ConnectionPool for lifecycle
- **Databricks / Delta Lake** — offline analytics and model training datasets (Spark SQL for larger joins)
- **Redis** — caching layer for hot paths, rate limits (coming online Q2 2026)

## Backend services
- **FastAPI** with Pydantic v2 for validation, `uvicorn` for serving
- **LangGraph** for agent orchestration (we prefer explicit node graphs over free-form `ReAct` loops)
- **LangChain core primitives** only — we avoid LangChain chains and abstractions
- **HuggingFace Inference Router API** for hosted LLM calls (`meta-llama/Llama-3.1-8B-Instruct` is our default for structured extraction)
- **Google Calendar + Gmail APIs** (OAuth2 user refresh token flow) for candidate invitations and offer-letter delivery
- **Tavily API** for web search inside agents
- **sentence-transformers (all-MiniLM-L6-v2)** for local embeddings

## Frontend
- **React 18 + Vite** + TypeScript
- **Tailwind CSS** (no component library — we own our design system)
- **react-dnd** for drag-and-drop (pipeline kanban board)
- **lucide-react** for icons
- No Redux, no React Query. Plain `useState` + `useEffect` + a thin `api.ts` fetch wrapper. If a component grows complex, we refactor toward a reducer locally.

## Cloud & operations
- **AWS** (us-west-2 primary) — EKS for services, RDS optional alternative to Supabase, S3 for resumes/attachments
- **Cloudflare** — DNS, CDN, WAF
- **GitHub Actions** for CI; blue/green deploys via ArgoCD
- **Datadog** for logs + metrics + tracing; **Sentry** for frontend errors
- **Terraform** for infra-as-code; reviewed like app code

## Engineering principles in practice
### Trunk-based development
- Short-lived branches, merged within a day when possible
- Every PR is gated by CI (tests, typecheck, lint, build)
- Every feature ships behind a **GrowthBook** feature flag — merge ≠ release

### Observability is first-class
- Every endpoint emits structured logs + latency + success/failure metrics
- Every agent run emits token usage, node durations, retrieval hit rates
- A feature without a dashboard is not done

### Tests we actually write
- **Integration tests** against a real Postgres (docker-compose) — no mocks for DB
- **Contract tests** for every outbound API (Google, Tavily, HuggingFace) — exercised weekly
- Unit tests for pure logic. We do not write tests just to hit coverage.

### SQL style
- Hand-written SQL; parameterized always (never f-strings)
- Prefer CTEs to nested subqueries for readability
- Index review for any query doing >100 rows/sec in prod

### AI / agent work
- Every agent has: a fixed graph, typed state, per-node retries, a persisted run log
- Prompts are code — they live in version control, they have unit tests
- We prefer **structured outputs** (JSON schema) over free-form parsing
- Before adding tool calls, ask: "Can a SQL query answer this faster?"

## Recent technical projects (2025–2026)
- **Applicant AI evaluator (Jan 2026)** — LangGraph agent: SQL prefilter → LLM scoring on 6 facets → persist evaluation. Cut HR screening time 70%.
- **Interview scheduling + Meet integration (Apr 2026)** — OAuth2 refresh token flow, Google Calendar event creation, Gmail API for branded invites with ICS attachment.
- **Offer letter generator (Apr 2026)** — Templated HTML rendering + Gmail send, HR-editable preview, persisted to `offer_letters`.
- **HR analytics chat (Q2 2026, in progress)** — Natural-language SQL over HR data, semantic caching via Qdrant.
- **Candidate sourcing agent (planned Q3 2026)** — LinkedIn / GitHub enrichment, pre-hire pipeline building.
