import { expect } from 'chai';
import * as Blockly from 'blockly';
import '@blockly/block-plus-minus';
import { swapListItems, initListReorder } from '../ui/listReorder.js';

function itemValues(list, field = 'TEXT') {
  const out = [];
  for (let i = 0; list.getInput('ADD' + i); i++) {
    const target = list.getInput('ADD' + i).connection.targetBlock();
    out.push(target ? target.getFieldValue(field) : null);
  }
  return out;
}

function makeList(
  workspace,
  values,
  shadowType = 'text',
  field = 'TEXT',
  blockType = 'lists_create_with'
) {
  const inputs = {};
  values.forEach((value, i) => {
    inputs['ADD' + i] = { shadow: { type: shadowType, fields: { [field]: value } } };
  });
  return Blockly.serialization.blocks.append(
    { type: blockType, extraState: { itemCount: values.length }, inputs },
    workspace
  );
}

function centre(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// Simulate a real pointer drag from one item's element to a client point,
// the way initListReorder's own handlers expect to receive it.
function drag(itemEl, to, pointerId = 999) {
  startDragTo(itemEl, to, pointerId)();
}

// Like `drag`, but stops short of releasing the pointer - returns a function
// that finishes the drag, so the caller can assert on mid-drag state first.
function startDragTo(itemEl, to, pointerId = 999) {
  const from = centre(itemEl);
  itemEl.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId, button: 0, clientX: from.x, clientY: from.y })
  );
  document.dispatchEvent(
    new PointerEvent('pointermove', { bubbles: true, pointerId, clientX: to.x, clientY: to.y })
  );
  return () =>
    document.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, pointerId, clientX: to.x, clientY: to.y })
    );
}

export function runListReorderTests(_flock) {
  describe('ui/listReorder @listReorder', function () {
    let workspace;
    let container;

    beforeEach(function () {
      container = document.createElement('div');
      container.style.width = '3000px';
      container.style.height = '2000px';
      document.body.appendChild(container);
      workspace = Blockly.inject(container, {});
    });

    afterEach(function () {
      workspace?.dispose();
      container?.remove();
    });

    it('swaps two non-adjacent items', function () {
      const list = makeList(workspace, ['a', 'b', 'c']);
      expect(swapListItems(list, 0, 2)).to.equal(true);
      expect(itemValues(list)).to.deep.equal(['c', 'b', 'a']);
    });

    it('swaps two adjacent items', function () {
      const list = makeList(workspace, ['a', 'b', 'c']);
      expect(swapListItems(list, 2, 1)).to.equal(true);
      expect(itemValues(list)).to.deep.equal(['a', 'c', 'b']);
    });

    it('leaves the other slots untouched', function () {
      const list = makeList(workspace, ['a', 'b', 'c', 'd', 'e']);
      swapListItems(list, 1, 3);
      expect(itemValues(list)).to.deep.equal(['a', 'd', 'c', 'b', 'e']);
    });

    it('carries a typed-in shadow value with the item', function () {
      const list = makeList(workspace, ['a', 'b', 'c']);
      list.getInput('ADD0').connection.targetBlock().setFieldValue('typed', 'TEXT');
      swapListItems(list, 0, 2);
      expect(itemValues(list)).to.deep.equal(['c', 'b', 'typed']);
    });

    it('works for math_number shadows', function () {
      const list = makeList(workspace, [1, 2, 3], 'math_number', 'NUM');
      swapListItems(list, 0, 2);
      expect(itemValues(list, 'NUM')).to.deep.equal([3, 2, 1]);
    });

    it('keeps the identity of a real value block', function () {
      const list = makeList(workspace, ['a', 'b', 'c']);
      const real = workspace.newBlock('text');
      real.setFieldValue('real', 'TEXT');
      real.initSvg();
      real.render();
      list.getInput('ADD1').connection.connect(real.outputConnection);

      swapListItems(list, 1, 0);
      expect(list.getInput('ADD0').connection.targetBlock().id).to.equal(real.id);
      expect(itemValues(list)).to.deep.equal(['real', 'a', 'c']);
    });

    it('is a no-op for an unchanged, out-of-range, or non-integer swap', function () {
      const list = makeList(workspace, ['a', 'b', 'c']);
      expect(swapListItems(list, 1, 1)).to.equal(false);
      expect(swapListItems(list, 0, 9)).to.equal(false);
      expect(swapListItems(list, -1, 0)).to.equal(false);
      expect(swapListItems(list, 0.5, 1)).to.equal(false);
      expect(swapListItems(list, 0, NaN)).to.equal(false);
      expect(itemValues(list)).to.deep.equal(['a', 'b', 'c']);
    });

    it('can be undone in one step', async function () {
      const flush = () => new Promise((resolve) => setTimeout(resolve, 60));
      const list = makeList(workspace, ['a', 'b', 'c']);
      await flush();
      swapListItems(list, 0, 2);
      expect(itemValues(list)).to.deep.equal(['c', 'b', 'a']);
      await flush(); // let Blockly's event queue reach the undo stack
      workspace.undo(false);
      expect(itemValues(list)).to.deep.equal(['a', 'b', 'c']);
    });

    it('swaps items in a text_join block', function () {
      const list = makeList(workspace, ['a', 'b', 'c'], 'text', 'TEXT', 'text_join');
      expect(swapListItems(list, 0, 2)).to.equal(true);
      expect(itemValues(list)).to.deep.equal(['c', 'b', 'a']);
    });

    it('rejects blocks of an unsupported type', function () {
      const notAList = workspace.newBlock('text');
      expect(swapListItems(notAList, 0, 1)).to.equal(false);
    });

    describe('dragging', function () {
      before(function () {
        // A minimal block with one unchecked value input, standing in for
        // "some other, non-list block with a compatible field".
        if (!Blockly.Blocks['test_value_sink']) {
          Blockly.Blocks['test_value_sink'] = {
            init() {
              this.appendValueInput('VALUE');
              this.setColour(0);
            },
          };
        }
      });

      beforeEach(function () {
        initListReorder(workspace);
      });

      it('dropped back on its own list, swaps items without creating or destroying blocks', function () {
        const list = makeList(workspace, ['a', 'b', 'c']);
        const item0 = list.getInput('ADD0').connection.targetBlock().getSvgRoot();
        const item2 = list.getInput('ADD2').connection.targetBlock().getSvgRoot();
        const countBefore = workspace.getAllBlocks(false).length;

        drag(item0, centre(item2));

        expect(itemValues(list)).to.deep.equal(['c', 'b', 'a']);
        expect(workspace.getAllBlocks(false)).to.have.lengthOf(countBefore);
      });

      it('swapping colours in a list via drag undoes in exactly one step, with no leftover block', async function () {
        const flush = () => new Promise((resolve) => setTimeout(resolve, 60));
        const list = makeList(workspace, ['#ff0000', '#00ff00', '#0000ff'], 'colour_picker', 'COLOUR');
        const item0 = list.getInput('ADD0').connection.targetBlock().getSvgRoot();
        const item2 = list.getInput('ADD2').connection.targetBlock().getSvgRoot();
        const countBefore = workspace.getAllBlocks(false).length;

        await flush();
        drag(item0, centre(item2));
        expect(itemValues(list, 'COLOUR')).to.deep.equal(['#0000ff', '#00ff00', '#ff0000']);
        expect(workspace.getAllBlocks(false)).to.have.lengthOf(countBefore);

        await flush(); // let Blockly's event queue reach the undo stack
        workspace.undo(false);

        expect(itemValues(list, 'COLOUR')).to.deep.equal(['#ff0000', '#00ff00', '#0000ff']);
        expect(workspace.getAllBlocks(false)).to.have.lengthOf(countBefore);
      });

      it('dropped just outside the list but near one of its own slots, leaves the original untouched', function () {
        const list = makeList(workspace, ['a', 'b', 'c']);
        const item0Block = list.getInput('ADD0').connection.targetBlock();
        const item0 = item0Block.getSvgRoot();
        const item2Rect = list.getInput('ADD2').connection.targetBlock().getSvgRoot().getBoundingClientRect();
        const listRect = list.getSvgRoot().getBoundingClientRect();

        // Items stack one per row (no setInputsInline), so the last item sits
        // right at the list's bottom edge. Just past that edge is outside
        // listRect, so this takes the "external connection" path - but still
        // within snap range of item2's own connection point, which
        // candidateConnections must exclude.
        const justOutside = { x: item2Rect.left + item2Rect.width / 2, y: listRect.bottom + 1 };

        drag(item0, justOutside);

        expect(itemValues(list)).to.deep.equal(['a', 'b', 'c']);
        expect(list.getInput('ADD0').connection.targetBlock().id).to.equal(item0Block.id);
        expect(list.getInput('ADD2').connection.targetBlock().isShadow()).to.equal(true);
      });

      it('dropped on empty canvas, leaves the original list untouched and creates a free copy', function () {
        const list = makeList(workspace, ['a', 'b', 'c']);
        const item0 = list.getInput('ADD0').connection.targetBlock().getSvgRoot();
        const listRect = list.getSvgRoot().getBoundingClientRect();
        const away = { x: listRect.left, y: listRect.bottom + 200 };

        drag(item0, away);

        expect(itemValues(list)).to.deep.equal(['a', 'b', 'c']);

        const copies = workspace
          .getAllBlocks(false)
          .filter((b) => b.type === 'text' && !b.isShadow() && b.getFieldValue('TEXT') === 'a');
        expect(copies).to.have.lengthOf(1);
        expect(copies[0].getParent()).to.equal(null);
      });

      it("dropped on another list's slot, leaves the original untouched and drops a copy there, replacing a shadow", function () {
        const source = makeList(workspace, ['a', 'b', 'c']);
        const target = makeList(workspace, ['x', 'y']);
        target.moveBy(0, 300);
        Blockly.renderManagement.triggerQueuedRenders(workspace);
        const item0Block = source.getInput('ADD0').connection.targetBlock();
        const item0 = item0Block.getSvgRoot();
        const slot1 = target.getInput('ADD1').connection.targetBlock().getSvgRoot();

        drag(item0, centre(slot1));

        expect(itemValues(source)).to.deep.equal(['a', 'b', 'c']);
        expect(itemValues(target)).to.deep.equal(['x', 'a']);
        expect(target.getInput('ADD1').connection.targetBlock().id).to.not.equal(item0Block.id);
      });

      it("dropped on another list's occupied slot, drops a copy there and bumps the real block out instead of deleting it", function () {
        const source = makeList(workspace, ['a', 'b', 'c']);
        const target = makeList(workspace, ['x', 'y']);
        target.moveBy(0, 300);
        Blockly.renderManagement.triggerQueuedRenders(workspace);
        const real = workspace.newBlock('text');
        real.setFieldValue('real', 'TEXT');
        real.initSvg();
        real.render();
        target.getInput('ADD0').connection.connect(real.outputConnection);
        Blockly.renderManagement.triggerQueuedRenders(workspace);

        const item0 = source.getInput('ADD0').connection.targetBlock().getSvgRoot();
        const slot0 = target.getInput('ADD0').connection.targetBlock().getSvgRoot();

        drag(item0, centre(slot0));

        expect(itemValues(source)).to.deep.equal(['a', 'b', 'c']);
        expect(itemValues(target)).to.deep.equal(['a', 'y']);
        expect(real.getParent()).to.equal(null);
        expect(real.disposed).to.not.equal(true);
      });

      it('can be undone in one step after being dropped as a free copy', async function () {
        const flush = () => new Promise((resolve) => setTimeout(resolve, 60));
        const list = makeList(workspace, ['a', 'b', 'c']);
        const item0 = list.getInput('ADD0').connection.targetBlock().getSvgRoot();
        const listRect = list.getSvgRoot().getBoundingClientRect();
        const away = { x: listRect.left, y: listRect.bottom + 200 };
        const countBefore = workspace.getAllBlocks(false).length;

        drag(item0, away);
        expect(workspace.getAllBlocks(false)).to.have.lengthOf(countBefore + 1);

        await flush(); // let Blockly's event queue reach the undo stack
        workspace.undo(false);

        expect(itemValues(list)).to.deep.equal(['a', 'b', 'c']);
        expect(workspace.getAllBlocks(false)).to.have.lengthOf(countBefore);
      });

      it('can be undone in one step after a copy is dropped into another slot', async function () {
        const flush = () => new Promise((resolve) => setTimeout(resolve, 60));
        const source = makeList(workspace, ['a', 'b', 'c']);
        const target = makeList(workspace, ['x', 'y']);
        target.moveBy(0, 300);
        Blockly.renderManagement.triggerQueuedRenders(workspace);
        const item0 = source.getInput('ADD0').connection.targetBlock().getSvgRoot();
        const slot1 = target.getInput('ADD1').connection.targetBlock().getSvgRoot();
        const countBefore = workspace.getAllBlocks(false).length;

        drag(item0, centre(slot1));
        expect(itemValues(target)).to.deep.equal(['x', 'a']);

        await flush();
        workspace.undo(false);

        expect(itemValues(source)).to.deep.equal(['a', 'b', 'c']);
        expect(itemValues(target)).to.deep.equal(['x', 'y']);
        expect(workspace.getAllBlocks(false)).to.have.lengthOf(countBefore);
      });

      it("dropped on a non-list block's compatible input, drops a copy there like an ordinary block drag", function () {
        const list = makeList(workspace, ['a', 'b', 'c']);
        const sink = workspace.newBlock('test_value_sink');
        sink.initSvg();
        sink.render();
        sink.moveBy(0, 300);
        const anchor = workspace.newBlock('text');
        anchor.setShadow(true);
        anchor.initSvg();
        anchor.render();
        sink.getInput('VALUE').connection.connect(anchor.outputConnection);
        Blockly.renderManagement.triggerQueuedRenders(workspace);

        const item0Block = list.getInput('ADD0').connection.targetBlock();
        const item0 = item0Block.getSvgRoot();
        const anchorEl = anchor.getSvgRoot();

        drag(item0, centre(anchorEl));

        const dropped = sink.getInput('VALUE').connection.targetBlock();
        expect(dropped.id).to.not.equal(item0Block.id);
        expect(dropped.getFieldValue('TEXT')).to.equal('a');
        expect(dropped.isShadow()).to.equal(false);
        expect(itemValues(list)).to.deep.equal(['a', 'b', 'c']);
      });
    });
  });
}
