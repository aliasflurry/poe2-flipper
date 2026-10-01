/**
 * Rebuild English campaign checklist from pathofbuild data + _vi-overrides.json
 * Run after: node scripts/build-overrides.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const rawPath = path.join(root, "data/poe2_data/pob-api-raw.json");
const overridesPath = path.join(root, "data/poe2_data/_vi-overrides.json");
const outPath = path.join(root, "data/poe2_data/campaign-checklist.json");

function hasVietnamese(s) {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/.test(
    s || ""
  );
}

function polish(s) {
  let t = String(s || "")
    .replace(/\bTake down\b/gi, "Defeat")
    .replace(/\bTalk to\b/gi, "Speak to")
    .replace(/\bGo into\b/gi, "Enter")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
  if (t && !t.startsWith("(") && !t.startsWith('"') && /^[a-z]/.test(t)) {
    t = t[0].toUpperCase() + t.slice(1);
  }
  return t;
}

function translate(text, overrides) {
  if (!text) return "";
  if (overrides[text]) return polish(overrides[text]);
  if (!hasVietnamese(text)) return polish(text);
  return polish(text);
}

function isTownName(name) {
  return /encampment|caravan|hideout|bazaar|refuge|kingsmarch/i.test(name);
}

function inferRewards(text, tags = []) {
  const rewards = [];
  const t = text || "";
  const perm = t.match(
    /\+?\d+%?\s*(?:to\s+)?(?:maximum\s+)?(?:Cold|Fire|Lightning|Chaos|All Elemental)?\s*Resistance[s]?|\+\d+\s*(?:Spirit|Strength|Dexterity|Intelligence|Life|Mana)|(?:Cold|Fire|Lightning)\s*Resistance\s*\+?\d+%/i
  );
  if (perm) rewards.push({ text: perm[0].trim(), type: "permanent" });
  if (/Uncut Support Gem|Support Gem/i.test(t)) {
    const m = t.match(/Uncut Support Gem[^.,]{0,24}|Support Gem[^.,]{0,16}/i);
    rewards.push({ text: (m ? m[0] : "Support Gem").trim(), type: "item" });
  } else if (/Uncut Skill Gem|Skill Gem/i.test(t)) {
    const m = t.match(/Uncut Skill Gem[^.,]{0,24}|Skill Gem[^.,]{0,16}/i);
    rewards.push({ text: (m ? m[0] : "Skill Gem").trim(), type: "item" });
  }
  if (/Skill Point|Weapon Set Skill Point|\+\d+\s*Skill Point/i.test(t)) {
    rewards.push({ text: "Skill Points", type: "points" });
  }
  if (/Ascendan/i.test(t)) rewards.push({ text: "Ascendancy", type: "ascendancy" });
  const seen = new Set();
  return rewards.filter((r) => {
    const k = r.text.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function rewardTypeFromText(lr) {
  if (/resistance|spirit|\+\d+%|life|mana|strength|dexterity|intelligence|permanent/i.test(lr))
    return "permanent";
  if (/skill point|passive|book|weapon set/i.test(lr)) return "points";
  if (/ascend/i.test(lr)) return "ascendancy";
  return "item";
}

const ACT_META = {
  act1: { num: 1, id: "act1", title: "Act 1 — Clearfell → Ogham Manor" },
  act2: { num: 2, id: "act2", title: "Act 2 — Vastiri Desert → Dreadnought" },
  act3: { num: 3, id: "act3", title: "Act 3 — Sandswept Marsh → Ziggurat" },
  act4: { num: 4, id: "act4", title: "Act 4 — Wraeclast Awakens" },
  i1: { num: 5, id: "interlude1", title: "Interlude I — Ogham — The Refuge" },
  i2: { num: 6, id: "interlude2", title: "Interlude II — Khari Bazaar" },
  i3: { num: 7, id: "interlude3", title: "Interlude III — Mount Kriar → Maps" },
};

function main() {
  const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));
  const overrides = JSON.parse(fs.readFileSync(overridesPath, "utf8"));
  const campaign = raw.campaign || [];
  const acts = [];
  const stillVi = [];

  for (const act of campaign) {
    const meta = ACT_META[act.id] || { num: acts.length + 1, id: act.id, title: act.title };
    const subtitle = act.subtitle ? translate(act.subtitle, overrides) : "";
    if (hasVietnamese(subtitle)) stillVi.push(subtitle);

    const areas = [];
    let zi = 0;
    for (const zone of act.zones || []) {
      const zoneName = translate(zone.name, overrides);
      if (hasVietnamese(zoneName)) stillVi.push(zoneName);

      const layoutRewards = new Map();
      for (const layout of zone.layouts || []) {
        for (const p of layout.points || []) {
          const pText = translate(p.text || "", overrides)
            .toLowerCase()
            .replace(/^\(optional\)\s*/i, "");
          const pReward = translate(p.reward || "", overrides);
          if (pReward) {
            layoutRewards.set(pText, pReward);
            const m = pText.match(/defeat\s+([^.(]+)/i);
            if (m) layoutRewards.set(m[1].trim().toLowerCase(), pReward);
          }
        }
      }

      const objectives = [];
      let si = 0;
      for (const step of zone.steps || []) {
        const tags = step.tags || [];
        let text = translate(step.t || "", overrides);
        const note = step.note ? translate(step.note, overrides) : "";
        if (hasVietnamese(text)) stillVi.push(text);
        if (hasVietnamese(note)) stillVi.push(note);

        const isNote = step.kind === "note";
        const isFirstChar = /^\(first character\)/i.test(text);
        const optional =
          tags.includes("optional") ||
          /^\(optional\)/i.test(text) ||
          isFirstChar;

        text = text.replace(/^\(optional\)\s*/i, "").trim();
        if (isFirstChar) {
          text = text.replace(/^\(first character\)\s*/i, "").trim();
          text = `(First character) ${text}`;
        }

        const obj = { id: `s${si++}`, text };
        if (isNote) {
          obj.kind = "note";
          obj.noteStyle = step.note_style || "info";
        }
        if (optional && !isNote) obj.optional = true;
        if (tags.includes("boss")) obj.boss = true;
        if (tags.includes("waypoint")) obj.waypoint = true;
        if (note) obj.note = note;

        let rewards = inferRewards(text + " " + (note || ""), tags);
        if (!rewards.length && (tags.includes("reward") || obj.boss)) {
          const key = obj.text.toLowerCase();
          for (const [lk, lr] of layoutRewards) {
            if (key.includes(lk.slice(0, 24)) || lk.includes(key.slice(0, 24))) {
              rewards = [{ text: lr, type: rewardTypeFromText(lr) }];
              break;
            }
          }
        }
        if (rewards.length) obj.rewards = rewards;
        objectives.push(obj);
      }

      const area = {
        id: `${meta.id}_z${zi++}`,
        name: zoneName || `Zone ${zi}`,
        objectives,
      };
      if (isTownName(zoneName)) area.type = "town";
      areas.push(area);
    }

    const actOut = { id: meta.id, num: meta.num, title: meta.title, areas };
    if (subtitle) actOut.subtitle = subtitle;
    acts.push(actOut);
  }

  const out = {
    version: 4,
    updated: "2026-09-04",
    source: "https://pathofbuild.io.vn/leveling/ (translated to English)",
    acts,
  };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");

  const totalObj = acts.reduce(
    (n, a) => n + a.areas.reduce((m, ar) => m + ar.objectives.length, 0),
    0
  );
  console.log(
    `Wrote ${acts.length} acts / ${acts.reduce((n, a) => n + a.areas.length, 0)} areas / ${totalObj} objectives`
  );
  console.log(`Remaining Vietnamese strings in output: ${stillVi.length}`);
  if (stillVi.length) stillVi.slice(0, 10).forEach((s) => console.log(" -", s.slice(0, 120)));
}

main();
