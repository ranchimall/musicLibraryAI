// Helps securely communicate with the marketplace.
// It ensures that requests are authentic and safe before they are sent.

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
async function signedMarketplaceRequest(path, urlParams, body, fields) {
  const time = Date.now();
  const privKey = await getSigningPrivateKey();
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

// --- Actions anyone can take ------------------------

// intent: "want_to_buy" | "want_to_sell"
async function marketplaceExpressInterest(propertyId, intent) {
  return signedMarketplaceRequest(
    `/api/properties/${propertyId}/interest`,
    { propertyId },
    { floId: floGlobals.myFloID, intent },
    ["propertyId", "floId", "intent", "time"],
  );
}

async function marketplaceBuySlot(propertyId, slotId, floTxid) {
  return signedMarketplaceRequest(
    `/api/properties/${propertyId}/slots/${slotId}/buy`,
    { propertyId, slotId },
    { floId: floGlobals.myFloID, floTxid },
    ["propertyId", "slotId", "floId", "time"],
  );
}

async function marketplaceSellSlot(propertyId, slotId, floTxid) {
  return signedMarketplaceRequest(
    `/api/properties/${propertyId}/slots/${slotId}/sell`,
    { propertyId, slotId },
    { floId: floGlobals.myFloID, floTxid },
    ["propertyId", "slotId", "floId", "time"],
  );
}

async function marketplaceBackTask(taskId, amount, revenueSharePct) {
  return signedMarketplaceRequest(
    `/api/financing/tasks/${taskId}/back`,
    { taskId },
    { financierFloId: floGlobals.myFloID, amount, revenueSharePct },
    ["taskId", "financierFloId", "amount", "revenueSharePct", "time"],
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

async function marketplaceInvestInTrack(trackId, amount, revenueSharePct) {
  return signedMarketplaceRequest(
    `/api/financing/tracks/${trackId}/invest`,
    { trackId },
    { financierFloId: floGlobals.myFloID, amount, revenueSharePct },
    ["trackId", "financierFloId", "amount", "revenueSharePct", "time"],
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