import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeTotalDifferences } from "./price-history-totals.mjs";
import { fetchBaseItems, refreshCatalog, resolvedName, unresolvedIds, UNKNOWN_ITEM } from "./item-catalog.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUTPUT_ROOT = process.argv[2] || ROOT;
const HOUR_SECONDS = 60 * 60;
const HISTORY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const HISTORY_GAP_MS = 2.5 * 60 * 60 * 1000;
const GAMES = [
  { directory: "poe_data", realm: "pc", league: "Covens" },
  { directory: "poe2_data", realm: "poe2", league: "Forbidden Rites" }
];

function sourceUrl(realm) {
  return `https://web.poecdn.com/api/currency-exchange${realm === "poe2" ? "/poe2" : ""}`;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value)}\n`);
}

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function itemFor(id, catalog) {
  const known = catalog[id];
  return {
    ApiId: id,
    BaseItemTypeId: id,
    Text: resolvedName(id, known?.name, known?.nameSource) || UNKNOWN_ITEM,
    NameSource: known?.nameSource || "catalog",
    IconUrl: known?.icon || "",
    CategoryApiId: known?.category || id.split("/")[2]?.toLowerCase() || "unknown"
  };
}

export function marketToPair(market, catalog = {}) {
  const [one, two] = market?.market_pair || [];
  if (!one || !two || one === two) return null;

  const rates = [market.lowest_ratio, market.highest_ratio]
    .map((ratio) => {
      const oneQuantity = positive(ratio?.[one]);
      const twoQuantity = positive(ratio?.[two]);
      return oneQuantity && twoQuantity ? twoQuantity / oneQuantity : null;
    })
    .filter((rate) => rate && Number.isFinite(rate));
  const oneVolume = positive(market.volume_traded?.[one]);
  const twoVolume = positive(market.volume_traded?.[two]);
  if (!rates.length || !oneVolume || !twoVolume) return null;

  const lowestRate = Math.min(...rates);
  const highestRate = Math.max(...rates);
  const rate = lowestRate;
  if (!Number.isFinite(rate) || rate <= 0) return null;

  return {
    CurrencyExchangeSnapshotPairId: market.market_id || `${one}|${two}`,
    Volume: Math.min(oneVolume, twoVolume),
    CurrencyOne: itemFor(one, catalog),
    CurrencyTwo: itemFor(two, catalog),
    CurrencyOneData: {
      RelativePrice: rate,
      RateToOther: lowestRate,
      VolumeTraded: oneVolume,
      HighestStock: Math.max(0, Number(market.highest_stock?.[one]) || 0)
    },
    CurrencyTwoData: {
      RelativePrice: 1,
      RateToOther: 1 / highestRate,
      VolumeTraded: twoVolume,
      HighestStock: Math.max(0, Number(market.highest_stock?.[two]) || 0)
    }
  };
}

export function historyEntry(pairs, updatedAt) {
  const pairMap = {};
  for (const pair of pairs) {
    const one = pair.CurrencyOne.ApiId;
    const two = pair.CurrencyTwo.ApiId;
    const onePrice = pair.CurrencyOneData.RelativePrice;
    const twoPrice = pair.CurrencyTwoData.RelativePrice;
    pairMap[`${one}>${two}`] = {
      one, two, onePrice, twoPrice,
      forwardRate: pair.CurrencyOneData.RateToOther,
      reverseRate: pair.CurrencyTwoData.RateToOther,
      volume: pair.Volume
    };
  }
  return { updatedAt, pairs: pairMap };
}

async function fetchLatestMarkets(game) {
  const source = sourceUrl(game.realm);
  const currentHour = Math.floor(Date.now() / 1000 / HOUR_SECONDS) * HOUR_SECONDS;
  for (let hoursBack = 1; hoursBack <= 4; hoursBack += 1) {
    const hour = currentHour - hoursBack * HOUR_SECONDS;
    const response = await fetch(`${source}/${hour}`, {
      headers: {
        accept: "application/json",
        "user-agent": "OAuth poe2-flipper/1.0.0 (contact: https://github.com/aliasflurry/poe2-flipper)"
      }
    });
    if (!response.ok) throw new Error(`${source}/${hour}: HTTP ${response.status}`);
    const payload = await response.json();
    const markets = Array.isArray(payload.markets)
      ? payload.markets.filter((market) => market.league === game.league)
      : [];
    if (markets.length) return { source, hour, markets };
  }
  throw new Error(`No ${game.league} markets found in the last four completed hours`);
}

async function updateGame(game) {
  const { source, hour, markets } = await fetchLatestMarkets(game);
  const directory = join(OUTPUT_ROOT, "data", game.directory);
  const snapshotPath = join(directory, "snapshot.json");
  const historyPath = join(directory, "price-history.json");
  const updatedAt = new Date(hour * 1000).toISOString();
  const catalogPath = join(directory, "item-catalog.json");
  const existingCatalog = readJson(catalogPath) || {};
  const localCatalog = readJson(join(ROOT, "data", game.directory, "item-catalog.json")) || {};
  for (const [id, item] of Object.entries(localCatalog)) {
    if (resolvedName(id, item?.name, item?.nameSource) || !resolvedName(id, existingCatalog[id]?.name, existingCatalog[id]?.nameSource)) {
      existingCatalog[id] = item;
    }
  }
  const ids = markets.flatMap((market) => market.market_pair || []);
  let baseItems = {};
  try {
    baseItems = await fetchBaseItems(game.realm === "poe2" ? "poe2" : "poe");
  } catch (error) {
    console.warn(`::warning::${game.league}: catalog refresh unavailable: ${error.message}`);
  }
  const catalog = refreshCatalog(existingCatalog, baseItems, ids);
  const missing = unresolvedIds(catalog, ids);
  if (missing.length) console.warn(`::warning::${game.league}: ${missing.length} unresolved item names: ${missing.join(", ")}`);
  const pairs = markets.map((market) => marketToPair(market, catalog)).filter(Boolean);
  if (!pairs.length) throw new Error(`No usable ${game.league} market pairs at ${updatedAt}`);

  const oldHistory = readJson(historyPath);
  const cutoff = hour * 1000 - HISTORY_WINDOW_MS;
  const snapshots = oldHistory?.source === source && oldHistory?.league === game.league
    ? (oldHistory.snapshots || []).filter((entry) => Date.parse(entry.updatedAt) >= cutoff)
    : [];
  const last = snapshots.at(-1);
  if (!last || hour * 1000 - Date.parse(last.updatedAt) >= HISTORY_GAP_MS) {
    snapshots.push(historyEntry(pairs, updatedAt));
  }

  mkdirSync(directory, { recursive: true });
  writeJson(catalogPath, catalog);
  writeJson(join(directory, "unresolved-items.json"), { updatedAt, ids: missing });
  writeJson(snapshotPath, { updatedAt, source, league: game.league, pairs });
  writeJson(historyPath, {
    updatedAt: snapshots.at(-1)?.updatedAt || updatedAt,
    source,
    league: game.league,
    totalDifferences: computeTotalDifferences(snapshots),
    snapshots
  });
  console.log(`${game.league}: wrote ${pairs.length} pairs for ${updatedAt}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const game of GAMES) await updateGame(game);
}
