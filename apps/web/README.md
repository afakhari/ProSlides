# ProSlides web

React/Vite client for the new Go API.

## Current state

The existing UI is retained while the live runtime uses typed HTTP commands,
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
```

`VITE_LIVE_API_BASE_URL` configures the Go live API (including `/api/v1`). The
older `VITE_API_BASE_URL` remains for non-live endpoints not migrated in this
stage. New live calls must be typed and aligned with the OpenAPI contract.
The default `/api/v1` is same-origin; the Vite development server proxies it to
the local Go API. A cross-origin production override requires an explicitly
restricted CORS policy at the trusted ingress.

The presenter connection moves a new draft session idempotently into the lobby
before displaying its join code. Participant retry/reconnect preserves one
join credential, and final/leaderboard views keep only the participant's own
row plus the aggregate count. Presenter roster and final score pages remain
bounded and load additional rows explicitly.
