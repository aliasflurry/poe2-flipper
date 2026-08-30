import type { Env, GameConfig, GameId } from "../env";
import { parseJsonValue } from "./http";

const GAME_IDS: GameId[] = ["poe2", "poe"];
const settingsCache = new Map<string, { expiresAt: number; config: GameConfig }>();
const CACHE_TTL_MS = 60_000;

export function listGameIds(): GameId[] {
  return [...GAME_IDS];
}

export function isGameId(value: string): value is GameId {
  return GAME_IDS.includes(value as GameId);
}

export async function getGlobalSetting<T>(db: D1Database, key: string, fallback: T): Promise<T> {
  const row = await db
    .prepare("SELECT value FROM settings WHERE scope = 'global' AND key = ?")
    .bind(key)
    .first<{ value: string }>();
  if (!row?.value) return fallback;
  return parseJsonValue<T>(row.value);
}

export async function getGameConfig(db: D1Database, gameId: GameId): Promise<GameConfig> {
  const cached = settingsCache.get(gameId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.config;
  }

  const rows = await db
    .prepare("SELECT scope, key, value FROM settings WHERE scope IN ('global', ?)")
    .bind(gameId)
    .all<{ scope: string; key: string; value: string }>();

  const merged = new Map<string, unknown>();
  for (const row of rows.results || []) {
    if (row.scope === "global") {
      merged.set(row.key, parseJsonValue(row.value));
    }
  }
  for (const row of rows.results || []) {
    if (row.scope === gameId) {
      merged.set(row.key, parseJsonValue(row.value));
    }
  }

  const config: GameConfig = {
    id: gameId,
    label: String(merged.get("label") || gameId),
    enabled: Boolean(merged.get("enabled")),
    sortOrder: Number(merged.get("sort_order") || 0),
    defaultStartCurrency: String(merged.get("default_start_currency") || ""),
    upstreamBase: String(merged.get("upstream_base") || "https://api.poe2scout.com"),
    realm: String(merged.get("realm") || ""),
    league: String(merged.get("league") || ""),
    historyRetentionDays: Number(merged.get("history_retention_days") || 7),
    historyAppendIntervalHours: Number(merged.get("history_append_interval_hours") || 2.5)
  };

  settingsCache.set(gameId, { expiresAt: Date.now() + CACHE_TTL_MS, config });
  return config;
}

export async function listEnabledGames(db: D1Database): Promise<GameConfig[]> {
  const configs = await Promise.all(GAME_IDS.map((id) => getGameConfig(db, id)));
  return configs.filter((game) => game.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function buildUpstreamUrl(config: GameConfig): string {
  return `${config.upstreamBase}/${config.realm}/Leagues/${config.league}/SnapshotPairs`;
}

export async function upsertSetting(
  db: D1Database,
  scope: string,
  key: string,
  value: unknown
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO settings (scope, key, value, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind(scope, key, JSON.stringify(value), now)
    .run();
  settingsCache.clear();
}

export async function seedSettingsFromObject(db: D1Database, payload: Record<string, Record<string, unknown>>): Promise<void> {
  const statements: D1PreparedStatement[] = [];
  const now = new Date().toISOString();
  for (const [scope, entries] of Object.entries(payload)) {
    for (const [key, value] of Object.entries(entries)) {
      statements.push(
        db
          .prepare(
            `INSERT INTO settings (scope, key, value, updated_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(scope, key) DO NOTHING`
          )
          .bind(scope, key, JSON.stringify(value), now)
      );
    }
  }
  if (statements.length) {
    await db.batch(statements);
  }
}

export function clearSettingsCache(): void {
  settingsCache.clear();
}

export async function ensureRefreshStateRows(db: D1Database): Promise<void> {
  const statements = listGameIds().map((game) =>
    db.prepare("INSERT OR IGNORE INTO refresh_state (game) VALUES (?)").bind(game)
  );
  await db.batch(statements);
}
