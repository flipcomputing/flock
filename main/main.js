// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limited - flipcomputing.com

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
	importSnippet
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
import {
	addExportContextMenuOptions,
} from "./export.js";
import { setLanguage, initializeLanguageMenu, initializeSavedLanguage } from "./translation.js";

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

function showUpdateNotification() {
	const notification = document.createElement("div");
	notification.innerHTML = `
	<div style="position: fixed; bottom: 0; left: 0; width: 100%; background: #511D91; color: white; text-align: center; padding: 10px; z-index: 1000;">
	  A new version of Flock is available. <button id="reload-btn" style="background: white; color: #511D91; padding: 5px 10px; border: none; cursor: pointer;">Reload</button>
	</div>
  `;
	document.body.appendChild(notification);

	document.getElementById("reload-btn").addEventListener("click", () => {
		// Reload the page to activate the new service worker
		window.location.reload();
	});
}

console.log("Blockly version:", Blockly.VERSION);

function initializeApp() {
	console.log("Initializing app...");

	// Add event listeners for menu buttons and controls
	const runCodeButton = document.getElementById("runCodeButton");
	const toggleDesignButton = document.getElementById("toggleDesign");
	const togglePlayButton = document.getElementById("togglePlay");
	const stopCodeButton = document.getElementById("stopCodeButton");
	const fileInput = document.getElementById("fileInput");
	const exportCodeButton = document.getElementById("exportCodeButton");
	const openButton = document.getElementById("openButton");

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

	document.addEventListener("keydown", function (e) {
		// Avoid in inputs/textareas
		const tag = (e.target.tagName || "").toLowerCase();
		if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;

		// Ctrl+O
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
			e.preventDefault();
			document.getElementById("fileInput").click();
		}
		// Ctrl+S (optional)
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
			e.preventDefault();
			exportCode(workspace); // Or saveWorkspace(workspace) for autosave
		}

		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
			e.preventDefault();
			if (typeof executeCode === "function") {
				executeCode();
			} else {
				console.warn("executeCode is not defined.");
			}
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

	// Resize Blockly workspace and Babylon.js canvas when the window is resized
	window.addEventListener("resize", onResize);

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

	// Initial view setup
	window.loadingCode = true;

	// Initialize saved language before loading workspace
	await initializeSavedLanguage();
	
	// Refresh toolbox to ensure categories are translated after language initialization
	const toolboxElement = document.getElementById('toolbox');
	if (toolboxElement) {
		workspace.updateToolbox(toolboxElement);
	} else {
		// If no toolbox element, import the toolbox configuration
		const { toolbox } = await import('../toolbox.js');
		workspace.updateToolbox(toolbox);
	}
	
	loadWorkspace(workspace, executeCode);
	switchView("both");

	setupFileInput(workspace, executeCode);

	setupInput();
	initializeApp();
};