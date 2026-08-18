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
| Docker CLI | installed | Docker daemon was not running, so container build/integration tests were not executed |
| GitHub Actions | configured in `.github/workflows/ci.yml` | must run Go and web verification on pushed changes |

Do not install a second Go version. Use the version declared by `apps/api/go.mod`.
Do not run a broad `npm audit fix`; investigate updates as a dedicated,
compatibility-tested change.

Latest completed local verification (2026-08-18): Go format/tests, web lint,
12 web unit tests, web production build, Compose syntax, and `git diff --check`
all passed. Docker runtime checks remain unverified only because the local
Docker daemon is not running.

## Exact next implementation: dependency adapters and readiness

### Objective

Replace bootstrap-only readiness with truthful health of configured PostgreSQL
and Redis dependencies. This is the prerequisite for any domain feature.

### Scope

1. Add `apps/api/internal/platform/postgres` and
   `apps/api/internal/platform/redis` adapters. Prefer stable, idiomatic Go
   clients and keep their interfaces narrow.
2. Extend config validation only for values already present in
   `apps/api/.env.example` / Compose. Do not add a new environment variable
   unless it has a real operational need; document every addition.
3. Construct adapters in `cmd/api/main.go`, inject a readiness dependency into
   the HTTP router, and close resources during graceful shutdown.
4. Keep `GET /healthz` process-only: 200 if the server can serve requests.
5. Make `GET /readyz` test all configured required dependencies with bounded
   request contexts. Return 200 only when both are reachable; otherwise return
   503 with a safe, structured dependency-status body. Never expose connection
   strings, credentials, hostnames, or raw driver errors.
6. Add unit tests for success, failure, timeout/cancellation mapping, and route
   status/body. Add an integration test only if it can be isolated and skipped
   clearly when Docker is unavailable.
7. Update `apps/api/openapi/openapi.yaml`, `apps/api/README.md`, `AGENTS.md`,
   and this document to record the final route behavior and tests.

### Out of scope

- No login/auth, quiz/content CRUD, SSE endpoint, WebSocket migration, live
  state machine, schema redesign, message queue, or UI rewrite.
- No change to existing PostgreSQL data volume and no destructive Compose
  command.

### Definition of done

- `healthz` remains independent from dependencies.
- `readyz` is 200 only when PostgreSQL and Redis checks pass and is 503 for
  each dependency-failure scenario.
- Dependency checks use timeouts and do not leak secrets or raw internals.
- Tests demonstrate all above behavior and pass locally or their exact blocker
  is reported.
- OpenAPI, API README, `AGENTS.md`, and this document agree with code.
- The change is committed on the feature branch, pushed, and CI status is
  reported.

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
