import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { affixTableStats, buildPool, buildReferencePools, confidenceInterval, craftItem, matchesTarget, simulate } from "../crafting-engine.mjs";

const base = { tags: ["ring", "default"] };
const modifier = (id, side, options = {}) => ({
  id, side, family: id, groups: [id], level: 1, spawn: [["ring", 100]], ...options
});
const prefix = modifier("life", "prefix");
const suffix = modifier("resist", "suffix");
const step = (action, count = 1, when = "always") => ({ action, count, when });

function run(mods, steps, options = {}, random = () => 0) {
  return simulate({ base, pool: buildPool(mods, base, 80), targets: [], match: "all", rarity: "normal",
    steps, trials: 1, ...options }, random);
}

test("the PoE1 catalog resolves a real base's tiers and filters by item level, tags and spawn weight", async () => {
  const data = JSON.parse(await readFile(new URL("../data/poe_data/crafting.json", import.meta.url)));
  const ring = data.bases.find((base) => base.name === "Amethyst Ring");
  const low = buildPool(data.mods, ring, 1);
  const high = buildPool(data.mods, ring, 84);
  assert.ok(low.some((mod) => mod.text.includes("maximum Life")));
  assert.ok(high.length > low.length);
  assert.ok(high.some((mod) => mod.level > 75 && mod.weight > 0));
  assert.ok(high.every((mod) => mod.level <= 84));
  assert.ok(!high.some((mod) => mod.family === "LocalIncreasedPhysicalDamagePercent"));
  assert.ok(!data.bases.some((base) => base.name === "Helical Ring"));
});

test("origin pools use the base's class and keep special modifiers out of ordinary rolls", async () => {
  const catalog = JSON.parse(await readFile(new URL("../data/poe_data/crafting.json", import.meta.url)));
  const ring = catalog.bases.find((base) => base.name === "Amethyst Ring");
  const reference = buildReferencePools(catalog, ring);
  const shaper = reference.get("shaper");
  assert.ok(shaper.some((mod) => mod.side === "prefix" && mod.weight > 0));
  assert.ok(shaper.some((mod) => mod.side === "suffix" && mod.weight > 0));
  assert.ok(shaper.every((mod) => mod.spawn.some(([tag, weight]) => tag === "ring_shaper" && weight > 0)));
  assert.ok(reference.get("crafted").some((mod) => mod.id === "HelenaMasterIncreasedLife1"));
  assert.ok(reference.get("essence").length > 0);
  const specialIds = new Set([...reference.values()].flat().map((mod) => mod.id));
  assert.ok(buildPool(catalog.mods, ring, Infinity).every((mod) => !specialIds.has(mod.id)));
  const flask = catalog.bases.find((base) => base.domain === "flask");
  assert.equal(buildReferencePools(catalog, flask).has("shaper"), false);
});

test("first matching spawn rule can block a modifier and selected modifiers can unlock weights", () => {
  const unlock = modifier("unlock", "prefix", { adds: ["unlocked"] });
  const locked = modifier("locked", "suffix", { spawn: [["unlocked", 10], ["default", 0]] });
  const blocked = modifier("blocked", "suffix", { spawn: [["ring", 0], ["default", 1000]] });
  const boosted = modifier("boosted", "suffix", { generation: [["ring", 50], ["default", 100]] });
  const pool = buildPool([unlock, locked, blocked, boosted], base, 80);
  assert.deepEqual(pool.map(({ id, weight }) => [id, weight]), [["unlock", 100], ["locked", 0], ["boosted", 50]]);
  const result = run([unlock, locked, blocked], [step("transmute"), step("augment")]);
  assert.deepEqual(result.sample.mods, ["unlock", "locked"]);
});

test("rare rolls respect prefix, suffix and shared mod-group limits", () => {
  const mods = [prefix, modifier("conflict", "suffix", { groups: ["life"] }), suffix];
  for (let i = 0; i < 5; i++) {
    mods.push(modifier(`p${i}`, "prefix"), modifier(`s${i}`, "suffix"));
  }
  const result = run(mods, [step("alchemy"), step("exalt")], {}, () => 0.001);
  assert.equal(result.sample.rarity, "rare");
  assert.equal(result.sample.mods.length, 5);
  assert.equal(result.sample.mods.filter((id) => id.startsWith("p") || id === "life").length, 3);
  assert.ok(!result.sample.mods.includes("conflict"));
});

test("conditional retries stop on success and only charge applied currencies", () => {
  const target = { ...prefix, scope: "family" };
  const result = run([prefix, suffix], [step("transmute"), step("alteration", 30, "miss"),
    step("regal", 1, "hit"), step("chaos", 1, "miss"), step("augment")], { targets: [target], trials: 4 });
  assert.equal(result.successful, 4);
  assert.deepEqual(result.hits, [4]);
  assert.deepEqual(result.usage, { transmute: 4, regal: 4 });
  assert.equal(result.skipped, 4);
  assert.deepEqual(result.sample.mods, ["life", "resist"]);
});

test("matching all exact targets differs from matching any, and zero hits retain an upper bound", () => {
  const targets = [prefix, suffix].map((mod) => ({ ...mod, scope: "exact" }));
  const all = run([prefix, suffix], [step("transmute")], { targets, trials: 1000 });
  const any = run([prefix, suffix], [step("transmute")], { targets, match: "any", trials: 1000 });
  assert.equal(all.successful, 0);
  assert.equal(any.successful, 1000);
  assert.deepEqual(all.hits, [1000, 0]);
  const [lower, upper] = confidenceInterval(0, 1000);
  assert.equal(lower, 0);
  assert.ok(upper > 0 && upper < 0.005);
});

test("minimum tier targets apply within the selected modifier family and side", () => {
  const tier = { ...prefix, level: 40, scope: "minimum" };
  assert.equal(matchesTarget({ mods: [{ ...prefix, id: "life-high", level: 60 }] }, tier), true);
  assert.equal(matchesTarget({ mods: [prefix] }, tier), false);
  assert.equal(matchesTarget({ mods: [{ ...suffix, level: 60 }] }, tier), false);
});

test("the preview shares currency rules and can seed every simulator trial", () => {
  const pool = buildPool([prefix, suffix], base, 80);
  const normal = { rarity: "normal", mods: [] };
  assert.equal(craftItem(base, pool, normal, "regal"), null);
  const magic = craftItem(base, pool, normal, "transmute", () => 0);
  const result = run([prefix, suffix], [step("regal")], { startingItem: magic, trials: 4 });
  assert.deepEqual(magic.mods.map((mod) => mod.id), ["life"]);
  assert.deepEqual(result.usage, { regal: 4 });
  assert.deepEqual(result.sample.mods, ["life", "resist"]);
});

test("simulator takes the matching route and counts bounded loops as incomplete", () => {
  const target = { ...prefix, scope: "exact" };
  const start = { ...step("transmute"), id: "start", onHit: "finish", onMiss: "start" };
  const skip = { ...step("regal"), id: "upgrade" };
  const hit = run([prefix, suffix], [start, skip], { targets: [target] });
  assert.equal(hit.successful, 1);
  assert.deepEqual(hit.usage, { transmute: 1 });
  const miss = run([suffix], [start, skip], { targets: [target] });
  assert.equal(miss.unfinished, 1);
  assert.equal(miss.successful, 0);
  assert.equal(miss.sample, undefined);
});

test("an open affix requirement uses the item's rarity limit and can be a goal by itself", () => {
  const mods = [prefix, suffix];
  const steps = [step("transmute")];
  assert.equal(run(mods, steps, { openAffixes: { suffix: 1 } }).successful, 1);
  assert.equal(run(mods, steps, { openAffixes: { prefix: 1 } }).successful, 0);
  assert.equal(run(mods, steps, { openAffixes: { suffix: 2 } }).successful, 0);
  assert.equal(run(mods, steps, { targets: [{ ...prefix, scope: "exact" }], openAffixes: { prefix: 1 } }).successful, 0);
});

test("affix table ranks stay stable across item levels and odds use the eligible weights", () => {
  const tierTwo = { ...prefix, id: "life-t2", level: 40, weight: 100 };
  const tierOne = { ...prefix, id: "life-t1", level: 80, weight: 20 };
  const anotherPrefix = { ...modifier("mana", "prefix"), weight: 300 };
  const oneSuffix = { ...suffix, weight: 400 };
  const stats = affixTableStats([tierTwo, anotherPrefix, oneSuffix], [tierOne, tierTwo, anotherPrefix, oneSuffix]);
  assert.deepEqual(stats.get(tierTwo.id), { tier: 2, sideChance: 0.25, poolChance: 0.125 });
  assert.deepEqual(stats.get(oneSuffix.id), { tier: 1, sideChance: 1, poolChance: 0.5 });
});

test("every added item group has bases with a domain-specific modifier pool", async () => {
  const data = JSON.parse(await readFile(new URL("../data/poe_data/crafting.json", import.meta.url)));
  for (const [group, pickerClass] of [
    ["charts", "Chart"], ["clusterJewel", "Block"], ["flask", "Utility Flasks"], ["heist", "Contracts"],
    ["invitation", "Eldritch Invitation"], ["jewel", "Crimson Jewel"], ["mapping", "Maps (UBER)"],
    ["miscellaneous", "Tinctures"], ["relic", "Small Relics"], ["strongboxes", "Diviner"]
  ]) {
    const item = data.bases.find((base) => base.group === group && base.pickerClass === pickerClass);
    assert.ok(item?.browseOnly, `${group} ${pickerClass} is missing`);
    const pool = buildPool(data.mods, item, 100);
    assert.ok(pool.length > 0, `${group} ${pickerClass} has an empty pool`);
    assert.ok(pool.every((mod) => mod.domain === item.domain));
  }
});
