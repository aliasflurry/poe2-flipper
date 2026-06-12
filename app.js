const SNAPSHOT_URL = "data/snapshot.json";
const LIVE_API_URL = "https://api.poe2scout.com/poe2/Leagues/runes/SnapshotPairs";
const EXCLUDED_STORAGE_KEY = "poe2-exchange-excluded-items";

const state = {
  rawPairs: [],
  items: new Map(),
  edgesByFrom: new Map(),
  lastLoadedAt: null,
  currentPage: 1,
  excludedItems: new Set()
};

const els = {
  refreshButton: document.querySelector("#refreshButton"),
  startCurrency: document.querySelector("#startCurrency"),
  startAmount: document.querySelector("#startAmount"),
  pathLength: document.querySelector("#pathLength"),
  minVolume: document.querySelector("#minVolume"),
  minStock: document.querySelector("#minStock"),
  pageSize: document.querySelector("#pageSize"),
  excludeSearch: document.querySelector("#excludeSearch"),
  excludeOptions: document.querySelector("#excludeOptions"),
  excludedChips: document.querySelector("#excludedChips"),
  status: document.querySelector("#status"),
  snapshotMeta: document.querySelector("#snapshotMeta"),
  results: document.querySelector("#results"),
  pagination: document.querySelector("#pagination"),
  template: document.querySelector("#resultTemplate")
};

const numberFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 4
});

const percentFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  style: "percent"
});

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

function makeEdge(pair, fromItem, toItem, fromData, toData) {
  const fromPrice = toNumber(fromData.RelativePrice);
  const toPrice = toNumber(toData.RelativePrice);
  const volume = Math.min(toNumber(fromData.VolumeTraded), toNumber(toData.VolumeTraded));
  const stock = Math.min(toNumber(fromData.HighestStock), toNumber(toData.HighestStock));

  if (fromPrice <= 0 || toPrice <= 0 || fromItem.ApiId === toItem.ApiId) {
    return null;
  }

  return {
    id: `${pair.CurrencyExchangeSnapshotPairId}:${fromItem.ApiId}>${toItem.ApiId}`,
    pairId: pair.CurrencyExchangeSnapshotPairId,
    from: fromItem.ApiId,
    to: toItem.ApiId,
    fromName: fromItem.Text,
    toName: toItem.Text,
    rate: fromPrice / toPrice,
    fromPrice,
    toPrice,
    volume,
    stock
  };
}

function buildGraph(pairs) {
  state.items.clear();
  state.edgesByFrom.clear();

  for (const pair of pairs) {
    const one = pair.CurrencyOne;
    const two = pair.CurrencyTwo;
    rememberItem(one);
    rememberItem(two);

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
  const current = els.startCurrency.value || "exalted";
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
  els.startCurrency.value = state.items.has(current) ? current : "exalted";
  els.excludeOptions.replaceChildren(...searchOptions);
  renderExcludedChips();
}

function getSettings() {
  return {
    start: els.startCurrency.value,
    amount: Math.max(toNumber(els.startAmount.value), 0),
    length: els.pathLength.value,
    minVolume: Math.max(toNumber(els.minVolume.value), 0),
    minStock: Math.max(toNumber(els.minStock.value), 0),
    pageSize: Math.min(Math.max(Math.round(toNumber(els.pageSize.value)), 1), 100),
    excludedItems: state.excludedItems
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
    .filter((cycle) => cycle.multiplier > 1)
    .sort((a, b) => b.multiplier - a.multiplier);
}

function scorePath(edges, amount) {
  const multiplier = edges.reduce((total, edge) => total * edge.rate, 1);
  const route = [edges[0].from, ...edges.map((edge) => edge.to)];

  return {
    edges,
    multiplier,
    input: amount,
    output: amount * multiplier,
    profit: amount * (multiplier - 1),
    route
  };
}

function itemLabel(id) {
  return state.items.get(id)?.name || id;
}

function itemIcon(id) {
  return state.items.get(id)?.icon || "";
}

function loadExcludedItems() {
  try {
    const stored = JSON.parse(localStorage.getItem(EXCLUDED_STORAGE_KEY) || "[]");
    state.excludedItems = new Set(Array.isArray(stored) ? stored.filter((itemId) => typeof itemId === "string") : []);
  } catch {
    state.excludedItems = new Set();
  }
}

function saveExcludedItems() {
  try {
    localStorage.setItem(EXCLUDED_STORAGE_KEY, JSON.stringify([...state.excludedItems]));
  } catch {
    // The filter still works for the current session if storage is unavailable.
  }
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

function renderResults() {
  const settings = getSettings();
  const cycles = findCycles(settings);
  const totalPages = Math.max(Math.ceil(cycles.length / settings.pageSize), 1);

  state.currentPage = Math.min(Math.max(state.currentPage, 1), totalPages);
  const startIndex = (state.currentPage - 1) * settings.pageSize;
  const visibleCycles = cycles.slice(startIndex, startIndex + settings.pageSize);

  els.results.replaceChildren();
  els.pagination.replaceChildren();

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
    const steps = node.querySelector(".steps");

    rank.textContent = `#${startIndex + index + 1}`;
    title.textContent = `${numberFormat.format(cycle.input)} ${itemLabel(settings.start)} -> ${numberFormat.format(cycle.output)} ${itemLabel(settings.start)}`;
    path.textContent = cycle.route.map(itemLabel).join(" > ");
    gain.textContent = `+${percentFormat.format(cycle.multiplier - 1)}`;
    card.style.setProperty("--accent", cycle.multiplier > 1.1 ? "#d7a84f" : "#5bbf98");

    cycle.edges.forEach((edge, stepIndex) => {
      const li = document.createElement("li");
      li.append(makeStepItems(edge), makeStepMeta(edge, stepIndex));
      steps.append(li);
    });

    els.results.append(node);
  });

  renderPagination(cycles.length, totalPages, settings.pageSize);
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
  const fromName = document.createElement("span");
  const arrow = document.createElement("span");
  const toIcon = document.createElement("img");
  const toName = document.createElement("span");

  wrap.className = "step-items";
  fromIcon.src = itemIcon(edge.from);
  fromIcon.alt = "";
  fromName.textContent = edge.fromName;
  arrow.className = "arrow";
  arrow.textContent = "->";
  toIcon.src = itemIcon(edge.to);
  toIcon.alt = "";
  toName.textContent = edge.toName;

  wrap.append(fromIcon, fromName, arrow, toIcon, toName);
  return wrap;
}

function makeStepMeta(edge, stepIndex) {
  const wrap = document.createElement("div");
  const values = [
    `Trade ${stepIndex + 1}`,
    `${numberFormat.format(edge.rate)}x`,
    `vol ${numberFormat.format(edge.volume)}`,
    `stock ${numberFormat.format(edge.stock)}`
  ];

  wrap.className = "step-meta";
  for (const value of values) {
    const span = document.createElement("span");
    span.textContent = value;
    wrap.append(span);
  }

  return wrap;
}

async function loadData() {
  els.refreshButton.disabled = true;
  els.status.textContent = "Loading exchange data...";
  els.snapshotMeta.textContent = "";

  try {
    const loaded = await fetchSnapshot();
    state.rawPairs = loaded.pairs;
    state.lastLoadedAt = new Date();
    buildGraph(state.rawPairs);
    populateCurrencies();
    renderResults();

    els.status.textContent = `${state.rawPairs.length.toLocaleString()} exchange pairs loaded`;
    els.snapshotMeta.textContent = loaded.updatedAt
      ? `Snapshot ${new Date(loaded.updatedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`
      : `Loaded ${state.lastLoadedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch (error) {
    els.status.textContent = "Could not load poe2scout data.";
    els.snapshotMeta.textContent = error.message;
    renderEmpty("The local snapshot is missing and the live API could not be reached from this browser. Run the GitHub Action or add data/snapshot.json, then refresh.");
  } finally {
    els.refreshButton.disabled = false;
  }
}

async function fetchSnapshot() {
  const localResponse = await fetch(SNAPSHOT_URL, { cache: "no-store" });
  if (localResponse.ok) {
    const snapshot = await localResponse.json();
    const pairs = snapshot.pairs?.value || snapshot.pairs || [];
    return Array.isArray(snapshot)
      ? { pairs: snapshot, updatedAt: null }
      : { pairs, updatedAt: snapshot.updatedAt };
  }

  const liveResponse = await fetch(LIVE_API_URL, {
    headers: {
      accept: "application/json"
    }
  });

  if (!liveResponse.ok) {
    throw new Error(`snapshot HTTP ${localResponse.status}; live API HTTP ${liveResponse.status}`);
  }

  return {
    pairs: await liveResponse.json(),
    updatedAt: null
  };
}

function handleFilterChange() {
  state.currentPage = 1;
  renderResults();
}

function handleControlsInput(event) {
  if (event.target === els.excludeSearch) return;
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

document.querySelector("#controls").addEventListener("input", handleControlsInput);
document.querySelector("#controls").addEventListener("change", handleControlsInput);
els.excludeSearch.addEventListener("keydown", handleExcludeKeydown);
els.excludeSearch.addEventListener("change", handleExcludeChange);
els.refreshButton.addEventListener("click", loadData);

loadExcludedItems();
loadData();
