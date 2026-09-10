import { expect } from 'chai';
import * as Blockly from 'blockly';
import '@blockly/block-plus-minus';
import { swapListItems } from '../ui/listReorder.js';

function itemValues(list, field = 'TEXT') {
  const out = [];
  for (let i = 0; list.getInput('ADD' + i); i++) {
    const target = list.getInput('ADD' + i).connection.targetBlock();
    out.push(target ? target.getFieldValue(field) : null);
  }
  return out;
}

function makeList(workspace, values, shadowType = 'text', field = 'TEXT') {
  const inputs = {};
  values.forEach((value, i) => {
    inputs['ADD' + i] = { shadow: { type: shadowType, fields: { [field]: value } } };
  });
  return Blockly.serialization.blocks.append(
    { type: 'lists_create_with', extraState: { itemCount: values.length }, inputs },
    workspace
  );
}

export function runListReorderTests(_flock) {
  describe('ui/listReorder @listReorder', function () {
    let workspace;
    let container;

    beforeEach(function () {
      container = document.createElement('div');
      container.style.width = '300px';
      container.style.height = '200px';
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
  });
}
