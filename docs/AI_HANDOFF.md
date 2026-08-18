# AI execution handoff

This document removes ambiguity for the next developer or AI agent. Read it
after `AGENTS.md`. If it disagrees with code, inspect the code first and update
both documents as part of the same change.

## Mission

Build ProSlides as a Go modular monolith with PostgreSQL, Redis, HTTP commands,
and SSE delivery. Preserve the existing React product while replacing its
legacy Django/Rust/WebSocket boundary. The backend now has a functional live
quiz vertical slice, but production parity and the measured 10k capacity target
are not complete. Never describe a design target as benchmark evidence.

## Current objective and status at a glance

- Branch purpose: isolated Go migration; `master` remains untouched legacy work.
- Overall migration estimate: about 70%; this is a roadmap estimate, not a
  code-coverage calculation.
- Implemented: Go/Compose foundation, cookie identity, owner-scoped dashboard
  and presentation/editor CRUD, settings, duplication/results management,
  hashed one-time password-reset tokens, content/question creation, live state
  machine, join, idempotent answers,
  replaceable scoring, aggregate scores, role-scoped snapshots, manager-only
  keyset-paginated roster/leaderboard, durable events, typed React HTTP/SSE,
  snapshot-first recovery, and public live-session join-code resolution.
- High-load improvements in this stage: one event-ledger poller per active
  session/API process, bounded subscriber buffers, slow-client disconnect and
  replay, presence compaction, snapshot cursor, and indexed participant scores.
- Not implemented: approved outbound password-reset delivery, Go-side Google
  token verification/email verification, rate limiting, telemetry, Redis
  wake-up fan-out/presence TTL, media upload,
  k6 proof, production proxy/security hardening, cutover, or rollback exercise.
- Capacity truth: architecture has a credible horizontal path, but 1k/5k/10k
  has not been measured. Use `docs/capacity-plan.md` as the only proof protocol.
- Exact next task: approved external identity-provider wiring, defined later in this document.

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
| C compiler | `gcc` is not installed | Go `-race` cannot run locally; CI runs the live-module race detector on Linux instead |

Do not install a second Go version. Use the version declared by `apps/api/go.mod`.
Do not run a broad `npm audit fix`; investigate updates as a dedicated,
compatibility-tested change.

Latest completed local verification (2026-08-19): Go formatting and all API
tests passed; the API image rebuilt; and the real Compose matrix passed identity,
owner presentation list/create/update/delete/duplicate, settings, slide replace/reorder,
content/question creation, live commands, idempotent join/answer, role-scoped
snapshots, participant non-disclosure, manager-only multi-page roster and score
ordering, aggregate-only leaderboard events, 16 concurrent joins, and
`Last-Event-ID` SSE replay. It also verified join-code resolution and removal
of question correctness metadata from participant snapshots. Web lint,
TypeScript checking, 23 web unit tests, and the production
build also passed; the generated sitemap timestamp was restored because it was
unrelated to this change. Browser automation could not run because no in-app or
extension browser was connected. `npm ci` still reports the already-known 20
vulnerabilities. GitHub CI must confirm the pushed revision.

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

Migrations `0004` through `0009` add durable sessions, participants, answers,
idempotent command results, participant credential hashes, versioned event
replay, atomic participant score projections, and hot-path indexes. Migration
`0008` removes an attempted session-row presence counter so concurrent joins do
not serialize on a hot counter; snapshots compute the exact indexed count and
presence events carry compactable deltas. Answer transactions use shared session locks: concurrent answers do not
serialize against one another, while closing a question cannot race past an
in-flight accepted answer. PostgreSQL remains authoritative.

Migration `0009` adds the `(session_id, joined_at, id)` index used by stable
joined-order keyset pagination. Participant snapshots are built in a read-only
`REPEATABLE READ` transaction and contain only public session fields, the
caller participant and score, aggregate count, active slide, and
`last_event_id`. Manager snapshots remain bounded; roster and leaderboard rows
come from `GET /api/v1/live/sessions/{sessionId}/roster` with `limit <= 100`, an
opaque order-bound cursor, and deterministic `joined` or `score` ordering.
New aggregate-only `leaderboard.updated` events use schema version 2. Historical
version-1 leaderboard arrays remain untouched in PostgreSQL but are reduced to
`participant_count` by the adapter before any replay or fan-out.

`EventBroker` replaces per-connection database polling with one poller per
active session per API process. Each SSE subscriber has a bounded buffer; a slow
subscriber is disconnected and recovers from PostgreSQL using snapshot plus
`Last-Event-ID`. Consecutive `presence.updated` events are compacted before
fan-out. Snapshot returns `last_event_id`, so a normal client applies the
authoritative state first and avoids replaying old presence bursts.

### Scope

1. Manager commands use authenticated HTTP plus CSRF and optimistic
   `expected_state_version`; duplicate `request_id` values return the stored
   original result.
2. Participants join with an HttpOnly scoped cookie and submit at most one
   answer per question; retries return the original score without double count.
3. Answers are accepted only for the active question while server `ends_at` is
   still in the future.
4. Snapshot is authoritative and exposes `last_event_id`. SSE replays the
   PostgreSQL ledger, switches to bounded shared fan-out, emits heartbeats, and
   disables proxy buffering.
5. `answer.stats` is aggregated at question close and `leaderboard.updated` is
   an aggregate count notification; no per-answer or full-roster SSE event is
   published.

### Out of scope

Redis wake-up fan-out/presence TTL, rate limiting, telemetry, reports, media,
load tests, event retention, and
production proxy tuning are not implemented. No database reset or volume
deletion was performed.

### Definition of done

- OpenAPI names every live route and event envelope/payload.
- Forward-only migrations apply during normal startup.
- Go tests and the real Compose matrix pass.
- `AGENTS.md`, API README, and this handoff describe the same implementation.

### Current exact next task

Complete the external identity-provider boundary after provider configuration
is explicitly supplied and approved.

Contract and acceptance criteria:

1. Wire a production mail adapter to the existing password-reset service; keep
   tokens hashed, one-time, expiring, and never logged.
2. Verify Google ID tokens server-side against the configured audience before
   issuing the same HttpOnly session/CSRF cookies used by password login.
3. Preserve the existing auth-page layout, animation, OTP states, responsive
   behavior, and recovery UX; only its transport/state integration may change.
4. Keep unknown-email responses non-disclosing and revoke every account session
   after a successful password reset.
5. Add provider-adapter tests and run the full Go/Compose/web/browser matrix.

Required owner inputs are the approved SMTP/provider settings, public reset
base URL, and Google OAuth client ID. Secrets belong in environment/secret
storage, never in Git or chat. After this task, return to bounded telemetry and
the documented 100-user k6 smoke scenario; do not run 1k/5k/10k yet.

## Commands and verification matrix

Run from repository root unless indicated otherwise.

```powershell
# Always first
git status --short --branch

# API formatting and tests (current shell may not have Go on PATH)
Push-Location apps/api
& 'C:\Program Files\Go\bin\go.exe' fmt ./...
& 'C:\Program Files\Go\bin\go.exe' test ./...
& 'C:\Program Files\Go\bin\go.exe' vet ./...
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
powershell -ExecutionPolicy Bypass -File .\scripts\test-auth-integration.ps1 -SkipComposeStartup
docker compose --env-file apps/api/.env.example down
```

`down -v`, `docker volume rm`, database resets, and Redis purges require owner
authorization because they destroy local data.

## Contract rules

1. OpenAPI is edited first for any externally observable route or event.
2. Command payloads include `request_id`; manager mutations include
   `expected_state_version`.
3. Every SSE event has a stable name and the standard metadata described in
   `AGENTS.md`; `event_id` orders delivery, while `state_version` prevents state
   regressions. Equal state versions are valid for aggregate events.
4. A reconnection uses `Last-Event-ID` and snapshot recovery; Redis Pub/Sub is
   not an event ledger.
5. Return a documented status for validation, authentication, conflict,
   idempotency, rate-limit, and dependency errors.
6. A snapshot is applied before opening SSE; pass snapshot `last_event_id` in
   `Last-Event-ID`. Treat the snapshot as truth and discard stale event versions.
7. Do not introduce one poll/query/goroutine with unbounded memory per event or
   participant. Per-connection goroutines are acceptable for Go SSE only with
   bounded buffers and measured resource use.

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
