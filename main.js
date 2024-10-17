// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limited - flipcomputing.com

import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";
import { registerFieldColour } from "@blockly/field-colour";
import { FieldGridDropdown } from "@blockly/field-grid-dropdown";
import { WorkspaceSearch } from "@blockly/plugin-workspace-search";
import { NavigationController } from "@blockly/keyboard-navigation";
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import { flock, initializeFlock } from "./flock.js";
import { initialBlocksJson } from "./toolbox.js";
import {
	options,
	defineBlocks,
	initializeVariableIndexes,
	handleBlockSelect,
	handleBlockDelete,
} from "./blocks";
import { defineShapeBlocks } from "./blocks/shapes";
import { defineGenerators } from "./generators";
import { enableGizmos, setGizmoManager, disposeGizmoManager} from "./ui/designview";

if (navigator.serviceWorker) {
	navigator.serviceWorker.addEventListener("controllerchange", () => {
		window.location.reload();
	});
}

let workspace = null;

//Blockly.utils.colour.setHsvSaturation(0.2) // 0 (inclusive) to 1 (exclusive), defaulting to 0.45
//Blockly.utils.colour.setHsvValue(0.95) // 0 (inclusive) to 1 (exclusive), defaulting to 0.65

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
	var state = Blockly.serialization.workspaces.save(workspace);

	const key = "flock_autosave.json";

	// Save today's workspace state
	localStorage.setItem(key, JSON.stringify(state));
}

// Function to load today's workspace state
function loadWorkspace() {
	const savedState = localStorage.getItem("flock_autosave.json");

	if (savedState) {
		Blockly.serialization.workspaces.load(
			JSON.parse(savedState),
			workspace,
		);
	} else {
		// Load the JSON into the workspace
		Blockly.serialization.workspaces.load(initialBlocksJson, workspace);
	}

	executeCode();
}

function stripFilename(inputString) {
	const removeEnd = inputString.replace(/\(\d+\)/g, "");
	// Find the last occurrence of '/' or '\'
	let lastIndex = Math.max(
		removeEnd.lastIndexOf("/"),
		removeEnd.lastIndexOf("\\"),
	);

	if ((lastIndex = fi == -1)) {
		return removeEnd.trim();
	}

	return removeEnd.substring(lastIndex + 1).trim();
}

function exportCode() {
	const projectName =
		document.getElementById("projectName").value || "default_project";

	const json = Blockly.serialization.workspaces.save(workspace);
	const jsonString = JSON.stringify(json, null, 2); // Pretty-print the JSON

	const element = document.createElement("a");
	element.setAttribute(
		"href",
		"data:text/json;charset=utf-8," + encodeURIComponent(jsonString),
	);
	element.setAttribute("download", projectName + ".json");

	document.body.appendChild(element); // Required for Firefox
	element.click();
	document.body.removeChild(element);
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
		return; // Exit if there's an error in running the code
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
	flock.audioContext.close();
	flock.scene.dispose();
	flock.removeEventListeners();
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

// Function to handle file upload and import JSON snippet into workspace
function handleSnippetUpload(event) {
	window.loadingCode = true;
	const file = event.target.files[0];
	const reader = new FileReader();
	reader.onload = function (event) {
		const jsonText = event.target.result;

		try {
			const json = JSON.parse(jsonText);
			Blockly.serialization.blocks.append(json, workspace);
		} catch (e) {
			console.error("Error importing JSON:", e);
		}
	};
	reader.readAsText(file);
}

// Function to trigger file input for importing snippet
function importSnippet() {
	document.getElementById("importFile").click();
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

function openAboutPage() {
	window.open("https://github.com/flipcomputing/flock/", "_blank");
}

window.openAboutPage = openAboutPage;

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
				Blockly.serialization.workspaces.load(json, workspace);
				executeCode();
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
	const gizmoButtons = document.getElementById("gizmoButtons");

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
		examples.style.width = "55px";
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

// Function to add the button event listener
function addButtonListener() {
	switchViewsBtn.addEventListener("click", togglePanels);
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
	toggleDesignButton.addEventListener("click", toggleDesign);
	togglePlayButton.addEventListener("click", togglePlay);
	exportCodeButton.addEventListener("click", exportCode);

	// Enable the file input after initialization
	fileInput.removeAttribute("disabled");

	// Add event listener to file input
	document
		.getElementById("importFile")
		.addEventListener("change", handleSnippetUpload);

	toggleDesignButton.addEventListener("click", function () {
		if (!flock.scene) return;

		const blocklyArea = document.getElementById("codePanel");
		const canvasArea = document.getElementById("rightArea");
		const gizmoButtons = document.getElementById("gizmoButtons");

		if (flock.scene.debugLayer.isVisible()) {
			switchView("both");
			flock.scene.debugLayer.hide();
			onResize();
		} else {
			blocklyArea.style.display = "none";
			codeMode = "none";
			canvasArea.style.display = "block";
			canvasArea.style.width = "0";
			gizmoButtons.style.display = "block";
			// https://doc.babylonjs.com/typedoc/interfaces/BABYLON.IInspectorOptions
			flock.scene.debugLayer.show({
				embedMode: true,
				enableClose: false,
				enablePopup: false,
			});
			canvasArea.style.flex = "1 1 0";
			onResize();
		}
	});

	let savedView = "canvas";

	togglePlayButton.addEventListener("click", function () {
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
			document.documentElement.style.setProperty(
				"--dynamic-offset",
				"40px",
			);
			onResize();
		} else {
			flock.scene.debugLayer.hide();
			blocklyArea.style.display = "block";
			canvasArea.style.display = "block";
			gizmoButtons.style.display = "block";
			bottomBar.style.display = "block";
			switchView("both");
			document.documentElement.style.setProperty(
				"--dynamic-offset",
				"65px",
			);
			if (savedView === "code") showCodeView();
			else showCanvasView();
			onResize();
		}
	});

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

	workspace = Blockly.inject("blocklyDiv", options);
	registerFieldColour();

	workspace.addChangeListener(handleBlockSelect);
	workspace.addChangeListener(handleBlockDelete);

	// Resize Blockly workspace and Babylon.js canvas when the window is resized
	window.addEventListener("resize", onResize);

	Blockly.ContextMenuItems.registerCommentOptions();
	const navigationController = new NavigationController();
	navigationController.init();
	navigationController.addWorkspace(workspace);
	// Turns on keyboard navigation.
	//navigationController.enable(workspace);

	const workspaceSearch = new WorkspaceSearch(workspace);
	workspaceSearch.init();

	console.log("Welcome to Flock 🐑🐑🐑");

	defineBlocks();
	defineShapeBlocks();
	defineGenerators();
	// Initialize Blockly and add custom context menu options
	addExportContextMenuOption();
	addImportContextMenuOption();
	//observeFlyoutVisibility(workspace);
	window.toolboxVisible = toolboxVisible;

	// Call this function to autosave periodically
	setInterval(saveWorkspace, 30000); // Autosave every 30 seconds

	(async () => {
		await flock.initialize();

		window.addEventListener("keydown", (event) => {
			// Check if the dot key (.) is pressed (key code 190)
			if (event.code === "Period") {
				focusCameraOnMesh();
			}
		});
		window.initialBlocksJson = initialBlocksJson;
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

				Blockly.serialization.workspaces.load(json, workspace);

				executeCode();
			};
			reader.readAsText(event.target.files[0]);
		});

	const blockTypesToCleanUp = [
		"start",
		"forever",
		"when_clicked",
		"when_touches",
		"when_key_pressed",
		"when_key_released",
		"on_event",
		"procedures_defnoreturn",
		"procedures_defreturn",
	];

	workspace.cleanUp = function () {
		const topBlocks = workspace.getTopBlocks(false); // Get all top-level blocks without sorting
		const spacing = 40; // Define spacing between blocks
		let cursorY = 10; // Starting y position
		let cursorX = 10; // Starting x position

		// Sort the blocks by their current y position (top to bottom)
		topBlocks.sort(
			(a, b) =>
				a.getRelativeToSurfaceXY().y - b.getRelativeToSurfaceXY().y,
		);

		topBlocks.forEach((block) => {
			// Check if the block is one of the specified types
			if (blockTypesToCleanUp.includes(block.type)) {
				const blockXY = block.getRelativeToSurfaceXY();
				block.moveBy(cursorX - blockXY.x, cursorY - blockXY.y);
				cursorY += block.getHeightWidth().height + spacing;
			}
		});
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
		try {
			if (event.type === Blockly.Events.BLOCK_MOVE) {
				const block = workspace.getBlockById(event.blockId);
				if (!block) return;

				// Clear any existing cleanup timeout to avoid multiple calls
				clearTimeout(cleanupTimeout);

				// Set a new timeout to call cleanUp after block movement settles
				cleanupTimeout = setTimeout(() => {
					Blockly.Events.disable(); // Temporarily disable events
					workspace.cleanUp(); // Clean up the workspace
					Blockly.Events.enable(); // Re-enable events
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

	initializeApp();
};

let deferredPrompt;

window.addEventListener("beforeinstallprompt", (e) => {
	e.preventDefault(); // Prevent the mini-infobar from appearing
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
		{ once: true },
	);
});

const adjustViewport = () => {
	const vh = window.innerHeight * 0.01;
	document.documentElement.style.setProperty("--vh", `${vh}px`);
};

// Adjust viewport on page load and resize
window.addEventListener("load", adjustViewport);
window.addEventListener("resize", adjustViewport);
