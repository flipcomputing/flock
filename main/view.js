import * as Blockly from "blockly";
import { workspace } from "./blocklyinit.js";
import { flock } from "../flock.js";

export function onResize() {
	Blockly.svgResize(workspace);
	//document.body.style.zoom = "reset";
	resizeCanvas();
	if (flock.engine) flock.engine.resize();
}

window.onresize = onResize;


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

	canvas.style.width = `${Math.round(newWidth)}px`;
	canvas.style.height = `${Math.round(newHeight)}px`;

	const width = canvas.clientWidth;
	const height = canvas.clientHeight;
	if (canvas.width !== width || canvas.height !== height) {
		canvas.width = width;
		canvas.height = height;
	}
}

let viewMode = "both";
let codeMode = "both";
window.viewMode = viewMode;
window.codeMode = codeMode;

function switchView(view) {
	if (flock.scene) flock.scene.debugLayer.hide();
	const blocklyArea = document.getElementById("codePanel");
	const canvasArea = document.getElementById("rightArea");
	const flockLink = document.getElementById("flocklink");

	if (view === "both") {
		viewMode = "both";
		codeMode = "both";
		blocklyArea.style.display = "block";
		canvasArea.style.display = "block";
		flockLink.style.display = "block";
		blocklyArea.style.width = "0";
		canvasArea.style.width = "0";
		blocklyArea.style.flex = "2 1 0"; // 2/3 of the space
		canvasArea.style.flex = "1 1 0"; // 1/3 of the space		gizmoButtons.style.display = "flex";
	} else if (view === "canvas") {
		console.log("canvas");
		viewMode = "canvas";
		blocklyArea.style.display = "none";
		canvasArea.style.display = "block";
		flockLink.style.display = "block";
	} else {
		flockLink.style.display = "none";
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
export {currentView,switchView, codeMode, showCodeView};

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
	const flockLink = document.getElementById("flocklink");

	gizmoButtons.style.display = "block";
	flockLink.style.display = "block";

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
	onResize();
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

export function togglePlayMode() {
	if (!flock.scene) return;

	const blocklyArea = document.getElementById("codePanel");
	const canvasArea = document.getElementById("rightArea");
	const gizmoButtons = document.getElementById("gizmoButtons");
	const bottomBar = document.getElementById("bottomBar");
	const flockLink = document.getElementById("flocklink");

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
		flockLink.style.display = "none";
		document.documentElement.style.setProperty("--dynamic-offset", "40px");
	} else {
		flock.scene.debugLayer.hide();
		blocklyArea.style.display = "block";
		canvasArea.style.display = "block";
		gizmoButtons.style.display = "block";
		bottomBar.style.display = "block";
		flockLink.style.display = "block";
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

function prepareCanvasForRecording() {
	// Force a render and resize to ensure canvas is ready for capture
	if (flock.engine && flock.scene) {
		flock.engine.resize();
		flock.scene.render();
	}
}

export function toggleDesignMode(){
	if (!flock.scene) return;

	const blocklyArea = document.getElementById("codePanel");
	const canvasArea = document.getElementById("rightArea");
	const gizmoButtons = document.getElementById("gizmoButtons");
	const flockLink = document.getElementById("flocklink");
	const infoPanel = document.getElementById("info-panel");

	if (flock.scene.debugLayer.isVisible()) {
		switchView("both");
		flock.scene.debugLayer.hide();
		flockLink.style.display = "block";
		infoPanel.style.display = "block";
	} else {
		blocklyArea.style.display = "none";
		codeMode = "none";
		canvasArea.style.display = "block";
		canvasArea.style.width = "0";
		gizmoButtons.style.display = "block";
		flockLink.style.display = "none";
		infoPanel.style.display = "none";

		flock.scene.debugLayer.show({
			embedMode: true,
			enableClose: false,
			enablePopup: false,
		});

		canvasArea.style.flex = "1 1 0";

		// Prepare canvas for potential recording
		setTimeout(prepareCanvasForRecording, 100);
	}

	onResize();
}

// Initialization function to set up everything
export function initializeUI() {
	addSwipeListeners(); // Add swipe event listeners
	addButtonListener(); // Add button click listener
}

const adjustViewport = () => {
	const vh = window.innerHeight * 0.01;
	document.documentElement.style.setProperty("--vh", `${vh}px`);
};

// Adjust viewport on page load and resize
window.addEventListener("load", adjustViewport);
window.addEventListener("resize", adjustViewport);

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