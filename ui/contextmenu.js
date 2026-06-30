// Context menu for blocks. One appears on right click, another on selection.

import * as Blockly from 'blockly';
import { translate } from '../main/translation.js';
import { getMeshFromBlock } from './blockmesh.js';
import {
  setBlockLocked,
  isBlockLocked,
  stripLockState,
  toggleBlockComment,
  toggleCommentBubble,
} from './blocklyutil.js';

// Render a context-menu row as "Label                 Shortcut", with the
// shortcut hint dimmed on the right. Shared by the detach (X), view (V) and
// comment (K) items.
function renderShortcut(label, shortcut) {
  const wrapper = document.createElement('span');
  wrapper.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;gap:1.5em;width:100%';
  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  const shortcutEl = document.createElement('span');
  shortcutEl.textContent = shortcut;
  shortcutEl.style.color = 'var(--blockly-text-disabled, #aaa)';
  wrapper.append(labelEl, shortcutEl);
  return wrapper;
}

export function initContextMenus(workspace) {
  // ------- Pointer tracking for "paste at pointer" -------
  let lastCM = { x: 0, y: 0 };
  (workspace.getInjectionDiv() || document).addEventListener(
    'contextmenu',
    (e) => {
      lastCM = { x: e.clientX, y: e.clientY };
    },
    { capture: true }
  );

  // Screen -> workspace coords
  function screenToWs(ws, xy) {
    const c = new Blockly.utils.Coordinate(xy.x, xy.y);
    return Blockly.utils.svgMath.screenToWsCoordinates(ws, c);
  }

  // Add a context menu item that mirrors the keyboard-navigation "detach" (X) shortcut.
  (function registerDetachContextMenuItem() {
    const registry = Blockly.ContextMenuRegistry.registry;
    const id = 'detachBlockWithShortcut';
    if (registry.getItem && registry.getItem(id)) return;

    registry.register({
      id,
      weight: 80,
      displayText: () => {
        const text = translate('detach_block_option');
        const label = text === 'detach_block_option' ? 'Detach' : text;
        return renderShortcut(label, 'X');
      },
      preconditionFn: (scope) => {
        const block = scope.block;
        if (!block || block.isInFlyout) return 'hidden';

        const hasParent =
          !!block.getParent() ||
          !!block.previousConnection?.targetConnection ||
          !!block.outputConnection?.targetConnection;
        return hasParent ? 'enabled' : 'disabled';
      },
      callback: (scope) => {
        const block = scope.block;
        if (!block) return;

        const healStack = !block.outputConnection?.isConnected();
        const prevGroup = Blockly.Events.getGroup();
        Blockly.Events.setGroup('contextmenu_detach');
        block.unplug(healStack);
        const cursor = block.workspace?.getCursor?.();
        if (cursor?.setCurNode) cursor.setCurNode(block);
        Blockly.Events.setGroup(prevGroup || null);
      },
      scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
    });
  })();

  // Add a context menu item to focus the canvas camera on a block's mesh.
  (function registerViewInCanvasContextMenuItem() {
    const registry = Blockly.ContextMenuRegistry.registry;
    const id = 'viewBlockInCanvas';
    if (registry.getItem && registry.getItem(id)) return;

    registry.register({
      id,
      weight: 8,
      displayText: () => {
        const text = translate('view_in_canvas_option');
        const label = text === 'view_in_canvas_option' ? 'View in canvas' : text;
        return renderShortcut(label, 'V');
      },
      preconditionFn: (scope) => {
        const block = scope.block;
        if (!block || block.isInFlyout) return 'hidden';
        try {
          const mesh = getMeshFromBlock(block);
          return mesh && mesh.name !== 'ground' ? 'enabled' : 'hidden';
        } catch {
          return 'hidden';
        }
      },
      callback: (scope) => {
        const block = scope.block;
        if (!block) return;
        Promise.all([import('../main/view.js'), import('./gizmos.js')]).then(
          ([{ showCanvasView }, { viewMeshWithCamera }]) => {
            showCanvasView();
            window.currentBlock = block;
            viewMeshWithCamera(block);
          }
        );
      },
      scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
    });
  })();

  // Add a context menu item to lock/unlock a block (and its descendants) so it
  // can't be edited, moved or deleted. Appears directly after "Disable".
  (function registerLockContextMenuItem() {
    const registry = Blockly.ContextMenuRegistry.registry;
    const id = 'blockLock';
    if (registry.getItem && registry.getItem(id)) return;

    registry.register({
      id,
      weight: 16,
      displayText: (scope) => {
        const locked = isBlockLocked(scope.block);
        const key = locked ? 'unlock_block_option' : 'lock_block_option';
        const text = translate(key);
        return text === key ? (locked ? 'Unlock' : 'Lock') : text;
      },
      preconditionFn: (scope) => {
        const block = scope.block;
        if (!block || block.isInFlyout) return 'hidden';
        // Stay enabled even when locked, so "Unlock" is reachable.
        return 'enabled';
      },
      callback: (scope) => {
        const block = scope.block;
        if (!block) return;
        const prevGroup = Blockly.Events.getGroup();
        Blockly.Events.setGroup('contextmenu_lock');
        setBlockLocked(block, !isBlockLocked(block));
        Blockly.Events.setGroup(prevGroup || null);
      },
      scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
    });
  })();

  // Reorder block context menu items for better grouping.
  // Cut/copy/paste are registered at weights 1/2/3; push everything else above that.
  (function adjustBlockContextMenuWeights() {
    const registry = Blockly.ContextMenuRegistry.registry;

    const weights = {
      blockDuplicate: 9,
      detachBlockWithShortcut: 10,
      viewBlockInCanvas: 10.5,
      blockComment: 12,
      blockInline: 13,
      blockCollapseExpand: 14,
      blockDisable: 15,
      blockLock: 16,
      blockDelete: 20,
      blockHelp: 999,
    };
    for (const [id, weight] of Object.entries(weights)) {
      const item = registry.getItem?.(id);
      if (item) item.weight = weight;
    }
  })();

  // Customize the built-in comment item. (1) Show the shortcut hint, the same
  // way detach shows "X" and view shows "V"; the item is dynamic — "Add Comment"
  // adds (K), "Remove Comment" deletes (Shift+K) — so match the hint to whichever
  // it will do. (2) Make "Add Comment" open and focus the bubble (Blockly's
  // default leaves it closed), matching the K shortcut.
  (function customizeCommentContextMenuItem() {
    const registry = Blockly.ContextMenuRegistry.registry;
    const item = registry.getItem?.('blockComment');
    if (!item || item.__commentItemWrapped) return;

    const origDisplayText = item.displayText;
    item.displayText = (scope) => {
      const text =
        typeof origDisplayText === 'function' ? origDisplayText(scope) : origDisplayText;
      const hasComment = scope?.block?.getCommentText?.() != null;
      return renderShortcut(text, hasComment ? 'Shift+K' : 'K');
    };

    const origCallback = item.callback;
    item.callback = function (scope, ...rest) {
      const block = scope?.block;
      if (block && block.getCommentText?.() == null) {
        // Adding: create the comment, open its bubble and focus the editor.
        Blockly.Events.setGroup('contextmenu_comment');
        toggleCommentBubble(block);
        Blockly.Events.setGroup(false);
        return;
      }
      return origCallback?.call(this, scope, ...rest);
    };

    item.__commentItemWrapped = true;
  })();

  // Disable context-menu items that would edit a locked block (comment, inline
  // inputs, disable, detach). Delete is already disabled via setDeletable(false),
  // and "Lock/Unlock" stays enabled so the block can be unlocked.
  (function disableMutatingItemsWhenLocked() {
    const registry = Blockly.ContextMenuRegistry.registry;
    const ids = ['blockComment', 'blockInline', 'blockDisable', 'detachBlockWithShortcut'];
    for (const id of ids) {
      const item = registry.getItem?.(id);
      if (!item || item.__lockWrapped) continue;
      const orig = item.preconditionFn?.bind(item);
      item.preconditionFn = (scope) => {
        if (isBlockLocked(scope.block)) return 'disabled';
        return orig ? orig(scope) : 'enabled';
      };
      item.__lockWrapped = true;
    }
  })();

  // Remove undo/redo (toolbar buttons cover this) and clean up (flock does this automatically).
  // Also remove the separate collapse/expand workspace items — replaced by a single toggle below.
  (function removeRedundantContextMenuItems() {
    const registry = Blockly.ContextMenuRegistry.registry;
    [
      'undoWorkspace',
      'redoWorkspace',
      'cleanWorkspace',
      'collapseWorkspace',
      'expandWorkspace',
    ].forEach((id) => {
      try {
        registry.unregister(id);
      } catch (e) {
        void e;
      }
    });
  })();

  // Replace separate "Collapse all" / "Expand all" workspace items with a single toggle.
  (function registerCollapseExpandWorkspaceToggle() {
    const registry = Blockly.ContextMenuRegistry.registry;
    const WORKSPACE = Blockly.ContextMenuRegistry.ScopeType.WORKSPACE;
    if (registry.getItem?.('flockCollapseExpandWorkspace')) return;

    const hasAnyExpanded = (ws) => {
      for (const block of ws.getTopBlocks(false)) {
        let b = block;
        while (b) {
          if (!b.isCollapsed()) return true;
          b = b.getNextBlock();
        }
      }
      return false;
    };

    registry.register({
      id: 'flockCollapseExpandWorkspace',
      weight: 4,
      scopeType: WORKSPACE,
      displayText: (scope) =>
        hasAnyExpanded(scope.workspace)
          ? translate('context_collapse_all_option')
          : translate('context_expand_all_option'),
      preconditionFn: (scope) => {
        if (!scope.workspace?.options?.collapse) return 'hidden';
        return scope.workspace.getTopBlocks(false).length ? 'enabled' : 'hidden';
      },
      callback: (scope) => {
        const ws = scope.workspace;
        const shouldCollapse = hasAnyExpanded(ws);
        Blockly.Events.setGroup(true);
        for (const block of ws.getTopBlocks(true)) {
          let b = block;
          while (b) {
            b.setCollapsed(shouldCollapse);
            b = b.getNextBlock();
          }
        }
        Blockly.Events.setGroup(false);
      },
    });
  })();

  // Rename built-in workspace "Delete" item to the localized "Delete all blocks" label.
  (function renameWorkspaceDeleteMenuItem() {
    const item = Blockly.ContextMenuRegistry.registry.getItem?.('workspaceDelete');
    if (item) item.displayText = () => translate('context_delete_all_blocks_option');
  })();

  // Add "Find in workspace" to the workspace context menu.
  (function registerWorkspaceSearchContextMenuItem() {
    const registry = Blockly.ContextMenuRegistry.registry;
    const id = 'workspaceFindInWorkspace';
    if (registry.getItem?.(id)) return;
    registry.register({
      id,
      weight: 50,
      displayText: () => translate('workspace_search_placeholder'),
      preconditionFn: () => 'enabled',
      callback: () => window.flockWorkspaceSearch?.open(),
      scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
    });
  })();

  // Register cut/copy/paste at the top of the block context menu (weights 1/2/3).
  (function registerClipboardContextMenuItems() {
    const registry = Blockly.ContextMenuRegistry.registry;
    const BLOCK = Blockly.ContextMenuRegistry.ScopeType.BLOCK;
    const WORKSPACE = Blockly.ContextMenuRegistry.ScopeType.WORKSPACE;

    const notInFlyout = (scope) => (scope.block?.isInFlyout ? 'hidden' : 'enabled');
    const hasCopiedData = () => !!Blockly.clipboard?.getLastCopiedData?.();

    registry.register({
      id: 'blockCut',
      weight: 1,
      displayText: () => Blockly.Msg['CUT_SHORTCUT'] || 'Cut',
      preconditionFn: (scope) => (isBlockLocked(scope.block) ? 'disabled' : notInFlyout(scope)),
      callback: (scope) => {
        const block = scope.block;
        if (!block) return;
        copyWithoutToast(block);
        Blockly.Events.setGroup('contextmenu_cut');
        block.dispose(true);
        Blockly.Events.setGroup(false);
      },
      scopeType: BLOCK,
    });

    registry.register({
      id: 'blockCopy',
      weight: 2,
      displayText: () => Blockly.Msg['COPY_SHORTCUT'] || 'Copy',
      preconditionFn: notInFlyout,
      callback: (scope) => {
        const block = scope.block;
        if (block) copyWithoutToast(block);
      },
      scopeType: BLOCK,
    });

    registry.register({
      id: 'blockPaste',
      weight: 3,
      displayText: () => Blockly.Msg['PASTE_SHORTCUT'] || 'Paste',
      preconditionFn: (scope) => {
        if (scope.block?.isInFlyout) return 'hidden';
        if (isBlockLocked(scope.block)) return 'disabled';
        return hasCopiedData() ? 'enabled' : 'disabled';
      },
      callback: (scope) => {
        const data = Blockly.clipboard?.getLastCopiedData?.();
        if (!data) return;
        const ws = scope?.block?.workspace ?? workspace;
        if (!ws) return;
        const block = scope.block;
        if (!block || !(block instanceof Blockly.Block)) return;
        pasteAsChildOrHere(block, ws, data);
      },
      scopeType: BLOCK,
    });

    registry.register({
      id: 'workspacePaste',
      weight: 3,
      displayText: () => Blockly.Msg['PASTE_SHORTCUT'] || 'Paste',
      preconditionFn: () => (hasCopiedData() ? 'enabled' : 'disabled'),
      callback: (scope) => {
        const data = Blockly.clipboard?.getLastCopiedData?.();
        if (!data) return;
        const ws = scope?.workspace ?? workspace;
        if (!ws) return;
        pasteAsChildOrHere(null, ws, data);
      },
      scopeType: WORKSPACE,
    });

    if (!registry.getItem?.('flock_ws_sep_after_paste')) {
      registry.register({
        id: 'flock_ws_sep_after_paste',
        weight: 3.5,
        separator: true,
        scopeType: WORKSPACE,
      });
    }
  })();

  // Add separators to the block context menu to group related items.
  // Weights: clipboard(1-3) | 5 | block-ops(9-10) | 10.5 | comment(11-14) | 18 | delete(20) | 50 | export(100-200) | 500 | help(999)
  (function registerBlockContextMenuSeparators() {
    const registry = Blockly.ContextMenuRegistry.registry;
    const BLOCK = Blockly.ContextMenuRegistry.ScopeType.BLOCK;
    const separators = [
      { id: 'flock_sep_after_clipboard', weight: 5 },
      { id: 'flock_sep_before_comment', weight: 10.5 },
      { id: 'flock_sep_before_delete', weight: 18 },
      { id: 'flock_sep_before_export', weight: 50 },
      { id: 'flock_sep_before_help', weight: 500 },
    ];
    for (const { id, weight } of separators) {
      if (!registry.getItem?.(id)) {
        registry.register({ id, weight, separator: true, scopeType: BLOCK });
      }
    }
  })();

  // ===== OVERRIDE CLIPBOARD METHODS =====
  const origCopy = Blockly.clipboard.copy;
  const origToastShow = Blockly.Toast?.show;

  Blockly.clipboard.copy = function (block) {
    origCopy.call(Blockly.clipboard, block);

    if (block?.isInFlyout) {
      const tb = Blockly.getMainWorkspace()?.getToolbox?.();
      tb?.getFlyout?.()?.hide?.();
      tb?.getSelectedItem?.()?.setSelected?.(false);
    }
  };

  // Assuming Blockly 13 has removed toasts, this is not needed
  function copyWithoutToast(block) {
    if (!block) return;
    if (Blockly.Toast?.show) Blockly.Toast.show = () => {};
    try {
      Blockly.clipboard.copy.call(Blockly.clipboard, block);
    } finally {
      if (Blockly.Toast?.show) Blockly.Toast.show = origToastShow;
    }
  }

  function overrideContextMenuCopyItem() {
    const ids = [
      'blockCopyToStorage', // Blockly core (common)
      'blockCopyFromContextMenu', // possible variant
    ];

    let item = null;
    for (const id of ids) {
      item = Blockly.ContextMenuRegistry.registry.getItem(id);
      if (item) break;
    }
    if (!item) return false;

    const original = item.callback;

    item.callback = function (scope, menuOpenEvent, location) {
      const block = scope?.block;
      if (block) {
        copyWithoutToast(block);
        return;
      }
      return original?.call(this, scope, menuOpenEvent, location);
    };

    return true;
  }

  (function installCopyOverrideWithRetry(maxAttempts = 20, delayMs = 50) {
    let attempts = 0;
    const t = setInterval(() => {
      attempts++;
      if (overrideContextMenuCopyItem() || attempts >= maxAttempts) {
        clearInterval(t);
      }
    }, delayMs);
  })();

  function isTypingInInput() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || !!el.isContentEditable;
  }

  const host = workspace.getInjectionDiv() || document;
  let __fcLastPointer = { x: 0, y: 0 };
  let __fcLastPointerType = 'mouse'; // 'mouse' | 'touch' | 'pen'
  let __fcMenuPoint = null;
  let __fcMenuPointerType = 'mouse';

  host.addEventListener(
    'pointerdown',
    (e) => {
      if (!e.isPrimary) return;
      __fcLastPointer = { x: e.clientX, y: e.clientY };
      __fcLastPointerType = e.pointerType || 'mouse';
    },
    { capture: true }
  );

  host.addEventListener(
    'pointermove',
    (e) => {
      if (!e.isPrimary) return;
      __fcLastPointer = { x: e.clientX, y: e.clientY };
      __fcLastPointerType = e.pointerType || __fcLastPointerType;
    },
    { capture: true }
  );

  // Capture the *actual* coordinates that opened the context menu (works for long-press)
  const __origShow = Blockly.ContextMenu.show;
  Blockly.ContextMenu.show = function (e, options, rtl) {
    __fcMenuPoint = { x: e.clientX, y: e.clientY };
    __fcMenuPointerType = e.pointerType || __fcLastPointerType || 'mouse';
    return __origShow.call(Blockly.ContextMenu, e, options, rtl);
  };
  host.addEventListener(
    'contextmenu',
    (e) => {
      lastCM = { x: e.clientX, y: e.clientY };
    },
    { capture: true }
  );
  host.addEventListener(
    'mousemove',
    (e) => {
      lastCM = { x: e.clientX, y: e.clientY };
    },
    { capture: true }
  );

  function pasteAsChildOrHere(targetBlock /* may be null */, ws, data) {
    if (!data) return;
    // A pasted copy of a locked block must be editable; the copied state carries
    // movable/editable/deletable=false, so strip it from the clipboard data.
    if (data.blockState) stripLockState(data.blockState);
    const at = screenToWs(ws, lastCM);
    const pasted = Blockly.clipboard.paste(data, ws, at);
    const pb = /** @type {Blockly.BlockSvg} */ (pasted);
    if (!targetBlock) return;

    const checker = ws.getConnectionChecker
      ? ws.getConnectionChecker()
      : new Blockly.ConnectionChecker();
    const can = (a, b) => checker.canConnect(a, b, /*isDragging=*/ false);

    // 1) stack after: target.next ⟷ pb.previous
    if (
      targetBlock.nextConnection &&
      pb.previousConnection &&
      can(targetBlock.nextConnection, pb.previousConnection)
    ) {
      targetBlock.nextConnection.connect(pb.previousConnection);
      return;
    }
    // 2) empty statement input ⟷ pb.previous
    for (const input of targetBlock.inputList) {
      if (
        input.type === Blockly.NEXT_STATEMENT &&
        input.connection &&
        !input.connection.targetBlock() &&
        pb.previousConnection &&
        can(input.connection, pb.previousConnection)
      ) {
        input.connection.connect(pb.previousConnection);
        return;
      }
    }
    // 2b) top-level block: insert pb as first child in statement input,
    //     pushing existing children after pb
    const isTopLevel = !targetBlock.previousConnection && !targetBlock.nextConnection;
    if (isTopLevel && pb.previousConnection) {
      for (const input of targetBlock.inputList) {
        if (
          input.type === Blockly.NEXT_STATEMENT &&
          input.connection &&
          input.connection.targetBlock() &&
          can(input.connection, pb.previousConnection)
        ) {
          const firstChild = input.connection.targetBlock();
          input.connection.disconnect();
          input.connection.connect(pb.previousConnection);
          // Append previous first child after pb chain
          let lastPb = pb;
          while (lastPb.nextConnection && lastPb.nextConnection.targetBlock()) {
            lastPb = lastPb.nextConnection.targetBlock();
          }
          if (
            lastPb.nextConnection &&
            firstChild.previousConnection &&
            can(lastPb.nextConnection, firstChild.previousConnection)
          ) {
            lastPb.nextConnection.connect(firstChild.previousConnection);
          }
          return;
        }
      }
    }
    // 3) empty value input ⟷ pb.output
    for (const input of targetBlock.inputList) {
      if (
        input.type === Blockly.INPUT_VALUE &&
        input.connection &&
        !input.connection.targetBlock() &&
        pb.outputConnection &&
        can(input.connection, pb.outputConnection)
      ) {
        input.connection.connect(pb.outputConnection);
        return;
      }
    }
    // 4) insert above: target.previous ⟷ pb.next
    if (
      targetBlock.previousConnection &&
      pb.nextConnection &&
      can(targetBlock.previousConnection, pb.nextConnection)
    ) {
      targetBlock.previousConnection.connect(pb.nextConnection);
      return;
    }
    // else: stays at pointer
  }

  // ---- Bind Ctrl/Cmd+V ----
  host.addEventListener(
    'keydown',
    (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if ((e.key || '').toLowerCase() !== 'v') return;
      if (isTypingInInput()) return;

      const data = Blockly.clipboard?.getLastCopiedData?.();
      if (!data) return;

      // Selected block (if any, and not from flyout)
      const selected = Blockly.common?.getSelected?.() || null;
      if (selected && selected.isInFlyout) return; // never paste in the flyout
      if (selected && !(selected instanceof Blockly.Block)) return; // only paste to blocks

      e.preventDefault();
      e.stopPropagation();
      pasteAsChildOrHere(selected || null, workspace, data);
    },
    { capture: true }
  );

  // ---- Floating block toolbar ----
  // Pointer selection shows it after a short hover; keyboard navigation shows it
  // immediately with a shortcut-letter overlay (D/X/K/V/Del) above each button.
  {
    const blockToolbar = document.createElement('div');
    blockToolbar.className = 'fc-block-toolbar';
    blockToolbar.setAttribute('role', 'toolbar');
    document.body.appendChild(blockToolbar);

    // Keyboard-only overlay of shortcut-letter badges, one per visible button.
    const badgeOverlay = document.createElement('div');
    badgeOverlay.className = 'fc-toolbar-badges';
    document.body.appendChild(badgeOverlay);

    // Icon paths: Font Awesome Free 6.7.2 by @fontawesome — https://fontawesome.com
    // License: https://fontawesome.com/license/free  Copyright 2025 Fonticons, Inc.
    const mkFaSvg = (path, vw = '0 0 448 512') =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vw}" width="20" height="20" fill="currentColor">${path}</svg>`;

    // Helper: detect untranslated keys and apply English fallback
    const getToolbarLabel = (key, fallback) => {
      const result = translate(key);
      return result === key ? fallback : result;
    };

    const duplicateBtn = document.createElement('button');
    duplicateBtn.type = 'button';
    duplicateBtn.className = 'fc-block-toolbar-btn';
    duplicateBtn.setAttribute('aria-label', getToolbarLabel('duplicate_button_ui', 'Duplicate'));
    duplicateBtn.innerHTML = mkFaSvg(
      '<path d="M208 0L332.1 0c12.7 0 24.9 5.1 33.9 14.1l67.9 67.9c9 9 14.1 21.2 14.1 33.9L448 336c0 26.5-21.5 48-48 48l-192 0c-26.5 0-48-21.5-48-48l0-288c0-26.5 21.5-48 48-48zM48 128l80 0 0 64-64 0 0 256 192 0 0-32 64 0 0 48c0 26.5-21.5 48-48 48L48 512c-26.5 0-48-21.5-48-48L0 176c0-26.5 21.5-48 48-48z"/>'
    );

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'fc-block-toolbar-btn fc-block-toolbar-btn--delete';
    deleteBtn.setAttribute('aria-label', getToolbarLabel('delete_button_ui', 'Delete'));
    deleteBtn.innerHTML = mkFaSvg(
      '<path d="M135.2 17.7L128 32 32 32C14.3 32 0 46.3 0 64S14.3 96 32 96l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0-7.2-14.3C307.4 6.8 296.3 0 284.2 0L163.8 0c-12.1 0-23.2 6.8-28.6 17.7zM416 128L32 128 53.2 467c1.6 25.3 22.6 45 47.9 45l245.8 0c25.3 0 46.3-19.7 47.9-45L416 128z"/>'
    );

    const detachBtn = document.createElement('button');
    detachBtn.type = 'button';
    detachBtn.className = 'fc-block-toolbar-btn';
    detachBtn.setAttribute('aria-label', getToolbarLabel('shortcut_detach_block', 'Detach'));
    detachBtn.innerHTML = mkFaSvg(
      '<path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L489.3 358.2l90.5-90.5c56.5-56.5 56.5-148 0-204.5c-50-50-128.8-56.5-186.3-15.4l-1.6 1.1c-14.4 10.3-17.7 30.3-7.4 44.6s30.3 17.7 44.6 7.4l1.6-1.1c32.1-22.9 76-19.3 103.8 8.6c31.5 31.5 31.5 82.5 0 114l-96 96-31.9-25C430.9 239.6 420.1 175.1 377 132c-52.2-52.3-134.5-56.2-191.3-11.7L38.8 5.1zM239 162c30.1-14.9 67.7-9.9 92.8 15.3c20 20 27.5 48.3 21.7 74.5L239 162zM406.6 416.4L220.9 270c-2.1 39.8 12.2 80.1 42.2 110c38.9 38.9 94.4 51 143.6 36.3zm-290-228.5L60.2 244.3c-56.5 56.5-56.5 148 0 204.5c50 50 128.8 56.5 186.3 15.4l1.6-1.1c14.4-10.3 17.7-30.3 7.4-44.6s-30.3-17.7-44.6-7.4l-1.6 1.1c-32.1 22.9-76 19.3-103.8-8.6C74 372 74 321 105.5 289.5l61.8-61.8-50.6-39.9z"/>',
      '0 0 640 512'
    );

    const commentBtn = document.createElement('button');
    commentBtn.type = 'button';
    commentBtn.className = 'fc-block-toolbar-btn';
    commentBtn.setAttribute('aria-label', getToolbarLabel('add_comment', 'Add comment'));
    const commentAddSvg = mkFaSvg(
      '<path d="M256 448c141.4 0 256-93.1 256-208S397.4 32 256 32S0 125.1 0 240c0 49.6 21.4 95 57 130.7C44.5 421.1 2.7 466 2.2 466.5c-2.2 2.4-2.8 5.7-1.5 8.7S4.8 480 8 480c66.3 0 116-31.8 140.6-51.4C169.2 433.6 212.3 448 256 448z"/>',
      '0 0 512 512'
    );
    const commentDeleteSvg = mkFaSvg(
      '<path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L512.9 376.7C552.2 340.2 576 292.3 576 240C576 125.1 461.4 32 320 32c-67.7 0-129.3 21.4-175.1 56.3L38.8 5.1zm385.2 425L82.9 161.3C70.7 185.6 64 212.2 64 240c0 45.1 17.7 86.8 47.7 120.9c-1.9 24.5-11.4 46.3-21.4 62.9c-5.5 9.2-11.1 16.6-15.2 21.6c-2.1 2.5-3.7 4.4-4.9 5.7c-.6 .6-1 1.1-1.3 1.4l-.3 .3c0 0 0 0 0 0c0 0 0 0 0 0s0 0 0 0s0 0 0 0c-4.6 4.6-5.9 11.4-3.4 17.4c2.5 6 8.3 9.9 14.8 9.9c28.7 0 57.6-8.9 81.6-19.3c22.9-10 42.4-21.9 54.3-30.6c31.8 11.5 67 17.9 104.1 17.9c37 0 72.3-6.4 104.1-17.9z"/>',
      '0 0 640 512'
    );
    commentBtn.innerHTML = commentAddSvg;

    const viewEnterSvg = mkFaSvg(
      '<path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"/>',
      '0 0 576 512'
    );
    const viewExitSvg = mkFaSvg(
      '<path d="M45.6 32C20.4 32 0 52.4 0 77.6L0 434.4C0 459.6 20.4 480 45.6 480c5.1 0 10-.8 14.7-2.4C74.6 472.8 177.6 440 320 440s245.4 32.8 259.6 37.6c4.7 1.6 9.7 2.4 14.7 2.4c25.2 0 45.6-20.4 45.6-45.6l0-356.7C640 52.4 619.6 32 594.4 32c-5 0-10 .8-14.7 2.4C565.4 39.2 462.4 72 320 72S74.6 39.2 60.4 34.4C55.6 32.8 50.7 32 45.6 32zM96 160a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zm272 0c7.9 0 15.4 3.9 19.8 10.5L512.3 353c5.4 8 5.6 18.4 .4 26.5s-14.7 12.3-24.2 10.7C442.7 382.4 385.2 376 320 376c-65.6 0-123.4 6.5-169.3 14.4c-9.8 1.7-19.7-2.9-24.7-11.5s-4.3-19.4 1.9-27.2L197.3 265c4.6-5.7 11.4-9 18.7-9s14.2 3.3 18.7 9l26.4 33.1 87-127.6c4.5-6.6 11.9-10.5 19.8-10.5z"/>',
      '0 0 640 512'
    );

    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.className = 'fc-block-toolbar-btn';
    viewBtn.setAttribute('aria-label', getToolbarLabel('view_in_canvas', 'View in canvas'));
    viewBtn.innerHTML = viewEnterSvg;

    blockToolbar.append(duplicateBtn, detachBtn, commentBtn, viewBtn, deleteBtn);

    // The keyboard shortcut that each toolbar button mirrors. The overlay shows
    // these as a passive legend — the keys themselves are bound elsewhere
    // (blocklyinit.js for D/X/K/Del, gizmos.js for V) and already fire on the
    // keyboard-selected block, so the badges only need to display them. A label
    // may be a function for state-dependent buttons.
    const buttonShortcuts = [
      [duplicateBtn, 'D'],
      [detachBtn, 'X'],
      // Match the comment button's icon: '⇧K' (Shift+K, delete) when the block
      // already has a comment, 'K' (show/hide) when it doesn't.
      [commentBtn, () => (toolbarBlock?.getCommentText?.() != null ? '⇧K' : 'K')],
      [viewBtn, 'V'],
      [deleteBtn, 'Del'],
    ];

    let toolbarBlock = null; // block the toolbar is currently visible for
    let selectedBlock = null; // block currently selected (regardless of toolbar visibility)
    let toolbarShowTimer = null;
    let lastSelectionWasPointer = false;
    let dismissedBlock = null; // block whose toolbar was just dismissed via toggle; suppress re-show for it only
    let toolbarKeyboardMode = false; // toolbar was opened via keyboard → show badge overlay

    function clearBadges() {
      badgeOverlay.replaceChildren();
      badgeOverlay.classList.remove('visible');
    }

    // Place a badge centred just above each currently-visible button.
    function renderBadges() {
      badgeOverlay.replaceChildren();
      for (const [btn, labelSpec] of buttonShortcuts) {
        if (btn.style.display === 'none' || btn.offsetParent === null) continue;
        const rect = btn.getBoundingClientRect();
        const badge = document.createElement('div');
        badge.className = 'fc-toolbar-key-badge';
        badge.textContent = typeof labelSpec === 'function' ? labelSpec() : labelSpec;
        badge.style.left = `${Math.round(rect.left + rect.width / 2)}px`;
        badge.style.top = `${Math.round(rect.top - 6)}px`;
        badgeOverlay.appendChild(badge);
      }
      badgeOverlay.classList.add('visible');
    }

    document.addEventListener(
      'pointerdown',
      () => {
        lastSelectionWasPointer = true;
      },
      { capture: true }
    );

    const isDetachable = (block) =>
      !!block?.getParent() ||
      !!block?.previousConnection?.targetConnection ||
      !!block?.outputConnection?.targetConnection;

    function positionBlockToolbar() {
      if (!toolbarBlock) return;
      const svgRoot = toolbarBlock.getSvgRoot?.();
      if (!svgRoot) return;
      const rect = svgRoot.getBoundingClientRect();
      const blockCenterX = Math.round(rect.left + rect.width / 2);
      blockToolbar.style.left = `${blockCenterX}px`;
      blockToolbar.style.top = `${Math.round(rect.top)}px`;
      blockToolbar.style.removeProperty('--caret-shift');

      // Clamp to viewport; shift caret opposite so it still points at the block
      const margin = 8;
      const tbRect = blockToolbar.getBoundingClientRect();
      let adj = 0;
      if (tbRect.left < margin) adj = margin - tbRect.left;
      else if (tbRect.right > window.innerWidth - margin)
        adj = window.innerWidth - margin - tbRect.right;
      if (adj !== 0) {
        blockToolbar.style.left = `${blockCenterX + adj}px`;
        blockToolbar.style.setProperty('--caret-shift', `${-adj}px`);
      }
      // Badges are positioned off the buttons, so they must follow the toolbar.
      if (toolbarKeyboardMode) renderBadges();
    }

    // Sync the comment button's icon + label to whether the block has a comment:
    // crossed-out "delete" icon when it does, plain "add" icon when it doesn't.
    function updateCommentButton(block) {
      const hasComment = block.getCommentText() !== null;
      commentBtn.setAttribute(
        'aria-label',
        hasComment
          ? getToolbarLabel('delete_comment', 'Delete comment')
          : getToolbarLabel('add_comment', 'Add comment')
      );
      commentBtn.innerHTML = hasComment ? commentDeleteSvg : commentAddSvg;
    }

    function showBlockToolbar(block, { keyboard = false } = {}) {
      toolbarBlock = block;
      toolbarKeyboardMode = keyboard;

      // Locked blocks can't be edited: hide the mutating buttons (detach,
      // comment, delete), leaving duplicate and view-in-canvas available.
      const locked = isBlockLocked(block);
      detachBtn.style.display = !locked && isDetachable(block) ? '' : 'none';
      commentBtn.style.display = locked ? 'none' : '';
      deleteBtn.style.display = locked ? 'none' : '';
      updateCommentButton(block);
      let mesh = null;
      try {
        mesh = getMeshFromBlock(block);
      } catch {
        /* scene not ready */
      }
      viewBtn.style.display = !mesh || mesh.name === 'ground' ? 'none' : '';
      let meshRoot = mesh;
      while (meshRoot?.parent) meshRoot = meshRoot.parent;
      const exitMode = !!window.orbitViewActive && (window.orbitBlock === block || (meshRoot && window.orbitMesh === meshRoot));
      viewBtn.innerHTML = exitMode ? viewExitSvg : viewEnterSvg;
      viewBtn.setAttribute(
        'aria-label',
        exitMode
          ? getToolbarLabel('exit_canvas_view', 'Exit canvas view')
          : getToolbarLabel('view_in_canvas', 'View in canvas')
      );
      blockToolbar.classList.add('visible');
      // Clear any stale badges from a previous keyboard selection; in keyboard
      // mode positionBlockToolbar() draws fresh ones (it also re-runs on block
      // move / viewport change to keep them aligned with the buttons).
      if (!keyboard) clearBadges();
      positionBlockToolbar();
    }

    function hideBlockToolbar() {
      clearTimeout(toolbarShowTimer);
      toolbarShowTimer = null;
      toolbarBlock = null;
      toolbarKeyboardMode = false;
      blockToolbar.classList.remove('visible');
      clearBadges();
    }

    const isToolbarBlock = (block) => block && !block.isInFlyout && !block.isShadow();

    workspace.addChangeListener((e) => {
      if (e.type === Blockly.Events.SELECTED) {
        if (e.newElementId) {
          clearTimeout(toolbarShowTimer);
          toolbarShowTimer = null;
          const block = workspace.getBlockById(e.newElementId);
          // Consume the pointer flag only here, on actual selection, not on deselect.
          // Blockly may fire SELECTED(null) before SELECTED(blockId) on a click, so
          // consuming it on deselect would clear it before we can use it.
          const wasPointer = lastSelectionWasPointer;
          lastSelectionWasPointer = false;
          const wasDismissed = block === dismissedBlock;
          dismissedBlock = null;
          if (isToolbarBlock(block)) {
            selectedBlock = block;

            if (wasPointer) {
              // Pointer selection: reveal after a short hover, no badges.
              if (!wasDismissed) {
                toolbarShowTimer = setTimeout(() => showBlockToolbar(block), 400);
              } else {
                hideBlockToolbar();
              }
            } else {
              // Keyboard navigation: show immediately with the shortcut overlay.
              showBlockToolbar(block, { keyboard: true });
            }
          } else {
            selectedBlock = null;
            hideBlockToolbar();
          }
        } else {
          // SELECTED(null) fires when non-block selectables (icons, bubbles) are deselected,
          // even while the block itself remains selected. Check Blockly's actual state.
          const actualSelected = Blockly.common?.getSelected?.();
          if (actualSelected && actualSelected === selectedBlock) {
            // Block is still selected in Blockly — this null event is for something else; ignore it.
          } else {
            clearTimeout(toolbarShowTimer);
            toolbarShowTimer = null;
            selectedBlock = null;
            dismissedBlock = null;
            hideBlockToolbar();
          }
        }
      } else if (
        (e.type === Blockly.Events.BLOCK_MOVE || e.type === Blockly.Events.VIEWPORT_CHANGE) &&
        toolbarBlock
      ) {
        positionBlockToolbar();
      } else if (
        e.type === Blockly.Events.BLOCK_CHANGE &&
        e.element === 'comment' &&
        toolbarBlock &&
        e.blockId === toolbarBlock.id
      ) {
        // Comment added/removed (e.g. via Shift+K) while the toolbar is up:
        // refresh the button icon and, in keyboard mode, its badge (K ⇄ ⇧K).
        updateCommentButton(toolbarBlock);
        if (toolbarKeyboardMode) renderBadges();
      } else if (e.type === Blockly.Events.BLOCK_DRAG && e.isStart) {
        hideBlockToolbar();
      }
    });

    // Toggle toolbar on click of the selected block
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (!selectedBlock) return;
        const svgRoot = selectedBlock.getSvgRoot?.();
        if (!svgRoot || !svgRoot.contains(e.target)) return;
        if (toolbarBlock) {
          // Toolbar visible → hide it; prevent SELECTED from re-showing for this specific block.

          dismissedBlock = selectedBlock;
          hideBlockToolbar();
        } else {
          // Toolbar not visible (dismissed or hidden e.g. after returning from gizmo/canvas).
          // Blockly won't fire SELECTED again for an already-selected block, so show directly.
          dismissedBlock = null;
          showBlockToolbar(selectedBlock);
        }
      },
      { capture: true }
    );

    duplicateBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!toolbarBlock) return;
      const block = toolbarBlock;
      Blockly.Events.setGroup('toolbar_duplicate');
      const json = Blockly.serialization.blocks.save(block, { includeShadows: true });
      delete json.next;
      // A copy of a locked block must itself be unlocked. Locking serializes
      // movable/editable/deletable=false into the state, so strip those before
      // appending; otherwise the copy is created frozen.
      stripLockState(json);
      const copy = Blockly.serialization.blocks.append(json, workspace);
      const orig = block.getRelativeToSurfaceXY();
      copy.moveTo(new Blockly.utils.Coordinate(orig.x + 30, orig.y + 30));
      Blockly.Events.setGroup(false);
    });

    detachBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!toolbarBlock || !isDetachable(toolbarBlock)) return;
      const block = toolbarBlock;
      const healStack = !block.outputConnection?.isConnected();
      Blockly.Events.setGroup('toolbar_detach');
      block.unplug(healStack);
      Blockly.Events.setGroup(false);
    });

    commentBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!toolbarBlock) return;
      toggleBlockComment(toolbarBlock);
      hideBlockToolbar();
    });

    viewBtn.addEventListener('pointerdown', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!toolbarBlock || viewBtn.style.display === 'none') return;
      const block = toolbarBlock;
      hideBlockToolbar();
      const [{ showCanvasView }, { viewMeshWithCamera }] = await Promise.all([
        import('../main/view.js'),
        import('./gizmos.js'),
      ]);
      showCanvasView();
      window.currentBlock = block;
      viewMeshWithCamera(block);
      window.orbitBlock = window.orbitViewActive ? block : null;
    });

    deleteBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!toolbarBlock) return;
      const block = toolbarBlock;
      // Count only blocks that will actually be deleted: the block + its input
      // descendants, but NOT the top-level next chain (which gets healed, not deleted).
      const countDeleted = (b, followNext) => {
        if (!b || b.isShadow()) return 0;
        let n = 1;
        for (const input of b.inputList) {
          n += countDeleted(input.connection?.targetBlock(), true);
        }
        if (followNext) n += countDeleted(b.nextConnection?.targetBlock(), true);
        return n;
      };
      const count = countDeleted(block, false);
      if (count > 1) {
        const msg = (Blockly.Msg['DELETE_ALL_BLOCKS'] || 'Delete all %1 blocks?').replace(
          '%1',
          count
        );
        Blockly.dialog.confirm(msg, (ok) => {
          if (!ok) return;
          hideBlockToolbar();
          if (block.isDisposed?.()) return;
          block.checkAndDelete();
          Blockly.Toast?.show?.(workspace, {
            message: translate('DELETE_UNDO_HINT'),
            id: 'delete-undo-tip',
            oncePerSession: true,
            duration: 8,
          });
        });
      } else {
        hideBlockToolbar();
        block.checkAndDelete();
      }
    });
  }
}
