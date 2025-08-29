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

export function onResize(mode) {
        // First handle canvas and engine
        resizeCanvas();
        if (flock.engine) flock.engine.resize();

        requestAnimationFrame(() => {
                let scrollX = workspace?.scrollX || 0;
                let scrollY = workspace?.scrollY || 0;
                
                if (scrollX === -7) {
                        scrollX = 0;
                }
                if (scrollY === -7) {
                        scrollY = 0;
                }
                
                if (workspace) {
                        Blockly.svgResize(workspace);
                        if(mode === "reset")
                                workspace.scroll(scrollX, scrollY);
                }
        });
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
        const resizer = document.getElementById("resizer");

        if (view === "both") {
                viewMode = "both";
                codeMode = "both";
                blocklyArea.style.display = "block";
                canvasArea.style.display = "block";
                flockLink.style.display = "block";
                if (resizer) resizer.style.display = "block";
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
                onResize(); 
        } else if (view === "canvas") {
                viewMode = "canvas";
                blocklyArea.style.display = "none";
                canvasArea.style.display = "block";
                flockLink.style.display = "block";
                if (resizer) resizer.style.display = "none";
                onResize("reset"); 
        } else {
                flockLink.style.display = "none";
                if (resizer) resizer.style.display = "none";
                onResize("reset"); 
        }

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

let savedView = "canvas";
let savedViewMode = "both"; // Track the actual view mode for wide screens

// Function to add the button event listener (narrow screens only)
function addButtonListener() {
        // Only add button listener on narrow screens
        if (!isNarrowScreen()) {
                return;
        }

        switchViewsBtn.addEventListener("click", togglePanels);
}

// Alternative approach: Instead of CSS transforms, actually reposition elements in DOM
// This ensures Blockly's coordinate system stays aligned

function showCodeView() {
        const blocklyArea = document.getElementById("codePanel");
        blocklyArea.style.display = "block";

        currentView = "code";

        if (isNarrowScreen()) {
                // Instead of CSS transform, change the layout directly
                const canvasArea = document.getElementById("canvasArea");

                // Hide canvas, show code full width
                canvasArea.style.display = "none";
                blocklyArea.style.width = "100%";
                blocklyArea.style.flex = "1 1 100%";

                switchViewsBtn.textContent = "<< Canvas";

                // Blockly resize after DOM changes
                requestAnimationFrame(() => {
                        if (workspace) {
                                Blockly.svgResize(workspace);
                        }
                });
        }

        onResize("reset");

        console.log("Scrolling to top");        
}

export function showCanvasView() {
        const gizmoButtons = document.getElementById("gizmoButtons");
        const flockLink = document.getElementById("flocklink");

        gizmoButtons.style.display = "block";
        flockLink.style.display = "block";

        currentView = "canvas";

        if (isNarrowScreen()) {
                // Instead of CSS transform, change the layout directly
                const blocklyArea = document.getElementById("codePanel");
                const canvasArea = document.getElementById("canvasArea");

                // Hide code, show canvas full width
                blocklyArea.style.display = "none";
                canvasArea.style.display = "block";
                canvasArea.style.width = "100%";
                canvasArea.style.flex = "1 1 100%";

                switchViewsBtn.textContent = "Code >>";
        }

        onResize();
}

// Updated swipe handling to work with DOM-based switching
function addSwipeListeners() {
        if (!isNarrowScreen()) {
                return;
        }

        let startX = 0;
        let startTime = 0;
        const swipeThreshold = 50;
        const maxSwipeTime = 300; // Max time for a valid swipe (ms)

        bottomBar.addEventListener("touchstart", (e) => {
                startX = e.touches[0].clientX;
                startTime = Date.now();
        });

        bottomBar.addEventListener("touchend", (e) => {
                const endX = e.changedTouches[0].clientX;
                const endTime = Date.now();

                const deltaX = endX - startX;
                const deltaTime = endTime - startTime;

                // Only process quick swipes
                if (deltaTime > maxSwipeTime) return;

                // Determine swipe direction
                if (Math.abs(deltaX) > swipeThreshold) {
                        if (deltaX > 0 && currentView === "canvas") {
                                // Swipe right from canvas to code
                                showCodeView();
                        } else if (deltaX < 0 && currentView === "code") {
                                // Swipe left from code to canvas
                                showCanvasView();
                        }
                }
        });
}

// Alternative approach using intersection observer to detect view changes
// This ensures Blockly always knows when it becomes visible
function setupViewObserver() {
        if (!window.IntersectionObserver || !isNarrowScreen()) return;

        const blocklyArea = document.getElementById("codePanel");

        const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                                // Blockly area is significantly visible, ensure it's properly sized
                                requestAnimationFrame(() => {
                                        if (workspace) {
                                                Blockly.svgResize(workspace);
                                        }
                                });
                        }
                });
        }, {
                threshold: [0.5] // Trigger when 50% visible
        });

        observer.observe(blocklyArea);
}

// Initialize the observer when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
        setupViewObserver();
});

// Initialize currentView properly on narrow screens
export function initializeUI() {
        addSwipeListeners(); // Add swipe event listeners (narrow screens only)
        addButtonListener(); // Add button click listener (narrow screens only)

        // Initialize currentView based on actual DOM state on narrow screens
        if (isNarrowScreen()) {
                const blocklyArea = document.getElementById("codePanel");
                const canvasArea = document.getElementById("canvasArea");

                // Determine initial view based on which panel is visible
                if (getComputedStyle(blocklyArea).display !== "none" && 
                        getComputedStyle(canvasArea).display === "none") {
                        currentView = "code";
                } else {
                        currentView = "canvas";
                        // Ensure canvas view is properly set up
                        showCanvasView();
                }
        }
}

// Modified toggle function to work with new approach
function togglePanels() {
        if (!isNarrowScreen()) {
                return;
        }

        // Check button text instead of currentView to avoid state mismatch
        if (switchViewsBtn.textContent === "Code >>") {
                showCodeView();
        } else {
                showCanvasView();
        }
}

// Updated play mode to work with new approach
export function togglePlayMode() {
        if (!flock.scene) return;

        const blocklyArea = document.getElementById("codePanel");
        const canvasArea = document.getElementById("canvasArea");
        const gizmoButtons = document.getElementById("gizmoButtons");
        const bottomBar = document.getElementById("bottomBar");
        const flockLink = document.getElementById("flocklink");
        const resizer = document.getElementById("resizer");

        const gizmosVisible =
                gizmoButtons &&
                getComputedStyle(gizmoButtons).display !== "none" &&
                getComputedStyle(gizmoButtons).visibility !== "hidden";

        if (gizmosVisible) {
                savedView = currentView;

                // Clear any transforms that might be applied
                if (isNarrowScreen()) {
                        container.style.transform = "translateX(0px)";
                }

                showCanvasView();
                flock.scene.debugLayer.hide();
                blocklyArea.style.display = "none";
                gizmoButtons.style.display = "none";
                bottomBar.style.display = "none";
                flockLink.style.display = "none";
                if (resizer) resizer.style.display = "none";
                document.documentElement.style.setProperty("--dynamic-offset", "40px");
        } else {
                flock.scene.debugLayer.hide();
                blocklyArea.style.display = "block";
                canvasArea.style.display = "block";
                gizmoButtons.style.display = "block";
                bottomBar.style.display = "block";
                flockLink.style.display = "block";
                if (resizer) resizer.style.display = "block";
                document.documentElement.style.setProperty("--dynamic-offset", "65px");

                // On narrow screens, restore the saved view
                if (isNarrowScreen()) {
                        if (savedView === "code") {
                                showCodeView();
                        } else {
                                showCanvasView();
                        }
                } else {
                        // On wide screens, restore the flex layout
                        switchView("both");
                }
        }

        onResize("reset");
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
        const resizer = document.getElementById("resizer");

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
                if (resizer) resizer.style.display = "none";

                flock.scene.debugLayer.show({
                        embedMode: true,
                        enableClose: false,
                        enablePopup: false,
                });

                canvasArea.style.flex = "1 1 0";

                // Prepare canvas for potential recording
                setTimeout(prepareCanvasForRecording, 100);
        }

        onResize("reset");
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
                onResize()
        }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
        new PanelResizer();
});