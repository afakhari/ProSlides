# Configuration reference

Configuration is read from environment variables. Copy the example files for
local development, but inject production values through the deployment
platform's secret/config store. Never commit passwords, peppers, database URLs,
cookies, participant credentials, or provider tokens.

## API variables

| Variable | Default/example | Purpose and constraints |
|---|---|---|
| `APP_ENV` | `development` | Set to `production` to emit Secure cookies. |
| `HTTP_ADDR` | `:8080` | Go HTTP listen address. |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARN`/`WARNING`, or `ERROR`. |
| `DATABASE_URL` | required | PostgreSQL connection URL; required in every environment. |
| `REDIS_URL` | required | Redis connection URL; required for readiness and distributed identity limits. |
| `DEPENDENCY_CHECK_TIMEOUT` | `2s` | Positive Go duration bounding each readiness ping. |
| `SESSION_TTL` | `168h` | Positive Go duration for account sessions. |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | `false` | When true, registration requires verified email before login. |
| `EMAIL_VERIFICATION_TTL` | `10m` | Positive OTP lifetime. |
| `EMAIL_VERIFICATION_RESEND_DELAY` | `60s` | Positive minimum interval between verification messages. |
| `EMAIL_VERIFICATION_MAX_ATTEMPTS` | `5` | Positive maximum checks for one verification challenge. |
| `EMAIL_VERIFICATION_PEPPER` | empty | Secret server-side OTP pepper; at least 32 characters when verification is required. |
| `PASSWORD_RESET_TTL` | `15m` | Positive reset-token lifetime. |
| `PUBLIC_WEB_URL` | local example `http://localhost:5173` | Browser origin used to build reset links; omit a trailing slash. |
| `SMTP_HOST` | empty | SMTP server. Must be configured together with `SMTP_FROM_ADDRESS`. |
| `SMTP_PORT` | `25` | Positive SMTP port. |
| `SMTP_USERNAME` | empty | Optional SMTP authentication username. |
| `SMTP_PASSWORD` | empty | Optional SMTP authentication secret. |
| `SMTP_FROM_ADDRESS` | empty | Sender address; paired with `SMTP_HOST`. |
| `SMTP_FROM_NAME` | `ProSlides` | Human-readable sender name. |
| `SMTP_USE_TLS` | `false` | STARTTLS mode; mutually exclusive with `SMTP_USE_SSL`. |
| `SMTP_USE_SSL` | `false` | Implicit TLS mode; mutually exclusive with `SMTP_USE_TLS`. |
| `GOOGLE_CLIENT_ID` | empty | Enables Google login verification when set. Must match the web client ID. |
| `GOOGLE_JWKS_URL` | Google certificates URL | Override only for a controlled provider/test endpoint. |

`AUTH_REQUIRE_EMAIL_VERIFICATION=true` requires configured SMTP and a strong
`EMAIL_VERIFICATION_PEPPER`. An SMTP username must be used over TLS or SSL; the
mailer rejects authenticated plaintext delivery. `SMTP_USE_TLS` and
`SMTP_USE_SSL` cannot both be true.

When SMTP is intentionally absent, ordinary local registration/login can run
with email verification disabled, but password-reset delivery returns a safe
service-unavailable response. Password reset also requires `PUBLIC_WEB_URL` so
the API can construct the link. When `GOOGLE_CLIENT_ID` is absent, Google login
is disabled with a safe service-unavailable response. Provider secrets are
never returned to the browser or health endpoints.

## Web variables

| Variable | Local value | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/v1` | Identity, dashboard, editor, and report API base. |
| `VITE_LIVE_API_BASE_URL` | `/api/v1` | Live HTTP/SSE API base. |
| `VITE_GOOGLE_CLIENT_ID` | provider client ID | Enables the existing Google UI; must exactly equal API `GOOGLE_CLIENT_ID`. |

Same-origin `/api/v1` paths are preferred in production. If separate origins
are unavoidable, configure the trusted ingress for credentials and a narrow
CORS allowlist. Vite variables are public build inputs and must never contain a
client secret.

## Dependency and failure behavior

- `GET /healthz` is process-only and does not prove dependencies.
- `GET /readyz` returns 200 only when both PostgreSQL and Redis respond within
  `DEPENDENCY_CHECK_TIMEOUT`; responses expose only safe status names.
- PostgreSQL is authoritative for sessions, content, answers, scores, commands,
  and replay events.
- Redis identity limits fail open on Redis errors to preserve authentication
  availability, while readiness still reports the dependency outage.
- Production TLS terminates at the trusted ingress. The API emits Secure cookies
  when `APP_ENV=production`; preserve forwarded-origin semantics at the proxy.

## Production checklist

1. Generate unique database/Redis credentials and a random verification pepper;
   store them only in the secret manager.
2. Configure verified SMTP sender credentials and one TLS mode, then exercise
   verification, resend, forgot-password, expiry, and one-time-use paths.
3. Create the Google OAuth web client for the exact production origin and set
   the identical client ID in API and web builds. No client secret is required
   by this ID-token flow.
4. Set `PUBLIC_WEB_URL`, allowed origins, ingress TLS, and `APP_ENV=production`;
   confirm cookie, CSRF, and reset-link behavior through the public hostname.
5. Confirm `/healthz` and `/readyz`, migration startup, backups, restore, and
   secret rotation in a non-production environment before cutover.

Canonical local examples live in
[`apps/api/.env.example`](../apps/api/.env.example) and
[`apps/web/.env.example`](../apps/web/.env.example).
