# PoE 2 Exchange Path Finder

A static GitHub Pages tool that reads poe2scout exchange snapshot data and ranks the best 2-trade or 3-trade loops for a selected starting currency.

## How it works

- Each poe2scout pair contains two items and each item has a `RelativePrice` in Exalted Orb value.
- The app converts every pair into two directed trades.
- A route is profitable when multiplying the trade rates returns more of the starting currency than it began with.
- Volume and stock filters help remove routes that are likely too thin to execute.
- Gold costs are read from `data/gold-costs.json`, generated from `https://poe2db.tw/Currency_Exchange`.

## Publish on GitHub Pages

1. Create a GitHub repository.
2. Push this folder to the repository.
3. Open the **Actions** tab and run **Update poe2scout snapshot** once.
4. In GitHub, open **Settings > Pages**.
5. Set **Source** to **Deploy from a branch**.
6. Choose your main branch and the root folder.

The site is fully static, so no build step is required.

The browser cannot reliably fetch the poe2scout API directly because of CORS, so `.github/workflows/update-snapshot.yml` refreshes `data/snapshot.json` every 30 minutes and commits it back to the repository.
