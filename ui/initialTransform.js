import * as Blockly from 'blockly';
import { getOwnVar, getOwnDoOwner } from '../generators/generators-utilities.js';
import { setNumberInputs, getNumberInput } from './blocklyutil.js';

const ROTATE = { type: 'rotate_to', varField: 'MODEL' };
const RESIZE = { type: 'resize', varField: 'BLOCK_NAME' };

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

function findOwnDoBlock(owner, { type, varField }) {
  const ownVar = getOwnVar(owner);
  const first = owner?.getInput?.('DO')?.connection?.targetBlock?.();
  for (let cur = first; cur; cur = cur.getNextBlock?.()) {
    if (cur.type === type && cur.getFieldValue?.(varField) === ownVar) return cur;
  }
  return null;
}

function openDoSection(owner) {
  if (owner.getInput('DO')) return false;
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

export function findInitialRotation(owner) {
  return owner ? findOwnDoBlock(owner, ROTATE) : null;
}

export function ensureInitialRotation(owner, seed = { x: 0, y: 0, z: 0 }) {
  if (!owner) return null;
  const addedDoSection = openDoSection(owner);
  const existing = findOwnDoBlock(owner, ROTATE);
  if (existing) return { block: existing, created: false, addedDoSection };

  const block = newTransformBlock(owner, ROTATE, {
    X: String(seed.x),
    Y: String(seed.y),
    Z: String(seed.z),
  });
  appendToDo(owner, block);
  return { block, created: true, addedDoSection };
}

export function findInitialSize(owner, mesh) {
  return supportsInitialSize(owner, mesh) ? findOwnDoBlock(owner, RESIZE) : null;
}

export function ensureInitialSize(owner, mesh, measureSize) {
  if (!supportsInitialSize(owner, mesh)) return null;
  const addedDoSection = openDoSection(owner);
  const existing = findOwnDoBlock(owner, RESIZE);
  if (existing) return { block: existing, created: false, addedDoSection };

  const size = measureSize();
  const seed = (value) => {
    const num = Number.isFinite(value) && value > 0 ? value : 1;
    return String(Math.round(num * 10) / 10);
  };
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

const AXIS_INPUTS = { x: 'X', y: 'Y', z: 'Z' };

function readXYZ(target) {
  return {
    x: getNumberInput(target, 'X'),
    y: getNumberInput(target, 'Y'),
    z: getNumberInput(target, 'Z'),
  };
}

function writeXYZ(target, values, { axes = ['x', 'y', 'z'], decimals = 1 } = {}) {
  if (!target || target.disposed) return;
  const inputs = {};
  for (const axis of axes) inputs[AXIS_INPUTS[axis]] = values[axis];
  setNumberInputs(target, inputs, { decimals });
}

export function getInitialRotationValues(target) {
  return readXYZ(target);
}

export function setInitialRotationValues(target, rotation, options) {
  writeXYZ(target, rotation, options);
}

export function getInitialSizeValues(target) {
  return readXYZ(target);
}

export function setInitialSizeValues(target, size, options) {
  writeXYZ(target, size, options);
}
