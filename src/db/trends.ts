import type { HistorySnapshot } from "../env";
import { computeTotalDifferences, historySnapshotFromPairMap, buildPairMap, buildPriceMap, extractSnapshotPairs } from "../lib/snapshot";

export async function loadHistorySnapshots(db: D1Database, game: string): Promise<HistorySnapshot[]> {
  const points = await db
    .prepare("SELECT ts FROM history_points WHERE game = ? ORDER BY ts ASC")
    .bind(game)
    .all<{ ts: string }>();

  const snapshots: HistorySnapshot[] = [];
  for (const point of points.results || []) {
    const pairsResult = await db
      .prepare(
        `SELECT pair_key, one_price, two_price, volume
         FROM history_pairs WHERE game = ? AND ts = ?`
      )
      .bind(game, point.ts)
      .all<{ pair_key: string; one_price: number; two_price: number; volume: number | null }>();

    const pairs: HistorySnapshot["pairs"] = {};
    const prices: Record<string, number> = {};
    for (const row of pairsResult.results || []) {
      const separator = row.pair_key.indexOf(">");
      if (separator < 1) continue;
      const one = row.pair_key.slice(0, separator);
      const two = row.pair_key.slice(separator + 1);
      pairs[row.pair_key] = {
        one,
        two,
        onePrice: row.one_price,
        twoPrice: row.two_price,
        volume: row.volume ?? 0
      };
      if (one && row.one_price > 0) prices[one] = row.one_price;
      if (two && row.two_price > 0) prices[two] = row.two_price;
    }

    snapshots.push({ updatedAt: point.ts, prices, pairs });
  }

  return snapshots;
}

export async function savePriceTotals(
  db: D1Database,
  game: string,
  totals: Record<string, number>
): Promise<void> {
  await db.prepare("DELETE FROM price_totals WHERE game = ?").bind(game).run();
  const entries = Object.entries(totals);
  const statements = entries.map(([key, total]) => {
    const separator = key.indexOf(">");
    const fromId = key.slice(0, separator);
    const toId = key.slice(separator + 1);
    return db
      .prepare(
        "INSERT INTO price_totals (game, from_id, to_id, total_diff) VALUES (?, ?, ?, ?)"
      )
      .bind(game, fromId, toId, total);
  });
  for (let index = 0; index < statements.length; index += 100) {
    await db.batch(statements.slice(index, index + 100));
  }
}

export async function getPriceTotals(db: D1Database, game: string) {
  const rows = await db
    .prepare("SELECT from_id, to_id, total_diff FROM price_totals WHERE game = ?")
    .bind(game)
    .all<{ from_id: string; to_id: string; total_diff: number }>();

  const totalDifferences: Record<string, number> = {};
  for (const row of rows.results || []) {
    totalDifferences[`${row.from_id}>${row.to_id}`] = row.total_diff;
  }

  const snapshotCount = (
    await db
      .prepare("SELECT COUNT(*) AS count FROM history_points WHERE game = ?")
      .bind(game)
      .first<{ count: number }>()
  )?.count || 0;

  const updatedAt = (
    await db
      .prepare("SELECT MAX(ts) AS updated_at FROM history_points WHERE game = ?")
      .bind(game)
      .first<{ updated_at: string | null }>()
  )?.updated_at;

  return { updatedAt, snapshotCount, totalDifferences };
}

export async function getPairHistory(db: D1Database, game: string, requestedPairKey: string) {
  let rows = await db
    .prepare(
      `SELECT ts, one_price, two_price, volume, pair_key
       FROM history_pairs
       WHERE game = ? AND pair_key = ?
       ORDER BY ts ASC`
    )
    .bind(game, requestedPairKey)
    .all<{ ts: string; one_price: number; two_price: number; volume: number | null; pair_key: string }>();

  let reverse = false;
  let storedKey = requestedPairKey;
  if (!rows.results?.length) {
    const separator = requestedPairKey.indexOf(">");
    if (separator < 1) {
      return { pairKey: requestedPairKey, fromId: "", toId: "", points: [] };
    }
    const fromId = requestedPairKey.slice(0, separator);
    const toId = requestedPairKey.slice(separator + 1);
    storedKey = `${toId}>${fromId}`;
    rows = await db
      .prepare(
        `SELECT ts, one_price, two_price, volume, pair_key
         FROM history_pairs
         WHERE game = ? AND pair_key = ?
         ORDER BY ts ASC`
      )
      .bind(game, storedKey)
      .all();
    reverse = true;
  }

  const separator = requestedPairKey.indexOf(">");
  const fromId = requestedPairKey.slice(0, separator);
  const toId = requestedPairKey.slice(separator + 1);

  const points = (rows.results || [])
    .map((row) => {
      const rate = reverse
        ? row.two_price / row.one_price
        : row.one_price / row.two_price;
      if (!Number.isFinite(rate) || rate <= 0) return null;
      return {
        updatedAt: row.ts,
        rate,
        volume: row.volume ?? 0
      };
    })
    .filter(Boolean);

  return { pairKey: `${fromId}>${toId}`, fromId, toId, points };
}

export async function appendHistorySnapshot(
  db: D1Database,
  game: string,
  snapshot: HistorySnapshot
): Promise<void> {
  const statements: D1PreparedStatement[] = [
    db.prepare("INSERT OR REPLACE INTO history_points (game, ts) VALUES (?, ?)").bind(game, snapshot.updatedAt)
  ];

  for (const [pairKey, pair] of Object.entries(snapshot.pairs)) {
    statements.push(
      db
        .prepare(
          `INSERT OR REPLACE INTO history_pairs
           (game, ts, pair_key, one_price, two_price, volume)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(game, snapshot.updatedAt, pairKey, pair.onePrice, pair.twoPrice, pair.volume)
    );
  }

  for (let index = 0; index < statements.length; index += 100) {
    await db.batch(statements.slice(index, index + 100));
  }
}

export async function pruneHistory(db: D1Database, game: string, retentionDays: number): Promise<void> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  await db.prepare("DELETE FROM history_pairs WHERE game = ? AND ts < ?").bind(game, cutoff).run();
  await db.prepare("DELETE FROM history_points WHERE game = ? AND ts < ?").bind(game, cutoff).run();
}

export async function recomputeTotalsFromDb(db: D1Database, game: string): Promise<void> {
  const snapshots = await loadHistorySnapshots(db, game);
  const totals = computeTotalDifferences(snapshots);
  await savePriceTotals(db, game, totals);
}

export function historySnapshotFromRawPayload(
  updatedAt: string,
  payload: unknown
): HistorySnapshot {
  const pairs = extractSnapshotPairs(payload);
  const pairMap = buildPairMap(pairs);
  const prices = buildPriceMap(pairs);
  return historySnapshotFromPairMap(updatedAt, prices, pairMap);
}

export async function importHistoryFromJson(
  db: D1Database,
  game: string,
  payload: {
    snapshots?: HistorySnapshot[];
    totalDifferences?: Record<string, number>;
  }
): Promise<void> {
  await db.prepare("DELETE FROM history_pairs WHERE game = ?").bind(game).run();
  await db.prepare("DELETE FROM history_points WHERE game = ?").bind(game).run();
  await db.prepare("DELETE FROM price_totals WHERE game = ?").bind(game).run();

  for (const snapshot of payload.snapshots || []) {
    await appendHistorySnapshot(db, game, snapshot);
  }

  if (payload.totalDifferences && Object.keys(payload.totalDifferences).length) {
    await savePriceTotals(db, game, payload.totalDifferences);
  } else {
    await recomputeTotalsFromDb(db, game);
  }
}
