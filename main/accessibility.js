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
    div.className = "area-menu-content";
    div.classList.add("hidden");
    div.innerHTML = `
    
        <h3>Jump to Area</h3>
        <ul>
            <li><kbd>1</kbd> 3D View</li>
            <li><kbd>2</kbd> Blocks</li>
            <li><kbd>3</kbd> Code Preview</li>
        </ul>
        <p>Press <kbd>Esc</kbd> to close</p>
          
    `;
    document.body.appendChild(div);
    this.overlay = div;

    if (DEBUG) console.log("🐟 Overlay div", this.overlay);
  },

  toggle(show) {
    if (this.overlay) {
      this.overlay.classList.toggle("hidden", !show);
      if (DEBUG)
        console.log("🐟 Visibility", this.overlay.classList.contains("hidden"));
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
};

// Start it up
AccessibilityManager.init();
