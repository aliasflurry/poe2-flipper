import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { marketToPair } from "./update-official-snapshots.mjs";

const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
// Load the app functions without registering browser events or fetching data.
const functions = source.slice(0, source.lastIndexOf("for (const button of els.tabButtons)"));

function app() {
  const elements = new Map();
  const storage = new Map();
  const context = vm.createContext({
    document: {
      querySelector(id) {
        if (!elements.has(id)) elements.set(id, { value: "" });
        return elements.get(id);
      },
      querySelectorAll: () => []
    },
    window: {},
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value)
    }
  });
  vm.runInContext(functions, context);
  return { context, run: (code) => vm.runInContext(code, context) };
}

for (const game of ["poe", "poe2"]) {
  test(`${game}: published catalogs refresh names and local names survive remote failure`, async () => {
    const { context, run } = app();
    context.game = game;
    run("state.gameId = game;");
    const id = "Metadata/Items/Currency/CurrencyAddModToRareOriginator";
    const local = { [id]: { name: "Originator's Exalted Orb" } };
    context.fetch = async (url) => {
      if (url.startsWith("https:")) throw new Error("offline");
      assert.equal(url, `data/${game}_data/item-catalog.json`);
      return { ok: true, json: async () => local };
    };
    assert.equal((await run("fetchItemCatalog()"))[id].name, "Originator's Exalted Orb");
    context.fetch = async (url) => ({ ok: true, json: async () => url.startsWith("https:") ? { [id]: { name: "Unknown item" } } : local });
    assert.equal((await run("fetchItemCatalog()"))[id].name, "Originator's Exalted Orb");
    context.fetch = async (url) => ({ ok: true, json: async () => url.startsWith("https:") ? local : { [id]: { name: "Add Mod To Rare Originator" } } });
    assert.equal((await run("fetchItemCatalog()"))[id].name, "Originator's Exalted Orb");
  });

  test(`${game}: catalog names replace stale labels and unknown items keep their IDs`, () => {
    const { context, run } = app();
    context.game = game;
    run(`
      state.gameId = game;
      const id = 'Metadata/Items/Currency/CurrencyAddModToRareOriginator';
      state.itemCatalog = { [id]: { name: "Originator's Exalted Orb", category: 'currency' } };
      rememberItem({ApiId: id, Text: 'Add Mod To Rare Originator'});
    `);
    assert.equal(run("state.items.get(id).name"), "Originator's Exalted Orb");
    assert.ok(run("currentGame().itemCatalogUrl"));
    run(`state.items.clear(); state.itemCatalog = {}; rememberItem({ApiId: id, Text: 'Add Mod To Rare Originator'});`);
    assert.equal(run("state.items.get(id).unknown"), true);
    assert.match(run("state.items.get(id).name"), /^Unknown item/);
    assert.equal(run("state.items.get(id).id"), "Metadata/Items/Currency/CurrencyAddModToRareOriginator");
  });

  test(`${game}: switching estimates recalculates routes and preserves manual overrides`, () => {
    const { context, run } = app();
    const base = game === "poe"
      ? "Metadata/Items/Currency/CurrencyRerollRare"
      : "Metadata/Items/Currency/CurrencyAddModToRare";
    function pair(one, two, average, low, high) {
      return marketToPair({
        market_pair: [one, two],
        volume_traded: { [one]: 1000, [two]: average * 1000 },
        highest_stock: { [one]: 1000, [two]: 1000 },
        lowest_ratio: { [one]: 1, [two]: low },
        highest_ratio: { [one]: 1, [two]: high }
      });
    }
    context.game = game;
    context.pairs = [
      pair(base, "B", 2, 1.8, 2.2),
      pair("B", "C", 2, 1.8, 2.2),
      pair("C", base, 0.3, 0.25, 0.35)
    ];
    run(`
      state.gameId = game;
      state.rawPairs = pairs;
      els.estimateMode.value = 'conservative';
      buildGraph(pairs);
      const settings = {start: defaultStartCurrency(), amount: 1, length: 'both',
        minVolume: 10, minStock: 1, maxGoldCost: 0,
        excludedItems: new Set(), includedItems: new Set()};
    `);
    assert.equal(run("findCycles(settings).length"), 0);
    assert.equal(run("state.edgesByFrom.get(settings.start)[0].rate"), 1.8);
    // Exercise the actual change handler, isolating only the rendering step.
    run("handleFilterChange = () => saveFilterSettings(); els.estimateMode.value = 'typical'; handleControlsInput({target: els.estimateMode});");
    assert.equal(run("state.edgesByFrom.get(settings.start)[0].rate"), 2);
    assert.equal(run("state.edgesByFrom.get('B')[0].rate"), 0.5);
    assert.equal(run("findCycles(settings).length"), 1);
    assert.equal(run("findCycles(settings)[0].multiplier"), 1.2);
    run("const edge = state.edgesByFrom.get(settings.start)[0]; state.rateOverrides.set(edge.id, 3);");
    for (const mode of ["conservative", "typical"]) {
      context.mode = mode;
      run("els.estimateMode.value = mode; handleControlsInput({target: els.estimateMode});");
      assert.equal(run("state.edgesByFrom.get(settings.start)[0].rate"), 3);
      assert.equal(run("state.edgesByFrom.get(settings.start)[0].isRateOverridden"), true);
    }
  });
}

test("estimate preferences persist separately for both games and default safely", () => {
  const { run } = app();
  run("state.gameId = 'poe2'; els.estimateMode.value = 'typical'; saveFilterSettings();");
  run("state.gameId = 'poe'; loadFilterSettings();");
  assert.equal(run("els.estimateMode.value"), "conservative");
  run("saveFilterSettings(); state.gameId = 'poe2'; loadFilterSettings();");
  assert.equal(run("els.estimateMode.value"), "typical");
  run("state.gameId = 'poe'; loadFilterSettings();");
  assert.equal(run("els.estimateMode.value"), "conservative");
  for (const storedMode of [undefined, "unknown"]) {
    run(`state.filterSettings = {estimateMode: ${JSON.stringify(storedMode) ?? "undefined"}}; applyFilterSettings();`);
    assert.equal(run("els.estimateMode.value"), "conservative");
  }
  run("els.estimateMode.value = 'typical'; saveFilterSettings(); state.gameId = 'poe2'; loadFilterSettings();");
  assert.equal(run("els.estimateMode.value"), "typical");
});

test("typical estimates fall back to conservative when quantities are unusable", () => {
  const { context, run } = app();
  run("els.estimateMode.value = 'typical';");
  for (const volume of [0, undefined, -1, Infinity]) {
    context.volume = volume;
    assert.equal(run("estimatedRate({VolumeTraded: volume, RateToOther: 0.01}, {VolumeTraded: 10})"), 0.01);
  }
});
