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

// Anyone can back a property financially.
async function marketplaceBackProperty(propertyId, amount, revenueSharePct) {
  return signedMarketplaceRequest(
    `/api/properties/${propertyId}/financing`,
    { propertyId },
    { financierFloId: floGlobals.myFloID, amount, revenueSharePct },
    ["propertyId", "financierFloId", "amount", "time"],
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

// --- Payments -----------------------------------------

async function marketplaceGetPaymentAddress() {
  const data = await marketplaceGetRequest(`/api/marketplace/payment-address`);
  return data.address;
}

// --- Slots: buy/sell -----------------------------------

// floTxid must be a confirmed on-chain payment covering the property's
// current price, sent to the address from marketplaceGetPaymentAddress().
async function marketplaceBuySlot(propertyId, slotId, floTxid) {
  return signedMarketplaceRequest(
    `/api/properties/${propertyId}/slots/${slotId}/buy`,
    { propertyId, slotId },
    { floId: floGlobals.myFloID, floTxid },
    ["propertyId", "slotId", "floId", "time"],
  );
}

// The backend pays the seller out directly - no txid needed from the client.
async function marketplaceSellSlot(propertyId, slotId) {
  return signedMarketplaceRequest(
    `/api/properties/${propertyId}/slots/${slotId}/sell`,
    { propertyId, slotId },
    { floId: floGlobals.myFloID },
    ["propertyId", "slotId", "floId", "time"],
  );
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