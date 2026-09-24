import * as Blockly from 'blockly';
import { meshMap, meshBlockIdMap } from '../generators/generators.js';
import { flock } from '../flock.js';
import { translate } from '../main/translation.js';
import {
  getBlockKeyFromBlock,
  getMeshFromBlockKey,
  getMeshFromBlock,
  getRootMesh,
  getXYZFromBlock,
  updateBlockColorAndHighlight,
  suppressBlockLiveUpdates,
  unsuppressBlockLiveUpdates,
  getSuppressedHitCount,
  setGroupSelectionFollower,
} from './blockmesh.js';
import {
  highlightBlockById,
  getCanvasXAndCanvasYValues,
  setBlockXYZ,
  duplicateBlockAndInsert,
  insertBlockSnapshot,
  captureStackAnchor,
  reattachBlockToAnchor,
  chainBlockAfter,
  findParentWithBlockId,
  setNumberInputs,
  getNumberInput,
  isBlockLocked,
  stripLockState,
} from './blocklyutil.js';
import { getMeshRotationInDegrees, roundToOneDecimal, pickLeafFromRay } from './meshhelpers.js';
import {
  startCanvasKeyboardMode,
  stopCanvasKeyboardMode,
  getCanvasCircle,
  setCrosshairCursor,
  setDefaultCursor,
} from './canvas-utils.js';
import { createAxisKeyboardHandler } from './axis-keyboard.js';
import { showStatus, clearStatus } from './status.js';
import { createGizmoMobileHud } from './gizmo-mobile-hud.js';
import { KeyboardDispatcher } from '../main/keyboardDispatcher.js';
import { announceToScreenReader } from '../main/input.js';
import { GizmoMenuManager } from '../accessibility/keyboardui.js';
import { isBodyAlive } from '../api/physics.js';
export let gizmoManager;

// Enable debug messages
const DEBUG = true;

const AXIS_HEX = { x: '#0072B2', y: '#009E73', z: '#D55E00' };

const blueColor = flock.BABYLON.Color3.FromHexString(AXIS_HEX.x); // Colour for X-axis
const greenColor = flock.BABYLON.Color3.FromHexString(AXIS_HEX.y); // Colour for Y-axis
const orangeColor = flock.BABYLON.Color3.FromHexString(AXIS_HEX.z); // Colour for Z-axis

// Matches --color-light-icon-bar in style.css (the light purple behind the
// gizmo buttons), so the orbit-view box reads as "in orbit" rather than
// "selected" at a glance.
const ORBIT_BOUNDING_BOX_COLOR = flock.BABYLON.Color3.FromHexString('#cec0e0');
let defaultBoundingBoxColors = null; // Babylon's own colours, captured once per scene
let boundingBoxColorHookScene = null; // Scene the per-box colour hook is installed on

// Babylon's BoundingBoxRenderer colour is normally scene-global — one
// frontColor/backColor shared by every mesh with showBoundingBox=true — but
// its onBeforeBoxRenderingObservable fires once per box, right before that
// box's colour is read, with the exact BoundingBox instance being drawn
// (mesh.getBoundingInfo().boundingBox — reused in place per mesh, not
// recreated, so `===` identifies which mesh it belongs to). Swapping
// frontColor/backColor in that hook tints only the orbited mesh's own box
// purple, leaving every other box (select, transform gizmos, ...) at
// Babylon's default colour — even while both are visible at once.
function ensureOrbitBoundingBoxColorHook() {
  const renderer = flock.scene?.getBoundingBoxRenderer?.();
  if (!renderer || boundingBoxColorHookScene === flock.scene) return;
  defaultBoundingBoxColors = {
    front: renderer.frontColor.clone(),
    back: renderer.backColor.clone(),
  };
  renderer.onBeforeBoxRenderingObservable.add((boundingBox) => {
    const orbitMesh = window.orbitMesh;
    const isOrbitBox =
      !!flock.scene?.activeCamera?.metadata?.orbitView &&
      orbitMesh &&
      !orbitMesh.isDisposed?.() &&
      boundingBox === orbitMesh.getBoundingInfo().boundingBox;
    const colors = isOrbitBox
      ? { front: ORBIT_BOUNDING_BOX_COLOR, back: ORBIT_BOUNDING_BOX_COLOR }
      : defaultBoundingBoxColors;
    renderer.frontColor = colors.front;
    renderer.backColor = colors.back;
  });
  boundingBoxColorHookScene = flock.scene;
}

// True while mesh is the one orbit view is currently centred on.
function isOrbitedMesh(mesh) {
  return !!(mesh && flock.scene?.activeCamera?.metadata?.orbitView && mesh === window.orbitMesh);
}

const FAST_CURSOR = 1; // Step for moving KB cursor quickly
const DEFAULT_CURSOR = 0.1; // Step for moving KB cursor slowly (default)
const FAST_ROTATION = 0.5;
const DEFAULT_ROTATION = 0.05;
const FAST_SCALE = 0.5;
const DEFAULT_SCALE = 0.05;

const MODEL_BLOCK_TYPES = new Set([
  'load_model',
  'load_multi_object',
  'load_object',
  'load_character',
]);

// Block types with no dimension fields of their own: like models, they get a
// resize block instead. A group is an empty container sized by its children.
const RESIZE_BLOCK_TYPES = new Set([...MODEL_BLOCK_TYPES, 'create_group']);

window.selectedColor = '#ffffff'; // Default color
let colorPicker = null;

// Which scale gizmo handle is being dragged ('x' | 'y' | 'z' | 'uniform')
let scaleDragAxis = null;
let textOrigScaleZ = 1;

// Round shapes have a single horizontal dimension: X and Z always match.
const RADIAL_BLOCK_TYPES = new Set(['create_capsule', 'create_cylinder']);

// Track state
let cameraMode = 'play';
let activePick = null; // [Select mesh?]
let activeDuplicatePickHandler = null; // [Clone mesh?]
let activeDuplicatePickTimer = null; // Deferred-listener timer for the above
let stopAxisKeyboard = null; // Axis keyboard active?
let duplicateModeActive = false;
let duplicateRafId = null;
let canvasClipboard = null;
let orbitSavedCamera = null; // Free camera stashed while orbit-view is active
let orbitViewObserver = null; // Unused; orbit no longer tracks selection
let orbitDisposeObserver = null; // Dispose handle for the orbited mesh
let orbitDisposeMesh = null; // Mesh the orbit camera targets (window.orbitMesh)
let orbitPreviousGizmoType = null; // Gizmo active before entering orbit, restored on exit
let orbitRetargetObserver = null; // Pointer observer that lets a canvas click switch orbit target

// Tools that keep the orbit camera active.
const ORBIT_COMPATIBLE_GIZMOS = new Set(['position', 'rotation', 'scale', 'duplicate', 'select']);

function isOrbitViewActive() {
  return !!flock.scene?.activeCamera?.metadata?.orbitView;
}

// Ends the tool but keeps an active orbit camera.
function exitTransformState() {
  const preserve = isOrbitViewActive();
  exitGizmoState(preserve ? { preserveOrbit: true } : undefined);
  if (preserve && gizmoManager) gizmoManager.usePointerToAttachGizmos = false;
}

// Keep track of things to clean up
const cleanupFns = [];

// Track DO sections and their associated blocks for cleanup
const gizmoCreatedBlocks = new Map(); // blockId -> { parentId, createdDoSection, timestamp }

// Keep the visual "active" state and its ARIA equivalent in sync — used at
// every gizmo-button activation/deactivation site instead of touching
// classList and aria-pressed separately.
export function setGizmoButtonActive(btn, active) {
  if (!btn) return;
  btn.classList.toggle('active', active);
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
}

function createAdaptiveInput({
  onMove,
  onConfirm,
  onCancel,
  stepNormal,
  stepFast,
  mode,
  showUniform,
  stepLabels,
  onHudHide,
  onAxisChange,
  stepLabelsByAxis,
  getValues = null,
  initialKeyboardAxis = null,
  initialHudAxis = null,
}) {
  let hud = null;
  let keyboard = null;

  let lastReportedAxis = initialKeyboardAxis ?? null; // seeds the HUD rebuilt on resize
  let lastHighlight;

  // Only dim for a lock the user can see the cause of: a keyboard axis always,
  // the HUD's axis only while its buttons are on screen.
  function visibleAxis() {
    const kbAxis = keyboard?.getAxis?.() ?? null;
    if (kbAxis) return kbAxis;
    if (!hud || hud.isCollapsed?.()) return null;
    return hud.getAxis?.() ?? null;
  }

  function reportAxis(axis) {
    if (axis === lastHighlight) return;
    lastHighlight = axis;
    onAxisChange?.(axis);
  }

  function onKbAxisChange(axis) {
    if (axis) {
      hud?.setAxis(axis);
      lastReportedAxis = axis;
    }
    reportAxis(visibleAxis());
  }

  function onHudAxisChange(axis) {
    if (keyboard?.getAxis?.()) {
      clearStatus('axis');
    }
    keyboard?.setAxis?.(null);
    lastReportedAxis = axis;
    reportAxis(visibleAxis());
  }

  function buildHud(initialAxis) {
    return createGizmoMobileHud({
      onMove,
      stepNormal,
      stepFast,
      mode,
      showUniform,
      stepLabels,
      onAxisChange: onHudAxisChange,
      onCollapsedChange: () => reportAxis(visibleAxis()),
      stepLabelsByAxis,
      getValues,
      initialAxis,
    });
  }

  hud = buildHud(initialHudAxis ?? initialKeyboardAxis);
  keyboard = createAxisKeyboardHandler({
    onMove,
    onConfirm,
    onCancel,
    stepNormal,
    stepFast,
    onAxisChange: onKbAxisChange,
    initialAxis: initialKeyboardAxis,
    allowUniform: showUniform,
  });
  // The HUD lands on an axis (X by default) and normalises saved ones, so take
  // its choice over the raw value.
  const startAxis = initialKeyboardAxis ?? hud?.getAxis?.() ?? initialHudAxis ?? null;
  lastReportedAxis = startAxis;
  if (startAxis) hud?.setAxis?.(startAxis);
  reportAxis(visibleAxis());
  flock.canvas?.focus();

  // The HUD's layout is computed once at creation time from canvas.width/height,
  // so it must be rebuilt whenever the canvas resizes.
  let resizeTimer = null;
  const handleCanvasResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeTimer = null;
      if (!hud) return;
      hud();
      hud = buildHud(lastReportedAxis);
    }, 200);
  };
  window.addEventListener('flock:canvas-resize', handleCanvasResize);

  function stop() {
    clearTimeout(resizeTimer);
    window.removeEventListener('flock:canvas-resize', handleCanvasResize);
    onHudHide?.();
    hud?.();
    keyboard?.();
  }
  // A drag is its own visible lock, so it dims even with the HUD hidden.
  stop.setAxis = (axis) => {
    if (axis) {
      hud?.setAxis(axis);
      lastReportedAxis = axis;
      reportAxis(axis);
    } else {
      reportAxis(visibleAxis());
    }
  };
  stop.getAxis = () => keyboard?.getAxis?.() ?? null;
  stop.toggleHud = () => hud?.toggleCollapsed?.();
  return stop;
}

// Register input handlers for gizmo actions
function registerBindings() {
  const noMod = (fn) => (e) => {
    if (!e.ctrlKey && !e.altKey && !e.metaKey) fn(e);
  };
  // Focus on mesh with J key (not F: F is orbit view's zoom-out key, and
  // focusOnMesh() exits orbit view, so F would zoom out for one frame then
  // immediately kick you out of orbit).
  KeyboardDispatcher.on(
    'GIZMO',
    'KeyJ',
    noMod(() => focusOnMesh())
  );
  KeyboardDispatcher.on(
    'GIZMO',
    'KeyV',
    noMod(() => toggleGizmo('eye'))
  );
  KeyboardDispatcher.on(
    'EDITOR',
    'KeyV',
    noMod(() => {
      const block = Blockly.common?.getSelected?.();
      if (!block) return;
      const mesh = getMeshFromBlock(block);
      if (!mesh || mesh.name === 'ground') return;
      attachMeshForActiveTool(mesh);
      toggleGizmo('eye');
    })
  );
  // Show/hide the on-screen transform controls with O
  KeyboardDispatcher.on(
    'GIZMO',
    'KeyO',
    noMod((e) => {
      if (!stopAxisKeyboard?.toggleHud) return;
      e.preventDefault();
      const collapsed = stopAxisKeyboard.toggleHud();
      showStatus(translate(collapsed ? 'hud_hidden' : 'hud_shown'), {
        duration: 3,
        owner: 'hud',
      });
    })
  );
  // Delete selected mesh with Del key
  const deleteCanvasTarget = (e) => {
    if (isCanvasClipboardTypingTarget(e)) return;
    if (e.repeat) return;
    const target = resolveCanvasTargetBlock();
    if (!target || target.isInFlyout) return;
    e.preventDefault?.();
    e.stopPropagation?.();
    deleteBlockWithUndo(target.id);
  };
  for (const ctx of ['GIZMO', 'CAMERA']) {
    KeyboardDispatcher.on(ctx, 'Delete', deleteCanvasTarget);
    KeyboardDispatcher.on(ctx, 'Backspace', deleteCanvasTarget);
  }
  // View the selected object with V when the canvas owns the keyboard. GIZMO
  // keeps its toggle-eye binding above; CAMERA had no V binding at all.
  KeyboardDispatcher.on(
    'CAMERA',
    'KeyV',
    noMod((e) => {
      if (isCanvasClipboardTypingTarget(e)) return;
      const target = resolveCanvasTargetBlock();
      if (!target) return;
      const mesh = getMeshFromBlock(target);
      if (!mesh || mesh.name === 'ground') return;
      attachMeshForActiveTool(mesh);
      toggleGizmo('eye');
    })
  );
  // Duplicate in place with Shift+D (bare D would clash with WASD movement,
  // which stays live even with a mesh selected). Chains the copy after the
  // original and selects the new mesh.
  const duplicateCanvasTarget = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!e.shiftKey) return;
    if (e.repeat) return;
    if (isCanvasClipboardTypingTarget(e)) return;
    const target = resolveCanvasTargetBlock();
    if (!target || target.disposed || target.isInFlyout || target.isShadow?.()) return;
    e.preventDefault?.();
    e.stopPropagation?.();
    duplicateCanvasTargetInPlace(target);
  };
  for (const ctx of ['GIZMO', 'CAMERA']) {
    KeyboardDispatcher.on(ctx, 'Shift+KeyD', duplicateCanvasTarget);
  }
  // Toggle disabled with Shift+E (bare E is fly-camera up, like WASD, so it
  // can't be reused — same reason duplicate is Shift+D). Refuses locked
  // blocks, like the block toolbar.
  const disableCanvasTarget = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!e.shiftKey) return;
    if (isCanvasClipboardTypingTarget(e)) return;
    if (e.repeat) return;
    const target = resolveCanvasTargetBlock();
    if (!target || target.disposed || target.isInFlyout || target.isShadow?.()) return;
    if (isBlockLocked(target)) return;
    if (typeof target.hasDisabledReason !== 'function') return;
    e.preventDefault?.();
    e.stopPropagation?.();
    Blockly.Events.setGroup('toolbar_disable');
    try {
      target.setDisabledReason(!target.hasDisabledReason('MANUALLY_DISABLED'), 'MANUALLY_DISABLED');
    } finally {
      Blockly.Events.setGroup(false);
    }
    window.flockBlockToolbar?.refresh?.(target);
  };
  for (const ctx of ['GIZMO', 'CAMERA']) {
    KeyboardDispatcher.on(ctx, 'Shift+KeyE', disableCanvasTarget);
  }
  // Canvas clipboard: Ctrl/Cmd+C/X/V on the selected mesh.
  const withCanvasClipboard = (fn) => (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.repeat) return;
    if (isCanvasClipboardTypingTarget(e)) return;
    e.preventDefault?.();
    e.stopPropagation?.();
    fn();
  };
  for (const ctx of ['GIZMO', 'CAMERA']) {
    KeyboardDispatcher.on(ctx, 'Mod+KeyC', withCanvasClipboard(copyCanvasSelection));
    KeyboardDispatcher.on(ctx, 'Mod+KeyX', withCanvasClipboard(cutCanvasSelection));
    KeyboardDispatcher.on(ctx, 'Mod+KeyV', withCanvasClipboard(pasteCanvasClipboard));
  }
  // Undo/redo on canvas. Previously handled on the canvas element itself
  // (main/input.js), which missed keys when a gizmo held the keyboard but
  // the canvas wasn't the key target — so it lives here now alongside the
  // other canvas clipboard bindings. (Holding the combo repeats, which
  // standard undo/redo supports.)
  const undoOnCanvas = (e) => {
    if (isCanvasClipboardTypingTarget(e)) return;
    const workspace = Blockly.getMainWorkspace?.() || window.mainWorkspace;
    if (!workspace) return;
    e.preventDefault?.();
    e.stopPropagation?.();
    workspace.undo(false);
    announceToScreenReader(translate('undo_performed'), { requireCanvasFocus: false });
  };
  const redoOnCanvas = (e) => {
    if (isCanvasClipboardTypingTarget(e)) return;
    const workspace = Blockly.getMainWorkspace?.() || window.mainWorkspace;
    if (!workspace) return;
    e.preventDefault?.();
    e.stopPropagation?.();
    workspace.undo(true);
    announceToScreenReader(translate('redo_performed'), { requireCanvasFocus: false });
  };
  for (const ctx of ['GIZMO', 'CAMERA']) {
    KeyboardDispatcher.on(ctx, 'Mod+KeyZ', undoOnCanvas);
    KeyboardDispatcher.on(ctx, 'Mod+Shift+KeyZ', redoOnCanvas);
    KeyboardDispatcher.on(ctx, 'Mod+KeyY', redoOnCanvas);
  }
  // Exit gizmo with Tab key
  KeyboardDispatcher.on('GIZMO', 'Tab', () => {
    exitGizmoState();
  });
  // Exit gizmo with Esc and unselect mesh
  KeyboardDispatcher.on(
    'GIZMO',
    'Escape',
    noMod(() => {
      try {
        if (cameraMode === 'fly') handleCameraGizmo();
        exitGizmoState();
        gizmoManager?.attachToMesh(null);
      } catch {
        disableGizmos?.();
      }
      window.dispatchEvent(new CustomEvent('global:escape'));
    })
  );
}

document.addEventListener('DOMContentLoaded', function () {
  const colorButton = document.getElementById('colorPickerButton');

  // Register input handlers for gizmo actions
  registerBindings();

  // Initialize custom color picker
  if (!colorPicker) {
    colorPicker = new window.CustomColorPicker({
      color: window.selectedColor,
      onColorChange: (newColor) => {
        window.selectedColor = newColor;
      },
      onClose: () => {
        // Re-activate button: painting mode is still a gizmo action.
        // The hint is cleared in close() itself, as soon as the picker closes.
        setGizmoButtonActive(document.getElementById('colorPickerButton'), true);
        pickMeshFromCanvas();
      },
      excludeFromClose: (target) => {
        // Don't close via the "outside click" handler when clicking the trigger
        // button itself — that button's own click listener (registered below,
        // at the target phase) is the sole decision-maker for open vs close.
        // Without this, the outside-click handler (capture phase on document,
        // which runs first) would close the picker out from under the button's
        // handler, which would then see an inactive button and reopen it —
        // rerolling a random starting color instead of toggling off.
        const colorPickerButton = document.getElementById('colorPickerButton');
        if (colorPickerButton && (colorPickerButton === target || colorPickerButton.contains(target)))
          return true;
        // Don't close when clicking the 3D canvas — canvas clicks paint meshes directly
        const canvas = document.getElementById('renderCanvas');
        if (canvas && (canvas === target || canvas.contains(target))) return true;
        // Don't close for a how-to link that glows one of the picker's own
        // controls (colorpalette/colorrandom/colorwheel/etc. — see
        // wireHowToLinks()/wireHowToButtons() in ui/howToPanel.js, which tag
        // these with data-target so they can be picked out here). Their whole
        // point is to highlight a picker control while it stays open to look
        // at, so an "outside" click on them must not close it. Every other
        // click in the help panel (or anywhere else) closes it as normal.
        const howtoLink = target?.closest?.('.help-link');
        if (howtoLink?.dataset.target?.startsWith('color')) return true;
        // Don't close when clicking a colour field in the Blockly workspace —
        // the pointerdown listener in blocks.js sets this flag for colour-field hits only
        if (colorPicker._colourFieldPointerDown) {
          colorPicker._colourFieldPointerDown = false;
          return true;
        }
        return false;
      },
      target: document.body,
    });
    // Make accessible globally for translation updates
    window.flockColorPicker = colorPicker;

    // Direct painting: clicking/tapping the canvas while picker is open applies colour
    const renderCanvas = document.getElementById('renderCanvas');
    if (renderCanvas) {
      renderCanvas.addEventListener('click', (event) => {
        if (!colorPicker?.isOpen) return;
        if (colorPicker._confirmOverride) return; // opened for a Blockly field — ignore canvas click
        // Use picker's live colour (not yet confirmed via "Use")
        window.selectedColor = colorPicker.currentColor || window.selectedColor;
        const canvasRect = renderCanvas.getBoundingClientRect();
        const [canvasX, canvasY] = getCanvasXAndCanvasYValues(event, canvasRect);
        applyColorAtPosition(canvasX, canvasY);
      });
    }
  }

  // Attach click event to open custom color picker
  if (colorButton) {
    colorButton.addEventListener('click', (event) => {
      event.preventDefault();
      if (!colorPicker) return;
      // Clicking while already active (popup open, or paint mode after a
      // confirmed pick) should close/deactivate rather than reopen the
      // picker, which would otherwise reroll a random starting color.
      if (colorButton.classList.contains('active')) {
        if (colorPicker.isOpen) colorPicker.close();
        // Keep an active orbit camera on close too — matches the open path
        // above (colourpicker.js's open()), which preserves it the same way.
        exitGizmoState({ preserveOrbit: !!window.orbitViewActive });
        return;
      }
      KeyboardDispatcher.clearModes();
      GizmoMenuManager.toggle(false);
      // No explicit color: defaults to the picker's own last-shown color
      // (this.currentColor), so closing and reopening without confirming
      // keeps whatever was on screen instead of rerolling a random one.
      // window.selectedColor only updates on an explicit paint/confirm, so
      // passing it here would reintroduce that staleness.
      colorPicker.open();
      showStatus(translate('color_picker_paint_prompt'), { owner: 'color-picker', hint: true });
    });
  }
});

function pickMeshFromCanvas() {
  const canvas = flock.scene?.getEngine?.().getRenderingCanvas?.();
  if (!canvas || !flock.scene) return;

  const onPickMesh = function (event) {
    const canvasRect = canvas.getBoundingClientRect();

    // Exit if outside canvas
    if (eventIsOutOfCanvasBounds(event, canvasRect)) {
      window.removeEventListener('click', onPickMesh);
      exitGizmoState();
      return;
    }

    const [canvasX, canvasY] = getCanvasXAndCanvasYValues(event, canvasRect);
    applyColorAtPosition(canvasX, canvasY);
  };

  // Register cleanup so Escape during painting mode also tears down correctly
  onExit(() => {
    clearTimeout(listenerTimer);
    window.removeEventListener('click', onPickMesh);
    stopCanvasKeyboardMode();
    document.body.style.cursor = 'default';
    if (flock.scene) flock.scene.defaultCursor = '';
  });

  startCanvasKeyboardMode((x, y) => applyColorAtPosition(x, y));
  document.body.style.cursor = 'crosshair';
  flock.scene.defaultCursor = 'crosshair';

  const listenerTimer = setTimeout(() => {
    window.addEventListener('click', onPickMesh);
  }, 200);
}

function applyColorAtPosition(canvasX, canvasY) {
  const scene = flock.scene;

  if (scene.selectionOctree) scene.createOrUpdateSelectionOctree();

  const pickRay = scene.createPickingRay(
    canvasX,
    canvasY,
    flock.BABYLON.Matrix.Identity(),
    scene.activeCamera
  );

  const pickedMesh = pickLeafFromRay(pickRay, scene);

  let target = pickedMesh;
  // If the topmost mesh is locked, fall through to the nearest non-locked mesh
  // at the same point (the visible/operable one); refuse only if all are locked.
  if (target && isMeshLocked(target)) {
    target = nearestUnlockedMesh(canvasX, canvasY);
    if (!target) {
      showNotAllowedCursor();
      return;
    }
  }

  if (target) {
    updateBlockColorAndHighlight(target, window.selectedColor);
  } else {
    flock.setSky(window.selectedColor);
    updateBlockColorAndHighlight(meshMap?.['sky'], window.selectedColor);
  }
}

// For composite meshes where visibility needs setting to
// 0.001 in order to show parent mesh's bounding box
function resetBoundingBoxVisibilityIfManuallyChanged(mesh) {
  if (mesh && mesh.visibility === 0.001) mesh.visibility = 0;
}

function hideBoundingBox(mesh) {
  mesh.showBoundingBox = false;
}

function resetChildMeshesOfAttachedMesh() {
  gizmoManager?.attachedMesh.getChildMeshes().forEach((child) => hideBoundingBox(child));
}

// Clears the attached mesh's box, except the orbited mesh's own box, which
// stays lit for as long as orbit view is centred on it — regardless of which
// tool is active or attached elsewhere. Safe to leave visible alongside a
// plain-coloured selection box: the per-box colour hook above means the two
// never share a colour just because they're both on screen at once.
function resetAttachedMesh() {
  if (!gizmoManager?.attachedMesh) return;
  if (!isOrbitedMesh(gizmoManager.attachedMesh)) {
    hideBoundingBox(gizmoManager.attachedMesh);
  }
  resetChildMeshesOfAttachedMesh();
}

function resetAttachedMeshIfMeshAttached() {
  if (gizmoManager?.attachedMesh) {
    resetAttachedMesh();
  }
}

// True when the mesh (or its root) belongs to a locked block.
function isMeshLocked(mesh) {
  if (!mesh) return false;
  const root = mesh.parent ? getRootMesh(mesh.parent) : mesh;
  return isBlockLocked(root && meshMap[root.metadata?.blockKey]);
}

// Nearest pickable, non-locked mesh under the given screen point. Used so a
// gizmo attaches to the visible/operable mesh (e.g. an unlocked duplicate)
// rather than a locked one coincident with it. Returns null if all hits are
// locked (so the caller can refuse).
function nearestUnlockedMesh(x, y) {
  const hits = flock.scene.multiPick(x, y, (m) => m.isPickable && m.name !== 'ground');
  if (!hits?.length) return null;
  hits.sort((a, b) => a.distance - b.distance);
  for (const h of hits) {
    if (h.pickedMesh && !isMeshLocked(h.pickedMesh)) return h.pickedMesh;
  }
  return null;
}

// Force the "no entry" cursor. Babylon re-applies its scene cursors on pointer
// move, so set those as well as the DOM cursor.
function showNotAllowedCursor() {
  const canvas = flock.canvas || flock.scene?.getEngine()?.getRenderingCanvas?.();
  if (flock.scene) {
    flock.scene.defaultCursor = 'not-allowed';
    flock.scene.hoverCursor = 'not-allowed';
  }
  document.body.style.cursor = 'not-allowed';
  if (canvas) canvas.style.cursor = 'not-allowed';
}

// Tools that mutate a mesh and must be refused on locked objects (transform,
// colour, delete). Select / view / duplicate stay allowed.
function blockedToolActive() {
  return [
    'positionButton',
    'rotationButton',
    'scaleButton',
    'colorPickerButton',
    'deleteButton',
  ].some((id) => document.getElementById(id)?.classList.contains('active'));
}

// If the currently attached mesh is locked, detach it (so a transform gizmo
// can't operate on it) and flag the no-entry cursor. The caller then falls
// through to its pick path so another mesh can still be chosen.
function detachIfAttachedMeshLocked() {
  const mesh = gizmoManager?.attachedMesh;
  if (mesh && isMeshLocked(mesh)) {
    showNotAllowedCursor();
    gizmoManager.attachToMesh(null);
    return true;
  }
  return false;
}

function attachMeshForActiveTool(pickedMesh) {
  if (!gizmoManager) return null;

  if (!pickedMesh || pickedMesh.name === 'ground') {
    gizmoManager.attachToMesh(null);
    return null;
  }

  if (pickedMesh.parent) {
    pickedMesh = getRootMesh(pickedMesh.parent);
  }

  const blockId = meshMap[pickedMesh?.metadata?.blockKey];
  if (blockId) {
    highlightBlockById(Blockly.getMainWorkspace(), blockId);
  }

  gizmoManager.attachToMesh(pickedMesh);

  return pickedMesh;
}

function eventIsOutOfCanvasBounds(event, canvasRect) {
  return (
    event.clientX < canvasRect.left ||
    event.clientX > canvasRect.right ||
    event.clientY < canvasRect.top ||
    event.clientY > canvasRect.bottom
  );
}

function watchClickAwayFromCanvas() {
  const canvas =
    flock.scene?.getEngine?.().getRenderingCanvas?.() ??
    document.getElementById('renderCanvas');
  if (!canvas) return;
  const onClickAway = (event) => {
    if (colorPicker?.isOpen) return;
    if (flock.scene?.activeCamera?.metadata?.orbitView) return;
    if (!document.querySelector('.gizmo-button.active:not(#cameraButton)')) return;
    if (!eventIsOutOfCanvasBounds(event, canvas.getBoundingClientRect())) return;
    exitGizmoState();
    gizmoManager?.attachToMesh(null);
  };
  const timer = setTimeout(() => window.addEventListener('click', onClickAway), 50);
  onExit(() => {
    clearTimeout(timer);
    window.removeEventListener('click', onClickAway);
  });
}

function deleteBlockWithUndo(blockId) {
  const workspace = Blockly.getMainWorkspace();
  const block = workspace.getBlockById(blockId);

  // Refuse to delete a mesh whose block is locked.
  if (block && isBlockLocked(block)) {
    showNotAllowedCursor();
    return;
  }

  if (!block) return;

  Blockly.Events.setGroup(true);
  try {
    const parentBlock = block.getParent();

    // Store reference to parent block before deletion
    let shouldCheckStartBlock = false;
    let startBlock = null;
    if (parentBlock && parentBlock.type === 'start') {
      startBlock = parentBlock;
      shouldCheckStartBlock = true;
    }

    // Delete the selected block
    block.dispose(true);

    // After deletion, check if the start block is now empty
    if (shouldCheckStartBlock && startBlock) {
      let remainingChildren = 0;

      // Count remaining input-connected blocks
      startBlock.inputList.forEach((input) => {
        if (input.connection && input.connection.targetBlock()) {
          remainingChildren++;
        }
      });

      // Check if the start block still has a next block
      if (startBlock.nextConnection && startBlock.nextConnection.targetBlock()) {
        remainingChildren++;
      }

      // If no children remain, delete the start block
      if (remainingChildren === 0) {
        startBlock.dispose(true);
      }
    }
  } finally {
    Blockly.Events.setGroup(false);
  }

  gizmoManager.attachToMesh(null);
  turnOffAllGizmos();
}

function getCanvasSelectedRoot() {
  let mesh = gizmoManager?.attachedMesh;
  if (!mesh || mesh.name === 'ground') return null;
  if (mesh.isDisposed?.()) return null;
  if (mesh.parent) mesh = getRootMesh(mesh.parent) ?? mesh;
  return mesh;
}

function isCanvasClipboardTypingTarget(e) {
  const t = e.target;
  if (!t) return false;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (t.isContentEditable) return true;
  if (Blockly.WidgetDiv?.isVisible?.() || Blockly.DropDownDiv?.isVisible?.()) return true;
  if (Blockly.getMainWorkspace?.()?.getInjectionDiv?.()?.contains(t)) return true;
  if (typeof t.closest === 'function' && t.closest('.blocklySvg, .blocklyToolbox')) {
    return true;
  }
  return false;
}

// Block the canvas shortcuts act on: gizmo-attached mesh first, then the
// Blockly selection, then window.currentBlock (e.g. set by View in canvas).
function resolveCanvasTargetBlock() {
  const workspace = Blockly.getMainWorkspace?.();
  if (!workspace) return null;
  const root = getCanvasSelectedRoot();
  if (root) {
    const blockKey = findParentWithBlockId(root)?.metadata?.blockKey;
    const block = blockKey != null && meshBlockIdMap[blockKey]
      ? workspace.getBlockById(meshBlockIdMap[blockKey])
      : null;
    if (block && !block.disposed) return block;
  }
  const selected = Blockly.common?.getSelected?.();
  if (selected instanceof Blockly.Block && !selected.disposed && !selected.isInFlyout) {
    return selected;
  }
  const current = window.currentBlock;
  if (current && !current.disposed && current.workspace === workspace) return current;
  return null;
}

function getBlockForCanvasRoot(root) {
  if (!root) return null;
  const workspace = Blockly.getMainWorkspace?.();
  if (!workspace) return null;
  const blockKey = findParentWithBlockId(root)?.metadata?.blockKey;
  const block = blockKey != null && meshBlockIdMap[blockKey]
    ? workspace.getBlockById(meshBlockIdMap[blockKey])
    : null;
  return block && !block.disposed ? block : null;
}

// Chain a freshly pasted/duplicated block after the selection. Covers stacks
// (next), statement inputs (empty, or prepend pushing existing children down)
// and empty value inputs — mirroring the workspace paste helper.
function connectPastedAfterSelection(workspace, targetBlock, pastedBlock) {
  if (!workspace || !targetBlock || targetBlock.disposed || !pastedBlock || pastedBlock.disposed) {
    return false;
  }
  if (chainBlockAfter(workspace, targetBlock, pastedBlock)) return true;
  const checker = workspace.getConnectionChecker
    ? workspace.getConnectionChecker()
    : new Blockly.ConnectionChecker();
  const can = (a, b) => checker.canConnect(a, b, false);
  if (pastedBlock.previousConnection) {
    for (const input of targetBlock.inputList ?? []) {
      if (
        input.type === Blockly.NEXT_STATEMENT &&
        input.connection &&
        !input.connection.targetBlock() &&
        can(input.connection, pastedBlock.previousConnection)
      ) {
        input.connection.connect(pastedBlock.previousConnection);
        return true;
      }
    }
    const isTopLevel = !targetBlock.previousConnection && !targetBlock.nextConnection;
    if (isTopLevel) {
      for (const input of targetBlock.inputList ?? []) {
        if (input.type !== Blockly.NEXT_STATEMENT || !input.connection) continue;
        const firstChild = input.connection.targetBlock();
        if (!firstChild || !can(input.connection, pastedBlock.previousConnection)) continue;
        let lastPasted = pastedBlock;
        while (lastPasted.nextConnection?.targetBlock?.()) {
          lastPasted = lastPasted.nextConnection.targetBlock();
        }
        if (
          !lastPasted.nextConnection ||
          !firstChild.previousConnection ||
          !can(lastPasted.nextConnection, firstChild.previousConnection)
        ) {
          continue;
        }
        input.connection.disconnect();
        input.connection.connect(pastedBlock.previousConnection);
        lastPasted.nextConnection.connect(firstChild.previousConnection);
        return true;
      }
    }
  }
  if (pastedBlock.outputConnection) {
    for (const input of targetBlock.inputList ?? []) {
      if (
        input.type === Blockly.INPUT_VALUE &&
        input.connection &&
        !input.connection.targetBlock() &&
        can(input.connection, pastedBlock.outputConnection)
      ) {
        input.connection.connect(pastedBlock.outputConnection);
        return true;
      }
    }
  }
  return false;
}

// A pasted stack block with no selection and no anchor gets its own start
// block, matching how object blocks are added from the canvas.
function ensureStartWrapper(workspace, block) {
  if (!workspace || !block || block.disposed) return null;
  if (!block.previousConnection || block.previousConnection.isConnected()) return null;
  if (block.getParent?.()) return null;
  let startBlock = null;
  try {
    startBlock = Blockly.serialization.blocks.append({ type: 'start' }, workspace);
  } catch {
    return null;
  }
  const conn = startBlock?.getInput?.('DO')?.connection;
  if (conn && block.previousConnection && !conn.targetBlock?.()) {
    try {
      conn.connect(block.previousConnection);
    } catch {
      // Leave the block loose rather than failing the paste.
    }
  }
  return startBlock;
}

// Shift+D: snapshot the target, strip its next stack, and chain the copy
// after the original.
function duplicateCanvasTargetInPlace(target) {
  const workspace = Blockly.getMainWorkspace?.();
  if (!workspace || !target || target.disposed) return false;
  let snapshot;
  try {
    snapshot = Blockly.serialization.blocks.save(target, { includeShadows: true });
  } catch {
    return false;
  }
  if (!snapshot) return false;
  if (snapshot.next) delete snapshot.next;
  const root = getCanvasSelectedRoot();
  let pastePos = null;
  try {
    const meshForPos = root && getBlockForCanvasRoot(root) === target
      ? root
      : getMeshFromBlock(target);
    pastePos = meshForPos ? flock.getBlockPositionFromMesh(meshForPos) : null;
  } catch {
    pastePos = null;
  }
  Blockly.Events.setGroup('duplicate');
  let newBlock = null;
  try {
    newBlock = insertBlockSnapshot(snapshot, workspace, pastePos, target);
    if (newBlock && !newBlock.getParent?.()) {
      connectPastedAfterSelection(workspace, target, newBlock);
    }
  } catch {
    newBlock = null;
  } finally {
    Blockly.Events.setGroup(false);
  }
  if (!newBlock) return false;
  highlightBlockById(workspace, newBlock);
  selectMeshForBlock(newBlock);
  return true;
}

export function copyCanvasSelection() {
  const mesh = getCanvasSelectedRoot();
  if (!mesh) return false;
  const blockKey = findParentWithBlockId(mesh)?.metadata?.blockKey;
  const workspace = Blockly.getMainWorkspace?.();
  const block = meshBlockIdMap[blockKey] ? workspace?.getBlockById(meshBlockIdMap[blockKey]) : null;
  if (!block || block.disposed) return false;
  let snapshot;
  try {
    snapshot = Blockly.serialization.blocks.save(block, { includeShadows: true });
  } catch {
    return false;
  }
  if (snapshot?.next) delete snapshot.next;
  const pos = flock.getBlockPositionFromMesh(mesh);
  canvasClipboard = {
    snapshot,
    blockId: block.id,
    anchor: captureStackAnchor(block),
    x: pos.x,
    y: pos.y,
    z: pos.z,
  };
  return true;
}

export function cutCanvasSelection() {
  const mesh = getCanvasSelectedRoot();
  if (!mesh) return false;
  const blockKey = findParentWithBlockId(mesh)?.metadata?.blockKey;
  const blockId = meshBlockIdMap[blockKey];
  if (!blockId || !copyCanvasSelection()) return false;
  deleteBlockWithUndo(blockId);
  return true;
}

export function pasteCanvasClipboard() {
  const workspace = Blockly.getMainWorkspace?.();
  if (!workspace) return false;
  const root = getCanvasSelectedRoot();
  const canvasBlock = getBlockForCanvasRoot(root);
  const blocklySelected = Blockly.common?.getSelected?.();
  const blocklyBlock =
    blocklySelected instanceof Blockly.Block && !blocklySelected.disposed && !blocklySelected.isInFlyout
      ? blocklySelected
      : null;
  const selectionBlock = canvasBlock ?? blocklyBlock ?? null;

  // Canvas copy/cut buffer first; otherwise fall back to the Blockly
  // clipboard (e.g. copied in the code view, pasted on the canvas).
  if (canvasClipboard?.snapshot) {
    const pastePos = root
      ? flock.getBlockPositionFromMesh(root)
      : { x: canvasClipboard.x, y: canvasClipboard.y, z: canvasClipboard.z };
    const source = canvasClipboard.blockId ? workspace.getBlockById(canvasClipboard.blockId) : null;
    const sourceAlive = source && !source.disposed ? source : null;
    // Prefer the live selection over the copy source, so copy A → select B →
    // paste lands after B. Without a selection, keep cut/paste restoring its
    // anchor, or copy/paste chaining after its source.
    const afterBlock = selectionBlock ?? sourceAlive ?? null;
    Blockly.Events.setGroup('duplicate');
    let newBlock = null;
    try {
      newBlock = insertBlockSnapshot(
        canvasClipboard.snapshot,
        workspace,
        pastePos,
        // insertBlockSnapshot only chains stacks; pass nothing when a
        // statement/value connect or anchor reattach will handle it, so a
        // start-block selection isn't skipped over.
        afterBlock?.nextConnection ? afterBlock : null
      );
      if (newBlock) {
        let connected = !!newBlock.getParent?.();
        if (!connected && !sourceAlive && canvasClipboard.anchor) {
          connected = !!reattachBlockToAnchor(workspace, newBlock, canvasClipboard.anchor);
        }
        if (!connected && afterBlock && afterBlock !== newBlock) {
          connected = connectPastedAfterSelection(workspace, afterBlock, newBlock) || connected;
        }
        if (!connected && !selectionBlock && !canvasClipboard.anchor) {
          ensureStartWrapper(workspace, newBlock);
        }
      }
    } catch {
      return false;
    } finally {
      Blockly.Events.setGroup(false);
    }
    if (!newBlock) return false;
    highlightBlockById(workspace, newBlock);
    selectMeshForBlock(newBlock);
    return true;
  }

  const data = Blockly.clipboard?.getLastCopiedData?.();
  if (!data) return false;
  if (data.blockState) stripLockState(data.blockState);
  Blockly.Events.setGroup('duplicate');
  let pasted = null;
  try {
    pasted = Blockly.clipboard.paste(data, workspace);
    const pb = Array.isArray(pasted) ? pasted[0] : pasted;
    if (!pb) return false;
    pasted = pb;
    let connected = !!pasted.getParent?.();
    if (!connected && selectionBlock && selectionBlock !== pasted) {
      connected = connectPastedAfterSelection(workspace, selectionBlock, pasted) || connected;
    }
    if (!connected && !selectionBlock) {
      ensureStartWrapper(workspace, pasted);
    }
  } catch {
    return false;
  } finally {
    Blockly.Events.setGroup(false);
  }
  if (!pasted) return false;
  highlightBlockById(workspace, pasted);
  selectMeshForBlock(pasted);
  return true;
}

export function getCanvasClipboard() {
  if (!canvasClipboard) return null;
  return {
    blockId: canvasClipboard.blockId,
    anchor: canvasClipboard.anchor ? { ...canvasClipboard.anchor } : null,
    x: canvasClipboard.x,
    y: canvasClipboard.y,
    z: canvasClipboard.z,
    snapshot: JSON.parse(JSON.stringify(canvasClipboard.snapshot)),
  };
}

export function clearCanvasClipboard() {
  canvasClipboard = null;
}

// Attach the gizmo/bounding box to the mesh for a just-created block, once its
// mesh exists. Blockly fires the create event synchronously but the
// corresponding mesh is built asynchronously (see applyLiveRotationWhenReady
// in ui/addmenu.js for the same pattern), so poll a few frames for it.
export function selectMeshForBlock(newBlock) {
  if (!gizmoManager) return;
  let attempts = 0;
  const tryAttach = () => {
    if (!newBlock || newBlock.disposed) return;
    const key = getBlockKeyFromBlock(newBlock);
    let mesh = (key ? getMeshFromBlockKey(key) : null) || getMeshFromBlock(newBlock);
    if (mesh) {
      if (mesh.parent) mesh = getRootMesh(mesh.parent) ?? mesh;
      gizmoManager.attachToMesh(mesh);
      enableBoundingBox(mesh);
      return;
    }
    attempts += 1;
    if (attempts < 20) requestAnimationFrame(tryAttach);
  };
  requestAnimationFrame(tryAttach);
}

// Reframe the free/fly camera directly on the mesh. Only valid when no
// follow camera is active — focusOnMesh() below routes to
// movePlayerToFaceMesh() instead whenever one is.
function frameFreeCameraOnMesh(mesh) {
  applyMeshSelection(mesh);

  mesh.computeWorldMatrix(true);
  const { min, max } = mesh.getHierarchyBoundingVectors(true);
  const newTarget = flock.BABYLON.Vector3.Center(min, max);

  const camera = flock.scene.activeCamera;
  const currentDistance = camera.radius || 10;
  const currentYPosition = camera.position.y;

  camera.position = new flock.BABYLON.Vector3(
    newTarget.x,
    currentYPosition,
    newTarget.z - currentDistance
  );
  camera.setTarget(newTarget);
}

// Move the followed player to face the mesh, keeping the camera attached to
// the player throughout — unlike orbit view, which detaches the camera onto
// its own free-floating ArcRotateCamera.
function movePlayerToFaceMesh(mesh, camera) {
  const BABYLON = flock.BABYLON;
  const player = camera.metadata.following;

  mesh.computeWorldMatrix(true);
  const { min, max } = mesh.getHierarchyBoundingVectors(true);
  const target = BABYLON.Vector3.Center(min, max);

  const size = max.subtract(min);
  const extent = Math.max(size.x, size.y, size.z);

  const playerY = player.position.y;
  const playerDistance = Math.max(extent * 2, 4);

  // Try a few candidate directions around the mesh.
  const candidateAngles = [
    -Math.PI / 2,
    0,
    Math.PI / 2,
    Math.PI,
    -Math.PI / 4,
    Math.PI / 4,
    (3 * Math.PI) / 4,
    (-3 * Math.PI) / 4,
  ];

  let chosenPlayerPos = null;
  let chosenYaw = null;

  const scene = flock.scene;
  const ignoreSet = new Set([mesh, player]);
  mesh.getChildMeshes?.(false).forEach((m) => ignoreSet.add(m));
  player.getChildMeshes?.(false).forEach((m) => ignoreSet.add(m));

  function isBlockingMesh(hitMesh) {
    if (!hitMesh) return false;
    if (ignoreSet.has(hitMesh)) return false;
    if (hitMesh.name === 'ground') return false;
    if (!hitMesh.isEnabled?.()) return false;
    if (!hitMesh.isVisible) return false;
    return hitMesh.isPickable !== false;
  }

  function getYawToTarget(fromPos, toPos) {
    const dir = toPos.subtract(fromPos);
    return Math.atan2(dir.x, dir.z);
  }

  function hasClearView(playerPos, yaw) {
    // Camera behind player, looking towards player/mesh.
    const testRadius = Math.max(extent / 2, 5);
    const testBeta = Math.PI / 3;

    // For ArcRotateCamera around player:
    // x offset = radius * cos(alpha) * sin(beta)
    // z offset = radius * sin(alpha) * sin(beta)
    // To put camera behind player relative to yaw:
    const alpha = -yaw - Math.PI / 2;

    const camPos = new BABYLON.Vector3(
      playerPos.x + testRadius * Math.cos(alpha) * Math.sin(testBeta),
      playerPos.y + testRadius * Math.cos(testBeta),
      playerPos.z + testRadius * Math.sin(alpha) * Math.sin(testBeta)
    );

    const direction = target.subtract(camPos);
    const length = direction.length();
    if (length < 0.001) return true;

    const ray = new BABYLON.Ray(camPos, direction.normalize(), length);
    const hit = scene.pickWithRay(ray, (candidate) => isBlockingMesh(candidate));
    return !hit?.hit;
  }

  for (const angle of candidateAngles) {
    const playerPos = new BABYLON.Vector3(
      target.x - Math.cos(angle) * playerDistance,
      playerY,
      target.z - Math.sin(angle) * playerDistance
    );

    const yaw = getYawToTarget(playerPos, target);

    if (hasClearView(playerPos, yaw)) {
      chosenPlayerPos = playerPos;
      chosenYaw = yaw;
      break;
    }

    if (!chosenPlayerPos) {
      chosenPlayerPos = playerPos;
      chosenYaw = yaw;
    }
  }

  if (!chosenPlayerPos) return;

  const PLAYER_FORWARD_OFFSET = Math.PI;
  const playerRotation = BABYLON.Quaternion.FromEulerAngles(
    0,
    chosenYaw + PLAYER_FORWARD_OFFSET,
    0
  );

  player.position.copyFrom(chosenPlayerPos);
  player.rotationQuaternion = playerRotation;

  if (isBodyAlive(player.physics)) {
    player.physics.setTargetTransform(chosenPlayerPos, playerRotation);
  }

  // Keep camera following player, but place it behind the player.
  if ('lockedTarget' in camera) {
    camera.lockedTarget = player;
  }

  camera.beta = Math.PI / 2;
  camera.radius = Math.max(extent / 2, 5);

  // Behind player relative to the direction the player is facing toward the mesh.
  camera.alpha = -chosenYaw - Math.PI / 2;
}

// Focus on a mesh: when a follow camera is active, moves the followed player
// to face it (camera stays attached); otherwise reframes the free camera on
// it directly. Resolves the mesh from `block` when given (context menu),
// else from the current gizmo selection (keyboard shortcut).
export function focusOnMesh(block) {
  let mesh;
  if (block) {
    mesh = getMeshFromBlock(block);
    if (mesh?.name === 'ground') mesh = null;
  } else {
    mesh = gizmoManager.attachedMesh;
    if (mesh?.name === 'ground') mesh = null;
    if (!mesh && window.currentBlock) {
      mesh = getMeshFromBlock(window.currentBlock);
      if (mesh?.name === 'ground') mesh = null;
    }
  }
  if (!mesh) return;

  // Orbit view owns the camera while active; drop out of it first so the
  // following/free-camera check below runs against the camera orbit was
  // covering for, instead of mutating the orbit camera directly (which would
  // desync window.orbitMesh and its disposal observer from what's on screen).
  let camera = flock.scene.activeCamera;
  if (camera?.metadata?.orbitView) {
    disconnectOrbitView();
    camera = flock.scene.activeCamera;
    if (camera?.metadata?.orbitView) return; // no valid camera to restore
  }

  if (camera?.metadata?.following) {
    movePlayerToFaceMesh(mesh, camera);
    return;
  }

  frameFreeCameraOnMesh(mesh);
}

function applyMeshSelection(pickedMesh, pickedPoint) {
  if (pickedMesh && pickedMesh.name !== 'ground') {
    if (pickedMesh.parent) {
      pickedMesh = getRootMesh(pickedMesh.parent);
      pickedMesh.visibility = 0.001;
    }
    const block = meshMap[pickedMesh?.metadata?.blockKey];
    highlightBlockById(Blockly.getMainWorkspace(), block);
    gizmoManager.attachToMesh(pickedMesh);
    enableBoundingBox(pickedMesh);
    return;
  }

  if (pickedMesh && pickedMesh.name === 'ground') {
    showStatus(positionStatus(pickedPoint), { duration: 10, owner: 'position-readout' });
  }
  if (gizmoManager.attachedMesh) {
    resetChildMeshesOfAttachedMesh();
    gizmoManager.attachToMesh(null);
  }
}

export function viewMeshWithCamera(block) {
  let mesh;
  if (block) {
    mesh = getMeshFromBlock(block);
    if (mesh?.name === 'ground') mesh = null;
  } else {
    mesh = gizmoManager.attachedMesh;
    if (mesh?.name === 'ground') mesh = null;
    if (!mesh && window.currentBlock) {
      mesh = getMeshFromBlock(window.currentBlock);
      if (mesh?.name === 'ground') mesh = null;
    }
  }

  const camera = flock.scene.activeCamera;
  if (camera?.metadata?.orbitView) {
    // Toggle off on the orbited mesh; switch target on a different one.
    if (!block || mesh === window.orbitMesh) {
      disconnectOrbitView();
      return;
    }
    disconnectOrbitView(); // switch target — disconnect first, then fall through
    // If disconnect failed (orbit camera still active), don't attach a new one on top
    if (flock.scene.activeCamera?.metadata?.orbitView) {
      return;
    }
  }
  if (mesh) attachOrbitView(mesh);
}

// Attach an ArcRotateCamera that orbits the given mesh (free-camera mode only).
function attachOrbitView(mesh) {
  const BABYLON = flock.BABYLON;
  const scene = flock.scene;
  // Orbit owns the camera, so drop out of fly mode before capturing the
  // camera to orbit from — otherwise it would orbit from the fly camera.
  if (cameraMode === 'fly') handleCameraGizmo();
  const freeCamera = scene.activeCamera;
  if (!freeCamera) return;

  // Orbit target and gizmo selection are independent.
  applyMeshSelection(mesh);
  const selectedMesh = gizmoManager.attachedMesh ?? mesh;

  mesh.computeWorldMatrix(true);
  const { min, max } = mesh.getHierarchyBoundingVectors(true);
  const target = BABYLON.Vector3.Center(min, max);
  const size = max.subtract(min);
  const extent = Math.max(size.x, size.y, size.z);
  const radius = Math.max(extent * 3, 8);

  const orbitCamera = new BABYLON.ArcRotateCamera(
    'orbitViewCamera',
    -Math.PI / 2, // alpha: front framing
    Math.PI / 2.5, // beta: slightly above
    radius,
    target,
    scene
  );
  // Unconstrained beta; no chase/zoom constraints.
  orbitCamera.lowerBetaLimit = null;
  orbitCamera.upperBetaLimit = null;
  orbitCamera.allowUpsideDown = true;
  orbitCamera.lowerRadiusLimit = null;
  orbitCamera.upperRadiusLimit = null;
  orbitCamera.minZ = 0.1;
  orbitCamera.wheelDeltaPercentage = 0.01;
  // Rotation comes from CameraControls via the InputManager, so drop Babylon's
  // keyboard input to keep physical arrows on a single path.
  orbitCamera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
  // Tag so orbit is recognised. Pointer attach stays off in orbit-only mode.
  orbitCamera.metadata = {
    orbitView: true,
    prevPointerAttach: gizmoManager.usePointerToAttachGizmos,
  };
  gizmoManager.usePointerToAttachGizmos = false;

  orbitSavedCamera = freeCamera;
  freeCamera.detachControl();
  scene.activeCamera = orbitCamera;
  // Orbit-view keys (WASD/arrows) are read straight off the physical keyboard
  // by CameraControls, same as fly mode — the project shouldn't see them too.
  flock.inputManager?.setInputOwner('editor');
  const canvas = scene.getEngine().getRenderingCanvas();
  if (canvas) {
    orbitCamera.attachControl(canvas, false);
    canvas.focus();
  }

  // Only disposing the orbited mesh exits orbit on its own.
  if (orbitDisposeObserver && orbitDisposeMesh) {
    orbitDisposeMesh.onDisposeObservable.remove(orbitDisposeObserver);
    orbitDisposeObserver = null;
    orbitDisposeMesh = null;
  }
  orbitDisposeMesh = selectedMesh;
  if (selectedMesh?.onDisposeObservable) {
    orbitDisposeObserver = selectedMesh.onDisposeObservable.add(() => {
      disconnectOrbitView();
    });
  }
  window.orbitViewActive = true;
  window.orbitBlock = window.currentBlock ?? null;
  window.orbitMesh = selectedMesh;
  setGizmoButtonActive(document.getElementById('eyeButton'), true);
  watchEyeGizmoRetarget();
}

// Restore the stashed free camera, disposing the orbit camera. Does not
// attach control to the restored camera (caller decides).
function restoreFreeCameraFromOrbit() {
  const scene = flock.scene;
  const orbitCamera = scene.activeCamera;
  if (!orbitCamera?.metadata?.orbitView) return;

  const freeCamera = orbitSavedCamera;
  // Without a valid camera to fall back to, disposing the orbit camera would
  // leave scene.activeCamera pointing at a disposed camera. Stay put instead.
  if (!freeCamera || freeCamera.isDisposed()) return false;

  if (orbitViewObserver) {
    try {
      gizmoManager.onAttachedToMeshObservable.remove(orbitViewObserver);
    } catch {
      // Already gone.
    }
    orbitViewObserver = null;
  }
  if (orbitDisposeObserver && orbitDisposeMesh) {
    try {
      orbitDisposeMesh.onDisposeObservable.remove(orbitDisposeObserver);
    } catch {
      // Already disposed.
    }
    orbitDisposeObserver = null;
    orbitDisposeMesh = null;
  }

  // Restore pointer-to-attach to whatever it was before orbit-view.
  gizmoManager.usePointerToAttachGizmos = orbitCamera.metadata.prevPointerAttach ?? true;

  orbitSavedCamera = null;
  orbitCamera.detachControl();
  scene.activeCamera = freeCamera;
  orbitCamera.dispose();
  return true;
}

// Standard orbit-view exit: return to the free camera.
function disconnectOrbitView() {
  const prevMesh = window.orbitMesh;
  // Scene gone (disposal path): wipe all orbit globals so stale state never
  // persists across a scene reset, even though no camera restore is possible.
  if (!flock.scene?.activeCamera?.metadata?.orbitView) {
    flock.inputManager?.setInputOwner('project');
    window.orbitViewActive = false;
    window.orbitBlock = null;
    window.orbitMesh = null;
    clearOrbitRetargetObserver();
    if (orbitDisposeObserver && orbitDisposeMesh) {
      try {
        orbitDisposeMesh.onDisposeObservable.remove(orbitDisposeObserver);
      } catch {
        // Already disposed.
      }
      orbitDisposeObserver = null;
      orbitDisposeMesh = null;
    }
    setGizmoButtonActive(document.getElementById('eyeButton'), false);
    return;
  }
  // Orbit camera is active — attempt a real restore. If orbitSavedCamera is
  // missing or disposed restoreFreeCameraFromOrbit returns false; in that case
  // leave all state intact so the caller can see the system is still "stuck"
  // in orbit rather than silently desynchronising flags from camera state.
  if (!restoreFreeCameraFromOrbit()) return;
  flock.inputManager?.setInputOwner('project');
  window.orbitViewActive = false;
  window.orbitBlock = null;
  window.orbitMesh = null;
  clearOrbitRetargetObserver();
  setGizmoButtonActive(document.getElementById('eyeButton'), false);
  // Re-attach the orbit target only when nothing else is selected.
  if (!gizmoManager.attachedMesh && prevMesh && !prevMesh.isDisposed?.()) {
    gizmoManager.attachToMesh(prevMesh);
    enableBoundingBox(prevMesh);
  } else if (
    prevMesh &&
    prevMesh !== gizmoManager.attachedMesh &&
    !prevMesh.isDisposed?.()
  ) {
    // The transform gizmo was retargeted elsewhere while orbiting (see the
    // click-retarget observer below), which keeps prevMesh's box on for as
    // long as it's still the orbit target. Orbit is ending on it now — since
    // nothing else references prevMesh, its box would otherwise be left on
    // indefinitely.
    hideBoundingBox(prevMesh);
  }
  const canvas = flock.scene.getEngine().getRenderingCanvas();
  if (canvas) {
    flock.scene.activeCamera?.attachControl(canvas, false);
    // canvas.focus() is intentionally omitted here — callers that need to
    // hand focus back to the canvas (e.g. eye toggle-off) do so explicitly,
    // so that focusin doesn't fire while no gizmo button is active and
    // accidentally close the gizmo overlay.
  }
}

function getScaledSize(mesh) {
  let { originalMin, originalMax } = mesh.metadata || {};
  // Empty container (e.g. a group): size lives in the children. Cache it
  // like flock.resize() does rather than re-measuring every call.
  if ((!originalMin || !originalMax) && mesh.getTotalVertices() === 0) {
    const bounds = flock.getHierarchyLocalBounds(mesh);
    mesh.metadata = mesh.metadata || {};
    mesh.metadata.originalMin = bounds.min.clone();
    mesh.metadata.originalMax = bounds.max.clone();
    originalMin = mesh.metadata.originalMin;
    originalMax = mesh.metadata.originalMax;
  }
  const min = originalMin ?? mesh.getBoundingInfo().boundingBox.minimum;
  const max = originalMax ?? mesh.getBoundingInfo().boundingBox.maximum;

  const baseX = max.x - min.x;
  const baseY = max.y - min.y;
  const baseZ = max.z - min.z;

  return {
    x: baseX * Math.abs(mesh.scaling.x),
    y: baseY * Math.abs(mesh.scaling.y),
    z: baseZ * Math.abs(mesh.scaling.z),
  };
}

// During a live scale-gizmo drag a primitive's geometry stays at its creation
// size while mesh.scaling stretches it, which stretches the texture. Re-run the
// size-based UV mapping with the current scaling folded in (plus the scaled
// world dimensions) so the tile size stays constant in world units — matching
// what the mesh looks like after the block updates and the program re-runs.
// Delegates to flock.retilePrimitiveUVs so the gizmo and resize() stay in sync.
function retilePrimitiveUVsForScale(mesh) {
  if (!mesh) return;
  const size = getScaledSize(mesh); // world dimensions = local size * scaling
  flock.retilePrimitiveUVs(mesh, { width: size.x, height: size.y, depth: size.z }, mesh.scaling);
}

// Clean up gizmo state if aborted
export function exitGizmoState(options = {}) {
  const { preserveOrbit = false } = options ?? {};
  if (!preserveOrbit) {
    disconnectOrbitView();
  }
  duplicateModeActive = false;
  clearStatus('duplicate-place');
  if (duplicateRafId !== null) {
    cancelAnimationFrame(duplicateRafId);
    duplicateRafId = null;
  }

  cleanupScenePick(); // Stop picking

  // Properly clean up if duplicating
  if (activeDuplicatePickTimer !== null) {
    clearTimeout(activeDuplicatePickTimer);
    activeDuplicatePickTimer = null;
  }
  if (activeDuplicatePickHandler) {
    window.removeEventListener('click', activeDuplicatePickHandler);
    activeDuplicatePickHandler = null;
  }

  // Stop the axis keyboard
  stopAxisKeyboard?.();
  stopAxisKeyboard = null;
  clearStatus('axis');
  clearStatus('camera');
  if (!preserveOrbit) clearStatus('eye-gizmo');
  clearStatus('color-picker');
  // The readout belongs to the tool that took it; the next tool doesn't move it.
  clearStatus('position-readout');
  clearStatus('gizmo-controls-hint');

  // Run all queued cleanup functions
  runCleanups();

  // Orbit stays lit alongside a compatible tool.
  document
    .querySelectorAll('.gizmo-button')
    .forEach((btn) => {
      if (preserveOrbit && btn.id === 'eyeButton') return;
      setGizmoButtonActive(btn, false);
    });
  if (preserveOrbit) setGizmoButtonActive(document.getElementById('eyeButton'), true);
  // The fly camera is a mode, not a tool: it stays on alongside whichever tool
  // is picked next, so its button keeps reporting that.
  setGizmoButtonActive(document.getElementById('cameraButton'), cameraMode === 'fly');
  disableGizmos();
  document.body.style.cursor = 'default';
}

// Start the keyboard handler for moving a mesh
function startMoveKeyboardHandler(mesh, savedHudAxis = null, onHudAxisSaved = null) {
  const initialKeyboardAxis = stopAxisKeyboard?.getAxis?.() ?? null;
  document.body.style.cursor = 'default';
  cleanupScenePick();
  stopAxisKeyboard?.();
  stopAxisKeyboard = null;

  const onMove = (dx, dy, dz) => {
    mesh.position.x += dx;
    mesh.position.y += dy;
    mesh.position.z += dz;
    mesh.computeWorldMatrix(true);
    const block = meshMap[mesh?.metadata?.blockKey];

    // One event group per nudge so the moved mesh's block and any parented
    // children's blocks revert together as a single undo.
    const groupId = Blockly.utils.idGenerator.genUid();
    Blockly.Events.setGroup(groupId);
    try {
      if (block && !block.disposed) {
        const pos = flock.getBlockPositionFromMesh(mesh);
        setBlockXYZ(block, pos.x, pos.y, pos.z);
      }
      updateChildBlockPositions(mesh);
    } finally {
      Blockly.Events.setGroup(false);
    }
  };
  const onConfirm = () => {
    exitTransformState();
    document.getElementById('positionButton')?.focus();
  };
  const onCancel = () => {
    exitTransformState();
    // Deselect so you get [select mesh] for next tool
    gizmoManager.attachToMesh(null);
    document.getElementById('positionButton')?.focus();
  };

  stopAxisKeyboard = createAdaptiveInput({
    onMove,
    onConfirm,
    onCancel,
    stepNormal: DEFAULT_CURSOR,
    stepFast: FAST_CURSOR,
    mode: 'arrows',
    stepLabels: ['-', '+'],
    onAxisChange: (axis) => {
      onHudAxisSaved?.(axis);
      highlightGizmoAxis(gizmoManager.gizmos?.positionGizmo, axis);
    },
    onHudHide: () => highlightGizmoAxis(gizmoManager.gizmos?.positionGizmo, null),
    initialKeyboardAxis,
    initialHudAxis: savedHudAxis,
  });
}

// Rotate a mesh using the keyboard
function startRotateKeyboardHandler(mesh, savedHudAxis = null, onHudAxisSaved = null) {
  const initialKeyboardAxis = stopAxisKeyboard?.getAxis?.() ?? null;
  document.body.style.cursor = 'default';
  cleanupScenePick();
  stopAxisKeyboard?.();
  stopAxisKeyboard = null;

  const rotateBlock =
    mesh?.metadata?.shapeType === 'Group' ? null : findOrCreateRotateBlock(mesh);
  if (rotateBlock) {
    highlightBlockById(Blockly.getMainWorkspace(), rotateBlock);
  } else {
    const blockKey = mesh?.metadata?.blockKey;
    const creationBlock = blockKey ? meshMap[blockKey] : null;
    if (creationBlock) highlightBlockById(Blockly.getMainWorkspace(), creationBlock);
  }

  // Track rotation as Euler degrees (the block's representation), not
  // quaternion increments: a single-axis drag then changes only that axis,
  // and each axis stays a WORLD-axis rotation like the drag arcs, matching
  // exactly what rotate_to applies.
  const working = (() => {
    const e = getMeshRotationInDegrees(mesh);
    return { x: e.x, y: e.y, z: e.z };
  })();
  const axisInput = { x: 'X', y: 'Y', z: 'Z' };
  // The mouse gizmo rotates the mesh without touching `working`; re-seed
  // from the mesh on divergence so the next slider touch doesn't jump.
  const syncWorkingToMesh = () => {
    if (!mesh.rotationQuaternion) return;
    const q = flock.BABYLON.Quaternion.RotationYawPitchRoll(
      flock.BABYLON.Tools.ToRadians(working.y),
      flock.BABYLON.Tools.ToRadians(working.x),
      flock.BABYLON.Tools.ToRadians(working.z)
    );
    if (Math.abs(flock.BABYLON.Quaternion.Dot(q, mesh.rotationQuaternion)) < 0.99999) {
      const e = getMeshRotationInDegrees(mesh);
      working.x = e.x;
      working.y = e.y;
      working.z = e.z;
    }
  };
  const onMove = (dx, dy, dz) => {
    syncWorkingToMesh();
    const deltas = { x: dx, y: dy, z: dz };
    const changedAxes = [];
    for (const axisKey of ['x', 'y', 'z']) {
      if (deltas[axisKey]) {
        working[axisKey] += flock.BABYLON.Tools.ToDegrees(deltas[axisKey]);
        changedAxes.push(axisKey);
      }
    }
    mesh.rotationQuaternion = flock.BABYLON.Quaternion.RotationYawPitchRoll(
      flock.BABYLON.Tools.ToRadians(working.y),
      flock.BABYLON.Tools.ToRadians(working.x),
      flock.BABYLON.Tools.ToRadians(working.z)
    );
    // Groups keep orientation in their members, never on the group node.
    if (mesh?.metadata?.shapeType === 'Group') updateChildBlockRotations(mesh);
    if (isBodyAlive(mesh.physics)) {
      mesh.physics.disablePreStep = false;
      mesh.physics.setTargetTransform(mesh.absolutePosition, mesh.rotationQuaternion);
    }
    if (rotateBlock && !rotateBlock.disposed) {
      for (const axisKey of changedAxes) {
        setBlockAxisValue(rotateBlock, axisInput[axisKey], working[axisKey]);
      }
    }
  };
  const onConfirm = () => {
    exitTransformState();
    document.getElementById('rotationButton')?.focus();
  };
  const onCancel = () => {
    exitTransformState();
    gizmoManager.attachToMesh(null);
    document.getElementById('rotationButton')?.focus();
  };

  const getValues = () => {
    syncWorkingToMesh();
    return { ...working };
  };
  stopAxisKeyboard = createAdaptiveInput({
    onMove,
    onConfirm,
    onCancel,
    stepNormal: DEFAULT_ROTATION,
    stepFast: FAST_ROTATION,
    mode: 'slider',
    getValues,
    onHudHide: () => highlightGizmoAxis(gizmoManager.gizmos?.rotationGizmo, null),
    onAxisChange: (axis) => {
      onHudAxisSaved?.(axis);
      highlightGizmoAxis(gizmoManager.gizmos?.rotationGizmo, axis);
    },
    initialKeyboardAxis,
    initialHudAxis: savedHudAxis,
  });
}

// Scale a mesh using the keyboard. Defaults to uniform (=) so the first
// arrow press scales all axes; the user can then pick X/Y/Z if needed.
function startScaleKeyboardHandler(mesh, savedHudAxis = null, onHudAxisSaved = null) {
  const carriedAxis = stopAxisKeyboard?.getAxis?.() ?? null;
  const defaultAxis = savedHudAxis ?? carriedAxis ?? 'all';
  document.body.style.cursor = 'default';
  cleanupScenePick();
  stopAxisKeyboard?.();
  stopAxisKeyboard = null;

  const creationBlock = meshMap[mesh?.metadata?.blockKey];
  if (creationBlock) {
    if (creationBlock.type === 'create_group') {
      highlightBlockById(Blockly.getMainWorkspace(), creationBlock);
    } else if (RESIZE_BLOCK_TYPES.has(creationBlock.type)) {
      const existingResize = findExistingResizeBlock(mesh);
      highlightBlockById(Blockly.getMainWorkspace(), existingResize ?? creationBlock);
    } else {
      highlightBlockById(Blockly.getMainWorkspace(), creationBlock);
    }
  }
  if (mesh?.metadata?.shapeType === 'Group') {
    healGroupOrigin(mesh);
    cacheGroupScaleBaseline(mesh);
  }

  const isRadial = RADIAL_BLOCK_TYPES.has(creationBlock?.type);

  const onMove = (dx, dy, dz) => {
    // Round shapes scale their diameter: either horizontal button changes both.
    if (isRadial) {
      const diameterStep = dx || dz;
      dx = diameterStep;
      dz = diameterStep;
    }

    // Scale about the members' true center, never a drifted origin.
    if (mesh?.metadata?.shapeType === 'Group') healGroupOrigin(mesh);

    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo();
    const bottomY = mesh.getBoundingInfo().boundingBox.minimumWorld.y;

    mesh.scaling.x = Math.max(0.01, mesh.scaling.x + dx);
    mesh.scaling.y = Math.max(0.01, mesh.scaling.y + dy);
    mesh.scaling.z = Math.max(0.01, mesh.scaling.z + dz);

    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo();
    mesh.position.y += bottomY - mesh.getBoundingInfo().boundingBox.minimumWorld.y;

    flock.updatePhysics(mesh);
    mesh.scaling.x = Math.max(0.01, mesh.scaling.x);
    mesh.scaling.y = Math.max(0.01, mesh.scaling.y);
    mesh.scaling.z = Math.max(0.01, mesh.scaling.z);
    updateScaleBlock(mesh);
  };
  const onConfirm = () => {
    exitTransformState();
    document.getElementById('scaleButton')?.focus();
  };
  const onCancel = () => {
    exitTransformState();
    gizmoManager.attachToMesh(null);
    document.getElementById('scaleButton')?.focus();
  };

  stopAxisKeyboard = createAdaptiveInput({
    onMove,
    onConfirm,
    onCancel,
    stepNormal: DEFAULT_SCALE,
    stepFast: FAST_SCALE,
    mode: 'arrows',
    showUniform: true,
    stepLabels: ['-', '+'],
    onAxisChange: (axis) => {
      onHudAxisSaved?.(axis);
      highlightGizmoAxis(gizmoManager.gizmos?.scaleGizmo, axis);
    },
    onHudHide: () => highlightGizmoAxis(gizmoManager.gizmos?.scaleGizmo, null),
    initialKeyboardAxis: defaultAxis,
    initialHudAxis: defaultAxis,
  });
}

// Set a single numeric axis input on a block (e.g. "X", "Y", or "Z")
function setBlockAxisValue(block, inputName, value) {
  const input = block.getInput(inputName);
  const connected = input?.connection?.targetBlock();
  if (connected) {
    connected.setFieldValue(String(Math.round(value * 10) / 10), 'NUM');
  }
}

// Find an existing rotate_to block in mesh's DO section without creating one.
function _findExistingRotateBlock(mesh) {
  const block = meshMap[mesh?.metadata?.blockKey];
  if (!block) return null;
  const modelVariable = block.getFieldValue('ID_VAR');
  const statementConnection = block.getInput('DO')?.connection;
  if (!statementConnection) return null;
  let current = statementConnection.targetBlock();
  while (current) {
    if (current.type === 'rotate_to' && current.getFieldValue('MODEL') === modelVariable) {
      return current;
    }
    current = current.getNextBlock();
  }
  return null;
}

// Find the existing rotate_to block in mesh's DO section, or create one.
// Returns the rotateBlock, or null if there is no associated Blockly block.
function findOrCreateRotateBlock(mesh) {
  const block = meshMap[mesh?.metadata?.blockKey];
  if (!block) return null;

  const groupId = Blockly.utils.idGenerator.genUid();
  Blockly.Events.setGroup(groupId);

  let addedDoSection = false;
  if (!block.getInput('DO')) {
    // Route through the block's own mutator so the +/- toggle button and any
    // "then" button stay in sync; a bare appendStatementInput would not.
    if (typeof block.toggleDoBlock === 'function') {
      block.toggleDoBlock();
    } else {
      block.appendStatementInput('DO').setCheck(null).appendField('');
    }
    addedDoSection = true;
  }

  let rotateBlock = null;
  const modelVariable = block.getFieldValue('ID_VAR');
  const statementConnection = block.getInput('DO').connection;
  if (statementConnection?.targetBlock()) {
    let currentBlock = statementConnection.targetBlock();
    while (currentBlock) {
      if (
        currentBlock.type === 'rotate_to' &&
        currentBlock.getFieldValue('MODEL') === modelVariable
      ) {
        rotateBlock = currentBlock;
        break;
      }
      currentBlock = currentBlock.getNextBlock();
    }
  }

  if (!rotateBlock) {
    rotateBlock = Blockly.getMainWorkspace().newBlock('rotate_to');
    rotateBlock.setFieldValue(modelVariable, 'MODEL');
    rotateBlock.initSvg();
    rotateBlock.render();
    ['X', 'Y', 'Z'].forEach((axis) => {
      const input = rotateBlock.getInput(axis);
      const shadow = Blockly.getMainWorkspace().newBlock('math_number');
      shadow.setFieldValue('0', 'NUM');
      shadow.setShadow(true);
      shadow.initSvg();
      shadow.render();
      input.connection.connect(shadow.outputConnection);
    });
    rotateBlock.render();

    // Make sure not to replace any existing blocks in DO
    const firstBlock = statementConnection.targetBlock();
    if (firstBlock) {
      let tail = firstBlock;
      while (tail.getNextBlock()) tail = tail.getNextBlock();
      tail.nextConnection.connect(rotateBlock.previousConnection);
    } else {
      block.getInput('DO').connection.connect(rotateBlock.previousConnection);
    }

    gizmoCreatedBlocks.set(rotateBlock.id, {
      parentId: block.id,
      createdDoSection: addedDoSection,
      timestamp: Date.now(),
    });
  }

  Blockly.Events.setGroup(null);
  return rotateBlock;
}

// Update the blockly block after a rotation.
// axisFilter: optional { x, y, z } booleans — only those axes are written.
export function updateRotationBlock(mesh, axisFilter = null) {
  const rotateBlock = findOrCreateRotateBlock(mesh);
  if (!rotateBlock) return;

  const groupId = Blockly.utils.idGenerator.genUid();
  Blockly.Events.setGroup(groupId);

  const currentRotation = getMeshRotationInDegrees(mesh);
  if (axisFilter) {
    if (axisFilter.x) setBlockAxisValue(rotateBlock, 'X', currentRotation.x);
    if (axisFilter.y) setBlockAxisValue(rotateBlock, 'Y', currentRotation.y);
    if (axisFilter.z) setBlockAxisValue(rotateBlock, 'Z', currentRotation.z);
  } else {
    setBlockXYZ(rotateBlock, currentRotation.x, currentRotation.y, currentRotation.z);
  }
  Blockly.Events.setGroup(null);
}

// Composite models (e.g. imported glTF) have no geometry on the root mesh;
// their bounding box only renders when visibility > 0, so we use 0.001.
function enableBoundingBox(mesh) {
  if (!mesh) return;
  if (!mesh.visibility || mesh.visibility === 0) {
    mesh.visibility = 0.001;
  }
  mesh.showBoundingBox = true;
  ensureOrbitBoundingBoxColorHook();
}

// Takes a block position, rounded as setBlockXYZ does, so the readout and the
// block always agree.
function positionStatus(position) {
  const [before = '', after = ''] = translate('position_readout').split('{position}');
  const axes = ['x', 'y', 'z'].flatMap((axis, i) => [
    { text: i ? ' ' : '' },
    {
      barColor: AXIS_HEX[axis],
      parts: [
        { text: axis, bold: true },
        { text: ': ' },
        { text: String(roundToOneDecimal(position?.[axis] ?? 0)) },
      ],
    },
  ]);
  return [{ text: before }, ...axes, { text: after }];
}

// Pick a mesh (used by multiple gizmos)
function pickMeshFromScene(onPicked, persistent = false, prompt = null) {
  cleanupScenePick(); // Stop picking
  resetAttachedMesh();
  if (prompt) showStatus(prompt, { owner: 'scene-pick', hint: true });
  let hasPicked = false;

  const handlePicked = (pickedMesh, pickedPoint, x, y) => {
    if (!persistent) {
      if (hasPicked) return;
      hasPicked = true;
      cleanupScenePick();
    }
    let mesh = pickedMesh;
    // For tools that can't act on a locked mesh (transform/colour/delete), if
    // the topmost hit is locked, fall through to the nearest non-locked mesh at
    // the same point — i.e. the visible/operable one (e.g. an unlocked
    // duplicate coincident with a locked original).
    if (mesh && blockedToolActive() && isMeshLocked(mesh)) {
      const alt = nearestUnlockedMesh(x ?? flock.scene.pointerX, y ?? flock.scene.pointerY);
      if (alt) mesh = alt;
    }
    onPicked(mesh, pickedPoint);
  };

  const pointerObservable = flock.scene.onPointerObservable;
  const pointerObserver = pointerObservable.add((event) => {
    if (event.type === flock.BABYLON.PointerEventTypes.POINTERPICK) {
      handlePicked(event.pickInfo.pickedMesh, event.pickInfo.pickedPoint);
    }
  });

  activePick = { pointerObservable, pointerObserver };

  setTimeout(() => {
    startCanvasKeyboardMode(
      (x, y) => {
        const pick = flock.scene.pick(x, y);
        handlePicked(pick?.pickedMesh, pick?.pickedPoint, x, y);
      },
      false,
      (x, y) => !!flock.scene.pick(x, y, (m) => m.isPickable && m.name !== 'ground')?.hit
    );
    document.body.style.cursor = 'crosshair';
    flock.scene.defaultCursor = 'crosshair';
  }, 0);
}

// Find an existing resize block in mesh's DO section without creating one.
function findExistingResizeBlock(mesh) {
  const block = meshMap[mesh?.metadata?.blockKey];
  if (!block || !RESIZE_BLOCK_TYPES.has(block.type)) return null;
  const modelVariable = block.getFieldValue('ID_VAR');
  const stmt = block.getInput('DO')?.connection?.targetBlock?.();
  for (let cur = stmt; cur; cur = cur.getNextBlock?.()) {
    if (cur.type === 'resize' && cur.getFieldValue?.('BLOCK_NAME') === modelVariable) {
      return cur;
    }
  }
  return null;
}

// Find the existing resize block in mesh's DO section, or create one.
// Returns the resizeBlock, or null if mesh's block type has no resize support.
function findOrCreateResizeBlock(mesh) {
  const block = meshMap[mesh?.metadata?.blockKey];
  if (!block || !RESIZE_BLOCK_TYPES.has(block.type)) return null;

  const groupId = Blockly.utils.idGenerator.genUid();
  Blockly.Events.setGroup(groupId);

  let addedDoSection = false;
  if (!block.getInput('DO')) {
    // Route through the block's own mutator so the +/- toggle button and any
    // "then" button stay in sync; a bare appendStatementInput would not.
    if (typeof block.toggleDoBlock === 'function') {
      block.toggleDoBlock();
    } else {
      block.appendStatementInput('DO').setCheck(null).appendField('');
    }
    addedDoSection = true;
  }

  const modelVariable = block.getFieldValue('ID_VAR');
  const stmt = block.getInput('DO')?.connection?.targetBlock?.();
  let resizeBlock = null;
  for (let cur = stmt; cur; cur = cur.getNextBlock?.()) {
    if (cur.type === 'resize' && cur.getFieldValue?.('BLOCK_NAME') === modelVariable) {
      resizeBlock = cur;
      break;
    }
  }

  if (!resizeBlock) {
    resizeBlock = Blockly.getMainWorkspace().newBlock('resize');
    resizeBlock.setFieldValue(modelVariable, 'BLOCK_NAME');
    resizeBlock.initSvg();
    resizeBlock.render();

    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo();
    const initialSize = getScaledSize(mesh);
    const axisValues = { X: initialSize.x, Y: initialSize.y, Z: initialSize.z };

    ['X', 'Y', 'Z'].forEach((axis) => {
      const input = resizeBlock.getInput(axis);
      const shadow = Blockly.getMainWorkspace().newBlock('math_number');
      const value = axisValues[axis];
      const num = Number.isFinite(value) && value > 0 ? value : 1;
      shadow.setFieldValue(String(Math.round(num * 10) / 10), 'NUM');
      shadow.setShadow(true);
      shadow.initSvg();
      shadow.render();
      input.connection.connect(shadow.outputConnection);
    });

    resizeBlock.render();

    // Creation applies Y as the *unrotated* base (see
    // applyPositionWithCurrentBaseRule) and the position gizmo commits that
    // same convention - so a move after scaling leaves creation holding a
    // post-scale position. Replaying rotate-then-resize would re-apply the
    // rotated anchor shift on top of it and the mesh jumps on Play. Running
    // the resize first measures the upright box, matching the convention the
    // creation position was written in, regardless of which gizmo the user
    // dragged first. (Tilt-then-scale with no later move replays closest in
    // drag order instead; that residual heals the moment the mesh is nudged.)
    let rotateTarget = null;
    for (let cur = stmt; cur; cur = cur.getNextBlock?.()) {
      if (cur.type === 'rotate_to' && cur.getFieldValue?.('MODEL') === modelVariable) {
        rotateTarget = cur;
        break;
      }
    }

    if (rotateTarget) {
      // targetConnection is either the DO input's own connection (when
      // rotateTarget is the first block in the stack) or a sibling's
      // nextConnection - either way, splice resizeBlock in ahead of it by
      // reattaching that same connection.
      const targetConnection = rotateTarget.previousConnection.targetConnection;
      rotateTarget.previousConnection.disconnect();
      targetConnection.connect(resizeBlock.previousConnection);
      resizeBlock.nextConnection.connect(rotateTarget.previousConnection);
    } else {
      const doFirstBlock = block.getInput('DO').connection.targetBlock();
      if (doFirstBlock) {
        let tail = doFirstBlock;
        while (tail.getNextBlock()) tail = tail.getNextBlock();
        tail.nextConnection.connect(resizeBlock.previousConnection);
      } else {
        block.getInput('DO').connection.connect(resizeBlock.previousConnection);
      }
    }

    gizmoCreatedBlocks.set(resizeBlock.id, {
      parentId: block.id,
      createdDoSection: addedDoSection,
      timestamp: Date.now(),
    });
  }

  Blockly.Events.setGroup(null);
  return resizeBlock;
}

// Update blockly block after a scale
// Baseline world sizes captured when a group scale begins (scale-drag-start
// / keyboard-scale setup), keyed by member blockKey. bakeGroupScale consumes
// them to turn the group's node scale into member size/position block values.
let groupScaleBaseline = null;

export function cacheGroupScaleBaseline(groupMesh) {
  const groupKey = groupMesh?.metadata?.blockKey;
  if (!groupKey) return;
  const sizes = new Map();
  for (const m of groupMesh.getChildMeshes?.(false) || []) {
    if (!m || m.isDisposed?.() || m.metadata?.shapeType === 'Group') continue;
    const key = m.metadata?.blockKey;
    if (!key || sizes.has(key)) continue;
    m.computeWorldMatrix(true);
    const bounds = flock.getEffectiveWorldBounds(m);
    sizes.set(key, {
      x: bounds.max.x - bounds.min.x,
      y: bounds.max.y - bounds.min.y,
      z: bounds.max.z - bounds.min.z,
    });
  }
  groupScaleBaseline = { groupKey, sizes };
}

// Blocks hold 1dp values; after a bake rounds member values, snap the live
// meshes back onto them so the scene is exactly what Play rebuilds. Sizes
// stay exact (like every plain-mesh scale): rebuilding geometry here would
// risk the physics corruption the suppression machinery guards against.
function snapMemberPositionToBlock(member) {
  const key = member?.metadata?.blockKey;
  if (!key || member.isDisposed?.()) return;
  const memberBlock = meshMap[key];
  if (!memberBlock || memberBlock.disposed) return;
  const live = flock.getBlockPositionFromMesh(member);
  const p = getXYZFromBlock(memberBlock);
  const num = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
  flock.setBlockPositionOnMesh(member, {
    x: num(p.x, live.x),
    y: num(p.y, live.y),
    z: num(p.z, live.z),
    useY: true,
  });
  flock.updatePhysics?.(member);
}

// Multiply a member's size inputs by per-axis factors, mirroring the
// updateScaleBlock cases. Models keep their size in a resize block; its id
// needs suppressing too (the entity's own block is covered by the caller).
function scaleMemberSizeInputs(mesh, fx, fy, fz, suppress) {
  const block = meshMap[mesh?.metadata?.blockKey];
  if (!block || block.disposed) return;
  const mul = (target, name, f) => {
    const cur = getNumberInput(target, name);
    if (Number.isFinite(cur)) setNumberInputs(target, { [name]: cur * f });
  };
  switch (block.type) {
    case 'create_plane':
      mul(block, 'WIDTH', fx);
      mul(block, 'HEIGHT', fy);
      break;
    case 'create_box':
    case 'create_wedge':
      mul(block, 'WIDTH', fx);
      mul(block, 'HEIGHT', fy);
      mul(block, 'DEPTH', fz);
      break;
    case 'create_capsule':
      mul(block, 'HEIGHT', fy);
      mul(block, 'DIAMETER', fx);
      break;
    case 'create_donut':
      mul(block, 'DIAMETER', fx);
      mul(block, 'THICKNESS', fy);
      break;
    case 'create_cylinder':
      mul(block, 'HEIGHT', fy);
      mul(block, 'DIAMETER_TOP', fx);
      mul(block, 'DIAMETER_BOTTOM', fx);
      break;
    case 'create_sphere':
      mul(block, 'DIAMETER_X', fx);
      mul(block, 'DIAMETER_Y', fy);
      mul(block, 'DIAMETER_Z', fz);
      break;
    case 'create_3d_text':
      mul(block, 'SIZE', fy);
      mul(block, 'DEPTH', fz);
      break;
    case 'load_model':
    case 'load_multi_object':
    case 'load_object':
    case 'load_character': {
      // A fresh resize block is seeded from the mesh's current (already
      // scaled) size, so only a pre-existing one needs multiplying.
      const existed = !!findExistingResizeBlock(mesh);
      const resizeBlock = findOrCreateResizeBlock(mesh);
      if (!resizeBlock) break;
      suppress?.(resizeBlock.id);
      if (existed) {
        mul(resizeBlock, 'X', fx);
        mul(resizeBlock, 'Y', fy);
        mul(resizeBlock, 'Z', fz);
      }
      break;
    }
  }
}

// Re-anchor a group to its members' center before scaling; a no-op when
// already aligned. Preserves every world transform.
export function healGroupOrigin(groupMesh) {
  if (!groupMesh || groupMesh.isDisposed?.()) return;
  groupMesh.computeWorldMatrix(true);
  let min = null;
  let max = null;
  for (const m of groupMesh.getChildMeshes?.(false) || []) {
    if (!m || m.isDisposed?.()) continue;
    const b = m.getHierarchyBoundingVectors(true);
    if (!b) continue;
    if (!min) {
      min = b.min.clone();
      max = b.max.clone();
    } else {
      flock.BABYLON.Vector3.CheckExtends(b.min, min, max);
      flock.BABYLON.Vector3.CheckExtends(b.max, min, max);
    }
  }
  if (!min || !max) return;
  const dx = (min.x + max.x) / 2 - groupMesh.position.x;
  const dy = (min.y + max.y) / 2 - groupMesh.position.y;
  const dz = (min.z + max.z) / 2 - groupMesh.position.z;
  if (dx * dx + dy * dy + dz * dz > 1e-6) {
    flock.recomputeGroupGeometry(groupMesh);
  }
}

// Blockly dispatches the bake's field-change events several frames late, so
// suppression lifts only after QUIET_FRAMES with no new interceptions
// (polling getSuppressedHitCount), capped at MAX_WAIT_FRAMES. Scoped to the
// bake's own block ids, so unrelated blocks are never at risk.
const QUIET_FRAMES = 3;
const MAX_WAIT_FRAMES = 90; // ~1.5s at 60fps - safety cap
function deferClearSuppressedBlocks(blockIds) {
  if (!blockIds || blockIds.size === 0) return;
  let lastHitCount = getSuppressedHitCount();
  let quietStreak = 0;
  let totalFrames = 0;
  const tick = () => {
    totalFrames++;
    const hitCount = getSuppressedHitCount();
    if (hitCount !== lastHitCount) {
      lastHitCount = hitCount;
      quietStreak = 0;
    } else {
      quietStreak++;
    }
    if (quietStreak >= QUIET_FRAMES || totalFrames >= MAX_WAIT_FRAMES) {
      for (const id of blockIds) unsuppressBlockLiveUpdates(id);
    } else {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
}

// Fold a group's node scale into its members; the group returns to scale 1.
// Returns false when there is nothing to bake, or a non-uniform scale meets
// rotated transforms unexpressible in member inputs (the caller then falls
// back to the legacy group resize block).
export function bakeGroupScale(groupMesh) {
  const groupKey = groupMesh?.metadata?.blockKey;
  if (!groupKey) return false;
  const s = groupMesh.scaling;
  if ([s.x, s.y, s.z].every((v) => Math.abs(v - 1) < 1e-4)) return false;

  const descendants = groupMesh.getChildMeshes?.(false) || [];
  // Top-most members only, so a scaled ancestor is never applied twice;
  // everything below them rides along untouched.
  const entities = [];
  const collectEntities = (node) => {
    for (const m of node.getChildMeshes?.(true) || []) {
      if (!m || m.isDisposed?.()) continue;
      if (m.metadata?.shapeType === 'Group') {
        collectEntities(m);
        continue;
      }
      entities.push(m);
    }
  };
  collectEntities(groupMesh);
  if (!entities.length) {
    groupMesh.scaling.set(1, 1, 1);
    return true;
  }

  const isUniform = (v) =>
    Math.abs(v.x - v.y) <= 1e-4 * Math.max(1, v.x, v.y, v.z) &&
    Math.abs(v.y - v.z) <= 1e-4 * Math.max(1, v.x, v.y, v.z);
  const worldQuatIdentity = (m) => {
    m.computeWorldMatrix(true);
    const scale = new flock.BABYLON.Vector3();
    const quat = new flock.BABYLON.Quaternion();
    const pos = new flock.BABYLON.Vector3();
    m.getWorldMatrix().decompose(scale, quat, pos);
    return Math.abs(quat.x) < 1e-3 && Math.abs(quat.y) < 1e-3 && Math.abs(quat.z) < 1e-3;
  };
  // Per-member scale factors, most exact source first: uniform ancestor
  // scales commute through rotation and nesting; otherwise the subtree must
  // be axis-aligned for component-wise factors, else baseline ratios.
  const factors = new Map();
  const seenKeys = new Set();
  const chainScales = (leaf) => {
    const acc = { x: 1, y: 1, z: 1 };
    let uniform = true;
    let p = leaf.parent;
    while (p) {
      const ps = p.scaling;
      if (p.metadata?.shapeType === 'Group') {
        if (!isUniform(ps)) uniform = false;
        acc.x *= ps.x;
        acc.y *= ps.y;
        acc.z *= ps.z;
      }
      p = p.parent;
    }
    return { acc, uniform };
  };
  const baseline = groupScaleBaseline;
  const baselineUsable =
    baseline && baseline.groupKey === groupKey
      ? baseline
      : null;
  let subtreeUnrotated = null;
  for (const m of entities) {
    const key = m.metadata?.blockKey;
    if (!key || seenKeys.has(key)) return false;
    seenKeys.add(key);
    const { acc, uniform } = chainScales(m);
    if (uniform) {
      factors.set(key, { x: acc.x, y: acc.y, z: acc.z });
      continue;
    }
    if (subtreeUnrotated === null) {
      subtreeUnrotated =
        worldQuatIdentity(groupMesh) &&
        descendants.every(
          (d) => !d || d.isDisposed?.() || worldQuatIdentity(d)
        );
    }
    if (subtreeUnrotated) {
      factors.set(key, { x: acc.x, y: acc.y, z: acc.z });
      continue;
    }
    if (!baselineUsable) return false;
    const oldSize = baselineUsable.sizes.get(key);
    if (!oldSize) return false;
    m.computeWorldMatrix(true);
    const bounds = flock.getEffectiveWorldBounds(m);
    const size = {
      x: bounds.max.x - bounds.min.x,
      y: bounds.max.y - bounds.min.y,
      z: bounds.max.z - bounds.min.z,
    };
    const ratio = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && b > 1e-9 ? a / b : 1);
    factors.set(key, { x: ratio(size.x, oldSize.x), y: ratio(size.y, oldSize.y), z: ratio(size.z, oldSize.z) });
  }
  groupScaleBaseline = null;

  const groupId = Blockly.utils.idGenerator.genUid();
  Blockly.Events.setGroup(groupId);
  // Own each touched block's writes: mid-bake they must not trigger the live
  // pipeline. Events still record, so the bake stays a single undo.
  const touchedBlockIds = new Set();
  const suppress = (blockId) => {
    if (!blockId || touchedBlockIds.has(blockId)) return;
    touchedBlockIds.add(blockId);
    suppressBlockLiveUpdates(blockId);
  };
  const parents = new Map();
  // Restored on success and again (guarded) in finally: anything throwing
  // mid-bake must not leave members detached with the group scale reset.
  let reparented = false;
  const restoreParents = () => {
    if (reparented) return;
    reparented = true;
    for (const m of entities) {
      if (!m.isDisposed?.()) m.setParent(parents.get(m) ?? null);
    }
  };
  try {
    for (const m of entities) {
      parents.set(m, m.parent);
      suppress(m.metadata?.blockKey);
      m.setParent(null);
    }
    for (const m of entities) {
      const key = m.metadata?.blockKey;
      const f = factors.get(key);
      scaleMemberSizeInputs(m, f.x, f.y, f.z, suppress);
      const childBlock = meshMap[key];
      if (childBlock && !childBlock.disposed) {
        const pos = flock.getBlockPositionFromMesh(m);
        setBlockXYZ(childBlock, pos.x, pos.y, pos.z);
      }
    }
    groupMesh.scaling.set(1, 1, 1);
    for (const m of descendants) {
      if (m?.metadata?.shapeType === 'Group' && !m.isDisposed?.()) m.scaling.set(1, 1, 1);
    }
    restoreParents();
    // Physics bodies rebuild once per direct parent group below, not here:
    // rebuilding twice in one tick corrupts the Havok body.
    // Members below top-level entities have no size to write, but their
    // world positions moved, so their blocks update too (read unparented,
    // like updateChildBlockPositions).
    const snappedSubs = [];
    for (const m of descendants) {
      if (!m || m.isDisposed?.() || m.metadata?.shapeType === 'Group') continue;
      const key = m.metadata?.blockKey;
      if (!key || seenKeys.has(key)) continue;
      const childBlock = meshMap[key];
      if (!childBlock || childBlock.disposed) continue;
      seenKeys.add(key);
      suppress(key);
      const parent = m.parent;
      m.setParent(null);
      let pos;
      try {
        pos = flock.getBlockPositionFromMesh(m);
      } finally {
        m.setParent(parent);
      }
      setBlockXYZ(childBlock, pos.x, pos.y, pos.z);
      snappedSubs.push(m);
    }
    // Snap live members onto the rounded blocks (positions only; sizes stay
    // exact) before the pivots recompute, so the scene matches Play.
    for (const m of entities) snapMemberPositionToBlock(m);
    for (const m of snappedSubs) snapMemberPositionToBlock(m);
    const depthOf = (m) => {
      let d = 0;
      let p = m.parent;
      while (p) {
        d++;
        p = p.parent;
      }
      return d;
    };
    const inners = descendants
      .filter((m) => m?.metadata?.shapeType === 'Group' && !m.isDisposed?.())
      .sort((a, b) => depthOf(b) - depthOf(a));
    for (const g of inners) flock.recomputeGroupGeometry(g);
    flock.recomputeGroupGeometry(groupMesh);
    const resizeBlock = findExistingResizeBlock(groupMesh);
    if (resizeBlock) {
      suppress(resizeBlock.id);
      const sized = getScaledSize(groupMesh);
      setNumberInputs(resizeBlock, { X: sized.x, Y: sized.y, Z: sized.z });
    }
    flock.updatePhysics?.(groupMesh);
  } finally {
    restoreParents();
    // Blockly dispatches the bake's field-change events a few frames late;
    // lifting suppression now would replay them against the baked mesh.
    // Clearing stays scoped to the touched blocks.
    deferClearSuppressedBlocks(touchedBlockIds);
    Blockly.Events.setGroup(false);
  }
  // Re-baseline to the baked state so repeated commits chain instead of
  // falling back to a group resize block.
  cacheGroupScaleBaseline(groupMesh);
  return true;
}

export function updateScaleBlock(mesh, originalBottomY = null) {
  const block = meshMap[mesh?.metadata?.blockKey];
  if (!block) return;

  flock.updatePhysics(mesh);
  mesh.scaling.x = Math.max(0.01, mesh.scaling.x);
  mesh.scaling.y = Math.max(0.01, mesh.scaling.y);
  mesh.scaling.z = Math.max(0.01, mesh.scaling.z);

  try {
    const ensureFreshBounds = (m) => {
      m.computeWorldMatrix(true);
      m.refreshBoundingInfo();
      return m.getBoundingInfo().boundingBox;
    };

    const bbox = ensureFreshBounds(mesh);
    const newBottomY = bbox.minimumWorld.y;
    if (originalBottomY !== null) {
      mesh.position.y += originalBottomY - newBottomY;
    }

    const sizeLocal = bbox.extendSize.scale(2);
    const w = sizeLocal.x * Math.abs(mesh.scaling.x);
    const h = sizeLocal.y * Math.abs(mesh.scaling.y);
    const d = sizeLocal.z * Math.abs(mesh.scaling.z);

    switch (block.type) {
      case 'create_plane':
        setNumberInputs(block, { WIDTH: w, HEIGHT: h });
        break;

      case 'create_box':
      case 'create_wedge':
        setNumberInputs(block, { WIDTH: w, HEIGHT: h, DEPTH: d });
        break;

      case 'create_capsule':
        setNumberInputs(block, { HEIGHT: h, DIAMETER: w });
        break;

      // Bounding box is (diameter + thickness) wide and thickness tall.
      case 'create_donut':
        setNumberInputs(block, { DIAMETER: Math.max(0, w - h), THICKNESS: h });
        break;

      case 'create_cylinder': {
        const newScaledDiameter = w;

        const currentTop = getNumberInput(block, 'DIAMETER_TOP');
        const currentBottom = getNumberInput(block, 'DIAMETER_BOTTOM');

        let newTop;
        let newBottom;

        if (
          Number.isFinite(currentTop) &&
          Number.isFinite(currentBottom) &&
          currentTop >= 0 &&
          currentBottom >= 0 &&
          Math.max(currentTop, currentBottom) > 0
        ) {
          const factor = newScaledDiameter / Math.max(currentTop, currentBottom);
          newTop = currentTop * factor;
          newBottom = currentBottom * factor;
        } else {
          newTop = newScaledDiameter;
          newBottom = newScaledDiameter;
        }

        setNumberInputs(block, {
          HEIGHT: h,
          DIAMETER_TOP: newTop,
          DIAMETER_BOTTOM: newBottom,
        });
        break;
      }

      case 'create_sphere':
        setNumberInputs(block, {
          DIAMETER_X: w,
          DIAMETER_Y: h,
          DIAMETER_Z: d,
        });
        break;

      case 'create_3d_text': {
        const currentSize = getNumberInput(block, 'SIZE');
        const currentDepth = getNumberInput(block, 'DEPTH');
        setNumberInputs(block, {
          SIZE: currentSize * mesh.scaling.y,
          DEPTH: currentDepth * mesh.scaling.z,
        });
        break;
      }

      case 'load_model':
      case 'load_multi_object':
      case 'load_object':
      case 'load_character':
      case 'create_group': {
        // Groups never keep a scale of their own: fold it into the members.
        // Only an unexpressible scale (non-uniform over rotated transforms
        // with no baseline) falls back to a group resize block.
        if (block.type === 'create_group') {
          if (bakeGroupScale(mesh)) break;
          const sc = mesh.scaling;
          if ([sc.x, sc.y, sc.z].every((v) => Math.abs(v - 1) < 1e-4)) break;
        }
        const resizeBlock = findOrCreateResizeBlock(mesh);
        if (!resizeBlock) break;

        mesh.computeWorldMatrix(true);
        mesh.refreshBoundingInfo();
        const sizeLocalScaled = getScaledSize(mesh);

        setNumberInputs(resizeBlock, {
          X: sizeLocalScaled.x,
          Y: sizeLocalScaled.y,
          Z: sizeLocalScaled.z,
        });
        break;
      }
    }
  } catch (e) {
    console.error('Error updating block values:', e);
  }
}

// When a mesh is moved, its parented children move with it in world space.
// Write each child's new position into its own block so re-running the
// project reproduces what's on screen. Read unparented so the transform is
// world-space, then restore the parent. Writing the block fires
// updateMeshFromBlock, which applies the change back on a deferred microtask;
// the 1dp rounding makes that a small snap onto the rounded values, keeping
// the scene identical to what Play rebuilds. The caller wraps this (with the
// parent's own block update) in a single Blockly event group: one undo.
function updateChildBlockPositions(mesh) {
  const rootKey = mesh?.metadata?.blockKey;
  const children = mesh?.getChildMeshes?.(false) || [];
  const seenKeys = new Set();

  children.forEach((child) => {
    const key = child?.metadata?.blockKey;
    if (!key || key === rootKey || seenKeys.has(key)) return;

    const childBlock = meshMap[key];
    if (!childBlock || childBlock.disposed) return;

    seenKeys.add(key);

    const childParent = child.parent;
    child.setParent(null);
    let pos;
    try {
      pos = flock.getBlockPositionFromMesh(child);
    } finally {
      child.setParent(childParent);
    }

    setBlockXYZ(childBlock, pos.x, pos.y, pos.z);
  });
}

function startDuplicatePlacement() {
  let blockKey, blockId, canvas, onPickMesh;
  if (!gizmoManager.attachedMesh) {
    showStatus(translate('select_mesh_duplicate_prompt'), { duration: 10, hint: true });
    return;
  }
  blockKey = findParentWithBlockId(gizmoManager.attachedMesh)?.metadata?.blockKey;

  // Make sure that if there is already a selected mesh
  // its bounding box is visible so the user knows what they are duplicating
  let meshToClone = gizmoManager.attachedMesh;
  enableBoundingBox(meshToClone);

  blockId = meshBlockIdMap[blockKey];
  duplicateModeActive = true;

  showStatus(translate('place_duplicate_prompt'), { owner: 'duplicate-place', hint: true });
  setCrosshairCursor();

  canvas = flock.scene.getEngine().getRenderingCanvas(); // Get the flock.BABYLON.js canvas

  const updateDuplicateChainSource = (newBlock, workspace) => {
    if (!newBlock) return;

    highlightBlockById(workspace, newBlock);
    blockId = newBlock.id;
    setCrosshairCursor();

    let attempt = 0;
    const maxAttempts = 20;

    const resolveSourceMesh = () => {
      duplicateRafId = null;
      if (!duplicateModeActive) return;

      const newBlockKey = getBlockKeyFromBlock(newBlock);
      let nextSource =
        (newBlockKey ? getMeshFromBlockKey(newBlockKey) : null) || getMeshFromBlock(newBlock);

      if (!nextSource && attempt < maxAttempts) {
        attempt += 1;
        duplicateRafId = requestAnimationFrame(resolveSourceMesh);
        return;
      }

      if (!nextSource) return;
      if (nextSource.parent) nextSource = getRootMesh(nextSource.parent);

      if (duplicateModeActive) {
        if (meshToClone && meshToClone !== nextSource) {
          meshToClone.showBoundingBox = false;
          resetBoundingBoxVisibilityIfManuallyChanged(meshToClone);
        }
        meshToClone = nextSource;
        gizmoManager.attachToMesh(meshToClone);
        enableBoundingBox(meshToClone);
      }
    };

    if (duplicateRafId !== null) {
      cancelAnimationFrame(duplicateRafId);
      duplicateRafId = null;
    }
    duplicateRafId = requestAnimationFrame(resolveSourceMesh);
  };

  onPickMesh = function (event) {
    const canvasRect = canvas.getBoundingClientRect();

    if (eventIsOutOfCanvasBounds(event, canvasRect)) {
      window.removeEventListener('click', onPickMesh);
      meshToClone.showBoundingBox = false;
      exitTransformState();
      return;
    }

    const [canvasX, canvasY] = getCanvasXAndCanvasYValues(event, canvasRect);

    const pickRay = flock.scene.createPickingRay(
      canvasX,
      canvasY,
      flock.BABYLON.Matrix.Identity(),
      flock.scene.activeCamera
    );

    const pickResult = flock.scene.pickWithRay(pickRay, (mesh) => mesh.isPickable);

    if (pickResult.hit) {
      const pickedPosition = pickResult.pickedPoint;
      const workspace = Blockly.getMainWorkspace();
      const originalBlock = workspace.getBlockById(blockId);
      // If they deleted the original block while picking, exit gracefully
      if (!originalBlock) {
        meshToClone.showBoundingBox = false;
        exitTransformState();
        return;
      }
      // Otherwise carry on adding the new block
      const newBlock = duplicateBlockAndInsert(originalBlock, workspace, pickedPosition);
      updateDuplicateChainSource(newBlock, workspace);
    }
  };

  // Store a reference to this listener so we can get rid of it
  // if they abort half way through a duplication
  activeDuplicatePickHandler = onPickMesh;

  // Use setTimeout to defer listener setup
  activeDuplicatePickTimer = setTimeout(() => {
    activeDuplicatePickTimer = null;
    window.addEventListener('click', onPickMesh);
  }, 50);

  // Keyboard mode: use canvas circle to place the duplicate
  setTimeout(() => {
    startCanvasKeyboardMode(
      (x, y) => {
        const pickResult = flock.scene.pick(x, y, (mesh) => mesh.isPickable);
        if (pickResult?.hit) {
          const workspace = Blockly.getMainWorkspace();
          const originalBlock = workspace.getBlockById(blockId);
          // If they deleted the original block while picking, exit gracefully
          if (!originalBlock) {
            meshToClone.showBoundingBox = false;
            exitTransformState();
            return;
          }
          const newBlock = duplicateBlockAndInsert(
            originalBlock,
            workspace,
            pickResult.pickedPoint
          );
          updateDuplicateChainSource(newBlock, workspace);
        }
      },
      false,
      (x, y) => !!flock.scene.pick(x, y, (mesh) => mesh.isPickable)?.hit
    );
    flock.scene.defaultCursor = 'crosshair';
  }, 0);
}

// Clean up after picking
function cleanupScenePick() {
  if (activePick) {
    activePick.pointerObservable.remove(activePick.pointerObserver);
    activePick = null;
  }
  stopCanvasKeyboardMode();
  setDefaultCursor();
  clearStatus('scene-pick');
}

// Add to list of cleanup we need to run
function onExit(fn) {
  cleanupFns.push(fn);
}

// Run all the cleanup functions
function runCleanups() {
  cleanupFns.forEach((fn) => fn());
  cleanupFns.length = 0;
}

export function disableGizmos() {
  if (!gizmoManager) return;
  // Disable all gizmos
  gizmoManager.positionGizmoEnabled = false;
  gizmoManager.rotationGizmoEnabled = false;
  gizmoManager.scaleGizmoEnabled = false;
  gizmoManager.boundingBoxGizmoEnabled = false;
  stopCanvasKeyboardMode();
}

// Toggle which Gizmo is being used
export function toggleGizmo(gizmoType) {
  // The camera button's job while orbiting is just to exit orbit. Must run
  // before the "already active" / cleanup logic below: cameraButton is never
  // marked active during orbit (cameraMode stays 'play' throughout), so
  // without this the general exitGizmoState() cleanup would disconnect orbit
  // on its own, and by the time handleCameraGizmo() ran its own orbit check
  // would already see a plain camera and fall through to a play/fly toggle.
  if (gizmoType === 'camera' && isOrbitViewActive()) {
    disconnectOrbitView();
    return;
  }

  // Is this gizmo already active? If so, toggle it off
  const button = document.getElementById(`${gizmoType}Button`);
  if (button?.classList.contains('active')) {
    if (gizmoType === 'camera') handleCameraGizmo();
    if (gizmoType === 'eye') {
      disconnectOrbitView();
      const prevType = orbitPreviousGizmoType;
      orbitPreviousGizmoType = null;
      const prevButton = prevType ? document.getElementById(`${prevType}Button`) : null;
      if (prevType && prevButton && !prevButton.classList.contains('active')) {
        // Skip when that tool is already live — toggling would turn it off.
        toggleGizmo(prevType);
      } else {
        setGizmoButtonActive(document.getElementById('eyeButton'), false);
        flock.scene?.getEngine()?.getRenderingCanvas()?.focus();
      }
      return;
    }
    // Turning a compatible tool off while orbiting stays in orbit.
    if (ORBIT_COMPATIBLE_GIZMOS.has(gizmoType) && isOrbitViewActive()) {
      exitGizmoState({ preserveOrbit: true });
      if (gizmoManager) gizmoManager.usePointerToAttachGizmos = false;
      if (gizmoType === 'select') {
        resetBoundingBoxVisibilityIfManuallyChanged(gizmoManager?.attachedMesh);
        resetAttachedMeshIfMeshAttached();
        gizmoManager?.attachToMesh(null);
      }
      return;
    }
    exitGizmoState();
    // Clicking the select tool off deselects whatever it had picked, rather
    // than leaving the gizmo/bounding box attached with no active tool.
    if (gizmoType === 'select') {
      resetBoundingBoxVisibilityIfManuallyChanged(gizmoManager?.attachedMesh);
      resetAttachedMeshIfMeshAttached();
      gizmoManager?.attachToMesh(null);
    }
    return;
  }

  const preserveOrbit = ORBIT_COMPATIBLE_GIZMOS.has(gizmoType) && isOrbitViewActive();

  // No buttons should be highlighted
  if (gizmoType === 'eye') {
    const activeBtn = document.querySelector('.gizmo-button.active');
    const prevId = activeBtn?.id ?? null;
    const prevType = prevId?.endsWith('Button') ? prevId.slice(0, -'Button'.length) : null;
    orbitPreviousGizmoType =
      prevType && ['position', 'rotation', 'scale', 'select', 'duplicate', 'delete', 'camera', 'focus'].includes(prevType)
        ? prevType
        : null;
  }
  document.querySelectorAll('.gizmo-button').forEach((btn) => {
    if (preserveOrbit && btn.id === 'eyeButton') return;
    setGizmoButtonActive(btn, false);
  });

  // If they abandoned a duplicate half way, remove listener
  if (gizmoType === 'duplicate' && activeDuplicatePickHandler) {
    exitTransformState();
    return;
  }

  exitGizmoState(preserveOrbit ? { preserveOrbit: true } : undefined); // Clean up any existing gizmo state
  // Not gated on preserveOrbit: resetAttachedMesh already keeps the orbited
  // mesh's own box lit on its own (see isOrbitedMesh), so switching tools
  // here should still clear a plain selection box even mid-orbit.
  if (gizmoType !== 'camera' && gizmoType !== 'eye') resetAttachedMeshIfMeshAttached();

  document.body.style.cursor = 'default';

  // Enable the selected gizmo
  switch (gizmoType) {
    case 'camera':
      handleCameraGizmo();
      break;
    case 'delete':
      handleDeleteGizmo();
      break;
    case 'duplicate':
      handleDuplicateGizmo();
      break;
    case 'select':
      handleSelectGizmo();
      break;
    case 'position':
      handlePositionGizmo();
      break;
    case 'rotation':
      handleRotationGizmo();
      break;
    case 'scale':
      handleScaleGizmo();
      break;
    case 'eye':
      handleEyeGizmo();
      break;
    /*
    case "boundingBox":
      gizmoManager.boundingBoxGizmoEnabled = true;
      break;
    case "bounds":
      _handleBoundsGizmo();
      break;
    */
    case 'focus':
      focusOnMesh();
      break;
    default:
      break;
  }
  // NOTE: canvas clicks used to retarget the gizmo here via
  // gizmoManager.usePointerToAttachGizmos = true, but that fires on raw
  // POINTERDOWN with no click-vs-drag distinction — the same pointerdown that
  // starts a drag to rotate the orbit camera would pick whatever's under the
  // cursor (often the ground) and immediately exit the gizmo. Left off, like
  // everywhere else orbit is preserved; retargeting the gizmo while orbiting
  // would need a POINTERPICK-based observer (see watchEyeGizmoRetarget) if
  // wanted back.
}

// Scale: Allow the user to scale the mesh by dragging it
function handleScaleGizmo() {
  watchClickAwayFromCanvas();
  // A locked mesh may already be attached from Select; don't let scale use it.
  detachIfAttachedMeshLocked();
  configureScaleGizmo(gizmoManager);
  observeDragAxis(gizmoManager.gizmos.scaleGizmo);
  {
    const usg = gizmoManager.gizmos.scaleGizmo.uniformScaleGizmo;
    if (usg?.dragBehavior) {
      const startObs = usg.dragBehavior.onDragStartObservable.add(() =>
        stopAxisKeyboard?.setAxis('all')
      );
      const endObs = usg.dragBehavior.onDragEndObservable.add(() =>
        stopAxisKeyboard?.setAxis(null)
      );
      onExit(() => {
        usg.dragBehavior.onDragStartObservable.remove(startObs);
        usg.dragBehavior.onDragEndObservable.remove(endObs);
      });
    }
  }
  {
    const sg = gizmoManager.gizmos.scaleGizmo;
    if (!sg._scaleAxisObserversRegistered) {
      sg.xGizmo.dragBehavior.onDragStartObservable.add(() => (scaleDragAxis = 'x'));
      sg.yGizmo.dragBehavior.onDragStartObservable.add(() => (scaleDragAxis = 'y'));
      sg.zGizmo.dragBehavior.onDragStartObservable.add(() => (scaleDragAxis = 'z'));
      sg.uniformScaleGizmo.dragBehavior.onDragStartObservable.add(
        () => (scaleDragAxis = 'uniform')
      );
      sg._scaleAxisObserversRegistered = true;
    }
  }

  // Highlight scale button
  const scaleButton = document.getElementById('scaleButton');
  setGizmoButtonActive(scaleButton, true);

  let savedHudAxis = null;
  const mesh = gizmoManager.attachedMesh;
  if (mesh) {
    startScaleKeyboardHandler(mesh, savedHudAxis, (axis) => {
      if (axis) savedHudAxis = axis;
    });
    showStatus(translate('gizmo_controls_hint'), {
      duration: 10,
      owner: 'gizmo-controls-hint',
      hint: true,
    });
  } else {
    pickMeshFromScene(
      (pickedMesh) => {
        if (!pickedMesh || pickedMesh.name === 'ground') {
          exitTransformState();
          return;
        }
        attachMeshForActiveTool(pickedMesh);
      },
      false,
      translate('select_mesh_prompt')
    );
  }

  let lastScaledMesh = gizmoManager.attachedMesh;
  const scaleObs = gizmoManager.onAttachedToMeshObservable.add((mesh) => {
    if (!mesh) {
      updateScaleBlock(lastScaledMesh); // update blockly block
      exitTransformState();
      gizmoManager.attachToMesh(null); // unselect
      return;
    }

    lastScaledMesh = mesh;
    startScaleKeyboardHandler(mesh, savedHudAxis, (axis) => {
      if (axis) savedHudAxis = axis;
    });
    showStatus(translate('gizmo_controls_hint'), {
      duration: 10,
      owner: 'gizmo-controls-hint',
      hint: true,
    });
  });

  onExit(() => gizmoManager.onAttachedToMeshObservable.remove(scaleObs));

  // Track bottom for correct visual anchoring
  let originalBottomY = 0;

  const scaleDrag = gizmoManager.gizmos.scaleGizmo.onDragObservable.add(() => {
    const mesh = gizmoManager.attachedMesh;

    // Never scale about a stale origin (see the keyboard onMove).
    if (mesh?.metadata?.shapeType === 'Group') healGroupOrigin(mesh);

    mesh.scaling.x = Math.max(0.01, mesh.scaling.x);
    mesh.scaling.y = Math.max(0.01, mesh.scaling.y);
    mesh.scaling.z = Math.max(0.01, mesh.scaling.z);

    const newBottomY = flock.getEffectiveWorldBounds(mesh).min.y;
    const deltaY = originalBottomY - newBottomY;
    mesh.position.y += deltaY;

    const block = Blockly.getMainWorkspace().getBlockById(mesh?.metadata?.blockKey);
    if (gizmoManager.scaleGizmoEnabled) {
      switch (block?.type) {
        case 'create_capsule':
        case 'create_cylinder': {
          // Babylon has no independent depth here, so whichever horizontal
          // handle was dragged drives both X and Z.
          const diameter = scaleDragAxis === 'z' ? mesh.scaling.z : mesh.scaling.x;
          mesh.scaling.x = diameter;
          mesh.scaling.z = diameter;
          break;
        }
        case 'create_3d_text':
          if (scaleDragAxis === 'z') {
            // Z handle: depth only — lock X and Y
            mesh.scaling.x = 1;
            mesh.scaling.y = 1;
          } else if (scaleDragAxis === 'x' || scaleDragAxis === 'uniform') {
            // X or uniform: size only — keep Y = X, lock Z
            mesh.scaling.y = mesh.scaling.x;
            mesh.scaling.z = textOrigScaleZ;
          } else if (scaleDragAxis === 'y') {
            // Y handle: size only — keep X = Y, lock Z
            mesh.scaling.x = mesh.scaling.y;
            mesh.scaling.z = textOrigScaleZ;
          }
          break;
      }
    }

    // Re-tile textures live so materials don't stretch while dragging.
    if (block && MODEL_BLOCK_TYPES.has(block.type)) {
      // Models use uScale/vScale tiling; the formula matches
      // flock.resize()'s maintainTextureScale so the look stays consistent.
      const size = getScaledSize(mesh);
      flock.applyTextureScaleToMesh(mesh, size.x, size.y, size.z);
    } else {
      // Primitives use size-based per-vertex UVs (set at creation / on block
      // edit via TILE_SIZE = 4). Re-run that mapping with the live scaling
      // folded in so the tile size stays constant in world units instead of
      // stretching with the geometry. Passing the scaled (world) size plus the
      // scale makes the live result match a re-baked mesh / program re-run.
      retilePrimitiveUVsForScale(mesh);
    }
  });

  onExit(() => gizmoManager.gizmos.scaleGizmo.onDragObservable.remove(scaleDrag));

  const scaleDragStart = gizmoManager.gizmos.scaleGizmo.onDragStartObservable.add(() => {
    const mesh = gizmoManager.attachedMesh;
    flock.ensureUniqueGeometry(mesh);
    originalBottomY = flock.getEffectiveWorldBounds(mesh).min.y;
    textOrigScaleZ = mesh.scaling.z;
    scaleDragAxis = null;

    const motionType = isBodyAlive(mesh.physics) ? mesh.physics.getMotionType() : undefined;
    mesh.savedMotionType = motionType;

    if (motionType != null && motionType !== flock.BABYLON.PhysicsMotionType.ANIMATED) {
      mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.ANIMATED);
      mesh.physics.disablePreStep = false;
    }

    const creationBlock = meshMap[mesh?.metadata?.blockKey];
    if (creationBlock) {
      if (creationBlock.type === 'create_group') {
        highlightBlockById(Blockly.getMainWorkspace(), creationBlock);
      } else if (RESIZE_BLOCK_TYPES.has(creationBlock.type)) {
        const resizeBlock = findOrCreateResizeBlock(mesh);
        if (resizeBlock) {
          highlightBlockById(Blockly.getMainWorkspace(), resizeBlock);
        } else {
          highlightBlockById(Blockly.getMainWorkspace(), creationBlock);
        }
      } else {
        highlightBlockById(Blockly.getMainWorkspace(), creationBlock);
      }
    }
    if (mesh?.metadata?.shapeType === 'Group') {
      healGroupOrigin(mesh);
      cacheGroupScaleBaseline(mesh);
    }
  });

  onExit(() => gizmoManager.gizmos.scaleGizmo.onDragStartObservable.remove(scaleDragStart));

  const scaleDragEnd = gizmoManager.gizmos.scaleGizmo.onDragEndObservable.add(() => {
    const mesh = gizmoManager.attachedMesh;
    scaleDragAxis = null;

    if (mesh.savedMotionType != null && isBodyAlive(mesh.physics)) {
      mesh.physics.setMotionType(mesh.savedMotionType);
    }
    updateScaleBlock(mesh, originalBottomY);
  });

  onExit(() => gizmoManager.gizmos.scaleGizmo.onDragEndObservable.remove(scaleDragEnd));
}

// Dim non-selected axis gizmo handles; pass axis=null to restore all to full opacity.
function highlightGizmoAxis(gizmo, axis) {
  const map = { x: gizmo?.xGizmo, y: gizmo?.yGizmo, z: gizmo?.zGizmo };
  Object.entries(map).forEach(([key, g]) => {
    if (g?._coloredMaterial) {
      g._coloredMaterial.alpha = !axis || axis === key || axis === 'all' ? 1 : 0.2;
    }
  });
}

// Highlight the HUD and gizmo handles while a drag handle is active.
function observeDragAxis(gizmo) {
  for (const axisKey of ['x', 'y', 'z']) {
    const g = gizmo?.[`${axisKey}Gizmo`];
    if (!g?.dragBehavior) continue;
    const startObs = g.dragBehavior.onDragStartObservable.add(() =>
      stopAxisKeyboard?.setAxis(axisKey)
    );
    const endObs = g.dragBehavior.onDragEndObservable.add(() => stopAxisKeyboard?.setAxis(null));
    onExit(() => {
      g.dragBehavior.onDragStartObservable.remove(startObs);
      g.dragBehavior.onDragEndObservable.remove(endObs);
    });
  }
}

// Rotation: Allow the user to rotate the mesh by dragging it
function handleRotationGizmo() {
  watchClickAwayFromCanvas();
  // A locked mesh may already be attached from Select; don't let rotation use it.
  detachIfAttachedMeshLocked();
  configureRotationGizmo(gizmoManager);
  observeDragAxis(gizmoManager.gizmos.rotationGizmo);

  // Show that rotation is active
  const rotationButton = document.getElementById('rotationButton');
  setGizmoButtonActive(rotationButton, true);

  // Default to Y on a fresh activation (most rotations are about the vertical
  // axis); once the user picks a different axis, re-attaching to another mesh
  // within this same activation keeps that choice instead of resetting.
  let savedHudAxis = 'y';
  const mesh = gizmoManager.attachedMesh;
  if (mesh) {
    startRotateKeyboardHandler(mesh, savedHudAxis, (axis) => {
      if (axis) savedHudAxis = axis;
    });
    showStatus(translate('gizmo_controls_hint'), {
      duration: 10,
      owner: 'gizmo-controls-hint',
      hint: true,
    });
  } else {
    pickMeshFromScene(
      (pickedMesh) => {
        if (!pickedMesh || pickedMesh.name === 'ground') {
          exitTransformState();
          return;
        }
        attachMeshForActiveTool(pickedMesh);
      },
      false,
      translate('select_mesh_prompt')
    );
  }

  let lastRotatedMesh = gizmoManager.attachedMesh;

  const rotateObs = gizmoManager.onAttachedToMeshObservable.add((mesh) => {
    if (!mesh) {
      if (lastRotatedMesh?.metadata?.shapeType !== 'Group') {
        updateRotationBlock(lastRotatedMesh); // properly update block if they click out
      }
      updateChildBlockRotations(lastRotatedMesh);
      exitTransformState();
      gizmoManager.attachToMesh(null);
      return;
    }

    lastRotatedMesh = mesh;

    showStatus(translate('gizmo_controls_hint'), {
      duration: 10,
      owner: 'gizmo-controls-hint',
      hint: true,
    });
    startRotateKeyboardHandler(mesh, savedHudAxis, (axis) => {
      if (axis) savedHudAxis = axis;
    });
  });

  onExit(() => gizmoManager.onAttachedToMeshObservable.remove(rotateObs));

  const rotDragStart = gizmoManager.gizmos.rotationGizmo.onDragStartObservable.add(() => {
    const mesh = gizmoManager.attachedMesh;
    if (!mesh) return;

    if (mesh.metadata?.shapeType === 'Group') {
      const groupBlock = meshMap[mesh.metadata?.blockKey];
      if (groupBlock) highlightBlockById(Blockly.getMainWorkspace(), groupBlock);
    } else {
      const rotateBlock = findOrCreateRotateBlock(mesh);
      if (rotateBlock) {
        highlightBlockById(Blockly.getMainWorkspace(), rotateBlock);
      }
    }

    if (!isBodyAlive(mesh.physics)) return;

    const motionType = mesh.physics.getMotionType();
    mesh.savedMotionType = motionType;

    if (motionType !== flock.BABYLON.PhysicsMotionType.ANIMATED) {
      mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.ANIMATED);
      mesh.physics.disablePreStep = false;
    }
  });

  onExit(() => gizmoManager.gizmos.rotationGizmo.onDragStartObservable.remove(rotDragStart));

  const rotDragEnd = gizmoManager.gizmos.rotationGizmo.onDragEndObservable.add(function () {
    let mesh = gizmoManager.attachedMesh;
    while (mesh?.parent && !mesh.parent.physics) {
      mesh = mesh.parent;
    }

    // Is there any physics to restore?
    if (isBodyAlive(mesh?.physics) && mesh.savedMotionType != null) {
      mesh.physics.setMotionType(mesh.savedMotionType);
    }

    // Write all three Euler values: one gizmo ring rotates about a world
    // axis, which a single YawPitchRoll value generally cannot represent, so
    // writing one axis would disagree with the mesh and jump on re-run.
    // A group's orientation lives in its members (see below), so no
    // rotate_to is written for the group itself - that would apply twice.
    if (mesh?.metadata?.shapeType !== 'Group') updateRotationBlock(mesh);
    updateChildBlockRotations(mesh);
  });

  onExit(() => gizmoManager.gizmos.rotationGizmo.onDragEndObservable.remove(rotDragEnd));
}

export function updateChildBlockRotations(mesh) {
  const rootKey = mesh?.metadata?.blockKey;
  // Only groups persist orientation in their members; other parents keep
  // the existing rotation-only behaviour.
  const isGroupRoot = mesh?.metadata?.shapeType === 'Group';
  const children = mesh?.getChildMeshes?.(false) || [];
  const seenKeys = new Set();

  children.forEach((child) => {
    const key = child?.metadata?.blockKey;
    if (!key || key === rootKey || seenKeys.has(key)) return;
    seenKeys.add(key);

    const childParent = child.parent;
    child.setParent(null);
    let rotation;
    let pos = null;
    try {
      rotation = getMeshRotationInDegrees(child);
      // A rotated group moves its members: persist world positions too, read
      // in the same unparented window, or re-run restores them unrotated.
      if (isGroupRoot) pos = flock.getBlockPositionFromMesh(child);
    } finally {
      child.setParent(childParent);
    }

    const rotateBlock = findOrCreateRotateBlock(child);
    if (rotateBlock) setBlockXYZ(rotateBlock, rotation.x, rotation.y, rotation.z);
    let memberBlock = null;
    if (isGroupRoot && pos) {
      memberBlock = meshMap[key];
      if (memberBlock && !memberBlock.disposed) {
        setBlockXYZ(memberBlock, pos.x, pos.y, pos.z);
      }
    }
    // Snap live onto the rounded blocks: set the world orientation while
    // unparented, then re-anchor the position to the rounded base.
    if (isGroupRoot && (rotateBlock || memberBlock)) {
      const parent = child.parent;
      child.setParent(null);
      try {
        if (rotateBlock && !rotateBlock.disposed) {
          const r = getXYZFromBlock(rotateBlock);
          if ([r.x, r.y, r.z].every((v) => Number.isFinite(Number(v)))) {
            child.rotationQuaternion = flock.eulerDegreesToQuat(
              Number(r.x),
              Number(r.y),
              Number(r.z)
            );
          }
        }
        if (memberBlock && !memberBlock.disposed) {
          const p = getXYZFromBlock(memberBlock);
          const live = flock.getBlockPositionFromMesh(child);
          const num = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
          flock.setBlockPositionOnMesh(child, {
            x: num(p.x, live.x),
            y: num(p.y, live.y),
            z: num(p.z, live.z),
            useY: true,
          });
        }
        flock.updatePhysics?.(child);
      } finally {
        child.setParent(parent);
      }
    }
  });

  // Rotating re-shapes the content bounds - re-centre the origin so the next
  // transform starts from a consistent pivot.
  if (isGroupRoot) flock.recomputeGroupGeometry(mesh);
}

// Position: Allow the user to move the mesh by dragging it
function handlePositionGizmo() {
  watchClickAwayFromCanvas();
  // A locked mesh may already be attached from Select; don't let move use it.
  detachIfAttachedMeshLocked();
  configurePositionGizmo(gizmoManager);
  observeDragAxis(gizmoManager.gizmos.positionGizmo);

  // Highlight the move button
  const positionButton = document.getElementById('positionButton');
  setGizmoButtonActive(positionButton, true);

  let keyboardAttachedMesh = null;
  let savedHudAxis = null;
  const activatePositionKeyboardForMesh = (mesh) => {
    if (!mesh) {
      exitTransformState();
      return;
    }

    if (keyboardAttachedMesh === mesh) return;
    keyboardAttachedMesh = mesh;

    showStatus(translate('gizmo_controls_hint'), {
      duration: 10,
      owner: 'gizmo-controls-hint',
      hint: true,
    });
    startMoveKeyboardHandler(mesh, savedHudAxis, (axis) => {
      if (axis) savedHudAxis = axis;
    });

    const blockKey = mesh?.metadata?.blockKey;
    const blockId = blockKey ? meshMap[blockKey] : null;
    if (!blockId) return;

    highlightBlockById(Blockly.getMainWorkspace(), blockId);
  };

  const posObs = gizmoManager.onAttachedToMeshObservable.add((mesh) => {
    activatePositionKeyboardForMesh(mesh);
  });

  onExit(() => gizmoManager.onAttachedToMeshObservable.remove(posObs));

  const mesh = gizmoManager.attachedMesh;
  if (mesh) {
    activatePositionKeyboardForMesh(mesh);
  } else {
    pickMeshFromScene(
      (pickedMesh) => {
        if (!pickedMesh || pickedMesh.name === 'ground') {
          exitTransformState();
          return;
        }
        if (pickedMesh.parent) {
          pickedMesh = getRootMesh(pickedMesh.parent);
        }
        gizmoManager.attachToMesh(pickedMesh);
      },
      false,
      translate('select_mesh_prompt')
    );
  }

  const posDragStart = gizmoManager.gizmos.positionGizmo.onDragStartObservable.add(() => {
    const mesh = gizmoManager.attachedMesh;
    if (!mesh) return;

    const motionType = isBodyAlive(mesh.physics) ? mesh.physics.getMotionType() : undefined;
    mesh.savedMotionType = motionType;

    if (motionType != null && motionType !== flock.BABYLON.PhysicsMotionType.ANIMATED) {
      mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.ANIMATED);
      mesh.physics.disablePreStep = false;
    }
  });

  onExit(() => gizmoManager.gizmos.positionGizmo.onDragStartObservable.remove(posDragStart));

  const posDragEnd = gizmoManager.gizmos.positionGizmo.onDragEndObservable.add(function () {
    const mesh = gizmoManager.attachedMesh;

    if (mesh.savedMotionType != null && isBodyAlive(mesh.physics)) {
      mesh.physics.setMotionType(mesh.savedMotionType);
    }
    mesh.computeWorldMatrix(true);

    const block = meshMap[mesh?.metadata?.blockKey];

    // One event group so the whole move — the moved mesh's block plus any
    // parented children's blocks — is a single undo.
    const groupId = Blockly.utils.idGenerator.genUid();
    Blockly.Events.setGroup(groupId);
    try {
      if (block && !block.disposed) {
        const blockPosition = flock.getBlockPositionFromMesh(mesh);
        setBlockXYZ(block, blockPosition.x, blockPosition.y, blockPosition.z);
      }
      updateChildBlockPositions(mesh);
    } finally {
      Blockly.Events.setGroup(false);
    }
  });

  onExit(() => gizmoManager.gizmos.positionGizmo.onDragEndObservable.remove(posDragEnd));
}

// Bounds: Allow the user to move the mesh
// Legacy?
function _handleBoundsGizmo() {
  gizmoManager.boundingBoxGizmoEnabled = true;
  gizmoManager.boundingBoxDragBehavior.onDragStartObservable.add(function () {
    const mesh = gizmoManager.attachedMesh;

    if (!isBodyAlive(mesh?.physics)) return;

    const motionType = mesh.physics.getMotionType();
    mesh.savedMotionType = motionType;

    if (motionType != null && motionType !== flock.BABYLON.PhysicsMotionType.STATIC) {
      mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.STATIC);
      mesh.physics.disablePreStep = false;
    }

    const block = meshMap[mesh?.metadata?.blockKey];
    highlightBlockById(Blockly.getMainWorkspace(), block);
  });

  gizmoManager.boundingBoxDragBehavior.onDragEndObservable.add(function () {
    const mesh = gizmoManager.attachedMesh;

    if (mesh.savedMotionType != null && isBodyAlive(mesh.physics)) {
      mesh.physics.setMotionType(mesh.savedMotionType);
    }

    mesh.computeWorldMatrix(true);

    const block = meshMap[mesh?.metadata?.blockKey];

    if (block && !block.disposed) {
      const blockPosition = flock.getBlockPositionFromMesh(mesh);
      setBlockXYZ(block, blockPosition.x, blockPosition.y, blockPosition.z);
    }
  });
}

// Select: Allow the user to select a mesh by clicking on it
function handleSelectGizmo() {
  watchClickAwayFromCanvas();
  setGizmoButtonActive(document.getElementById('selectButton'), true);

  function applySelection(pickedMesh, pickedPoint) {
    applyMeshSelection(pickedMesh, pickedPoint);
    // A pick can land on a child; the attached mesh is the root owning the block.
    const attached = gizmoManager.attachedMesh;
    if (attached) {
      showStatus(positionStatus(flock.getBlockPositionFromMesh(attached)), {
        duration: 10,
        owner: 'position-readout',
      });
    }
    setTimeout(() => {
      if (!getCanvasCircle()) document.body.style.cursor = 'crosshair';
    }, 0);
  }

  // Use helper function to pick the mesh
  pickMeshFromScene(applySelection, true, translate('select_mesh_prompt'));
}

// Duplicate: Create a copy of the selected mesh and its corresponding block,
// and allow the user to place it by clicking on the canvas
function handleDuplicateGizmo() {
  // Set button active state
  const duplicateButton = document.getElementById('duplicateButton');
  setGizmoButtonActive(duplicateButton, true);

  // Check if mesh already selected, if not prompt to select
  if (!gizmoManager.attachedMesh) {
    pickMeshFromScene(
      (pickedMesh) => {
        if (!pickedMesh || pickedMesh.name === 'ground') {
          exitTransformState();
          return;
        }
        attachMeshForActiveTool(pickedMesh);
        startDuplicatePlacement();
      },
      false,
      translate('select_mesh_duplicate_prompt')
    );
    return;
  }

  // Place the duplicate
  startDuplicatePlacement();
}

// Delete: Remove the selected mesh and its corresponding block
function handleDeleteGizmo() {
  watchClickAwayFromCanvas();
  // Highlight the button
  setGizmoButtonActive(document.getElementById('deleteButton'), true);

  function applyDelete(pickedMesh) {
    if (!pickedMesh || pickedMesh.name === 'ground') {
      setTimeout(() => {
        if (document.getElementById('deleteButton')?.classList.contains('active')) {
          pickMeshFromScene(applyDelete, false, translate('select_mesh_delete_prompt'));
        }
      }, 0);
      return;
    }
    const blockKey = findParentWithBlockId(pickedMesh)?.metadata?.blockKey;
    const blockId = meshBlockIdMap[blockKey];
    deleteBlockWithUndo(blockId);
    setTimeout(() => {
      if (document.getElementById('deleteButton')?.classList.contains('active')) {
        pickMeshFromScene(applyDelete, false, translate('select_mesh_delete_prompt'));
      }
    }, 0);
  }

  // If a mesh selected, delete it instantly
  if (gizmoManager.attachedMesh) {
    applyDelete(gizmoManager.attachedMesh);
    return;
  }

  // Explain how to delete
  pickMeshFromScene(applyDelete, false, translate('select_mesh_delete_prompt'));
}

const isTouchDevice = () =>
  'ontouchstart' in window ||
  navigator.maxTouchPoints > 0 ||
  window.matchMedia('(pointer: coarse)').matches;

// Camera: Toggle between play and fly camera modes
function handleCameraGizmo() {
  // If orbit-view is active, the camera button's job is just to exit orbit
  // and return to whichever camera was active before it — the player's
  // follow camera if that's what was showing, not a fly/play toggle on top
  // (cameraMode is always 'play' during orbit, so that toggle would always
  // land on the fly camera regardless of what was really active before).
  if (flock.scene.activeCamera?.metadata?.orbitView) {
    disconnectOrbitView();
    return;
  }

  const cameraButton = document.getElementById('cameraButton');

  if (cameraMode === 'play') {
    cameraMode = 'fly';
    flock.inputManager?.setInputOwner('editor');
    showStatus(
      translate(isTouchDevice() ? 'fly_camera_instructions_touch' : 'fly_camera_instructions'),
      { duration: 15, owner: 'camera', hint: true }
    );
    setGizmoButtonActive(cameraButton, true);
  } else {
    cameraMode = 'play';
    flock.inputManager?.setInputOwner('project');
    setGizmoButtonActive(cameraButton, false);
  }

  const currentCamera = flock.scene.activeCamera;
  currentCamera.detachControl();

  flock.scene.activeCamera = flock.savedCamera;
  flock.savedCamera = currentCamera;
  // Focus the canvas so you can use the camera controls
  const canvas = flock.scene.getEngine().getRenderingCanvas();
  flock.scene.activeCamera.attachControl(canvas, false);
  canvas.focus();
}

function turnOffAllGizmos() {
  if (!gizmoManager) return;
  resetBoundingBoxVisibilityIfManuallyChanged(gizmoManager.attachedMesh);
  resetAttachedMeshIfMeshAttached();
  gizmoManager.attachToMesh(null);
  disableGizmos();
}

// Add undo handler to clean up DO sections when undoing block creation
function addUndoHandler() {
  const workspace = Blockly.getMainWorkspace();

  if (workspace._gizmoUndoHandlerRegistered) return;
  workspace._gizmoUndoHandlerRegistered = true;

  workspace.addChangeListener(function (event) {
    if (event.type === Blockly.Events.BLOCK_DELETE && event.oldJson) {
      const deletedBlockId = event.blockId;

      // Check if this was a gizmo-created block
      if (gizmoCreatedBlocks.has(deletedBlockId)) {
        const blockInfo = gizmoCreatedBlocks.get(deletedBlockId);
        const { parentId, createdDoSection, timestamp } = blockInfo;

        // Remove from tracking
        gizmoCreatedBlocks.delete(deletedBlockId);

        // If this block created the DO section, check if we should remove it
        if (createdDoSection) {
          const parentBlock = workspace.getBlockById(parentId);
          if (parentBlock) {
            const doInput = parentBlock.getInput('DO');

            // Check if DO section is now empty or only contains blocks created after this one
            let shouldRemoveDoSection = true;
            if (doInput && doInput.connection.targetBlock()) {
              let currentBlock = doInput.connection.targetBlock();

              // Check all blocks in the DO section
              while (currentBlock) {
                const blockInfo = gizmoCreatedBlocks.get(currentBlock.id);

                // If there's a block that wasn't created by gizmos, or was created before this block, keep DO section
                if (!blockInfo || blockInfo.timestamp < timestamp) {
                  shouldRemoveDoSection = false;
                  break;
                }

                currentBlock = currentBlock.getNextBlock();
              }
            }

            // Remove DO section if it should be removed
            if (shouldRemoveDoSection && doInput) {
              // Mirror toggleDoBlock so the mutator button reverts to "+".
              if (typeof parentBlock.toggleDoBlock === 'function') {
                parentBlock.toggleDoBlock();
              } else {
                parentBlock.removeInput('DO');
              }
            }
          }
        }
      }
    }
  });
}

// While eye is the only active gizmo, clicking a different mesh in the
// canvas switches the orbit target to it instead of doing nothing. Once
// another gizmo (position/rotation/scale/...) is also active, this stays out
// of the way — that combination no longer retargets on a raw canvas click
// (see toggleGizmo's preserveOrbit handling), since a drag to rotate the
// orbit camera would trip the same pointerdown and exit the gizmo.
function watchEyeGizmoRetarget() {
  const scene = flock.scene;
  if (!scene) return;
  if (orbitRetargetObserver) scene.onPointerObservable.remove(orbitRetargetObserver);
  orbitRetargetObserver = scene.onPointerObservable.add((event) => {
    if (event.type !== flock.BABYLON.PointerEventTypes.POINTERPICK) return;
    if (document.querySelector('.gizmo-button.active:not(#eyeButton)')) return;
    if (!scene.activeCamera?.metadata?.orbitView) return;

    let pickedMesh = event.pickInfo?.pickedMesh;
    if (!pickedMesh || pickedMesh.name === 'ground') return;
    if (pickedMesh.parent) pickedMesh = getRootMesh(pickedMesh.parent);
    if (!pickedMesh || pickedMesh === window.orbitMesh) return;

    disconnectOrbitView();
    attachMeshForActiveTool(pickedMesh);
    attachOrbitView(pickedMesh); // re-registers this observer for the new target
    showStatus(translate('orbit_mesh_info'), { owner: 'eye-gizmo', hint: true });
  });
}

// Detach the eye-gizmo retarget-on-click observer. Called from every path
// that ends orbit view, so it never outlives the orbit camera it depends on.
function clearOrbitRetargetObserver() {
  if (!orbitRetargetObserver) return;
  flock.scene?.onPointerObservable?.remove(orbitRetargetObserver);
  orbitRetargetObserver = null;
}

// Eye: Orbit camera around selected or picked mesh
function handleEyeGizmo() {
  watchClickAwayFromCanvas();
  setGizmoButtonActive(document.getElementById('eyeButton'), true);

  const mesh = gizmoManager.attachedMesh;
  if (mesh && mesh.name !== 'ground') {
    attachOrbitView(mesh);
    showStatus(translate('orbit_mesh_info'), { owner: 'eye-gizmo', hint: true });
    return;
  }

  pickMeshFromScene(
    (pickedMesh) => {
      if (!pickedMesh || pickedMesh.name === 'ground') {
        exitGizmoState();
        return;
      }
      attachMeshForActiveTool(pickedMesh);
      attachOrbitView(pickedMesh);
      showStatus(translate('orbit_mesh_info'), { owner: 'eye-gizmo', hint: true });
    },
    false,
    translate('select_mesh_eye_prompt')
  );
}

export function enableGizmos() {
  // Initialize undo handler for DO section cleanup
  addUndoHandler();

  const positionButton = document.getElementById('positionButton');
  const rotationButton = document.getElementById('rotationButton');
  const scaleButton = document.getElementById('scaleButton');
  const selectButton = document.getElementById('selectButton');
  const duplicateButton = document.getElementById('duplicateButton');
  const deleteButton = document.getElementById('deleteButton');
  const cameraButton = document.getElementById('cameraButton');
  const eyeButton = document.getElementById('eyeButton');
  const showShapesButton = document.getElementById('showShapesButton');
  const colorPickerButton = document.getElementById('colorPickerButton');
  const aboutButton = document.getElementById('logo');

  const scrollShapesLeftButton = document.getElementById('scrollShapesLeftButton');
  const scrollShapesRightButton = document.getElementById('scrollShapesRightButton');
  const scrollModelsLeftButton = document.getElementById('scrollModelsLeftButton');
  const scrollModelsRightButton = document.getElementById('scrollModelsRightButton');
  const scrollObjectsLeftButton = document.getElementById('scrollObjectsLeftButton');
  const scrollObjectsRightButton = document.getElementById('scrollObjectsRightButton');
  const scrollCharactersLeftButton = document.getElementById('scrollCharactersLeftButton');
  const scrollCharactersRightButton = document.getElementById('scrollCharactersRightButton');

  // Enable the buttons

  const buttons = [
    positionButton,
    rotationButton,
    scaleButton,
    selectButton,
    duplicateButton,
    deleteButton,
    cameraButton,
    eyeButton,
    showShapesButton,
    colorPickerButton,
    aboutButton,
    scrollShapesLeftButton,
    scrollShapesRightButton,
    scrollModelsLeftButton,
    scrollModelsRightButton,
    scrollObjectsLeftButton,
    scrollObjectsRightButton,
    scrollCharactersLeftButton,
    scrollCharactersRightButton,
  ];

  const requiredButtons = [
    positionButton,
    rotationButton,
    scaleButton,
    selectButton,
    duplicateButton,
    deleteButton,
    cameraButton,
    eyeButton,
    showShapesButton,
    scrollShapesLeftButton,
    scrollShapesRightButton,
    scrollModelsLeftButton,
    scrollModelsRightButton,
    scrollObjectsLeftButton,
    scrollObjectsRightButton,
    scrollCharactersLeftButton,
    scrollCharactersRightButton,
  ];
  if (requiredButtons.some((button) => !button)) return;
  buttons.forEach((button) => button?.removeAttribute('disabled'));

  // Attach event listeners
  positionButton.addEventListener('click', () => toggleGizmo('position'));
  rotationButton.addEventListener('click', () => toggleGizmo('rotation'));
  scaleButton.addEventListener('click', () => toggleGizmo('scale'));
  selectButton.addEventListener('click', () => toggleGizmo('select'));
  cameraButton.addEventListener('click', () => toggleGizmo('camera'));
  eyeButton.addEventListener('click', () => toggleGizmo('eye'));
  duplicateButton.addEventListener('click', () => toggleGizmo('duplicate'));
  deleteButton.addEventListener('click', () => toggleGizmo('delete'));
  showShapesButton.addEventListener('click', () => {
    exitTransformState();
    window.showShapes();
  });
  scrollShapesLeftButton.addEventListener('click', () => window.scrollShapes(-1));
  scrollShapesRightButton.addEventListener('click', () => window.scrollShapes(1));
  scrollModelsLeftButton.addEventListener('click', () => window.scrollModels(-1));
  scrollModelsRightButton.addEventListener('click', () => window.scrollModels(1));
  scrollObjectsLeftButton.addEventListener('click', () => window.scrollObjects(-1));
  scrollObjectsRightButton.addEventListener('click', () => window.scrollObjects(1));
  scrollCharactersLeftButton.addEventListener('click', () => window.scrollCharacters(-1));
  scrollCharactersRightButton.addEventListener('click', () => window.scrollCharacters(1));
}

export function setGizmoManager(value) {
  gizmoManager = value;
  if (!value) return;

  // Every click-to-select flow in this file already goes through
  // pickMeshFromScene (a drag-aware POINTERPICK), not this built-in,
  // POINTERDOWN-driven auto-attach. Left at Babylon's default (true), it fires
  // on the very first pointerdown of an ordinary camera-look drag; since the
  // ground is pickable and fills most of the view, that pick lands on it and
  // attachToMesh's wrapper below (mesh.name === 'ground') calls
  // turnOffAllGizmos() — silently ending whatever gizmo was active before the
  // drag could rotate the camera at all. Orbit view already disables this for
  // the same reason; do it everywhere so a camera drag never steals selection.
  gizmoManager.usePointerToAttachGizmos = false;

  // A drop grouping the attached mesh moves the gizmo to the group root,
  // like a canvas pick. Anything else is left alone. Registered here, not at
  // module scope: the import cycle can leave blockmesh's binding in TDZ
  // during module evaluation. One-directional (gizmos -> blockmesh).
  setGroupSelectionFollower((memberMesh, groupMesh) => {
    if (!gizmoManager || gizmoManager.attachedMesh !== memberMesh) return;
    if (!groupMesh || groupMesh.isDisposed?.()) return;
    const block = meshMap[groupMesh.metadata?.blockKey];
    if (block) highlightBlockById(Blockly.getMainWorkspace(), block);
    gizmoManager.attachToMesh(groupMesh);
  });

  const originalAttach = gizmoManager.attachToMesh.bind(gizmoManager);
  let attachedMeshDisposeObserver = null;
  let meshWithDisposeObserver = null;

  const clearAttachedMeshDisposeObserver = () => {
    if (attachedMeshDisposeObserver && meshWithDisposeObserver) {
      meshWithDisposeObserver.onDisposeObservable.remove(attachedMeshDisposeObserver);
    }

    attachedMeshDisposeObserver = null;
    meshWithDisposeObserver = null;
  };
  gizmoManager.attachToMesh = (mesh) => {
    if (mesh && mesh.name === 'ground') {
      turnOffAllGizmos();
      mesh = null;
    }

    if (mesh?.parent) {
      mesh = getRootMesh(mesh.parent);
    }

    // Refuse to attach a transform gizmo to a locked mesh (select / duplicate /
    // view still attach so those tools keep working). Show a "no entry" cursor
    // and leave any current selection untouched.
    const transformActive =
      gizmoManager.positionGizmoEnabled ||
      gizmoManager.rotationGizmoEnabled ||
      gizmoManager.scaleGizmoEnabled;
    if (transformActive && isMeshLocked(mesh)) {
      showNotAllowedCursor();
      return;
    }

    if (mesh && mesh === gizmoManager.attachedMesh) return;

    clearAttachedMeshDisposeObserver();

    if (gizmoManager.attachedMesh) {
      resetAttachedMesh();

      const block = Blockly.getMainWorkspace().getBlockById(mesh?.metadata?.blockKey);

      if (block && gizmoManager.scaleGizmoEnabled) {
        switch (block.type) {
          case 'create_plane':
            gizmoManager.gizmos.scaleGizmo.zGizmo.isEnabled = false;

            break;

          default:
            gizmoManager.gizmos.scaleGizmo.zGizmo.isEnabled = true;
        }
      }
    }

    if (mesh && mesh.physics) {
      mesh.physics.disablePreStep = false;
    }

    originalAttach(mesh);

    if (mesh) {
      meshWithDisposeObserver = mesh;
      attachedMeshDisposeObserver = mesh.onDisposeObservable.add(() => {
        clearAttachedMeshDisposeObserver();
        turnOffAllGizmos();
      });
    }
  };

  // Show a "no entry" cursor when hovering a locked mesh while picking/gizmo
  // editing. Babylon re-applies scene.defaultCursor/hoverCursor on every pointer
  // move, so we drive those (not just canvas.style.cursor) and restore them when
  // leaving the locked mesh. Gated to pick/gizmo modes so we only pay for the
  // per-move scene.pick while editing.
  if (flock.scene && !flock.scene.__lockHoverObserver) {
    let saved = null; // { defaultCursor, hoverCursor, body, canvas }
    flock.scene.__lockHoverObserver = flock.scene.onPointerObservable.add((pi) => {
      if (pi.type !== flock.BABYLON.PointerEventTypes.POINTERMOVE) return;
      // Only a blocked tool (transform / colour / delete) should show the
      // no-entry cursor over a locked mesh; select / view / duplicate are fine.
      const active = blockedToolActive();
      const canvas = flock.canvas || flock.scene?.getEngine()?.getRenderingCanvas?.();

      let locked = false;
      if (active) {
        const pick = flock.scene.pick(
          flock.scene.pointerX,
          flock.scene.pointerY,
          (m) => m.isPickable && m.name !== 'ground'
        );
        const root = pick?.hit ? getRootMesh(pick.pickedMesh) : null;
        const blk = root && meshMap[root.metadata?.blockKey];
        locked = !!(blk && isBlockLocked(blk));
      }

      if (locked && !saved) {
        saved = {
          defaultCursor: flock.scene.defaultCursor,
          hoverCursor: flock.scene.hoverCursor,
          body: document.body.style.cursor,
          canvas: canvas?.style.cursor,
        };
        flock.scene.defaultCursor = 'not-allowed';
        flock.scene.hoverCursor = 'not-allowed';
        document.body.style.cursor = 'not-allowed';
        if (canvas) canvas.style.cursor = 'not-allowed';
      } else if (!locked && saved) {
        flock.scene.defaultCursor = saved.defaultCursor;
        flock.scene.hoverCursor = saved.hoverCursor;
        document.body.style.cursor = saved.body;
        if (canvas) canvas.style.cursor = saved.canvas ?? '';
        saved = null;
      }
    });
  }

  // Clicking a different mesh while a transform gizmo (position/rotation/
  // scale) is active retargets it there — the replacement for the
  // usePointerToAttachGizmos behaviour disabled above. POINTERPICK (unlike
  // POINTERDOWN) is click/drag-aware, so a drag to rotate the camera never
  // fires it; same mechanism as watchEyeGizmoRetarget, which handles the
  // equivalent case for the orbit target.
  if (flock.scene && !flock.scene.__transformRetargetObserver) {
    flock.scene.__transformRetargetObserver = flock.scene.onPointerObservable.add((event) => {
      if (event.type !== flock.BABYLON.PointerEventTypes.POINTERPICK) return;
      // Babylon's click detection doesn't filter by button — a right-click
      // (or middle-click) that doesn't drag fires POINTERPICK too. Only a
      // primary-button click should retarget the gizmo.
      if (event.event?.button !== 0) return;
      if (!gizmoManager) return;
      const transformActive =
        gizmoManager.positionGizmoEnabled ||
        gizmoManager.rotationGizmoEnabled ||
        gizmoManager.scaleGizmoEnabled;
      if (!transformActive) return;

      let pickedMesh = event.pickInfo?.pickedMesh;
      if (!pickedMesh || pickedMesh.name === 'ground') return;
      if (pickedMesh.parent) pickedMesh = getRootMesh(pickedMesh.parent);
      if (!pickedMesh || pickedMesh === gizmoManager.attachedMesh) return;

      // Wrapped attachToMesh (above) already handles locked meshes, parent
      // resolution and the dispose observer, but it also hides the bounding
      // box of whatever was attached before (resetAttachedMesh) — normally
      // right, but while orbiting that "before" mesh is usually the orbited
      // one, so its box would vanish even though the orbit camera is still
      // centred on it. Only the orbited mesh's box is restored: the new gizmo
      // target gets no box of its own, matching how this retarget behaved
      // before (Babylon's native pointer-attach never granted one either).
      gizmoManager.attachToMesh(pickedMesh);
      if (flock.scene?.activeCamera?.metadata?.orbitView && window.orbitMesh && !window.orbitMesh.isDisposed?.()) {
        enableBoundingBox(window.orbitMesh);
      }
    });
  }
}

export function disposeGizmoManager() {
  exitGizmoState(); // Clear up gizmo state and event listeners
  if (cameraMode === 'fly') {
    cameraMode = 'play';
    flock.inputManager?.setInputOwner('project');
    setGizmoButtonActive(document.getElementById('cameraButton'), false);
  }
  if (gizmoManager) {
    gizmoManager.dispose();
    gizmoManager = null; // Clear the global reference for garbage collection
  }
}

export function configurePositionGizmo(
  gizmoManager,
  {
    enable = true,
    snapDistance = 0.1,
    dragDeltaRatio = 0.2,
    smoothDrag = true,
    xColor = blueColor,
    yColor = greenColor,
    zColor = orangeColor,
    updateToMatchAttachedMesh = true,
  } = {}
) {
  if (!gizmoManager) return;

  gizmoManager.positionGizmoEnabled = enable;

  const pg = gizmoManager.gizmos?.positionGizmo;
  if (!pg) return;

  pg.snapDistance = snapDistance;

  [pg.xGizmo, pg.yGizmo, pg.zGizmo].forEach((axisGizmo) => {
    const dragBehavior = axisGizmo?.dragBehavior;
    if (!dragBehavior) return;
    dragBehavior.dragDeltaRatio = dragDeltaRatio;
    dragBehavior.smoothDrag = smoothDrag;
  });

  if (pg.xGizmo?._coloredMaterial) pg.xGizmo._coloredMaterial.diffuseColor = xColor;
  if (pg.yGizmo?._coloredMaterial) pg.yGizmo._coloredMaterial.diffuseColor = yColor;
  if (pg.zGizmo?._coloredMaterial) pg.zGizmo._coloredMaterial.diffuseColor = zColor;

  pg.updateGizmoPositionToMatchAttachedMesh = updateToMatchAttachedMesh;
  pg.updateGizmoRotationToMatchAttachedMesh = false;
}

export function configureRotationGizmo(
  gizmoManager,
  {
    enable = true,
    xColor = blueColor,
    yColor = greenColor,
    zColor = orangeColor,
    updateToMatchAttachedMesh = false,
  } = {}
) {
  if (!gizmoManager) return;

  gizmoManager.rotationGizmoEnabled = enable;

  const rg = gizmoManager.gizmos?.rotationGizmo;
  if (!rg) return;

  if (rg.xGizmo?._coloredMaterial) rg.xGizmo._coloredMaterial.diffuseColor = xColor;
  if (rg.yGizmo?._coloredMaterial) rg.yGizmo._coloredMaterial.diffuseColor = yColor;
  if (rg.zGizmo?._coloredMaterial) rg.zGizmo._coloredMaterial.diffuseColor = zColor;

  rg.updateGizmoRotationToMatchAttachedMesh = updateToMatchAttachedMesh;
}

export function configureScaleGizmo(
  gizmoManager,
  {
    enable = true,
    preserveScaling = true,
    xColor = blueColor,
    yColor = greenColor,
    zColor = orangeColor,
    sensitivity = 4,
    uniformScaleRatio = 2.5,
  } = {}
) {
  if (!gizmoManager) return;

  gizmoManager.scaleGizmoEnabled = enable;

  const sg = gizmoManager.gizmos?.scaleGizmo;
  if (!sg) return;

  sg.PreserveScaling = preserveScaling;

  if (sg.xGizmo?._coloredMaterial) sg.xGizmo._coloredMaterial.diffuseColor = xColor;
  if (sg.yGizmo?._coloredMaterial) sg.yGizmo._coloredMaterial.diffuseColor = yColor;
  if (sg.zGizmo?._coloredMaterial) sg.zGizmo._coloredMaterial.diffuseColor = zColor;

  sg.sensitivity = sensitivity;

  if (sg.uniformScaleGizmo) sg.uniformScaleGizmo.scaleRatio = uniformScaleRatio;
}

// Export functions for global access
window.toggleGizmo = toggleGizmo;
window.turnOffAllGizmos = turnOffAllGizmos;
if (DEBUG) {
  window._debugPick = () => flock.scene.onPointerObservable._observers.length;
}
