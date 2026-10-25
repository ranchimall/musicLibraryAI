// Manages the marketplace interface where users can browse and interact with properties.
// It handles keeping the display up to date and processing interactions like buying or selling.

const MARKETPLACE_COMPONENT_TYPES = ["lyrics", "music", "vocals", "marketing"];

let marketplaceState = {
  categories: [],
  categorySlug: null,
  categoryId: null,
  view: "properties", // "properties" | "token" | "taskboard" | "overview" | "config"
  top100Only: false,
  properties: [], // bundle Properties in the selected category
  property: null, // currently open bundle, with components/people/financing attached
  tokenPrice: null,
  tokenSupply: null,
  systemValuation: null,
  usdaiPaymentAddress: null,
};

// Remembers if the current user has special privileges so we don't have to keep checking.
let isCurrentUserAdmin = null;
let marketplaceConfigCache = null;

// Notification polling state. The poll only asks for an unread count, not the full inbox, and backs off when the backend is unavailable.
const NOTIFICATION_POLL_BASE_MS = 60000;
const NOTIFICATION_POLL_MAX_MS = 300000;
const NOTIFICATION_POLL_JITTER_MS = 15000;
let notificationUnreadCount = 0;
let notificationPollTimer = null;
let notificationPollInFlight = false;
let notificationPollBackoffMs = NOTIFICATION_POLL_BASE_MS;
let notificationLastPollAt = 0;
let notificationPollStartAttempts = 0;

// Starts up the marketplace view when the user navigates here.
async function renderMarketplace() {

  marketplaceState.view = "properties";
  document.getElementById("marketplace_token_panel").classList.add("hidden");
  document.getElementById("marketplace_taskboard_panel").classList.add("hidden");
  document.getElementById("marketplace_property_detail").classList.add("hidden");
  document.getElementById("marketplace_loading_state").classList.remove("hidden");
  if (!marketplaceState.categories.length) {
    await loadMarketplaceCategories();
  }

  if (isCurrentUserAdmin === null) {
    await checkAndApplyAdminVisibility();
  }

  // Only reveal the tabs/controls once categories and the admin check are done.
  document.getElementById("marketplace_view_tabs")?.classList.remove("hidden");
  document
    .getElementById("marketplace_property_controls")
    ?.classList.remove("hidden");

  highlightMarketplaceViewTab();
  await showMarketplaceView();
}

// Keeps special controls hidden until we know for sure the user is allowed to see them.
async function checkAndApplyAdminVisibility() {
  try {
    isCurrentUserAdmin = await marketplaceCheckIsAdmin();
  } catch (err) {
    console.error("Failed to check admin status:", err);
    isCurrentUserAdmin = false;
  }

  const addCategoryBtn = document.getElementById(
    "marketplace_add_category_btn",
  );
  if (addCategoryBtn)
    addCategoryBtn.classList.toggle("hidden", !isCurrentUserAdmin);

  const addPropertyBtn = document.getElementById(
    "marketplace_add_property_btn",
  );
  if (addPropertyBtn)
    addPropertyBtn.classList.toggle("hidden", !isCurrentUserAdmin);

  const attachComponentBtn = document.getElementById(
    "marketplace_show_attach_component_btn",
  );
  if (attachComponentBtn)
    attachComponentBtn.classList.toggle("hidden", !isCurrentUserAdmin);

  const attachPersonBtn = document.getElementById(
    "marketplace_show_attach_person_btn",
  );
  if (attachPersonBtn)
    attachPersonBtn.classList.toggle("hidden", !isCurrentUserAdmin);

  const attachTaskBtn = document.getElementById(
    "marketplace_show_attach_task_btn",
  );
  if (attachTaskBtn)
    attachTaskBtn.classList.toggle("hidden", !isCurrentUserAdmin);

  const addFinanceBtn = document.getElementById(
    "marketplace_show_add_finance_btn",
  );
  if (addFinanceBtn)
    addFinanceBtn.classList.toggle("hidden", !isCurrentUserAdmin);

  const postTaskBtn = document.getElementById("financing_post_task_btn");
  if (postTaskBtn) postTaskBtn.classList.toggle("hidden", !isCurrentUserAdmin);

  const usageBtn = document.getElementById("marketplace_show_usage_btn");
  if (usageBtn) usageBtn.classList.toggle("hidden", !isCurrentUserAdmin);

  const inviteBtn = document.getElementById("marketplace_show_invite_btn");
  if (inviteBtn) inviteBtn.classList.toggle("hidden", !isCurrentUserAdmin);

  const configTab = document.getElementById("marketplace_config_tab_btn");
  if (configTab) configTab.classList.toggle("hidden", !isCurrentUserAdmin);
}

function setMarketplaceLoading(isLoading) {
  document
    .getElementById("marketplace_loading_state")
    .classList.toggle("hidden", !isLoading);
  if (isLoading) {
    document
      .getElementById("marketplace_properties_list")
      .classList.add("hidden");
    document
      .getElementById("marketplace_property_detail")
      .classList.add("hidden");
    document.getElementById("marketplace_empty_state").classList.add("hidden");
  }
}

async function loadMarketplaceCategories() {
  const select = document.getElementById("marketplace_category_select");
  try {
    const res = await fetch(`${API_BASE_URL}/api/categories`);
    const data = await res.json();

    // "All Categories" is always the first option — shows the global Top-100.
    const allCategoriesOption = `<option value="" data-id="">All Categories</option>`;

    if (!data.success || !data.categories.length) {
      select.innerHTML = allCategoriesOption;
      marketplaceState.categorySlug = null;
      marketplaceState.categoryId = null;
    } else {
      marketplaceState.categories = data.categories;
      select.innerHTML =
        allCategoriesOption +
        data.categories
          .map(
            (c) =>
              `<option value="${c.slug}" data-id="${c.id}">${c.name}</option>`,
          )
          .join("");

      // Start on "All Categories" (global Top-100) rather than the first category.
      marketplaceState.categorySlug = null;
      marketplaceState.categoryId = null;
    }

    select.onchange = () => {
      const opt = select.options[select.selectedIndex];
      marketplaceState.categorySlug = opt.value || null;
      marketplaceState.categoryId = opt.dataset.id
        ? Number(opt.dataset.id)
        : null;
      showMarketplacePropertiesList();
    };
  } catch (err) {
    console.error("Failed to load categories:", err);
    select.innerHTML = `<option value="">Failed to load categories</option>`;
  }
}

function setMarketplaceView(view) {
  marketplaceState.view = view;
  highlightMarketplaceViewTab();
  showMarketplaceView();
}

function highlightMarketplaceViewTab() {
  document.querySelectorAll(".marketplace-tab-btn").forEach((btn) => {
    const active = btn.dataset.view === marketplaceState.view;
    btn.classList.toggle("bg-primary-fixed-dim", active);
    btn.classList.toggle("text-on-primary-fixed", active);
    btn.classList.toggle("text-outline", !active);
  });
}

// Updates the view depending on which top-level tab the user is looking at.
async function showMarketplaceView() {
  const view = marketplaceState.view;
  const isToken = view === "token";
  const isTaskboard = view === "taskboard";
  const isOverview = view === "overview";
  const isConfig = view === "config";

  const tokenPanel = document.getElementById("marketplace_token_panel");
  const taskboardPanel = document.getElementById("marketplace_taskboard_panel");
  const propertyDetail = document.getElementById("marketplace_property_detail");
  const overviewPanel = document.getElementById("marketplace_overview_panel");
  const configPanel = document.getElementById("marketplace_config_panel");
  if (tokenPanel) tokenPanel.classList.add("hidden");
  if (taskboardPanel) taskboardPanel.classList.add("hidden");
  if (propertyDetail) propertyDetail.classList.add("hidden");
  if (overviewPanel) overviewPanel.classList.add("hidden");
  if (configPanel) configPanel.classList.add("hidden");

  // Category browsing controls only make sense on Properties.
  const hideChrome = isToken || isTaskboard || isOverview || isConfig;
  const categorySelectWrap = document.getElementById("marketplace_category_select_wrap");
  if (categorySelectWrap) categorySelectWrap.classList.toggle("hidden", hideChrome);
  const top100Wrap = document.getElementById("marketplace_top100_toggle_wrap");
  if (top100Wrap) top100Wrap.classList.toggle("hidden", hideChrome);
  const addPropertyBtn = document.getElementById("marketplace_add_property_btn");
  if (addPropertyBtn) {
    addPropertyBtn.classList.toggle("hidden", hideChrome || !isCurrentUserAdmin);
  }

  // Get the rest of the elements
  const propertiesList = document.getElementById("marketplace_properties_list");
  const emptyState = document.getElementById("marketplace_empty_state");
  const loadingState = document.getElementById("marketplace_loading_state");

  if (isOverview) {
    loadingState.classList.add("hidden");
    propertiesList.classList.add("hidden");
    emptyState.classList.add("hidden");
    taskboardPanel.classList.add("hidden");
    tokenPanel.classList.add("hidden");
    overviewPanel.classList.remove("hidden");
    await loadMarketplaceOverview();
    return;
  }

  if (isConfig) {
    loadingState.classList.add("hidden");
    propertiesList.classList.add("hidden");
    emptyState.classList.add("hidden");
    taskboardPanel.classList.add("hidden");
    tokenPanel.classList.add("hidden");
    overviewPanel.classList.add("hidden");
    if (configPanel) configPanel.classList.remove("hidden");
    await loadMarketplaceConfigPanel();
    return;
  }

  if (isTaskboard) {
    loadingState.classList.add("hidden");
    propertiesList.classList.add("hidden");
    emptyState.classList.add("hidden");
    tokenPanel.classList.add("hidden");
    taskboardPanel.classList.remove("hidden");
    if (typeof ensureTaskBriefEditor === "function") ensureTaskBriefEditor();
    if (typeof loadFinancingTasks === "function") await loadFinancingTasks();
    return;
  }

  if (isToken) {
    loadingState.classList.add("hidden");
    propertiesList.classList.add("hidden");
    emptyState.classList.add("hidden");
    taskboardPanel.classList.add("hidden");
    tokenPanel.classList.remove("hidden");
    await loadMarketplaceTokenPanel();
    return;
  }

  // Default: Properties view
  tokenPanel.classList.add("hidden");
  taskboardPanel.classList.add("hidden");
  await showMarketplacePropertiesList();
}

function handleMarketplaceTop100Toggle() {
  marketplaceState.top100Only = document.getElementById(
    "marketplace_top100_toggle",
  ).checked;
  showMarketplacePropertiesList();
}

// --- Properties list --------------------------------------------------

async function showMarketplacePropertiesList() {
  document
    .getElementById("marketplace_property_detail")
    .classList.add("hidden");

  setMarketplaceLoading(true);

  try {
    let properties;
    if (marketplaceState.categorySlug) {
      // A specific category is selected.
      properties = await marketplaceGetCategoryProperties(
        marketplaceState.categorySlug,
        marketplaceState.top100Only,
      );
    } else {
      // "All Categories" — show the global ranking.
      properties = await marketplaceGetGlobalProperties(
        marketplaceState.top100Only,
      );
    }
    marketplaceState.properties = properties;

    setMarketplaceLoading(false);

    if (!properties || !properties.length) {
      document
        .getElementById("marketplace_properties_list")
        .classList.add("hidden");
      document
        .getElementById("marketplace_empty_state")
        .classList.remove("hidden");
      return;
    }

    document.getElementById("marketplace_empty_state").classList.add("hidden");
    document
      .getElementById("marketplace_properties_list")
      .classList.remove("hidden");
    renderMarketplacePropertiesList();
  } catch (err) {
    console.error("Failed to load properties:", err);
    setMarketplaceLoading(false);
    showToast("Failed to load marketplace data.", "error");
  }
}

function renderMarketplacePropertiesList() {
  const grid = document.getElementById("marketplace_properties_list");
  grid.innerHTML = marketplaceState.properties
    .map((p) => {
      const rankBadge = p.in_top_100
        ? `<span class="font-label-caps text-[9px] text-primary-fixed-dim uppercase tracking-widest px-2 py-1 rounded bg-primary-fixed-dim/10 border border-primary-fixed-dim/20">#${p.category_rank}</span>`
        : "";
      // Every property gets a visible outline; scored ones additionally
      // carry a left accent so rated bundles stand apart at a glance.
      const rated = Number(p.scarcity_score) > 0 || Number(p.utility_score) > 0;
      const ratedBorder = rated ? "border-l-2 border-l-primary-fixed-dim" : "";
      return `
        <button onclick="showMarketplacePropertyDetail(${p.id})" title="${escapeHtml(p.name || "")}"
          class="glass-panel rounded-xl p-md flex flex-col gap-2 text-left border border-white/10 ${ratedBorder} hover:border-primary-fixed-dim/40 transition-all">
          <div class="flex items-start justify-between gap-2">
            <span class="font-headline-md text-sm text-on-surface truncate">${escapeHtml(p.name || "Untitled")}</span>
            ${rankBadge}
          </div>
          <div class="flex items-center gap-md font-code-sm text-xs text-outline">
            <span>Price: <span class="text-primary-fixed-dim">${Number(p.current_price).toFixed(2)} USDAI</span></span>
            ${p.in_top_100 ? "<span>Top 100</span>" : ""}
          </div>
        </button>`;
    })
    .join("");
}

// --- Property detail ---------------------------------------------------

async function showMarketplacePropertyDetail(propertyId) {
  document
    .getElementById("marketplace_properties_list")
    .classList.add("hidden");
  document.getElementById("marketplace_empty_state").classList.add("hidden");
  setMarketplaceLoading(true);

  try {
    const data = await marketplaceGetProperty(propertyId);
    marketplaceState.property = data;

    setMarketplaceLoading(false);
    document
      .getElementById("marketplace_property_detail")
      .classList.remove("hidden");

    renderMarketplacePropertyDetail();
  } catch (err) {
    console.error("Failed to load property:", err);
    setMarketplaceLoading(false);
    showToast("Failed to load property.", "error");
  }
}

function renderMarketplacePropertyDetail() {
  const {
    property,
    components = [],
    people = [],
    tasks = [],
    peopleCount,
    membershipCount,
    counts = {},
    invitations = [],
    bundleMembers = [],
  } = marketplaceState.property;

  document.getElementById("marketplace_property_name").textContent =
    property.name || "Untitled";
  document.getElementById("marketplace_stat_price").textContent = Number(
    property.current_price,
  ).toFixed(2);
  document.getElementById("marketplace_stat_scarcity").textContent = Number(
    property.scarcity_score,
  ).toFixed(2);
  document.getElementById("marketplace_stat_utility").textContent = Number(
    property.utility_score,
  ).toFixed(2);
  document.getElementById("marketplace_stat_consumption").textContent = Number(
    property.consumption || 0,
  ).toFixed(2);

  const uniquePeople =
    peopleCount ?? new Set(people.map((p) => p.flo_id)).size;
  const activeMemberships = membershipCount ?? people.length;
  document.getElementById("marketplace_people_count").textContent = uniquePeople;
  document.getElementById("marketplace_membership_count").textContent =
    activeMemberships;
  document.getElementById("marketplace_pending_invitations_count").textContent =
    counts.pendingInvitations ?? invitations.length;

  const bundleChip = document.getElementById("marketplace_bundle_chip");
  if (bundleChip) {
    bundleChip.classList.toggle("hidden", !property.is_bundle);
    document.getElementById("marketplace_bundle_count").textContent =
      bundleMembers.length || counts.bundleMembers || 0;
  }

  const inviteForm = document.getElementById("marketplace_invite_form");
  if (inviteForm) inviteForm.classList.add("hidden");
  const inviteLinkWrap = document.getElementById("marketplace_invite_link_wrap");
  if (inviteLinkWrap) inviteLinkWrap.classList.add("hidden");

  const adminScorePanel = document.getElementById("marketplace_admin_score_panel");
  if (adminScorePanel) {
    adminScorePanel.classList.toggle("hidden", !isCurrentUserAdmin);
    document.getElementById("marketplace_admin_score_current").textContent =
      Number(property.admin_score || 0).toFixed(2);
    document.getElementById("marketplace_admin_score_reason").textContent =
      property.admin_score_reason || "No admin reason recorded.";
    document.getElementById("marketplace_admin_score_input").value =
      Number(property.admin_score || 0);
    document.getElementById("marketplace_admin_score_reason_input").value =
      property.admin_score_reason || "";
  }

  const componentsList = document.getElementById("marketplace_components_list");
  if (!components.length) {
    componentsList.innerHTML = `<div class="font-code-sm text-xs text-outline">No components attached yet.</div>`;
  } else {
    componentsList.innerHTML = components
      .map((c) => {
        const removeBtn = isCurrentUserAdmin
          ? `<button onclick="handleMarketplaceRemoveComponent(${c.id})" title="Remove"
               class="text-outline hover:text-error"><span class="material-symbols-outlined text-sm">close</span></button>`
          : "";
        const title = c.metadata?.title || `Track ${c.track_id}`;
        const artist = c.metadata?.artist || "";

        const label = artist
          ? `${c.component_type} — ${title} — ${artist}`
          : `${c.component_type} — ${title}`;

        return `
  <div class="flex items-center justify-between gap-2 font-code-sm text-xs text-on-surface py-1">
    <span>${escapeHtml(label)}</span>
    ${removeBtn}
  </div>`;
      })
      .join("");
  }

  const peopleList = document.getElementById("marketplace_people_list");
  if (!people.length) {
    peopleList.innerHTML = `<div class="font-code-sm text-xs text-outline">Nobody attached yet.</div>`;
  } else {
    peopleList.innerHTML = people
      .map((p) => {
        const removeBtn = isCurrentUserAdmin
          ? `<button onclick="handleMarketplaceRemovePerson('${p.flo_id}', '${p.role || ""}')" title="Remove"
               class="text-outline hover:text-error"><span class="material-symbols-outlined text-sm">close</span></button>`
          : "";
        const roleTag = p.role ? ` (${escapeHtml(p.role)})` : "";
        const partTag = p.part
          ? `<span class="ml-2 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] uppercase tracking-widest text-outline">${escapeHtml(p.part)}</span>`
          : "";
        return `
          <div class="flex items-center justify-between gap-2 font-code-sm text-xs text-on-surface py-1">
            <span>${escapeHtml(p.name || truncateFloId(p.flo_id))}${roleTag} — ${escapeHtml(p.work_profile || "")}${partTag}</span>
            ${removeBtn}
          </div>`;
      })
      .join("");
  }

  const bundlePanel = document.getElementById("marketplace_bundle_members_panel");
  const bundleList = document.getElementById("marketplace_bundle_members_list");
  if (bundlePanel && bundleList) {
    bundlePanel.classList.toggle("hidden", !property.is_bundle);
    document.getElementById("marketplace_bundle_members_count").textContent =
      bundleMembers.length;
    bundleList.innerHTML = bundleMembers.length
      ? bundleMembers
          .map(
            (member) => `
              <div class="flex items-center justify-between gap-2 font-code-sm text-xs text-on-surface py-1">
                <button onclick="showMarketplacePropertyDetail(${member.id})"
                  class="text-left text-primary-fixed-dim hover:underline truncate">
                  ${escapeHtml(member.name || `Property #${member.id}`)}
                </button>
                <span class="text-outline">${Number(member.consumption || 0).toFixed(2)} consumption</span>
              </div>`,
          )
          .join("")
      : `<div class="font-code-sm text-xs text-outline">No bundle members recorded.</div>`;
  }

  renderMarketplaceInvitations(invitations);

  renderMarketplaceFinanceSection(property.id);

  // --- Tasks attached to this property ---
  const tasksList = document.getElementById("marketplace_tasks_list");
  if (tasksList) {
    const propertyTasks = tasks || [];
    if (!propertyTasks.length) {
      tasksList.innerHTML = `<div class="font-code-sm text-xs text-outline">No tasks attached yet.</div>`;
    } else {
      tasksList.innerHTML = propertyTasks
        .map((t) => {
          const removeBtn = isCurrentUserAdmin
            ? `<button onclick="handleMarketplaceRemoveTask(${t.task_id || t.id})" title="Remove task"
                 class="text-outline hover:text-error"><span class="material-symbols-outlined text-sm">close</span></button>`
            : "";
          const briefText = t.brief
            ? (typeof DOMPurify !== "undefined"
              ? DOMPurify.sanitize(t.brief, { ALLOWED_TAGS: [] })
              : t.brief.replace(/<[^>]*>/g, "")
            ).slice(0, 80)
            : `Task #${t.task_id || t.id}`;
          const statusBadge = t.status
            ? `<span class="font-label-caps text-[9px] uppercase tracking-widest px-2 py-0.5 rounded ${t.status === "open"
              ? "bg-primary-fixed-dim/10 text-primary-fixed-dim"
              : t.status === "claimed"
                ? "bg-yellow-400/10 text-yellow-400"
                : "bg-green-400/10 text-green-400"
            }">${escapeHtml(t.status)}</span>`
            : "";
          return `
            <div class="flex items-center justify-between gap-2 font-code-sm text-xs text-on-surface py-1">
              <span class="flex items-center gap-2 truncate">${escapeHtml(briefText)}… ${statusBadge}</span>
              ${removeBtn}
            </div>`;
        })
        .join("");
    }
  }

  // Show usage event add button only for admins
  const usageBtn = document.getElementById("marketplace_show_usage_btn");
  if (usageBtn) {
    usageBtn.classList.toggle("hidden", !isCurrentUserAdmin);
  }

  const usageForm = document.getElementById("marketplace_add_usage_form");
  if (usageForm) usageForm.classList.add("hidden");

  const usageList = document.getElementById("marketplace_usage_list");
  if (usageList) {
    const usageEvents =
      marketplaceState.property?.usageEvents ||
      marketplaceState.property?.usage_events ||
      [];
    if (!usageEvents.length) {
      usageList.innerHTML = `<div class="font-code-sm text-xs text-outline">No usage events logged yet.</div>`;
    } else {
      usageList.innerHTML = usageEvents
        .map((ev) => {
          const type = escapeHtml(ev.usage_type || ev.usageType || "event");
          const desc =
            ev.value_description || ev.valueDescription
              ? ` — ${escapeHtml(ev.value_description || ev.valueDescription)}`
              : "";
          // Add delete button for admins
          const deleteBtn = isCurrentUserAdmin
            ? `<button onclick="handleMarketplaceDeleteUsageEvent(${ev.id})" title="Delete event" class="text-outline hover:text-error"><span class="material-symbols-outlined text-sm">close</span></button>`
            : "";

          return `
      <div class="flex items-center justify-between gap-2 font-code-sm text-xs text-on-surface py-1">
        <span><span class="text-primary-fixed-dim uppercase text-[10px] px-1.5 py-0.5 rounded bg-primary-fixed-dim/10">${type}</span>${desc}</span>
        ${deleteBtn}
      </div>`;
        })
        .join("");
    }
  }
}

function formatMarketplaceInvitationDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function renderMarketplaceInvitations(invitations = []) {
  const list = document.getElementById("marketplace_invitations_list");
  if (!list) return;

  if (!invitations.length) {
    list.innerHTML = `<div class="font-code-sm text-xs text-outline">No pending invitations.</div>`;
    return;
  }

  list.innerHTML = invitations
    .map((invitation) => {
      const revokeBtn = isCurrentUserAdmin
        ? `<button onclick="handleMarketplaceRevokeInvitation(${invitation.id})" title="Revoke"
             class="text-outline hover:text-error"><span class="material-symbols-outlined text-sm">close</span></button>`
        : "";
      const resendBtn =
        isCurrentUserAdmin && invitation.status === "pending"
          ? `<button onclick="handleMarketplaceResendInvitation(${invitation.id})" title="Resend / new link"
               class="text-outline hover:text-primary-fixed-dim"><span class="material-symbols-outlined text-sm">forward_to_inbox</span></button>`
          : "";
      const statusClass =
        invitation.status === "pending"
          ? "bg-yellow-400/10 text-yellow-400"
          : invitation.status === "accepted"
            ? "bg-green-400/10 text-green-400"
            : "bg-white/5 text-outline";
      return `
        <div class="flex items-center justify-between gap-2 font-code-sm text-xs text-on-surface py-1">
          <span class="min-w-0 truncate">
            ${escapeHtml(invitation.invitee_name || truncateFloId(invitation.invitee_flo_id))}
            <span class="text-outline"> · ${escapeHtml(invitation.part || "people")} / ${escapeHtml(invitation.role || "")}</span>
          </span>
          <span class="flex items-center gap-2 shrink-0">
            <span class="font-label-caps text-[9px] uppercase tracking-widest px-2 py-0.5 rounded ${statusClass}">
              ${escapeHtml(invitation.status || "pending")}
            </span>
            <span class="text-outline text-[10px]">${formatMarketplaceInvitationDate(invitation.expires_at)}</span>
            ${resendBtn}
            ${revokeBtn}
          </span>
        </div>`;
    })
    .join("");
}

function toggleMarketplaceInviteForm() {
  const form = document.getElementById("marketplace_invite_form");
  if (!form) return;
  form.classList.toggle("hidden");
}

function handleMarketplaceInvitePartChange() {
  const part = document.getElementById("marketplace_invite_part")?.value;
  const roleInput = document.getElementById("marketplace_invite_role");
  if (!roleInput) return;
  const defaults = {
    people: "contributor",
    creative: "creative",
    finance: "finance",
    marketing: "marketing",
  };
  roleInput.placeholder = defaults[part] || "e.g. lyrics, producer";
}

async function handleMarketplaceCreateInvitation() {
  if (!marketplaceState.property?.property?.id) return;
  const inviteeFloId = document
    .getElementById("marketplace_invite_floid")
    ?.value.trim();
  const part = document.getElementById("marketplace_invite_part")?.value;
  const role = document.getElementById("marketplace_invite_role")?.value.trim();
  const expiresInDays = Number(
    document.getElementById("marketplace_invite_expiry")?.value || 7,
  );

  if (!inviteeFloId) {
    showToast("Enter the invitee's FLO ID.", "error");
    return;
  }

  try {
    const data = await marketplaceCreatePropertyInvitation(
      marketplaceState.property.property.id,
      inviteeFloId,
      part,
      role,
      expiresInDays,
    );
    const token = data.invitation?.token;
    if (token) {
      const url = `${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(token)}`;
      const linkInput = document.getElementById("marketplace_invite_link");
      const linkWrap = document.getElementById("marketplace_invite_link_wrap");
      if (linkInput) linkInput.value = url;
      if (linkWrap) linkWrap.classList.remove("hidden");
    }
    showToast("Invitation created.", "success");
    document.getElementById("marketplace_invite_floid").value = "";
    document.getElementById("marketplace_invite_role").value = "";
    await showMarketplacePropertyDetail(marketplaceState.property.property.id);
    if (token) {
      const linkWrap = document.getElementById("marketplace_invite_link_wrap");
      if (linkWrap) linkWrap.classList.remove("hidden");
    }
  } catch (err) {
    console.error("Failed to create invitation:", err);
    showToast(err.message || "Failed to create invitation.", "error");
  }
}

function copyMarketplaceInviteLink() {
  const value = document.getElementById("marketplace_invite_link")?.value;
  if (!value) return;
  navigator.clipboard
    .writeText(value)
    .then(() => showToast("Invitation link copied.", "success"))
    .catch(() => showToast("Copy failed.", "error"));
}

function shareMarketplaceInviteLink(channel) {
  const link = document.getElementById("marketplace_invite_link")?.value;
  if (!link) return;
  const propertyName =
    marketplaceState.property?.property?.name || "a property";
  const text = `You are invited to join ${propertyName} on Music Marketplace.`;
  const subject = `Invitation to join ${propertyName}`;

  if (channel === "email") {
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${text}\n\n${link}`)}`;
    return;
  }
  if (channel === "sms") {
    window.location.href = `sms:?body=${encodeURIComponent(`${text} ${link}`)}`;
    return;
  }
  if (channel === "native" && navigator.share) {
    navigator
      .share({ title: subject, text, url: link })
      .catch(() => copyMarketplaceInviteLink());
    return;
  }
  copyMarketplaceInviteLink();
}

async function handleMarketplaceResendInvitation(invitationId) {
  if (!marketplaceState.property?.property?.id) return;
  try {
    const data = await marketplaceResendPropertyInvitation(
      marketplaceState.property.property.id,
      invitationId,
      7,
    );
    const token = data.invitation?.token;
    if (token) {
      const url = `${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(token)}`;
      document.getElementById("marketplace_invite_link").value = url;
      document.getElementById("marketplace_invite_link_wrap").classList.remove("hidden");
    }
    showToast("Invitation refreshed — new link ready.", "success");
    await showMarketplacePropertyDetail(marketplaceState.property.property.id);
    if (token) {
      document.getElementById("marketplace_invite_link_wrap").classList.remove("hidden");
    }
  } catch (err) {
    console.error("Failed to resend invitation:", err);
    showToast(err.message || "Failed to resend invitation.", "error");
  }
}

async function handleMarketplaceRevokeInvitation(invitationId) {
  if (!marketplaceState.property?.property?.id) return;
  try {
    await marketplaceRevokePropertyInvitation(
      marketplaceState.property.property.id,
      invitationId,
    );
    showToast("Invitation revoked.", "success");
    await showMarketplacePropertyDetail(marketplaceState.property.property.id);
  } catch (err) {
    console.error("Failed to revoke invitation:", err);
    showToast(err.message || "Failed to revoke invitation.", "error");
  }
}

async function handleMarketplaceSaveAdminScore() {
  if (!marketplaceState.property?.property?.id) return;
  const score = document.getElementById("marketplace_admin_score_input")?.value;
  const reason = document
    .getElementById("marketplace_admin_score_reason_input")
    ?.value.trim();

  if (score === "" || !Number.isFinite(Number(score))) {
    showToast("Enter a numeric admin score.", "error");
    return;
  }

  try {
    await marketplaceSetAdminScore(
      marketplaceState.property.property.id,
      Number(score),
      reason,
    );
    showToast("Admin score saved.", "success");
    await showMarketplacePropertyDetail(marketplaceState.property.property.id);
  } catch (err) {
    console.error("Failed to save admin score:", err);
    showToast(err.message || "Failed to save admin score.", "error");
  }
}

// --- Invitation link modal ---------------------------------

let marketplaceInviteToken = null;

async function openMarketplaceInvitation(token) {
  marketplaceInviteToken = token;
  const modal = document.getElementById("marketplace_invite_modal");
  const status = document.getElementById("marketplace_invite_modal_status");
  const details = document.getElementById("marketplace_invite_modal_details");
  const actions = document.getElementById("marketplace_invite_modal_actions");
  if (!modal || !status || !details || !actions) return;

  modal.classList.remove("hidden");
  status.textContent = "Loading invitation…";
  details.innerHTML = "";
  actions.classList.add("hidden");
  const acceptBtn = document.getElementById("marketplace_invite_accept_btn");
  const declineBtn = document.getElementById("marketplace_invite_decline_btn");
  if (acceptBtn) acceptBtn.disabled = false;
  if (declineBtn) declineBtn.disabled = false;

  try {
    const data = await marketplaceGetInvitation(token);
    const invitation = data.invitation;
    status.textContent =
      data.canAccept
        ? "You have been invited to join this property."
        : `This invitation is ${invitation.status}.`;
    details.innerHTML = `
      <div class="font-code-sm text-sm text-on-surface">${escapeHtml(invitation.property_name || `Property #${invitation.property_id}`)}</div>
      <div class="font-code-sm text-xs text-outline">Part: ${escapeHtml(invitation.part || "people")} · Role: ${escapeHtml(invitation.role || "")}</div>
      <div class="font-code-sm text-xs text-outline">Invited by: ${escapeHtml(invitation.inviter_flo_id || "—")}</div>
      <div class="font-code-sm text-xs text-outline">Expires: ${formatMarketplaceInvitationDate(invitation.expires_at)}</div>`;
    actions.classList.toggle("hidden", !data.canAccept);
  } catch (err) {
    console.error("Failed to load invitation:", err);
    status.textContent = err.message || "Invitation not found.";
  }
}

function closeMarketplaceInvitation() {
  const modal = document.getElementById("marketplace_invite_modal");
  if (modal) modal.classList.add("hidden");
  marketplaceInviteToken = null;
  const url = new URL(window.location.href);
  if (url.searchParams.has("invite")) {
    url.searchParams.delete("invite");
    window.history.replaceState({}, "", url.toString());
  }
}

async function handleMarketplaceAcceptInvitation() {
  if (!marketplaceInviteToken) return;
  const acceptBtn = document.getElementById("marketplace_invite_accept_btn");
  const declineBtn = document.getElementById("marketplace_invite_decline_btn");
  const status = document.getElementById("marketplace_invite_modal_status");
  if (acceptBtn) acceptBtn.disabled = true;
  if (declineBtn) declineBtn.disabled = true;

  try {
    await marketplaceAcceptInvitation(marketplaceInviteToken);
    if (status) status.textContent = "Invitation accepted. You are now a member.";
    showToast("Invitation accepted.", "success");
    refreshNotificationBadge();
    setTimeout(closeMarketplaceInvitation, 1200);
  } catch (err) {
    console.error("Failed to accept invitation:", err);
    if (status) status.textContent = err.message || "Failed to accept invitation.";
    if (acceptBtn) acceptBtn.disabled = false;
    if (declineBtn) declineBtn.disabled = false;
  }
}

async function handleMarketplaceDeclineInvitation() {
  if (!marketplaceInviteToken) return;
  const acceptBtn = document.getElementById("marketplace_invite_accept_btn");
  const declineBtn = document.getElementById("marketplace_invite_decline_btn");
  const status = document.getElementById("marketplace_invite_modal_status");
  if (acceptBtn) acceptBtn.disabled = true;
  if (declineBtn) declineBtn.disabled = true;

  try {
    await marketplaceDeclineInvitation(marketplaceInviteToken);
    if (status) status.textContent = "Invitation declined.";
    showToast("Invitation declined.", "success");
    refreshNotificationBadge();
    setTimeout(closeMarketplaceInvitation, 1200);
  } catch (err) {
    console.error("Failed to decline invitation:", err);
    if (status) status.textContent = err.message || "Failed to decline invitation.";
    if (acceptBtn) acceptBtn.disabled = false;
    if (declineBtn) declineBtn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const token = new URLSearchParams(window.location.search).get("invite");
  if (token) openMarketplaceInvitation(token);

  setTimeout(refreshNotificationBadge, 2500);
  setTimeout(refreshNotificationBadge, 7000);
  setTimeout(startNotificationPolling, 8000);

  document.addEventListener("click", (event) => {
    const panel = document.getElementById("notification_panel");
    if (!panel || panel.classList.contains("hidden")) return;
    if (
      panel.contains(event.target) ||
      event.target.closest("#notification_btn")
    ) {
      return;
    }
    panel.classList.add("hidden");
  });
});

function formatMarketplaceFinanceComponentType(componentType) {
  const labels = {
    budget: "Budget",
    royalty_split: "Royalty Split",
    financial_plan: "Financial Plan",
    financial_task: "Financial Task",
  };
  return labels[componentType] || componentType || "Component";
}

function formatMarketplaceFinancePercent(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "0%";
  const percent =
    numericValue <= 1 && numericValue >= 0 ? numericValue * 100 : numericValue;
  return `${percent.toFixed(percent >= 10 ? 1 : 2)}%`;
}

function toggleMarketplaceAddFinanceForm() {
  const form = document.getElementById("marketplace_add_finance_form");
  if (!form) return;
  form.classList.toggle("hidden");
  if (!form.classList.contains("hidden")) {
    toggleMarketplaceFinanceComponentFields();
    if (
      !document.querySelector(
        "#marketplace_royalty_split_rows [data-royalty-split-row]",
      )
    ) {
      addMarketplaceRoyaltySplitRow();
    }
  }
}

function toggleMarketplaceFinanceComponentFields() {
  const typeInput = document.getElementById(
    "marketplace_finance_component_type",
  );
  const royaltyWrap = document.getElementById("marketplace_royalty_split_wrap");
  if (!typeInput || !royaltyWrap) return;

  const isRoyaltySplit = typeInput.value === "royalty_split";
  royaltyWrap.classList.toggle("hidden", !isRoyaltySplit);
  if (
    isRoyaltySplit &&
    !document.querySelector(
      "#marketplace_royalty_split_rows [data-royalty-split-row]",
    )
  ) {
    addMarketplaceRoyaltySplitRow();
  }
}

function addMarketplaceRoyaltySplitRow() {
  const rows = document.getElementById("marketplace_royalty_split_rows");
  if (!rows) return;

  rows.insertAdjacentHTML(
    "beforeend",
    `
      <div class="royalty-split-row grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_96px_auto] gap-sm items-end" data-royalty-split-row>
        <div>
          <label class="font-label-caps text-xs text-outline tracking-wider block mb-2">Recipient FLO ID</label>
          <input type="text" data-royalty-recipient
            class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-code-sm focus:outline-none focus:border-primary-fixed-dim"
            placeholder="FLO ID or recipient label" />
        </div>
        <div>
          <label class="font-label-caps text-xs text-outline tracking-wider block mb-2">Share %</label>
          <input type="number" min="0" max="100" step="any" data-royalty-share
            class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-code-sm focus:outline-none focus:border-primary-fixed-dim"
            placeholder="25" />
        </div>
        <button type="button" onclick="removeMarketplaceRoyaltySplitRow(this)"
          class="w-full sm:w-auto shrink-0 px-md py-3 rounded-lg border border-white/10 text-outline font-label-caps text-[10px] tracking-widest uppercase hover:bg-white/5 transition-all">
          Remove
        </button>
      </div>
    `,
  );
}

function removeMarketplaceRoyaltySplitRow(button) {
  const row = button.closest("[data-royalty-split-row]");
  const rows = document.querySelectorAll(
    "#marketplace_royalty_split_rows [data-royalty-split-row]",
  );
  if (!row) return;

  if (rows.length > 1) {
    row.remove();
    return;
  }

  row.querySelectorAll("input").forEach((input) => {
    input.value = "";
  });
}

function collectMarketplaceRoyaltySplits() {
  const rows = document.querySelectorAll(
    "#marketplace_royalty_split_rows [data-royalty-split-row]",
  );
  return Array.from(rows)
    .map((row) => {
      const recipient = row
        .querySelector("[data-royalty-recipient]")
        ?.value.trim();
      const sharePct = row.querySelector("[data-royalty-share]")?.value.trim();
      if (!recipient && !sharePct) return null;
      const share = Number(sharePct);
      if (!recipient || !Number.isFinite(share) || share < 0 || share > 100)
        return null;
      return {
        recipient_flo_id: recipient,
        share_percentage: share,
      };
    })
    .filter(Boolean);
}

function renderMarketplaceFinanceSection(propertyId) {
  const componentsList = document.getElementById(
    "marketplace_finance_components_list",
  );
  const allocationsList = document.getElementById(
    "marketplace_finance_allocations_list",
  );
  if (!componentsList || !allocationsList) return;

  componentsList.innerHTML = `<div class="font-code-sm text-xs text-outline">Loading finance components...</div>`;
  allocationsList.innerHTML = `<div class="font-code-sm text-xs text-outline">Loading algorithmic allocation...</div>`;

  Promise.all([
    marketplaceGetFinanceComponents(propertyId),
    marketplaceGetFinanceAllocations(propertyId),
  ])
    .then(([componentsData, allocationsData]) => {
      const components =
        componentsData.financeComponents || componentsData.components || [];
      const allocations =
        allocationsData.allocations || allocationsData.financeAllocations || [];

      if (!components.length) {
        componentsList.innerHTML = `<div class="font-code-sm text-xs text-outline">No finance components yet.</div>`;
      } else {
        componentsList.innerHTML = components
          .map((component) => {
            const componentId = component.id ?? component.component_id;
            const componentType =
              component.componentType || component.component_type;
            const title =
              component.title ||
              formatMarketplaceFinanceComponentType(componentType);
            const amount =
              component.amount != null && component.amount !== ""
                ? `${Number(component.amount).toFixed(2)} ${escapeHtml(component.currency || "USDAI")}`
                : "Unpriced";
            const description = component.description
              ? `<p class="font-code-sm text-[11px] text-outline">${escapeHtml(component.description)}</p>`
              : "";
            const terms = component.terms
              ? `<p class="font-code-sm text-[11px] text-outline">${escapeHtml(component.terms)}</p>`
              : "";
            const splits =
              component.royaltySplits || component.royalty_splits || [];
            const splitHtml = splits.length
              ? `<div class="flex flex-wrap gap-2 pt-2">${splits
                .map((split) => {
                  const recipient =
                    split.recipientFloId ||
                    split.recipient_flo_id ||
                    split.recipient ||
                    "Unknown";
                  const share =
                    split.share_percentage ??
                    split.sharePct ??
                    split.share_pct ??
                    split.share;
                  return `<span class="px-2 py-1 rounded bg-white/5 border border-white/10 font-code-sm text-[11px] text-outline">${escapeHtml(recipient)} · ${formatMarketplaceFinancePercent(share)}</span>`;
                })
                .join("")}</div>`
              : "";
            const deleteBtn =
              isCurrentUserAdmin && componentId != null
                ? `<button onclick="handleMarketplaceDeleteFinanceComponent(${propertyId}, ${JSON.stringify(componentId)})" title="Delete finance component" class="text-outline hover:text-error"><span class="material-symbols-outlined text-sm">close</span></button>`
                : "";

            return `
              <div class="flex items-start justify-between gap-3 py-2 border-b border-white/5 last:border-b-0">
                <div class="min-w-0 space-y-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-label-caps text-[9px] uppercase tracking-widest px-2 py-1 rounded bg-primary-fixed-dim/10 border border-primary-fixed-dim/20 text-primary-fixed-dim">${escapeHtml(formatMarketplaceFinanceComponentType(componentType))}</span>
                    <span class="font-code-sm text-xs text-on-surface truncate">${escapeHtml(title)}</span>
                    <span class="font-code-sm text-[11px] text-primary-fixed-dim">${escapeHtml(amount)}</span>
                  </div>
                  ${description}
                  ${terms}
                  ${splitHtml}
                </div>
                ${deleteBtn}
              </div>`;
          })
          .join("");
      }

      if (!allocations.length) {
        allocationsList.innerHTML = `<div class="font-code-sm text-xs text-outline">No algorithmic allocations available.</div>`;
      } else {
        allocationsList.innerHTML = allocations
          .map((allocation) => {
            const label =
              allocation.label ||
              allocation.name ||
              allocation.component_title ||
              formatMarketplaceFinanceComponentType(
                allocation.component_type || allocation.componentType,
              );
            const percentage =
              allocation.percentage ??
              allocation.allocation_pct ??
              allocation.share_pct ??
              allocation.sharePct;
            return `
              <div class="flex items-center justify-between gap-2 font-code-sm text-xs text-on-surface py-1">
                <span class="truncate">${escapeHtml(String(label))}</span>
                <span class="text-primary-fixed-dim">${formatMarketplaceFinancePercent(percentage)}</span>
              </div>`;
          })
          .join("");
      }
    })
    .catch((err) => {
      console.error("Failed to load finance section:", err);
      componentsList.innerHTML = `<div class="font-code-sm text-xs text-outline">Failed to load finance components.</div>`;
      allocationsList.innerHTML = `<div class="font-code-sm text-xs text-outline">Failed to load allocations.</div>`;
    });
}

async function handleMarketplaceAddFinanceComponent() {
  if (!marketplaceState.property?.property?.id) {
    showToast("Open a property first.", "warning");
    return;
  }

  const propertyId = marketplaceState.property.property.id;
  const typeInput = document.getElementById(
    "marketplace_finance_component_type",
  );
  const titleInput = document.getElementById("marketplace_finance_title");
  const descriptionInput = document.getElementById(
    "marketplace_finance_description",
  );
  const amountInput = document.getElementById("marketplace_finance_amount");
  const currencyInput = document.getElementById("marketplace_finance_currency");
  const termsInput = document.getElementById("marketplace_finance_terms");

  const componentType = typeInput?.value;
  const title = titleInput?.value.trim();
  const description = descriptionInput?.value.trim();
  const amountValue = amountInput?.value.trim();
  const currency = currencyInput?.value.trim();
  const terms = termsInput?.value.trim();

  if (!componentType) {
    showToast("Choose a finance component type.", "warning");
    return;
  }
  if (!title) {
    showToast("Enter a title for the finance component.", "warning");
    return;
  }

  const amount = amountValue ? Number(amountValue) : undefined;
  if (amountValue && (!Number.isFinite(amount) || amount < 0)) {
    showToast("Enter a valid amount.", "warning");
    return;
  }

  const royaltySplits =
    componentType === "royalty_split"
      ? collectMarketplaceRoyaltySplits()
      : undefined;
  if (componentType === "royalty_split" && !royaltySplits.length) {
    showToast("Add at least one royalty split row.", "warning");
    return;
  }

  try {
    await marketplaceCreateFinanceComponent(
      propertyId,
      componentType,
      title,
      description || undefined,
      amount,
      currency || undefined,
      terms || undefined,
      royaltySplits,
    );

    showToast("Finance component created.", "success");
    titleInput.value = "";
    if (descriptionInput) descriptionInput.value = "";
    if (amountInput) amountInput.value = "";
    if (currencyInput) currencyInput.value = "USDAI";
    if (termsInput) termsInput.value = "";
    if (typeInput) typeInput.value = "budget";
    const rows = document.getElementById("marketplace_royalty_split_rows");
    if (rows) rows.innerHTML = "";
    toggleMarketplaceFinanceComponentFields();
    document
      .getElementById("marketplace_add_finance_form")
      ?.classList.add("hidden");
    await renderMarketplaceFinanceSection(propertyId);
  } catch (err) {
    console.error("Failed to create finance component:", err);
    showToast(err.message || "Failed to create finance component.", "error");
  }
}

async function handleMarketplaceDeleteFinanceComponent(
  propertyId,
  componentId,
) {
  if (!confirm("Delete this finance component?")) return;

  try {
    await marketplaceDeleteFinanceComponent(propertyId, componentId);
    showToast("Finance component deleted.", "success");
    await renderMarketplaceFinanceSection(propertyId);
  } catch (err) {
    console.error("Failed to delete finance component:", err);
    showToast(err.message || "Failed to delete finance component.", "error");
  }
}

// --- Usage events (admin) ---------------------------------------------

function toggleMarketplaceUsageForm() {
  document
    .getElementById("marketplace_add_usage_form")
    ?.classList.toggle("hidden");
}

async function handleMarketplaceLogUsage() {
  const type = document.getElementById("marketplace_usage_type")?.value;
  const desc = document.getElementById("marketplace_usage_desc")?.value?.trim();

  if (!type) {
    showToast("Select a usage type.", "warning");
    return;
  }

  if (!marketplaceState.property?.property?.id) {
    showToast("Open a property first.", "warning");
    return;
  }

  try {
    await marketplaceLogUsageEvent(
      marketplaceState.property.property.id,
      type,
      { valueDescription: desc || undefined },
    );
    showToast("Usage event logged", "success");
    const descInput = document.getElementById("marketplace_usage_desc");
    if (descInput) descInput.value = "";
    document
      .getElementById("marketplace_add_usage_form")
      ?.classList.add("hidden");
    await showMarketplacePropertyDetail(marketplaceState.property.property.id);
  } catch (err) {
    console.error("Failed to log usage event:", err);
    showToast(err.message || "Failed to log usage event.", "error");
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// --- Category management (admin) ---------------------------------------

function toggleMarketplaceAddCategoryForm() {
  document
    .getElementById("marketplace_add_category_form")
    .classList.toggle("hidden");
}

async function handleMarketplaceAddCategory() {
  const slugInput = document.getElementById("marketplace_new_category_slug");
  const nameInput = document.getElementById("marketplace_new_category_name");

  const slug = slugInput.value.trim();
  const name = nameInput.value.trim();

  if (!slug || !name) {
    showToast("Enter both a slug and a name.", "warning");
    return;
  }

  try {
    await marketplaceCreateCategory(slug, name);
    showToast("Category added.", "success");
    slugInput.value = "";
    nameInput.value = "";
    document
      .getElementById("marketplace_add_category_form")
      .classList.add("hidden");
    await loadMarketplaceCategories();
  } catch (err) {
    console.error("Failed to add category:", err);
    showToast(err.message || "Failed to add category.", "error");
  }
}

// --- Property management (admin) ----------------------------------------

function toggleMarketplaceAddPropertyForm() {
  document
    .getElementById("marketplace_add_property_form")
    .classList.toggle("hidden");
}

async function handleMarketplaceAddProperty() {
  const nameInput = document.getElementById("marketplace_new_property_name");
  const name = nameInput.value.trim();

  if (!name) {
    showToast("Enter a name for the property.", "warning");
    return;
  }
  if (!marketplaceState.categorySlug) {
    showToast("Select a category first.", "warning");
    return;
  }

  try {
    await marketplaceCreateProperty(marketplaceState.categorySlug, name);
    showToast("Property created.", "success");
    nameInput.value = "";
    document
      .getElementById("marketplace_add_property_form")
      .classList.add("hidden");
    await showMarketplacePropertiesList();
  } catch (err) {
    console.error("Failed to create property:", err);
    showToast(err.message || "Failed to create property.", "error");
  }
}

// --- Component attach (admin) -------------------------------------------

function toggleMarketplaceAttachComponentForm() {
  const form = document.getElementById("marketplace_attach_component_form");
  form.classList.toggle("hidden");
  if (!form.classList.contains("hidden")) loadMarketplaceComponentChoices();
}

async function loadMarketplaceComponentChoices() {
  const select = document.getElementById("marketplace_attach_component_choice");
  const componentType = document.getElementById(
    "marketplace_attach_component_type",
  ).value;
  select.innerHTML = `<option value="">Loading...</option>`;

  try {
    const propertyCategoryId = marketplaceState.property.property.category_id;
    const category = marketplaceState.categories.find(
      (c) => Number(c.id) === Number(propertyCategoryId),
    );

    if (!category) {
      throw new Error("Property category not found");
    }

    const components = await marketplaceGetCategoryComponents(
      category.slug,
      componentType,
    );
    if (!components.length) {
      select.innerHTML = `<option value="">No ${componentType} components in this category</option>`;
      return;
    }
    select.innerHTML = components
      .map((c) => {
        const title = c.metadata?.title || `Track ${c.track_id}`;
        const artist = c.metadata?.artist;

        const label = artist ? `${title} — ${artist}` : title;

        return `<option value="${c.component_id}">
      ${escapeHtml(String(label))} (score ${c.score})
    </option>`;
      })
      .join("");
  } catch (err) {
    console.error("Failed to load components:", err);
    select.innerHTML = `<option value="">Failed to load</option>`;
  }
}

async function handleMarketplaceAttachComponent() {
  const select = document.getElementById("marketplace_attach_component_choice");
  const componentId = select.value;
  if (!componentId) {
    showToast("Pick a component to attach.", "warning");
    return;
  }

  try {
    await marketplaceAttachComponent(
      marketplaceState.property.property.id,
      componentId,
    );
    showToast("Component attached.", "success");
    await showMarketplacePropertyDetail(marketplaceState.property.property.id);
  } catch (err) {
    console.error("Failed to attach component:", err);
    showToast(err.message || "Failed to attach component.", "error");
  }
}

async function handleMarketplaceRemoveComponent(componentId) {
  try {
    await marketplaceRemoveComponent(
      marketplaceState.property.property.id,
      componentId,
    );
    showToast("Component removed.", "success");
    await showMarketplacePropertyDetail(marketplaceState.property.property.id);
  } catch (err) {
    console.error("Failed to remove component:", err);
    showToast(err.message || "Failed to remove component.", "error");
  }
}

// --- Task attach (admin) -----------------------------------------------

function toggleMarketplaceAttachTaskForm() {
  const form = document.getElementById("marketplace_attach_task_form");
  form.classList.toggle("hidden");
  if (!form.classList.contains("hidden")) loadMarketplaceTaskChoices();
}

async function loadMarketplaceTaskChoices() {
  const select = document.getElementById("marketplace_attach_task_id");
  select.innerHTML = `<option value="">Loading tasks...</option>`;

  try {
    const tasks = await marketplaceGetAllTasks();
    if (!tasks.length) {
      select.innerHTML = `<option value="">No tasks available — create one in Financing first</option>`;
      return;
    }
    select.innerHTML =
      `<option value="">Select a task</option>` +
      tasks
        .map((t) => {
          const label = t.brief
            ? (typeof DOMPurify !== "undefined"
              ? DOMPurify.sanitize(t.brief, { ALLOWED_TAGS: [] })
              : t.brief.replace(/<[^>]*>/g, "")
            ).slice(0, 60)
            : `Task #${t.id}`;
          return `<option value="${t.id}">#${t.id} — ${escapeHtml(label)}… (${t.status || "open"})</option>`;
        })
        .join("");
  } catch (err) {
    console.error("Failed to load tasks:", err);
    select.innerHTML = `<option value="">Failed to load tasks</option>`;
  }
}

async function handleMarketplaceAttachTask() {
  const taskIdInput = document.getElementById("marketplace_attach_task_id");
  const taskId = Number(taskIdInput.value);

  if (!taskId) {
    showToast("Select a task.", "warning");
    return;
  }

  try {
    await marketplaceAttachTask(marketplaceState.property.property.id, taskId);
    showToast("Task attached.", "success");
    taskIdInput.value = "";
    document
      .getElementById("marketplace_attach_task_form")
      .classList.add("hidden");
    await showMarketplacePropertyDetail(marketplaceState.property.property.id);
  } catch (err) {
    console.error("Failed to attach task:", err);
    showToast(err.message || "Failed to attach task.", "error");
  }
}

async function handleMarketplaceRemoveTask(taskId) {
  try {
    await marketplaceRemoveTask(marketplaceState.property.property.id, taskId);
    showToast("Task removed.", "success");
    await showMarketplacePropertyDetail(marketplaceState.property.property.id);
  } catch (err) {
    console.error("Failed to remove task:", err);
    showToast(err.message || "Failed to remove task.", "error");
  }
}

// --- People attach (admin) + self-registration --------------------------

function toggleMarketplaceAttachPersonForm() {
  document
    .getElementById("marketplace_attach_person_form")
    .classList.toggle("hidden");
}

async function handleMarketplaceAttachPerson() {
  const floIdInput = document.getElementById("marketplace_attach_person_floid");
  const roleInput = document.getElementById("marketplace_attach_person_role");

  const personFloId = floIdInput.value.trim();
  const role = roleInput.value.trim();

  if (!personFloId) {
    showToast("Enter the person's FLO ID.", "warning");
    return;
  }

  try {
    await marketplaceAttachPerson(
      marketplaceState.property.property.id,
      personFloId,
      role,
    );
    showToast("Person attached.", "success");
    floIdInput.value = "";
    roleInput.value = "";
    await showMarketplacePropertyDetail(marketplaceState.property.property.id);
  } catch (err) {
    console.error("Failed to attach person:", err);
    showToast(err.message || "Failed to attach person.", "error");
  }
}

async function handleMarketplaceRemovePerson(personFloId, role) {
  try {
    await marketplaceRemovePerson(
      marketplaceState.property.property.id,
      personFloId,
      role,
    );
    showToast("Person removed.", "success");
    await showMarketplacePropertyDetail(marketplaceState.property.property.id);
  } catch (err) {
    console.error("Failed to remove person:", err);
    showToast(err.message || "Failed to remove person.", "error");
  }
}

function toggleMarketplaceRegisterPersonForm() {
  document
    .getElementById("marketplace_register_person_form")
    .classList.toggle("hidden");
}

async function handleMarketplaceRegisterPerson() {
  const workProfile = document
    .getElementById("marketplace_register_work_profile")
    .value.trim();
  const experience = document
    .getElementById("marketplace_register_experience")
    .value.trim();
  const name = document
    .getElementById("marketplace_register_name")
    .value.trim();
  const cvUrl = document
    .getElementById("marketplace_register_cv_url")
    .value.trim();

  if (!workProfile) {
    showToast("Work profile is required.", "warning");
    return;
  }

  try {
    await marketplaceRegisterPerson(
      workProfile,
      experience || undefined,
      name || undefined,
      cvUrl || undefined,
    );
    showToast("Profile saved.", "success");
    document
      .getElementById("marketplace_register_person_form")
      .classList.add("hidden");
  } catch (err) {
    console.error("Failed to save profile:", err);
    showToast(err.message || "Failed to save profile.", "error");
  }
}

// --- Main Token panel -----------------------------------------------------

function truncateFloId(floId) {
  if (!floId) return "";
  return `${floId.slice(0, 6)}…${floId.slice(-4)}`;
}

// Loads the token price/supply, the USDAI payment address, and the signed-in
// user's portfolio. Safe to call repeatedly.
async function loadMarketplaceTokenPanel() {
  try {
    const data = await marketplaceGetTokenPrice();
    marketplaceState.tokenPrice = Number(data.tokenPrice);
    marketplaceState.systemValuation = Number(data.systemValuation);
    marketplaceState.tokenSupply = Number(data.totalSupply);

    document.getElementById("marketplace_token_price").textContent =
      marketplaceState.tokenPrice.toFixed(6) + " USDAI";
    document.getElementById("marketplace_token_supply").textContent =
      marketplaceState.tokenSupply.toLocaleString(undefined, {
        maximumFractionDigits: 6,
      });
    document.getElementById("marketplace_token_valuation").textContent =
      marketplaceState.systemValuation.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      }) + " USDAI";
  } catch (err) {
    console.error("Failed to load token price:", err);
  }

  try {
    if (!marketplaceState.usdaiPaymentAddress) {
      marketplaceState.usdaiPaymentAddress =
        await marketplaceGetUsdaiPaymentAddress();
    }
    document.getElementById("marketplace_usdai_address").textContent =
      marketplaceState.usdaiPaymentAddress;
  } catch (err) {
    console.error("Failed to load USDAI payment address:", err);
    document.getElementById("marketplace_usdai_address").textContent =
      "unavailable";
  }

  const minEl = document.getElementById("marketplace_min_buy");
  if (minEl) minEl.textContent = MIN_MAIN_TOKEN_BUY_USDAI;

  await refreshMarketplacePortfolio();
  await loadMarketplaceSellQueueStats();
}

// --- Sell-queue transparency -------------------------------------------

function formatAgeSince(dateish) {
  if (!dateish) return "–";
  const ms = Date.now() - new Date(dateish).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "–";
  const hours = ms / 3600000;
  if (hours < 1) return "<1h";
  if (hours < 48) return `${Math.floor(hours)}h`;
  return `${Math.floor(hours / 24)}d`;
}

async function loadMarketplaceSellQueueStats() {
  const wrap = document.getElementById("marketplace_sell_queue_stats");
  if (!wrap) return;
  wrap.classList.remove("hidden");

  try {
    const stats = await marketplaceGetSellQueueStats();

    if (!stats.liquidityBuilt) {
      document.getElementById("sellq_pending").textContent = String(
        stats.pendingCount,
      );
      document.getElementById("sellq_value").textContent = Number(stats.outstandingUsdai).toFixed(2) + " USDAI";
      document.getElementById("sellq_oldest").textContent = formatAgeSince(
        stats.oldestRequestedAt,
      );
      document.getElementById("sellq_rate").textContent = "0%";
      document.getElementById("sellq_bar").style.width = "0%";
      document.getElementById("sellq_note").textContent =
        `Payouts start once platform liquidity reaches 10,000 USDAI. Requests expire after ${Number(stats.sellQueuePeriodDays || 7)} days (${Number(stats.expiredCount || 0)} expired).`;
      return;
    }

    const releaseFraction = Number(stats.releaseFraction);
    const ratePct = (releaseFraction * 100).toFixed(0);

    document.getElementById("sellq_pending").textContent = String(
      stats.pendingCount,
    );
    document.getElementById("sellq_value").textContent =
      `${Number(stats.outstandingUsdai).toFixed(2)} USDAI`;
    document.getElementById("sellq_oldest").textContent = formatAgeSince(
      stats.oldestRequestedAt,
    );
    document.getElementById("sellq_rate").textContent =
      `${ratePct}% of inflows`;
    document.getElementById("sellq_bar").style.width =
      `${(releaseFraction * 100).toFixed(1)}%`;
    document.getElementById("sellq_note").textContent =
      (Number(stats.pressureRatio7d) >= 1
        ? `Buys outnumbered sells ${Number(stats.pressureRatio7d).toFixed(1)}x over the last ${Number(stats.pressureWindowDays || 7)} days - the pool pays out ${ratePct}% of incoming funds to sellers each run.`
        : `Selling pressure is high right now - payout rate is reduced until buying picks up.`) +
      ` Requests expire after ${Number(stats.sellQueuePeriodDays || 7)} days (${Number(stats.expiredCount || 0)} expired).`;
  } catch (err) {
    console.error("Failed to load sell-queue stats:", err);
    document.getElementById("sellq_note").textContent =
      "Queue metrics unavailable right now.";
  }
}

async function refreshMarketplacePortfolio() {
  const balanceEl = document.getElementById("marketplace_token_balance");
  const listEl = document.getElementById("marketplace_portfolio_list");

  if (!floGlobals.myFloID) {
    balanceEl.textContent = "--";
    listEl.innerHTML = `<div class="font-code-sm text-xs text-outline">Sign in to see your holdings.</div>`;
    return;
  }

  try {
    const data = await marketplaceGetPortfolio(floGlobals.myFloID);
    balanceEl.textContent = Number(data.balance).toLocaleString(undefined, {
      maximumFractionDigits: 6,
    });

    const positions = data.positions || [];
    if (!positions.length) {
      listEl.innerHTML = `<div class="font-code-sm text-xs text-outline">No positions yet — your tokens will spread across the Top 100 once properties qualify.</div>`;
      return;
    }
    listEl.innerHTML = positions
      .map(
        (pos) => `
          <div class="flex items-center justify-between gap-2 font-code-sm text-xs text-on-surface py-1">
            <span class="truncate">${escapeHtml(pos.property_name || `Property #${pos.property_id}`)}</span>
            <span class="text-primary-fixed-dim whitespace-nowrap">${Number(pos.token_amount).toFixed(6)} (${(Number(pos.allocation_pct) * 100).toFixed(2)}%)</span>
          </div>`,
      )
      .join("");
  } catch (err) {
    console.error("Failed to load portfolio:", err);
    listEl.innerHTML = `<div class="font-code-sm text-xs text-outline">Failed to load holdings.</div>`;
  }
}

function setMarketplaceBuyStatus(message) {
  const el = document.getElementById("marketplace_token_buy_result");
  if (!message) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.classList.remove("hidden");
  el.textContent = message;
}

// Shows a simple success or fail popup after you try to buy
function showMarketplaceTransactionResult(success, txid, options = {}) {
  const esc =
    typeof escapeHtml === "function"
      ? escapeHtml
      : (s) => {
        const d = document.createElement("div");
        d.textContent = s == null ? "" : String(s);
        return d.innerHTML;
      };
  const title =
    options.title ||
    (success ? "Transaction request sent" : "Transaction failed");
  const description =
    options.description ||
    (success
      ? "This might take up to 30 mins to complete and reflect on blockchain."
      : String(txid || "Unknown error"));
  const container = document.getElementById("marketplace_tx_result");
  const popup = document.getElementById("marketplace_tx_result_popup");
  if (!container || !popup) return;

  const explorerUrl =
    txid && success ? `https://blockbook.ranchimall.net/tx/${txid}` : "";
  const successIcon = `<svg class="icon icon--success" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M0 0h24v24H0z" fill="none"/><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>`;
  const failIcon = `<svg class="icon icon--failed" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
  const safeTxid = txid ? esc(txid) : "";

  container.innerHTML = `
    ${success ? successIcon : failIcon}
    <h3>${esc(title)}</h3>
    <p class="font-code-sm text-sm text-outline max-w-[32ch]">${esc(description)}</p>
    ${success && txid
      ? `
      <div class="grid gap-3 w-full">
        <a id="marketplace_tx_link" href="${explorerUrl}" target="_blank" rel="noopener"
           class="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-primary-fixed-dim bg-primary-fixed-dim/10 text-primary-fixed-dim font-label-caps text-[10px] tracking-widest uppercase hover:bg-primary-fixed-dim hover:text-on-primary-fixed transition-colors">
          See transaction on blockchain
          <span class="material-symbols-outlined text-base">open_in_new</span>
        </a>
        <div class="grid gap-1 justify-items-center">
          <span class="font-label-caps text-[9px] text-outline uppercase tracking-widest">Transaction ID</span>
          <button onclick="navigator.clipboard.writeText('${(txid || "").replace(/'/g, "\\'")}').then(()=>showToast('Transaction ID copied','success')).catch(()=>showToast('Copy failed','error'))"
                  class="font-code-sm text-[11px] text-primary-fixed-dim break-all hover:underline max-w-full px-2">${safeTxid}</button>
        </div>
        ${options.extraHtml || ""}
      </div>
    `
      : ""
    }
  `;
  popup.classList.remove("hidden");
}

function closeMarketplaceTxResult() {
  const popup = document.getElementById("marketplace_tx_result_popup");
  if (popup) popup.classList.add("hidden");
}

function showMarketplaceBuyLoading(text) {
  const el = document.getElementById("marketplace_buy_loading_text");
  const wrap = document.getElementById("marketplace_buy_loading");
  if (el) el.textContent = text;
  if (wrap) wrap.classList.remove("hidden");
}
function hideMarketplaceBuyLoading() {
  const wrap = document.getElementById("marketplace_buy_loading");
  if (wrap) wrap.classList.add("hidden");
}

async function handleMarketplaceTokenBuy() {
  const amountInput = document.getElementById("marketplace_token_buy_amount");
  const buyBtn = document.getElementById("marketplace_token_buy_btn");
  const amount = Number(amountInput.value);

  if (!Number.isFinite(amount) || amount <= 0) {
    showToast("Enter how much USDAI you want to spend.", "warning");
    return;
  }
  if (amount < MIN_MAIN_TOKEN_BUY_USDAI) {
    showToast(`Minimum is ${MIN_MAIN_TOKEN_BUY_USDAI} USDAI.`, "warning");
    setMarketplaceBuyStatus(`Minimum is ${MIN_MAIN_TOKEN_BUY_USDAI} USDAI.`);
    return;
  }

  //  Fetch and display the receiving address
  const address = await marketplaceGetUsdaiPaymentAddress();
  const addressEl = document.getElementById("usdai_key_prompt_address");
  if (addressEl) addressEl.textContent = address;

  // Ask the user to paste the TXID after sending funds externally
  const txid = await requestUsdaiTransactionId();
  if (!txid) return;

  const origBtnText = buyBtn.textContent;
  buyBtn.disabled = true;
  buyBtn.innerHTML = '<span class="material-symbols-outlined text-base animate-spin">progress_activity</span> Verifying…';

  try {
    // Send the TXID to the backend for verification and minting
    showMarketplaceBuyLoading("Verifying payment on-chain…");
    setMarketplaceBuyStatus("Verifying payment…");

    const result = await marketplaceBuyMainToken(txid);

    hideMarketplaceBuyLoading();
    const amt = Number(result.tokenAmount ?? result.usdaiValue ?? amount);
    const price = Number(result.tokenPrice ?? 1);
    const safeAmt = Number.isFinite(amt) ? amt : amount;
    const safePrice = Number.isFinite(price) && price !== 0 ? price : 1;

    let msg = `Bought ${safeAmt.toFixed(6)} Main Token at price ${safePrice.toFixed(6)}.`;

    setMarketplaceBuyStatus(msg);
    showToast("Main Token purchased.", "success");
    amountInput.value = "";
    await refreshMarketplacePortfolio();
    await loadMarketplaceTokenPanel();
    await loadMarketplaceSellQueueStats();

    showMarketplaceTransactionResult(true, txid, {
      title: "Purchase completed",
      description: msg,
      extraHtml: `<p class="font-code-sm text-[11px] text-outline">Added to your Top 100 positions.</p>`,
    });
  } catch (err) {
    hideMarketplaceBuyLoading();
    console.error("Main Token buy failed:", err);
    const errMsg = String((err && err.message) || err);
    const friendly = (() => {
      if (errMsg.includes("Token API returned 404")) return "Payment not found yet. Wait 30s and try again.";
      if (errMsg.includes("not confirmed")) return "Payment still confirming. Try again in 30s.";
      if (errMsg.includes("Insufficient USDAI")) return "Not enough USDAI in the transaction.";
      return errMsg;
    })();
    setMarketplaceBuyStatus(`Purchase incomplete. ${friendly}`);
    showToast("Could not complete purchase.", "error");
    showMarketplaceTransactionResult(false, txid, {
      title: "Failed",
      description: friendly,
    });
  } finally {
    hideMarketplaceBuyLoading();
    buyBtn.disabled = false;
    buyBtn.textContent = origBtnText;
  }
}

async function handleMarketplaceTokenSell() {
  const input = document.getElementById("marketplace_token_sell_amount");
  const resultEl = document.getElementById("marketplace_token_sell_result");
  const tokenAmount = Number(input.value);

  if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) {
    showToast("Enter a token amount to sell.", "warning");
    return;
  }

  try {
    const result = await marketplaceSellMainToken(tokenAmount);
    input.value = "";
    resultEl.classList.remove("hidden");
    const ratePct = (Number(result.currentReleaseFraction) * 100).toFixed(0);
    resultEl.textContent = `Sell request received - you're in line. The pool is paying out ${ratePct}% of inflows to sellers right now; see "Queue right now" below for live metrics.`;
    showToast("Sell request queued.", "success");
    await refreshMarketplacePortfolio();
    await loadMarketplaceSellQueueStats();
  } catch (err) {
    console.error("Failed to queue sell:", err);
    showToast(err.message || "Failed to queue sell.", "error");
  }
}

async function handleMarketplaceInterest(intent) {
  if (!marketplaceState.property) return;
  try {
    await marketplaceExpressInterest(
      marketplaceState.property.property.id,
      intent,
    );
    showToast(
      intent === "want_to_buy"
        ? "Buy interest recorded."
        : "Sell interest recorded.",
      "success",
    );
  } catch (err) {
    console.error("Failed to record interest:", err);
    showToast(err.message || "Failed to record interest.", "error");
  }
}

async function handleMarketplaceDeleteUsageEvent(eventId) {
  if (!confirm("Delete this usage event?")) return;

  try {
    await marketplaceDeleteUsageEvent(marketplaceState.property.property.id, eventId);
    showToast("Usage event deleted.", "success");
    await showMarketplacePropertyDetail(marketplaceState.property.property.id);
  } catch (err) {
    console.error("Failed to delete usage event:", err);
    showToast(err.message || "Failed to delete usage event.", "error");
  }
}

async function loadMarketplaceConfigPanel() {
  const formulaList = document.getElementById("marketplace_formulas_list");
  if (formulaList) {
    formulaList.innerHTML = `<div class="font-code-sm text-xs text-outline">Loading formulas…</div>`;
  }

  try {
    const data = await marketplaceGetFormulas();
    const config = data.config || {};
    marketplaceConfigCache = config;

    const setValue = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    };
    setValue("config_people_weight", config.people_weight);
    setValue("config_task_weight", config.task_weight);
    setValue("config_top_n_properties", config.top_n_properties);
    setValue("config_weak_bundle_size", config.weak_bundle_size);
    setValue("config_sell_queue_period_days", config.sell_queue_period_days);
    const bundleToggle = document.getElementById("config_weak_bundle_enabled");
    if (bundleToggle) bundleToggle.checked = !!config.weak_bundle_enabled;

    if (formulaList) {
      const formulas = data.formulas || {};
      const labels = {
        consumption: "Consumption",
        playsDefinition: "Total plays",
        likesDefinition: "Total likes",
        peopleDefinition: "People",
        tasksDefinition: "Tasks",
        adminScoreDefinition: "Admin score",
        basePrice: "Base price",
        currentPrice: "Current price",
        scarcity: "Scarcity",
        utility: "Utility",
        usageWeights: "Usage event weights",
        totalConsumption: "Total consumption",
        topNConfig: "Top N",
        consumptionShare: "Consumption share",
        bundle: "Bundle consumption",
        poolPricePerUnit:
          formulas.poolPriceStatus === "deferred"
            ? "Pool price per unit (deferred)"
            : "Pool price per unit",
      };

      const usageWeightsText = formulas.usageWeights
        ? Object.entries(formulas.usageWeights)
            .map(([type, weight]) => `${type}: ${weight}`)
            .join(" · ")
        : "";

      formulaList.innerHTML = Object.entries(labels)
        .filter(([key]) => formulas[key])
        .map(([key, label]) => {
          const value =
            key === "usageWeights" ? usageWeightsText : formulas[key];
          return `
            <div class="border-b border-white/5 py-2">
              <div class="font-label-caps text-[9px] text-outline uppercase tracking-widest mb-1">${label}</div>
              <div class="font-code-sm text-[11px] text-on-surface break-words">${escapeHtml(value)}</div>
            </div>`;
        })
        .join("");
    }
  } catch (err) {
    console.error("Failed to load config:", err);
    if (formulaList) {
      formulaList.innerHTML = `<div class="font-code-sm text-xs text-outline">Could not load formulas.</div>`;
    }
    showToast("Failed to load marketplace config.", "error");
  }
}

async function handleMarketplaceSaveConfig() {
  const original = marketplaceConfigCache || {};
  const updates = {
    people_weight: Number(document.getElementById("config_people_weight")?.value),
    task_weight: Number(document.getElementById("config_task_weight")?.value),
    top_n_properties: Number(document.getElementById("config_top_n_properties")?.value),
    weak_bundle_size: Number(document.getElementById("config_weak_bundle_size")?.value),
    sell_queue_period_days: Number(document.getElementById("config_sell_queue_period_days")?.value),
    weak_bundle_enabled: !!document.getElementById("config_weak_bundle_enabled")?.checked,
  };

  const changed = Object.entries(updates).filter(
    ([key, value]) => String(original[key]) !== String(value),
  );
  if (!changed.length) {
    showToast("No configuration changes.", "info");
    return;
  }

  const saveBtn = document.getElementById("marketplace_config_save_btn");
  if (saveBtn) saveBtn.disabled = true;
  try {
    for (const [key, value] of changed) {
      await marketplaceUpdateConfig(key, value);
    }
    showToast("Configuration saved.", "success");
    await loadMarketplaceConfigPanel();
    const note = document.getElementById("marketplace_config_note");
    if (note) note.textContent = "Saved. Run the pipeline to apply pricing changes.";
  } catch (err) {
    console.error("Failed to save config:", err);
    showToast(err.message || "Failed to save configuration.", "error");
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

async function handleMarketplaceRunPipeline() {
  try {
    await marketplaceRunPipeline();
    showToast("Pipeline triggered.", "success");
    const note = document.getElementById("marketplace_config_note");
    if (note) note.textContent = "Pipeline triggered — refresh in a few minutes.";
  } catch (err) {
    console.error("Failed to run pipeline:", err);
    showToast(err.message || "Failed to run pipeline.", "error");
  }
}

function updateNotificationBadge(count) {
  const badge = document.getElementById("notification_badge");
  if (!badge) return;
  const pending = Number(count) || 0;
  notificationUnreadCount = pending;
  badge.textContent = pending > 99 ? "99+" : String(pending);
  badge.classList.toggle("hidden", pending <= 0);
}

function renderNotificationList(invitations = []) {
  const list = document.getElementById("notification_list");
  if (!list) return;

  const pending = invitations.filter(
    (invitation) => invitation.status === "pending",
  );
  if (!pending.length) {
    list.innerHTML = `<div class="font-code-sm text-xs text-outline">No pending invitations.</div>`;
    return;
  }

  list.innerHTML = pending
    .map(
      (invitation) => `
        <div class="flex items-start justify-between gap-2 border-b border-white/5 py-2">
          <div class="min-w-0">
            <div class="font-code-sm text-xs text-on-surface truncate">
              ${invitation.is_unread ? `<span class="inline-block w-1.5 h-1.5 rounded-full bg-primary-fixed-dim mr-1"></span>` : ""}
              ${escapeHtml(invitation.property_name || `Property #${invitation.property_id}`)}
            </div>
            <div class="font-code-sm text-[10px] text-outline">${escapeHtml(invitation.part || "people")} / ${escapeHtml(invitation.role || "")} · expires ${formatMarketplaceInvitationDate(invitation.expires_at)}</div>
          </div>
          <button onclick="openNotificationInvitation('${escapeHtml(invitation.token)}')"
            class="shrink-0 font-label-caps text-[9px] uppercase tracking-widest text-primary-fixed-dim hover:underline">Open</button>
        </div>`,
    )
    .join("");
}

function openNotificationInvitation(token) {
  const panel = document.getElementById("notification_panel");
  if (panel) panel.classList.add("hidden");
  openMarketplaceInvitation(token);
}

function toggleNotificationPanel() {
  const panel = document.getElementById("notification_panel");
  if (!panel) return;
  panel.classList.toggle("hidden");
  if (!panel.classList.contains("hidden")) {
    refreshNotificationBadge(true);
  }
}

function notificationPanelIsOpen() {
  const panel = document.getElementById("notification_panel");
  return !!panel && !panel.classList.contains("hidden");
}

function scheduleNotificationPoll(delayMs) {
  if (notificationPollTimer) {
    clearTimeout(notificationPollTimer);
    notificationPollTimer = null;
  }
  if (document.hidden || !floGlobals.myFloID) return;

  const jitter = Math.floor(Math.random() * NOTIFICATION_POLL_JITTER_MS);
  const delay =
    delayMs === undefined
      ? notificationPollBackoffMs + jitter
      : delayMs;
  notificationPollTimer = setTimeout(pollNotificationUnread, delay);
}

async function pollNotificationUnread() {
  notificationPollTimer = null;
  if (document.hidden || !floGlobals.myFloID || notificationPollInFlight) {
    scheduleNotificationPoll();
    return;
  }

  notificationPollInFlight = true;
  try {
    const data = await marketplaceGetUnreadInvitationCount();
    const unread = Number(data.unreadCount || 0);
    const changed = unread !== notificationUnreadCount;
    updateNotificationBadge(unread);
    notificationPollBackoffMs = NOTIFICATION_POLL_BASE_MS;
    notificationLastPollAt = Date.now();

    // Only fetch the full inbox when the panel is open and something changed.
    if (changed && notificationPanelIsOpen()) {
      const inbox = await marketplaceGetMyInvitations();
      renderNotificationList(inbox.invitations || []);
    }
  } catch (err) {
    notificationPollBackoffMs = Math.min(
      notificationPollBackoffMs * 2,
      NOTIFICATION_POLL_MAX_MS,
    );
    console.error("Notification poll failed; backing off:", err);
  } finally {
    notificationPollInFlight = false;
    scheduleNotificationPoll(notificationPollBackoffMs);
  }
}

function startNotificationPolling() {
  if (!floGlobals.myFloID) {
    if (notificationPollStartAttempts < 12) {
      notificationPollStartAttempts += 1;
      setTimeout(startNotificationPolling, 5000);
    }
    return;
  }
  notificationPollStartAttempts = 0;
  notificationPollBackoffMs = NOTIFICATION_POLL_BASE_MS;
  scheduleNotificationPoll(0);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (notificationPollTimer) {
      clearTimeout(notificationPollTimer);
      notificationPollTimer = null;
    }
    return;
  }

  if (!floGlobals.myFloID) return;
  const stale = Date.now() - notificationLastPollAt > NOTIFICATION_POLL_BASE_MS;
  scheduleNotificationPoll(stale ? 0 : undefined);
});

async function refreshNotificationBadge(markRead = false) {
  if (!floGlobals.myFloID) {
    updateNotificationBadge(0);
    renderNotificationList([]);
    return;
  }
  try {
    const data = await marketplaceGetMyInvitations();
    const invitations = data.invitations || [];
    const unread = Number(data.unreadCount ?? 0);
    updateNotificationBadge(unread);
    renderNotificationList(invitations);
    notificationPollBackoffMs = NOTIFICATION_POLL_BASE_MS;
    notificationLastPollAt = Date.now();

    if (markRead && unread > 0) {
      await marketplaceMarkInvitationsRead();
      updateNotificationBadge(0);
      renderNotificationList(
        invitations.map((invitation) => ({
          ...invitation,
          is_unread: false,
        })),
      );
    }
    scheduleNotificationPoll();
  } catch (err) {
    console.error("Failed to refresh invitation notifications:", err);
  }
}

async function loadMarketplaceInvitationInbox() {
  const list = document.getElementById("overview_my_invites_list");
  const count = document.getElementById("overview_my_invites_count");
  if (!list) return;

  if (!floGlobals.myFloID) {
    if (count) count.textContent = "0";
    list.innerHTML = `<div class="font-code-sm text-xs text-outline">Sign in to see invitations addressed to you.</div>`;
    return;
  }

  try {
    const data = await marketplaceGetMyInvitations();
    const invitations = data.invitations || [];
    const unread = Number(
      data.unreadCount ??
        invitations.filter((invitation) => invitation.is_unread).length,
    );
    updateNotificationBadge(unread);
    renderNotificationList(invitations);
    if (unread > 0) {
      try {
        await marketplaceMarkInvitationsRead();
        updateNotificationBadge(0);
      } catch (markErr) {
        console.error("Failed to mark invitations read:", markErr);
      }
    }
    if (count) count.textContent = String(invitations.length);
    if (!invitations.length) {
      list.innerHTML = `<div class="font-code-sm text-xs text-outline">No invitations addressed to you.</div>`;
      return;
    }

    const statusClass = (status) =>
      status === "pending"
        ? "bg-yellow-400/10 text-yellow-400"
        : status === "accepted"
          ? "bg-green-400/10 text-green-400"
          : "bg-white/5 text-outline";

    list.innerHTML = invitations
      .map((invitation) => {
        const openBtn =
          invitation.status === "pending" && invitation.token
            ? `<button onclick="openMarketplaceInvitation('${escapeHtml(invitation.token)}')"
                 class="shrink-0 font-label-caps text-[9px] uppercase tracking-widest text-primary-fixed-dim hover:underline">Open</button>`
            : "";
        return `
          <div class="flex items-center justify-between gap-2 border-b border-white/5 py-2">
            <div class="min-w-0">
              <div class="font-code-sm text-xs text-on-surface truncate">${escapeHtml(invitation.property_name || `Property #${invitation.property_id}`)}</div>
              <div class="font-code-sm text-[10px] text-outline">${escapeHtml(invitation.part || "people")} / ${escapeHtml(invitation.role || "")} · ${formatMarketplaceInvitationDate(invitation.expires_at)}</div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="font-label-caps text-[9px] uppercase tracking-widest px-2 py-0.5 rounded ${statusClass(invitation.status)}">${escapeHtml(invitation.status)}</span>
              ${openBtn}
            </div>
          </div>`;
      })
      .join("");
  } catch (err) {
    console.error("Failed to load invitation inbox:", err);
    if (count) count.textContent = "0";
    list.innerHTML = `<div class="font-code-sm text-xs text-outline">Sign in to see invitations addressed to you.</div>`;
  }
}

async function loadMarketplaceOverview() {
  try {
    const data = await marketplaceGetOverview();
    const counts = data.counts || {};
    const uniquePeople = data.uniquePeople || data.people || [];
    const creative = data.creative || [];
    const finance = data.finance || [];
    const financeAllocations = data.financeAllocations || [];
    const payouts = data.payouts || [];
    const royaltySplits = data.royaltySplits || [];
    const marketing = data.marketing || [];
    const tasks = data.tasks || [];
    const invitationCounts = data.invitations || {};

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    const empty = (text) =>
      `<div class="font-code-sm text-xs text-outline">${escapeHtml(text)}</div>`;

    const uniqueTasks = [...new Map(tasks.map((task) => [task.id, task])).values()];

    // Summary cards + section counts.
    setText("overview_unique_people_count", counts.uniquePeople ?? uniquePeople.length);
    setText("overview_membership_count", counts.memberships ?? 0);
    setText("overview_property_count", counts.properties ?? 0);
    setText("overview_task_count", counts.tasks ?? uniqueTasks.length);
    setText("overview_payout_count", counts.payouts ?? payouts.length);
    setText("overview_invite_count", counts.pendingInvitations ?? invitationCounts.pending ?? 0);
    setText("overview_people_count", counts.uniquePeople ?? uniquePeople.length);
    setText("overview_creative_count", counts.creativeComponents ?? creative.length);
    setText("overview_finance_count", counts.financeComponents ?? finance.length);
    setText("overview_finance_allocations_count", counts.financeAllocations ?? financeAllocations.length);
    setText("overview_payouts_count", counts.payouts ?? payouts.length);
    setText("overview_royalty_count", counts.royaltySplits ?? royaltySplits.length);
    setText("overview_marketing_count", counts.marketingComponents ?? marketing.length);
    setText("overview_tasks_count", counts.tasks ?? uniqueTasks.length);

    const inviteBreakdown = Object.entries(invitationCounts)
      .map(([status, count]) => `${status}: ${count}`)
      .join(" · ");
    setText("overview_invite_breakdown", inviteBreakdown || "—");

    // People (unique, not membership rows).
    const peopleList = document.getElementById("overview_people_list");
    if (!uniquePeople.length) {
      peopleList.innerHTML = empty("No people registered yet.");
    } else {
      peopleList.innerHTML = uniquePeople
        .map((person) => {
          const propertyCount = Number(person.property_count || 0);
          const membershipCount = Number(person.membership_count || 0);
          return `
            <div class="flex items-center justify-between gap-2 border-b border-white/5 py-2">
              <div class="min-w-0">
                <span class="font-code-sm text-xs text-on-surface">${escapeHtml(person.name || truncateFloId(person.flo_id))}</span>
                <span class="font-code-sm text-[10px] text-outline ml-2">${escapeHtml(person.work_profile || "")}</span>
              </div>
              <span class="font-code-sm text-[10px] text-primary-fixed-dim shrink-0">${propertyCount} properties · ${membershipCount} roles</span>
            </div>`;
        })
        .join("");
    }

    // Creative parts: lyrics / music / vocals.
    const creativeBreakdown = document.getElementById("overview_creative_breakdown");
    if (creativeBreakdown) {
      const byType = counts.creativeByType || {};
      creativeBreakdown.innerHTML = ["lyrics", "music", "vocals"]
        .map(
          (type) =>
            `<span class="font-code-sm text-[10px] text-outline px-2 py-1 rounded bg-white/5 border border-white/10">${type}: ${Number(byType[type] || 0)}</span>`,
        )
        .join("");
    }
    const creativeList = document.getElementById("overview_creative_list");
    if (!creative.length) {
      creativeList.innerHTML = empty("No creative components yet.");
    } else {
      creativeList.innerHTML = creative
        .map((component) => {
          const title = component.metadata?.title || component.track_id || "N/A";
          const artist = component.metadata?.artist || "";
          return `
            <div class="flex items-center justify-between gap-2 border-b border-white/5 py-2">
              <div class="min-w-0">
                <span class="font-code-sm text-xs text-on-surface">${escapeHtml(component.component_type || "component")} — ${escapeHtml(title)}</span>
                <span class="font-code-sm text-[10px] text-outline ml-2">${artist ? `${escapeHtml(artist)} · ` : ""}${escapeHtml(component.property_name || "Unassigned")}</span>
              </div>
            </div>`;
        })
        .join("");
    }

    // Finance components.
    const financeList = document.getElementById("overview_finance_list");
    if (!finance.length) {
      financeList.innerHTML = empty("No finance components yet.");
    } else {
      financeList.innerHTML = finance
        .map((fin) => {
          const amount = fin.amount
            ? `${Number(fin.amount).toFixed(2)} ${escapeHtml(fin.currency || "USDAI")}`
            : "Unpriced";
          return `
            <div class="flex items-center justify-between gap-2 border-b border-white/5 py-2">
              <div class="min-w-0">
                <span class="font-code-sm text-xs text-on-surface">${escapeHtml(fin.title || "Untitled")}</span>
                <span class="font-code-sm text-[10px] text-outline ml-2">${escapeHtml(fin.property_name || "Unassigned")}</span>
              </div>
              <span class="font-code-sm text-[11px] text-primary-fixed-dim">${amount}</span>
            </div>`;
        })
        .join("");
    }

    // Allocations.
    const allocationsList = document.getElementById("overview_finance_allocations_list");
    if (!financeAllocations.length) {
      allocationsList.innerHTML = empty("No finance allocations yet.");
    } else {
      allocationsList.innerHTML = financeAllocations
        .map(
          (allocation) => `
            <div class="flex items-center justify-between gap-2 font-code-sm text-xs text-on-surface py-1">
              <span class="truncate">${escapeHtml(allocation.property_name || `Property #${allocation.property_id}`)} · ${escapeHtml(allocation.category || "general")}</span>
              <span class="text-primary-fixed-dim">${formatMarketplaceFinancePercent(allocation.allocation_pct)}</span>
            </div>`,
        )
        .join("");
    }

    // Payouts.
    const payoutsList = document.getElementById("overview_payouts_list");
    if (!payouts.length) {
      payoutsList.innerHTML = empty("No payouts yet.");
    } else {
      payoutsList.innerHTML = payouts
        .map(
          (payout) => `
            <div class="flex items-center justify-between gap-2 font-code-sm text-xs text-on-surface py-1">
              <span class="truncate">${escapeHtml(payout.property_name || `Property #${payout.property_id}`)} · ${escapeHtml(truncateFloId(payout.recipient_flo_id))}</span>
              <span class="text-primary-fixed-dim">${Number(payout.amount || 0).toFixed(2)} · ${escapeHtml(payout.status || "pending")}</span>
            </div>`,
        )
        .join("");
    }

    // Royalty splits.
    const royaltyList = document.getElementById("overview_royalty_list");
    if (!royaltySplits.length) {
      royaltyList.innerHTML = empty("No royalty splits yet.");
    } else {
      royaltyList.innerHTML = royaltySplits
        .map(
          (split) => `
            <div class="flex items-center justify-between gap-2 font-code-sm text-xs text-on-surface py-1">
              <span class="truncate">${escapeHtml(split.property_name || "Unassigned")} · ${escapeHtml(split.finance_title || "Finance")} · ${escapeHtml(truncateFloId(split.recipient_flo_id))}</span>
              <span class="text-primary-fixed-dim">${formatMarketplaceFinancePercent(split.share_percentage)}</span>
            </div>`,
        )
        .join("");
    }

    // Marketing.
    const marketingList = document.getElementById("overview_marketing_list");
    if (!marketing.length) {
      marketingList.innerHTML = empty("No marketing components yet.");
    } else {
      marketingList.innerHTML = marketing
        .map((mark) => {
          const title = mark.metadata?.title || mark.track_id || "N/A";
          const artist = mark.metadata?.artist || "";
          return `
            <div class="flex items-center justify-between gap-2 border-b border-white/5 py-2">
              <div class="min-w-0">
                <span class="font-code-sm text-xs text-on-surface">Marketing — ${escapeHtml(title)}</span>
                <span class="font-code-sm text-[10px] text-outline ml-2">${artist ? `${escapeHtml(artist)} · ` : ""}${escapeHtml(mark.property_name || "Unassigned")}</span>
              </div>
            </div>`;
        })
        .join("");
    }

    // Tasks.
    const tasksList = document.getElementById("overview_tasks_list");
    if (!uniqueTasks.length) {
      tasksList.innerHTML = empty("No tasks yet.");
    } else {
      tasksList.innerHTML = uniqueTasks
        .map((task) => {
          const brief = escapeHtml((task.brief || `Task #${task.id}`).slice(0, 90));
          const statusClass =
            task.status === "completed"
              ? "bg-green-400/10 text-green-400"
              : "bg-primary-fixed-dim/10 text-primary-fixed-dim";
          return `
            <div class="flex items-center justify-between gap-2 border-b border-white/5 py-2">
              <div class="min-w-0">
                <span class="font-code-sm text-xs text-on-surface">${brief}</span>
                <span class="font-code-sm text-[10px] text-outline ml-2">${escapeHtml(task.property_name || "Unassigned")}</span>
              </div>
              <span class="font-label-caps text-[9px] uppercase tracking-widest px-2 py-0.5 rounded ${statusClass}">${escapeHtml(task.status || "open")}</span>
            </div>`;
        })
        .join("");
    }

    // Consumption shares are fetched separately so a backend hiccup doesn't blank out the rest of the overview.
    try {
      const shares = await marketplaceGetConsumptionShares();
      setText("overview_consumption_total", Number(shares.totalConsumption || 0).toFixed(2));
      setText("overview_consumption_count", shares.properties?.length || 0);
      const consumptionList = document.getElementById("overview_consumption_list");
      if (!shares.properties?.length) {
        consumptionList.innerHTML = empty("No Top-N consumption yet.");
      } else {
        consumptionList.innerHTML = shares.properties
          .slice(0, 12)
          .map(
            (property) => `
              <div class="flex items-center justify-between gap-2 font-code-sm text-xs text-on-surface py-1">
                <span class="truncate">${escapeHtml(property.name || `Property #${property.id}`)}${property.isBundle ? " · bundle" : ""}</span>
                <span class="text-primary-fixed-dim">${Number(property.consumption || 0).toFixed(2)} · ${(Number(property.consumptionSharePct || 0)).toFixed(1)}%</span>
              </div>`,
          )
          .join("");
      }
    } catch (shareErr) {
      console.error("Failed to load consumption shares:", shareErr);
      setText("overview_consumption_total", "—");
    }

    await loadMarketplaceInvitationInbox();
  } catch (err) {
    console.error("Failed to load overview:", err);
    showToast("Failed to load overview.", "error");
  }
}