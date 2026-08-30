# PoE Exchange Path Finder

A static frontend with a Cloudflare Worker backend that reads poe2scout exchange snapshot data and ranks the best 2-trade or 3-trade loops for a selected starting currency.

## Architecture

- **Frontend:** `index.html`, `app.js`, `campaign.js`, `styles.css`
- **Backend:** Cloudflare Worker (`src/`) with D1 database and a 30-minute cron refresh
- **Reference data:** gold costs and campaign checklist live in `data/` and sync into D1 via `npm run sync:data`

See [docs/cloudflare-migration-plan.md](docs/cloudflare-migration-plan.md) for the full migration plan.

**Setup:** step-by-step local and Cloudflare instructions are in [docs/setup-guide.md](docs/setup-guide.md).

## Local development

Install dependencies:

```bash
npm install
```

Apply D1 migrations locally:

```bash
npm run db:migrate:local
```

Seed reference data into local D1:

```bash
npm run sync:data
```

Optionally backfill 7-day price history from the `snapshots` branch:

```bash
npm run backfill:history
```

Start the Worker and static assets together:

```bash
npm run dev
```

Open the URL Wrangler prints (usually `http://127.0.0.1:8787`).

The frontend auto-uses `/api/...` when not hosted on GitHub Pages. Force legacy file/GitHub mode with `?api=0`.

## Deploy to Cloudflare

1. Create the D1 database:

```bash
npx wrangler d1 create price-checker
```

2. Copy the returned `database_id` into `wrangler.toml` if Wrangler does not fill it automatically.

3. Apply migrations to production:

```bash
npm run db:migrate:remote
```

4. Set secrets:

```bash
npx wrangler secret put ADMIN_REFRESH_TOKEN
```

5. Sync reference data to production D1:

```bash
npm run sync:data -- --remote
```

6. Backfill history (first deploy only):

```bash
npm run backfill:history -- --remote
```

7. Deploy:

```bash
npm run deploy
```

Workers Paid ($5/month) is required for the cron refresh job CPU budget.

Preview and production should use separate D1 databases.

## API

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Refresh state and build version |
| `GET /api/games` | Enabled games and labels |
| `GET /api/snapshots/:game/current` | Current normalized snapshot |
| `GET /api/items/:game` | Item labels and icons |
| `GET /api/trends/:game/totals` | Precomputed `totalDifferences` |
| `GET /api/trends/:game/pair/:pairKey` | Per-pair 7-day series |
| `GET /api/data/:game/gold-costs` | Gold costs |
| `GET /api/data/:game/campaign-checklist` | Campaign checklist (`poe2` only) |
| `POST /api/admin/refresh` | Manual refresh (`Authorization: Bearer …`) |

## Updating reference data

Edit the JSON files under `data/`, then run:

```bash
npm run sync:data
```

For production:

```bash
npm run sync:data -- --remote
```

Gold costs are manual/on-demand only. League changes are live settings edits via D1 or `POST /api/admin/settings/:scope/:key`.

## Tests

```bash
npm test
```

## Rollback

The GitHub Action in `.github/workflows/update-snapshot.yml` is disabled but kept for one-league rollback. Re-enable its schedule and point the frontend back to GitHub raw URLs with `?api=0` if needed.

## Legacy GitHub Pages mode

GitHub Pages can still serve the static frontend from `main`, reading snapshots from the `snapshots` branch. That mode does not use the Worker API or D1.
