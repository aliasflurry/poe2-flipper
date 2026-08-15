const SNAPSHOT_DATA_BASE = "https://raw.githubusercontent.com/aliasflurry/poe2-flipper/snapshots";

const GAME_CONFIGS = {
  poe2: {
    label: "Path of Exile 2",
    storagePrefix: "poe2",
    defaultStartCurrency: "exalted",
    localSnapshotUrl: `${SNAPSHOT_DATA_BASE}/data/poe2_data/snapshot.json`,
    historyUrl: `${SNAPSHOT_DATA_BASE}/data/poe2_data/price-history.json`,
    goldCostsUrl: "data/poe2_data/gold-costs.json",
    liveSnapshotUrl: "https://api.poe2scout.com/poe2/Leagues/runes/SnapshotPairs"
  },
  poe: {
    label: "Path of Exile",
    storagePrefix: "poe",
    defaultStartCurrency: "chaos",
    localSnapshotUrl: `${SNAPSHOT_DATA_BASE}/data/poe_data/snapshot.json`,
    historyUrl: `${SNAPSHOT_DATA_BASE}/data/poe_data/price-history.json`,
    goldCostsUrl: "data/poe_data/gold-costs.json",
    liveSnapshotUrl: "https://api.poe2scout.com/pc/Leagues/allflame/SnapshotPairs"
  }
};
const DEFAULT_GAME_ID = "poe2";
const EXCLUDED_STORAGE_KEY = "exchange-excluded-items";
const INCLUDED_STORAGE_KEY = "exchange-included-items";
const RATE_OVERRIDES_STORAGE_KEY = "exchange-rate-overrides";
const FILTER_SETTINGS_STORAGE_KEY = "exchange-filter-settings";
const TRENDS_SETTINGS_STORAGE_KEY = "price-trends-settings";
const TRENDS_MIN_DAILY_VOLUME = 100;
const FORECAST_CHECKPOINT_COUNT = 8;
const DEFAULT_CHECKPOINT_MS = 2.5 * 60 * 60 * 1000;
const HISTORY_PREDICTION_COLOR = "#9aa4b5";

const CATEGORY_LABELS = {
  poe: {
    allflameembers: "Allflame Embers",
    ancestor: "Tattoos & Omens",
    cards: "Divination Cards",
    catalysts: "Catalysts",
    currency: "Currency",
    deliriumorbs: "Delirium Orbs",
    delve: "Delve",
    essences: "Essences",
    expedition: "Expedition",
    fragments: "Fragments",
    keepers: "Keepers",
    oils: "Oils",
    runegrafts: "Runegrafts"
  },
  poe2: {
    abyss: "Abyss",
    breach: "Breach",
    currency: "Currency",
    delirium: "Delirium",
    essences: "Essences",
    expedition: "Expedition",
    fragments: "Fragments",
    idol: "Idols",
    incursion: "Incursion",
    lineagesupportgems: "Lineage Support Gems",
    ritual: "Ritual",
    runes: "Runes",
    ultimatum: "Ultimatum",
    uncutgems: "Uncut Gems",
    vaal: "Vaal",
    vaultkeys: "Vault Keys",
    verisium: "Verisium"
  }
};

const state = {
  gameId: DEFAULT_GAME_ID,
  rawPairs: [],
  items: new Map(),
  itemPricesById: new Map(),
  priceHistory: [],
  goldCostsByName: new Map(),
  goldCostsByItem: new Map(),
  edgesByFrom: new Map(),
  lastLoadedAt: null,
  currentPage: 1,
  trendsPage: 1,
  sortBy: "gain",
  sortDirection: "desc",
  excludedItems: new Set(),
  includedItems: new Set(),
  rateOverrides: new Map(),
  filterSettings: null,
  trendsSettings: null,
  excludedTrendsTypes: new Set()
};

const els = {
  refreshButton: document.querySelector("#refreshButton"),
  resetOverridesButton: document.querySelector("#resetOverridesButton"),
  startCurrency: document.querySelector("#startCurrency"),
  startAmount: document.querySelector("#startAmount"),
  pathLength: document.querySelector("#pathLength"),
  minVolume: document.querySelector("#minVolume"),
  minStock: document.querySelector("#minStock"),
  maxGoldCost: document.querySelector("#maxGoldCost"),
  pageSize: document.querySelector("#pageSize"),
  excludeSearch: document.querySelector("#excludeSearch"),
  excludeOptions: document.querySelector("#excludeOptions"),
  excludedChips: document.querySelector("#excludedChips"),
  includeSearch: document.querySelector("#includeSearch"),
  includeOptions: document.querySelector("#includeOptions"),
  includedChips: document.querySelector("#includedChips"),
  status: document.querySelector("#status"),
  snapshotMeta: document.querySelector("#snapshotMeta"),
  results: document.querySelector("#results"),
  pagination: document.querySelector("#pagination"),
  sortButtons: document.querySelectorAll(".sort-button"),
  template: document.querySelector("#resultTemplate"),
  gameButtons: document.querySelectorAll(".game-tab-button"),
  gameEyebrow: document.querySelector("#gameEyebrow"),
  tabButtons: document.querySelectorAll(".tab-button"),
  exchangeView: document.querySelector("#exchangeView"),
  priceTrendsView: document.querySelector("#priceTrendsView"),
  campaignView: document.querySelector("#campaignView"),
  campaignTabButton: document.querySelector('.tab-button[data-tab="campaign"]'),
  trendsControls: document.querySelector("#trendsControls"),
  trendsStartCurrency: document.querySelector("#trendsStartCurrency"),
  trendsSearch: document.querySelector("#trendsSearch"),
  trendsPageSize: document.querySelector("#trendsPageSize"),
  trendsExcludeTypeSearch: document.querySelector("#trendsExcludeTypeSearch"),
  trendsExcludeTypeOptions: document.querySelector("#trendsExcludeTypeOptions"),
  trendsExcludedTypeChips: document.querySelector("#trendsExcludedTypeChips"),
  trendsStatus: document.querySelector("#trendsStatus"),
  trendsMeta: document.querySelector("#trendsMeta"),
  trendsResults: document.querySelector("#trendsResults"),
  trendsPagination: document.querySelector("#trendsPagination"),
  campaignActs: document.querySelector("#campaignActs"),
  campaignSummary: document.querySelector("#campaignSummary"),
  campaignStatus: document.querySelector("#campaignStatus"),
  campaignMeta: document.querySelector("#campaignMeta"),
  campaignResetButton: document.querySelector("#campaignResetButton"),
  workspace: document.querySelector(".workspace")
};

const TAB_VIEWS = {
  exchange: () => els.exchangeView,
  "price-trends": () => els.priceTrendsView,
  campaign: () => els.campaignView
};

const numberFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 4
});

const percentFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  style: "percent"
});

function currentGame() {
  return GAME_CONFIGS[state.gameId] || GAME_CONFIGS[DEFAULT_GAME_ID];
}

function gameStorageKey(key) {
  return `${currentGame().storagePrefix}-${key}`;
}

function defaultStartCurrency() {
  return currentGame().defaultStartCurrency || "exalted";
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePositiveRate(value) {
  const text = String(value).trim();
  if (!text) return null;

  const parts = text.split("/");
  if (parts.length === 1) {
    const rate = Number(parts[0].trim());
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  }

  if (parts.length !== 2) return null;

  const numerator = Number(parts[0].trim());
  const denominator = Number(parts[1].trim());
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || numerator <= 0 || denominator <= 0) {
    return null;
  }

  return numerator / denominator;
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function rememberItem(item) {
  if (!item?.ApiId) return;
  if (!state.items.has(item.ApiId)) {
    state.items.set(item.ApiId, {
      id: item.ApiId,
      name: item.Text,
      icon: item.IconUrl,
      category: item.CategoryApiId
    });
  }
}

function rememberItemPrice(item, data) {
  const price = toNumber(data?.RelativePrice);
  if (item?.ApiId && price > 0) {
    state.itemPricesById.set(item.ApiId, price);
  }
}

function hydrateGoldCosts() {
  state.goldCostsByItem.clear();

  for (const item of state.items.values()) {
    const goldCost = state.goldCostsByName.get(normalizeName(item.name));
    if (Number.isFinite(goldCost)) {
      state.goldCostsByItem.set(item.id, goldCost);
    }
  }
}

function makeEdge(pair, fromItem, toItem, fromData, toData) {
  const fromPrice = toNumber(fromData.RelativePrice);
  const toPrice = toNumber(toData.RelativePrice);
  const volume = Math.min(toNumber(fromData.VolumeTraded), toNumber(toData.VolumeTraded));
  const stock = Math.min(toNumber(fromData.HighestStock), toNumber(toData.HighestStock));

  if (fromPrice <= 0 || toPrice <= 0 || fromItem.ApiId === toItem.ApiId) {
    return null;
  }

  const id = `${pair.CurrencyExchangeSnapshotPairId}:${fromItem.ApiId}>${toItem.ApiId}`;
  const originalRate = fromPrice / toPrice;
  const overrideRate = state.rateOverrides.get(id);

  return {
    id,
    pairId: pair.CurrencyExchangeSnapshotPairId,
    from: fromItem.ApiId,
    to: toItem.ApiId,
    fromName: fromItem.Text,
    toName: toItem.Text,
    rate: Number.isFinite(overrideRate) && overrideRate > 0 ? overrideRate : originalRate,
    originalRate,
    isRateOverridden: Number.isFinite(overrideRate) && overrideRate > 0,
    fromPrice,
    toPrice,
    volume,
    stock
  };
}

function buildGraph(pairs) {
  state.items.clear();
  state.itemPricesById.clear();
  state.edgesByFrom.clear();

  for (const pair of pairs) {
    const one = pair.CurrencyOne;
    const two = pair.CurrencyTwo;
    rememberItem(one);
    rememberItem(two);
    rememberItemPrice(one, pair.CurrencyOneData);
    rememberItemPrice(two, pair.CurrencyTwoData);

    const edges = [
      makeEdge(pair, one, two, pair.CurrencyOneData, pair.CurrencyTwoData),
      makeEdge(pair, two, one, pair.CurrencyTwoData, pair.CurrencyOneData)
    ].filter(Boolean);

    for (const edge of edges) {
      if (!state.edgesByFrom.has(edge.from)) {
        state.edgesByFrom.set(edge.from, []);
      }
      state.edgesByFrom.get(edge.from).push(edge);
    }
  }
}

function populateCurrencies() {
  const fallback = defaultStartCurrency();
  const current = state.filterSettings?.startCurrency || els.startCurrency.value || fallback;
  let removedMissingExclusions = false;
  for (const itemId of state.excludedItems) {
    if (!state.items.has(itemId)) {
      state.excludedItems.delete(itemId);
      removedMissingExclusions = true;
    }
  }
  if (removedMissingExclusions) {
    saveExcludedItems();
  }

  let removedMissingInclusions = false;
  for (const itemId of state.includedItems) {
    if (!state.items.has(itemId)) {
      state.includedItems.delete(itemId);
      removedMissingInclusions = true;
    }
  }
  if (removedMissingInclusions) {
    saveIncludedItems();
  }

  const options = [...state.items.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.name;
      return option;
    });
  const searchOptions = [...state.items.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => {
      const option = document.createElement("option");
      option.value = item.name;
      option.dataset.itemId = item.id;
      return option;
    });

  els.startCurrency.replaceChildren(...options);
  els.startCurrency.value = state.items.has(current) ? current : fallback;
  els.excludeOptions.replaceChildren(...searchOptions.map((option) => option.cloneNode(true)));
  els.includeOptions.replaceChildren(...searchOptions);
  renderExcludedChips();
  renderIncludedChips();
  populateTrendsCurrencies();
}

function getSettings() {
  return {
    start: els.startCurrency.value,
    amount: Math.max(toNumber(els.startAmount.value), 0),
    length: els.pathLength.value,
    minVolume: Math.max(toNumber(els.minVolume.value), 0),
    minStock: Math.max(toNumber(els.minStock.value), 0),
    maxGoldCost: Math.max(toNumber(els.maxGoldCost.value), 0),
    pageSize: Math.min(Math.max(Math.round(toNumber(els.pageSize.value)), 1), 100),
    excludedItems: state.excludedItems,
    includedItems: state.includedItems
  };
}

function edgePasses(edge, settings) {
  return edge.volume >= settings.minVolume
    && edge.stock >= settings.minStock
    && !settings.excludedItems.has(edge.from)
    && !settings.excludedItems.has(edge.to);
}

function findCycles(settings) {
  const firstEdges = (state.edgesByFrom.get(settings.start) || []).filter((edge) => edgePasses(edge, settings));
  const cycles = [];

  for (const first of firstEdges) {
    if (settings.length !== "3") {
      for (const second of state.edgesByFrom.get(first.to) || []) {
        if (!edgePasses(second, settings) || second.to !== settings.start || second.pairId === first.pairId) continue;
        cycles.push(scorePath([first, second], settings.amount));
      }
    }

    if (settings.length !== "2") {
      for (const second of state.edgesByFrom.get(first.to) || []) {
        if (!edgePasses(second, settings) || second.to === settings.start || second.to === first.from) continue;

        for (const third of state.edgesByFrom.get(second.to) || []) {
          if (!edgePasses(third, settings) || third.to !== settings.start) continue;
          if (new Set([first.pairId, second.pairId, third.pairId]).size !== 3) continue;
          cycles.push(scorePath([first, second, third], settings.amount));
        }
      }
    }
  }

  return cycles
    .filter((cycle) => cycle.route.every((itemId) => !settings.excludedItems.has(itemId)))
    .filter((cycle) => (
      settings.includedItems.size === 0
      || cycle.route.some((itemId) => settings.includedItems.has(itemId))
    ))
    .filter((cycle) => cycle.multiplier > 1)
    .filter((cycle) => settings.maxGoldCost === 0 || cycle.goldCost <= settings.maxGoldCost)
    .sort(compareCycles);
}

function scorePath(edges, amount) {
  const multiplier = edges.reduce((total, edge) => total * edge.rate, 1);
  const route = [edges[0].from, ...edges.map((edge) => edge.to)];
  let runningAmount = amount;
  let goldCost = 0;
  const stepAmounts = [];

  for (const edge of edges) {
    const outputAmount = runningAmount * edge.rate;
    const unitGoldCost = state.goldCostsByItem.get(edge.to) || 0;
    const stepGoldCost = outputAmount * unitGoldCost;

    goldCost += stepGoldCost;
    stepAmounts.push({
      input: runningAmount,
      output: outputAmount,
      unitGoldCost,
      goldCost: stepGoldCost
    });
    runningAmount = outputAmount;
  }

  return {
    edges,
    stepAmounts,
    multiplier,
    input: amount,
    output: amount * multiplier,
    profit: amount * (multiplier - 1),
    goldCost,
    profitPerGold: goldCost > 0 ? (amount * (multiplier - 1)) / goldCost : 0,
    profitPerMillionGold: goldCost > 0 ? ((amount * (multiplier - 1)) / goldCost) * 1000000 : 0,
    profitPerMillionGoldValue: goldCost > 0 ? ((amount * (multiplier - 1)) / goldCost) * 1000000 * marketValueFor(edges[0].from) : 0,
    route
  };
}

function compareCycles(a, b) {
  const direction = state.sortDirection === "asc" ? 1 : -1;
  const valueA = state.sortBy === "profit" ? a.profitPerMillionGoldValue : a.multiplier - 1;
  const valueB = state.sortBy === "profit" ? b.profitPerMillionGoldValue : b.multiplier - 1;

  if (valueA === valueB) {
    return b.multiplier - a.multiplier;
  }

  return (valueA - valueB) * direction;
}

function itemLabel(id) {
  return state.items.get(id)?.name || id;
}

function itemIcon(id) {
  return state.items.get(id)?.icon || "";
}

async function copyItemName(name) {
  if (!navigator.clipboard?.writeText) return false;

  try {
    await navigator.clipboard.writeText(name);
    return true;
  } catch {
    return false;
  }
}

function exaltedValueFor(itemId) {
  if (itemId === "exalted") return 1;
  return state.itemPricesById.get(itemId) || 0;
}

function marketValueFor(itemId) {
  if (itemId === defaultStartCurrency()) return 1;
  return state.itemPricesById.get(itemId) || 0;
}

function formatDivineProfit(value) {
  const divinePrice = marketValueFor("divine");
  const fallbackCurrency = state.gameId === "poe" ? "Chaos Orb" : "Exalted Orb";
  const remainderCurrency = state.gameId === "poe" ? "Chaos" : "Exalted";
  if (!divinePrice) {
    return `${numberFormat.format(value)} ${fallbackCurrency}`;
  }

  const divines = Math.floor(value / divinePrice);
  const remainder = value - (divines * divinePrice);

  if (divines <= 0) {
    return `${numberFormat.format(remainder)} ${fallbackCurrency}`;
  }

  return `${numberFormat.format(divines)} Divine + ${numberFormat.format(remainder)} ${remainderCurrency}`;
}

function loadExcludedItems() {
  try {
    const stored = JSON.parse(localStorage.getItem(gameStorageKey(EXCLUDED_STORAGE_KEY)) || "[]");
    state.excludedItems = new Set(Array.isArray(stored) ? stored.filter((itemId) => typeof itemId === "string") : []);
  } catch {
    state.excludedItems = new Set();
  }
}

function saveExcludedItems() {
  try {
    localStorage.setItem(gameStorageKey(EXCLUDED_STORAGE_KEY), JSON.stringify([...state.excludedItems]));
  } catch {
    // The filter still works for the current session if storage is unavailable.
  }
}

function loadIncludedItems() {
  try {
    const stored = JSON.parse(localStorage.getItem(gameStorageKey(INCLUDED_STORAGE_KEY)) || "[]");
    state.includedItems = new Set(Array.isArray(stored) ? stored.filter((itemId) => typeof itemId === "string") : []);
  } catch {
    state.includedItems = new Set();
  }
}

function saveIncludedItems() {
  try {
    localStorage.setItem(gameStorageKey(INCLUDED_STORAGE_KEY), JSON.stringify([...state.includedItems]));
  } catch {
    // The filter still works for the current session if storage is unavailable.
  }
}

function loadRateOverrides() {
  try {
    const stored = JSON.parse(localStorage.getItem(gameStorageKey(RATE_OVERRIDES_STORAGE_KEY)) || "{}");
    state.rateOverrides = new Map(
      Object.entries(stored).filter(([, rate]) => Number.isFinite(rate) && rate > 0)
    );
  } catch {
    state.rateOverrides = new Map();
  }
}

function saveRateOverrides() {
  try {
    if (state.rateOverrides.size) {
      localStorage.setItem(gameStorageKey(RATE_OVERRIDES_STORAGE_KEY), JSON.stringify(Object.fromEntries(state.rateOverrides)));
    } else {
      localStorage.removeItem(gameStorageKey(RATE_OVERRIDES_STORAGE_KEY));
    }
  } catch {
    // Overrides still apply for the current session if storage is unavailable.
  }
}

function loadFilterSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(gameStorageKey(FILTER_SETTINGS_STORAGE_KEY)) || "null");
    state.filterSettings = stored && typeof stored === "object" ? stored : null;
    applyFilterSettings();
  } catch {
    state.filterSettings = null;
  }
}

function saveFilterSettings() {
  const settings = {
    startCurrency: els.startCurrency.value,
    startAmount: els.startAmount.value,
    pathLength: els.pathLength.value,
    minVolume: els.minVolume.value,
    minStock: els.minStock.value,
    maxGoldCost: els.maxGoldCost.value,
    pageSize: els.pageSize.value,
    sortBy: state.sortBy,
    sortDirection: state.sortDirection
  };

  state.filterSettings = settings;

  try {
    localStorage.setItem(gameStorageKey(FILTER_SETTINGS_STORAGE_KEY), JSON.stringify(settings));
  } catch {
    // Filters still apply for the current session if storage is unavailable.
  }
}

function applyFilterSettings() {
  const settings = state.filterSettings;
  if (!settings) return;

  setInputValue(els.startAmount, settings.startAmount);
  setInputValue(els.minVolume, settings.minVolume);
  setInputValue(els.minStock, settings.minStock);
  setInputValue(els.maxGoldCost, settings.maxGoldCost);
  setInputValue(els.pageSize, settings.pageSize);

  if (["both", "2", "3"].includes(settings.pathLength)) {
    els.pathLength.value = settings.pathLength;
  }

  if (typeof settings.startCurrency === "string" && (!state.items.size || state.items.has(settings.startCurrency))) {
    els.startCurrency.value = settings.startCurrency;
  }

  if (["gain", "profit"].includes(settings.sortBy)) {
    state.sortBy = settings.sortBy;
  }

  if (["asc", "desc"].includes(settings.sortDirection)) {
    state.sortDirection = settings.sortDirection;
  }
}

function loadTrendsSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(gameStorageKey(TRENDS_SETTINGS_STORAGE_KEY)) || "null");
    state.trendsSettings = stored && typeof stored === "object" ? stored : null;
    applyTrendsSettings();
  } catch {
    state.trendsSettings = null;
    state.excludedTrendsTypes = new Set();
  }
}

function saveTrendsSettings() {
  const settings = {
    startCurrency: els.trendsStartCurrency.value,
    pageSize: els.trendsPageSize.value,
    search: els.trendsSearch.value,
    excludedTypes: [...state.excludedTrendsTypes]
  };

  state.trendsSettings = settings;

  try {
    localStorage.setItem(gameStorageKey(TRENDS_SETTINGS_STORAGE_KEY), JSON.stringify(settings));
  } catch {
    // Trends settings still apply for the current session if storage is unavailable.
  }
}

function applyTrendsSettings() {
  const settings = state.trendsSettings;
  if (!settings) {
    state.excludedTrendsTypes = new Set();
    renderExcludedTrendsTypeChips();
    return;
  }

  setInputValue(els.trendsPageSize, settings.pageSize);
  if (typeof settings.search === "string") {
    els.trendsSearch.value = settings.search;
  }

  if (typeof settings.startCurrency === "string" && (!state.items.size || state.items.has(settings.startCurrency))) {
    els.trendsStartCurrency.value = settings.startCurrency;
  }

  state.excludedTrendsTypes = new Set(
    Array.isArray(settings.excludedTypes)
      ? settings.excludedTypes.filter((value) => typeof value === "string" && value.trim())
      : []
  );
  renderExcludedTrendsTypeChips();
}

function categoryLabel(categoryId) {
  const id = String(categoryId || "").toLowerCase();
  if (!id) return "Unknown";
  const labels = CATEGORY_LABELS[state.gameId] || {};
  if (labels[id]) return labels[id];
  return id
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function availableTrendCategories() {
  const categories = new Map();
  for (const item of state.items.values()) {
    const id = String(item.category || "").toLowerCase();
    if (!id) continue;
    if (!categories.has(id)) {
      categories.set(id, categoryLabel(id));
    }
  }
  return [...categories.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function populateTrendsTypeOptions() {
  const options = availableTrendCategories().map((category) => {
    const option = document.createElement("option");
    option.value = category.label;
    option.dataset.categoryId = category.id;
    return option;
  });
  els.trendsExcludeTypeOptions.replaceChildren(...options);

  let removedMissing = false;
  for (const categoryId of [...state.excludedTrendsTypes]) {
    if (![...state.items.values()].some((item) => String(item.category || "").toLowerCase() === categoryId)) {
      state.excludedTrendsTypes.delete(categoryId);
      removedMissing = true;
    }
  }
  if (removedMissing) saveTrendsSettings();
  renderExcludedTrendsTypeChips();
}

function findTrendCategoryBySearch(value) {
  const query = value.trim().toLowerCase();
  if (!query) return null;

  const categories = availableTrendCategories();
  const exact = categories.find((category) => (
    category.label.toLowerCase() === query || category.id === query
  ));
  if (exact) return exact;

  const partial = categories.filter((category) => (
    category.label.toLowerCase().includes(query) || category.id.includes(query)
  ));
  return partial.length === 1 ? partial[0] : null;
}

function addExcludedTrendsType(value) {
  const category = findTrendCategoryBySearch(value);
  if (!category) return false;

  state.excludedTrendsTypes.add(category.id);
  saveTrendsSettings();
  els.trendsExcludeTypeSearch.value = "";
  state.trendsPage = 1;
  renderExcludedTrendsTypeChips();
  renderPriceTrends();
  return true;
}

function removeExcludedTrendsType(categoryId) {
  state.excludedTrendsTypes.delete(categoryId);
  saveTrendsSettings();
  state.trendsPage = 1;
  renderExcludedTrendsTypeChips();
  renderPriceTrends();
}

function renderExcludedTrendsTypeChips() {
  if (!els.trendsExcludedTypeChips) return;
  els.trendsExcludedTypeChips.replaceChildren();

  for (const categoryId of [...state.excludedTrendsTypes].sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)))) {
    const label = categoryLabel(categoryId);
    const chip = document.createElement("span");
    const name = document.createElement("span");
    const remove = document.createElement("button");

    chip.className = "exclude-chip";
    name.textContent = label;
    remove.type = "button";
    remove.className = "chip-remove";
    remove.textContent = "X";
    remove.title = `Remove ${label}`;
    remove.setAttribute("aria-label", `Remove ${label}`);
    remove.addEventListener("click", () => removeExcludedTrendsType(categoryId));

    chip.append(name, remove);
    els.trendsExcludedTypeChips.append(chip);
  }
}

function populateTrendsCurrencies() {
  const fallback = defaultStartCurrency();
  const current = state.trendsSettings?.startCurrency || els.trendsStartCurrency.value || fallback;
  const options = [...state.items.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.name;
      return option;
    });

  els.trendsStartCurrency.replaceChildren(...options);
  els.trendsStartCurrency.value = state.items.has(current) ? current : fallback;
  populateTrendsTypeOptions();
}

function setInputValue(input, value) {
  if (typeof value === "string" && value.trim() !== "") {
    input.value = value;
  }
}

function updateResetOverridesButton() {
  els.resetOverridesButton.disabled = state.rateOverrides.size === 0;
}

function setRateOverride(edge, rate) {
  state.rateOverrides.set(edge.id, rate);
  saveRateOverrides();
  updateResetOverridesButton();
  buildGraph(state.rawPairs);
  state.currentPage = 1;
  renderResults();
}

function resetRateOverrides() {
  if (!state.rateOverrides.size) return;

  state.rateOverrides.clear();
  saveRateOverrides();
  updateResetOverridesButton();
  buildGraph(state.rawPairs);
  state.currentPage = 1;
  renderResults();
}

function findItemBySearch(value) {
  const query = value.trim().toLowerCase();
  if (!query) return null;

  const items = [...state.items.values()];
  const exact = items.find((item) => (
    item.name.toLowerCase() === query || item.id.toLowerCase() === query
  ));
  if (exact) return exact;

  const partialMatches = items.filter((item) => (
    item.name.toLowerCase().includes(query) || item.id.toLowerCase().includes(query)
  ));

  return partialMatches.length === 1 ? partialMatches[0] : null;
}

function addExcludedItem(value) {
  const item = findItemBySearch(value);
  if (!item) return false;

  state.excludedItems.add(item.id);
  saveExcludedItems();
  els.excludeSearch.value = "";
  state.currentPage = 1;
  renderExcludedChips();
  renderResults();
  return true;
}

function removeExcludedItem(itemId) {
  state.excludedItems.delete(itemId);
  saveExcludedItems();
  state.currentPage = 1;
  renderExcludedChips();
  renderResults();
}

function renderExcludedChips() {
  els.excludedChips.replaceChildren();

  for (const itemId of [...state.excludedItems].sort((a, b) => itemLabel(a).localeCompare(itemLabel(b)))) {
    const item = state.items.get(itemId);
    if (!item) continue;

    const chip = document.createElement("span");
    const name = document.createElement("span");
    const remove = document.createElement("button");

    chip.className = "exclude-chip";
    name.textContent = item.name;
    remove.type = "button";
    remove.className = "chip-remove";
    remove.textContent = "X";
    remove.title = `Remove ${item.name}`;
    remove.setAttribute("aria-label", `Remove ${item.name}`);
    remove.addEventListener("click", () => removeExcludedItem(item.id));

    chip.append(name, remove);
    els.excludedChips.append(chip);
  }
}

function addIncludedItem(value) {
  const item = findItemBySearch(value);
  if (!item) return false;

  state.includedItems.add(item.id);
  saveIncludedItems();
  els.includeSearch.value = "";
  state.currentPage = 1;
  renderIncludedChips();
  renderResults();
  return true;
}

function removeIncludedItem(itemId) {
  state.includedItems.delete(itemId);
  saveIncludedItems();
  state.currentPage = 1;
  renderIncludedChips();
  renderResults();
}

function renderIncludedChips() {
  els.includedChips.replaceChildren();

  for (const itemId of [...state.includedItems].sort((a, b) => itemLabel(a).localeCompare(itemLabel(b)))) {
    const item = state.items.get(itemId);
    if (!item) continue;

    const chip = document.createElement("span");
    const name = document.createElement("span");
    const remove = document.createElement("button");

    chip.className = "exclude-chip";
    name.textContent = item.name;
    remove.type = "button";
    remove.className = "chip-remove";
    remove.textContent = "X";
    remove.title = `Remove ${item.name}`;
    remove.setAttribute("aria-label", `Remove ${item.name}`);
    remove.addEventListener("click", () => removeIncludedItem(item.id));

    chip.append(name, remove);
    els.includedChips.append(chip);
  }
}

function renderResults() {
  const settings = getSettings();
  let cycles = findCycles(settings);

  if (!cycles.length && settings.start !== defaultStartCurrency() && state.items.has(defaultStartCurrency())) {
    const defaultSettings = {
      ...settings,
      start: defaultStartCurrency()
    };
    const defaultCycles = findCycles(defaultSettings);
    if (defaultCycles.length) {
      els.startCurrency.value = defaultSettings.start;
      settings.start = defaultSettings.start;
      cycles = defaultCycles;
      saveFilterSettings();
    }
  }

  const totalPages = Math.max(Math.ceil(cycles.length / settings.pageSize), 1);

  state.currentPage = Math.min(Math.max(state.currentPage, 1), totalPages);
  const startIndex = (state.currentPage - 1) * settings.pageSize;
  const visibleCycles = cycles.slice(startIndex, startIndex + settings.pageSize);

  els.results.replaceChildren();
  els.pagination.replaceChildren();
  updateSortButtons();

  if (!settings.start) {
    renderEmpty("No currencies are available yet.");
    return;
  }

  if (!cycles.length) {
    const lengthText = settings.length === "both" ? "2 or 3 trade" : `${settings.length} trade`;
    renderEmpty(`No profitable ${lengthText} loops match these filters.`);
    return;
  }

  visibleCycles.forEach((cycle, index) => {
    const node = els.template.content.cloneNode(true);
    const card = node.querySelector(".result-card");
    const rank = node.querySelector(".result-rank");
    const title = node.querySelector("h2");
    const path = node.querySelector(".path-text");
    const gain = node.querySelector(".gain");
    const profitScore = node.querySelector(".profit-score");
    const steps = node.querySelector(".steps");

    rank.textContent = `#${startIndex + index + 1}`;
    title.textContent = `${numberFormat.format(cycle.input)} ${itemLabel(settings.start)} -> ${numberFormat.format(cycle.output)} ${itemLabel(settings.start)}`;
    path.textContent = `${cycle.route.map(itemLabel).join(" > ")} | gold ${numberFormat.format(Math.ceil(cycle.goldCost))}`;
    gain.textContent = `+${percentFormat.format(cycle.multiplier - 1)}`;
    profitScore.textContent = formatDivineProfit(cycle.profitPerMillionGoldValue);
    card.style.setProperty("--accent", cycle.multiplier > 1.1 ? "#d7a84f" : "#5bbf98");

    cycle.edges.forEach((edge, stepIndex) => {
      const li = document.createElement("li");
      li.append(makeStepItems(edge), makeStepMeta(edge, stepIndex, cycle.stepAmounts[stepIndex]));
      steps.append(li);
    });

    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-expanded", "false");
    card.title = "Show 7 day price history";
    card.addEventListener("click", (event) => toggleHistoryCard(card, cycle, event));
    card.addEventListener("keydown", (event) => {
      if (event.target?.closest("button, input, select, a, label")) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleHistoryCard(card, cycle, event);
    });

    els.results.append(node);
  });

  renderPagination(cycles.length, totalPages, settings.pageSize);
}

function toggleHistoryCard(card, cycle, event) {
  if (event?.target?.closest("button, input, select, a, label")) return;

  const existing = card.querySelector(".history-panel");
  if (existing) {
    existing.remove();
    card.classList.remove("expanded");
    card.setAttribute("aria-expanded", "false");
    return;
  }

  card.append(renderHistoryPanel(cycle));
  card.classList.add("expanded");
  card.setAttribute("aria-expanded", "true");
}

function renderHistoryPanel(cycle) {
  const panel = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const meta = document.createElement("span");
  const chart = document.createElement("div");
  const legend = document.createElement("div");
  const seenPairs = new Set();
  const series = cycle.edges
    .filter((edge) => {
      const key = `${edge.from}>${edge.to}`;
      if (seenPairs.has(key)) return false;
      seenPairs.add(key);
      return true;
    })
    .map((edge) => ({
      name: `${itemLabel(edge.from)} > ${itemLabel(edge.to)}`,
      points: pairRatePointsFor(edge.from, edge.to)
    }))
    .filter((entry) => entry.points.length);

  panel.className = "history-panel";
  header.className = "history-header";
  title.textContent = "7 day price history";
  meta.textContent = state.priceHistory.length
    ? `${state.priceHistory.length} snapshots`
    : "No snapshots";
  chart.className = "history-chart";
  legend.className = "history-legend";
  header.append(title, meta);

  if (!series.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "Historical prices will appear here after the snapshot workflow runs.";
    panel.append(header, empty);
    return panel;
  }

  const chartApi = renderHistoryChart(chart, series);
  for (const [index, entry] of series.entries()) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "history-legend-chip";
    chip.style.setProperty("--series-color", historyColor(index));
    chip.setAttribute("aria-pressed", "true");
    chip.title = "Toggle this line";
    chip.textContent = `${entry.name} ${formatHistoryChange(entry.points)}`;
    chip.addEventListener("click", () => {
      const next = chip.getAttribute("aria-pressed") === "false";
      chip.setAttribute("aria-pressed", String(next));
      chip.classList.toggle("legend-hidden", !next);
      chartApi.setSeriesVisible(index, next);
    });
    legend.append(chip);
  }

  panel.append(header, chart, legend);
  return panel;
}

function pairRatePointsFor(fromId, toId) {
  return state.priceHistory
    .map((snapshot) => {
      const rate = pairRateAt(snapshot, fromId, toId);
      const date = new Date(snapshot.updatedAt);
      if (!Number.isFinite(rate) || rate <= 0 || Number.isNaN(date.getTime())) return null;
      return { date, price: rate };
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date);
}

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

function pairVolumeAt(snapshot, fromId, toId) {
  const pairs = snapshot?.pairs;
  if (!pairs) return NaN;

  const direct = pairs[`${fromId}>${toId}`];
  if (direct) {
    const volume = Number(direct.volume);
    if (Number.isFinite(volume)) return volume;
  }

  const reverse = pairs[`${toId}>${fromId}`];
  if (reverse) {
    const volume = Number(reverse.volume);
    if (Number.isFinite(volume)) return volume;
  }

  return NaN;
}

function latestPairVolume(fromId, toId) {
  for (let index = state.priceHistory.length - 1; index >= 0; index -= 1) {
    const volume = pairVolumeAt(state.priceHistory[index], fromId, toId);
    if (Number.isFinite(volume)) return volume;
  }
  return NaN;
}

function averageCheckpointIntervalMs(points) {
  if (!Array.isArray(points) || points.length < 2) return DEFAULT_CHECKPOINT_MS;

  const gaps = [];
  for (let index = 1; index < points.length; index += 1) {
    const gap = points[index].date.getTime() - points[index - 1].date.getTime();
    if (Number.isFinite(gap) && gap > 0) gaps.push(gap);
  }

  if (!gaps.length) return DEFAULT_CHECKPOINT_MS;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

function predictNextCheckpointPoints(points, checkpointCount = FORECAST_CHECKPOINT_COUNT) {
  if (!Array.isArray(points) || points.length < 2 || checkpointCount < 1) return null;

  const t0 = points[0].date.getTime();
  let sumT = 0;
  let sumP = 0;
  let sumTP = 0;
  let sumTT = 0;

  for (const point of points) {
    const t = point.date.getTime() - t0;
    const price = point.price;
    if (!Number.isFinite(t) || !Number.isFinite(price)) continue;
    sumT += t;
    sumP += price;
    sumTP += t * price;
    sumTT += t * t;
  }

  const n = points.length;
  const denom = n * sumTT - sumT * sumT;
  if (!denom) return null;

  const slope = (n * sumTP - sumT * sumP) / denom;
  const intercept = (sumP - slope * sumT) / n;
  const last = points[points.length - 1];
  if (!last?.price) return null;

  const intervalMs = averageCheckpointIntervalMs(points);
  const forecastPoints = [{ date: new Date(last.date.getTime()), price: last.price }];

  for (let step = 1; step <= checkpointCount; step += 1) {
    const forecastTime = last.date.getTime() + step * intervalMs;
    const forecastPrice = intercept + slope * (forecastTime - t0);
    if (!Number.isFinite(forecastPrice) || forecastPrice <= 0) return null;
    forecastPoints.push({ date: new Date(forecastTime), price: forecastPrice });
  }

  const end = forecastPoints[forecastPoints.length - 1];
  return {
    points: forecastPoints,
    change: (end.price - last.price) / last.price
  };
}

function formatSignedPercent(change) {
  if (!Number.isFinite(change)) return "";
  const sign = change >= 0 ? "+" : "";
  return `${sign}${percentFormat.format(change)}`;
}

function seriesColor(entry, index) {
  return entry?.color || historyColor(index);
}

function renderHistoryChart(container, series) {
  const namespace = "http://www.w3.org/2000/svg";
  const width = 720;
  const height = 260;
  const padding = { top: 18, right: 18, bottom: 34, left: 54 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const visibility = series.map(() => true);

  // Scales recompute from the currently visible series so the plot rescales on legend toggles.
  const scale = { minTime: 0, maxTime: 0, timeRange: 1, yMin: 0, priceRange: 1 };
  const xFor = (time) => padding.left + ((time - scale.minTime) / scale.timeRange) * plotWidth;
  const yFor = (price) => padding.top + (1 - (price - scale.yMin) / scale.priceRange) * plotHeight;

  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Seven day price history chart");

  const gridLayer = document.createElementNS(namespace, "g");
  const seriesLayer = document.createElementNS(namespace, "g");
  const crosshair = document.createElementNS(namespace, "line");
  crosshair.setAttribute("class", "history-crosshair");
  crosshair.setAttribute("y1", String(padding.top));
  crosshair.setAttribute("y2", String(padding.top + plotHeight));
  crosshair.style.opacity = "0";

  const focusLayer = document.createElementNS(namespace, "g");
  const focusDots = series.map((entry, index) => {
    const focus = document.createElementNS(namespace, "circle");
    focus.setAttribute("class", "history-focus");
    focus.setAttribute("r", "4.5");
    focus.setAttribute("fill", seriesColor(entry, index));
    focus.style.opacity = "0";
    focusLayer.append(focus);
    return focus;
  });

  svg.append(gridLayer, seriesLayer, crosshair, focusLayer);

  const tooltip = document.createElement("div");
  tooltip.className = "history-tooltip";
  tooltip.hidden = true;

  function visiblePoints() {
    const points = [];
    for (const [index, entry] of series.entries()) {
      if (visibility[index]) points.push(...entry.points);
    }
    return points.length ? points : series.flatMap((entry) => entry.points);
  }

  function computeScale() {
    const points = visiblePoints();
    const times = points.map((point) => point.date.getTime());
    const prices = points.map((point) => point.price);
    scale.minTime = Math.min(...times);
    scale.maxTime = Math.max(...times);
    scale.timeRange = Math.max(scale.maxTime - scale.minTime, 1);
    const yScale = niceAxisTicks(Math.min(...prices), Math.max(...prices), 4);
    scale.yMin = yScale.min;
    scale.priceRange = Math.max(yScale.max - yScale.min, 1e-9);
    scale.yScale = yScale;
  }

  function drawGrid() {
    gridLayer.replaceChildren();

    for (const tick of scale.yScale.ticks) {
      const y = yFor(tick);
      if (y < padding.top - 0.5 || y > padding.top + plotHeight + 0.5) continue;
      const line = document.createElementNS(namespace, "line");
      line.setAttribute("x1", String(padding.left));
      line.setAttribute("x2", String(width - padding.right));
      line.setAttribute("y1", y.toFixed(2));
      line.setAttribute("y2", y.toFixed(2));
      line.setAttribute("class", "history-grid-line");
      gridLayer.append(line);
      appendHistoryAxisText(gridLayer, padding.left - 6, y + 4, formatAxisNumber(tick, scale.yScale.step), "end");
    }

    const xTicks = niceTimeTicks(scale.minTime, scale.maxTime, 4);
    for (const tick of xTicks.ticks) {
      const x = xFor(tick);
      if (x < padding.left - 0.5 || x > width - padding.right + 0.5) continue;
      const line = document.createElementNS(namespace, "line");
      line.setAttribute("x1", x.toFixed(2));
      line.setAttribute("x2", x.toFixed(2));
      line.setAttribute("y1", String(padding.top));
      line.setAttribute("y2", String(padding.top + plotHeight));
      line.setAttribute("class", "history-grid-line");
      gridLayer.append(line);
      appendHistoryAxisText(gridLayer, x, height - 12, formatAxisTime(tick, xTicks.stepMs), "middle");
    }
  }

  function drawSeries() {
    seriesLayer.replaceChildren();

    for (const [index, entry] of series.entries()) {
      if (!visibility[index]) continue;
      const color = seriesColor(entry, index);
      const group = document.createElementNS(namespace, "g");
      group.setAttribute("class", entry.predicted ? "history-series history-series-predicted" : "history-series");
      const path = document.createElementNS(namespace, "path");
      const d = entry.points
        .map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${xFor(point.date.getTime()).toFixed(2)} ${yFor(point.price).toFixed(2)}`)
        .join(" ");

      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", color);
      path.setAttribute("stroke-width", entry.predicted ? "2.5" : "3");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      if (entry.predicted) {
        path.setAttribute("stroke-dasharray", "7 5");
      }
      group.append(path);

      for (const [pointIndex, point] of entry.points.entries()) {
        if (entry.predicted && pointIndex === 0) continue;
        const dot = document.createElementNS(namespace, "circle");
        dot.setAttribute("class", entry.predicted ? "history-point history-point-predicted" : "history-point");
        dot.setAttribute("cx", xFor(point.date.getTime()).toFixed(2));
        dot.setAttribute("cy", yFor(point.price).toFixed(2));
        dot.setAttribute("r", entry.predicted ? "3.5" : "2.5");
        dot.setAttribute("fill", entry.predicted ? "transparent" : color);
        if (entry.predicted) {
          dot.setAttribute("stroke", color);
          dot.setAttribute("stroke-width", "2");
        }
        group.append(dot);
      }

      seriesLayer.append(group);
    }
  }

  function redraw() {
    computeScale();
    drawGrid();
    drawSeries();
  }

  redraw();
  container.append(svg, tooltip);
  attachHistoryInteractions({ svg, tooltip, container, series, crosshair, focusDots, visibility, scale, xFor, yFor, plotWidth, padding, width });

  return {
    setSeriesVisible(index, visible) {
      if (index < 0 || index >= series.length) return;
      visibility[index] = visible;
      if (!visible) focusDots[index].style.opacity = "0";
      redraw();
    }
  };
}

function attachHistoryInteractions(ctx) {
  const { svg, tooltip, container, series, crosshair, focusDots, visibility, scale, xFor, yFor } = ctx;
  const priceByTime = series.map((entry) => {
    const map = new Map();
    for (const point of entry.points) map.set(point.date.getTime(), point.price);
    return map;
  });

  const hide = () => {
    tooltip.hidden = true;
    crosshair.style.opacity = "0";
    for (const dot of focusDots) dot.style.opacity = "0";
  };

  const move = (event) => {
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;

    const visibleTimes = [...new Set(
      series.flatMap((entry, index) => (visibility[index] ? entry.points.map((point) => point.date.getTime()) : []))
    )].sort((a, b) => a - b);
    if (!visibleTimes.length) {
      hide();
      return;
    }

    const viewX = ((event.clientX - rect.left) / rect.width) * ctx.width;
    const targetTime = scale.minTime + ((viewX - ctx.padding.left) / ctx.plotWidth) * scale.timeRange;
    const nearest = visibleTimes.reduce((best, time) => (Math.abs(time - targetTime) < Math.abs(best - targetTime) ? time : best), visibleTimes[0]);
    const snapX = xFor(nearest);

    crosshair.setAttribute("x1", snapX.toFixed(2));
    crosshair.setAttribute("x2", snapX.toFixed(2));
    crosshair.style.opacity = "1";

    const rows = [];
    for (const [index, entry] of series.entries()) {
      const focus = focusDots[index];
      const price = priceByTime[index].get(nearest);
      if (!visibility[index] || price === undefined) {
        focus.style.opacity = "0";
        continue;
      }
      focus.setAttribute("cx", snapX.toFixed(2));
      focus.setAttribute("cy", yFor(price).toFixed(2));
      focus.style.opacity = "1";
      rows.push(`<div class="history-tooltip-row"><span class="history-tooltip-dot" style="background:${seriesColor(entry, index)}"></span><span class="history-tooltip-name">${entry.name}</span><strong>${numberFormat.format(price)}</strong></div>`);
    }

    if (!rows.length) {
      hide();
      return;
    }

    tooltip.innerHTML = `<div class="history-tooltip-time">${new Date(nearest).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>${rows.join("")}`;
    tooltip.hidden = false;

    const containerRect = container.getBoundingClientRect();
    const pixelX = (snapX / ctx.width) * rect.width;
    const maxTooltipWidth = Math.max(120, containerRect.width - 8);
    tooltip.style.maxWidth = `${Math.min(260, maxTooltipWidth)}px`;

    const tooltipWidth = Math.ceil(Math.max(tooltip.offsetWidth, tooltip.scrollWidth));
    const tooltipHeight = Math.ceil(Math.max(tooltip.offsetHeight, tooltip.scrollHeight));
    const gap = 14;
    const maxLeft = Math.max(4, containerRect.width - tooltipWidth - 4);
    const maxTop = Math.max(4, containerRect.height - tooltipHeight - 4);

    // Prefer the right side of the cursor, but flip left near the chart edge
    // so the tooltip is not clipped by overflow:hidden on .history-chart.
    let left = pixelX + gap;
    if (left > maxLeft) {
      left = pixelX - tooltipWidth - gap;
    }
    left = Math.min(Math.max(left, 4), maxLeft);

    let top = event.clientY - containerRect.top - tooltipHeight - 12;
    if (top < 4) {
      top = event.clientY - containerRect.top + 12;
    }
    top = Math.min(Math.max(top, 4), maxTop);

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };

  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerdown", move);
  svg.addEventListener("pointerleave", hide);
}

function niceStep(range, targetCount) {
  const rough = Math.abs(range) / Math.max(targetCount, 1) || 1;
  const power = Math.pow(10, Math.floor(Math.log10(rough)));
  const fraction = rough / power;
  let niceFraction;
  if (fraction < 1.5) niceFraction = 1;
  else if (fraction < 3) niceFraction = 2;
  else if (fraction < 7) niceFraction = 5;
  else niceFraction = 10;
  return niceFraction * power;
}

function niceAxisTicks(min, max, targetCount) {
  if (!(max > min)) {
    const step = niceStep(Math.abs(min) || 1, targetCount);
    return { min: min - step, max: min + step, step, ticks: [min - step, min, min + step] };
  }

  const step = niceStep(max - min, targetCount);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks = [];
  for (let value = niceMin; value <= niceMax + step * 1e-9; value += step) {
    ticks.push(Number(value.toFixed(12)));
  }
  return { min: niceMin, max: niceMax, step, ticks };
}

function niceTimeTicks(minTime, maxTime, targetCount) {
  const dayMs = 24 * 60 * 60 * 1000;
  const stepDays = Math.max(niceStep((maxTime - minTime) / dayMs, targetCount), 0.5);
  const stepMs = stepDays * dayMs;
  const start = Math.ceil(minTime / stepMs) * stepMs;
  const ticks = [];
  for (let time = start; time <= maxTime + 1; time += stepMs) {
    ticks.push(time);
  }
  if (!ticks.length) ticks.push(minTime, maxTime);
  return { ticks, stepMs };
}

function formatAxisNumber(value, step) {
  const decimals = Math.min(6, Math.max(0, -Math.floor(Math.log10(step))));
  return value.toFixed(decimals);
}

function formatAxisTime(time, stepMs) {
  const date = new Date(time);
  if (stepMs < 24 * 60 * 60 * 1000) {
    return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function appendHistoryAxisText(svg, x, y, value, anchor = "start") {
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", String(x));
  text.setAttribute("y", String(y));
  text.setAttribute("class", "history-axis-text");
  text.setAttribute("text-anchor", anchor);
  text.textContent = value;
  svg.append(text);
}

function formatHistoryChange(points) {
  if (points.length < 2) return "";
  const first = points[0].price;
  const last = points[points.length - 1].price;
  if (!first) return "";
  const change = (last - first) / first;
  const sign = change >= 0 ? "+" : "";
  return `${sign}${percentFormat.format(change)}`;
}

function historyChangeValue(points) {
  if (points.length < 2) return null;
  const first = points[0].price;
  const last = points[points.length - 1].price;
  if (!first) return null;
  const change = (last - first) / first;
  return Number.isFinite(change) ? change : null;
}

function getTrendsPageSize() {
  return Math.min(100, Math.max(1, Number(els.trendsPageSize.value) || 10));
}

function buildTrendEntries(startId) {
  if (!startId || !state.items.has(startId)) return [];

  const entries = [];
  for (const item of state.items.values()) {
    if (item.id === startId) continue;
    const categoryId = String(item.category || "").toLowerCase();
    if (categoryId && state.excludedTrendsTypes.has(categoryId)) continue;

    const volume = latestPairVolume(item.id, startId);
    if (!(volume > TRENDS_MIN_DAILY_VOLUME)) continue;

    const points = pairRatePointsFor(item.id, startId);
    if (!points.length) continue;
    entries.push({
      itemId: item.id,
      name: item.name,
      points,
      change: historyChangeValue(points),
      volume
    });
  }

  entries.sort((a, b) => {
    const aHas = a.change !== null;
    const bHas = b.change !== null;
    if (aHas && bHas) return a.change - b.change;
    if (aHas) return -1;
    if (bHas) return 1;
    return a.name.localeCompare(b.name);
  });

  return entries;
}

function renderPriceTrends() {
  const startId = els.trendsStartCurrency.value;
  const search = els.trendsSearch.value.trim().toLowerCase();
  const pageSize = getTrendsPageSize();

  if (!state.items.size) {
    renderTrendsEmpty("Load exchange data to view price trends.");
    els.trendsStatus.textContent = "Waiting for exchange data...";
    els.trendsMeta.textContent = "";
    return;
  }

  if (!startId || !state.items.has(startId)) {
    renderTrendsEmpty("Select a starting currency to view price trends.");
    els.trendsStatus.textContent = "Select a starting currency.";
    els.trendsMeta.textContent = "";
    return;
  }

  let entries = buildTrendEntries(startId);
  if (search) {
    entries = entries.filter((entry) => entry.name.toLowerCase().includes(search));
  }

  const totalResults = entries.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  state.trendsPage = Math.min(Math.max(1, state.trendsPage), totalPages);

  const startName = itemLabel(startId);
  const excludedTypeCount = state.excludedTrendsTypes.size;
  els.trendsStatus.textContent = totalResults
    ? `${totalResults.toLocaleString()} items vs ${startName} (vol > ${TRENDS_MIN_DAILY_VOLUME}${excludedTypeCount ? `, ${excludedTypeCount} type${excludedTypeCount === 1 ? "" : "s"} excluded` : ""}), sorted by % change`
    : search
      ? `No items match "${els.trendsSearch.value.trim()}"`
      : `No historical pairs found vs ${startName} with volume > ${TRENDS_MIN_DAILY_VOLUME}`;
  els.trendsMeta.textContent = state.priceHistory.length
    ? `${state.priceHistory.length} snapshots (7 day)`
    : "No snapshots";

  if (!totalResults) {
    renderTrendsEmpty(
      state.priceHistory.length
        ? "No matching items with price history and volume over 100 for the current filters."
        : "Historical prices will appear here after the snapshot workflow runs."
    );
    return;
  }

  const pageEntries = entries.slice((state.trendsPage - 1) * pageSize, state.trendsPage * pageSize);
  const cards = pageEntries.map((entry) => makeTrendCard(entry, startName));
  els.trendsResults.replaceChildren(...cards);
  els.trendsPagination.replaceChildren();
  renderTrendsPagination(totalResults, totalPages, pageSize);
}

function renderTrendsEmpty(message) {
  const empty = document.createElement("p");
  empty.className = "empty";
  empty.textContent = message;
  els.trendsResults.replaceChildren(empty);
  els.trendsPagination.replaceChildren();
}

function makeTrendCard(entry, startName) {
  const card = document.createElement("article");
  const header = document.createElement("div");
  const identity = document.createElement("div");
  const icon = document.createElement("img");
  const titleWrap = document.createElement("div");
  const title = document.createElement("h2");
  const subtitle = document.createElement("p");
  const metrics = document.createElement("div");
  const change = document.createElement("strong");
  const forecast = document.createElement("strong");
  const chart = document.createElement("div");
  const changeText = formatHistoryChange(entry.points);
  const prediction = predictNextCheckpointPoints(entry.points);

  card.className = "trends-card";
  header.className = "trends-card-header";
  identity.className = "trends-card-identity";
  icon.src = itemIcon(entry.itemId);
  icon.alt = "";
  icon.className = "trends-card-icon";
  titleWrap.className = "trends-card-titles";
  title.textContent = entry.name;
  subtitle.className = "trends-card-subtitle";
  subtitle.textContent = `Price in ${startName}`;
  metrics.className = "trends-card-metrics";
  change.className = "trends-card-change";
  if (entry.change !== null) {
    change.textContent = changeText;
    change.title = "7 day change";
    change.classList.toggle("down", entry.change < 0);
    change.classList.toggle("up", entry.change > 0);
  } else {
    change.textContent = "n/a";
    change.classList.add("muted");
  }

  forecast.className = "trends-card-forecast";
  if (prediction) {
    forecast.textContent = `+${FORECAST_CHECKPOINT_COUNT} ${formatSignedPercent(prediction.change)}`;
    forecast.title = `Linear forecast for the next ${FORECAST_CHECKPOINT_COUNT} checkpoints`;
    forecast.classList.toggle("down", prediction.change < 0);
    forecast.classList.toggle("up", prediction.change > 0);
  } else {
    forecast.textContent = `+${FORECAST_CHECKPOINT_COUNT} n/a`;
    forecast.classList.add("muted");
  }

  chart.className = "history-chart trends-card-chart";

  titleWrap.append(title, subtitle);
  identity.append(icon, titleWrap);
  metrics.append(change, forecast);
  header.append(identity, metrics);
  card.append(header, chart);

  const chartSeries = [
    {
      name: `${entry.name} / ${startName}`,
      points: entry.points
    }
  ];

  if (prediction) {
    chartSeries.push({
      name: `+${FORECAST_CHECKPOINT_COUNT} checkpoint forecast`,
      points: prediction.points,
      predicted: true,
      color: HISTORY_PREDICTION_COLOR
    });
  }

  renderHistoryChart(chart, chartSeries);

  return card;
}

function renderTrendsPagination(totalResults, totalPages, pageSize) {
  const previous = makeTrendsPageButton("Previous", state.trendsPage - 1, state.trendsPage === 1);
  const next = makeTrendsPageButton("Next", state.trendsPage + 1, state.trendsPage === totalPages);
  const summary = document.createElement("span");
  const pages = document.createElement("div");
  const firstResult = (state.trendsPage - 1) * pageSize + 1;
  const lastResult = Math.min(state.trendsPage * pageSize, totalResults);

  summary.className = "pagination-summary";
  summary.textContent = `${numberFormat.format(firstResult)}-${numberFormat.format(lastResult)} of ${numberFormat.format(totalResults)} results`;
  pages.className = "page-numbers";

  for (const page of getVisiblePages(totalPages, state.trendsPage)) {
    if (page === "...") {
      const gap = document.createElement("span");
      gap.className = "page-gap";
      gap.textContent = "...";
      pages.append(gap);
      continue;
    }

    const pageButton = makeTrendsPageButton(String(page), page, page === state.trendsPage);
    pageButton.classList.add("page-number");
    pageButton.setAttribute("aria-label", `Go to page ${page}`);
    if (page === state.trendsPage) {
      pageButton.setAttribute("aria-current", "page");
    }
    pages.append(pageButton);
  }

  els.trendsPagination.append(previous, pages, next, summary);
}

function makeTrendsPageButton(label, page, disabled) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "page-button";
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", () => {
    state.trendsPage = page;
    renderPriceTrends();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  return button;
}

function historyColor(index) {
  return ["#d7a84f", "#5bbf98", "#7aa7ff", "#d66d5f"][index % 4];
}

function updateSortButtons() {
  for (const button of els.sortButtons) {
    const isActive = button.dataset.sort === state.sortBy;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
    button.textContent = `${button.dataset.sort === "profit" ? "Profit / 1M gold" : "Gain %"}${isActive ? (state.sortDirection === "desc" ? " v" : " ^") : ""}`;
  }
}

function renderEmpty(message) {
  const empty = document.createElement("p");
  empty.className = "empty";
  empty.textContent = message;
  els.results.replaceChildren(empty);
  els.pagination.replaceChildren();
}

function renderPagination(totalResults, totalPages, pageSize) {
  const previous = makePageButton("Previous", state.currentPage - 1, state.currentPage === 1);
  const next = makePageButton("Next", state.currentPage + 1, state.currentPage === totalPages);
  const summary = document.createElement("span");
  const pages = document.createElement("div");
  const firstResult = (state.currentPage - 1) * pageSize + 1;
  const lastResult = Math.min(state.currentPage * pageSize, totalResults);

  summary.className = "pagination-summary";
  summary.textContent = `${numberFormat.format(firstResult)}-${numberFormat.format(lastResult)} of ${numberFormat.format(totalResults)} results`;
  pages.className = "page-numbers";

  for (const page of getVisiblePages(totalPages, state.currentPage)) {
    if (page === "...") {
      const gap = document.createElement("span");
      gap.className = "page-gap";
      gap.textContent = "...";
      pages.append(gap);
      continue;
    }

    const pageButton = makePageButton(String(page), page, page === state.currentPage);
    pageButton.classList.add("page-number");
    pageButton.setAttribute("aria-label", `Go to page ${page}`);
    if (page === state.currentPage) {
      pageButton.setAttribute("aria-current", "page");
    }
    pages.append(pageButton);
  }

  els.pagination.append(previous, pages, next, summary);
}

function makePageButton(label, page, disabled) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "page-button";
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", () => {
    state.currentPage = page;
    renderResults();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  return button;
}

function getVisiblePages(totalPages, currentPage) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages]);
  const start = Math.max(2, currentPage - 2);
  const end = Math.min(totalPages - 1, currentPage + 2);

  for (let page = start; page <= end; page += 1) {
    pages.add(page);
  }

  return [...pages]
    .sort((a, b) => a - b)
    .reduce((visible, page, index, sortedPages) => {
      if (index > 0 && page - sortedPages[index - 1] > 1) {
        visible.push("...");
      }
      visible.push(page);
      return visible;
    }, []);
}

function makeStepItems(edge) {
  const wrap = document.createElement("div");
  const fromIcon = document.createElement("img");
  const arrow = document.createElement("span");
  const toIcon = document.createElement("img");

  wrap.className = "step-items";
  fromIcon.src = itemIcon(edge.from);
  fromIcon.alt = "";
  arrow.className = "arrow";
  arrow.textContent = "->";
  toIcon.src = itemIcon(edge.to);
  toIcon.alt = "";

  wrap.append(fromIcon, makeCopyableItemName(edge.fromName), arrow, toIcon, makeCopyableItemName(edge.toName));
  return wrap;
}

function makeCopyableItemName(name) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "copy-item-name";
  button.textContent = name;
  button.title = `Copy ${name}`;
  button.setAttribute("aria-label", `Copy ${name}`);
  button.addEventListener("click", async () => {
    const copied = await copyItemName(name);
    button.classList.toggle("copied", copied);
    button.title = copied ? `Copied ${name}` : `Could not copy ${name}`;
    window.setTimeout(() => {
      button.classList.remove("copied");
      button.title = `Copy ${name}`;
    }, 1200);
  });
  return button;
}

function makeStepMeta(edge, stepIndex, stepAmount) {
  const wrap = document.createElement("div");
  const values = [
    `Trade ${stepIndex + 1}`,
    `vol ${numberFormat.format(edge.volume)}`,
    `stock ${numberFormat.format(edge.stock)}`,
    `gold ${numberFormat.format(Math.ceil(stepAmount?.goldCost || 0))}`
  ];

  wrap.className = "step-meta";
  wrap.append(makeRateEditor(edge));

  for (const value of values) {
    const span = document.createElement("span");
    span.textContent = value;
    wrap.append(span);
  }

  return wrap;
}

function makeRateEditor(edge) {
  const wrap = document.createElement("label");
  const input = document.createElement("input");
  const suffix = document.createElement("span");
  const value = String(edge.rate);

  wrap.className = "rate-editor";
  wrap.classList.toggle("overridden", edge.isRateOverridden);
  wrap.title = edge.isRateOverridden
    ? `Override rate. Original: ${numberFormat.format(edge.originalRate)}x`
    : "Edit this exchange rate";

  input.className = "rate-input";
  input.type = "text";
  input.inputMode = "decimal";
  input.pattern = "\\s*\\d*\\.?\\d+(\\s*/\\s*\\d*\\.?\\d+)?\\s*";
  input.value = value;
  input.setAttribute("aria-label", `Rate for ${edge.fromName} to ${edge.toName}`);

  suffix.className = "rate-suffix";
  suffix.textContent = "x";

  input.addEventListener("change", () => commitRateInput(edge, input));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    }

    if (event.key === "Escape") {
      input.value = value;
      input.blur();
    }
  });

  wrap.append(input, suffix);
  return wrap;
}

function commitRateInput(edge, input) {
  const rate = parsePositiveRate(input.value);
  if (!rate) {
    input.value = String(edge.rate);
    return;
  }

  if (rate === edge.rate) return;
  setRateOverride(edge, rate);
}

function switchTab(tabName) {
  const activeTab = TAB_VIEWS[tabName] ? tabName : "exchange";

  for (const [name, getView] of Object.entries(TAB_VIEWS)) {
    getView()?.classList.toggle("active", name === activeTab);
  }

  for (const button of els.tabButtons) {
    const isActive = button.dataset.tab === activeTab;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }

  if (activeTab === "price-trends") {
    renderPriceTrends();
  }
}

window.switchTab = switchTab;

function updateGameControls() {
  const game = currentGame();
  els.gameEyebrow.textContent = game.label;
  els.workspace?.setAttribute("data-game", state.gameId);
  window.CampaignModule?.setCampaignTabVisible(state.gameId === "poe2", els);

  for (const button of els.gameButtons) {
    const isActive = button.dataset.game === state.gameId;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function resetControlsToDefaults() {
  document.querySelector("#controls").reset();
  els.trendsControls?.reset();
  state.currentPage = 1;
  state.trendsPage = 1;
  state.sortBy = "gain";
  state.sortDirection = "desc";
  state.filterSettings = null;
  state.trendsSettings = null;
  state.excludedTrendsTypes = new Set();
  renderExcludedTrendsTypeChips();
  updateSortButtons();
}

function resetExchangeState() {
  state.rawPairs = [];
  state.items.clear();
  state.itemPricesById.clear();
  state.priceHistory = [];
  state.goldCostsByName.clear();
  state.goldCostsByItem.clear();
  state.edgesByFrom.clear();
  state.excludedItems.clear();
  state.includedItems.clear();
  state.rateOverrides.clear();
  els.startCurrency.replaceChildren();
  els.trendsStartCurrency.replaceChildren();
  els.trendsExcludeTypeOptions.replaceChildren();
  els.excludeOptions.replaceChildren();
  els.excludedChips.replaceChildren();
  els.includeOptions.replaceChildren();
  els.includedChips.replaceChildren();
  els.results.replaceChildren();
  els.pagination.replaceChildren();
  els.trendsResults.replaceChildren();
  els.trendsPagination.replaceChildren();
  els.snapshotMeta.textContent = "";
  els.trendsStatus.textContent = "Select a starting currency to view price trends.";
  els.trendsMeta.textContent = "";
  renderExcludedTrendsTypeChips();
}

function switchGame(gameId) {
  if (!GAME_CONFIGS[gameId] || gameId === state.gameId) return;

  saveFilterSettings();
  saveTrendsSettings();
  state.gameId = gameId;
  updateGameControls();
  resetExchangeState();
  resetControlsToDefaults();
  loadExcludedItems();
  loadIncludedItems();
  loadRateOverrides();
  loadFilterSettings();
  loadTrendsSettings();
  updateResetOverridesButton();
  loadData();
}

async function loadData() {
  const requestedGameId = state.gameId;
  const game = currentGame();
  els.refreshButton.disabled = true;
  els.status.textContent = `Loading ${game.label} exchange data...`;
  els.snapshotMeta.textContent = "";

  try {
    const [loaded, goldCosts, history] = await Promise.all([
      fetchSnapshot(),
      fetchGoldCosts(),
      fetchPriceHistory()
    ]);

    if (requestedGameId !== state.gameId) return;

    state.rawPairs = loaded.pairs;
    state.priceHistory = history;
    state.goldCostsByName = goldCosts.costsByName;
    state.lastLoadedAt = new Date();
    buildGraph(state.rawPairs);
    hydrateGoldCosts();
    populateCurrencies();
    renderResults();
    renderPriceTrends();

    els.status.textContent = `${state.rawPairs.length.toLocaleString()} ${game.label} exchange pairs loaded`;
    const matchedGoldCosts = `${state.goldCostsByItem.size.toLocaleString()} gold costs matched`;
    els.snapshotMeta.textContent = loaded.updatedAt
      ? `Snapshot ${new Date(loaded.updatedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} | ${matchedGoldCosts}`
      : `Loaded ${state.lastLoadedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} | ${matchedGoldCosts}`;
  } catch (error) {
    if (requestedGameId !== state.gameId) return;

    els.status.textContent = `Could not load ${game.label} poe2scout data.`;
    els.snapshotMeta.textContent = error.message;
    renderEmpty("The exchange snapshot could not be reached from this browser. Refresh again or try the other game tab.");
    renderTrendsEmpty("The exchange snapshot could not be reached from this browser.");
  } finally {
    if (requestedGameId === state.gameId) {
      els.refreshButton.disabled = false;
    }
  }
}

async function fetchGoldCosts() {
  const response = await fetch(currentGame().goldCostsUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`gold costs HTTP ${response.status}`);
  }

  const payload = await response.json();
  const costsByName = new Map();

  for (const entry of payload.costs || []) {
    const gold = Number(entry.gold);
    if (entry.name && Number.isFinite(gold)) {
      costsByName.set(normalizeName(entry.name), gold);
    }
  }

  return {
    costsByName,
    updatedAt: payload.updatedAt || null
  };
}

async function fetchPriceHistory() {
  const game = currentGame();
  if (!game.historyUrl) return [];

  const response = await fetch(game.historyUrl, { cache: "no-store" }).catch(() => null);
  if (!response?.ok) return [];

  const payload = await response.json();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const snapshots = Array.isArray(payload?.snapshots) ? payload.snapshots : [];

  return snapshots
    .filter((snapshot) => {
      const time = new Date(snapshot?.updatedAt).getTime();
      const hasPrices = snapshot?.prices && typeof snapshot.prices === "object";
      const hasPairs = snapshot?.pairs && typeof snapshot.pairs === "object";
      return Number.isFinite(time) && time >= cutoff && (hasPrices || hasPairs);
    })
    .sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
}

function normalizeSnapshotPayload(payload) {
  const pairs = payload?.pairs?.value || payload?.pairs || payload?.value || payload;
  return {
    pairs: Array.isArray(pairs) ? pairs : [],
    updatedAt: Array.isArray(payload) ? null : payload?.updatedAt || null
  };
}

async function fetchSnapshot() {
  const game = currentGame();

  if (game.localSnapshotUrl) {
    const localResponse = await fetch(game.localSnapshotUrl, { cache: "no-store" });
    if (localResponse.ok) {
      return normalizeSnapshotPayload(await localResponse.json());
    }
  }

  const liveResponse = await fetch(game.liveSnapshotUrl, {
    headers: {
      accept: "application/json"
    }
  });

  if (!liveResponse.ok) {
    throw new Error(`live API HTTP ${liveResponse.status}`);
  }

  return {
    ...normalizeSnapshotPayload(await liveResponse.json()),
    updatedAt: null
  };
}

function handleFilterChange() {
  state.currentPage = 1;
  saveFilterSettings();
  renderResults();
}

function handleControlsInput(event) {
  if (event.target === els.excludeSearch || event.target === els.includeSearch) return;
  handleFilterChange();
}

function handleExcludeKeydown(event) {
  if (event.key !== "Enter") return;

  event.preventDefault();
  addExcludedItem(els.excludeSearch.value);
}

function handleExcludeChange() {
  addExcludedItem(els.excludeSearch.value);
}

function handleIncludeKeydown(event) {
  if (event.key !== "Enter") return;

  event.preventDefault();
  addIncludedItem(els.includeSearch.value);
}

function handleIncludeChange() {
  addIncludedItem(els.includeSearch.value);
}

function handleSortClick(event) {
  const sortBy = event.currentTarget.dataset.sort;
  if (!sortBy) return;

  if (state.sortBy === sortBy) {
    state.sortDirection = state.sortDirection === "desc" ? "asc" : "desc";
  } else {
    state.sortBy = sortBy;
    state.sortDirection = "desc";
  }

  state.currentPage = 1;
  saveFilterSettings();
  renderResults();
}

function handleTrendsControlsChange(event) {
  if (event?.target === els.trendsExcludeTypeSearch) return;
  state.trendsPage = 1;
  saveTrendsSettings();
  renderPriceTrends();
}

function handleTrendsExcludeTypeKeydown(event) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  addExcludedTrendsType(els.trendsExcludeTypeSearch.value);
}

function handleTrendsExcludeTypeChange() {
  addExcludedTrendsType(els.trendsExcludeTypeSearch.value);
}

for (const button of els.tabButtons) {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
}
for (const button of els.gameButtons) {
  button.addEventListener("click", () => switchGame(button.dataset.game));
}

document.querySelector("#controls").addEventListener("input", handleControlsInput);
document.querySelector("#controls").addEventListener("change", handleControlsInput);
els.trendsControls.addEventListener("input", handleTrendsControlsChange);
els.trendsControls.addEventListener("change", handleTrendsControlsChange);
els.trendsExcludeTypeSearch.addEventListener("keydown", handleTrendsExcludeTypeKeydown);
els.trendsExcludeTypeSearch.addEventListener("change", handleTrendsExcludeTypeChange);
els.excludeSearch.addEventListener("keydown", handleExcludeKeydown);
els.excludeSearch.addEventListener("change", handleExcludeChange);
els.includeSearch.addEventListener("keydown", handleIncludeKeydown);
els.includeSearch.addEventListener("change", handleIncludeChange);
for (const button of els.sortButtons) {
  button.addEventListener("click", handleSortClick);
}
els.refreshButton.addEventListener("click", loadData);
els.resetOverridesButton.addEventListener("click", resetRateOverrides);

loadExcludedItems();
loadIncludedItems();
loadRateOverrides();
loadFilterSettings();
loadTrendsSettings();
updateGameControls();
updateResetOverridesButton();
window.CampaignModule?.initCampaign(els);
loadData();
