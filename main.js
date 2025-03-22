// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limited - flipcomputing.com

import * as Blockly from "blockly";
import { Multiselect } from "@mit-app-inventor/blockly-plugin-workspace-multiselect";
import { javascriptGenerator } from "blockly/javascript";
//import { registerFieldColour } from "@blockly/field-colour";
import { FieldGridDropdown } from "@blockly/field-grid-dropdown";
import { WorkspaceSearch } from "@blockly/plugin-workspace-search";
import { NavigationController } from "@blockly/keyboard-navigation";
import * as BlockDynamicConnection from "@blockly/block-dynamic-connection";
//import {CrossTabCopyPaste} from '@blockly/plugin-cross-tab-copy-paste';
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import { flock, initializeFlock } from "./flock.js";
import {
	options,
	defineBlocks,
	initializeVariableIndexes,
	handleBlockSelect,
	handleBlockDelete,
	CustomZelosRenderer,
} from "./blocks";
import { defineBaseBlocks } from "./blocks/base";
import { defineShapeBlocks } from "./blocks/shapes";
import { defineGenerators } from "./generators";
import {
	enableGizmos,
	setGizmoManager,
	disposeGizmoManager,
} from "./ui/designview";

if ("serviceWorker" in navigator) {
	navigator.serviceWorker
		.register("/flock/sw.js")
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

let workspace = null;

Blockly.utils.colour.setHsvSaturation(0.3); // 0 (inclusive) to 1 (exclusive), defaulting to 0.45
Blockly.utils.colour.setHsvValue(0.85); // 0 (inclusive) to 1 (exclusive), defaulting to 0.65

/*
function Mesh(id = "UNDEFINED") {
	this.id = id;
}
flock.Mesh = Mesh;
Mesh.prototype.toString = function MeshToString() {
	console.log("Mesh.toString", `${this.id}`);
	return `${this.id}`;
};
*/
// Function to save the current workspace state
function saveWorkspace() {
	const state = Blockly.serialization.workspaces.save(workspace);

	const key = "flock_autosave.json";

	// Save today's workspace state
	localStorage.setItem(key, JSON.stringify(state));
}

function loadWorkspaceAndExecute(json, workspace, executeCallback) {
	try {
		// Ensure that the workspace and json are valid before attempting to load
		if (!workspace || !json) {
			throw new Error("Invalid workspace or json data.");
		}

		Blockly.serialization.workspaces.load(json, workspace);
		executeCallback(); // Runs only if loading succeeds
	} catch (error) {
		console.error("Failed to load workspace:", error);

		// Additional handling for corrupt local storage or recovery
		if (error.message.includes("isDeadOrDying")) {
			// Try to reset workspace or handle specific cleanup for the isDeadOrDying error
			console.warn("Workspace might be corrupted, attempting reset.");
			workspace.clear(); // Clear the workspace if needed
			localStorage.removeItem("flock_autosave.json");
		}
	}
}

function loadWorkspace() {
	const urlParams = new URLSearchParams(window.location.search);
	const projectUrl = urlParams.get("project"); // Check for project URL parameter
	const reset = urlParams.get("reset"); // Check for reset URL parameter
	const savedState = localStorage.getItem("flock_autosave.json");
	const starter = "examples/starter.json"; // Starter JSON fallback

	// Helper function to load starter project
	function loadStarter() {
		fetch(starter)
			.then((response) => response.json())
			.then((json) => {
				loadWorkspaceAndExecute(json, workspace, executeCode);
			})
			.catch((error) => {
				console.error("Error loading starter example:", error);
			});
	}

	// Reset logic if 'reset' URL parameter is present
	if (reset) {
		console.warn("Resetting workspace and clearing local storage.");
		workspace.clear(); // Clear the workspace
		localStorage.removeItem("flock_autosave.json"); // Clear the saved state in localStorage
		// Optionally reload the starter project after reset
		loadStarter();
		return; // Exit the function after reset
	}

	if (projectUrl) {
		if (projectUrl === "starter") {
			// Explicit request for the starter project
			loadStarter();
		} else {
			// Load from project URL parameter
			fetch(projectUrl)
				.then((response) => {
					if (!response.ok) throw new Error("Invalid response");
					return response.json();
				})
				.then((json) => {
					loadWorkspaceAndExecute(json, workspace, executeCode);
				})
				.catch((error) => {
					console.error("Error loading project from URL:", error);
					// Fallback to starter project
					loadStarter();
				});
		}
	} else if (savedState) {
		// Load from local storage if available
		loadWorkspaceAndExecute(JSON.parse(savedState), workspace, executeCode);
	} else {
		// Load starter project if no other options
		loadStarter();
	}
}

function stripFilename(inputString) {
	const removeEnd = inputString.replace(/\(\d+\)/g, "");
	// Find the last occurrence of '/' or '\'
	let lastIndex = Math.max(
		removeEnd.lastIndexOf("/"),
		removeEnd.lastIndexOf("\\"),
	);

	if (lastIndex === -1) {
		return removeEnd.trim();
	}

	return removeEnd.substring(lastIndex + 1).trim();
}
async function exportCode() {
	try {
		const projectName =
			document.getElementById("projectName").value || "default_project";

		let ws = Blockly.getMainWorkspace();
		let usedModels = Blockly.Variables.allUsedVarModels(ws);
		let allModels = ws.getAllVariables();
		for (const model of allModels) {
			if (
				!usedModels.find((element) => element.getId() === model.getId())
			) {
				ws.deleteVariableById(model.getId());
			}
		}

		const json = Blockly.serialization.workspaces.save(workspace);
		const jsonString = JSON.stringify(json, null, 2); // Pretty-print the JSON

		// Use File System Access API if available
		if ("showSaveFilePicker" in window) {
			const options = {
				suggestedName: `${projectName}.json`,
				types: [
					{
						description: "JSON Files",
						accept: { "application/json": [".json"] },
					},
				],
			};

			const fileHandle = await window.showSaveFilePicker(options);
			const writable = await fileHandle.createWritable();
			await writable.write(jsonString);
			await writable.close();
		} else {
			// Fallback for older browsers
			const blob = new Blob([jsonString], { type: "application/json" });
			const link = document.createElement("a");
			link.href = URL.createObjectURL(blob);
			link.download = `${projectName}.json`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
	} catch (e) {
		console.error("Error exporting project:", e);
	}
}

let toolboxVisible = false;

let isExecuting = false;

async function executeCode() {
	// Check if the function is already running
	if (isExecuting) {
		console.log("Function already running, skipping execution.");
		return; // Exit if already running
	}

	// Set the flag to indicate the function is running
	isExecuting = true;

	// Utility function for delay
	const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

	// Wait until the engine is ready using a loop with an async delay
	while (!flock.engineReady) {
		await delay(100);
	}

	console.log("Engine ready");

	// Cache DOM elements
	const container = document.getElementById("maincontent");
	const switchViewsBtn = document.getElementById("switchViews");
	const renderCanvas = document.getElementById("renderCanvas");

	// Switch to code view if currently in canvas view
	if (currentView === "canvas") {
		currentView = "code";
		container.style.transform = `translateX(0px)`; // Move to Code view
		switchViewsBtn.textContent = "Canvas >>"; // Update button text
	}

	disposeGizmoManager();

	let showDebug = flock.scene?.debugLayer?.isVisible();

	if (showDebug) {
		flock.scene.debugLayer.hide();
	}

	// Generate the code from the workspace
	const code = javascriptGenerator.workspaceToCode(workspace);

	try {
		console.log(code);
		await flock.runCode(code);
		renderCanvas?.focus(); // Focus the render canvas safely if it exists
	} catch (error) {
		console.error("Error executing Blockly code:", error);
		isExecuting = false; // Reset the flag if there's an error

		// Load the starter project if execution fails
		const starter = "examples/starter.json";
		fetch(starter)
			.then((response) => response.json())
			.then((json) => {
				loadWorkspaceAndExecute(json, workspace, executeCode);
			})
			.catch((loadError) => {
				console.error(
					"Error loading starter project after execution failure:",
					loadError,
				);
			});
		return; // Exit after handling the error
	}

	// Check if the debug layer is visible and show it if necessary
	if (showDebug) {
		try {
			await flock.scene.debugLayer.show({
				embedMode: true,
				enableClose: false,
				enablePopup: false,
			});
		} catch (error) {
			console.error("Error showing debug layer:", error);
		}
	}

	setGizmoManager(new flock.BABYLON.GizmoManager(flock.scene, 8));

	await delay(1000);
	// Reset the flag to allow future executions
	isExecuting = false;
}

function stopCode() {
	// Stop all playing sounds
	if (flock.scene && flock.scene.mainSoundTrack) {
		flock.scene.mainSoundTrack.soundCollection.forEach((sound) => {
			if (sound.isPlaying) {
				sound.stop();
				console.log(`Stopped sound: ${sound.name}`);
			}
		});
	}

	// Close the audio context
	if (flock.audioContext) {
		flock.audioContext
			.close()
			.then(() => {
				console.log("Audio context closed.");
			})
			.catch((error) => {
				console.error("Error closing audio context:", error);
			});
	}

	// Stop rendering
	flock.engine.stopRenderLoop();
	console.log("Render loop stopped.");

	// Remove event listeners
	flock.removeEventListeners();

	// Switch to code view
	switchView(codeMode);
}

window.stopCode = stopCode;

function onResize() {
	Blockly.svgResize(workspace);
	//document.body.style.zoom = "reset";
	resizeCanvas();
	if (flock.engine) flock.engine.resize();
}
window.onresize = onResize;

async function exportBlockSnippet(block) {
	try {
		// Save the block and its children to a JSON object
		const blockJson = Blockly.serialization.blocks.save(block);

		// Convert the JSON object to a pretty-printed JSON string
		const jsonString = JSON.stringify(blockJson, null, 2);

		// Check if the File System Access API is available
		if ("showSaveFilePicker" in window) {
			// Define the options for the file picker
			const options = {
				suggestedName: "blockly_snippet.json",
				types: [
					{
						description: "JSON Files",
						accept: {
							"application/json": [".json"],
						},
					},
				],
			};

			// Show the save file picker
			const fileHandle = await window.showSaveFilePicker(options);

			// Create a writable stream
			const writable = await fileHandle.createWritable();

			// Write the JSON string to the file
			await writable.write(jsonString);

			// Close the writable stream
			await writable.close();
		} else {
			// Fallback for browsers that don't support the File System Access API
			const filename =
				prompt(
					"Enter a filename for the snippet:",
					"blockly_snippet",
				) || "blockly_snippet";
			const blob = new Blob([jsonString], { type: "application/json" });
			const link = document.createElement("a");
			link.href = URL.createObjectURL(blob);
			link.download = `${filename}.json`;
			link.click();
		}
	} catch (e) {
		console.error("Error exporting block:", e);
	}
}

import { getMetadata } from "meta-png";

function importSnippet() {
	const fileInput = document.getElementById("importFile");
	fileInput.click();

	fileInput.onchange = (event) => {
		const file = event.target.files[0];
		if (file) {
			const fileType = file.type;

			const reader = new FileReader();
			reader.onload = () => {
				const content = reader.result;

				if (fileType === "image/svg+xml") {
					// Handle SVG
					try {
						const parser = new DOMParser();
						const svgDoc = parser.parseFromString(
							content,
							"image/svg+xml",
						);

						// Extract metadata
						const metadataElement =
							svgDoc.querySelector("metadata");
						if (!metadataElement) {
							console.error(
								"No <metadata> tag found in the SVG file.",
							);
							return;
						}

						// Extract and parse JSON from metadata
						const metadataContent =
							metadataElement.textContent.trim();
						let blockJson;
						try {
							const parsedData = JSON.parse(metadataContent);

							// Ensure the key containing JSON exists
							if (!parsedData.blockJson) {
								console.error(
									"Metadata JSON does not contain 'blockJson'.",
								);
								return;
							}

							// Parse the block JSON if needed
							blockJson = JSON.parse(parsedData.blockJson);
						} catch (parseError) {
							console.error(
								"Error parsing metadata JSON:",
								parseError,
							);
							return;
						}

						// Load blocks into Blockly workspace without clearing
						try {
							const workspace = Blockly.getMainWorkspace(); // Ensure correct reference

							Blockly.serialization.blocks.append(
								blockJson,
								workspace,
							);
						} catch (workspaceError) {
							console.error(
								"Error loading blocks into workspace:",
								workspaceError,
							);
						}
					} catch (error) {
						console.error(
							"An error occurred while processing the SVG file:",
							error,
						);
					}
				} else if (fileType === "image/png") {
					// Handle PNG metadata
					try {
						const arrayBuffer = new Uint8Array(content);
						const encodedMetadata = getMetadata(
							arrayBuffer,
							"blockJson",
						);

						if (!encodedMetadata) {
							console.error("No metadata found in the PNG file.");
							return;
						}

						// Decode the URL-encoded metadata and parse it as JSON
						const decodedMetadata = JSON.parse(
							decodeURIComponent(encodedMetadata),
						);

						// Load blocks into Blockly workspace without clearing
						const workspace = Blockly.getMainWorkspace();
						Blockly.serialization.blocks.append(
							decodedMetadata,
							workspace,
						);
					} catch (error) {
						console.error("Error processing PNG metadata:", error);
					}
				} else if (fileType === "application/json") {
					// Handle JSON
					try {
						const blockJson = JSON.parse(content);

						// Load blocks into Blockly workspace without clearing
						const workspace = Blockly.getMainWorkspace();
						Blockly.serialization.blocks.append(
							blockJson,
							workspace,
						);
					} catch (error) {
						console.error("Error processing JSON file:", error);
					}
				} else {
					console.error("Unsupported file type:", fileType);
				}
			};
			if (fileType === "image/png") {
				reader.readAsArrayBuffer(file); // PNG files need ArrayBuffer for metadata
			} else {
				reader.readAsText(file); // Other files use text
			}
		}
	};
}

function addExportContextMenuOption() {
	Blockly.ContextMenuRegistry.registry.register({
		id: "exportBlock",
		weight: 200,
		displayText: function () {
			return "Export block as JSON snippet";
		},
		preconditionFn: function (scope) {
			return scope.block ? "enabled" : "hidden";
		},
		callback: function (scope) {
			exportBlockSnippet(scope.block);
		},
		scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
		checkbox: false,
	});
}

// Extend Blockly with custom context menu for importing snippets in the workspace
function addImportContextMenuOption() {
	Blockly.ContextMenuRegistry.registry.register({
		id: "importSnippet",
		weight: 100,
		displayText: function () {
			return "Import snippet";
		},
		preconditionFn: function (scope) {
			return "enabled";
		},
		callback: function (scope) {
			importSnippet();
		},
		scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
		checkbox: false,
	});
}

function addExportPNGContextMenuOption() {
	Blockly.ContextMenuRegistry.registry.register({
		id: "exportPNG",
		weight: 100,
		displayText: function () {
			return "Export as PNG";
		},
		preconditionFn: function (scope) {
			return "enabled";
		},
		callback: function (scope) {
			if (scope.block) {
				exportBlockAsPNG(scope.block);
			} else if (scope.workspace) {
				//exportWorkspaceAsPNG(scope.workspace);
			}
		},
		scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
		checkbox: false,
	});
}

// Extend Blockly with custom context menu for exporting SVG of the workspace
function addExportSVGContextMenuOption() {
	Blockly.ContextMenuRegistry.registry.register({
		id: "exportSVG",
		weight: 101,
		displayText: function () {
			return "Export as SVG";
		},
		preconditionFn: function (scope) {
			return "enabled";
		},
		callback: function (scope) {
			if (scope.block) {
				// Export selected block or stack as SVG
				exportBlockAsSVG(scope.block);
			} else if (scope.workspace) {
				// Export the entire workspace as SVG
				exportWorkspaceAsSVG(scope.workspace);
			}
		},
		scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
		checkbox: false,
	});
}

/*
function toggleToolbox() {
	const toolboxControl = document.getElementById("toolboxControl");

	if (!workspace) return;
	if (toolboxVisible) {
		toolboxVisible = false;
		workspace.getToolbox().setVisible(false);
		//onResize();
	} else {
		toolboxVisible = true;
		workspace.getToolbox().setVisible(true);
		// Delay binding the click event listener
		setTimeout(() => {
			document.addEventListener("click", handleClickOutside);
		}, 100); // Small delay to ensure the menu is shown before adding the listener
	}

	function handleClickOutside(event) {
		if (!toolboxControl.contains(event.target)) {
			workspace.getToolbox().setVisible(false);
			document.removeEventListener("click", handleClickOutside);
		}
	}
}

window.toggleToolbox = toggleToolbox;
*/

async function loadExample() {
	window.loadingCode = true;

	const exampleSelect = document.getElementById("exampleSelect");
	const exampleFile = exampleSelect.value;
	const projectNameElement = document.getElementById("projectName");

	if (exampleFile) {
		// Set the project name based on the selected option's text
		const selectedOption =
			exampleSelect.options[exampleSelect.selectedIndex].text;
		projectNameElement.value = selectedOption;

		fetch(exampleFile)
			.then((response) => response.json())
			.then((json) => {
				console.log("Loading:", selectedOption);
				loadWorkspaceAndExecute(json, workspace, executeCode);
			})
			.catch((error) => {
				console.error("Error loading example:", error);
			});
	}

	exampleSelect.value = "";
}
window.executeCode = executeCode;
window.exportCode = exportCode;
window.loadExample = loadExample;

// Function to maintain a 16:9 aspect ratio for the canvas
function resizeCanvas() {
	const canvasArea = document.getElementById("rightArea");
	const canvas = document.getElementById("renderCanvas");

	const areaWidth = canvasArea.clientWidth;
	let areaHeight = canvasArea.clientHeight;

	const gizmoButtons = document.getElementById("gizmoButtons");
	if (gizmoButtons.style.display != "none") {
		areaHeight -= 60; //Gizmos visible
	}

	const aspectRatio = 16 / 9;

	let newWidth, newHeight;

	if (areaWidth / areaHeight > aspectRatio) {
		newHeight = areaHeight;
		newWidth = newHeight * aspectRatio;
	} else {
		newWidth = areaWidth;
		newHeight = newWidth / aspectRatio;
	}

	canvas.style.width = `${newWidth}px`;
	canvas.style.height = `${newHeight}px`;
}

let viewMode = "both";
let codeMode = "both";
window.viewMode = viewMode;
window.codeMode = codeMode;

function switchView(view) {
	if (flock.scene) flock.scene.debugLayer.hide();
	const blocklyArea = document.getElementById("codePanel");
	const canvasArea = document.getElementById("rightArea");

	if (view === "both") {
		viewMode = "both";
		codeMode = "both";
		blocklyArea.style.display = "block";
		canvasArea.style.display = "block";
		blocklyArea.style.width = "0";
		canvasArea.style.width = "0";
		blocklyArea.style.flex = "2 1 0"; // 2/3 of the space
		canvasArea.style.flex = "1 1 0"; // 1/3 of the space		gizmoButtons.style.display = "flex";
	} else if (view === "canvas") {
		console.log("canvas");
		viewMode = "canvas";
		blocklyArea.style.display = "none";
		canvasArea.style.display = "block";
	}

	onResize(); // Ensure both Blockly and Babylon.js canvas resize correctly
}

window.switchView = switchView;

function toggleMenu() {
	const menu = document.getElementById("menu");
	const currentDisplay = window.getComputedStyle(menu).display;

	if (currentDisplay != "none") {
		menu.style.display = "none";
		document.removeEventListener("click", handleClickOutside);
	} else {
		menu.style.display = "flex";

		// Delay binding the click event listener
		setTimeout(() => {
			document.addEventListener("click", handleClickOutside);
		}, 100); // Small delay to ensure the menu is shown before adding the listener
	}

	function handleClickOutside(event) {
		if (!menu.contains(event.target)) {
			menu.style.display = "none";
			document.removeEventListener("click", handleClickOutside);
		}
	}
}

window.toggleMenu = toggleMenu;

document.addEventListener("DOMContentLoaded", () => {
	const requestFullscreen = () => {
		const elem = document.documentElement;

		if (elem.requestFullscreen) {
			elem.requestFullscreen();
		} else if (elem.mozRequestFullScreen) {
			// For Firefox
			elem.mozRequestFullScreen();
		} else if (elem.webkitRequestFullscreen) {
			// For Chrome, Safari, and Opera
			elem.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
		} else if (elem.msRequestFullscreen) {
			// For IE/Edge
			elem.msRequestFullscreen();
		}
	};

	const isMobile = () => {
		return /Mobi|Android/i.test(navigator.userAgent);
	};

	const isFullscreen = window.matchMedia(
		"(display-mode: fullscreen)",
	).matches;

	// Request fullscreen on mobile only when running as a PWA
	if (isMobile() && isFullscreen) {
		requestFullscreen();
		document.getElementById("fullscreenToggle").style.display = "none";
	}

	if (window.matchMedia("(display-mode: fullscreen)").matches) {
		// Adjust layout for fullscreen mode
		adjustViewport();
	}

	window
		.matchMedia("(display-mode: fullscreen)")
		.addEventListener("change", (e) => {
			if (e.matches) {
				// The app has entered fullscreen mode
				adjustViewport();
			}
		});

	if (isMobile()) {
		adjustViewport();
		//const dpr = window.devicePixelRatio || 1;
		// document.body.style.zoom = dpr;  // This adjusts the zoom based on DPR
	}

	// Additional adjustments for mobile UI in fullscreen mode
	const examples = document.getElementById("exampleSelect");
	if (examples) {
		examples.style.width = "70px";
	}
	const projectName = document.getElementById("projectName");
	if (projectName) {
		//projectName.style.minWidth = "5px";
		//projectName.style.maxWidth = "80px";
	}
});

let currentView = "start"; // Start with the code view
// Function to be called once the app has fully loaded

const container = document.getElementById("maincontent");
const bottomBar = document.getElementById("bottomBar");
const switchViewsBtn = document.getElementById("switchViews");
let startX = 0;
let currentTranslate = 0;
let previousTranslate = 0;
let isDragging = false;
const swipeThreshold = 50; // Minimum swipe distance

function showCanvasView() {
	const gizmoButtons = document.getElementById("gizmoButtons");

	gizmoButtons.style.display = "block";
	currentView = "canvas";
	container.style.transform = `translateX(0px)`; // Move to Code view
	switchViewsBtn.textContent = "Code >>"; // Update button text
	onResize();
}

function showCodeView() {
	const blocklyArea = document.getElementById("codePanel");
	blocklyArea.style.display = "block";
	const panelWidth = window.innerWidth;
	currentView = "code";
	container.style.transform = `translateX(-${panelWidth}px)`; // Move to Canvas view
	switchViewsBtn.textContent = "<< Canvas"; // Update button text
}

function togglePanels() {
	if (switchViewsBtn.textContent === "Code >>") {
		showCodeView();
	} else {
		showCanvasView();
	}
}

function setTranslateX(value) {
	container.style.transform = `translateX(${value}px)`;
}

// Function to add the swipe event listeners
function addSwipeListeners() {
	// Handle touch start (drag begins)
	bottomBar.addEventListener("touchstart", (e) => {
		startX = e.touches[0].clientX;
		isDragging = true;
	});

	// Handle touch move (drag in progress)
	bottomBar.addEventListener("touchmove", (e) => {
		if (!isDragging) return;
		const currentX = e.touches[0].clientX;
		const deltaX = currentX - startX;

		currentTranslate = previousTranslate + deltaX;

		// Ensure the container doesn't drag too far
		if (currentTranslate > 0) currentTranslate = 0;
		if (currentTranslate < -window.innerWidth)
			currentTranslate = -window.innerWidth;

		setTranslateX(currentTranslate);
	});

	// Handle touch end (drag ends, snap to nearest panel)
	bottomBar.addEventListener("touchend", () => {
		isDragging = false;

		// Calculate the total distance swiped
		const deltaX = currentTranslate - previousTranslate;

		// Snap to the next or previous panel based on swipe distance and direction
		if (deltaX < -swipeThreshold) {
			showCodeView(); // Swipe left to switch to the Canvas view
		} else if (deltaX > swipeThreshold) {
			showCanvasView(); // Swipe right to switch to the Code view
		}

		previousTranslate = currentTranslate; // Update the last translate value
	});
}

let savedView = "canvas";

function togglePlayMode() {
	if (!flock.scene) return;

	const blocklyArea = document.getElementById("codePanel");
	const canvasArea = document.getElementById("rightArea");
	const gizmoButtons = document.getElementById("gizmoButtons");
	const bottomBar = document.getElementById("bottomBar");

	const gizmosVisible =
		gizmoButtons &&
		getComputedStyle(gizmoButtons).display !== "none" &&
		getComputedStyle(gizmoButtons).visibility !== "hidden";

	if (gizmosVisible) {
		savedView = currentView;
		showCanvasView();
		flock.scene.debugLayer.hide();
		blocklyArea.style.display = "none";
		gizmoButtons.style.display = "none";
		bottomBar.style.display = "none";
		document.documentElement.style.setProperty("--dynamic-offset", "40px");
	} else {
		flock.scene.debugLayer.hide();
		blocklyArea.style.display = "block";
		canvasArea.style.display = "block";
		gizmoButtons.style.display = "block";
		bottomBar.style.display = "block";
		switchView("both");
		document.documentElement.style.setProperty("--dynamic-offset", "65px");

		if (savedView === "code") showCodeView();
		else showCanvasView();
	}

	onResize();
}

// Function to add the button event listener
function addButtonListener() {
	switchViewsBtn.addEventListener("click", togglePanels);
}

function toggleDesignMode() {
	if (!flock.scene) return;

	const blocklyArea = document.getElementById("codePanel");
	const canvasArea = document.getElementById("rightArea");
	const gizmoButtons = document.getElementById("gizmoButtons");

	if (flock.scene.debugLayer.isVisible()) {
		switchView("both");
		flock.scene.debugLayer.hide();
	} else {
		blocklyArea.style.display = "none";
		codeMode = "none";
		canvasArea.style.display = "block";
		canvasArea.style.width = "0";
		gizmoButtons.style.display = "block";

		flock.scene.debugLayer.show({
			embedMode: true,
			enableClose: false,
			enablePopup: false,
		});

		canvasArea.style.flex = "1 1 0";
	}

	onResize();
}

// Initialization function to set up everything
function initializeUI() {
	addSwipeListeners(); // Add swipe event listeners
	addButtonListener(); // Add button click listener
}

function initializeApp() {
	console.log("Initializing app...");

	// Add event listeners for menu buttons and controls
	const runCodeButton = document.getElementById("runCodeButton");
	const toggleDesignButton = document.getElementById("toggleDesign");
	const togglePlayButton = document.getElementById("togglePlay");
	const stopCodeButton = document.getElementById("stopCodeButton");
	const fileInput = document.getElementById("fileInput");
	const exportCodeButton = document.getElementById("exportCodeButton");

	runCodeButton.addEventListener("click", executeCode);
	stopCodeButton.addEventListener("click", stopCode);
	exportCodeButton.addEventListener("click", exportCode);

	// Enable the file input after initialization
	fileInput.removeAttribute("disabled");

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

	exampleSelect.addEventListener("change", loadExample);

	onResize();
}

async function exportWorkspaceAsSVG(workspace) {
	// Get the SVG element representing the entire workspace
	const svg = workspace.getParentSvg().cloneNode(true);

	// Adjust the dimensions to fit the content
	const bbox = svg.getBBox();
	svg.setAttribute("width", bbox.width);
	svg.setAttribute("height", bbox.height);
	svg.setAttribute(
		"viewBox",
		`${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`,
	);

	// Convert the SVG to a data URL
	const serializer = new XMLSerializer();
	const svgString = serializer.serializeToString(svg);
	const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });

	// Create a download link
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = "workspace.svg";
	link.click();
}

async function convertFontToBase64(fontUrl) {
	const response = await fetch(fontUrl);
	const fontBlob = await response.blob();
	const reader = new FileReader();

	return new Promise((resolve, reject) => {
		reader.onloadend = () => {
			const base64Data = reader.result.split(",")[1]; // Remove the data URL prefix
			resolve(base64Data);
		};
		reader.onerror = reject;
		reader.readAsDataURL(fontBlob); // Read as data URL and convert to base64
	});
}

async function generateSVG(block) {
	const svgBlock = block.getSvgRoot().cloneNode(true);
	const serializer = new XMLSerializer();

	svgBlock.removeAttribute("transform");

	const bbox = block.getSvgRoot().getBBox();

	const images = svgBlock.querySelectorAll("image");
	await Promise.all(
		Array.from(images).map(async (img) => {
			const href =
				img.getAttribute("xlink:href") || img.getAttribute("href");
			if (href && !href.startsWith("data:")) {
				try {
					const response = await fetch(href);
					const blob = await response.blob();
					const reader = new FileReader();
					const dataUrl = await new Promise((resolve) => {
						reader.onload = () => resolve(reader.result);
						reader.readAsDataURL(blob);
					});
					img.setAttribute("xlink:href", dataUrl);
					img.setAttribute("href", dataUrl);
				} catch (error) {
					console.error(`Failed to embed image: ${href}`, error);
				}
			}
		}),
	);

	const uiElements = svgBlock.querySelectorAll("rect.blocklyFieldRect");
	uiElements.forEach((element) => {
		const parentBlock = element.closest(".blocklyDraggable");
		if (element.classList.contains("blocklyDropdownRect")) {
			const blockFill = parentBlock
				?.querySelector(".blocklyPath")
				?.getAttribute("fill");
			if (blockFill) {
				element.setAttribute("fill", blockFill);
			}
			element.setAttribute("stroke", "#999999");
			element.setAttribute("stroke-width", "1px");
		} else if (element.classList.contains("blocklyCheckbox")) {
			element.setAttribute("style", "fill: #ffffff !important;");
			element.setAttribute("stroke", "#999999");
			element.setAttribute("stroke-width", "1px");
		} else {
			element.setAttribute("fill", "none");
			element.setAttribute("stroke", "#999999");
			element.setAttribute("stroke-width", "1px");
		}
	});

	const uiTexts = svgBlock.querySelectorAll(
		"text.blocklyCheckbox, text.blocklyText",
	);
	uiTexts.forEach((textElement) => {
		textElement.setAttribute("style", "fill: #000000 !important;");
		textElement.setAttribute("stroke", "none");
		textElement.setAttribute("font-weight", "600");
	});

	const fontBase64 = await convertFontToBase64("./fonts/Asap-Medium.woff2");

	const style = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"style",
	);
	style.textContent = `
	@font-face {
	  font-family: "Asap";
	  src: url('data:font/woff2;base64,${fontBase64}') format('woff2');
	}
	.blocklyText {
	  font-family: "Asap", sans-serif;
	  font-weight: 500;
	}
	.blocklyEditableText rect.blocklyFieldRect:not(.blocklyDropdownRect) {
	  fill: #ffffff !important; 
	}
  `;
	svgBlock.insertBefore(style, svgBlock.firstChild);

	const wrapperSVG = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"svg",
	);
	wrapperSVG.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	wrapperSVG.setAttribute("width", bbox.width);
	wrapperSVG.setAttribute("height", bbox.height);
	wrapperSVG.setAttribute("viewBox", `0 0 ${bbox.width} ${bbox.height}`);

	const translationGroup = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"g",
	);
	translationGroup.setAttribute(
		"transform",
		`translate(${-bbox.x}, ${-bbox.y})`,
	);
	translationGroup.appendChild(svgBlock);

	wrapperSVG.appendChild(translationGroup);

	// Get the JSON representation of the block
	const blockJson = JSON.stringify(Blockly.serialization.blocks.save(block));
	const encodedJson = encodeURIComponent(blockJson); // Ensure it is URL-encoded

	// Embed the JSON in a <metadata> tag inside the SVG
	const metadata = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"metadata",
	);
	metadata.textContent = `{"blockJson": "${encodedJson}"}`;
	wrapperSVG.appendChild(metadata);

	const svgString = serializer.serializeToString(wrapperSVG);
	const svgDeclaration = '<?xml version="1.0" encoding="UTF-8"?>';
	const finalSVG = `${svgDeclaration}${svgString}`;

	return finalSVG;
}

async function exportBlockAsSVG(block) {
	const finalSVG = await generateSVG(block);

	// Create and download the SVG blob
	const blob = new Blob([finalSVG], { type: "image/svg+xml" });
	const link = document.createElement("a");
	link.download = `${block.type}.svg`;
	link.href = URL.createObjectURL(blob);
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}

import { addMetadata } from "meta-png";

async function exportBlockAsPNG(block) {
	const finalSVG = await generateSVG(block);
	const blockJson = JSON.stringify(Blockly.serialization.blocks.save(block));
	const encodedJson = encodeURIComponent(blockJson);

	const img = new Image();
	const svgBlob = new Blob([finalSVG], { type: "image/svg+xml" });
	const svgUrl = URL.createObjectURL(svgBlob);

	const scale = 2; // Adjust for higher resolution

	img.onload = () => {
		const canvas = document.createElement("canvas");
		const scaledWidth = img.width * scale;
		const scaledHeight = img.height * scale;
		canvas.width = scaledWidth;
		canvas.height = scaledHeight;
		const ctx = canvas.getContext("2d");

		// Improve image quality by setting a higher resolution
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = "high";

		// Draw at a higher resolution
		ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

		canvas.toBlob(async (pngBlob) => {
			if (!pngBlob) {
				console.error("Failed to create PNG blob");
				return;
			}

			const arrayBuffer = await pngBlob.arrayBuffer();
			const updatedPngBuffer = addMetadata(
				new Uint8Array(arrayBuffer),
				"blockJson",
				encodedJson,
			);

			const updatedBlob = new Blob([updatedPngBuffer], {
				type: "image/png",
			});
			const updatedUrl = URL.createObjectURL(updatedBlob);

			const link = document.createElement("a");
			link.download = `${block.type}.png`;
			link.href = updatedUrl;
			link.click();

			URL.revokeObjectURL(svgUrl);
			URL.revokeObjectURL(updatedUrl);
		}, "image/png");
	};

	img.onerror = (error) => {
		console.error("Failed to load SVG image:", error);
	};

	img.src = svgUrl;
}

// Function to enforce minimum font size and delay the focus to prevent zoom
function enforceMinimumFontSize(input) {
	const currentFontSize = parseFloat(input.style.fontSize);

	// Set font size immediately if it's less than 16px
	if (currentFontSize < 16) {
		input.style.fontSize = "16px";
		input.offsetHeight; // Force reflow to apply the font size change
	}

	// Delay focus to prevent zoom
	input.addEventListener(
		"focus",
		(event) => {
			event.preventDefault(); // Prevent the default focus action
			setTimeout(() => {
				input.focus(); // Focus the input after a short delay
			}, 50); // Adjust the delay as needed (50ms is usually enough)
		},
		{ once: true },
	); // Add the event listener once for each input
}

// Function to observe changes in the DOM for dynamically added blocklyHtmlInput elements
function observeBlocklyInputs() {
	const observer = new MutationObserver((mutationsList) => {
		mutationsList.forEach((mutation) => {
			if (mutation.type === "childList") {
				mutation.addedNodes.forEach((node) => {
					// Check if the added node is an INPUT element with the blocklyHtmlInput class
					if (
						node.nodeType === Node.ELEMENT_NODE &&
						node.classList.contains("blocklyHtmlInput")
					) {
						enforceMinimumFontSize(node); // Set font size and delay focus
					}
				});
			}
		});
	});

	// Start observing the entire document for added nodes (input fields may appear anywhere)
	observer.observe(document.body, { childList: true, subtree: true });
}

window.onload = function () {
	const scriptElement = document.getElementById("flock");
	if (scriptElement) {
		initializeFlock();
		console.log("Standalone Flock");
		return; // standalone flock
	}

	observeBlocklyInputs();

	defineBaseBlocks();
	defineBlocks();
	defineShapeBlocks();
	defineGenerators();
	// Initialize Blockly and add custom context menu options
	addExportContextMenuOption();
	addImportContextMenuOption();
	addExportSVGContextMenuOption();
	addExportPNGContextMenuOption();
	//observeFlyoutVisibility(workspace);
	window.toolboxVisible = toolboxVisible;

	function getBlocksFromToolbox(workspace) {
		const toolboxBlocks = [];

		const seenBlocks = new Set();

		function processItem(item, categoryName = "") {
			const currentCategory = item.getName
				? item.getName()
				: categoryName;

			if (currentCategory === "Snippets") {
				return;
			}

			if (item.getContents) {
				const contents = item.getContents();
				const blocks = Array.isArray(contents) ? contents : [contents];

				blocks.forEach((block) => {
					if (block.kind === "block" && !seenBlocks.has(block.type)) {
						seenBlocks.add(block.type); // Track processed block types
						toolboxBlocks.push({
							type: block.type,
							text: block.type,
							full: block,
						});
					}
				});
			}

			if (item.getChildToolboxItems) {
				item.getChildToolboxItems().forEach((child) => {
					processItem(child, currentCategory);
				});
			}
		}

		// Process all toolbox items
		workspace
			.getToolbox()
			.getToolboxItems()
			.forEach((item) => processItem(item));

		return toolboxBlocks;
	}

	function overrideSearchPlugin(workspace) {
		// Get the registered search category
		const SearchCategory = Blockly.registry.getClass(
			Blockly.registry.Type.TOOLBOX_ITEM,
			"search",
		);

		if (!SearchCategory) {
			console.error("Search category not found in registry!");
			return;
		}

		// Hook into the category's prototype
		const toolboxBlocks = getBlocksFromToolbox(workspace);
		SearchCategory.prototype.initBlockSearcher = function () {
			this.blockSearcher.indexBlocks = function () {
				this.indexedBlocks_ = toolboxBlocks; // Replace the index with toolbox blocks
			};

			// Rebuild the index immediately
			this.blockSearcher.indexBlocks();
		};

		SearchCategory.prototype.matchBlocks = function () {
			// Skip processing on initial focus
			if (!this.hasInputStarted) {
				this.hasInputStarted = true;
				return;
			}

			const query = this.searchField?.value.toLowerCase().trim() || "";

			// Filter blocks based on the query
			const matches = this.blockSearcher.indexedBlocks_.filter(
				(block) => {
					// Check if the block has a text property
					if (block.text) {
						return block.text.toLowerCase().includes(query); // Only match valid blocks
					}
					return false; // Ignore blocks without text
				},
			);

			// Display matches (ensure this step renders results correctly)
			this.showMatchingBlocks(matches);
		};

		/**
		 * Recursively builds XML from block JSON, preserving all shadows.
		 */
		function createXmlFromJson(blockJson, isShadow = false) {
			// Create a block or shadow element
			const blockXml = Blockly.utils.xml.createElement(
				isShadow ? "shadow" : "block",
			);
			blockXml.setAttribute("type", blockJson.type);

			// Add mutation directly for blocks like 'lists_create_with'
			if (
				blockJson.type === "lists_create_with" &&
				blockJson.extraState
			) {
				const mutation = Blockly.utils.xml.createElement("mutation");
				mutation.setAttribute("items", blockJson.extraState.itemCount); // Add itemCount
				blockXml.appendChild(mutation); // Attach mutation inside the block
			}

			// Process inputs and shadows
			if (blockJson.inputs) {
				Object.entries(blockJson.inputs).forEach(([name, input]) => {
					const valueXml = Blockly.utils.xml.createElement("value");
					valueXml.setAttribute("name", name);

					if (input.block) {
						// Add nested blocks
						const nestedXml = createXmlFromJson(input.block, false);
						valueXml.appendChild(nestedXml);
					}

					if (input.shadow) {
						// Add shadow blocks
						const shadowXml = createXmlFromJson(input.shadow, true);
						valueXml.appendChild(shadowXml);
					}

					blockXml.appendChild(valueXml);
				});
			}

			// Preserve fields (e.g., values like numbers or text)
			if (blockJson.fields) {
				Object.entries(blockJson.fields).forEach(([name, value]) => {
					const fieldXml = Blockly.utils.xml.createElement("field");
					fieldXml.setAttribute("name", name);
					fieldXml.textContent = value;
					blockXml.appendChild(fieldXml);
				});
			}

			return blockXml;
		}

		SearchCategory.prototype.showMatchingBlocks = function (matches) {
			const flyout = this.workspace_.getToolbox().getFlyout();
			if (!flyout) {
				console.error("Flyout not found!");
				return;
			}

			// Clear the flyout
			flyout.hide();
			flyout.show([]);

			const xmlList = [];
			const mutations = [];

			matches.forEach((match) => {
				const blockJson = match.full; // Full structure
				const blockXml = createXmlFromJson(blockJson); // Generate XML

				xmlList.push(blockXml); // Store XML

				// Handle mutations (e.g., itemCount for lists_create_with)
				if (
					blockJson.type === "lists_create_with" &&
					blockJson.extraState
				) {
					const mutation =
						Blockly.utils.xml.createElement("mutation");
					mutation.setAttribute(
						"items",
						blockJson.extraState.itemCount,
					); // Apply itemCount
					mutations.push(mutation);
				} else {
					mutations.push(null); // No mutation needed
				}
			});

			// Display the blocks in the flyout
			flyout.show(xmlList);

			// Apply mutations after rendering
			const flyoutWorkspace = flyout.getWorkspace();
			flyoutWorkspace.getAllBlocks(false).forEach((block, index) => {
				const mutation = mutations[index];
				if (mutation) {
					block.domToMutation(mutation); // Apply mutation dynamically
				}
			});
		};

		const toolboxDef = workspace.options.languageTree; // Get toolbox XML/JSON

		workspace.updateToolbox(toolboxDef); // Force rebuild toolbox
	}

	// Register the custom renderer
	Blockly.registry.register(
		Blockly.registry.Type.RENDERER,
		"custom_zelos_renderer",
		CustomZelosRenderer,
	);

	workspace = Blockly.inject("blocklyDiv", options);

	workspace.registerToolboxCategoryCallback('VARIABLE', function(ws) {

		console.log("Adding variable shadows");
	  // Get the default XML list for the Variables category.
	  const xmlList = Blockly.Variables.flyoutCategory(ws);

	  // For each dynamically generated variables_set block, add a math_number shadow.
	  xmlList.forEach((xmlBlock) => {
		if (xmlBlock.getAttribute('type') === 'variables_set') {
		  const valueElement = document.createElement('value');
		  valueElement.setAttribute('name', 'VALUE');

		  const shadowElement = document.createElement('shadow');
		  shadowElement.setAttribute('type', 'math_number');

		  const fieldElement = document.createElement('field');
		  fieldElement.setAttribute('name', 'NUM');
		  fieldElement.textContent = '0';

		  shadowElement.appendChild(fieldElement);
		  valueElement.appendChild(shadowElement);
		  xmlBlock.appendChild(valueElement);
		}
	  });

	  // Find an existing variables_set block to clone.
	  const defaultBlock = xmlList.find(xmlBlock => xmlBlock.getAttribute('type') === 'variables_set');
	  if (defaultBlock) {
		// Clone the default block so it retains the dynamic variable field.
		const xmlBlockText = defaultBlock.cloneNode(true);

		// Locate the VALUE input in the cloned block.
		const valueElements = xmlBlockText.getElementsByTagName('value');
		for (let i = 0; i < valueElements.length; i++) {
		  if (valueElements[i].getAttribute('name') === 'VALUE') {
			// Remove any existing shadow (the math_number one).
			while (valueElements[i].firstChild) {
			  valueElements[i].removeChild(valueElements[i].firstChild);
			}
			// Create a new shadow block of type "text".
			const shadowText = document.createElement('shadow');
			shadowText.setAttribute('type', 'text');

			// Add the default text field.
			const fieldText = document.createElement('field');
			fieldText.setAttribute('name', 'TEXT');
			fieldText.textContent = '';
			shadowText.appendChild(fieldText);
			valueElements[i].appendChild(shadowText);
			break;
		  }
		}

		// Insert the new text-shadow block immediately after the default block.
		const defaultIndex = xmlList.indexOf(defaultBlock);
		if (defaultIndex !== -1) {
		  xmlList.splice(defaultIndex + 1, 0, xmlBlockText);
		}
	  }
	  return xmlList;
	});

	
	const multiselectPlugin = new Multiselect(workspace);
	multiselectPlugin.init(options);

	// Add this debug listener right after workspace injection
	workspace.addChangeListener(function (event) {
		// Only log events that are recorded in the undo stack
		if (event.recordUndo) {
			// Add stack trace to see where the event is coming from
			/*console.log("Undoable Event:", {
				type: event.type,
				blockId: event.blockId,
				group: event.group,
				timestamp: event.timestamp,
				details: event,
				trace: new Error().stack,
			});*/

			// Log the current undo stack size
			const undoStack = workspace.undoStack_;
			//console.log("Undo Stack Size:", undoStack ? undoStack.length : 0);
		}
	});

	workspace.addChangeListener(BlockDynamicConnection.finalizeConnections);

	overrideSearchPlugin(workspace);

	const workspaceSearch = new WorkspaceSearch(workspace);
	workspaceSearch.init();

	// Resize Blockly workspace and Babylon.js canvas when the window is resized
	window.addEventListener("resize", onResize);

	setupAutoValueBehavior(workspace);
	workspace.addChangeListener(handleBlockSelect);
	workspace.addChangeListener(handleBlockDelete);

	Blockly.getMainWorkspace().addChangeListener((event) => {
		// Check if the event is a block collapse action
		if (
			event.type === Blockly.Events.BLOCK_CHANGE &&
			event.element === "collapsed"
		) {
			const block = Blockly.getMainWorkspace().getBlockById(
				event.blockId,
			);

			// Check if the block is a top-level block (no parent)
			if (block && !block.getParent() && block.isCollapsed()) {
				// Call Blockly's built-in clean up function
				Blockly.getMainWorkspace().cleanUp();
			}
		}
	});

	Blockly.getMainWorkspace().addChangeListener((event) => {
		// Check if the event is a block collapse/expand action
		if (
			event.type === Blockly.Events.BLOCK_CHANGE &&
			event.element === "collapsed"
		) {
			const block = Blockly.getMainWorkspace().getBlockById(
				event.blockId,
			);

			// Check if the block is a top-level block (no parent)
			if (block && !block.getParent()) {
				// Call Blockly's built-in clean up function when the block is collapsed or expanded
				Blockly.getMainWorkspace().cleanUp();
			}
		}
	});

	let dummyNextBlock = null; // Store the dummy next block
	let dummyPreviousBlock = null; // Store the dummy previous block
	let draggedBlock = null; // Variable to store the currently dragged block

	// Listen for the drag start event to detect when a block starts being dragged
	workspace.getCanvas().addEventListener("mousedown", function (event) {
		// Check if the event target is a block being dragged (using Blockly's internal event system)
		if (
			event.target &&
			event.target.block &&
			event.target.block.type === "when_clicked"
		) {
			draggedBlock = event.target.block; // Store the dragged block
			// Listen for mousemove to track the block's position during dragging
			workspace.getCanvas().addEventListener("mousemove", onMouseMove);
		}
	});

	// Listen for mouse move events during dragging to track the block's position
	function onMouseMove(event) {
		if (draggedBlock) {
			//console.log("Dragging block:", draggedBlock);

			// Check if the dragged block is over any other block
			checkIfOverAnyBlock(draggedBlock);
		}
	}

	// Check if the dragged "when_clicked" block is over any other block
	function checkIfOverAnyBlock(sourceBlock) {
		const allBlocks = workspace.getAllBlocks();
		let isOverOtherBlock = false;

		for (let i = 0; i < allBlocks.length; i++) {
			const targetBlock = allBlocks[i];

			// Skip the source block itself
			if (sourceBlock === targetBlock) continue;

			// Check if the dragged block is near the target block
			if (isBlockOverAnotherBlock(sourceBlock, targetBlock)) {
				isOverOtherBlock = true;
				break; // Stop as soon as we detect it's over a block
			}
		}

		// If the dragged block is over another block, add the next/previous blocks
		if (isOverOtherBlock) {
			addNextAndPreviousBlocks(sourceBlock);
		} else {
			// If not over another block, remove the next/previous blocks
			removeNextAndPreviousBlocks();
		}
	}

	// Check if the dragged block is near another block (e.g., within a certain distance)
	function isBlockOverAnotherBlock(sourceBlock, targetBlock) {
		const sourcePosition = sourceBlock.getRelativeToSurfaceXY();
		const targetPosition = targetBlock.getRelativeToSurfaceXY();

		// Define a "nearby" threshold distance (you can adjust this value)
		const threshold = 50;

		// Calculate the distance between the blocks
		const distanceX = Math.abs(sourcePosition.x - targetPosition.x);
		const distanceY = Math.abs(sourcePosition.y - targetPosition.y);

		return distanceX < threshold && distanceY < threshold; // If within the threshold, it's "over" the target block
	}

	// Add the "next" and "previous" blocks to the dragged block (when_clicked)
	function addNextAndPreviousBlocks(sourceBlock) {
		// Only add the blocks if they don't already exist
		if (!dummyNextBlock && !dummyPreviousBlock) {
			dummyNextBlock = workspace.newBlock("next_statement");
			dummyPreviousBlock = workspace.newBlock("previous_statement");

			// Attach the dummy blocks to the source block
			dummyNextBlock.setParent(sourceBlock);
			dummyPreviousBlock.setParent(sourceBlock);

			// Make these blocks non-interactive (they are just visual cues)
			dummyNextBlock.setEditable(false);
			dummyPreviousBlock.setEditable(false);

			// Position them next to the dragged block
			dummyNextBlock.moveBy(10, 10);
			dummyPreviousBlock.moveBy(10, 30);

			//console.log("Dummy next and previous blocks added");
		}
	}

	// Remove the next and previous blocks if the dragged block is not over another block
	function removeNextAndPreviousBlocks() {
		if (dummyNextBlock) {
			dummyNextBlock.dispose();
			dummyNextBlock = null;
		}
		if (dummyPreviousBlock) {
			dummyPreviousBlock.dispose();
			dummyPreviousBlock = null;
		}

		//console.log("Dummy next and previous blocks removed");
	}

	// Listen for the drag end event to clean up after the drag ends
	workspace.getCanvas().addEventListener("mouseup", function (event) {
		if (draggedBlock) {
			//console.log("Drag ended for block:", draggedBlock);

			// Stop the mousemove listener after the drag is done
			workspace.getCanvas().removeEventListener("mousemove", onMouseMove);

			// Clean up the visual blocks after the drag ends
			removeNextAndPreviousBlocks();

			// Reset the draggedBlock variable
			draggedBlock = null;
		}
	});

	const workspaceSvg = workspace.getParentSvg();

	// Bind mousemove event using browserEvents
	Blockly.browserEvents.bind(workspaceSvg, "mousemove", null, (event) => {
		const mouseXY = Blockly.utils.browserEvents.mouseToSvg(
			event,
			workspace.getParentSvg(),
			workspace.getInverseScreenCTM(),
		);

		const absoluteMetrics = workspace
			.getMetricsManager()
			.getAbsoluteMetrics();
		mouseXY.x -= absoluteMetrics.left;
		mouseXY.y -= absoluteMetrics.top;

		// Adjust for scrolling
		mouseXY.x -= workspace.scrollX;
		mouseXY.y -= workspace.scrollY;

		// Adjust for zoom scaling
		mouseXY.x /= workspace.scale;
		mouseXY.y /= workspace.scale;

		highlightBlockUnderCursor(workspace, mouseXY.x, mouseXY.y);
	});

	let lastHighlightedBlock = null;

	function highlightBlockUnderCursor(workspace, cursorX, cursorY) {
		if (lastHighlightedBlock) {
			lastHighlightedBlock.removeSelect();
			lastHighlightedBlock = null;
		}

		const allBlocks = workspace.getAllBlocks();

		// Flatten all descendants of each block to consider nested blocks
		const blocksWithDescendants = [];
		for (const block of allBlocks) {
			blocksWithDescendants.push(...block.getDescendants(false));
		}

		// Iterate through blocks in reverse order to prioritize inner blocks
		for (let i = blocksWithDescendants.length - 1; i >= 0; i--) {
			const block = blocksWithDescendants[i];
			if (!block.rendered) continue;

			const blockBounds = block.getBoundingRectangle();

			// Check if cursor is within block bounds
			if (
				cursorX >= blockBounds.left &&
				cursorX <= blockBounds.right &&
				cursorY >= blockBounds.top &&
				cursorY <= blockBounds.bottom
			) {
				if (isBlockDraggable(block)) {
					block.addSelect();
					lastHighlightedBlock = block;
				}
				lastHighlightedBlock = block;
				break;
			}
		}
	}

	function isBlockDraggable(block) {
		// Check if block is a shadow block
		if (block.isShadow()) {
			return false;
		}

		if (block.previousConnection || block.nextConnection) {
			return false;
		}

		// Check if block is a C-block
		if (block.statementInputCount > 0) {
			return false;
		}

		// Check if block is movable
		if (!block.isMovable()) {
			return false;
		}

		// Check if block is deletable
		if (!block.isDeletable()) {
			return false;
		}

		// Output blocks are allowed
		if (block.outputConnection) {
			return true;
		}

		return true;
	}

	workspace.addChangeListener(function (event) {
		if (
			event.type === Blockly.Events.BLOCK_MOVE ||
			event.type === Blockly.Events.BLOCK_CREATE ||
			event.type === Blockly.Events.SELECTED
		) {
			requestAnimationFrame(() => {
				enforceOrphanZOrder();
			});
		}
	});

	function enforceOrphanZOrder() {
		workspace.getAllBlocks().forEach((block) => {
			// Check if the block is orphaned
			if (!block.getParent() && !block.isInFlyout) {
				bringToTop(block);
			}
		});
	}

	function bringToTop(block) {
		const svgGroup = block.getSvgRoot();
		if (svgGroup && svgGroup.parentNode) {
			svgGroup.parentNode.appendChild(svgGroup);
		}
	}

	//Blockly.ContextMenuItems.registerCommentOptions();
	const navigationController = new NavigationController();
	navigationController.init();
	navigationController.addWorkspace(workspace);
	// Turns on keyboard navigation.
	//navigationController.enable(workspace);

	console.log("Welcome to Flock 🐑🐑🐑");

	// Call this function to autosave periodically
	setInterval(saveWorkspace, 30000); // Autosave every 30 seconds

	(async () => {
		await flock.initialize();
	})();

	//workspace.getToolbox().setVisible(false);

	workspace.addChangeListener(function (event) {
		if (event.type === Blockly.Events.FINISHED_LOADING) {
			initializeVariableIndexes();
			window.loadingCode = false;
		}
	});
	workspace.addChangeListener(Blockly.Events.disableOrphans);

	// Initial view setup
	window.loadingCode = true;

	loadWorkspace();
	switchView("both");

	workspace.addChangeListener(function (event) {
		if (
			event.type === Blockly.Events.TOOLBOX_ITEM_SELECT ||
			event.type === Blockly.Events.FLYOUT_SHOW
		) {
			const toolbox = workspace.getToolbox();
			const selectedItem = toolbox.getSelectedItem();

			if (selectedItem && selectedItem.getName() === "Snippets") {
				window.loadingCode = true;
			} else {
				window.loadingCode = false;
			}
		}
	});

	document
		.getElementById("fileInput")
		.addEventListener("change", function (event) {
			const reader = new FileReader();
			reader.onload = function () {
				window.loadingCode = true;
				const text = reader.result;
				const json = JSON.parse(text);

				// Set the project name as the value of the projectName input field
				document.getElementById("projectName").value = stripFilename(
					document
						.getElementById("fileInput")
						.value.replace(".json", ""),
				);

				loadWorkspaceAndExecute(json, workspace, executeCode);
			};
			reader.readAsText(event.target.files[0]);
		});

	const blockTypesToCleanUp = [
		"start",
		"forever",
		"when_clicked",
		"when_touches",
		"when_key_event",
		"on_event",
		"procedures_defnoreturn",
		"procedures_defreturn",
	];

	workspace.cleanUp = function () {
		//console.log('Starting workspace cleanup');
		Blockly.Events.setGroup(true); // Start a new group for cleanup events

		const topBlocks = workspace.getTopBlocks(false);
		const spacing = 40;
		let cursorY = 10;
		let cursorX = 10;

		topBlocks.sort(
			(a, b) =>
				a.getRelativeToSurfaceXY().y - b.getRelativeToSurfaceXY().y,
		);

		topBlocks.forEach((block) => {
			if (blockTypesToCleanUp.includes(block.type)) {
				const blockXY = block.getRelativeToSurfaceXY();
				//console.log(`Moving block ${block.type} during cleanup`);
				block.moveBy(cursorX - blockXY.x, cursorY - blockXY.y);
				cursorY += block.getHeightWidth().height + spacing;
			}
		});

		Blockly.Events.setGroup(false); // End the group
		//console.log('Finished workspace cleanup');
	};

	let cleanupTimeout;

	// Get the canvas element
	const canvas = document.getElementById("renderCanvas");

	// Disable text selection on the body when the canvas is touched or clicked
	function disableSelection() {
		document.body.style.userSelect = "none"; // Disable text selection
	}

	// Enable text selection when touching or clicking outside the canvas
	function enableSelection(event) {
		// Check if the event target is outside the canvas
		if (!canvas.contains(event.target)) {
			document.body.style.userSelect = "auto"; // Enable text selection
		}
	}

	// For mouse events
	canvas.addEventListener("mousedown", disableSelection);
	document.addEventListener("mousedown", enableSelection);

	// For touch events (mobile)
	canvas.addEventListener("touchstart", disableSelection);
	document.addEventListener("touchstart", enableSelection);

	workspace.addChangeListener(function (event) {
		// Log all events during cleanup
		if (window.cleanupInProgress) {
			/*console.log('Event during cleanup:', {
				type: event.type,
				blockId: event.blockId,
				group: event.group,
				recordUndo: event.recordUndo,
				trace: new Error().stack
			});*/
		}

		try {
			if (
				event.type === Blockly.Events.BLOCK_MOVE ||
				event.type === Blockly.Events.BLOCK_DELETE
			) {
				// Clear any existing cleanup timeout to avoid multiple calls
				clearTimeout(cleanupTimeout);

				// Set a new timeout to call cleanUp after block movement settles
				cleanupTimeout = setTimeout(() => {
					window.cleanupInProgress = true;
					Blockly.Events.disable(); // Temporarily disable events
					workspace.cleanUp(); // Clean up the workspace
					Blockly.Events.enable(); // Re-enable events
					window.cleanupInProgress = false;
				}, 500); // Delay cleanup by 500ms to ensure block moves have settled
			}
		} catch (error) {
			console.error(
				"An error occurred during the Blockly workspace cleanup process:",
				error,
			);
		}
	});

	document.addEventListener("keydown", function (event) {
		if (event.ctrlKey && event.key === ".") {
			event.preventDefault();

			const workspace = Blockly.getMainWorkspace();

			// Create the placeholder block at the computed position
			const placeholderBlock = workspace.newBlock("keyword_block");
			placeholderBlock.initSvg();
			placeholderBlock.render();

			let workspaceCoordinates = workspace
				.getMetricsManager()
				.getViewMetrics(true);
			let posx =
				workspaceCoordinates.left + workspaceCoordinates.width / 2;
			let posy =
				workspaceCoordinates.top + workspaceCoordinates.height / 2;
			let blockCoordinates = new Blockly.utils.Coordinate(posx, posy);

			placeholderBlock.initSvg();
			placeholderBlock.render();
			placeholderBlock.moveTo(blockCoordinates);

			// Select the block for immediate editing
			placeholderBlock.select();

			// Automatically focus on the text input field
			const textInputField = placeholderBlock.getField("KEYWORD");
			if (textInputField) {
				textInputField.showEditor_();
			}
		}
	});

	// Add a click handler to track block selection
	workspace.addChangeListener(function (event) {
		if (event.type === Blockly.Events.SELECTED) {
			if (event.newElementId) {
				// A block was selected
				window.currentBlock = workspace.getBlockById(
					event.newElementId,
				);
				
			} else {
				// Selection was cleared
				window.currentBlock = null;
			}
		}
	});
	// Handle Enter key for adding new blocks
	document.addEventListener("keydown", function (event) {
		if (!event.ctrlKey && event.key === "Enter") {
			let selectedBlock = null;

			const cursor = workspace.getCursor();

			if (cursor?.getCurNode()) {
				
				const currentNode = cursor.getCurNode();
				if (currentNode) {
					const block = currentNode.getSourceBlock();
					if (block) {
						selectedBlock = block;
					}
				}
			} else {
				selectedBlock = window.currentBlock;
			}

			if (!selectedBlock) {
				return;
			}

			selectedBlock.unselect();
			
			if (!selectedBlock.nextConnection) {
				
				return;
			}

			// Create a new keyword block
			const keywordBlock = workspace.newBlock("keyword");
			window.currentBlock = keywordBlock;
			keywordBlock.initSvg();
			keywordBlock.render();

			// Connect blocks (same as before)
			const currentNextBlock = selectedBlock.getNextBlock();
			if (currentNextBlock) {
				selectedBlock.nextConnection.disconnect();
			}
			selectedBlock.nextConnection.connect(
				keywordBlock.previousConnection,
			);
			if (currentNextBlock && keywordBlock.nextConnection) {
				keywordBlock.nextConnection.connect(
					currentNextBlock.previousConnection,
				);
			}

			// Update our tracking variable to the new block
			window.currentBlock = keywordBlock;

			// Try to select it in Blockly too
			keywordBlock.select();

			// Open the editor with a delay
			setTimeout(() => {
				const textInputField = keywordBlock.getField("KEYWORD");
				if (textInputField) {
					textInputField.showEditor_();
				}
			}, 100);
		}
		// Handle Tab key for adding a block inside a block that accepts nested blocks
		else if (event.ctrlKey && event.key === "Enter") {
			// Prevent the default Tab behavior (like moving focus)
			event.preventDefault();

			let selectedBlock = null;
			const cursor = workspace.getCursor();
			if (cursor?.getCurNode()) {
				const currentNode = cursor.getCurNode();
				if (currentNode) {
					const block = currentNode.getSourceBlock();
					if (block) {
						selectedBlock = block;
					}
				}
			} else {
				selectedBlock = window.currentBlock;
			}

			if (!selectedBlock) {
				return;
			}

			let inputName = "DO";
			if (selectedBlock.type === "controls_if") {
				inputName = "DO0";
			}
			const statementInput = selectedBlock.getInput(inputName);
			if (!statementInput) {
				return;
			}

			const inputConnection = statementInput.connection;
			if (!inputConnection) {
				return;
			}

			// Create a new block to be added inside (change type if necessary)
			const insideBlock = workspace.newBlock("keyword");
			insideBlock.initSvg();
			insideBlock.render();

			// If the input already has a block connected, append to the end of the chain.
			if (inputConnection.targetBlock()) {
				let lastBlock = inputConnection.targetBlock();
				while (lastBlock.getNextBlock()) {
					lastBlock = lastBlock.getNextBlock();
				}
				lastBlock.nextConnection.connect(
					insideBlock.previousConnection,
				);
			} else {
				// Connect directly if there is no block inside yet.
				inputConnection.connect(insideBlock.previousConnection);
			}

			window.currentBlock = insideBlock;
			insideBlock.select();

			// Open the editor after a short delay if the new block has a text field
			setTimeout(() => {
				const textInputField = insideBlock.getField("KEYWORD");
				if (textInputField) {
					textInputField.showEditor_();
				}
			}, 100);
		}
	});

	initializeApp();
};

/*
let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
	e.preventDefault(); // Prevent the mini-infobar from appearing
	if (!deferredPrompt) {
		deferredPrompt = e; // Save the event for later use

		// Prompt the user after interaction (scroll, click, etc.)
		window.addEventListener(
			"click",
			() => {
				if (deferredPrompt) {
					deferredPrompt.prompt();
					deferredPrompt.userChoice.then((choiceResult) => {
						if (choiceResult.outcome === "accepted") {
							console.log("User accepted the install prompt");
						} else {
							console.log("User dismissed the install prompt");
						}
						deferredPrompt = null; // Clear the event
					});
				}
			},
			{ once: true } // Ensure the listener is only triggered once
		);
	}
});
*/

const adjustViewport = () => {
	const vh = window.innerHeight * 0.01;
	document.documentElement.style.setProperty("--vh", `${vh}px`);
};

// Adjust viewport on page load and resize
window.addEventListener("load", adjustViewport);
window.addEventListener("resize", adjustViewport);

function setupAutoValueBehavior(workspace) {
	workspace.addChangeListener(function (event) {
		// Only handle events that change block structure (like adding a new input)
		if (
			event.type === Blockly.Events.BLOCK_CHANGE ||
			event.type === Blockly.Events.BLOCK_CREATE
		) {
			// Get the block that was changed
			var block = workspace.getBlockById(event.blockId);

			// Check if it's a lists_create_with block
			if (block && block.type === "lists_create_with") {
				// Count the number of inputs
				var inputCount = 0;
				while (block.getInput("ADD" + inputCount)) {
					inputCount++;
				}

				// Only proceed if there are at least 2 inputs (to have a previous item)
				if (inputCount >= 2) {
					// Get the second-to-last input
					var previousInput = block.getInput(
						"ADD" + (inputCount - 2),
					);
					// Get the last input
					var lastInput = block.getInput("ADD" + (inputCount - 1));

					// If the previous input has a connection and the last one doesn't
					if (
						previousInput &&
						previousInput.connection.targetConnection &&
						lastInput &&
						!lastInput.connection.targetConnection
					) {
						// Get the block connected to the previous input
						var sourceBlock =
							previousInput.connection.targetConnection
								.sourceBlock_;
						var isShadow = sourceBlock.isShadow();

						// Create a new block (shadow or regular based on the source)
						newBlock = workspace.newBlock(sourceBlock.type);
						var newBlock;
						if (isShadow) {
							newBlock.setShadow(true);
						}
						newBlock.initSvg();
						newBlock.render();

						// Copy field values based on block type
						if (sourceBlock.type === "math_number") {
							newBlock.setFieldValue(
								sourceBlock.getFieldValue("NUM"),
								"NUM",
							);
						} else if (sourceBlock.type === "text") {
							newBlock.setFieldValue(
								sourceBlock.getFieldValue("TEXT"),
								"TEXT",
							);
						} else if (sourceBlock.type === "logic_boolean") {
							newBlock.setFieldValue(
								sourceBlock.getFieldValue("BOOL"),
								"BOOL",
							);
						} else if (sourceBlock.type === "variables_get") {
							newBlock.setFieldValue(
								sourceBlock.getFieldValue("VAR"),
								"VAR",
							);
						}

						// Connect the new block to the last input
						lastInput.connection.connect(newBlock.outputConnection);
					}
				}
			}
		}
	});
}
