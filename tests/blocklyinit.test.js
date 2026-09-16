import { expect } from 'chai';
import * as Blockly from 'blockly';
import { installWorkspaceJumpDebug } from '../main/blocklyinit.js';
import { defineControlBlocks } from '../blocks/control.js';

export function runBlocklyInitTests(_flock) {
  describe('main/blocklyinit @blocklyinit', function () {
    let workspace;
    let container;

    before(function () {
      defineControlBlocks();
    });

    beforeEach(function () {
      container = document.createElement('div');
      container.style.width = '300px';
      container.style.height = '200px';
      document.body.appendChild(container);
      workspace = Blockly.inject(container, {
        move: { scrollbars: { horizontal: true, vertical: true }, drag: true, wheel: true },
      });

      // scroll() clamps to the content bounding box (see blockly_compressed.js):
      // a single block barely bigger than the viewport gives zero scroll slack,
      // so the box has to be much larger than the viewport in both dimensions to
      // leave real scroll range for the assertions below.
      const near = workspace.newBlock('wait');
      near.initSvg();
      near.render();

      const far = workspace.newBlock('wait');
      far.initSvg();
      far.render();
      far.moveBy(3000, 3000);

      installWorkspaceJumpDebug(workspace);
    });

    afterEach(function () {
      workspace?.dispose();
      container?.remove();
    });

    describe('focus-scroll jump suppression', function () {
      // Named to match the stack-trace check in installWorkspaceJumpDebug, which
      // only reacts to Blockly's own focus-follow path (scrollBoundsIntoView /
      // onNodeFocus), mirroring the real call site in blockly_compressed.js.
      function scrollBoundsIntoView(x, y) {
        workspace.scroll(x, y);
      }

      it('suppresses a large horizontal jump but keeps the accompanying vertical scroll after a direct canvas tap', function () {
        workspace
          .getParentSvg()
          .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

        const beforeX = workspace.scrollX;
        const beforeY = workspace.scrollY;
        scrollBoundsIntoView(beforeX - 400, beforeY - 50);

        expect(workspace.scrollX).to.equal(beforeX);
        expect(workspace.scrollY).to.equal(beforeY - 50);
      });

      it('applies both axes normally when there was no recent canvas tap', function () {
        const beforeX = workspace.scrollX;
        const beforeY = workspace.scrollY;
        scrollBoundsIntoView(beforeX - 400, beforeY - 50);

        expect(workspace.scrollX).to.equal(beforeX - 400);
        expect(workspace.scrollY).to.equal(beforeY - 50);
      });

      it('suppresses the focus scroll entirely (both axes) after a keyword-block-shortcut insertion', function () {
        const near = workspace.getAllBlocks(false).find((b) => b.getRelativeToSurfaceXY().x !== 3000);
        Blockly.getFocusManager().focusNode(near);
        workspace.markKeywordBlockCreated(near);

        const beforeX = workspace.scrollX;
        const beforeY = workspace.scrollY;
        scrollBoundsIntoView(beforeX - 400, beforeY - 50);

        expect(workspace.scrollX).to.equal(beforeX);
        expect(workspace.scrollY).to.equal(beforeY);
      });

      it('does not suppress the focus scroll when the created block is not fully in view', function () {
        // "far" was moved to (3000, 3000) in beforeEach — well outside the
        // viewport regardless of current scroll position.
        const far = workspace.getAllBlocks(false).find((b) => b.getRelativeToSurfaceXY().x === 3000);
        Blockly.getFocusManager().focusNode(far);
        workspace.markKeywordBlockCreated(far);

        const beforeX = workspace.scrollX;
        const beforeY = workspace.scrollY;
        scrollBoundsIntoView(beforeX - 400, beforeY - 50);

        expect(workspace.scrollX).to.equal(beforeX - 400);
        expect(workspace.scrollY).to.equal(beforeY - 50);
      });

      it('does not suppress the focus scroll when focus has moved to a different block', function () {
        const near = workspace.getAllBlocks(false).find((b) => b.getRelativeToSurfaceXY().x !== 3000);
        const far = workspace.getAllBlocks(false).find((b) => b.getRelativeToSurfaceXY().x === 3000);
        // "near" is the block the shortcut created (and is fully visible), but
        // focus has since moved to "far" — that block's own scroll-into-view
        // must not be swallowed just because "near" is still within its window.
        workspace.markKeywordBlockCreated(near);
        Blockly.getFocusManager().focusNode(far);

        const beforeX = workspace.scrollX;
        const beforeY = workspace.scrollY;
        scrollBoundsIntoView(beforeX - 400, beforeY - 50);

        expect(workspace.scrollX).to.equal(beforeX - 400);
        expect(workspace.scrollY).to.equal(beforeY - 50);
      });

      it('only suppresses once, letting a later scroll for the same block through', function () {
        const near = workspace.getAllBlocks(false).find((b) => b.getRelativeToSurfaceXY().x !== 3000);
        Blockly.getFocusManager().focusNode(near);
        workspace.markKeywordBlockCreated(near);

        const beforeX = workspace.scrollX;
        const beforeY = workspace.scrollY;
        scrollBoundsIntoView(beforeX - 400, beforeY - 50);
        expect(workspace.scrollX).to.equal(beforeX);
        expect(workspace.scrollY).to.equal(beforeY);

        // The marker is consumed by the first suppression, so a second
        // focus-driven scroll for the same block applies normally instead of
        // being suppressed indefinitely for the rest of the window.
        scrollBoundsIntoView(beforeX - 400, beforeY - 50);
        expect(workspace.scrollX).to.equal(beforeX - 400);
        expect(workspace.scrollY).to.equal(beforeY - 50);
      });

      it('applies both axes normally for a non-focus-driven scroll even after a canvas tap', function () {
        workspace
          .getParentSvg()
          .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

        const beforeX = workspace.scrollX;
        const beforeY = workspace.scrollY;
        workspace.scroll(beforeX - 400, beforeY - 50);

        expect(workspace.scrollX).to.equal(beforeX - 400);
        expect(workspace.scrollY).to.equal(beforeY - 50);
      });
    });
  });
}
