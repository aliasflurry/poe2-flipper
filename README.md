# PoE 2 Exchange Path Finder

A static GitHub Pages tool that reads the official Path of Exile Currency Exchange hourly history and ranks 2-trade or 3-trade loops for a selected starting currency.

## How it works

- Each official market digest gives a range of ratios, traded volume, and stock for two items. The app uses the conservative end of the hourly range for each trade direction; these historical estimates are not live quotes.
- The app converts every pair into two directed trades.
- A route is profitable when multiplying the trade rates returns more of the starting currency than it began with.
- Volume and stock filters help remove routes that are likely too thin to execute.
- Gold costs are read from the selected game's data folder: `poe2_data/gold-costs.json` or `poe_data/gold-costs.json`.
- Price history is read from the `snapshots` branch and appears when a result row is expanded.
- Known names and icons come from local catalogs migrated from earlier snapshots. Items missing from the catalogs use readable names derived from their exchange IDs.

## Deploy locally

The app is static, but it should be served through a local HTTP server so the browser can fetch the selected game's local data files and the published snapshot files.

From the project root, run one of these commands:

```bash
python -m http.server 8000
```

or:

```bash
npx serve .
```

Then open `http://localhost:8000` in your browser. If port `8000` is already in use, choose another port, for example:

```bash
python -m http.server 8080
```

No build step is required.

## Publish on GitHub Pages

1. Create a GitHub repository.
2. Push this folder to the repository.
3. Push the `snapshots` branch.
4. Open the **Actions** tab and run **Update official exchange snapshots** once.
5. In GitHub, open **Settings > Pages**.
6. Set **Source** to **Deploy from a branch**.
7. Choose your main branch and the root folder.

The exchange path finder is fully static, so no build step is required.

The official Currency Exchange feed publishes completed hourly digests and cannot be fetched directly by this browser app. `.github/workflows/update-snapshot.yml` reads the PoE1 `Covens` and PoE2 `Forbidden Rites` markets each hour, converts them into app snapshots, and commits them to the `snapshots` branch. `main` keeps the app source clean, while generated history lives separately. Price history is sampled every 3 hours and retains the last 7 days. The file also stores a `totalDifferences` map (`from>to` → sum of absolute consecutive rate changes) over that window, which Price trends uses for sorting.

## Stash lookup proxy

The stash lookup calls the official trade API, which may be blocked by browser CORS. Deploy the app on a serverless host that supports Vercel-style API routes to enable `api/trade2/[...path].js`. The browser tries `/api/trade2` first and falls back to the direct trade API when the proxy is not available.

GitHub Pages can still host the exchange tool, but it cannot run this proxy endpoint by itself.
