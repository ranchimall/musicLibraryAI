// Manages the marketplace interface where users can browse and interact with properties.
// It handles keeping the display up to date and processing interactions like buying or selling.

const MARKETPLACE_COMPONENT_TYPES = ["lyrics", "music", "vocals", "marketing"];

let marketplaceState = {
  categories: [],
  categorySlug: null,
  categoryId: null,
  view: "properties", // "properties" | "financing"
  top100Only: false,
  properties: [], // bundle Properties in the selected category
  property: null, // currently open bundle, with components/people/financing attached
  slots: [],
  buySlotId: null, // slot awaiting a payment txid, or null
  paymentAddress: null,
};

// Remembers if the current user has special privileges so we don't have to keep checking.
let isCurrentUserAdmin = null;

// Starts up the marketplace view when the user navigates here.
async function renderMarketplace() {
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

  const addCategoryBtn = document.getElementById("marketplace_add_category_btn");
  if (addCategoryBtn) addCategoryBtn.classList.toggle("hidden", !isCurrentUserAdmin);

  const addPropertyBtn = document.getElementById("marketplace_add_property_btn");
  if (addPropertyBtn) addPropertyBtn.classList.toggle("hidden", !isCurrentUserAdmin);

  const attachComponentBtn = document.getElementById("marketplace_show_attach_component_btn");
  if (attachComponentBtn) attachComponentBtn.classList.toggle("hidden", !isCurrentUserAdmin);

  const attachPersonBtn = document.getElementById("marketplace_show_attach_person_btn");
  if (attachPersonBtn) attachPersonBtn.classList.toggle("hidden", !isCurrentUserAdmin);

  const attachTaskBtn = document.getElementById("marketplace_show_attach_task_btn");
  if (attachTaskBtn) attachTaskBtn.classList.toggle("hidden", !isCurrentUserAdmin);

  const postTaskBtn = document.getElementById("financing_post_task_btn");
  if (postTaskBtn) postTaskBtn.classList.toggle("hidden", !isCurrentUserAdmin);
}

function setMarketplaceLoading(isLoading) {
  document.getElementById("marketplace_loading_state").classList.toggle("hidden", !isLoading);
  if (isLoading) {
    document.getElementById("marketplace_properties_list").classList.add("hidden");
    document.getElementById("marketplace_property_detail").classList.add("hidden");
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
          .map((c) => `<option value="${c.slug}" data-id="${c.id}">${c.name}</option>`)
          .join("");

      // Start on "All Categories" (global Top-100) rather than the first category.
      marketplaceState.categorySlug = null;
      marketplaceState.categoryId = null;
    }

    select.onchange = () => {
      const opt = select.options[select.selectedIndex];
      marketplaceState.categorySlug = opt.value || null;
      marketplaceState.categoryId = opt.dataset.id ? Number(opt.dataset.id) : null;
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
  const isFinancing = marketplaceState.view === "financing";

  const categorySelectWrap = document.getElementById("marketplace_category_select_wrap");
  if (categorySelectWrap) categorySelectWrap.classList.toggle("hidden", isFinancing);
  const top100Wrap = document.getElementById("marketplace_top100_toggle_wrap");
  if (top100Wrap) top100Wrap.classList.toggle("hidden", isFinancing);
  const addPropertyBtn = document.getElementById("marketplace_add_property_btn");
  if (addPropertyBtn) addPropertyBtn.classList.toggle("hidden", isFinancing || !isCurrentUserAdmin);

  if (isFinancing) {
    document.getElementById("marketplace_loading_state").classList.add("hidden");
    document.getElementById("marketplace_properties_list").classList.add("hidden");
    document.getElementById("marketplace_property_detail").classList.add("hidden");
    document.getElementById("marketplace_empty_state").classList.add("hidden");
    document.getElementById("marketplace_financing_panel").classList.remove("hidden");
    if (typeof renderFinancing === "function") await renderFinancing();
    return;
  }

  document.getElementById("marketplace_financing_panel").classList.add("hidden");
  await showMarketplacePropertiesList();
}

function handleMarketplaceTop100Toggle() {
  marketplaceState.top100Only = document.getElementById("marketplace_top100_toggle").checked;
  showMarketplacePropertiesList();
}

// --- Properties list --------------------------------------------------

async function showMarketplacePropertiesList() {
  document.getElementById("marketplace_property_detail").classList.add("hidden");

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
      properties = await marketplaceGetGlobalProperties(marketplaceState.top100Only);
    }
    marketplaceState.properties = properties;

    setMarketplaceLoading(false);

    if (!properties || !properties.length) {
      document.getElementById("marketplace_properties_list").classList.add("hidden");
      document.getElementById("marketplace_empty_state").classList.remove("hidden");
      return;
    }

    document.getElementById("marketplace_empty_state").classList.add("hidden");
    document.getElementById("marketplace_properties_list").classList.remove("hidden");
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
      return `
        <button onclick="showMarketplacePropertyDetail(${p.id})" title="${escapeHtml(p.name || "")}"
          class="glass-panel rounded-xl p-md flex flex-col gap-2 text-left hover:border-primary-fixed-dim/40 border border-transparent transition-all">
          <div class="flex items-start justify-between gap-2">
            <span class="font-headline-md text-sm text-on-surface truncate">${escapeHtml(p.name || "Untitled")}</span>
            ${rankBadge}
          </div>
          <div class="flex items-center gap-md font-code-sm text-xs text-outline">
            <span>Price: <span class="text-primary-fixed-dim">${Number(p.current_price).toFixed(2)}</span></span>
            <span>Slots: ${p.total_slots}</span>
          </div>
        </button>`;
    })
    .join("");
}

// --- Property detail ---------------------------------------------------

async function showMarketplacePropertyDetail(propertyId) {
  document.getElementById("marketplace_properties_list").classList.add("hidden");
  document.getElementById("marketplace_empty_state").classList.add("hidden");
  setMarketplaceLoading(true);

  try {
    const data = await marketplaceGetProperty(propertyId);
    marketplaceState.property = data;
    marketplaceState.slots = []; // refreshed below via loadMarketplaceSlots
    hideMarketplaceBuyPanel();

    setMarketplaceLoading(false);
    document.getElementById("marketplace_property_detail").classList.remove("hidden");

    renderMarketplacePropertyDetail();
    await loadMarketplaceSlots(propertyId);
  } catch (err) {
    console.error("Failed to load property:", err);
    setMarketplaceLoading(false);
    showToast("Failed to load property.", "error");
  }
}

function renderMarketplacePropertyDetail() {
  const { property, components, people, financing, tasks } = marketplaceState.property;

  document.getElementById("marketplace_property_name").textContent = property.name || "Untitled";
  document.getElementById("marketplace_stat_price").textContent = Number(property.current_price).toFixed(2);
  document.getElementById("marketplace_stat_scarcity").textContent = Number(property.scarcity_score).toFixed(2);
  document.getElementById("marketplace_stat_utility").textContent = Number(property.utility_score).toFixed(2);
  document.getElementById("marketplace_stat_slots").textContent = property.total_slots;

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

  const financingList = document.getElementById("marketplace_financing_list");
  if (!financing.length) {
    financingList.innerHTML = `<div class="font-code-sm text-xs text-outline">No financing yet.</div>`;
  } else {
    financingList.innerHTML = financing
      .map(
        (f) => `
          <div class="flex items-center justify-between gap-2 font-code-sm text-xs text-on-surface py-1">
            <span>${truncateFloId(f.financier_flo_id)}</span>
            <span class="text-primary-fixed-dim">${Number(f.amount).toFixed(2)}${f.revenue_share_pct ? ` (${f.revenue_share_pct}% rev)` : ""}</span>
          </div>`,
      )
      .join("");
  }

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
              : t.brief.replace(/<[^>]*>/g, "")).slice(0, 80)
            : `Task #${t.task_id || t.id}`;
          const statusBadge = t.status
            ? `<span class="font-label-caps text-[9px] uppercase tracking-widest px-2 py-0.5 rounded ${t.status === "open" ? "bg-primary-fixed-dim/10 text-primary-fixed-dim" :
              t.status === "claimed" ? "bg-yellow-400/10 text-yellow-400" :
                "bg-green-400/10 text-green-400"
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
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// --- Category management (admin) ---------------------------------------

function toggleMarketplaceAddCategoryForm() {
  document.getElementById("marketplace_add_category_form").classList.toggle("hidden");
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
    document.getElementById("marketplace_add_category_form").classList.add("hidden");
    await loadMarketplaceCategories();
  } catch (err) {
    console.error("Failed to add category:", err);
    showToast(err.message || "Failed to add category.", "error");
  }
}

// --- Property management (admin) ----------------------------------------

function toggleMarketplaceAddPropertyForm() {
  document.getElementById("marketplace_add_property_form").classList.toggle("hidden");
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
    document.getElementById("marketplace_add_property_form").classList.add("hidden");
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
  const componentType = document.getElementById("marketplace_attach_component_type").value;
  select.innerHTML = `<option value="">Loading...</option>`;

  try {
    const propertyCategoryId = marketplaceState.property.property.category_id;
    const category = marketplaceState.categories.find(
      (c) => Number(c.id) === Number(propertyCategoryId)
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

        const label = artist
          ? `${title} — ${artist}`
          : title;

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
    await marketplaceAttachComponent(marketplaceState.property.property.id, componentId);
    showToast("Component attached.", "success");
    await showMarketplacePropertyDetail(marketplaceState.property.property.id);
  } catch (err) {
    console.error("Failed to attach component:", err);
    showToast(err.message || "Failed to attach component.", "error");
  }
}

async function handleMarketplaceRemoveComponent(componentId) {
  try {
    await marketplaceRemoveComponent(marketplaceState.property.property.id, componentId);
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
              : t.brief.replace(/<[^>]*>/g, "")).slice(0, 60)
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
    document.getElementById("marketplace_attach_task_form").classList.add("hidden");
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
  document.getElementById("marketplace_attach_person_form").classList.toggle("hidden");
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
    await marketplaceAttachPerson(marketplaceState.property.property.id, personFloId, role);
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
    await marketplaceRemovePerson(marketplaceState.property.property.id, personFloId, role);
    showToast("Person removed.", "success");
    await showMarketplacePropertyDetail(marketplaceState.property.property.id);
  } catch (err) {
    console.error("Failed to remove person:", err);
    showToast(err.message || "Failed to remove person.", "error");
  }
}

function toggleMarketplaceRegisterPersonForm() {
  document.getElementById("marketplace_register_person_form").classList.toggle("hidden");
}

async function handleMarketplaceRegisterPerson() {
  const workProfile = document.getElementById("marketplace_register_work_profile").value.trim();
  const experience = document.getElementById("marketplace_register_experience").value.trim();
  const name = document.getElementById("marketplace_register_name").value.trim();
  const cvUrl = document.getElementById("marketplace_register_cv_url").value.trim();

  if (!workProfile) {
    showToast("Work profile is required.", "warning");
    return;
  }

  try {
    await marketplaceRegisterPerson(workProfile, experience || undefined, name || undefined, cvUrl || undefined);
    showToast("Profile saved.", "success");
    document.getElementById("marketplace_register_person_form").classList.add("hidden");
  } catch (err) {
    console.error("Failed to save profile:", err);
    showToast(err.message || "Failed to save profile.", "error");
  }
}

// --- Financing (back a property) ----------------------------------------

async function handleMarketplaceBackProperty() {
  const amountInput = document.getElementById("marketplace_back_amount");
  const revshareInput = document.getElementById("marketplace_back_revshare");

  const amount = Number(amountInput.value);
  if (!amount || amount <= 0) {
    showToast("Enter an amount to back this property.", "warning");
    return;
  }
  const revenueSharePct = revshareInput.value ? Number(revshareInput.value) : undefined;

  if (revenueSharePct !== undefined && (revenueSharePct < 0 || revenueSharePct > 100)) {
    showToast("Revenue share must be between 0 and 100%.", "warning");
    return;
  }

  try {
    await marketplaceBackProperty(marketplaceState.property.property.id, amount, revenueSharePct);
    showToast("Property backed.", "success");
    amountInput.value = "";
    revshareInput.value = "";
    await showMarketplacePropertyDetail(marketplaceState.property.property.id);
  } catch (err) {
    console.error("Failed to back property:", err);
    showToast(err.message || "Failed to back property.", "error");
  }
}

// --- Slots: buy/sell -----------------------------------------------------

async function loadMarketplaceSlots(propertyId) {
  const grid = document.getElementById("marketplace_slots_grid");
  try {
    const res = await fetch(`${API_BASE_URL}/api/properties/${propertyId}/slots`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Failed to load slots");

    marketplaceState.slots = data.slots;
    renderMarketplaceSlotsGrid();
  } catch (err) {
    console.error("Failed to load slots:", err);
    grid.innerHTML = `<div class="col-span-full text-center text-outline py-8 font-code-sm">Failed to load slots.</div>`;
  }
}

function truncateFloId(floId) {
  if (!floId) return "";
  return `${floId.slice(0, 6)}…${floId.slice(-4)}`;
}

function renderMarketplaceSlotsGrid() {
  const grid = document.getElementById("marketplace_slots_grid");
  const myFloId = floGlobals.myFloID;

  if (!marketplaceState.slots.length) {
    grid.innerHTML = `<div class="col-span-full text-center text-outline py-8 font-code-sm">No slots minted yet.</div>`;
    return;
  }

  grid.innerHTML = marketplaceState.slots
    .map((slot) => {
      const isOwned = !!slot.owner_flo_id;
      const isMine = isOwned && slot.owner_flo_id === myFloId;
      const canSell =
        isMine &&
        !slot.pending_payout &&
        slot.eligible_to_sell_at &&
        new Date(slot.eligible_to_sell_at) <= new Date();

      let actionHtml;
      if (slot.pending_payout) {
        actionHtml = `
          <div class="w-full text-center py-xs rounded bg-white/5 font-label-caps text-[10px] tracking-widest uppercase text-outline">
            Sale in progress
          </div>`;
      } else if (!isOwned) {
        actionHtml = `
          <button onclick="handleMarketplaceBuy(${slot.id})" title="Buy this slot"
            class="w-full flex items-center justify-center gap-xs py-xs rounded bg-primary-fixed-dim text-on-primary-fixed font-label-caps text-[10px] tracking-widest uppercase hover:scale-[1.02] active:scale-[0.98] transition-all">
            <span class="material-symbols-outlined text-sm">shopping_cart</span>
            <span class="hidden sm:inline">Buy</span>
          </button>`;
      } else if (canSell) {
        actionHtml = `
          <button onclick="handleMarketplaceSell(${slot.id})" title="Sell this slot"
            class="w-full flex items-center justify-center gap-xs py-xs rounded bg-white/5 border border-white/10 text-on-surface font-label-caps text-[10px] tracking-widest uppercase hover:bg-white/10 active:scale-95 transition-all">
            <span class="material-symbols-outlined text-sm">sell</span>
            <span class="hidden sm:inline">Sell</span>
          </button>`;
      } else if (isMine) {
        actionHtml = `
          <div class="w-full text-center py-xs rounded bg-white/5 font-label-caps text-[10px] tracking-widest uppercase text-outline">
            Holding
          </div>`;
      } else {
        actionHtml = `
          <div class="w-full text-center py-xs rounded bg-white/5 font-label-caps text-[10px] tracking-widest uppercase text-outline">
            Owned
          </div>`;
      }

      return `
        <div class="glass-panel rounded-xl p-md flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="font-code-sm text-code-sm text-outline">#${slot.slot_index}</span>
            ${isMine ? '<span class="material-symbols-outlined text-primary-fixed-dim text-sm">verified</span>' : ""}
          </div>
          <div class="font-code-sm text-[11px] text-on-surface truncate" title="${slot.owner_flo_id || ""}">
            ${isOwned ? truncateFloId(slot.owner_flo_id) : "Available"}
          </div>
          ${actionHtml}
        </div>`;
    })
    .join("");
}

async function handleMarketplaceInterest(intent) {
  if (!marketplaceState.property) return;
  try {
    await marketplaceExpressInterest(marketplaceState.property.property.id, intent);
    showToast(
      intent === "want_to_buy" ? "Buy interest recorded." : "Sell interest recorded.",
      "success",
    );
  } catch (err) {
    console.error("Failed to record interest:", err);
    showToast(err.message || "Failed to record interest.", "error");
  }
}

// Buying now needs a real on-chain payment first - show the address/amount
// and collect a txid rather than buying outright.
async function handleMarketplaceBuy(slotId) {
  if (!marketplaceState.property) return;

  try {
    if (!marketplaceState.paymentAddress) {
      marketplaceState.paymentAddress = await marketplaceGetPaymentAddress();
    }
  } catch (err) {
    console.error("Failed to load payment address:", err);
    showToast("Payments are not available right now.", "error");
    return;
  }

  marketplaceState.buySlotId = slotId;
  document.getElementById("marketplace_buy_amount").textContent =
    Number(marketplaceState.property.property.current_price).toFixed(8);
  document.getElementById("marketplace_buy_address").textContent = marketplaceState.paymentAddress;
  document.getElementById("marketplace_buy_txid").value = "";
  document.getElementById("marketplace_buy_panel").classList.remove("hidden");
}

function hideMarketplaceBuyPanel() {
  marketplaceState.buySlotId = null;
  document.getElementById("marketplace_buy_panel").classList.add("hidden");
}

async function handleMarketplaceConfirmBuy() {
  const txid = document.getElementById("marketplace_buy_txid").value.trim();
  if (!txid) {
    showToast("Enter the transaction ID.", "warning");
    return;
  }
  if (!marketplaceState.buySlotId) return;

  try {
    await marketplaceBuySlot(marketplaceState.property.property.id, marketplaceState.buySlotId, txid);
    showToast("Slot purchased.", "success");
    hideMarketplaceBuyPanel();
    await showMarketplacePropertyDetail(marketplaceState.property.property.id);
  } catch (err) {
    console.error("Buy failed:", err);
    showToast(err.message || "Failed to buy slot.", "error");
  }
}

async function handleMarketplaceSell(slotId) {
  if (!marketplaceState.property) return;
  try {
    await marketplaceSellSlot(marketplaceState.property.property.id, slotId);
    showToast("Slot sold - payout sent.", "success");
    await showMarketplacePropertyDetail(marketplaceState.property.property.id);
  } catch (err) {
    console.error("Sell failed:", err);
    showToast(err.message || "Failed to sell slot.", "error");
  }
}