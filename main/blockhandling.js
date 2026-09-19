import * as Blockly from 'blockly';
import { FieldMultilineInput } from '@blockly/field-multilineinput';
import { workspace } from './blocklyinit.js';
import { translate } from './translation.js';
import { blockHandlerRegistry, refreshReporterAriaLabels, applyInputHint } from '../blocks/blocks.js';
import { announceToScreenReader } from './input.js';
import { TOP_BLOCK_TYPES } from '../config.js';
import { showBlockHint, clearBlockHint } from '../ui/blockHint.js';
import { ensureBlockSearchIndex, isCompactSearchLayout } from './blocksearch.js';
import {
  attachSectionBehaviour,
  buildContainedIdSet,
  layoutSectionChildren,
  setSectionReflowHook,
} from '../blocks/sectionContainment.js';
import { updateCollapsedBlockIcon } from '../blocks/blockIcons.js';

function asBlocklyBlock(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  return typeof candidate.getNextBlock === 'function' ? candidate : null;
}

function getSelectedBlockFromFocusedNode(node) {
  if (!node) {
    return null;
  }

  const direct = asBlocklyBlock(node);
  if (direct) {
    return direct;
  }

  if (typeof node.getSourceBlock === 'function') {
    return asBlocklyBlock(node.getSourceBlock());
  }

  return asBlocklyBlock(node.sourceBlock_);
}

function getSelectedBlockForKeywordShortcut() {
  const selected = asBlocklyBlock(Blockly.common?.getSelected?.());
  if (selected) {
    return selected;
  }

  const focusedNode = Blockly.getFocusManager?.()?.getFocusedNode?.();
  return getSelectedBlockFromFocusedNode(focusedNode) || asBlocklyBlock(window.currentBlock);
}

// Keyboard navigation stops on empty sockets, which are connections rather than
// blocks: a value socket, or a statement slot — a C-shaped block's body, or the
// gap below a block inside one.
function getFocusedConnection() {
  const node = Blockly.getFocusManager?.()?.getFocusedNode?.();
  if (!node || typeof node.connect !== 'function') return null;
  return node.type === Blockly.ConnectionType.INPUT_VALUE ||
    node.type === Blockly.ConnectionType.NEXT_STATEMENT
    ? node
    : null;
}

// A hat block has nothing to append to, so the picker goes in the first slot of
// its body — where a block dragged from the toolbox onto it would land.
function getBodySlot(block) {
  const input = block.inputList.find(
    (candidate) => candidate.connection?.type === Blockly.ConnectionType.NEXT_STATEMENT
  );
  return input?.connection ?? null;
}

function findFieldForEditor(editor) {
  for (const block of workspace.getAllBlocks(false)) {
    for (const input of block.inputList) {
      for (const field of input.fieldRow) {
        if (field.htmlInput_ === editor) return field;
      }
    }
  }
  return null;
}

// Clicking a shadow block selects its parent, so the number the user is typing
// in is only reachable through the field editor that click opened.
function getBlockBeingEdited() {
  const editor = document.activeElement;
  if (!editor?.classList?.contains('blocklyHtmlInput')) return null;

  const block = findFieldForEditor(editor)?.getSourceBlock() ?? null;
  return block && !block.type.startsWith('keyword') ? block : null;
}

function getViewportCenterCoordinates(activeWorkspace) {
  const { left, top, width, height } = activeWorkspace.getMetricsManager().getViewMetrics(true);

  return new Blockly.utils.Coordinate(left + width / 2, top + height / 2);
}

function getBlocklyFocusManager() {
  return Blockly.getFocusManager?.() || Blockly.common?.getFocusManager?.();
}

const undoFocusTargets = new Map(); // event group id -> block id to refocus if that group is undone

export function rememberUndoFocusTarget(groupId, blockId) {
  if (!groupId || !blockId) return;
  undoFocusTargets.set(groupId, blockId);
}

export function focusBlocklyBlock(block) {
  const previouslySelected = Blockly.common?.getSelected?.();
  if (previouslySelected && previouslySelected !== block) {
    previouslySelected.unselect?.();
  }

  Blockly.common?.setSelected?.(block);
  getBlocklyFocusManager()?.focusNode?.(block);
  block.select?.();

  const focusableElement = block.getFocusableElement?.() || block.getSvgRoot?.();
  focusableElement?.focus?.({ preventScroll: true });
}

function focusKeywordField(block) {
  focusBlocklyBlock(block);

  // The picker needs the search index; build it now if the idle build has not run.
  ensureBlockSearchIndex(block.workspace);

  const textInputField = block.getField('KEYWORD');
  if (textInputField) {
    textInputField.showEditor_();

    requestAnimationFrame(() => {
      const htmlInput = document.querySelector('.blocklyHtmlInput');
      htmlInput?.focus?.({ preventScroll: true });
      htmlInput?.select?.();
    });
  }
}

// Connecting is left to Blockly, so the picker lands where a block dragged from
// the toolbox would, and anything already there is spliced on below.
function createKeywordBlockIn(connection) {
  const isValueSocket = connection.type === Blockly.ConnectionType.INPUT_VALUE;

  // Whatever the socket held is about to be replaced; a field editor open on it
  // would otherwise be left behind editing a disposed block.
  Blockly.WidgetDiv?.hide?.();

  Blockly.Events.setGroup(true);
  try {
    const keywordBlock = workspace.newBlock(isValueSocket ? 'keyword_value' : 'keyword');
    keywordBlock.initSvg();
    keywordBlock.render();
    connection.connect(
      isValueSocket ? keywordBlock.outputConnection : keywordBlock.previousConnection
    );
    window.currentBlock = keywordBlock;
    workspace.markKeywordBlockCreated?.(keywordBlock);
    workspace.layoutTopLevelBlocks?.();
    setTimeout(() => focusKeywordField(keywordBlock), 100);
  } finally {
    Blockly.Events.setGroup(false);
  }
}

// The picker takes the selected value block's place in its parent socket. With
// nothing to plug into it is created loose, like the no-selection case.
function createValueKeywordBlock(selectedBlock) {
  const socket = selectedBlock.outputConnection.targetConnection;
  if (socket) {
    createKeywordBlockIn(socket);
  } else {
    createKeywordBlockAtViewportCenter('keyword_value');
  }
}

function createKeywordBlockAtViewportCenter(blockType) {
  const ownsGroup = !Blockly.Events.getGroup();
  if (ownsGroup) Blockly.Events.setGroup(true);
  let block;
  try {
    block = workspace.newBlock(blockType);
    block.initSvg();
    block.render();
    block.moveTo(getViewportCenterCoordinates(workspace));
    window.currentBlock = block;
    workspace.markKeywordBlockCreated?.(block);
    workspace.layoutTopLevelBlocks?.();
  } finally {
    if (ownsGroup) Blockly.Events.setGroup(false);
  }
  focusKeywordField(block);
  return block;
}

// Clicking a field is, in Blockly's own gesture handling, a real SELECT of
// the enclosing block immediately followed by a real DESELECT once the
// field's editor opens. Rendering each as it arrives is correct at every
// step but flickers the block's tooltip up then down, so field clicks are
// special-cased below: decide and render the outcome immediately from the
// click target (a slot's hint if applyInputHint set one, else blank), and
// mute the SELECT/DESELECT noise so it can't override that decision.
//
// The shape of that noise isn't fixed -- clicking a field on an
// already-deselected block can produce three events (leftover noise, select,
// deselect) where the same field on an already-selected block produces just
// one (a bare deselect). fieldGesture tracks content, not count or timing:
// it waits for the enclosing block's reselect (unless it was already
// selected, in which case there isn't one) and treats the deselect that
// follows as completion. Anything that doesn't fit -- a later, unrelated
// selection change, e.g. from keyboard navigation -- passes through
// unsuppressed instead of being swallowed indefinitely.
let lastCanvasPointerBlock = null;
const fieldGesture = {
  active: false,
  expectedEnclosingId: null,
  wasAlreadySelected: false,
  seenExpectedReselect: false,
};

function armFieldGesture(enclosingId) {
  fieldGesture.active = true;
  fieldGesture.expectedEnclosingId = enclosingId;
  fieldGesture.wasAlreadySelected = window.currentBlock?.id === enclosingId;
  fieldGesture.seenExpectedReselect = false;
}

function disarmFieldGesture() {
  fieldGesture.active = false;
  fieldGesture.expectedEnclosingId = null;
  fieldGesture.wasAlreadySelected = false;
  fieldGesture.seenExpectedReselect = false;
}

// Returns true if this SELECTED event is gesture noise to swallow rather
// than pass to showSelectedBlockHint. See the fieldGesture comment above.
function isFieldGestureNoise(newElementId) {
  if (!fieldGesture.active) return false;

  if (!fieldGesture.seenExpectedReselect) {
    if (newElementId === fieldGesture.expectedEnclosingId) {
      fieldGesture.seenExpectedReselect = true;
      return true;
    }
    if (newElementId === undefined && fieldGesture.wasAlreadySelected) {
      disarmFieldGesture(); // sole deselect; nothing to reselect first
      return true;
    }
    return true; // leftover noise from an earlier click
  }

  disarmFieldGesture();
  return newElementId === undefined;
}

// Skips the DOM write (and whatever show/hide animation it triggers) when the
// hint box already displays this exact text. Checked against the live DOM,
// not a cached value, since other flows (the flyout hint, the one-off
// info-shortcut message) write to the same box directly.
function renderHint(text) {
  if (document.getElementById('blockHintText')?.textContent === text) return;
  if (text) {
    showBlockHint(text);
  } else {
    clearBlockHint();
  }
}

export function showSelectedBlockHint() {
  const selected = asBlocklyBlock(window.currentBlock);
  const text = selected && !selected.isDisposed?.() ? Blockly.Tooltip.getTooltipOfObject(selected) : '';
  renderHint(text);
}

// Blockly hangs its tooltip owner (a block or a field) off the SVG elements it
// binds, so walking up from the pointer target finds what is under the cursor.
function blockFromPointerTarget(target) {
  for (let node = target; node; node = node.parentNode) {
    const owner = node.tooltip;
    if (!owner) continue;
    const block = asBlocklyBlock(owner) || asBlocklyBlock(owner.getSourceBlock?.());
    if (block) return block;
  }
  return null;
}

// Hints for the toolbox: hovering or keyboard-focusing a flyout block describes
// it in the hint box, which replaced Blockly's hover tooltips.
function initializeFlyoutHints() {
  const flyoutWorkspace = workspace.getFlyout()?.getWorkspace();
  if (!flyoutWorkspace) return;

  let hoveredBlock = null;

  // A flyout item is dragged out whole, so hint about its root block rather
  // than whichever shadow field the pointer or cursor happens to be on.
  const showFlyoutHint = (block) => {
    const root = block && !block.isDisposed() ? block.getRootBlock() : null;
    if (!root) {
      showSelectedBlockHint();
      return;
    }
    showBlockHint(Blockly.Tooltip.getTooltipOfObject(root));
  };

  flyoutWorkspace.addChangeListener((event) => {
    if (event.type !== Blockly.Events.SELECTED) return;
    // Deselecting (clicking a flyout block deselects it again) falls back to
    // the block under the pointer, which is usually the one just clicked.
    const selected = event.newElementId && flyoutWorkspace.getBlockById(event.newElementId);
    showFlyoutHint(selected || hoveredBlock);
  });

  const flyoutSvg = flyoutWorkspace.getParentSvg();
  flyoutSvg.addEventListener('pointerover', (event) => {
    hoveredBlock = blockFromPointerTarget(event.target);
    showFlyoutHint(hoveredBlock);
  });
  flyoutSvg.addEventListener('pointerleave', () => {
    hoveredBlock = null;
    // A tap-selected flyout block keeps its hint in the box: mobile users
    // lift the finger (firing pointerleave) to read the help, and the
    // workspace selection a tap just made is usually none.
    const tapSelectedId = workspace.flyoutTapSelectedId;
    if (tapSelectedId) {
      const tapSelected = flyoutWorkspace.getBlockById(tapSelectedId);
      if (tapSelected && !tapSelected.isDisposed()) {
        showFlyoutHint(tapSelected);
        return;
      }
    }
    showSelectedBlockHint();
  });
}

export function initializeBlockHandling() {
  observeBlocklyInputs();
  initializeFlyoutHints();
  attachSectionBehaviour(workspace);

  // Capture-phase so this runs before Blockly's own gesture handling decides
  // whether the click selects a block or just edits a field in place.
  //
  // A click directly on a field's own DOM group (.blocklyField) is the
  // obvious case, but a block that's just a bare value with nothing else --
  // a shadow (the number in say's DURATION) or a plain reporter dragged in
  // to replace one (a variable) -- has its *whole* clickable area, border
  // included, wired to the same "activate this field" behavior.
  // .closest('.blocklyField') alone misses a click on that outline.
  workspace.getParentSvg()?.addEventListener(
    'pointerdown',
    (event) => {
      lastCanvasPointerBlock = blockFromPointerTarget(event.target);
      const isFieldClick =
        !!event.target.closest?.('.blocklyField') ||
        !!lastCanvasPointerBlock?.isShadow?.() ||
        !!lastCanvasPointerBlock?.isSimpleReporter?.();
      if (isFieldClick) {
        // A shadow defers its selection to its enclosing block (e.g. "say"),
        // but a real block -- a dragged-in variable, or a field living
        // directly on a non-shadow block -- gets selected itself.
        const parentConnection =
          lastCanvasPointerBlock?.outputConnection?.targetConnection ??
          lastCanvasPointerBlock?.previousConnection?.targetConnection;
        const enclosingId = lastCanvasPointerBlock?.isShadow?.()
          ? (parentConnection?.getSourceBlock?.()?.id ?? lastCanvasPointerBlock?.id ?? null)
          : (lastCanvasPointerBlock?.id ?? null);
        armFieldGesture(enclosingId);
        const hint = lastCanvasPointerBlock?.hasOwnInputHint
          ? Blockly.Tooltip.getTooltipOfObject(lastCanvasPointerBlock)
          : '';
        renderHint(hint);
      } else {
        // A body click just selects and stays selected, so the upcoming
        // SELECTED event renders it -- but also call this now, for the one
        // case with no such event: field-to-empty-canvas is a no-op in
        // Blockly's selection model.
        disarmFieldGesture();
        showSelectedBlockHint();
      }
    },
    true
  );

  // Refresh reporter fields' ARIA when their slot changes so a value block
  // (e.g. a number in scale's X) announces its parent input ("x, number").
  workspace.addChangeListener((event) => {
    if (event.isUiEvent) return;
    if (event.type === Blockly.Events.BLOCK_MOVE) {
      const block = workspace.getBlockById(event.blockId);
      if (block) refreshReporterAriaLabels(block);
    } else if (event.type === Blockly.Events.FINISHED_LOADING) {
      for (const top of workspace.getTopBlocks(false)) {
        refreshReporterAriaLabels(top);
      }
    }
  });

  // A slot's hint (e.g. say's DURATION meaning "seconds to show") belongs to
  // whatever currently occupies it: the initial shadow, a respawned one after
  // the real block is dragged out, or something dropped in to replace it.
  workspace.addChangeListener((event) => {
    if (event.isUiEvent) return;
    if (event.type === Blockly.Events.BLOCK_CREATE) {
      for (const id of event.ids ?? []) {
        applyInputHint(workspace.getBlockById(id));
      }
    } else if (event.type === Blockly.Events.BLOCK_MOVE) {
      applyInputHint(workspace.getBlockById(event.blockId));
    } else if (event.type === Blockly.Events.FINISHED_LOADING) {
      for (const block of workspace.getAllBlocks(false)) {
        applyInputHint(block);
      }
    }
  });

  workspace.addChangeListener(function (event) {
    if (
      event.type === Blockly.Events.TOOLBOX_ITEM_SELECT ||
      event.type === Blockly.Events.FLYOUT_SHOW
    ) {
      const toolbox = workspace.getToolbox();
      const selectedItem = toolbox.getSelectedItem();

      if (selectedItem && selectedItem.getName() === 'Snippets') {
        window.loadingCode = true;
      } else {
        window.loadingCode = false;
      }
    }
  });

  const blockTypesToCleanUp = TOP_BLOCK_TYPES;

  function layoutTopLevelBlocks() {
    const spacing = 40;
    const cursorX = 10;
    let cursorY = 10;

    // setGroup(true) unconditionally mints a new group id — it doesn't check
    // for one already open — so calling it unguarded here would split a
    // caller's in-progress group (e.g. keyword-block creation) into two undo
    // steps. Only open a group if the caller hasn't already opened one.
    const ownsGroup = !Blockly.Events.getGroup();
    if (ownsGroup) Blockly.Events.setGroup(true);
    try {
      const contained = buildContainedIdSet(workspace);
      const topBlocks = (workspace.getTopBlocks(false) || [])
        .filter((b) => !!b && !b.isInFlyout && !b.isShadow?.() && !contained.has(b.id))
        .sort((a, b) => a.getRelativeToSurfaceXY().y - b.getRelativeToSurfaceXY().y);

      for (const block of topBlocks) {
        if (!blockTypesToCleanUp.includes(block.type)) continue;
        // This debounced pass can fire mid-gesture on a slow drag; repositioning
        // a block still held by the user corrupts its rendering.
        if (block.isDragging?.()) continue;
        try {
          const xy = block.getRelativeToSurfaceXY();
          const dx = cursorX - xy.x;
          const dy = cursorY - xy.y;
          if (dx || dy) block.moveBy(dx, dy);

          if (block.type === 'section') layoutSectionChildren(block);
          const h = block.getHeightWidth?.().height || 40;
          cursorY += h + spacing;
        } catch (error) {
          console.warn('Suppressed non-critical error:', error);
        }
      }

      // Bring top-level blocks to the front in z-order so orphan blocks
      // (newly created, just-detached, dropped on existing stacks) render on
      // top of anything underneath them. canvas.appendChild on an existing
      // child detaches+reattaches the node, which drops DOM focus on any
      // focused descendant — so we snapshot document.activeElement around the
      // loop and restore it afterwards. In Blockly v13, after a duplicate or
      // delete this preserves the focus the focus_manager just placed on the
      // new / fallback block.
      try {
        const canvas = workspace.getBlockCanvas?.();
        if (canvas) {
          const activeBefore = document.activeElement;
          const activeInsideCanvas =
            activeBefore && canvas.contains(activeBefore) ? activeBefore : null;

          for (const b of topBlocks) {
            const svg = b.getSvgRoot?.();
            if (svg && svg.parentNode === canvas && svg !== canvas.lastChild) {
              canvas.appendChild(svg);
            }
          }

          if (
            activeInsideCanvas &&
            document.contains(activeInsideCanvas) &&
            document.activeElement !== activeInsideCanvas
          ) {
            try {
              activeInsideCanvas.focus({ preventScroll: true });
            } catch {
              // best-effort focus restoration
            }
          }
        }
      } catch (error) {
        console.warn('Suppressed non-critical error:', error);
      }
    } finally {
      if (ownsGroup) Blockly.Events.setGroup(false);
    }
  }

  setSectionReflowHook(layoutTopLevelBlocks);
  // Exposed so the Mod+. keyword-block shortcut (createKeywordBlockIn /
  // createKeywordBlockAtViewportCenter, below) can resolve stack overlap the
  // instant it inserts a block, the same way this fires straight after a
  // paste — instead of waiting on the 300ms debounce below, which leaves the
  // picker's open, focused search input sitting in an overlapping stack (or
  // jumping once the debounce finally corrects it).
  workspace.layoutTopLevelBlocks = layoutTopLevelBlocks;

  // Undoing a keyword-picker resolution (main/blockhandling.js /
  // blocks/blocks.js) removes the chosen block and recreates the keyword
  // placeholder it replaced, but Blockly's own undo doesn't move focus onto
  // that recreated block — it's left on whatever this happened to focus
  // before (typically the placeholder's parent), leaving an editable
  // placeholder sitting unfocused. Patched here rather than in each of the
  // several places that call workspace.undo() (toolbar buttons, the 3D
  // canvas's own Ctrl+Z, Blockly's built-in shortcut), so it applies no
  // matter how undo was triggered.
  const workspaceUndo = workspace.undo.bind(workspace);
  workspace.undo = function (redo) {
    const stack = redo ? this.getRedoStack?.() : this.getUndoStack?.();
    const undoneGroup = stack?.[stack.length - 1]?.group;

    const beforeIds = new Set(this.getAllBlocks(false).map((b) => b.id));
    const result = workspaceUndo(redo);
    const recreated = this.getAllBlocks(false).find(
      (b) => !beforeIds.has(b.id) && b.type?.startsWith('keyword')
    );
    if (recreated) {
      focusBlocklyBlock(recreated);
      // Blockly's own BlockSvg.dispose() has already run by this point (it's
      // part of workspaceUndo() above, undoing that block's creation): if the
      // disposed block held focus — it did, it's what undo just replaced —
      // dispose() itself schedules a bare setTimeout(…, 0) that reassigns
      // focus to its parent, precisely to avoid leaving focus on disposed
      // content. That macrotask is already queued ahead of anything we
      // schedule from here, so it always fires after the synchronous
      // assignment above and silently overwrites it. Queuing our own
      // setTimeout(…, 0) now runs after theirs (same delay, later in the
      // queue), giving this the last word instead — and reopening the
      // picker's own text field, not just the block, so typing can continue
      // right where undo left off.
      setTimeout(() => {
        if (recreated.isDisposed()) return;
        focusKeywordField(recreated);
      }, 0);
    } else if (!redo && undoneGroup && undoFocusTargets.has(undoneGroup)) {
      const targetId = undoFocusTargets.get(undoneGroup);
      undoFocusTargets.delete(undoneGroup);
      const target = this.getBlockById(targetId);
      if (target && !target.isDisposed?.()) {
        focusBlocklyBlock(target);
        // Same dispose()-queued setTimeout(…, 0) race as the keyword-block
        // case above: queue ours after it to have the last word.
        setTimeout(() => {
          if (!target.isDisposed?.()) focusBlocklyBlock(target);
        }, 0);
      }
    }
    return result;
  };

  function pruneUnusedVariables() {
    const usedModels = Blockly.Variables.allUsedVarModels(workspace);
    const usedIds = new Set(usedModels.map((model) => model.getId()));
    const unusedModels = workspace
      .getVariableMap()
      .getAllVariables()
      .filter((model) => !usedIds.has(model.getId()));
    if (!unusedModels.length) return;

    Blockly.Events.setGroup(true);
    try {
      for (const model of unusedModels) {
        workspace.getVariableMap().deleteVariable(model);
      }
    } finally {
      Blockly.Events.setGroup(false);
    }
  }

  // Preserve selection/cursor focus while tidying.
  // This is invoked by explicit "Clean up blocks" actions.
  workspace.cleanUp = function () {
    layoutTopLevelBlocks();
    pruneUnusedVariables();
  };

  // Unify all undo-recording events fired during a drag (mouse or keyboard
  // nav) into a single group, so one undo press reverts the whole move.
  // Some internal Blockly/plugin code (Mover post-drop, dynamic-connection
  // finalize, etc.) emits follow-up events with new or null group IDs,
  // splitting the move across multiple undo entries.
  let __dragSessionGroup = null;
  let __dragSessionTimer = null;
  workspace.addChangeListener((event) => {
    if (event.type === Blockly.Events.BLOCK_DRAG) {
      if (event.isStart) {
        __dragSessionGroup = event.group || `drag-${Date.now()}-${Math.random()}`;
        if (__dragSessionTimer) {
          clearTimeout(__dragSessionTimer);
          __dragSessionTimer = null;
        }
      } else {
        if (__dragSessionTimer) clearTimeout(__dragSessionTimer);
        __dragSessionTimer = setTimeout(() => {
          __dragSessionGroup = null;
          __dragSessionTimer = null;
        }, 200);
      }
      return;
    }
    if (__dragSessionGroup && event.recordUndo && event.group !== __dragSessionGroup) {
      event.group = __dragSessionGroup;
    }
  });

  workspace.addChangeListener(Blockly.Events.disableOrphans);

  let cleanupTimeout = null;

  // Global keyboard shortcuts
  document.addEventListener('keydown', function (event) {
    // Skip to main content (Alt+M)
    if (event.altKey && event.key.toLowerCase() === 'm') {
      event.preventDefault();
      const mainContent = document.getElementById('maincontent');
      if (mainContent) {
        mainContent.focus();
        announceToScreenReader(translate('focused_main_content'));
      }
      return;
    }

    // Close modal with Escape
    if (event.key === 'Escape') {
      const openModals = document.querySelectorAll('.modal:not(.hidden)');
      openModals.forEach((modal) => {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        modal.removeAttribute('aria-modal');
      });
      return;
    }
  });

  // Handle Enter key for adding new blocks
  document.addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key === '.') {
      event.preventDefault();

      const focusedConnection = getFocusedConnection();
      if (focusedConnection) {
        createKeywordBlockIn(focusedConnection);
        return;
      }

      const selectedBlock = getBlockBeingEdited() ?? getSelectedBlockForKeywordShortcut();

      if (!selectedBlock) {
        createKeywordBlockAtViewportCenter('keyword');
        return;
      }

      selectedBlock.unselect();

      // A rounded block gets a rounded picker in its own socket: the picker
      // replaces it there (a shadow vanishes, a real block is bumped out) and
      // only offers blocks that socket accepts.
      if (selectedBlock.outputConnection) {
        createValueKeywordBlock(selectedBlock);
        return;
      }

      if (!selectedBlock.nextConnection) {
        const bodySlot = getBodySlot(selectedBlock);
        if (bodySlot) createKeywordBlockIn(bodySlot);
        return;
      }

      // Create a new keyword block
      const ownsGroup = !Blockly.Events.getGroup();
      if (ownsGroup) Blockly.Events.setGroup(true);
      const keywordBlock = workspace.newBlock('keyword');
      try {
        window.currentBlock = keywordBlock;
        keywordBlock.initSvg();
        keywordBlock.render();

        // Connect blocks (same as before)
        const currentNextBlock = selectedBlock.getNextBlock();
        if (currentNextBlock) {
          selectedBlock.nextConnection.disconnect();
        }
        selectedBlock.nextConnection.connect(keywordBlock.previousConnection);
        if (currentNextBlock && keywordBlock.nextConnection) {
          keywordBlock.nextConnection.connect(currentNextBlock.previousConnection);
        }

        // Update our tracking variable to the new block
        window.currentBlock = keywordBlock;
        workspace.markKeywordBlockCreated?.(keywordBlock);
        layoutTopLevelBlocks();
      } finally {
        if (ownsGroup) Blockly.Events.setGroup(false);
      }

      // Open the editor with a delay
      setTimeout(() => {
        focusKeywordField(keywordBlock);
      }, 100);
    }
  });

  workspace.addChangeListener((event) => {
    // Track the currently selected block.
    if (event.type === Blockly.Events.SELECTED) {
      window.currentBlock = event.newElementId ? workspace.getBlockById(event.newElementId) : null;
      if (!isFieldGestureNoise(event.newElementId)) showSelectedBlockHint();
    }

    // Workaround for Blockly not checking for orphans on key
    if (event.type === Blockly.Events.BLOCK_DRAG && event.isStart === false) {
      // Preserve the move's event group so the disabled-state change
      // from disableOrphans collapses into the same undo step.
      const eventGroup = event.group;
      // Wait until Blockly has fully settled
      queueMicrotask(() => {
        const prevGroup = Blockly.Events.getGroup();
        if (eventGroup) Blockly.Events.setGroup(eventGroup);
        try {
          Blockly.Events.disableOrphans({
            type: Blockly.Events.BLOCK_MOVE,
            workspaceId: workspace.id,
            blockId: event.blockId,
            oldParentId: undefined,
            newParentId: undefined,
            recordUndo: false,
            isUiEvent: false,
            group: eventGroup,
          });
        } finally {
          Blockly.Events.setGroup(prevGroup);
        }
      });
    }
    // Debounced cleanup on structural changes.
    if (
      !event.isUiEvent &&
      (event.type === Blockly.Events.BLOCK_MOVE ||
        event.type === Blockly.Events.BLOCK_CREATE ||
        event.type === Blockly.Events.BLOCK_DELETE)
    ) {
      // Capture this event's group so the cleanup's disableOrphans call
      // is attributed to the same undo entry as the triggering change.
      const eventGroup = event.group;
      clearTimeout(cleanupTimeout);
      cleanupTimeout = setTimeout(() => {
        const activeBefore = document.activeElement;

        const wasEnabled = Blockly.Events.isEnabled();
        try {
          if (wasEnabled) Blockly.Events.disable(); // don't create undo entries
          layoutTopLevelBlocks();
        } finally {
          if (wasEnabled) Blockly.Events.enable();
        }

        const prevGroup = Blockly.Events.getGroup();
        if (eventGroup) Blockly.Events.setGroup(eventGroup);
        try {
          Blockly.Events.disableOrphans(workspace);
        } finally {
          Blockly.Events.setGroup(prevGroup);
        }

        // Restore focus if the cleanup blurred it. Only restore if the
        // element is still in the DOM and currently lacks focus.
        if (
          activeBefore &&
          activeBefore !== document.body &&
          document.contains(activeBefore) &&
          document.activeElement !== activeBefore
        ) {
          try {
            activeBefore.focus?.({ preventScroll: true });
          } catch {
            // best-effort
          }
        }
      }, 300); // adjust if you want snappier/slower cleanup
    }

    // Immediate cleanup when a top-level block is collapsed/expanded via
    // Blockly's own native collapse (a section's own toggle reflows via
    // setSectionReflowHook instead).
    if (event.type === Blockly.Events.BLOCK_CHANGE && event.element === 'collapsed') {
      const block = workspace.getBlockById(event.blockId);
      if (block && !block.getParent()) {
        layoutTopLevelBlocks();
      }
      if (block && event.newValue) {
        updateCollapsedBlockIcon(block);
      }
    }

    // Purge deleted blocks from the registry, then dispatch to handlers.
    if (event.type === Blockly.Events.BLOCK_DELETE && Array.isArray(event.ids)) {
      for (const id of event.ids) {
        if (!workspace.getBlockById(id)) {
          blockHandlerRegistry.delete(id);
        }
      }
    }

    // cachedValues() returns a stable snapshot that guards against
    // mid-iteration mutations (e.g. a handler that creates or deletes blocks)
    // without allocating a new array on every event.
    const handlers = blockHandlerRegistry.cachedValues();
    for (const handler of handlers) {
      handler(event);
    }
  });
}

// Rebuilds from a stashed pristine original each call, so HMR re-applies
// the latest wrapper instead of skipping (guard flag) or double-wrapping.
function patchMethod(proto, methodName, buildWrapper) {
  if (!proto?.[methodName]) return;
  const originalKey = `__original_${methodName}`;
  if (!proto[originalKey]) proto[originalKey] = proto[methodName];
  proto[methodName] = buildWrapper(proto[originalKey]);
}

// 1pt = 4/3px, matching the getComputedStyle check in enforceMinimumFontSize.
const MIN_EDIT_FONT_PX = 16;
const MIN_EDIT_LINES = 3;

function patchFieldMinimumEditSize(FieldClass) {
  patchMethod(FieldClass?.prototype, 'updateSize_', (originalUpdateSize) =>
    function (...args) {
      originalUpdateSize.apply(this, args);
      if (!this.isBeingEdited_) return;

      const constants = this.getConstants();
      const scale = this.workspace_?.getScale?.();
      if (!constants || !scale) return;

      const naturalRealPx = constants.FIELD_TEXT_FONTSIZE * scale * (4 / 3);
      if (naturalRealPx < MIN_EDIT_FONT_PX) {
        const ratio = MIN_EDIT_FONT_PX / naturalRealPx;
        this.size_.width *= ratio;
        this.size_.height *= ratio;
      }

      if (typeof this.setMaxLines === 'function') {
        const lineHeight = constants.FIELD_TEXT_HEIGHT + constants.FIELD_BORDER_RECT_Y_PADDING;
        const minHeight =
          lineHeight * MIN_EDIT_LINES + constants.FIELD_BORDER_RECT_Y_PADDING * 2;
        if (this.size_.height < minHeight) this.size_.height = minHeight;
      }

      if (this.borderRect_) {
        this.borderRect_.setAttribute('width', this.size_.width);
        this.borderRect_.setAttribute('height', this.size_.height);
      }
    }
  );
}

patchFieldMinimumEditSize(FieldMultilineInput);
patchFieldMinimumEditSize(Blockly.FieldTextInput);

function wrapLineToMaxLength(line, maxLength) {
  if (line.length <= maxLength) return [line];

  const wrapped = [];
  let current = '';
  for (const word of line.split(' ')) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLength && current) {
      wrapped.push(current);
      current = word;
    } else {
      current = candidate;
    }
    while (current.length > maxLength) {
      wrapped.push(current.slice(0, maxLength));
      current = current.slice(maxLength);
    }
  }
  if (current) wrapped.push(current);
  return wrapped;
}

function patchFieldWrapWhenStatic(FieldClass) {
  patchMethod(FieldClass?.prototype, 'getDisplayText_', (originalGetDisplayText) =>
    function (...args) {
      if (this.isBeingEdited_) return originalGetDisplayText.apply(this, args);

      const text = this.getText();
      if (!text) return Blockly.Field.NBSP;

      const wrapped = text
        .split('\n')
        .flatMap((line) => wrapLineToMaxLength(line, this.maxDisplayLength))
        .map((line) => line.replace(/\s/g, Blockly.Field.NBSP))
        .join('\n');

      return this.getSourceBlock()?.RTL ? wrapped + '‏' : wrapped;
    }
  );
}

patchFieldWrapWhenStatic(FieldMultilineInput);

function patchFieldFlatWhenStatic(FieldClass) {
  patchMethod(FieldClass?.prototype, 'render_', (originalRender) =>
    function (...args) {
      originalRender.apply(this, args);

      const block = this.getSourceBlock();
      const blockPath = block?.isShadow() ? block.pathObject?.svgPath : null;

      if (!this.borderRect_) return;

      this.borderRect_.setAttribute('rx', 4);
      this.borderRect_.setAttribute('ry', 4);
      blockPath?.style.setProperty('fill', 'transparent', 'important');
      blockPath?.style.setProperty('stroke', 'transparent', 'important');

      if (this.isBeingEdited_) {
        this.borderRect_.style.removeProperty('fill');
        this.borderRect_.style.removeProperty('stroke');
      } else {
        const blockColour = block?.getColour() ?? 'var(--color-text-primary)';
        this.borderRect_.style.setProperty(
          'fill',
          `color-mix(in srgb, ${blockColour} 25%, var(--color-bg))`,
          'important'
        );
        this.borderRect_.style.setProperty(
          'stroke',
          `color-mix(in srgb, ${blockColour} 45%, var(--color-bg))`,
          'important'
        );
      }
    }
  );
}

patchFieldFlatWhenStatic(FieldMultilineInput);

// Function to enforce minimum font size and delay the focus to prevent zoom
function enforceMinimumFontSize(input) {
  // The block picker sets its own size to match the toolbox search box; on
  // narrow screens it still takes the 16px iOS zoom guard below.
  if (input.classList.contains('block-search-input') && !isCompactSearchLayout()) {
    return;
  }

  const currentFontSize = parseFloat(getComputedStyle(input).fontSize);

  if (currentFontSize > 0 && currentFontSize < MIN_EDIT_FONT_PX) {
    const ratio = MIN_EDIT_FONT_PX / currentFontSize;
    input.style.fontSize = `${MIN_EDIT_FONT_PX}px`;
    input.offsetHeight; // Force reflow to apply the font size change

    if (!(findFieldForEditor(input) instanceof FieldMultilineInput)) {
      requestAnimationFrame(() => {
        const widgetDiv = input.closest('.blocklyWidgetDiv');
        if (!widgetDiv) return;
        const currentWidth = parseFloat(widgetDiv.style.width);
        if (currentWidth) widgetDiv.style.width = `${currentWidth * ratio}px`;

        input.offsetHeight;

        const neededHeight = input.scrollHeight;
        if (neededHeight) widgetDiv.style.height = `${neededHeight}px`;
      });
    }
  }

  // Delay focus to prevent zoom
  input.addEventListener(
    'focus',
    (event) => {
      event.preventDefault(); // Prevent the default focus action
      setTimeout(() => {
        input.focus(); // Focus the input after a short delay
      }, 50); // Adjust the delay as needed (50ms is usually enough)
    },
    { once: true }
  ); // Add the event listener once for each input
}

// Function to observe changes in the DOM for dynamically added blocklyHtmlInput elements
function observeBlocklyInputs() {
  const observer = new MutationObserver((mutationsList) => {
    mutationsList.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          // Check if the added node is an INPUT element with the blocklyHtmlInput class
          if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('blocklyHtmlInput')) {
            enforceMinimumFontSize(node); // Set font size and delay focus
          }
        });
      }
    });
  });

  // Observe only the Blockly container to avoid scanning the entire document
  const blocklyContainer =
    workspace?.getParentSvg()?.closest('#blocklyDiv') ??
    document.getElementById('blocklyDiv') ??
    document.body;
  observer.observe(blocklyContainer, { childList: true, subtree: true });
}
