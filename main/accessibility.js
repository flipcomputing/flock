// Area menu accessed with Ctrl + B to quickly skip to
// different areas on the interface
let DEBUG = true;

const AccessibilityManager = {
  overlay: null,

  init() {
    this.createOverlay();
    this.setupListeners();
    if (DEBUG) console.log("🐟 Area overlay initialized");
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

    if (DEBUG) console.log("🐟 Overlay div", this.overlay);
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
          if (DEBUG) console.log("🐟 Ctrl B pressed");
          e.preventDefault();
          this.toggle(true);
        }
        // Close: Escape
        if (e.key === "Escape") {
          if (DEBUG) console.log("🐟 Escape pressed");
          this.toggle(false);
        }
      },
      true,
    ); // 'true' uses the capture phase to beat Blockly's listeners
  },

  renderHighlights() {
    const container = document.getElementById("area-menu-content");
    container.innerHTML = ""; // Clear old numbers

    const areas = [
      { selector: "#menuleft", label: "1" }, // Top left menu
      { selector: "#menuright", label: "2" }, // Top right
      { selector: "#renderCanvas", label: "3" }, // Main canvas
      { selector: "#gizmoButtons", label: "4" }, // Gizmos
      { selector: "#resizer", label: "5" }, // Resizer
      { selector: "#blockly-0", label: "6" }, // Block selector
      //{ selector: "#.blocklyWorkspace", label: "7" }, // Block workspace
    ];

    areas.forEach((area) => {
      const el = document.querySelector(area.selector);
      if (el && el.offsetWidth > 0) {
        const rect = el.getBoundingClientRect();

        const badge = document.createElement("div");
        badge.className = "area-number-badge";
        badge.innerText = area.label;

        // Position the badge exactly over the element
        badge.style.top = `${rect.top + 20}px`;
        badge.style.left = `${rect.left + 20}px`;

        container.appendChild(badge);

        // Optional: Add a dashed border highlight to the area itself
        const highlight = document.createElement("div");
        highlight.className = "area-outline";
        highlight.style.top = `${rect.top}px`;
        highlight.style.left = `${rect.left}px`;
        highlight.style.width = `${rect.width}px`;
        highlight.style.height = `${rect.height}px`;
        container.appendChild(highlight);
      }
    });
  },
};

// Start it up
AccessibilityManager.init();
