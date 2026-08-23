# Persian-first frontend professionalization plan

## Purpose and product direction

This document is the source of truth for turning the current functional React
client into a coherent, production-quality Persian product. The target product
language is Persian. User-facing application chrome, primary workflows,
validation, empty states, loading states, and accessibility labels must be
Persian and use RTL layout. API fields, code identifiers, URLs, logs, and
developer documentation remain English.

Professional does not mean adding long or decorative animation. The product
must feel continuous, predictable, fast, accessible, and visually consistent.
Durable API behavior and the existing editor/live correctness boundaries must
not be weakened for visual polish.

## Current evidence — 2026-08-23

A real-Chrome review at desktop and 390x844 reproduced the first critical flow:

```text
dashboard -> Creating button -> unrelated full-screen loader -> empty editor
```

The dashboard, loader, and editor currently change color system, density,
language, and spatial structure at once. The editor initially shows a mostly
blank canvas with weak first-action guidance. Mobile remains usable, but the
header is crowded and English labels wrap. The code also contains duplicated
presentation routing, inconsistent alert/toast patterns, production imports
from mock data, and several oversized components.

## Experience rules for all frontend work

1. Persian is the default user-facing language and page direction is RTL.
2. Navigation preserves spatial context. Async route changes use a shell-shaped
   skeleton, not a visually unrelated full-screen loader.
3. Motion is functional, normally 160-220 ms, and disabled or reduced under
   `prefers-reduced-motion`.
4. Every mutation exposes pending, success, and recoverable error states. A
   disabled control must explain why.
5. Empty states identify the next useful action. They must not look like broken
   or unfinished screens.
6. One design-token system owns brand colors, typography, spacing, radii,
   shadows, focus states, and semantic feedback colors.
7. Responsive acceptance is required at desktop 1440x900 and mobile 390x844.
8. Keyboard navigation, visible focus, named icon buttons, live status regions,
   and reduced motion are part of completion, not a later cosmetic pass.
9. Mock/demo data must not enter production flows. Unimplemented controls are
   hidden or explicitly marked as unavailable.
10. Large UI changes require real-browser snapshots before and after the change.

## Ordered delivery phases

### Phase F1 — creation-to-editor continuity

Objective: make `New presentation` feel like one continuous Persian workflow.

- Keep visible progress in the dashboard while the create request commits.
- Navigate with explicit creation context and render an editor-shaped skeleton.
- Replace the generic loader on the editor route.
- Fade the loaded editor into the same shell without layout jump.
- Add a Persian first-run empty state with a clear first-slide action.
- Open slide-type selection immediately after the first draft slide is created.
- Localize every user-facing string introduced or touched by this flow.
- Respect reduced-motion preference.

Acceptance:

- A single click creates exactly one presentation and performs one navigation.
- Pending state is announced and duplicate clicks are blocked.
- No unrelated background/loading screen flashes between dashboard and editor.
- The final editor remains usable at 1440x900 and 390x844.
- Create failure leaves the user on the dashboard with a Persian recoverable
  error and no false success state.
- Unit, lint, typecheck, build, and real-Chrome flow checks pass.

### Phase F2 — Persian app shell and design system

- Introduce shared application shell, tokens, typography, and semantic colors.
- Translate dashboard, editor chrome, share flow, reports, and common dialogs.
- Establish one RTL/LTR boundary for content such as URLs and access codes.
- Replace mixed alerts/toasts with one accessible feedback system.
- Remove or mark non-functional header/editor controls.

### Phase F3 — editor information architecture and responsive refinement

- Simplify editor navigation and clarify canvas/panel hierarchy.
- Make slide creation type-first and avoid abandoned draft slides.
- Refine mobile header, bottom toolbar, sheets, and safe-area behavior.
- Add consistent save state, dirty state, and conflict recovery affordances.

### Phase F4 — maintainability, accessibility, and product cleanup

- Split oversized route/components behind stable domain boundaries.
- Remove duplicated presentation runtime from `App.jsx`.
- Remove production mock-data dependencies.
- Complete keyboard, contrast, focus, screen-reader, and reduced-motion audit.
- Add screenshot/interaction regression coverage for critical Persian flows.

## AI handoff protocol

For every phase, update this document with implemented scope, browser evidence,
known gaps, and the next exact phase. Do not mark a phase complete from static
screenshots alone: verify the API request count, navigation, error recovery,
desktop viewport, and mobile viewport. Do not mix capacity claims with frontend
polish; the capacity gates in `capacity-plan.md` remain independently required.
