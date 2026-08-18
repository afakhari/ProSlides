# ADR 0001: Go modular monolith with SSE

## Status

Accepted — 2026-08-18

## Context

The legacy system combines Django, Rust WebSockets, SQLite, and Redis. The new
product targets large live sessions and needs one primary backend language and a
clear growth path.

## Decision

Build the new platform as a Go modular monolith with PostgreSQL and Redis.
Use REST/HTTP POST for client commands and SSE for server-to-client events.

## Consequences

- PostgreSQL owns durable content, answers, scores, and reports.
- Redis is not a durable source of truth.
- Django/Rust remain only in Git history and the existing `master` branch.
- No broker, microservice, or Kubernetes deployment is introduced before a
  measured scaling need requires it.
