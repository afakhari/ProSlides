# ProSlides

ProSlides is a capacity-oriented interactive presentation platform for quizzes,
polls, word clouds, Q&A, live sessions, scoring, and reports.

## Architecture

```text
apps/web  → React + TypeScript + Vite
apps/api  → Go modular monolith + REST + SSE
             ↓
        PostgreSQL + Redis
```

The backend uses HTTP POST for commands and Server-Sent Events for live
server-to-client updates. PostgreSQL is the durable source of truth. Redis
currently provides readiness and distributed identity rate limits; future live
fan-out/presence acceleration must remain ephemeral.

## Repository layout

- `apps/api` — Go API, SQL migrations, and OpenAPI contract.
- `apps/web` — React client using the Go cookie API and snapshot-first SSE.
- `docs` — architecture and architectural decisions.
- `AGENTS.md` — mandatory development context and update protocol.

## Local stack

Install Docker Desktop and run:

```powershell
docker compose --env-file apps/api/.env.example up --build
```

The API health endpoint is `http://localhost:8080/healthz`. Readiness is
`http://localhost:8080/readyz` and requires PostgreSQL and Redis.

For direct Go development, install the version declared in `apps/api/go.mod`,
then run `go test ./...` from `apps/api`.

## Development rules

Read [AGENTS.md](AGENTS.md) before making a change. API and SSE contract changes
start in `apps/api/openapi/openapi.yaml`; after every material change, update
both [AGENTS.md](AGENTS.md) and [the AI execution handoff](docs/AI_HANDOFF.md).
The handoff document defines the exact next task, verification commands, and
completion criteria. See [migration status](docs/migration-status.md) for the
Django/Rust parity matrix and [configuration](docs/configuration.md) for all
runtime settings.
