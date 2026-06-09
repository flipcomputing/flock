import * as Blockly from 'blockly';
import { workspace } from './blocklyinit.js';
import { flock } from '../flock.js';

export const isNarrowScreen = () => {
  return window.innerWidth <= 1024;
};

const isMobile = () => {
  return /Mobi|Android|iPad/i.test(navigator.userAgent);
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
      if (mode === 'reset') workspace.scroll(scrollX, scrollY);
    }
  });
}

let resizeTimer;
const handleWindowResize = () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(onResize, 100);
};
window.addEventListener('resize', handleWindowResize);

// Function to maintain a 16:9 aspect ratio for the canvas
function resizeCanvas() {
  const canvasArea = document.getElementById('canvasArea');
  const canvas = document.getElementById('renderCanvas');
  if (!canvasArea || !canvas) return;

  const areaRect = canvasArea.getBoundingClientRect();
  const areaWidth = Math.max(1, Math.round(areaRect.width));
  let areaHeight = Math.max(1, Math.round(areaRect.height));

  if (flock.embedMode) {
    const aspectRatio = 16 / 9;

    const availableHeight = Math.max(1, areaHeight - 4);

    let fittedHeight = Math.max(1, Math.round(availableHeight));
    let fittedWidth = Math.max(1, Math.round(fittedHeight * aspectRatio));

    if (fittedWidth > areaWidth) {
      fittedWidth = Math.max(1, Math.round(areaWidth));
      fittedHeight = Math.max(1, Math.round(fittedWidth / aspectRatio));
    }

    canvas.style.width = `${fittedWidth}px`;
    canvas.style.height = `${fittedHeight}px`;
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '100%';

    if (canvas.width !== fittedWidth || canvas.height !== fittedHeight) {
      canvas.width = fittedWidth;
      canvas.height = fittedHeight;
    }

    const syncEmbedFrame = () => {
      const measuredCanvasWidth = Math.max(1, Math.round(canvas.getBoundingClientRect().width));
      const playerWidth = Math.max(1, measuredCanvasWidth);

      const embedShell = document.getElementById('embedShell');
      if (embedShell) {
        embedShell.style.width = '100%';
        embedShell.style.maxWidth = '100%';
        embedShell.style.marginLeft = '0';
        embedShell.style.marginRight = '0';
        embedShell.style.boxSizing = 'border-box';
      }

      const mainContent = document.getElementById('maincontent');
      if (mainContent) {
        mainContent.style.width = '100%';
        mainContent.style.maxWidth = '100%';
        mainContent.style.marginLeft = '0';
        mainContent.style.marginRight = '0';
        mainContent.style.boxSizing = 'border-box';
      }

      const embedTopBar = document.getElementById('embedTopBar');
      if (embedTopBar) {
        embedTopBar.style.width = '100%';
        embedTopBar.style.left = '0';
        embedTopBar.style.right = '0';
        embedTopBar.style.transform = 'none';
        embedTopBar.style.boxSizing = 'border-box';
      }

      const embedBottomBar = document.getElementById('embedBottomBar');
      if (embedBottomBar) {
        embedBottomBar.style.width = '100%';
        embedBottomBar.style.left = '0';
        embedBottomBar.style.right = '0';
        embedBottomBar.style.transform = 'none';
        embedBottomBar.style.boxSizing = 'border-box';
      }
    };

    syncEmbedFrame();
    requestAnimationFrame(syncEmbedFrame);
    return;
  }

  const gizmoButtons = document.getElementById('gizmoButtons');
  if (gizmoButtons && gizmoButtons.style.display != 'none') {
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

let viewMode = 'both';
let codeMode = 'both';
window.viewMode = viewMode;
window.codeMode = codeMode;

function switchView(view) {
  if (flock.scene) flock.scene.debugLayer.hide();
  const blocklyArea = document.getElementById('codePanel');
  const canvasArea = document.getElementById('canvasArea');
  const flockLink = document.getElementById('flocklink');
  const resizer = document.getElementById('resizer');
  if (!blocklyArea || !canvasArea || !flockLink) return;

  if (view === 'both') {
    viewMode = 'both';
    codeMode = 'both';
    blocklyArea.style.display = 'block';
    canvasArea.style.display = '';
    flockLink.style.display = 'block';
    if (resizer) resizer.style.display = 'block';
    blocklyArea.style.width = '0';
    canvasArea.style.width = '0';
    blocklyArea.style.flex = '2 1 0'; // 2/3 of the space
    canvasArea.style.flex = '1 1 0'; // 1/3 of the space

    // Reset any transforms on desktop
    if (!isNarrowScreen()) {
      const container = document.getElementById('maincontent');
      if (container) {
        container.style.transform = 'translateX(0px)';
      }
    }
    onResize();
  } else if (view === 'canvas') {
    viewMode = 'canvas';
    blocklyArea.style.display = 'none';
    canvasArea.style.display = '';
    flockLink.style.display = 'block';
    if (resizer) resizer.style.display = 'none';
    onResize('reset');
  } else {
    flockLink.style.display = 'none';
    if (resizer) resizer.style.display = 'none';
    onResize('reset');
  }
}

window.switchView = switchView;

function toggleMenu() {
  const menu = document.getElementById('menu');
  if (!menu) return;
  const currentDisplay = window.getComputedStyle(menu).display;

  if (currentDisplay != 'none') {
    menu.style.display = 'none';
    document.removeEventListener('click', handleClickOutside);
  } else {
    menu.style.display = 'flex';

    // Delay binding the click event listener
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100); // Small delay to ensure the menu is shown before adding the listener
  }

  function handleClickOutside(event) {
    if (!menu.contains(event.target)) {
      menu.style.display = 'none';
      document.removeEventListener('click', handleClickOutside);
    }
  }
}

window.toggleMenu = toggleMenu;

document.addEventListener('DOMContentLoaded', () => {
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

  const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;

  // No need to request fullscreen in PWA
  if (isMobile() && isFullscreen) {
    //requestFullscreen();
    const fullscreenToggle = document.getElementById('fullscreenToggle');
    if (fullscreenToggle) fullscreenToggle.style.display = 'none';
  }

  if (window.matchMedia('(display-mode: fullscreen)').matches) {
    // Adjust layout for fullscreen mode
    adjustViewport();
  }

  window.matchMedia('(display-mode: fullscreen)').addEventListener('change', (e) => {
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
  const examples = document.getElementById('exampleSelect');
  if (examples) {
    examples.style.width = '70px';
  }
  const projectName = document.getElementById('projectName');
  if (projectName) {
    //projectName.style.minWidth = "5px";
    //projectName.style.maxWidth = "80px";
  }
});

let currentView = 'start'; // Start with the code view
// Function to be called once the app has fully loaded
export { currentView, switchView, codeMode, showCodeView };

const container = document.getElementById('maincontent');
const bottomBar = document.getElementById('bottomBar');
const canvasToggleBtn = document.getElementById('canvasToggleBtn');
const codeToggleBtn = document.getElementById('codeToggleBtn');

let savedView = 'canvas';
let savedShortcutsVisible = false;

function addButtonListener() {
  if (canvasToggleBtn) canvasToggleBtn.addEventListener('click', showCanvasView);
  if (codeToggleBtn) codeToggleBtn.addEventListener('click', showCodeView);
}

// Alternative approach: Instead of CSS transforms, actually reposition elements in DOM
// This ensures Blockly's coordinate system stays aligned

function showCodeView() {
  const blocklyArea = document.getElementById('codePanel');
  if (!blocklyArea) return;
  blocklyArea.style.display = 'block';

  currentView = 'code';

  if (isNarrowScreen()) {
    // Instead of CSS transform, change the layout directly
    const canvasArea = document.getElementById('canvasArea');
    if (!canvasArea) return;

    // Hide canvas, show code full width
    canvasArea.style.display = 'none';
    blocklyArea.style.width = '100%';
    blocklyArea.style.flex = '1 1 100%';

    if (canvasToggleBtn) canvasToggleBtn.setAttribute('aria-pressed', 'false');
    if (codeToggleBtn) codeToggleBtn.setAttribute('aria-pressed', 'true');

    // Blockly resize after DOM changes
    requestAnimationFrame(() => {
      if (workspace) {
        Blockly.svgResize(workspace);
      }
    });
  }

  onResize('reset');
}

export function showCanvasView() {
  window.flockWorkspaceSearch?.close();

  const gizmoButtons = document.getElementById('gizmoButtons');
  const flockLink = document.getElementById('flocklink');
  if (!gizmoButtons || !flockLink) return;
  gizmoButtons.style.display = 'block';
  flockLink.style.display = 'block';

  currentView = 'canvas';

  if (isNarrowScreen()) {
    // Instead of CSS transform, change the layout directly
    const canvasArea = document.getElementById('canvasArea');
    const blocklyArea = document.getElementById('codePanel');
    if (!blocklyArea || !canvasArea) return;

    // Hide code, show canvas full width
    blocklyArea.style.display = 'none';
    canvasArea.style.display = '';
    canvasArea.style.width = '100%';
    canvasArea.style.flex = '1 1 100%';

    if (canvasToggleBtn) canvasToggleBtn.setAttribute('aria-pressed', 'true');
    if (codeToggleBtn) codeToggleBtn.setAttribute('aria-pressed', 'false');
  }

  onResize();
}

// Updated swipe handling to work with DOM-based switching
function addSwipeListeners() {
  if (!bottomBar) return;

  let startX = 0;
  let startTime = 0;
  const swipeThreshold = 50;
  const maxSwipeTime = 300; // Max time for a valid swipe (ms)

  bottomBar.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startTime = Date.now();
  });

  bottomBar.addEventListener('touchend', (e) => {
    const endX = e.changedTouches[0].clientX;
    const endTime = Date.now();

    const deltaX = endX - startX;
    const deltaTime = endTime - startTime;

    // Only process quick swipes
    if (deltaTime > maxSwipeTime) return;

    // Determine swipe direction
    if (Math.abs(deltaX) > swipeThreshold) {
      if (deltaX > 0 && currentView === 'canvas') {
        // Swipe right from canvas to code
        showCodeView();
      } else if (deltaX < 0 && currentView === 'code') {
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

  const blocklyArea = document.getElementById('codePanel');
  if (!blocklyArea) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
          // Blockly area is significantly visible, ensure it's properly sized
          requestAnimationFrame(() => {
            if (workspace) {
              Blockly.svgResize(workspace);
            }
          });
        }
      });
    },
    {
      threshold: [0.5], // Trigger when 50% visible
    }
  );

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
    const blocklyArea = document.getElementById('codePanel');
    const canvasArea = document.getElementById('canvasArea');
    if (!blocklyArea || !canvasArea) return;

    // Determine initial view based on which panel is visible
    if (
      getComputedStyle(blocklyArea).display !== 'none' &&
      getComputedStyle(canvasArea).display === 'none'
    ) {
      currentView = 'code';
    } else {
      currentView = 'canvas';
      // Ensure canvas view is properly set up
      showCanvasView();
    }
  }
}

// Handle transitions between narrow and wide layouts on resize
window.matchMedia('(max-width: 1024px)').addEventListener('change', (e) => {
  const blocklyArea = document.getElementById('codePanel');
  const canvasArea = document.getElementById('canvasArea');
  if (!blocklyArea || !canvasArea) return;

  if (e.matches) {
    // Crossed into narrow: set up single-panel view
    showCanvasView();
  } else {
    // Crossed into wide: restore both panels, clear inline styles set by mobile view
    blocklyArea.style.display = 'block';
    blocklyArea.style.width = '';
    blocklyArea.style.flex = '';
    canvasArea.style.display = '';
    canvasArea.style.width = '';
    canvasArea.style.flex = '';
    onResize();
  }
});

// Modified toggle function to work with new approach
function togglePanels() {
  if (!isNarrowScreen()) {
    return;
  }
  if (currentView === 'canvas') {
    showCodeView();
  } else {
    showCanvasView();
  }
}

// Updated play mode to work with new approach
export function togglePlayMode() {
  const blocklyArea = document.getElementById('codePanel');
  const canvasArea = document.getElementById('canvasArea');
  const gizmoButtons = document.getElementById('gizmoButtons');
  const bottomBar = document.getElementById('bottomBar');
  const flockLink = document.getElementById('flocklink');
  const infoPanel = document.getElementById('info-panel');
  const resizer = document.getElementById('resizer');
  if (!blocklyArea || !canvasArea || !gizmoButtons || !bottomBar || !flockLink) {
    return;
  }

  const gizmosVisible =
    gizmoButtons &&
    getComputedStyle(gizmoButtons).display !== 'none' &&
    getComputedStyle(gizmoButtons).visibility !== 'hidden';

  if (gizmosVisible) {
    savedView = currentView;

    // Clear any transforms that might be applied
    if (isNarrowScreen()) {
      if (container) container.style.transform = 'translateX(0px)';
    }

    showCanvasView();
    if (flock.scene) flock.scene.debugLayer.hide();
    savedShortcutsVisible = !(
      window.flockShortcutsPanel?.panel?.classList.contains('hidden') ?? true
    );
    window.flockShortcutsPanel?.hide();
    blocklyArea.style.display = 'none';
    gizmoButtons.style.display = 'none';
    bottomBar.style.display = 'none';
    flockLink.style.display = 'none';
    if (infoPanel) infoPanel.style.display = 'none';
    if (resizer) resizer.style.display = 'none';
    document.documentElement.style.setProperty('--dynamic-offset', '40px');
  } else {
    if (flock.scene) flock.scene.debugLayer.hide();
    blocklyArea.style.display = 'block';
    canvasArea.style.display = '';
    gizmoButtons.style.display = 'block';
    bottomBar.style.display = '';
    flockLink.style.display = 'block';
    if (infoPanel) infoPanel.style.display = '';
    if (resizer) resizer.style.display = 'block';
    if (savedShortcutsVisible) {
      window.flockShortcutsPanel?.show();
      savedShortcutsVisible = false;
    }
    document.documentElement.style.setProperty('--dynamic-offset', '65px');

    // On narrow screens, restore the saved view
    if (isNarrowScreen()) {
      if (savedView === 'code') {
        showCodeView();
      } else {
        showCanvasView();
      }
    } else {
      // On wide screens, restore the flex layout
      switchView('both');
    }
  }

  onResize('reset');
}

function prepareCanvasForRecording() {
  // Force a render and resize to ensure canvas is ready for capture
  if (flock.engine && flock.scene) {
    flock.engine.resize();
    flock.scene.render();
  }
}

export function toggleDesignMode() {
  if (!flock.scene) return;

  const blocklyArea = document.getElementById('codePanel');
  const canvasArea = document.getElementById('canvasArea');
  const gizmoButtons = document.getElementById('gizmoButtons');
  const flockLink = document.getElementById('flocklink');
  const infoPanel = document.getElementById('info-panel');
  const resizer = document.getElementById('resizer');
  if (!blocklyArea || !canvasArea || !gizmoButtons || !flockLink || !infoPanel) {
    return;
  }

  if (flock.scene.debugLayer.isVisible()) {
    canvasArea.style.flexDirection = '';
    switchView('both');
    flock.scene.debugLayer.hide();
    flockLink.style.display = 'block';
    infoPanel.style.display = 'flex';
  } else {
    blocklyArea.style.display = 'none';
    codeMode = 'none';
    canvasArea.style.display = '';
    canvasArea.style.flexDirection = 'row';
    canvasArea.style.width = '0';
    gizmoButtons.style.display = 'block';
    flockLink.style.display = 'none';
    infoPanel.style.display = 'none';
    if (resizer) resizer.style.display = 'none';

    flock.scene.debugLayer.show({
      embedMode: true,
      enableClose: false,
      enablePopup: false,
    });

    canvasArea.style.flex = '1 1 0';

    // Prepare canvas for potential recording
    setTimeout(prepareCanvasForRecording, 100);
  }

  onResize('reset');
}

let _keyboardWasOpen = false;

const scrollEditingBlockIntoView = () => {
  if (!workspace) return;
  const input = document.activeElement;
  if (!input?.classList.contains('blocklyHtmlInput')) return;

  const rect = input.getBoundingClientRect();
  const visibleBottom = window.visualViewport.height;
  const padding = 24;
  const overlap = rect.bottom - visibleBottom;

  if (overlap > 0) {
    const origHideChaff = workspace.hideChaff.bind(workspace);
    workspace.hideChaff = () => {};
    workspace.scroll(workspace.scrollX, workspace.scrollY - (overlap + padding) / workspace.scale);
    workspace.hideChaff = origHideChaff;
    Blockly.WidgetDiv.repositionForWindowResize();
  }
};

const adjustViewport = () => {
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const vh = viewportHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
  document.documentElement.style.setProperty('--app-height', `${viewportHeight}px`);
  const keyboardOpen =
    window.visualViewport && window.innerHeight - window.visualViewport.height > 150;
  document.documentElement.classList.toggle('keyboard-open', keyboardOpen);

  if (keyboardOpen && !_keyboardWasOpen) {
    setTimeout(scrollEditingBlockIntoView, 300);
  }
  _keyboardWasOpen = keyboardOpen;
};

const _origWidgetCreate = Blockly.FieldNumber.prototype.widgetCreate_;
Blockly.FieldNumber.prototype.widgetCreate_ = function () {
  const input = _origWidgetCreate.call(this);
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  return input;
};

// Adjust viewport on page load and resize
window.addEventListener('load', adjustViewport);
window.addEventListener('resize', adjustViewport);
window.addEventListener('orientationchange', adjustViewport);
document.addEventListener('fullscreenchange', adjustViewport);

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', adjustViewport);
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
    this.touchActivationPointerId = null;
    this.touchActivationStartX = 0;
    this.touchActivationStartY = 0;
    this.touchActivationRadius = 22;
    this.touchActivationMoveThreshold = 8;
    this.enabled = !!this.resizer && !!this.canvasArea && !!this.codePanel && !!this.mainContent;

    this.init();
  }

  init() {
    if (!this.enabled) return;

    // Mouse events
    this.resizer.addEventListener('mousedown', this.startResize.bind(this));
    document.addEventListener('mousemove', this.handleResize.bind(this));
    document.addEventListener('mouseup', this.stopResize.bind(this));

    // Touch events for mobile
    this.resizer.addEventListener('touchstart', this.startResize.bind(this));
    document.addEventListener('touchmove', this.handleResize.bind(this));
    document.addEventListener('touchend', this.stopResize.bind(this));

    // Touch drags may begin in Blockly or the canvas, then pass over the narrow bar.
    document.addEventListener('pointerdown', this.trackTouchPointer.bind(this), true);
    document.addEventListener('pointermove', this.handleDocumentPointerMove.bind(this), {
      capture: true,
      passive: false,
    });
    document.addEventListener('pointerup', this.clearTouchPointer.bind(this), true);
    document.addEventListener('pointercancel', this.clearTouchPointer.bind(this), true);

    // Keyboard accessibility
    this.resizer.addEventListener('keydown', this.handleKeyboard.bind(this));

    // Prevent text selection during resize
    this.resizer.addEventListener('selectstart', (e) => e.preventDefault());
  }

  startResize(e) {
    if (!this.enabled) return;
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
    if (e.cancelable) e.preventDefault();
  }

  trackTouchPointer(e) {
    if (!this.enabled || !this.isTouchLikePointer(e) || e.isPrimary === false) return;
    if (!this.mainContent.contains(e.target)) return;

    this.touchActivationPointerId = e.pointerId;
    this.touchActivationStartX = e.clientX;
    this.touchActivationStartY = e.clientY;
  }

  handleDocumentPointerMove(e) {
    if (!this.enabled || !this.isTouchLikePointer(e) || e.isPrimary === false) return;
    if (this.touchActivationPointerId !== e.pointerId) return;

    if (!this.isResizing && this.shouldActivateFromTouchDrag(e)) {
      this.startResize(e);
    }

    if (this.isResizing) {
      this.handleResize(e);
      e.stopPropagation();
    }
  }

  clearTouchPointer(e) {
    if (!this.enabled || !this.isTouchLikePointer(e)) return;
    if (this.touchActivationPointerId !== e.pointerId) return;

    this.touchActivationPointerId = null;
    this.stopResize();
  }

  shouldActivateFromTouchDrag(e) {
    const deltaX = e.clientX - this.touchActivationStartX;
    const deltaY = e.clientY - this.touchActivationStartY;
    const distance = Math.hypot(deltaX, deltaY);

    return (
      distance >= this.touchActivationMoveThreshold &&
      this.isResizerVisible() &&
      this.isPointInTouchActivationZone(e.clientX, e.clientY)
    );
  }

  isPointInTouchActivationZone(clientX, clientY) {
    const rect = this.resizer.getBoundingClientRect();

    return (
      clientX >= rect.left - this.touchActivationRadius &&
      clientX <= rect.right + this.touchActivationRadius &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }

  isResizerVisible() {
    const rect = this.resizer.getBoundingClientRect();
    const style = window.getComputedStyle(this.resizer);

    return (
      rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    );
  }

  isTouchLikePointer(e) {
    return e.pointerType === 'touch' || e.pointerType === 'pen';
  }

  handleResize(e) {
    if (!this.enabled || !this.isResizing) return;

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

    if (e.cancelable) e.preventDefault();
  }

  stopResize() {
    if (!this.enabled || !this.isResizing) return;

    this.isResizing = false;

    // Remove resizing class to restore hover effects
    this.resizer.classList.remove('resizing');

    document.body.style.cursor = '';

    // Final resize trigger after dragging stops
    this.triggerContentResize();
  }

  handleKeyboard(e) {
    if (!this.enabled) return;
    const step = 20; // pixels
    let deltaX = 0;

    switch (e.key) {
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
    const minPanelWidth = 300;

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
