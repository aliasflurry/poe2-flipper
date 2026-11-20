import assert from "node:assert/strict";
import test from "node:test";
import { refreshCatalog, unresolvedIds } from "./item-catalog.mjs";

test("refresh replaces generated names, preserves known items, and flags missing IDs", () => {
  const id = "Metadata/Items/Currency/CurrencyAddModToRareOriginator";
  const known = "Metadata/Items/Currency/CurrencyRerollRare";
  const missing = "Metadata/Items/Currency/CurrencyNewItem";
  const old = { [id]: { name: "Add Mod To Rare Originator", icon: "existing.png" }, [known]: { name: "Chaos Orb" } };
  const catalog = refreshCatalog(old, { [id]: { name: "Originator's Exalted Orb" } }, [id, missing]);
  assert.equal(catalog[id].name, "Originator's Exalted Orb");
  assert.equal(catalog[id].icon, "existing.png");
  assert.equal(catalog[known].name, "Chaos Orb");
  assert.equal(catalog[missing].name, "Unknown item");
  assert.deepEqual(unresolvedIds(catalog, [id, known, missing, missing]), [missing]);
  assert.equal(old[id].name, "Add Mod To Rare Originator");
  assert.equal(refreshCatalog(old, {}, [id])[id].name, "Unknown item");
});

test("confirmed game names that resemble generated names stay resolved on later refreshes", () => {
  const id = "Metadata/Items/Currency/BreachSplinter";
  const catalog = refreshCatalog({}, { [id]: { name: "Breach Splinter" } }, [id]);
  assert.deepEqual(unresolvedIds(catalog, [id]), []);
  assert.equal(refreshCatalog(catalog, {}, [id])[id].name, "Breach Splinter");
});
