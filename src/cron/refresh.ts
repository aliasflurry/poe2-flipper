import type { GameId } from "../env";
import { upsertItems, saveSnapshot } from "../db/snapshots";
import {
  appendHistorySnapshot,
  pruneHistory,
  recomputeTotalsFromDb
} from "../db/trends";
import {
  buildUpstreamUrl,
  ensureRefreshStateRows,
  getGameConfig,
  listGameIds
} from "../lib/settings";
import {
  extractItemsFromPairs,
  extractSnapshotPairs,
  historySnapshotFromPairMap,
  buildPairMap,
  buildPriceMap,
  normalizeSnapshotForStorage
} from "../lib/snapshot";

const USER_AGENT = "PriceChecker/1.0.0 (contact: price-checker@local.dev)";

async function getRefreshState(db: D1Database, game: string) {
  return db
    .prepare(
      "SELECT last_history_append_at FROM refresh_state WHERE game = ?"
    )
    .bind(game)
    .first<{ last_history_append_at: string | null }>();
}

async function setRefreshState(
  db: D1Database,
  game: string,
  fields: {
    lastRefreshAt: string;
    lastSuccessAt?: string | null;
    lastStatus: string;
    lastError?: string | null;
    lastHistoryAppendAt?: string | null;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO refresh_state
       (game, last_refresh_at, last_success_at, last_status, last_error, last_history_append_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(game) DO UPDATE SET
         last_refresh_at = excluded.last_refresh_at,
         last_success_at = excluded.last_success_at,
         last_status = excluded.last_status,
         last_error = excluded.last_error,
         last_history_append_at = COALESCE(excluded.last_history_append_at, refresh_state.last_history_append_at)`
    )
    .bind(
      game,
      fields.lastRefreshAt,
      fields.lastSuccessAt ?? null,
      fields.lastStatus,
      fields.lastError ?? null,
      fields.lastHistoryAppendAt ?? null
    )
    .run();
}

export async function refreshGame(db: D1Database, gameId: GameId): Promise<void> {
  const config = await getGameConfig(db, gameId);
  if (!config.enabled) return;

  const now = new Date();
  const nowIso = now.toISOString();
  const upstreamUrl = buildUpstreamUrl(config);

  try {
    const response = await fetch(upstreamUrl, {
      headers: {
        accept: "application/json",
        "user-agent": USER_AGENT
      }
    });

    if (!response.ok) {
      throw new Error(`Upstream HTTP ${response.status}`);
    }

    const payload = await response.json();
    const rawPairs = extractSnapshotPairs(payload);
    const storedSnapshot = normalizeSnapshotForStorage(rawPairs, nowIso, upstreamUrl);
    const items = extractItemsFromPairs(rawPairs);

    await upsertItems(db, gameId, items);
    await saveSnapshot(db, gameId, storedSnapshot);

    const refreshState = await getRefreshState(db, gameId);
    const appendIntervalMs = config.historyAppendIntervalHours * 60 * 60 * 1000;
    const lastAppend = refreshState?.last_history_append_at
      ? new Date(refreshState.last_history_append_at).getTime()
      : 0;
    const shouldAppend = !lastAppend || now.getTime() - lastAppend >= appendIntervalMs;

    let lastHistoryAppendAt = refreshState?.last_history_append_at || null;
    if (shouldAppend) {
      const pairMap = buildPairMap(rawPairs);
      const prices = buildPriceMap(rawPairs);
      const historySnapshot = historySnapshotFromPairMap(nowIso, prices, pairMap);
      await appendHistorySnapshot(db, gameId, historySnapshot);
      lastHistoryAppendAt = nowIso;
    }

    await pruneHistory(db, gameId, config.historyRetentionDays);
    await recomputeTotalsFromDb(db, gameId);

    await setRefreshState(db, gameId, {
      lastRefreshAt: nowIso,
      lastSuccessAt: nowIso,
      lastStatus: "ok",
      lastError: null,
      lastHistoryAppendAt
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setRefreshState(db, gameId, {
      lastRefreshAt: nowIso,
      lastStatus: "error",
      lastError: message
    });
    throw error;
  }
}

export async function refreshAllGames(db: D1Database): Promise<void> {
  await ensureRefreshStateRows(db);
  for (const gameId of listGameIds()) {
    const config = await getGameConfig(db, gameId);
    if (config.enabled) {
      await refreshGame(db, gameId);
    }
  }
}

