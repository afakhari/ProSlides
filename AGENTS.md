# ProSlides: mandatory development guide

This is the entry document for every human or AI agent working in this
repository. Read it completely before inspecting, changing, generating, or
deleting code. It is the operational source of truth; if it conflicts with the
repository, investigate the discrepancy, correct this document in the same
change, and state the discrepancy in the final handoff.

## Product and non-negotiable decisions

ProSlides is a capacity-oriented, interactive presentation platform in the
Kahoot/AhaSlides category: presentations, quizzes, polls, word clouds, Q&A,
live sessions, scoring, leaderboards, and reports.

- The target is a future-ready system that can be proven at 10,000 participants
  in one live session before scaling beyond that.
- The backend is a Go **modular monolith**, not Django, Rust, or microservices.
- Client commands use HTTP; server-to-client live updates use SSE. Do not add a
  WebSocket feature unless the owner explicitly approves a documented,
  measured two-way need.
- PostgreSQL is the durable source of truth. Redis is only for fan-out,
  presence, cache, and distributed rate limits; it must never be the only copy
  of a command, answer, score, or report.
- Start with the smallest maintainable component set. Do not introduce Kafka,
  RabbitMQ, NATS, ClickHouse, MongoDB, Kubernetes, or a microservice solely for
  anticipated scale.

The historical Django/Rust implementation was intentionally removed from this
branch. Its history remains in Git and `master`; do not restore legacy code as
a shortcut.

## Current repository state — 2026-08-18

| Area | Actual state | Rule for next work |
|---|---|---|
| `apps/api` | Go API with Compose-verified presentation, slide, and question creation | Define answer submission and scoring contracts before live state work. |
| `apps/web` | React 19/Vite UI migration baseline; still JavaScript and still contains legacy WebSocket client code | Preserve visual work, but do not extend WebSocket. Replace its boundary with typed HTTP + SSE in Phase 2. |
| PostgreSQL | PostgreSQL 16 in Compose, with an initial immutable SQL migration | Durable data belongs here. Add forward-only migrations only. |
| Redis | Redis 7.4 in Compose | Use it only after the durable command/write path is correct. |
| CI | GitHub Actions validates Go tests and web lint/unit tests | Keep CI passing and add checks with new tooling. |
| Tests | Web lint, unit tests, and build last passed; Go 1.26.6 formatting/unit tests and the real Docker Compose health/readiness check passed on 2026-08-18 | Run the relevant matrix before every handoff. |

The working branch is `feat/go-platform-foundation`. It uses a separate Git
worktree, so `master` remains available to teammates. Do not merge, force-push,
or modify `master` without explicit owner approval.

## Repository map

```text
apps/
  api/                       Go API
    cmd/api/                 composition root; process lifecycle only
    internal/platform/       config, HTTP, Postgres, Redis, observability
    internal/<module>/       module-specific application, domain, adapters
    migrations/              ordered, forward-only PostgreSQL SQL migrations
    openapi/                 REST and SSE contract source
  web/                       React client, progressive JS -> TypeScript migration
docs/
  AI_HANDOFF.md              precise execution plan and handoff template
  architecture.md            architecture boundaries
  decisions/                 Architecture Decision Records
AGENTS.md                    this mandatory guide
docker-compose.yaml          local API + PostgreSQL + Redis stack
```

Dependency flow inside the API is strictly:

```text
HTTP handler -> application/use case -> domain -> repository or infrastructure adapter
```

Domain code must not import HTTP/framework concerns. Only the `live` module can
advance session state, change scores, or close/open a question.

## Live protocol contract

Commands are HTTP and must return their definitive result; clients must not
wait for an SSE echo to decide whether a command succeeded.

```text
POST /api/v1/live/sessions/{sessionId}/join
POST /api/v1/live/sessions/{sessionId}/answers
POST /api/v1/live/sessions/{sessionId}/actions
GET  /api/v1/live/sessions/{sessionId}/snapshot
GET  /api/v1/live/sessions/{sessionId}/events       # text/event-stream
```

Every mutation carries `request_id`; manager mutations also carry
`expected_state_version`. A duplicate request returns the original result and
must not create a second answer or score.

Every event must be documented and versioned in `apps/api/openapi/` with at
least `event_id`, `schema_version`, `session_id`, `state_version`,
`occurred_at`, and `payload`. Use named events such as `slide.opened`,
`answer.stats`, and `leaderboard.updated`; never opaque numeric messages.

The state machine is:

```text
draft -> lobby -> content | question_open -> question_closed -> leaderboard -> ended
```

Answers are accepted only during `question_open` and before the server-side
`ends_at`. Invalid transitions return `409 Conflict`. Batch answer statistics
and leaderboard publications (normally 250–500 ms); never broadcast one event
per answer at capacity. SSE reconnect uses `Last-Event-ID`, then an authoritative
snapshot if replay is incomplete.

## Required workflow for every change

1. Read this file, then `docs/AI_HANDOFF.md`, then the files relevant to the
   requested scope.
2. Inspect `git status --short --branch`. Preserve unrelated changes; never
   reset, checkout, delete, or overwrite them.
3. For a REST or event contract change: edit OpenAPI first, implement API and
   web consumer second, then add/update contract and behavior tests.
4. Keep migrations forward-only. Never edit an applied migration, reset a
   database, purge Redis, or delete data without explicit owner authorization.
5. Use structured logs with request/session/participant identifiers. Never log
   secrets, access tokens, answers before closure, or personally identifying
   data beyond what the product requires.
6. Run the applicable verification commands in `docs/AI_HANDOFF.md`.
7. Update this file and `docs/AI_HANDOFF.md` whenever a material implementation,
   contract, decision, known risk, tool prerequisite, or next task changes.
8. In the final handoff state: files changed, behavior delivered, verification
   run and result, work not verified, and exactly one recommended next task.

## Completion criteria and safety rails

A task is not complete merely because code compiles. It is complete when its
contract, error behavior, tests, documentation, and operational consequence are
consistent. New external behavior needs an OpenAPI entry; new configuration
needs `.env.example` documentation; new persistent data needs a migration;
new operational dependency needs Compose, health/readiness, and CI coverage.

Before production, require TLS, secure/HttpOnly cookies or short-lived SSE
tickets, CSRF protection for mutations, restricted CORS, disabled proxy
buffering for SSE, appropriate timeouts/heartbeats, OpenTelemetry/metrics, and
load tests. Long-lived JWTs in an SSE query string are prohibited.

## Phases and the single next task

- [x] Phase 0a: choose Go modular monolith + PostgreSQL + Redis + HTTP/SSE.
- [x] Phase 0b: establish monorepo, Go bootstrap, Compose, initial schema,
  contract skeleton, CI, architecture documents, and remove legacy stack.
- [x] Phase 0c: PostgreSQL and Redis adapters, safe dependency readiness,
  configuration validation, route tests, and API contract documentation.
- [x] **Phase 1a:** identity contract, schema, password/session primitives,
  PostgreSQL adapter, secure cookie handlers, and the real Compose auth matrix
  are implemented and verified.
- [ ] Phase 1: identity, content, quizzes, presentations, slides, media, and
  typed React API client.
- [ ] Phase 2: live state machine, commands, snapshots, SSE, idempotency,
  presence, timers, score, and WebSocket-to-SSE UI migration.
- [ ] Phase 3: integration/E2E tests plus k6 scenarios for 1k/5k/10k users,
  reconnects, host disconnects, and answer bursts; document SLOs.
- [ ] Phase 4: feature-flagged cutover and exercised rollback only after
  parity is measured. Do not merge legacy code into this branch.

## Change log

| Date | Change | Verification / consequence |
|---|---|---|
| 2026-08-18 | Go-first capacity architecture selected | Replaces Django/Rust/WebSocket direction. |
| 2026-08-18 | Foundation created and repository reset to `apps/api` + `apps/web` | Legacy sources/docs removed only on feature branch; `master` preserved. |
| 2026-08-18 | Added Compose, initial PostgreSQL schema, OpenAPI skeleton, CI, ADR, and web migration notes | Web lint/unit/build and Compose configuration passed; Docker daemon was unavailable. |
| 2026-08-18 | Made this guide and `AI_HANDOFF.md` the explicit AI handoff protocol | Future agents must update both for material changes. |
| 2026-08-18 | Registered existing Go 1.26.6 installation in the user PATH and ran API formatting/tests | `go fmt ./...` and `go test ./...` passed; Docker daemon remains unavailable. |
| 2026-08-18 | Added the AI execution handoff and completed the local verification matrix | Web lint, 12 web unit tests, web build, Go tests, Compose syntax, and diff hygiene passed; `npm ci` reports 20 dependency vulnerabilities for later reviewed remediation. |
| 2026-08-18 | Added PostgreSQL/Redis clients and truthful `/readyz` | `healthz` remains process-only; `readyz` reports only safe per-dependency states and returns 503 on missing, failed, or timed-out dependencies. |
| 2026-08-18 | Replaced blocked `gcr.io` runtime image with Docker Hub Alpine non-root runtime | Docker build and real Compose `healthz`/`readyz` passed with PostgreSQL and Redis. |
| 2026-08-18 | Began identity boundary with forward-only opaque-session schema and OpenAPI contract | `0002_identity_sessions.sql`, `SESSION_TTL`, and register/login/logout/me contract added; HTTP auth behavior is not implemented yet. |
| 2026-08-18 | Wired identity HTTP handlers into the Go API | Application routes are present; PostgreSQL-backed auth route integration tests remain required. |
| 2026-08-18 | Added embedded forward-only migration runner | API applies tracked schema migrations before serving; auth runtime validation remains next. |
| 2026-08-18 | Corrected overly strict email parser comparison | Go identity tests pass; repeat the full Compose auth flow before declaring auth complete. |
| 2026-08-18 | Added Compose auth-matrix script and corrected registration success status to 201 | Go tests, Compose startup, and the full register/login/me/logout/CSRF matrix passed. |
| 2026-08-18 | Defined owner-scoped presentation read contract | `GET /api/v1/presentations/{presentationId}` documents authentication, ordered slides, and non-disclosing 404 behavior. |
| 2026-08-18 | Implemented owner-scoped presentation read slice | PostgreSQL adapter, authenticated handler, composition wiring, and behavior tests pass. |
| 2026-08-18 | Verified presentation read against Compose | Embedded presentation schema migration, owner read, ordered slides, and non-owner 404 passed end to end. |
| 2026-08-18 | Implemented and verified presentation creation | CSRF-protected owner creation and subsequent owner read passed through Compose. |
| 2026-08-18 | Implemented and verified slide creation | Contract, CSRF-protected handler, owner-scoped PostgreSQL write, Go behavior tests, and Compose flow passed. |
| 2026-08-18 | Implemented question creation with single/multiple choice | Question validation requires two options and correct answers; single has exactly one correct option. |

## References

- `docs/AI_HANDOFF.md` — exact next task, commands, acceptance criteria, and
  final-response template.
- `docs/architecture.md` — boundaries and scale design.
- `docs/decisions/0001-go-modular-monolith.md` — architecture decision record.
- `apps/api/openapi/openapi.yaml` — contract source of truth.
