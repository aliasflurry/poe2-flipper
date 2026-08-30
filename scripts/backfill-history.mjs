import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const remote = process.argv.includes("--remote");
const target = remote ? "--remote" : "--local";
const SNAPSHOTS_BASE =
  "https://raw.githubusercontent.com/aliasflurry/poe2-flipper/snapshots";

const games = [
  { id: "poe2", historyUrl: `${SNAPSHOTS_BASE}/data/poe2_data/price-history.json` },
  { id: "poe", historyUrl: `${SNAPSHOTS_BASE}/data/poe_data/price-history.json` }
];

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function runWrangler(file) {
  execFileSync("npx", ["wrangler", "d1", "execute", "price-checker", target, "--file", file], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
}

for (const game of games) {
  console.log(`Backfilling ${game.id} history from snapshots branch...`);
  const response = await fetch(game.historyUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${game.historyUrl}: HTTP ${response.status}`);
  }
  const payload = await response.json();
  const snapshots = Array.isArray(payload.snapshots) ? payload.snapshots : [];
  const lines = [
    `DELETE FROM history_pairs WHERE game = ${sqlString(game.id)};`,
    `DELETE FROM history_points WHERE game = ${sqlString(game.id)};`,
    `DELETE FROM price_totals WHERE game = ${sqlString(game.id)};`
  ];

  for (const snapshot of snapshots) {
    if (!snapshot?.updatedAt || !snapshot?.pairs) continue;
    lines.push(
      `INSERT INTO history_points (game, ts) VALUES (${sqlString(game.id)}, ${sqlString(snapshot.updatedAt)});`
    );
    for (const [pairKey, pair] of Object.entries(snapshot.pairs)) {
      lines.push(
        `INSERT INTO history_pairs (game, ts, pair_key, one_price, two_price, volume) VALUES (${[
          sqlString(game.id),
          sqlString(snapshot.updatedAt),
          sqlString(pairKey),
          Number(pair.onePrice),
          Number(pair.twoPrice),
          Number(pair.volume)
        ].join(", ")});`
      );
    }
  }

  for (const [key, total] of Object.entries(payload.totalDifferences || {})) {
    const separator = key.indexOf(">");
    if (separator < 1) continue;
    lines.push(
      `INSERT INTO price_totals (game, from_id, to_id, total_diff) VALUES (${[
        sqlString(game.id),
        sqlString(key.slice(0, separator)),
        sqlString(key.slice(separator + 1)),
        Number(total)
      ].join(", ")});`
    );
  }

  const dir = mkdtempSync(join(tmpdir(), "pc-backfill-"));
  const file = join(dir, `${game.id}-history.sql`);
  writeFileSync(file, lines.join("\n"));
  try {
    runWrangler(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log("History backfill complete.");
