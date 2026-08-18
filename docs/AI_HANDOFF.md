# AI execution handoff

This document removes ambiguity for the next developer or AI agent. Read it
after `AGENTS.md`. If it disagrees with code, inspect the code first and update
both documents as part of the same change.

## Mission

Build ProSlides as a Go modular monolith with PostgreSQL, Redis, HTTP commands,
and SSE delivery. The present foundation is intentionally minimal: it is not a
working quiz system yet. Do not represent placeholders as production behavior.

## Branch and collaboration boundary

- Work only in `D:\software proj\ProSlides-go-platform` on
  `feat/go-platform-foundation` unless the owner directs otherwise.
- `D:\software proj\ProSlides` / `master` is the colleagues' legacy workspace.
  Never modify, rebase, reset, or clean it as part of this project.
- Commit focused changes to the feature branch and push normally. Do not merge
  to `master`, force-push, or open a production deployment without approval.

## Confirmed environment facts

| Tool | Status | Use |
|---|---|---|
| Node | v24.11.1 | web lint, tests, build |
| npm | v11.6.2 | web dependencies/scripts; current `npm ci` reports 20 vulnerabilities (2 low, 4 moderate, 14 high) requiring a separately reviewed update |
| Go | 1.26.6 installed at `C:\Program Files\Go\bin\go.exe`; its PATH was not visible to the previous shell | invoke via absolute path or refresh PATH before `go` commands |
| Docker CLI/Desktop | installed and daemon available | API image and real Compose health/readiness checks passed; use Docker Hub base images because `gcr.io` returned 403 in this environment |
| GitHub Actions | configured in `.github/workflows/ci.yml` | must run Go and web verification on pushed changes |

Do not install a second Go version. Use the version declared by `apps/api/go.mod`.
Do not run a broad `npm audit fix`; investigate updates as a dedicated,
compatibility-tested change.

Latest completed local verification (2026-08-18): Go formatting and all API
tests passed; the API image rebuilt; and the real Compose matrix passed identity,
content/question creation, live commands, idempotent join/answer, scoring,
snapshot, aggregate event delivery, and `Last-Event-ID` SSE replay. Web lint,
12 web unit tests, and the production build last passed before this backend-only
slice and were not affected.

## Completed implementation: dependency adapters and readiness

### Objective

Bootstrap readiness has been replaced by truthful health of configured
PostgreSQL and Redis dependencies. This was the prerequisite for domain work.

### Scope

1. `pgxpool` and `go-redis` clients live behind narrow `Dependency` interfaces.
2. `DATABASE_URL` and `REDIS_URL` are required; `DEPENDENCY_CHECK_TIMEOUT`
   (default `2s`) bounds each ping and is documented in Compose and `.env.example`.
3. `cmd/api` owns lifecycle and graceful closure of both clients.
4. `GET /healthz` remains process-only and returns 200.
5. `GET /readyz` returns 200 only when PostgreSQL and Redis pings succeed; it
   returns 503 otherwise, with only `ok` or `unavailable` dependency states.
6. Route tests cover success, each dependency failure, missing configuration,
   timeout behavior, and secret-error non-disclosure. Configuration tests cover
   missing URLs and invalid timeout values.
7. OpenAPI and API README now document this behavior.

### Verification note

The real local Compose stack was verified with PostgreSQL and Redis. It creates
named local volumes; use ordinary `docker compose down` after a test to preserve
them. `down -v` remains destructive and requires owner authorization.

## Completed implementation: durable live backend vertical slice

### Objective

Provide a complete PostgreSQL-backed live path from session creation through
answers, scoring, snapshots, leaderboard publication, and SSE recovery without
introducing WebSockets or treating Redis as durable storage.

### Current progress

`internal/live` owns the state machine, HTTP use cases, PostgreSQL adapter,
event ledger, and a `ScoringPolicy` boundary. The current `DeductionPolicy`
scores multiple-choice partial answers as
`max(0, correct selections - incorrect selections) / correct option count`,
then applies the configured maximum and optional server-timed range. Exact-match
mode remains available when partial scoring is disabled, and another policy can
replace this implementation without changing HTTP or storage code.

Migrations `0004` through `0006` add durable sessions, participants, answers,
idempotent command results, participant credential hashes, and versioned event
replay. Answer transactions use shared session locks: concurrent answers do not
serialize against one another, while closing a question cannot race past an
in-flight accepted answer. PostgreSQL remains authoritative; Redis fan-out has
not yet been added.

### Scope

1. Manager commands use authenticated HTTP plus CSRF and optimistic
   `expected_state_version`; duplicate `request_id` values return the stored
   original result.
2. Participants join with an HttpOnly scoped cookie and submit at most one
   answer per question; retries return the original score without double count.
3. Answers are accepted only for the active question while server `ends_at` is
   still in the future.
4. Snapshot is authoritative. SSE replays the PostgreSQL event ledger after
   `Last-Event-ID`, emits heartbeats, and disables proxy buffering.
5. `answer.stats` is aggregated at question close and `leaderboard.updated` at
   leaderboard display; no per-answer SSE event is published.

### Out of scope

The React client still uses the legacy boundary and is not migrated in this
slice. Redis fan-out/presence, rate limiting, reports, media, load tests, and
production proxy tuning are also not implemented. No database reset or volume
deletion was performed.

### Definition of done

- OpenAPI names every live route and event envelope/payload.
- Forward-only migrations apply during normal startup.
- Go tests and the real Compose matrix pass.
- `AGENTS.md`, API README, and this handoff describe the same implementation.

### Current exact next task

Build a typed React API/SSE client for the implemented live contract and replace
the first legacy WebSocket-backed audience/manager flow. Recovery must fetch the
snapshot and reconnect with `Last-Event-ID`; commands must decide success from
their HTTP response rather than waiting for an SSE echo. Preserve the existing
visual UI and do not add Redis fan-out until this single-node client flow passes.

## Commands and verification matrix

Run from repository root unless indicated otherwise.

```powershell
# Always first
git status --short --branch

# API formatting and tests (current shell may not have Go on PATH)
Push-Location apps/api
& 'C:\Program Files\Go\bin\go.exe' fmt ./...
& 'C:\Program Files\Go\bin\go.exe' test ./...
Pop-Location

# Web checks
Push-Location apps/web
npm ci
npm run lint
npm run test:unit
npm run build
Pop-Location

# Compose syntax; does not require daemon
docker compose --env-file apps/api/.env.example config

# Diff hygiene
git diff --check
```

If Docker Desktop is running, additionally execute the stack and verify both
endpoint classes:

```powershell
docker compose --env-file apps/api/.env.example up --build -d
Invoke-RestMethod http://localhost:8080/healthz
Invoke-RestMethod http://localhost:8080/readyz
docker compose --env-file apps/api/.env.example down
```

`down -v`, `docker volume rm`, database resets, and Redis purges require owner
authorization because they destroy local data.

## Contract rules

1. OpenAPI is edited first for any externally observable route or event.
2. Command payloads include `request_id`; manager mutations include
   `expected_state_version`.
3. Every SSE event has a stable name and the standard metadata described in
   `AGENTS.md`; clients discard stale state versions.
4. A reconnection uses `Last-Event-ID` and snapshot recovery; Redis Pub/Sub is
   not an event ledger.
5. Return a documented status for validation, authentication, conflict,
   idempotency, rate-limit, and dependency errors.

## Documentation update protocol

For every material change, update both documents in the same commit:

- `AGENTS.md`: actual current-state table, checked phase item, single next task,
  risks/prerequisites, and dated change-log row.
- `docs/AI_HANDOFF.md`: replace the exact-next-task section, environment facts
  if changed, definition of done, and commands if changed.

Use precise completion language: say `implemented and verified`, `implemented
but not locally verified because <specific reason>`, or `not implemented`. Do
not say `done` for code that only has a placeholder.

## Final handoff template

Use this exact compact structure after a material task:

```text
Delivered: <observable behavior and primary files>
Verified: <commands and outcomes>
Not verified: <specific command + specific external blocker, or “none”>
Documentation: AGENTS.md and docs/AI_HANDOFF.md updated
Git: <branch>, <commit>, <pushed/not pushed>
Next: <exactly one small, ordered task>
```
