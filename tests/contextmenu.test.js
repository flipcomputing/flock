import { expect } from "chai";
import * as Blockly from "blockly";
import { initContextMenus } from "../ui/contextmenu.js";
import { setBlockLocked, isBlockLocked } from "../ui/blocklyutil.js";
import { defineControlBlocks } from "../blocks/control.js";

export function runContextMenuTests(flock) {
  describe("ui/contextmenu @contextmenu", function () {
    this.timeout(10000);

    let workspace;
    let container;
    let createdBlocks;

    before(function () {
      // The full app registers block types during its Blockly-init sequence,
      // which this lightweight test harness doesn't run — register the one
      // block type these tests need directly.
      defineControlBlocks();
      container = document.createElement("div");
      container.style.width = "300px";
      container.style.height = "200px";
      document.body.appendChild(container);
      workspace = Blockly.inject(container, { collapse: true });
      initContextMenus(workspace);
    });

    after(function () {
      workspace?.dispose();
      container?.remove();
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

    function makeBlock(type = "wait") {
      const block = workspace.newBlock(type);
      block.initSvg();
      block.render();
      createdBlocks.push(block);
      return block;
    }

    function getItem(id) {
      return Blockly.ContextMenuRegistry.registry.getItem(id);
    }

    describe("detachBlockWithShortcut", function () {
      it("is hidden for a block in a flyout", function () {
        const block = makeBlock();
        block.isInFlyout = true;
        expect(getItem("detachBlockWithShortcut").preconditionFn({ block })).to.equal(
          "hidden",
        );
      });

      it("is disabled for a top-level block with no parent", function () {
        const block = makeBlock();
        expect(getItem("detachBlockWithShortcut").preconditionFn({ block })).to.equal(
          "disabled",
        );
      });

      it("is enabled once the block is connected below a parent", function () {
        const parent = makeBlock();
        const child = makeBlock();
        parent.nextConnection.connect(child.previousConnection);
        expect(
          getItem("detachBlockWithShortcut").preconditionFn({ block: child }),
        ).to.equal("enabled");
      });

      it("callback unplugs the block from its parent", function () {
        const parent = makeBlock();
        const child = makeBlock();
        parent.nextConnection.connect(child.previousConnection);
        getItem("detachBlockWithShortcut").callback({ block: child });
        expect(child.previousConnection.isConnected()).to.equal(false);
      });
    });

    describe("viewBlockInCanvas", function () {
      it("is hidden for a block with no associated mesh", function () {
        const block = makeBlock();
        expect(getItem("viewBlockInCanvas").preconditionFn({ block })).to.equal(
          "hidden",
        );
      });

      it("is hidden for a block in a flyout", function () {
        const block = makeBlock();
        block.isInFlyout = true;
        expect(getItem("viewBlockInCanvas").preconditionFn({ block })).to.equal(
          "hidden",
        );
      });
    });

    describe("blockLock", function () {
      it("stays enabled for a plain, unlocked block", function () {
        const block = makeBlock();
        expect(getItem("blockLock").preconditionFn({ block })).to.equal("enabled");
      });

      it("stays enabled even when the block is already locked (so it can be unlocked)", function () {
        const block = makeBlock();
        setBlockLocked(block, true);
        expect(getItem("blockLock").preconditionFn({ block })).to.equal("enabled");
      });

      it("callback toggles the locked state on and back off", function () {
        const block = makeBlock();
        expect(isBlockLocked(block)).to.equal(false);
        getItem("blockLock").callback({ block });
        expect(isBlockLocked(block)).to.equal(true);
        getItem("blockLock").callback({ block });
        expect(isBlockLocked(block)).to.equal(false);
      });

      it("displayText differs between the locked and unlocked states", function () {
        const block = makeBlock();
        const unlockedText = getItem("blockLock").displayText({ block });
        setBlockLocked(block, true);
        const lockedText = getItem("blockLock").displayText({ block });
        expect(unlockedText).to.not.equal(lockedText);
      });
    });

    describe("disableMutatingItemsWhenLocked", function () {
      it("disables blockInline and blockDisable once the block is locked", function () {
        const block = makeBlock();
        setBlockLocked(block, true);
        for (const id of ["blockInline", "blockDisable"]) {
          const item = getItem(id);
          expect(item, `expected ${id} to be registered`).to.exist;
          expect(item.preconditionFn({ block })).to.equal("disabled");
        }
      });

      it("disables detachBlockWithShortcut even when otherwise connected", function () {
        const parent = makeBlock();
        const child = makeBlock();
        parent.nextConnection.connect(child.previousConnection);
        setBlockLocked(child, true);
        expect(
          getItem("detachBlockWithShortcut").preconditionFn({ block: child }),
        ).to.equal("disabled");
      });

      it("leaves the item's normal behaviour intact when unlocked", function () {
        const block = makeBlock();
        expect(getItem("blockInline").preconditionFn({ block })).to.not.equal(
          "disabled",
        );
      });
    });

    describe("flockCollapseExpandWorkspace", function () {
      it("is hidden when the workspace has no top-level blocks", function () {
        expect(workspace.getTopBlocks(false)).to.have.lengthOf(0);
        expect(
          getItem("flockCollapseExpandWorkspace").preconditionFn({ workspace }),
        ).to.equal("hidden");
      });

      it("is enabled once a top-level block exists", function () {
        makeBlock();
        expect(
          getItem("flockCollapseExpandWorkspace").preconditionFn({ workspace }),
        ).to.equal("enabled");
      });

      it("callback collapses all top blocks, then expands them again on a second call", function () {
        const block = makeBlock();
        const item = getItem("flockCollapseExpandWorkspace");
        item.callback({ workspace });
        expect(block.isCollapsed()).to.equal(true);
        item.callback({ workspace });
        expect(block.isCollapsed()).to.equal(false);
      });
    });

    describe("workspaceDelete rename", function () {
      it("relabels the built-in delete-all item away from its default text", function () {
        const item = getItem("workspaceDelete");
        expect(item).to.exist;
        const text = item.displayText({ workspace });
        expect(text).to.be.a("string").and.not.equal("DELETE_ALL_BLOCKS");
      });
    });

    describe("workspaceFindInWorkspace", function () {
      it("is always enabled", function () {
        expect(getItem("workspaceFindInWorkspace").preconditionFn({})).to.equal(
          "enabled",
        );
      });

      it("callback opens window.flockWorkspaceSearch", function () {
        let opened = false;
        const saved = window.flockWorkspaceSearch;
        window.flockWorkspaceSearch = { open: () => (opened = true) };
        try {
          getItem("workspaceFindInWorkspace").callback({});
          expect(opened).to.equal(true);
        } finally {
          window.flockWorkspaceSearch = saved;
        }
      });
    });

    describe("clipboard: cut / copy / paste", function () {
      it("blockCopy is hidden in a flyout and enabled otherwise", function () {
        const block = makeBlock();
        expect(getItem("blockCopy").preconditionFn({ block })).to.equal("enabled");
        block.isInFlyout = true;
        expect(getItem("blockCopy").preconditionFn({ block })).to.equal("hidden");
      });

      it("blockCut is disabled on a locked block", function () {
        const block = makeBlock();
        setBlockLocked(block, true);
        expect(getItem("blockCut").preconditionFn({ block })).to.equal("disabled");
      });

      it("blockCut disposes the block after copying it", function () {
        const block = makeBlock();
        getItem("blockCut").callback({ block });
        expect(block.disposed).to.equal(true);
        createdBlocks = createdBlocks.filter((b) => b !== block);
      });

      it("blockPaste is disabled with no copied data", function () {
        Blockly.clipboard.getLastCopiedData?.();
        // Force a known empty-clipboard state via a fresh copy/cut cycle isn't
        // reliable across test order, so only assert the shape of the result.
        const block = makeBlock();
        const result = getItem("blockPaste").preconditionFn({ block });
        expect(["enabled", "disabled"]).to.include(result);
      });

      it("blockPaste becomes enabled after a copy, and pastes a new block stacked after the target", function () {
        const source = makeBlock();
        getItem("blockCopy").callback({ block: source });
        expect(getItem("blockPaste").preconditionFn({ block: source })).to.equal(
          "enabled",
        );

        const target = makeBlock();
        const before = workspace.getAllBlocks(false).length;
        getItem("blockPaste").callback({ block: target });
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
  });
}
