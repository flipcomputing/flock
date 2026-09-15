import * as Blockly from 'blockly';

const CHILD_GAP = 40;
const TOP_GAP = 8;
export const FOLDER_DO_CHECK = '__folder_do_never_connects__';

function isRendered(block) {
  return !!block && typeof block.getSvgRoot === 'function' && !!block.getSvgRoot();
}

export function getAllFolderBlocks(workspace) {
  return (workspace.getAllBlocks(false) || []).filter((b) => b.type === 'folder');
}

export function buildContainedIdSet(workspace) {
  const ids = new Set();
  for (const folder of getAllFolderBlocks(workspace)) {
    for (const id of folder.containedBlockIds_ || []) ids.add(id);
  }
  return ids;
}

export function generateWorkspaceCode(workspace, javascriptGenerator) {
  const contained = buildContainedIdSet(workspace);
  javascriptGenerator.init(workspace);
  const topBlocks = workspace.getTopBlocks(true).filter((b) => !contained.has(b.id));

  const lines = [];
  for (const block of topBlocks) {
    let line = javascriptGenerator.blockToCode(block);
    if (Array.isArray(line)) line = line[0];
    if (!line) continue;

    if (block.outputConnection) {
      line = javascriptGenerator.scrubNakedValue(line);
      if (javascriptGenerator.STATEMENT_PREFIX && !block.suppressPrefixSuffix) {
        line = javascriptGenerator.injectId(javascriptGenerator.STATEMENT_PREFIX, block) + line;
      }
      if (javascriptGenerator.STATEMENT_SUFFIX && !block.suppressPrefixSuffix) {
        line += javascriptGenerator.injectId(javascriptGenerator.STATEMENT_SUFFIX, block);
      }
    }
    lines.push(line);
  }

  let code = javascriptGenerator.finish(lines.join('\n'));
  code = code.replace(/^\s+\n/, '');
  code = code.replace(/\n\s+$/, '\n');
  code = code.replace(/[ \t]+\n/g, '\n');
  return code;
}

function findOwningFolder(workspace, blockId) {
  for (const folder of getAllFolderBlocks(workspace)) {
    if ((folder.containedBlockIds_ || []).includes(blockId)) return folder;
  }
  return null;
}

function duplicateOwnedBlock(workspace, originalId) {
  const original = workspace.getBlockById(originalId);
  if (!original) return null;
  const state = Blockly.serialization.blocks.save(original);
  if (!state) return null;
  return Blockly.serialization.blocks.append(state, workspace);
}

function deduplicateFolderContents(workspace, folder) {
  const ids = folder.containedBlockIds_;
  if (!Array.isArray(ids) || !ids.length) return;

  let changed = false;
  for (let i = 0; i < ids.length; i++) {
    const owner = findOwningFolder(workspace, ids[i]);
    if (!owner || owner === folder) continue;

    const copy = duplicateOwnedBlock(workspace, ids[i]);
    if (copy) {
      ids[i] = copy.id;
      changed = true;
    }
  }

  if (changed) layoutFolderChildren(folder);
}

function isSelfOrDescendant(workspace, folder, candidateId) {
  if (folder.id === candidateId) return true;
  const ids = folder.containedBlockIds_ || [];
  for (const id of ids) {
    if (id === candidateId) return true;
    const child = workspace.getBlockById(id);
    if (child && child.type === 'folder' && isSelfOrDescendant(workspace, child, candidateId)) {
      return true;
    }
  }
  return false;
}

function setBlockVisible(block, visible) {
  const svg = block?.getSvgRoot?.();
  if (svg) svg.style.display = visible ? '' : 'none';
}

function collectAllDescendantIds(ws, folder, out = []) {
  for (const id of folder.containedBlockIds_ || []) {
    out.push(id);
    const child = ws.getBlockById(id);
    if (child && child.type === 'folder') collectAllDescendantIds(ws, child, out);
  }
  return out;
}

// Blockly coalesces a synthetic BlockChange event away when it's followed by
// the icon field's own change in the same tick, so this hook is called directly.
let reflowTopLevelBlocks = null;
export function setFolderReflowHook(fn) {
  reflowTopLevelBlocks = fn;
}

export function toggleFolderCollapsed(folder) {
  folder.folderCollapsed_ = !folder.folderCollapsed_;
  layoutFolderChildren(folder);
  reflowTopLevelBlocks?.();
  Blockly.Events.fire(new Blockly.Events.BlockChange(folder, 'mutation', null, '', ''));
}

export function layoutFolderChildren(folder) {
  if (!isRendered(folder) || folder.isInFlyout) return;
  if (folder.isDragging?.()) return;
  const ws = folder.workspace;
  const ids = folder.containedBlockIds_ || [];

  if (folder.folderCollapsed_) {
    for (const id of collectAllDescendantIds(ws, folder)) {
      setBlockVisible(ws.getBlockById(id), false);
    }
    // Blockly leaves residual row height if the input is merely hidden, not removed.
    if (folder.getInput('DO')) folder.removeInput('DO');
    folder.render();
    return;
  }

  let doInput = folder.getInput('DO');
  if (!doInput) {
    doInput = folder.appendStatementInput('DO').setCheck(FOLDER_DO_CHECK);
  }
  doInput.setVisible(true);

  const children = ids.map((id) => ws.getBlockById(id)).filter(Boolean);
  let desired = children.length ? TOP_GAP : 0;
  children.forEach((child, index) => {
    const hw = child.getHeightWidth ? child.getHeightWidth() : { width: 100, height: 40 };
    desired += hw.height;
    desired += index < children.length - 1 ? CHILD_GAP : TOP_GAP;
  });
  folder.desiredMouthHeight_ = desired;
  folder.render();

  const origin = folder.getRelativeToSurfaceXY();
  const offset = doInput.connection.getOffsetInBlock();
  const targetX = origin.x + offset.x;
  let cursorY = origin.y + offset.y + (children.length ? TOP_GAP : 0);

  for (const child of children) {
    setBlockVisible(child, true);

    const pos = child.getRelativeToSurfaceXY();
    const dx = targetX - pos.x;
    const dy = cursorY - pos.y;
    if (dx || dy) child.moveBy(dx, dy);

    const hw = child.getHeightWidth ? child.getHeightWidth() : { width: 100, height: 40 };
    cursorY += hw.height + CHILD_GAP;

    if (child.type === 'folder') layoutFolderChildren(child);
  }
}

const ZONE_MARGIN = 10;
const TOP_ANCHOR_OFFSET = 10;
const LEFT_ANCHOR_OFFSET = 15;

function getFolderDropZone(folder) {
  if (!isRendered(folder) || folder.folderCollapsed_) return null;
  const rect = folder.getBoundingRectangle();
  return {
    left: rect.left - ZONE_MARGIN,
    right: rect.right + ZONE_MARGIN,
    top: rect.top - ZONE_MARGIN,
    bottom: rect.bottom + ZONE_MARGIN,
  };
}

function findFolderAt(workspace, draggedBlock) {
  const rect = draggedBlock.getBoundingRectangle?.();
  if (!rect) return null;
  const cx = rect.left + LEFT_ANCHOR_OFFSET;
  const cy = rect.top + TOP_ANCHOR_OFFSET;

  let best = null;
  let bestZoneArea = Infinity;
  for (const folder of getAllFolderBlocks(workspace)) {
    if (folder.id === draggedBlock.id) continue;
    if (isSelfOrDescendant(workspace, draggedBlock, folder.id)) continue;
    const zone = getFolderDropZone(folder);
    if (!zone) continue;
    if (cx < zone.left || cx > zone.right || cy < zone.top || cy > zone.bottom) continue;
    const zoneArea = (zone.right - zone.left) * (zone.bottom - zone.top);
    if (zoneArea < bestZoneArea) {
      bestZoneArea = zoneArea;
      best = folder;
    }
  }
  return best;
}

function removeChildId(folder, blockId) {
  const ids = folder.containedBlockIds_ || [];
  const index = ids.indexOf(blockId);
  if (index !== -1) ids.splice(index, 1);
}

function insertChildIdByPosition(folder, block) {
  const ws = folder.workspace;
  const ids = folder.containedBlockIds_ || (folder.containedBlockIds_ = []);
  const dropY = block.getRelativeToSurfaceXY().y;
  let index = ids.length;
  for (let i = 0; i < ids.length; i++) {
    const sibling = ws.getBlockById(ids[i]);
    if (sibling && dropY < sibling.getRelativeToSurfaceXY().y) {
      index = i;
      break;
    }
  }
  ids.splice(index, 0, block.id);
}

function handleDragEnd(workspace, draggedBlock) {
  if (draggedBlock.previousConnection || draggedBlock.outputConnection) return;
  if (draggedBlock.type === 'folder' && draggedBlock.isInFlyout) return;

  const oldFolder = findOwningFolder(workspace, draggedBlock.id);
  const candidate = findFolderAt(workspace, draggedBlock);

  if (oldFolder && oldFolder !== candidate) {
    removeChildId(oldFolder, draggedBlock.id);
    layoutFolderChildren(oldFolder);
  }

  if (candidate) {
    if (candidate === oldFolder) removeChildId(candidate, draggedBlock.id);
    insertChildIdByPosition(candidate, draggedBlock);
    layoutFolderChildren(candidate);
  }
}

function propagateFolderMove(workspace, folder, dx, dy) {
  for (const id of folder.containedBlockIds_ || []) {
    const child = workspace.getBlockById(id);
    if (child) child.moveBy(dx, dy);
  }
}

function resizeOwningFoldersImmediately(workspace, changedBlockId) {
  const changed = workspace.getBlockById(changedBlockId);
  if (!changed) return;

  let root = changed;
  while (typeof root.getSurroundParent === 'function' && root.getSurroundParent()) {
    root = root.getSurroundParent();
  }

  let owner = findOwningFolder(workspace, root.id);
  while (owner) {
    layoutFolderChildren(owner);
    owner = findOwningFolder(workspace, owner.id);
  }
}

// Blockly grows a target block live during a drag via direct rendering that
// bypasses Blockly.Events entirely, so this reads the undocumented
// `connectionCandidate` field off BlockDragStrategy to detect it - wrapped in
// try/catch since it's not public API and could change shape in a future
// Blockly upgrade.
function installConnectionPreviewFolderResize() {
  const proto = Blockly.dragging?.BlockDragStrategy?.prototype;
  if (!proto || proto.folderPreviewPatched_ || typeof proto.drag !== 'function') return;

  const originalDrag = proto.drag;
  proto.drag = function (newLoc, e) {
    originalDrag.call(this, newLoc, e);
    // connectionCandidate lags by one call if read synchronously here -
    // Blockly updates it asynchronously, apparently on the next frame.
    const self = this;
    requestAnimationFrame(() => {
      try {
        const neighbourBlock = self.connectionCandidate?.neighbour?.getSourceBlock?.() || null;
        const previous = self.folderPreviewTarget_ || null;
        if (neighbourBlock === previous) return;
        self.folderPreviewTarget_ = neighbourBlock;
        if (previous) resizeOwningFoldersImmediately(self.workspace, previous.id);
        if (neighbourBlock) resizeOwningFoldersImmediately(self.workspace, neighbourBlock.id);
      } catch {
        // Undocumented internals moved under us - fall through silently.
      }
    });
  };

  if (typeof proto.startDrag === 'function') {
    const originalStartDrag = proto.startDrag;
    proto.startDrag = function (e) {
      this.folderPreviewTarget_ = null;
      return originalStartDrag.call(this, e);
    };
  }

  proto.folderPreviewPatched_ = true;
}

// Contained blocks aren't real SVG children of the folder, so they don't move
// for free while it's dragged - reparent them into its SVG group for the
// duration of the drag, then back on drop.
export function beginFolderDragFollow(folder) {
  const ws = folder.workspace;
  const folderGroup = folder.getSvgRoot?.();
  if (!folderGroup) return;
  const folderOrigin = folder.getRelativeToSurfaceXY();

  const state = [];
  for (const id of collectAllDescendantIds(ws, folder)) {
    const child = ws.getBlockById(id);
    const childRoot = child?.getSvgRoot?.();
    if (!child || !childRoot || !childRoot.parentNode) continue;

    const childOrigin = child.getRelativeToSurfaceXY();
    const localX = childOrigin.x - folderOrigin.x;
    const localY = childOrigin.y - folderOrigin.y;
    const originalParent = childRoot.parentNode;

    folderGroup.appendChild(childRoot);
    childRoot.setAttribute('transform', `translate(${localX}, ${localY})`);
    state.push({ id, localX, localY, originalParent });
  }
  folder.dragFollowState_ = state;
}

export function endFolderDragFollow(folder) {
  const state = folder.dragFollowState_;
  folder.dragFollowState_ = null;
  if (!state || !state.length) return;

  const ws = folder.workspace;
  const folderOrigin = folder.getRelativeToSurfaceXY();

  for (const { id, localX, localY, originalParent } of state) {
    const child = ws.getBlockById(id);
    const childRoot = child?.getSvgRoot?.();
    if (!child || !childRoot || !originalParent) continue;

    originalParent.appendChild(childRoot);
    childRoot.setAttribute(
      'transform',
      `translate(${folderOrigin.x + localX}, ${folderOrigin.y + localY})`
    );
  }
}

export function removeFromAllFolders(workspace, blockId) {
  for (const folder of getAllFolderBlocks(workspace)) {
    if ((folder.containedBlockIds_ || []).includes(blockId)) {
      removeChildId(folder, blockId);
      layoutFolderChildren(folder);
    }
  }
}

// event.oldJson is the folder's state captured before disposal, readable
// even though the live block is already gone.
function deleteFolderContents(workspace, savedFolderJson) {
  const ids = savedFolderJson?.extraState?.contains;
  if (!Array.isArray(ids)) return;
  for (const id of ids) {
    workspace.getBlockById(id)?.dispose(false);
  }
}

export function attachFolderBehaviour(workspace) {
  installConnectionPreviewFolderResize();
  workspace.addChangeListener((event) => {
    if (event.type === Blockly.Events.BLOCK_DRAG) {
      const block = workspace.getBlockById(event.blockId);
      if (event.isStart) {
        if (block?.type === 'folder') beginFolderDragFollow(block);
        return;
      }
      if (block?.type === 'folder') endFolderDragFollow(block);
      if (block) handleDragEnd(workspace, block);
      return;
    }

    if (event.type === Blockly.Events.BLOCK_MOVE) {
      // Blockly can coalesce a drag into an event that carries both a
      // coordinate change and a reparent, so both are checked unconditionally.
      if (event.oldCoordinate && event.newCoordinate) {
        const folder = workspace.getBlockById(event.blockId);
        if (folder && folder.type === 'folder') {
          const dx = event.newCoordinate.x - event.oldCoordinate.x;
          const dy = event.newCoordinate.y - event.oldCoordinate.y;
          if (dx || dy) propagateFolderMove(workspace, folder, dx, dy);
        }
      }
      resizeOwningFoldersImmediately(workspace, event.blockId);
      return;
    }

    if (event.type === Blockly.Events.BLOCK_DELETE) {
      removeFromAllFolders(workspace, event.blockId);
      for (const id of event.ids || []) removeFromAllFolders(workspace, id);
      if (event.oldJson?.type === 'folder') deleteFolderContents(workspace, event.oldJson);
      return;
    }

    if (event.type === Blockly.Events.BLOCK_CREATE) {
      const ids = Array.isArray(event.ids) ? event.ids : [event.blockId];
      for (const id of ids) {
        const block = workspace.getBlockById(id);
        if (block?.type === 'folder') deduplicateFolderContents(workspace, block);
      }
    }
  });
}
