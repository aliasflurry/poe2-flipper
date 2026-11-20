export const UNKNOWN_ITEM = "Unknown item";

export function generatedName(id) {
  return id.split("/").at(-1)
    .replace(/^(Currency|DivinationCard|MapFragment)/, "")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2").trim();
}

export function resolvedName(id, name, source) {
  return typeof name === "string" && name.trim() && name !== id &&
    name !== UNKNOWN_ITEM && (source === "base-items" || source === "verified" || name !== generatedName(id)) ? name : null;
}

export function refreshCatalog(existing, baseItems, ids) {
  const catalog = { ...existing };
  for (const id of new Set([...Object.keys(existing), ...ids])) {
    const previous = existing[id];
    const base = baseItems[id];
    const name = base?.name?.trim() || resolvedName(id, previous?.name, previous?.nameSource);
    const art = base?.visual_identity?.dds_file;
    catalog[id] = {
      name: name || UNKNOWN_ITEM,
      ...(base?.name?.trim() ? { nameSource: "base-items" } : previous?.nameSource ? { nameSource: previous.nameSource } : {}),
      icon: previous?.icon || (art ? `https://web.poecdn.com/image/${art.replace(/\.dds$/i, ".png")}` : ""),
      category: previous?.category || id.split("/")[2]?.toLowerCase() || "unknown"
    };
  }
  return catalog;
}

export async function fetchBaseItems(gameId) {
  const url = `https://repoe-fork.github.io/${gameId === "poe2" ? "poe2/" : ""}base_items.json`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const data = await response.json();
  if (!data || typeof data !== "object" || Array.isArray(data) || !Object.keys(data).some((id) => id.startsWith("Metadata/Items/"))) {
    throw new Error(`${url}: invalid base item data`);
  }
  return data;
}

export function unresolvedIds(catalog, ids) {
  return [...new Set(ids)].filter((id) => !resolvedName(id, catalog[id]?.name, catalog[id]?.nameSource)).sort();
}
