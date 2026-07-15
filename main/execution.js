import { flock } from '../flock.js';
import { currentView, isNarrowScreen, showCanvasView } from './view.js';
import { handleError } from '../ui/notifications.js';
import { setGizmoManager, disposeGizmoManager } from '../ui/gizmos.js';
import { javascriptGenerator } from 'blockly/javascript';
import { workspace } from './blocklyinit.js';

let isExecuting = false;

export async function executeCode(options = {}) {
  // Check if the function is already running
  if (isExecuting) {
    return; // Exit if already running
  }

  // Set the flag to indicate the function is running
  isExecuting = true;

  // Remove the "press play" overlay now that the scene is starting
  hideStoppedOverlay();

  // Abort any still-running previous Compartment and stop its audio immediately.
  // runCode also aborts, but only after initializeNewScene's async delays — without
  // this early abort, the old Compartment can slip a playNotes call through during
  // that gap and create a new audio context that races with the new run.
  flock.abortController?.abort();
  flock.stopAllSounds();

  // Utility function for delay
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Wait until the engine is ready using a loop with an async delay
  while (!flock.engineReady) {
    await delay(100);
  }

  //console.log("Engine ready");

  // If on a narrow screen and currently showing code, switch to canvas
  if (isNarrowScreen() && currentView === 'code') {
    showCanvasView();
  }

  disposeGizmoManager();

  let showDebug = flock.scene?.debugLayer?.isVisible();

  if (showDebug) {
    flock.scene.debugLayer.hide();
  }

  // Generate the code from the workspace
  const code = javascriptGenerator.workspaceToCode(workspace);

  try {
    //console.log(code);
    await flock.runCode(code, options);
  } catch (error) {
    isExecuting = false; // Reset the flag if there's an error
    handleError(error, { source: 'project-run', fatal: false });
    return; // Exit after handling the error
  }

  // Check if the debug layer is visible and show it if necessary
  if (showDebug) {
    try {
      await import('@babylonjs/inspector');
      await flock.scene.debugLayer.show({
        embedMode: true,
        enableClose: false,
        enablePopup: false,
      });
    } catch (error) {
      console.error('Error showing debug layer:', error);
    }
  }

  setGizmoManager(new flock.BABYLON.GizmoManager(flock.scene, 8));

  await delay(1000);
  // Reset the flag to allow future executions
  isExecuting = false;
}

function getStoppedOverlay() {
  return document.getElementById('canvasStoppedOverlay');
}

let overlayResizeHandler = null;

// Size the overlay to the rendered canvas box so it covers only the Babylon
// canvas, not the surrounding canvas area or the (hidden) gizmo buttons.
function positionStoppedOverlay() {
  const overlay = getStoppedOverlay();
  const canvas = document.getElementById('renderCanvas');
  if (!overlay || !canvas) return;
  overlay.style.left = `${canvas.offsetLeft}px`;
  overlay.style.top = `${canvas.offsetTop}px`;
  overlay.style.width = `${canvas.offsetWidth}px`;
  overlay.style.height = `${canvas.offsetHeight}px`;
}

function showStoppedOverlay() {
  const overlay = getStoppedOverlay();
  if (!overlay) return;
  // Hides the gizmo buttons (via CSS) and covers the canvas; the canvas is made
  // inert below so screen reader and keyboard users skip the frozen scene.
  document.getElementById('canvasArea')?.classList.add('is-stopped');
  const canvas = document.getElementById('renderCanvas');
  if (canvas) canvas.inert = true;
  positionStoppedOverlay();
  overlay.hidden = false;
  // Move keyboard focus to the play button so it can be triggered immediately
  overlay.querySelector('#overlayPlayButton')?.focus({ preventScroll: true });
  if (!overlayResizeHandler) {
    overlayResizeHandler = () => positionStoppedOverlay();
    window.addEventListener('resize', overlayResizeHandler);
  }
}

function hideStoppedOverlay() {
  const overlay = getStoppedOverlay();
  if (overlay) overlay.hidden = true;
  document.getElementById('canvasArea')?.classList.remove('is-stopped');
  const canvas = document.getElementById('renderCanvas');
  if (canvas) canvas.inert = false;
  if (overlayResizeHandler) {
    window.removeEventListener('resize', overlayResizeHandler);
    overlayResizeHandler = null;
  }
}

export function stopCode() {
  flock.abortController?.abort();
  flock.stopAllSounds();

  // Stop rendering
  flock.engine.stopRenderLoop();
  //console.log("Render loop stopped.");

  // Show the "press play" overlay over the (now frozen) canvas
  showStoppedOverlay();

  // Remove event listeners
  flock.removeEventListeners();

  // If on a narrow screen and currently showing code, switch to canvas
  if (isNarrowScreen() && currentView === 'code') {
    showCanvasView();
  }

  //console.log("Switched view.");
}

window.stopCode = stopCode;

window.executeCode = executeCode;
