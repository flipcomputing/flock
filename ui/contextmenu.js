import * as Blockly from 'blockly';
import { translate } from '../main/translation.js';
import { getMeshFromBlock } from './blockmesh.js';

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

    function renderShortcut(label, shortcut) {
      const wrapper = document.createElement('span');
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.justifyContent = 'space-between';
      wrapper.style.gap = '1.5em';
      wrapper.style.width = '100%';

      const labelEl = document.createElement('span');
      labelEl.textContent = label;

      const shortcutEl = document.createElement('span');
      shortcutEl.textContent = shortcut;
      shortcutEl.style.color = 'var(--blockly-text-disabled, #aaa)';

      wrapper.append(labelEl, shortcutEl);
      return wrapper;
    }

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
      blockDelete: 20,
      blockHelp: 999,
    };
    for (const [id, weight] of Object.entries(weights)) {
      const item = registry.getItem?.(id);
      if (item) item.weight = weight;
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
      } catch (_) {}
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
      preconditionFn: notInFlyout,
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
        return hasCopiedData() ? 'enabled' : 'disabled';
      },
      callback: (scope) => {
        const data = Blockly.clipboard?.getLastCopiedData?.();
        if (!data) return;
        const ws = scope?.block?.workspace ?? workspace;
        if (!ws) return;
        const selected = Blockly.common?.getSelected?.() || null;
        if (selected && selected.isInFlyout) return;
        pasteAsChildOrHere(selected || null, ws, data);
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

      e.preventDefault();
      e.stopPropagation();
      pasteAsChildOrHere(selected || null, workspace, data);
    },
    { capture: true }
  );
}
