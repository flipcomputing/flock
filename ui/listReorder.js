import * as Blockly from 'blockly';
import { translate } from '../main/translation.js';

const DRAG_THRESHOLD = 6;
const SNAP_RADIUS = 32;

const SWAPPABLE_TYPES = new Set(['lists_create_with', 'text_join']);

function countItems(list) {
  if (Number.isInteger(list.itemCount_)) return list.itemCount_;
  let n = 0;
  while (list.getInput('ADD' + n)) n++;
  return n;
}

function listItemInfo(block) {
  const tappedBlock = block;
  let b = block;
  while (b) {
    const parent = b.getParent?.();
    const input = b.outputConnection?.targetConnection?.getParentInput?.();
    if (parent && SWAPPABLE_TYPES.has(parent.type) && input) {
      const m = /^ADD(\d+)$/.exec(input.name || '');
      if (m) return { list: parent, index: Number(m[1]), itemBlock: b, tappedBlock };
    }
    b = parent;
  }
  return null;
}

function resolveFromEvent(workspace, target) {
  const host = target?.closest?.('[data-id]');
  if (!host) return null;
  const block = workspace.getBlockById(host.getAttribute('data-id'));
  return block ? listItemInfo(block) : null;
}

function shadowFields(connection) {
  const state = connection?.getShadowState?.(true);
  return state && state.fields ? { ...state.fields } : null;
}

function snapshotSlots(list, n) {
  const slots = [];
  for (let i = 0; i < n; i++) {
    const conn = list.getInput('ADD' + i)?.connection || null;
    const target = conn?.targetBlock() || null;
    slots.push({
      realBlock: target && !target.isShadow() ? target : null,
      fields: shadowFields(conn),
    });
  }
  return slots;
}

function swappedOrder(n, i, j) {
  const order = Array.from({ length: n }, (_, k) => k);
  [order[i], order[j]] = [order[j], order[i]];
  return order;
}

function applyOrder(list, snapshot, order) {
  for (const slot of snapshot) if (slot.realBlock) slot.realBlock.unplug(false);
  for (let i = 0; i < order.length; i++) {
    const dest = list.getInput('ADD' + i)?.connection;
    const src = snapshot[order[i]];
    if (!dest || !src) continue;
    if (src.realBlock) {
      dest.connect(src.realBlock.outputConnection);
      continue;
    }
    const shadow = dest.targetBlock();
    if (!shadow || !shadow.isShadow() || !src.fields) continue;
    for (const [name, value] of Object.entries(src.fields)) {
      if (shadow.getField(name) != null && shadow.getFieldValue(name) !== value) {
        shadow.setFieldValue(value, name);
      }
    }
  }
  if (list.rendered) list.render();
}

export function swapListItems(list, i, j) {
  if (!list || !SWAPPABLE_TYPES.has(list.type)) return false;
  const n = countItems(list);
  if (n < 2 || i === j) return false;
  if (!Number.isInteger(i) || !Number.isInteger(j)) return false;
  if (i < 0 || j < 0 || i >= n || j >= n) return false;

  const snapshot = snapshotSlots(list, n);
  const order = swappedOrder(n, i, j);
  const prevGroup = Blockly.Events.getGroup();
  Blockly.Events.setGroup(prevGroup || true);
  try {
    applyOrder(list, snapshot, order);
  } finally {
    Blockly.Events.setGroup(prevGroup || false);
  }
  return true;
}

function setOpacity(block, value) {
  try {
    const root = block?.getSvgRoot?.();
    if (root) root.style.opacity = value;
  } catch {
    /* ignore */
  }
}

function measureItemCentres(list) {
  Blockly.renderManagement?.triggerQueuedRenders?.(list.workspace);
  const centres = [];
  for (let i = 0; list.getInput('ADD' + i); i++) {
    const conn = list.getInput('ADD' + i).connection;
    const el = conn?.targetBlock()?.getSvgRoot?.();
    if (el) {
      const r = el.getBoundingClientRect();
      centres.push({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      continue;
    }
    const off = conn?.getOffsetInBlock?.();
    if (off) {
      const base = list.getRelativeToSurfaceXY();
      const p = Blockly.utils.svgMath.wsToScreenCoordinates(
        list.workspace,
        new Blockly.utils.Coordinate(base.x + off.x, base.y + off.y)
      );
      centres.push({ x: p.x, y: p.y });
    } else {
      centres.push(null);
    }
  }
  return centres;
}

function slotAt(centres, clientX, clientY, fallback) {
  let best = fallback;
  let bestDist = Infinity;
  for (let i = 0; i < centres.length; i++) {
    const c = centres[i];
    if (!c) continue;
    const d = (c.x - clientX) ** 2 + (c.y - clientY) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function pointInRect(rect, clientX, clientY) {
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function candidateConnections(workspace, itemBlock, sourceList) {
  const skip = new Set([itemBlock, sourceList, ...itemBlock.getDescendants(false)]);
  const candidates = [];
  for (const block of workspace.getAllBlocks(false)) {
    if (skip.has(block) || block.isInFlyout) continue;
    for (const input of block.inputList) {
      const conn = input.connection;
      if (!conn || conn.type !== Blockly.INPUT_VALUE) continue;
      if (!workspace.connectionChecker.canConnect(itemBlock.outputConnection, conn, true, Infinity)) continue;
      const el = conn.targetBlock()?.getSvgRoot?.();
      if (el) {
        const r = el.getBoundingClientRect();
        candidates.push({ connection: conn, x: r.left + r.width / 2, y: r.top + r.height / 2 });
        continue;
      }
      const off = conn.getOffsetInBlock?.();
      if (!off) continue;
      const base = block.getRelativeToSurfaceXY();
      const p = Blockly.utils.svgMath.wsToScreenCoordinates(
        workspace,
        new Blockly.utils.Coordinate(base.x + off.x, base.y + off.y)
      );
      candidates.push({ connection: conn, x: p.x, y: p.y });
    }
  }
  return candidates;
}

function nearestConnectionAt(candidates, clientX, clientY, maxDist) {
  let best = null;
  let bestDist = maxDist * maxDist;
  for (const c of candidates) {
    const d = (c.x - clientX) ** 2 + (c.y - clientY) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = c.connection;
    }
  }
  return best;
}

function duplicateItemBlock(itemBlock) {
  Blockly.Events.disable();
  try {
    const state = Blockly.serialization.blocks.save(itemBlock, { includeShadows: true });
    return Blockly.serialization.blocks.append(state, itemBlock.workspace);
  } finally {
    Blockly.Events.enable();
  }
}

function commitDuplicate(copy) {
  Blockly.Events.fire(new Blockly.Events.BlockCreate(copy));
}

function discardDuplicate(copy) {
  Blockly.Events.disable();
  try {
    copy.dispose(false);
  } finally {
    Blockly.Events.enable();
  }
}

function connectItemTo(copy, dest) {
  const targetBlock = dest.getSourceBlock();
  const prior = dest.targetBlock();
  if (prior && !prior.isShadow()) prior.unplug(false);
  dest.connect(copy.outputConnection);
  if (prior && !prior.isShadow()) prior.bumpNeighbours();
  if (targetBlock?.rendered) targetBlock.render();
}

function placeItemAt(copy, workspace, clientX, clientY) {
  const point = Blockly.utils.svgMath.screenToWsCoordinates(
    workspace,
    new Blockly.utils.Coordinate(clientX, clientY)
  );
  const size = copy.getHeightWidth?.() || { width: 0, height: 0 };
  copy.moveTo(new Blockly.utils.Coordinate(point.x - size.width / 2, point.y - size.height / 2));
}

function handleTap(info, downEvent) {
  const node = downEvent.target;
  const block = info.tappedBlock || info.itemBlock;
  for (const input of block.inputList || []) {
    for (const field of input.fieldRow || []) {
      const root = field.getClickTarget_?.() ?? field.getSvgRoot?.();
      if (root && node instanceof Node && root.contains(node) && field.isClickable?.()) {
        try {
          field.showEditor?.(downEvent);
        } catch {
          /* ignore */
        }
        return;
      }
    }
  }
  try {
    (block.isShadow?.() ? info.list : block).select?.();
  } catch {
    /* ignore */
  }
}

let contextMenuRegistered = false;
function registerContextMenuItems() {
  if (contextMenuRegistered) return;
  const registry = Blockly.ContextMenuRegistry?.registry;
  if (!registry) return;
  contextMenuRegistered = true;

  const register = (id, dir, key, fallback, weight) => {
    if (registry.getItem?.(id)) return;
    registry.register({
      id,
      weight,
      scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
      displayText: () => {
        const text = translate(key);
        return text === key ? fallback : text;
      },
      preconditionFn: (scope) => {
        const info = listItemInfo(scope.block);
        if (!info) return 'hidden';
        const next = info.index + dir;
        return next >= 0 && next < countItems(info.list) ? 'enabled' : 'disabled';
      },
      callback: (scope) => {
        const info = listItemInfo(scope.block);
        if (info) swapListItems(info.list, info.index, info.index + dir);
      },
    });
  };

  register('flockListItemMoveUp', -1, 'move_item_up_option', 'Move item up', 10.55);
  register('flockListItemMoveDown', 1, 'move_item_down_option', 'Move item down', 10.58);
}

export function initListReorder(workspace) {
  registerContextMenuItems();

  const div = workspace.getInjectionDiv?.();
  if (!div || div.__flockListReorderBound) return;
  div.__flockListReorderBound = true;

  div.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey) return;
      if (workspace.isFlyout || workspace.isMutator) return;

      const info = resolveFromEvent(workspace, e.target);
      if (!info || info.list.isInFlyout) return;
      const n = countItems(info.list);
      if (n < 2) return;

      e.stopPropagation();

      const { list, index: fromIndex, itemBlock } = info;
      const itemRoot = itemBlock.getSvgRoot?.();
      if (!itemRoot) return;
      const pointerId = e.pointerId;
      const startX = e.clientX;
      const startY = e.clientY;
      let dragging = false;
      let centres = null;
      let listRect = null;
      let candidates = [];
      let dropIndex = fromIndex;
      let externalTarget = null;
      let highlighted = null;
      let copy = null;
      let copyRoot = null;
      let copyOrigTransform = '';

      try {
        div.setPointerCapture(pointerId);
      } catch {
        /* ignore */
      }

      const setExternalTarget = (target) => {
        if (target === externalTarget) return;
        highlighted?.unhighlight();
        externalTarget = target;
        highlighted = target || null;
        highlighted?.highlight();
      };

      const startDrag = () => {
        dragging = true;
        centres = measureItemCentres(list);
        listRect = list.getSvgRoot().getBoundingClientRect();

        copy = duplicateItemBlock(itemBlock);
        Blockly.Events.disable();
        try {
          copy.moveTo(itemBlock.getRelativeToSurfaceXY());
        } finally {
          Blockly.Events.enable();
        }
        candidates = candidateConnections(list.workspace, copy, list);
        copyRoot = copy.getSvgRoot();
        copyOrigTransform = copyRoot?.getAttribute('transform') || '';
        if (copyRoot) copyRoot.style.pointerEvents = 'none';
        setOpacity(copy, '0.9');
        div.style.cursor = 'grabbing';
      };

      const endVisuals = () => {
        div.style.cursor = '';
        highlighted?.unhighlight();
        highlighted = null;
        if (copyRoot) copyRoot.style.pointerEvents = '';
        setOpacity(copy, '');
      };

      const removeListeners = () => {
        try {
          div.releasePointerCapture(pointerId);
        } catch {
          /* ignore */
        }
        document.removeEventListener('pointermove', onMove, true);
        document.removeEventListener('pointerup', onUp, true);
        document.removeEventListener('pointercancel', onCancel, true);
      };

      const onMove = (ev) => {
        if (ev.pointerId !== pointerId) return;
        if (!dragging) {
          if (
            Math.abs(ev.clientY - startY) < DRAG_THRESHOLD &&
            Math.abs(ev.clientX - startX) < DRAG_THRESHOLD
          ) {
            return;
          }
          startDrag();
        }
        ev.preventDefault();

        const scale = list.workspace.scale || 1;
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        if (copyRoot) copyRoot.setAttribute('transform', `${copyOrigTransform} translate(${dx},${dy})`);

        if (pointInRect(listRect, ev.clientX, ev.clientY)) {
          dropIndex = slotAt(centres, ev.clientX, ev.clientY, dropIndex);
          setExternalTarget(null);
        } else {
          setExternalTarget(nearestConnectionAt(candidates, ev.clientX, ev.clientY, SNAP_RADIUS * scale));
        }
      };

      const onUp = (ev) => {
        if (ev.pointerId !== pointerId) return;
        removeListeners();
        if (!dragging) {
          handleTap(info, e);
          return;
        }
        ev.stopPropagation();
        ev.preventDefault();
        endVisuals();

        if (pointInRect(listRect, ev.clientX, ev.clientY)) {
          if (dropIndex !== fromIndex) swapListItems(list, fromIndex, dropIndex);
          discardDuplicate(copy);
          return;
        }

        const prevGroup = Blockly.Events.getGroup();
        Blockly.Events.setGroup(prevGroup || true);
        try {
          commitDuplicate(copy);
          if (externalTarget) connectItemTo(copy, externalTarget);
          else placeItemAt(copy, list.workspace, ev.clientX, ev.clientY);
        } finally {
          Blockly.renderManagement?.triggerQueuedRenders?.(list.workspace);
          Blockly.Events.setGroup(prevGroup || false);
        }
      };

      const onCancel = (ev) => {
        if (ev.pointerId !== pointerId) return;
        removeListeners();
        if (dragging) {
          endVisuals();
          if (copy) discardDuplicate(copy);
        }
      };

      document.addEventListener('pointermove', onMove, true);
      document.addEventListener('pointerup', onUp, true);
      document.addEventListener('pointercancel', onCancel, true);
    },
    { capture: true }
  );
}
