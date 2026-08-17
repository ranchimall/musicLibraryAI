// Manages the marketplace interface where users can browse and interact with properties.
// It handles keeping the display up to date and processing interactions like buying or selling.

const MARKETPLACE_COMPONENT_TYPES = ["lyrics", "music", "vocals", "marketing"];

let marketplaceState = {
  categories: [],
  categorySlug: null,
  categoryId: null,
  component: "music",
  property: null, // current property row, or null if none exists yet
  slots: [],
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

  highlightMarketplaceComponentTab();
  await showMarketplaceComponentView();
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

  const postTaskBtn = document.getElementById("financing_post_task_btn");
  if (postTaskBtn) postTaskBtn.classList.toggle("hidden", !isCurrentUserAdmin);
}

function setMarketplaceLoading(isLoading) {
  document.getElementById("marketplace_loading_state").classList.toggle("hidden", !isLoading);
  if (isLoading) {
    document.getElementById("marketplace_property_panel").classList.add("hidden");
    document.getElementById("marketplace_empty_state").classList.add("hidden");
  }
}

async function loadMarketplaceCategories() {
  const select = document.getElementById("marketplace_category_select");
  try {
    const res = await fetch(`${API_BASE_URL}/api/categories`);
    const data = await res.json();
    if (!data.success || !data.categories.length) {
      select.innerHTML = `<option value="">No categories yet</option>`;
      return;
    }

    marketplaceState.categories = data.categories;
    select.innerHTML = data.categories
      .map((c) => `<option value="${c.slug}" data-id="${c.id}">${c.name}</option>`)
      .join("");

    const first = data.categories[0];
    marketplaceState.categorySlug = first.slug;
    marketplaceState.categoryId = first.id;

    select.onchange = () => {
      const opt = select.options[select.selectedIndex];
      marketplaceState.categorySlug = opt.value;
      marketplaceState.categoryId = Number(opt.dataset.id);
      refreshMarketplaceProperty();
    };
  } catch (err) {
    console.error("Failed to load categories:", err);
    select.innerHTML = `<option value="">Failed to load categories</option>`;
  }
}

function setMarketplaceComponent(component) {
  const isFinancing = component === "financing";
  if (!isFinancing && !MARKETPLACE_COMPONENT_TYPES.includes(component)) return;

  marketplaceState.component = component;
  highlightMarketplaceComponentTab();
  showMarketplaceComponentView();
}

function toggleMarketplaceAddCategoryForm() {
  document.getElementById("marketplace_add_category_form").classList.toggle("hidden");
}

// Only authorized users can actually add a new category.
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

// Updates the view depending on what part of the marketplace the user is looking at.
async function showMarketplaceComponentView() {
  const isFinancing = marketplaceState.component === "financing";

  const categorySelectWrap = document.getElementById("marketplace_category_select_wrap");
  if (categorySelectWrap) categorySelectWrap.classList.toggle("hidden", isFinancing);

  if (isFinancing) {
    document.getElementById("marketplace_loading_state").classList.add("hidden");
    document.getElementById("marketplace_property_panel").classList.add("hidden");
    document.getElementById("marketplace_empty_state").classList.add("hidden");
    document.getElementById("marketplace_financing_panel").classList.remove("hidden");
    if (typeof renderFinancing === "function") await renderFinancing();
    return;
  }

  document.getElementById("marketplace_financing_panel").classList.add("hidden");
  await refreshMarketplaceProperty();
}

function highlightMarketplaceComponentTab() {
  document.querySelectorAll(".marketplace-tab-btn").forEach((btn) => {
    const active = btn.dataset.component === marketplaceState.component;
    btn.classList.toggle("bg-primary-fixed-dim", active);
    btn.classList.toggle("text-on-primary-fixed", active);
    btn.classList.toggle("text-outline", !active);
  });
}

async function refreshMarketplaceProperty() {
  if (!marketplaceState.categoryId) {
    setMarketplaceLoading(false);
    document.getElementById("marketplace_empty_state").classList.remove("hidden");
    return;
  }

  setMarketplaceLoading(true);

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/properties/${marketplaceState.categoryId}?component=${marketplaceState.component}`,
    );
    const data = await res.json();

    setMarketplaceLoading(false);

    if (!data.success) {
      marketplaceState.property = null;
      document.getElementById("marketplace_property_panel").classList.add("hidden");
      document.getElementById("marketplace_empty_state").classList.remove("hidden");
      return;
    }

    marketplaceState.property = data.property;
    document.getElementById("marketplace_empty_state").classList.add("hidden");
    document.getElementById("marketplace_property_panel").classList.remove("hidden");

    renderMarketplacePropertyStats(data.property);
    await loadMarketplaceSlots(data.property.id);
  } catch (err) {
    console.error("Failed to load property:", err);
    setMarketplaceLoading(false);
    showToast("Failed to load marketplace data.", "error");
  }
}

function renderMarketplacePropertyStats(property) {
  document.getElementById("marketplace_stat_price").textContent =
    Number(property.current_price).toFixed(2);
  document.getElementById("marketplace_stat_scarcity").textContent =
    Number(property.scarcity_score).toFixed(2);
  document.getElementById("marketplace_stat_utility").textContent =
    Number(property.utility_score).toFixed(2);
  document.getElementById("marketplace_stat_slots").textContent = property.total_slots;
}

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
        slot.eligible_to_sell_at &&
        new Date(slot.eligible_to_sell_at) <= new Date();

      let actionHtml;
      if (!isOwned) {
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
    await marketplaceExpressInterest(marketplaceState.property.id, intent);
    showToast(
      intent === "want_to_buy" ? "Buy interest recorded." : "Sell interest recorded.",
      "success",
    );
  } catch (err) {
    console.error("Failed to record interest:", err);
    showToast(err.message || "Failed to record interest.", "error");
  }
}

async function handleMarketplaceBuy(slotId) {
  if (!marketplaceState.property) return;
  try {
    await marketplaceBuySlot(marketplaceState.property.id, slotId);
    showToast("Slot purchased.", "success");
    await refreshMarketplaceProperty();
  } catch (err) {
    console.error("Buy failed:", err);
    showToast(err.message || "Failed to buy slot.", "error");
  }
}

async function handleMarketplaceSell(slotId) {
  if (!marketplaceState.property) return;
  try {
    await marketplaceSellSlot(marketplaceState.property.id, slotId);
    showToast("Slot sold.", "success");
    await refreshMarketplaceProperty();
  } catch (err) {
    console.error("Sell failed:", err);
    showToast(err.message || "Failed to sell slot.", "error");
  }
}