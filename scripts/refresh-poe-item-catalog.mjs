import { readFileSync, writeFileSync } from "node:fs";
import { fetchBaseItems, refreshCatalog, unresolvedIds } from "./item-catalog.mjs";

const NINJA_URL = "https://poe.ninja/poe1/api/economy/exchange/current/overview";
const NINJA_TYPES = [
  "Currency", "Fragment", "Runegraft", "AllflameEmber", "Tattoo", "Omen",
  "DjinnCoin", "Ducat", "EnshroudingCrystal", "DivinationCard", "Artifact",
  "Oil", "DeliriumOrb", "Scarab", "Astrolabe", "Thread", "Fossil",
  "Resonator", "Essence"
];
const HEADERS = { "user-agent": "poe2-flipper/1.0 (https://github.com/aliasflurry/poe2-flipper)" };
const NINJA_ID_BY_ITEM_ID = {
  "Metadata/Items/Currency/CurrencyEssenceUber1": "essence-of-trickery",
  "Metadata/Items/MapFragments/AtlasAllflamePack": "allflame-ember-of-the-multitude",
  "Metadata/Items/MapFragments/CloisterAllflamePack": "allflame-ember-of-the-cloister",
  "Metadata/Items/MapFragments/CurrencyAuguryBossKey": "cursed-poppet",
  "Metadata/Items/MapFragments/PantheonAllflamePack": "allflame-ember-of-the-divine"
};

async function getJson(url) {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

function normalized(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function fallbackName(id) {
  return id.split("/").at(-1)
    .replace(/^(Currency|DivinationCard|MapFragment)/, "")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2").trim();
}

function directIcon(baseItem) {
  const art = baseItem?.visual_identity?.dds_file;
  return art ? `https://web.poecdn.com/image/${art.replace(/\.dds$/i, ".png")}` : "";
}

function imageArt(item) {
  const encoded = item.image?.match(/\/gen\/image\/([^/]+)/)?.[1];
  if (!encoded) return "";
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))?.[2]?.f || "";
  } catch {
    return "";
  }
}

function itemFromNinja(id, ninjaItems) {
  const explicitId = NINJA_ID_BY_ITEM_ID[id];
  if (explicitId) return ninjaItems.find((item) => item.id === explicitId);

  const thread = id.match(/\/Threads\/Thread(.+)$/)?.[1];
  if (thread) return ninjaItems.find((item) => normalized(item.name) === normalized(`${thread} Thread`));

  const astrolabe = id.match(/\/Currency\/Astrolabe(.+)$/)?.[1];
  if (astrolabe) {
    return ninjaItems.find((item) => normalized(imageArt(item).split("/").at(-1)) === normalized(`AtlasMission${astrolabe}`));
  }
  return null;
}

async function latestMarkets(game) {
  const hour = Math.floor(Date.now() / 3_600_000) * 3600;
  for (let back = 1; back <= 4; back += 1) {
    const payload = await getJson(`https://web.poecdn.com/api/currency-exchange${game.id === "poe2" ? "/poe2" : ""}/${hour - back * 3600}`);
    const markets = payload.markets?.filter((market) => market.league === game.league) || [];
    if (markets.length) return markets;
  }
  throw new Error(`No recent ${game.league} markets found`);
}

async function main(game) {
  const CATALOG_PATH = new URL(`../data/${game.id}_data/item-catalog.json`, import.meta.url);
  const SNAPSHOT_URL = `https://raw.githubusercontent.com/aliasflurry/poe2-flipper/snapshots/data/${game.id}_data/snapshot.json`;
  const existing = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  const [baseItems, markets, snapshot] = await Promise.all([
    fetchBaseItems(game.id), latestMarkets(game), getJson(SNAPSHOT_URL)
  ]);
  const snapshotIds = (snapshot.pairs || []).flatMap((pair) => [pair.CurrencyOne?.ApiId, pair.CurrencyTwo?.ApiId]);
  const ids = [...new Set([...markets.flatMap((market) => market.market_pair || []), ...snapshotIds].filter(Boolean))].sort();
  const ninjaItems = [];
  for (const type of game.id === "poe" ? NINJA_TYPES : []) {
    const url = `${NINJA_URL}?league=Covens&type=${type}`;
    const data = await getJson(url);
    ninjaItems.push(...(data.items || []));
  }
  const byName = new Map();
  for (const item of ninjaItems) {
    const key = normalized(item.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(item);
  }

  const catalog = refreshCatalog(existing, baseItems, ids);
  for (const id of ids) {
    const baseName = baseItems[id]?.name;
    const matchedById = !baseName ? itemFromNinja(id, ninjaItems) : null;
    const candidateName = baseName || matchedById?.name || fallbackName(id);
    const matches = byName.get(normalized(candidateName)) || [];
    const unique = matchedById || (matches.length === 1 ? matches[0] : null);
    const icon = unique?.image
      ? new URL(unique.image, "https://web.poecdn.com").href
      : directIcon(baseItems[id]);
    if (unique?.name && !baseName) {
      catalog[id].name = unique.name;
      catalog[id].nameSource = "verified";
    }
    if (icon) catalog[id].icon = icon;
  }

  const unresolved = unresolvedIds(catalog, ids);
  console.log(`${game.id}: Market IDs: ${ids.length}; unresolved names: ${unresolved.length}`);
  console.log(JSON.stringify(unresolved, null, 2));
  if (process.argv.includes("--write")) {
    writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog)}\n`);
  }
}

for (const game of [{ id: "poe", league: "Covens" }, { id: "poe2", league: "Forbidden Rites" }]) {
  await main(game);
}
