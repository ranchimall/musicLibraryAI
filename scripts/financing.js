// Handles the financing section where tasks can be viewed, posted, and managed.
// This connects the interface directly to the backend to keep everything in sync.

let financingTasks = [];
let taskBriefEditor = null;

// Small overlay while any financing payment is on-chain
function showFinancingLoading(text) {
  const el = document.getElementById("financing_loading");
  const t = document.getElementById("financing_loading_text");
  if (t && text) t.textContent = text;
  if (el) el.classList.remove("hidden");
}
function hideFinancingLoading() {
  document.getElementById("financing_loading")?.classList.add("hidden");
}

// What's allowed to be shown in a task brief safely.
// This ensures that any submitted text is cleaned up before displaying it to anyone.
const TASK_BRIEF_SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "p", "br", "strong", "em", "u", "s", "a",
    "ul", "ol", "li", "h1", "h2", "h3", "blockquote", "code", "pre",
  ],
  ALLOWED_ATTR: ["href", "target", "rel"],
};

function sanitizeTaskBrief(html) {
  return DOMPurify.sanitize(html || "", TASK_BRIEF_SANITIZE_CONFIG);
}

// Gets things started when someone opens the financing section.
async function renderFinancing() {
  ensureTaskBriefEditor();
  await loadFinancingTasks();
  await loadFinancingTrackOptions();
}

// Fills the invest-form track picker from the user's library, so nobody has to type a raw track ID. A search box filters tracks by title,artist or ID.
let financingTrackChoices = [];
let financingTrackSearchWired = false;

async function loadFinancingTrackOptions() {
  const searchInput = document.getElementById("financing_invest_track_search");
  if (!searchInput) return;

  wireFinancingTrackSearch();

  // Library not loaded yet? Try once to fetch it before giving up.
  if (!Array.isArray(TRACKS) || !TRACKS.length) {
    if (typeof window.loadTracksFromCloud === "function") {
      try {
        await window.loadTracksFromCloud();
      } catch (err) {
        console.warn("Could not refresh track library for investing:", err);
      }
    }
  }

  financingTrackChoices = Array.isArray(TRACKS) ? TRACKS.slice() : [];

  if (!financingTrackChoices.length) {
    searchInput.placeholder = "No tracks in your library yet";
    searchInput.disabled = true;
    return;
  }

  searchInput.disabled = false;
  renderFinancingTrackList("");
}

function financingTrackLabel(track) {
  const title = track.title || track.id;
  return track.artist ? `${title} — ${track.artist}` : title;
}

function renderFinancingTrackList(query) {
  const listBox = document.getElementById("financing_invest_track_options");
  if (!listBox) return;

  const q = (query || "").trim().toLowerCase();
  const matches = financingTrackChoices.filter((t) => {
    if (!q) return true;
    return `${t.title || ""} ${t.artist || ""} ${t.id}`
      .toLowerCase()
      .includes(q);
  });

  if (!matches.length) {
    listBox.innerHTML = `<div class="px-4 py-3 font-code-sm text-xs text-outline">No matching tracks</div>`;
    return;
  }

  listBox.innerHTML = matches
    .map(
      (t) => `
      <button type="button" data-track-id="${escapeHtml(t.id)}"
        data-track-label="${escapeHtml(financingTrackLabel(t))}"
        class="w-full text-left px-4 py-2.5 font-code-sm text-xs text-on-surface hover:bg-white/5 border-b border-white/5 last:border-b-0 transition-colors">
        ${escapeHtml(t.title || t.id)}${t.artist ? ` <span class="text-outline">— ${escapeHtml(t.artist)}</span>` : ""}
      </button>`,
    )
    .join("");
}

function selectFinancingTrack(id, label) {
  const hiddenInput = document.getElementById("financing_invest_track_id");
  const searchInput = document.getElementById("financing_invest_track_search");
  const listBox = document.getElementById("financing_invest_track_options");
  if (hiddenInput) hiddenInput.value = id;
  if (searchInput) searchInput.value = label;
  if (listBox) listBox.classList.add("hidden");
}

// Attaches the search/list events exactly once.
function wireFinancingTrackSearch() {
  if (financingTrackSearchWired) return;
  const searchInput = document.getElementById("financing_invest_track_search");
  const listBox = document.getElementById("financing_invest_track_options");
  if (!searchInput || !listBox) return;
  financingTrackSearchWired = true;

  searchInput.addEventListener("input", () => {
    // Editing the query clears the previous pick.
    const hiddenInput = document.getElementById("financing_invest_track_id");
    if (hiddenInput) hiddenInput.value = "";
    renderFinancingTrackList(searchInput.value);
    listBox.classList.remove("hidden");
  });

  searchInput.addEventListener("focus", () => {
    if (!financingTrackChoices.length) return;
    renderFinancingTrackList(searchInput.value);
    listBox.classList.remove("hidden");
  });

  // mousedown so the choice lands before any outside-click handler hides the list.
  listBox.addEventListener("mousedown", (e) => {
    const option = e.target.closest("button[data-track-id]");
    if (!option) return;
    e.preventDefault();
    selectFinancingTrack(option.dataset.trackId, option.dataset.trackLabel);
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (listBox.classList.contains("hidden")) return;
      const first = listBox.querySelector("button[data-track-id]");
      if (first) selectFinancingTrack(first.dataset.trackId, first.dataset.trackLabel);
    } else if (e.key === "Escape") {
      listBox.classList.add("hidden");
    }
  });

  document.addEventListener("click", (e) => {
    if (
      !e.target.closest("#financing_invest_track_search") &&
      !e.target.closest("#financing_invest_track_options")
    ) {
      listBox.classList.add("hidden");
    }
  });
}

// Sets up the text editor if it hasn't been done already.
function ensureTaskBriefEditor() {
  if (taskBriefEditor || typeof Quill === "undefined") return;

  taskBriefEditor = new Quill("#financing_task_brief_editor", {
    theme: "snow",
    placeholder: "What needs to be made? Add detail, links, a checklist...",
    modules: {
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["blockquote", "code-block", "link"],
        ["clean"],
      ],
    },
  });
}

function toggleFinancingPostTaskForm() {
  document.getElementById("financing_post_task_form").classList.toggle("hidden");
}

async function loadFinancingTasks() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/tasks`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Failed to load tasks");

    financingTasks = data.tasks;
    renderFinancingTaskList();
  } catch (err) {
    console.error("Failed to load tasks:", err);
    showToast("Failed to load tasks.", "error");
  }
}

const COMPONENT_TYPE_LABELS = {
  lyrics: "Lyrics",
  music: "Music",
  vocals: "Vocals",
  marketing: "Marketing",
};

function financingComponentTag(task) {
  if (!task.component_type) return "";
  const label = COMPONENT_TYPE_LABELS[task.component_type] || task.component_type;
  return `<span class="font-label-caps text-[9px] text-primary-fixed-dim uppercase tracking-widest shrink-0 px-2 py-1 rounded bg-primary-fixed-dim/10 border border-primary-fixed-dim/20">${label}</span>`;
}

function renderFinancingTaskList() {
  const columns = { open: [], claimed: [], completed: [] };
  financingTasks.forEach((task) => {
    (columns[task.status] || columns.open).push(task);
  });

  renderFinancingColumn("financing_task_column_open", columns.open, "open",
    "No open tasks yet - be the first to post one.");
  renderFinancingColumn("financing_task_column_claimed", columns.claimed, "claimed",
    "Nothing claimed right now.");
  renderFinancingColumn("financing_task_column_completed", columns.completed, "completed",
    "Nothing delivered yet.");
}

function renderFinancingColumn(elementId, tasks, status, emptyMessage) {
  const el = document.getElementById(elementId);
  if (!tasks.length) {
    el.innerHTML = `<div class="text-center text-outline py-6 font-code-sm text-xs">${emptyMessage}</div>`;
    return;
  }

  const myFloId = floGlobals.myFloID;

  el.innerHTML = tasks
    .map((task) => {
      const budgetLabel = task.budget != null ? Number(task.budget).toFixed(2) : "Open";
      const isMine = task.fulfilled_by_flo_id === myFloId;

      let actionHtml = "";
      if (status === "open") {
        actionHtml = `
          <button onclick="handleFinancingClaimTask(${task.id})" title="Claim this task"
            class="w-full flex items-center justify-center gap-xs py-xs rounded bg-primary-fixed-dim text-on-primary-fixed font-label-caps text-[10px] tracking-widest uppercase hover:scale-[1.02] active:scale-[0.98] transition-all">
            <span class="material-symbols-outlined text-sm">flag</span>
            Claim
          </button>`;
      } else if (status === "claimed" && isMine) {
        actionHtml = `
          <div class="flex flex-col sm:flex-row gap-xs sm:gap-sm items-stretch sm:items-center">
            <input id="financing_complete_trackid_${task.id}" type="text"
              class="flex-1 min-w-0 w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-code-sm focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-all placeholder:text-outline/50"
              placeholder="Track ID" />
            <button onclick="handleFinancingCompleteTask(${task.id})" title="Mark complete"
              class="shrink-0 flex items-center justify-center gap-xs px-md py-2 rounded-lg bg-primary-fixed-dim text-on-primary-fixed font-label-caps text-[10px] tracking-widest uppercase hover:scale-[1.02] active:scale-[0.98] transition-all w-full sm:w-auto">
              <span class="material-symbols-outlined text-sm">check</span>
              Deliver
            </button>
          </div>`;
      } else if (status === "claimed") {
        actionHtml = `<div class="text-center py-xs rounded bg-white/5 font-label-caps text-[10px] tracking-widest uppercase text-outline">Claimed by ${truncateFloId(task.fulfilled_by_flo_id)}</div>`;
      } else if (status === "completed") {
        actionHtml = `<div class="text-center py-xs rounded bg-white/5 font-label-caps text-[10px] tracking-widest uppercase text-outline">Delivered: ${escapeHtml(task.track_id || "")}</div>`;
      }

      // You can always support a task financially, even if someone else is doing the work.
      const backingHtml = status !== "completed" ? `
          <div class="flex flex-col sm:flex-row gap-xs sm:gap-sm items-stretch sm:items-center">
            <input id="financing_back_amount_${task.id}" type="number" min="0" step="any"
              class="flex-1 min-w-0 w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-code-sm focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-all placeholder:text-outline/50"
              placeholder="Back: USDAI amount" />
            <div class="flex gap-xs sm:gap-sm items-center w-full sm:w-auto">
              <input id="financing_back_revshare_${task.id}" type="number" min="0" max="100" step="any"
                class="flex-1 sm:flex-none sm:w-20 min-w-0 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-code-sm focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-all placeholder:text-outline/50"
                placeholder="Rev %" />
              <button onclick="handleFinancingBackTask(${task.id})" title="Back this task"
                class="shrink-0 flex items-center justify-center py-2 px-3 rounded-lg bg-white/5 border border-white/10 text-on-surface font-label-caps text-[10px] tracking-widest uppercase hover:bg-white/10 active:scale-95 transition-all">
                <span class="material-symbols-outlined text-sm">handshake</span>
              </button>
            </div>
          </div>` : "";

      return `
        <div class="glass-panel rounded-xl p-sm md:p-md flex flex-col gap-3 min-w-0 overflow-hidden">
          <div class="flex items-start justify-between gap-2 min-w-0">
            <div class="task-brief-content font-code-sm text-sm text-on-surface flex-1 min-w-0 break-words">${sanitizeTaskBrief(task.brief)}</div>
            ${financingComponentTag(task)}
          </div>
          <span class="font-code-sm text-xs text-outline">Budget: <span class="text-primary-fixed-dim">${budgetLabel}</span></span>
          ${actionHtml}
          ${backingHtml}
        </div>`;
    })
    .join("");
}

// Keeps user text safe before showing it on the page.
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function handleFinancingPostTask() {
  const budgetInput = document.getElementById("financing_task_budget");
  const componentTypeInput = document.getElementById("financing_task_component_type");

  const briefHtml = taskBriefEditor ? taskBriefEditor.root.innerHTML.trim() : "";
  const briefIsEmpty = !taskBriefEditor || taskBriefEditor.getText().trim().length === 0;
  if (briefIsEmpty) {
    showToast("Enter a brief for the task.", "warning");
    return;
  }

  const budget = budgetInput.value ? Number(budgetInput.value) : null;
  const componentType = componentTypeInput.value || undefined;

  try {
    // Makes sure only authorized users can post new tasks.
    await marketplaceCreateTask(floGlobals.myFloID, briefHtml, budget, componentType);

    showToast("Task posted.", "success");
    taskBriefEditor.setContents([]);
    budgetInput.value = "";
    componentTypeInput.value = "";
    document.getElementById("financing_post_task_form").classList.add("hidden");
    await loadFinancingTasks();
  } catch (err) {
    console.error("Failed to post task:", err);
    showToast(err.message || "Failed to post task.", "error");
  }
}

async function handleFinancingClaimTask(taskId) {
  try {
    await marketplaceClaimTask(taskId);
    showToast("Task claimed.", "success");
    await loadFinancingTasks();
  } catch (err) {
    console.error("Failed to claim task:", err);
    showToast(err.message || "Failed to claim task.", "error");
  }
}

async function handleFinancingCompleteTask(taskId) {
  const trackIdInput = document.getElementById(`financing_complete_trackid_${taskId}`);
  const trackId = trackIdInput.value.trim();
  if (!trackId) {
    showToast("Enter the track ID you delivered.", "warning");
    return;
  }

  try {
    await marketplaceCompleteTask(taskId, trackId);
    showToast("Task marked complete.", "success");
    await loadFinancingTasks();
  } catch (err) {
    console.error("Failed to complete task:", err);
    showToast(err.message || "Failed to complete task.", "error");
  }
}

// Financing moves real USDAI: key prompt -> on-chain payment -> verified credit.
async function handleFinancingBackTask(taskId) {
  const amountInput = document.getElementById(`financing_back_amount_${taskId}`);
  const revshareInput = document.getElementById(`financing_back_revshare_${taskId}`);

  const amount = Number(amountInput.value);
  if (!amount || amount <= 0) {
    showToast("Enter an amount to back this task.", "warning");
    return;
  }
  const revenueSharePct = revshareInput.value ? Number(revshareInput.value) : undefined;

  if (revenueSharePct !== undefined && (revenueSharePct < 0 || revenueSharePct > 100)) {
    showToast("Revenue share must be between 0 and 100%.", "warning");
    return;
  }

  const privKey = await requestUsdaiPrivateKey();
  if (!privKey) return;

  const backBtn = document.querySelector(`button[onclick="handleFinancingBackTask(${taskId})"]`);
  const origBackText = backBtn ? backBtn.innerHTML : "";
  if (backBtn) { backBtn.disabled = true; backBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span>'; }
  showFinancingLoading(`Sending ${amount} USDAI on-chain…`);
  try {
    showToast(`Sending ${amount} USDAI on-chain…`);
    const { payerFloId, txid } = await sendUsdaiFromKey(privKey, amount);
    showFinancingLoading(`Waiting for confirmation…`);
    const result = await redeemUsdaiPayment(
      (rTxid, rAuth) => marketplaceBackTask(taskId, amount, revenueSharePct, rTxid, rAuth),
      txid,
      { privKey, floId: payerFloId },
    );

    showToast(
      `Task backed - $${Number(result.usdaiValue).toFixed(2)} USD credited.`,
      "success",
    );
    await loadFinancingTasks();
  } catch (err) {
    console.error("Failed to back task:", err);
    showToast(
      typeof err === "string" ? err : err.message || "Failed to back task.",
      "error",
    );
  } finally {
    hideFinancingLoading();
    if (backBtn) { backBtn.disabled = false; backBtn.innerHTML = origBackText; }
  }
}

// Financing moves real USDAI: key prompt -> on-chain payment -> verified credit.
async function handleFinancingInvest() {
  const trackSearch = document.getElementById("financing_invest_track_search");
  const hiddenTrackId = document.getElementById("financing_invest_track_id");
  const amountInput = document.getElementById("financing_invest_amount");
  const revshareInput = document.getElementById("financing_invest_revshare");

  const trackId = hiddenTrackId ? hiddenTrackId.value : "";
  const amount = Number(amountInput.value);

  if (!trackId) {
    showToast("Choose a track to invest in.", "warning");
    trackSearch?.focus();
    return;
  }
  if (!amount || amount <= 0) {
    showToast("Enter an amount to invest.", "warning");
    return;
  }

  const revenueSharePct = revshareInput.value ? Number(revshareInput.value) : undefined;

  if (revenueSharePct !== undefined && (revenueSharePct < 0 || revenueSharePct > 100)) {
    showToast("Revenue share must be between 0 and 100%.", "warning");
    return;
  }

  const privKey = await requestUsdaiPrivateKey();
  if (!privKey) return;

  const investBtn = document.querySelector('button[onclick="handleFinancingInvest()"]');
  const origInvestText = investBtn ? investBtn.innerHTML : "";
  if (investBtn) { investBtn.disabled = true; investBtn.innerHTML = '<span class="material-symbols-outlined text-base animate-spin">progress_activity</span> Investing…'; }
  showFinancingLoading(`Sending ${amount} USDAI on-chain…`);
  try {
    showToast(`Sending ${amount} USDAI on-chain…`);
    const { payerFloId, txid } = await sendUsdaiFromKey(privKey, amount);
    showFinancingLoading(`Waiting for confirmation…`);
    const result = await redeemUsdaiPayment(
      (rTxid, rAuth) => marketplaceInvestInTrack(trackId, amount, revenueSharePct, rTxid, rAuth),
      txid,
      { privKey, floId: payerFloId },
    );

    showToast(
      `Investment credited - $${Number(result.usdaiValue).toFixed(2)} USD.`,
      "success",
    );
    if (hiddenTrackId) hiddenTrackId.value = "";
    if (trackSearch) trackSearch.value = "";
    document
      .getElementById("financing_invest_track_options")
      ?.classList.add("hidden");
    amountInput.value = "";
    revshareInput.value = "";
  } catch (err) {
    console.error("Failed to invest:", err);
    showToast(
      typeof err === "string" ? err : err.message || "Failed to invest.",
      "error",
    );
  } finally {
    hideFinancingLoading();
    if (investBtn) { investBtn.disabled = false; investBtn.innerHTML = origInvestText; }
  }
}
