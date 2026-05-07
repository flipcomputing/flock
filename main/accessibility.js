import { InputManager } from "./inputmanager.js";
import { ContextManager } from "./context.js";

// Area menu accessed with Ctrl + B to quickly skip to
// different areas on the interface

const AreaManager = {
  overlay: null,
  areas: [
    { selector: "#menuleft", label: "1", name: "Top left menu" },
    { selector: "#menuright", label: "2", name: "Top right menu" },
    { selector: "#renderCanvas", label: "3", name: "Canvas" },
    { selector: "#gizmoButtons", label: "4", name: "Gizmos" },
    { selector: "#resizer", label: "5", pad: -3, name: "Resizer" },
    { selector: ".blocklyToolbox", label: "6", name: "Toolbox" },
    { selector: "svg.blocklySvg", label: "7", name: "Code editor" },
  ],

  init() {
    this.createOverlay();
    this.setupListeners();
  },

  createOverlay() {
    // Create the element dynamically so you don't have to edit index.html
    const div = document.createElement("div");
    div.id = "area-menu-overlay";
    div.className = "hidden";
    div.classList.add("hidden");
    div.setAttribute("role", "dialog");
    div.setAttribute("aria-modal", "true");
    div.setAttribute("aria-label", "Area navigation menu");
    div.tabIndex = -1;
    div.innerHTML = `<div id="area-menu-content"> </div>`;
    document.body.appendChild(div);
    this.overlay = div;
  },

  toggle(show) {
    if (this.overlay) {
      if (show) {
        GizmoMenuManager.toggle(false); // Close gizmo menu if open
        this.renderHighlights();
        setTimeout(() => this.overlay.focus(), 0);
      }
      this.overlay.classList.toggle("hidden", !show);
    }
  },

  setupListeners() {
    InputManager.on("*", "Mod+KeyB", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggle(this.overlay.classList.contains("hidden"));
    });

    InputManager.on("OVERLAY", "Escape", () => this.toggle(false));

    for (let i = 1; i <= 9; i++) {
      InputManager.on("OVERLAY", `Digit${i}`, (e) => {
        e.preventDefault();
        const area = this.areas.find((a) => a.label === String(i));
        if (area) this.activateArea(area);
      });
    }

    const cycleBadges = (reverse) => {
      const badges = [...this.overlay.querySelectorAll(".area-number-badge")];
      if (badges.length === 0) return;
      const currentIndex = badges.indexOf(document.activeElement);
      const nextIndex = reverse
        ? (currentIndex - 1 + badges.length) % badges.length
        : (currentIndex + 1) % badges.length;
      badges[nextIndex].focus();
    };

    InputManager.on("OVERLAY", "Tab", (e) => {
      e.preventDefault();
      cycleBadges(false);
    });
    InputManager.on("OVERLAY", "Shift+Tab", (e) => {
      e.preventDefault();
      cycleBadges(true);
    });

    InputManager.on("OVERLAY", "Enter", (e) => {
      const focused = document.activeElement;
      if (!focused?.classList.contains("area-number-badge")) return;
      e.preventDefault();
      const area = this.areas.find((a) => a.label === focused.innerText);
      if (area) this.activateArea(area);
    });
  },

  // Set the focus to this area and close overlay
  activateArea(area) {
    this.toggle(false); // Close the menu
    const el = document.querySelector(area.selector);
    const focusable =
      el?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ) ?? el; // Focus the area itself if no suitable child

    focusable?.focus();
    if (area.selector === "#gizmoButtons") GizmoMenuManager.toggle(true);
  },

  renderHighlights() {
    const container = document.getElementById("area-menu-content");
    container.innerHTML = ""; // Clear old numbers

    this.areas.forEach((area) => {
      const el = document.querySelector(area.selector);
      if (el && (el.offsetWidth > 0 || el.getBoundingClientRect().width > 0)) {
        const rect = el.getBoundingClientRect();

        const badge = document.createElement("div");
        badge.className = "area-number-badge";
        badge.setAttribute("role", "button");
        badge.setAttribute("aria-label", `${area.label}: ${area.name}`);
        badge.tabIndex = 0; // Make badges focusable
        badge.innerText = area.label;

        // Position the badge in the center of the area
        badge.style.top = `${rect.top + rect.height / 2 - 20}px`;
        badge.style.left = `${rect.left + rect.width / 2 - 20}px`;

        container.appendChild(badge);

        const highlight = document.createElement("div");
        const pad = area.pad ?? 1;
        highlight.className = "area-outline";
        highlight.style.top = `${rect.top - pad}px`;
        highlight.style.left = `${rect.left - pad}px`;
        highlight.style.width = `${rect.width + pad * 2}px`;
        highlight.style.height = `${rect.height + pad * 2}px`;
        container.appendChild(highlight);
      }
    });
  },
};

/* Overlay for gizmo buttons */
const GizmoMenuManager = {
  overlay: null,
  buttons: [
    { id: "showShapesButton", label: "1" },
    { id: "colorPickerButton", label: "2" },
    { id: "positionButton", label: "3" },
    { id: "rotationButton", label: "4" },
    { id: "scaleButton", label: "5" },
    { id: "selectButton", label: "6" },
    { id: "duplicateButton", label: "7" },
    { id: "deleteButton", label: "8" },
    { id: "cameraButton", label: "9" },
  ],

  init() {
    this.createOverlay();
    this.setupListeners();
  },

  createOverlay() {
    const div = document.createElement("div");
    div.id = "gizmo-menu-overlay";
    div.className = "hidden";
    div.innerHTML = `<div id="gizmo-menu-content"></div>`;
    document.body.appendChild(div);
    this.overlay = div;
  },

  isOpen() {
    return !this.overlay.classList.contains("hidden");
  },

  toggle(show) {
    if (!this.overlay) return;
    if (show) {
      this.renderBadges();

      // Check if the Gizmo number shortcut overlay should exit
      this._watcher = () => {
        const ctx = ContextManager.getCurrentContext();
        if (ctx !== "GIZMO" && ctx !== "NAVIGATION") this.toggle(false);
      };
      document.addEventListener("focusin", this._watcher);
      document.addEventListener("pointerdown", this._watcher, {
        capture: true,
      });

      // Focus 1st button if nothing in gizmos is already focused,
      // but if another gizmo is active, leave focus there
      const alreadyFocused = document.activeElement?.closest("#gizmoButtons");

      if (!alreadyFocused) {
        const btn =
          document.querySelector(".gizmo-button.active") ||
          document.getElementById("showShapesButton");
        if (btn && !btn.disabled && btn.offsetParent !== null) btn.focus();
      }
    }
    this.overlay.classList.toggle("hidden", !show);
  },

  setupListeners() {
    // Toggle gizmo menu with Ctrl + G
    InputManager.on("*", "Mod+KeyG", (e) => {
      const ctx = ContextManager.getCurrentContext();
      if (ctx === "TYPING" || ctx === "OVERLAY") return;
      e.preventDefault();
      e.stopPropagation();
      this.toggle(true);
    });

    // Activate gizmo buttons with number keys
    for (let i = 1; i <= 9; i++) {
      InputManager.on("*", `Digit${i}`, () => {
        if (!this.isOpen()) return;
        const entry = this.buttons.find((b) => b.label === String(i));
        if (entry) this.activateButton(entry);
      });
    }

    // Move the gizmo buttons if the window is resized
    const gizmoButtons = document.getElementById("gizmoButtons");
    const resizer = document.getElementById("resizer");
    if (gizmoButtons) {
      new ResizeObserver(() => {
        if (this.isOpen()) this.renderBadges();
      }).observe(gizmoButtons);
    }
    if (resizer) {
      new MutationObserver(() => {
        if (!resizer.classList.contains("resizing") && this.isOpen()) {
          this.renderBadges();
        }
      }).observe(resizer, { attributes: true, attributeFilter: ["class"] });
    }
  },

  activateButton(entry) {
    const el = document.getElementById(entry.id);
    if (!el) return;
    el.focus();
    if (!el.disabled) el.click();
  },

  renderBadges() {
    const container = document.getElementById("gizmo-menu-content");
    container.innerHTML = "";
    this.buttons.forEach((entry) => {
      const el = document.getElementById(entry.id);
      if (!el || el.offsetParent === null) return;
      const rect = el.getBoundingClientRect();
      const badge = document.createElement("div");
      badge.className = "gizmo-key-badge";
      badge.innerText = entry.label;
      badge.style.top = `${rect.top + rect.height + 8}px`;
      badge.style.left = `${rect.left + rect.width / 2}px`;
      container.appendChild(badge);
    });
  },
};

// Modal showing all keyboard shortcuts, accessed with Ctrl + /

// Check their platform (Mac or not Mac) to show the correct modifier key
function isMac() {
  return navigator.platform.toUpperCase().includes("MAC");
}

// List of shortcuts to show in the panel, with categories for grouping
function getShortcuts() {
  const mod = isMac() ? "⌘" : "Ctrl";
  return [
    { label: "Show/hide shortcut help", keys: `${mod} + /`, category: "Main" },
    {
      label: "Move between menus, canvas and editor",
      keys: `Tab`,
      category: "Main",
    },
    { label: "Confirm", keys: `Enter`, category: "Main" },
    { label: "Exit", keys: `Esc`, category: "Main" },
    { label: "Play", keys: `${mod} + P`, category: "Main" },
    { label: "Undo", keys: `${mod} + Z`, category: "Main" },
    { label: "Redo", keys: `${mod} + Shift + Z`, category: "Main" },
    {
      label: "Browser navigation bar (overriden shortcuts work from here)",
      keys: `${mod} + L`,
      category: "Main",
    },

    { label: "Main menu", keys: `${mod} + M`, category: "Menu" },
    { label: "Open file", keys: `${mod} + O`, category: "Menu" },
    { label: "Save / export", keys: `${mod} + S`, category: "Menu" },

    {
      label: "Open/close area menu",
      keys: `${mod} + B`,
      category: "Area menu",
    },
    { label: "Toggle area", keys: `Tab`, category: "Area menu" },
    { label: "Select area", keys: `1-9 / Enter`, category: "Area menu" },

    { label: "Code editor", keys: `${mod} + E`, category: "Editor" },
    {
      label: "Add block by name",
      keys: `${mod} + ]`,
      category: "Editor",
    },
    { label: "Search for a block", keys: `${mod} + F`, category: "Editor" },
    { label: "Move through blocks", keys: `↑ ↓ ← →`, category: "Editor" },

    { label: "Gizmos", keys: `${mod} + G`, category: "Gizmos" },
    {
      label: "Select gizmo",
      keys: `1-9`,
      category: "Gizmos",
    },

    {
      label: "Keyboard cursor for gizmos",
      keys: `↑ ↓ ← →`,
      category: "Gizmos",
    },
    {
      label: "Lock transform to axis",
      keys: `X Y Z`,
      category: "Gizmos",
    },
    { label: "Transform in 3D", keys: `↑ ↓ ← → PgUp PgDn`, category: "Gizmos" },
    { label: "Focus camera on object", keys: `F`, category: "Gizmos" },

    {
      label: "Quick use colour in colour picker",
      keys: `P`,
      category: "Gizmos",
    },
    { label: "Delete object", keys: `Del`, category: "Gizmos" },
  ];
}

// Formats keys for menu nicely
// You can use + or / and these won't be <kbd> tagged
function formatKeys(keys) {
  return keys
    .split(/( \+ | \/ )/)
    .map((part) =>
      part === " + " || part === " / "
        ? part
        : part
            .split(" ")
            .map((k) => `<kbd>${k}</kbd>`)
            .join(" "),
    )
    .join("");
}

const ShortcutsPanel = {
  panel: null,
  dock: "left",
  previousFocus: null,

  init() {
    this.createPanel();
    this.setupListeners();
  },

  createPanel() {
    const div = document.createElement("div");
    div.id = "shortcutsPanel";
    div.className = "shortcuts-panel hidden shortcuts-panel--left";
    div.setAttribute("role", "region");
    div.setAttribute("aria-label", "Keyboard shortcuts");
    div.tabIndex = 0;
    div.innerHTML = `      
        <button type="button" class="close-button" id="closeShortcutsPanel" aria-label="Close keyboard shortcuts">&times;</button>
        <h1 id="shortcuts-panel-title">Keyboard shortcuts</h1>
        <table id="shortcuts-table"><tbody></tbody></table>
      `;
    document.body.appendChild(div);
    this.panel = div;
  },

  show() {
    const tbody = this.panel.querySelector("tbody");
    const groups = getShortcuts().reduce((acc, s) => {
      (acc[s.category] ??= []).push(s);
      return acc;
    }, {});
    tbody.innerHTML = Object.entries(groups)
      .map(
        ([cat, items]) => `
      <tr><th colspan="2">${cat}</th></tr>
      ${items.map(({ label, keys }) => `<tr><td>${label}</td><td>${formatKeys(keys)}</td></tr>`).join("")}
    `,
      )
      .join("");
    this.previousFocus = document.activeElement;
    this.panel.classList.remove("hidden");
    this.panel.focus();
  },

  hide() {
    this.previousFocus?.focus();
    this.previousFocus = null;
    this.panel.classList.add("hidden");
  },

  toggle() {
    this.panel.classList.contains("hidden") ? this.show() : this.hide();
  },

  setDock(side) {
    this.dock = side;
    this.panel.classList.toggle("shortcuts-panel--left", side === "left");
    this.panel.classList.toggle("shortcuts-panel--right", side === "right");
  },

  setupListeners() {
    // Not handled by InputManager as they are set specifically
    // to listen when the panel has focus, not globally
    document.addEventListener("click", (e) => {
      if (e.target.id === "closeShortcutsPanel") this.hide();
    });
    this.panel.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        this.setDock("left");
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        this.setDock("right");
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        this.panel.scrollBy({ top: -100, behavior: "instant" });
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.panel.scrollBy({ top: 100, behavior: "instant" });
      }
      if (e.key === "Tab" || e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
      }
    });
  },
};

// Start it up
AreaManager.init();
GizmoMenuManager.init();
ShortcutsPanel.init();

export { ShortcutsPanel, GizmoMenuManager };
