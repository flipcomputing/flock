import * as Blockly from 'blockly';
import { getOwnVar, getOwnDoOwner } from '../generators/generators-utilities.js';
import { setNumberInputs, getNumberInput, isDoOpen, findOrCreateDoBlock } from './blocklyutil.js';
import { flock } from '../flock.js';

const ROTATE = { type: 'rotate_to', varField: 'MODEL' };
const RESIZE = { type: 'resize', varField: 'BLOCK_NAME' };
const MOVE = { type: 'move_to_xyz', varField: 'MODEL' };

const SIZE_OWNER_TYPES = new Set([
  'load_model',
  'load_multi_object',
  'load_object',
  'load_character',
  'create_group',
  'clone_mesh',
]);

export function isInitialTransformBlock(block) {
  return block?.type === ROTATE.type || block?.type === RESIZE.type;
}

export function getInitialTransformOwner(block) {
  return isInitialTransformBlock(block) ? getOwnDoOwner(block) : null;
}

export function supportsInitialSize(owner, mesh) {
  if (!owner || !SIZE_OWNER_TYPES.has(owner.type)) return false;
  return owner.type !== 'clone_mesh' || mesh?.metadata?.shapeType !== 'Group';
}

export function hasInitialTransformRows(block) {
  return typeof block?.setRotateShown === 'function';
}

export function usesAnchorPosition(block) {
  return Boolean(block?.rotateShown_ || block?.resizeShown_);
}

export function readBlockPosition(mesh, block) {
  const anchored =
    usesAnchorPosition(block) || block?.type === 'clone_mesh' || mesh?.metadata?.isPrefab;
  return anchored ? flock._getAnchor(mesh) : flock.getBlockPositionFromMesh(mesh);
}

// Only moved axes are written, so finer values elsewhere are not rounded away.
export function writeMovedPosition(block, position, { decimals = 1 } = {}) {
  const moved = {};
  for (const axis of ['X', 'Y', 'Z']) {
    const value = position[axis.toLowerCase()];
    if (!(Math.abs(getNumberInput(block, axis) - value) <= 0.001)) moved[axis] = value;
  }
  setNumberInputs(block, moved, { decimals });
}

export function placeAtBlockPosition(mesh, block, position) {
  if (usesAnchorPosition(block)) flock._applyInitialTransform(mesh, { position });
  else flock.setBlockPositionOnMesh(mesh, { ...position, useY: true });
}

function findOwnDoBlock(owner, { type, varField }) {
  const ownVar = getOwnVar(owner);
  const first = owner?.getInput?.('DO')?.connection?.targetBlock?.();
  for (let cur = first; cur; cur = cur.getNextBlock?.()) {
    if (cur.type === type && cur.getFieldValue?.(varField) === ownVar) return cur;
  }
  return null;
}

function openDoSection(owner) {
  if (hasInitialTransformRows(owner)) return owner.setOptionsOpen(true);
  if (isDoOpen(owner)) return false;
  // The mutator keeps the +/- and "then" buttons in sync.
  if (typeof owner.toggleDoBlock === 'function') {
    owner.toggleDoBlock();
  } else {
    owner.appendStatementInput('DO').setCheck(null).appendField('');
  }
  return true;
}

function newTransformBlock(owner, { type, varField }, values) {
  const workspace = Blockly.getMainWorkspace();
  const block = workspace.newBlock(type);
  block.setFieldValue(getOwnVar(owner), varField);
  block.initSvg();
  block.render();
  for (const axis of ['X', 'Y', 'Z']) {
    const shadow = workspace.newBlock('math_number');
    shadow.setFieldValue(values[axis], 'NUM');
    shadow.setShadow(true);
    shadow.initSvg();
    shadow.render();
    block.getInput(axis).connection.connect(shadow.outputConnection);
  }
  block.render();
  return block;
}

function appendToDo(owner, block) {
  const doConnection = owner.getInput('DO').connection;
  let tail = doConnection.targetBlock();
  if (!tail) {
    doConnection.connect(block.previousConnection);
    return;
  }
  while (tail.getNextBlock()) tail = tail.getNextBlock();
  tail.nextConnection.connect(block.previousConnection);
}

export function findOwnMove(owner) {
  return owner ? findOwnDoBlock(owner, MOVE) : null;
}

export function ensureOwnMove(owner) {
  const zero = { shadow: { type: 'math_number', fields: { NUM: 0 } } };
  return findOrCreateDoBlock(
    owner,
    {
      type: MOVE.type,
      varField: MOVE.varField,
      varId: getOwnVar(owner),
      inputs: { X: zero, Y: zero, Z: zero },
    },
    { atStart: true }
  ).block;
}

export function findLegacyInitialRotation(owner) {
  return owner ? findOwnDoBlock(owner, ROTATE) : null;
}

export function findInitialRotation(owner) {
  return findLegacyInitialRotation(owner) ?? (owner?.rotateShown_ ? owner : null);
}

export function ensureInitialRotation(owner, seed = { x: 0, y: 0, z: 0 }) {
  if (!owner) return null;
  const addedDoSection = openDoSection(owner);
  const existing = findOwnDoBlock(owner, ROTATE);
  if (existing) return { block: existing, created: false, addedDoSection };

  if (hasInitialTransformRows(owner)) {
    const created = !owner.rotateShown_;
    if (created) {
      owner.setRotateShown(true);
      setInitialRotationValues(owner, seed);
    }
    return { block: owner, created, addedDoSection };
  }

  const block = newTransformBlock(owner, ROTATE, {
    X: String(seed.x),
    Y: String(seed.y),
    Z: String(seed.z),
  });
  appendToDo(owner, block);
  return { block, created: true, addedDoSection };
}

export function findLegacyInitialSize(owner, mesh) {
  return supportsInitialSize(owner, mesh) ? findOwnDoBlock(owner, RESIZE) : null;
}

export function findInitialSize(owner, mesh) {
  if (!supportsInitialSize(owner, mesh)) return null;
  return findOwnDoBlock(owner, RESIZE) ?? (owner.resizeShown_ ? owner : null);
}

export function ensureInitialSize(owner, mesh, measureSize) {
  if (!supportsInitialSize(owner, mesh)) return null;
  const addedDoSection = openDoSection(owner);
  const existing = findOwnDoBlock(owner, RESIZE);
  if (existing) return { block: existing, created: false, addedDoSection };

  const seed = (value) => {
    const num = Number.isFinite(value) && value > 0 ? value : 1;
    return String(Math.round(num * 10) / 10);
  };

  if (hasInitialTransformRows(owner)) {
    const created = !owner.resizeShown_;
    if (created) owner.setResizeShown(true, measureSize());
    return { block: owner, created, addedDoSection };
  }

  const size = measureSize();
  const block = newTransformBlock(owner, RESIZE, {
    X: seed(size.x),
    Y: seed(size.y),
    Z: seed(size.z),
  });

  // Resize before rotate so Play measures the upright box the position was written against.
  const rotateBlock = findOwnDoBlock(owner, ROTATE);
  if (rotateBlock) {
    const targetConnection = rotateBlock.previousConnection.targetConnection;
    rotateBlock.previousConnection.disconnect();
    targetConnection.connect(block.previousConnection);
    block.nextConnection.connect(rotateBlock.previousConnection);
  } else {
    appendToDo(owner, block);
  }
  return { block, created: true, addedDoSection };
}

function isAfter(block, reference) {
  for (let cur = reference.getNextBlock(); cur; cur = cur.getNextBlock()) {
    if (cur === block) return true;
  }
  return false;
}

export function placeMoveAfterInitialTransforms(owner) {
  const move = owner ? findOwnDoBlock(owner, MOVE) : null;
  if (!move) return;
  const transforms = [findOwnDoBlock(owner, ROTATE), findOwnDoBlock(owner, RESIZE)].filter(Boolean);
  const last = transforms.find((t) => transforms.every((o) => o === t || isAfter(t, o)));
  if (!last || isAfter(move, last)) return;

  move.unplug(true);
  const following = last.getNextBlock();
  if (following) last.nextConnection.disconnect();
  last.nextConnection.connect(move.previousConnection);
  if (following) move.nextConnection.connect(following.previousConnection);
}

const AXES = ['x', 'y', 'z'];

function inputName(target, rowPrefix, axis) {
  const name = axis.toUpperCase();
  return hasInitialTransformRows(target) ? `${rowPrefix}_${name}` : name;
}

function readXYZ(target, rowPrefix) {
  return Object.fromEntries(
    AXES.map((axis) => [axis, getNumberInput(target, inputName(target, rowPrefix, axis))])
  );
}

function writeXYZ(target, rowPrefix, values, { axes = AXES, decimals = 1 } = {}) {
  if (!target || target.disposed) return;
  const inputs = {};
  for (const axis of axes) inputs[inputName(target, rowPrefix, axis)] = values[axis];
  setNumberInputs(target, inputs, { decimals });
}

export function getInitialRotationValues(target) {
  return readXYZ(target, 'ROTATE');
}

export function setInitialRotationValues(target, rotation, options) {
  writeXYZ(target, 'ROTATE', rotation, options);
}

export function getInitialSizeValues(target) {
  return readXYZ(target, 'SIZE');
}

export function setInitialSizeValues(target, size, options) {
  writeXYZ(target, 'SIZE', size, options);
}

export function measureInitialSize(mesh) {
  if (!mesh) return null;
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
