import type { Env } from "../env";
import {
  badRequest,
  cachedJson,
  cacheHeaders,
  errorResponse,
  jsonResponse,
  makeEtag,
  notFound,
  readJsonBody,
  requireAdmin
} from "../lib/http";
import { getCampaignChecklistResponse, getGoldCostsResponse, replaceCampaignChecklist, replaceGoldCosts } from "../db/reference-data";
import { getCurrentSnapshotResponse, getItemsManifest } from "../db/snapshots";
import { getPairHistory, getPriceTotals } from "../db/trends";
import {
  isGameId,
  listEnabledGames,
  upsertSetting
} from "../lib/settings";
import { refreshAllGames } from "../cron/refresh";

export async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method.toUpperCase();

  if (pathname === "/api/health" && method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT game, last_refresh_at, last_success_at, last_status, last_error, last_history_append_at FROM refresh_state"
    ).all();
    return jsonResponse({
      ok: true,
      version: env.BUILD_VERSION,
      games: rows.results || []
    });
  }

  if (pathname === "/api/games" && method === "GET") {
    const games = await listEnabledGames(env.DB);
    return jsonResponse({
      games: games.map((game) => ({
        id: game.id,
        label: game.label,
        sortOrder: game.sortOrder,
        defaultStartCurrency: game.defaultStartCurrency
      }))
    }, { headers: cacheHeaders(60, 300) });
  }

  const snapshotMatch = pathname.match(/^\/api\/snapshots\/([^/]+)\/current$/);
  if (snapshotMatch && method === "GET") {
    const game = snapshotMatch[1];
    if (!isGameId(game)) return notFound("Unknown game");
    const snapshot = await getCurrentSnapshotResponse(env.DB, game);
    if (!snapshot) return notFound("Snapshot not found");
    const etag = makeEtag(snapshot.updatedAt || "empty");
    return cachedJson(
      request,
      `snapshot:${game}`,
      1800,
      etag,
      async () => snapshot,
      cacheHeaders(60, 1800)
    );
  }

  const itemsMatch = pathname.match(/^\/api\/items\/([^/]+)$/);
  if (itemsMatch && method === "GET") {
    const game = itemsMatch[1];
    if (!isGameId(game)) return notFound("Unknown game");
    const manifest = await getItemsManifest(env.DB, game);
    const etag = makeEtag(manifest.updatedAt || "empty");
    return cachedJson(
      request,
      `items:${game}`,
      86400,
      etag,
      async () => manifest,
      cacheHeaders(3600, 86400)
    );
  }

  const totalsMatch = pathname.match(/^\/api\/trends\/([^/]+)\/totals$/);
  if (totalsMatch && method === "GET") {
    const game = totalsMatch[1];
    if (!isGameId(game)) return notFound("Unknown game");
    const totals = await getPriceTotals(env.DB, game);
    const etag = makeEtag(`${totals.updatedAt || "empty"}:${totals.snapshotCount}`);
    return cachedJson(
      request,
      `totals:${game}`,
      1800,
      etag,
      async () => ({
        updatedAt: totals.updatedAt,
        snapshotCount: totals.snapshotCount,
        totalDifferences: totals.totalDifferences
      }),
      cacheHeaders(60, 1800)
    );
  }

  const pairMatch = pathname.match(/^\/api\/trends\/([^/]+)\/pair\/(.+)$/);
  if (pairMatch && method === "GET") {
    const game = pairMatch[1];
    const pairKey = decodeURIComponent(pairMatch[2]);
    if (!isGameId(game)) return notFound("Unknown game");
    if (!pairKey.includes(">")) return badRequest("Invalid pair key");
    const history = await getPairHistory(env.DB, game, pairKey);
    const etag = makeEtag(`${pairKey}:${history.points.at(-1)?.updatedAt || "empty"}`);
    return cachedJson(
      request,
      `pair:${game}:${pairKey}`,
      1800,
      etag,
      async () => history,
      cacheHeaders(60, 1800)
    );
  }

  const goldMatch = pathname.match(/^\/api\/data\/([^/]+)\/gold-costs$/);
  if (goldMatch && method === "GET") {
    const game = goldMatch[1];
    if (!isGameId(game)) return notFound("Unknown game");
    const payload = await getGoldCostsResponse(env.DB, game);
    if (!payload) return notFound("Gold costs not found");
    const etag = makeEtag(payload.updatedAt || "empty");
    return cachedJson(
      request,
      `gold:${game}`,
      86400,
      etag,
      async () => payload,
      cacheHeaders(3600, 86400)
    );
  }

  const campaignMatch = pathname.match(/^\/api\/data\/([^/]+)\/campaign-checklist$/);
  if (campaignMatch && method === "GET") {
    const game = campaignMatch[1];
    if (!isGameId(game)) return notFound("Unknown game");
    if (game !== "poe2") return notFound("Campaign checklist is only available for poe2");
    const payload = await getCampaignChecklistResponse(env.DB, game);
    if (!payload) return notFound("Campaign checklist not found");
    const etag = makeEtag(`${payload.updated || "empty"}:${payload.acts.length}`);
    return cachedJson(
      request,
      `campaign:${game}`,
      86400,
      etag,
      async () => payload,
      cacheHeaders(3600, 86400)
    );
  }

  if (pathname === "/api/admin/refresh" && method === "POST") {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    try {
      await refreshAllGames(env.DB);
      return jsonResponse({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return errorResponse(502, "Refresh failed", message);
    }
  }

  const settingsMatch = pathname.match(/^\/api\/admin\/settings\/([^/]+)\/([^/]+)$/);
  if (settingsMatch && method === "POST") {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    const scope = settingsMatch[1];
    const key = settingsMatch[2];
    const body = await readJsonBody<{ value?: unknown }>(request);
    if (!body || !("value" in body)) return badRequest("Missing value");
    await upsertSetting(env.DB, scope, key, body.value);
    return jsonResponse({ ok: true });
  }

  const dataMatch = pathname.match(/^\/api\/admin\/data\/([^/]+)\/([^/]+)$/);
  if (dataMatch && method === "POST") {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    const game = dataMatch[1];
    const key = dataMatch[2];
    if (!isGameId(game)) return badRequest("Unknown game");
    const body = await readJsonBody<Record<string, unknown>>(request);
    if (!body) return badRequest("Invalid JSON body");

    if (key === "gold-costs") {
      await replaceGoldCosts(env.DB, game, body as never);
    } else if (key === "campaign-checklist") {
      await replaceCampaignChecklist(env.DB, game, body as never);
    } else {
      return badRequest("Unknown data key");
    }

    await env.DB
      .prepare(
        `INSERT INTO data_versions (key, content_hash, applied_at, externally_modified)
         VALUES (?, ?, ?, 1)
         ON CONFLICT(key) DO UPDATE SET
           content_hash = excluded.content_hash,
           applied_at = excluded.applied_at,
           externally_modified = 1`
      )
      .bind(`${key}:${game}`, "external", new Date().toISOString())
      .run();

    return jsonResponse({ ok: true });
  }

  return notFound("Unknown API route");
}

export async function seedSettingsIfEmpty(env: Env): Promise<void> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM settings").first<{ count: number }>();
  if ((row?.count || 0) > 0) return;

  const settings = {
    global: {
      history_retention_days: 7,
      history_append_interval_hours: 2.5
    },
    poe2: {
      label: "Path of Exile 2",
      enabled: true,
      sort_order: 1,
      default_start_currency: "exalted",
      upstream_base: "https://api.poe2scout.com",
      realm: "poe2",
      league: "runes"
    },
    poe: {
      label: "Path of Exile",
      enabled: true,
      sort_order: 2,
      default_start_currency: "chaos",
      upstream_base: "https://api.poe2scout.com",
      realm: "pc",
      league: "allflame"
    }
  };

  const statements: D1PreparedStatement[] = [];
  const now = new Date().toISOString();
  for (const [scope, entries] of Object.entries(settings)) {
    for (const [key, value] of Object.entries(entries)) {
      statements.push(
        env.DB
          .prepare("INSERT INTO settings (scope, key, value, updated_at) VALUES (?, ?, ?, ?)")
          .bind(scope, key, JSON.stringify(value), now)
      );
    }
  }
  await env.DB.batch(statements);
}
