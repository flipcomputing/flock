// Area menu accessed with Ctrl + B to quickly skip to
// different areas on the interface

const AccessibilityManager = {
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
    div.innerHTML = `
        <div id="area-menu-content"> </div>        
    `;
    document.body.appendChild(div);
    this.overlay = div;
  },

  toggle(show) {
    if (this.overlay) {
      if (show) this.renderHighlights();
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
          this.toggle(true);
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
            if (area) {
              e.preventDefault(); // Don't type the number!
              this.toggle(false); // Close the menu

              const el = document.querySelector(area.selector);
              const focusable =
                el?.querySelector(
                  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
                ) ?? el; // Focus the area itself if no suitable child

              focusable?.focus();
            }
          }
        }
      },
      true,
    ); // 'true' uses the capture phase to beat Blockly's listeners
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

// Start it up
AccessibilityManager.init();
