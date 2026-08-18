# ProSlides web

React/Vite client for the new Go API.

## Current state

The existing UI is retained as a migration baseline. Its WebSocket-specific
contexts and routes are legacy code and must be replaced with the SSE + HTTP
contract defined in `../api/openapi/openapi.yaml`. Do not extend WebSocket code.

## Development

```sh
npm ci
npm run dev
npm run lint
npm run test:unit
```

The API base URL is configured through the Vite environment files. New API calls
must be typed and aligned with the OpenAPI contract.
