# AI execution handoff

This document removes ambiguity for the next developer or AI agent. Read it
after `AGENTS.md`. If it disagrees with code, inspect the code first and update
both documents as part of the same change.

## Mission

Build ProSlides as a Go modular monolith with PostgreSQL, Redis, HTTP commands,
and SSE delivery. Preserve the existing React product while replacing its
legacy Django/Rust/WebSocket boundary. Active product/API behavior now has Go
coverage, but production certification and the measured 10k capacity target are
not complete. Never describe a design target as benchmark evidence.

## Current objective and status at a glance

- Branch purpose: isolated Go migration; `master` remains untouched legacy work.
- Overall migration estimate: about 85%; this is a roadmap estimate, not a
  code-coverage calculation.
- Implemented: Go/Compose foundation, cookie identity, owner-scoped dashboard
  and presentation/editor CRUD, settings, duplication/results management,
  hashed one-time password-reset tokens with SMTP delivery, optional hashed
  email OTP verification, signed Google ID-token verification, Redis-backed
  auth rate limits, content/question creation, live state
  machine, join, idempotent answers,
  replaceable scoring, aggregate scores, role-scoped snapshots, manager-only
  keyset-paginated roster/leaderboard, durable events, typed React HTTP/SSE,
  snapshot-first recovery, public live-session join-code resolution, and
  owner-only keyset-paginated per-question results derived from Go answers.
- High-load improvements in this stage: one event-ledger poller per active
  session/API process, bounded subscriber buffers, slow-client disconnect and
  replay, presence compaction, snapshot cursor, and indexed participant scores.
- Deployment foundation: full-stack local Compose, production API/web images,
  same-origin Nginx with SSE buffering disabled, health checks, a loopback-bound
  production Compose reference, trusted-proxy-aware limits, serialized
  transactional startup migrations, and local/deploy/operations runbooks.
- Not implemented: production SMTP/Google secret provisioning, telemetry, Redis
  wake-up fan-out/presence TTL, join/answer rate limiting, media object storage,
  k6 proof, real production certificate/ingress and backup/restore validation,
  cutover, or rollback exercise.
- Capacity truth: architecture has a credible horizontal path, but 1k/5k/10k
  has not been measured. Use `docs/capacity-plan.md` as the only proof protocol.
- Exact next task: bounded telemetry and the documented 100-user k6 smoke run.
- Canonical parity and deployment references: `docs/migration-status.md` and
  `docs/configuration.md`.

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
| npm | v11.6.2 | full development tree reports 1 high-severity advisory; `npm audit --omit=dev` reports zero production vulnerabilities, so remediation belongs to a separately reviewed tooling update |
| Go | 1.26.6 installed at `C:\Program Files\Go\bin\go.exe`; its PATH was not visible to the previous shell | invoke via absolute path or refresh PATH before `go` commands |
| Docker CLI/Desktop | installed and daemon available | API image and real Compose health/readiness checks passed; use Docker Hub base images because `gcr.io` returned 403 in this environment |
| Chrome | 151 at `C:\Program Files\Google\Chrome\Application\chrome.exe` | Playwright launches this system browser through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; the Playwright CDN returned a location-based 403 |
| Python | 3.13.15 installed user-scoped | runs official Codex skill helper scripts; the incomplete `C:\Python314` installation cannot import `encodings` |
| Codex skills | official `security-best-practices`, `playwright`, `gh-fix-ci`, and `yeet` installed personally | available from the next Codex turn; they are developer tooling, not repository/runtime dependencies |
| GitHub CLI / Actions | `gh` 2.97.0; Actions run Go/web checks, both Compose validations, and API/web image builds | `gh auth status` currently reports an invalid default token and must be repaired before `gh-fix-ci` or `yeet`; normal Git credential-manager pushes still work |
| C compiler | `gcc` is not installed | Go `-race` cannot run locally; CI runs the live-module race detector on Linux instead |

Do not install a second Go version. Use the version declared by `apps/api/go.mod`.
Do not run a broad `npm audit fix`; investigate updates as a dedicated,
compatibility-tested change.

Latest pushed revision (`d118d4b`, 2026-08-19) adds the system-Chrome browser
smoke coverage and local runtime fixes. The earlier parity revision (`8ae78d9`)
passed Go tests/vet, SMTP and Google
adapter tests, OpenAPI parsing, web lint/typecheck/unit/build passed; the API
image rebuilt; and the real Compose matrix passed identity,
owner presentation list/create/update/delete/duplicate, settings, atomic slide insert/replace/reorder,
content/question creation, live commands, idempotent join/answer, role-scoped
snapshots, participant non-disclosure, manager-only multi-page roster and score
ordering, owner-only per-question option counts/leaderboard, aggregate-only leaderboard events, 16 concurrent joins, and
`Last-Event-ID` SSE replay. It also verified join-code resolution and removal
of question correctness metadata from participant snapshots. Web lint,
TypeScript checking, 23 web unit tests, and the production
build also passed; the generated sitemap timestamp was restored because it was
unrelated to this change. Browser automation could not run because no in-app or
extension browser was connected. Revision `d118d4b` adds three system-Chrome
Playwright smoke flows and verifies registration/login/logout, presentation and
slide creation, report/history navigation, responsive auth, and invalid join
codes. The refreshed lockfile reports one remaining development-only
high-severity npm advisory and zero production advisories. Both GitHub
Actions workflows passed for `8ae78d9`; CI status for `d118d4b` was not queried
because the local `gh` authentication is invalid.

Deployment hardening verification (2026-08-23): Go tests and vet; web lint,
typecheck, 23 unit tests, production build, and three system-Chrome Playwright
flows passed. Local and production Compose contracts parsed, both OCI images
built, Nginx syntax passed, the full four-service stack became healthy on
loopback, SPA fallback/API proxy/security/cache headers passed, and the complete
Compose integration matrix passed. Existing PostgreSQL/Redis volumes were
preserved; no destructive reset was run. The container build reports one
remaining high-severity development-tool advisory for a separate
compatibility-reviewed fix; `npm audit --omit=dev` reports zero production
vulnerabilities.

## Installed Codex workflow prerequisites

- `security-best-practices` is explicit-request-only and must load the matching
  Go and React/JavaScript guidance before a security report or fix.
- `playwright` is CLI-first for interactive browser automation, requires `npx`,
  and writes disposable artifacts to ignored `output/playwright/`. The checked-in
  `@playwright/test` suite remains the regression-test path when tests are requested.
- `gh-fix-ci` inspects GitHub Actions failures and requires an approved plan
  before code changes. It requires authenticated `gh` repository/workflow access.
- `yeet` is reserved for explicit stage+commit+push+PR requests, reuses an
  existing PR, and preserves that PR's draft/review state. It also requires
  authenticated `gh` access.

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

Redis wake-up fan-out/presence TTL, join/answer rate limiting, telemetry,
immutable report exports, media object storage, load tests, event retention, and
real production ingress/certificate validation are not implemented. No database reset or volume
deletion was performed.

### Definition of done

- OpenAPI names every live route and event envelope/payload.
- Forward-only migrations apply during normal startup under one cross-replica
  PostgreSQL advisory lock; every file and ledger row commit transactionally.
- Go tests and the real Compose matrix pass.
- `AGENTS.md`, API README, and this handoff describe the same implementation.

### Legacy parity decisions

The remaining Django product behavior is represented by Go or deliberately
replaced at the architecture boundary:

| Legacy behavior | Go behavior |
|---|---|
| JWT login/refresh/logout | opaque PostgreSQL session + CSRF cookies; no browser token storage |
| email verification/reset | hashed one-time OTP/reset records, expiry/attempt controls, SMTP TLS/SSL adapter |
| Google login | RS256/JWKS signature, issuer, audience, expiry, and verified-email validation |
| persistent quiz access code | generated code for the current non-ended live session |
| Rust result ingestion and duplicate score ledger | durable Go answers are the single source for option counts and per-question results |
| Django slide insertion/order side effects | atomic zero-based insert/move/compact operations |
| full quiz export used by the old runtime | bounded presentation definition plus role-scoped live snapshot and paginated result queries |

Django admin is an operational framework UI, not a product API, and is not
recreated. Actual provider values (`SMTP_*`, `PUBLIC_WEB_URL`,
`EMAIL_VERIFICATION_PEPPER`,
`GOOGLE_CLIENT_ID`) must be supplied through deployment secret/config storage;
none belong in Git. Next, implement bounded telemetry and run the 100-user k6
smoke gate before the documented 1k/5k/10k sequence.

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
npm run typecheck
npm run test:unit
npm run build
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run test:e2e
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
