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

// Hide separators with no items between them
function collapseSeparators(options) {
  if (!Array.isArray(options)) return options;
  const out = [];
  for (const option of options) {
    if (!option?.separator) out.push(option);
    else if (out.length && !out[out.length - 1]?.separator) out.push(option);
  }
  while (out.length && out[out.length - 1]?.separator) out.pop();
  return out;
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

  // Blockly activates menu items on pointerup, and arms its opening-press guard
  // (Menu.openingCoords) only for dropdown fields — so without this, releasing
  // the right button over the just-drawn menu runs the item under the pointer.
  document.addEventListener(
    'pointerup',
    (e) => {
      if (e.button !== 0 && e.target?.closest?.('.blocklyMenu')) e.stopPropagation();
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
      const text = typeof origDisplayText === 'function' ? origDisplayText(scope) : origDisplayText;
      const hasComment = scope?.block?.getCommentText?.() != null;
      return renderShortcut(text, hasComment ? 'Shift+K' : 'K');
    };

    const origCallback = item.callback;
    item.callback = function (scope, ...rest) {
      const block = scope?.block;
      if (block && block.getCommentText?.() == null) {
        // Adding: create the comment, open its bubble and focus the editor. The
        // undoable create runs synchronously inside toggleCommentBubble (before
        // it awaits) so it lands in this group; the async bubble open/focus is
        // UI state. Preserve/restore the outer group like the other items here.
        const prevGroup = Blockly.Events.getGroup();
        Blockly.Events.setGroup('contextmenu_comment');
        toggleCommentBubble(block);
        Blockly.Events.setGroup(prevGroup || null);
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

  // Drop separators left stranded
  (function filterStrandedSeparators() {
    const proto = Blockly.BlockSvg.prototype;
    if (!proto.__flockSeparatorFilter) {
      const origGenerate = proto.generateContextMenu;
      proto.generateContextMenu = function (...args) {
        return collapseSeparators(origGenerate.apply(this, args));
      };
      proto.__flockSeparatorFilter = true;
    }

    // Workspace scope has no equivalent method; configureContextMenu is the
    // documented hook and mutates the array in place.
    const origConfigure = workspace.configureContextMenu;
    workspace.configureContextMenu = function (options, e) {
      origConfigure?.call(this, options, e);
      options.splice(0, options.length, ...collapseSeparators(options));
    };
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
  // immediately with a shortcut-letter overlay (D/X/M/K/V/Del) above each button.
  {
    const blockToolbar = document.createElement('div');
    blockToolbar.className = 'fc-block-toolbar';
    blockToolbar.setAttribute('role', 'toolbar');
    blockToolbar.setAttribute('aria-hidden', 'true');
    blockToolbar.inert = true;
    document.body.appendChild(blockToolbar);

    // Keyboard-only overlay of shortcut-letter badges, one per visible button.
    const badgeOverlay = document.createElement('div');
    badgeOverlay.className = 'fc-toolbar-badges';
    document.body.appendChild(badgeOverlay);

    // Icon paths below are Font Awesome Free 6.7.2 solid- and regular-style icons
    // (each call site names the icon it draws) by @fontawesome — https://fontawesome.com
    // License: https://fontawesome.com/license/free  Copyright 2024 Fonticons, Inc.
    const mkFaSvg = (path, vw = '0 0 448 512') =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vw}" width="20" height="20" fill="currentColor">${path}</svg>`;

    // Helper: detect untranslated keys and apply English fallback
    const getToolbarLabel = (key, fallback) => {
      const result = translate(key);
      return result === key ? fallback : result;
    };

    // Helper: set both the a11y label and the native hover tooltip together,
    // so toolbar buttons always show hover text like the rest of the app.
    const setToolbarLabel = (el, label) => {
      el.setAttribute('aria-label', label);
      el.title = label;
    };

    const duplicateBtn = document.createElement('button');
    duplicateBtn.type = 'button';
    duplicateBtn.className = 'fc-block-toolbar-btn';
    // fa-copy
    duplicateBtn.innerHTML = mkFaSvg(
      '<path d="M208 0L332.1 0c12.7 0 24.9 5.1 33.9 14.1l67.9 67.9c9 9 14.1 21.2 14.1 33.9L448 336c0 26.5-21.5 48-48 48l-192 0c-26.5 0-48-21.5-48-48l0-288c0-26.5 21.5-48 48-48zM48 128l80 0 0 64-64 0 0 256 192 0 0-32 64 0 0 48c0 26.5-21.5 48-48 48L48 512c-26.5 0-48-21.5-48-48L0 176c0-26.5 21.5-48 48-48z"/>'
    );

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'fc-block-toolbar-btn fc-block-toolbar-btn--delete';
    // fa-trash
    deleteBtn.innerHTML = mkFaSvg(
      '<path d="M135.2 17.7L128 32 32 32C14.3 32 0 46.3 0 64S14.3 96 32 96l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0-7.2-14.3C307.4 6.8 296.3 0 284.2 0L163.8 0c-12.1 0-23.2 6.8-28.6 17.7zM416 128L32 128 53.2 467c1.6 25.3 22.6 45 47.9 45l245.8 0c25.3 0 46.3-19.7 47.9-45L416 128z"/>'
    );

    const detachBtn = document.createElement('button');
    detachBtn.type = 'button';
    detachBtn.className = 'fc-block-toolbar-btn';
    // fa-share-from-square (solid)
    detachBtn.innerHTML = mkFaSvg(
      '<path d="M352 224H305.5c-45 0-81.5 36.5-81.5 81.5c0 22.3 10.3 34.3 19.2 40.5c6.8 4.7 12.8 12 12.8 20.3c0 9.8-8 17.8-17.8 17.8h-2.5c-2.4 0-4.8-.4-7.1-1.4C210.8 374.8 128 333.4 128 240c0-79.5 64.5-144 144-144h80V34.7C352 15.5 367.5 0 386.7 0c8.6 0 16.8 3.2 23.2 8.9L548.1 133.3c7.6 6.8 11.9 16.5 11.9 26.7s-4.3 19.9-11.9 26.7l-139 125.1c-5.9 5.3-13.5 8.2-21.4 8.2H384c-17.7 0-32-14.3-32-32V224zM80 96c-8.8 0-16 7.2-16 16V432c0 8.8 7.2 16 16 16H400c8.8 0 16-7.2 16-16V384c0-17.7 14.3-32 32-32s32 14.3 32 32v48c0 44.2-35.8 80-80 80H80c-44.2 0-80-35.8-80-80V112C0 67.8 35.8 32 80 32h48c17.7 0 32 14.3 32 32s-14.3 32-32 32H80z"/>',
      '0 0 576 512'
    );

    // duplicate/delete/detach labels don't change per-block, so nothing else
    // re-applies them after creation — without this, switching language after
    // the toolbar first renders would leave them stuck in the old language.
    function refreshStaticToolbarLabels() {
      // role="toolbar" needs a name of its own, not just named buttons.
      blockToolbar.setAttribute('aria-label', getToolbarLabel('block_menu', 'Block menu'));
      setToolbarLabel(duplicateBtn, getToolbarLabel('duplicate_block_button_ui', 'Duplicate block'));
      setToolbarLabel(deleteBtn, getToolbarLabel('delete_block_button_ui', 'Delete block'));
      setToolbarLabel(detachBtn, getToolbarLabel('shortcut_detach_block', 'Detach'));
    }

    // Passive "press M to move" hint. Looks like a toolbar button but is inert
    // (pointer-events: none): it exists purely so keyboard users see the move
    // icon with an M badge when they land on a loose block.
    const moveHint = document.createElement('span');
    moveHint.className = 'fc-block-toolbar-btn fc-block-toolbar-hint';
    moveHint.setAttribute('aria-hidden', 'true');
    // fa-up-down-left-right
    moveHint.innerHTML = mkFaSvg(
      '<path d="M278.6 9.4c-12.5-12.5-32.8-12.5-45.3 0l-64 64c-9.2 9.2-11.9 22.9-6.9 34.9s16.6 19.8 29.6 19.8l32 0 0 96-96 0 0-32c0-12.9-7.8-24.6-19.8-29.6s-25.7-2.2-34.9 6.9l-64 64c-12.5 12.5-12.5 32.8 0 45.3l64 64c9.2 9.2 22.9 11.9 34.9 6.9s19.8-16.6 19.8-29.6l0-32 96 0 0 96-32 0c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l64 64c12.5 12.5 32.8 12.5 45.3 0l64-64c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8l-32 0 0-96 96 0 0 32c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l64-64c12.5-12.5 12.5-32.8 0-45.3l-64-64c-9.2-9.2-22.9-11.9-34.9-6.9s-19.8 16.6-19.8 29.6l0 32-96 0 0-96 32 0c12.9 0 24.6-7.8 29.6-19.8s2.2-25.7-6.9-34.9l-64-64z"/>',
      '0 0 512 512'
    );

    const commentBtn = document.createElement('button');
    commentBtn.type = 'button';
    commentBtn.className = 'fc-block-toolbar-btn';
    setToolbarLabel(commentBtn, getToolbarLabel('add_comment', 'Add comment'));
    // fa-note-sticky (solid)
    const commentIconPath =
      '<path d="M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H288V368c0-26.5 21.5-48 48-48H448V96c0-35.3-28.7-64-64-64H64zM448 352H402.7 336c-8.8 0-16 7.2-16 16v66.7V480l32-32 64-64 32-32z"/>';
    const commentAddSvg = mkFaSvg(commentIconPath, '0 0 448 512');
    const commentDeleteSvg = mkFaSvg(
      `${commentIconPath}<path d="M246 102L346 202M346 102L246 202" fill="none" stroke="white" stroke-width="32" stroke-linecap="round"/>`,
      '0 0 448 512'
    );
    commentBtn.innerHTML = commentAddSvg;

    const enableBtn = document.createElement('button');
    enableBtn.type = 'button';
    enableBtn.className = 'fc-block-toolbar-btn';
    // fa-toggle-on
    const blockEnabledSvg = mkFaSvg(
      '<path d="M384 64c106 0 192 86 192 192s-86 192-192 192l-192 0C86 448 0 362 0 256S86 64 192 64l192 0zm0 288a96 96 0 1 0 0-192 96 96 0 1 0 0 192z"/>',
      '0 0 576 512'
    );
    // fa-toggle-off
    const blockDisabledSvg = mkFaSvg(
      '<path d="M192 64C86 64 0 150 0 256S86 448 192 448l192 0c106 0 192-86 192-192S490 64 384 64L192 64zm0 288a96 96 0 1 1 0-192 96 96 0 1 1 0 192z"/>',
      '0 0 576 512'
    );

    // fa-eye
    const viewEnterSvg = mkFaSvg(
      '<path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"/>',
      '0 0 576 512'
    );
    // fa-eye-slash
    const viewExitSvg = mkFaSvg(
      '<path d="M45.6 32C20.4 32 0 52.4 0 77.6L0 434.4C0 459.6 20.4 480 45.6 480c5.1 0 10-.8 14.7-2.4C74.6 472.8 177.6 440 320 440s245.4 32.8 259.6 37.6c4.7 1.6 9.7 2.4 14.7 2.4c25.2 0 45.6-20.4 45.6-45.6l0-356.7C640 52.4 619.6 32 594.4 32c-5 0-10 .8-14.7 2.4C565.4 39.2 462.4 72 320 72S74.6 39.2 60.4 34.4C55.6 32.8 50.7 32 45.6 32zM96 160a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zm272 0c7.9 0 15.4 3.9 19.8 10.5L512.3 353c5.4 8 5.6 18.4 .4 26.5s-14.7 12.3-24.2 10.7C442.7 382.4 385.2 376 320 376c-65.6 0-123.4 6.5-169.3 14.4c-9.8 1.7-19.7-2.9-24.7-11.5s-4.3-19.4 1.9-27.2L197.3 265c4.6-5.7 11.4-9 18.7-9s14.2 3.3 18.7 9l26.4 33.1 87-127.6c4.5-6.6 11.9-10.5 19.8-10.5z"/>',
      '0 0 640 512'
    );

    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.className = 'fc-block-toolbar-btn';
    setToolbarLabel(viewBtn, getToolbarLabel('view_in_canvas', 'View in canvas'));
    viewBtn.innerHTML = viewEnterSvg;

    blockToolbar.append(duplicateBtn, detachBtn, moveHint, commentBtn, enableBtn, viewBtn, deleteBtn);

    // The keyboard shortcut that each toolbar button mirrors. The overlay shows
    // these as a passive legend — the keys themselves are bound elsewhere
    // (blocklyinit.js for D/X/K/Del, gizmos.js for V) and already fire on the
    // keyboard-selected block, so the badges only need to display them. A label
    // may be a function for state-dependent buttons.
    const buttonShortcuts = [
      [duplicateBtn, 'D'],
      [detachBtn, 'X'],
      [moveHint, 'M'],
      // Match the comment button's icon: '⇧K' (Shift+K, delete) when the block
      // already has a comment, 'K' (show/hide) when it doesn't.
      [commentBtn, () => (toolbarBlock?.getCommentText?.() != null ? '⇧K' : 'K')],
      [enableBtn, 'L'],
      [viewBtn, 'V'],
      [deleteBtn, 'Del'],
    ];

    let toolbarBlock = null; // block the toolbar is currently visible for
    let selectedBlock = null; // block currently selected (regardless of toolbar visibility)
    let pointerIsDown = false; // a pointer button is currently held
    let pointerDownTarget = null; // element the last pointerdown landed on, to tell a click from a selection Blockly made itself
    let revealOnRelease = null; // block to open once the held button comes up, unless a drag intervenes
    let dismissedBlock = null; // block whose toolbar was just dismissed via toggle; suppress re-show for it only
    let toolbarKeyboardMode = false; // toolbar was opened via keyboard → show badge overlay
    // Block whose toolbar we hid because a keyboard move (M) just started on
    // it. Starting a move fires a deselect+reselect SELECTED pair for that
    // same block (Blockly refocusing it), which would otherwise immediately
    // reshow the toolbar we just hid; this suppresses exactly that one echo.
    let suppressReshowBlock = null;
    // Mesh availability for a block changes with attach state (code
    // re-executes on attach/detach, creating/destroying the mesh), but that
    // re-execution is debounced — it may not have landed yet at the instant
    // a BLOCK_MOVE event fires. This re-checks shortly after, so viewBtn
    // catches up once the mesh actually appears/disappears.
    let viewMeshRecheckTimer = null;
    let moveInProgress = false; // a drag/keyboard move is running — Enter belongs to Blockly

    function clearBadges() {
      badgeOverlay.replaceChildren();
      badgeOverlay.classList.remove('visible');
    }

    // Place a badge below each currently-visible button, slightly overlapping
    // it — same offset as the gizmo-menu badges.
    function renderBadges() {
      badgeOverlay.replaceChildren();
      for (const [btn, labelSpec] of buttonShortcuts) {
        if (btn.style.display === 'none' || btn.offsetParent === null) continue;
        const rect = btn.getBoundingClientRect();
        const badge = document.createElement('div');
        badge.className = 'fc-toolbar-key-badge';
        badge.textContent = typeof labelSpec === 'function' ? labelSpec() : labelSpec;
        badge.style.left = `${Math.round(rect.left + rect.width / 2)}px`;
        badge.style.top = `${Math.round(rect.top + rect.height + 8)}px`;
        badgeOverlay.appendChild(badge);
      }
      badgeOverlay.classList.add('visible');
    }

    // A selection only counts as a click when it lands on the block that was
    // pressed. One gesture can fire several SELECTED events, so the press
    // stands until the next one or a navigation key.
    document.addEventListener(
      'pointerdown',
      (e) => {
        pointerIsDown = true;
        pointerDownTarget = e.target;
      },
      { capture: true }
    );
    document.addEventListener(
      'pointerup',
      () => {
        pointerIsDown = false;
        if (revealOnRelease) {
          const block = revealOnRelease;
          revealOnRelease = null;
          // Not guarded on toolbarBlock: showing re-points an open toolbar, so
          // a click moves it between blocks without closing it first.
          if (block === selectedBlock) showBlockToolbar(block);
        }
      },
      { capture: true }
    );
    document.addEventListener(
      'pointercancel',
      () => {
        pointerIsDown = false;
        revealOnRelease = null;
      },
      { capture: true }
    );
    document.addEventListener(
      'keydown',
      (e) => {
        // Navigating by keyboard retires the last press. Ignore typing and
        // app-level combos, and bare Shift — that one so a Shift held during a
        // mouse drag doesn't retire the press that started it.
        if (isTypingInInput()) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 'Shift') return;
        pointerDownTarget = null;
      },
      { capture: true }
    );

    window.addEventListener('flock:canvas-resize-done', () => {
      if (toolbarBlock) positionBlockToolbar();
    });

    const isDetachable = (block) =>
      !!block?.getParent() ||
      !!block?.previousConnection?.targetConnection ||
      !!block?.outputConnection?.targetConnection;

    // A block's own SVG group nests any blocks connected below it (via next
    // connection), so getBoundingClientRect() on it spans the whole stack —
    // for a hat block with a long stack underneath, that puts the toolbar way
    // off to the right of the (narrow) hat itself. getBoundingRectangleWithoutChildren()
    // returns just this block's own extent, in workspace units; convert that
    // to screen pixels instead.
    function getOwnBlockScreenRect(block) {
      if (!block.getBoundingRectangleWithoutChildren) return null;
      const wsRect = block.getBoundingRectangleWithoutChildren();
      const topLeft = Blockly.utils.svgMath.wsToScreenCoordinates(
        workspace,
        new Blockly.utils.Coordinate(wsRect.left, wsRect.top)
      );
      const bottomRight = Blockly.utils.svgMath.wsToScreenCoordinates(
        workspace,
        new Blockly.utils.Coordinate(wsRect.right, wsRect.bottom)
      );
      return {
        left: topLeft.x,
        top: topLeft.y,
        right: bottomRight.x,
        bottom: bottomRight.y,
        width: bottomRight.x - topLeft.x,
        height: bottomRight.y - topLeft.y,
      };
    }

    // Play mode hides #codePanel without deselecting the block (main/view.js).
    const workspaceIsVisible = () => {
      const div = workspace.getInjectionDiv?.();
      return !!div && div.clientWidth > 0 && div.clientHeight > 0;
    };

    function getToolboxRightEdge() {
      let right = -Infinity;
      const sel = '.blocklyToolboxDiv, .blocklyToolbox, .blocklyFlyout';
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) right = Math.max(right, r.right);
      }
      return right === -Infinity ? null : right;
    }

    function getWorkspaceTopEdge() {
      const div = workspace.getInjectionDiv?.();
      if (!div) return null;
      const r = div.getBoundingClientRect();
      return r.height > 0 ? r.top : null;
    }

    // The workspace toolbar draws over the zoom controls, so they bound the
    // usable area too.
    function getWorkspaceBottomEdge() {
      const div = workspace.getInjectionDiv?.();
      if (!div) return null;
      const r = div.getBoundingClientRect();
      if (r.height <= 0) return null;
      const controls = document.getElementById('blocklyZoomControls')?.getBoundingClientRect();
      return controls?.height > 0 ? Math.min(r.bottom, controls.top) : r.bottom;
    }

    // Where the block's own first row ends: the jaw start for a block with a
    // statement input, otherwise null.
    function getFirstStatementTopScreenY(block) {
      const jawInput = block.inputList?.find((input) => input.type === Blockly.NEXT_STATEMENT);
      const connection = jawInput?.connection;
      if (!connection) return null;
      const screen = Blockly.utils.svgMath.wsToScreenCoordinates(
        workspace,
        new Blockly.utils.Coordinate(connection.x, connection.y)
      );
      return screen.y;
    }

    // Nudges the workspace down so a block near the top edge has room for the
    // toolbar above it. Returns the pixels actually gained — Blockly clamps to
    // the scrollable area, so this can be less than asked for, or nothing.
    function scrollWorkspaceForToolbar(px) {
      if (typeof workspace.scroll !== 'function' || pointerIsDown) return 0;
      const before = workspace.scrollY;
      try {
        workspace.scroll(workspace.scrollX, before + px);
      } catch {
        return 0; // workspace has no metrics yet, so it cannot be scrolled
      }
      return workspace.scrollY - before;
    }

    function positionBlockToolbar({ mayScroll = false } = {}) {
      if (!toolbarBlock) return;
      const svgRoot = toolbarBlock.getSvgRoot?.();
      if (!svgRoot) return;
      if (!workspaceIsVisible()) {
        hideBlockToolbar();
        return;
      }
      const readRect = () => getOwnBlockScreenRect(toolbarBlock) ?? svgRoot.getBoundingClientRect();
      let rect = readRect();

      const margin = 8;
      const workspaceTop = getWorkspaceTopEdge();
      const minTop = workspaceTop != null ? workspaceTop + margin : margin;
      const maxBottom = (getWorkspaceBottomEdge() ?? window.innerHeight) - margin;
      const maxRight = window.innerWidth - margin;
      const toolboxRight = getToolboxRightEdge();

      // Each placement is a CSS class (which side of the anchor point the bar
      // hangs off) plus the anchor point itself.
      const anchor = (mode, x, y) => {
        blockToolbar.classList.remove('below', 'beside-left', 'beside-right');
        if (mode) blockToolbar.classList.add(mode);
        blockToolbar.style.left = `${Math.round(x)}px`;
        blockToolbar.style.top = `${Math.round(y)}px`;
        return blockToolbar.getBoundingClientRect();
      };

      // Slides the caret the opposite way to a clamp, so it keeps pointing at
      // the block. Past this limit it would fall off the end of the bar.
      const shiftCaret = (px, extent) => {
        const limit = Math.max(0, extent / 2 - 12);
        blockToolbar.style.setProperty(
          '--caret-shift',
          `${Math.max(-limit, Math.min(limit, -px))}px`
        );
      };

      blockToolbar.style.removeProperty('--caret-shift');

      // Preferred placement: centred above the block.
      let bar = anchor(null, rect.left + rect.width / 2, rect.top);
      let overshoot = minTop - bar.top;

      // No room above: scroll the block down to make some, so the bar keeps its
      // usual place. Only on show — a reposition must not fight the user's own
      // scrolling, and falls through to the placements below instead.
      if (overshoot > 0 && mayScroll && scrollWorkspaceForToolbar(overshoot) > 0) {
        rect = readRect();
        bar = anchor(null, rect.left + rect.width / 2, rect.top);
        overshoot = minTop - bar.top;
      }

      // Could not scroll — mid-gesture, or the workspace would not go far
      // enough. Sit beside the block's first row rather than over the blocks
      // inside it.
      let besideY = 0;
      let beside = false;
      if (overshoot > 0) {
        besideY = (rect.top + (getFirstStatementTopScreenY(toolbarBlock) ?? rect.bottom)) / 2;
        const minLeft = toolboxRight != null ? Math.max(margin, toolboxRight + margin) : margin;
        bar = anchor('beside-right', rect.right, besideY);
        if (bar.right > maxRight) bar = anchor('beside-left', rect.left, besideY);
        beside = bar.left >= minLeft && bar.right <= maxRight;
      }

      if (beside) {
        // Keep it inside the workspace vertically; the caret follows the row.
        let adj = 0;
        if (bar.top < minTop) adj = minTop - bar.top;
        else if (bar.bottom > maxBottom) adj = Math.max(maxBottom - bar.bottom, minTop - bar.top);
        if (adj !== 0) {
          blockToolbar.style.top = `${Math.round(besideY + adj)}px`;
          shiftCaret(adj, bar.height);
        }
        if (toolbarKeyboardMode) renderBadges();
        return;
      }

      // Nowhere else to go: flip under the block. A hat block's own rect wraps
      // everything in its jaw, so use the jaw start rather than its far bottom.
      const blockCenterX = Math.round(rect.left + rect.width / 2);
      if (overshoot > 0) {
        const jawTop = toolbarBlock.previousConnection
          ? null
          : getFirstStatementTopScreenY(toolbarBlock);
        const belowY = jawTop ?? rect.bottom;
        // rect.bottom is past everything a C-shaped block holds, which can be
        // below the workspace, so pull it back inside.
        anchor('below', blockCenterX, belowY);
        const drop = blockToolbar.getBoundingClientRect().bottom - maxBottom;
        if (drop > 0) anchor('below', blockCenterX, belowY - drop);
      }

      // Clamp to viewport, and to the right of the toolbox/flyout so the
      // toolbar is never tucked behind it. Shift the caret opposite so it
      // still points at the block.
      const tbRect = blockToolbar.getBoundingClientRect();
      // On narrow phones the toolbar can be wider than the space left beside
      // the toolbox: spill over the toolbox rather than off the screen edge.
      const fitsBesideToolbox =
        toolboxRight == null || tbRect.width <= window.innerWidth - toolboxRight - 2 * margin;
      const minLeft =
        toolboxRight != null && fitsBesideToolbox
          ? Math.max(margin, toolboxRight + margin)
          : margin;
      let adj = 0;
      if (tbRect.left < minLeft) adj = minLeft - tbRect.left;
      else if (tbRect.right > maxRight)
        adj = Math.max(maxRight - tbRect.right, minLeft - tbRect.left);
      if (adj !== 0) {
        blockToolbar.style.left = `${blockCenterX + adj}px`;
        shiftCaret(adj, tbRect.width);
      }
      // Badges are positioned off the buttons, so they must follow the toolbar.
      if (toolbarKeyboardMode) renderBadges();
    }

    // Deal with blocks that COULD attach to something but currently free
    const isLooseAndMovable = (block) =>
      !!block &&
      !isBlockLocked(block) &&
      !isDetachable(block) &&
      !!block.isMovable?.() &&
      (!!block.previousConnection || !!block.outputConnection);

    function scheduleViewMeshRecheck() {
      clearTimeout(viewMeshRecheckTimer);
      const recheckBlock = toolbarBlock;
      viewMeshRecheckTimer = setTimeout(() => {
        viewMeshRecheckTimer = null;
        if (toolbarBlock !== recheckBlock) return;
        updateSimplifiedToolbar();
        if (toolbarKeyboardMode) renderBadges();
      }, 400);
    }

    function updateSimplifiedToolbar() {
      const block = toolbarBlock;
      if (!block) return;
      const simplified = isLooseAndMovable(block);
      const locked = isBlockLocked(block);
      duplicateBtn.style.display = '';
      commentBtn.style.display = locked ? 'none' : '';
      detachBtn.style.display = locked || !isDetachable(block) ? 'none' : '';
      enableBtn.style.display = locked || simplified ? 'none' : '';
      moveHint.style.display = toolbarKeyboardMode && simplified ? '' : 'none';
      // Loose blocks never show View, regardless of mesh state — no point
      // waiting on a mesh check for a block that isn't placed anywhere yet.
      if (simplified) {
        viewBtn.style.display = 'none';
        return;
      }
      let mesh = null;
      try {
        mesh = getMeshFromBlock(block);
      } catch {
        /* scene not ready */
      }
      viewBtn.style.display = !mesh || mesh.name === 'ground' ? 'none' : '';
    }

    // Sync the comment button's icon + label to whether the block has a comment:
    // crossed-out "delete" icon when it does, plain "add" icon when it doesn't.
    function updateCommentButton(block) {
      const hasComment = block.getCommentText() !== null;
      setToolbarLabel(
        commentBtn,
        hasComment
          ? getToolbarLabel('delete_comment', 'Delete comment')
          : getToolbarLabel('add_comment', 'Add comment')
      );
      commentBtn.innerHTML = hasComment ? commentDeleteSvg : commentAddSvg;
    }

    function updateEnableButton(block) {
      const disabled = block.hasDisabledReason('MANUALLY_DISABLED');
      setToolbarLabel(
        enableBtn,
        disabled ? getToolbarLabel('context_enable_option', 'Enable') : getToolbarLabel('context_disable_option', 'Disable')
      );
      enableBtn.innerHTML = disabled ? blockDisabledSvg : blockEnabledSvg;
    }

    function showBlockToolbar(block, { keyboard = false } = {}) {
      toolbarBlock = block;
      toolbarKeyboardMode = keyboard;

      // Locked blocks can't be edited: hide the mutating buttons (detach,
      // comment, enable/disable, delete), leaving duplicate and view-in-canvas available.
      const locked = isBlockLocked(block);
      deleteBtn.style.display = locked ? 'none' : '';
      refreshStaticToolbarLabels();
      updateSimplifiedToolbar();
      updateCommentButton(block);
      updateEnableButton(block);
      let mesh = null;
      try {
        mesh = getMeshFromBlock(block);
      } catch {
        /* scene not ready */
      }
      let meshRoot = mesh;
      while (meshRoot?.parent) meshRoot = meshRoot.parent;
      const exitMode =
        !!window.orbitViewActive &&
        (window.orbitBlock === block || (meshRoot && window.orbitMesh === meshRoot));
      viewBtn.innerHTML = exitMode ? viewExitSvg : viewEnterSvg;
      setToolbarLabel(
        viewBtn,
        exitMode
          ? getToolbarLabel('exit_canvas_view', 'Stop orbiting object')
          : getToolbarLabel('view_in_canvas', 'View in canvas')
      );
      blockToolbar.classList.add('visible');
      blockToolbar.removeAttribute('aria-hidden');
      blockToolbar.inert = false;
      // Clear any stale badges from a previous keyboard selection; in keyboard
      // mode positionBlockToolbar() draws fresh ones (it also re-runs on block
      // move / viewport change to keep them aligned with the buttons).
      if (!keyboard) clearBadges();
      positionBlockToolbar({ mayScroll: true });
    }

    function hideBlockToolbar() {
      revealOnRelease = null;
      clearTimeout(viewMeshRecheckTimer);
      viewMeshRecheckTimer = null;
      toolbarBlock = null;
      toolbarKeyboardMode = false;
      blockToolbar.classList.remove('visible');
      blockToolbar.setAttribute('aria-hidden', 'true');
      blockToolbar.inert = true;
      clearBadges();
    }

    window.flockBlockToolbar = { hide: hideBlockToolbar };

    const isToolbarBlock = (block) => block && !block.isInFlyout && !block.isShadow();

    workspace.addChangeListener((e) => {
      if (e.type === Blockly.Events.SELECTED) {
        if (e.newElementId) {
          const block = workspace.getBlockById(e.newElementId);
          const wasDismissed = block === dismissedBlock;
          dismissedBlock = null;
          const wasSuppressed = block === suppressReshowBlock;
          suppressReshowBlock = null;
          if (isToolbarBlock(block)) {
            selectedBlock = block;

            // Only a click opens the toolbar; every other way a block gets
            // selected takes an open one away. Blockly selects on the press, so
            // wait for the release — a drag in between cancels via hide.
            if (!wasDismissed && !wasSuppressed && isOnBlockItself(block, pointerDownTarget)) {
              if (pointerIsDown) revealOnRelease = block;
              else showBlockToolbar(block);
            } else {
              hideBlockToolbar();
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
            selectedBlock = null;
            dismissedBlock = null;
            hideBlockToolbar();
          }
        }
      } else if (
        (e.type === Blockly.Events.BLOCK_MOVE || e.type === Blockly.Events.VIEWPORT_CHANGE) &&
        toolbarBlock
      ) {
        // A move can attach/detach the block (e.g. X detaches it while the
        // toolbar is up), so refresh the simplified-toolbar state before
        // re-rendering badges.
        if (e.type === Blockly.Events.BLOCK_MOVE) {
          updateSimplifiedToolbar();
          scheduleViewMeshRecheck();
        }
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
      } else if (
        e.type === Blockly.Events.BLOCK_CHANGE &&
        e.element === 'disabled' &&
        toolbarBlock &&
        e.blockId === toolbarBlock.id
      ) {
        updateEnableButton(toolbarBlock);
        updateSimplifiedToolbar();
        scheduleViewMeshRecheck();
      } else if (e.type === Blockly.Events.BLOCK_DRAG) {
        moveInProgress = !!e.isStart;
        if (e.isStart) {
          // Dragging is not a request for the toolbar, so flag the block for
          // the SELECTED handler above: the reselect that follows must not
          // undo this hide. Covers toolbox drags and keyboard moves (M) alike.
          suppressReshowBlock = workspace.getBlockById(e.blockId) ?? toolbarBlock;
          hideBlockToolbar();
        }
      }
    });

    // Is this element the block's own body? A block's SVG group nests
    // everything it holds, so `contains` alone can't tell it from a block
    // within it. Sockets and clickable fields belong to the input being aimed
    // at; plain labels and icons are part of the block.
    const isOnBlockItself = (block, el) => {
      const svgRoot = block?.getSvgRoot?.();
      if (!svgRoot || !el || !svgRoot.contains(el)) return false;
      if (block.getChildren(false).some((child) => child.getSvgRoot()?.contains(el))) return false;
      return !block.inputList?.some((input) =>
        input.fieldRow?.some((field) => field.isClickable?.() && field.getSvgRoot?.()?.contains(el))
      );
    };

    // Blockly won't fire SELECTED again for an already-selected block, so the
    // click and key paths show/hide directly. Hiding marks the block dismissed
    // so a following SELECTED doesn't re-show it.
    function toggleToolbarForSelected({ keyboard = false } = {}) {
      if (!selectedBlock) return;
      if (toolbarBlock) {
        dismissedBlock = selectedBlock;
        hideBlockToolbar();
      } else {
        dismissedBlock = null;
        showBlockToolbar(selectedBlock, { keyboard });
      }
    }

    // Toggle toolbar on click of the selected block
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (e.button !== 0) return;
        if (!isOnBlockItself(selectedBlock, e.target)) return;
        toggleToolbarForSelected();
      },
      { capture: true }
    );

    // Enter toggles the toolbar for the focused block, with H as an alias. The
    // containment check guards against `selectedBlock` being stale while focus
    // has moved elsewhere (e.g. the toolbox).
    document.addEventListener(
      'keydown',
      (e) => {
        const key = e.key.toLowerCase();
        if (key !== 'enter' && key !== 'h') return;
        if (isTypingInInput()) return;
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
        // Enter also confirms a move (M) and opens a field's editor, so take
        // it only when the block itself is focused and no move is running.
        if (key === 'enter') {
          if (moveInProgress) return;
          if (!document.activeElement?.classList?.contains('blocklyPath')) return;
        }
        if (!isOnBlockItself(selectedBlock, document.activeElement)) return;
        e.preventDefault();
        e.stopPropagation();
        toggleToolbarForSelected({ keyboard: true });
      },
      { capture: true }
    );

    // pointerdown fires for non-primary buttons too: without this, a right-click
    // landing on the toolbar runs the button's action instead of opening the menu.
    function onToolbarButtonPress(btn, handler) {
      btn.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        handler();
      });
    }

    onToolbarButtonPress(duplicateBtn, () => {
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

    onToolbarButtonPress(detachBtn, () => {
      if (!toolbarBlock || !isDetachable(toolbarBlock)) return;
      const block = toolbarBlock;
      const healStack = !block.outputConnection?.isConnected();
      Blockly.Events.setGroup('toolbar_detach');
      block.unplug(healStack);
      Blockly.Events.setGroup(false);
    });

    onToolbarButtonPress(commentBtn, () => {
      if (!toolbarBlock) return;
      toggleBlockComment(toolbarBlock);
      hideBlockToolbar();
    });

    onToolbarButtonPress(enableBtn, () => {
      if (!toolbarBlock) return;
      const block = toolbarBlock;
      Blockly.Events.setGroup('toolbar_disable');
      block.setDisabledReason(!block.hasDisabledReason('MANUALLY_DISABLED'), 'MANUALLY_DISABLED');
      Blockly.Events.setGroup(false);
      updateEnableButton(block);
      if (toolbarKeyboardMode) renderBadges();
    });

    onToolbarButtonPress(viewBtn, async () => {
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

    onToolbarButtonPress(deleteBtn, () => {
      if (!toolbarBlock) return;
      const block = toolbarBlock;
      hideBlockToolbar();
      block.checkAndDelete();
      Blockly.Toast?.show?.(workspace, {
        message: translate('DELETE_UNDO_HINT'),
        id: 'delete-undo-tip',
        oncePerSession: true,
        duration: 8,
      });
    });
  }
}
