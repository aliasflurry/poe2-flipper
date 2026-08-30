# Cloudflare Backend + D1 Plan For Price Checker

Version 2 — 2026-08-30

Supersedes the initial Pages Functions plan. Changes from v1 are recorded in
[Revision history](#revision-history) at the end.

## Summary

Migrate Price Checker from static GitHub Pages hosting to a single Cloudflare
**Worker with static assets**, backed by D1 and one scheduled cron trigger. All data
currently held in files — gold costs, campaign checklist, exchange snapshots, price
history, and the game configs embedded in `app.js` — moves into the database.

The primary measurable goal is to cut the client payload from roughly **8.1 MB to about
500 KB** on first load, by normalizing data on ingest and serving price history in
per-pair slices rather than as one monolithic file. Authentication is out of scope.

Platform constraints verified against
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
[D1 limits](https://developers.cloudflare.com/d1/platform/limits/),
[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), and the
[PoE developer docs](https://www.pathofexile.com/developer/docs).

## Architecture decisions

**Workers with static assets, not Pages Functions.** Pages Functions have no
`scheduled()` handler and cannot run cron triggers at all, so a Pages-based design would
need a second deployable Worker regardless. Workers now have parity with Pages for static
assets and custom domains, while cron triggers, Durable Objects, and Workflows remain
Workers-only. One deployable, one runtime.

**Workers Paid ($5/month) from day one.** The free tier caps CPU at 10 ms per invocation,
including cron invocations. The refresh job parses megabytes of JSON and performs on the
order of 165,000 rate computations; Cloudflare's own guidance places large-payload parsing
alone at 10–20 ms. Paid raises the cron limit to 30 s. This is a baseline cost, not a
contingency.

**Normalize on ingest; never store the raw upstream payload in D1.** D1 caps any row at
2,000,000 bytes. The current `data/poe2_data/snapshot.json` is 1,968,482 bytes — 98.4% of
the limit, roughly 23 new currency pairs from breaking permanently. Stripping the fields
the client never reads (`CurrencyExchangeSnapshotPairId`, `VolumeTraded`, `HighestStock`,
and per-pair icon/category duplication) brings it to about 175 KB, which removes the
ceiling and cuts the client payload tenfold at the same time.

**Price history is stored as indexed rows, not a blob.** This is the one dataset with a
genuine query workload, and the reason to use D1 at all. Today the browser downloads 6 MB
and discards nearly all of it: the trends ranking is driven by precomputed
`totalDifferences` (~50 KB) and each chart needs one pair's 56 points. With an index on
`(game, pair_key, ts)`, a chart request scans ~56 rows out of ~164,000 retained. D1 bills
rows *scanned*, so that index is correctness-critical for cost, not an optimization.

**The current snapshot stays a blob, because it is read whole and written whole.** D1
counts a 175 KB row and a 1 KB row identically, so one blob row per game costs 2
row-writes per refresh. Storing the same data as 1,463 pair rows per game would cost
~140,000 row-writes per day before index writes — pure waste, and over the free tier's
100,000/day limit.

## Data model

```sql
-- Configuration — database-authoritative after initial seed
settings(scope, key, value, updated_at)                       PK (scope, key)

-- Operational state — cron-owned
refresh_state(game, last_refresh_at, last_success_at, last_status,
              last_error, last_history_append_at)             PK (game)

-- Sync bookkeeping for repo-authoritative content
data_versions(key, content_hash, applied_at, externally_modified)  PK (key)

-- Reference data — repo-authoritative
gold_costs(game, name, name_normalized, slug, gold, source, updated_at)
    PK (game, name)                    INDEX (game, name_normalized)

campaign_acts(game, act_id, num, title, sort_order)           PK (game, act_id)
campaign_areas(game, act_id, area_id, name, sort_order)       PK (game, act_id, area_id)
campaign_objectives(game, act_id, area_id, objective_id, text, optional, sort_order)
    PK (game, act_id, area_id, objective_id)
campaign_objective_rewards(game, act_id, area_id, objective_id,
                           text, type, sort_order)

-- Exchange data — cron-owned
items(game, api_id, text, icon_url, category_api_id)          PK (game, api_id)
snapshots(game, updated_at, source, payload_json)             PK (game)
history_points(game, ts)                                      PK (game, ts)
history_pairs(game, ts, pair_key, one_price, two_price, volume)
    PK (game, ts, pair_key)            INDEX (game, pair_key, ts)
price_totals(game, from_id, to_id, total_diff)                PK (game, from_id, to_id)
```

Approximate scale: `gold_costs` 1,091 rows across both games; campaign tables a few
hundred rows total; `items` ~538 per game; `history_pairs` ~164,000 retained;
`price_totals` ~4,336 per game. Total storage in the tens of megabytes against 5 GB
included.

The campaign tables carry explicit `sort_order` at every level because SQL has no
inherent row order and act/area/objective sequence is meaningful to the UI.
`gold_costs.name_normalized` is precomputed because `app.js` currently normalizes names in
JS on every load to match them against snapshot items.

There is no `games` table, so the `game` column has no foreign-key anchor and nothing
prevents a typo'd game id. With two games that is acceptable; a one-column `games(id)`
stub purely as an FK target is the cheap alternative if the constraint is wanted.

## Settings seed

Replacing `GAME_CONFIGS` at `app.js:1-21`. `value` is JSON-encoded TEXT, parsed on read,
resolved per-game with fallback to `global`.

| scope | key | value |
| --- | --- | --- |
| global | `history_retention_days` | `7` |
| global | `history_append_interval_hours` | `2.5` |
| poe2 | `label` | `"Path of Exile 2"` |
| poe2 | `enabled` / `sort_order` | `true` / `1` |
| poe2 | `default_start_currency` | `"exalted"` |
| poe2 | `upstream_base` / `realm` / `league` | `"https://api.poe2scout.com"` / `"poe2"` / `"runes"` |
| poe | `label` | `"Path of Exile"` |
| poe | `enabled` / `sort_order` | `true` / `2` |
| poe | `default_start_currency` | `"chaos"` |
| poe | `upstream_base` / `realm` / `league` | `"https://api.poe2scout.com"` / `"pc"` / `"allflame"` |

The cron reconstructs the upstream URL as
`{upstream_base}/{realm}/Leagues/{league}/SnapshotPairs`. Storing `league` as its own row
is deliberate: rollover every few months becomes a one-word edit, and it is the config
that has already drifted once, with the workflow on `allflame` while
`scripts/generate-price-history.mjs` uses `mirage`.

The two `global` keys were hardcoded in the workflow's PowerShell and become tunable
without a deploy. Note `history_append_interval_hours` is 2.5 to match the existing
implementation; the README describes the resulting cadence as 3 hours.

Not migrated, being artifacts of static hosting: `localSnapshotUrl`, `historyUrl`,
`goldCostsUrl`, and the `SNAPSHOT_DATA_BASE` constant. All become `/api/...` routes
derived from the game id. `storagePrefix` stays client-side — it is a `localStorage` key
prefix identical to the game id, and fetching it would block restoring persisted filters
on a network round-trip for no benefit.

Settings are read on the request path, so the Worker caches the resolved per-game object
with a short TTL. Live edits propagate within about a minute without adding a D1
round-trip to every response.

## Data ownership

Three update models, deliberately distinct.

**Repo-authoritative** — gold costs, campaign checklist. The JSON files remain the
authoring source of truth in the repo, preserving git history, diffs, code review, and
rollback for data edits. `npm run sync:data` hashes each file against
`data_versions.content_hash` and re-seeds only what changed, inside a `db.batch()`
transaction, so it is idempotent and safe to re-run. CI runs it in dry-run mode and fails
the build if the database has drifted from the repo. **Gold costs are loaded once and
updated only on demand** — no automation, no scraping. To update: edit the file, commit,
run the sync.

**Database-authoritative** — settings. Seeded once from `data/settings.json`, then owned
by the database and edited live via the admin endpoint or `wrangler d1 execute`.
Explicitly **excluded from the CI drift check**, since the entire point of putting
`league` in the database is changing it at league launch without a deploy.

**Cron-owned** — snapshots, items, history, totals, refresh state. Never hand-edited.

## Public API

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Per-game refresh state from `refresh_state`, plus build version |
| `GET /api/games` | `label`, `enabled`, `sort_order`, `default_start_currency` |
| `GET /api/snapshots/:game/current` | Normalized snapshot, ~175 KB |
| `GET /api/items/:game` | Label and icon manifest, long cache |
| `GET /api/trends/:game/totals` | Precomputed `totalDifferences`, ~50 KB |
| `GET /api/trends/:game/pair/:pairKey` | 7-day series for one pair, a few KB |
| `GET /api/data/:game/gold-costs` | Assembled to the current file's exact shape |
| `GET /api/data/:game/campaign-checklist` | Reassembled nested structure, `poe2` only |
| `POST /api/admin/refresh` | Manual snapshot refresh |
| `POST /api/admin/data/:game/:key` | Out-of-band reference data write |
| `POST /api/admin/settings/:scope/:key` | Live settings edit |

Admin routes sit behind `Authorization: Bearer <ADMIN_REFRESH_TOKEN>`.
`POST /api/admin/data/:game/:key` marks `externally_modified` so the next CI check reports
divergence rather than silently reverting the change.

Both `/api/data/...` endpoints return the identical JSON shape the files return today, so
`app.js` and `campaign.js` need only a URL change for them.

`GET /api/trends/:game/pair/:pairKey` is the point of the migration. The v1 plan's single
`/api/snapshots/:game/history` endpoint would have preserved the 6 MB payload and
forfeited the entire benefit.

## Payload budget

| | Today | After |
| --- | --- | --- |
| Snapshot | 1.9 MB | ~175 KB |
| Price history | 6.0 MB | ~50 KB totals + a few KB per chart |
| Item labels/icons | (inside snapshot) | ~80 KB, cached hard |
| Gold costs | 130 KB | 130 KB, cached hard |
| Campaign checklist | 73 KB | 73 KB, cached hard |
| **First load** | **~8.1 MB** | **~500 KB** |
| **Repeat load in cache window** | ~8.1 MB | ~225 KB, mostly 304s |

## Caching

Every response is identical for all users and changes on a fixed schedule, so caching does
most of the work.

- Snapshot and trends: `public, max-age=60, s-maxage=1800, stale-while-revalidate=300`
- Items, gold costs, campaign checklist: `public, max-age=86400` on versioned paths
- Every JSON endpoint carries an **ETag derived from `updated_at` and honors
  `If-None-Match`**, so repeat visits within a refresh window become 304s.

Use the Cache API explicitly so a cache hit never touches D1. Each D1 database is backed
by a single-threaded Durable Object and must stay out of the hot path for read-heavy
identical JSON. A full gold-costs response scans 668 rows, and D1 bills rows scanned —
with cache in front that happens roughly once per hour rather than once per visitor.

Add `stale-if-error` to the data endpoints. Once file fallbacks are gone, D1 is a hard
dependency for rendering, so a database error should serve stale-but-cached data rather
than a 500.

## Cron refresh

One trigger, every 30 minutes. Per game: fetch upstream, normalize, upsert `items`,
replace the `snapshots` row.

**Append to history only if `history_append_interval_hours` has elapsed since
`last_history_append_at`**, matching current behavior. Appending every 30 minutes instead
would inflate `totalDifferences` — it sums absolute deltas between consecutive samples, so
6× the samples captures 6× the noise and would silently reshuffle trend rankings with no
code change that looks responsible.

Then recompute `price_totals`, prune history beyond `history_retention_days`, and write
`refresh_state` — all via `db.batch()` so a mid-write failure cannot leave partial state.

Send an identifying User-Agent with contact details, replacing the current spoofed
`origin: https://poe2scout.com` and `referer` headers.

## Frontend changes

Keep `localStorage` for filters, includes/excludes, overrides, trends settings, and
campaign progress. v1 changes nothing about per-device state.

**Keep the `api.poe2scout.com` fallback** in `app.js`. That resilience matters more, not
less, once a battle-tested static CDN is replaced by bespoke compute and a database.

Surface a stale `updated_at` visibly rather than presenting old data as current.

The trends rework is the real work: `app.js` is 2,003 lines with snapshot and trends logic
interleaved, and moving from "download everything, filter client-side" to "load totals,
then fetch per-pair on demand" is a genuine restructuring rather than a URL swap.

## Phases

**Phase 0 — Spike.** Confirm a Worker can reach `api.poe2scout.com` without being
rate-limited differently than GitHub Actions runners; Worker egress comes from Cloudflare
ranges that some services treat more aggressively. Measure actual cron CPU. **This gates
the cron design** — if poe2scout blocks Cloudflare egress, refresh stays in GitHub Actions
and Cloudflare becomes serving-only.

**Phase 1 — Hosting.** Deploy the existing static site to Workers unchanged, still reading
GitHub raw. Zero risk; settles hosting and domain.

**Phase 2a — Reference data.** `settings`, `gold_costs`, campaign tables, `sync:data`, the
two `/api/data/...` endpoints, golden tests. **Independent of Phase 0's outcome** — small
data, no upstream dependency, exactly-verifiable output. The right place to start real
implementation even if Phase 0 turns up problems.

**Phase 2b — Exchange data.** Cron writes to D1 in parallel with the existing GitHub
Action; diff outputs until they agree. Backfill history from the existing 6 MB
`price-history.json` via `wrangler d1 execute --file` so D1 holds a full 7-day window
before any user sees it — otherwise the trends tab looks broken for a week after cutover.

**Phase 3 — Frontend cutover,** behind a query-param flag.

**Phase 4 — Cleanup.** Disable the GitHub Action (keep as documented rollback for one
league cycle), delete `api/trade2/[...path].js`, remove the stale duplicate
`campaign-checklist.json` from the `snapshots` branch, and rewrite `README.md`, which
currently documents GitHub Pages deployment and describes a `/api/trade2` frontend
fallback that does not exist in the code.

## Test plan

Automated tests are the priority. `totalDifferences` currently exists twice — in
PowerShell in `.github/workflows/update-snapshot.yml` and in
`scripts/price-history-totals.mjs` — and the two have already diverged on league name. A
TypeScript port would be a third copy. So: one implementation, delete the others, and a
**golden test** running the new code over the existing `price-history.json`, asserting
output matches the current `totalDifferences` within epsilon.

The same pattern covers Phase 2a: assert `/api/data/:game/gold-costs` and
`/api/data/:game/campaign-checklist` deep-equal the current JSON files after seeding. That
directly guards the risk that normalizing and reassembling the four-level campaign
structure drops `optional`, loses `rewards`, or scrambles ordering.

Also required:

- Unit tests for snapshot normalization and the history append gate.
- `sync:data` idempotency — a second run writes nothing.
- CI drift check fails when the database is modified out of band.
- Campaign reassembly preserves `sort_order` at all four levels.

Use Vitest with `@cloudflare/vitest-pool-workers`.

Manual verification: local `wrangler dev` with migrations applied; cron invoked via
`/cdn-cgi/handler/scheduled`; both games load; per-pair charts render; ETag returns 304 on
repeat; retention prunes past 7 days; `/api/health` reflects a deliberately failed refresh.

**Preview and production must use separate D1 databases,** or the preview cron will
overwrite production data.

## Cost

Workers Paid at $5/month. Everything else sits inside included allowances by a wide
margin: roughly 28,000 rows written per day against 50 million/month included, storage in
the tens of megabytes against 5 GB, and no D1 egress charges.

## Out of scope

**Path of Exile OAuth — removed entirely.** Three independent reasons. GGG require
confidential clients to use "a secure (HTTPS-enabled) URI with a registered domain
controlled by the application owner" and "cannot accept IP addresses or localhost domains
even for in-development projects," so a free `pages.dev` subdomain cannot work.
Registration is manual via `oauth@grindinggear.com`, is "considered a low priority," and
requires justifying each scope. And login would deliver no v1 user benefit — it would only
establish identity for a future sync feature — in exchange for the only security-sensitive
surface in the codebase.

Revisit when a real domain exists and cross-device sync is an actual requirement. That work
will need the OAuth `state` parameter, PKCE, a single session design rather than both
DB-backed and stateless, cookie `SameSite`, session expiry, and the mandatory
`OAuth {clientId}/{version} (contact: {contact})` User-Agent format.

**`api/trade2/[...path].js` — delete.** Nothing in the frontend calls it. Beyond being dead
code, it is an open unauthenticated proxy to GGG's trade API with
`Access-Control-Allow-Origin: *`; on a stable URL anyone can route traffic through it, and
GGG rate-limit by client, so this deployment absorbs the consequences. If stash lookup is
built later it needs an origin allowlist, rate limiting, a compliant User-Agent, and
handling of upstream `X-Rate-Limit-*` headers.

**Gold cost automation.** Manual and on demand, by design.

## Assumptions and open risks

- poe2scout tolerates Cloudflare egress at 48 requests/day — **unverified; Phase 0 exists
  to check it.**
- A real domain is a prerequisite for any future OAuth work; `pages.dev` is fine for v1.
- Secrets go through `wrangler secret put`, are per-environment, and never appear in
  `wrangler.toml`.
- D1 migrations are forward-only with no down-migrations; the settings seed ships as a
  migration.
- The free tier allows 5 cron triggers per account; this plan uses 1.
- D1 becomes a hard dependency for rendering, mitigated by `stale-if-error`, the Cache API
  layer, and the retained poe2scout fallback.

Two items remain genuinely uncertain rather than merely unbuilt: whether poe2scout accepts
Cloudflare egress, and how much of `app.js` must move to make per-pair trend loading work.

## Revision history

**v2 — 2026-08-30.** Corrected three blockers in v1: Pages Functions cannot run cron
(moved to Workers with static assets); the free tier's 10 ms CPU limit cannot run the
refresh job (Workers Paid is a day-one cost); and the PoE2 snapshot at 1,968,482 bytes sits
at 98.4% of D1's 2 MB row limit (normalize on ingest). Split the history endpoint into
totals plus per-pair to realize the payload reduction. Removed OAuth entirely — a
`pages.dev` domain cannot satisfy GGG's redirect URI requirements, so v1's two assumptions
contradicted each other. Added the golden-test strategy for the three-way duplicated
`totalDifferences` logic, the history backfill step, and the Phase 0 egress spike.
Migrated all remaining file-based data into D1 with the repo-as-authoring-source pattern.
Replaced the `games` table with `settings` plus `refresh_state`, and dropped the proposed
gold-costs scrape automation.
