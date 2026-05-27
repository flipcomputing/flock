/**
 * Flock Context Manager
 * Priority-based state tracker for keyboard/mouse intent.
 */
export const ContextManager = {
  // Define priority order (Top of list = most important)
  priorities: [
    "TYPING",
    "OVERLAY",
    "GIZMO",
    "RESIZER",
    "NAVIGATION",
    "EDITOR",
    "CAMERA",
  ],

  getCurrentContext() {
    // TYPING: Are they in an input box or search box
    const activeEl = document.activeElement;
    const isInput =
      activeEl &&
      (activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.isContentEditable);

    // Check Blockly safely across different versions/namespaces
    let isBlocklyTyping = false;
    if (window.Blockly) {
      // Try multiple ways to find the main workspace
      const mainWorkspace =
        typeof Blockly.getMainWorkspace === "function"
          ? Blockly.getMainWorkspace()
          : Blockly.common &&
              typeof Blockly.common.getMainWorkspace === "function"
            ? Blockly.common.getMainWorkspace()
            : null;

      // If workspace is found, check if it's currently editing a field
      if (mainWorkspace && mainWorkspace.isTyping) {
        isBlocklyTyping = mainWorkspace.isTyping();
      }
    }

    if (isInput || isBlocklyTyping) return "TYPING";

    // OVERLAY: are they currently in an overlay?
    const overlaySelectors = "#area-menu-overlay";
    const isOverlayVisible = Array.from(
      document.querySelectorAll(overlaySelectors),
    ).some((el) => window.getComputedStyle(el).display !== "none");

    if (isOverlayVisible) {
      return "OVERLAY";
    }

    // GIZMO: Is a gizmo currently active?
    // Yield to EDITOR if the user is actively working in Blockly
    if (document.querySelector(".gizmo-button.active")) {
      const currentGesture = window.Blockly?.Gesture?.getCurrentGesture?.();
      const isBlocklyActive =
        currentGesture?.isDragging?.() ||
        activeEl?.closest(".blocklySvg") ||
        activeEl?.closest(".blocklyToolbox");
      if (!isBlocklyActive) return "GIZMO";
    }

    // RESIZER: Are they changing the canvas size?
    const resizer = document.getElementById("resizer");
    if (activeEl === resizer) {
      return "RESIZER";
    }

    // NAVIGATION: Are they focused on a menu or a button
    const isUI =
      activeEl?.tagName === "BUTTON" || activeEl?.closest(".menu-container");

    if (isUI) {
      return "NAVIGATION";
    }

    // EDITOR: Are they in the blockly workspace or toolbox
    const mainWS = window.Blockly?.getMainWorkspace?.();
    const currentGesture = window.Blockly?.Gesture?.getCurrentGesture?.();

    const isDragging = currentGesture && currentGesture.isDragging();
    const isInWorkspace = activeEl?.closest(".blocklySvg");
    const isInToolbox = activeEl?.closest(".blocklyToolbox");
    const hasSelectedBlock = !!window.Blockly?.selected;

    if (isDragging || isInWorkspace || isInToolbox || hasSelectedBlock) {
      return "EDITOR";
    }

    // DEFAULT: Move the camera
    return "CAMERA";
  },

  // Helper to show context in the UI for debugging
  updateDebugDisplay() {
    const el = document.getElementById("flock-context-debug");
    if (el) {
      el.innerText = `Current Context: ${this.getCurrentContext()}`;
    }
  },
};

// Inject this debug overlay into index.html
(function injectDebugUI() {
  const start = () => {
    if (window.location.hostname !== "localhost") return; // Only show debug on dev
    // 1. Create Style with !important to prevent overrides
    const style = document.createElement("style");
    style.textContent = `
            #flock-context-debug {
                position: fixed !important;
                top: 0 !important;
                left: 50% !important;
                transform: translateX(-50%) !important;
                background: rgba(0, 0, 0, 0.85) !important;
                color: #00ff00 !important;
                padding: 4px 12px !important;
                font-family: 'Consolas', 'Monaco', monospace !important;
                font-size: 12px !important;
                z-index: 999999 !important;
                border: 1px solid #00ff00 !important;
                border-top: none !important;
                border-radius: 0 0 6px 6px !important;
                pointer-events: none !important;
                width: 400px !important;
                overflow: hidden !important;
            }
        `;
    document.head.appendChild(style);

    // 2. Create the Element
    const debugDiv = document.createElement("div");
    debugDiv.id = "flock-context-debug";
    debugDiv.innerHTML = `CONTEXT: <span id="ctx-value">...</span><br>INPUT: <span id="input-debug-value">...</span>`;
    document.body.appendChild(debugDiv);

    // Update loop
    const valueSpan = document.getElementById("ctx-value");

    setInterval(() => {
      if (typeof ContextManager !== "undefined") {
        // Simply fetch and display the state
        valueSpan.innerText =
          ContextManager.getCurrentContext() + " " + document.activeElement.id;
      }
    }, 100);
  };

  // Run immediately if body exists, otherwise wait for load
  if (document.body) {
    start();
  } else {
    window.addEventListener("DOMContentLoaded", start);
  }
})();
