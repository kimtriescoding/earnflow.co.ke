## Performance Baseline

Date: 2026-05-15 (GET-first optimization pass)

### Instrumentation

- `src/lib/observability/get-timing.js` — `Server-Timing`, optional `GET_TIMING_LOG=1`, slow-request logs (≥500ms).
- Tier-1 GET routes emit timing headers: aviator, dashboard summary/activity/transactions, auth/me, notifications, admin analytics/summary.

### GET TTL caches (in-process, single instance)

| Route | TTL | Notes |
|-------|-----|--------|
| `GET /api/modules/games/aviator` | 0.4–1.5s | Global engine + per-user wallet/bet |
| `GET /api/dashboard/summary` | 60s | Withdrawal totals via aggregation |
| `GET /api/dashboard/activity` | 20s | Keyed by page/filters |
| `GET /api/dashboard/transactions` | 15s | Keyed by page |
| `GET /api/dashboard/earnings-series` | 30s | Mongo day aggregation |
| `GET /api/dashboard/affiliate-network` | 30s | L1/L2 capped at 500 |
| `GET /api/user/notifications` | 12s | Per user + limit |
| `GET /api/admin/analytics` | 2min range / 10min all-time | Split caches |
| `GET /api/admin/summary` | 90s | Global |
| `GET /api/admin/withdrawals` | 30s | List + count |
| `GET /api/admin/switcher` | 8s | Superadmin |
| `GET /api/modules/games/spin` | 2s config slice | Balance still live |

Invalidation: `src/lib/cache/get-cache-invalidation.js` (wallet, earnings, withdrawals, aviator bets).

### Query fixes

- Dashboard summary: withdrawal `$group` instead of unbounded `find`.
- Academic/video tasks: batch participant counts (`participant-counts.js`).
- Admin referrals: commission total via `$lookup`, not full user-id scan.
- Admin users: `includeTotal=1` for withdrawable sum.
- `ModuleInteraction` index: `{ module, action, itemId, status }`.

### Client polling (unchanged cadence; server load reduced via caches)

- Aviator: 400–450ms flying/betting; `auth/me?lite=1` on profile fetch.
- Notifications: ~45s.

### MongoDB ops

- Enable slow-query logging in Atlas/host (`>100ms`) for production tuning.
- Pool: `MONGODB_MAX_POOL_SIZE` (default 50) in `src/lib/db.js`.
