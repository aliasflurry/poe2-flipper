export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  BUILD_VERSION: string;
  ADMIN_REFRESH_TOKEN?: string;
}

export type GameId = "poe2" | "poe";

export interface GameConfig {
  id: GameId;
  label: string;
  enabled: boolean;
  sortOrder: number;
  defaultStartCurrency: string;
  upstreamBase: string;
  realm: string;
  league: string;
  historyRetentionDays: number;
  historyAppendIntervalHours: number;
}

export interface StoredPair {
  id: number;
  one: string;
  two: string;
  onePrice: number;
  twoPrice: number;
  volume: number;
}

export interface StoredSnapshot {
  updatedAt: string;
  source: string;
  pairs: StoredPair[];
}

export interface ItemRow {
  api_id: string;
  text: string;
  icon_url: string | null;
  category_api_id: string | null;
}

export interface HistorySnapshot {
  updatedAt: string;
  prices: Record<string, number>;
  pairs: Record<string, {
    one: string;
    two: string;
    onePrice: number;
    twoPrice: number;
    volume: number;
  }>;
}
