import { flock } from '../flock.js';
import { GROUND_PLACED_TYPES } from '../toolbox.js';
import { getPlaceOnGroundEnabled } from './controlPreferences.js';

export const GROUND_LEVEL_TYPE = 'ground_level';
export const GROUND_LEVEL_SENTINEL = -999999;
const SNAP_DISTANCE = 0.1;

export function placesOnGround(block) {
  return getPlaceOnGroundEnabled() && GROUND_PLACED_TYPES.has(block?.type);
}

export function isGroundMesh(mesh) {
  return !!mesh && (mesh === flock.ground || mesh.name === 'ground');
}

export function hasGroundLevelY(block) {
  return block?.getInputTargetBlock?.('Y')?.type === GROUND_LEVEL_TYPE;
}

function numberAt(block, inputName) {
  const n = Number(block?.getInputTargetBlock?.(inputName)?.getFieldValue?.('NUM'));
  return Number.isFinite(n) ? n : 0;
}

export function groundYAt(x, z) {
  return flock.getGroundLevelAt?.(x, z) ?? 0;
}

export function groundYForBlock(block) {
  return groundYAt(numberAt(block, 'X'), numberAt(block, 'Z'));
}

// The Y a position block stands for in the editor: ground level resolves to
// the ground height under its own X/Z.
export function readBlockY(block) {
  if (hasGroundLevelY(block)) return groundYForBlock(block);
  const n = Number(block?.getInputTargetBlock?.('Y')?.getFieldValue?.('NUM'));
  return Number.isFinite(n) ? n : NaN;
}

export function isNearGround({ x, y, z }) {
  return Math.abs(y - groundYAt(x, z)) <= SNAP_DISTANCE;
}

// Placed over the number shadow, as if dragged in, so removing it leaves a number.
export function setGroundLevelY(block) {
  const connection = block?.getInput?.('Y')?.connection;
  const target = connection?.targetBlock();
  if (!connection) return false;
  if (target?.type === GROUND_LEVEL_TYPE) return true;
  if (target && !target.isShadow()) return false;
  const ground = block.workspace.newBlock(GROUND_LEVEL_TYPE);
  ground.initSvg?.();
  ground.render?.();
  connection.connect(ground.outputConnection);
  return true;
}

export function setNumberY(block, value) {
  const connection = block?.getInput?.('Y')?.connection;
  const target = connection?.targetBlock();
  if (target?.type !== GROUND_LEVEL_TYPE) return null;
  target.dispose(false);
  const number = connection.targetBlock();
  if (number?.getField('NUM')) number.setFieldValue(String(value), 'NUM');
  else connection.setShadowState({ type: 'math_number', fields: { NUM: value } });
  return connection.targetBlock();
}

// After a placement tool moves a block to `position`: a lifted object gets a
// number, and with the setting on one at the ground gets ground level.
// Returns whether Y is ground level afterwards.
export function syncGroundLevelY(block, position, { decimals = 1 } = {}) {
  const near = isNearGround(position);
  if (near && placesOnGround(block)) return setGroundLevelY(block);
  if (!hasGroundLevelY(block)) return false;
  if (near) return true;
  const factor = 10 ** decimals;
  setNumberY(block, Math.round(position.y * factor) / factor);
  return false;
}
