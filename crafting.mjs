import { actions, affixTableStats, buildPool, buildReferencePools, confidenceInterval, craftItem, meetsGoal } from "./crafting-engine.mjs";

const calculatorActions = Object.keys(actions).filter((action) => actions[action].effect === "reroll");
const conditions = { always: "craftingAlways", hit: "craftingIfHit", miss: "craftingIfMiss" };
const rarityKeys = { normal: "craftingNormal", magic: "craftingMagic", rare: "craftingRare" };
const poolOrigins = ["normal", "crafted", "shaper", "elder", "crusader", "eyrie", "basilisk", "adjudicator", "essence"];
const maxSteps = 12;
const maxTargets = 12;
const itemGroups = {
  bodyArmour: ["Body Armour"], boots: ["Boots"], charts: [], clusterJewel: [], flask: [], gloves: ["Gloves"],
  heist: [], helmet: ["Helmet"], invitation: [], jewel: [], jewellery: ["Amulet", "Belt", "Ring"],
  mapping: [], miscellaneous: [], offhand: ["Quiver", "Shield"],
  oneHanded: ["Claw", "Dagger", "One Hand Axe", "One Hand Mace", "One Hand Sword", "Rune Dagger", "Sceptre", "Thrusting One Hand Sword", "Wand"],
  relic: [], strongboxes: [], twoHanded: ["Bow", "Staff", "Two Hand Axe", "Two Hand Mace", "Two Hand Sword", "Warstaff"]
};

function baseClass(base) {
  const { name, tags } = base;
  if (name === "Grasping Mail" || name === "Ghostflame Blade") return name;
  if (tags.includes("ring_can_roll_minion_modifiers")) return "Summoner Ring";
  if (tags.includes("unset_ring")) return "Unset Ring";
  if (tags.includes("focus_can_roll_minion_modifiers")) return "Shield (SUMMONER)";
  if (base.class === "Wand" && tags.includes("weapon_can_roll_minion_modifiers")) return "Summoner Wand";
  const armour = tags.find((tag) => /^(?:(?:str|dex|int|ward)_)+armour$/.test(tag));
  return armour ? `${base.class} (${armour.slice(0, -7).replaceAll("_", "/").toUpperCase()})` : base.class;
}

function tagLabel(tag) {
  return tag.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function option(value, text) {
  const node = element("option", text);
  node.value = value;
  return node;
}

function button(text, label = text) {
  const node = element("button", text, "text-button");
  node.type = "button";
  node.setAttribute("aria-label", label);
  return node;
}

function field(text, input) {
  const node = element("label");
  input.setAttribute("aria-label", text);
  node.append(element("span", text), input);
  return node;
}

function targetLabel(target, t) {
  const text = target.text.replaceAll("\n", " / ");
  if (target.scope === "exact") return `${target.name} · ${text}`;
  if (target.scope === "minimum") return `${text} · ${t("craftingMinimum")}`;
  return `${familyText(text)} · ${t("craftingFamily")}`;
}

function familyText(text) {
  return text.replaceAll("\n", " / ").replace(/\(-?\d+(?:\.\d+)?\s*[-–]\s*-?\d+(?:\.\d+)?\)|-?\d+(?:\.\d+)?/g, "#");
}

export function createCrafting(view, i18n) {
  const { t } = i18n;
  const names = ["Status", "Retry", "Form", "Group", "Class", "Base", "Level", "Bench", "Tools", "BrowseOnly", "Search", "ModifierType", "ModifierTag", "Pool", "PoolCount", "TierPicker", "Tier", "PoolHelp",
    "Targets", "Match", "OpenPrefixes", "OpenSuffixes", "Currency", "CalculatePreview", "Calculator", "Simulator", "Rarity", "Steps", "AddStep", "Trials", "Run",
    "Cancel", "Results", "DataSource", "Preview", "PreviewCurrency", "PreviewHint", "Undo", "Reset", "PreviewStatus", "Transfer", "RestorePlan"];
  const ui = Object.fromEntries(names.map((name) => [name, view.querySelector(`#crafting${name}`)]));
  const modeButtons = [...view.querySelectorAll("[data-crafting-mode]")];
  let nextStepId = 1;
  const makeStep = (action, count = 1, when = "always") => ({ id: `step-${nextStepId++}`, action, count, when });
  const steps = [makeStep("transmute"), makeStep("regal")];
  let previousPlan;
  let targets = [];
  let data;
  let indexedBases;
  let loading = false;
  let loadStatus = "";
  let mode = "calculator";
  let pool = [];
  let allTiers = [];
  let referencePools = new Map();
  let modsById = new Map();
  let preview = { rarity: "normal", mods: [] };
  let previewBase;
  let previewHistory = [];
  let previewStatus = "";
  let worker;
  let result;
  let resultStatus = "craftingIdle";

  function openAffixes() {
    return { prefix: Number(ui.OpenPrefixes.value), suffix: Number(ui.OpenSuffixes.value) };
  }

  function hasGoal() {
    const { prefix, suffix } = openAffixes();
    return Boolean(targets.length || prefix || suffix);
  }

  function updateLoadStatus() {
    ui.Status.textContent = loadStatus ? t(loadStatus) : "";
    ui.Status.hidden = !loadStatus;
    ui.Retry.hidden = loadStatus !== "craftingLoadError";
  }

  async function open() {
    if (data || loading) return;
    loading = true;
    loadStatus = "craftingLoading";
    updateLoadStatus();
    try {
      const response = await fetch(new URL("data/poe_data/crafting.json", import.meta.url));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const catalog = await response.json();
      if (!catalog.bases?.length || !catalog.mods?.length) throw new Error("Missing crafting data");
      data = catalog;
      indexedBases = data.bases.map((base, index) => ({ index, base, itemClass: base.pickerClass ?? baseClass(base),
        group: base.group ?? Object.keys(itemGroups).find((id) => itemGroups[id].includes(base.class)) }));
      ui.Currency.replaceChildren(...calculatorActions.map((action) => option(action, actions[action].name)));
      ui.Currency.value = "alteration";
      ui.PreviewCurrency.replaceChildren(option("", ""), ...Object.entries(actions).map(([id, action]) => option(id, action.name)));
      updateLanguage();
      ui.Form.hidden = false;
      loadStatus = "";
    } catch {
      data = undefined;
      loadStatus = "craftingLoadError";
    } finally {
      loading = false;
      updateLoadStatus();
    }
  }

  function renderItemChoices(group = ui.Group.value, itemClass = ui.Class.value, base = ui.Base.value) {
    const groups = Object.keys(itemGroups).filter((id) => indexedBases.some((item) => item.group === id));
    const labels = groups.map((id) => option(id, t(`craftingGroup_${id}`)));
    ui.Group.replaceChildren(option("", t("craftingSelectGroup")), ...labels);
    ui.Group.value = groups.includes(group) ? group : "";

    const inGroup = indexedBases.filter((item) => item.group === ui.Group.value);
    const classes = [...new Set(inGroup.map((item) => item.itemClass))].sort();
    ui.Class.replaceChildren(option("", t(ui.Group.value ? "craftingSelectClass" : "craftingSelectGroupFirst")),
      ...classes.map((name) => option(name, name)));
    ui.Class.disabled = !classes.length;
    ui.Class.value = classes.includes(itemClass) ? itemClass : "";

    const inClass = inGroup.filter((item) => item.itemClass === ui.Class.value);
    ui.Base.replaceChildren(option("", t(ui.Class.value ? "craftingSelectBase" : "craftingSelectClassFirst")),
      ...inClass.map((item) => option(item.index, item.base.name)));
    ui.Base.disabled = !inClass.length;
    ui.Base.value = inClass.some((item) => String(item.index) === base) ? base : "";
  }

  function updatePool() {
    ui.Bench.hidden = !ui.Base.value || !ui.Level.validity.valid;
    if (!ui.Base.value) {
      targets = [];
      previewBase = undefined;
      resetResult();
      return;
    }
    if (!ui.Level.validity.valid) {
      resetResult();
      return;
    }
    const base = data.bases[Number(ui.Base.value)];
    const browseOnly = Boolean(base.browseOnly);
    ui.Tools.hidden = browseOnly;
    ui.BrowseOnly.hidden = !browseOnly;
    ui.TierPicker.hidden = browseOnly;
    ui.PoolHelp.hidden = browseOnly;
    pool = buildPool(data.mods, base, ui.Level.valueAsNumber);
    if (base !== previewBase) {
      allTiers = buildPool(data.mods, base, Infinity);
      referencePools = buildReferencePools(data, base);
    }
    modsById = new Map(pool.map((mod) => [mod.id, mod]));
    targets = (browseOnly ? [] : targets).flatMap((target) => {
      const family = pool.filter((mod) => mod.family === target.family && mod.side === target.side);
      if (target.scope === "family") return family.length ? [{ ...family[0], scope: target.scope }] : [];
      if (target.scope === "minimum") return family.some((mod) => mod.level >= target.level) ? [target] : [];
      return modsById.has(target.id) ? [target] : [];
    });
    if (base !== previewBase || preview.mods.some((mod) => !modsById.has(mod.id))) {
      preview = { rarity: "normal", mods: [] };
      ui.PreviewCurrency.value = "";
    }
    previewBase = base;
    previewHistory = [];
    previewStatus = "";
    renderTagChoices();
    renderPool();
    renderTargets();
    if (ui.CalculatePreview.checked) updateCalculatorActions();
    resetResult();
  }

  function renderTagChoices() {
    const previous = ui.ModifierTag.value;
    const mods = [...pool, ...[...referencePools.values()].flat().filter((mod) => mod.level <= ui.Level.valueAsNumber)];
    const tags = [...new Set(mods.flatMap((mod) => mod.tags ?? []))].sort();
    ui.ModifierTag.replaceChildren(option("", t("craftingAllTags")), ...tags.map((tag) => option(tag, tagLabel(tag))));
    if (tags.includes(previous)) ui.ModifierTag.value = previous;
  }

  function renderPool() {
    const query = ui.Search.value.trim().toLowerCase();
    const type = ui.ModifierType.value;
    const tag = ui.ModifierTag.value;
    const matches = (mod) => (!type || mod.side === type) && (!tag || mod.tags?.includes(tag)) &&
      `${mod.name} ${mod.text}`.toLowerCase().includes(query);
    const weights = new Intl.NumberFormat(i18n.formatLocale, { maximumFractionDigits: 2 });
    const percentages = new Intl.NumberFormat(i18n.formatLocale, { style: "percent", maximumFractionDigits: 4 });
    let count = 0;
    const sections = [];
    for (const origin of poolOrigins) {
      const normal = origin === "normal";
      const tiers = normal ? allTiers : referencePools.get(origin) ?? [];
      const eligible = normal ? pool : tiers.filter((mod) => mod.level <= ui.Level.valueAsNumber);
      const visible = eligible.filter(matches);
      if (!visible.length) continue;
      count += visible.length;
      const title = t(`craftingOrigin_${origin}`);
      const section = element("section", "", "crafting-pool-origin");
      const heading = element("h4", title);
      heading.id = `craftingOrigin-${origin}`;
      section.setAttribute("aria-labelledby", heading.id);
      const columns = element("div", "", "crafting-pool-columns");
      const tableStats = affixTableStats(eligible, tiers);
      const showWeight = origin !== "crafted" && origin !== "essence";
      for (const side of type ? [type] : ["prefix", "suffix"]) {
        const mods = visible.filter((mod) => mod.side === side);
        columns.append(renderPoolColumn(mods, side, { title, normal, showWeight, tableStats, weights, percentages }));
      }
      section.append(heading, columns);
      sections.push(section);
    }
    ui.Pool.replaceChildren(...(sections.length ? sections : [element("p", t("craftingNoModifiers"), "crafting-muted")]));
    ui.PoolCount.textContent = t("craftingMatchCount", { count: new Intl.NumberFormat(i18n.formatLocale).format(count) });
    updatePoolSelection();
  }

  function renderPoolColumn(visible, side, { title: origin, normal, showWeight, tableStats, weights, percentages }) {
    const column = element("div", "", "crafting-pool-column");
    const title = t(side === "prefix" ? "craftingPrefixes" : "craftingSuffixes");
    const frame = element("div", "", "crafting-table-frame");
    frame.tabIndex = 0;
    frame.setAttribute("role", "region");
    frame.setAttribute("aria-label", `${origin} · ${title}`);
    const table = element("table", "", "crafting-mod-table");
    table.append(element("caption", title));
    const headings = table.createTHead().insertRow();
    const headingKeys = ["craftingModifier", "craftingTableTier", "craftingLevel"];
    if (showWeight) headingKeys.push("craftingWeight");
    if (normal) headingKeys.push("craftingSideChance", "craftingPoolChance");
    for (const key of headingKeys) {
      const heading = element("th", t(key));
      heading.scope = "col";
      headings.append(heading);
    }
    const families = new Map();
    for (const mod of visible) {
      if (!families.has(mod.family)) families.set(mod.family, []);
      families.get(mod.family).push(mod);
    }
    const groups = [...families.values()].sort((a, b) => familyText(a[0].text).localeCompare(familyText(b[0].text)));
    const selectable = normal && !previewBase.browseOnly;
    for (const mods of groups) {
      mods.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
      const body = table.createTBody();
      const family = element("th", familyText(mods[0].text));
      family.scope = "rowgroup";
      family.colSpan = headings.cells.length;
      body.insertRow().append(family);
      for (const mod of mods) {
        const row = body.insertRow();
        const { tier: rank, sideChance, poolChance } = tableStats.get(mod.id);
        const text = mod.text.replaceAll("\n", " / ");
        const tier = selectable ? button(text, `${mod.name} · ${text}`) : element("span", text, "crafting-tier");
        if (selectable) {
          tier.classList.add("crafting-tier");
          tier.dataset.mod = mod.id;
          tier.addEventListener("click", () => toggleTarget(mod));
        }
        tier.append(element("small", mod.name));
        row.insertCell().append(tier);
        const values = [`T${rank}`, weights.format(mod.level)];
        if (showWeight) values.push(mod.weight ? weights.format(mod.weight) : t("craftingConditionalWeight"));
        if (normal) values.push(mod.weight ? percentages.format(sideChance) : "—", mod.weight ? percentages.format(poolChance) : "—");
        for (const value of values) {
          row.insertCell().textContent = value;
        }
      }
    }
    if (!groups.length) {
      const empty = table.createTBody().insertRow().insertCell();
      empty.colSpan = headings.cells.length;
      empty.textContent = t("craftingNoModifiers");
    }
    frame.append(table);
    column.append(frame);
    return column;
  }

  function selectedTargetIndex(mod) {
    return targets.findIndex((target) => target.scope === ui.Tier.value && (target.scope === "family"
      ? target.family === mod.family && target.side === mod.side : target.id === mod.id));
  }

  function toggleTarget(mod) {
    const index = selectedTargetIndex(mod);
    if (index >= 0) targets.splice(index, 1);
    else if (targets.length < maxTargets) targets.push({ ...mod, scope: ui.Tier.value });
    renderTargets();
    resetResult();
  }

  function updatePoolSelection() {
    for (const node of ui.Pool.querySelectorAll("[data-mod]")) {
      const selected = selectedTargetIndex(modsById.get(node.dataset.mod)) >= 0;
      node.setAttribute("aria-pressed", String(selected));
      node.disabled = !selected && targets.length >= maxTargets;
    }
    ui.Transfer.disabled = !hasGoal();
  }

  function renderTargets() {
    ui.Targets.replaceChildren(...targets.map((target, index) => {
      const label = targetLabel(target, t);
      const row = element("li");
      const remove = button("×", t("craftingRemoveItem", { item: label }));
      remove.addEventListener("click", () => {
        targets.splice(index, 1);
        renderTargets();
        (ui.Targets.children[index]?.querySelector("button") ?? ui.Search).focus();
        resetResult();
      });
      row.append(element("span", label), remove);
      return row;
    }));
    updatePoolSelection();
    renderPreview();
  }

  function renderPreview() {
    const heading = element("strong", previewBase.name);
    const summary = element("span", `${t(rarityKeys[preview.rarity])} · ${t("craftingLevel")} ${ui.Level.value}`);
    const content = [heading, summary];
    if (preview.mods.length) {
      const list = element("span", "", "crafting-preview-affixes");
      for (const mod of preview.mods) {
        const side = t(mod.side === "prefix" ? "craftingPrefix" : "craftingSuffix");
        list.append(element("span", `${side} · ${mod.text.replaceAll("\n", " / ")}`));
      }
      content.push(list);
    } else content.push(element("span", t("craftingNoAffixes"), "crafting-muted"));
    if (hasGoal()) {
      const hit = meetsGoal(preview, targets, ui.Match.value, openAffixes());
      content.push(element("span", t(hit ? "craftingIfHit" : "craftingIfMiss"), hit ? "crafting-goal-hit" : "crafting-muted"));
    }
    ui.Preview.replaceChildren(...content);
    ui.Preview.dataset.rarity = preview.rarity;
    for (const node of ui.PreviewCurrency.options) {
      if (node.value) node.disabled = !actions[node.value].from.includes(preview.rarity);
    }
    if (ui.PreviewCurrency.selectedOptions[0]?.disabled) ui.PreviewCurrency.value = "";
    const action = actions[ui.PreviewCurrency.value];
    ui.Preview.setAttribute("aria-disabled", String(!action));
    ui.PreviewHint.textContent = action ? t("craftingClickItem", { currency: action.name }) : t("craftingSelectCurrencyFirst");
    ui.Undo.disabled = !previewHistory.length;
    ui.Reset.disabled = preview.rarity === "normal" && !preview.mods.length;
    ui.PreviewStatus.hidden = !previewStatus;
    ui.PreviewStatus.textContent = previewStatus ? t(previewStatus) : "";
  }

  function focusPreview() {
    (ui.PreviewCurrency.value ? ui.Preview : ui.PreviewCurrency).focus();
  }

  function usesPreview() {
    return mode === "calculator" ? ui.CalculatePreview.checked : ui.Rarity.value === "preview";
  }

  function updateCalculatorActions() {
    const current = ui.Currency.value;
    const methods = ui.CalculatePreview.checked
      ? Object.keys(actions).filter((action) => actions[action].from.includes(preview.rarity)) : calculatorActions;
    ui.Currency.replaceChildren(...methods.map((action) => option(action, actions[action].name)));
    if (methods.includes(current)) ui.Currency.value = current;
  }

  function previewChanged() {
    renderPreview();
    if (ui.CalculatePreview.checked) updateCalculatorActions();
    if (usesPreview()) resetResult();
  }

  function setPreview(item) {
    if (previewHistory.length >= 50) previewHistory.shift();
    previewHistory.push(preview);
    preview = item;
    previewStatus = "";
    previewChanged();
  }

  function renderRoutes(step) {
    const routes = element("details", "", "crafting-routes");
    routes.open = Boolean(step.onHit || step.onMiss);
    routes.append(element("summary", t("craftingRoutes")));
    const fields = element("div", "", "crafting-route-fields");
    for (const [key, label] of [["onHit", "craftingOnHit"], ["onMiss", "craftingOnMiss"]]) {
      const select = element("select");
      select.replaceChildren(option("", t("craftingNextStep")), option("finish", t("craftingFinishTrial")),
        ...steps.map((destination, index) => option(destination.id, t("craftingStep", { number: index + 1 }))));
      select.value = step[key] ?? "";
      select.addEventListener("change", () => { step[key] = select.value; resetResult(); });
      fields.append(field(t(label), select));
    }
    routes.append(fields);
    return routes;
  }

  function renderSteps() {
    ui.AddStep.disabled = steps.length >= maxSteps;
    ui.Steps.replaceChildren(...steps.map((step, index) => {
      const number = index + 1;
      const row = element("li", "", "crafting-step");
      const header = element("div", "", "crafting-step-header");
      const controls = element("div", "", "crafting-step-buttons");
      const up = button("↑", t("craftingUp", { number }));
      const down = button("↓", t("craftingDown", { number }));
      const remove = button("×", t("craftingRemoveItem", { item: t("craftingStep", { number }) }));
      up.disabled = index === 0;
      down.disabled = index === steps.length - 1;
      function move(offset) {
        const next = index + offset;
        [steps[next], steps[index]] = [steps[index], steps[next]];
        renderSteps();
        ui.Steps.children[next].querySelector("select").focus();
        resetResult();
      }
      up.addEventListener("click", () => move(-1));
      down.addEventListener("click", () => move(1));
      remove.addEventListener("click", () => {
        steps.splice(index, 1);
        for (const remaining of steps) {
          if (remaining.onHit === step.id) remaining.onHit = "";
          if (remaining.onMiss === step.id) remaining.onMiss = "";
        }
        renderSteps();
        (ui.Steps.children[index]?.querySelector("select") ?? ui.AddStep).focus();
        resetResult();
      });
      controls.append(up, down, remove);
      header.append(element("strong", t("craftingStep", { number })), controls);

      const fields = element("div", "", "crafting-step-fields");
      const action = element("select");
      action.replaceChildren(...Object.entries(actions).map(([id, method]) => option(id, method.name)));
      action.value = step.action;
      action.addEventListener("change", () => { step.action = action.value; resetResult(); });
      const repeat = element("input");
      Object.assign(repeat, { type: "number", min: 1, max: 100, required: true, value: step.count });
      repeat.addEventListener("input", () => { step.count = repeat.value; resetResult(); });
      const condition = element("select");
      condition.replaceChildren(...Object.entries(conditions).map(([value, key]) => option(value, t(key))));
      condition.value = step.when;
      condition.addEventListener("change", () => { step.when = condition.value; resetResult(); });
      fields.append(field(t("craftingCurrency"), action), field(t("craftingRepeat"), repeat), field(t("craftingCondition"), condition));
      row.append(header, fields, renderRoutes(step));
      return row;
    }));
  }

  function renderResult() {
    ui.Results.replaceChildren();
    if (!result) {
      ui.Results.append(element("p", t(resultStatus), "crafting-muted"));
      return;
    }
    const { successful, trials, hits, usage, skipped, unfinished, sample } = result;
    const counts = new Intl.NumberFormat(i18n.formatLocale, { maximumFractionDigits: 3 });
    const percentages = new Intl.NumberFormat(i18n.formatLocale, { style: "percent", maximumFractionDigits: 3 });
    const percent = (rate) => percentages.format(rate);
    const count = (value) => counts.format(value);
    if (hasGoal()) {
      const [low, high] = confidenceInterval(successful, trials);
      ui.Results.append(
        element("p", percent(successful / trials), "crafting-odds"),
        element("p", t("craftingHitCount", { hits: count(successful), trials: count(trials) })),
        element("p", t("craftingRange", { low: percent(low), high: percent(high) }), "crafting-muted")
      );
      const list = element("ul");
      targets.forEach((target, index) => list.append(element("li", `${targetLabel(target, t)} · ${percent(hits[index] / trials)}`)));
      if (targets.length) ui.Results.append(element("h4", t("craftingPerTarget")), list);
    } else {
      ui.Results.append(element("p", t("craftingTrialCount", { trials: count(trials) })));
    }
    if (mode === "simulator") {
      const used = element("ul");
      for (const [action, amount] of Object.entries(usage)) {
        used.append(element("li", `${actions[action].name} · ${count(amount / trials)}`));
      }
      if (used.childElementCount) ui.Results.append(element("h4", t("craftingUsage")), used);
      if (skipped) ui.Results.append(element("p", t("craftingSkipped", { count: count(skipped) }), "crafting-muted"));
      if (unfinished) ui.Results.append(element("p", t("craftingUnfinished", { count: count(unfinished) }), "crafting-muted"));
      if (!sample) return;
      ui.Results.append(element("h4", t("craftingExample")), element("p", t(rarityKeys[sample.rarity])));
      const affixes = element("ul");
      for (const id of sample.mods) {
        const mod = modsById.get(id);
        const side = t(mod.side === "prefix" ? "craftingPrefix" : "craftingSuffix");
        affixes.append(element("li", `${side} · ${mod.text.replaceAll("\n", " / ")}`));
      }
      ui.Results.append(sample.mods.length ? affixes : element("p", t("craftingNoAffixes"), "crafting-muted"));
      const useSample = button(t("craftingUseSample"));
      useSample.addEventListener("click", () => {
        setPreview({ rarity: sample.rarity, mods: sample.mods.map((id) => modsById.get(id)) });
        focusPreview();
      });
      ui.Results.append(useSample);
    }
  }

  function resetResult(status = "craftingIdle") {
    worker?.terminate();
    worker = undefined;
    result = undefined;
    resultStatus = status;
    ui.Run.disabled = false;
    ui.Cancel.hidden = true;
    renderResult();
  }

  function run(event) {
    event.preventDefault();
    if (!previewBase || previewBase.browseOnly) return;
    const action = ui.Currency.value;
    const calculator = mode === "calculator";
    if (!hasGoal() && (calculator || steps.some((step) => step.when !== "always" || step.onHit || step.onMiss))) {
      resetResult("craftingNeedTarget");
      return;
    }
    if (!calculator && !steps.length) {
      resetResult("craftingNeedStep");
      return;
    }
    const startingItem = usesPreview() ? preview : undefined;
    if (calculator && startingItem && !craftItem(previewBase, pool, startingItem, action, () => 0)) {
      resetResult("craftingCannotApply");
      return;
    }
    resetResult("craftingRunning");
    try {
      const activeWorker = new Worker(new URL("./crafting-engine.mjs", import.meta.url), { type: "module" });
      worker = activeWorker;
      ui.Run.disabled = true;
      ui.Cancel.hidden = false;
      activeWorker.onmessage = ({ data: outcome }) => {
        if (worker !== activeWorker) return;
        if (outcome.error) {
          resetResult("craftingRunError");
          return;
        }
        worker.terminate();
        worker = undefined;
        result = outcome;
        ui.Run.disabled = false;
        ui.Cancel.hidden = true;
        renderResult();
      };
      activeWorker.onerror = () => {
        if (worker === activeWorker) resetResult("craftingRunError");
      };
      activeWorker.postMessage({
        base: data.bases[Number(ui.Base.value)], pool, targets, match: ui.Match.value, openAffixes: openAffixes(), trials: Number(ui.Trials.value),
        rarity: calculator ? actions[action].from[0] : ui.Rarity.value,
        startingItem,
        steps: calculator ? [{ action, count: 1, when: "always" }] : steps.map((step) => ({ ...step, count: Number(step.count) }))
      });
    } catch {
      resetResult("craftingRunError");
    }
  }

  function updateMode() {
    ui.Calculator.hidden = mode !== "calculator";
    ui.Simulator.hidden = mode !== "simulator";
    for (const input of ui.Steps.querySelectorAll("input")) input.disabled = ui.Simulator.hidden;
    for (const node of modeButtons) {
      const selected = node.dataset.craftingMode === mode;
      node.classList.toggle("active", selected);
      node.setAttribute("aria-pressed", String(selected));
    }
    // Changing the markup key keeps the form button correct after a language switch.
    ui.Run.dataset.i18n = mode === "calculator" ? "craftingCalculate" : "craftingRunSimulation";
    ui.Run.textContent = t(ui.Run.dataset.i18n);
  }

  function updateLanguage() {
    updateLoadStatus();
    if (!data) return;
    renderItemChoices();
    ui.PreviewCurrency.options[0].textContent = t("craftingSelectCurrency");
    ui.DataSource.textContent = t("craftingDataSource", { revision: data.revision });
    if (previewBase && !ui.Bench.hidden) {
      renderTagChoices();
      renderPool();
      renderTargets();
    }
    renderSteps();
    updateMode();
    renderResult();
  }

  ui.Retry.addEventListener("click", open);
  ui.Form.addEventListener("submit", run);
  ui.Group.addEventListener("change", () => {
    renderItemChoices(ui.Group.value, "", "");
    updatePool();
  });
  ui.Class.addEventListener("change", () => {
    renderItemChoices(ui.Group.value, ui.Class.value, "");
    updatePool();
  });
  ui.Base.addEventListener("change", updatePool);
  ui.Level.addEventListener("input", updatePool);
  ui.Search.addEventListener("input", renderPool);
  ui.ModifierType.addEventListener("change", renderPool);
  ui.ModifierTag.addEventListener("change", renderPool);
  ui.Search.addEventListener("keydown", (event) => { if (event.key === "Enter") event.preventDefault(); });
  ui.Tier.addEventListener("change", updatePoolSelection);
  ui.PreviewCurrency.addEventListener("change", () => {
    previewStatus = "";
    renderPreview();
  });
  ui.Preview.addEventListener("click", () => {
    if (!ui.PreviewCurrency.value || !ui.Level.reportValidity()) return;
    const item = craftItem(previewBase, pool, preview, ui.PreviewCurrency.value);
    if (item) setPreview(item);
    else {
      previewStatus = "craftingCannotApply";
      renderPreview();
    }
  });
  ui.Undo.addEventListener("click", () => {
    preview = previewHistory.pop();
    previewStatus = "";
    previewChanged();
    if (ui.Undo.disabled) focusPreview();
  });
  ui.Reset.addEventListener("click", () => {
    setPreview({ rarity: "normal", mods: [] });
    focusPreview();
  });
  for (const control of [ui.Match, ui.OpenPrefixes, ui.OpenSuffixes]) {
    control.addEventListener("change", () => {
      renderPreview();
      ui.Transfer.disabled = !hasGoal();
      resetResult();
    });
  }
  ui.CalculatePreview.addEventListener("change", () => {
    updateCalculatorActions();
    resetResult();
  });
  for (const control of [ui.Currency, ui.Rarity, ui.Trials]) {
    control.addEventListener("change", () => resetResult());
  }
  for (const node of modeButtons) {
    node.addEventListener("click", () => {
      if (mode === node.dataset.craftingMode) return;
      mode = node.dataset.craftingMode;
      updateMode();
      resetResult();
    });
  }
  ui.Transfer.addEventListener("click", () => {
    const action = ui.Currency.value;
    const startingRarity = ui.CalculatePreview.checked ? "preview" : actions[action].from[0];
    const itemRarity = startingRarity === "preview" ? preview.rarity : startingRarity;
    const plan = [makeStep(action)];
    if (itemRarity === actions[action].to && actions[action].effect === "reroll") plan.push(makeStep(action, 19, "miss"));
    previousPlan = { steps: [...steps], rarity: ui.Rarity.value };
    steps.splice(0, steps.length, ...plan);
    ui.RestorePlan.hidden = false;
    ui.Rarity.value = startingRarity;
    mode = "simulator";
    renderSteps();
    updateMode();
    resetResult();
    ui.Run.focus();
  });
  ui.RestorePlan.addEventListener("click", () => {
    steps.splice(0, steps.length, ...previousPlan.steps);
    ui.Rarity.value = previousPlan.rarity;
    previousPlan = undefined;
    ui.RestorePlan.hidden = true;
    renderSteps();
    resetResult();
    ui.Run.focus();
  });
  ui.AddStep.addEventListener("click", () => {
    steps.push(makeStep("chaos"));
    renderSteps();
    ui.Steps.lastElementChild.querySelector("select").focus();
    resetResult();
  });
  ui.Cancel.addEventListener("click", () => {
    resetResult("craftingCancelled");
    ui.Run.focus();
  });

  return { open, updateLanguage };
}
