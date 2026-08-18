# Go backend foundation

This is the new ProSlides Go modular monolith. It is intentionally a small,
standard-library bootstrap: it exposes health/readiness/version endpoints but
does not yet connect to PostgreSQL or Redis.

## Start with Docker Compose

From the repository root:

```sh
docker compose --env-file backend-go/.env.example up --build
```

Then request `http://localhost:8080/healthz`.

## Local development

Install the Go version declared in `go.mod`, copy `.env.example` to `.env`, then:

```sh
go test ./...
go run ./cmd/api
```

The next implementation task is wiring PostgreSQL and Redis adapters, including
real readiness probes, before any domain endpoint is added.
