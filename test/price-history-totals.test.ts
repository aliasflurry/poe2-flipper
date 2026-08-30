import { describe, expect, it } from "vitest";
import { computeTotalDifferences } from "../src/lib/snapshot";

describe("computeTotalDifferences", () => {
  it("matches the legacy price-history-totals behavior", () => {
    const snapshots = [
      {
        updatedAt: "2026-01-01T00:00:00.000Z",
        prices: { a: 1, b: 2 },
        pairs: {
          "a>b": { one: "a", two: "b", onePrice: 1, twoPrice: 2, volume: 10 }
        }
      },
      {
        updatedAt: "2026-01-01T03:00:00.000Z",
        prices: { a: 1.2, b: 2.4 },
        pairs: {
          "a>b": { one: "a", two: "b", onePrice: 1.2, twoPrice: 2.4, volume: 12 }
        }
      },
      {
        updatedAt: "2026-01-01T06:00:00.000Z",
        prices: { a: 1.1, b: 2.2 },
        pairs: {
          "a>b": { one: "a", two: "b", onePrice: 1.1, twoPrice: 2.2, volume: 11 }
        }
      }
    ];

    const totals = computeTotalDifferences(snapshots);
    expect(totals["a>b"]).toBeCloseTo(0.025, 8);
    expect(totals["b>a"]).toBeCloseTo(0.52066116, 6);
  });
});
