import { expect } from 'chai';
import * as Blockly from 'blockly';
import {
  installWorkspaceJumpDebug,
  installVariableScopeWarnings,
  variableFlyoutItems,
} from '../main/blocklyinit.js';
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

    describe('variables flyout', function () {
      const blocks = (ws) =>
        variableFlyoutItems(ws)
          .filter((item) => item.kind === 'block')
          .map((item) => `${item.type}:${item.fields?.VAR?.name ?? ''}`);

      it('offers a fresh set then local in an empty project', function () {
        expect(blocks(workspace)).to.deep.equal([
          'variables_set:variable1',
          'local_variable:variable1',
        ]);
      });

      it('puts the fresh set and local above the blocks for the latest variable', function () {
        workspace.createVariable('variable1');
        const score = workspace.createVariable('score');
        Blockly.serialization.blocks.append(
          { type: 'variables_get', fields: { VAR: { id: score.getId() } } },
          workspace
        );
        const names = blocks(workspace);
        expect(names.slice(0, 2)).to.deep.equal([
          'variables_set:variable2',
          'local_variable:variable2',
        ]);
        expect(names.slice(2).every((name) => !name.endsWith(':variable2'))).to.equal(true);
        expect(names.slice(2, 4)).to.deep.equal(['variables_set:score', 'variables_set:score']);
      });

      it('does not offer a local-only variable to the set, change and get blocks', function () {
        Blockly.serialization.blocks.append(
          {
            type: 'controls_repeat_ext',
            inputs: {
              DO: { block: { type: 'local_variable', fields: { VAR: { name: 'count' } } } },
            },
          },
          workspace
        );
        expect(blocks(workspace).filter((name) => name.endsWith(':count'))).to.deep.equal([]);
      });
    });

    describe('unavailable variable warnings', function () {
      const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const flushEvents = async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        await nextFrame();
        await nextFrame();
      };
      const warningText = (block) =>
        block
          .getIcons()
          .map((icon) => icon.getText?.() ?? '')
          .join('\n');

      let loop;
      let local;
      let read;

      beforeEach(async function () {
        installVariableScopeWarnings(workspace);
        loop = Blockly.serialization.blocks.append(
          {
            type: 'controls_repeat_ext',
            inputs: {
              DO: { block: { type: 'local_variable', fields: { VAR: { name: 'count' } } } },
            },
          },
          workspace
        );
        local = loop.getInputTargetBlock('DO');
        const outside = Blockly.serialization.blocks.append(
          {
            type: 'variables_set',
            fields: { VAR: { name: 'total' } },
            inputs: {
              VALUE: {
                block: { type: 'variables_get', fields: { VAR: { name: 'count' } } },
              },
            },
          },
          workspace
        );
        read = outside.getInputTargetBlock('VALUE');
        await flushEvents();
      });

      it('warns on a block that reads a local variable outside its scope', function () {
        expect(warningText(read)).to.include("'count' isn't available here.");
        expect(warningText(local)).to.equal('');
      });

      it('clears the warning when the block moves into scope', async function () {
        const holder = Blockly.serialization.blocks.append(
          { type: 'variables_set', fields: { VAR: { name: 'total' } } },
          workspace
        );
        local.nextConnection.connect(holder.previousConnection);
        holder.getInput('VALUE').connection.connect(read.outputConnection);
        await flushEvents();

        expect(warningText(read)).to.equal('');
      });

      it('clears the warning once the variable is set outside its scope', async function () {
        Blockly.serialization.blocks.append(
          { type: 'variables_set', fields: { VAR: { name: 'count' } } },
          workspace
        );
        await flushEvents();

        expect(warningText(read)).to.equal('');
      });

      it('leaves other warnings on the block alone', async function () {
        read.setWarningText('Other warning');
        const holder = Blockly.serialization.blocks.append(
          { type: 'variables_set', fields: { VAR: { name: 'total' } } },
          workspace
        );
        local.nextConnection.connect(holder.previousConnection);
        holder.getInput('VALUE').connection.connect(read.outputConnection);
        await flushEvents();

        expect(warningText(read)).to.equal('Other warning');
      });
    });
  });
}
