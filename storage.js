const CONFIG = {
  mode: "local",   // change to "remote" to switch backends
  remoteURL: null, // paste your Supabase base URL here when ready
};

const KEYS = {
  ITEMS:         "labtrack_items",
  SETTINGS:      "labtrack_settings",
  ACTIVITY:      "labtrack_activity",
  REORDER_QUEUE: "labtrack_reorder_queue",
  ORDER_HISTORY: "labtrack_order_history",
};

// ── Utilities ──────────────────────────────────────────────────────────────

function generateId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function now() {
  return new Date().toISOString();
}

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Remote helpers (used when CONFIG.mode === "remote") ────────────────────
// Switching to remote: set CONFIG.mode = "remote" and CONFIG.remoteURL = "https://..."
// Remote fetch calls are async; app.js storage calls must then use await.

async function remoteFetch(path, opts = {}) {
  const res = await fetch(CONFIG.remoteURL + path, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) throw new Error(`Remote error ${res.status}`);
  return res.json();
}

// ── Items ──────────────────────────────────────────────────────────────────

function getItems() {
  if (CONFIG.mode === "remote") {
    // return remoteFetch("/items");  // returns Promise<Item[]>
    console.warn("LabTrack: remote mode requires async storage calls in app.js");
  }
  return readJSON(KEYS.ITEMS) || [];
}

function getItem(id) {
  if (CONFIG.mode === "remote") {
    // return remoteFetch(`/items/${id}`);
    console.warn("LabTrack: remote mode requires async storage calls in app.js");
  }
  return getItems().find((item) => item.id === id) || null;
}

function saveItem(data) {
  if (CONFIG.mode === "remote") {
    // return remoteFetch("/items", { method: "POST", body: JSON.stringify(data) });
    console.warn("LabTrack: remote mode requires async storage calls in app.js");
  }
  const items = readJSON(KEYS.ITEMS) || [];
  const item = {
    id:            generateId(),
    name:          data.name,
    category:      data.category || "Uncategorized",
    quantity:      Number(data.quantity) || 0,
    unit:          data.unit || "",
    supplier:      data.supplier || "",
    catalogNumber: data.catalogNumber || "",
    notes:         data.notes || "",
    status:        data.status || "active",
    createdAt:     now(),
    updatedAt:     now(),
  };
  items.push(item);
  writeJSON(KEYS.ITEMS, items);
  _logActivity("added", item.name, item.id);
  return item;
}

function updateItem(id, changes) {
  if (CONFIG.mode === "remote") {
    // return remoteFetch(`/items/${id}`, { method: "PATCH", body: JSON.stringify(changes) });
    console.warn("LabTrack: remote mode requires async storage calls in app.js");
  }
  const items = readJSON(KEYS.ITEMS) || [];
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const updated = { ...items[index], ...changes, updatedAt: now() };
  items[index] = updated;
  writeJSON(KEYS.ITEMS, items);
  _logActivity("updated", updated.name, updated.id);
  return updated;
}

function deleteItem(id) {
  if (CONFIG.mode === "remote") {
    // return remoteFetch(`/items/${id}`, { method: "DELETE" });
    console.warn("LabTrack: remote mode requires async storage calls in app.js");
  }
  const items = readJSON(KEYS.ITEMS) || [];
  const item  = items.find((i) => i.id === id);
  if (!item) return false;
  writeJSON(KEYS.ITEMS, items.filter((i) => i.id !== id));
  _logActivity("deleted", item.name, id);
  return true;
}

function getFlaggedItems() {
  return getItems().filter(
    (item) => (item.status === "active" || item.status === "order_sent")
           && item.reorderThreshold > 0
           && item.quantity <= item.reorderThreshold
  );
}

// ── Settings ───────────────────────────────────────────────────────────────

function getSettings() {
  return readJSON(KEYS.SETTINGS) || {
    labName:              "",
    researcherName:       "",
    email:                "",
    emailjsServiceId:     "",
    emailjsTemplateId:    "",
    emailjsPublicKey:     "",
    remoteBackendEnabled: false,
    remoteBackendURL:     "",
  };
}

function saveSettings(data) {
  const settings = { ...getSettings(), ...data };
  writeJSON(KEYS.SETTINGS, settings);
  return settings;
}

// ── Reorder queue ─────────────────────────────────────────────────────────

function getReorderQueue() {
  return readJSON(KEYS.REORDER_QUEUE) || [];
}

function saveReorderQueue(ids) {
  writeJSON(KEYS.REORDER_QUEUE, ids);
}

// ── Order history ──────────────────────────────────────────────────────────

function getOrderHistory() {
  return readJSON(KEYS.ORDER_HISTORY) || [];
}

function addOrderToHistory(items) {
  const history = getOrderHistory();
  const order = {
    id:        generateId(),
    sentAt:    now(),
    itemCount: items.length,
    items:     items.map((i) => ({
      id:            i.id,
      name:          i.name,
      supplier:      i.supplier      || "",
      catalogNumber: i.catalogNumber || "",
      quantity:      i.quantity,
      unit:          i.unit          || "",
    })),
  };
  history.unshift(order);
  writeJSON(KEYS.ORDER_HISTORY, history);
  return order;
}

// ── Activity feed ──────────────────────────────────────────────────────────

function _logActivity(action, itemName, itemId) {
  const activity = readJSON(KEYS.ACTIVITY) || [];
  activity.unshift({ id: generateId(), action, itemName, itemId, at: now() });
  writeJSON(KEYS.ACTIVITY, activity.slice(0, 50));
}

function logActivity(action, itemName, itemId) {
  _logActivity(action, itemName, itemId);
}

function getActivity() {
  return readJSON(KEYS.ACTIVITY) || [];
}

// ── Public API ─────────────────────────────────────────────────────────────

window.Storage = {
  getItems,
  getItem,
  saveItem,
  updateItem,
  deleteItem,
  getFlaggedItems,
  getSettings,
  saveSettings,
  getActivity,
  logActivity,
  getReorderQueue,
  saveReorderQueue,
  getOrderHistory,
  addOrderToHistory,
  CONFIG,
};
