import { describe, expect, it } from "vitest";
import {
  buildPairMap,
  extractSnapshotPairs,
  normalizeSnapshotForStorage
} from "../src/lib/snapshot";

describe("snapshot normalization", () => {
  it("extracts pairs from wrapped payloads and stores compact pairs", () => {
    const payload = {
      updatedAt: "2026-01-01T00:00:00.000Z",
      pairs: [
        {
          CurrencyExchangeSnapshotPairId: 42,
          Volume: 99,
          CurrencyOne: {
            ApiId: "vaal",
            Text: "Vaal Orb",
            IconUrl: "https://example.com/vaal.png",
            CategoryApiId: "currency"
          },
          CurrencyTwo: {
            ApiId: "chaos",
            Text: "Chaos Orb",
            IconUrl: "https://example.com/chaos.png",
            CategoryApiId: "currency"
          },
          CurrencyOneData: { RelativePrice: 2, VolumeTraded: 1, HighestStock: 1 },
          CurrencyTwoData: { RelativePrice: 4, VolumeTraded: 1, HighestStock: 1 }
        }
      ]
    };

    const rawPairs = extractSnapshotPairs(payload);
    const stored = normalizeSnapshotForStorage(rawPairs, "2026-01-01T00:00:00.000Z", "https://example.com");

    expect(stored.pairs).toHaveLength(1);
    expect(stored.pairs[0]).toEqual({
      id: 42,
      one: "vaal",
      two: "chaos",
      onePrice: 2,
      twoPrice: 4,
      volume: 99
    });

    const pairMap = buildPairMap(rawPairs);
    expect(Object.keys(pairMap)).toEqual(["vaal>chaos"]);
  });
});
