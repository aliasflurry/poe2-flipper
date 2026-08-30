import type { HistorySnapshot, ItemRow, StoredPair, StoredSnapshot } from "../env";
import { toNumber } from "./http";

type RawPair = {
  CurrencyExchangeSnapshotPairId?: number;
  Volume?: number;
  CurrencyOne?: { ApiId?: string; Text?: string; IconUrl?: string; CategoryApiId?: string };
  CurrencyTwo?: { ApiId?: string; Text?: string; IconUrl?: string; CategoryApiId?: string };
  CurrencyOneData?: { RelativePrice?: number; VolumeTraded?: number; HighestStock?: number };
  CurrencyTwoData?: { RelativePrice?: number; VolumeTraded?: number; HighestStock?: number };
};

export function extractSnapshotPairs(payload: unknown): RawPair[] {
  if (Array.isArray(payload)) return payload as RawPair[];
  const obj = payload as Record<string, unknown>;
  const pairs = obj.pairs as unknown;
  if (Array.isArray(pairs)) return pairs as RawPair[];
  if (pairs && typeof pairs === "object" && Array.isArray((pairs as { value?: unknown }).value)) {
    return (pairs as { value: RawPair[] }).value;
  }
  if (Array.isArray(obj.value)) return obj.value as RawPair[];
  return [];
}

export function buildPriceMap(pairs: RawPair[]): Record<string, number> {
  const prices: Record<string, number> = {};
  for (const pair of pairs) {
    const entries = [
      { item: pair.CurrencyOne, data: pair.CurrencyOneData },
      { item: pair.CurrencyTwo, data: pair.CurrencyTwoData }
    ];
    for (const entry of entries) {
      const apiId = entry.item?.ApiId;
      const price = toNumber(entry.data?.RelativePrice);
      if (apiId && price > 0) {
        prices[apiId] = price;
      }
    }
  }
  return prices;
}

export function buildPairMap(pairs: RawPair[]): Record<string, StoredPair & { one: string; two: string }> {
  const result: Record<string, StoredPair & { one: string; two: string }> = {};
  for (const pair of pairs) {
    const oneId = pair.CurrencyOne?.ApiId;
    const twoId = pair.CurrencyTwo?.ApiId;
    if (!oneId || !twoId) continue;

    const onePrice = toNumber(pair.CurrencyOneData?.RelativePrice);
    const twoPrice = toNumber(pair.CurrencyTwoData?.RelativePrice);
    const volume = toNumber(pair.Volume);
    if (onePrice <= 0 || twoPrice <= 0) continue;

    const key = `${oneId}>${twoId}`;
    result[key] = {
      id: toNumber(pair.CurrencyExchangeSnapshotPairId),
      one: oneId,
      two: twoId,
      onePrice,
      twoPrice,
      volume
    };
  }
  return result;
}

export function extractItemsFromPairs(pairs: RawPair[]): ItemRow[] {
  const items = new Map<string, ItemRow>();
  for (const pair of pairs) {
    for (const item of [pair.CurrencyOne, pair.CurrencyTwo]) {
      if (!item?.ApiId) continue;
      items.set(item.ApiId, {
        api_id: item.ApiId,
        text: item.Text || item.ApiId,
        icon_url: item.IconUrl || null,
        category_api_id: item.CategoryApiId || null
      });
    }
  }
  return [...items.values()];
}

export function normalizeSnapshotForStorage(
  pairs: RawPair[],
  updatedAt: string,
  source: string
): StoredSnapshot {
  const pairMap = buildPairMap(pairs);
  return {
    updatedAt,
    source,
    pairs: Object.values(pairMap)
  };
}

export function historySnapshotFromPairMap(
  updatedAt: string,
  prices: Record<string, number>,
  pairMap: ReturnType<typeof buildPairMap>
): HistorySnapshot {
  const pairs: HistorySnapshot["pairs"] = {};
  for (const [key, pair] of Object.entries(pairMap)) {
    pairs[key] = {
      one: pair.one,
      two: pair.two,
      onePrice: pair.onePrice,
      twoPrice: pair.twoPrice,
      volume: pair.volume
    };
  }
  return { updatedAt, prices, pairs };
}

export function expandSnapshotForClient(
  stored: StoredSnapshot,
  items: Map<string, ItemRow>
): { updatedAt: string; source: string; pairs: unknown[] } {
  const pairs = stored.pairs.map((pair) => {
    const one = items.get(pair.one);
    const two = items.get(pair.two);
    return {
      CurrencyExchangeSnapshotPairId: pair.id,
      Volume: pair.volume,
      CurrencyOne: {
        ApiId: pair.one,
        Text: one?.text || pair.one,
        IconUrl: one?.icon_url || "",
        CategoryApiId: one?.category_api_id || ""
      },
      CurrencyTwo: {
        ApiId: pair.two,
        Text: two?.text || pair.two,
        IconUrl: two?.icon_url || "",
        CategoryApiId: two?.category_api_id || ""
      },
      CurrencyOneData: {
        RelativePrice: pair.onePrice,
        VolumeTraded: 0,
        HighestStock: 0
      },
      CurrencyTwoData: {
        RelativePrice: pair.twoPrice,
        VolumeTraded: 0,
        HighestStock: 0
      }
    };
  });

  return {
    updatedAt: stored.updatedAt,
    source: stored.source,
    pairs
  };
}

export function pairRateAt(snapshot: HistorySnapshot, fromId: string, toId: string): number {
  const pairs = snapshot.pairs;
  const direct = pairs[`${fromId}>${toId}`];
  if (direct) {
    const rate = direct.onePrice / direct.twoPrice;
    if (Number.isFinite(rate) && rate > 0) return rate;
  }
  const reverse = pairs[`${toId}>${fromId}`];
  if (reverse) {
    const rate = reverse.twoPrice / reverse.onePrice;
    if (Number.isFinite(rate) && rate > 0) return rate;
  }
  const fromPrice = snapshot.prices[fromId];
  const toPrice = snapshot.prices[toId];
  if (fromPrice > 0 && toPrice > 0) return fromPrice / toPrice;
  return NaN;
}

export function totalDifferenceForPair(
  snapshots: HistorySnapshot[],
  fromId: string,
  toId: string
): number | null {
  let previous: number | null = null;
  let total = 0;
  let compared = 0;

  for (const snapshot of snapshots) {
    const rate = pairRateAt(snapshot, fromId, toId);
    if (!Number.isFinite(rate) || rate <= 0) continue;
    if (previous !== null) {
      total += Math.abs(rate - previous);
      compared += 1;
    }
    previous = rate;
  }

  return compared ? Number(total.toFixed(8)) : null;
}

export function computeTotalDifferences(snapshots: HistorySnapshot[]): Record<string, number> {
  const ordered = [...snapshots].sort(
    (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
  );
  const pairKeys = new Set<string>();
  for (const snapshot of ordered) {
    for (const key of Object.keys(snapshot.pairs || {})) {
      pairKeys.add(key);
    }
  }

  const totalDifferences: Record<string, number> = {};
  for (const key of pairKeys) {
    const separator = key.indexOf(">");
    if (separator < 1) continue;
    const one = key.slice(0, separator);
    const two = key.slice(separator + 1);
    if (!one || !two) continue;

    for (const [fromId, toId] of [
      [one, two],
      [two, one]
    ] as const) {
      const outKey = `${fromId}>${toId}`;
      if (outKey in totalDifferences) continue;
      const total = totalDifferenceForPair(ordered, fromId, toId);
      if (total !== null) totalDifferences[outKey] = total;
    }
  }

  return totalDifferences;
}
