// Handles the financing section where tasks can be viewed, posted, and managed.
// This connects the interface directly to the backend to keep everything in sync.

let financingTasks = [];
let taskBriefEditor = null;

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
          <div class="flex items-center gap-xs">
            <input id="financing_complete_trackid_${task.id}" type="text"
              class="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-code-sm focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-all placeholder:text-outline/50"
              placeholder="Track ID" />
            <button onclick="handleFinancingCompleteTask(${task.id})" title="Mark complete"
              class="shrink-0 flex items-center justify-center gap-xs px-md py-2 rounded-lg bg-primary-fixed-dim text-on-primary-fixed font-label-caps text-[10px] tracking-widest uppercase hover:scale-[1.02] active:scale-[0.98] transition-all">
              <span class="material-symbols-outlined text-sm">check</span>
            </button>
          </div>`;
      } else if (status === "claimed") {
        actionHtml = `<div class="text-center py-xs rounded bg-white/5 font-label-caps text-[10px] tracking-widest uppercase text-outline">Claimed by ${truncateFloId(task.fulfilled_by_flo_id)}</div>`;
      } else if (status === "completed") {
        actionHtml = `<div class="text-center py-xs rounded bg-white/5 font-label-caps text-[10px] tracking-widest uppercase text-outline">Delivered: ${escapeHtml(task.track_id || "")}</div>`;
      }

      // You can always support a task financially, even if someone else is doing the work.
      const backingHtml = status !== "completed" ? `
          <div class="flex items-center gap-sm">
            <input id="financing_back_amount_${task.id}" type="number" min="0" step="any"
              class="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-code-sm focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-all placeholder:text-outline/50"
              placeholder="Back: amount" />
            <input id="financing_back_revshare_${task.id}" type="number" min="0" max="100" step="any"
              class="w-16 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-code-sm focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-all placeholder:text-outline/50"
              placeholder="Rev %" />
            <button onclick="handleFinancingBackTask(${task.id})" title="Back this task"
              class="shrink-0 flex items-center justify-center py-2 px-3 rounded-lg bg-white/5 border border-white/10 text-on-surface font-label-caps text-[10px] tracking-widest uppercase hover:bg-white/10 active:scale-95 transition-all">
              <span class="material-symbols-outlined text-sm">handshake</span>
            </button>
          </div>` : "";

      return `
        <div class="glass-panel rounded-xl p-md flex flex-col gap-3">
          <div class="flex items-start justify-between gap-2">
            <div class="task-brief-content font-code-sm text-sm text-on-surface flex-1">${sanitizeTaskBrief(task.brief)}</div>
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

async function handleFinancingBackTask(taskId) {
  const amountInput = document.getElementById(`financing_back_amount_${taskId}`);
  const revshareInput = document.getElementById(`financing_back_revshare_${taskId}`);

  const amount = Number(amountInput.value);
  if (!amount || amount <= 0) {
    showToast("Enter an amount to back this task.", "warning");
    return;
  }
  const revenueSharePct = revshareInput.value ? Number(revshareInput.value) : undefined;

  try {
    await marketplaceBackTask(taskId, amount, revenueSharePct);
    showToast("Task backed.", "success");
    amountInput.value = "";
    revshareInput.value = "";
  } catch (err) {
    console.error("Failed to back task:", err);
    showToast(err.message || "Failed to back task.", "error");
  }
}

async function handleFinancingInvest() {
  const trackIdInput = document.getElementById("financing_invest_track_id");
  const amountInput = document.getElementById("financing_invest_amount");
  const revshareInput = document.getElementById("financing_invest_revshare");

  const trackId = trackIdInput.value.trim();
  const amount = Number(amountInput.value);

  if (!trackId) {
    showToast("Enter a track ID to invest in.", "warning");
    return;
  }
  if (!amount || amount <= 0) {
    showToast("Enter an amount to invest.", "warning");
    return;
  }

  const revenueSharePct = revshareInput.value ? Number(revshareInput.value) : undefined;

  try {
    await marketplaceInvestInTrack(trackId, amount, revenueSharePct);
    showToast("Investment recorded.", "success");
    trackIdInput.value = "";
    amountInput.value = "";
    revshareInput.value = "";
  } catch (err) {
    console.error("Failed to invest:", err);
    showToast(err.message || "Failed to invest.", "error");
  }
}
