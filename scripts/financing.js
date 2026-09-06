// Handles the task board where tasks can be viewed, posted, claimed, and completed.
// This keeps the interface directly in sync with the backend task endpoints.

let financingTasks = [];
let taskBriefEditor = null;

// What's allowed to be shown in a task brief safely.
// This ensures that any submitted text is cleaned up before displaying it to anyone.
const TASK_BRIEF_SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "a",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "blockquote",
    "code",
    "pre",
  ],
  ALLOWED_ATTR: ["href", "target", "rel"],
};

function sanitizeTaskBrief(html) {
  return DOMPurify.sanitize(html || "", TASK_BRIEF_SANITIZE_CONFIG);
}

// Gets things started when someone opens the task board.
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
  document
    .getElementById("financing_post_task_form")
    .classList.toggle("hidden");
}

async function loadFinancingTasks() {
  try {
    if (typeof isCurrentUserAdmin === "undefined" || isCurrentUserAdmin === null) {
      if (typeof checkAndApplyAdminVisibility === "function") {
        await checkAndApplyAdminVisibility();
      }
    }
    const res = await fetch(`${API_BASE_URL}/api/tasks`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Failed to load tasks");

    const claims = Array.isArray(data.claims) ? data.claims : [];
    const myFloId = floGlobals.myFloID;

    financingTasks = (data.tasks || []).map((task) => {
      const myClaim = claims.find(
        (c) => c.task_id === task.id && c.claimer_flo_id === myFloId,
      );
      return {
        ...task,
        isClaimedByMe: !!myClaim,
      };
    });
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
  const label =
    COMPONENT_TYPE_LABELS[task.component_type] || task.component_type;
  return `<span class="font-label-caps text-[9px] text-primary-fixed-dim uppercase tracking-widest shrink-0 px-2 py-1 rounded bg-primary-fixed-dim/10 border border-primary-fixed-dim/20">${label}</span>`;
}

function renderFinancingTaskList() {
  const columns = { open: [], claimed: [], completed: [] };
  const myFloId = floGlobals.myFloID;
  const isAdmin = isCurrentUserAdmin;

  financingTasks.forEach((task) => {
    // NEW LOGIC: If completed, hide it from normal users
    if (task.status === "completed") {
      if (
        isAdmin ||
        task.requester_flo_id === myFloId ||
        task.winner_flo_id === myFloId
      ) {
        columns.completed.push(task);
      }
    } else {
      // For Open and Claimed, just push normally
      (columns[task.status] || columns.open).push(task);
    }
  });

  renderFinancingColumn(
    "financing_task_column_open",
    columns.open,
    "open",
    "No open tasks yet - be the first to post one.",
  );
  renderFinancingColumn(
    "financing_task_column_completed",
    columns.completed,
    "completed",
    "Nothing delivered yet.",
  );
}

function renderFinancingColumn(elementId, tasks, status, emptyMessage) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (!tasks.length) {
    el.innerHTML = `<div class="text-center text-outline py-6 font-code-sm text-xs">${emptyMessage}</div>`;
    return;
  }

  el.innerHTML = tasks
    .map((task) => {
      const budgetLabel =
        task.budget != null ? Number(task.budget).toFixed(2) : "Open";

      let actionHtml = "";
      if (status === "open") {
        const claimantLabel = task.isClaimedByMe
          ? `<div class="text-center py-xs rounded bg-white/5 font-label-caps text-[10px] tracking-widest uppercase text-outline mb-2">Claimed by You</div>`
          : "";

        const submitSection = `
          <!-- Add this for users to submit their work -->
          <div class="mt-2 pt-2 border-t border-white/5">
              <input id="delivery_link_${task.id}" type="text"
                  class="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-xs font-code-sm text-white focus:outline-none focus:border-primary-fixed-dim"
                  placeholder="Paste delivery link here...">
              <button onclick="handleSubmitTask(${task.id})"
                  class="mt-1 w-full px-2 py-1 rounded bg-primary-fixed-dim text-on-primary-fixed text-[10px] uppercase font-bold hover:opacity-90 transition-opacity">
                  Submit Work
              </button>
          </div>`;

        const adminSection = isCurrentUserAdmin
          ? `
          <!-- Add this for Admins to view submissions (only show if isCurrentUserAdmin) -->
          <div class="mt-2">
              <button onclick="loadSubmissions(${task.id})"
                  class="w-full px-2 py-1 rounded bg-white/5 border border-white/10 text-on-surface text-[10px] uppercase hover:bg-white/10 transition-colors">
                  View Submissions
              </button>
              <div id="submissions_${task.id}" class="mt-1 space-y-1"></div>
          </div>`
          : "";

        if (task.isClaimedByMe) {
          actionHtml = claimantLabel + submitSection + adminSection;
        } else {
          actionHtml = `
            <button onclick="handleFinancingClaimTask(${task.id})" title="Claim this task"
              class="w-full flex items-center justify-center gap-xs py-xs rounded bg-primary-fixed-dim text-on-primary-fixed font-label-caps text-[10px] tracking-widest uppercase hover:scale-[1.02] active:scale-[0.98] transition-all">
              <span class="material-symbols-outlined text-sm">flag</span>
              Claim
            </button>
            ${adminSection}`;
        }
      } else if (status === "completed") {
        const isWinner =
          task.winner_flo_id && task.winner_flo_id === floGlobals.myFloID;
        const winnerBadge = isWinner
          ? `<div class="text-center py-xs rounded bg-green-400/10 border border-green-400/20 font-label-caps text-[10px] tracking-widest uppercase text-green-400 font-bold mb-1">Won by You</div>`
          : task.winner_flo_id
          ? `<div class="text-center py-xs rounded bg-white/5 font-label-caps text-[10px] tracking-widest uppercase text-outline mb-1">Winner: ${truncateFloId(task.winner_flo_id)}</div>`
          : "";

        const adminSection = isCurrentUserAdmin
          ? `
          <div class="mt-2">
              <button onclick="loadSubmissions(${task.id})"
                  class="w-full px-2 py-1 rounded bg-white/5 border border-white/10 text-on-surface text-[10px] uppercase hover:bg-white/10 transition-colors">
                  View Submissions
              </button>
              <div id="submissions_${task.id}" class="mt-1 space-y-1"></div>
          </div>`
          : "";

        actionHtml = `${winnerBadge}<div class="text-center py-xs rounded bg-white/5 font-label-caps text-[10px] tracking-widest uppercase text-outline">Delivered: ${escapeHtml(task.track_id || "Completed")}</div>${adminSection}`;
      }

      return `
        <div class="glass-panel rounded-xl p-sm md:p-md flex flex-col gap-3 min-w-0 overflow-hidden">
          <div class="flex items-start justify-between gap-2 min-w-0">
            <div class="task-brief-content font-code-sm text-sm text-on-surface flex-1 min-w-0 break-words">${sanitizeTaskBrief(task.brief)}</div>
            ${financingComponentTag(task)}
          </div>
          <span class="font-code-sm text-xs text-outline">Scope: <span class="text-primary-fixed-dim">${budgetLabel}</span></span>
          ${actionHtml}
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
  const componentTypeInput = document.getElementById(
    "financing_task_component_type",
  );

  const briefHtml = taskBriefEditor
    ? taskBriefEditor.root.innerHTML.trim()
    : "";
  const briefIsEmpty =
    !taskBriefEditor || taskBriefEditor.getText().trim().length === 0;
  if (briefIsEmpty) {
    showToast("Enter a brief for the task.", "warning");
    return;
  }

  const budget = budgetInput.value ? Number(budgetInput.value) : null;
  const componentType = componentTypeInput.value || undefined;

  try {
    // Makes sure only authorized users can post new tasks.
    await marketplaceCreateTask(
      floGlobals.myFloID,
      briefHtml,
      budget,
      componentType,
    );

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
  const trackIdInput = document.getElementById(
    `financing_complete_trackid_${taskId}`,
  );
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

// --- Task Submission & Winner Selection Handlers ---

// User submits their work link
async function handleSubmitTask(taskId) {
  const input = document.getElementById(`delivery_link_${taskId}`);
  const deliveryLink = input ? input.value.trim() : "";

  if (!deliveryLink) {
    showToast("Please paste your delivery link first.", "warning");
    return;
  }

  try {
    await marketplaceSubmitTask(taskId, deliveryLink);
    showToast("Work submitted!", "success");
    if (input) input.value = "";
    if (typeof loadFinancingTasks === "function") await loadFinancingTasks(); // Refresh board
  } catch (err) {
    console.error("Failed to submit task:", err);
    showToast(err.message || "Failed to submit work.", "error");
  }
}

// Admin loads and views submissions for a task
async function loadSubmissions(taskId) {
  const container = document.getElementById(`submissions_${taskId}`);
  if (!container) return;

  container.innerHTML = `<div class="font-code-sm text-xs text-outline">Loading submissions...</div>`;

  try {
    const data = await marketplaceGetSubmissions(taskId);
    const submissions = data.submissions || [];

    if (!submissions.length) {
      container.innerHTML = `<div class="font-code-sm text-xs text-outline">No submissions yet.</div>`;
      return;
    }

    container.innerHTML = submissions.map((sub) => {
      const selectedBadge = sub.is_selected
        ? `<span class="px-2 py-0.5 rounded bg-green-400/10 text-green-400 text-[9px] uppercase font-bold">Selected</span>`
        : "";

      const selectBtn = isCurrentUserAdmin && !sub.is_selected
        ? `<button onclick="handleSelectWinner(${taskId}, ${sub.id})" class="ml-2 px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] hover:bg-white/10 transition-colors">Select Winner</button>`
        : "";

      return `
        <div class="flex items-center justify-between gap-2 border-b border-white/5 py-2">
          <div class="min-w-0">
            <a href="${escapeHtml(sub.delivery_link || '')}" target="_blank" rel="noopener noreferrer" class="text-primary-fixed-dim underline truncate block">${escapeHtml(sub.delivery_link || '')}</a>
            <span class="font-code-sm text-[10px] text-outline">By ${escapeHtml(sub.submitter_flo_id || '')}</span>
            ${selectedBadge}
          </div>
          ${selectBtn}
        </div>`;
    }).join("");
  } catch (err) {
    console.error("Failed to load submissions:", err);
    container.innerHTML = `<div class="font-code-sm text-xs text-error">Failed to load submissions.</div>`;
  }
}

// Admin selects the winning submission
async function handleSelectWinner(taskId, submissionId) {
  if (!confirm("Select this submission as the winning work?")) return;

  try {
    await marketplaceSelectWinner(taskId, submissionId);
    showToast("Winner selected!", "success");
    if (typeof loadFinancingTasks === "function") await loadFinancingTasks(); // Refresh board
  } catch (err) {
    console.error("Failed to select winner:", err);
    showToast(err.message || "Failed to select winner.", "error");
  }
}

