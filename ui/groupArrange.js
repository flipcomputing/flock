import * as Blockly from 'blockly';
import { flock } from '../flock.js';
import { getMeshFromBlock, writeClonePosition } from './blockmesh.js';
import { getNumberInput, setNumberInputs } from './blocklyutil.js';
import { findOwnMove } from './initialTransform.js';

export const ARRANGE_AXES = ['x', 'y', 'z'];
export const ARRANGE_MODES = ['min', 'centre', 'max', 'distribute'];

// Matches group members' precision: finer digits are float32 noise.
const DECIMALS = 4;
const MIN_MOVE = 0.00005;

export function minMembersFor(mode) {
  return mode === 'distribute' ? 3 : 2;
}

function boundsOf(mesh) {
  mesh.computeWorldMatrix(true);
  const parts = mesh.metadata?.shapeType === 'Group' ? mesh.getChildMeshes(false) : [mesh];
  let min = null;
  let max = null;
  for (const part of parts) {
    if (!part || part.isDisposed?.()) continue;
    const b = part.getHierarchyBoundingVectors(true);
    if (!ARRANGE_AXES.every((axis) => b.min[axis] <= b.max[axis])) continue;
    if (!min) {
      min = b.min.clone();
      max = b.max.clone();
    } else {
      flock.BABYLON.Vector3.CheckExtends(b.min, min, max);
      flock.BABYLON.Vector3.CheckExtends(b.max, min, max);
    }
  }
  return min ? { min, max } : null;
}

const movesAsUnit = (block, mesh) =>
  mesh.metadata?.shapeType === 'Group' || block.type === 'combine';

const hasLiteralPosition = (block, prefix = '') =>
  ['X', 'Y', 'Z'].every((axis) => !!block.getInputTargetBlock(prefix + axis)?.getField('NUM'));

// A member with a computed coordinate is left out rather than counted in the
// bounds: that coordinate can't be written, and the live view doesn't follow
// edits to its other coordinates.
function canMove(block, mesh) {
  if (block.type === 'clone_mesh') {
    const move = findOwnMove(block);
    if (move) return hasLiteralPosition(move);
    return !block.positionShown_ || hasLiteralPosition(block, 'POSITION_');
  }
  return movesAsUnit(block, mesh) || hasLiteralPosition(block);
}

export function getArrangeMembers(groupBlock) {
  const members = [];
  for (let cur = groupBlock?.getInputTargetBlock('DO'); cur; cur = cur.getNextBlock()) {
    if (!cur.isEnabled()) continue;
    const mesh = getMeshFromBlock(cur);
    if (!mesh || mesh.isDisposed?.() || mesh.metadata?.mirror) continue;
    if (!canMove(cur, mesh)) continue;
    const bounds = boundsOf(mesh);
    if (bounds) members.push({ block: cur, mesh, bounds });
  }
  return members;
}

// Offsets along one axis that align or evenly space the boxes, as in
// slide tools: align to the boxes' combined extent; distribute keeps the
// outermost two in place and makes the gaps between neighbours equal.
export function arrangeOffsets(boxes, axis, mode) {
  const lo = boxes.map((b) => b.min[axis]);
  const hi = boxes.map((b) => b.max[axis]);
  const refMin = Math.min(...lo);
  const refMax = Math.max(...hi);

  if (mode === 'min') return lo.map((v) => refMin - v);
  if (mode === 'max') return hi.map((v) => refMax - v);
  if (mode === 'centre') {
    const refCentre = (refMin + refMax) / 2;
    return boxes.map((_, i) => refCentre - (lo[i] + hi[i]) / 2);
  }

  const order = boxes.map((_, i) => i).sort((a, b) => lo[a] + hi[a] - (lo[b] + hi[b]));
  const first = order[0];
  const last = order[order.length - 1];
  const totalSize = order.reduce((sum, i) => sum + hi[i] - lo[i], 0);
  const gap = (hi[last] - lo[first] - totalSize) / (order.length - 1);
  const offsets = new Array(boxes.length).fill(0);
  let cursor = lo[first];
  for (const i of order) {
    offsets[i] = cursor - lo[i];
    cursor += hi[i] - lo[i] + gap;
  }
  return offsets;
}

function moveMember({ block, mesh }, axis, offset, translateGroupedMesh) {
  if (block.type === 'clone_mesh') {
    const anchor = flock._getAnchor(mesh);
    writeClonePosition(block, { ...anchor, [axis]: anchor[axis] + offset }, { decimals: DECIMALS });
    return;
  }
  if (movesAsUnit(block, mesh)) {
    const delta = flock.BABYLON.Vector3.Zero();
    delta[axis] = offset;
    translateGroupedMesh(mesh, delta);
    return;
  }
  const input = axis.toUpperCase();
  const current = getNumberInput(block, input);
  if (Number.isFinite(current)) {
    setNumberInputs(block, { [input]: current + offset }, { decimals: DECIMALS });
  }
}

// One click is one undo step; block changes drive the live mesh updates.
export async function arrangeGroup(groupBlock, axis, mode) {
  // Loaded on use: gizmos.js imports much of the editor.
  const { translateGroupedMesh } = await import('./gizmos.js');
  const members = getArrangeMembers(groupBlock);
  if (members.length < minMembersFor(mode)) return false;

  const offsets = arrangeOffsets(
    members.map((m) => m.bounds),
    axis,
    mode
  ).map((v) => Math.round(v * 10 ** DECIMALS) / 10 ** DECIMALS);

  Blockly.Events.setGroup(Blockly.utils.idGenerator.genUid());
  try {
    members.forEach((member, i) => {
      if (Math.abs(offsets[i]) >= MIN_MOVE) {
        moveMember(member, axis, offsets[i], translateGroupedMesh);
      }
    });
  } finally {
    Blockly.Events.setGroup(false);
  }

  const groupMesh = getMeshFromBlock(groupBlock);
  if (groupMesh?.metadata?.shapeType === 'Group') flock.recomputeGroupGeometry(groupMesh);
  return true;
}
