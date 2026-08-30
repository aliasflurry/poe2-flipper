CREATE TABLE IF NOT EXISTS settings (
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (scope, key)
);

CREATE TABLE IF NOT EXISTS refresh_state (
  game TEXT NOT NULL PRIMARY KEY,
  last_refresh_at TEXT,
  last_success_at TEXT,
  last_status TEXT,
  last_error TEXT,
  last_history_append_at TEXT
);

CREATE TABLE IF NOT EXISTS data_versions (
  key TEXT NOT NULL PRIMARY KEY,
  content_hash TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  externally_modified INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gold_costs (
  game TEXT NOT NULL,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  slug TEXT,
  gold REAL NOT NULL,
  source TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (game, name)
);

CREATE INDEX IF NOT EXISTS idx_gold_costs_normalized ON gold_costs (game, name_normalized);

CREATE TABLE IF NOT EXISTS campaign_acts (
  game TEXT NOT NULL,
  act_id TEXT NOT NULL,
  num INTEGER NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (game, act_id)
);

CREATE TABLE IF NOT EXISTS campaign_areas (
  game TEXT NOT NULL,
  act_id TEXT NOT NULL,
  area_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  area_type TEXT,
  PRIMARY KEY (game, act_id, area_id)
);

CREATE TABLE IF NOT EXISTS campaign_objectives (
  game TEXT NOT NULL,
  act_id TEXT NOT NULL,
  area_id TEXT NOT NULL,
  objective_id TEXT NOT NULL,
  text TEXT NOT NULL,
  optional INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (game, act_id, area_id, objective_id)
);

CREATE TABLE IF NOT EXISTS campaign_objective_rewards (
  game TEXT NOT NULL,
  act_id TEXT NOT NULL,
  area_id TEXT NOT NULL,
  objective_id TEXT NOT NULL,
  text TEXT NOT NULL,
  type TEXT,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (game, act_id, area_id, objective_id, sort_order)
);

CREATE TABLE IF NOT EXISTS items (
  game TEXT NOT NULL,
  api_id TEXT NOT NULL,
  text TEXT NOT NULL,
  icon_url TEXT,
  category_api_id TEXT,
  PRIMARY KEY (game, api_id)
);

CREATE TABLE IF NOT EXISTS snapshots (
  game TEXT NOT NULL PRIMARY KEY,
  updated_at TEXT NOT NULL,
  source TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS history_points (
  game TEXT NOT NULL,
  ts TEXT NOT NULL,
  PRIMARY KEY (game, ts)
);

CREATE TABLE IF NOT EXISTS history_pairs (
  game TEXT NOT NULL,
  ts TEXT NOT NULL,
  pair_key TEXT NOT NULL,
  one_price REAL NOT NULL,
  two_price REAL NOT NULL,
  volume REAL,
  PRIMARY KEY (game, ts, pair_key)
);

CREATE INDEX IF NOT EXISTS idx_history_pairs_lookup ON history_pairs (game, pair_key, ts);

CREATE TABLE IF NOT EXISTS price_totals (
  game TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  total_diff REAL NOT NULL,
  PRIMARY KEY (game, from_id, to_id)
);
