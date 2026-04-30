// Area menu accessed with Ctrl + B to quickly skip to
// different areas on the interface

const AreaManager = {
  overlay: null,
  areas: [
    { selector: "#menuleft", label: "1" }, // Top left menu (line 148 input.js - demo menu is excluded?)
    { selector: "#menuright", label: "2" }, // Top right
    { selector: "#renderCanvas", label: "3" }, // Main canvas
    { selector: "#gizmoButtons", label: "4" }, // Gizmos
    { selector: "#resizer", label: "5", pad: -3 }, // Resizer
    { selector: ".blocklyToolbox", label: "6" }, // Blockly toolbox
    { selector: "svg.blocklySvg", label: "7" }, // Block workspace
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
    div.innerHTML = `<div id="area-menu-content"> </div>`;
    document.body.appendChild(div);
    this.overlay = div;
  },

  toggle(show) {
    if (this.overlay) {
      if (show) {
        this.renderHighlights();
        setTimeout(
          () => this.overlay.querySelector(".area-number-badge")?.focus(),
          0,
        );
      }
      this.overlay.classList.toggle("hidden", !show);
    }
  },

  setupListeners() {
    window.addEventListener(
      "keydown",
      (e) => {
        // Open: Ctrl+B
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
          e.preventDefault();
          this.toggle(this.overlay.classList.contains("hidden"));
        }
        // Close: Escape
        if (e.key === "Escape") {
          this.toggle(false);
        }
        // Handle number keys
        if (e.key >= "1" && e.key <= "9") {
          // Only if the overlay is open (otherwise you can't type numbers)
          if (!this.overlay.classList.contains("hidden")) {
            // Find the area and set the focus
            const area = this.areas.find((a) => a.label === e.key);
            if (area) this.activateArea(area);
          }
        }
        // Tab through badges when overlay is open
        if (e.key === "Tab" && !this.overlay.classList.contains("hidden")) {
          e.preventDefault();
          const badges = [
            ...this.overlay.querySelectorAll(".area-number-badge"),
          ];
          if (badges.length === 0) return;
          const currentIndex = badges.indexOf(document.activeElement);
          const nextIndex = e.shiftKey
            ? (currentIndex - 1 + badges.length) % badges.length
            : (currentIndex + 1) % badges.length;
          badges[nextIndex].focus();
        }
        // Enter opens the area if a badge is focused
        if (e.key === "Enter" && !this.overlay.classList.contains("hidden")) {
          const focused = document.activeElement;
          // Do nothing if a badge is not focused
          if (!focused?.classList.contains("area-number-badge")) return;
          e.preventDefault();

          // Find the area and set the focus
          const area = this.areas.find((a) => a.label === focused.innerText);
          if (area) this.activateArea(area);
        }
      },
      true,
    ); // 'true' uses the capture phase to beat Blockly's listeners
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
    window.addEventListener(
      "keydown",
      (e) => {
        // Show the overlay on Ctrl+G
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
          e.preventDefault();
          e.stopPropagation(); // prevent main.js from also handling this
          this.toggle(!this.isOpen());
          return;
        }

        // Do nothing if the overlay isn't open
        if (!this.isOpen()) return;

        // Guard against typing in inputs triggering gizmo shortcuts
        const t = e.target;
        const tag = (t?.tagName || "").toLowerCase();
        if (
          t?.isContentEditable ||
          tag === "input" ||
          tag === "textarea" ||
          tag === "select"
        )
          return;

        // If the overlay is open and a number key is pressed,
        // activate the gizmo
        if (e.key >= "1" && e.key <= "9") {
          const entry = this.buttons.find((b) => b.label === e.key);
          if (entry) this.activateButton(entry);
        }
      },
      true,
    );
  },

  activateButton(entry) {
    this.toggle(false);
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

// Start it up
AreaManager.init();
GizmoMenuManager.init();
