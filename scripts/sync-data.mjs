import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");
const remote = process.argv.includes("--remote");
const target = remote ? "--remote" : "--local";

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function runWrangler(args) {
  execFileSync("npx", ["wrangler", "d1", "execute", "price-checker", target, ...args], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
}

function queryScalar(sql) {
  const dir = mkdtempSync(join(tmpdir(), "pc-sync-"));
  const file = join(dir, "query.sql");
  writeFileSync(file, sql);
  try {
    const output = execFileSync(
      "npx",
      ["wrangler", "d1", "execute", "price-checker", target, "--file", file, "--json"],
      { cwd: root, encoding: "utf8", shell: process.platform === "win32" }
    );
    const parsed = JSON.parse(output);
    const result = parsed?.[0]?.results?.[0];
    return result || null;
  } catch {
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function buildGoldCostsSql(game, payload) {
  const lines = [`DELETE FROM gold_costs WHERE game = ${sqlString(game)};`];
  const updatedAt = payload.updatedAt || new Date().toISOString();
  const source = payload.source || null;
  for (const entry of payload.costs || []) {
    const normalized = String(entry.name || "")
      .toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    lines.push(
      `INSERT INTO gold_costs (game, name, name_normalized, slug, gold, source, updated_at) VALUES (${[
        sqlString(game),
        sqlString(entry.name),
        sqlString(normalized),
        entry.slug ? sqlString(entry.slug) : "NULL",
        Number(entry.gold),
        source ? sqlString(source) : "NULL",
        sqlString(updatedAt)
      ].join(", ")});`
    );
  }
  return lines.join("\n");
}

function buildCampaignSql(game, payload) {
  const lines = [
    `DELETE FROM campaign_objective_rewards WHERE game = ${sqlString(game)};`,
    `DELETE FROM campaign_objectives WHERE game = ${sqlString(game)};`,
    `DELETE FROM campaign_areas WHERE game = ${sqlString(game)};`,
    `DELETE FROM campaign_acts WHERE game = ${sqlString(game)};`
  ];

  for (const [actIndex, act] of (payload.acts || []).entries()) {
    lines.push(
      `INSERT INTO campaign_acts (game, act_id, num, title, sort_order) VALUES (${[
        sqlString(game),
        sqlString(act.id),
        act.num,
        sqlString(act.title),
        actIndex
      ].join(", ")});`
    );

    for (const [areaIndex, area] of (act.areas || []).entries()) {
      lines.push(
        `INSERT INTO campaign_areas (game, act_id, area_id, name, sort_order, area_type) VALUES (${[
          sqlString(game),
          sqlString(act.id),
          sqlString(area.id),
          sqlString(area.name),
          areaIndex,
          area.type ? sqlString(area.type) : "NULL"
        ].join(", ")});`
      );

      for (const [objectiveIndex, objective] of (area.objectives || []).entries()) {
        lines.push(
          `INSERT INTO campaign_objectives (game, act_id, area_id, objective_id, text, optional, sort_order) VALUES (${[
            sqlString(game),
            sqlString(act.id),
            sqlString(area.id),
            sqlString(objective.id),
            sqlString(objective.text),
            objective.optional ? 1 : 0,
            objectiveIndex
          ].join(", ")});`
        );

        for (const [rewardIndex, reward] of (objective.rewards || []).entries()) {
          lines.push(
            `INSERT INTO campaign_objective_rewards (game, act_id, area_id, objective_id, text, type, sort_order) VALUES (${[
              sqlString(game),
              sqlString(act.id),
              sqlString(area.id),
              sqlString(objective.id),
              sqlString(reward.text),
              reward.type ? sqlString(reward.type) : "NULL",
              rewardIndex
            ].join(", ")});`
          );
        }
      }
    }
  }

  return lines.join("\n");
}

function buildSettingsSql(payload) {
  const lines = [];
  const now = new Date().toISOString();
  for (const [scope, entries] of Object.entries(payload)) {
    for (const [key, value] of Object.entries(entries)) {
      lines.push(
        `INSERT INTO settings (scope, key, value, updated_at) VALUES (${[
          sqlString(scope),
          sqlString(key),
          sqlString(JSON.stringify(value)),
          sqlString(now)
        ].join(", ")}) ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`
      );
    }
  }
  return lines.join("\n");
}

const sources = [
  {
    key: "settings",
    path: join(root, "data", "settings.json"),
    buildSql: (payload) => buildSettingsSql(payload)
  },
  {
    key: "gold-costs:poe2",
    path: join(root, "data", "poe2_data", "gold-costs.json"),
    buildSql: (payload) => buildGoldCostsSql("poe2", payload)
  },
  {
    key: "gold-costs:poe",
    path: join(root, "data", "poe_data", "gold-costs.json"),
    buildSql: (payload) => buildGoldCostsSql("poe", payload)
  },
  {
    key: "campaign-checklist:poe2",
    path: join(root, "data", "poe2_data", "campaign-checklist.json"),
    buildSql: (payload) => buildCampaignSql("poe2", payload)
  }
];

console.log(`Syncing reference data (${remote ? "remote" : "local"} D1)${dryRun ? " [dry-run]" : ""}...`);

for (const source of sources) {
  const contentHash = hashFile(source.path);
  const payload = JSON.parse(readFileSync(source.path, "utf8"));
  const existing = queryScalar(
    `SELECT content_hash, externally_modified FROM data_versions WHERE key = ${sqlString(source.key)};`
  );

  if (existing?.content_hash === contentHash) {
    console.log(`= ${source.key} unchanged`);
    continue;
  }

  if (existing?.externally_modified) {
    console.error(`! ${source.key} drift: database was modified out of band`);
    process.exitCode = 1;
    continue;
  }

  console.log(`→ ${source.key} changed`);
  if (dryRun) continue;

  const dir = mkdtempSync(join(tmpdir(), "pc-sync-"));
  const file = join(dir, `${source.key.replace(/[:/]/g, "-")}.sql`);
  const now = new Date().toISOString();
  const sql = `${source.buildSql(payload)}\nINSERT INTO data_versions (key, content_hash, applied_at, externally_modified) VALUES (${[
    sqlString(source.key),
    sqlString(contentHash),
    sqlString(now),
    0
  ].join(", ")}) ON CONFLICT(key) DO UPDATE SET content_hash = excluded.content_hash, applied_at = excluded.applied_at, externally_modified = 0;`;
  writeFileSync(file, sql);
  try {
    runWrangler(["--file", file]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}
