// Manages the marketplace interface where users can browse and interact with properties.
// It handles keeping the display up to date and processing interactions like buying or selling.

const MARKETPLACE_COMPONENT_TYPES = ["lyrics", "music", "vocals", "marketing"];

let marketplaceState = {
  categories: [],
  categorySlug: null,
  categoryId: null,
  view: "properties", // "properties" | "token" | "financing" | "taskboard"
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

  const tokenPanel = document.getElementById("marketplace_token_panel");
  const taskboardPanel = document.getElementById("marketplace_taskboard_panel");
  const propertyDetail = document.getElementById("marketplace_property_detail");
  if (tokenPanel) tokenPanel.classList.add("hidden");
  if (taskboardPanel) taskboardPanel.classList.add("hidden");
  if (propertyDetail) propertyDetail.classList.add("hidden");

  // Category browsing controls only make sense on Properties.
  const hideChrome = isToken || isTaskboard;
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
  const { property, components, people, tasks } = marketplaceState.property;

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
        return `
          <div class="flex items-center justify-between gap-2 font-code-sm text-xs text-on-surface py-1">
            <span>${escapeHtml(p.name || truncateFloId(p.flo_id))}${roleTag} — ${escapeHtml(p.work_profile || "")}</span>
            ${removeBtn}
          </div>`;
      })
      .join("");
  }

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
        "Payouts start once platform liquidity reaches 10,000 USDAI.";
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
      Number(stats.pressureRatio7d) >= 1
        ? `Buys outnumbered sells ${Number(stats.pressureRatio7d).toFixed(1)}x over the last 7 days - the pool pays out ${ratePct}% of incoming funds to sellers each run.`
        : `Selling pressure is high right now - payout rate is reduced until buying picks up.`;
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