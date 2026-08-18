# ADR 0002: Durable event replay with bounded process-local SSE fan-out

## Status

Accepted - 2026-08-18

## Context

Polling PostgreSQL independently from every SSE connection produces query load
proportional to participant count. At 10,000 connections and a 500 ms interval,
one session would generate about 20,000 event-ledger queries per second before
useful product traffic. Broadcasting every join or answer independently also
creates quadratic work and unbounded risk for slow clients.

## Decision

- Keep `live_events` in PostgreSQL as the durable replay ledger.
- Poll once per active session per API process and fan out through a bounded
  process-local broker.
- Disconnect slow subscribers when their fixed buffer fills; they recover via
  snapshot plus `Last-Event-ID`.
- Compact consecutive presence updates by summing their participant deltas, and
  publish aggregate answer/leaderboard events rather than one audience event per
  answer.
- Return `last_event_id` in snapshots so normal clients do not replay irrelevant
  historical bursts.
- Permit a future Redis Pub/Sub wake-up path only when fed from the PostgreSQL
  outbox/ledger; Redis never becomes the sole event record.

## Consequences

- PostgreSQL polling scales with active sessions and API replicas, not SSE
  connections.
- Memory use per connection is explicitly bounded.
- Correctness survives API or Redis loss because replay is durable.
- Cross-instance event latency remains tied to the polling interval until a
  measured need justifies Redis wake-up fan-out.
- Role-scoped snapshots, telemetry, retention, and load proof remain required.
