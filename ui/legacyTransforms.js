import * as Blockly from 'blockly';
import { flock } from '../flock.js';
import { getOwnVar } from '../generators/generators-utilities.js';
import { getMeshFromBlock } from './blockmesh.js';
import {
  hasInitialTransformRows,
  usesAnchorPosition,
  setInitialRotationValues,
  setInitialSizeValues,
  writeMovedPosition,
} from './initialTransform.js';

const AXES = ['X', 'Y', 'Z'];
const MESH_WAIT_MS = 30000;
const MESH_POLL_MS = 200;

function literalXYZ(block) {
  const values = AXES.map((axis) => {
    const target = block.getInputTargetBlock(axis);
    return target?.type === 'math_number' ? Number(target.getFieldValue('NUM')) : NaN;
  });
  return values.every(Number.isFinite) ? { x: values[0], y: values[1], z: values[2] } : null;
}

function doStatements(owner) {
  const statements = [];
  for (let cur = owner.getInputTargetBlock('DO'); cur; cur = cur.getNextBlock()) {
    statements.push(cur);
  }
  return statements;
}

// A clone's own move straight after the transforms decides where it ends up,
// before and after folding. A cloned group has no size row to take a resize.
function clonePlacedAfter(owner, next, resize) {
  const isOwnMove =
    next?.type === 'move_to_xyz' &&
    next.isEnabled() &&
    next.getFieldValue('MODEL') === getOwnVar(owner) &&
    next.getFieldValue('USE_Y') === 'TRUE';
  if (!isOwnMove) return false;
  if (!resize) return true;
  const sourceVar = owner.getFieldValue('SOURCE_MESH');
  return !owner.workspace
    .getBlocksByType('create_group', false)
    .some((group) => group.getFieldValue('ID_VAR') === sourceVar);
}

// Old projects rotate and resize an add block with DO blocks. Only a leading
// run of plain-number blocks folds into the rows, so the result is identical.
export function findFoldableTransforms(owner) {
  if (!hasInitialTransformRows(owner) || usesAnchorPosition(owner)) return null;
  const ownVar = getOwnVar(owner);
  const statements = doStatements(owner);
  if (statements.some((b) => b.type === 'set_pivot' && b.getFieldValue('MESH') === ownVar)) {
    return null;
  }

  let rotate = null;
  let resize = null;
  let runLength = 0;
  for (const statement of statements) {
    if (!statement.isEnabled()) break;
    if (statement.type === 'resize' && !resize && !rotate) {
      if (statement.getFieldValue('BLOCK_NAME') !== ownVar) break;
      resize = statement;
    } else if (statement.type === 'rotate_to' && !rotate) {
      if (statement.getFieldValue('MODEL') !== ownVar) break;
      rotate = statement;
    } else {
      break;
    }
    runLength += 1;
  }
  if (!rotate && !resize) return null;
  if (resize && !owner.hasResizeRow_) return null;
  if (owner.type === 'clone_mesh' && !clonePlacedAfter(owner, statements[runLength], resize)) {
    return null;
  }

  const position = owner.type === 'clone_mesh' ? null : literalXYZ(owner);
  const rotation = rotate ? literalXYZ(rotate) : null;
  const size = resize ? literalXYZ(resize) : null;
  if (owner.type !== 'clone_mesh' && !position) return null;
  if ((rotate && !rotation) || (resize && !size)) return null;
  if (size && !AXES.every((axis) => size[axis.toLowerCase()] > 0)) return null;
  return { rotate, resize, position, rotation, size };
}

function legacyAnchor(owner, mesh, { position, rotation, size, resize }) {
  if (!position) return null;
  return flock._legacyInitialAnchor(mesh, {
    position,
    placeByOrigin: owner.type === 'create_3d_text',
    rotation,
    size: size && {
      width: size.x,
      height: size.y,
      depth: size.z,
      xOrigin: resize.getFieldValue('X_ORIGIN') || 'CENTRE',
      yOrigin: resize.getFieldValue('Y_ORIGIN') || 'BASE',
      zOrigin: resize.getFieldValue('Z_ORIGIN') || 'CENTRE',
    },
  });
}

export function foldLegacyInitialTransforms(owner, mesh = null) {
  const fold = findFoldableTransforms(owner);
  if (!fold) return false;
  if (fold.position && (!mesh || mesh.isDisposed?.())) return false;
  const { rotate, resize, rotation, size } = fold;
  const anchor = legacyAnchor(owner, mesh, fold);

  const exact = { decimals: 6 };
  Blockly.Events.disable();
  try {
    if (rotate) {
      owner.setRotateShown(true);
      setInitialRotationValues(owner, rotation, exact);
      rotate.dispose(true);
    }
    if (resize) {
      owner.setResizeShown(true, size);
      setInitialSizeValues(owner, size, exact);
      resize.dispose(true);
    }
    if (anchor) writeMovedPosition(owner, anchor, { decimals: 2 });
    if (!owner.getInputTargetBlock('DO') && !owner.getInputTargetBlock('THEN')) {
      owner.removeDoSection?.();
    }
  } finally {
    Blockly.Events.enable();
  }
  return true;
}

function whenBlockMeshReady(block, callback) {
  const started = Date.now();
  const poll = () => {
    if (block.disposed || Date.now() - started > MESH_WAIT_MS) return;
    const mesh = getMeshFromBlock(block);
    if (mesh) callback(mesh);
    else setTimeout(poll, MESH_POLL_MS);
  };
  poll();
}

export function convertLegacyInitialTransforms(workspace) {
  for (const owner of workspace.getAllBlocks(false)) {
    const fold = findFoldableTransforms(owner);
    if (!fold) continue;
    if (fold.position) {
      whenBlockMeshReady(owner, (mesh) => foldLegacyInitialTransforms(owner, mesh));
    } else {
      foldLegacyInitialTransforms(owner);
    }
  }
}
