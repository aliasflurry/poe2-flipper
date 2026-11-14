import assert from "node:assert/strict";
import test from "node:test";
import { historyEntry, marketToPair } from "./update-official-snapshots.mjs";
import { computeTotalDifferences } from "./price-history-totals.mjs";

const chaos = "Metadata/Items/Currency/CurrencyRerollRare";
const divine = "Metadata/Items/Currency/CurrencyModValues";

function market(overrides = {}) {
  return {
    market_id: `${chaos}|${divine}`,
    market_pair: [chaos, divine],
    volume_traded: { [chaos]: 1000, [divine]: 10 },
    highest_stock: { [chaos]: 500, [divine]: 5 },
    lowest_ratio: { [chaos]: 93, [divine]: 1 },
    highest_ratio: { [chaos]: 110, [divine]: 1 },
    ...overrides
  };
}

test("converts official ratio bounds into the existing pair direction", () => {
  const pair = marketToPair(market(), {
    [chaos]: { name: "Chaos Orb", category: "currency" },
    [divine]: { name: "Divine Orb", category: "currency" }
  });
  assert.equal(pair.CurrencyOne.Text, "Chaos Orb");
  assert.equal(pair.CurrencyTwo.Text, "Divine Orb");
  assert.equal(pair.Volume, 10);
  assert.equal(pair.CurrencyOneData.HighestStock, 500);
  assert.equal(pair.CurrencyTwoData.HighestStock, 5);
  assert.equal(pair.CurrencyOneData.RelativePrice / pair.CurrencyTwoData.RelativePrice, 1 / 110);
  assert.equal(pair.CurrencyOneData.RateToOther, 1 / 110);
  assert.ok(Math.abs(pair.CurrencyTwoData.RateToOther - 93) < 1e-12);

  const entry = historyEntry([pair], "2026-11-14T20:00:00.000Z");
  assert.equal(entry.pairs[`${chaos}>${divine}`].volume, 10);
  assert.equal(entry.pairs[`${chaos}>${divine}`].forwardRate, 1 / 110);
  assert.ok(Math.abs(entry.pairs[`${chaos}>${divine}`].reverseRate - 93) < 1e-12);
  assert.equal(entry.prices, undefined);

  const next = historyEntry([marketToPair(market({
    lowest_ratio: { [chaos]: 90, [divine]: 1 },
    highest_ratio: { [chaos]: 100, [divine]: 1 }
  }))], "2026-11-14T23:00:00.000Z");
  const differences = computeTotalDifferences([entry, next]);
  assert.equal(differences[`${chaos}>${divine}`], Number((1 / 100 - 1 / 110).toFixed(8)));
  assert.equal(differences[`${divine}>${chaos}`], 3);
});

test("ignores markets without a traded volume or usable ratio", () => {
  assert.equal(marketToPair(market({ volume_traded: { [chaos]: 0, [divine]: 0 } })), null);
  assert.equal(marketToPair(market({ lowest_ratio: {}, highest_ratio: {} })), null);
  assert.equal(marketToPair(market({ market_pair: [chaos] })), null);
});
