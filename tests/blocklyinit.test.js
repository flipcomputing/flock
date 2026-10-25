import { expect } from 'chai';
import * as Blockly from 'blockly';
import { injectTestWorkspace, disposeTestWorkspace } from './utils/blocklyTestUtils.js';
import {
  installWorkspaceJumpDebug,
  installVariableScopeWarnings,
  setupAutoValueBehavior,
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
      workspace = injectTestWorkspace(container, {
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
      disposeTestWorkspace(workspace);
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

    describe('list + and - with undo', function () {
      // Blockly fires queued events a frame and a timeout later, and events the
      // auto-fill listener fires wait for another round, so wait out several.
      const flushEvents = async () => {
        for (let round = 0; round < 3; round++) {
          await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
        }
      };

      // null leaves a slot empty; a string is a number shadow; { variable } is a
      // real variables_get block.
      function makeList(items) {
        const list = workspace.newBlock('lists_create_with');
        list.loadExtraState({ itemCount: items.length });
        list.initSvg();
        list.render();
        items.forEach((item, i) => {
          if (item === null) return;
          const block = workspace.newBlock(item.variable ? 'variables_get' : 'math_number');
          if (item.variable) {
            block.setFieldValue(workspace.createVariable(item.variable).getId(), 'VAR');
          } else {
            block.setShadow(true);
            block.setFieldValue(item, 'NUM');
          }
          block.initSvg();
          block.render();
          list.getInput('ADD' + i).connection.connect(block.outputConnection);
        });
        return list;
      }

      function items(list) {
        const values = [];
        for (let i = 0; list.getInput('ADD' + i); i++) {
          const block = list.getInputTargetBlock('ADD' + i);
          if (!block) values.push(null);
          else if (block.type === 'variables_get') values.push(`var:${block.getField('VAR').getText()}`);
          else values.push(`${block.isShadow() ? '' : 'real:'}${block.getFieldValue('NUM')}`);
        }
        return values;
      }

      const snapshot = (list) => ({ items: items(list), tops: workspace.getTopBlocks(false).length });

      async function perform(list, step) {
        if (step === '+') list.getField('PLUS').showEditor_();
        else if (step === '-') list.getField('MINUS').showEditor_();
        else list.getInputTargetBlock('ADD' + step.slot).setFieldValue(step.value, 'NUM');
        await flushEvents();
      }

      // Each step is one undo entry, so undoing every step walks back through
      // the states in reverse and redoing walks forward again.
      async function expectUndoRedoRetraces(list, steps) {
        const states = [snapshot(list)];
        for (const step of steps) {
          await perform(list, step);
          states.push(snapshot(list));
        }
        for (let i = steps.length - 1; i >= 0; i--) {
          workspace.undo(false);
          await flushEvents();
          expect(snapshot(list), `after undoing step ${i + 1}`).to.deep.equal(states[i]);
        }
        expect(workspace.getUndoStack()).to.have.length(0);
        for (let i = 1; i <= steps.length; i++) {
          workspace.undo(true);
          await flushEvents();
          expect(snapshot(list), `after redoing step ${i}`).to.deep.equal(states[i]);
        }
        expect(workspace.getRedoStack()).to.have.length(0);
      }

      beforeEach(function () {
        setupAutoValueBehavior(workspace);
      });

      async function listReadyForSteps(items) {
        const list = makeList(items);
        await flushEvents();
        workspace.clearUndo();
        return list;
      }

      it('+ fills the new slot with a copy of the item before it', async function () {
        const list = await listReadyForSteps(['1', '2']);
        await perform(list, '+');
        expect(items(list)).to.deep.equal(['1', '2', '2']);
      });

      it('undoes and redoes + in one step each', async function () {
        const list = await listReadyForSteps(['1', '2']);
        await expectUndoRedoRetraces(list, ['+']);
      });

      it('redo of + brings back the copy that a later redone edit changes', async function () {
        const list = await listReadyForSteps(['1', '2']);
        await expectUndoRedoRetraces(list, ['+', { slot: 2, value: 5 }]);
      });

      it('undo of - brings back the removed item as it was', async function () {
        const list = await listReadyForSteps(['1', '2', '3']);
        await expectUndoRedoRetraces(list, [{ slot: 2, value: 7 }, '-']);
      });

      it('- leaves an empty slot before the removed one empty', async function () {
        const list = await listReadyForSteps(['1', null, '3']);
        await perform(list, '-');
        expect(items(list)).to.deep.equal(['1', null]);
      });

      it('copies a real block as a real block and undoes it without leaving it behind', async function () {
        const list = await listReadyForSteps(['1', { variable: 'item' }]);
        await expectUndoRedoRetraces(list, ['+']);
        expect(items(list)).to.deep.equal(['1', 'var:item', 'var:item']);
      });

      it('retraces mixed +, - and edits on the same slots', async function () {
        const list = await listReadyForSteps(['1', '2', '3']);
        await expectUndoRedoRetraces(list, [
          '+',
          { slot: 3, value: 8 },
          '-',
          '-',
          '+',
          { slot: 2, value: 9 },
          '+',
        ]);
      });

      it('retraces removing every item and adding new ones', async function () {
        const list = await listReadyForSteps(['1', '2', '3']);
        await expectUndoRedoRetraces(list, ['-', '-', '-', '+', '+']);
      });
    });
  });
}
