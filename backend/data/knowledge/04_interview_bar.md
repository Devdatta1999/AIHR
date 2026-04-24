# Nimbus Labs — Interview Bar & Calibration

## Overview
We run a four-stage loop: recruiter screen → hiring manager conversation → technical loop (2–3 interviews) → bar-raiser. Every candidate is evaluated against role-specific signals *and* the six leadership principles. A "hire" requires consensus; a "no hire" from any interviewer is a no-hire unless the bar-raiser overrides with written rationale.

## Levels & expectations

### IC3 — Engineer
- Ships features independently in a well-defined area
- Writes production-quality code; requires direction on architecture
- Owns on-call rotation for their team
- **Interview focus:** coding fluency, debugging, narrow system design

### IC4 — Senior Engineer
- Leads features end-to-end including design, rollout, metrics
- Mentors IC3s
- Identifies tech debt and drives cleanup
- **Interview focus:** system design at the service level, cross-functional collaboration, influence without authority

### IC5 — Staff Engineer
- Leads multi-quarter initiatives spanning 2+ teams
- Sets technical strategy for a domain
- Writes RFCs that shape roadmaps
- **Interview focus:** org-scale design, ambiguity, technical judgment, writing, strategy

### IC6 — Principal Engineer
- Sets strategy across the company
- Mentors staff engineers
- Represents Nimbus Labs externally (talks, papers)
- **Interview focus:** long-horizon technical bets, org impact, crisis leadership

## Signals by question type

### Behavioral — Culture Fit
Target **candor**, **outcome ownership**, **default to trust**.
- "Tell me about a time you disagreed with your manager's decision."
  - *Hire*: disagreed directly, committed after the call, revisited with data
  - *No-hire*: either capitulated silently, or undermined the decision afterward
- "Describe feedback you gave a peer that was hard to deliver."
  - *Hire*: specific, actionable, received well or led to productive tension
  - *No-hire*: generic, delivered via manager, or never actually delivered

### Behavioral — Leadership
Target **bias for action**, **raise the bar**, **systems thinking**.
- "Tell me about a time you decided to move forward with incomplete information."
- "Describe a hire you made or influenced. What was the bar, and did they raise it?"
- "Walk me through a time you declined to hire someone everyone else wanted to hire."

### Situational — Judgment
Give a realistic scenario and see how the candidate reasons. Push on tradeoffs.
- "A customer hits a bug in prod at 11pm on Friday. Your on-call engineer is sleeping. What do you do in the first 20 minutes?"
- "You discover that the feature you're about to launch has a small bias in its output. Launch date is Monday. What do you do?"
- "Your director asks you to cut a corner to hit a deadline. You disagree. How does that conversation go?"

### Technical — Role-specific
- **Backend / services:** API design, SQL, distributed-systems failure modes, observability, on-call runbooks
- **Data engineering:** pipeline idempotency, schema evolution, cost vs. latency, data quality monitoring, incremental processing
- **ML / AI:** evaluation design, offline/online skew, prompt engineering, structured outputs, latency budgets
- **Frontend:** state management tradeoffs, accessibility, perf, component API design
- **Infrastructure:** deploy strategies, secrets, multi-region, cost control, incident response

## Anti-patterns we disqualify for
- Can't describe *why* a past technical decision was made, only *what* was done
- Talks about work exclusively in the first person plural ("we did X") and can't surface their own contribution
- Gets defensive when pushed on a tradeoff
- Won't revise their position when given new data
- Describes code reviews as a bureaucratic obstacle rather than a learning loop

## Debrief format
Each interviewer submits, within 24h:
- **Vote:** Strong Hire / Hire / Lean No / Strong No
- **Signal for each dimension** (3–5 per role) — Exceeds / Meets / Below / Not Assessed
- **What I'd learn from this person** — required; no answer = not a hire
- **Biggest concern** — required
- **One followup question** — what I'd probe further next round
