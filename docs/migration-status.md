# Go migration status

## Executive summary

As of 2026-08-19, the active React product flows have functional backend
coverage in Go. The historical Django/Rust implementation remains available in
Git history and on `master`, but it is not part of this branch's runtime.

The migration is estimated at **about 85% overall**. This is a delivery-roadmap
estimate, not test coverage and not a 10,000-user capacity claim. Product/API
parity is complete; production certification still requires secrets,
observability, load evidence, infrastructure hardening, cutover, and rollback.

## Product parity matrix

| Product behavior | Go implementation | Status |
|---|---|---|
| register, login, logout, current user | opaque PostgreSQL sessions, HttpOnly cookies, CSRF | complete |
| email verification and resend | hashed OTP, TTL, resend delay, attempt limit, SMTP delivery | complete; provider config required in deployment |
| forgot/reset password | one-time hashed token, TTL, SMTP reset link | complete; provider config required in deployment |
| Google login | RS256/JWKS signature, issuer, audience, expiry, and verified-email checks | complete; matching client IDs required |
| dashboard and owner presentation CRUD | list, create, update, delete, duplicate, settings | complete |
| editor/content model | slides, content, questions/options, atomic zero-based insertion/movement/compaction | complete |
| start and control live quiz | create session, resolve join code, manager commands, optimistic versioning | complete |
| participant lifecycle | idempotent join, scoped credential cookie, role checks | complete |
| answers and scoring | deadline/state enforcement, idempotency, replaceable scoring, durable aggregate | complete |
| participant snapshot | public state, active slide, self/score, aggregate count, `last_event_id` only | complete |
| presenter roster/leaderboard | manager-only, limit at most 100, stable keyset pagination | complete |
| live delivery | snapshot-first SSE, durable replay, bounded process broker, slow-client recovery | complete |
| question results | owner-only option counts and stable keyset-ranked answer rows | complete |
| reports | bounded Go presentation/results queries consumed by React | complete for current product UI |

No active React flow needs a Django or Rust service. Django admin is a framework
operations UI rather than a product endpoint and is intentionally not cloned.
Media remains URL metadata because the legacy product did not expose a required
binary-upload API; managed object storage is a separate production capability.

## Deliberate boundary changes

- Django JWT access/refresh storage was replaced with opaque server sessions and
  CSRF-protected cookie authentication.
- The old full quiz/live export was split into a bounded presentation definition,
  role-scoped snapshot, manager roster pages, and owner result pages.
- Rust result ingestion and its second score ledger were removed. Durable Go
  answers are authoritative for scores and reports.
- Persistent presentation codes were replaced by the active non-ended live
  session's generated join code.
- The historical Google path did not prove token signatures. Go deliberately
  performs full provider verification; weakening it would be a security defect,
  not useful parity.

## Frontend status

The dashboard, editor, reports, authentication, presenter, and participant
runtime use the Go API. Live play uses HTTP commands plus SSE; active routes do
not open the legacy WebSocket client. Participant state types cannot retain a
complete roster or correctness metadata.

The established login/register/recovery presentation was preserved. The main
`AuthPage.jsx` remains the large, custom-designed screen; migration work changed
its transport and provider integration rather than replacing the design.

## Verification evidence

The latest completed revision (`8ae78d9`, 2026-08-19) passed:

- all Go tests and `go vet`, including SMTP and Google adapter tests;
- OpenAPI parsing;
- web lint, TypeScript checking, 23 unit tests, and production build;
- the real Docker Compose matrix for identity, owner CRUD/settings, atomic slide
  operations, live commands, idempotent join/answer, scoped snapshots,
  participant non-disclosure, multi-page manager ordering, per-question results,
  aggregate-only events, concurrent joins, and SSE replay;
- both GitHub Actions workflows for the pushed revision.

The later `d118d4b` revision added three system-Chrome Playwright smoke flows
covering responsive auth, registration/login/logout, presentation and slide
creation, reports/history, and invalid join codes. Compose/browser smoke is
functional evidence, not load evidence.

## Remaining work, in order

1. Provision production SMTP, Google, database, Redis, origin, and TLS secrets
   through the deployment platform; never commit them.
2. Add bounded OpenTelemetry-compatible metrics and a reproducible 100-user k6
   smoke scenario. This is the exact next engineering step.
3. Add public join/answer abuse limits, event retention, production backup/
   restore evidence, and graceful-drain verification. Portable web/API images,
   migration serialization, and reference TLS/SSE proxy/runbooks are present.
4. Pass the documented 1k level twice, then 5k, then 10k on named
   production-like infrastructure, fixing measured bottlenecks between levels.
5. Exercise feature-flagged cutover and rollback before removing legacy
   operational dependencies.

See [capacity-plan.md](capacity-plan.md) for objective gates and
[configuration.md](configuration.md) for deployment inputs.
