// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limithsed - flipcomputing.com

import * as Blockly from "blockly";
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import { flock, initializeFlock } from "../flock.js";
import { initializeVariableIndexes } from "../blocks";
import { meshMap } from "../generators";
import { enableGizmos } from "../ui/gizmos.js";
import { executeCode, stopCode } from "./execution.js";
import "../ui/addmeshes.js";
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
	setupFileInput,
	loadExampleWrapper,
	newProject,
	importSnippet,
} from "./files.js";
import {
	onResize,
	toggleDesignMode,
	togglePlayMode,
	initializeUI,
	switchView,
} from "./view.js";
import { hideLoadingScreen } from "./loading.js";
import "./debug.js";
import { initializeBlockHandling } from "./blockhandling.js";
import { setupInput } from "./input.js";
import { addExportContextMenuOptions } from "./export.js";
import {
	setLanguage,
	initializeLanguageMenu,
	initializeSavedLanguage,
} from "./translation.js";

if ("serviceWorker" in navigator) {
	navigator.serviceWorker
		.register("./sw.js")
		.then((registration) => {
			console.log("Service Worker registered:", registration);

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
	const notification = document.createElement("div");
	notification.innerHTML = `
	<div style="position: fixed; bottom: 0; left: 0; width: 100%; background: #511D91; color: white; text-align: center; padding: 10px; z-index: 1000;">
	  <span data-i18n="update_available">A new version of Flock is available.</span> <button id="reload-btn" style="background: white; color: #511D91; padding: 5px 10px; border: none; cursor: pointer;" data-i18n="reload_button">Reload</button>
	</div>
  `;
	document.body.appendChild(notification);

	// Apply translations to the new elements
	const { applyTranslations } = await import("./translation.js");
	applyTranslations();

	document.getElementById("reload-btn").addEventListener("click", () => {
		// Reload the page to activate the new service worker
		window.location.reload();
	});
}

console.log("Blockly version:", Blockly.VERSION);

function initializeApp() {
	console.log("Initializing app...");

	
	(() => {
	  const ws = () => Blockly.getMainWorkspace?.();
	  const flyout = () => ws()?.getToolbox?.()?.getFlyout?.();

	  const isSearchCategorySelected = () => {
		const sel = document.querySelector(
		  '.blocklyToolboxDiv .blocklyToolboxCategory.blocklyToolboxSelected'
		);
		return !!sel?.querySelector('input[type="search"]');
	  };

	  const clickIsInsideToolboxOrFlyout = (el) =>
		!!el.closest('.blocklyToolboxDiv, .blocklyFlyout');

	  // Close search flyout on outside clicks *only when* search is the selected category.
	  const onOutside = (e) => {
		if (!isSearchCategorySelected()) return;              // only for search
		if (clickIsInsideToolboxOrFlyout(e.target)) return;   // ignore toolbox/flyout clicks
		flyout()?.hide?.();
	  };

	  // Capture so we run even if something stops propagation later.
	  window.addEventListener('pointerdown', onOutside, { capture: true });
	  window.addEventListener('click',       onOutside, { capture: true });
	})();


	const observer = new MutationObserver((mutations) => {
	  const unmuteButton = document.getElementById('babylonUnmuteButton');
	  if (unmuteButton && !unmuteButton.getAttribute('aria-label')) {
		unmuteButton.setAttribute('aria-label', 'Unmute audio');
		observer.disconnect(); // Stop observing once we've found it
	  }
	});

	observer.observe(document.body, { 
	  childList: true, 
	  subtree: true 
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

	runCodeButton.addEventListener("click", executeCode);
	stopCodeButton.addEventListener("click", stopCode);
	exportCodeButton.addEventListener("click", exportCode);

	// Make open button work with keyboard
	openButton.addEventListener("click", () => {
		fileInput.click();
	});

	openButton.addEventListener("keydown", (event) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			fileInput.click();
		}
	});

	// Enable the file input after initialization
	fileInput.removeAttribute("disabled");

	// keydown event listener
	document.addEventListener("keydown", function (e) {
		// Avoid in inputs
		const tag = (e.target.tagName || "").toLowerCase();
		if (tag === "input" || tag === "textarea" || e.target.isContentEditable)
			return;

		// Check for modifier key (Ctrl on Windows/Linux, Cmd on Mac)
		if (!(e.ctrlKey || e.metaKey)) return;

		const key = e.key.toLowerCase();

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

			case "/": // Ctrl+/ - Toggle info details
				e.preventDefault();
				const infoSummary = document.querySelector("#info-details summary");
				if (infoSummary) {
					infoSummary.click(); // Simulate a click to toggle details
					infoSummary.focus(); // Move focus to the summary
				}
				break;

			case "m": // Ctrl+M - Open menu
				e.preventDefault();
				menuButton.click(); // Simulate click to open the menu
				// Focus the first menu item
				const menuDropdown = document.getElementById("menuDropdown");
				const firstMenuItem = menuDropdown ? menuDropdown.querySelector("li") : null;
				if (firstMenuItem) {
					firstMenuItem.focus(); // Set focus on the first item
				}
				break;

			case "g": // Ctrl+G - Focus shapes button
				e.preventDefault();
				const btn = document.getElementById("showShapesButton");
				if (btn && !btn.disabled && btn.offsetParent !== null) {
					btn.focus();
				}
				break;

			/* Uncomment if needed:
			case "k": // Ctrl+K - Stop code
				e.preventDefault();
				// Force any focused element to blur, so pending changes are committed
				if (document.activeElement && typeof document.activeElement.blur === "function") {
					document.activeElement.blur();
				}
				// Give the browser a tick to finish handling blur before continuing
				setTimeout(() => {
					document.getElementById("stopCodeButton").click();
				}, 0);
				break;
			*/
		}
	});
	toggleDesignButton.addEventListener("click", toggleDesignMode);

	togglePlayButton.addEventListener("click", togglePlayMode);

	document
		.getElementById("fullscreenToggle")
		.addEventListener("click", function () {
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

	document
		.getElementById("project-new")
		.addEventListener("click", function (e) {
			e.preventDefault();
			newProject();
			document.getElementById("menuDropdown").classList.add("hidden");
		});
	document
		.getElementById("project-open")
		.addEventListener("click", function (e) {
			e.preventDefault();
			fileInput.click();
			document.getElementById("menuDropdown").classList.add("hidden");
		});
	document
		.getElementById("project-save")
		.addEventListener("click", function (e) {
			e.preventDefault();
			exportCode();
			document.getElementById("menuDropdown").classList.add("hidden");
		});

	initializeUI();

	console.log("Enabling gizmos");

	enableGizmos();
	// Enable gizmo buttons

	const exampleSelect = document.getElementById("exampleSelect");

	const fullscreenToggle = document.getElementById("fullscreenToggle");

	//toolboxControl.removeAttribute("disabled");
	runCodeButton.removeAttribute("disabled");
	exampleSelect.removeAttribute("disabled");
	fullscreenToggle.removeAttribute("disabled");

	// Add event listeners for buttons and controls
	/*toolboxControl.addEventListener("mouseover", function () {
		toolboxControl.style.cursor = "pointer";
		toggleToolbox();
	});*/

	exampleSelect.addEventListener("change", loadExampleWrapper);

	// Make setLanguage available globally for the menu
	window.setLanguage = async (lang) => await setLanguage(lang);

	// Initialize language menu
	initializeLanguageMenu();
}

window.onload = async function () {

	// Resize Blockly workspace and Babylon.js canvas when the window is resized
	window.addEventListener("resize", onResize);

	switchView("both");

	const scriptElement = document.getElementById("flock");
	if (scriptElement) {
		initializeFlock();
		console.log("Standalone Flock");
		// Hide loading screen after a short delay for standalone flock
		setTimeout(hideLoadingScreen, 1000);
		return; // standalone flock
	}

	initializeBlocks();
	// Initialize Blockly and add custom context menu options
	addExportContextMenuOptions();

	createBlocklyWorkspace();
	initializeWorkspace();
	overrideSearchPlugin(workspace);
	initializeBlockHandling();
	//Blockly.ContextMenuItems.registerCommentOptions();

	/*const navigationController = new NavigationController();
	navigationController.init();
	navigationController.addWorkspace(workspace);*/
	// Turns on keyboard navigation.
	//keyboardNav = new KeyboardNavigation(workspace);

	console.log("Welcome to Flock 🐑🐑🐑");

	// Call this function to autosave periodically
	setInterval(() => saveWorkspace(workspace), 30000); // Autosave every 30 seconds

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

	document.getElementById('info-details').addEventListener('toggle', function(e) {
		if (this.open) {
			setTimeout(() => {
				const content = this.querySelector('.content');
				if (content) {
					content.setAttribute('tabindex', '0'); // Make it focusable
					content.focus();
				}
			}, 10);
		} else {
			const content = this.querySelector('.content');
			if (content) {
				content.setAttribute('tabindex', '-1'); // Remove from tab order when closed
			}
		}
	});

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

	setupFileInput(workspace, executeCode);

	setupInput();
	
	loadWorkspace(workspace, executeCode);
	
};
