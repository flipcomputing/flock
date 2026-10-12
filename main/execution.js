import { flock } from '../flock.js';
import {
  currentView,
  hideInspector,
  isInspectorCollapsed,
  isNarrowScreen,
  showCanvasView,
  showInspector,
} from './view.js';
import { handleError, isBenignAbort, isReported } from '../ui/notifications.js';
import { setGizmoManager, disposeGizmoManager } from '../ui/gizmos.js';
import { resetLiveEditsForRun } from '../ui/blockmesh.js';
import { javascriptGenerator } from 'blockly/javascript';
import { workspace } from './blocklyinit.js';
import { generateWorkspaceCode } from '../blocks/sectionContainment.js';
import { showStatus, clearStatus } from '../ui/status.js';
import { translate } from './translation.js';
import { isMac } from '../accessibility/keyboardui.js';

let isExecuting = false;

const ENGINE_READY_TIMEOUT_MS = 10000;

export async function executeCode(options = {}) {
  if (isExecuting) {
    return;
  }

  isExecuting = true;

  // finally must reset isExecuting: a throw anywhere below must not leave Play
  // permanently disabled.
  try {
    // Abort early: runCode aborts too, but only after async delays, leaving a
    // gap where the old run's audio can race the new one.
    flock.abortController?.abort();
    flock.stopAllSounds();
    // Play while paused starts afresh rather than resuming.
    resumeCode();

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Bail if the engine never readies, so a failed startup can't hold isExecuting.
    const waitStarted = Date.now();
    while (!flock.engineReady) {
      if (Date.now() - waitStarted > ENGINE_READY_TIMEOUT_MS) {
        handleError(new Error('Engine not ready'), { source: 'startup', fatal: true });
        return;
      }
      await delay(100);
    }

    if (isNarrowScreen() && currentView === 'code') {
      showCanvasView();
    }

    disposeGizmoManager();

    const showDebug = flock.scene?.debugLayer?.isVisible();
    const inspectorWasCollapsed = showDebug && isInspectorCollapsed();

    if (showDebug) {
      hideInspector();
    }

    try {
      // Inside the try: a generator throw would escape with gizmos already disposed.
      // The code we're about to generate bakes current block values — nothing stale.
      resetLiveEditsForRun();
      const code = generateWorkspaceCode(workspace, javascriptGenerator);
      await flock.runCode(code, options);
    } catch (error) {
      // An aborted run (Play pressed again) is not a failure: skip the banner and the gizmo/debug
      // restore below. A real failure falls through so the editor UI that
      // disposeGizmoManager tore down above still gets rebuilt.
      if (isBenignAbort(error)) {
        return;
      }
      // Already banner'd by a more specific handler (e.g. WebGL unavailable).
      if (!isReported(error)) {
        handleError(error, { source: 'project-run', fatal: false });
      }
    }

    if (showDebug) {
      try {
        await showInspector({ collapsed: inspectorWasCollapsed });
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

const PAUSE_ICON =
  'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM224 192l0 128c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-128c0-17.7 14.3-32 32-32s32 14.3 32 32zm128 0l0 128c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-128c0-17.7 14.3-32 32-32s32 14.3 32 32z';
// The usual play/pause combination, cut from a solid circle like the other run buttons.
const UNPAUSE_ICON =
  'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM136 168l0 176l128-88zM316 168a20 20 0 0 1 20 20v136a20 20 0 0 1-40 0v-136a20 20 0 0 1 20-20zM380 168a20 20 0 0 1 20 20v136a20 20 0 0 1-40 0v-136a20 20 0 0 1 20-20z';

// The label changes with the icon, so the button is not also aria-pressed.
function setPausedUI(paused) {
  const key = paused ? 'unpause_code_button' : 'pause_code_button';
  const label = translate(`${key}_ui`);
  for (const button of document.querySelectorAll('.pause-toggle')) {
    button.querySelector('path')?.setAttribute('d', paused ? UNPAUSE_ICON : PAUSE_ICON);
    if (button.dataset.i18n) button.dataset.i18n = key;
    button.title = label;
    button.setAttribute('aria-label', label);
  }
}

export function pauseCode() {
  if (flock.isPaused()) return;
  flock.setPaused(true);
  setPausedUI(true);
  const keys = `${isMac() ? '⌘' : 'Ctrl'} + K`;
  // Not a gizmo hint, so the Tools panel's hint setting doesn't hide it: it
  // explains why everything has stopped.
  showStatus(translate('pause_hint').replace('{keys}', keys), { duration: 15, owner: 'pause' });
}

export function resumeCode() {
  if (!flock.isPaused()) return;
  flock.setPaused(false);
  setPausedUI(false);
  clearStatus('pause');
}

export function togglePause({ focusCanvas = false } = {}) {
  if (flock.isPaused()) resumeCode();
  else pauseCode();
  // Like Play: the button hands focus to the scene, while the shortcut leaves
  // it where it was, so you can keep working on your code.
  if (focusCanvas) document.getElementById('renderCanvas')?.focus({ preventScroll: true });
}

window.executeCode = executeCode;
