// ── Bootstrap ──────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  try {
    App.init();
  } catch (err) {
    console.error("LabTrack init error:", err);
  }
});

// ── App shell ──────────────────────────────────────────────────────────────

const App = {
  currentPage: "dashboard",
  _pageCleanup: null, // called before rendering a new page (remove fixed bars etc.)

  init() {
    this.bindNav();
    this.navigate("dashboard");
    this.updateLabName();
  },

  navigate(page) {
    if (this._pageCleanup) {
      this._pageCleanup();
      this._pageCleanup = null;
    }
    this.currentPage = page;
    this.updateBadges();
    this.setActiveNav(page);
    this.renderPage(page);
  },

  bindNav() {
    // Only bind the actual buttons — not the li containers — to avoid double-firing
    document.querySelectorAll(".sidebar-btn[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => this.navigate(btn.dataset.page));
    });
    document.querySelectorAll(".tab-btn[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => this.navigate(btn.dataset.page));
    });
    document.getElementById("alert-badge").addEventListener("click", () => {
      this.navigate("reorder");
    });
  },

  setActiveNav(page) {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === page);
    });
    document.querySelectorAll(".sidebar-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === page);
    });
    // Sidebar pill needs layout to be settled — use rAF
    requestAnimationFrame(() => {
      const activeBtn = document.querySelector(`.sidebar-btn[data-page="${page}"]`);
      const pill      = document.getElementById("sidebar-pill");
      const navList   = document.getElementById("sidebar-nav");
      if (activeBtn && pill && navList) {
        const navTop = navList.getBoundingClientRect().top;
        const btn    = activeBtn.getBoundingClientRect();
        pill.style.top    = `${btn.top - navTop}px`;
        pill.style.height = `${btn.height}px`;
      }
    });
  },

  updateBadges() {
    const count = Storage.getReorderQueue().length;
    const alertBadge   = document.getElementById("alert-badge");
    const alertCount   = document.getElementById("alert-count");
    const sidebarBadge = document.getElementById("sidebar-badge");
    const tabBadge     = document.getElementById("tab-badge");

    alertBadge.hidden   = count === 0;
    sidebarBadge.hidden = count === 0;
    tabBadge.hidden     = count === 0;

    if (count > 0) {
      alertCount.textContent   = count;
      sidebarBadge.textContent = count;
      tabBadge.textContent     = count;
    }
  },

  updateLabName() {
    const s = Storage.getSettings();
    document.getElementById("topbar-lab-name").textContent = s.labName || "LabTrack";
    document.getElementById("sidebar-lab-name").textContent = s.labName || "";
  },

  renderPage(page) {
    const main     = document.getElementById("main");
    const renderer = Pages[page];
    if (!renderer) return;
    main.innerHTML = "";
    try {
      main.appendChild(renderer());
    } catch (err) {
      console.error(`LabTrack: error rendering page "${page}":`, err);
      main.innerHTML = `<div class="page"><div class="no-items-msg"><strong>Error loading page</strong><span>Check the browser console for details.</span></div></div>`;
    }
  },
};

// ── DOM helpers ────────────────────────────────────────────────────────────

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);

  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === "className")   { node.className   = v; }
      else if (k === "textContent") { node.textContent = String(v); }
      else if (k === "innerHTML")   { node.innerHTML   = v; }
      else if (k === "value")       { node.value       = v; }
      else if (k === "checked")     { node.checked     = v; }
      else if (k === "disabled")    { node.disabled    = v; }
      else if (k === "selected")    { node.selected    = v; }
      else { node.setAttribute(k, v); }
    }
  }

  for (const child of children.flat(Infinity)) {
    if (child == null) continue;
    if (typeof child === "string" || typeof child === "number") {
      node.appendChild(document.createTextNode(String(child)));
    } else {
      node.appendChild(child);
    }
  }

  return node;
}

// Convenience: create an SVG icon element from a raw path/shape string
function svgIcon(pathInnerHTML, size = 20) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = pathInnerHTML;
  return svg;
}

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function openModal(contentEl) {
  const backdrop = document.getElementById("modal-backdrop");
  backdrop.hidden = false;

  const existing = document.getElementById("active-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.id = "active-modal";
  modal.appendChild(contentEl);
  document.body.appendChild(modal);

  backdrop.onclick = closeModal;
}

function closeModal() {
  const modal = document.getElementById("active-modal");
  if (modal) modal.remove();
  document.getElementById("modal-backdrop").hidden = true;
}

function timeAgo(isoString) {
  const diff  = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function getStockStatus(item) {
  if (!item.reorderThreshold)                            return "none";
  if (item.quantity <= item.reorderThreshold)            return "red";
  if (item.quantity <= item.reorderThreshold * 1.5)     return "amber";
  return "green";
}

function getStockPercent(item) {
  const max = Math.max(item.reorderThreshold * 3, item.quantity, 1);
  return Math.min(100, Math.round((item.quantity / max) * 100));
}

function closeX() {
  return el("button", { className: "modal-close", "aria-label": "Close" },
    svgIcon(`<path d="M4 4l12 12M16 4L4 16" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>`, 20)
  );
}

// ── Pages ──────────────────────────────────────────────────────────────────

const Pages = {

  // ── Dashboard ────────────────────────────────────────────────────────────

  dashboard() {
    const s        = Storage.getSettings();
    const allItems = Storage.getItems();
    const items    = allItems.filter((i) => i.status === "active" || i.status === "order_sent");
    const queueIds = Storage.getReorderQueue();
    const history  = Storage.getOrderHistory();
    const activity = Storage.getActivity();

    const page = el("div", { className: "page" });

    // Greeting
    const hour     = new Date().getHours();
    const tod      = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const greeting = s.researcherName ? `${tod}, ${s.researcherName}` : tod;
    const subline  = s.labName || "Streamline your lab ordering";
    page.appendChild(
      el("div", { className: "greeting-bar" },
        el("h1", { textContent: greeting }),
        el("p",  { textContent: subline })
      )
    );

    // Stat cards
    const statGrid = el("div", { className: "stat-grid" });
    const stats = [
      { label: "Total Items",   value: items.length,    cls: "",                                 navPage: "inventory" },
      { label: "Reorder Queue", value: queueIds.length, cls: queueIds.length > 0 ? "red" : "",  navPage: "reorder"   },
      { label: "Past Orders",   value: history.length,  cls: "",                                 navPage: "history"   },
    ];
    stats.forEach(({ label, value, cls, navPage }) => {
      const card = el("div", { className: "stat-card" });
      card.style.cursor = "pointer";
      card.appendChild(el("div", { className: "stat-label",              textContent: label }));
      card.appendChild(el("div", { className: `stat-value ${cls}`.trim(), textContent: String(value) }));
      card.addEventListener("click", () => App.navigate(navPage));
      statGrid.appendChild(card);
    });
    page.appendChild(statGrid);

    // Quick actions
    page.appendChild(el("div", { className: "section-heading", textContent: "Quick Actions" }));
    const actionGrid = el("div", { className: "module-grid" });
    const actions = [
      {
        name:      "Browse Inventory",
        desc:      `${items.length} item${items.length !== 1 ? "s" : ""}`,
        navPage:   "inventory",
        iconClass: "blue",
        icon:      `<rect x="2" y="3" width="16" height="3" rx="1" fill="currentColor"/><rect x="2" y="8.5" width="16" height="3" rx="1" fill="currentColor" opacity=".5"/><rect x="2" y="14" width="16" height="3" rx="1" fill="currentColor" opacity=".3"/>`,
      },
      {
        name:      "Repeat a Past Order",
        desc:      history.length > 0 ? `${history.length} past order${history.length !== 1 ? "s" : ""}` : "No orders yet",
        navPage:   "history",
        iconClass: history.length > 0 ? "amber" : "muted",
        icon:      `<path d="M3 10a7 7 0 1 0 7-7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><path d="M3 4v6h6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
      },
    ];
    actions.forEach((mod) => {
      const card   = el("div", { className: "module-card" });
      const iconEl = el("div", { className: `module-icon ${mod.iconClass}` });
      const svg    = svgIcon(mod.icon, 20);
      svg.style.width  = "16px";
      svg.style.height = "16px";
      iconEl.appendChild(svg);
      card.appendChild(iconEl);
      card.appendChild(el("div", { className: "module-name", textContent: mod.name }));
      card.appendChild(el("div", { className: "module-desc", textContent: mod.desc }));
      card.style.cursor = "pointer";
      card.addEventListener("click", () => App.navigate(mod.navPage));
      actionGrid.appendChild(card);
    });
    page.appendChild(actionGrid);

    // Activity feed
    page.appendChild(el("div", { className: "section-heading", textContent: "Recent Activity" }));
    if (activity.length === 0) {
      page.appendChild(el("div", { className: "empty-state", textContent: "No activity yet" }));
    } else {
      const list = el("div", { className: "activity-list" });
      const ACTION_LABELS = { added: "added", updated: "updated", deleted: "deleted", reordered: "reordered", order_sent: "order sent" };
      activity.slice(0, 8).forEach((entry) => {
        const row = el("div", { className: "activity-item" });
        row.appendChild(el("div", { className: `activity-dot ${entry.action}` }));
        const info = el("div", { className: "activity-text" });
        info.appendChild(el("div", { className: "activity-name", textContent: entry.itemName }));
        info.appendChild(el("div", { className: "text-muted",    textContent: ACTION_LABELS[entry.action] || entry.action, style: "font-size:11px" }));
        row.appendChild(info);
        row.appendChild(el("div", { className: "activity-time", textContent: timeAgo(entry.at) }));
        list.appendChild(row);
      });
      page.appendChild(list);
    }

    return page;
  },

  // ── Inventory ─────────────────────────────────────────────────────────────

  inventory() {
    const page        = el("div", { className: "page" });
    const selectedIds = new Set();
    let   deleteMode  = false;
    let   visibleItems = [];

    // ── Header (rebuilt from scratch on each mode change) ──
    const heading  = el("div", { className: "page-heading" });
    heading.appendChild(el("h1", { className: "page-title", textContent: "Inventory" }));
    const headRight = el("div", { style: "display:flex; gap:8px; align-items:center" });
    heading.appendChild(headRight);
    page.appendChild(heading);

    // ── Search bar ──
    const toolbar    = el("div", { className: "toolbar" });
    const searchWrap = el("div", { className: "search-wrap" });
    searchWrap.appendChild(svgIcon(`<circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="1.75"/><path d="M13 13l3 3" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>`, 20));
    const searchInput = el("input", { className: "search-input", type: "text", placeholder: "Search name, supplier, catalog..." });
    searchWrap.appendChild(searchInput);
    toolbar.appendChild(searchWrap);
    page.appendChild(toolbar);

    const listWrap = el("div", { className: "inv-card-list" });
    page.appendChild(listWrap);
    page.appendChild(el("div", { style: "height:80px" }));

    // ── Floating action bar (push or delete) ──
    const pushBar   = el("div", { className: "push-bar" });
    pushBar.hidden  = true;
    const pushLabel = el("span", { className: "push-bar-label" });
    const pushBtn   = el("button", { className: "btn btn-primary", textContent: "Push to reorder" });
    pushBar.appendChild(pushLabel);
    pushBar.appendChild(pushBtn);
    document.body.appendChild(pushBar);
    App._pageCleanup = () => pushBar.remove();

    // ── Push bar label update ──
    const updatePushBar = () => {
      const n = selectedIds.size;
      pushBar.hidden        = n === 0;
      pushLabel.textContent = `${n} item${n !== 1 ? "s" : ""} selected`;
    };

    // ── Header renderer — only function that touches headRight ──
    const renderInventoryHeader = (mode) => {
      headRight.innerHTML = "";
      const allSelected = visibleItems.length > 0 && visibleItems.every((i) => selectedIds.has(i.id));
      const selectLabel = allSelected ? "Deselect all" : "Select all";

      const toggleSelectAll = () => {
        if (visibleItems.length > 0 && visibleItems.every((i) => selectedIds.has(i.id))) {
          selectedIds.clear();
        } else {
          visibleItems.forEach((i) => selectedIds.add(i.id));
        }
        renderList(searchInput.value.trim());
      };

      if (mode === "normal") {
        const clearBtn = el("button", { className: "btn btn-ghost btn-sm", textContent: "Clear" });
        clearBtn.style.display = selectedIds.size === 0 ? "none" : "";
        clearBtn.addEventListener("click", () => { selectedIds.clear(); renderList(searchInput.value.trim()); });

        const selBtn = el("button", { className: "btn btn-ghost btn-sm", textContent: selectLabel });
        selBtn.addEventListener("click", toggleSelectAll);

        const delBtn = el("button", { className: "btn btn-ghost btn-sm inv-delete-btn", textContent: "Delete" });
        delBtn.addEventListener("click", () => setDeleteMode(true));

        const addBtn = el("button", { className: "btn btn-primary btn-sm", textContent: "+ Add" });
        addBtn.addEventListener("click", () => Modals.itemForm(null, () => renderList(searchInput.value.trim())));

        headRight.appendChild(clearBtn);
        headRight.appendChild(selBtn);
        headRight.appendChild(delBtn);
        headRight.appendChild(addBtn);

      } else {
        const cancelBtn = el("button", { className: "btn btn-ghost btn-sm", textContent: "Cancel" });
        cancelBtn.addEventListener("click", () => setDeleteMode(false));

        const selBtn = el("button", { className: "btn btn-ghost btn-sm", textContent: selectLabel });
        selBtn.addEventListener("click", toggleSelectAll);

        headRight.appendChild(cancelBtn);
        headRight.appendChild(selBtn);
      }
    };

    // ── Mode switch ──
    const setDeleteMode = (on) => {
      deleteMode = on;
      selectedIds.clear();

      if (on) {
        pushBtn.textContent = "Delete selected";
        pushBtn.className   = "btn btn-danger-solid";
        pushBar.classList.add("push-bar-danger");
      } else {
        pushBtn.textContent = "Push to reorder";
        pushBtn.className   = "btn btn-primary";
        pushBar.classList.remove("push-bar-danger");
      }
      pushBar.hidden = true;

      renderList(searchInput.value.trim());
    };

    // ── Delete confirmation sheet ──
    const showDeleteSheet = (ids) => {
      const allItems = Storage.getItems();
      const items    = ids.map((id) => allItems.find((i) => i.id === id)).filter(Boolean);
      if (items.length === 0) return;

      const backdrop = el("div", { className: "confirm-sheet-backdrop" });
      const sheet    = el("div", { className: "confirm-sheet" });

      sheet.appendChild(el("div", { className: "confirm-sheet-handle" }));
      sheet.appendChild(el("div", { className: "confirm-sheet-title",
        textContent: `Delete ${items.length} item${items.length !== 1 ? "s" : ""}?` }));
      sheet.appendChild(el("div", { className: "confirm-sheet-warning",
        textContent: "This cannot be undone." }));

      const nameList = el("div", { className: "confirm-sheet-list" });
      items.forEach((item) => {
        nameList.appendChild(el("div", { className: "confirm-sheet-item", textContent: item.name }));
      });
      sheet.appendChild(nameList);

      const confirmBtn     = el("button", { className: "btn btn-danger-solid",
        textContent: `Delete ${items.length} item${items.length !== 1 ? "s" : ""}` });
      const sheetCancelBtn = el("button", { className: "btn btn-secondary", textContent: "Cancel" });

      sheetCancelBtn.addEventListener("click", () => backdrop.remove());
      confirmBtn.addEventListener("click", () => {
        ids.forEach((id) => Storage.deleteItem(id));
        backdrop.remove();
        setDeleteMode(false);
      });

      sheet.appendChild(el("div", { className: "confirm-sheet-actions" }, confirmBtn, sheetCancelBtn));
      backdrop.appendChild(sheet);
      document.body.appendChild(backdrop);
      backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
    };

    pushBtn.addEventListener("click", () => {
      if (deleteMode) {
        showDeleteSheet([...selectedIds]);
      } else {
        const queue = new Set(Storage.getReorderQueue());
        selectedIds.forEach((id) => queue.add(id));
        Storage.saveReorderQueue([...queue]);
        selectedIds.clear();
        App.updateBadges();
        pushBar.remove();
        App._pageCleanup = null;
        App.navigate("reorder");
      }
    });

    // ── Card renderer ──
    const renderList = (query = "") => {
      let items = Storage.getItems().filter((i) => i.status === "active" || i.status === "order_sent");
      if (query) {
        const q = query.toLowerCase();
        items = items.filter((i) =>
          i.name.toLowerCase().includes(q) ||
          (i.supplier      || "").toLowerCase().includes(q) ||
          (i.catalogNumber || "").toLowerCase().includes(q)
        );
      }
      visibleItems = items;
      listWrap.innerHTML = "";
      if (items.length === 0) {
        listWrap.appendChild(
          el("div", { className: "no-items-msg" },
            el("strong", { textContent: query ? "No results" : "No items yet" }),
            el("span",   { textContent: query ? "Try a different search" : "Tap + Add to get started" })
          )
        );
        updatePushBar();
        renderInventoryHeader(deleteMode ? "delete" : "normal");
        return;
      }

      items.forEach((item) => {
        const selected = selectedIds.has(item.id);
        const selDel   = selected && deleteMode;
        const selNorm  = selected && !deleteMode;
        let cardCls    = "inv-card";
        if (deleteMode) cardCls += " inv-delete-mode";
        if (selNorm)    cardCls += " selected";
        if (selDel)     cardCls += " selected-delete";
        const card = el("div", { className: cardCls });

        // ── Main row: sel · body · right ──
        const mainRow = el("div", { className: "inv-card-main" });

        const sel = el("div", { className: "inv-card-sel" });
        if (deleteMode) {
          sel.appendChild(svgIcon(`<path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>`, 20));
        } else {
          sel.appendChild(svgIcon(`<polyline points="4,10 8,14 16,6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`, 20));
        }
        mainRow.appendChild(sel);

        const body = el("div", { className: "inv-card-body" });
        body.appendChild(el("div", { className: "inv-card-name", textContent: item.name }));
        const subParts = [item.supplier || "No supplier"];
        if (item.catalogNumber) subParts.push(`Cat# ${item.catalogNumber}`);
        body.appendChild(el("div", { className: "inv-card-sub", textContent: subParts.join(" · ") }));
        mainRow.appendChild(body);

        const rightCol = el("div", { className: "inv-card-right" });
        const editBtn  = el("button", { className: "inv-card-edit-btn", "aria-label": "Edit item" });
        editBtn.appendChild(svgIcon(`<path d="M14.5 2.5a2.12 2.12 0 0 1 3 3L6 17l-4 1 1-4Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>`, 16));
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          Modals.inventoryEdit(item, () => renderList(searchInput.value.trim()));
        });
        rightCol.appendChild(editBtn);
        const status = getStockStatus(item);
        const dotCls = { red: "dot-red", amber: "dot-amber", green: "dot-green", none: "dot-muted" }[status] || "dot-muted";
        rightCol.appendChild(el("div", { className: `status-dot ${dotCls}` }));
        mainRow.appendChild(rightCol);

        card.appendChild(mainRow);

        // ── Notes toggle (only when notes exist) ──
        if (item.notes) {
          buildNotesToggle(card, item.notes);
        }

        // Tap to select / deselect (only on main row, not notes toggle)
        mainRow.addEventListener("click", () => {
          if (selectedIds.has(item.id)) {
            selectedIds.delete(item.id);
            card.classList.remove("selected", "selected-delete");
          } else {
            selectedIds.add(item.id);
            card.classList.add(deleteMode ? "selected-delete" : "selected");
          }
          updatePushBar();
          renderInventoryHeader(deleteMode ? "delete" : "normal");
        });

        listWrap.appendChild(card);
      });
      updatePushBar();
      renderInventoryHeader(deleteMode ? "delete" : "normal");
    };

    searchInput.addEventListener("input", () => {
      selectedIds.clear();
      renderList(searchInput.value.trim());
    });

    renderList();
    return page;
  },

  // ── Reorder Queue ─────────────────────────────────────────────────────────

  reorder() {
    const page = el("div", { className: "page" });

    const UNIT_OPTIONS = [
      "Box", "Boxes", "Bottle", "Bottles", "Case", "Cases",
      "Gallon", "Gallons", "Liter", "Liters", "mL",
      "Gram", "Grams", "Kg", "Lbs",
      "Vial", "Vials", "Pack", "Packs",
      "Unit", "Units", "Each",
    ];

    // Order quantities live in memory only — ephemeral, for the email
    const orderQtys = new Map();

    const heading = el("div", { className: "page-heading" });
    heading.appendChild(el("h1", { className: "page-title", textContent: "Reorder Queue" }));
    page.appendChild(heading);

    const listWrap = el("div", { className: "reorder-queue-list" });
    page.appendChild(listWrap);
    page.appendChild(el("div", { style: "height:90px" }));

    // Fixed send button — appended to body, cleaned up on navigate
    const submitBar = el("div", { className: "reorder-submit-bar" });
    const sendBtn   = el("button", { className: "btn btn-primary", textContent: "Send Order Request" });
    submitBar.appendChild(sendBtn);
    document.body.appendChild(submitBar);
    App._pageCleanup = () => submitBar.remove();

    const renderQueue = () => {
      listWrap.innerHTML = "";
      const queueIds = Storage.getReorderQueue();
      const allItems = Storage.getItems();
      const items    = queueIds.map((id) => allItems.find((i) => i.id === id)).filter(Boolean);

      if (items.length === 0) {
        sendBtn.disabled      = true;
        sendBtn.style.opacity = "0.5";
        listWrap.appendChild(
          el("div", { className: "no-items-msg" },
            el("strong", { textContent: "Queue is empty" }),
            el("span",   { textContent: "Go to Inventory and push items to reorder." })
          )
        );
        return;
      }

      sendBtn.disabled      = false;
      sendBtn.style.opacity = "1";

      // Seed order qty defaults — use preset saved on item, else qty 1 / Units
      const matchUnit = (val) => val
        ? (UNIT_OPTIONS.find((u) => u.toLowerCase() === val.toLowerCase()) || "Units")
        : "Units";

      items.forEach((item) => {
        if (!orderQtys.has(item.id)) {
          const presetQty  = item.presetQty  ? Math.max(1, parseInt(item.presetQty) || 1) : 1;
          const presetUnit = matchUnit(item.presetUnit);
          orderQtys.set(item.id, { qty: presetQty, unit: presetUnit });
        }
      });

      items.forEach((item) => {
        const oq  = orderQtys.get(item.id);
        const row = el("div", { className: "reorder-queue-item" });

        // ── Top row: info + remove button ──
        const topRow = el("div", { className: "rq-top-row" });
        const info   = el("div", { className: "reorder-queue-info" });
        info.appendChild(el("div", { className: "reorder-queue-name", textContent: item.name }));
        const subParts = [item.supplier || "No supplier"];
        if (item.catalogNumber) subParts.push(`Cat# ${item.catalogNumber}`);
        info.appendChild(el("div", { className: "reorder-queue-sub", textContent: subParts.join(" · ") }));
        topRow.appendChild(info);

        const removeBtn = el("button", { className: "reorder-queue-remove", "aria-label": "Remove from queue", textContent: "×" });
        removeBtn.addEventListener("click", () => {
          const updated = Storage.getReorderQueue().filter((id) => id !== item.id);
          Storage.saveReorderQueue(updated);
          orderQtys.delete(item.id);
          App.updateBadges();
          renderQueue();
        });
        topRow.appendChild(removeBtn);
        row.appendChild(topRow);

        // ── Qty selector row ──
        const qtyRow = el("div", { className: "rq-qty-row" });

        const downBtn = el("button", { className: "rq-qty-btn", "aria-label": "Decrease quantity" });
        downBtn.appendChild(svgIcon(`<path d="M4 10h12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>`, 20));

        const numInput = el("input", {
          className: "rq-qty-input",
          type:      "number",
          min:       "1",
          value:     String(oq.qty),
          inputmode: "numeric",
        });

        const upBtn = el("button", { className: "rq-qty-btn", "aria-label": "Increase quantity" });
        upBtn.appendChild(svgIcon(`<path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>`, 20));

        const unitSel = document.createElement("select");
        unitSel.className = "rq-unit-select";
        UNIT_OPTIONS.forEach((u) => {
          const opt = document.createElement("option");
          opt.value       = u;
          opt.textContent = u;
          if (u === oq.unit) opt.selected = true;
          unitSel.appendChild(opt);
        });

        // Helpers
        const setQty = (v) => {
          const clamped = Math.max(1, Math.round(v));
          numInput.value = String(clamped);
          orderQtys.set(item.id, { ...orderQtys.get(item.id), qty: clamped });
        };

        downBtn.addEventListener("click", () => setQty((parseInt(numInput.value) || 1) - 1));
        upBtn.addEventListener("click",   () => setQty((parseInt(numInput.value) || 1) + 1));
        numInput.addEventListener("change", () => setQty(parseInt(numInput.value) || 1));
        unitSel.addEventListener("change", () => {
          orderQtys.set(item.id, { ...orderQtys.get(item.id), unit: unitSel.value });
        });

        // Touch-swipe on number input: swipe up = more, swipe down = less
        let touchStartY = 0;
        let touchLastY  = 0;
        numInput.addEventListener("touchstart", (e) => {
          touchStartY = e.touches[0].clientY;
          touchLastY  = touchStartY;
        }, { passive: true });
        numInput.addEventListener("touchmove", (e) => {
          const y     = e.touches[0].clientY;
          const delta = touchLastY - y;
          if (Math.abs(delta) >= 10) {
            setQty((parseInt(numInput.value) || 1) + (delta > 0 ? 1 : -1));
            touchLastY = y;
          }
          e.preventDefault();
        }, { passive: false });

        qtyRow.appendChild(downBtn);
        qtyRow.appendChild(numInput);
        qtyRow.appendChild(upBtn);
        qtyRow.appendChild(unitSel);
        row.appendChild(qtyRow);

        // Notes toggle
        if (item.notes) {
          buildNotesToggle(row, item.notes);
        }

        listWrap.appendChild(row);
      });
    };

    sendBtn.addEventListener("click", () => {
      const queueIds = Storage.getReorderQueue();
      const allItems = Storage.getItems();
      const items    = queueIds.map((id) => allItems.find((i) => i.id === id)).filter(Boolean);
      if (items.length === 0) return;
      // Overlay order quantities so email uses what the user selected here
      const itemsForEmail = items.map((item) => {
        const oq = orderQtys.get(item.id) || { qty: 1, unit: item.unit || "Units" };
        return { ...item, quantity: oq.qty, unit: oq.unit };
      });
      Modals.emailPreview(itemsForEmail);
    });

    renderQueue();
    return page;
  },

  // ── Settings ──────────────────────────────────────────────────────────────

  settings() {
    const s    = Storage.getSettings();
    const page = el("div", { className: "page" });

    page.appendChild(el("h1", { className: "page-title", textContent: "Settings", style: "margin-bottom:16px" }));

    // Lab Info
    const labSection = el("div", { className: "settings-section" });
    labSection.appendChild(el("div", { className: "settings-section-title", textContent: "Lab Info" }));

    const inputs = {};

    const labFields = [
      { key: "labName",        label: "Lab Name",            placeholder: "e.g. Huntsman Cancer Lab",  type: "text" },
      { key: "researcherName", label: "Your Name",           placeholder: "e.g. Dr. Jane Smith",       type: "text" },
      { key: "email",          label: "Order Request Email", placeholder: "you@institution.edu",        type: "email" },
    ];
    labFields.forEach(({ key, label, placeholder, type }) => {
      const grp   = el("div", { className: "form-group" });
      const input = el("input", { className: "form-input", type, placeholder });
      input.value = s[key] || "";
      inputs[key] = input;
      grp.appendChild(el("label", { className: "form-label", textContent: label }));
      grp.appendChild(input);
      labSection.appendChild(grp);
    });
    page.appendChild(labSection);

    // EmailJS
    const emailSection = el("div", { className: "settings-section" });
    emailSection.appendChild(el("div", { className: "settings-section-title", textContent: "EmailJS" }));

    const emailjsFields = [
      { key: "emailjsServiceId",  label: "Service ID",   hint: "Found in your EmailJS dashboard",       placeholder: "service_xxxxxx" },
      { key: "emailjsTemplateId", label: "Template ID",  hint: "The template you created in EmailJS",   placeholder: "template_xxxxxx" },
      { key: "emailjsPublicKey",  label: "Public Key",   hint: "From EmailJS Account > API Keys",       placeholder: "xxxxxxxxxxxxxxxxxxxxxx" },
    ];
    emailjsFields.forEach(({ key, label, hint, placeholder }) => {
      const grp   = el("div", { className: "form-group" });
      const input = el("input", { className: "form-input mono", type: "text", placeholder });
      let displayVal = s[key] || "";
      if (key === "emailjsTemplateId") displayVal = displayVal.replace(/^template_/, "");
      input.value = displayVal;
      inputs[key] = input;
      grp.appendChild(el("label",  { className: "form-label", textContent: label }));
      grp.appendChild(input);
      if (hint) grp.appendChild(el("div", { className: "form-hint", textContent: hint }));
      emailSection.appendChild(grp);
    });
    page.appendChild(emailSection);

    // Backend toggle
    const remoteSection = el("div", { className: "settings-section" });
    remoteSection.appendChild(el("div", { className: "settings-section-title", textContent: "Backend (Advanced)" }));

    const toggleRow  = el("div", { className: "toggle-row" });
    const toggleInfo = el("div", {});
    toggleInfo.appendChild(el("div", { className: "toggle-label", textContent: "Remote backend" }));
    toggleInfo.appendChild(el("div", { className: "toggle-sub",   textContent: "Connect a Supabase instance for multi-user sync" }));

    const toggleWrap  = el("label", { className: "toggle" });
    const toggleCb    = document.createElement("input");
    toggleCb.type     = "checkbox";
    toggleCb.checked  = !!s.remoteBackendEnabled;
    const toggleTrack = el("span", { className: "toggle-track" });
    const toggleThumb = el("span", { className: "toggle-thumb" });
    toggleWrap.appendChild(toggleCb);
    toggleWrap.appendChild(toggleTrack);
    toggleWrap.appendChild(toggleThumb);
    toggleRow.appendChild(toggleInfo);
    toggleRow.appendChild(toggleWrap);
    remoteSection.appendChild(toggleRow);

    const urlGroup = el("div", { className: "form-group", style: `margin-top:12px; display:${s.remoteBackendEnabled ? "flex" : "none"}` });
    const urlInput = el("input", { className: "form-input mono", type: "url", placeholder: "https://xxxx.supabase.co" });
    urlInput.value = s.remoteBackendURL || "";
    inputs.remoteBackendURL = urlInput;
    urlGroup.appendChild(el("label", { className: "form-label", textContent: "Backend URL" }));
    urlGroup.appendChild(urlInput);
    remoteSection.appendChild(urlGroup);

    toggleCb.addEventListener("change", () => {
      urlGroup.style.display = toggleCb.checked ? "flex" : "none";
    });
    inputs.remoteBackendEnabled = toggleCb;
    page.appendChild(remoteSection);

    // Save
    const saveBtn = el("button", { className: "btn btn-primary", textContent: "Save Settings" });
    saveBtn.addEventListener("click", () => {
      const updates = {};
      for (const [key, input] of Object.entries(inputs)) {
        let val = input.type === "checkbox" ? input.checked : input.value.trim();
        if (key === "emailjsTemplateId" && typeof val === "string") {
          val = val.replace(/^template_/, "");
        }
        updates[key] = val;
      }
      Storage.saveSettings(updates);
      App.updateLabName();
      showToast("Settings saved");
    });
    page.appendChild(saveBtn);

    // Import Inventory section
    page.appendChild(el("div", { className: "divider", style: "margin:24px 0" }));
    page.appendChild(Importer.buildSection());

    return page;
  },

  // ── Order History ─────────────────────────────────────────────────────────

  history() {
    const page = el("div", { className: "page" });

    const heading = el("div", { className: "page-heading" });
    heading.appendChild(el("h1", { className: "page-title", textContent: "Order History" }));
    page.appendChild(heading);

    const orders = Storage.getOrderHistory();

    if (orders.length === 0) {
      page.appendChild(
        el("div", { className: "no-items-msg" },
          el("strong", { textContent: "No orders yet" }),
          el("span",   { textContent: "Sent order requests will appear here." })
        )
      );
      return page;
    }

    const list = el("div", { className: "history-list" });

    orders.forEach((order) => {
      const card     = el("div", { className: "history-card" });
      const dateStr  = new Date(order.sentAt).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit",
      });
      card.appendChild(el("div", { className: "history-card-date", textContent: dateStr }));
      card.appendChild(el("div", { className: "history-card-count", textContent: `${order.itemCount} item${order.itemCount !== 1 ? "s" : ""}` }));
      const preview = order.items.slice(0, 3).map((i) => i.name).join(", ") + (order.items.length > 3 ? "…" : "");
      card.appendChild(el("div", { className: "history-card-preview", textContent: preview }));

      card.addEventListener("click", () => {
        const itemIds = order.items.map((i) => i.id);
        Storage.saveReorderQueue(itemIds);
        App.updateBadges();
        App.navigate("reorder");
      });

      list.appendChild(card);
    });

    page.appendChild(list);
    return page;
  },
};

// ── Item renderers ─────────────────────────────────────────────────────────

function renderItemCards(items) {
  const wrap = el("div", { className: "item-cards" });

  items.forEach((item) => {
    const status  = getStockStatus(item);
    const pct     = getStockPercent(item);
    const flagged = item.reorderThreshold > 0 && item.quantity <= item.reorderThreshold;

    const card = el("div", { className: `item-card${flagged ? " flagged" : ""}` });

    const header   = el("div", { className: "item-card-header" });
    const nameWrap = el("div", {});
    nameWrap.appendChild(el("div", { className: "item-card-name", textContent: item.name }));
    nameWrap.appendChild(el("div", { className: "item-card-cat",  textContent: item.category }));
    header.appendChild(nameWrap);

    const actions = el("div", { className: "item-card-actions" });
    actions.appendChild(actionBtn("Edit", () => Modals.itemForm(item, () => App.navigate("inventory"))));
    actions.appendChild(actionBtn("Qty",  () => Modals.updateQty(item, () => App.navigate("inventory"))));
    header.appendChild(actions);
    card.appendChild(header);

    const qtyRow = el("div", { className: "qty-row" });
    qtyRow.appendChild(el("span", { className: "qty-value mono", textContent: item.quantity }));
    qtyRow.appendChild(el("span", { className: "qty-unit",       textContent: item.unit }));
    qtyRow.appendChild(el("span", { className: "qty-threshold",  textContent: `min ${item.reorderThreshold}` }));
    card.appendChild(qtyRow);

    const barWrap = el("div", { className: "qty-bar-wrap" });
    const bar     = el("div", { className: `qty-bar ${status}` });
    bar.style.width = `${pct}%`;
    barWrap.appendChild(bar);
    card.appendChild(barWrap);

    if (item.supplier) {
      card.appendChild(
        el("div", { className: "text-muted", textContent: item.supplier, style: "font-size:11px; margin-top:8px" })
      );
    }
    if (item.status === "order_sent") {
      card.appendChild(el("span", { className: "chip chip-blue", textContent: "Order Sent", style: "margin-top:8px; display:inline-block" }));
    }

    wrap.appendChild(card);
  });

  return wrap;
}

function renderItemTable(items) {
  const wrap  = el("div", { className: "item-table-wrap" });
  const table = el("table", { className: "item-table" });

  const thead = el("thead", {});
  const hr    = el("tr", {});
  ["Item", "Category", "On hand", "Reorder at", "Supplier", "Status", ""].forEach((h) => {
    hr.appendChild(el("th", { textContent: h }));
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = el("tbody", {});
  items.forEach((item) => {
    const status    = getStockStatus(item);
    const flagged   = item.quantity <= item.reorderThreshold;
    const orderSent = item.status === "order_sent";
    const chipCls   = orderSent ? "chip-blue" : { red: "chip-red", amber: "chip-amber", green: "chip-green", none: "chip-muted" }[status];
    const chipTxt   = orderSent ? "Order Sent" : status === "none" ? "Not configured" : item.quantity === 0 ? "Out of stock" : status === "red" ? "Low stock" : status === "amber" ? "Monitor" : "OK";

    const tr = el("tr", { className: flagged ? "flagged" : "" });

    const nameTd = el("td", {});
    nameTd.appendChild(el("div", { className: "table-name", textContent: item.name }));
    if (item.catalogNumber) {
      nameTd.appendChild(el("div", { className: "text-muted table-mono", textContent: item.catalogNumber, style: "font-size:11px" }));
    }
    tr.appendChild(nameTd);
    tr.appendChild(el("td", { textContent: item.category }));
    tr.appendChild(el("td", { className: "table-mono", textContent: `${item.quantity} ${item.unit}` }));
    tr.appendChild(el("td", { className: "table-mono", textContent: `${item.reorderThreshold} ${item.unit}` }));
    tr.appendChild(el("td", { textContent: item.supplier || "" }));
    tr.appendChild(el("td", {}, el("span", { className: `chip ${chipCls}`, textContent: chipTxt })));

    const actionsTd   = el("td", {});
    const actionsWrap = el("div", { className: "table-actions" });
    actionsWrap.appendChild(actionBtn("Edit", () => Modals.itemForm(item, () => App.navigate("inventory"))));
    actionsWrap.appendChild(actionBtn("Qty",  () => Modals.updateQty(item, () => App.navigate("inventory"))));
    actionsTd.appendChild(actionsWrap);
    tr.appendChild(actionsTd);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

function actionBtn(label, onClick) {
  const btn = el("button", { className: "btn btn-secondary btn-sm", textContent: label });
  btn.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
  return btn;
}

function buildNotesToggle(parentEl, notesText) {
  const wrapper = el("div", { className: "notes-toggle-wrap" });

  const trigger = el("button", { className: "notes-toggle-btn", textContent: "Notes" });
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const expanded = body.classList.toggle("notes-body-open");
    trigger.textContent = expanded ? "Minimize" : "Notes";
  });
  wrapper.appendChild(trigger);

  const body = el("div", { className: "notes-toggle-body" });
  body.appendChild(el("span", { className: "notes-toggle-text", textContent: notesText }));
  wrapper.appendChild(body);

  parentEl.appendChild(wrapper);
}

// ── Modals ─────────────────────────────────────────────────────────────────

const Modals = {

  itemForm(existing, onDone) {
    const isEdit  = !!existing;
    const content = el("div", {});

    const xBtn  = closeX();
    xBtn.addEventListener("click", closeModal);
    const header = el("div", { className: "modal-header" },
      el("div", { className: "modal-title", textContent: isEdit ? "Edit Item" : "Add Item" }),
      xBtn
    );
    content.appendChild(header);

    const textFields = [
      { key: "name",          label: "Item Name",     required: true,  placeholder: "e.g. Ethanol 200 proof" },
      { key: "supplier",      label: "Supplier",       required: false, placeholder: "e.g. Sigma-Aldrich" },
      { key: "catalogNumber", label: "Catalog Number", required: false, placeholder: "e.g. 459836" },
    ];

    const inputs = {};
    textFields.forEach(({ key, label, required, placeholder }) => {
      const grp   = el("div", { className: "form-group" });
      const input = el("input", { className: "form-input", type: "text", placeholder });
      const raw   = existing ? existing[key] : "";
      input.value = raw != null ? String(raw) : "";
      inputs[key] = input;
      grp.appendChild(el("label", { className: "form-label", textContent: label + (required ? " *" : "") }));
      grp.appendChild(input);
      content.appendChild(grp);
    });

    // Notes — multiline textarea
    const notesGrp      = el("div", { className: "form-group" });
    const notesTextarea = document.createElement("textarea");
    notesTextarea.className   = "form-input form-textarea";
    notesTextarea.placeholder = "Optional notes about this item...";
    notesTextarea.rows        = 3;
    notesTextarea.value       = (existing ? existing.notes : "") || "";
    inputs.notes = notesTextarea;
    notesGrp.appendChild(el("label", { className: "form-label", textContent: "Notes" }));
    notesGrp.appendChild(notesTextarea);
    content.appendChild(notesGrp);

    const footer = el("div", { className: "modal-footer" });

    if (isEdit) {
      const deleteBtn = el("button", { className: "btn btn-danger", textContent: "Delete" });
      deleteBtn.addEventListener("click", () => {
        if (!confirm(`Delete "${existing.name}"?`)) return;
        Storage.deleteItem(existing.id);
        App.updateBadges();
        closeModal();
        onDone();
        showToast("Item deleted");
      });
      footer.appendChild(deleteBtn);
    }

    const cancelBtn = el("button", { className: "btn btn-secondary", textContent: "Cancel" });
    cancelBtn.addEventListener("click", closeModal);

    const saveBtn = el("button", { className: "btn btn-primary", textContent: isEdit ? "Save Changes" : "Add Item" });
    saveBtn.addEventListener("click", () => {
      const name = inputs.name.value.trim();
      if (!name) { showToast("Item name is required", "error"); return; }
      const data = {
        name,
        supplier:      inputs.supplier.value.trim(),
        catalogNumber: inputs.catalogNumber.value.trim(),
        notes:         inputs.notes.value.trim(),
        status:        "active",
      };
      if (isEdit) {
        Storage.updateItem(existing.id, data);
        showToast("Item updated");
      } else {
        Storage.saveItem(data);
        showToast("Item added");
      }
      App.updateBadges();
      closeModal();
      onDone();
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    content.appendChild(footer);
    openModal(content);
  },

  updateQty(item, onDone) {
    const content = el("div", {});

    const xBtn = closeX();
    xBtn.addEventListener("click", closeModal);
    content.appendChild(
      el("div", { className: "modal-header" },
        el("div", { className: "modal-title", textContent: "Update Quantity" }),
        xBtn
      )
    );

    content.appendChild(
      el("div", { className: "form-group", style: "margin-top:4px" },
        el("label", { className: "form-label", textContent: item.name }),
        el("div",   { className: "form-hint",  textContent: `Current: ${item.quantity}${item.unit ? " " + item.unit : ""}` })
      )
    );

    const qtyInput = el("input", {
      className: "form-input mono",
      type: "number",
      min: "0",
      style: "font-size:24px; text-align:center; margin-bottom:4px",
    });
    qtyInput.value = String(item.quantity);
    content.appendChild(qtyInput);

    const cancelBtn = el("button", { className: "btn btn-secondary", textContent: "Cancel" });
    cancelBtn.addEventListener("click", closeModal);

    const saveBtn = el("button", { className: "btn btn-primary", textContent: "Update" });
    saveBtn.addEventListener("click", () => {
      const qty = parseFloat(qtyInput.value);
      if (isNaN(qty) || qty < 0) { showToast("Enter a valid quantity", "error"); return; }
      Storage.updateItem(item.id, { quantity: qty });
      App.updateBadges();
      closeModal();
      onDone();
      showToast("Quantity updated");
    });

    content.appendChild(el("div", { className: "modal-footer" }, cancelBtn, saveBtn));
    openModal(content);
    qtyInput.focus();
    qtyInput.select();
  },

  emailPreview(selectedItems) {
    const content = el("div", {});

    const xBtn = closeX();
    xBtn.addEventListener("click", closeModal);
    content.appendChild(
      el("div", { className: "modal-header" },
        el("div", { className: "modal-title", textContent: "Order Request Preview" }),
        xBtn
      )
    );

    const previewText = Email.buildOrderText(selectedItems);
    content.appendChild(el("div", { className: "email-preview", textContent: previewText }));

    const s = Storage.getSettings();
    if (s.email) {
      content.appendChild(el("div", { className: "form-hint", textContent: `Will be sent to: ${s.email}`, style: "margin-bottom:8px" }));
    }

    const configured = Email.isConfigured();
    if (!configured) {
      content.appendChild(
        el("div", { className: "chip chip-amber", textContent: "EmailJS not configured. Go to Settings and add your Service ID, Template ID, and Public Key.", style: "margin-bottom:8px; white-space:normal; border-radius:8px; padding:10px 12px" })
      );
    }

    const cancelBtn = el("button", { className: "btn btn-secondary", textContent: "Cancel" });
    cancelBtn.addEventListener("click", closeModal);

    const sendBtn = el("button", {
      className: "btn btn-primary",
      textContent: configured ? "Send Order Request" : "Configure EmailJS in Settings",
    });
    if (!configured) {
      sendBtn.addEventListener("click", () => { closeModal(); App.navigate("settings"); });
    } else {
      sendBtn.addEventListener("click", async () => {
        sendBtn.disabled     = true;
        sendBtn.textContent  = "Sending...";
        try {
          await Email.send(selectedItems);
          Storage.addOrderToHistory(selectedItems);
          Storage.saveReorderQueue([]);
          selectedItems.forEach((item) => {
            Storage.logActivity("order_sent", item.name, item.id);
            Storage.updateItem(item.id, { presetQty: item.quantity, presetUnit: item.unit });
          });
          App.updateBadges();
          closeModal();
          showToast("Order request sent");
          App.navigate("history");
        } catch (err) {
          sendBtn.disabled    = false;
          sendBtn.textContent = "Send Order Request";
          showToast(err.message || "Failed to send email", "error");
        }
      });
    }

    content.appendChild(el("div", { className: "modal-footer" }, cancelBtn, sendBtn));
    openModal(content);
  },

  inventoryEdit(item, onDone) {
    const content = el("div", {});
    const xBtn = closeX();
    xBtn.addEventListener("click", closeModal);
    content.appendChild(
      el("div", { className: "modal-header" },
        el("div", { className: "modal-title", textContent: "Edit Item" }),
        xBtn
      )
    );

    const textFields = [
      { key: "name",          label: "Item Name",     placeholder: "e.g. Ethanol 200 proof" },
      { key: "supplier",      label: "Supplier",       placeholder: "e.g. Sigma-Aldrich" },
      { key: "catalogNumber", label: "Catalog Number", placeholder: "e.g. 459836" },
    ];

    const inputs = {};
    textFields.forEach(({ key, label, placeholder }) => {
      const grp   = el("div", { className: "form-group" });
      const input = el("input", { className: "form-input", type: "text", placeholder });
      input.value = item[key] != null ? String(item[key]) : "";
      inputs[key] = input;
      grp.appendChild(el("label", { className: "form-label", textContent: label }));
      grp.appendChild(input);
      content.appendChild(grp);
    });

    const notesGrp      = el("div", { className: "form-group" });
    const notesTextarea = document.createElement("textarea");
    notesTextarea.className   = "form-input form-textarea";
    notesTextarea.placeholder = "Optional notes about this item...";
    notesTextarea.rows        = 3;
    notesTextarea.value       = item.notes || "";
    inputs.notes = notesTextarea;
    notesGrp.appendChild(el("label", { className: "form-label", textContent: "Notes" }));
    notesGrp.appendChild(notesTextarea);
    content.appendChild(notesGrp);

    const cancelBtn = el("button", { className: "btn btn-secondary", textContent: "Cancel" });
    cancelBtn.addEventListener("click", closeModal);

    const saveBtn = el("button", { className: "btn btn-primary", textContent: "Save" });
    saveBtn.addEventListener("click", () => {
      const name = inputs.name.value.trim();
      if (!name) { showToast("Item name is required", "error"); return; }
      Storage.updateItem(item.id, {
        name,
        supplier:      inputs.supplier.value.trim(),
        catalogNumber: inputs.catalogNumber.value.trim(),
        notes:         inputs.notes.value.trim(),
      });
      App.updateBadges();
      closeModal();
      onDone();
      showToast("Item updated");
    });

    content.appendChild(el("div", { className: "modal-footer" }, cancelBtn, saveBtn));
    openModal(content);
  },
};

// ── Importer ───────────────────────────────────────────────────────────────

const Importer = {

  FIELDS: {
    name:          "Item Name",
    supplier:      "Company",
    catalogNumber: "Catalog #",
    notes:         "Notes",
    presetQty:     "Preset Quantity",
    presetUnit:    "Preset Unit",
  },

  ALIASES: {
    name:          ["name", "item", "item name", "product", "reagent", "chemical", "material", "description"],
    supplier:      ["supplier", "company", "vendor", "manufacturer", "brand"],
    catalogNumber: ["catalog #", "catalog", "catalog number", "catalog#", "catalog no", "cat #", "cat no", "sku", "part number", "item number", "part #"],
    notes:         ["notes", "note", "comment", "comments", "remarks", "memo"],
    presetQty:     ["preset quantity", "preset qty", "order quantity", "order qty", "default quantity", "default qty", "reorder quantity", "reorder qty"],
    presetUnit:    ["preset unit", "order unit", "default unit", "reorder unit", "unit"],
  },

  // ── Build Settings UI section ────────────────────────────────────────────

  buildSection() {
    const section = el("div", { className: "settings-section" });
    section.appendChild(el("div", { className: "settings-section-title", textContent: "Import Inventory" }));
    section.appendChild(el("div", { className: "form-hint", textContent: "Upload a CSV or Excel file to import items. Existing fields will be mapped automatically.", style: "margin-bottom:14px" }));

    const dropZone    = el("div", { className: "import-drop-zone" });
    const fileInput   = document.createElement("input");
    fileInput.type    = "file";
    fileInput.accept  = ".csv,.xlsx,.xls";
    fileInput.style.display = "none";
    section.appendChild(fileInput);

    const uploadIcon = svgIcon(`<path d="M10 3v9M6 7l4-4 4 4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 14v1a2 2 0 002 2h10a2 2 0 002-2v-1" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>`, 24);
    uploadIcon.style.cssText = "width:32px;height:32px;color:var(--blue);margin-bottom:8px";
    dropZone.appendChild(uploadIcon);
    dropZone.appendChild(el("div", { className: "import-drop-label",  textContent: "Click to choose a file or drag and drop" }));
    dropZone.appendChild(el("div", { className: "import-drop-hint",   textContent: "Supports .xlsx, .xls, and .csv" }));

    dropZone.addEventListener("click", () => fileInput.click());

    dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("drag-over"); });
    dropZone.addEventListener("dragleave", ()  => dropZone.classList.remove("drag-over"));
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("drag-over");
      const file = e.dataTransfer.files[0];
      if (file) this.handleFile(file);
    });

    fileInput.addEventListener("change", () => {
      if (fileInput.files[0]) this.handleFile(fileInput.files[0]);
      fileInput.value = ""; // reset so same file can be re-selected
    });

    section.appendChild(dropZone);
    return section;
  },

  // ── File handling ────────────────────────────────────────────────────────

  async handleFile(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext)) {
      showToast("Only .csv, .xlsx, and .xls files are supported", "error");
      return;
    }

    showToast("Reading file...", "info");

    try {
      const { headers, rows } = await this.parseFile(file, ext);
      if (headers.length === 0 || rows.length === 0) {
        showToast("The file appears to be empty", "error");
        return;
      }

      const mapping = this.autoMap(headers);
      const unmatched = headers.filter((h) => !mapping[h]);

      if (unmatched.length > 0) {
        this.showMappingModal(headers, mapping, rows);
      } else {
        this.showConfirmModal(headers, mapping, rows);
      }
    } catch (err) {
      showToast(err.message || "Failed to read file", "error");
    }
  },

  async parseFile(file, ext) {
    if (ext === "csv") {
      const text = await file.text();
      return this.parseCSV(text);
    }
    await this.loadXLSX();
    const buffer = await file.arrayBuffer();
    const wb     = XLSX.read(buffer, { type: "array" });
    const ws     = wb.Sheets[wb.SheetNames[0]];
    const raw    = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    if (!raw.length) return { headers: [], rows: [] };
    const headers = raw[0].map((h) => String(h).trim());
    const rows    = raw.slice(1)
      .filter((r) => r.some((c) => c !== "" && c != null))
      .map((r) => headers.map((_, i) => String(r[i] ?? "").trim()));
    return { headers, rows };
  },

  parseCSV(text) {
    const lines = text.split(/\r?\n/);
    const parse = (line) => {
      const cells = [];
      let cur = "", inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if (ch === "," && !inQ) {
          cells.push(cur.trim()); cur = "";
        } else {
          cur += ch;
        }
      }
      cells.push(cur.trim());
      return cells;
    };
    const nonEmpty = lines.filter((l) => l.trim());
    if (nonEmpty.length < 2) return { headers: [], rows: [] };
    const headers = parse(nonEmpty[0]);
    const rows    = nonEmpty.slice(1).map(parse).filter((r) => r.some((c) => c !== ""));
    return { headers, rows };
  },

  loadXLSX() {
    return new Promise((resolve, reject) => {
      if (window.XLSX) { resolve(); return; }
      const s   = document.createElement("script");
      s.src     = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      s.onload  = resolve;
      s.onerror = () => reject(new Error("Failed to load SheetJS. Check your internet connection."));
      document.head.appendChild(s);
    });
  },

  autoMap(headers) {
    const mapping = {};
    const used    = new Set(); // prevent two headers mapping to the same field

    headers.forEach((header) => {
      const norm = header.toLowerCase().trim();
      for (const [field, aliases] of Object.entries(this.ALIASES)) {
        if (!used.has(field) && aliases.includes(norm)) {
          mapping[header] = field;
          used.add(field);
          break;
        }
      }
    });

    return mapping;
  },

  rowsToItems(headers, rows, mapping) {
    return rows.map((row) => {
      const item = { status: "active" };
      headers.forEach((header, i) => {
        const field = mapping[header];
        if (!field) return;
        const val = row[i] || "";
        if (field === "quantity" || field === "reorderThreshold" || field === "presetQty") {
          item[field] = parseFloat(val) || 0;
        } else {
          item[field] = val;
        }
      });
      return item;
    }).filter((item) => item.name && item.name.trim());
  },

  // ── Column mapping modal ─────────────────────────────────────────────────

  showMappingModal(headers, autoMapping, rows) {
    const content = el("div", {});

    const xBtn = closeX();
    xBtn.addEventListener("click", closeModal);
    content.appendChild(
      el("div", { className: "modal-header" },
        el("div", { className: "modal-title", textContent: "Map Columns" }),
        xBtn
      )
    );
    content.appendChild(el("div", { className: "form-hint", textContent: `${rows.length} rows found. Match each column to the correct field.`, style: "margin-bottom:14px" }));

    const fieldOptions = [
      ["", "Ignore this column"],
      ...Object.entries(this.FIELDS).map(([k, v]) => [k, v]),
    ];

    const selectMap = {}; // header -> <select>

    headers.forEach((header) => {
      const row = el("div", { className: "mapping-row" });
      row.appendChild(el("div", { className: "mapping-col-name", textContent: header }));

      const sel = document.createElement("select");
      sel.className = "form-input";
      sel.style.cssText = "font-size:14px; min-height:40px; padding:8px 10px";
      fieldOptions.forEach(([val, label]) => {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = label;
        if (autoMapping[header] === val) opt.selected = true;
        sel.appendChild(opt);
      });
      selectMap[header] = sel;
      row.appendChild(sel);
      content.appendChild(row);
    });

    const cancelBtn = el("button", { className: "btn btn-secondary", textContent: "Cancel" });
    cancelBtn.addEventListener("click", closeModal);

    const nextBtn = el("button", { className: "btn btn-primary", textContent: "Continue" });
    nextBtn.addEventListener("click", () => {
      const resolvedMapping = {};
      headers.forEach((h) => {
        const v = selectMap[h].value;
        if (v) resolvedMapping[h] = v;
      });
      const hasName = Object.values(resolvedMapping).includes("name");
      if (!hasName) {
        showToast("Map at least one column to Item Name", "error");
        return;
      }
      closeModal();
      this.showConfirmModal(headers, resolvedMapping, rows);
    });

    content.appendChild(el("div", { className: "modal-footer" }, cancelBtn, nextBtn));
    openModal(content);
  },

  // ── Import confirm modal ─────────────────────────────────────────────────

  showConfirmModal(headers, mapping, rows) {
    const items = this.rowsToItems(headers, rows, mapping);
    if (items.length === 0) {
      showToast("No valid rows found. Make sure the Item Name column is mapped.", "error");
      return;
    }

    const content = el("div", {});

    const xBtn = closeX();
    xBtn.addEventListener("click", closeModal);
    content.appendChild(
      el("div", { className: "modal-header" },
        el("div", { className: "modal-title", textContent: "Import Ready" }),
        xBtn
      )
    );

    content.appendChild(
      el("div", { className: "import-summary-box" },
        el("div", { className: "import-summary-count", textContent: items.length }),
        el("div", { textContent: `item${items.length !== 1 ? "s" : ""} ready to import` })
      )
    );

    // Preview first 3 items
    if (items.length > 0) {
      const preview = el("div", { style: "margin-bottom:14px" });
      preview.appendChild(el("div", { className: "form-hint", textContent: "Preview (first 3 items):", style: "margin-bottom:6px" }));
      items.slice(0, 3).forEach((item) => {
        preview.appendChild(
          el("div", { className: "import-preview-row" },
            el("span", { className: "import-preview-name", textContent: item.name }),
            el("span", { className: "import-preview-cat",  textContent: [item.supplier, item.catalogNumber].filter(Boolean).join(" · ") })
          )
        );
      });
      content.appendChild(preview);
    }

    // Merge vs replace
    content.appendChild(el("div", { className: "form-label", textContent: "Import mode", style: "margin-bottom:8px" }));
    const modeWrap   = el("div", { className: "import-mode-group" });
    const mergeRadio = document.createElement("input");
    mergeRadio.type = "radio"; mergeRadio.name = "import-mode"; mergeRadio.value = "merge"; mergeRadio.checked = true;
    const replaceRadio = document.createElement("input");
    replaceRadio.type = "radio"; replaceRadio.name = "import-mode"; replaceRadio.value = "replace";

    modeWrap.appendChild(el("label", { className: "import-mode-label" }, mergeRadio, el("span", { textContent: "Merge with current inventory" })));
    modeWrap.appendChild(el("label", { className: "import-mode-label" }, replaceRadio, el("span", { textContent: "Replace all existing items" })));
    content.appendChild(modeWrap);

    const cancelBtn = el("button", { className: "btn btn-secondary", textContent: "Cancel" });
    cancelBtn.addEventListener("click", closeModal);

    const importBtn = el("button", { className: "btn btn-primary", textContent: `Import ${items.length} Item${items.length !== 1 ? "s" : ""}` });
    importBtn.addEventListener("click", () => {
      const mode = replaceRadio.checked ? "replace" : "merge";
      const count = this.doImport(items, mode);
      App.updateBadges();
      closeModal();
      showToast(`Imported ${count} item${count !== 1 ? "s" : ""}. Inventory updated.`);
      // Navigate to inventory to show imported items
      App.navigate("inventory");
    });

    content.appendChild(el("div", { className: "modal-footer" }, cancelBtn, importBtn));
    openModal(content);
  },

  // ── Execute import ───────────────────────────────────────────────────────

  doImport(items, mode) {
    if (mode === "replace") {
      Storage.getItems().forEach((i) => Storage.deleteItem(i.id));
    }
    items.forEach((item) => Storage.saveItem(item));
    return items.length;
  },
};
