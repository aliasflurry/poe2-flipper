import type { ItemRow, StoredSnapshot } from "../env";
import { parseJsonValue } from "../lib/http";
import { expandSnapshotForClient } from "../lib/snapshot";

export async function getItemsMap(db: D1Database, game: string): Promise<Map<string, ItemRow>> {
  const result = await db
    .prepare("SELECT api_id, text, icon_url, category_api_id FROM items WHERE game = ?")
    .bind(game)
    .all<ItemRow>();
  const map = new Map<string, ItemRow>();
  for (const row of result.results || []) {
    map.set(row.api_id, row);
  }
  return map;
}

export async function upsertItems(db: D1Database, game: string, items: ItemRow[]): Promise<void> {
  const statements = items.map((item) =>
    db
      .prepare(
        `INSERT INTO items (game, api_id, text, icon_url, category_api_id)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(game, api_id) DO UPDATE SET
           text = excluded.text,
           icon_url = excluded.icon_url,
           category_api_id = excluded.category_api_id`
      )
      .bind(game, item.api_id, item.text, item.icon_url, item.category_api_id)
  );
  for (let index = 0; index < statements.length; index += 100) {
    await db.batch(statements.slice(index, index + 100));
  }
}

export async function getStoredSnapshot(db: D1Database, game: string): Promise<StoredSnapshot | null> {
  const row = await db
    .prepare("SELECT updated_at, source, payload_json FROM snapshots WHERE game = ?")
    .bind(game)
    .first<{ updated_at: string; source: string; payload_json: string }>();
  if (!row) return null;
  const payload = parseJsonValue<StoredSnapshot>(row.payload_json);
  return {
    updatedAt: row.updated_at,
    source: row.source,
    pairs: payload.pairs || []
  };
}

export async function saveSnapshot(
  db: D1Database,
  game: string,
  snapshot: StoredSnapshot
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO snapshots (game, updated_at, source, payload_json)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(game) DO UPDATE SET
         updated_at = excluded.updated_at,
         source = excluded.source,
         payload_json = excluded.payload_json`
    )
    .bind(game, snapshot.updatedAt, snapshot.source, JSON.stringify({ pairs: snapshot.pairs }))
    .run();
}

export async function getCurrentSnapshotResponse(db: D1Database, game: string) {
  const stored = await getStoredSnapshot(db, game);
  if (!stored) return null;
  const items = await getItemsMap(db, game);
  return expandSnapshotForClient(stored, items);
}

export async function getItemsManifest(db: D1Database, game: string) {
  const items = await getItemsMap(db, game);
  const updatedAt = (
    await db.prepare("SELECT updated_at FROM snapshots WHERE game = ?").bind(game).first<{ updated_at: string }>()
  )?.updated_at;
  const manifest: Record<string, { text: string; iconUrl: string | null; categoryApiId: string | null }> = {};
  for (const [apiId, item] of items.entries()) {
    manifest[apiId] = {
      text: item.text,
      iconUrl: item.icon_url,
      categoryApiId: item.category_api_id
    };
  }
  return { updatedAt: updatedAt || null, items: manifest };
}
