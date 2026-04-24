// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limited - flipcomputing.com

import * as Blockly from "blockly";
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import { flock } from "../flock.js";
import { initializeVariableIndexes } from "../blocks/blocks";
import { enableGizmos } from "../ui/gizmos.js";
import { executeCode, stopCode } from "./execution.js";
import "../ui/addmeshes.js";
import "../ui/colourpicker.js";
import {
  initializeBlocks,
  initializeWorkspace,
  createBlocklyWorkspace,
  overrideSearchPlugin,
  workspace,
} from "./blocklyinit.js";
import {
  saveWorkspace,
  loadWorkspace,
  exportCode,
  autoSaveToFile,
  setupFileInput,
  setupDragAndDrop,
  loadExampleWrapper,
  newProject,
} from "./files.js";
import {
  onResize,
  toggleDesignMode,
  togglePlayMode,
  initializeUI,
  switchView,
} from "./view.js";
import { hideLoadingScreen } from "./loading.js";
//import "./debug.js";
import { initializeBlockHandling } from "./blockhandling.js";
import { setupInput } from "./input.js";
import { addExportContextMenuOptions } from "./export.js";
import {
  setLanguage,
  initializeLanguageMenu,
  initializeSavedLanguage,
  translate,
} from "./translation.js";

function isEmbedModeEnabled() {
  const embedParam = new URLSearchParams(window.location.search).get("embed");
  if (embedParam === null) return false;

  const normalized = embedParam.trim().toLowerCase();
  return normalized !== "false" && normalized !== "0" && normalized !== "off";
}

function addEmbedPlaybackControls() {
  const existingControls = document.getElementById("embedTopBar");
  if (existingControls) return existingControls;

  const topBar = document.createElement("div");
  topBar.id = "embedTopBar";
  Object.assign(topBar.style, {
    position: "relative",
    top: "0",
    left: "0",
    right: "0",
    zIndex: "1000",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
    padding: "6px 8px",
    background: "#ffffff",
    border: "0",
    borderBottom: "1px solid #cfcde0",
    boxSizing: "border-box",
  });

  const buttonRow = document.createElement("div");
  Object.assign(buttonRow.style, {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  });

  const createActionButton = (templateId, fallbackLabel, onClick) => {
    const template = document.getElementById(templateId);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bigbutton";
    button.title = fallbackLabel;
    button.setAttribute("aria-label", fallbackLabel);
    button.style.minWidth = "36px";
    button.style.minHeight = "36px";
    button.style.width = "36px";
    button.style.height = "36px";
    button.style.margin = "0";
    button.style.padding = "0";
    button.style.display = "inline-flex";
    button.style.alignItems = "center";
    button.style.justifyContent = "center";
    button.style.lineHeight = "1";

    if (template) {
      button.innerHTML = template.innerHTML;
    } else {
      button.textContent = fallbackLabel;
    }
    button.addEventListener("click", onClick);
    return button;
  };

  const playButton = createActionButton("runCodeButton", "Play", () => {
    void executeCode();
  });
  buttonRow.appendChild(playButton);

  const stopButton = createActionButton("stopCodeButton", "Stop", () => {
    stopCode();
  });
  buttonRow.appendChild(stopButton);
  topBar.appendChild(buttonRow);

  const actions = document.createElement("div");
  Object.assign(actions.style, {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  });

  const openInFlockButton = document.createElement("a");
  const projectUrl = new URLSearchParams(window.location.search).get("project");
  const targetUrl = projectUrl
    ? `https://flipcomputing.github.io/flock/?project=${encodeURIComponent(projectUrl)}`
    : "https://flipcomputing.github.io/flock/";
  openInFlockButton.href = targetUrl;
  openInFlockButton.id = "embedOpenInFlock";
  openInFlockButton.target = "_blank";
  openInFlockButton.rel = "noopener noreferrer";
  openInFlockButton.className = "bigbutton";
  openInFlockButton.title = "Open in Flock";
  openInFlockButton.setAttribute("aria-label", "Open in Flock");
  openInFlockButton.style.minWidth = "36px";
  openInFlockButton.style.minHeight = "36px";
  openInFlockButton.style.width = "36px";
  openInFlockButton.style.height = "36px";
  openInFlockButton.style.margin = "0";
  openInFlockButton.style.padding = "0";
  openInFlockButton.style.textDecoration = "none";
  openInFlockButton.style.display = "inline-flex";
  openInFlockButton.style.alignItems = "center";
  openInFlockButton.style.justifyContent = "center";
  openInFlockButton.innerHTML = `
    <span class="icon" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
        <path fill="currentColor" d="M320 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l82.7 0-201.4 201.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L448 109.3 448 192c0 17.7 14.3 32 32 32s32-14.3 32-32l0-160c0-17.7-14.3-32-32-32L320 0zM80 96C35.8 96 0 131.8 0 176L0 432c0 44.2 35.8 80 80 80l256 0c44.2 0 80-35.8 80-80l0-80c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 80c0 8.8-7.2 16-16 16L80 448c-8.8 0-16-7.2-16-16l0-256c0-8.8 7.2-16 16-16l80 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L80 96z"/>
      </svg>
    </span>
  `;
  actions.appendChild(openInFlockButton);
  topBar.appendChild(actions);

  document.body.prepend(topBar);
  return topBar;
}

function shouldShowEmbedPlaybackControls() {
  const controlsParam = new URLSearchParams(window.location.search).get(
    "controls",
  );
  if (!controlsParam) return false;

  const normalized = controlsParam.trim().toLowerCase();
  return (
    normalized === "playstop" ||
    normalized === "play-stop" ||
    normalized === "true" ||
    normalized === "1"
  );
}

function addEmbedBottomBar() {
  const existingBar = document.getElementById("embedBottomBar");
  if (existingBar) return existingBar;

  const bar = document.createElement("div");
  bar.id = "embedBottomBar";
  Object.assign(bar.style, {
    position: "relative",
    left: "0",
    right: "0",
    bottom: "0",
    zIndex: "1000",
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    padding: "6px 6px",
    minHeight: "0",
    lineHeight: "1",
    background: "#ffffff",
    border: "0",
    borderTop: "1px solid #cfcde0",
    boxSizing: "border-box",
  });

  const logoLink = document.createElement("a");
  logoLink.href = "https://flockxr.com/";
  logoLink.target = "_blank";
  logoLink.rel = "noopener noreferrer";
  logoLink.setAttribute("aria-label", "Visit Flock XR website");
  logoLink.style.display = "inline-flex";
  logoLink.style.alignItems = "center";
  logoLink.style.justifyContent = "center";
  logoLink.style.padding = "2px";
  logoLink.style.borderRadius = "4px";

  const logo = document.createElement("img");
  logo.src = "./images/inline-flock-xr.svg";
  logo.alt = "Flock XR";
  logo.style.height = "15px";
  logo.style.width = "auto";
  logoLink.appendChild(logo);
  bar.appendChild(logoLink);

  document.body.appendChild(bar);
  return bar;
}

function applyEmbedMode() {
  if (!isEmbedModeEnabled()) return;
  document.body.classList.add("embed-mode");

  const header = document.querySelector("header");
  const codePanel = document.getElementById("codePanel");
  const bottomBar = document.getElementById("bottomBar");
  const gizmoButtons = document.getElementById("gizmoButtons");
  const flockLink = document.getElementById("flocklink");
  const resizer = document.getElementById("resizer");
  const infoPanel = document.getElementById("info-panel");
  const canvasArea = document.getElementById("canvasArea");
  const mainContent = document.getElementById("maincontent");
  const canvas = document.getElementById("renderCanvas");

  if (header) header.style.display = "none";
  if (codePanel) codePanel.style.display = "none";
  if (bottomBar) bottomBar.style.display = "none";
  if (gizmoButtons) gizmoButtons.style.display = "none";
  if (resizer) resizer.style.display = "none";
  if (infoPanel) infoPanel.style.display = "none";

  if (canvasArea) {
    canvasArea.style.display = "block";
    canvasArea.style.width = "100%";
    canvasArea.style.height = "100%";
    canvasArea.style.flex = "1 1 100%";
    canvasArea.style.overflow = "hidden";
  }

  if (mainContent) {
    mainContent.style.transform = "translateX(0px)";
    mainContent.style.marginTop = "0";
    mainContent.style.height = "auto";
    mainContent.tabIndex = -1;
  }

  if (canvas) {
    canvas.tabIndex = 0;
    canvas.style.display = "block";
    canvas.style.margin = "0 auto";
  }

  if (flockLink) flockLink.style.display = "none";
  flock.embedMode = true;

  document.documentElement.style.setProperty("--dynamic-offset", "0px");
  document.documentElement.style.background = "#e5e5eb";

  const embedBottomBar = addEmbedBottomBar();
  let embedTopBar = null;

  if (shouldShowEmbedPlaybackControls()) {
    embedTopBar = addEmbedPlaybackControls();
  }

  let embedShell = document.getElementById("embedShell");
  if (!embedShell) {
    embedShell = document.createElement("div");
    embedShell.id = "embedShell";
    document.body.appendChild(embedShell);
  }

  if (embedTopBar) embedShell.appendChild(embedTopBar);
  if (mainContent) embedShell.appendChild(mainContent);
  if (embedBottomBar) embedShell.appendChild(embedBottomBar);

  const openInFlockButton = document.getElementById("embedOpenInFlock");
  const logoLink = document.querySelector("#embedBottomBar a");

  if (
    canvas &&
    openInFlockButton &&
    !openInFlockButton.dataset.canvasTabBound
  ) {
    openInFlockButton.addEventListener("keydown", (event) => {
      if (event.key === "Tab" && !event.shiftKey) {
        event.preventDefault();
        canvas.focus();
      }
    });
    openInFlockButton.dataset.canvasTabBound = "true";
  }

  if (canvas && logoLink && !canvas.dataset.logoTabBound) {
    canvas.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;

      if (!event.shiftKey) {
        event.preventDefault();
        logoLink.focus();
        return;
      }

      const unmuteButton = document.getElementById("babylonUnmuteButton");
      const unmuteVisible =
        unmuteButton &&
        getComputedStyle(unmuteButton).display !== "none" &&
        getComputedStyle(unmuteButton).visibility !== "hidden";

      if (!unmuteVisible && openInFlockButton) {
        event.preventDefault();
        openInFlockButton.focus();
      }
    });
    canvas.dataset.logoTabBound = "true";
  }

  if (canvas && logoLink && !logoLink.dataset.canvasTabBound) {
    logoLink.addEventListener("keydown", (event) => {
      if (event.key === "Tab" && event.shiftKey) {
        event.preventDefault();
        canvas.focus();
      }
    });
    logoLink.dataset.canvasTabBound = "true";
  }

  onResize("reset");
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./sw.js")
    .then((registration) => {
      //console.log("Service Worker registered:", registration);

      // Check for updates to the Service Worker
      registration.onupdatefound = () => {
        const newWorker = registration.installing;

        if (newWorker) {
          newWorker.onstatechange = () => {
            if (newWorker.state === "installed") {
              // If the old Service Worker is controlling the page
              if (navigator.serviceWorker.controller) {
                // Notify the user about the update
                console.log("New update available");
                showUpdateNotification();
              }
            }
          };
        }
      };
    })
    .catch((error) => {
      console.error("Service Worker registration failed:", error);
    });
}

async function showUpdateNotification() {
  const banner = document.createElement("div");
  Object.assign(banner.style, {
    position: "fixed",
    bottom: "0",
    left: "0",
    width: "100%",
    background: "#511D91",
    color: "white",
    textAlign: "center",
    padding: "10px",
    zIndex: "1000",
  });

  const message = document.createElement("span");
  message.dataset.i18n = "update_available";
  message.textContent = "A new version of Flock is available.";

  const reloadBtn = document.createElement("button");
  reloadBtn.id = "reload-btn";
  reloadBtn.dataset.i18n = "reload_button";
  reloadBtn.textContent = "Reload";
  Object.assign(reloadBtn.style, {
    background: "white",
    color: "#511D91",
    padding: "5px 10px",
    border: "none",
    cursor: "pointer",
  });

  banner.appendChild(message);
  banner.appendChild(document.createTextNode(" "));
  banner.appendChild(reloadBtn);

  const notification = document.createElement("div");
  notification.appendChild(banner);
  document.body.appendChild(notification);

  // Apply translations to the new elements
  const { applyTranslations } = await import("./translation.js");
  applyTranslations();

  reloadBtn.addEventListener("click", () => {
    // Reload the page to activate the new service worker
    window.location.reload();
  });
}

console.log("Blockly version:", Blockly.VERSION);

function registerBlocklyPlayShortcut() {
  const shortcutRegistry = Blockly.ShortcutRegistry.registry;
  const shortcutName = "flock_play_scene";
  const keyCode = shortcutRegistry.createSerializedKey(
    Blockly.utils.KeyCodes.P,
    null,
  );

  const keyboardShortcuts = shortcutRegistry.getRegistry?.();
  if (keyboardShortcuts?.[shortcutName]) {
    shortcutRegistry.unregister(shortcutName);
  }
  shortcutRegistry.register({
    name: shortcutName,
    keyCodes: [keyCode],
    preconditionFn: (ws) => !ws.isDragging(),
    callback: (_ws, event) => {
      const targetElement =
        event?.target instanceof Element ? event.target : null;
      const activeElement = document.activeElement;
      const inToolboxContext =
        !!targetElement?.closest?.(
          ".blocklyToolboxDiv, .blocklyToolbox, .blocklyFlyout",
        ) ||
        !!activeElement?.closest?.(
          ".blocklyToolboxDiv, .blocklyToolbox, .blocklyFlyout",
        );
      if (inToolboxContext) {
        return false;
      }
      event.preventDefault();
      void executeCode({ focusCanvas: false });
      return true;
    },
  });
}

function initializeApp() {
  //console.log("Initializing Flock XR ...");

  (() => {
    const ws = () => Blockly.getMainWorkspace?.();
    const flyout = () => ws()?.getToolbox?.()?.getFlyout?.();

    const isSearchCategorySelected = () => {
      const sel = document.querySelector(
        ".blocklyToolboxDiv .blocklyToolboxCategory.blocklyToolboxSelected",
      );
      return !!sel?.querySelector('input[type="search"]');
    };

    const clickIsInsideToolboxOrFlyout = (el) =>
      !!el.closest(".blocklyToolboxDiv, .blocklyFlyout");

    // Close search flyout on outside clicks *only when* search is the selected category.
    const onOutside = (e) => {
      if (!isSearchCategorySelected()) return; // only for search
      if (clickIsInsideToolboxOrFlyout(e.target)) return; // ignore toolbox/flyout clicks
      flyout()?.hide?.();
    };

    // Capture so we run even if something stops propagation later.
    window.addEventListener("pointerdown", onOutside, {
      capture: true,
    });
    window.addEventListener("click", onOutside, { capture: true });
  })();

  const observer = new MutationObserver(() => {
    const unmuteButton = document.getElementById("babylonUnmuteButton");
    if (unmuteButton && !unmuteButton.getAttribute("aria-label")) {
      unmuteButton.setAttribute("aria-label", translate("unmute_audio_aria"));
      observer.disconnect(); // Stop observing once we've found it
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  // Add event listeners for menu buttons and controls
  const runCodeButton = document.getElementById("runCodeButton");
  const toggleDesignButton = document.getElementById("toggleDesign");
  const togglePlayButton = document.getElementById("togglePlay");
  const stopCodeButton = document.getElementById("stopCodeButton");
  const fileInput = document.getElementById("fileInput");
  const exportCodeButton = document.getElementById("exportCodeButton");
  const openButton = document.getElementById("openButton");
  const menuButton = document.getElementById("menuBtn");
  if (!runCodeButton || !stopCodeButton || !exportCodeButton || !fileInput) {
    return;
  }
  runCodeButton.addEventListener("click", executeCode);
  stopCodeButton.addEventListener("click", stopCode);
  exportCodeButton.addEventListener("click", exportCode);

  // Make open button work with keyboard
  if (openButton) {
    openButton.addEventListener("click", () => {
      fileInput.click();
    });

    openButton.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        fileInput.click();
      }
    });
  }

  // Enable the file input after initialization
  fileInput.removeAttribute("disabled");

  // keydown event listener (capture phase to ensure shortcuts
  // are handled before any other handler can stop propagation)
  document.addEventListener(
    "keydown",
    function (e) {
      // Check for modifier key (Ctrl on Windows/Linux, Cmd on Mac)
      if (!(e.ctrlKey || e.metaKey)) return;

      let key = e.key.toLowerCase();
      if (e.code === "KeyM" && key !== "m") key = "m";
      if (e.code === "KeyE" && key !== "e") key = "e";

      switch (key) {
        case "o": // Ctrl+O - Open file
          e.preventDefault();
          document.getElementById("fileInput").click();
          break;

        case "s": // Ctrl+S - Save/Export
          e.preventDefault();
          exportCode(workspace); // Or saveWorkspace(workspace) for autosave
          break;

        case "p": // Ctrl+P - Execute code
          e.preventDefault();
          if (typeof executeCode === "function") {
            executeCode();
          } else {
            console.warn("executeCode is not defined.");
          }
          break;

        case "/": {
          // Ctrl+/ - Toggle info details
          e.preventDefault();
          const infoSummary = document.querySelector("#info-details summary");
          if (infoSummary) {
            infoSummary.click(); // Simulate a click to toggle details
            infoSummary.focus(); // Move focus to the summary
          }
          break;
        }

        case "m": {
          // Ctrl+M - Move focus to main menu button
          e.preventDefault();
          if (menuButton) menuButton.focus();
          break;
        }

        case "g": {
          // Ctrl+G - Focus shapes button
          e.preventDefault();
          const btn = document.getElementById("showShapesButton");
          if (btn && !btn.disabled && btn.offsetParent !== null) {
            btn.focus();
          }
          break;
        }

        case "e": // Ctrl+E - Focus Blockly workspace/editor and move cursor
          e.preventDefault();
          Blockly.keyboardNavigationController?.setIsActive?.(true);
         
          break;
      }
    },
    true,
  );
  if (toggleDesignButton) {
    toggleDesignButton.addEventListener("click", toggleDesignMode);
  }

  if (togglePlayButton) {
    togglePlayButton.addEventListener("click", togglePlayMode);
  }

  const fullscreenToggleEl = document.getElementById("fullscreenToggle");
  if (fullscreenToggleEl) {
    fullscreenToggleEl.addEventListener("click", function () {
      if (!document.fullscreenElement) {
        // Go fullscreen
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
        } else if (document.documentElement.mozRequestFullScreen) {
          /* Firefox */
          document.documentElement.mozRequestFullScreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
          /* Chrome, Safari & Opera */
          document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
          /* IE/Edge */
          document.documentElement.msRequestFullscreen();
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
          /* Firefox */
          document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
          /* Chrome, Safari & Opera */
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          /* IE/Edge */
          document.msExitFullscreen();
        }
      }
    });
  }

  const projectNew = document.getElementById("project-new");
  if (projectNew) {
    projectNew.addEventListener("click", function (e) {
      e.preventDefault();
      newProject();
      document.getElementById("menuDropdown")?.classList.add("hidden");
    });
  }
  const projectOpen = document.getElementById("project-open");
  if (projectOpen) {
    projectOpen.addEventListener("click", function (e) {
      e.preventDefault();
      fileInput.click();
      document.getElementById("menuDropdown")?.classList.add("hidden");
    });
  }
  const projectSave = document.getElementById("project-save");
  if (projectSave) {
    projectSave.addEventListener("click", function (e) {
      e.preventDefault();
      exportCode();
      document.getElementById("menuDropdown")?.classList.add("hidden");
    });
  }

  const shareModal = document.getElementById("shareModal");
  const shareUrlInput = document.getElementById("shareUrl");
  const copyShareUrl = document.getElementById("copyShareUrl");
  const closeShareModal = document.getElementById("closeShareModal");

  function openShareModal(url) {
    shareUrlInput.value = url;
    shareModal.classList.remove("hidden");
    shareModal.removeAttribute("aria-hidden");
    shareModal.setAttribute("aria-modal", "true");
    copyShareUrl.focus();
  }

  function hideShareModal() {
    shareModal.classList.add("hidden");
    shareModal.setAttribute("aria-hidden", "true");
    shareModal.removeAttribute("aria-modal");
    document.getElementById("project-share")?.focus();
  }

  if (closeShareModal) {
    closeShareModal.addEventListener("click", hideShareModal);
  }

  if (shareModal) {
    shareModal.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        hideShareModal();
      } else if (e.key === "Tab") {
        const focusable = shareModal.querySelectorAll(
          'button, input, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

  if (copyShareUrl) {
    copyShareUrl.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(shareUrlInput.value);
        const { translate } = await import("./translation.js");
        const original = copyShareUrl.textContent;
        copyShareUrl.textContent = translate("share_copied_ui") || "Copied!";
        setTimeout(() => {
          copyShareUrl.textContent = original;
        }, 2000);
      } catch {
        shareUrlInput.select();
      }
    });
  }

  const projectShare = document.getElementById("project-share");
  if (projectShare) {
    projectShare.addEventListener("click", async function (e) {
      e.preventDefault();
      document.getElementById("menuDropdown")?.classList.add("hidden");
      try {
        const { buildShareUrl } = await import("./share.js");
        const url = await buildShareUrl();
        openShareModal(url);
      } catch (err) {
        console.error("Failed to build share link:", err);
        alert("Failed to generate share link.");
      }
    });
  }

  initializeUI();

  enableGizmos();
  // Enable gizmo buttons

  const exampleSelect = document.getElementById("exampleSelect");

  const fullscreenToggle = document.getElementById("fullscreenToggle");

  //toolboxControl.removeAttribute("disabled");
  runCodeButton.removeAttribute("disabled");
  if (exampleSelect) exampleSelect.removeAttribute("disabled");
  if (fullscreenToggle) fullscreenToggle.removeAttribute("disabled");

  // Add event listeners for buttons and controls
  /*toolboxControl.addEventListener("mouseover", function () {
                toolboxControl.style.cursor = "pointer";
                toggleToolbox();
        });*/

  if (exampleSelect) {
    exampleSelect.addEventListener("change", loadExampleWrapper);
  }

  // Make setLanguage available globally for the menu
  window.setLanguage = async (lang) => await setLanguage(lang);

  // Initialize language menu
  initializeLanguageMenu();
}

window.onload = async function () {
  const blocklyContainer = document.getElementById("blocklyDiv");
  if (!blocklyContainer) {
    const standaloneScript = document.getElementById("flock");
    if (standaloneScript) {
      console.log(
        "Skipping editor initialization: standalone script detected without #blocklyDiv.",
      );
    } else {
      console.warn(
        "Skipping editor initialization: missing required #blocklyDiv container.",
      );
    }
    return;
  }

  // Resize Blockly workspace and Babylon.js canvas when the window is resized
  window.addEventListener("resize", onResize);

  switchView("both");
  initializeBlocks();
  // Initialize Blockly and add custom context menu options
  addExportContextMenuOptions();

  createBlocklyWorkspace();
  if (!workspace) {
    console.error(
      "Blockly workspace failed to initialize; aborting editor setup.",
    );
    return;
  }
  registerBlocklyPlayShortcut();
  initializeWorkspace();
  overrideSearchPlugin(workspace);
  initializeBlockHandling();

  console.log("Welcome to Flock XR 🐦🐦🐦");
  console.log("Release 1");

  // Autosave every 30 seconds: to localStorage and (if a file was saved) to that file
  setInterval(() => {
    saveWorkspace(workspace);
    autoSaveToFile(workspace);
  }, 30000);

  (async () => {
    await flock.initialize();

    // Hide loading screen once Flock is fully initialized
    setTimeout(hideLoadingScreen, 500);
  })();

  //workspace.getToolbox().setVisible(false);

  workspace.addChangeListener(function (event) {
    if (event.type === Blockly.Events.FINISHED_LOADING) {
      initializeVariableIndexes();
      window.loadingCode = false;
    }
  });

  const infoDetails = document.getElementById("info-details");
  if (infoDetails) {
    infoDetails.addEventListener("toggle", function () {
      if (this.open) {
        setTimeout(() => {
          const content = this.querySelector(".content");
          if (content) {
            content.setAttribute("tabindex", "0"); // Make it focusable
            content.focus();
          }
        }, 10);
      } else {
        const content = this.querySelector(".content");
        if (content) {
          content.setAttribute("tabindex", "-1"); // Remove from tab order when closed
        }
      }
    });
  }

  // Initial view setup
  window.loadingCode = true;

  // Initialize saved language before loading workspace
  await initializeSavedLanguage();

  // Refresh toolbox to ensure categories are translated after language initialization
  const toolboxElement = document.getElementById("toolbox");
  if (toolboxElement) {
    workspace.updateToolbox(toolboxElement);
  } else {
    // If no toolbox element, import the toolbox configuration
    const { toolbox } = await import("../toolbox.js");
    workspace.updateToolbox(toolbox);
  }

  initializeApp();
  applyEmbedMode();

  setupFileInput(workspace, executeCode);
  setupDragAndDrop(workspace, executeCode);

  setupInput();

  loadWorkspace(workspace, executeCode);
};
