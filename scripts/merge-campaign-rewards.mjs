import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundlePath =
  "C:/Users/User/AppData/Local/Overwolf/Extensions/pieipbjakjgegggfdahpmlifmenkeiaobikdldin/1.51.0/dist/4835.bundle.js";
const checklistPath = path.join(__dirname, "../data/poe2_data/campaign-checklist.json");

const TYPE_MAP = {
  stat: "permanent",
  gem: "item",
  passives: "points",
  ascendancy: "ascendancy",
  item: "item",
  unlock: "unlocks",
  gold: "item",
  currency: "item"
};

function mapType(owTypes) {
  if (!owTypes?.length) return "item";
  const primary = owTypes.find((t) => t !== "league") || owTypes[0];
  return TYPE_MAP[primary] || "item";
}

const ID_ALIASES = {
  "clear-mud-borrow": "clear-mud-burrow"
};

function extractMessage(fragment) {
  const match = fragment.match(/\{message:"((?:\\.|[^"\\])*)"\}/);
  if (!match) return null;

  let message = match[1]
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  const paramsMatch = fragment.match(/,\{([^}]*)\},\{message:/);
  if (paramsMatch) {
    for (const [, key, value] of paramsMatch[1].matchAll(/(\w+):(\d+)/g)) {
      message = message.replaceAll(`{${key}}`, value);
    }
  }

  return message;
}

function resolveHelperReward(expr) {
  const helpers = {
    e: (n) => ({ text: `Skill Gem (${n})`, type: "item" }),
    r: (n) => ({ text: `Spirit Gem (${n})`, type: "item" }),
    n: (n) => ({ text: `Support Gem (${n})`, type: "item" }),
    s: (n) => ({ text: `${n} Passives`, type: "points" }),
    i: (n) => ({ text: `+${n} Spirit`, type: "permanent" }),
    w: (n) => ({ text: `Torn Map Piece (${n}/4)`, type: "unlocks" })
  };
  const constants = {
    o: { text: "Alch", type: "item" },
    d: { text: "Artificer's Orb", type: "item" },
    l: { text: "Chaos", type: "item" },
    u: { text: "Regal", type: "item" },
    c: { text: "Exalted", type: "item" },
    p: { text: "Armourer's Scrap", type: "item" },
    m: { text: "Lesser Jeweller's", type: "item" },
    h: { text: "Lesser Rune", type: "item" },
    g: { text: "Greater Rune", type: "item" },
    b: { text: "Greater Jeweller's", type: "item" },
    f: { text: "Gemcutter's", type: "item" },
    _: { text: "Random Unique", type: "item" },
    k: { text: "Magic Ring", type: "item" }
  };

  const trimmed = expr.trim();
  const fnMatch = trimmed.match(/^([ernsiw])\((\d+)\)$/);
  if (fnMatch) {
    const [, fn, num] = fnMatch;
    return helpers[fn](Number(num));
  }
  if (constants[trimmed]) return constants[trimmed];
  return null;
}

function parseInlineReward(fragment) {
  const typesMatch = fragment.match(/types:\[([^\]]*)\]/);
  const owTypes = typesMatch
    ? [...typesMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
    : [];
  const text = extractMessage(fragment);
  if (!text) return null;
  return { text, type: mapType(owTypes) };
}

function parseRewardsExpr(expr) {
  const rewards = [];
  let i = 1; // skip opening [

  while (i < expr.length - 1) {
    while (expr[i] === " " || expr[i] === ",") i += 1;
    if (i >= expr.length - 1) break;

    if (expr[i] === "{") {
      let braceDepth = 0;
      const start = i;
      for (; i < expr.length; i += 1) {
        if (expr[i] === "{") braceDepth += 1;
        if (expr[i] === "}") {
          braceDepth -= 1;
          if (braceDepth === 0) {
            const block = expr.slice(start, i + 1);
            const parsed = parseInlineReward(block);
            if (parsed) rewards.push(parsed);
            i += 1;
            break;
          }
        }
      }
      continue;
    }

    const helperMatch = expr.slice(i).match(/^([a-z_])\((\d+)\)/);
    if (helperMatch) {
      const resolved = resolveHelperReward(helperMatch[0]);
      if (resolved) rewards.push(resolved);
      i += helperMatch[0].length;
      continue;
    }

    const constMatch = expr.slice(i).match(/^([a-z_]+)/);
    if (constMatch) {
      const resolved = resolveHelperReward(constMatch[1]);
      if (resolved) rewards.push(resolved);
      i += constMatch[1].length;
      continue;
    }

    break;
  }

  return rewards;
}

function parseRewardsFromBlock(block) {
  const idx = block.indexOf("rewards:");
  if (idx < 0) return [];

  let i = idx + "rewards:".length;
  while (block[i] === " ") i += 1;
  if (block[i] !== "[") return [];

  let depth = 0;
  const start = i;
  for (; i < block.length; i += 1) {
    if (block[i] === "[") depth += 1;
    if (block[i] === "]") {
      depth -= 1;
      if (depth === 0) {
        return parseRewardsExpr(block.slice(start, i + 1));
      }
    }
  }

  return [];
}

function parseObjectives(areaBody) {
  const objectives = [];
  const objStart = areaBody.indexOf("objectives:[");
  if (objStart < 0) return objectives;

  const section = areaBody.slice(objStart);
  let cursor = "objectives:[".length;
  const leagueMatch = section.slice(cursor).match(/^v\((\w+(?:\(\d+\))?)\)/);
  if (leagueMatch) {
    const reward = resolveHelperReward(leagueMatch[1]);
    if (reward) {
      objectives.push({ id: "league-mechanic", rewards: [reward] });
    }
  }

  const idRegex = /id:"([^"]+)"/g;
  const matches = [...section.matchAll(idRegex)];
  if (!matches.length) return objectives;

  for (let i = 0; i < matches.length; i += 1) {
    const id = matches[i][1];
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : section.length;
    const block = section.slice(start, end);
    const rewards = parseRewardsFromBlock(block);
    if (rewards.length > 0) {
      objectives.push({ id, rewards });
    }
  }

  return objectives;
}

function parseAreas(master) {
  const areasStart = master.indexOf("areas:{") + "areas:{".length;
  const areas = new Map();
  let i = areasStart;

  while (i < master.length) {
    const rest = master.slice(i);
    if (rest.startsWith("}")) break;

    const idMatch = rest.match(/^([GP][\d_a-zA-Z]+):/);
    if (!idMatch) break;

    const areaId = idMatch[1];
    i += idMatch[0].length;
    if (master[i] !== "{") break;

    let depth = 0;
    const start = i;
    for (; i < master.length; i += 1) {
      if (master[i] === "{") depth += 1;
      if (master[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          areas.set(areaId, master.slice(start, i + 1));
          i += 1;
          if (master[i] === ",") i += 1;
          break;
        }
      }
    }
  }

  return areas;
}

function parseOverwolfGuide(bundle) {
  const start = bundle.indexOf('{id:"master"');
  const end = bundle.indexOf("}}},[a]);return", start);
  const master = bundle.slice(start, end + 4);
  const areas = parseAreas(master);

  const rewardMap = new Map();
  for (const [areaId, areaBody] of areas) {
    for (const obj of parseObjectives(areaBody)) {
      rewardMap.set(`${areaId}.${obj.id}`, obj.rewards);
    }
  }

  return rewardMap;
}

function stripRewardHints(text) {
  return text
    .replace(/\s*\([^)]*(?:unlocks|Resistance|Gem|Ring|Flask|Bench|Vendor|Gold|Orbs?|Tattoo|Boon|Mana|Life|Scrap|Rune|Jewel|Items?|Ascendancy|Djinn)[^)]*\)/gi, "")
    .replace(/\s*→ Pick Flame Ruby/g, " → Pick Flame Ruby")
    .trim();
}

const bundle = fs.readFileSync(bundlePath, "utf8");
const rewardMap = parseOverwolfGuide(bundle);
const checklist = JSON.parse(fs.readFileSync(checklistPath, "utf8"));

let merged = 0;
let missing = 0;

for (const act of checklist.acts) {
  for (const area of act.areas) {
    for (const obj of area.objectives) {
      let rewards = rewardMap.get(`${area.id}.${obj.id}`);
      if (!rewards?.length) {
        for (const [owId, ourId] of Object.entries(ID_ALIASES)) {
          if (ourId === obj.id) {
            rewards = rewardMap.get(`${area.id}.${owId}`);
            break;
          }
        }
      }
      if (rewards?.length) {
        obj.rewards = rewards;
        merged += 1;
        obj.text = stripRewardHints(obj.text);
      } else {
        delete obj.rewards;
      }
    }

    const leagueRewards = rewardMap.get(`${area.id}.league-mechanic`);
    if (leagueRewards?.length) {
      const waypoint = area.objectives.find((o) => o.id === "activate-waypoint");
      if (waypoint) {
        waypoint.rewards = leagueRewards;
        merged += 1;
      }
    }
  }
}

// Report overwolf rewards not matched in our checklist
for (const [key] of rewardMap) {
  const [areaId, objId] = key.split(".");
  let found = false;
  for (const act of checklist.acts) {
    const area = act.areas.find((a) => a.id === areaId);
    if (area?.objectives.some((o) => o.id === objId)) {
      found = true;
      break;
    }
  }
  if (!found) missing += 1;
}

checklist.updated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(checklistPath, `${JSON.stringify(checklist, null, 2)}\n`);

console.log(`Merged rewards into ${merged} objectives`);
console.log(`Overwolf reward entries not in checklist: ${missing}`);
console.log(`Total overwolf reward entries: ${rewardMap.size}`);
