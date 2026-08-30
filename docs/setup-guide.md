# Setup Guide: Local and Cloudflare

This guide walks through running Price Checker on your machine and deploying it to Cloudflare.

For architecture details, see [cloudflare-migration-plan.md](cloudflare-migration-plan.md).

---

## Prerequisites

| Requirement | Notes |
| --- | --- |
| **Node.js 18+** | Includes `npm`. Download from [nodejs.org](https://nodejs.org/). |
| **Cloudflare account** | Required for deployment only. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com/sign-up). |
| **Wrangler login** | Run once before deploying: `npx wrangler login` |

Optional for local work:

- **Git** — to clone the repo
- **curl or a browser** — to verify API endpoints

### Cost note

The scheduled snapshot refresh needs **Workers Paid** (~$5/month). The cron job parses large JSON payloads and exceeds the free tier’s 10 ms CPU limit. Static serving and API reads can run on the free tier, but the full app as designed expects Paid.

---

## Part 1: Local development

### 1. Clone and install

From the project root:

```bash
npm install
```

This installs Wrangler, TypeScript, and Vitest as dev dependencies.

### 2. Create the local D1 database

Apply migrations to a local SQLite database (stored under `.wrangler/`):

```bash
npm run db:migrate:local
```

This creates all tables defined in `migrations/0001_initial.sql`.

### 3. Seed reference data

Load settings, gold costs, and the campaign checklist from the JSON files in `data/`:

```bash
npm run sync:data
```

What gets synced:

| Source file | D1 destination |
| --- | --- |
| `data/settings.json` | `settings` table |
| `data/poe2_data/gold-costs.json` | `gold_costs` (poe2) |
| `data/poe_data/gold-costs.json` | `gold_costs` (poe) |
| `data/poe2_data/campaign-checklist.json` | campaign tables |

The script is idempotent — re-running it skips unchanged files. To preview without writing:

```bash
npm run sync:data:dry
```

### 4. Backfill price history (recommended)

The trends tab needs 7 days of history. On first setup, import it from the GitHub `snapshots` branch:

```bash
npm run backfill:history
```

This fetches `price-history.json` for both games and loads `history_points`, `history_pairs`, and `price_totals`. It requires network access to GitHub raw URLs.

Without this step, exchange and gold costs work, but **Price trends will be empty** until the cron runs for several days.

### 5. Start the dev server

```bash
npm run dev
```

Wrangler serves:

- Static files (`index.html`, `app.js`, etc.) from the repo root
- API routes from `src/` at `/api/*`

Open the URL Wrangler prints, usually:

```
http://127.0.0.1:8787
```

The frontend automatically uses `/api/...` when not on GitHub Pages. To force the old static-file mode:

```
http://127.0.0.1:8787/?api=0
```

### 6. Load exchange snapshots locally

Reference data is seeded in step 3, but **live exchange snapshots are not**. Until the cron runs or you trigger a manual refresh, the app falls back to the live poe2scout API.

To populate D1 with snapshots locally:

1. Set an admin token for local dev (choose any random string):

   ```bash
   npx wrangler secret put ADMIN_REFRESH_TOKEN
   ```

   Wrangler may prompt about local vs remote — choose **local** for dev.

2. Restart `npm run dev` if it was already running.

3. Trigger a refresh:

   ```bash
   curl -X POST http://127.0.0.1:8787/api/admin/refresh ^
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```

   On macOS/Linux, use `\` instead of `^` for line continuation, or put it on one line.

### 7. Verify local setup

Check these in your browser or with curl:

| Check | URL | Expected |
| --- | --- | --- |
| Health | `GET /api/health` | `{ "ok": true, "games": [...] }` |
| Games | `GET /api/games` | PoE2 and PoE entries |
| Gold costs | `GET /api/data/poe2/gold-costs` | JSON with `costs` array |
| Campaign | `GET /api/data/poe2/campaign-checklist` | JSON with `acts` |
| Snapshot | `GET /api/snapshots/poe2/current` | JSON with `pairs` (after refresh) |
| Trends | `GET /api/trends/poe2/totals` | `totalDifferences` object (after backfill) |
| Frontend | `/` | Exchange tab loads pair data |

Run unit tests:

```bash
npm test
```

### 8. Test the cron locally

Wrangler can invoke the scheduled handler without waiting 30 minutes:

```bash
curl "http://127.0.0.1:8787/cdn-cgi/handler/scheduled?cron=*/30+*+*+*+*"
```

Then check `GET /api/health` — `last_success_at` should update for each game.

---

## Part 2: Deploy to Cloudflare

### 1. Log in to Cloudflare

```bash
npx wrangler login
```

A browser window opens to authorize Wrangler with your account.

### 2. Create the production D1 database

```bash
npx wrangler d1 create price-checker
```

Wrangler prints a `database_id`. If it is not written into `wrangler.toml` automatically, add it:

```toml
[[d1_databases]]
binding = "DB"
database_name = "price-checker"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
migrations_dir = "migrations"
```

### 3. Apply migrations to production

```bash
npm run db:migrate:remote
```

Confirm when Wrangler asks whether to apply N migrations.

### 4. Set secrets

**Admin refresh token** — used for manual snapshot refresh and admin API routes:

```bash
npx wrangler secret put ADMIN_REFRESH_TOKEN
```

Enter a long random string. Save it somewhere secure; you need it for manual refreshes.

Secrets are per-Worker and not stored in the repo.

### 5. Seed production reference data

```bash
npm run sync:data -- --remote
```

The `--` passes `--remote` to the sync script so it writes to the cloud D1 database instead of local.

### 6. Backfill production history (first deploy only)

```bash
npm run backfill:history -- --remote
```

This may take a minute — it imports ~6 MB of history per game.

### 7. Deploy the Worker

```bash
npm run deploy
```

Wrangler uploads the Worker, static assets, and cron trigger. On success it prints a URL like:

```
https://price-checker.<your-subdomain>.workers.dev
```

### 8. Trigger the first snapshot refresh

After deploy, run a manual refresh so exchange data is in D1 immediately:

```bash
curl -X POST https://price-checker.<your-subdomain>.workers.dev/api/admin/refresh \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 9. Verify production

Same checks as local, using your deployed URL:

```bash
curl https://price-checker.<your-subdomain>.workers.dev/api/health
curl https://price-checker.<your-subdomain>.workers.dev/api/games
```

Open the site in a browser and confirm both game tabs load exchange data and the trends tab shows history.

### 10. Enable Workers Paid

1. Go to [Cloudflare dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Plans**
2. Upgrade to **Workers Paid** ($5/month)

Without Paid, the cron trigger will hit the 10 ms CPU limit and snapshots will not refresh on schedule.

### 11. Optional: custom domain

1. Dashboard → **Workers & Pages** → select **price-checker**
2. **Settings** → **Domains & Routes** → **Add** → **Custom domain**
3. Follow the DNS prompts

The Worker serves both the frontend and `/api/*` on the same domain.

### 12. Preview vs production databases

If you use Cloudflare preview deployments, create a **separate D1 database** for previews. A preview cron writing to production D1 would overwrite live snapshot data.

Pattern:

```bash
npx wrangler d1 create price-checker-preview
```

Use environment-specific Wrangler config or `--env` blocks to bind different `database_id` values per environment.

---

## Day-to-day operations

### Update gold costs or campaign checklist

1. Edit the JSON file under `data/`
2. Commit the change
3. Sync to the target database:

   ```bash
   # Local
   npm run sync:data

   # Production
   npm run sync:data -- --remote
   ```

Gold costs are manual only — there is no automatic scrape.

### Change league or game settings

League names and upstream URLs live in the `settings` table. Update without redeploying:

**Option A — Wrangler SQL:**

```bash
npx wrangler d1 execute price-checker --remote --command \
  "UPDATE settings SET value = '\"new-league\"' WHERE scope = 'poe2' AND key = 'league'"
```

**Option B — Admin API:**

```bash
curl -X POST https://your-domain/api/admin/settings/poe2/league \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "new-league"}'
```

Then trigger a refresh so the new league’s snapshot is fetched.

### Redeploy after code changes

```bash
npm run deploy
```

Migrations, sync, and secrets persist across deploys — you only re-run those when schema or data changes.

---

## Troubleshooting

### `npm: command not found`

Install Node.js 18+ from [nodejs.org](https://nodejs.org/) and restart your terminal.

### Exchange tab loads but trends are empty

Run `npm run backfill:history` (or `-- --remote` for production). Trends need rows in `history_pairs` and `price_totals`.

### `/api/snapshots/.../current` returns 404

No snapshot in D1 yet. Trigger `POST /api/admin/refresh` with a valid admin token, or wait for the cron.

### Cron not updating snapshots

- Confirm **Workers Paid** is active
- Check `GET /api/health` — look at `last_status` and `last_error` per game
- poe2scout may block Cloudflare egress IPs — see Phase 0 in the migration plan

### `sync:data` reports drift / exits with code 1

The database was modified outside the repo (via admin API or manual SQL). Either:

- Re-sync from repo: update `data_versions.externally_modified` and run sync again, or
- Accept the DB as source of truth and update the repo files to match

### Frontend shows old GitHub Pages behavior

You are either on `*.github.io` or have `?api=0` in the URL. Remove the query param or deploy to Cloudflare/localhost.

### Wrangler dev: port already in use

```bash
npx wrangler dev --port 8788
```

---

## Quick reference

| Task | Command |
| --- | --- |
| Install deps | `npm install` |
| Migrate local D1 | `npm run db:migrate:local` |
| Migrate production D1 | `npm run db:migrate:remote` |
| Seed reference data (local) | `npm run sync:data` |
| Seed reference data (production) | `npm run sync:data -- --remote` |
| Backfill history (local) | `npm run backfill:history` |
| Backfill history (production) | `npm run backfill:history -- --remote` |
| Start dev server | `npm run dev` |
| Run tests | `npm test` |
| Deploy | `npm run deploy` |
| Set admin token | `npx wrangler secret put ADMIN_REFRESH_TOKEN` |
| Manual refresh | `POST /api/admin/refresh` with `Authorization: Bearer …` |

---

## Related docs

- [cloudflare-migration-plan.md](cloudflare-migration-plan.md) — architecture and data model
- [README.md](../README.md) — project overview and API table
