import { flock } from '../flock.js';
import { currentView, isNarrowScreen, showCanvasView } from './view.js';
import { handleError, isBenignAbort } from '../ui/notifications.js';
import { setGizmoManager, disposeGizmoManager } from '../ui/gizmos.js';
import { javascriptGenerator } from 'blockly/javascript';
import { workspace } from './blocklyinit.js';

let isExecuting = false;

// Stop pressed while a run is still waiting for the engine. The abort
// controller can't carry this: the pending run has aborted the old one and not
// yet made its own, so Stop has nothing to signal.
let stopRequested = false;

const ENGINE_READY_TIMEOUT_MS = 10000;

export async function executeCode(options = {}) {
  if (isExecuting) {
    return;
  }

  isExecuting = true;
  stopRequested = false;

  // finally must reset isExecuting: a throw anywhere below must not leave Play
  // permanently disabled.
  try {
    hideStoppedOverlay();

    // Abort early: runCode aborts too, but only after async delays, leaving a
    // gap where the old run's audio can race the new one.
    flock.abortController?.abort();
    flock.stopAllSounds();

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Bail if the engine never readies, so a failed startup can't hold isExecuting.
    const waitStarted = Date.now();
    while (!flock.engineReady) {
      if (Date.now() - waitStarted > ENGINE_READY_TIMEOUT_MS) {
        handleError(new Error('Engine not ready'), { source: 'startup', fatal: true });
        return;
      }
      await delay(100);
      if (stopRequested) return;
    }

    if (isNarrowScreen() && currentView === 'code') {
      showCanvasView();
    }

    disposeGizmoManager();

    let showDebug = flock.scene?.debugLayer?.isVisible();

    if (showDebug) {
      flock.scene.debugLayer.hide();
    }

    try {
      // Inside the try: a generator throw would escape with gizmos already disposed.
      const code = javascriptGenerator.workspaceToCode(workspace);
      await flock.runCode(code, options);
    } catch (error) {
      // A stopped run is a normal stop: skip the banner and the gizmo/debug
      // restore below. A real failure falls through so the editor UI that
      // disposeGizmoManager tore down above still gets rebuilt.
      if (isBenignAbort(error)) {
        return;
      }
      handleError(error, { source: 'project-run', fatal: false });
    }

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

    // Guard the scene: a failed run may have left none, and GizmoManager(null) throws.
    if (flock.scene) {
      setGizmoManager(new flock.BABYLON.GizmoManager(flock.scene, 8));
    }

    // Debounce so rapid re-presses of Play are ignored until the scene settles.
    await delay(1000);
  } finally {
    isExecuting = false;
  }
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
  stopRequested = true;
  flock.abortController?.abort();
  flock.stopAllSounds();
  flock.engine?.stopRenderLoop();
  showStoppedOverlay();
  flock.removeEventListeners();

  if (isNarrowScreen() && currentView === 'code') {
    showCanvasView();
  }
}

window.stopCode = stopCode;

window.executeCode = executeCode;
