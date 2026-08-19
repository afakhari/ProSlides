# ProSlides web

React/Vite client for the new Go API.

## Current state

The existing UI is retained while authentication, dashboard, editor, reports,
and the live runtime use the Go API. Live delivery uses typed HTTP commands,
role-scoped snapshots, manager-only paginated rosters, and SSE recovery from
`last_event_id`. No live runtime route opens the historical WebSocket client.

## Development

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

Playwright uses its managed Chromium by default. When browser-binary downloads
are unavailable but Chrome is installed locally, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to the Chrome executable before running
`npm run test:e2e`. The smoke suite starts or reuses Vite on port 4173 and
expects the Go API stack on port 8080.

`VITE_API_BASE_URL` and `VITE_LIVE_API_BASE_URL` configure the Go API. Both
default to same-origin `/api/v1`; the Vite development server proxies it to the
local Go API. A cross-origin production override requires an explicitly
restricted CORS policy at the trusted ingress. `VITE_GOOGLE_CLIENT_ID` enables
the existing Google UI and must exactly match the backend `GOOGLE_CLIENT_ID`.
The Go endpoint verifies the signature, JWKS key, issuer, audience, expiry, and
verified-email claim before issuing the normal session/CSRF cookies.

The original login/register/recovery presentation, animations, responsive
behavior, OTP states, and validation UX are intentionally preserved. The
integration no longer stores Django JWT access/refresh tokens in the browser;
authentication is cookie-based.

The presenter connection moves a new draft session idempotently into the lobby
before displaying its join code. Participant retry/reconnect preserves one
join credential, and final/leaderboard views keep only the participant's own
row plus the aggregate count. Presenter roster and final score pages remain
bounded and load additional rows explicitly.
