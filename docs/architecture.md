# Architecture

## Current target

ProSlides is a Go modular monolith with a React client. The design is optimized
for high-participant live sessions without early operational complexity.

## Boundaries

- `identity`: accounts, sessions, authorization.
- `quizzes`: presentations, slides, questions, options.
- `live`: session state machine, commands, scoring, presence, SSE delivery.
- `reports`: immutable post-session projections and exports.
- `media`: object-storage metadata and access policy.
- `platform`: HTTP, database, Redis, telemetry, configuration.

Dependencies flow inward: transport handlers call application services; services
call domain and repository interfaces; adapters live in `platform` or the owning
module. No domain package may import HTTP or Redis packages.

## Realtime

Clients issue idempotent HTTP commands. The server publishes named SSE events.
Every event includes a session state version. A reconnect obtains a snapshot and
only applies newer events. High-frequency answer statistics are aggregated before
broadcasting.

## Data

PostgreSQL is the durable source of truth. Redis supports local fan-out across
API instances, presence TTLs, rate limits, and cache. Redis loss must never create
or destroy a durable answer or score.
