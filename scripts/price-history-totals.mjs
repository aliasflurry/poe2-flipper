// Canonical implementation lives in src/lib/snapshot.ts (computeTotalDifferences).
// This module remains for local scripts that have not been migrated yet.

function pairRateAt(snapshot, fromId, toId) {
  const pairs = snapshot?.pairs;
  if (pairs) {
    const direct = pairs[`${fromId}>${toId}`];
    if (direct) {
      const rate = Number(direct.onePrice) / Number(direct.twoPrice);
      if (Number.isFinite(rate) && rate > 0) return rate;
    }
    const reverse = pairs[`${toId}>${fromId}`];
    if (reverse) {
      const rate = Number(reverse.twoPrice) / Number(reverse.onePrice);
      if (Number.isFinite(rate) && rate > 0) return rate;
    }
  }

  const fromPrice = Number(snapshot?.prices?.[fromId]);
  const toPrice = Number(snapshot?.prices?.[toId]);
  if (fromPrice > 0 && toPrice > 0) return fromPrice / toPrice;
  return NaN;
}

function totalDifferenceForPair(snapshots, fromId, toId) {
  let previous = null;
  let total = 0;
  let compared = 0;

  for (const snapshot of snapshots) {
    const rate = pairRateAt(snapshot, fromId, toId);
    if (!Number.isFinite(rate) || rate <= 0) continue;
    if (previous !== null) {
      total += Math.abs(rate - previous);
      compared += 1;
    }
    previous = rate;
  }

  return compared ? Number(total.toFixed(8)) : null;
}

export function computeTotalDifferences(snapshots) {
  const ordered = [...snapshots].sort(
    (a, b) => new Date(a?.updatedAt) - new Date(b?.updatedAt)
  );
  const pairKeys = new Set();

  for (const snapshot of ordered) {
    const pairs = snapshot?.pairs;
    if (!pairs || typeof pairs !== "object") continue;
    for (const key of Object.keys(pairs)) pairKeys.add(key);
  }

  const totalDifferences = {};
  for (const key of pairKeys) {
    const separator = key.indexOf(">");
    if (separator < 1) continue;
    const one = key.slice(0, separator);
    const two = key.slice(separator + 1);
    if (!one || !two) continue;

    for (const [fromId, toId] of [
      [one, two],
      [two, one]
    ]) {
      const outKey = `${fromId}>${toId}`;
      if (outKey in totalDifferences) continue;
      const total = totalDifferenceForPair(ordered, fromId, toId);
      if (total !== null) totalDifferences[outKey] = total;
    }
  }

  return totalDifferences;
}
