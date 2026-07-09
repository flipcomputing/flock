import * as Blockly from 'blockly';
import { meshMap, meshBlockIdMap } from '../generators/generators.js';
import { flock } from '../flock.js';
import { translate } from '../main/translation.js';
import {
  getBlockKeyFromBlock,
  getMeshFromBlockKey,
  getMeshFromBlock,
  getRootMesh,
  updateBlockColorAndHighlight,
} from './blockmesh.js';
import {
  highlightBlockById,
  getCanvasXAndCanvasYValues,
  setBlockXYZ,
  duplicateBlockAndInsert,
  findParentWithBlockId,
  setNumberInputs,
  getNumberInput,
  isBlockLocked,
} from './blocklyutil.js';
import { getMeshRotationInDegrees, roundVectorToFixed, pickLeafFromRay } from './meshhelpers.js';
import {
  startCanvasKeyboardMode,
  stopCanvasKeyboardMode,
  getCanvasCircle,
  setCrosshairCursor,
  setDefaultCursor,
} from './canvas-utils.js';
import { createAxisKeyboardHandler } from './axis-keyboard.js';
import { createGizmoMobileHud } from './gizmo-mobile-hud.js';
import { KeyboardDispatcher } from '../main/keyboardDispatcher.js';
import { GizmoMenuManager } from '../accessibility/keyboardui.js';
import { isBodyAlive } from '../api/physics.js';
export let gizmoManager;

// Enable debug messages
const DEBUG = true;

const blueColor = flock.BABYLON.Color3.FromHexString('#0072B2'); // Colour for X-axis
const greenColor = flock.BABYLON.Color3.FromHexString('#009E73'); // Colour for Y-axis
const orangeColor = flock.BABYLON.Color3.FromHexString('#D55E00'); // Colour for Z-axis

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

window.selectedColor = '#ffffff'; // Default color
let colorPicker = null;

// 3D text scale gizmo axis tracking
let textScaleAxis = null;
let textOrigScaleZ = 1;

// Track state
let cameraMode = 'play';
let activePick = null; // [Select mesh?]
let activeDuplicatePickHandler = null; // [Clone mesh?]
let stopAxisKeyboard = null; // Axis keyboard active?
let duplicateModeActive = false;
let duplicateRafId = null;
let orbitSavedCamera = null; // Free camera stashed while orbit-view is active
let orbitViewObserver = null; // Observer handle for orbit-view selection tracking
let orbitPreviousGizmoType = null; // Gizmo active before entering orbit, restored on exit

// Keep track of things to clean up
const cleanupFns = [];

// Track DO sections and their associated blocks for cleanup
const gizmoCreatedBlocks = new Map(); // blockId -> { parentId, createdDoSection, timestamp }

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

  let lastReportedAxis = initialKeyboardAxis ?? null;
  function onKbAxisChange(axis) {
    if (axis) hud?.setAxis(axis);
    if (axis !== lastReportedAxis) {
      lastReportedAxis = axis;
      onAxisChange?.(axis);
    }
  }

  function onHudAxisChange(axis) {
    if (keyboard?.getAxis?.()) {
      flock.printText({ text: translate('axis_free'), duration: 10, color: 'black' });
    }
    keyboard?.setAxis?.(null);
    lastReportedAxis = axis;
    onAxisChange?.(axis);
  }

  hud = createGizmoMobileHud({ onMove, stepNormal, stepFast, mode, showUniform, stepLabels, onAxisChange: onHudAxisChange, stepLabelsByAxis, getValues, initialAxis: initialHudAxis ?? initialKeyboardAxis });
  keyboard = createAxisKeyboardHandler({ onMove, onConfirm, onCancel, stepNormal, stepFast, onAxisChange: onKbAxisChange, initialAxis: initialKeyboardAxis, allowUniform: showUniform });
  const startAxis = initialKeyboardAxis ?? initialHudAxis;
  if (startAxis) onAxisChange?.(startAxis);
  flock.canvas?.focus();

  function stop() {
    onHudHide?.();
    hud?.();
    keyboard?.();
  }
  stop.setAxis = (axis) => {
    if (axis) hud?.setAxis(axis);
    lastReportedAxis = axis;
    onAxisChange?.(axis);
  };
  stop.getAxis = () => keyboard?.getAxis?.() ?? null;
  return stop;
}

// Register input handlers for gizmo actions
function registerBindings() {
  const noMod = (fn) => (e) => {
    if (!e.ctrlKey && !e.altKey && !e.metaKey) fn(e);
  };
  // Focus on mesh with V or F key
  KeyboardDispatcher.on('GIZMO', 'KeyF', noMod(focusCameraOnMesh));
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
  // Delete selected mesh with Del key
  KeyboardDispatcher.on('GIZMO', 'Delete', (e) => {
    if (!gizmoManager?.attachedMesh) return;
    if (Blockly.getMainWorkspace()?.getInjectionDiv()?.contains(e.target)) return;
    e.stopPropagation();
    const blockKey = findParentWithBlockId(gizmoManager.attachedMesh)?.metadata?.blockKey;
    deleteBlockWithUndo(meshBlockIdMap[blockKey]);
  });
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
        const cameraButton = document.getElementById('cameraButton');
        if (cameraButton?.classList.contains('active')) handleCameraGizmo();
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
        // Re-activate button: painting mode is still a gizmo action
        document.getElementById('colorPickerButton')?.classList.add('active');
        pickMeshFromCanvas();
      },
      excludeFromClose: (target) => {
        // Don't close when clicking the 3D canvas — canvas clicks paint meshes directly
        const canvas = document.getElementById('renderCanvas');
        if (canvas && (canvas === target || canvas.contains(target))) return true;
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
      if (colorPicker) {
        KeyboardDispatcher.clearModes();
        GizmoMenuManager.toggle(false);
        colorPicker.open(window.selectedColor);
      }
    });
  }
});

function pickMeshFromCanvas() {
  const canvas = flock.scene?.getEngine?.().getRenderingCanvas?.();
  if (!canvas || !flock.scene) return;
  GizmoMenuManager.toggle(true);

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
    window.removeEventListener('click', onPickMesh);
    stopCanvasKeyboardMode();
    document.body.style.cursor = 'default';
    if (flock.scene) flock.scene.defaultCursor = '';
  });

  startCanvasKeyboardMode((x, y) => applyColorAtPosition(x, y));
  document.body.style.cursor = 'crosshair';
  flock.scene.defaultCursor = 'crosshair';

  setTimeout(() => {
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

function resetAttachedMesh() {
  if (!gizmoManager?.attachedMesh) return;
  hideBoundingBox(gizmoManager.attachedMesh);
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
  return ['positionButton', 'rotationButton', 'scaleButton', 'colorPickerButton', 'deleteButton'].some(
    (id) => document.getElementById(id)?.classList.contains('active')
  );
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

function deleteBlockWithUndo(blockId) {
  const workspace = Blockly.getMainWorkspace();
  const block = workspace.getBlockById(blockId);

  // Refuse to delete a mesh whose block is locked.
  if (block && isBlockLocked(block)) {
    showNotAllowedCursor();
    return;
  }

  if (block) {
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
  } else {
    console.log(`Block with ID ${blockId} not found.`);
  }
}

function focusCameraOnMesh(overrideMesh) {
  let mesh = overrideMesh ?? gizmoManager.attachedMesh;
  if (mesh && mesh.name === 'ground') mesh = null;
  if (!mesh && window.currentBlock) {
    mesh = getMeshFromBlock(window.currentBlock);
    if (mesh && mesh.name === 'ground') mesh = null;
  }
  if (!mesh) return;
  applyMeshSelection(mesh);

  mesh.computeWorldMatrix(true);
  const { min, max } = mesh.getHierarchyBoundingVectors(true);
  const newTarget = flock.BABYLON.Vector3.Center(min, max);

  if (flock.scene.activeCamera?.metadata?.following) {
    handleCameraGizmo();
  }

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
    const roundedPosition = roundVectorToFixed(pickedPoint, 2);
    flock.printText({
      text: translate('position_readout').replace('{position}', String(roundedPosition)),
      duration: 30,
      color: 'black',
    });
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

  if (!camera?.metadata?.following) {
    if (camera?.metadata?.orbitView) {
      // Toggle off if: V key (no block), or eye button on the already-orbited mesh.
      // Switch if: eye button on a different mesh.
      if (!block || mesh === gizmoManager.attachedMesh) {
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
    return;
  }

  if (!mesh) return;

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

// Attach an ArcRotateCamera that orbits the given mesh (free-camera mode only).
function attachOrbitView(mesh) {
  const BABYLON = flock.BABYLON;
  const scene = flock.scene;
  const freeCamera = scene.activeCamera;
  if (!freeCamera) return;

  // Make sure the mesh is the selected one so the selection-tracking
  // observable below is meaningful (deselect/delete/select-other -> exit).
  applyMeshSelection(mesh);
  const selectedMesh = gizmoManager.attachedMesh ?? mesh;

  mesh.computeWorldMatrix(true);
  const { min, max } = mesh.getHierarchyBoundingVectors(true);
  const target = BABYLON.Vector3.Center(min, max);
  const size = max.subtract(min);
  const extent = Math.max(size.x, size.y, size.z);
  const radius = Math.max(extent * 2, 4);

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
  // Tag so the V toggle, the camera button and disconnect logic recognise it.
  // Stop pointer drags from re-attaching the gizmo (which would trip the
  // selection-change exit below); restore the prior setting on disconnect.
  orbitCamera.metadata = {
    orbitView: true,
    prevPointerAttach: gizmoManager.usePointerToAttachGizmos,
  };
  gizmoManager.usePointerToAttachGizmos = false;

  orbitSavedCamera = freeCamera;
  freeCamera.detachControl();
  scene.activeCamera = orbitCamera;
  const canvas = scene.getEngine().getRenderingCanvas();
  if (canvas) {
    orbitCamera.attachControl(canvas, false);
    canvas.focus();
  }

  // Exit when the selection ends or changes to a different mesh.
  orbitViewObserver = gizmoManager.onAttachedToMeshObservable.add((attached) => {
    if (attached !== selectedMesh) disconnectOrbitView();
  });
  window.orbitViewActive = true;
  window.orbitBlock = window.currentBlock ?? null;
  window.orbitMesh = selectedMesh;
  document.getElementById('eyeButton')?.classList.add('active');
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
    gizmoManager.onAttachedToMeshObservable.remove(orbitViewObserver);
    orbitViewObserver = null;
  }

  // Restore pointer-to-attach to whatever it was before orbit-view.
  gizmoManager.usePointerToAttachGizmos = orbitCamera.metadata.prevPointerAttach ?? true;

  orbitSavedCamera = null;
  orbitCamera.detachControl();
  scene.activeCamera = freeCamera;
  orbitCamera.dispose();
  return true;
}

// Standard orbit-view exit (V toggle, deselect, delete, select-other):
// return to the free camera and give it canvas control.
function disconnectOrbitView() {
  const prevMesh = window.orbitMesh;
  // Scene gone (disposal path): wipe all orbit globals so stale state never
  // persists across a scene reset, even though no camera restore is possible.
  if (!flock.scene?.activeCamera?.metadata?.orbitView) {
    window.orbitViewActive = false;
    window.orbitBlock = null;
    window.orbitMesh = null;
    document.getElementById('eyeButton')?.classList.remove('active');
    return;
  }
  // Orbit camera is active — attempt a real restore. If orbitSavedCamera is
  // missing or disposed restoreFreeCameraFromOrbit returns false; in that case
  // leave all state intact so the caller can see the system is still "stuck"
  // in orbit rather than silently desynchronising flags from camera state.
  if (!restoreFreeCameraFromOrbit()) return;
  window.orbitViewActive = false;
  window.orbitBlock = null;
  window.orbitMesh = null;
  document.getElementById('eyeButton')?.classList.remove('active');
  // BabylonJS may clear gizmoManager.attachedMesh when the orbit camera is
  // disposed or usePointerToAttachGizmos is restored. Re-attach so the mesh
  // stays selected and V can re-enter orbit without a pick prompt.
  if (prevMesh && !prevMesh.isDisposed?.()) {
    gizmoManager.attachToMesh(prevMesh);
    enableBoundingBox(prevMesh);
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
  const { originalMin, originalMax } = mesh.metadata || {};
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
  flock.retilePrimitiveUVs(
    mesh,
    { width: size.x, height: size.y, depth: size.z },
    mesh.scaling
  );
}

// Clean up gizmo state if aborted
export function exitGizmoState() {
  disconnectOrbitView();
  duplicateModeActive = false;
  if (duplicateRafId !== null) {
    cancelAnimationFrame(duplicateRafId);
    duplicateRafId = null;
  }

  cleanupScenePick(); // Stop picking

  // Properly clean up if duplicating
  if (activeDuplicatePickHandler) {
    window.removeEventListener('click', activeDuplicatePickHandler);
    activeDuplicatePickHandler = null;
  }

  // Stop the axis keyboard
  stopAxisKeyboard?.();
  stopAxisKeyboard = null;

  // Run all queued cleanup functions
  runCleanups();

  // Remove active class from all buttons
  document.querySelectorAll('.gizmo-button').forEach((btn) => btn.classList.remove('active'));
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
    if (block && !block.disposed) {
      const pos = flock.getBlockPositionFromMesh(mesh);
      setBlockXYZ(block, pos.x, pos.y, pos.z);
    }
  };
  const onConfirm = () => {
    exitGizmoState();
    document.getElementById('positionButton')?.focus();
  };
  const onCancel = () => {
    exitGizmoState();
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
    stepLabelsByAxis: { x: ['◁', '▷'], y: ['▽', '△'], z: ['▽', '△'], all: ['◁', '▷'] },
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

  const rotateBlock = findOrCreateRotateBlock(mesh);
  if (rotateBlock) {
    highlightBlockById(Blockly.getMainWorkspace(), rotateBlock);
  } else {
    const blockKey = mesh?.metadata?.blockKey;
    const creationBlock = blockKey ? meshMap[blockKey] : null;
    if (creationBlock) highlightBlockById(Blockly.getMainWorkspace(), creationBlock);
  }

  // Track the rotation as Euler degrees (the block's own representation) rather
  // than composing increments onto the quaternion and reading Euler back. A
  // single-axis drag then changes only that axis's value, and the mesh is
  // rebuilt with RotationYawPitchRoll — identical to what rotate_to applies — so
  // the live view always matches the block. This also makes each axis a
  // WORLD-axis rotation, like the drag arcs: rotating "Y" yaws a tilted mesh
  // about the vertical, instead of spinning it about its own (local) axis, which
  // on a shape symmetric about that axis (e.g. a capsule) looked like no change
  // and smeared every Euler component across all three block values.
  const working = (() => {
    const e = getMeshRotationInDegrees(mesh);
    return { x: e.x, y: e.y, z: e.z };
  })();
  const axisInput = { x: 'X', y: 'Y', z: 'Z' };
  // The slider/keyboard treat `working` as their source of truth, but the mouse
  // rotation gizmo (active at the same time) rotates the mesh without touching
  // `working`. Left alone, the next slider touch would rebuild the mesh from the
  // now-stale `working` and jump it off the mouse-dragged orientation. Re-seed
  // `working` from the mesh whenever the two have actually diverged (a no-op
  // during a continuous slider drag, where the mesh already equals `working`).
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
    exitGizmoState();
    document.getElementById('rotationButton')?.focus();
  };
  const onCancel = () => {
    exitGizmoState();
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

// Scale a mesh using the keyboard
function startScaleKeyboardHandler(mesh, savedHudAxis = null, onHudAxisSaved = null) {
  const initialKeyboardAxis = stopAxisKeyboard?.getAxis?.() ?? null;
  document.body.style.cursor = 'default';
  cleanupScenePick();
  stopAxisKeyboard?.();
  stopAxisKeyboard = null;

  const creationBlock = meshMap[mesh?.metadata?.blockKey];
  if (creationBlock) {
    if (MODEL_BLOCK_TYPES.has(creationBlock.type)) {
      const existingResize = findExistingResizeBlock(mesh);
      highlightBlockById(Blockly.getMainWorkspace(), existingResize ?? creationBlock);
    } else {
      highlightBlockById(Blockly.getMainWorkspace(), creationBlock);
    }
  }

  const onMove = (dx, dy, dz) => {
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
    exitGizmoState();
    document.getElementById('scaleButton')?.focus();
  };
  const onCancel = () => {
    exitGizmoState();
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
    initialKeyboardAxis,
    initialHudAxis: savedHudAxis,
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
    block.appendStatementInput('DO').setCheck(null).appendField('');
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
function updateRotationBlock(mesh, axisFilter = null) {
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
}

// Pick a mesh (used by multiple gizmos)
function pickMeshFromScene(onPicked, persistent = false) {
  cleanupScenePick(); // Stop picking
  resetAttachedMesh();
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
  if (!block || !MODEL_BLOCK_TYPES.has(block.type)) return null;
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
// Returns the resizeBlock, or null if mesh is not a model type.
function findOrCreateResizeBlock(mesh) {
  const block = meshMap[mesh?.metadata?.blockKey];
  if (!block || !MODEL_BLOCK_TYPES.has(block.type)) return null;

  const groupId = Blockly.utils.idGenerator.genUid();
  Blockly.Events.setGroup(groupId);

  let addedDoSection = false;
  if (!block.getInput('DO')) {
    block.appendStatementInput('DO').setCheck(null).appendField('');
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

    const doFirstBlock = block.getInput('DO').connection.targetBlock();
    if (doFirstBlock) {
      let tail = doFirstBlock;
      while (tail.getNextBlock()) tail = tail.getNextBlock();
      tail.nextConnection.connect(resizeBlock.previousConnection);
    } else {
      block.getInput('DO').connection.connect(resizeBlock.previousConnection);
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
function updateScaleBlock(mesh, originalBottomY = null) {
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
        setNumberInputs(block, { WIDTH: w, HEIGHT: h, DEPTH: d });
        break;

      case 'create_capsule':
        setNumberInputs(block, { HEIGHT: h, DIAMETER: w });
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
          currentTop > 0 &&
          currentBottom > 0
        ) {
          if (currentTop >= currentBottom) {
            newTop = newScaledDiameter;
            newBottom = newTop * (currentBottom / currentTop);
          } else {
            newBottom = newScaledDiameter;
            newTop = newBottom * (currentTop / currentBottom);
          }
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
      case 'load_character': {
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

function startDuplicatePlacement() {
  let blockKey, blockId, canvas, onPickMesh;
  if (!gizmoManager.attachedMesh) {
    flock.printText({
      text: translate('select_mesh_duplicate_prompt'),
      duration: 30,
      color: 'black',
    });
    return;
  }
  blockKey = findParentWithBlockId(gizmoManager.attachedMesh)?.metadata?.blockKey;

  // Make sure that if there is already a selected mesh
  // its bounding box is visible so the user knows what they are duplicating
  let meshToClone = gizmoManager.attachedMesh;
  enableBoundingBox(meshToClone);

  blockId = meshBlockIdMap[blockKey];
  duplicateModeActive = true;

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
      exitGizmoState();
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
        exitGizmoState();
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
  setTimeout(() => {
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
            exitGizmoState();
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
  // Is this gizmo already active? If so, toggle it off
  const button = document.getElementById(`${gizmoType}Button`);
  if (button?.classList.contains('active')) {
    if (gizmoType === 'camera') handleCameraGizmo();
    if (gizmoType === 'eye') {
      disconnectOrbitView();
      const prevType = orbitPreviousGizmoType;
      orbitPreviousGizmoType = null;
      if (prevType) {
        // Re-run the full activation flow for the previous tool so its
        // handlers (pick observer, drag handles, etc.) are live again —
        // not just its button class.
        toggleGizmo(prevType);
      } else {
        flock.scene?.getEngine()?.getRenderingCanvas()?.focus();
      }
      return;
    }
    exitGizmoState();
    return;
  }

  // No buttons should be highlighted
  if (gizmoType === 'eye') {
    const activeBtn = document.querySelector('.gizmo-button.active');
    orbitPreviousGizmoType = activeBtn?.id.replace('Button', '') ?? null;
  }
  document.querySelectorAll('.gizmo-button').forEach((btn) => btn.classList.remove('active'));

  // If they abandoned a duplicate half way, remove listener
  if (gizmoType === 'duplicate' && activeDuplicatePickHandler) {
    exitGizmoState();
    return;
  }

  exitGizmoState(); // Clean up any existing gizmo state
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
      focusCameraOnMesh();
      break;
    default:
      break;
  }
}

// Scale: Allow the user to scale the mesh by dragging it
function handleScaleGizmo() {
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
    if (!sg._textAxisObserversRegistered) {
      sg.xGizmo.dragBehavior.onDragStartObservable.add(() => (textScaleAxis = 'x'));
      sg.yGizmo.dragBehavior.onDragStartObservable.add(() => (textScaleAxis = 'y'));
      sg.zGizmo.dragBehavior.onDragStartObservable.add(() => (textScaleAxis = 'z'));
      sg.uniformScaleGizmo.dragBehavior.onDragStartObservable.add(
        () => (textScaleAxis = 'uniform')
      );
      sg._textAxisObserversRegistered = true;
    }
  }

  // Highlight scale button
  const scaleButton = document.getElementById('scaleButton');
  scaleButton.classList.add('active');

  let savedHudAxis = null;
  const mesh = gizmoManager.attachedMesh;
  if (mesh) {
    startScaleKeyboardHandler(mesh, savedHudAxis, (axis) => {
      if (axis) savedHudAxis = axis;
    });
  } else {
    pickMeshFromScene((pickedMesh) => {
      if (!pickedMesh || pickedMesh.name === 'ground') {
        exitGizmoState();
        return;
      }
      attachMeshForActiveTool(pickedMesh);
    });
  }

  let lastScaledMesh = gizmoManager.attachedMesh;
  const scaleObs = gizmoManager.onAttachedToMeshObservable.add((mesh) => {
    if (!mesh) {
      updateScaleBlock(lastScaledMesh); // update blockly block
      exitGizmoState();
      gizmoManager.attachToMesh(null); // unselect
      return;
    }

    lastScaledMesh = mesh;
    startScaleKeyboardHandler(mesh, savedHudAxis, (axis) => {
      if (axis) savedHudAxis = axis;
    });
  });

  onExit(() => gizmoManager.onAttachedToMeshObservable.remove(scaleObs));

  // Track bottom for correct visual anchoring
  let originalBottomY = 0;

  const scaleDrag = gizmoManager.gizmos.scaleGizmo.onDragObservable.add(() => {
    const mesh = gizmoManager.attachedMesh;

    mesh.scaling.x = Math.max(0.01, mesh.scaling.x);
    mesh.scaling.y = Math.max(0.01, mesh.scaling.y);
    mesh.scaling.z = Math.max(0.01, mesh.scaling.z);

    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo();

    const newBottomY = mesh.getBoundingInfo().boundingBox.minimumWorld.y;
    const deltaY = originalBottomY - newBottomY;
    mesh.position.y += deltaY;

    const block = Blockly.getMainWorkspace().getBlockById(mesh?.metadata?.blockKey);
    if (gizmoManager.scaleGizmoEnabled) {
      switch (block?.type) {
        case 'create_capsule':
        case 'create_cylinder':
          mesh.scaling.z = mesh.scaling.x;
          break;
        case 'create_3d_text':
          if (textScaleAxis === 'z') {
            // Z handle: depth only — lock X and Y
            mesh.scaling.x = 1;
            mesh.scaling.y = 1;
          } else if (textScaleAxis === 'x' || textScaleAxis === 'uniform') {
            // X or uniform: size only — keep Y = X, lock Z
            mesh.scaling.y = mesh.scaling.x;
            mesh.scaling.z = textOrigScaleZ;
          } else if (textScaleAxis === 'y') {
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
    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo();
    originalBottomY = mesh.getBoundingInfo().boundingBox.minimumWorld.y;
    textOrigScaleZ = mesh.scaling.z;
    textScaleAxis = null;

    const motionType = isBodyAlive(mesh.physics) ? mesh.physics.getMotionType() : undefined;
    mesh.savedMotionType = motionType;

    if (motionType != null && motionType !== flock.BABYLON.PhysicsMotionType.ANIMATED) {
      mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.ANIMATED);
      mesh.physics.disablePreStep = false;
    }

    const creationBlock = meshMap[mesh?.metadata?.blockKey];
    if (creationBlock) {
      if (MODEL_BLOCK_TYPES.has(creationBlock.type)) {
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
  });

  onExit(() => gizmoManager.gizmos.scaleGizmo.onDragStartObservable.remove(scaleDragStart));

  const scaleDragEnd = gizmoManager.gizmos.scaleGizmo.onDragEndObservable.add(() => {
    const mesh = gizmoManager.attachedMesh;
    textScaleAxis = null;

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
  // A locked mesh may already be attached from Select; don't let rotation use it.
  detachIfAttachedMeshLocked();
  configureRotationGizmo(gizmoManager);
  observeDragAxis(gizmoManager.gizmos.rotationGizmo);

  // Show that rotation is active
  const rotationButton = document.getElementById('rotationButton');
  rotationButton.classList.add('active');

  let savedHudAxis = null;
  const mesh = gizmoManager.attachedMesh;
  if (mesh) {
    startRotateKeyboardHandler(mesh, savedHudAxis, (axis) => {
      if (axis) savedHudAxis = axis;
    });
  } else {
    pickMeshFromScene((pickedMesh) => {
      if (!pickedMesh || pickedMesh.name === 'ground') {
        exitGizmoState();
        return;
      }
      attachMeshForActiveTool(pickedMesh);
    });
  }

  let lastRotatedMesh = gizmoManager.attachedMesh;

  const rotateObs = gizmoManager.onAttachedToMeshObservable.add((mesh) => {
    if (!mesh) {
      updateRotationBlock(lastRotatedMesh); // properly update block if they click out
      exitGizmoState();
      gizmoManager.attachToMesh(null);
      return;
    }

    lastRotatedMesh = mesh;

    startRotateKeyboardHandler(mesh, savedHudAxis, (axis) => {
      if (axis) savedHudAxis = axis;
    });
  });

  onExit(() => gizmoManager.onAttachedToMeshObservable.remove(rotateObs));

  const rotDragStart = gizmoManager.gizmos.rotationGizmo.onDragStartObservable.add(() => {
    const mesh = gizmoManager.attachedMesh;
    if (!mesh) return;

    const rotateBlock = findOrCreateRotateBlock(mesh);
    if (rotateBlock) {
      highlightBlockById(Blockly.getMainWorkspace(), rotateBlock);
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

    // Write all three Euler values so the block faithfully describes the mesh's
    // actual orientation. A single gizmo ring rotates about a world axis, which
    // in general cannot be represented by changing only one YawPitchRoll value
    // (unless the object is otherwise unrotated), so writing just one axis makes
    // the block disagree with the mesh and the object jumps when the block runs.
    updateRotationBlock(mesh);
  });

  onExit(() => gizmoManager.gizmos.rotationGizmo.onDragEndObservable.remove(rotDragEnd));
}

// Position: Allow the user to move the mesh by dragging it
function handlePositionGizmo() {
  // A locked mesh may already be attached from Select; don't let move use it.
  detachIfAttachedMeshLocked();
  configurePositionGizmo(gizmoManager);
  observeDragAxis(gizmoManager.gizmos.positionGizmo);

  // Highlight the move button
  const positionButton = document.getElementById('positionButton');
  positionButton.classList.add('active');

  let keyboardAttachedMesh = null;
  let savedHudAxis = null;
  const activatePositionKeyboardForMesh = (mesh) => {
    if (!mesh) {
      exitGizmoState();
      return;
    }

    if (keyboardAttachedMesh === mesh) return;
    keyboardAttachedMesh = mesh;

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
    pickMeshFromScene((pickedMesh) => {
      if (!pickedMesh || pickedMesh.name === 'ground') {
        exitGizmoState();
        return;
      }
      if (pickedMesh.parent) {
        pickedMesh = getRootMesh(pickedMesh.parent);
      }
      gizmoManager.attachToMesh(pickedMesh);
    });
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

    if (block && !block.disposed) {
      const blockPosition = flock.getBlockPositionFromMesh(mesh);
      setBlockXYZ(block, blockPosition.x, blockPosition.y, blockPosition.z);
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
  gizmoManager.selectGizmoEnabled = true;
  document.getElementById('selectButton')?.classList.add('active');

  function applySelection(pickedMesh, pickedPoint) {
    if (pickedMesh && pickedMesh.name !== 'ground') {
      const position = pickedMesh.getAbsolutePosition();
      const roundedPosition = roundVectorToFixed(position, 2);
      flock.printText({
        text: translate('position_readout').replace('{position}', String(roundedPosition)),
        duration: 30,
        color: 'black',
      });
    }
    applyMeshSelection(pickedMesh, pickedPoint);
    setTimeout(() => {
      if (!getCanvasCircle()) document.body.style.cursor = 'crosshair';
    }, 0);
  }

  // Use helper function to pick the mesh
  pickMeshFromScene(applySelection, true);
}

// Duplicate: Create a copy of the selected mesh and its corresponding block,
// and allow the user to place it by clicking on the canvas
function handleDuplicateGizmo() {
  // Set button active state
  const duplicateButton = document.getElementById('duplicateButton');
  duplicateButton.classList.add('active');

  // Check if mesh already selected, if not prompt to select
  if (!gizmoManager.attachedMesh) {
    flock.printText({
      text: translate('select_mesh_duplicate_prompt'),
      duration: 30,
      color: 'black',
    });
    pickMeshFromScene((pickedMesh) => {
      if (!pickedMesh || pickedMesh.name === 'ground') {
        exitGizmoState();
        return;
      }
      attachMeshForActiveTool(pickedMesh);
      startDuplicatePlacement();
    });
    return;
  }

  // Place the duplicate
  startDuplicatePlacement();
}

// Delete: Remove the selected mesh and its corresponding block
function handleDeleteGizmo() {
  // Highlight the button
  document.getElementById('deleteButton')?.classList.add('active');

  function applyDelete(pickedMesh) {
    if (!pickedMesh || pickedMesh.name === 'ground') {
      setTimeout(() => {
        if (document.getElementById('deleteButton')?.classList.contains('active')) {
          pickMeshFromScene(applyDelete, false);
        }
      }, 0);
      return;
    }
    const blockKey = findParentWithBlockId(pickedMesh)?.metadata?.blockKey;
    const blockId = meshBlockIdMap[blockKey];
    deleteBlockWithUndo(blockId);
    setTimeout(() => {
      if (document.getElementById('deleteButton')?.classList.contains('active')) {
        pickMeshFromScene(applyDelete, false);
      }
    }, 0);
  }

  // If a mesh selected, delete it instantly
  if (gizmoManager.attachedMesh) {
    applyDelete(gizmoManager.attachedMesh);
    return;
  }

  // Explain how to delete
  flock.printText({
    text: translate('select_mesh_delete_prompt'),
    duration: 30,
    color: 'black',
  });

  pickMeshFromScene(applyDelete);
}

// Camera: Toggle between play and fly camera modes
function handleCameraGizmo() {
  // If orbit-view is active, drop back to the free camera first so the
  // play/fly swap below operates on the normal camera pair. If there is no
  // saved play camera to swap to, just stay on the restored free camera.
  if (flock.scene.activeCamera?.metadata?.orbitView) {
    disconnectOrbitView();
    if (!flock.savedCamera) return;
  }

  const cameraButton = document.getElementById('cameraButton');

  if (cameraMode === 'play') {
    cameraMode = 'fly';
    flock._onScreenSource?.pause();
    flock._gamepadSource?.setFlyMode(true);
    flock._keyboardSource?.setFlyMode(true);
    flock.printText({
      text: translate('fly_camera_instructions'),
      duration: 15,
      color: 'white',
    });
    cameraButton.classList.add('active');
  } else {
    cameraMode = 'play';
    flock._onScreenSource?.resume();
    flock._gamepadSource?.setFlyMode(false);
    flock._keyboardSource?.setFlyMode(false);
    cameraButton.classList.remove('active');
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
              parentBlock.removeInput('DO');
            }
          }
        }
      }
    }
  });
}

// Eye: Orbit camera around selected or picked mesh
function handleEyeGizmo() {
  document.getElementById('eyeButton')?.classList.add('active');

  const mesh = gizmoManager.attachedMesh;
  if (mesh && mesh.name !== 'ground') {
    attachOrbitView(mesh);
    return;
  }

  flock.printText({
    text: translate('select_mesh_eye_prompt'),
    duration: 30,
    color: 'black',
  });
  pickMeshFromScene((pickedMesh) => {
    if (!pickedMesh || pickedMesh.name === 'ground') {
      exitGizmoState();
      return;
    }
    attachMeshForActiveTool(pickedMesh);
    attachOrbitView(pickedMesh);
  });
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
    exitGizmoState(); // Unhighlight other buttons
    window.showShapes();
  });
  scrollModelsLeftButton.addEventListener('click', () => window.scrollModels(-1));
  scrollModelsRightButton.addEventListener('click', () => window.scrollModels(1));
  scrollObjectsLeftButton.addEventListener('click', () => window.scrollObjects(-1));
  scrollObjectsRightButton.addEventListener('click', () => window.scrollObjects(1));
  scrollCharactersLeftButton.addEventListener('click', () => window.scrollCharacters(-1));
  scrollCharactersRightButton.addEventListener('click', () => window.scrollCharacters(1));
}

export function setGizmoManager(value) {
  gizmoManager = value;

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
    if (mesh) {
      const k = mesh.metadata?.blockKey;
      const b = meshMap[k];
      // TEMP lock debug — remove after diagnosis.
      console.log('[lock-debug] attachToMesh', {
        meshName: mesh.name,
        blockKey: k,
        resolvedBlockType: b?.type,
        blockLocked: !!b?.locked,
        isMeshLocked: isMeshLocked(mesh),
        transformActive,
      });
    }
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
          case 'create_capsule':
          case 'create_cylinder':
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
}

export function disposeGizmoManager() {
  exitGizmoState(); // Clear up gizmo state and event listeners
  if (cameraMode === 'fly') {
    cameraMode = 'play';
    flock._onScreenSource?.resume();
    flock._gamepadSource?.setFlyMode(false);
    flock._keyboardSource?.setFlyMode(false);
    document.getElementById('cameraButton')?.classList.remove('active');
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
