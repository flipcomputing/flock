import { expect } from 'chai';
import * as Blockly from 'blockly';
import { initContextMenus } from '../ui/contextmenu.js';
import { setBlockLocked, isBlockLocked } from '../ui/blocklyutil.js';
import {
  insertBlockSnapshot,
  captureStackAnchor,
  reattachBlockToAnchor,
  chainBlockAfter,
} from '../ui/blocklyutil.js';
import { defineControlBlocks } from '../blocks/control.js';
import { translate } from '../main/translation.js';

export function runContextMenuTests(_flock) {
  describe('ui/contextmenu @contextmenu', function () {
    this.timeout(10000);

    let workspace;
    let container;
    let createdBlocks;
    let previousMainWorkspace;
    let blockToolbar;

    before(function () {
      // The full app registers block types during its Blockly-init sequence,
      // which this lightweight test harness doesn't run — register the one
      // block type these tests need directly.
      defineControlBlocks();
      // Blockly.inject() installs its result as the global main workspace;
      // save whatever it was so after() can put it back rather than leaving
      // a disposed workspace as "main" for suites that run later in the same
      // browser session.
      previousMainWorkspace = Blockly.getMainWorkspace?.();
      container = document.createElement('div');
      container.style.width = '300px';
      container.style.height = '200px';
      document.body.appendChild(container);
      workspace = Blockly.inject(container, { collapse: true });
      initContextMenus(workspace);
      // initContextMenus appends its toolbar to <body>; ours is the newest.
      blockToolbar = [...document.querySelectorAll('.fc-block-toolbar')].pop();
    });

    after(function () {
      workspace?.dispose();
      container?.remove();
      // setMainWorkspace(null) itself throws (it dereferences the workspace
      // it's given), so only restore when there was a real prior workspace —
      // otherwise leave things as Blockly's own inject/dispose left them,
      // matching pre-existing behaviour for that case.
      if (previousMainWorkspace) {
        Blockly.common?.setMainWorkspace?.(previousMainWorkspace);
      }
    });

    beforeEach(function () {
      createdBlocks = [];
    });

    afterEach(function () {
      createdBlocks.forEach((b) => {
        if (!b.disposed) b.dispose();
      });
      createdBlocks = [];
    });

    function makeBlock(type = 'wait') {
      const block = workspace.newBlock(type);
      block.initSvg();
      block.render();
      createdBlocks.push(block);
      return block;
    }

    function getItem(id) {
      return Blockly.ContextMenuRegistry.registry.getItem(id);
    }

    describe('detachBlockWithShortcut', function () {
      it('is hidden for a block in a flyout', function () {
        const block = makeBlock();
        block.isInFlyout = true;
        expect(getItem('detachBlockWithShortcut').preconditionFn({ block })).to.equal('hidden');
      });

      it('is disabled for a top-level block with no parent', function () {
        const block = makeBlock();
        expect(getItem('detachBlockWithShortcut').preconditionFn({ block })).to.equal('disabled');
      });

      it('is enabled once the block is connected below a parent', function () {
        const parent = makeBlock();
        const child = makeBlock();
        parent.nextConnection.connect(child.previousConnection);
        expect(getItem('detachBlockWithShortcut').preconditionFn({ block: child })).to.equal(
          'enabled'
        );
      });

      it('callback unplugs the block from its parent', function () {
        const parent = makeBlock();
        const child = makeBlock();
        parent.nextConnection.connect(child.previousConnection);
        getItem('detachBlockWithShortcut').callback({ block: child });
        expect(child.previousConnection.isConnected()).to.equal(false);
      });
    });

    describe('viewBlockInCanvas', function () {
      it('is hidden for a block with no associated mesh', function () {
        const block = makeBlock();
        expect(getItem('viewBlockInCanvas').preconditionFn({ block })).to.equal('hidden');
      });

      it('is hidden for a block in a flyout', function () {
        const block = makeBlock();
        block.isInFlyout = true;
        expect(getItem('viewBlockInCanvas').preconditionFn({ block })).to.equal('hidden');
      });
    });

    describe('blockLock', function () {
      it('stays enabled for a plain, unlocked block', function () {
        const block = makeBlock();
        expect(getItem('blockLock').preconditionFn({ block })).to.equal('enabled');
      });

      it('stays enabled even when the block is already locked (so it can be unlocked)', function () {
        const block = makeBlock();
        setBlockLocked(block, true);
        expect(getItem('blockLock').preconditionFn({ block })).to.equal('enabled');
      });

      it('callback toggles the locked state on and back off', function () {
        const block = makeBlock();
        expect(isBlockLocked(block)).to.equal(false);
        getItem('blockLock').callback({ block });
        expect(isBlockLocked(block)).to.equal(true);
        getItem('blockLock').callback({ block });
        expect(isBlockLocked(block)).to.equal(false);
      });

      it('displayText differs between the locked and unlocked states', function () {
        const block = makeBlock();
        const unlockedText = getItem('blockLock').displayText({ block });
        setBlockLocked(block, true);
        const lockedText = getItem('blockLock').displayText({ block });
        expect(unlockedText).to.not.equal(lockedText);
      });
    });

    describe('disableMutatingItemsWhenLocked', function () {
      it('disables blockInline and blockDisable once the block is locked', function () {
        const block = makeBlock();
        setBlockLocked(block, true);
        for (const id of ['blockInline', 'blockDisable']) {
          const item = getItem(id);
          expect(item, `expected ${id} to be registered`).to.exist;
          expect(item.preconditionFn({ block })).to.equal('disabled');
        }
      });

      it('disables detachBlockWithShortcut even when otherwise connected', function () {
        const parent = makeBlock();
        const child = makeBlock();
        parent.nextConnection.connect(child.previousConnection);
        setBlockLocked(child, true);
        expect(getItem('detachBlockWithShortcut').preconditionFn({ block: child })).to.equal(
          'disabled'
        );
      });

      it("leaves the item's normal behaviour intact when unlocked", function () {
        const block = makeBlock();
        expect(getItem('blockInline').preconditionFn({ block })).to.not.equal('disabled');
      });
    });

    describe('flockCollapseExpandWorkspace', function () {
      it('is hidden when the workspace has no top-level blocks', function () {
        expect(workspace.getTopBlocks(false)).to.have.lengthOf(0);
        expect(getItem('flockCollapseExpandWorkspace').preconditionFn({ workspace })).to.equal(
          'hidden'
        );
      });

      it('is enabled once a top-level block exists', function () {
        makeBlock();
        expect(getItem('flockCollapseExpandWorkspace').preconditionFn({ workspace })).to.equal(
          'enabled'
        );
      });

      it('callback collapses all top blocks, then expands them again on a second call', function () {
        const block = makeBlock();
        const item = getItem('flockCollapseExpandWorkspace');
        item.callback({ workspace });
        expect(block.isCollapsed()).to.equal(true);
        item.callback({ workspace });
        expect(block.isCollapsed()).to.equal(false);
      });
    });

    describe('workspaceDelete rename', function () {
      it('relabels the built-in delete-all item to the translated flock label', function () {
        const item = getItem('workspaceDelete');
        expect(item).to.exist;
        const text = item.displayText({ workspace });
        expect(text).to.equal(translate('context_delete_all_blocks_option'));
      });
    });

    describe('cleanWorkspace removal', function () {
      it('removes the built-in clean-up item from the workspace menu', function () {
        expect(getItem('cleanWorkspace')).to.not.exist;
      });
    });

    describe('workspaceFindInWorkspace', function () {
      it('is always enabled', function () {
        expect(getItem('workspaceFindInWorkspace').preconditionFn({})).to.equal('enabled');
      });

      it('callback opens window.flockWorkspaceSearch', function () {
        let opened = false;
        const saved = window.flockWorkspaceSearch;
        window.flockWorkspaceSearch = { open: () => (opened = true) };
        try {
          getItem('workspaceFindInWorkspace').callback({});
          expect(opened).to.equal(true);
        } finally {
          window.flockWorkspaceSearch = saved;
        }
      });
    });

    describe('clipboard: cut / copy / paste', function () {
      it('blockCopy is hidden in a flyout and enabled otherwise', function () {
        const block = makeBlock();
        expect(getItem('blockCopy').preconditionFn({ block })).to.equal('enabled');
        block.isInFlyout = true;
        expect(getItem('blockCopy').preconditionFn({ block })).to.equal('hidden');
      });

      it('blockCut is disabled on a locked block', function () {
        const block = makeBlock();
        setBlockLocked(block, true);
        expect(getItem('blockCut').preconditionFn({ block })).to.equal('disabled');
      });

      it('blockCut disposes the block after copying it', function () {
        const block = makeBlock();
        getItem('blockCut').callback({ block });
        expect(block.disposed).to.equal(true);
        createdBlocks = createdBlocks.filter((b) => b !== block);
      });

      it('blockPaste is disabled with no copied data', function () {
        const saved = Blockly.clipboard.getLastCopiedData();
        Blockly.clipboard.setLastCopiedData(null);
        try {
          const block = makeBlock();
          expect(getItem('blockPaste').preconditionFn({ block })).to.equal('disabled');
        } finally {
          Blockly.clipboard.setLastCopiedData(saved);
        }
      });

      it('blockPaste becomes enabled after a copy, and pastes a new block stacked after the target', function () {
        const source = makeBlock();
        getItem('blockCopy').callback({ block: source });
        expect(getItem('blockPaste').preconditionFn({ block: source })).to.equal('enabled');

        const target = makeBlock();
        const before = workspace.getAllBlocks(false).length;
        getItem('blockPaste').callback({ block: target });
        const after = workspace.getAllBlocks(false).length;
        expect(after).to.equal(before + 1);

        // The pasted block should be freshly created (not one of ours to dispose
        // manually) — sweep it up via the workspace so afterEach doesn't miss it.
        for (const b of workspace.getAllBlocks(false)) {
          if (!createdBlocks.includes(b)) createdBlocks.push(b);
        }

        // It should have landed connected below the target, not floating loose.
        expect(target.nextConnection.isConnected()).to.equal(true);
      });
    });

    describe('canvas clipboard stack anchor', function () {
      const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

      function chain(count = 3) {
        const blocks = [];
        for (let i = 0; i < count; i++) blocks.push(makeBlock());
        for (let i = 0; i + 1 < count; i++) {
          blocks[i].nextConnection.connect(blocks[i + 1].previousConnection);
        }
        return blocks;
      }

      function snapshotOf(block) {
        const snapshot = Blockly.serialization.blocks.save(block, { includeShadows: true });
        if (snapshot.next) delete snapshot.next;
        return snapshot;
      }

      it('captureStackAnchor records the parent and next block', function () {
        const [a, b, c] = chain();
        const anchor = captureStackAnchor(b);
        expect(anchor.parentId).to.equal(a.id);
        expect(anchor.inputName).to.equal(null);
        expect(anchor.nextId).to.equal(c.id);
      });

      it('cut-style paste reinserts the block into its stack position', async function () {
        const [a, b, c] = chain();
        const snapshot = snapshotOf(b);
        const anchor = captureStackAnchor(b);
        b.dispose(true);
        createdBlocks = createdBlocks.filter((x) => x !== b);
        expect(a.getNextBlock()).to.equal(c);

        const pasted = insertBlockSnapshot(snapshot, workspace, { x: 0, y: 0, z: 0 }, null);
        createdBlocks.push(pasted);
        expect(reattachBlockToAnchor(workspace, pasted, anchor)).to.equal(true);
        expect(a.getNextBlock()).to.equal(pasted);
        expect(pasted.getNextBlock()).to.equal(c);
        await flush();
      });

      it('reattach leaves the block detached when the parent is gone', async function () {
        const [a, b] = chain(2);
        const snapshot = snapshotOf(b);
        const anchor = captureStackAnchor(b);
        b.dispose(true);
        createdBlocks = createdBlocks.filter((x) => x !== b);
        a.dispose();
        createdBlocks = createdBlocks.filter((x) => x !== a);

        const pasted = insertBlockSnapshot(snapshot, workspace, { x: 0, y: 0, z: 0 }, null);
        createdBlocks.push(pasted);
        expect(reattachBlockToAnchor(workspace, pasted, anchor)).to.equal(false);
        expect(pasted.getParent()).to.equal(null);
        await flush();
      });

      it('chainBlockAfter inserts between a target and its next block', async function () {
        const [a, c] = chain(2);
        const loose = makeBlock();
        expect(chainBlockAfter(workspace, a, loose)).to.equal(true);
        expect(a.getNextBlock()).to.equal(loose);
        expect(loose.getNextBlock()).to.equal(c);
        await flush();
      });

      it('cut lone block then paste chains after the selected block', async function () {
        const lone = makeBlock();
        const snapshot = snapshotOf(lone);
        const anchor = captureStackAnchor(lone);
        expect(anchor).to.equal(null);
        lone.dispose();
        createdBlocks = createdBlocks.filter((x) => x !== lone);

        const target = makeBlock();
        const pasted = insertBlockSnapshot(snapshot, workspace, { x: 0, y: 0, z: 0 }, null);
        createdBlocks.push(pasted);
        expect(reattachBlockToAnchor(workspace, pasted, anchor)).to.equal(false);
        expect(chainBlockAfter(workspace, target, pasted)).to.equal(true);
        expect(target.getNextBlock()).to.equal(pasted);
        await flush();
      });
    });

    describe('floating block toolbar', function () {
      // Blockly fires its change events asynchronously.
      const flush = () => new Promise((resolve) => setTimeout(resolve, 50));
      // Long enough for a click's reveal-on-release to have run if it was going to.
      const settle = () => new Promise((resolve) => setTimeout(resolve, 200));

      it('does not open when a block is merely selected', async function () {
        const block = makeBlock();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        block.select();
        await flush();
        expect(blockToolbar.classList.contains('visible')).to.equal(false);
      });

      it('stays shut for a selection the pointer never landed on', async function () {
        // Blockly selects on its own too — moving focus to a neighbour after a
        // delete, say — and that is not a request for the toolbar.
        const block = makeBlock();
        document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        block.select();
        await settle();
        expect(blockToolbar.classList.contains('visible')).to.equal(false);
      });

      it('opens via a click on the block itself', async function () {
        const block = makeBlock();
        try {
          block
            .getSvgRoot()
            .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
          block.select();
          await flush();
          document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
          expect(blockToolbar.classList.contains('visible')).to.equal(true);
        } finally {
          window.flockBlockToolbar?.hide();
        }
      });

      it('hides when a toolbox category opens on narrow screens', async function () {
        const block = makeBlock();
        const origMatchMedia = window.matchMedia;
        const origGetToolbox = workspace.getToolbox;
        try {
          block
            .getSvgRoot()
            .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
          block.select();
          await flush();
          document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
          expect(blockToolbar.classList.contains('visible')).to.equal(true);

          window.matchMedia = () => ({ matches: true });
          workspace.getToolbox = () => ({ getFlyout: () => ({ isVisible: () => true }) });
          workspace.fireChangeListener({
            type: Blockly.Events.TOOLBOX_ITEM_SELECT,
            newItem: 'Logic',
          });
          expect(blockToolbar.classList.contains('visible')).to.equal(false);
        } finally {
          window.matchMedia = origMatchMedia;
          workspace.getToolbox = origGetToolbox;
          window.flockBlockToolbar?.hide();
        }
      });

      it('stays open on toolbox selection when the flyout is shut', async function () {
        const block = makeBlock();
        const origGetToolbox = workspace.getToolbox;
        try {
          block
            .getSvgRoot()
            .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
          block.select();
          await flush();
          document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
          expect(blockToolbar.classList.contains('visible')).to.equal(true);

          workspace.getToolbox = () => ({ getFlyout: () => ({ isVisible: () => false }) });
          workspace.fireChangeListener({
            type: Blockly.Events.TOOLBOX_ITEM_SELECT,
            newItem: null,
          });
          expect(blockToolbar.classList.contains('visible')).to.equal(true);
        } finally {
          workspace.getToolbox = origGetToolbox;
          window.flockBlockToolbar?.hide();
        }
      });

      it('does not open while the toolbox flyout is open on narrow screens', async function () {
        const block = makeBlock();
        const origMatchMedia = window.matchMedia;
        const origGetToolbox = workspace.getToolbox;
        try {
          block
            .getSvgRoot()
            .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
          block.select();
          await flush();
          window.matchMedia = () => ({ matches: true });
          workspace.getToolbox = () => ({ getFlyout: () => ({ isVisible: () => true }) });
          document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
          expect(blockToolbar.classList.contains('visible')).to.equal(false);
        } finally {
          window.matchMedia = origMatchMedia;
          workspace.getToolbox = origGetToolbox;
          window.flockBlockToolbar?.hide();
        }
      });
    });
  });
}
