import { InputManager } from "../main/inputmanager.js";
import { ContextManager } from "../main/context.js";
import { translate } from "../main/translation.js";
import { SHORTCUTS_HELP_URL } from "../config.js";
import { stopCanvasKeyboardMode } from "../ui/canvas-utils.js";

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
    {
      selector: "#blocklyZoomControls",
      label: "8",
      name: "Workspace controls",
      extend: { top: -8 },
    },
  ],

  init() {
    this.createOverlay();
    this.setupListeners();
  },

  createOverlay() {
    // Create the element dynamically so you don't have to edit index.html
    const div = document.createElement("div");
    div.id = "area-menu-overlay";
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
        stopCanvasKeyboardMode(); // Stop canvas keyboard cursor if active
        GizmoMenuManager.toggle(false); // Close gizmo menu if open
        this.renderHighlights();
        this._previousInertStates = new Map();
        document
          .querySelectorAll("body > *:not(#area-menu-overlay)")
          .forEach((el) => {
            this._previousInertStates.set(el, el.inert);
            el.inert = true;
          });
        this.previousFocus = document.activeElement;
        setTimeout(() => this.overlay.focus(), 0);
      } else {
        this._previousInertStates?.forEach(
          (wasInert, el) => (el.inert = wasInert),
        );
        this._previousInertStates = null;
        this.previousFocus?.focus();
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
        ? currentIndex === -1
          ? badges.length - 1
          : (currentIndex - 1 + badges.length) % badges.length
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

    // Re-render if the browser window gets resized
    window.addEventListener("resize", () => {
      if (!this.overlay.classList.contains("hidden")) {
        requestAnimationFrame(() => this.renderHighlights());
      }
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
        const ext = area.extend ?? {};
        const eTop = ext.top ?? 0;
        const eBottom = ext.bottom ?? 0;
        const eLeft = ext.left ?? 0;
        const eRight = ext.right ?? 0;
        highlight.className = "area-outline";
        highlight.style.top = `${rect.top - pad - eTop}px`;
        highlight.style.left = `${rect.left - pad - eLeft}px`;
        highlight.style.width = `${rect.width + pad * 2 + eLeft + eRight}px`;
        highlight.style.height = `${rect.height + pad * 2 + eTop + eBottom}px`;
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
  return (navigator.userAgentData?.platform ?? navigator.platform)
    .toUpperCase()
    .includes("MAC");
}

// List of shortcuts to show in the panel, with categories for grouping
function getShortcuts() {
  const mod = isMac() ? "⌘" : "Ctrl";
  return [
    {
      label: translate("shortcut_show_hide_help"),
      keys: `${mod} + /`,
      category: translate("shortcut_category_main"),
    },
    {
      label: translate("shortcut_move_between_areas"),
      keys: `Tab / Shift + Tab`,
      category: translate("shortcut_category_main"),
    },
    {
      label: translate("shortcut_confirm"),
      keys: `Enter`,
      category: translate("shortcut_category_main"),
    },
    {
      label: translate("shortcut_exit"),
      keys: `Esc`,
      category: translate("shortcut_category_main"),
    },
    {
      label: translate("shortcut_play"),
      keys: `${mod} + P`,
      category: translate("shortcut_category_main"),
    },
    {
      label: translate("shortcut_undo"),
      keys: `${mod} + Z`,
      category: translate("shortcut_category_main"),
    },
    {
      label: translate("shortcut_redo"),
      keys: `${mod} + Shift + Z`,
      category: translate("shortcut_category_main"),
    },
    {
      label: translate("shortcut_browser_nav"),
      keys: `${mod} + L`,
      category: translate("shortcut_category_main"),
    },

    {
      label: translate("shortcut_main_menu"),
      keys: `${mod} + M`,
      category: translate("shortcut_category_menu"),
    },
    {
      label: translate("shortcut_open_file"),
      keys: `${mod} + O`,
      category: translate("shortcut_category_menu"),
    },
    {
      label: translate("shortcut_save_export"),
      keys: `${mod} + S`,
      category: translate("shortcut_category_menu"),
    },

    {
      label: translate("shortcut_open_close_area_menu"),
      keys: `${mod} + B`,
      category: translate("shortcut_category_area_menu"),
    },
    {
      label: translate("shortcut_toggle_area"),
      keys: `Tab`,
      category: translate("shortcut_category_area_menu"),
    },
    {
      label: translate("shortcut_select_area"),
      keys: `1-9 / Enter`,
      category: translate("shortcut_category_area_menu"),
    },

    {
      label: translate("shortcut_toolbox"),
      keys: `T`,
      category: translate("shortcut_category_toolbox"),
    },
    {
      label: translate("shortcut_toolbox_typing"),
      keys: `"${translate("shortcut_toolbox_typing_hint")}"`,
      category: translate("shortcut_category_toolbox"),
    },
    {
      label: translate("shortcut_nav_toolbox_blocks"),
      keys: `↑ ↓ ← →`,
      category: translate("shortcut_category_toolbox"),
    },
    {
      label: translate("shortcut_add_block"),
      keys: `Enter`,
      category: translate("shortcut_category_toolbox"),
    },

    {
      label: translate("shortcut_code_editor"),
      keys: `${mod} + E`,
      category: translate("shortcut_category_editor"),
    },
    {
      label: translate("shortcut_select_workspace"),
      keys: `W`,
      category: translate("shortcut_category_editor"),
    },
    {
      label: translate("shortcut_move_through_blocks"),
      keys: `↑ ↓`,
      category: translate("shortcut_category_editor"),
    },
    {
      label: translate("shortcut_move_in_out_blocks"),
      keys: `← →`,
      category: translate("shortcut_category_editor"),
    },

    {
      label: translate("shortcut_next_block_stack"),
      keys: `N`,
      category: translate("shortcut_category_editor"),
    },
    {
      label: translate("shortcut_prev_block_stack"),
      keys: `B`,
      category: translate("shortcut_category_editor"),
    },
    {
      label: translate("shortcut_add_block_by_name"),
      keys: `${mod} + ]`,
      category: translate("shortcut_category_editor"),
    },
    {
      label: translate("shortcut_context_menu"),
      keys: `${mod} + Enter`,
      category: translate("shortcut_category_editor"),
    },
    {
      label: translate("shortcut_duplicate_block"),
      keys: `D`,
      category: translate("shortcut_category_editor"),
    },
    {
      label: translate("shortcut_detach_block"),
      keys: `X`,
      category: translate("shortcut_category_editor"),
    },
    {
      label: translate("shortcut_start_move_block"),
      keys: `M`,
      category: translate("shortcut_category_editor"),
    },
    {
      label: translate("shortcut_move_arrows"),
      keys: `↑ ↓`,
      category: translate("shortcut_category_editor"),
    },
    {
      label: translate("shortcut_move_anywhere"),
      keys: `${mod} + ↑ ↓ ← →`,
      category: translate("shortcut_category_editor"),
    },
    {
      label: translate("shortcut_search_block"),
      keys: `${mod} + F`,
      category: translate("shortcut_category_editor"),
    },
    {
      label: translate("shortcut_select_next_result"),
      keys: `Enter`,
      category: translate("shortcut_category_editor"),
    },
    {
      label: translate("shortcut_select_previous_result"),
      keys: `Shift + Enter`,
      category: translate("shortcut_category_editor"),
    },
    {
      label: translate("shortcut_focus_result"),
      keys: `Esc`,
      category: translate("shortcut_category_editor"),
    },

    {
      label: translate("shortcut_open_gizmos"),
      keys: `${mod} + G`,
      category: translate("shortcut_category_gizmos"),
    },
    {
      label: translate("shortcut_select_gizmo"),
      keys: `1-9`,
      category: translate("shortcut_category_gizmos"),
    },
    {
      label: translate("shortcut_keyboard_cursor_gizmos"),
      keys: `↑ ↓ ← →`,
      category: translate("shortcut_category_gizmos"),
    },
    {
      label: translate("shortcut_slow_cursor_gizmos"),
      keys: `Shift + ↑ ↓ ← →`,
      category: translate("shortcut_category_gizmos"),
    },
    {
      label: translate("shortcut_lock_transform"),
      keys: `X Y Z`,
      category: translate("shortcut_category_gizmos"),
    },
    {
      label: translate("shortcut_uniform_scale"),
      keys: `U`,
      category: translate("shortcut_category_gizmos"),
    },
    {
      label: translate("shortcut_transform_3d"),
      keys: `↑ ↓ ← → PgUp PgDn`,
      category: translate("shortcut_category_gizmos"),
    },
    {
      label: translate("shortcut_focus_camera"),
      keys: `F`,
      category: translate("shortcut_category_gizmos"),
    },
    {
      label: translate("shortcut_quick_colour"),
      keys: `C`,
      category: translate("shortcut_category_gizmos"),
    },
    {
      label: translate("shortcut_delete_object"),
      keys: `Del`,
      category: translate("shortcut_category_gizmos"),
    },
  ];
}

// Formats keys for menu nicely
// You can use + or / and these won't be <kbd> tagged
function formatKeys(keys) {
  if (keys.startsWith('"') && keys.endsWith('"')) {
    return keys.slice(1, -1);
  }
  return keys
    .split(/( \+ | \/ )/)
    .map((part) =>
      part === " + "
        ? part
        : part === " / "
          ? "<br>"
          : part
              .split(" ")
              .map((k) => `<kbd>${k}</kbd>`)
              .join(" "),
    )
    .join("");
}

const InfoPanel = {
  _tabs: new Map(),
  _activeId: null,

  init() {
    this._el = document.getElementById("info-panel");
    this._tablist = document.getElementById("info-panel-tabs");
    this._body = document.getElementById("info-panel-body");
  },

  register(id, label) {
    const btn = document.createElement("button");
    btn.id = `info-tab-btn-${id}`;
    btn.className = "info-tab-btn bigbutton";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", "false");
    btn.setAttribute("aria-controls", `info-tab-panel-${id}`);
    btn.textContent = label;
    btn.addEventListener("click", () => this.toggle(id));
    this._tablist.appendChild(btn);
    const divider = document.createElement("div");
    divider.className = "toolbar-divider";
    divider.setAttribute("aria-hidden", "true");
    this._tablist.appendChild(divider);

    const panel = document.createElement("div");
    panel.id = `info-tab-panel-${id}`;
    panel.className = "info-tab-panel hidden";
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", `info-tab-btn-${id}`);
    panel.tabIndex = 0;
    this._body.appendChild(panel);

    this._tabs.set(id, { btn, panel });
    return panel;
  },

  activate(id) {
    if (this._activeId && this._activeId !== id) {
      const cur = this._tabs.get(this._activeId);
      cur.btn.setAttribute("aria-selected", "false");
      cur.btn.classList.remove("active");
      cur.panel.classList.add("hidden");
    }
    const tab = this._tabs.get(id);
    if (!tab) return;
    this._activeId = id;
    tab.btn.setAttribute("aria-selected", "true");
    tab.btn.classList.add("active");
    tab.panel.classList.remove("hidden");
    tab.panel.focus();
  },

  deactivate(id) {
    const tab = this._tabs.get(id);
    if (!tab) return;
    tab.btn.setAttribute("aria-selected", "false");
    tab.btn.classList.remove("active");
    tab.panel.classList.add("hidden");
    if (this._activeId === id) this._activeId = null;
  },

  toggle(id) {
    const tab = this._tabs.get(id);
    if (!tab) return;
    tab.panel.classList.contains("hidden")
      ? this.activate(id)
      : this.deactivate(id);
  },
};

const SHORTCUTS_FONT_SIZES = [0.8, 1.0, 1.2, 1.4, 1.6, 1.8];
const SHORTCUTS_FONT_SIZE_KEY = "flock-shortcuts-font-size";
const SHORTCUTS_FONT_SIZE_DEFAULT = 1.2;

const ShortcutsPanel = {
  panel: null,
  previousFocus: null,
  fontSize:
    parseFloat(localStorage.getItem(SHORTCUTS_FONT_SIZE_KEY)) ||
    SHORTCUTS_FONT_SIZE_DEFAULT,

  init() {
    this.createPanel();
    this.setupListeners();
    window.flockShortcutsPanel = this;
  },

  adjustFontSize(delta) {
    const sizes = SHORTCUTS_FONT_SIZES;
    const idx = sizes.indexOf(this.fontSize);
    const next = sizes[Math.max(0, Math.min(sizes.length - 1, idx + delta))];
    if (next === this.fontSize) return;
    this.fontSize = next;
    localStorage.setItem(SHORTCUTS_FONT_SIZE_KEY, next);
    this.panel.querySelector("#shortcuts-table").style.fontSize = next + "em";
    this.panel.querySelector(".shortcuts-decrease-btn").disabled =
      next === sizes[0];
    this.panel.querySelector(".shortcuts-increase-btn").disabled =
      next === sizes[sizes.length - 1];
  },

  createPanel() {
    const panel = InfoPanel.register(
      "shortcuts",
      translate("shortcut_panel_title"),
    );
    const btn = document.getElementById("info-tab-btn-shortcuts");
    btn.setAttribute("aria-label", translate("shortcut_panel_title"));
    btn.setAttribute("title", translate("shortcut_panel_title"));
    btn.innerHTML = `<div class="icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M64 64C28.7 64 0 92.7 0 128L0 384c0 35.3 28.7 64 64 64l448 0c35.3 0 64-28.7 64-64l0-256c0-35.3-28.7-64-64-64L64 64zM175.1 224l16 0c8.8 0 16 7.2 16 16l0 16c0 8.8-7.2 16-16 16l-16 0c-8.8 0-16-7.2-16-16l0-16c0-8.8 7.2-16 16-16zm-72 32c0 8.8-7.2 16-16 16l-16 0c-8.8 0-16-7.2-16-16l0-16c0-8.8 7.2-16 16-16l16 0c8.8 0 16 7.2 16 16l0 16zm128 0c0 8.8-7.2 16-16 16l-16 0c-8.8 0-16-7.2-16-16l0-16c0-8.8 7.2-16 16-16l16 0c8.8 0 16 7.2 16 16l0 16zm128 0c0 8.8-7.2 16-16 16l-16 0c-8.8 0-16-7.2-16-16l0-16c0-8.8 7.2-16 16-16l16 0c8.8 0 16 7.2 16 16l0 16zm72-32l16 0c8.8 0 16 7.2 16 16l0 16c0 8.8-7.2 16-16 16l-16 0c-8.8 0-16-7.2-16-16l0-16c0-8.8 7.2-16 16-16zM80 336c0-8.8 7.2-16 16-16l288 0c8.8 0 16 7.2 16 16l0 16c0 8.8-7.2 16-16 16l-288 0c-8.8 0-16-7.2-16-16l0-16zm336-16l16 0c8.8 0 16 7.2 16 16l0 16c0 8.8-7.2 16-16 16l-16 0c-8.8 0-16-7.2-16-16l0-16c0-8.8 7.2-16 16-16z"/></svg></div>`;
    panel.innerHTML = `
        <div class="shortcuts-panel-header">
          <h2 id="shortcuts-panel-title" class="shortcuts-panel-title"></h2>
          <div class="shortcuts-panel-controls">
            <button class="bigbutton shortcuts-decrease-btn" aria-label="Decrease text size" title="Decrease text size"><span aria-hidden="true">A</span></button>
            <button class="bigbutton shortcuts-increase-btn" aria-label="Increase text size" title="Increase text size"><span aria-hidden="true">A</span></button>
            <a href="${SHORTCUTS_HELP_URL}" target="_blank" rel="noopener noreferrer" class="help-link-button" aria-label="${translate("shortcut_panel_help_link")}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="16" height="16" aria-hidden="true"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path fill="currentColor" d="M320 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l82.7 0L201.4 265.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L448 109.3l0 82.7c0 17.7 14.3 32 32 32s32-14.3 32-32l0-160c0-17.7-14.3-32-32-32L320 0zM80 32C35.8 32 0 67.8 0 112L0 432c0 44.2 35.8 80 80 80l320 0c44.2 0 80-35.8 80-80l0-112c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 112c0 8.8-7.2 16-16 16L80 448c-8.8 0-16-7.2-16-16l0-320c0-8.8 7.2-16 16-16l112 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L80 32z"/></svg></a>
          </div>
        </div>
        <table id="shortcuts-table"><colgroup><col style="width:33%"><col></colgroup><tbody></tbody></table>
      `;
    this.panel = panel;
    const sizes = SHORTCUTS_FONT_SIZES;
    const decreaseBtn = panel.querySelector(".shortcuts-decrease-btn");
    const increaseBtn = panel.querySelector(".shortcuts-increase-btn");
    decreaseBtn.disabled = this.fontSize === sizes[0];
    increaseBtn.disabled = this.fontSize === sizes[sizes.length - 1];
    decreaseBtn.addEventListener("click", () => this.adjustFontSize(-1));
    increaseBtn.addEventListener("click", () => this.adjustFontSize(1));
    panel.querySelector("#shortcuts-table").style.fontSize =
      this.fontSize + "em";
    this.renderContent();
  },

  renderContent() {
    document
      .getElementById("info-tab-btn-shortcuts")
      .setAttribute("aria-label", translate("shortcut_panel_title"));
    this.panel.querySelector("#shortcuts-panel-title").textContent = translate(
      "shortcut_panel_title",
    );
    this.panel
      .querySelector(".help-link-button")
      .setAttribute("aria-label", translate("shortcut_panel_help_link"));
    const tbody = this.panel.querySelector("tbody");
    const groups = getShortcuts().reduce((acc, s) => {
      (acc[s.category] ??= []).push(s);
      return acc;
    }, {});
    tbody.innerHTML = Object.entries(groups)
      .map(
        ([cat, items]) => `
      <tr><th colspan="2" scope="rowgroup">${cat}</th></tr>
      ${items.map(({ label, keys }) => `<tr><td>${label}</td><td>${formatKeys(keys)}</td></tr>`).join("")}
    `,
      )
      .join("");
  },

  show() {
    this.renderContent();
    this.previousFocus = document.activeElement;
    InfoPanel.activate("shortcuts");
    document.getElementById("shortcutsBtn")?.classList.add("active");
  },

  refreshTranslations() {
    this.renderContent();
  },

  hide() {
    this.previousFocus?.focus();
    this.previousFocus = null;
    InfoPanel.deactivate("shortcuts");
    document.getElementById("shortcutsBtn")?.classList.remove("active");
  },

  toggle() {
    this.panel.classList.contains("hidden") ? this.show() : this.hide();
  },

  setupListeners() {
    this.panel.addEventListener("keydown", (e) => {
      const scroller = document.getElementById("info-panel-body");
      if (e.key === "ArrowUp") {
        e.preventDefault();
        scroller?.scrollBy({ top: -100, behavior: "instant" });
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        scroller?.scrollBy({ top: 100, behavior: "instant" });
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
        document.getElementById("info-tab-btn-shortcuts")?.focus();
      }
    });
  },
};

// Start it up
AreaManager.init();
GizmoMenuManager.init();
if (document.getElementById("info-panel-tabs")) {
  InfoPanel.init();
  ShortcutsPanel.init();
}

export { InfoPanel, ShortcutsPanel, GizmoMenuManager };
