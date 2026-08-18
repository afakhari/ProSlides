# Go backend foundation

This is the new ProSlides Go modular monolith. It provides process liveness,
dependency readiness, and version endpoints. PostgreSQL uses `pgxpool`; Redis
uses `go-redis`. Domain features are not implemented yet.

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

## Authentication status

The API contains contract-defined register, login, logout, and current-user
routes using opaque server-side sessions and CSRF cookies. The Compose-backed
end-to-end auth matrix has passed.

Run `powershell -ExecutionPolicy Bypass -File scripts/test-auth-integration.ps1`
from the repository root to execute the matrix. Use `-SkipComposeStartup` only
for an already-running local stack and `-StopAfter` only when it is safe to stop it.
