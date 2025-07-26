import * as Blockly from "blockly";
import { workspace } from "./blocklyinit.js";
import { flock } from "../flock.js";

// Add this helper function at the top
export const isNarrowScreen = () => {
	return window.innerWidth <= 768;
};

const isMobile = () => {
	return /Mobi|Android/i.test(navigator.userAgent);
};

export function onResize() {
	workspace.resize();
	Blockly.svgResize(workspace);	
	//document.body.style.zoom = "reset";
	resizeCanvas();
	if (flock.engine) flock.engine.resize();
}

window.onresize = onResize;

// Function to maintain a 16:9 aspect ratio for the canvas
function resizeCanvas() {
	const canvasArea = document.getElementById("canvasArea");
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
	const canvasArea = document.getElementById("canvasArea");
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
		canvasArea.style.flex = "1 1 0"; // 1/3 of the space

		// Reset any transforms on desktop
		if (!isNarrowScreen()) {
			const container = document.getElementById("maincontent");
			if (container) {
				container.style.transform = "translateX(0px)";
			}
		}
	} else if (view === "canvas") {
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

export function showCanvasView() {
	const gizmoButtons = document.getElementById("gizmoButtons");
	const flockLink = document.getElementById("flocklink");

	gizmoButtons.style.display = "block";
	flockLink.style.display = "block";

	currentView = "canvas";

	// Only apply transforms on narrow screens
	if (isNarrowScreen()) {
		container.style.transform = `translateX(0px)`; // Move to Canvas view
		switchViewsBtn.textContent = "Code >>"; // Update button text
	}

	onResize();
}

function showCodeView() {
	const blocklyArea = document.getElementById("codePanel");
	blocklyArea.style.display = "block";

	currentView = "code";

	// Only apply transforms on narrow screens
	if (isNarrowScreen()) {
		const panelWidth = window.innerWidth;
		container.style.transform = `translateX(-${panelWidth}px)`; // Move to Code view
		switchViewsBtn.textContent = "<< Canvas"; // Update button text
	}

	onResize();
}

function togglePanels() {
	// Only allow panel toggling on narrow screens
	if (!isNarrowScreen()) {
		return;
	}

	if (switchViewsBtn.textContent === "Code >>") {
		showCodeView();
	} else {
		showCanvasView();
	}
}

function setTranslateX(value) {
	// Only apply transforms on narrow screens
	if (isNarrowScreen()) {
		container.style.transform = `translateX(${value}px)`;
	}
}

// Function to add the swipe event listeners (narrow screens only)
function addSwipeListeners() {
	// Only add swipe listeners on narrow screens
	if (!isNarrowScreen()) {
		return;
	}

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
			showCanvasView(); // Swipe left to go back to canvas view
		} else if (deltaX > swipeThreshold) {
			showCodeView(); // Swipe right to go to code view
		}

		previousTranslate = currentTranslate; // Update the last translate value
	});
}

let savedView = "canvas";
let savedViewMode = "both"; // Track the actual view mode for wide screens

export function togglePlayMode() {
	if (!flock.scene) return;

	const blocklyArea = document.getElementById("codePanel");
	const canvasArea = document.getElementById("canvasArea");
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
		document.documentElement.style.setProperty("--dynamic-offset", "65px");

		// On narrow screens, use the mobile view switching logic
		if (isNarrowScreen()) {
			switchView("both");
			if (savedView === "code") showCodeView();
			else showCanvasView();
		} else {
			// On wide screens, restore the appropriate view
			switchView("both"); // This sets up the flex layout properly
		}
	}

	onResize();
}

// Function to add the button event listener (narrow screens only)
function addButtonListener() {
	// Only add button listener on narrow screens
	if (!isNarrowScreen()) {
		return;
	}

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
	const canvasArea = document.getElementById("canvasArea");
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
	addSwipeListeners(); // Add swipe event listeners (narrow screens only)
	addButtonListener(); // Add button click listener (narrow screens only)
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

class PanelResizer {
	constructor() {
		this.resizer = document.getElementById('resizer');
		this.canvasArea = document.getElementById('canvasArea');
		this.codePanel = document.getElementById('codePanel');
		this.mainContent = document.getElementById('maincontent');

		this.isResizing = false;
		this.startX = 0;
		this.startCanvasWidth = 0;
		this.startCodeWidth = 0;

		this.init();
	}

	init() {
		// Mouse events
		this.resizer.addEventListener('mousedown', this.startResize.bind(this));
		document.addEventListener('mousemove', this.handleResize.bind(this));
		document.addEventListener('mouseup', this.stopResize.bind(this));

		// Touch events for mobile
		this.resizer.addEventListener('touchstart', this.startResize.bind(this));
		document.addEventListener('touchmove', this.handleResize.bind(this));
		document.addEventListener('touchend', this.stopResize.bind(this));

		// Keyboard accessibility
		this.resizer.addEventListener('keydown', this.handleKeyboard.bind(this));

		// Prevent text selection during resize
		this.resizer.addEventListener('selectstart', (e) => e.preventDefault());

	}

	startResize(e) {
		this.isResizing = true;

		// Add resizing class to prevent hover effects
		this.resizer.classList.add('resizing');

		// Handle both mouse and touch events
		const clientX = e.touches ? e.touches[0].clientX : e.clientX;
		this.startX = clientX;

		const canvasRect = this.canvasArea.getBoundingClientRect();
		const codeRect = this.codePanel.getBoundingClientRect();

		this.startCanvasWidth = canvasRect.width;
		this.startCodeWidth = codeRect.width;

		// Add visual feedback
		document.body.style.cursor = 'col-resize';

		// Prevent default to avoid text selection
		e.preventDefault();
	}

	handleResize(e) {
		if (!this.isResizing) return;

		const clientX = e.touches ? e.touches[0].clientX : e.clientX;
		const deltaX = clientX - this.startX;

		const mainRect = this.mainContent.getBoundingClientRect();
		
		const minPanelWidth = 300;

		const newCanvasWidth = this.startCanvasWidth + deltaX;
		const newCodeWidth = this.startCodeWidth - deltaX;

		// Ensure minimum widths
		if (newCanvasWidth >= minPanelWidth && newCodeWidth >= minPanelWidth) {
			const totalWidth = mainRect.width;
			const canvasFlexBasis = (newCanvasWidth / totalWidth) * 100;
			const codeFlexBasis = (newCodeWidth / totalWidth) * 100;

			this.canvasArea.style.flex = `0 0 ${canvasFlexBasis}%`;
			this.codePanel.style.flex = `0 0 ${codeFlexBasis}%`;

			// Trigger resize for canvas and Blockly
			this.triggerContentResize();
		}

		e.preventDefault();
	}

	stopResize() {
		if (!this.isResizing) return;

		this.isResizing = false;

		// Remove resizing class to restore hover effects
		this.resizer.classList.remove('resizing');

		document.body.style.cursor = '';

		// Final resize trigger after dragging stops
		this.triggerContentResize();
	}

	handleKeyboard(e) {
		
		const step = 20; // pixels
		let deltaX = 0;

		switch(e.key) {
			case 'ArrowLeft':
				deltaX = -step;
				break;
			case 'ArrowRight':
				deltaX = step;
				break;
			case 'Home':
				this.resetPanels();
				return;
			default:
				return;
		}

		// Get current widths
		const currentCanvasWidth = this.canvasArea.offsetWidth;
		const currentCodeWidth = this.codePanel.offsetWidth;
		const mainRect = this.mainContent.getBoundingClientRect();
		const resizerWidth = 0;
		const minPanelWidth = 300;
		const totalAvailableWidth = mainRect.width - resizerWidth;

		// Calculate new widths
		const newCanvasWidth = currentCanvasWidth + deltaX;
		const newCodeWidth = currentCodeWidth - deltaX;

		// Check minimum width constraint
		if (newCanvasWidth < minPanelWidth || newCodeWidth < minPanelWidth) {
			e.preventDefault();
			return; // Just return without changing anything
		}

		// Use fixed pixel widths instead of percentages to be more explicit
		this.canvasArea.style.flex = `0 0 ${newCanvasWidth}px`;
		this.codePanel.style.flex = `0 0 ${newCodeWidth}px`;

		// Trigger content resize
		this.triggerContentResize();

		e.preventDefault();
	}

	triggerContentResize() {
		onResize();
	}
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
	new PanelResizer();
});

