// Helps securely communicate with the marketplace.
// It ensures that requests are authentic and safe before they are sent.
const USDAI_TOKEN_IDENTIFIER = "usdai";

// Securely retrieves the user's key to authorize actions.
async function getSigningPrivateKey() {
  let privKey = floDapps.user.private;
  if (privKey instanceof Promise) {
    privKey = await privKey;
  }
  if (!privKey) {
    throw new Error("No private key available - are you signed in?");
  }
  return privKey;
}

// Organizes the data nicely so it can be verified later.
function buildHashcontent(fields, source) {
  return fields
    .map((f) => {
      const v = source[f];
      return v === undefined || v === null ? "" : String(v);
    })
    .join("|");
}

// Securely sends an action to the marketplace.
// auth (optional): { privKey, floId } - signs with an explicitly provided
// key/identity instead of the logged-in session's. Used by the Main Token
// buy flow where the paying wallet can differ from the login identity.
async function signedMarketplaceRequest(path, urlParams, body, fields, auth = {}) {
  const time = Date.now();
  const privKey = auth.privKey || (await getSigningPrivateKey());
  const pubKey = floCrypto.getPubKeyHex(privKey);

  const source = { ...urlParams, ...body, time };
  const hashcontent = buildHashcontent(fields, source);
  const sign = floCrypto.signData(hashcontent, privKey);

  const payload = { ...body, time, pubKey, sign };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || `Request to ${path} failed (${response.status})`);
  }
  return data;
}

async function marketplaceGetRequest(path) {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || `Request to ${path} failed (${response.status})`);
  }
  return data;
}

// --- Properties (bundles) ---------------------------

async function marketplaceGetCategoryProperties(categorySlug, top100Only) {
  const qs = top100Only ? "?top100=true" : "";
  const data = await marketplaceGetRequest(`/api/categories/${categorySlug}/properties${qs}`);
  return data.properties;
}

async function marketplaceGetProperty(propertyId) {
  return marketplaceGetRequest(`/api/properties/${propertyId}`);
}

// Discovery - which lyrics/music/vocals/marketing components exist in a category, ranked by engagement. Used when an admin is picking what to attach to a bundle.
async function marketplaceGetCategoryComponents(categorySlug, componentType) {
  const data = await marketplaceGetRequest(
    `/api/categories/${categorySlug}/components?component=${componentType}`,
  );
  return data.components;
}

// Admin-only on the backend.
async function marketplaceCreateProperty(categorySlug, name) {
  return signedMarketplaceRequest(
    `/api/properties`,
    {},
    { adminFloId: floGlobals.myFloID, categorySlug, name },
    ["adminFloId", "categorySlug", "name", "time"],
  );
}

// Admin-only on the backend.
async function marketplaceAttachComponent(propertyId, componentId) {
  return signedMarketplaceRequest(
    `/api/properties/${propertyId}/components`,
    { propertyId },
    { adminFloId: floGlobals.myFloID, componentId },
    ["propertyId", "adminFloId", "componentId", "time"],
  );
}

// Admin-only on the backend.
async function marketplaceRemoveComponent(propertyId, componentId) {
  return signedMarketplaceRequest(
    `/api/properties/${propertyId}/components/${componentId}/remove`,
    { propertyId, componentId },
    { adminFloId: floGlobals.myFloID },
    ["propertyId", "componentId", "adminFloId", "time"],
  );
}

// Admin-only on the backend. Links an existing task to a property.
async function marketplaceAttachTask(propertyId, taskId) {
  return signedMarketplaceRequest(
    `/api/properties/${propertyId}/tasks`,
    { propertyId, taskId },
    {
      adminFloId: floGlobals.myFloID,
      taskId,
    },
    ["propertyId", "adminFloId", "taskId", "time"],
  );
}

// Admin-only on the backend.
async function marketplaceRemoveTask(propertyId, taskId) {
  return signedMarketplaceRequest(
    `/api/properties/${propertyId}/tasks/${taskId}/remove`,
    { propertyId, taskId },
    {
      adminFloId: floGlobals.myFloID,
    },
    ["propertyId", "taskId", "adminFloId", "time"],
  );
}

// Fetches all tasks so admins can pick one to attach to a property.
async function marketplaceGetAllTasks() {
  const data = await marketplaceGetRequest(`/api/tasks`);
  return data.tasks || [];
}

// Fetches all properties globally (no category filter) for global Top-100.
async function marketplaceGetGlobalProperties(top100Only) {
  const qs = top100Only ? "?top100=true" : "";
  const data = await marketplaceGetRequest(`/api/properties${qs}`);
  return data.properties;
}

// Admin-only on the backend. personFloId must already have a people
// profile - see marketplaceRegisterPerson.
async function marketplaceAttachPerson(propertyId, personFloId, role) {
  return signedMarketplaceRequest(
    `/api/properties/${propertyId}/people`,
    { propertyId },
    { adminFloId: floGlobals.myFloID, personFloId, role },
    ["propertyId", "adminFloId", "personFloId", "time"],
  );
}

// Admin-only on the backend.
async function marketplaceRemovePerson(propertyId, personFloId, role) {
  return signedMarketplaceRequest(
    `/api/properties/${propertyId}/people/${personFloId}/remove`,
    { propertyId, personFloId },
    { adminFloId: floGlobals.myFloID, role },
    ["propertyId", "personFloId", "adminFloId", "time"],
  );
}

// Anyone can back a property financially. Financing moves real USDAI -
// usdaiTxid is an on-chain payment sent to the USDAI payment address.
// auth: { privKey, floId } of the paying wallet when it differs from the
// session identity.
async function marketplaceBackProperty(propertyId, amount, revenueSharePct, usdaiTxid, auth = {}) {
  return signedMarketplaceRequest(
    `/api/properties/${propertyId}/financing`,
    { propertyId },
    { financierFloId: auth.floId ?? floGlobals.myFloID, amount, revenueSharePct, usdaiTxid },
    ["propertyId", "financierFloId", "amount", "revenueSharePct", "usdaiTxid", "time"],
    auth,
  );
}

// --- People ------------------------------------------

// Self-service - registers/updates the signed-in user's own profile so
// an admin can later attach them to a property.
async function marketplaceRegisterPerson(workProfile, experience, name, cvUrl) {
  return signedMarketplaceRequest(
    `/api/people`,
    {},
    { floId: floGlobals.myFloID, workProfile, experience, name, cvUrl },
    ["floId", "workProfile", "time"],
  );
}

async function marketplaceGetPerson(floId) {
  try {
    const data = await marketplaceGetRequest(`/api/people/${floId}`);
    return data.person;
  } catch (err) {
    return null; // no profile yet - not an error the caller needs to handle specially
  }
}

// --- Main Token: price / buy / sell / portfolio ---------

async function marketplaceGetTokenPrice() {
  return marketplaceGetRequest(`/api/main-token/price`);
}

// Buyers send USDAI on-chain to this address first, then redeem the
// resulting transaction ID via marketplaceBuyMainToken.
async function marketplaceGetUsdaiPaymentAddress() {
  const data = await marketplaceGetRequest(`/api/main-token/payment-address`);
  return data.address;
}

// usdaiTxid must be a confirmed on-chain USDAI transfer sent to
// marketplaceGetUsdaiPaymentAddress(). Mints Main Token at the current
// price and spreads it across the Top 100.
// auth: { privKey, floId } of the paying wallet (asked per purchase).
async function marketplaceBuyMainToken(usdaiTxid, auth = {}) {
  const floId = auth.floId ?? floGlobals.myFloID;
  return signedMarketplaceRequest(
    `/api/main-token/buy`,
    {},
    { floId, usdaiTxid },
    ["floId", "usdaiTxid", "time"],
    auth,
  );
}

// Sells are queued, not instant - the backend fulfills them from the
// liquidity pool based on the buy/sell pressure ratio. Returns
// { queued, currentPressureRatio, currentReleaseFraction }.
async function marketplaceSellMainToken(tokenAmount) {
  return signedMarketplaceRequest(
    `/api/main-token/sell`,
    {},
    { floId: floGlobals.myFloID, tokenAmount },
    ["floId", "tokenAmount", "time"],
  );
}

// Public transparency metrics: how many sells are waiting, their total
// value, and what fraction of inflows is paying them right now.
async function marketplaceGetSellQueueStats() {
  return marketplaceGetRequest(`/api/main-token/sell-queue`);
}

// Balance plus the holder's Top-100 positions.
async function marketplaceGetPortfolio(floId) {
  return marketplaceGetRequest(`/api/main-token/portfolio/${floId}`);
}

// --- USDAI on-chain payments (shared by token buys and financing) -------

// FLO dust attached to carry the USDAI token transfer on-chain.
const USDAI_TX_FEE = 0.0003;
// How long to keep polling while a payment waits for its first network
// confirmation (12 tries x 20s = 4 minutes).
const PAYMENT_REDEEM_MAX_ATTEMPTS = 12;
const PAYMENT_REDEEM_RETRY_MS = 20000;

// Asks the user for the private key of the wallet that will pay. The key
// is asked for every money-moving action and never stored - resolved once,
// then wiped from the DOM.
let usdaiKeyPromptResolve = null;
function requestUsdaiPrivateKey() {
  return new Promise((resolve) => {
    usdaiKeyPromptResolve = resolve;
    const input = document.getElementById("usdai_key_prompt_input");
    input.value = "";
    const balWrap = document.getElementById("usdai_key_prompt_balance");
    if (balWrap) balWrap.classList.add("hidden");
    document.getElementById("usdai_key_prompt").classList.remove("hidden");
    input.focus();
  });
}

function resolveUsdaiKeyPrompt(submit) {
  const input = document.getElementById("usdai_key_prompt_input");
  const value = input.value.trim();
  input.value = "";
  const balWrap = document.getElementById("usdai_key_prompt_balance");
  if (balWrap) balWrap.classList.add("hidden");
  document.getElementById("usdai_key_prompt").classList.add("hidden");
  if (usdaiKeyPromptResolve) {
    usdaiKeyPromptResolve(submit && value ? value : null);
    usdaiKeyPromptResolve = null;
  }
}

// Show the wallet's USDAI and FLO so you know if you can pay
let usdaiBalanceDebounce = null;
async function updateUsdaiKeyPromptBalance() {
  const input = document.getElementById("usdai_key_prompt_input");
  const wrap = document.getElementById("usdai_key_prompt_balance");
  const usdaiEl = document.getElementById("usdai_key_prompt_usdai");
  const floEl = document.getElementById("usdai_key_prompt_flo");
  const warnEl = document.getElementById("usdai_key_prompt_flo_warn");
  if (!input || !wrap || !usdaiEl || !floEl) return;
  const privKey = input.value.trim();
  if (!privKey) {
    wrap.classList.add("hidden");
    return;
  }
  let floId;
  try {
    floId = floCrypto.getFloID(privKey);
    if (!floCrypto.validateFloID(floId, true)) throw new Error("invalid");
  } catch {
    wrap.classList.add("hidden");
    return;
  }
  const floIdEl = document.getElementById("usdai_key_prompt_floid");
  if (floIdEl) floIdEl.textContent = floId.slice(0, 8) + "…" + floId.slice(-4);
  wrap.classList.remove("hidden");
  usdaiEl.textContent = "loading…";
  floEl.textContent = "loading…";
  if (warnEl) warnEl.classList.add("hidden");

   // Try to get USDAI balance — sum history if the fast path is empty
  async function sumUsdaiHistory(addr) {
    const r2 = await fetch(`https://ranchimallflo.ranchimall.net/api/v2/floAddressTransactions/${addr}?token=${encodeURIComponent(USDAI_TOKEN_IDENTIFIER)}`);
    if (!r2.ok) return 0;
    const data = await r2.json();
    const txs = data?.transactions || data || [];
    const seen = new Set(); let bal = 0;
    for (const tx of txs) {
      const id = tx.txid || tx.hash || tx.txID || tx.transactionTrigger;
      if (!id || seen.has(id)) continue; seen.add(id);
      const amt = Number(tx.tokenAmount || 0); if (!amt) continue;
      if (tx.receiverAddress === addr) bal += amt; else if (tx.senderAddress === addr) bal -= amt;
    }
    return bal;
  }
  const usdaiPromise = (typeof floTokenAPI !== "undefined" && floTokenAPI.getBalance)
    ? floTokenAPI.getBalance(floId, "usdai").then(async (v) => {
        if (v != null && Number(v) > 0) return v;
        return await sumUsdaiHistory(floId);
      }).catch(async () => await sumUsdaiHistory(floId))
    : fetch(`https://ranchimallflo.ranchimall.net/api/v2/floAddressInfo/${floId}`)
      .then((r) => r.ok ? r.json() : null)
      .then(async (j) => {
        const direct = j?.floAddressBalances?.usdai?.balance ?? j?.floAddressBalances?.USDAI?.balance;
        if (direct != null && Number(direct) > 0) return direct;
        return await sumUsdaiHistory(floId);
      })
      .catch(() => null);

  const floPromise = (typeof floBlockchainAPI !== "undefined" && floBlockchainAPI.getBalance)
    ? floBlockchainAPI.getBalance(floId).catch(() => null)
    : Promise.resolve(null);

  const [usdaiBal, floBal] = await Promise.all([usdaiPromise, floPromise]);
  // If user typed a new key while we were fetching, ignore stale result
  if (input.value.trim() !== privKey) return;
  usdaiEl.textContent = usdaiBal == null ? "—" : Number(usdaiBal).toFixed(8).replace(/\.?0+$/, "") + " USDAI";
  floEl.textContent = floBal == null ? "—" : Number(floBal).toFixed(8) + " FLO";
  if (warnEl) {
    const floNum = Number(floBal);
    warnEl.classList.toggle("hidden", !(Number.isFinite(floNum) && floNum < 0.0004));
  }
}

// Enter confirms, Escape cancels while the prompt is open.
document
  .getElementById("usdai_key_prompt_input")
  .addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      resolveUsdaiKeyPrompt(true);
    }
  });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const overlay = document.getElementById("usdai_key_prompt");
    if (!overlay.classList.contains("hidden")) resolveUsdaiKeyPrompt(false);
  }
});

// Update balance as you type, but wait a bit so it doesn't check too often
document
  .getElementById("usdai_key_prompt_input")
  .addEventListener("input", () => {
    clearTimeout(usdaiBalanceDebounce);
    usdaiBalanceDebounce = setTimeout(updateUsdaiKeyPromptBalance, 400);
  });

// Sends `usdaiAmount` from the wallet behind privKey to the platform's
// USDAI payment address. Returns { payerFloId, txid }.
async function sendUsdaiFromKey(privKey, usdaiAmount) {
  let payerFloId;
  try {
    payerFloId = floCrypto.getFloID(privKey);
  } catch (err) {
    throw new Error("Invalid private key.");
  }
  if (!floCrypto.validateFloID(payerFloId, true)) {
    throw new Error("Invalid private key.");
  }

  const address = await marketplaceGetUsdaiPaymentAddress();
  const txid = await floBlockchainAPI.sendTx(
    payerFloId,
    address,
    USDAI_TX_FEE,
    privKey,
    `send ${usdaiAmount} usdai#`,
  );
  return { payerFloId, txid };
}

// Try to redeem the payment, and try again if it's still confirming
async function redeemUsdaiPayment(redeemFn, txid, auth = {}) {
  for (let attempt = 1; attempt <= PAYMENT_REDEEM_MAX_ATTEMPTS; attempt++) {
    try {
      return await redeemFn(txid, auth);
    } catch (err) {
      const msg = String((err && err.message) || err);
      const retryable = msg.includes("not confirmed") || msg.includes("Token API returned 404") || msg.includes("not found");
      if (!retryable || attempt === PAYMENT_REDEEM_MAX_ATTEMPTS) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, PAYMENT_REDEEM_RETRY_MS));
    }
  }
}

// intent: "want_to_buy" | "want_to_sell"
async function marketplaceExpressInterest(propertyId, intent) {
  return signedMarketplaceRequest(
    `/api/properties/${propertyId}/interest`,
    { propertyId },
    { floId: floGlobals.myFloID, intent },
    ["propertyId", "floId", "intent", "time"],
  );
}

// --- Financing (tasks & direct track investment) --------
// Unaffected by the Property bundle model - tasks and track investment
// are independent of which bundle (if any) a track ends up attached to.

async function marketplaceBackTask(taskId, amount, revenueSharePct, usdaiTxid, auth = {}) {
  return signedMarketplaceRequest(
    `/api/financing/tasks/${taskId}/back`,
    { taskId },
    { financierFloId: auth.floId ?? floGlobals.myFloID, amount, revenueSharePct, usdaiTxid },
    ["taskId", "financierFloId", "amount", "revenueSharePct", "usdaiTxid", "time"],
    auth,
  );
}

// Someone steps up to take on a task.
async function marketplaceClaimTask(taskId) {
  return signedMarketplaceRequest(
    `/api/tasks/${taskId}/claim`,
    { taskId },
    { creatorFloId: floGlobals.myFloID },
    ["taskId", "creatorFloId", "time"],
  );
}

// The person doing the work finishes it and delivers the track.
async function marketplaceCompleteTask(taskId, trackId) {
  return signedMarketplaceRequest(
    `/api/tasks/${taskId}/complete`,
    { taskId },
    { creatorFloId: floGlobals.myFloID, trackId },
    ["taskId", "creatorFloId", "trackId", "time"],
  );
}

async function marketplaceInvestInTrack(trackId, amount, revenueSharePct, usdaiTxid, auth = {}) {
  return signedMarketplaceRequest(
    `/api/financing/tracks/${trackId}/invest`,
    { trackId },
    { financierFloId: auth.floId ?? floGlobals.myFloID, amount, revenueSharePct, usdaiTxid },
    ["trackId", "financierFloId", "amount", "revenueSharePct", "usdaiTxid", "time"],
    auth,
  );
}

// --- Special authorized actions ---------------------------------------------

// Checks if the user is allowed to do special things here.
async function marketplaceCheckIsAdmin() {
  const data = await signedMarketplaceRequest(
    `/api/admin/whoami`,
    {},
    { floId: floGlobals.myFloID },
    ["floId", "time"],
  );
  return data.isAdmin;
}

async function marketplaceCreateTask(requesterFloId, brief, budget, componentType) {
  return signedMarketplaceRequest(
    `/api/tasks`,
    {},
    { adminFloId: floGlobals.myFloID, requesterFloId, brief, budget, componentType },
    ["adminFloId", "requesterFloId", "brief", "budget", "componentType", "time"],
  );
}

async function marketplaceCreateCategory(slug, name) {
  return signedMarketplaceRequest(
    `/api/categories`,
    {},
    { adminFloId: floGlobals.myFloID, slug, name },
    ["adminFloId", "slug", "name", "time"],
  );
}

async function marketplaceLogUsageEvent(propertyId, usageType, options = {}) {
  return signedMarketplaceRequest(
    `/api/properties/${propertyId}/usage-events`,
    { propertyId },
    {
      adminFloId: floGlobals.myFloID,
      usageType,
      componentId: options.componentId,
      actorFloId: options.actorFloId,
      rightsDurationDays: options.rightsDurationDays,
      valueType: options.valueType,
      valueAmount: options.valueAmount,
      valueDescription: options.valueDescription,
      metadata: options.metadata,
    },
    ["propertyId", "adminFloId", "usageType", "time"],
  );
}

async function marketplaceRunPipeline() {
  return signedMarketplaceRequest(
    `/api/marketplace/run-pipeline`,
    {},
    { adminFloId: floGlobals.myFloID },
    ["adminFloId", "time"],
  );
}

// Adds a new part of a track to the system right after it goes live.
async function marketplaceRegisterComponent(trackId, categorySlug, componentType, metadata) {
  return signedMarketplaceRequest(
    `/api/tracks/${trackId}/components`,
    { trackId },
    {
      contributorFloId: floGlobals.myFloID,
      categorySlug,
      componentType,
      metadata,
    },
    ["trackId", "contributorFloId", "categorySlug", "componentType", "time"],
  );
}