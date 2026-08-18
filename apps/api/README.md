# Go backend foundation

This is the ProSlides Go modular monolith. It provides identity, owner-scoped
presentation/slide/question APIs, durable live sessions, idempotent answers,
pluggable scoring, role-scoped snapshots, manager-paginated rosters, and SSE
replay. PostgreSQL uses
`pgxpool` and is authoritative; Redis uses `go-redis` and is currently limited
to readiness rather than durable live state.

## Start with Docker Compose

From the repository root:

```sh
docker compose --env-file apps/api/.env.example up --build
```

Then request:

- `GET http://localhost:8080/healthz` returns process liveness only.
- `GET http://localhost:8080/readyz` returns `200` only when PostgreSQL and
  Redis are reachable; it returns `503` with safe dependency statuses when
  either is unavailable.

## Local development

Install the Go version declared in `go.mod`, copy `.env.example` to `.env`, then:

```sh
go test ./...
go run ./cmd/api
```

`DATABASE_URL` and `REDIS_URL` are required in every environment.
`DEPENDENCY_CHECK_TIMEOUT` is a positive Go duration (default `2s`) that bounds
each readiness check. Never place real credentials in `.env.example` or Git.

API contract changes begin in `openapi/openapi.yaml`. See the repository root
`AGENTS.md` and `docs/AI_HANDOFF.md` before changing code.

## Implemented API status

Authentication uses opaque server-side sessions and CSRF cookies. Live manager
commands use HTTP and state versions; participants receive a scoped HttpOnly
cookie. The SSE endpoint supports durable `Last-Event-ID` replay and sends
aggregate answer/leaderboard notifications rather than one event per answer or
one full-roster event. Multiple choice scoring is behind `ScoringPolicy`; the
current deduction policy supports partial credit and can be replaced later.
Aggregate-only leaderboard notifications use schema version 2; retained legacy
arrays are sanitized to counts during replay without modifying ledger history.

Participant snapshots expose public session state, active slide, the caller's
participant/score, aggregate participant count, and `last_event_id`; they never
include the complete roster, score map, or question correctness metadata.
`GET /api/v1/live/sessions/resolve?join_code=...` maps the public presenter code
to the current non-ended Go live session without exposing manager fields.
Manager snapshots are also bounded.
Managers use `GET /api/v1/live/sessions/{sessionId}/roster` with a maximum
`limit` of 100, opaque keyset cursors, and stable `joined` or `score` ordering.

Event delivery uses one bounded process-local broker per active session rather
than polling PostgreSQL from every SSE connection. Slow subscribers are closed
and recover from the durable ledger. Snapshots return `last_event_id`, presence
bursts are compacted, and participant scores are maintained atomically for
indexed snapshot/leaderboard reads. This removes known immediate bottlenecks but
does not certify the 10k target; see `docs/capacity-plan.md` for the required
workload and pass/fail gates.

Run `powershell -ExecutionPolicy Bypass -File scripts/test-auth-integration.ps1`
from the repository root to execute the identity, content, live, scoring,
role-scoped snapshot, paginated roster, and SSE replay matrix. Use
`-SkipComposeStartup` only for an
already-running local stack and `-StopAfter` only when it is safe to stop it.
