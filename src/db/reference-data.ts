import { normalizeName } from "../lib/http";

interface GoldCostsFile {
  updatedAt?: string;
  source?: string;
  costs?: Array<{ name?: string; slug?: string; gold?: number }>;
}

export async function getGoldCostsResponse(db: D1Database, game: string) {
  const rows = await db
    .prepare(
      "SELECT name, slug, gold, source, updated_at FROM gold_costs WHERE game = ? ORDER BY name ASC"
    )
    .bind(game)
    .all<{ name: string; slug: string | null; gold: number; source: string | null; updated_at: string }>();

  if (!rows.results?.length) return null;

  const updatedAt = rows.results[0]?.updated_at || null;
  const source = rows.results[0]?.source || null;
  return {
    updatedAt,
    source,
    costs: rows.results.map((row) => ({
      name: row.name,
      slug: row.slug,
      gold: row.gold
    }))
  };
}

export async function replaceGoldCosts(db: D1Database, game: string, payload: GoldCostsFile): Promise<void> {
  await db.prepare("DELETE FROM gold_costs WHERE game = ?").bind(game).run();
  const updatedAt = payload.updatedAt || new Date().toISOString();
  const source = payload.source || null;
  const statements = (payload.costs || []).map((entry) =>
    db
      .prepare(
        `INSERT INTO gold_costs (game, name, name_normalized, slug, gold, source, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        game,
        entry.name,
        normalizeName(entry.name || ""),
        entry.slug || null,
        Number(entry.gold),
        source,
        updatedAt
      )
  );
  for (let index = 0; index < statements.length; index += 100) {
    await db.batch(statements.slice(index, index + 100));
  }
}

interface CampaignFile {
  version?: number;
  updated?: string;
  acts?: Array<{
    id: string;
    num: number;
    title: string;
    areas?: Array<{
      id: string;
      name: string;
      type?: string;
      objectives?: Array<{
        id: string;
        text: string;
        optional?: boolean;
        rewards?: Array<{ text: string; type?: string }>;
      }>;
    }>;
  }>;
}

export async function getCampaignChecklistResponse(db: D1Database, game: string) {
  const acts = await db
    .prepare(
      "SELECT act_id, num, title, sort_order FROM campaign_acts WHERE game = ? ORDER BY sort_order ASC"
    )
    .bind(game)
    .all<{ act_id: string; num: number; title: string; sort_order: number }>();

  if (!acts.results?.length) return null;

  const areas = await db
    .prepare(
      "SELECT act_id, area_id, name, sort_order, area_type FROM campaign_areas WHERE game = ? ORDER BY sort_order ASC"
    )
    .bind(game)
    .all<{ act_id: string; area_id: string; name: string; sort_order: number; area_type: string | null }>();

  const objectives = await db
    .prepare(
      `SELECT act_id, area_id, objective_id, text, optional, sort_order
       FROM campaign_objectives WHERE game = ? ORDER BY sort_order ASC`
    )
    .bind(game)
    .all<{
      act_id: string;
      area_id: string;
      objective_id: string;
      text: string;
      optional: number;
      sort_order: number;
    }>();

  const rewards = await db
    .prepare(
      `SELECT act_id, area_id, objective_id, text, type, sort_order
       FROM campaign_objective_rewards WHERE game = ? ORDER BY sort_order ASC`
    )
    .bind(game)
    .all<{
      act_id: string;
      area_id: string;
      objective_id: string;
      text: string;
      type: string | null;
      sort_order: number;
    }>();

  const rewardsByObjective = new Map<string, Array<{ text: string; type?: string }>>();
  for (const reward of rewards.results || []) {
    const key = `${reward.act_id}.${reward.area_id}.${reward.objective_id}`;
    if (!rewardsByObjective.has(key)) rewardsByObjective.set(key, []);
    rewardsByObjective.get(key)!.push({
      text: reward.text,
      ...(reward.type ? { type: reward.type } : {})
    });
  }

  const objectivesByArea = new Map<string, Array<Record<string, unknown>>>();
  for (const objective of objectives.results || []) {
    const key = `${objective.act_id}.${objective.area_id}`;
    if (!objectivesByArea.has(key)) objectivesByArea.set(key, []);
    const entry: Record<string, unknown> = {
      id: objective.objective_id,
      text: objective.text
    };
    if (objective.optional) entry.optional = true;
    const rewardList = rewardsByObjective.get(`${objective.act_id}.${objective.area_id}.${objective.objective_id}`);
    if (rewardList?.length) entry.rewards = rewardList;
    objectivesByArea.get(key)!.push(entry);
  }

  const areasByAct = new Map<string, Array<Record<string, unknown>>>();
  for (const area of areas.results || []) {
    if (!areasByAct.has(area.act_id)) areasByAct.set(area.act_id, []);
    const entry: Record<string, unknown> = {
      id: area.area_id,
      name: area.name,
      objectives: objectivesByArea.get(`${area.act_id}.${area.area_id}`) || []
    };
    if (area.area_type) entry.type = area.area_type;
    areasByAct.get(area.act_id)!.push(entry);
  }

  const versionRow = await db
    .prepare("SELECT applied_at FROM data_versions WHERE key = ?")
    .bind(`campaign-checklist:${game}`)
    .first<{ applied_at: string | null }>();

  return {
    version: 3,
    updated: versionRow?.applied_at?.slice(0, 10) || null,
    acts: (acts.results || []).map((act) => ({
      id: act.act_id,
      num: act.num,
      title: act.title,
      areas: areasByAct.get(act.act_id) || []
    }))
  };
}

export async function replaceCampaignChecklist(db: D1Database, game: string, payload: CampaignFile): Promise<void> {
  await db.prepare("DELETE FROM campaign_objective_rewards WHERE game = ?").bind(game).run();
  await db.prepare("DELETE FROM campaign_objectives WHERE game = ?").bind(game).run();
  await db.prepare("DELETE FROM campaign_areas WHERE game = ?").bind(game).run();
  await db.prepare("DELETE FROM campaign_acts WHERE game = ?").bind(game).run();

  const statements: D1PreparedStatement[] = [];
  for (const [actIndex, act] of (payload.acts || []).entries()) {
    statements.push(
      db
        .prepare(
          "INSERT INTO campaign_acts (game, act_id, num, title, sort_order) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(game, act.id, act.num, act.title, actIndex)
    );

    for (const [areaIndex, area] of (act.areas || []).entries()) {
      statements.push(
        db
          .prepare(
            `INSERT INTO campaign_areas (game, act_id, area_id, name, sort_order, area_type)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(game, act.id, area.id, area.name, areaIndex, area.type || null)
      );

      for (const [objectiveIndex, objective] of (area.objectives || []).entries()) {
        statements.push(
          db
            .prepare(
              `INSERT INTO campaign_objectives
               (game, act_id, area_id, objective_id, text, optional, sort_order)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              game,
              act.id,
              area.id,
              objective.id,
              objective.text,
              objective.optional ? 1 : 0,
              objectiveIndex
            )
        );

        for (const [rewardIndex, reward] of (objective.rewards || []).entries()) {
          statements.push(
            db
              .prepare(
                `INSERT INTO campaign_objective_rewards
                 (game, act_id, area_id, objective_id, text, type, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
              )
              .bind(game, act.id, area.id, objective.id, reward.text, reward.type || null, rewardIndex)
          );
        }
      }
    }
  }

  for (let index = 0; index < statements.length; index += 100) {
    await db.batch(statements.slice(index, index + 100));
  }
}
