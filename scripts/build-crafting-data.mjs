import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [inputDirectory, revision] = process.argv.slice(2);
if (!inputDirectory || !revision) throw new Error("Usage: node scripts/build-crafting-data.mjs <RePoE export directory> <PoE version>");

const readExport = async (file) => JSON.parse(await readFile(join(inputDirectory, file), "utf8"));
const [baseItems, modifiers, clusterJewels, itemClasses, benchOptions, essences] = await Promise.all([
  readExport("base_items.min.json"), readExport("mods.min.json"), readExport("cluster_jewels.min.json"),
  readExport("item_classes.min.json"), readExport("crafting_bench_options.min.json"), readExport("essences.min.json")
]);
const equipment = new Set([
  "Amulet", "Belt", "Body Armour", "Boots", "Bow", "Claw", "Dagger", "Gloves", "Helmet",
  "One Hand Axe", "One Hand Mace", "One Hand Sword", "Quiver", "Ring", "Rune Dagger", "Sceptre",
  "Shield", "Staff", "Thrusting One Hand Sword", "Two Hand Axe", "Two Hand Mace", "Two Hand Sword",
  "Wand", "Warstaff"
]);

const flaskClasses = { LifeFlask: "Life Flasks", ManaFlask: "Mana Flasks", HybridFlask: "Hybrid Flasks", UtilityFlask: "Utility Flasks" };
const heistClasses = { HeistContract: "Contracts", HeistBlueprint: "Blueprints", Trinket: "Trinkets",
  HeistEquipmentUtility: "Heist Cloaks", HeistEquipmentReward: "Heist Brooches" };
const heistSubclasses = {
  lockpick: "Lockpick", bruteforce: "Bracer", perception: "Charm", demolition: "Flashpowder",
  counterthaumaturge: "Ward", trapdisarmament: "Keyring", agility: "Sole", deception: "Disguise Kit",
  engineering: "Blowtorch", melee: "Sharpening Stone", ranged: "Arrowhead", caster: "Burst Band"
};
const clusterClasses = {
  "Chance to Block Attack Damage": "Block", "Chance to Block Spell Damage": "Block",
  Strength: "Attributes", Dexterity: "Attributes", Intelligence: "Attributes"
};

function additionalClasses(base, key) {
  const { domain, item_class: type, name, tags } = base;
  switch (domain) {
    case "item": return type === "FishingRod" ? [["twoHanded", "Fishing Rods"]] : [];
    case "flask": return [["flask", name === "Iron Flask" ? name : flaskClasses[type]]];
    case "jewel":
    case "abyss_jewel": return [["jewel", name === "Mycelium Core" ? "Prismatic Jewel" : name]];
    case "affliction_jewel": return (clusterJewels[key]?.passive_skills ?? []).map((skill) => {
      const pickerClass = clusterClasses[skill.name] ?? skill.name;
      return ["clusterJewel", pickerClass, [skill.tag], pickerClass === skill.name ? name : `${name} · ${skill.name}`];
    });
    case "heist_area":
    case "heist_trinket":
    case "heist_npc": {
      if (heistClasses[type]) return [["heist", heistClasses[type]]];
      const variant = Object.entries(heistSubclasses).find(([tag]) => tags.includes(`heist_equipment_${tag}`));
      return variant ? [["heist", `Heist ${type === "HeistEquipmentTool" ? "Tools" : "Gear"} (${variant[1]})`]] : [];
    }
    case "templar_relic": {
      const size = ["Small", "Medium", "Large"].find((size) => tags.includes(`${size.toLowerCase()}_sanctum_relic`));
      return size ? [["relic", `${size} Relics`]] : [];
    }
    case "tincture": return [["miscellaneous", "Tinctures"]];
    case "deepwater_chart": return type === "DeepwaterChart" ? [["charts", "Chart"]] : [];
    case "area": {
      if (type === "ExpeditionLogbook") return [["mapping", "Expedition Logbooks"]];
      if (type === "MapKey") {
        const variants = { uber_tier_map: "UBER", cannot_be_twinned: "No Twin", low_tier_map: "LOW", mid_tier_map: "MID", top_tier_map: "HIGH" };
        const label = name === "Valdo Map" ? "Valdo" : Object.entries(variants).find(([tag]) => tags.includes(tag))?.[1];
        return label ? [["mapping", `Maps (${label})`]] : [];
      }
      if (tags.includes("primordial_map")) return [["invitation", "Eldritch Invitation"]];
      if (!tags.includes("maven_map")) return [];
      if (tags.includes("maven_void_map_feared") || tags.includes("maven_void_map_hidden")) return [["invitation", name]];
      return [["invitation", tags.includes("maven_void_map") ? "Maven's Invitation" : "Other Invitation"]];
    }
    default: return [];
  }
}

const bases = new Map();
function addBase(entry) {
  bases.set(JSON.stringify(entry), entry);
}

for (const [key, base] of Object.entries(baseItems)) {
  if (base.release_state !== "released" || base.name.startsWith("[")) continue;
  const entry = { name: base.name, class: base.item_class, tags: base.tags };
  if (base.domain === "item" && equipment.has(base.item_class)) {
    if (!base.tags.includes("experimental_base") && !base.tags.includes("talisman")) addBase(entry);
    continue;
  }
  for (const [group, pickerClass, extraTags = [], name = entry.name] of additionalClasses(base, key)) {
    addBase({ ...entry, name, tags: [...extraTags, ...entry.tags], domain: base.domain, group, pickerClass, browseOnly: true });
  }
}

// The Prismatic Jewel is a template for unique jewels, which the released-only export omits.
addBase({ name: "Prismatic Jewel", class: "Jewel", tags: ["jewel", "intjewel", "dexjewel", "strjewel", "not_for_sale", "default"],
  domain: "jewel", group: "jewel", pickerClass: "Prismatic Jewel", browseOnly: true });

// The game stores strongboxes as area objects outside the base-item export.
const strongboxes = [
  ["Currency", "Arcanist's Strongbox", "drops_no_mods drops_no_rares drops_no_quality drops_no_sockets drops_not_dupeable drops_no_threads strongbox"],
  ["Armour", "Armourer's Strongbox", "drops_no_threads armour strongbox"],
  ["Weapon", "Blacksmith's Strongbox", "drops_no_threads weapon strongbox"],
  ["Cartographer", "Cartographer's Strongbox", "drops_no_sockets limited_strongbox_benefits drops_no_threads drops_no_quality map strongbox"],
  ["Chemist", "Chemist's Strongbox", "flask drops_no_rares drops_no_sockets drops_no_threads strongbox"],
  ["Gemcutter", "Gemcutter's Strongbox", "gem drops_no_mods drops_no_rares drops_no_sockets drops_not_dupeable drops_no_threads drops_unaffected_by_rarity strongbox"],
  ["Jeweller", "Jeweller's Strongbox", "drops_no_sockets drops_no_quality drops_no_threads jewellery strongbox"],
  ...["Large Strongbox", "Ornate Strongbox", "Strongbox"].map((name) => ["Generic", name, "strongbox basic_strongbox"]),
  ["Diviner", "Diviner's Strongbox", "drops_no_mods drops_no_rares drops_no_quality drops_no_sockets drops_not_dupeable divination_card drops_no_threads drops_unaffected_by_rarity"],
  ["Operative", "Operative's Strongbox", "drops_no_mods drops_no_rares drops_no_quality drops_no_sockets drops_not_dupeable scarab drops_unaffected_by_rarity strongbox"],
  ["Vaal", "Exquisite Vaal Vessel", "vaal_empowered"],
  ["Jewel", "Opalescent Strongbox", "drops_no_sockets drops_no_quality drops_no_threads jewel strongbox"]
];
for (const [pickerClass, name, tags] of strongboxes) {
  addBase({ name, class: "Strongbox", tags: [...tags.split(" "), "default"], domain: "chest", group: "strongboxes", pickerClass, browseOnly: true });
}

const domains = new Set([...bases.values()].map((base) => base.domain ?? "item"));
const isAffix = (mod) => mod && ["prefix", "suffix"].includes(mod.generation_type);
const itemMods = Object.entries(modifiers).filter(([, mod]) =>
  domains.has(mod.domain) && isAffix(mod) && !mod.is_essence_only);
const possibleTags = new Set([...bases.values()].flatMap((base) => base.tags));
for (const [, mod] of itemMods) {
  for (const tag of mod.adds_tags) possibleTags.add(tag);
}

const weights = (entries, tags) => entries.filter(({ tag }) => tags.has(tag)).map(({ tag, weight }) => [tag, weight]);
function modifierEntry(id, mod, spawn, tags = possibleTags) {
  const entry = { id, name: mod.name || id, text: mod.text || mod.name || id, side: mod.generation_type,
    level: mod.required_level, family: mod.type || id, groups: mod.groups, spawn, tags: mod.implicit_tags };
  if (mod.domain !== "item") entry.domain = mod.domain;
  const generation = weights(mod.generation_weights, tags);
  if (generation.length) entry.generation = generation;
  if (mod.adds_tags.length) entry.adds = mod.adds_tags;
  return entry;
}

const mods = [];
for (const [id, mod] of itemMods) {
  const spawn = weights(mod.spawn_weights, possibleTags);
  if (spawn.some(([, weight]) => weight > 0)) mods.push(modifierEntry(id, mod, spawn));
}

const influenceTags = Object.fromEntries([...equipment].map((type) => [type, itemClasses[type]?.influence_tags ?? []]));
const knownInfluenceTags = new Set(Object.values(influenceTags).flat());
const influencePoolTags = new Set([...possibleTags, ...knownInfluenceTags]);
const influenceMods = [];
for (const [id, mod] of itemMods) {
  if (mod.domain !== "item" || !mod.spawn_weights.some(({ tag, weight }) => weight > 0 && knownInfluenceTags.has(tag))) continue;
  influenceMods.push(modifierEntry(id, mod, weights(mod.spawn_weights, influencePoolTags), influencePoolTags));
}

function addReferenceClasses(byId, id, classes) {
  if (!isAffix(modifiers[id])) return;
  if (!byId.has(id)) byId.set(id, new Set());
  for (const type of classes) byId.get(id).add(type);
}

const crafted = new Map();
for (const recipe of benchOptions) {
  addReferenceClasses(crafted, recipe.actions.add_explicit_mod, recipe.item_classes);
}
const essence = new Map();
for (const { mods: outcomes } of Object.values(essences)) {
  for (const [type, id] of Object.entries(outcomes)) {
    if (modifiers[id]?.is_essence_only) addReferenceClasses(essence, id, [type]);
  }
}
const classReferenceEntries = (byId) => [...byId].map(([id, classes]) => ({
  ...modifierEntry(id, modifiers[id], []), classes: [...classes]
}));
const craftedMods = classReferenceEntries(crafted);
const essenceMods = classReferenceEntries(essence);

const sortedBases = [...bases.values()].sort((a, b) => a.class.localeCompare(b.class) || a.name.localeCompare(b.name));
const formatEntries = (entries) => entries.map((entry) => `    ${JSON.stringify(entry)}`).join(",\n");
const catalog = `{
  "source": "https://repoe-fork.github.io/poe1.html",
  "revision": ${JSON.stringify(revision)},
  "bases": [
${formatEntries(sortedBases)}
  ],
  "mods": [
${formatEntries(mods)}
  ],
  "influenceTags": ${JSON.stringify(influenceTags)},
  "influenceMods": [
${formatEntries(influenceMods)}
  ],
  "craftedMods": [
${formatEntries(craftedMods)}
  ],
  "essenceMods": [
${formatEntries(essenceMods)}
  ]
}
`;
const output = new URL("../data/poe_data/crafting.json", import.meta.url);
await writeFile(output, catalog);
console.log(`Wrote ${sortedBases.length} bases and ${mods.length} modifiers.`);
