// Drag an item of a `lists_create_with` block up or down to reorder it, without
// giving up the +/- mutator UI. Item slots (ADD0, ADD1, ...) stay fixed; only
// their contents move, so nothing about serialization or the generators changes.
//
// A pointerdown that lands on an item (its shadow, or a real value block plugged
// into it) is taken over here before Blockly starts a whole-block drag - that
// interception is the only reason a shadow, which Blockly won't drag on its own,
// becomes grabbable. Below the drag threshold the press falls through to the
// field editor / selection so tapping a shadow to type still works.
//
// While dragging, the grabbed item lifts and follows the pointer while the other
// items stay put. On drop the grabbed item swaps places with whatever item the
// pointer ended over - a single undoable change. Works whether the list lays its
// items out inline (a row) or stacked.

import * as Blockly from 'blockly';
import { translate } from '../main/translation.js';

const DRAG_THRESHOLD = 6;

function countItems(list) {
  if (Number.isInteger(list.itemCount_)) return list.itemCount_;
  let n = 0;
  while (list.getInput('ADD' + n)) n++;
  return n;
}

// Walk up from a block to the first ancestor sitting directly in an ADDn slot of
// a lists_create_with. `itemBlock` is that slot occupant (what a drag moves);
// `tappedBlock` is the block actually under the pointer, which may be nested
// inside it (what a tap should act on).
function listItemInfo(block) {
  const tappedBlock = block;
  let b = block;
  while (b) {
    const parent = b.getParent?.();
    const input = b.outputConnection?.targetConnection?.getParentInput?.();
    if (parent && parent.type === 'lists_create_with' && input) {
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

// The field values shown by a slot's shadow, keyed by field name. Empty slots
// and real-block slots return null (the caller doesn't need them).
function shadowFields(connection) {
  const state = connection?.getShadowState?.(true);
  return state && state.fields ? { ...state.fields } : null;
}

// One entry per ADDn slot: its real (non-shadow) occupant if any, and the field
// values its shadow should show. Captured once, before any rearranging.
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

// The identity order with slots `i` and `j` exchanged.
function swappedOrder(n, i, j) {
  const order = Array.from({ length: n }, (_, k) => k);
  [order[i], order[j]] = [order[j], order[i]];
  return order;
}

// Arrange the list so slot i shows what `snapshot[order[i]]` described. Works
// from the original snapshot, so it is safe to call repeatedly with different
// orders (each call re-derives the whole layout).
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

/**
 * Swap the contents of slots `i` and `j` in a lists_create_with block. A real
 * value block moves by its connection and keeps its identity; a shadow
 * placeholder stays in its slot and takes on the other item's field values.
 * The change is one undoable event group.
 * @returns {boolean} true if the block changed.
 */
export function swapListItems(list, i, j) {
  if (!list || list.type !== 'lists_create_with') return false;
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
    Blockly.Events.setGroup(prevGroup || null);
  }
  return true;
}

function setOpacity(block, value) {
  try {
    const root = block?.getSvgRoot?.();
    if (root) root.style.opacity = value;
  } catch {
    /* SVG gone after a re-render - ignore */
  }
}

// A dashed outline in the shape of the grabbed block, left where it was picked
// up. Cloned from the block's own body path so it matches the notch and corners,
// placed in the same SVG group with the block's own transform. Returns the
// element to remove when the drag ends, or null if the path wasn't found.
function makeGhost(itemRoot, transform) {
  const path = itemRoot.querySelector('.blocklyPath');
  const container = itemRoot.parentNode;
  if (!path || !container) return null;
  const g = Blockly.utils.dom.createSvgElement('g', {}, null);
  if (transform) g.setAttribute('transform', transform);
  g.style.pointerEvents = 'none';
  const outline = path.cloneNode(false);
  outline.removeAttribute('filter');
  outline.setAttribute('fill', 'none');
  outline.setAttribute('stroke', 'var(--fc-list-ghost,rgba(0,0,0,.4))');
  outline.setAttribute('stroke-width', '2');
  outline.setAttribute('stroke-dasharray', '5 3');
  g.appendChild(outline);
  container.insertBefore(g, itemRoot);
  return g;
}

// Client-pixel centre point of each item, read from what is actually on screen.
// Measured once, before the drag moves anything; any pending Blockly render is
// flushed first so the rects are current. Points (not just a Y) so this works
// whether the list lays items out in a row, a column, or wrapped.
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
    // Empty socket: fall back to the connection's own screen position.
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

// Which item the pointer is over, by nearest centre point.
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

// A press that didn't turn into a drag: reproduce the click Blockly would have
// handled - open the field editor under the pointer, else just select. Acts on
// the block actually pressed, which may be nested inside the slot occupant.
function handleTap(info, downEvent) {
  const node = downEvent.target;
  const block = info.tappedBlock || info.itemBlock;
  for (const input of block.inputList || []) {
    for (const field of input.fieldRow || []) {
      const root = field.getSvgRoot?.();
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

  // Sit just after "Detach" (weight 10) / "View in canvas" (10.5).
  register('flockListItemMoveUp', -1, 'move_item_up_option', 'Move item up', 10.55);
  register('flockListItemMoveDown', 1, 'move_item_down_option', 'Move item down', 10.58);
}

/**
 * Wire drag-to-reorder for lists_create_with items on the given workspace, and
 * register the matching context-menu items (once).
 */
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

      // Claim this press before Blockly turns it into a whole-list drag.
      e.stopPropagation();

      const { list, index: fromIndex, itemBlock } = info;
      const itemRoot = itemBlock.getSvgRoot?.();
      if (!itemRoot) return;
      const pointerId = e.pointerId;
      const startX = e.clientX;
      const startY = e.clientY;
      let dragging = false;
      let centres = null;
      let origTransform = '';
      let dropIndex = fromIndex;
      let ghost = null;

      try {
        div.setPointerCapture(pointerId);
      } catch {
        /* ignore */
      }

      const startDrag = () => {
        dragging = true;
        centres = measureItemCentres(list);
        origTransform = itemRoot.getAttribute('transform') || '';
        ghost = makeGhost(itemRoot, origTransform);
        itemRoot.parentNode?.appendChild(itemRoot); // lift above the ghost
        itemRoot.style.pointerEvents = 'none';
        setOpacity(itemBlock, '0.9');
        div.style.cursor = 'grabbing';
      };

      const endVisuals = () => {
        div.style.cursor = '';
        setOpacity(itemBlock, '');
        itemRoot.style.pointerEvents = '';
        itemRoot.setAttribute('transform', origTransform);
        ghost?.remove();
        ghost = null;
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
        itemRoot.setAttribute('transform', `${origTransform} translate(${dx},${dy})`);

        dropIndex = slotAt(centres, ev.clientX, ev.clientY, dropIndex);
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
        if (dropIndex !== fromIndex) swapListItems(list, fromIndex, dropIndex);
        else if (list.rendered) list.render();
      };

      const onCancel = (ev) => {
        if (ev.pointerId !== pointerId) return;
        removeListeners();
        if (dragging) {
          endVisuals();
          if (list.rendered) list.render();
        }
      };

      document.addEventListener('pointermove', onMove, true);
      document.addEventListener('pointerup', onUp, true);
      document.addEventListener('pointercancel', onCancel, true);
    },
    { capture: true }
  );
}
