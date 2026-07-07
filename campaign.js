const CAMPAIGN_STORAGE_KEY = "poe2-campaign-checklist";
const CAMPAIGN_DATA_URL = "data/poe2_data/campaign-checklist.json";

const campaignState = {
  data: null,
  completed: new Map(),
  collapsedActs: new Set(),
  saveTimer: null
};

function stepKey(actId, questId, stepId) {
  return `${actId}.${questId}.${stepId}`;
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
        version: campaignState.data?.version || 1,
        completed
      }));
    } catch {
      // The checklist still works for the current session if storage is unavailable.
    }
  }, 200);
}

function isStepCompleted(actId, questId, stepId) {
  return campaignState.completed.get(stepKey(actId, questId, stepId)) === true;
}

function toggleStep(actId, questId, stepId, checked) {
  const key = stepKey(actId, questId, stepId);
  if (checked) {
    campaignState.completed.set(key, true);
  } else {
    campaignState.completed.delete(key);
  }
  saveCampaignProgress();
}

function countActProgress(act) {
  let total = 0;
  let done = 0;

  for (const quest of act.quests) {
    for (const step of quest.steps) {
      total += 1;
      if (isStepCompleted(act.id, quest.id, step.id)) {
        done += 1;
      }
    }
  }

  return { done, total };
}

function countOverallProgress() {
  if (!campaignState.data?.acts) return { done: 0, total: 0 };

  return campaignState.data.acts.reduce(
    (acc, act) => {
      const progress = countActProgress(act);
      acc.done += progress.done;
      acc.total += progress.total;
      return acc;
    },
    { done: 0, total: 0 }
  );
}

function questTypeLabel(type) {
  if (type === "side") return "Side";
  if (type === "optional") return "Optional";
  return "Main";
}

function rewardLabel(rewardType) {
  if (rewardType === "permanent") return "Permanent";
  if (rewardType === "points") return "Skill Points";
  if (rewardType === "ascendancy") return "Ascendancy";
  if (rewardType === "choice") return "Choice";
  if (rewardType === "unlocks") return "Unlocks";
  return "Reward";
}

function createRewardPill(reward, rewardType, isStep) {
  const pill = document.createElement("span");
  pill.className = `reward-pill reward-${rewardType || "item"}${isStep ? " reward-pill-step" : ""}`;
  pill.textContent = reward;
  pill.setAttribute("title", rewardLabel(rewardType));
  return pill;
}

function createProgressBar(done, total) {
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

function renderCampaignSummary(els) {
  const progress = countOverallProgress();
  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  els.campaignSummary.textContent = `${progress.done} of ${progress.total} steps complete — ${percent}%`;

  const bar = document.getElementById("campaignOverallBar");
  if (bar) {
    bar.style.width = `${percent}%`;
    bar.parentElement.setAttribute("aria-valuenow", String(progress.done));
    bar.parentElement.setAttribute("aria-valuemax", String(progress.total));
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

    // ── Act header (entire row is clickable) ──
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
    titleGroup.append(titleRow, createProgressBar(progress.done, progress.total));
    header.append(toggle, titleGroup);

    // ── Act body ──
    const body = document.createElement("div");
    body.className = "campaign-act-body";
    if (collapsed) body.setAttribute("hidden", "");

    for (const quest of act.quests) {
      const questBlock = document.createElement("section");
      questBlock.className = "campaign-quest";
      questBlock.dataset.type = quest.type || "main";

      const questHeader = document.createElement("div");
      questHeader.className = "campaign-quest-header";

      const questTitleRow = document.createElement("div");
      questTitleRow.className = "campaign-quest-title-row";

      const questTitle = document.createElement("h3");
      questTitle.textContent = quest.title;

      const badge = document.createElement("span");
      badge.className = `quest-type-badge quest-type-${quest.type || "main"}`;
      badge.textContent = questTypeLabel(quest.type);

      questTitleRow.append(questTitle, badge);
      questHeader.append(questTitleRow);

      if (quest.reward) {
        const rewardRow = document.createElement("div");
        rewardRow.className = "campaign-quest-reward-row";
        const rewardLabel = document.createElement("span");
        rewardLabel.className = "campaign-quest-reward-label";
        rewardLabel.textContent = "Reward:";
        rewardRow.append(rewardLabel, createRewardPill(quest.reward, quest.rewardType, false));
        questHeader.append(rewardRow);
      }

      const stepList = document.createElement("ul");
      stepList.className = "campaign-step-list";

      for (const step of quest.steps) {
        const item = document.createElement("li");
        const label = document.createElement("label");
        label.className = "campaign-step";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = isStepCompleted(act.id, quest.id, step.id);

        const stepContent = document.createElement("span");
        stepContent.className = "campaign-step-content";

        const text = document.createElement("span");
        text.className = "campaign-step-text";
        text.textContent = step.text;
        stepContent.append(text);

        if (step.reward) {
          stepContent.append(createRewardPill(step.reward, step.rewardType, true));
        }

        if (checkbox.checked) label.classList.add("done");

        checkbox.addEventListener("change", () => {
          toggleStep(act.id, quest.id, step.id, checkbox.checked);
          label.classList.toggle("done", checkbox.checked);
          renderCampaign(els);
        });

        label.append(checkbox, stepContent);
        item.append(label);
        stepList.append(item);
      }

      questBlock.append(questHeader, stepList);
      body.append(questBlock);
    }

    // Clicking anywhere on the header row toggles the act
    function handleToggle() {
      if (campaignState.collapsedActs.has(act.id)) {
        campaignState.collapsedActs.delete(act.id);
      } else {
        campaignState.collapsedActs.add(act.id);
      }
      renderCampaignActs(els);
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
