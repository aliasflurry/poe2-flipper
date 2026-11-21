export const actions = {
  transmute: { name: "Orb of Transmutation", from: ["normal"], to: "magic", effect: "reroll" },
  alteration: { name: "Orb of Alteration", from: ["magic"], to: "magic", effect: "reroll" },
  augment: { name: "Orb of Augmentation", from: ["magic"], to: "magic", effect: "add" },
  regal: { name: "Regal Orb", from: ["magic"], to: "rare", effect: "add" },
  alchemy: { name: "Orb of Alchemy", from: ["normal"], to: "rare", effect: "reroll" },
  chaos: { name: "Chaos Orb", from: ["rare"], to: "rare", effect: "reroll" },
  exalt: { name: "Exalted Orb", from: ["rare"], to: "rare", effect: "add" },
  annul: { name: "Orb of Annulment", from: ["magic", "rare"], effect: "remove" },
  scour: { name: "Orb of Scouring", from: ["magic", "rare"], to: "normal", effect: "clear" }
};

const sideLimits = { normal: 0, magic: 1, rare: 3 };

function firstWeight(entries, tags, fallback) {
  return entries?.find(([tag]) => tags.has(tag))?.[1] ?? fallback;
}

function weightFor(mod, tags) {
  return firstWeight(mod.spawn, tags, 0) * firstWeight(mod.generation, tags, 100) / 100;
}

export function buildPool(mods, base, level) {
  const baseTags = new Set(base.tags);
  const possibleTags = new Set(baseTags);
  const candidates = mods.filter((mod) => mod.level <= level && (mod.domain ?? "item") === (base.domain ?? "item"));
  const reachable = new Set();
  // A rolled modifier can unlock other modifiers through its added tags.
  let size;
  do {
    size = possibleTags.size;
    for (const mod of candidates) {
      if (weightFor(mod, possibleTags) <= 0 && weightFor(mod, baseTags) <= 0) continue;
      reachable.add(mod);
      for (const tag of mod.adds ?? []) possibleTags.add(tag);
    }
  } while (possibleTags.size > size);
  // Alternate tag combinations can expose a positive rule hidden by another added tag.
  return candidates.filter((mod) => reachable.has(mod) || mod.spawn.some(([tag, weight]) =>
    weight > 0 && possibleTags.has(tag) && !baseTags.has(tag)))
    .map((mod) => ({ ...mod, weight: weightFor(mod, baseTags) }));
}

export function buildReferencePools(catalog, base) {
  const pools = new Map();
  const applicable = (mods) => (mods ?? []).filter((mod) => mod.classes.includes(base.class));
  pools.set("crafted", applicable(catalog.craftedMods));
  for (const tag of catalog.influenceTags?.[base.class] ?? []) {
    const origin = tag.slice(tag.lastIndexOf("_") + 1);
    const influencedBase = { ...base, tags: [...base.tags, tag] };
    pools.set(origin, buildPool(catalog.influenceMods ?? [], influencedBase, Infinity));
  }
  pools.set("essence", applicable(catalog.essenceMods));
  return pools;
}

export function affixTableStats(pool, allTiers) {
  const sideTotals = { prefix: 0, suffix: 0 };
  for (const mod of pool) sideTotals[mod.side] += mod.weight;
  const poolTotal = sideTotals.prefix + sideTotals.suffix;
  const familyKey = (mod) => `${mod.side}:${mod.family}`;
  const familyLevels = new Map();
  for (const mod of allTiers) {
    const key = familyKey(mod);
    if (!familyLevels.has(key)) familyLevels.set(key, new Set());
    familyLevels.get(key).add(mod.level);
  }
  const ranks = new Map([...familyLevels].map(([key, levels]) => [key, [...levels].sort((a, b) => b - a)]));
  return new Map(pool.map((mod) => [mod.id, {
    tier: ranks.get(familyKey(mod)).indexOf(mod.level) + 1,
    sideChance: sideTotals[mod.side] ? mod.weight / sideTotals[mod.side] : 0,
    poolChance: poolTotal ? mod.weight / poolTotal : 0
  }]));
}

function rollMod(item, context, rarity, random) {
  const limit = sideLimits[rarity];
  let prefixes = 0;
  const groups = new Set();
  const tags = new Set();
  for (const mod of item.mods) {
    if (mod.side === "prefix") prefixes++;
    for (const group of mod.groups) groups.add(group);
    for (const tag of mod.adds ?? []) if (!context.baseTags.has(tag)) tags.add(tag);
  }
  const suffixes = item.mods.length - prefixes;
  if (prefixes >= limit && suffixes >= limit) return null;

  const weights = context.weights(tags);
  let total = 0;
  let choices = 0;
  for (let index = 0; index < context.pool.length; index++) {
    const mod = context.pool[index];
    const used = mod.side === "prefix" ? prefixes : suffixes;
    if (weights[index] <= 0 || used >= limit || mod.groups.some((group) => groups.has(group))) continue;
    total += weights[index];
    context.indices[choices] = index;
    context.thresholds[choices++] = total;
  }
  if (!total) return null;
  const pick = random() * total;
  let lower = 0;
  let upper = choices - 1;
  while (lower < upper) {
    const middle = (lower + upper) >>> 1;
    if (pick < context.thresholds[middle]) upper = middle;
    else lower = middle + 1;
  }
  return context.pool[context.indices[lower]];
}

function reroll(rarity, context, random) {
  const item = { rarity, mods: [] };
  const roll = random();
  // Observed reroll distributions for ordinary two- and six-affix equipment.
  const count = rarity === "magic" ? (roll < 1 / 2 ? 1 : 2) : (roll < 2 / 3 ? 4 : roll < 11 / 12 ? 5 : 6);
  while (item.mods.length < count) {
    const mod = rollMod(item, context, rarity, random);
    if (!mod) break;
    item.mods.push(mod);
  }
  return item;
}

function applyAction(item, action, context, random) {
  const { from, to = item.rarity, effect } = actions[action];
  if (!from.includes(item.rarity)) return null;
  if (effect === "reroll") {
    const next = reroll(to, context, random);
    return next.mods.length ? next : null;
  }
  if (effect === "clear") return { rarity: to, mods: [] };
  if (effect === "remove") {
    if (!item.mods.length) return null;
    const index = Math.floor(random() * item.mods.length);
    return { rarity: to, mods: item.mods.filter((_, modIndex) => modIndex !== index) };
  }
  const mod = rollMod(item, context, to, random);
  return mod ? { rarity: to, mods: [...item.mods, mod] } : null;
}

function makeContext(base, pool) {
  const baseTags = new Set(base.tags);
  const cache = new Map([["", pool.map((mod) => mod.weight)]]);
  return {
    baseTags, pool, indices: new Uint32Array(pool.length), thresholds: new Float64Array(pool.length),
    weights(addedTags) {
      if (!addedTags.size) return cache.get("");
      const key = [...addedTags].sort().join(",");
      if (cache.has(key)) return cache.get(key);
      const tags = new Set([...baseTags, ...addedTags]);
      const weights = pool.map((mod) => weightFor(mod, tags));
      if (cache.size < 256) cache.set(key, weights);
      return weights;
    }
  };
}

export function craftItem(base, pool, item, action, random = Math.random) {
  return applyAction(item, action, makeContext(base, pool), random);
}

export function matchesTarget(item, target) {
  return item.mods.some((mod) => {
    if (target.scope === "exact") return mod.id === target.id;
    if (mod.family !== target.family || mod.side !== target.side) return false;
    return target.scope !== "minimum" || mod.level >= target.level;
  });
}

export function meetsGoal(item, targets, match, { prefix = 0, suffix = 0 } = {}) {
  if (prefix || suffix) {
    const prefixes = item.mods.filter((mod) => mod.side === "prefix").length;
    const suffixes = item.mods.length - prefixes;
    const limit = sideLimits[item.rarity];
    if (limit - prefixes < prefix || limit - suffixes < suffix) return false;
  }
  if (!targets.length) return Boolean(prefix || suffix);
  return match === "any" ? targets.some((target) => matchesTarget(item, target))
    : targets.every((target) => matchesTarget(item, target));
}

export function simulate({ base, pool, rarity, startingItem, targets, match, openAffixes, steps, trials }, random = Math.random) {
  const context = makeContext(base, pool);
  const hits = targets.map(() => 0);
  const usage = {};
  let successful = 0;
  let skipped = 0;
  let unfinished = 0;
  let sample;
  const first = steps[0];
  const firstAction = actions[first?.action];
  const replacesStartingMods = first?.when === "always" && firstAction.effect === "reroll" && firstAction.from.includes(rarity);

  const stepIndices = new Map(steps.flatMap((step, index) => step.id ? [[step.id, index]] : []));
  const checkGoal = (item) => meetsGoal(item, targets, match, openAffixes);

  for (let trial = 0; trial < trials; trial++) {
    let item = startingItem ?? (rarity === "normal" || replacesStartingMods ? { rarity, mods: [] } : reroll(rarity, context, random));
    let index = 0;
    let visits = 0;
    while (index < steps.length && visits < 100) {
      const step = steps[index];
      visits++;
      for (let attempt = 0; attempt < step.count; attempt++) {
        if (step.when === "hit" && !checkGoal(item)) break;
        if (step.when === "miss" && checkGoal(item)) break;
        const next = applyAction(item, step.action, context, random);
        if (!next) {
          skipped++;
          break;
        }
        item = next;
        usage[step.action] = (usage[step.action] ?? 0) + 1;
      }
      const route = step.onHit || step.onMiss ? (checkGoal(item) ? step.onHit : step.onMiss) : undefined;
      index = route === "finish" ? steps.length : (stepIndices.get(route) ?? index + 1);
    }

    if (index < steps.length) {
      unfinished++;
      continue;
    }
    const success = checkGoal(item);
    if (success) successful++;
    targets.forEach((target, index) => { if (matchesTarget(item, target)) hits[index]++; });
    if (!sample || (success && !sample.success)) {
      sample = { rarity: item.rarity, mods: item.mods.map((mod) => mod.id), success };
    }
  }
  return { successful, hits, usage, skipped, unfinished, sample, trials };
}

export function confidenceInterval(hits, trials) {
  const rate = hits / trials;
  const z = 1.96;
  const scale = 1 + z ** 2 / trials;
  const midpoint = (rate + z ** 2 / (2 * trials)) / scale;
  const halfWidth = z * Math.sqrt((rate * (1 - rate) + z ** 2 / (4 * trials)) / trials) / scale;
  return [Math.max(0, midpoint - halfWidth), Math.min(1, midpoint + halfWidth)];
}

if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
  self.addEventListener("message", ({ data }) => {
    try {
      self.postMessage(simulate(data));
    } catch (error) {
      self.postMessage({ error: error.message });
    }
  });
}
