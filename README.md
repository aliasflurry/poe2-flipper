# PoE 2 Exchange Path Finder

A static GitHub Pages tool that reads poe2scout exchange snapshot data and ranks the best 2-trade or 3-trade loops for a selected starting currency.

## How it works

- Each poe2scout pair contains two items and each item has a `RelativePrice` in Exalted Orb value.
- The app converts every pair into two directed trades.
- A route is profitable when multiplying the trade rates returns more of the starting currency than it began with.
- Volume and stock filters help remove routes that are likely too thin to execute.
- Gold costs are read from the selected game's data folder: `poe2_data/gold-costs.json` or `poe_data/gold-costs.json`.
- Price history is read from `price-history.json` in the selected game's data folder and appears when a result row is expanded.

## Deploy locally

The app is static, but it should be served through a local HTTP server so the browser can fetch the selected game's data files from `poe2_data/` or `poe_data/`.

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
3. Open the **Actions** tab and run **Update poe2scout snapshot** once.
4. In GitHub, open **Settings > Pages**.
5. Set **Source** to **Deploy from a branch**.
6. Choose your main branch and the root folder.

The exchange path finder is fully static, so no build step is required.

The browser cannot reliably fetch the poe2scout API directly because of CORS, so `.github/workflows/update-snapshot.yml` refreshes the local snapshot JSON files and commits them back to the repository. The workflow fetches live snapshot pairs every 30 minutes, but only appends a price-history snapshot four times a day. Each price-history snapshot records the per-pair price history (both currencies' relative prices and volume) alongside a flat item price map, and only the last 7 days are kept.

## Stash lookup proxy

The stash lookup calls the official trade API, which may be blocked by browser CORS. Deploy the app on a serverless host that supports Vercel-style API routes to enable `api/trade2/[...path].js`. The browser tries `/api/trade2` first and falls back to the direct trade API when the proxy is not available.

GitHub Pages can still host the exchange tool, but it cannot run this proxy endpoint by itself.
