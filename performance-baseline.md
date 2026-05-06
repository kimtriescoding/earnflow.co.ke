## Performance Baseline (Pre-Optimization)

Date: 2026-05-06

### Client Polling / Render Cadence

- `src/app/(user)/dashboard/aviator/page.js`
  - Engine polling delay:
    - hidden tab: `1500ms`
    - flying: `180ms`
    - betting/locked: `150ms`
    - other: `500ms`
  - Render clock updates:
    - flying: `requestAnimationFrame` (~60fps)
    - betting/locked: `setInterval(60ms)`
    - other: `setInterval(200ms)`
  - Engine fetch uses timestamp cache-busting and `no-store`.
- `src/app/(admin)/admin/switcher/SwitcherPageClient.js`
  - Poll interval: `3000ms`
  - Requests use `cache: "no-store"`.
- `src/components/user/UserNotificationsBell.js`
  - Poll interval: `22000ms`.

### Dashboard API Query Sizes

- `src/lib/dashboard/user-transactions.js`
  - `FETCH_LIMIT = 300`
  - Pulls up to 9 datasets in parallel, then merges/sorts in memory.
- `src/app/api/dashboard/activity/route.js`
  - Earning events: up to `500`
  - Referral commissions: up to `100`
  - Transactions: up to `100`
  - Merges and sorts in memory.
- `src/app/api/dashboard/summary/route.js`
  - Executes many parallel queries/aggregations per request.

### Auth/Guard Redundancy

- Middleware verifies JWT for protected route groups.
- Route-group layouts also reconnect DB and fetch user rows per render.

### Logging Baseline

- `src/lib/observability/logger.js` emits `console.log/error/warn` with JSON payloads for all levels without env-level gating.
