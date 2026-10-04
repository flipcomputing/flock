import * as Blockly from 'blockly';
import {
  meshMap,
  meshBlockIdMap,
  blockKeyByBlock,
  blockKeyByBlockId,
} from '../generators/generators.js';
import { getOwnDoOwner, getOwnVar } from '../generators/generators-utilities.js';
import { flock } from '../flock.js';

export { getOwnVar };
import { objectColours, TEXTURE_TILE_SIZE } from '../config.js';
import { createMeshOnCanvas, readTargetCameraOptions } from './addmeshes.js';
import { highlightBlockById, findParentWithBlockId, findOrCreateDoBlock } from './blocklyutil.js';
import { createBlockWithShadows } from './addmenu.js';

const colorFields = {
  HAIR_COLOR: true,
  SKIN_COLOR: true,
  EYES_COLOR: true,
  TSHIRT_COLOR: true,
  SHORTS_COLOR: true,
  SLEEVES_COLOR: true,
};

// blockKeyToMeshes: O(1) reverse index from blockKey → Set<mesh>, maintained via
// scene observables. Rebuilt lazily whenever new meshes are added to the scene.
const blockKeyToMeshes = new Map();
let _meshIndexScene = null;
let _meshIndexDirty = true;
let _meshRemovedHandle = null;
let _meshAddedHandle = null;

// Live edits to mesh-creating blocks during a run, block id → { colour, events }.
// Meshes spawned after an edit reconcile to the block's current values. Colour is
// a flag not a stored event: its source is a swappable child whose id goes stale
// on drag-out, so we re-resolve current colour instead. Cleared each run.
const liveEditsByBlock = new Map();

const CAMERA_BLOCK_TYPES = new Set([
  'create_fly_camera',
  'create_follow_camera',
  'create_orbit_camera',
]);

// 1:1 block-key → mesh types, so an edit replays onto one fresh mesh unambiguously.
// Model/character loads are multi-mesh/async — a follow-up.
const LATE_BOUND_CREATE_TYPES = new Set([
  'create_box',
  'create_sphere',
  'create_cylinder',
  'create_capsule',
  'create_wedge',
  'create_donut',
  'create_ring',
  'create_plane',
  'create_3d_text',
]);

export function resetLiveEditsForRun() {
  liveEditsByBlock.clear();
}

// CREATE included so colour-source removal is caught: drag-out detaches the moved
// block (its MOVE won't route back), but the respawning shadow fires a CREATE.
const RECORDED_EDIT_TYPES = new Set([
  Blockly.Events.BLOCK_CHANGE,
  Blockly.Events.BLOCK_MOVE,
  Blockly.Events.BLOCK_CREATE,
]);

// True when the change touches the colour input (value, drag in/out, or material
// subtree). Flags colour reconcile without pinning to the child id.
function isColourEdit(block, changeEvent) {
  if (!block?.getInputTargetBlock) return false;
  const names = block.type === 'load_multi_object' ? ['COLORS'] : ['COLOR'];

  if (names.includes(changeEvent.newInputName) || names.includes(changeEvent.oldInputName)) {
    return true;
  }
  if (['COLOR', 'COLOUR', 'COLORS', 'BASE_COLOR'].includes(changeEvent.name)) return true;

  for (const name of names) {
    const input = block.getInputTargetBlock(name);
    if (!input) continue;
    if (changeEvent.blockId === input.id) return true;
    if (
      isBlockIdDescendantOf(input, changeEvent.blockId) ||
      isBlockIdDescendantOf(input, changeEvent.newParentId) ||
      isBlockIdDescendantOf(input, changeEvent.oldParentId)
    ) {
      return true;
    }
  }
  return false;
}

export function recordLiveEdit(block, changeEvent) {
  if (!block || !RECORDED_EDIT_TYPES.has(changeEvent?.type)) return;
  if (!LATE_BOUND_CREATE_TYPES.has(block.type)) return;

  let rec = liveEditsByBlock.get(block.id);
  if (!rec) {
    rec = { colour: false, events: new Map() };
    liveEditsByBlock.set(block.id, rec);
  }

  // Flag colour rather than store a child-id event that goes stale on swap.
  if (isColourEdit(block, changeEvent)) {
    rec.colour = true;
    return;
  }

  const sig = `${changeEvent.blockId ?? ''}:${changeEvent.element ?? ''}:${changeEvent.name ?? ''}`;
  // Detached copy: Blockly reuses/mutates the live event object after dispatch.
  rec.events.set(sig, {
    type: changeEvent.type,
    element: changeEvent.element,
    name: changeEvent.name,
    blockId: changeEvent.blockId,
    newParentId: changeEvent.newParentId,
    oldParentId: changeEvent.oldParentId,
  });
}

// While a bulk editor operation owns a block's writes (bakeGroupScale), the
// live field-change cascade must stay out of that block: it would rebuild
// its mesh from half-written state. Scoped to block IDs, not a global flag:
// Blockly dispatches those change events several frames late, and a global
// flag held open that long could swallow an unrelated block's real events.
// Stored on globalThis so hot-reload module copies share the one cell.
const SUPPRESSED_BLOCK_IDS_KEY = '__flockSuppressedBlockIds';
// Bumped on every interception so the bake can poll for its event backlog
// draining (depth varies with how many members/fields it touched).
const SUPPRESS_HITS_KEY = '__flockSuppressLiveMeshUpdateHits';

function getSuppressedBlockIds() {
  try {
    if (!(globalThis[SUPPRESSED_BLOCK_IDS_KEY] instanceof Set)) {
      globalThis[SUPPRESSED_BLOCK_IDS_KEY] = new Set();
    }
    return globalThis[SUPPRESSED_BLOCK_IDS_KEY];
  } catch {
    return new Set();
  }
}

export function suppressBlockLiveUpdates(blockId) {
  if (!blockId) return;
  getSuppressedBlockIds().add(blockId);
}

export function unsuppressBlockLiveUpdates(blockId) {
  if (!blockId) return;
  getSuppressedBlockIds().delete(blockId);
}

function isBlockLiveUpdateSuppressed(blockId) {
  return !!blockId && getSuppressedBlockIds().has(blockId);
}

function noteSuppressedHit() {
  try {
    globalThis[SUPPRESS_HITS_KEY] = (globalThis[SUPPRESS_HITS_KEY] ?? 0) + 1;
  } catch {
    /* fall through */
  }
}

export function getSuppressedHitCount() {
  try {
    return globalThis[SUPPRESS_HITS_KEY] ?? 0;
  } catch {
    return 0;
  }
}

// Applies the block's current colour to one mesh; random re-rolls per call.
function applyBlockColourToMesh(block, mesh) {
  const changed = block.type === 'load_multi_object' ? 'COLORS' : 'COLOR';
  const { color, materialInfo } = resolveColorAndMaterialForBlock(block);
  handleMaterialOrColorChange(mesh, block, changed, color, materialInfo);
}

export function reconcileSpawnedMesh(mesh) {
  const blockKey = mesh?.metadata?.blockKey;
  if (!blockKey) return;

  const rec = liveEditsByBlock.get(blockKey);
  if (!rec) return;

  const block = meshMap[blockKey] || Blockly.getMainWorkspace()?.getBlockById(blockKey);
  if (!block || block.disposed) return;

  if (rec.colour) {
    applyBlockColourToMesh(block, mesh);
  }
  for (const event of rec.events.values()) {
    updateMeshFromBlock(mesh, block, event);
  }
}

function ensureMeshIndex() {
  const scene = flock.scene;
  if (!scene) return;

  if (scene !== _meshIndexScene) {
    if (_meshIndexScene) {
      _meshIndexScene.onMeshRemovedObservable?.remove(_meshRemovedHandle);
      _meshIndexScene.onNewMeshAddedObservable?.remove(_meshAddedHandle);
    }
    _meshIndexScene = scene;
    _meshIndexDirty = true;

    _meshRemovedHandle = scene.onMeshRemovedObservable?.add((mesh) => {
      const key = mesh.metadata?.blockKey;
      if (key) blockKeyToMeshes.get(key)?.delete(mesh);
    });
    _meshAddedHandle = scene.onNewMeshAddedObservable?.add((mesh) => {
      _meshIndexDirty = true;
      // A mesh is added to the scene by its constructor, but the shape/model APIs
      // set metadata.blockKey *after* that. If anything rebuilds the index in
      // that window (e.g. another observer, or the second event of a duplicate),
      // the still-keyless mesh is skipped and the dirty flag is cleared — leaving
      // the mesh permanently unindexed. Re-assert dirty once the current
      // synchronous work (including the key assignment) has finished, so the next
      // lookup rebuilds with the key present. Same deferral lets us read the
      // blockKey to reconcile a post-edit spawn.
      queueMicrotask(() => {
        _meshIndexDirty = true;
        reconcileSpawnedMesh(mesh);
      });
    });
  }

  if (_meshIndexDirty) {
    blockKeyToMeshes.clear();
    for (const mesh of scene.meshes) {
      const key = mesh.metadata?.blockKey;
      if (!key) continue;
      let s = blockKeyToMeshes.get(key);
      if (!s) {
        s = new Set();
        blockKeyToMeshes.set(key, s);
      }
      s.add(mesh);
    }
    _meshIndexDirty = false;
  }
}

let activeSceneControllerBlockId = null;

export function getActiveSceneControllerBlockId() {
  return activeSceneControllerBlockId;
}

function setActiveSceneControllerBlockId(block) {
  activeSceneControllerBlockId = block?.id ?? null;
}

function isMainWorkspaceEvent(changeEvent, block) {
  const mainWs = Blockly.getMainWorkspace();
  const ws = block?.workspace;

  if (!ws) {
    if (flock.meshDebug)
      console.log('[isMainWorkspaceEvent] false: block has no workspace', {
        blockId: block?.id,
        eventType: changeEvent?.type,
        eventWorkspaceId: changeEvent?.workspaceId,
      });
    return false;
  }

  if (ws.isFlyout) {
    if (flock.meshDebug)
      console.log('[isMainWorkspaceEvent] false: block is in flyout workspace', {
        blockId: block?.id,
        eventType: changeEvent?.type,
        eventWorkspaceId: changeEvent?.workspaceId,
        blockWorkspaceId: ws.id,
        mainWorkspaceId: mainWs?.id,
      });
    return false;
  }

  if (ws !== mainWs) {
    if (flock.meshDebug)
      console.log('[isMainWorkspaceEvent] false: block is in a non-main, non-flyout workspace', {
        blockId: block?.id,
        eventType: changeEvent?.type,
        eventWorkspaceId: changeEvent?.workspaceId,
        blockWorkspaceId: ws.id,
        mainWorkspaceId: mainWs?.id,
      });
    return false;
  }

  if (changeEvent?.workspaceId && changeEvent.workspaceId !== ws.id) {
    if (flock.meshDebug)
      console.log('[isMainWorkspaceEvent] false: event workspaceId mismatch', {
        blockId: block?.id,
        eventType: changeEvent?.type,
        eventWorkspaceId: changeEvent.workspaceId,
        blockWorkspaceId: ws.id,
        mainWorkspaceId: mainWs?.id,
      });
    return false;
  }

  return true;
}

export function getRootMesh(mesh) {
  if (flock.meshDebug) console.log(mesh.parent);
  if (!mesh) return null;
  if (!mesh.parent) return mesh;
  return getRootMesh(mesh.parent);
}

export function deleteMeshFromBlock(blockId) {
  const blockKey = getBlockKeyFromBlockID(blockId) || blockId;

  if (!blockKey) {
    const block = Blockly.getMainWorkspace().getBlockById(blockId);
    if (block && block.type === 'create_map') {
      const mesh = flock?.scene?.getMeshByName('ground');
      if (mesh) {
        flock.disposeMesh(mesh);
        return;
      }
    }
  }

  const meshes = getMeshesFromBlockKey(blockKey);
  meshes.forEach((mesh) => {
    if (!mesh || mesh.name === '__root__') return;
    flock.disposeMesh(mesh);
  });

  // Remove mappings
  delete meshMap[blockKey];
  delete meshBlockIdMap[blockKey];
}

export function getBlockKeyFromBlock(block) {
  if (!block) return null;
  return blockKeyByBlock.get(block) ?? null;
}

export function getBlockKeyFromBlockID(blockId) {
  if (!blockId) return null;
  return blockKeyByBlockId.get(blockId) ?? null;
}

export function getMeshFromBlockKey(blockKey) {
  if (!blockKey) return undefined;
  ensureMeshIndex();
  const set = blockKeyToMeshes.get(blockKey);
  return set?.values().next().value;
}

export function getMeshesFromBlockKey(blockKey) {
  if (!blockKey) return [];
  ensureMeshIndex();
  const set = blockKeyToMeshes.get(blockKey);
  return set ? [...set] : [];
}

function isTransformBlock(block) {
  return block?.type === 'rotate_to' || block?.type === 'resize';
}

// A rotate_to/resize is an add block's initial transform only when it sits
// directly in that block's DO stack, is enabled, and names the block's own
// variable - the only case where Play applies it to that mesh unconditionally.
export function getInitialTransformOwner(transformBlock) {
  return isTransformBlock(transformBlock) ? getOwnDoOwner(transformBlock) : null;
}

const CLONE_LIKE_TYPES = new Set(['clone_mesh', 'mirror_mesh']);

// move_to_xyz / change_color only update live under a clone or mirror,
// whose own block has no position or colour inputs.
export function getCloneDoOwner(block) {
  if (block?.type !== 'move_to_xyz' && block?.type !== 'change_color') return null;
  const owner = getOwnDoOwner(block);
  return CLONE_LIKE_TYPES.has(owner?.type) ? owner : null;
}

function applyCloneDoBlock(block, owner, meshes = getMeshesFromBlock(owner)) {
  if (block.type === 'move_to_xyz') {
    const position = getXYZFromBlock(block);
    const useY = block.getFieldValue('USE_Y') === 'TRUE';
    meshes.forEach((mesh) => flock.positionAt(mesh.name, { ...position, useY }));
    return;
  }

  const color = readColourList(block.getInputTargetBlock('COLOR'));
  if (color == null || [].concat(color).includes(null)) return;
  meshes.forEach((mesh) => flock.changeColorMesh(mesh, color));
}

export function getMeshFromBlock(block) {
  if (!block) return null;

  if (block.type === 'create_map') {
    return flock?.scene?.getMeshByName('ground');
  }

  if (isTransformBlock(block)) {
    block = getInitialTransformOwner(block);
    if (!block) return null;
  }

  const blockKey = getBlockKeyFromBlock(block) || block.id;
  if (!blockKey) return null;

  return getMeshFromBlockKey(blockKey);
}

export function getMeshesFromBlock(block) {
  if (!block) return [];

  if (block.type === 'create_map') {
    const mesh = flock?.scene?.getMeshByName('ground');
    return mesh ? [mesh] : [];
  }

  if (isTransformBlock(block)) {
    block = getInitialTransformOwner(block);
    if (!block) return [];
  }

  const blockKey = getBlockKeyFromBlock(block) || block.id;
  if (!blockKey) return [];

  return getMeshesFromBlockKey(blockKey);
}

// Safe field getter. Returns null when field is missing or name is invalid.
function getBlockValue(block, fieldName) {
  if (!block) return null;
  if (typeof fieldName !== 'string' || !fieldName) return null;
  const fld = block.getField(fieldName);
  return fld ? fld.getValue() : null;
}

// Safe colour reader: supports single colour, lists, and random_colour via API.
export function readColourValue(block) {
  if (!block) return { value: null, kind: 'none' };

  const randomColour = () =>
    typeof flock?.randomColour === 'function' ? flock.randomColour() : '#71BC78';

  if (block.type === 'lists_create_with') {
    const list = [];
    for (const input of block.inputList) {
      const tb = input.connection?.targetBlock();
      if (!tb) continue;

      if (tb.type === 'random_colour') {
        const c = randomColour();
        list.push(c);
        continue;
      }

      if (tb.type === 'material') {
        list.push(materialDescriptor(tb));
        continue;
      }

      const c = safeGetFieldValue(tb, 'COLOR') ?? safeGetFieldValue(tb, 'COLOUR') ?? null;

      if (c) list.push(c);
    }
    return { value: list, kind: 'list' };
  }

  if (block.type === 'random_colour') {
    const c = randomColour();
    return { value: c, kind: 'single' };
  }

  if (block.type === 'gradient_colour') {
    const colors = readColourValue(block.getInputTargetBlock('COLORS'));
    const list = Array.isArray(colors.value) ? colors.value : colors.value ? [colors.value] : [];
    if (!list.length) return { value: null, kind: 'none' };

    return {
      value: {
        color: list,
        materialName: 'none.png',
        direction: Number(safeGetFieldValue(block, 'DIRECTION')) || 0,
      },
      kind: 'gradient',
    };
  }

  if (block.type === 'material') {
    return { value: materialDescriptor(block), kind: 'material' };
  }

  const single = safeGetFieldValue(block, 'COLOR') ?? safeGetFieldValue(block, 'COLOUR') ?? null;

  return { value: single, kind: single ? 'single' : 'none' };
}

function materialDescriptor(block) {
  const { textureSet, baseColor, alpha, scale, angle } = extractMaterialInfo(block);
  return {
    color: baseColor ?? '#ffffff',
    materialName: textureSet && textureSet !== 'NONE' ? textureSet : 'none.png',
    alpha,
    scale,
    angle,
  };
}

export function readColourList(block) {
  if (block?.type !== 'lists_create_with') return readColourValue(block).value;
  return block.inputList
    .filter((input) => input.name?.startsWith('ADD'))
    .map((input) => readColourValue(input.connection?.targetBlock()).value);
}

// Numeric from an input's NUM field, with fallback.
export function readNumberInput(parent, inputName, fallback = 1) {
  const b = parent?.getInputTargetBlock?.(inputName);
  const v = b?.getField?.('NUM')?.getValue?.();
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : fallback;
}

// A number, or each number in a list block for inputs that take either.
export function readNumberOrList(parent, inputName, fallback = 1) {
  const list = parent?.getInputTargetBlock?.(inputName);
  if (list?.type !== 'lists_create_with') return readNumberInput(parent, inputName, fallback);
  return list.inputList
    .filter((input) => input.name?.startsWith('ADD'))
    .map((input) => readNumberInput(list, input.name, fallback));
}

// Reads a colour from an input's target block, falling back to the shadow's value when present.
export function readColourFromInputOrShadow(parent, inputName) {
  const target = parent?.getInputTargetBlock?.(inputName);
  if (target) return readColourValue(target);

  const shadowDom = parent?.getInput?.(inputName)?.connection?.getShadowDom?.();

  if (!shadowDom?.querySelector) return { value: null, kind: 'none' };

  const shadowField =
    shadowDom.querySelector('field[name="COLOUR"]') ||
    shadowDom.querySelector('field[name="COLOR"]');

  const shadowValue = shadowField?.textContent || shadowField?.innerText || null;
  return shadowValue ? { value: shadowValue, kind: 'shadow' } : { value: null, kind: 'none' };
}

// Extract texture set, base colour (single or list), and alpha.
export function extractMaterialInfo(materialBlock) {
  if (!materialBlock) return { textureSet: 'NONE', baseColor: null, alpha: 1, scale: 1, angle: 0 };

  const textureSet =
    getBlockValue(materialBlock, 'TEXTURE_SET') ??
    getBlockValue(materialBlock, 'TEXTURE') ??
    'NONE';

  const read = readColourFromInputOrShadow(materialBlock, 'BASE_COLOR');
  const baseColor = read.value ?? null;

  const alpha = readNumberInput(materialBlock, 'ALPHA', 1);
  const scale = readNumberInput(materialBlock, 'SCALE', 1);
  const angle = readNumberInput(materialBlock, 'ANGLE', 0);

  return { textureSet, baseColor, alpha, scale, angle };
}

function applyBackgroundColorFromBlock(block) {
  if (!block.isEnabled()) {
    if (getActiveSceneControllerBlockId() === block.id) {
      setClearSkyToBlack();
    }
    return;
  }

  // Don't steal sky controller ownership from another block that still exists.
  const currentOwnerId = getActiveSceneControllerBlockId();
  if (currentOwnerId && currentOwnerId !== block.id) {
    const ownerBlock = Blockly.getMainWorkspace()?.getBlockById(currentOwnerId);
    if (ownerBlock && !ownerBlock.disposed) {
      return;
    }
  }

  setActiveSceneControllerBlockId(block);
  const read = readColourFromInputOrShadow(block, 'COLOR');
  flock.setSky(read.value, { clear: true });
}

export function clearSkyMesh({ preserveClearColor = true } = {}) {
  // Dispose the existing sky dome without forcing the clear colour to change;
  // callers decide what the next background should be.
  if (flock.sky) {
    flock.disposeMesh(flock.sky);
    flock.sky = null;
  }

  if (!preserveClearColor) {
    const clearColor = flock.initialClearColor
      ? (flock.initialClearColor.clone?.() ?? flock.initialClearColor)
      : new flock.BABYLON.Color3(0, 0, 0);

    flock.scene.clearColor = clearColor;
  }

  delete meshMap['sky'];
}

export function setClearSkyToBlack() {
  if (flock.meshDebug) console.log('*** Setting clear sky to black');
  const fallbackColor =
    flock.initialClearColor?.toHexString?.() ?? flock.initialClearColor ?? '#000000';

  setActiveSceneControllerBlockId(null);
  flock.setSky(fallbackColor, { clear: true });
}

// Add this function before updateMeshFromBlock
export function updateOrCreateMeshFromBlock(block, changeEvent) {
  const sceneControllerTypes = [
    'set_sky_color',
    'set_background_color',
    'create_ground',
    'create_map',
  ];

  if (flock.meshDebug)
    console.log('Update or create mesh from block', block.type, changeEvent.type);

  if (!isMainWorkspaceEvent(changeEvent, block)) {
    return;
  }

  const cloneOwner = getCloneDoOwner(block);
  if (cloneOwner) {
    const loading = window.loadingCode && !changeEvent?.recordUndo;
    const applies =
      changeEvent?.type === Blockly.Events.BLOCK_CHANGE ||
      changeEvent?.type === Blockly.Events.BLOCK_MOVE;
    if (applies && !loading) {
      applyCloneDoBlock(block, cloneOwner);
    }
    return;
  }

  const meshes = getMeshesFromBlock(block);
  const isConnectedToEnabledChain = isBlockConnectedToEnabledChain(block);
  if (flock.meshDebug) console.log(meshes);
  const wasDisabled = changeEvent?.oldValue === true || changeEvent?.oldValue === 'true';
  const nowEnabled = changeEvent?.newValue === false || changeEvent?.newValue === 'false';
  const isEnabledEvent =
    changeEvent?.type === Blockly.Events.BLOCK_CHANGE &&
    changeEvent.element === 'disabled' &&
    wasDisabled &&
    nowEnabled;
  const isImmediateEnabledCreate =
    changeEvent?.type === Blockly.Events.BLOCK_CREATE &&
    isConnectedToEnabledChain &&
    meshes.length === 0;
  const isConnectedMove =
    changeEvent?.type === Blockly.Events.BLOCK_MOVE &&
    isConnectedToEnabledChain &&
    meshes.length === 0;

  if (!isConnectedToEnabledChain) {
    if (meshes.length) {
      deleteMeshFromBlock(block.id);
    }
    return;
  }
  if ((window.loadingCode && !changeEvent?.recordUndo) || block.disposed) return;

  // Record so meshes spawned later in a loop/event pick the edit up too.
  recordLiveEdit(block, changeEvent);

  const alreadyCreatingMesh = meshMap[block.id] !== undefined;
  if (!alreadyCreatingMesh && (isEnabledEvent || isImmediateEnabledCreate || isConnectedMove)) {
    if (sceneControllerTypes.includes(block.type)) {
      updateMeshFromBlock(meshes, block, changeEvent);
    } else {
      createMeshOnCanvas(block);
    }
    return;
  }
  if (flock.meshDebug) {
    console.log(
      'Should update?',
      changeEvent?.type === Blockly.Events.BLOCK_CHANGE ||
        changeEvent?.type === Blockly.Events.BLOCK_CREATE ||
        changeEvent?.type === Blockly.Events.BLOCK_MOVE
    );
  }
  if (block.type === 'mirror_mesh') {
    scheduleMirrorRebuild(block);
    return;
  }
  if (
    (changeEvent?.type === Blockly.Events.BLOCK_CHANGE ||
      changeEvent?.type === Blockly.Events.BLOCK_CREATE ||
      changeEvent?.type === Blockly.Events.BLOCK_MOVE) &&
    (meshes.length || sceneControllerTypes.includes(block.type))
  ) {
    updateMeshFromBlock(meshes, block, changeEvent);
  }
}

function isBlockConnectedToEnabledChain(block) {
  if (!block?.isEnabled?.()) return false;
  if (block.previousConnection && !block.previousConnection.isConnected?.()) {
    return false;
  }

  let root = block;
  let parent = block.getParent?.();
  while (parent) {
    root = parent;
    parent = parent.getParent?.();
  }

  if (root.type.startsWith('procedures_def')) {
    return false;
  }

  return root?.isEnabled?.() ?? false;
}

function isBlockIdDescendantOf(rootBlock, id) {
  if (!rootBlock || !id) return false;
  if (rootBlock.id === id) return true;

  const descendants = rootBlock.getDescendants(false);
  return descendants.some((d) => d.id === id);
}

function safeGetFieldValue(block, fieldName) {
  if (!block || !fieldName) return null;
  const fld = block.getField(fieldName);
  return fld ? fld.getValue() : null;
}

function updateSkyFromBlock(block) {
  if (!block.isEnabled()) {
    if (getActiveSceneControllerBlockId() === block.id) {
      setClearSkyToBlack();
    }
    return;
  }

  // Don't steal sky controller ownership from another block that still exists.
  const currentOwnerId = getActiveSceneControllerBlockId();
  if (currentOwnerId && currentOwnerId !== block.id) {
    const ownerBlock = Blockly.getMainWorkspace()?.getBlockById(currentOwnerId);
    if (ownerBlock && !ownerBlock.disposed) {
      return;
    }
  }

  setActiveSceneControllerBlockId(block);

  const colorInput = block.getInputTargetBlock('COLOR');
  if (!colorInput) return;

  if (colorInput && colorInput.type === 'material') {
    const { textureSet, baseColor, alpha, scale, angle } = extractMaterialInfo(colorInput);
    let read = readColourFromInputOrShadow(colorInput, 'BASE_COLOR');

    const colorValue = read.value ?? baseColor;

    if (textureSet && textureSet !== 'NONE') {
      flock.setSky({
        color: colorValue,
        materialName: textureSet,
        alpha,
        scale,
        angle,
      });
      return;
    }

    flock.setSky(colorValue);
    return;
  }

  const read = readColourFromInputOrShadow(block, 'COLOR');
  flock.setSky(read.value);
}

function updateLoadBlockScaleFromEvent(mesh, block, changeEvent) {
  mesh.metadata = mesh.metadata || {};

  // Extract old/new values from the Blockly change event, even if it came from the child math_number
  const getScaleFromEvent = (blk, ev) => {
    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    // 1) If this change came from the child plugged into SCALE, use its old/new
    const inp = blk.getInput && blk.getInput('SCALE');
    const child =
      inp && inp.connection && inp.connection.targetBlock && inp.connection.targetBlock();

    if (child && ev && ev.type === Blockly.Events.CHANGE && ev.blockId === child.id) {
      // ev.element likely "field", ev.name likely "NUM"
      return {
        oldScale: num(ev.oldValue),
        newScale: num(ev.newValue),
      };
    }

    // 2) If the change came from an inline field on the parent, use that
    if (ev && ev.type === Blockly.Events.CHANGE && ev.blockId === blk.id && ev.name === 'SCALE') {
      return {
        oldScale: num(ev.oldValue),
        newScale: num(ev.newValue),
      };
    }

    // 3) Fallback: read current value block (post-change)
    const readCurrent = () => {
      if (child && typeof child.getFieldValue === 'function') {
        const v = num(child.getFieldValue('NUM'));
        if (v != null) return v;
      }
      // inline field fallback
      const v2 = num(blk.getField && blk.getField('SCALE') && blk.getFieldValue('SCALE'));
      return v2 != null ? v2 : 1;
    };

    const cur = readCurrent();
    return { oldScale: null, newScale: cur };
  };

  const { oldScale, newScale } = getScaleFromEvent(block, changeEvent);
  const toNum = (v, d) => (Number.isFinite(v) ? Number(v) : d);
  const prev = toNum(oldScale, null);
  const next = toNum(newScale, 1);

  if (!mesh.metadata.__unitScale) {
    const divider = prev || next || 1;
    mesh.metadata.__unitScale = {
      x: mesh.scaling.x / divider,
      y: mesh.scaling.y / divider,
      z: mesh.scaling.z / divider,
    };
  }

  // Apply absolute scale: scaling = unit × newScale
  const u = mesh.metadata.__unitScale;
  mesh.scaling.set(u.x * next, u.y * next, u.z * next);
  mesh.metadata.__lastAppliedScale = next;

  // Keep base on ground
  mesh.computeWorldMatrix(true);
  mesh.refreshBoundingInfo();
  const ext = mesh.getBoundingInfo().boundingBox.extendSizeWorld;

  const getNumInput = (blk, name, def = 0) => {
    const inp = blk.getInput && blk.getInput(name);
    const tgt = inp && inp.connection && inp.connection.targetBlock && inp.connection.targetBlock();
    const v = tgt ? Number(tgt.getFieldValue('NUM')) : def;
    return Number.isFinite(v) ? v : def;
  };
  const baseY = getNumInput(block, 'Y', 0);
  mesh.position.y = baseY + ext.y;

  mesh.computeWorldMatrix(true);
  mesh.refreshBoundingInfo();

  // flock.updatePhysics(mesh);
  //flock.adjustMaterialTilingForHierarchy(mesh);

  if (flock.meshDebug) {
    console.log('[SCALE change]', {
      oldScale,
      newScale,
      unit: mesh.metadata.__unitScale,
      applied: mesh.scaling.clone(),
    });
  }
}

export function getColorRoot(mesh) {
  let current = mesh;
  while (current) {
    if (current.metadata?._attachedTargetName) {
      flock.setPhysics(current.name, 'NONE');
      return current;
    }
    if (
      !current.parent ||
      current.parent.metadata?.shapeType === 'Group' ||
      flock._isSeparateObject(current)
    ) {
      return current;
    }
    current = current.parent;
  }
  return mesh;
}

export function updatePrefabMaterial(prefabBlock, index) {
  const entry = prefabBlock.getInputTargetBlock('ARG' + index);
  if (!entry) return;
  const materialInfo = entry.type === 'material' ? extractMaterialInfo(entry) : null;
  const color = materialInfo ? materialInfo.baseColor : readColourValue(entry).value;
  if (!color) return;
  for (const group of getMeshesFromBlock(prefabBlock)) {
    if (!group.metadata?.isPrefab) continue;
    for (const part of group.getChildMeshes(false)) {
      if (part.metadata?.prefabMaterialIndex === index) {
        handleMaterialOrColorChange(part, entry, 'COLOR', color, materialInfo);
      }
    }
  }
}

export function handleMaterialOrColorChange(mesh, block, changed, color, materialInfo) {
  if (
    !(
      ['COLOR', 'COLORS', 'BASE_COLOR', 'ALPHA', 'MATERIAL_OPTION'].includes(changed) ||
      changed.startsWith?.('ADD')
    )
  ) {
    if (flock.meshDebug) console.log('Returning');
    return mesh;
  }

  if (block?.type === 'load_model' && !block.colorsEdited) return mesh;

  const root = getColorRoot(mesh);

  const alpha = materialInfo?.alpha ?? 1;

  let rawColor = materialInfo?.colors || materialInfo?.baseColor || color;

  if (!rawColor) {
    const firstMat = [root, ...flock._ownDescendants(root)].find((m) => m.material)?.material;
    rawColor = firstMat?.diffuseColor?.toHexString() || '#ffffff';
  }

  const textureSet = materialInfo?.textureSet;

  let input;
  if (textureSet && textureSet !== 'NONE') {
    input = {
      color: rawColor,
      alpha,
      materialName: textureSet,
      scale: materialInfo?.scale ?? 1,
      angle: materialInfo?.angle ?? 0,
    };
  } else {
    input = rawColor;
  }

  flock.applyMaterialToHierarchy(root, input, {
    applyColor: true,
    alpha,
    blockKey: root.metadata?.blockKey,
    ownOnly: true,
  });

  return root;
}

function updateGroundFromBlock(_mesh, _block, _changeEvent) {
  if (flock.meshDebug) console.log('Use map block instead of ground');
}

function updateMapFromBlock(mesh, block, changeEvent) {
  // Don't steal ground ownership from another block while the current owner still exists.
  // This prevents a second map block from taking over and causing its deletion to remove the ground.
  const currentOwnerId = meshBlockIdMap['ground'];
  if (currentOwnerId && currentOwnerId !== block.id) {
    const ownerBlock = Blockly.getMainWorkspace()?.getBlockById(currentOwnerId);
    if (ownerBlock && !ownerBlock.disposed) {
      return;
    }
  }

  meshMap['ground'] = block;
  meshBlockIdMap['ground'] = block.id;

  const mapName = block.getFieldValue('MAP_NAME');
  const materialBlock = block.getInputTargetBlock('MATERIAL');

  if (!materialBlock) return;

  // A raw colour/list block may be connected directly to MATERIAL (not via a
  // material block), so dispatch on block type and pass the raw value straight
  // to createMap to match the generated-JS code path.
  const isMaterialBlock = materialBlock.type === 'material';
  let read, mapArg;
  if (isMaterialBlock) {
    const { textureSet, alpha, scale, angle } = extractMaterialInfo(materialBlock);
    read = readColourFromInputOrShadow(materialBlock, 'BASE_COLOR');
    const materialName = !textureSet || textureSet === 'NONE' ? 'none.png' : textureSet;
    mapArg = { color: read.value, materialName, alpha, scale, angle };
  } else {
    read = readColourValue(materialBlock);
    mapArg = read.value;
  }

  const colorIsEmpty = read.value == null || (Array.isArray(read.value) && read.value.length === 0);
  if (colorIsEmpty) {
    // Retry once — mutator operations briefly leave the colour list empty.
    // If still empty after the retry, bail silently to avoid an infinite loop.
    const wasRetrying = block.__mapRetry;
    block.__mapRetry = false;
    if (!wasRetrying) {
      block.__mapRetry = true;
      requestAnimationFrame(() => updateMapFromBlock(mesh, block, changeEvent));
    }
    return;
  }
  block.__mapRetry = false;

  flock.createMap(mapName, mapArg);
}

// True when a colour input resolves to a random value (directly, inside a list,
// or as a material's base colour) — meaning it must be rolled per mesh.
function inputSubtreeHasRandomColour(target) {
  if (!target) return false;
  if (target.type === 'random_colour') return true;
  if (target.type === 'lists_create_with') {
    return target.inputList.some(
      (input) => input.connection?.targetBlock()?.type === 'random_colour'
    );
  }
  if (target.type === 'material') {
    return inputSubtreeHasRandomColour(target.getInputTargetBlock?.('BASE_COLOR'));
  }
  return false;
}

export function colourSourceIsRandom(block) {
  if (!block?.getInputTargetBlock) return false;
  const inputName = ['load_multi_object', 'load_model'].includes(block.type) ? 'COLORS' : 'COLOR';
  return inputSubtreeHasRandomColour(block.getInputTargetBlock(inputName));
}

function resolveColorAndMaterialForBlock(block) {
  let color;
  let materialInfo = null;

  if (
    !['load_object', 'load_multi_object', 'load_model', 'load_character', 'create_map'].includes(
      block.type
    )
  ) {
    const colorInput = block.getInputTargetBlock('COLOR');

    // Check if it's a material block
    if (colorInput && colorInput.type === 'material') {
      materialInfo = extractMaterialInfo(colorInput);
      const read = readColourFromInputOrShadow(colorInput, 'BASE_COLOR');

      if (flock.meshDebug) {
        console.log('Material block detected:');
        console.log('  Texture:', materialInfo.textureSet);
        console.log('  Base color from material:', materialInfo.baseColor);
        console.log('  Color from input:', read.value);
        console.log('  Alpha:', materialInfo.alpha);
      }

      color = read.value ?? materialInfo.baseColor;
    } else {
      // Simple color block
      const read = readColourFromInputOrShadow(block, 'COLOR');
      color = read.value;

      if (flock.meshDebug) {
        console.log('Simple color block detected:', color);
      }
    }
  } else if (block.type === 'load_object' || block.type === 'load_character') {
    // Handle load_object and load_character color input
    const colorInput = block.getInputTargetBlock('COLOR');

    if (flock.meshDebug) {
      console.log('Processing load_object/load_character color input');
      console.log('  Color input type:', colorInput?.type);
    }

    // Check if it's a material block
    if (colorInput && colorInput.type === 'material') {
      materialInfo = extractMaterialInfo(colorInput);
      const read = readColourFromInputOrShadow(colorInput, 'BASE_COLOR');

      if (flock.meshDebug) {
        console.log('Material block detected for load_object:');
        console.log('  Texture:', materialInfo.textureSet);
        console.log('  Base color from material:', materialInfo.baseColor);
        console.log('  Color from input:', read.value);
        console.log('  Alpha:', materialInfo.alpha);
      }

      color = read.value ?? materialInfo.baseColor;
    } else {
      // Simple color block
      const read = readColourFromInputOrShadow(block, 'COLOR');
      color = read.value;

      if (flock.meshDebug) {
        console.log('Simple color for load_object:', color);
      }
    }
  } else if (block.type === 'load_multi_object' || block.type === 'load_model') {
    color = readColourList(block.getInputTargetBlock('COLORS'));
  }

  return { color, materialInfo };
}

// assumes getXYZFromBlock is imported / available in this module

function handlePrimitiveGeometryChange(mesh, block, changed) {
  if (!mesh || !block) return;

  // Re-pin to this mesh's own anchor, not the block's authored position, so
  // loop-spawned copies aren't all yanked together. Capture before resizing.
  const anchor = flock.getBlockPositionFromMesh(mesh);

  const repositionPrimitiveFromBlock = () => {
    if (mesh.isDisposed?.()) return;
    const parentMesh = detachFromParent(mesh);
    try {
      flock.setBlockPositionOnMesh(mesh, { ...anchor, useY: true });
    } finally {
      reattachToParent(mesh, parentMesh);
    }
    flock.updatePhysics?.(mesh);
  };

  const applyPrimitiveUVTiling = (shapeType, dims) => {
    const TILE_SIZE = TEXTURE_TILE_SIZE;
    switch (shapeType) {
      case 'Box':
      case 'Wedge':
        flock.setSizeBasedBoxUVs(mesh, dims.width, dims.height, dims.depth, TILE_SIZE);
        break;
      case 'Sphere':
        flock.setSphereUVs(mesh, dims.diameter, TILE_SIZE);
        break;
      case 'Cylinder':
        flock.setSizeBasedCylinderUVs(
          mesh,
          dims.height,
          dims.diameterTop,
          dims.diameterBottom,
          TILE_SIZE
        );
        break;
      case 'Capsule':
        flock.setCapsuleUVs(mesh, dims.radius, dims.height, TILE_SIZE);
        break;
      case 'Plane':
        flock.setSizeBasedPlaneUVs(mesh, dims.width, dims.height, TILE_SIZE);
        break;
    }
  };

  switch (block.type) {
    case 'create_box': {
      if (['WIDTH', 'HEIGHT', 'DEPTH'].includes(changed)) {
        const width = block.getInput('WIDTH').connection.targetBlock().getFieldValue('NUM');
        const height = block.getInput('HEIGHT').connection.targetBlock().getFieldValue('NUM');
        const depth = block.getInput('DEPTH').connection.targetBlock().getFieldValue('NUM');

        setAbsoluteSize(mesh, width, height, depth);
        applyPrimitiveUVTiling('Box', { width, height, depth });
        repositionPrimitiveFromBlock();
      }
      break;
    }

    case 'create_sphere': {
      if (['DIAMETER_X', 'DIAMETER_Y', 'DIAMETER_Z'].includes(changed)) {
        const dx = block.getInput('DIAMETER_X').connection.targetBlock().getFieldValue('NUM');
        const dy = block.getInput('DIAMETER_Y').connection.targetBlock().getFieldValue('NUM');
        const dz = block.getInput('DIAMETER_Z').connection.targetBlock().getFieldValue('NUM');

        setAbsoluteSize(mesh, dx, dy, dz);
        applyPrimitiveUVTiling('Sphere', {
          diameter: Math.max(dx, dy, dz),
        });
        repositionPrimitiveFromBlock();
      }
      break;
    }

    case 'create_cylinder': {
      if (['HEIGHT', 'DIAMETER_TOP', 'DIAMETER_BOTTOM', 'TESSELLATIONS'].includes(changed)) {
        const h = block.getInput('HEIGHT').connection.targetBlock().getFieldValue('NUM');
        const dt = block.getInput('DIAMETER_TOP').connection.targetBlock().getFieldValue('NUM');
        const db = block.getInput('DIAMETER_BOTTOM').connection.targetBlock().getFieldValue('NUM');
        const s = block.getInput('TESSELLATIONS').connection.targetBlock().getFieldValue('NUM');

        updateCylinderGeometry(mesh, dt, db, h, s);
        applyPrimitiveUVTiling('Cylinder', {
          height: h,
          diameterTop: dt,
          diameterBottom: db,
        });

        // only reposition when actual dimensions change, not tessellation
        if (['HEIGHT', 'DIAMETER_TOP', 'DIAMETER_BOTTOM'].includes(changed)) {
          repositionPrimitiveFromBlock();
        }
      }
      break;
    }

    case 'create_capsule': {
      if (['HEIGHT', 'DIAMETER'].includes(changed)) {
        const d = block.getInput('DIAMETER').connection.targetBlock().getFieldValue('NUM');
        const h = block.getInput('HEIGHT').connection.targetBlock().getFieldValue('NUM');

        updateCapsuleGeometry(mesh, d, h);
        applyPrimitiveUVTiling('Capsule', { radius: d / 2, height: h });
        repositionPrimitiveFromBlock();
      }
      break;
    }

    case 'create_wedge': {
      if (['WIDTH', 'HEIGHT', 'DEPTH', 'PEAK', 'AXIS'].includes(changed)) {
        const w = block.getInput('WIDTH').connection.targetBlock().getFieldValue('NUM');
        const h = block.getInput('HEIGHT').connection.targetBlock().getFieldValue('NUM');
        const d = block.getInput('DEPTH').connection.targetBlock().getFieldValue('NUM');
        const peak = block.getInput('PEAK').connection.targetBlock().getFieldValue('NUM');
        const axis = block.getFieldValue('AXIS');

        updateWedgeGeometry(mesh, w, h, d, peak, axis);
        applyPrimitiveUVTiling('Wedge', { width: w, height: h, depth: d });
        repositionPrimitiveFromBlock();
      }
      break;
    }

    case 'create_donut':
    case 'create_ring': {
      if (['HEIGHT', 'DIAMETER', 'INNER_DIAMETER', 'THICKNESS', 'SIDES'].includes(changed)) {
        const readNumber = (name) =>
          Number(block.getInput(name)?.connection.targetBlock()?.getFieldValue('NUM') ?? NaN);
        const requested = {
          diameter: readNumber('DIAMETER'),
          innerDiameter: readNumber('INNER_DIAMETER'),
          thickness: readNumber('THICKNESS'),
          height: readNumber('HEIGHT'),
          tessellation: readNumber('SIDES'),
        };
        const resized =
          block.type === 'create_donut'
            ? updateDonutGeometry(mesh, requested)
            : updateRingGeometry(mesh, requested);
        if (resized && changed !== 'SIDES') {
          repositionPrimitiveFromBlock();
        }
      }
      break;
    }

    case 'create_plane': {
      if (['HEIGHT', 'WIDTH'].includes(changed)) {
        const w = block.getInput('WIDTH').connection.targetBlock().getFieldValue('NUM');
        const h = block.getInput('HEIGHT').connection.targetBlock().getFieldValue('NUM');

        setAbsoluteSize(mesh, w, h, 0);
        applyPrimitiveUVTiling('Plane', { width: w, height: h });
        repositionPrimitiveFromBlock();
      }
      break;
    }

    case 'create_3d_text': {
      const horizontal = block.getFieldValue('HORIZONTAL') === 'TRUE';
      const newSize = readNumberInput(block, 'SIZE', 1);
      const newDepth = readNumberOrList(block, 'DEPTH', 1);
      // Per-letter depths can't be reached by scaling, so rebuild instead.
      const rebuildFor = Array.isArray(newDepth)
        ? ['TEXT', 'HORIZONTAL', 'SPACING', 'SIZE', 'DEPTH']
        : ['TEXT', 'HORIZONTAL', 'SPACING'];

      if (rebuildFor.includes(changed)) {
        const text = block.getInputTargetBlock('TEXT');
        const value = text?.getFieldValue('TEXT') ?? text?.getFieldValue('NUM');
        if (value === null || value === undefined || String(value) === '') break;
        flock
          ._rebuild3DTextGeometry(mesh, {
            text: String(value),
            font: 'fonts/FreeSansBold.ttf',
            size: newSize,
            depth: newDepth,
            spacing: readNumberInput(block, 'SPACING', 0),
            horizontal,
          })
          .then(repositionPrimitiveFromBlock)
          .catch((error) => console.error('Error rebuilding 3D text:', error));
      } else if (['SIZE', 'DEPTH'].includes(changed)) {
        mesh.computeWorldMatrix(true);
        mesh.refreshBoundingInfo();
        // Glyph height is a font-dependent fraction of SIZE, so scale from the
        // size the geometry was built at rather than matching SIZE directly.
        const builtSize = mesh.metadata?.textSize;
        const factor = builtSize > 0 ? newSize / builtSize : 1;
        const ext = mesh.getBoundingInfo().boundingBox.extendSize;
        const newW = ext.x * 2 * factor;
        // Horizontal text's letter height runs along Z and its depth along Y.
        const newH = (horizontal ? ext.z : ext.y) * 2 * factor;

        if (horizontal) {
          setAbsoluteSize(mesh, newW, newDepth, newH);
        } else {
          setAbsoluteSize(mesh, newW, newH, newDepth);
        }
        mesh.metadata = { ...mesh.metadata, textSize: newSize };
        repositionPrimitiveFromBlock();
      }
      break;
    }
  }
}

function handleLoadBlockChange(meshes, block, changed, changeEvent) {
  // All load_* blocks: replace model when MODELS changes
  if (
    ['load_object', 'load_multi_object', 'load_model', 'load_character'].includes(block.type) &&
    changed === 'MODELS'
  ) {
    meshes.forEach((mesh) => replaceMeshModel(mesh, block, changeEvent));
    return true; // caller should return early
  }

  // Extra handling for load_character colour fields
  if (block.type === 'load_character' && changed in colorFields) {
    const read = (name) => readColourValue(block.getInputTargetBlock(name)).value;
    const colors = {
      hair: read('HAIR_COLOR'),
      skin: read('SKIN_COLOR'),
      eyes: read('EYES_COLOR'),
      tshirt: read('TSHIRT_COLOR'),
      shorts: read('SHORTS_COLOR'),
      sleeves: read('SLEEVES_COLOR'),
    };

    meshes.forEach((mesh) => {
      if (mesh) flock.applyColorsToCharacter(mesh, colors);
    });
  }

  return false;
}

// Utility: read X/Y/Z numeric inputs from a Blockly block
export function getXYZFromBlock(block) {
  if (!block) return { x: null, y: null, z: null };

  const getNum = (inputName) => {
    const input = block.getInput(inputName);
    const targetBlock = input?.connection?.targetBlock();
    return targetBlock?.getFieldValue('NUM');
  };

  return {
    x: getNum('X'),
    y: getNum('Y'),
    z: getNum('Z'),
  };
}

function isBoneAttached(mesh) {
  return !!mesh?.metadata?._attachedTargetName;
}

// attach overwrites position with the bone offset, so live edits that move an
// attached object must replay it.
function reattachToBone(mesh) {
  const md = mesh?.metadata;
  if (!md?._attachedTargetName) return;
  flock.attach(mesh.name, md._attachedTargetName, {
    boneName: md._attachedBoneName,
    x: md._attachedOffset?.x ?? 0,
    y: md._attachedOffset?.y ?? 0,
    z: md._attachedOffset?.z ?? 0,
  });
}

// Pending deferred position applies for parented child objects: mesh -> block.
const _pendingChildPositionApply = new Map();

// A child object's position block holds a WORLD position, but the child follows
// its parent, so applying it inline is order-dependent: during a grouped
// parent-move undo/redo the child's block reverts while the parent is still
// mid-revert, and applying then (followed by the parent settling) lands the
// child a move-distance away. Deferring the apply to a microtask sidesteps this
// — by the time it runs the whole event batch has processed and the parent has
// settled (the child has followed it), so applying the block position is a true
// no-op for a parent move/undo/redo, and a genuine move for a direct edit.
function scheduleChildPositionApply(mesh, block) {
  const alreadyPending = _pendingChildPositionApply.has(mesh);
  _pendingChildPositionApply.set(mesh, block);
  if (alreadyPending) return;

  queueMicrotask(() => {
    const pendingBlock = _pendingChildPositionApply.get(mesh);
    _pendingChildPositionApply.delete(mesh);
    applyChildBlockPosition(mesh, pendingBlock);
  });
}

function applyChildBlockPosition(mesh, block) {
  if (!mesh || mesh.isDisposed?.() || !mesh.parent) return;
  if (!block || block.disposed) return;

  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const position = getXYZFromBlock(block);
  const childParent = mesh.parent;

  flock.setBlockPositionOnMesh(mesh, {
    x: num(position.x, mesh.position.x),
    y: num(position.y, mesh.position.y),
    z: num(position.z, mesh.position.z),
    useY: true,
  });
  flock.updatePhysics?.(mesh);

  if (childParent?.metadata?.shapeType === 'Group') {
    const groupBlock = meshMap[childParent.metadata?.blockKey];
    if (groupBlock) recomputeGroupPivot(groupBlock);
  }
}

export function findEnclosingGroupBlock(block) {
  const container = block?.getSurroundParent?.();
  if (!container || container.type !== 'create_group') return null;
  if (container.getFieldValue('ACTIVE') !== 'TRUE') return null;

  let cur = container.getInput('DO')?.connection?.targetBlock();
  while (cur) {
    if (cur === block) return container;
    cur = cur.getNextBlock();
  }
  return null;
}

function resolveGroupMesh(groupBlock) {
  if (!groupBlock) return null;
  return (
    getMeshFromBlock(groupBlock) ||
    flock.scene?.meshes?.find((m) => m?.metadata?.blockKey === groupBlock.id)
  );
}

export function attachToEnclosingGroupIfAny(block, mesh) {
  if (!mesh) return;
  const groupBlock = findEnclosingGroupBlock(block);
  const groupMesh = resolveGroupMesh(groupBlock);
  if (!groupMesh || groupMesh === mesh) return;
  mesh.setParent(groupMesh);

  const eventGroupId = Blockly.utils.idGenerator.genUid();
  Blockly.Events.setGroup(eventGroupId);
  try {
    recomputeGroupPivot(groupBlock);
  } finally {
    Blockly.Events.setGroup(false);
  }
}

// Called with (memberMesh, groupMesh) when a drop groups a mesh. Owned by
// gizmos.js (selection); blockmesh must not import gizmos back.
let groupSelectionFollower = null;

export function setGroupSelectionFollower(fn) {
  groupSelectionFollower = typeof fn === 'function' ? fn : null;
}

let groupActiveToggleListener = null;

// True while a mirror is under a gizmo: disposing it would end the tool, so
// its rebuild waits and only its placement follows. Owned by gizmos.js.
let mirrorInUse = null;

export function setMirrorInUseCheck(fn) {
  mirrorInUse = typeof fn === 'function' ? fn : null;
}

// Long enough for the source's own live update (often async) to land first.
const MIRROR_REBUILD_DELAY_MS = 150;
const MIRROR_SOURCE_RETRIES = 10;
const mirrorRebuildTimers = new Map();
// Mirrors already rebuilt in the dependency chain that led to a pending
// rebuild, so mirrors built from each other can't rebuild each other forever.
const mirrorRebuildChains = new Map();
const MIRROR_EVENT_TYPES = new Set([
  Blockly.Events.BLOCK_CHANGE,
  Blockly.Events.BLOCK_CREATE,
  Blockly.Events.BLOCK_DELETE,
  Blockly.Events.BLOCK_MOVE,
]);

function ownerBlocksOfVariable(block, fieldName) {
  const variableId = block.getFieldValue(fieldName);
  if (!variableId) return [];
  return block.workspace
    .getAllBlocks(false)
    .filter((b) => b !== block && getOwnVar(b) === variableId);
}

// A mirror tracks its source and about object while editing: any edit
// inside either one's block rebuilds it. Unplugging fires a move before a
// delete, so moves cover blocks deleted from inside them.
export function watchMirrorSources(block, changeEvent) {
  if (!MIRROR_EVENT_TYPES.has(changeEvent.type) || block.disposed) return;
  if (window.loadingCode && !changeEvent.recordUndo) return;
  if (!isMainWorkspaceEvent(changeEvent, block)) return;

  if (changeEvent.type === Blockly.Events.BLOCK_DELETE) {
    if (getMeshFromBlock(block)) scheduleMirrorRebuild(block);
    return;
  }

  const touched = [
    changeEvent.blockId,
    ...(changeEvent.ids ?? []),
    changeEvent.oldParentId,
    changeEvent.newParentId,
  ].filter(Boolean);
  const roots = [
    ...ownerBlocksOfVariable(block, 'SOURCE_MESH'),
    ...ownerBlocksOfVariable(block, 'ABOUT'),
  ];
  if (roots.some((root) => touched.some((id) => isBlockIdDescendantOf(root, id)))) {
    scheduleMirrorRebuild(block);
  }
}

function scheduleMirrorRebuild(block, attempt = 0, chain = new Set()) {
  clearTimeout(mirrorRebuildTimers.get(block.id));
  mirrorRebuildChains.set(block.id, chain);
  mirrorRebuildTimers.set(
    block.id,
    setTimeout(() => {
      mirrorRebuildTimers.delete(block.id);
      rebuildMirror(block, attempt);
    }, MIRROR_REBUILD_DELAY_MS)
  );
}

function rebuildMirror(block, attempt) {
  if (block.disposed) return;
  const oldMesh = getMeshFromBlock(block);
  if (oldMesh && mirrorInUse?.(oldMesh)) {
    const source = getMeshFromBlockKey(oldMesh.metadata?.mirror?.sourceBlockKey);
    if (source) flock.placeReflected(oldMesh, source, oldMesh.metadata.mirror);
    scheduleMirrorRebuild(block, attempt, mirrorRebuildChains.get(block.id));
    return;
  }
  deleteMeshFromBlock(block.id);
  if (!isBlockConnectedToEnabledChain(block)) return;

  const sourceOwner = ownerBlocksOfVariable(block, 'SOURCE_MESH')[0];
  if (!getMeshFromBlock(sourceOwner)) {
    // The source may itself be mid-rebuild (e.g. a model reloading).
    if (sourceOwner && attempt < MIRROR_SOURCE_RETRIES) {
      scheduleMirrorRebuild(block, attempt + 1, mirrorRebuildChains.get(block.id));
    }
    return;
  }
  createMeshOnCanvas(block);
}

// Re-applies the mirror's own DO edits that the live editor handles, as Play
// would after building it. Takes the mesh: the block index may not have it yet.
export function applyMirrorDoBlocks(block, mesh) {
  for (let cur = block.getInputTargetBlock('DO'); cur; cur = cur.getNextBlock()) {
    if (cur.isEnabled() && getCloneDoOwner(cur) === block) applyCloneDoBlock(cur, block, [mesh]);
  }
}

// A rebuilt mirror makes no block events, so mirrors built from it follow here.
export function rebuildDependentMirrors(block) {
  const chain = new Set(mirrorRebuildChains.get(block.id)).add(block.id);
  mirrorRebuildChains.delete(block.id);
  const variableId = getOwnVar(block);
  if (!variableId) return;
  for (const other of block.workspace.getBlocksByType('mirror_mesh', false)) {
    if (chain.has(other.id)) continue;
    if (
      other.getFieldValue('SOURCE_MESH') === variableId ||
      other.getFieldValue('ABOUT') === variableId
    ) {
      scheduleMirrorRebuild(other, 0, chain);
    }
  }
}

export function setGroupActiveToggleListener(fn) {
  groupActiveToggleListener = typeof fn === 'function' ? fn : null;
}

export function syncGroupParentOnMove(mesh, block) {
  if (!mesh || mesh.isDisposed?.() || !block || block.disposed) return;
  // Not suppression-gated: a bake-owned mesh is already correctly parented
  // (the check below), making this a no-op; gating would risk dropping a
  // real concurrent drag-into-group instead.

  const groupBlock = findEnclosingGroupBlock(block);
  const newGroupMesh = resolveGroupMesh(groupBlock);
  const wasGrouped = mesh.parent?.metadata?.shapeType === 'Group';
  const oldGroupMesh = wasGrouped ? mesh.parent : null;

  if (newGroupMesh) {
    if (mesh.parent === newGroupMesh || mesh === newGroupMesh) return newGroupMesh;
    mesh.setParent(newGroupMesh);
    // A drop grouping the selected mesh moves selection to the group, like
    // a canvas pick; any other selection is left alone.
    groupSelectionFollower?.(mesh, newGroupMesh);
  } else {
    if (!wasGrouped) return null; // wasn't a group child; nothing to convert
    mesh.setParent(null);
  }

  flock.updatePhysics?.(mesh);

  const eventGroupId = Blockly.utils.idGenerator.genUid();
  Blockly.Events.setGroup(eventGroupId);
  try {
    recomputeGroupPivot(groupBlock);
    if (oldGroupMesh && oldGroupMesh !== newGroupMesh) {
      const oldGroupBlock = meshMap[oldGroupMesh.metadata?.blockKey];
      if (oldGroupBlock) recomputeGroupPivot(oldGroupBlock);
    }
  } finally {
    Blockly.Events.setGroup(false);
  }
  return newGroupMesh;
}

function recomputeGroupPivot(groupBlock) {
  if (!groupBlock || groupBlock.disposed || groupBlock.type !== 'create_group') return;
  const groupMesh = resolveGroupMesh(groupBlock);
  if (!groupMesh || groupMesh.isDisposed?.()) return;
  flock.recomputeGroupGeometry(groupMesh);
}

function detachFromParent(mesh) {
  const parentMesh = mesh?.parent ?? null;
  if (parentMesh && !mesh.isDisposed?.()) mesh.parent = null;
  return parentMesh;
}

function reattachToParent(mesh, parentMesh) {
  if (!parentMesh || parentMesh.isDisposed?.() || mesh.isDisposed?.()) return;
  if (mesh.parent !== parentMesh) mesh.parent = parentMesh;
  if (parentMesh.metadata?.shapeType !== 'Group') return;
  const groupBlock = meshMap[parentMesh.metadata?.blockKey];
  if (groupBlock) recomputeGroupPivot(groupBlock);
}

function getDirectGroupMemberBlocks(groupBlock) {
  const members = [];
  let cur = groupBlock?.getInput('DO')?.connection?.targetBlock();
  while (cur) {
    members.push(cur);
    cur = cur.getNextBlock();
  }
  return members;
}

function handleGroupActiveToggle(groupMesh, groupBlock) {
  if (!groupMesh || groupMesh.isDisposed?.()) return;

  groupActiveToggleListener?.([
    groupMesh,
    ...getDirectGroupMemberBlocks(groupBlock).flatMap((b) => getMeshesFromBlock(b)),
  ]);

  if (groupBlock.getFieldValue('ACTIVE') === 'TRUE') {
    getDirectGroupMemberBlocks(groupBlock).forEach((memberBlock) => {
      getMeshesFromBlock(memberBlock).forEach((mesh) => {
        if (mesh && mesh !== groupMesh && mesh.parent !== groupMesh) mesh.setParent(groupMesh);
      });
    });
    flock.recomputeGroupGeometry(groupMesh);
  } else {
    groupMesh.getChildMeshes(true).forEach((child) => child.setParent(null));
    flock.rebuildGroupGeometry(groupMesh, 0.01, 0.01, 0.01);
  }
  flock.updatePhysics?.(groupMesh);
}

function applyTransformBlockToMeshes(transformBlock, meshes) {
  if (transformBlock.type === 'rotate_to') {
    const rotation = getXYZFromBlock(transformBlock);
    return Promise.all(
      meshes.map((mesh) =>
        flock.rotateTo(mesh.name, { ...rotation, world: true }).then(() => {
          // Rotating a member reshapes the group bounds - keep the group
          // outline in sync, like moving a child does.
          const groupMesh = mesh?.parent;
          if (mesh?.isDisposed?.() || groupMesh?.metadata?.shapeType !== 'Group') return;
          const groupBlock = meshMap[groupMesh.metadata?.blockKey];
          if (groupBlock) recomputeGroupPivot(groupBlock);
        })
      )
    );
  }

  if (transformBlock.type === 'resize') {
    const dims = getXYZFromBlock(transformBlock);
    const resizeOptions = {
      width: dims.x ?? null,
      height: dims.y ?? null,
      depth: dims.z ?? null,
      xOrigin: transformBlock.getFieldValue('X_ORIGIN') || 'CENTRE',
      yOrigin: transformBlock.getFieldValue('Y_ORIGIN') || 'BASE',
      zOrigin: transformBlock.getFieldValue('Z_ORIGIN') || 'CENTRE',
    };

    if (flock.meshDebug) console.log('Resize', resizeOptions, 'on mesh', meshes[0]?.name);

    return Promise.all(
      meshes.map((mesh) => {
        const resized = flock.resize(mesh.name, resizeOptions);
        if (flock.meshDebug) console.log('After resize', mesh);
        reattachToBone(mesh);
        // Resize runs parented (as Play's DO-resize does); resync the group
        // outline and body from the new bounds.
        const groupMesh = mesh?.parent?.metadata?.shapeType === 'Group' ? mesh.parent : null;
        if (groupMesh && !mesh.isDisposed?.()) {
          const groupBlock = meshMap[groupMesh.metadata?.blockKey];
          if (groupBlock) recomputeGroupPivot(groupBlock);
        }
        return resized;
      })
    );
  }

  return Promise.resolve();
}

// Retargeting a transform onto its add block's own variable applies it like
// editing its values would; retargeting it away waits for Play, as removing it does.
export function applyRetargetedTransform(transformBlock) {
  const meshes = getMeshesFromBlock(transformBlock);
  if (meshes.length) applyTransformBlockToMeshes(transformBlock, meshes);
}

// A freshly built canvas mesh only reflects its add block's own inputs, so a
// pasted/duplicated block would lose its initial transforms until Play.
// Replay them in order, as Play would.
export async function applyInitialTransformsFromBlock(block, mesh) {
  for (let child = block.getInputTargetBlock?.('DO'); child; child = child.getNextBlock()) {
    if (block.disposed || mesh.isDisposed?.()) return;
    if (getInitialTransformOwner(child) !== block) continue;
    await applyTransformBlockToMeshes(child, [mesh]);
  }
}

export function updateMeshFromBlock(meshesOrMesh, block, changeEvent) {
  // Bulk editor operations own their blocks' writes; the live pipeline must
  // not rebuild those meshes from half-written state.
  if (isBlockLiveUpdateSuppressed(block?.id)) {
    noteSuppressedHit();
    return;
  }

  if (flock.meshDebug) {
    console.log('=== UPDATE MESH FROM BLOCK ===');
    console.log('Block type:', block.type);
    console.log('Block ID:', block.id);
    console.log('Change event type:', changeEvent.type);
    console.log('Change event details:', changeEvent);
  }

  const meshes = Array.isArray(meshesOrMesh) ? meshesOrMesh : meshesOrMesh ? [meshesOrMesh] : [];

  if (
    meshes.length === 0 &&
    !['set_sky_color', 'set_background_color', 'create_ground', 'create_map'].includes(block.type)
  ) {
    if (flock.meshDebug) console.log('No mesh and not a special block type, returning');
    return;
  }

  if (block.type === 'change_color') {
    if (flock.meshDebug) console.log('Skipping live update for change_color block');
    return;
  }

  const changedBlock = changeEvent.blockId
    ? Blockly.getMainWorkspace().getBlockById(changeEvent.blockId)
    : null;

  const parent = changedBlock?.getParent() || changedBlock;

  let cursor = changedBlock;
  while (cursor) {
    if (cursor.type === 'change_color') {
      if (flock.meshDebug) console.log('Skipping live update for change_color subtree');
      return;
    }
    cursor = cursor.getParent?.();
  }

  let changed;

  if (flock.meshDebug) {
    console.log('Changed block:', changedBlock?.type);
    console.log('Parent block:', parent?.type);
  }

  if (
    changeEvent.type === Blockly.Events.BLOCK_CHANGE &&
    changeEvent.element === 'field' &&
    changeEvent.blockId === block.id
  ) {
    if (
      ['load_object', 'load_multi_object', 'load_model', 'load_character'].includes(block.type) &&
      changeEvent.name === 'MODELS'
    ) {
      changed = 'MODELS';
    } else if (block.type === 'create_map' && changeEvent.name === 'MAP_NAME') {
      changed = 'MAP_NAME';
    } else if (block.type === 'create_group' && changeEvent.name === 'ACTIVE') {
      changed = 'ACTIVE';
    } else if (block.type === 'create_3d_text' && changeEvent.name === 'HORIZONTAL') {
      changed = 'HORIZONTAL';
    } else if (CAMERA_BLOCK_TYPES.has(block.type) && ['TARGET', 'VISIBLE'].includes(changeEvent.name)) {
      changed = changeEvent.name;
    }
  }

  // Check if the changed block is in one of our inputs
  if (!changed && parent?.inputList) {
    changed =
      parent.inputList.find((input) => {
        const id =
          input?.connection?.targetConnection?.sourceBlock_?.id ??
          input?.connection?.shadowState?.id;
        return id === changedBlock.id;
      })?.name || changed;

    if (parent.type === 'material' && ['SCALE', 'ANGLE'].includes(changed)) {
      changed = 'MATERIAL_OPTION';
    }

    const leftColourInput =
      changeEvent.oldParentId === block.id && changeEvent.oldInputName in colorFields;
    if (!changed && leftColourInput) changed = changeEvent.oldInputName;

    if (block.type === 'load_character') {
      const touched = [changeEvent.blockId, changeEvent.newParentId, changeEvent.oldParentId];
      const colourInput = Object.keys(colorFields).find((name) => {
        const target = block.getInputTargetBlock(name);
        return touched.some((id) => isBlockIdDescendantOf(target, id));
      });
      if (colourInput) changed = colourInput;
    }

    if (changed && flock.meshDebug) {
      console.log(`Change detected in input: ${changed}`);
    }
  }

  // An edit inside a list reports the list's ADDn slot; name the text
  // block's own input so depth lists rebuild and colour lists repaint.
  if (block.type === 'create_3d_text' && changed?.startsWith?.('ADD')) {
    let child = changedBlock;
    while (child && child.getParent() !== block) child = child.getParent();
    changed = (child && block.getInputWithBlock(child)?.name) || changed;
  }

  // Special handling for material blocks - check if change is in material subtree
  for (const inputName of ['COLOR', 'COLORS']) {
    if (changed) break;
    const colorInput = block.getInputTargetBlock(inputName);
    if (colorInput) {
      // Check if the changed block is the color input or in its subtree
      const isMaterialChange =
        changeEvent.blockId === colorInput.id ||
        isBlockIdDescendantOf(colorInput, changeEvent.blockId) ||
        isBlockIdDescendantOf(colorInput, changeEvent.newParentId) ||
        isBlockIdDescendantOf(colorInput, changeEvent.oldParentId);

      if (isMaterialChange) {
        changed = inputName;
        if (flock.meshDebug) console.log(`Material change detected in ${inputName} input subtree`);
      }
    }
  }

  if (!changed && block.type === 'create_map') {
    const m = block.getInputTargetBlock('MATERIAL');
    if (m) {
      const touched =
        isBlockIdDescendantOf(m, changeEvent.blockId) ||
        isBlockIdDescendantOf(m, changeEvent.newParentId) ||
        isBlockIdDescendantOf(m, changeEvent.oldParentId) ||
        (changeEvent.type === Blockly.Events.BLOCK_CHANGE && changeEvent.blockId === m.id);
      if (touched) changed = 'MATERIAL';
    }
  }

  if (!changed) {
    if (
      block.type === 'set_sky_color' ||
      block.type === 'set_background_color' ||
      block.type === 'create_ground' ||
      block.type === 'create_map'
    ) {
      changed = 'COLOR';
    } else {
      if (flock.meshDebug) console.log('No relevant change detected, returning');
      return;
    }
  }

  if (flock.meshDebug) console.log(`Processing change type: ${changed}`);

  if (
    (block.type === 'load_object' ||
      block.type === 'load_multi_object' ||
      block.type === 'load_model' ||
      block.type === 'load_character') &&
    changed === 'MODELS' &&
    meshes.length === 0
  ) {
    meshes.push(...getMeshesFromBlock(block));
  }

  //if (meshes.length && mesh.physics) mesh.physics.disablePreStep = true;

  if (block.type === 'set_sky_color') {
    updateSkyFromBlock(block);
    return;
  }

  if (block.type === 'set_background_color') {
    applyBackgroundColorFromBlock(block);
    return;
  }

  if (block.type === 'create_ground') {
    updateGroundFromBlock(null, block, changeEvent);
    return;
  }

  if (block.type === 'create_map') {
    updateMapFromBlock(null, block, changeEvent);
    return;
  }

  if (block.type === 'create_group' && changed === 'ACTIVE') {
    handleGroupActiveToggle(meshes[0], block);
    return;
  }

  if (CAMERA_BLOCK_TYPES.has(block.type)) {
    if (changed === 'VISIBLE') {
      const visible = block.getFieldValue('VISIBLE') === 'TRUE';
      meshes.forEach((mesh) => flock.setCameraFrameVisible(mesh.name, visible));
    } else if (['TARGET', 'DISTANCE', 'UP', 'AROUND'].includes(changed)) {
      const options = readTargetCameraOptions(block);
      meshes.forEach((mesh) => flock.updateCameraRig(mesh.name, options));
    }
    if (!['X', 'Y', 'Z'].includes(changed)) return;
  }

  const colourIsRandom = colourSourceIsRandom(block);

  // Random sources roll per mesh in the loop; resolving here would waste a roll.
  let color;
  let materialInfo = null;
  if (!colourIsRandom) {
    ({ color, materialInfo } = resolveColorAndMaterialForBlock(block));
  }

  if (block.type.startsWith('load_') && changed === 'SCALE') {
    meshes.forEach((mesh) => {
      const parentMesh = detachFromParent(mesh);
      try {
        updateLoadBlockScaleFromEvent(mesh, block, changeEvent);
      } finally {
        reattachToParent(mesh, parentMesh);
      }
      reattachToBone(mesh);
    });
  }

  // Handle load_* blocks (models and character colours)
  if (handleLoadBlockChange(meshes, block, changed, changeEvent)) {
    return;
  }

  meshes.forEach((mesh) => {
    const parentMesh = detachFromParent(mesh);
    try {
      handlePrimitiveGeometryChange(mesh, block, changed);
    } finally {
      reattachToParent(mesh, parentMesh);
    }

    // Random colour rolls per mesh; resolving once would paint all copies alike.
    let meshColour = color;
    let meshMaterial = materialInfo;
    if (colourIsRandom) {
      ({ color: meshColour, materialInfo: meshMaterial } = resolveColorAndMaterialForBlock(block));
    }

    handleMaterialOrColorChange(mesh, block, changed, meshColour, meshMaterial);
  });

  if (['X', 'Y', 'Z'].includes(changed)) {
    const isFieldChange =
      changeEvent.type === Blockly.Events.BLOCK_CHANGE && changeEvent.element === 'field';

    // Decide which block actually owns the X/Y/Z inputs:
    // - rotate_to / resize child (nested inside DO)
    // - otherwise the root block itself
    const contextBlock =
      parent && (parent.type === 'rotate_to' || parent.type === 'resize') ? parent : block;

    // rotate_to / resize: also allow gizmo / non-field events
    if (contextBlock.type === 'rotate_to' || contextBlock.type === 'resize') {
      applyTransformBlockToMeshes(contextBlock, meshes);
      return;
    }

    // --- Everything else (positionAt) stays strict: only real field edits ---
    if (!isFieldChange) {
      if (flock.meshDebug) {
        console.log(
          'Ignoring X/Y/Z change for non-field event on',
          block.type,
          'event type:',
          changeEvent.type
        );
      }
      return;
    }

    // This is a direct X/Y/Z on the root block (e.g. create_box, load_object)
    if (parent && parent.id !== block.id) {
      if (flock.meshDebug) {
        console.log(
          'X/Y/Z change is on a nested block; skipping positionAt for',
          'root:',
          block.type,
          'parent:',
          parent.type
        );
      }
      return;
    }

    const position = getXYZFromBlock(block);
    if (flock.meshDebug) console.log('Position', position, block.type);
    meshes.forEach((mesh) => {
      // attach discards the block's X/Y/Z, and setParent below ignores
      // _transformToBoneReferal.
      if (isBoneAttached(mesh)) return;
      // Child object (parented mesh): defer the apply so the parent has settled
      // first (see scheduleChildPositionApply) — then unparent/move/reparent.
      if (mesh.parent) {
        scheduleChildPositionApply(mesh, block);
        return;
      }
      flock.positionAt(mesh.name, { ...position, useY: true });
    });
  }

  meshes.forEach((mesh) => flock.updatePhysics(mesh));

  if (flock.meshDebug) console.log('=== UPDATE COMPLETE ===');
}

function moveMeshToOrigin(mesh) {
  mesh.position = flock.BABYLON.Vector3.Zero();
  mesh.rotation = flock.BABYLON.Vector3.Zero();
  return mesh;
}

function setAbsoluteSize(mesh, width, height, depth) {
  flock.ensureUniqueGeometry(mesh);
  const boundingInfo = mesh.getBoundingInfo();
  const originalSize = boundingInfo.boundingBox.extendSize;

  // Store the current world matrix and decompose it
  const worldMatrix = mesh.computeWorldMatrix(true);
  const currentScale = new flock.BABYLON.Vector3();
  const currentRotationQuaternion = new flock.BABYLON.Quaternion();
  const currentPosition = new flock.BABYLON.Vector3();
  worldMatrix.decompose(currentScale, currentRotationQuaternion, currentPosition);

  // Temporarily move mesh to origin
  mesh = moveMeshToOrigin(mesh);

  // Calculate new scaling
  const newScaleX = width / (originalSize.x * 2);
  const newScaleY = height / (originalSize.y * 2);
  const newScaleZ = depth === 0 ? 1 : depth / (originalSize.z * 2);

  // Apply scaling
  mesh.scaling = new flock.BABYLON.Vector3(newScaleX, newScaleY, newScaleZ);

  // Bake the scaling into the vertices
  mesh.bakeCurrentTransformIntoVertices();

  // Reset scaling to 1,1,1
  mesh.scaling = flock.BABYLON.Vector3.One();

  // Restore original position and rotation from world matrix
  mesh.position = currentPosition;
  mesh.rotationQuaternion = currentRotationQuaternion;

  let shapeType = null;
  if (mesh.metadata) shapeType = mesh.metadata.shapeType;
  if (mesh.physics && shapeType) {
    const shape = mesh.physics.shape;
    let newShape, diameterBottom, startPoint, endPoint;

    // Create the new physics shape based on the type
    switch (shapeType) {
      case 'Box':
        newShape = new flock.BABYLON.PhysicsShapeBox(
          flock.BABYLON.Vector3.Zero(),
          new flock.BABYLON.Quaternion(0, 0, 0, 1),
          new flock.BABYLON.Vector3(width, height, depth),
          mesh.getScene()
        );
        break;
      case 'Cylinder':
        diameterBottom = Math.min(width, depth);
        startPoint = new flock.BABYLON.Vector3(0, -height / 2, 0);
        endPoint = new flock.BABYLON.Vector3(0, height / 2, 0);
        newShape = new flock.BABYLON.PhysicsShapeCylinder(
          startPoint,
          endPoint,
          diameterBottom / 2,
          mesh.getScene()
        );
        break;
      case 'Sphere':
        newShape = new flock.BABYLON.PhysicsShapeSphere(
          flock.BABYLON.Vector3.Zero(),
          Math.max(width, depth, height) / 2,
          mesh.getScene()
        );
        break;
      case 'Capsule':
        newShape = flock.createCapsuleFromBoundingBox(mesh, mesh.getScene());
        break;
      case 'Wedge':
        newShape = new flock.BABYLON.PhysicsShapeConvexHull(mesh, mesh.getScene());
        break;
      case 'Donut':
      case 'Ring':
        try {
          const motionType = mesh.physics.getMotionType?.();
          if (
            typeof flock.isHollowWalledMesh === 'function' &&
            flock.isHollowWalledMesh(mesh) &&
            motionType === flock.BABYLON.PhysicsMotionType.DYNAMIC &&
            typeof flock.createHollowContainerShape === 'function'
          ) {
            newShape = flock.createHollowContainerShape(mesh, mesh.getScene());
            if (newShape) mesh.metadata.physicsShapeType = 'CONTAINER';
          } else {
            newShape = new flock.BABYLON.PhysicsShapeMesh(mesh, mesh.getScene());
            if (newShape) mesh.metadata.physicsShapeType = 'MESH';
          }
        } catch {
          newShape = new flock.BABYLON.PhysicsShapeMesh(mesh, mesh.getScene());
        }
        break;
      default:
        console.log('Unknown or unsupported physics shape type: ' + shapeType);
        break;
    }

    if (newShape) {
      shape.dispose();
      const physicsBody = mesh.physics;
      physicsBody.shape = newShape;
      mesh.physics.disablePreStep;
      mesh.computeWorldMatrix(true);
    }
  }
}

function updateCylinderGeometry(mesh, diameterTop, diameterBottom, height, sides) {
  // Store the current world matrix and decompose it
  const worldMatrix = mesh.computeWorldMatrix(true);
  const currentScale = new flock.BABYLON.Vector3();
  const currentRotationQuaternion = new flock.BABYLON.Quaternion();
  const currentPosition = new flock.BABYLON.Vector3();
  worldMatrix.decompose(currentScale, currentRotationQuaternion, currentPosition);

  // If the mesh has geometry, dispose of it before updating
  if (mesh.geometry) {
    mesh.geometry.dispose();
  }

  // Temporarily reset mesh transform
  mesh = moveMeshToOrigin(mesh);
  mesh.scaling = flock.BABYLON.Vector3.One();

  // Create a temporary mesh with the provided dimensions (already in world space)
  const tempMesh = flock.BABYLON.MeshBuilder.CreateCylinder(
    '',
    {
      height: height,
      diameterTop: diameterTop,
      diameterBottom: diameterBottom,
      tessellation: sides,
      updatable: true,
    },
    mesh.getScene()
  );

  // Extract vertex data from the temporary mesh
  const vertexData = flock.BABYLON.VertexData.ExtractFromMesh(tempMesh);

  // Create new geometry for the mesh
  const newGeometry = new flock.BABYLON.Geometry(
    mesh.name + '_geometry',
    mesh.getScene(),
    vertexData,
    true,
    mesh
  );

  // Apply the new geometry to the mesh
  newGeometry.applyToMesh(mesh);
  mesh.makeGeometryUnique();

  // Dispose of the temporary mesh after extracting vertex data
  tempMesh.dispose();

  // Restore position and rotation only, keep scale at 1,1,1
  mesh.position = currentPosition;
  mesh.rotationQuaternion = currentRotationQuaternion;
  mesh.scaling = flock.BABYLON.Vector3.One();

  // Ensure the world matrix is updated
  mesh.computeWorldMatrix(true);
}

// Rebuild a capsule at a new size. Unlike setAbsoluteSize (scale + bake), this
// regenerates the geometry so the hemispherical caps stay spherical instead of
// being squashed into ellipsoids by non-uniform scaling. Mirrors
// updateCylinderGeometry, with a matching physics-shape rebuild.
function updateCapsuleGeometry(mesh, diameter, height) {
  const radius = diameter / 2;

  // Store the current world matrix and decompose it
  const worldMatrix = mesh.computeWorldMatrix(true);
  const currentScale = new flock.BABYLON.Vector3();
  const currentRotationQuaternion = new flock.BABYLON.Quaternion();
  const currentPosition = new flock.BABYLON.Vector3();
  worldMatrix.decompose(currentScale, currentRotationQuaternion, currentPosition);

  // If the mesh has geometry, dispose of it before updating
  if (mesh.geometry) {
    mesh.geometry.dispose();
  }

  // Temporarily reset mesh transform
  mesh = moveMeshToOrigin(mesh);
  mesh.scaling = flock.BABYLON.Vector3.One();

  // Create a temporary capsule with the requested (world-space) dimensions
  const tempMesh = flock.BABYLON.MeshBuilder.CreateCapsule(
    '',
    {
      radius: radius,
      height: height,
      tessellation: 24,
      updatable: true,
    },
    mesh.getScene()
  );

  // Extract vertex data and rebuild the mesh's geometry
  const vertexData = flock.BABYLON.VertexData.ExtractFromMesh(tempMesh);
  const newGeometry = new flock.BABYLON.Geometry(
    mesh.name + '_geometry',
    mesh.getScene(),
    vertexData,
    true,
    mesh
  );
  newGeometry.applyToMesh(mesh);
  mesh.makeGeometryUnique();
  tempMesh.dispose();

  // Restore position and rotation only, keep scale at 1,1,1
  mesh.position = currentPosition;
  mesh.rotationQuaternion = currentRotationQuaternion;
  mesh.scaling = flock.BABYLON.Vector3.One();

  // Rebuild the physics shape to match the new capsule
  if (mesh.physics && mesh.metadata?.shapeType === 'Capsule') {
    const newShape = flock.createCapsuleFromBoundingBox(mesh, mesh.getScene());
    if (newShape) {
      mesh.physics.shape?.dispose?.();
      mesh.physics.shape = newShape;
    }
  }

  // Ensure the world matrix is updated
  mesh.computeWorldMatrix(true);
}

// Peak and axis reshape the cross-section, so this rebuilds rather than rescales.
function updateWedgeGeometry(mesh, width, height, depth, peak, axis) {
  // This path skips createWedge, so normalise here too.
  const toDimension = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  width = toDimension(width, 1);
  height = toDimension(height, 1);
  depth = toDimension(depth, 1);
  peak = Math.min(1, Math.max(0, toDimension(peak, 0)));
  axis = String(axis).toUpperCase() === 'Z' ? 'Z' : 'X';

  const worldMatrix = mesh.computeWorldMatrix(true);
  const currentScale = new flock.BABYLON.Vector3();
  const currentRotationQuaternion = new flock.BABYLON.Quaternion();
  const currentPosition = new flock.BABYLON.Vector3();
  worldMatrix.decompose(currentScale, currentRotationQuaternion, currentPosition);

  if (mesh.geometry) {
    mesh.geometry.dispose();
  }

  mesh = moveMeshToOrigin(mesh);
  mesh.scaling = flock.BABYLON.Vector3.One();

  const tempMesh = flock.BABYLON.MeshBuilder.CreatePolyhedron(
    '',
    {
      custom: flock.wedgeGeometryData({ width, height, depth, peak, axis }),
    },
    mesh.getScene()
  );

  const vertexData = flock.BABYLON.VertexData.ExtractFromMesh(tempMesh);
  const newGeometry = new flock.BABYLON.Geometry(
    mesh.name + '_geometry',
    mesh.getScene(),
    vertexData,
    true,
    mesh
  );
  newGeometry.applyToMesh(mesh);
  mesh.makeGeometryUnique();
  tempMesh.dispose();

  mesh.position = currentPosition;
  mesh.rotationQuaternion = currentRotationQuaternion;
  mesh.scaling = flock.BABYLON.Vector3.One();

  mesh.metadata = mesh.metadata || {};
  mesh.metadata.wedgePeak = peak;
  mesh.metadata.wedgeAxis = axis;

  if (mesh.physics && mesh.metadata?.shapeType === 'Wedge') {
    const newShape = new flock.BABYLON.PhysicsShapeConvexHull(mesh, mesh.getScene());
    if (newShape) {
      mesh.physics.shape?.dispose?.();
      mesh.physics.shape = newShape;
    }
  }

  mesh.computeWorldMatrix(true);
}

function updateDonutGeometry(mesh, requested) {
  return rebuildWalledGeometry(mesh, 'donutDimensions', flock.donutDimensions(requested), (dims) => {
    const tempMesh = flock.BABYLON.MeshBuilder.CreateTorus(
      '',
      { ...flock.donutTorusOptions(dims), updatable: true },
      mesh.getScene()
    );
    const vertexData = flock.BABYLON.VertexData.ExtractFromMesh(tempMesh);
    tempMesh.dispose();
    return vertexData;
  });
}

function updateRingGeometry(mesh, requested) {
  return rebuildWalledGeometry(mesh, 'ringDimensions', flock.ringDimensions(requested), (dims) =>
    flock.ringVertexData(dims)
  );
}

function rebuildWalledGeometry(mesh, metadataKey, dimensions, buildVertexData) {
  const previous = mesh.metadata?.[metadataKey];
  const unchanged =
    previous &&
    mesh.scaling.equalsToFloats(1, 1, 1) &&
    Object.keys(dimensions).every((key) => previous[key] === dimensions[key]);
  if (unchanged) return false;

  const worldMatrix = mesh.computeWorldMatrix(true);
  const currentScale = new flock.BABYLON.Vector3();
  const currentRotationQuaternion = new flock.BABYLON.Quaternion();
  const currentPosition = new flock.BABYLON.Vector3();
  worldMatrix.decompose(currentScale, currentRotationQuaternion, currentPosition);

  if (mesh.geometry) {
    mesh.geometry.dispose();
  }

  mesh = moveMeshToOrigin(mesh);
  mesh.scaling = flock.BABYLON.Vector3.One();

  const newGeometry = new flock.BABYLON.Geometry(
    mesh.name + '_geometry',
    mesh.getScene(),
    buildVertexData(dimensions),
    true,
    mesh
  );
  newGeometry.applyToMesh(mesh);
  mesh.makeGeometryUnique();

  mesh.position = currentPosition;
  mesh.rotationQuaternion = currentRotationQuaternion;
  mesh.scaling = flock.BABYLON.Vector3.One();

  mesh.metadata = mesh.metadata || {};
  mesh.metadata[metadataKey] = dimensions;

  if (mesh.physics) {
    // A dynamic ring/donut needs the hollow container; a static one keeps the
    // exact triangle mesh. Match setPhysicsForMesh so live edits don't flip
    // the behaviour the user saw (edit "fixing" the fall).
    let newShape = null;
    try {
      const motionType = mesh.physics.getMotionType?.();
      if (
        typeof flock.isHollowWalledMesh === 'function' &&
        flock.isHollowWalledMesh(mesh) &&
        motionType === flock.BABYLON.PhysicsMotionType.DYNAMIC &&
        typeof flock.createHollowContainerShape === 'function'
      ) {
        newShape = flock.createHollowContainerShape(mesh, mesh.getScene());
        if (newShape) mesh.metadata.physicsShapeType = 'CONTAINER';
      } else {
        newShape = new flock.BABYLON.PhysicsShapeMesh(mesh, mesh.getScene());
        if (newShape) mesh.metadata.physicsShapeType = 'MESH';
      }
    } catch {
      newShape = null;
    }
    if (newShape) {
      mesh.physics.shape?.dispose?.();
      mesh.physics.shape = newShape;
    }
  }

  mesh.computeWorldMatrix(true);
  return true;
}

function replaceMeshModel(currentMesh, block) {
  if (!currentMesh || !block) return;

  const animationInfo = flock._getCurrentAnimationInfo(currentMesh);

  const modelName = block.getFieldValue('MODELS');
  if (!modelName) return;

  const wasEnabled =
    typeof currentMesh.isEnabled === 'function'
      ? currentMesh.isEnabled()
      : (currentMesh.isVisible ?? true);
  const setMeshEnabled = (enabled) => {
    if (typeof currentMesh.setEnabled === 'function') {
      currentMesh.setEnabled(enabled);
    } else {
      currentMesh.isVisible = enabled;
    }
  };

  if (wasEnabled) setMeshEnabled(false);

  // ---------- helpers ----------
  function walkNodes(root) {
    const out = [];
    const stack = [root];
    while (stack.length) {
      const n = stack.pop();
      if (!n) continue;
      out.push(n);
      if (n.getChildren) {
        const kids = n.getChildren();
        for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
      }
    }
    return out;
  }

  function isRenderableMesh(n) {
    const cls = n?.getClassName?.();
    return cls === 'Mesh' || cls === 'InstancedMesh';
  }

  const warnSuppressed = (operation, error) => {
    console.warn(`[replaceMeshModel] Suppressed non-critical error in ${operation}:`, error);
  };

  function disposeTree(node) {
    if (!node || node.isDisposed?.()) return;
    const kids = node.getChildren ? node.getChildren() : [];
    for (const k of kids) disposeTree(k);
    try {
      node.setParent?.(null);
    } catch (error) {
      warnSuppressed('disposeTree:setParent', error);
    }
    try {
      node.dispose?.();
    } catch (error) {
      warnSuppressed('disposeTree:dispose', error);
    }
  }

  function disposePhysics(node) {
    try {
      node.physics?.dispose?.();
    } catch (error) {
      warnSuppressed('disposePhysics:physics.dispose', error);
    }
  }

  function stripPhysicsTree(root) {
    const stack = [root];
    while (stack.length) {
      const n = stack.pop();
      if (!n) continue;
      disposePhysics(n);
      if (n.getChildren) {
        const kids = n.getChildren();
        for (let i = 0; i < kids.length; i++) stack.push(kids[i]);
      }
    }
  }

  function _colToHex(c) {
    if (!c) return null;
    const r = Math.round(c.r * 255),
      g = Math.round(c.g * 255),
      b = Math.round(c.b * 255);
    return _rgbToHex(r, g, b);
  }

  function _rgbToHex(r, g, b) {
    // Ensure values are within valid range
    r = Math.max(0, Math.min(255, Math.round(r)));
    g = Math.max(0, Math.min(255, Math.round(g)));
    b = Math.max(0, Math.min(255, Math.round(b)));

    // Convert to hex and pad with zeros if needed
    const hex =
      '#' +
      [r, g, b]
        .map((x) => {
          const hex = x.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        })
        .join('');

    return hex;
  }

  function _matPrimaryColor(mat) {
    if (!mat) return null;
    return mat.diffuseColor !== undefined && mat.diffuseColor
      ? mat.diffuseColor
      : mat.albedoColor !== undefined && mat.albedoColor
        ? mat.albedoColor
        : null;
  }

  function extractColorsForChangeOrder(root) {
    const colors = [];
    const materialToIndex = new Map();

    function visit(part) {
      let mat = part.material;
      if (!mat && part.getClassName?.() === 'InstancedMesh') {
        mat = part.sourceMesh?.material || null;
      }
      if (mat && !materialToIndex.has(mat)) {
        const mCls = mat.getClassName?.();
        if (mCls === 'MultiMaterial') {
          const subs = mat.subMaterials || [];
          const subMeshes = part.subMeshes || [];
          let chosen = null;
          if (subs.length && subMeshes.length) {
            const idx = subMeshes[0].materialIndex;
            chosen = _matPrimaryColor(subs[idx]);
          }
          if (!chosen && subs.length) chosen = _matPrimaryColor(subs[0]);
          if (!chosen) chosen = _matPrimaryColor(mat);
          colors.push(_colToHex(chosen));
        } else {
          colors.push(_colToHex(_matPrimaryColor(mat)));
        }
        materialToIndex.set(mat, colors.length - 1);
      }
      const kids = part.getChildMeshes?.().sort((a, b) => a.name.localeCompare(b.name)) || [];
      for (const k of kids) visit(k);
    }

    visit(root);
    return colors.filter(Boolean);
  }

  function worldBaseYOfRenderables(roots) {
    let minY = Infinity;
    const collect = Array.isArray(roots) ? roots : [roots];
    for (const r of collect) {
      const nodes = walkNodes(r);
      for (const n of nodes) {
        if (!isRenderableMesh(n) || !(n.getTotalVertices?.() > 0)) continue;
        try {
          n.computeWorldMatrix(true);
          n.refreshBoundingInfo?.();
          const y = n.getBoundingInfo().boundingBox.minimumWorld.y;
          if (y < minY) minY = y;
        } catch (error) {
          warnSuppressed('worldBaseYOfRenderables:boundingInfo', error);
        }
      }
    }
    return isFinite(minY) ? minY : null;
  }

  const NAME_TO_PART = {
    hair: 'hair',
    skin: 'skin',
    eyes: 'eyes',
    shorts: 'shorts',
    tshirt: 'tshirt',
    't-shirt': 'tshirt',
    tee: 'tshirt',
    sleeves: 'sleeves',
    sleeve: 'sleeves',
    detail: 'sleeves',
  };
  const partFromName = (name = '') => {
    const s = name.toLowerCase();
    for (const key of Object.keys(NAME_TO_PART)) {
      if (s === key || s.includes(key)) return NAME_TO_PART[key];
    }
    return null;
  };

  function extractCharacterColorsFromHierarchy(root) {
    const found = {};
    const nodes = walkNodes(root);
    for (const n of nodes) {
      if (!isRenderableMesh(n) || n.name === '__root__') continue;
      const mat = n.material;
      if (!mat) continue;

      const cls = mat.getClassName?.();
      if (cls === 'MultiMaterial') {
        const subMats = mat.subMaterials || [];
        const subMeshes = n.subMeshes || [];
        for (let i = 0; i < subMeshes.length; i++) {
          const idx = subMeshes[i].materialIndex;
          const sm = subMats[idx] || null;
          const part =
            partFromName(n.metadata?.materialPartName) ||
            partFromName(sm?.name) ||
            partFromName(n.name) ||
            partFromName(mat.name);
          const color = sm?.albedoColor || sm?.diffuseColor || null;
          const hex = _colToHex(color);
          if (part && hex && !found[part]) found[part] = hex;
        }
      } else {
        const part =
          partFromName(n.metadata?.materialPartName) ||
          partFromName(mat.name) ||
          partFromName(n.name);
        const color = mat?.albedoColor || mat?.diffuseColor || null;
        const hex = _colToHex(color);
        if (part && hex && !found[part]) found[part] = hex;
      }
    }
    return found;
  }

  // ---------- capture original children and debug ----------
  const originalDirectChildren = (currentMesh.getChildren ? currentMesh.getChildren() : []).slice();
  const oldFirstChild = originalDirectChildren.length ? originalDirectChildren[0] : null;
  const oldChildScale = oldFirstChild?.scaling?.clone?.() || null;

  // ---------- create temp new mesh ----------
  const tempId = `${modelName}__temp__${Date.now()}`;
  const isCharacter = block.type === 'load_character';
  let createArgs;

  if (isCharacter) {
    const prev = (currentMesh.metadata && currentMesh.metadata.colors) || {};
    const extracted = extractCharacterColorsFromHierarchy(currentMesh);
    const characterPalette = { ...prev, ...extracted };

    createArgs = Object.keys(characterPalette).length
      ? { modelName, modelId: tempId, colors: characterPalette }
      : { modelName, modelId: tempId };
  } else {
    createArgs = { modelName, modelId: tempId };
  }

  const newMeshName = isCharacter
    ? flock.createCharacter(createArgs)
    : block.type === 'load_model'
      ? flock.createModel(createArgs)
      : flock.createObject(createArgs);

  flock.whenModelReady(newMeshName, (loadedMesh) => {
    if (!loadedMesh) {
      if (wasEnabled) setMeshEnabled(true);
      return;
    }

    try {
      const newChildren = (loadedMesh.getChildren ? loadedMesh.getChildren() : []).slice();
      if (!newChildren.length) return;
      const newChild = newChildren[0];

      // The pivot a re-run produces. Via world matrices: newChild can sit
      // under __root__.
      let freshLocalPosition = null;
      try {
        loadedMesh.computeWorldMatrix(true);
        newChild.computeWorldMatrix(true);
        freshLocalPosition = flock.BABYLON.Vector3.TransformCoordinates(
          newChild.getAbsolutePosition(),
          flock.BABYLON.Matrix.Invert(loadedMesh.getWorldMatrix())
        );
      } catch (error) {
        warnSuppressed('captureFreshLocalPosition', error);
      }

      // Colors to reapply for non-characters
      let nonCharacterColors = null;
      if (!isCharacter) {
        const cols = [];
        for (const oc of originalDirectChildren) {
          if (oc && !oc.isDisposed?.()) {
            const c = extractColorsForChangeOrder(oc);
            if (c.length) cols.push(...c);
          }
        }
        const blockColors = (() => {
          if (block.type === 'load_multi_object') {
            const colorsInput = block.getInput('COLORS');
            const listBlock = colorsInput?.connection?.targetBlock?.();
            if (listBlock?.type === 'lists_create_with') {
              const collected = [];
              for (const input of listBlock.inputList || []) {
                if (!input?.name?.startsWith('ADD')) continue;
                const target = input.connection?.targetBlock?.();
                const hex =
                  target?.getFieldValue?.('COLOR') || target?.getFieldValue?.('COLOUR') || null;
                if (hex) collected.push(hex);
              }
              return collected;
            }
          }
          return null;
        })();

        nonCharacterColors = blockColors && blockColors.length ? blockColors : cols;
      }

      // Measure old base (world) before removing originals
      const oldBaseY = worldBaseYOfRenderables(originalDirectChildren);

      // Remove physics on the temp container to avoid duplicate bodies
      stripPhysicsTree(loadedMesh);

      // Collect bone-attached objects from the target's metadata list.
      // This is more reliable than traversing the BabylonJS hierarchy because
      // it doesn't depend on getChildren() returning bone-attached meshes.
      const boneAttachments = (currentMesh.metadata?._boneAttachments || [])
        .filter((item) => {
          const m = flock.scene?.getMeshByName?.(item.meshName);
          return m && !m.isDisposed?.();
        })
        .slice();
      // Clear the list before disposal (will be repopulated by flock.attach)
      if (currentMesh.metadata) {
        currentMesh.metadata._boneAttachments = [];
      }
      // Detach each tracked object so it survives the old skeleton disposal
      for (const item of boneAttachments) {
        const m = flock.scene?.getMeshByName?.(item.meshName);
        if (m) {
          m.detachFromBone?.();
          m.parent = null;
        }
      }

      // Remove ONLY the original direct children
      const removed = [];
      const skipped = [];
      for (const child of originalDirectChildren) {
        if (!child || child.isDisposed?.()) {
          skipped.push({ name: child?.name, reason: 'already disposed' });
          continue;
        }
        if (child === currentMesh) {
          skipped.push({ name: child.name, reason: 'is parent' });
          continue;
        }
        if (child.parent !== currentMesh) {
          skipped.push({ name: child.name, reason: 'no longer direct child' });
          continue;
        }
        stripPhysicsTree(child);
        disposeTree(child);
        removed.push(child.name);
      }
      for (const child of newChildren) child.parent = currentMesh;
      currentMesh.metadata = currentMesh.metadata || {};
      currentMesh.metadata.modelName = loadedMesh.metadata?.modelName ?? modelName;
      currentMesh.metadata.displayName =
        loadedMesh.metadata?.displayName ?? currentMesh.metadata.displayName;

      // Re-attach any objects that were bone-attached to the old skeleton
      for (const item of boneAttachments) {
        flock.attach(item.meshName, currentMesh.name, {
          boneName: item.boneName,
          x: item.offset?.x ?? 0,
          y: item.offset?.y ?? 0,
          z: item.offset?.z ?? 0,
        });
      }

      // Apply old first child's local scale (if any) to the new child
      if (oldChildScale && newChild.scaling) {
        try {
          newChild.scaling.copyFrom(oldChildScale);
        } catch (error) {
          warnSuppressed('applyOldScale:copyFrom', error);
        }
        try {
          newChild.computeWorldMatrix(true);
          newChild.refreshBoundingInfo?.();
        } catch (error) {
          warnSuppressed('applyOldScale:refreshBounds', error);
        }
      }

      // Bone-attached keeps its own pivot; grounded keeps its base.
      if (isBoneAttached(currentMesh)) {
        if (freshLocalPosition) newChild.position.copyFrom(freshLocalPosition);
        reattachToBone(currentMesh);
      } else if (oldBaseY != null) {
        try {
          const newBaseY = worldBaseYOfRenderables(newChildren);
          if (newBaseY != null) {
            const dy = oldBaseY - newBaseY;
            for (const child of newChildren) {
              const abs = child.getAbsolutePosition();
              child.setAbsolutePosition(new flock.BABYLON.Vector3(abs.x, abs.y + dy, abs.z));
            }
          }
        } catch (error) {
          warnSuppressed('baseAlignment:setAbsolutePosition', error);
        }
      }

      // Apply material/colour from the block, then fall back to saved colours
      const { color: blockColor, materialInfo } = resolveColorAndMaterialForBlock(block);

      if (materialInfo || blockColor) {
        try {
          handleMaterialOrColorChange(newChild, block, 'COLOR', blockColor, materialInfo);
        } catch (e) {
          console.warn('handleMaterialOrColorChange failed', e);
        }
      }

      if (isCharacter) {
        const palette = (currentMesh.metadata && currentMesh.metadata.colors) || null;
        if (palette && Object.keys(palette).length) {
          try {
            flock.applyColorsToCharacter(currentMesh, palette);
          } catch (error) {
            warnSuppressed('applyCharacterColors', error);
          }
        }
      } else if (nonCharacterColors && nonCharacterColors.length) {
        try {
          //flock.changeColorMesh(newChild, nonCharacterColors);
        } catch (e) {
          console.warn('changeColorMesh failed', e);
        }
      }

      // Dispose the now-empty loader wrapper (physics already stripped)
      if (!loadedMesh.isDisposed?.()) {
        try {
          loadedMesh.setParent?.(null);
        } catch (error) {
          warnSuppressed('disposeLoadedMesh:setParent', error);
        }
        try {
          loadedMesh.dispose?.();
        } catch (error) {
          warnSuppressed('disposeLoadedMesh:dispose', error);
        }
      }

      if (animationInfo?.name) {
        flock.switchAnimation(currentMesh.name, {
          animationName: animationInfo.name,
          restart: true,
          loop: animationInfo.isLooping ?? true, // defaults to true if undefined
        });
      }
    } finally {
      if (wasEnabled) setMeshEnabled(true);
    }
  });
}

const CHARACTER_COLOR_PARTS = ['hair', 'skin', 'eyes', 'tshirt', 'shorts', 'sleeves'];
const MULTI_COLOUR_SOURCE_TYPES = new Set(['load_model', 'load_multi_object', 'create_group']);

function meshColorHex(mesh) {
  const colour = mesh?.material?.albedoColor || mesh?.material?.diffuseColor;
  return colour?.toHexString ? colour.toHexString() : '#ffffff';
}

// Same slot order as changeColorMesh uses for a colour list.
function getCloneColorSlots(cloneRoot, mesh) {
  const parts = [cloneRoot, ...cloneRoot.getChildMeshes()];
  if (parts.some((part) => flock.getCanonicalPartName(part))) {
    const colors = CHARACTER_COLOR_PARTS.map((name) =>
      meshColorHex(parts.find((part) => flock.getCanonicalPartName(part) === name))
    );
    return {
      colors,
      index: CHARACTER_COLOR_PARTS.indexOf(flock.getCanonicalPartName(mesh)),
      isCharacter: true,
    };
  }

  const sourceType = meshMap[cloneRoot.metadata?.sourceBlockKey]?.type;
  if (sourceType && !MULTI_COLOUR_SOURCE_TYPES.has(sourceType)) {
    return { colors: [meshColorHex(mesh)], index: 0, isCharacter: false };
  }

  const slots = flock.getColorSlots(cloneRoot, { includeRoot: true });
  const colors = [];
  slots.forEach(({ mesh: slotMesh, index }) => {
    colors[index] ??= meshColorHex(slotMesh);
  });
  return {
    colors,
    index: slots.find((slot) => slot.mesh === mesh)?.index ?? 0,
    isCharacter: false,
  };
}

function colourListSpec(colors) {
  return {
    type: 'lists_create_with',
    extraState: { itemCount: colors.length },
    inline: true,
    inputs: Object.fromEntries(
      colors.map((c, i) => [`ADD${i}`, { shadow: { type: 'colour', fields: { COLOR: c } } }])
    ),
  };
}

// Keeps any extra entries the user added; colour lists wrap across slots
// (see applyMaterialToHierarchy), characters take one entry per part.
function setCloneColor(cloneBlock, cloneRoot, mesh, color) {
  const { colors, index, isCharacter } = getCloneColorSlots(cloneRoot, mesh);
  if (index < 0) return;
  colors[index] = color;

  const { block } = findOrCreateDoBlock(cloneBlock, {
    type: 'change_color',
    varField: 'MODEL_VAR',
    varId: getOwnVar(cloneBlock),
    inputs: {
      COLOR: {
        shadow: { type: 'colour', fields: { COLOR: color } },
        block: colourListSpec(colors),
      },
    },
  });

  const workspace = block.workspace;
  const input = block.getInput('COLOR');
  let list = input.connection.targetBlock();
  const countEntries = (b) => b.inputList.filter((inp) => /^ADD\d+$/.test(inp.name)).length;
  const usable =
    list?.type === 'lists_create_with' && countEntries(list) > (isCharacter ? index : 0);
  if (!usable) {
    if (list && !list.isShadow()) list.dispose(false);
    list = Blockly.serialization.blocks.append(colourListSpec(colors), workspace);
    input.connection.connect(list.outputConnection);
  }

  const length = countEntries(list);
  const entryIndex = isCharacter ? index : index % length;
  const entry = list.getInputTargetBlock(`ADD${entryIndex}`);
  if (entry?.getField?.('COLOR')) {
    entry.setFieldValue(color, 'COLOR');
  } else {
    if (entry && !entry.isShadow()) entry.dispose(false);
    const colourBlock = Blockly.serialization.blocks.append(
      { type: 'colour', fields: { COLOR: color } },
      workspace
    );
    list.getInput(`ADD${entryIndex}`).connection.connect(colourBlock.outputConnection);
  }

  const listColors = Array.from({ length }, (_, i) => {
    const target = list.getInputTargetBlock(`ADD${i}`);
    return target?.getField?.('COLOR')
      ? target.getFieldValue('COLOR')
      : (colors[i] ?? colors[i % colors.length]);
  });

  getMeshesFromBlock(cloneBlock).forEach((clone) => flock.changeColorMesh(clone, listColors));
  highlightBlockById(Blockly.getMainWorkspace(), block);
}

export function updateBlockColorAndHighlight(mesh, selectedColor, { letter } = {}) {
  // ---------- helpers
  const withUndoGroup = (fn) => {
    try {
      Blockly.Events.setGroup(true);
      fn();
    } finally {
      Blockly.Events.setGroup(false);
    }
  };

  const setColorOnTargetOrField = (targetBlock, parentBlock, colorHex) => {
    if (targetBlock) {
      if (targetBlock.getField?.('COLOR')) {
        targetBlock.setFieldValue(colorHex, 'COLOR');
        return true;
      }
      if (targetBlock.getField?.('COLOUR')) {
        targetBlock.setFieldValue(colorHex, 'COLOUR');
        return true;
      }
    }
    if (parentBlock) {
      if (parentBlock.getField?.('COLOR')) {
        parentBlock.setFieldValue(colorHex, 'COLOR');
        return true;
      }
      if (parentBlock.getField?.('COLOUR')) {
        parentBlock.setFieldValue(colorHex, 'COLOUR');
        return true;
      }
    }
    return false;
  };

  // Ensure a colour target exists on an input: connect shadow if needed, then return the target block.
  const ensureColorTargetOnInput = (input) => {
    if (!input?.connection) return null;
    let tgt = input.connection.targetBlock?.();
    const ws = input.sourceBlock_?.workspace;
    if (!tgt && ws) {
      // materialize existing shadow if present
      const shadowDom = input.connection.getShadowDom?.();
      if (shadowDom) {
        const shadowBlock = Blockly.Xml.domToBlock(shadowDom, ws);
        if (shadowBlock?.outputConnection) input.connection.connect(shadowBlock.outputConnection);
        tgt = input.connection.targetBlock?.();
      }
      // or create a new colour picker shadow
      if (!tgt) {
        const picker = ws.newBlock('colour_picker');
        picker.setShadow(true);
        picker.initSvg();
        picker.render();
        input.connection.connect(picker.outputConnection);
        tgt = picker;
      }
    }
    return tgt || null;
  };

  const isColorishName = (name) => /(?:^|_)(MAP_)?COL(?:OU)?R$/i.test(name || '');

  const findNestedColorTarget = (rootBlock, visited = new Set()) => {
    if (!rootBlock || visited.has(rootBlock.id)) return null;
    visited.add(rootBlock.id);

    if (rootBlock.getField?.('COLOR') || rootBlock.getField?.('COLOUR')) {
      return { input: null, targetBlock: rootBlock, ownerBlock: rootBlock };
    }

    for (const inp of rootBlock.inputList || []) {
      if (isColorishName(inp?.name)) {
        const targetBlock = ensureColorTargetOnInput(inp);
        return { input: inp, targetBlock, ownerBlock: rootBlock };
      }
    }

    for (const inp of rootBlock.inputList || []) {
      const child = inp?.connection?.targetBlock?.();
      if (!child) continue;
      const found = findNestedColorTarget(child, visited);
      if (found) return found;
    }

    return null;
  };

  const materialToFieldMap = {
    Hair: 'HAIR_COLOR',
    Skin: 'SKIN_COLOR',
    Eyes: 'EYES_COLOR',
    Sleeves: 'SLEEVES_COLOR',
    Detail: 'SLEEVES_COLOR',
    Shorts: 'SHORTS_COLOR',
    TShirt: 'TSHIRT_COLOR',
  };

  // ---------- main ----------
  let block = null;

  // Special case: background/sky fallback
  if (!mesh || mesh.type === 'set_sky_color') {
    const ws = Blockly.getMainWorkspace();
    const wsBlocks = ws?.getAllBlocks(false) ?? [];
    const backgroundBlock =
      wsBlocks.find((b) => b.type === 'set_background_color' && b.isEnabled()) ??
      wsBlocks.find((b) => b.type === 'set_background_color');
    const skyBlock =
      wsBlocks.find((b) => b.type === 'set_sky_color' && b.isEnabled()) ??
      wsBlocks.find((b) => b.type === 'set_sky_color');

    block = backgroundBlock || skyBlock || meshMap?.['sky'];

    if (!block) {
      // Create sky block
      block = createBlockWithShadows('set_sky_color', null, selectedColor);
      meshMap['sky'] = block;
      // Create start block
      const startBlock = Blockly.getMainWorkspace().newBlock('start');
      startBlock.initSvg();
      startBlock.render();
      // Wrap sky block around start block
      const connection = startBlock.getInput('DO').connection;
      if (connection && block.previousConnection) connection.connect(block.previousConnection);
    }

    withUndoGroup(() => {
      const found = findNestedColorTarget(block);
      if (!found) {
        console.warn('[color] No color target found on background/sky block');
        return;
      }
      setColorOnTargetOrField(found.targetBlock, found.ownerBlock, selectedColor);
      block.initSvg?.();
      highlightBlockById(Blockly.getMainWorkspace(), block);
    });
    return;
  }

  let prefab = null;
  let slot;
  for (let node = mesh; node; node = node.parent) {
    if (node.metadata?.isPrefab) prefab = node;
    slot ??= node.metadata?.prefabMaterialIndex;
  }
  const prefabBlock = meshMap?.[prefab?.metadata?.blockKey];
  if (prefabBlock && !prefabBlock.disposed) {
    const input = prefabBlock.getInput('ARG' + (slot ?? prefabBlock.arguments_.length - 1));
    const found = findNestedColorTarget(ensureColorTargetOnInput(input));
    if (!found) return;
    withUndoGroup(() => {
      setColorOnTargetOrField(found.targetBlock, found.ownerBlock, selectedColor);
      highlightBlockById(Blockly.getMainWorkspace(), prefabBlock);
    });
    return;
  }

  const owner = findParentWithBlockId(mesh);
  const ownerBlock = meshMap?.[owner?.metadata?.blockKey];
  if (CLONE_LIKE_TYPES.has(ownerBlock?.type)) {
    withUndoGroup(() => setCloneColor(ownerBlock, owner, mesh, selectedColor));
    return;
  }

  // Mesh → block (per member inside groups - see getColorRoot)
  const root = getColorRoot(mesh);
  const blockKey = root?.metadata?.blockKey;

  if (!blockKey || !meshMap?.[blockKey]) {
    const ws = Blockly.getMainWorkspace();
    const fallbackBlock = blockKey ? ws?.getBlockById(blockKey) : null;
    if (fallbackBlock) {
      meshMap[blockKey] = fallbackBlock;
      meshBlockIdMap[blockKey] = fallbackBlock.id;
    } else {
      console.warn('[color] Block not found for mesh', {
        mesh: mesh?.name,
        blockKey,
        root: root?.name,
      });
      return;
    }
  }

  if (!meshMap?.[blockKey]) {
    console.warn('[color] Block not found for mesh', {
      mesh: mesh?.name,
      blockKey,
      root: root?.name,
    });
    return;
  }
  block = meshMap[blockKey];

  const materialName = mesh?.material?.name?.replace(/_clone$/, '');
  const colorIndex = mesh?.metadata?.materialIndex;

  if (block.type === 'load_model') {
    const index =
      colorIndex ??
      flock.getColorSlots(root, { ownOnly: true }).find((slot) => slot.mesh === mesh)?.index;
    if (index === undefined) return;
    withUndoGroup(() => {
      block.updateColorAtIndex?.(selectedColor, index);
      block.initSvg?.();
      highlightBlockById(Blockly.getMainWorkspace(), block);
    });
    return;
  }

  if (materialName && Object.prototype.hasOwnProperty.call(materialToFieldMap, materialName)) {
    const fieldName = materialToFieldMap[materialName];
    const input = block.getInput(fieldName);
    if (!input) {
      console.warn(`[color] Character field input '${fieldName}' not found on '${block.type}'`);
      return;
    }
    withUndoGroup(() => {
      const target = ensureColorTargetOnInput(input);
      setColorOnTargetOrField(target, block, selectedColor);
      block.initSvg?.();
      highlightBlockById(Blockly.getMainWorkspace(), block);
    });
    return;
  }

  if (block.type === 'load_multi_object') {
    withUndoGroup(() => {
      block.updateColorAtIndex?.(selectedColor, colorIndex);
      block.initSvg?.();
      highlightBlockById(Blockly.getMainWorkspace(), block);
    });
    return;
  }

  // A picked 3D text letter recolours its own entry in a colour list, which
  // the letters cycle through.
  const colourList =
    block.type === 'create_3d_text' && letter !== undefined
      ? block.getInputTargetBlock('COLOR')
      : null;
  if (colourList?.type === 'lists_create_with') {
    const slots = colourList.inputList.filter((input) => /^ADD\d+$/.test(input.name));
    if (slots.length) {
      withUndoGroup(() => {
        const target = ensureColorTargetOnInput(slots[letter % slots.length]);
        setColorOnTargetOrField(target, colourList, selectedColor);
        highlightBlockById(Blockly.getMainWorkspace(), block);
      });
      return;
    }
  }

  const found = findNestedColorTarget(block);
  if (!found) {
    console.warn(
      `[color] No nested color target found under block '${block.type}' for mesh '${mesh.name}'`
    );
    return;
  }

  const isDefaultPurple = selectedColor?.toLowerCase?.() === '#9932cc';
  let finalColor = selectedColor;
  if (block.type === 'load_object' && isDefaultPurple && typeof objectColours === 'object') {
    finalColor = objectColours[block.getFieldValue?.('MODELS')] || '#FFD700';
  }

  withUndoGroup(() => {
    setColorOnTargetOrField(found.targetBlock, found.ownerBlock, finalColor);
    block.initSvg?.();
    highlightBlockById(Blockly.getMainWorkspace(), block);
  });
}
