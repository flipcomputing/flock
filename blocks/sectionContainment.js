import * as Blockly from 'blockly';

const CHILD_GAP = 40;
const TOP_GAP = 8;
export const SECTION_DO_CHECK = '__section_do_never_connects__';

function isRendered(block) {
  return !!block && typeof block.getSvgRoot === 'function' && !!block.getSvgRoot();
}

export function getAllSectionBlocks(workspace) {
  return (workspace.getAllBlocks(false) || []).filter((b) => b.type === 'section');
}

export function buildContainedIdSet(workspace) {
  const ids = new Set();
  for (const section of getAllSectionBlocks(workspace)) {
    for (const id of section.containedBlockIds_ || []) ids.add(id);
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

function findOwningSection(workspace, blockId) {
  for (const section of getAllSectionBlocks(workspace)) {
    if ((section.containedBlockIds_ || []).includes(blockId)) return section;
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

function deduplicateSectionContents(workspace, section) {
  const ids = section.containedBlockIds_;
  if (!Array.isArray(ids) || !ids.length) return;

  let changed = false;
  for (let i = 0; i < ids.length; i++) {
    const owner = findOwningSection(workspace, ids[i]);
    if (!owner || owner === section) continue;

    const copy = duplicateOwnedBlock(workspace, ids[i]);
    if (copy) {
      ids[i] = copy.id;
      changed = true;
    }
  }

  if (changed) layoutSectionChildren(section);
}

function isSelfOrDescendant(workspace, section, candidateId) {
  if (section.id === candidateId) return true;
  const ids = section.containedBlockIds_ || [];
  for (const id of ids) {
    if (id === candidateId) return true;
    const child = workspace.getBlockById(id);
    if (child && child.type === 'section' && isSelfOrDescendant(workspace, child, candidateId)) {
      return true;
    }
  }
  return false;
}

function setBlockVisible(block, visible) {
  const svg = block?.getSvgRoot?.();
  if (svg) svg.style.display = visible ? '' : 'none';
}

function collectAllDescendantIds(ws, section, out = []) {
  for (const id of section.containedBlockIds_ || []) {
    out.push(id);
    const child = ws.getBlockById(id);
    if (child && child.type === 'section') collectAllDescendantIds(ws, child, out);
  }
  return out;
}

// Blockly coalesces a synthetic BlockChange event away when it's followed by
// the icon field's own change in the same tick, so this hook is called directly.
let reflowTopLevelBlocks = null;
export function setSectionReflowHook(fn) {
  reflowTopLevelBlocks = fn;
}

export function toggleSectionCollapsed(section) {
  section.sectionCollapsed_ = !section.sectionCollapsed_;
  layoutSectionChildren(section);
  reflowTopLevelBlocks?.();
  Blockly.Events.fire(new Blockly.Events.BlockChange(section, 'mutation', null, '', ''));
}

export function layoutSectionChildren(section) {
  if (!isRendered(section) || section.isInFlyout) return;
  if (section.isDragging?.()) return;
  const ws = section.workspace;
  const ids = section.containedBlockIds_ || [];

  if (section.sectionCollapsed_) {
    for (const id of collectAllDescendantIds(ws, section)) {
      setBlockVisible(ws.getBlockById(id), false);
    }
    // Blockly leaves residual row height if the input is merely hidden, not removed.
    if (section.getInput('DO')) section.removeInput('DO');
    section.render();
    return;
  }

  let doInput = section.getInput('DO');
  if (!doInput) {
    doInput = section.appendStatementInput('DO').setCheck(SECTION_DO_CHECK);
  }
  doInput.setVisible(true);

  const children = ids.map((id) => ws.getBlockById(id)).filter(Boolean);
  let desired = children.length ? TOP_GAP : 0;
  children.forEach((child, index) => {
    const hw = child.getHeightWidth ? child.getHeightWidth() : { width: 100, height: 40 };
    desired += hw.height;
    desired += index < children.length - 1 ? CHILD_GAP : TOP_GAP;
  });
  section.desiredMouthHeight_ = desired;
  section.render();

  const origin = section.getRelativeToSurfaceXY();
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

    if (child.type === 'section') layoutSectionChildren(child);
  }
}

const ZONE_MARGIN = 10;
const TOP_ANCHOR_OFFSET = 10;
const LEFT_ANCHOR_OFFSET = 15;

function getSectionDropZone(section) {
  if (!isRendered(section) || section.sectionCollapsed_) return null;
  const rect = section.getBoundingRectangle();
  return {
    left: rect.left - ZONE_MARGIN,
    right: rect.right + ZONE_MARGIN,
    top: rect.top - ZONE_MARGIN,
    bottom: rect.bottom + ZONE_MARGIN,
  };
}

function findSectionAt(workspace, draggedBlock) {
  const rect = draggedBlock.getBoundingRectangle?.();
  if (!rect) return null;
  const cx = rect.left + LEFT_ANCHOR_OFFSET;
  const cy = rect.top + TOP_ANCHOR_OFFSET;

  let best = null;
  let bestZoneArea = Infinity;
  for (const section of getAllSectionBlocks(workspace)) {
    if (section.id === draggedBlock.id) continue;
    if (isSelfOrDescendant(workspace, draggedBlock, section.id)) continue;
    const zone = getSectionDropZone(section);
    if (!zone) continue;
    if (cx < zone.left || cx > zone.right || cy < zone.top || cy > zone.bottom) continue;
    const zoneArea = (zone.right - zone.left) * (zone.bottom - zone.top);
    if (zoneArea < bestZoneArea) {
      bestZoneArea = zoneArea;
      best = section;
    }
  }
  return best;
}

function removeChildId(section, blockId) {
  const ids = section.containedBlockIds_ || [];
  const index = ids.indexOf(blockId);
  if (index !== -1) ids.splice(index, 1);
}

function insertChildIdByPosition(section, block) {
  const ws = section.workspace;
  const ids = section.containedBlockIds_ || (section.containedBlockIds_ = []);
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
  if (draggedBlock.type === 'section' && draggedBlock.isInFlyout) return;

  const oldSection = findOwningSection(workspace, draggedBlock.id);
  const candidate = findSectionAt(workspace, draggedBlock);

  if (oldSection && oldSection !== candidate) {
    removeChildId(oldSection, draggedBlock.id);
    layoutSectionChildren(oldSection);
  }

  if (candidate) {
    if (candidate === oldSection) removeChildId(candidate, draggedBlock.id);
    insertChildIdByPosition(candidate, draggedBlock);
    layoutSectionChildren(candidate);
  }
}

function propagateSectionMove(workspace, section, dx, dy) {
  for (const id of section.containedBlockIds_ || []) {
    const child = workspace.getBlockById(id);
    if (child) child.moveBy(dx, dy);
  }
}

function resizeOwningSectionsImmediately(workspace, changedBlockId) {
  const changed = workspace.getBlockById(changedBlockId);
  if (!changed) return;

  let root = changed;
  while (typeof root.getSurroundParent === 'function' && root.getSurroundParent()) {
    root = root.getSurroundParent();
  }

  let owner = findOwningSection(workspace, root.id);
  while (owner) {
    layoutSectionChildren(owner);
    owner = findOwningSection(workspace, owner.id);
  }
}

// Blockly grows a target block live during a drag via direct rendering that
// bypasses Blockly.Events entirely, so this reads the undocumented
// `connectionCandidate` field off BlockDragStrategy to detect it - wrapped in
// try/catch since it's not public API and could change shape in a future
// Blockly upgrade.
function installConnectionPreviewSectionResize() {
  const proto = Blockly.dragging?.BlockDragStrategy?.prototype;
  if (!proto || proto.sectionPreviewPatched_ || typeof proto.drag !== 'function') return;

  const originalDrag = proto.drag;
  proto.drag = function (newLoc, e) {
    originalDrag.call(this, newLoc, e);
    // connectionCandidate lags by one call if read synchronously here -
    // Blockly updates it asynchronously, apparently on the next frame.
    const self = this;
    requestAnimationFrame(() => {
      try {
        const neighbourBlock = self.connectionCandidate?.neighbour?.getSourceBlock?.() || null;
        const previous = self.sectionPreviewTarget_ || null;
        if (neighbourBlock === previous) return;
        self.sectionPreviewTarget_ = neighbourBlock;
        if (previous) resizeOwningSectionsImmediately(self.workspace, previous.id);
        if (neighbourBlock) resizeOwningSectionsImmediately(self.workspace, neighbourBlock.id);
      } catch {
        // Undocumented internals moved under us - fall through silently.
      }
    });
  };

  if (typeof proto.startDrag === 'function') {
    const originalStartDrag = proto.startDrag;
    proto.startDrag = function (e) {
      this.sectionPreviewTarget_ = null;
      return originalStartDrag.call(this, e);
    };
  }

  proto.sectionPreviewPatched_ = true;
}

// Contained blocks aren't real SVG children of the section, so they don't move
// for free while it's dragged - reparent them into its SVG group for the
// duration of the drag, then back on drop.
export function beginSectionDragFollow(section) {
  const ws = section.workspace;
  const sectionGroup = section.getSvgRoot?.();
  if (!sectionGroup) return;
  const sectionOrigin = section.getRelativeToSurfaceXY();

  const state = [];
  for (const id of collectAllDescendantIds(ws, section)) {
    const child = ws.getBlockById(id);
    const childRoot = child?.getSvgRoot?.();
    if (!child || !childRoot || !childRoot.parentNode) continue;

    const childOrigin = child.getRelativeToSurfaceXY();
    const localX = childOrigin.x - sectionOrigin.x;
    const localY = childOrigin.y - sectionOrigin.y;
    const originalParent = childRoot.parentNode;

    sectionGroup.appendChild(childRoot);
    childRoot.setAttribute('transform', `translate(${localX}, ${localY})`);
    state.push({ id, localX, localY, originalParent });
  }
  section.dragFollowState_ = state;
}

export function endSectionDragFollow(section) {
  const state = section.dragFollowState_;
  section.dragFollowState_ = null;
  if (!state || !state.length) return;

  const ws = section.workspace;
  const sectionOrigin = section.getRelativeToSurfaceXY();

  for (const { id, localX, localY, originalParent } of state) {
    const child = ws.getBlockById(id);
    const childRoot = child?.getSvgRoot?.();
    if (!child || !childRoot || !originalParent) continue;

    originalParent.appendChild(childRoot);
    childRoot.setAttribute(
      'transform',
      `translate(${sectionOrigin.x + localX}, ${sectionOrigin.y + localY})`
    );
  }
}

export function removeFromAllSections(workspace, blockId) {
  for (const section of getAllSectionBlocks(workspace)) {
    if ((section.containedBlockIds_ || []).includes(blockId)) {
      removeChildId(section, blockId);
      layoutSectionChildren(section);
    }
  }
}

// event.oldJson is the section's state captured before disposal, readable
// even though the live block is already gone.
function deleteSectionContents(workspace, savedSectionJson) {
  const ids = savedSectionJson?.extraState?.contains;
  if (!Array.isArray(ids)) return;
  for (const id of ids) {
    workspace.getBlockById(id)?.dispose(false);
  }
}

export function attachSectionBehaviour(workspace) {
  installConnectionPreviewSectionResize();
  workspace.addChangeListener((event) => {
    if (event.type === Blockly.Events.BLOCK_DRAG) {
      const block = workspace.getBlockById(event.blockId);
      if (event.isStart) {
        if (block?.type === 'section') beginSectionDragFollow(block);
        return;
      }
      if (block?.type === 'section') endSectionDragFollow(block);
      if (block) handleDragEnd(workspace, block);
      return;
    }

    if (event.type === Blockly.Events.BLOCK_MOVE) {
      // Blockly can coalesce a drag into an event that carries both a
      // coordinate change and a reparent, so both are checked unconditionally.
      if (event.oldCoordinate && event.newCoordinate) {
        const section = workspace.getBlockById(event.blockId);
        if (section && section.type === 'section') {
          const dx = event.newCoordinate.x - event.oldCoordinate.x;
          const dy = event.newCoordinate.y - event.oldCoordinate.y;
          if (dx || dy) propagateSectionMove(workspace, section, dx, dy);
        }
      }
      resizeOwningSectionsImmediately(workspace, event.blockId);
      return;
    }

    if (event.type === Blockly.Events.BLOCK_DELETE) {
      removeFromAllSections(workspace, event.blockId);
      for (const id of event.ids || []) removeFromAllSections(workspace, id);
      if (event.oldJson?.type === 'section') deleteSectionContents(workspace, event.oldJson);
      return;
    }

    if (event.type === Blockly.Events.BLOCK_CREATE) {
      const ids = Array.isArray(event.ids) ? event.ids : [event.blockId];
      for (const id of ids) {
        const block = workspace.getBlockById(id);
        if (block?.type === 'section') deduplicateSectionContents(workspace, block);
      }
    }
  });
}
