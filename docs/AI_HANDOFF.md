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

Latest completed local verification (2026-08-18): Go format/tests/vet, web
lint, 12 web unit tests, web production build, Compose syntax, `git diff
--check`, API image build, and a real Compose call to `/healthz` and `/readyz`
all passed.

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

## Exact next implementation: identity boundary

### Objective

Create the first domain boundary: identity and authentication. It must be
contract-first, durable in PostgreSQL, and independent from quiz/live modules.

### Current progress

`migrations/0002_identity_sessions.sql` creates opaque server-side sessions and
a case-insensitive email uniqueness index. `SESSION_TTL` is configured with a
default of `168h`. The OpenAPI contract and HTTP handlers define register,
login, logout, and current-user behavior.

The identity core validates/normalizes registration data, hashes passwords with
bcrypt, and generates opaque session/CSRF values while retaining only their
SHA-256 hashes for persistence. The PostgreSQL store and register/login/logout/
me handlers are wired into the API composition root.

Authentication is implemented and verified. `scripts/test-auth-integration.ps1`
successfully started Compose through normal startup and covered successful
register/login/`me`, duplicate email, invalid credentials, missing and invalid
CSRF, successful logout, and revoked-session rejection. Registration returns
the contract-required `201 Created`.

### Scope

1. Add an OpenAPI design for account registration/sign-in/sign-out/current-user
   behavior, status/error responses, and cookie/session security requirements.
2. Add an `internal/identity` module with domain/application/repository layers.
3. Add forward-only PostgreSQL migrations for users and opaque server-side
   sessions. Email must be unique case-insensitively; store only password hashes,
   never plaintext passwords or bearer tokens in the database.
4. Use secure cookie sessions; require CSRF protection for mutating endpoints.
   Do not place long-lived tokens in SSE URLs.
5. Add unit tests for validation, duplicate-email behavior, password hashing,
   session lifecycle, and authorization boundary behavior.

### Out of scope

No quiz/content CRUD, SSE endpoint, WebSocket migration, live state machine,
message queue, UI rewrite, database reset, or destructive Compose operation.

### Definition of done

- Contract, migration, API behavior, tests, `AGENTS.md`, and this handoff agree.
- Secrets and credentials are absent from logs and responses.
- The implementation is committed and pushed on the feature branch with CI
  result reported.

### Current exact next task

`GET /api/v1/presentations/{presentationId}` is implemented as the first
`presentations` slice. It authenticates via the opaque session cookie, enforces
ownership in the PostgreSQL query, returns slides by ascending position, and
uses 404 for absent or unauthorized resources. Unit behavior tests cover missing
sessions, owner-scoped success, and the non-disclosing 404 path.

The Compose auth matrix now also inserts a presentation with ordered slides,
verifies the owner read, and verifies a second authenticated user receives 404.
`0003_presentations.sql` is an embedded, forward-only migration that creates
the required durable schema on normal API startup.

Define the OpenAPI contract for creating a presentation. Require the current
authenticated user as owner and CSRF protection; do not implement it, add a web
client, or begin live/SSE behavior until that contract is reviewed.

`POST /api/v1/presentations` is now implemented and verified end to end. It
requires the session and CSRF header, creates an empty owner-scoped presentation,
and returns 201. Next, complete the slide-create vertical slice with the same
contract-to-Compose workflow; do not begin live/SSE behavior.

`POST /api/v1/presentations/{presentationId}/slides` is implemented and verified
end to end. It accepts a non-negative position, a generic kind, and JSON content;
it requires the owner session plus CSRF, and returns 404 for absent or non-owned
presentations. The Compose flow creates a presentation, creates a slide, and
reads it back. Next, define the first question-slide contract before implementation.

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
