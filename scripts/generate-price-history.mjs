import { readFileSync, writeFileSync } from "node:fs";

const GAMES = [
  {
    snapshotPath: "data/poe2_data/snapshot.json",
    historyPath: "data/poe2_data/price-history.json",
    source: "https://api.poe2scout.com/poe2/Leagues/runes/SnapshotPairs"
  },
  {
    snapshotPath: "data/poe_data/snapshot.json",
    historyPath: "data/poe_data/price-history.json",
    source: "https://api.poe2scout.com/pc/Leagues/mirage/SnapshotPairs"
  }
];

const SNAPSHOT_COUNT = 28; // 7 days, four times a day
const STEP_MS = 6 * 60 * 60 * 1000; // every 6 hours
const MAX_STEP = 0.06; // up to +/-6% random walk per step

function getPairs(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.pairs)) return payload.pairs;
  if (Array.isArray(payload?.pairs?.value)) return payload.pairs.value;
  if (Array.isArray(payload?.value)) return payload.value;
  return [];
}

function toPrice(value) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function jitter(price, rng) {
  const factor = 1 + (rng() * 2 - 1) * MAX_STEP;
  return Math.max(price * factor, price * 0.2);
}

// Deterministic PRNG so re-runs are stable-ish per key.
function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildBase(pairs) {
  const items = new Map();
  const pairDefs = [];

  for (const pair of pairs) {
    const oneId = pair?.CurrencyOne?.ApiId;
    const twoId = pair?.CurrencyTwo?.ApiId;
    if (!oneId || !twoId) continue;

    const onePrice = toPrice(pair?.CurrencyOneData?.RelativePrice);
    const twoPrice = toPrice(pair?.CurrencyTwoData?.RelativePrice);
    if (onePrice === null || twoPrice === null) continue;

    const volume = Number(pair?.Volume) || 0;

    if (!items.has(oneId)) items.set(oneId, onePrice);
    if (!items.has(twoId)) items.set(twoId, twoPrice);

    pairDefs.push({ key: `${oneId}>${twoId}`, one: oneId, two: twoId, volume });
  }

  return { items, pairDefs };
}

function generate(game) {
  const payload = JSON.parse(readFileSync(game.snapshotPath, "utf8"));
  const pairs = getPairs(payload);
  const { items, pairDefs } = buildBase(pairs);

  if (!items.size) {
    console.warn(`No pairs found for ${game.snapshotPath}, skipping.`);
    return;
  }

  // Independent random walk per item, anchored so the final snapshot equals current price.
  const walks = new Map();
  for (const [itemId, current] of items) {
    const rng = makeRng(hashString(itemId));
    const series = new Array(SNAPSHOT_COUNT);
    series[SNAPSHOT_COUNT - 1] = current;
    for (let i = SNAPSHOT_COUNT - 2; i >= 0; i -= 1) {
      series[i] = jitter(series[i + 1], rng);
    }
    walks.set(itemId, series);
  }

  const now = Date.now();
  const snapshots = [];

  for (let i = 0; i < SNAPSHOT_COUNT; i += 1) {
    const stepsFromEnd = SNAPSHOT_COUNT - 1 - i;
    const updatedAt = new Date(now - stepsFromEnd * STEP_MS).toISOString();

    const prices = {};
    for (const [itemId, series] of walks) {
      prices[itemId] = Number(series[i].toFixed(8));
    }

    const pairMap = {};
    for (const def of pairDefs) {
      pairMap[def.key] = {
        one: def.one,
        two: def.two,
        onePrice: prices[def.one],
        twoPrice: prices[def.two],
        volume: def.volume
      };
    }

    snapshots.push({ updatedAt, prices, pairs: pairMap });
  }

  const output = {
    updatedAt: snapshots[snapshots.length - 1].updatedAt,
    source: game.source,
    snapshots
  };

  writeFileSync(game.historyPath, JSON.stringify(output), "utf8");
  console.log(
    `Wrote ${snapshots.length} snapshots (${items.size} items, ${pairDefs.length} pairs) to ${game.historyPath}`
  );
}

for (const game of GAMES) {
  generate(game);
}
