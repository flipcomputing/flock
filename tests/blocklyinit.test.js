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
