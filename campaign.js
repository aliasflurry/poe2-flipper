const CAMPAIGN_STORAGE_KEY = "poe2-campaign-v3";
const CAMPAIGN_DATA_URL = "data/poe2_data/campaign-checklist.json";

const campaignState = {
  data: null,
  completed: new Map(),
  collapsedActs: new Set(),
  saveTimer: null
};

function objKey(actId, areaId, objId) {
  return `${actId}.${areaId}.${objId}`;
}

function loadCampaignProgress() {
  try {
    const raw = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!parsed?.completed || typeof parsed.completed !== "object") return;

    campaignState.completed.clear();
    for (const [key, value] of Object.entries(parsed.completed)) {
      if (value) campaignState.completed.set(key, true);
    }
  } catch {
    // Progress is optional convenience state.
  }
}

function saveCampaignProgress() {
  if (campaignState.saveTimer) {
    clearTimeout(campaignState.saveTimer);
  }

  campaignState.saveTimer = setTimeout(() => {
    try {
      const completed = {};
      for (const [key, value] of campaignState.completed.entries()) {
        if (value) completed[key] = true;
      }

      localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify({
        version: campaignState.data?.version || 3,
        completed
      }));
    } catch {
      // The checklist still works for the current session if storage is unavailable.
    }
  }, 200);
}

function isObjCompleted(actId, areaId, objId) {
  return campaignState.completed.get(objKey(actId, areaId, objId)) === true;
}

function toggleObj(actId, areaId, objId, checked) {
  const key = objKey(actId, areaId, objId);
  if (checked) {
    campaignState.completed.set(key, true);
  } else {
    campaignState.completed.delete(key);
  }
  saveCampaignProgress();
}

function countAreaProgress(act, area) {
  let total = 0;
  let done = 0;
  for (const obj of area.objectives) {
    total += 1;
    if (isObjCompleted(act.id, area.id, obj.id)) done += 1;
  }
  return { done, total };
}

function countActProgress(act) {
  return act.areas.reduce(
    (acc, area) => {
      const p = countAreaProgress(act, area);
      acc.done += p.done;
      acc.total += p.total;
      return acc;
    },
    { done: 0, total: 0 }
  );
}

function countOverallProgress() {
  if (!campaignState.data?.acts) return { done: 0, total: 0 };
  return campaignState.data.acts.reduce(
    (acc, act) => {
      const p = countActProgress(act);
      acc.done += p.done;
      acc.total += p.total;
      return acc;
    },
    { done: 0, total: 0 }
  );
}

function createActProgressBar(done, total) {
  const bar = document.createElement("div");
  const fill = document.createElement("div");
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  bar.className = "campaign-act-progress";
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", String(total));
  bar.setAttribute("aria-valuenow", String(done));

  fill.className = "campaign-act-progress-fill";
  fill.style.width = `${percent}%`;
  bar.append(fill);
  return bar;
}

function rewardLabel(rewardType) {
  if (rewardType === "permanent") return "Permanent";
  if (rewardType === "points") return "Skill Points";
  if (rewardType === "ascendancy") return "Ascendancy";
  if (rewardType === "choice") return "Choice";
  if (rewardType === "unlocks") return "Unlocks";
  return "Reward";
}

function createRewardPill(reward, rewardType) {
  const pill = document.createElement("span");
  pill.className = `reward-pill reward-${rewardType || "item"}`;
  pill.textContent = reward;
  pill.setAttribute("title", rewardLabel(rewardType));
  return pill;
}

function createAreaProgressBar(done, total) {
  const wrap = document.createElement("div");
  const fill = document.createElement("div");
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  wrap.className = "campaign-area-progress";
  wrap.setAttribute("role", "progressbar");
  wrap.setAttribute("aria-valuemin", "0");
  wrap.setAttribute("aria-valuemax", String(total));
  wrap.setAttribute("aria-valuenow", String(done));

  fill.className = "campaign-area-progress-fill";
  fill.style.width = `${percent}%`;
  wrap.append(fill);
  return wrap;
}

function renderCampaignSummary(els) {
  const progress = countOverallProgress();
  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  els.campaignSummary.textContent = `${progress.done} of ${progress.total} objectives complete — ${percent}%`;

  const bar = document.getElementById("campaignOverallBar");
  if (bar) {
    bar.style.width = `${percent}%`;
    bar.parentElement.setAttribute("aria-valuenow", String(progress.done));
    bar.parentElement.setAttribute("aria-valuemax", String(progress.total));
  }
}

function renderArea(act, area, els) {
  const progress = countAreaProgress(act, area);
  const isComplete = progress.total > 0 && progress.done === progress.total;
  const isTown = area.type === "town";

  const areaEl = document.createElement("div");
  areaEl.className = `campaign-area${isComplete ? " is-complete" : ""}${isTown ? " campaign-area-town" : ""}`;
  areaEl.dataset.areaId = area.id;

  // Area header
  const header = document.createElement("div");
  header.className = "campaign-area-header";

  const headerLeft = document.createElement("div");
  headerLeft.className = "campaign-area-header-left";

  const nameEl = document.createElement("span");
  nameEl.className = "campaign-area-name";
  nameEl.textContent = area.name;
  headerLeft.append(nameEl);

  if (area.note) {
    const noteEl = document.createElement("span");
    noteEl.className = "campaign-area-note";
    noteEl.textContent = area.note;
    headerLeft.append(noteEl);
  }

  const headerRight = document.createElement("div");
  headerRight.className = "campaign-area-header-right";

  const countEl = document.createElement("span");
  countEl.className = "campaign-area-count";
  countEl.textContent = `${progress.done}/${progress.total}`;
  headerRight.append(countEl);

  header.append(headerLeft, headerRight);
  areaEl.append(header);

  // Area progress bar
  areaEl.append(createAreaProgressBar(progress.done, progress.total));

  // Separate required vs optional objectives
  const required = area.objectives.filter(o => !o.optional);
  const optional = area.objectives.filter(o => o.optional);

  function buildObjectiveList(objectives) {
    const list = document.createElement("ul");
    list.className = "campaign-objective-list";

    for (const obj of objectives) {
      const item = document.createElement("li");
      item.className = `campaign-objective${obj.optional ? " optional" : ""}`;

      const label = document.createElement("label");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = isObjCompleted(act.id, area.id, obj.id);
      if (checkbox.checked) item.classList.add("done");

      const textWrap = document.createElement("span");
      textWrap.className = "campaign-objective-content";

      const text = document.createElement("span");
      text.className = "campaign-objective-text";
      text.textContent = obj.text;
      textWrap.append(text);

      if (obj.rewards?.length) {
        const rewardRow = document.createElement("span");
        rewardRow.className = "campaign-objective-rewards";
        for (const reward of obj.rewards) {
          rewardRow.append(createRewardPill(reward.text, reward.type));
        }
        textWrap.append(rewardRow);
      }

      checkbox.addEventListener("change", () => {
        toggleObj(act.id, area.id, obj.id, checkbox.checked);
        item.classList.toggle("done", checkbox.checked);

        // Update area header count and progress bar
        const newProgress = countAreaProgress(act, area);
        countEl.textContent = `${newProgress.done}/${newProgress.total}`;
        const newPercent = newProgress.total > 0
          ? Math.round((newProgress.done / newProgress.total) * 100)
          : 0;
        const areaBar = areaEl.querySelector(".campaign-area-progress-fill");
        if (areaBar) areaBar.style.width = `${newPercent}%`;
        areaEl.classList.toggle("is-complete", newProgress.total > 0 && newProgress.done === newProgress.total);

        renderCampaignSummary(els);
        updateActHeader(act, areaEl.closest(".campaign-act"));
      });

      label.append(checkbox, textWrap);
      item.append(label);
      list.append(item);
    }

    return list;
  }

  if (required.length > 0) {
    areaEl.append(buildObjectiveList(required));
  }

  if (optional.length > 0) {
    const optHeader = document.createElement("p");
    optHeader.className = "campaign-optional-header";
    optHeader.textContent = "Optional";
    areaEl.append(optHeader, buildObjectiveList(optional));
  }

  return areaEl;
}

function updateActHeader(act, actEl) {
  if (!actEl) return;
  const progress = countActProgress(act);
  const isComplete = progress.total > 0 && progress.done === progress.total;

  actEl.classList.toggle("is-complete", isComplete);

  const countEl = actEl.querySelector(".campaign-act-count");
  if (countEl) countEl.textContent = `${progress.done} / ${progress.total}`;

  const barFill = actEl.querySelector(".campaign-act-progress-fill");
  if (barFill) {
    const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
    barFill.style.width = `${percent}%`;
  }
}

function renderCampaignActs(els) {
  els.campaignActs.replaceChildren();

  if (!campaignState.data?.acts?.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No campaign checklist data is available.";
    els.campaignActs.append(empty);
    return;
  }

  for (const act of campaignState.data.acts) {
    const progress = countActProgress(act);
    const collapsed = campaignState.collapsedActs.has(act.id);
    const isComplete = progress.total > 0 && progress.done === progress.total;

    const article = document.createElement("article");
    article.className = `campaign-act${isComplete ? " is-complete" : ""}`;
    article.dataset.actId = act.id;

    // Act header (entire row is clickable)
    const header = document.createElement("div");
    header.className = "campaign-act-header";
    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    header.setAttribute("aria-expanded", String(!collapsed));
    header.setAttribute("aria-label", act.title);

    const toggle = document.createElement("span");
    toggle.className = "campaign-act-toggle";
    toggle.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-expanded", String(!collapsed));

    const titleGroup = document.createElement("div");
    titleGroup.className = "campaign-act-title-group";

    const titleRow = document.createElement("div");
    titleRow.className = "campaign-act-title-row";

    const title = document.createElement("h2");
    title.textContent = act.title;

    const count = document.createElement("span");
    count.className = "campaign-act-count";
    count.textContent = `${progress.done} / ${progress.total}`;

    titleRow.append(title, count);
    titleGroup.append(titleRow, createActProgressBar(progress.done, progress.total));
    header.append(toggle, titleGroup);

    // Act body
    const body = document.createElement("div");
    body.className = "campaign-act-body";
    if (collapsed) body.setAttribute("hidden", "");

    for (const area of act.areas) {
      body.append(renderArea(act, area, els));
    }

    function handleToggle() {
      if (campaignState.collapsedActs.has(act.id)) {
        campaignState.collapsedActs.delete(act.id);
        body.removeAttribute("hidden");
        header.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-expanded", "true");
      } else {
        campaignState.collapsedActs.add(act.id);
        body.setAttribute("hidden", "");
        header.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-expanded", "false");
      }
      article.classList.toggle("is-collapsed", campaignState.collapsedActs.has(act.id));
    }

    header.addEventListener("click", handleToggle);
    header.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleToggle();
      }
    });

    article.append(header, body);
    els.campaignActs.append(article);
  }
}

function renderCampaign(els) {
  renderCampaignSummary(els);
  renderCampaignActs(els);
}

function resetCampaignProgress(els) {
  campaignState.completed.clear();
  saveCampaignProgress();
  renderCampaign(els);
}

function setCampaignTabVisible(visible, els) {
  const button = els.campaignTabButton;
  if (!button) return;

  button.hidden = !visible;

  if (!visible && button.classList.contains("active") && typeof window.switchTab === "function") {
    window.switchTab("exchange");
  }
}

async function initCampaign(els) {
  loadCampaignProgress();

  els.campaignResetButton?.addEventListener("click", () => {
    if (window.confirm("Reset all campaign checklist progress?")) {
      resetCampaignProgress(els);
    }
  });

  els.campaignStatus.textContent = "Loading campaign checklist...";

  try {
    const response = await fetch(CAMPAIGN_DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`campaign data HTTP ${response.status}`);
    }

    campaignState.data = await response.json();
    els.campaignStatus.textContent = "";
    els.campaignMeta.textContent = "";
    renderCampaign(els);
  } catch (error) {
    els.campaignStatus.textContent = "Could not load campaign checklist.";
    els.campaignMeta.textContent = error.message;
    els.campaignActs.replaceChildren();
  }
}

window.CampaignModule = {
  initCampaign,
  setCampaignTabVisible,
  renderCampaign
};
