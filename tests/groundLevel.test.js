import { expect } from 'chai';
import * as Blockly from 'blockly';
import { flock } from '../flock.js';
import { defineShapeBlocks } from '../blocks/shapes.js';
import { defineSensingBlocks } from '../blocks/sensing.js';
import { toolbox } from '../toolbox.js';
import { getPlaceOnGroundEnabled, setPlaceOnGroundEnabled } from '../ui/controlPreferences.js';
import {
  hasGroundLevelY,
  placesOnGround,
  readBlockY,
  setGroundLevelY,
  setNumberY,
  syncGroundLevelY,
} from '../ui/groundLevel.js';

export function runGroundLevelTests() {
  describe('ui/groundLevel @groundlevel', function () {
    let ws;
    let savedGroundLevelAt;
    let savedPlaceOnGround;

    before(function () {
      if (!Blockly.Blocks['create_box']) defineShapeBlocks();
      if (!Blockly.Blocks['ground_level']) defineSensingBlocks();
    });

    beforeEach(function () {
      ws = new Blockly.Workspace();
      savedGroundLevelAt = flock.getGroundLevelAt;
      flock.getGroundLevelAt = (x) => x / 2;
      savedPlaceOnGround = getPlaceOnGroundEnabled();
    });

    afterEach(function () {
      ws.dispose();
      flock.getGroundLevelAt = savedGroundLevelAt;
      setPlaceOnGroundEnabled(savedPlaceOnGround);
    });

    const number = (value) => ({ shadow: { type: 'math_number', fields: { NUM: value } } });

    function box({ x = 4, y = 0, z = 0, yBlock = null, type = 'create_box' } = {}) {
      return Blockly.serialization.blocks.append(
        {
          type,
          inputs: {
            X: number(x),
            Y: { ...number(y), ...(yBlock ? { block: yBlock } : {}) },
            Z: number(z),
          },
        },
        ws
      );
    }

    const yTarget = (block) => block.getInputTargetBlock('Y');

    describe('setGroundLevelY', function () {
      it('puts a ground level block over the number, as if dragged in', function () {
        const block = box({ y: 3 });
        expect(setGroundLevelY(block)).to.equal(true);
        expect(yTarget(block).type).to.equal('ground_level');
        expect(yTarget(block).isShadow()).to.equal(false);

        yTarget(block).dispose(false);
        expect(yTarget(block).type).to.equal('math_number');
        expect(yTarget(block).getFieldValue('NUM')).to.equal(3);
      });

      it('leaves a computed Y alone', function () {
        const block = box({ yBlock: { type: 'math_arithmetic', fields: { OP: 'ADD' } } });
        expect(setGroundLevelY(block)).to.equal(false);
        expect(yTarget(block).type).to.equal('math_arithmetic');
      });
    });

    describe('setNumberY', function () {
      it('replaces ground level with the number', function () {
        const block = box({ yBlock: { type: 'ground_level' } });
        setNumberY(block, 2.5);
        expect(yTarget(block).type).to.equal('math_number');
        expect(yTarget(block).isShadow()).to.equal(true);
        expect(yTarget(block).getFieldValue('NUM')).to.equal(2.5);
      });

      it('does nothing to a number', function () {
        const block = box({ y: 1 });
        expect(setNumberY(block, 5)).to.equal(null);
        expect(yTarget(block).getFieldValue('NUM')).to.equal(1);
      });
    });

    describe('readBlockY', function () {
      it('resolves ground level to the ground height under the block', function () {
        expect(readBlockY(box({ x: 6, yBlock: { type: 'ground_level' } }))).to.equal(3);
      });

      it('reads a number', function () {
        expect(readBlockY(box({ y: 1.5 }))).to.equal(1.5);
      });
    });

    describe('syncGroundLevelY', function () {
      it('turns ground level into a number when lifted', function () {
        const block = box({ yBlock: { type: 'ground_level' } });
        expect(syncGroundLevelY(block, { x: 4, y: 5, z: 0 })).to.equal(false);
        expect(yTarget(block).getFieldValue('NUM')).to.equal(5);
      });

      it('keeps ground level at the ground, whatever the setting', function () {
        setPlaceOnGroundEnabled(false);
        const block = box({ yBlock: { type: 'ground_level' } });
        expect(syncGroundLevelY(block, { x: 4, y: 2.05, z: 0 })).to.equal(true);
        expect(hasGroundLevelY(block)).to.equal(true);
      });

      it('snaps a number at the ground to ground level with the setting on', function () {
        setPlaceOnGroundEnabled(true);
        const block = box({ y: 2 });
        expect(syncGroundLevelY(block, { x: 4, y: 2.05, z: 0 })).to.equal(true);
        expect(hasGroundLevelY(block)).to.equal(true);
      });

      it('keeps a number at the ground with the setting off', function () {
        setPlaceOnGroundEnabled(false);
        const block = box({ y: 2 });
        expect(syncGroundLevelY(block, { x: 4, y: 2, z: 0 })).to.equal(false);
        expect(yTarget(block).type).to.equal('math_number');
      });

      it('keeps a number above the snap distance', function () {
        setPlaceOnGroundEnabled(true);
        const block = box({ y: 2.5 });
        expect(syncGroundLevelY(block, { x: 4, y: 2.5, z: 0 })).to.equal(false);
        expect(yTarget(block).type).to.equal('math_number');
      });
    });

    describe('placesOnGround', function () {
      it('applies only with the setting on, and only to add blocks', function () {
        setPlaceOnGroundEnabled(false);
        expect(placesOnGround(box())).to.equal(false);
        setPlaceOnGroundEnabled(true);
        expect(placesOnGround(box())).to.equal(true);
        expect(placesOnGround({ type: 'move_to_xyz' })).to.equal(false);
      });
    });

    describe('toolbox defaults', function () {
      const findEntry = (items, type) => {
        for (const item of items ?? []) {
          if (item.kind === 'block' && item.type === type) return item;
          const found = findEntry(item.contents, type);
          if (found) return found;
        }
        return null;
      };

      it('adds a ground level block over the Y number only while the setting is on', function () {
        setPlaceOnGroundEnabled(false);
        const entry = findEntry(toolbox.contents, 'create_box');
        expect(entry.inputs.Y.block).to.equal(undefined);
        expect(entry.inputs.Y.shadow.type).to.equal('math_number');

        setPlaceOnGroundEnabled(true);
        expect(entry.inputs.Y.block).to.deep.equal({ type: 'ground_level' });
        expect(entry.inputs.Y.shadow.type).to.equal('math_number');

        setPlaceOnGroundEnabled(false);
        expect(entry.inputs.Y.block).to.equal(undefined);
      });

      it('leaves blocks that are not add blocks alone', function () {
        setPlaceOnGroundEnabled(true);
        expect(findEntry(toolbox.contents, 'move_to_xyz').inputs.Y.block).to.equal(undefined);
      });
    });
  });
}
