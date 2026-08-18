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
server-to-client updates. PostgreSQL is the durable source of truth; Redis is
used only for ephemeral realtime delivery, presence, and rate limits.

## Repository layout

- `apps/api` — Go API, SQL migrations, and OpenAPI contract.
- `apps/web` — React client; its legacy WebSocket implementation is retained
  temporarily as UI migration input.
- `docs` — architecture and architectural decisions.
- `AGENTS.md` — mandatory development context and update protocol.

## Local stack

Install Docker Desktop and run:

```powershell
docker compose --env-file apps/api/.env.example up --build
```

The API health endpoint is `http://localhost:8080/healthz`.

For direct Go development, install the version declared in `apps/api/go.mod`,
then run `go test ./...` from `apps/api`.

## Development rules

Read [AGENTS.md](AGENTS.md) before making a change. API and SSE contract changes
start in `apps/api/openapi/openapi.yaml`; after every material change, update
`AGENTS.md`.
