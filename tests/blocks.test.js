import { expect } from 'chai';
import * as Blockly from 'blockly';
import {
  blockHandlerRegistry,
  DISCLOSURE_CLOSED,
  DISCLOSURE_CLOSED_CODE,
  DISCLOSURE_OPEN_INLINE_CODE,
  dispatchBlockEvent,
  enableBlockHandlers,
  handleBlockCreateEvent,
  queueDisclosureSync,
  registerBlockHandler,
} from '../blocks/blocks.js';
import { setAsideBlockHandlers } from './utils/blockHandlerTestUtils.js';
import { injectTestWorkspace, disposeTestWorkspace } from './utils/blocklyTestUtils.js';
import { dismissBanner } from '../ui/notifications.js';
import { translate } from '../main/translation.js';
import { setProjectLoading } from '../main/projectLoading.js';

export function runBlocksTests() {
  describe('blocks.js tests', function () {
    this.timeout(5000);

    describe('handleBlockCreateEvent variable naming', function () {
      let mockWorkspace;
      let mockBlock;
      let mockVariableField;
      let createdVariables;
      let workspaceBlocks;

      const asVariableField = (field) =>
        Object.setPrototypeOf(field, Blockly.FieldVariable.prototype);

      const referenceBlock = (variable) => ({
        id: `ref_${variable.name}`,
        inputList: [
          {
            fieldRow: [asVariableField({ getValue: () => variable.getId(), setValue: () => {} })],
          },
        ],
      });

      const createEvent = (blockId) => ({
        type: 'create',
        blockId,
        ids: [blockId],
        recordUndo: true,
      });

      const nameOnBlock = () => mockWorkspace.getVariableById(mockVariableField.getValue())?.name;

      beforeEach(function () {
        createdVariables = new Map();

        const mockVariableMap = {
          createVariable: function (name, type) {
            const id = `var_${Math.random().toString(36).substr(2, 9)}`;
            const variable = { name, type, getId: () => id };
            createdVariables.set(id, variable);
            return variable;
          },
          getVariableById: function (id) {
            return createdVariables.get(id) || null;
          },
          getVariable: function (name) {
            for (const variable of createdVariables.values()) {
              if (variable.name === name) return variable;
            }
            return null;
          },
          getAllVariables: function () {
            return Array.from(createdVariables.values());
          },
        };

        mockWorkspace = {
          getVariableById: function (id) {
            return createdVariables.get(id) || null;
          },
          getVariableMap: function () {
            return mockVariableMap;
          },
          createVariable: function (name, type) {
            return mockVariableMap.createVariable(name, type);
          },
          getAllBlocks: function () {
            return workspaceBlocks;
          },
        };

        mockVariableField = {
          currentValue: null,
          getValue: function () {
            return this.currentValue;
          },
          setValue: function (value) {
            this.currentValue = value;
          },
        };

        mockBlock = {
          id: 'block123',
          isInFlyout: false,
          workspace: mockWorkspace,
          inputList: [],
          getField: function (fieldName) {
            return fieldName === 'ID_VAR' ? mockVariableField : null;
          },
          getDescendants: function () {
            return [this];
          },
        };

        workspaceBlocks = [mockBlock];
        setProjectLoading(false);
      });

      afterEach(function () {
        setProjectLoading(false);
      });

      it('should keep a unique name when the block is not a duplicate', function () {
        const variable = mockWorkspace.createVariable('myStar3', null);
        mockVariableField.setValue(variable.getId());

        handleBlockCreateEvent(mockBlock, createEvent('block123'), 'star');

        expect(nameOnBlock()).to.equal('myStar3');
      });

      it('should add a number to a duplicated custom name', function () {
        const variable = mockWorkspace.createVariable('myCustomStar', null);
        mockVariableField.setValue(variable.getId());
        workspaceBlocks = [mockBlock, referenceBlock(variable)];

        handleBlockCreateEvent(mockBlock, createEvent('block123'), 'star');

        expect(nameOnBlock()).to.equal('myCustomStar1');
      });

      it('should number sequential duplicates', function () {
        const star = mockWorkspace.createVariable('star', null);
        mockVariableField.setValue(star.getId());
        workspaceBlocks = [mockBlock, referenceBlock(star)];

        handleBlockCreateEvent(mockBlock, createEvent('block123'), 'star');
        expect(nameOnBlock()).to.equal('star1');

        const star1 = mockWorkspace.getVariableById(mockVariableField.getValue());
        mockBlock.id = 'block456';
        workspaceBlocks = [mockBlock, referenceBlock(star), referenceBlock(star1)];

        handleBlockCreateEvent(mockBlock, createEvent('block456'), 'star');
        expect(nameOnBlock()).to.equal('star2');
      });

      it('should preserve renamed base names on duplicate when source has no suffix', function () {
        const star = mockWorkspace.createVariable('star', null);
        mockVariableField.setValue(star.getId());
        workspaceBlocks = [mockBlock, referenceBlock(star)];

        handleBlockCreateEvent(mockBlock, createEvent('block123'), 'item');

        expect(nameOnBlock()).to.equal('star1');
      });

      it('should continue from the source suffix on duplicate', function () {
        const myStar3 = mockWorkspace.createVariable('myStar3', null);
        mockVariableField.setValue(myStar3.getId());
        workspaceBlocks = [mockBlock, referenceBlock(myStar3)];

        handleBlockCreateEvent(mockBlock, createEvent('block123'), 'item');

        expect(nameOnBlock()).to.equal('myStar4');
      });

      it('should skip names that already exist above the source suffix', function () {
        const star1 = mockWorkspace.createVariable('star1', null);
        mockWorkspace.createVariable('star2', null);
        mockVariableField.setValue(star1.getId());
        workspaceBlocks = [mockBlock, referenceBlock(star1)];

        handleBlockCreateEvent(mockBlock, createEvent('block123'), 'star');

        expect(nameOnBlock()).to.equal('star3');
      });

      it('should duplicate-check the field the block names', function () {
        const merged = mockWorkspace.createVariable('merged1', null);
        mockBlock.getField = (fieldName) => (fieldName === 'RESULT_VAR' ? mockVariableField : null);
        mockVariableField.setValue(merged.getId());
        workspaceBlocks = [mockBlock, referenceBlock(merged)];

        handleBlockCreateEvent(mockBlock, createEvent('block123'), 'merged', 'RESULT_VAR');

        expect(nameOnBlock()).to.equal('merged2');
      });

      it('should not rename variables during code loading', function () {
        setProjectLoading(true);
        const variable = mockWorkspace.createVariable('star', null);
        mockVariableField.setValue(variable.getId());
        workspaceBlocks = [mockBlock, referenceBlock(variable)];

        handleBlockCreateEvent(mockBlock, createEvent('block123'), 'star');

        expect(nameOnBlock()).to.equal('star');
      });

      it('should ignore events for different blocks', function () {
        const variable = mockWorkspace.createVariable('star', null);
        mockVariableField.setValue(variable.getId());
        workspaceBlocks = [mockBlock, referenceBlock(variable)];

        handleBlockCreateEvent(mockBlock, createEvent('different_block'), 'star');

        expect(nameOnBlock()).to.equal('star');
      });

      it('should handle missing variable field gracefully', function () {
        mockBlock.getField = () => null;

        expect(() =>
          handleBlockCreateEvent(mockBlock, createEvent('block123'), 'star')
        ).to.not.throw();
      });

      it('should handle missing variable gracefully', function () {
        mockVariableField.setValue('invalid_id');

        expect(() =>
          handleBlockCreateEvent(mockBlock, createEvent('block123'), 'star')
        ).to.not.throw();
      });
    });

    describe('material options toggle', function () {
      let workspace;

      beforeEach(function () {
        workspace = new Blockly.Workspace();
      });

      afterEach(function () {
        workspace.dispose();
      });

      const savedMaterial = (alpha) => ({
        type: 'material',
        fields: { TEXTURE_SET: 'bricks.png' },
        inputs: {
          BASE_COLOR: { shadow: { type: 'colour', fields: { COLOR: '#ff0000' } } },
          ALPHA: { shadow: { type: 'math_number', fields: { NUM: alpha } } },
        },
      });

      it('puts the toggle straight after the colour', function () {
        const block = Blockly.serialization.blocks.append({ type: 'material' }, workspace);
        const names = block.inputList.map((input) => input.name);
        expect(names.slice(names.indexOf('BASE_COLOR'))).to.deep.equal([
          'BASE_COLOR',
          'OPTIONS',
          'ALPHA',
          'SCALE',
          'ANGLE',
        ]);
        expect(block.getInputTargetBlock('ANGLE').getFieldValue('NUM')).to.equal(0);
      });

      it('loads a project saved with alpha folded, keeping its value', function () {
        const block = Blockly.serialization.blocks.append(savedMaterial(0.5), workspace);
        expect(block.getInput('ALPHA').isVisible()).to.equal(false);
        expect(block.getInput('SCALE').isVisible()).to.equal(false);
        expect(Number(block.getInputTargetBlock('ALPHA').getFieldValue('NUM'))).to.equal(0.5);
        expect(block.getInputTargetBlock('SCALE').getFieldValue('NUM')).to.equal(1);
      });

      it('round-trips the shown state through save and load', function () {
        const block = Blockly.serialization.blocks.append({ type: 'material' }, workspace);
        expect(Blockly.serialization.blocks.save(block).extraState).to.equal(undefined);

        block.toggleOptions_();
        const state = Blockly.serialization.blocks.save(block);
        expect(state.extraState).to.deep.equal({ options: true });
        const reloaded = Blockly.serialization.blocks.append(state, workspace);
        expect(reloaded.getInput('SCALE').isVisible()).to.equal(true);

        reloaded.toggleOptions_();
        expect(reloaded.getInput('ALPHA').isVisible()).to.equal(false);
        expect(Blockly.serialization.blocks.save(reloaded).extraState).to.equal(undefined);
      });

      it('keeps hidden values and blocks when folded', function () {
        const block = Blockly.serialization.blocks.append(savedMaterial(0.5), workspace);
        block.toggleOptions_();
        const scale = workspace.newBlock('math_number');
        scale.setFieldValue(3, 'NUM');
        block.getInput('SCALE').connection.connect(scale.outputConnection);

        block.toggleOptions_();
        expect(block.getInput('SCALE').isVisible()).to.equal(false);
        expect(Number(block.getInputTargetBlock('ALPHA').getFieldValue('NUM'))).to.equal(0.5);
        expect(block.getInputTargetBlock('SCALE')).to.equal(scale);

        const reloaded = Blockly.serialization.blocks.append(
          Blockly.serialization.blocks.save(block),
          workspace
        );
        expect(reloaded.getInput('ALPHA').isVisible()).to.equal(false);
        expect(Number(reloaded.getInputTargetBlock('SCALE').getFieldValue('NUM'))).to.equal(3);
      });

      it('fills the options arrow only when a hidden value is not the default', async function () {
        const plain = Blockly.serialization.blocks.append({ type: 'material' }, workspace);
        const changed = Blockly.serialization.blocks.append(savedMaterial(0.5), workspace);
        queueDisclosureSync({ workspaceId: workspace.id });
        await new Promise((resolve) => requestAnimationFrame(resolve));

        expect(plain.getField('OPTIONS_BUTTON').getValue()).to.equal(DISCLOSURE_CLOSED);
        expect(changed.getField('OPTIONS_BUTTON').getValue()).to.equal(DISCLOSURE_CLOSED_CODE);

        changed.toggleOptions_();
        expect(changed.getField('OPTIONS_BUTTON').getValue()).to.equal(DISCLOSURE_OPEN_INLINE_CODE);
      });
    });

    describe('inline on drag', function () {
      let container;
      let workspace;

      beforeEach(function () {
        container = document.createElement('div');
        container.style.width = '800px';
        container.style.height = '600px';
        document.body.appendChild(container);
        workspace = injectTestWorkspace(container, {});
      });

      afterEach(function () {
        Blockly.Events.setGroup(false);
        disposeTestWorkspace(workspace);
        container.remove();
      });

      it('places the new connections on a block dragged out of the flyout', function () {
        const block = workspace.newBlock('procedures_defnoreturn');
        block.initSvg();
        block.render();
        block.moveTo(new Blockly.utils.Coordinate(200, 150));
        block.setDragging(true);
        block.startDrag();

        expect(block.isInline).to.equal(true);
        const origin = block.getRelativeToSurfaceXY();
        const offset = block.previousConnection.getOffsetInBlock();
        expect(block.previousConnection.x).to.be.closeTo(origin.x + offset.x, 0.01);
        expect(block.previousConnection.y).to.be.closeTo(origin.y + offset.y, 0.01);
      });
    });

    describe('block event dispatch', function () {
      let workspace;
      let seen;

      const append = (state) => Blockly.serialization.blocks.append(state, workspace);
      const listen = (block, options) => {
        registerBlockHandler(block, (event) => seen.push([block.id, event.type]), options);
      };
      const heard = (block) => seen.filter(([id]) => id === block.id).map(([, type]) => type);

      // The registry is shared, and other suites leave handlers for blocks on
      // workspaces they have since disposed; set those aside for each test.
      let restoreBlockHandlers;

      beforeEach(function () {
        restoreBlockHandlers = setAsideBlockHandlers();
        workspace = new Blockly.Workspace();
        enableBlockHandlers(workspace);
        seen = [];
      });

      afterEach(function () {
        workspace.dispose();
        restoreBlockHandlers();
      });

      it('calls a block for a field change inside its inputs, not an unrelated block', function () {
        const compare = append({
          type: 'logic_compare',
          inputs: { A: { block: { type: 'math_number' } } },
        });
        const unrelated = append({ type: 'logic_compare' });
        listen(compare);
        listen(unrelated);

        dispatchBlockEvent(workspace, {
          type: Blockly.Events.BLOCK_CHANGE,
          element: 'field',
          blockId: compare.getInputTargetBlock('A').id,
        });

        expect(heard(compare)).to.deep.equal([Blockly.Events.BLOCK_CHANGE]);
        expect(heard(unrelated)).to.deep.equal([]);
      });

      it('calls a block further down a moved stack', function () {
        const top = append({
          type: 'variables_set',
          fields: { VAR: { name: 'a' } },
          next: { block: { type: 'variables_set', fields: { VAR: { name: 'b' } } } },
        });
        const below = top.getNextBlock();
        const unrelated = append({ type: 'variables_set', fields: { VAR: { name: 'c' } } });
        listen(below);
        listen(unrelated);

        dispatchBlockEvent(workspace, { type: Blockly.Events.BLOCK_MOVE, blockId: top.id });

        expect(heard(below)).to.deep.equal([Blockly.Events.BLOCK_MOVE]);
        expect(heard(unrelated)).to.deep.equal([]);
      });

      it('calls the block a child is moved out of', function () {
        const compare = append({ type: 'logic_compare' });
        const number = append({ type: 'math_number' });
        listen(compare);

        dispatchBlockEvent(workspace, {
          type: Blockly.Events.BLOCK_MOVE,
          blockId: number.id,
          oldParentId: compare.id,
        });

        expect(heard(compare)).to.deep.equal([Blockly.Events.BLOCK_MOVE]);
      });

      it('sends an event about no block in particular to every block', function () {
        const first = append({ type: 'logic_compare' });
        const second = append({ type: 'logic_compare' });
        listen(first);
        listen(second);

        dispatchBlockEvent(workspace, { type: Blockly.Events.VAR_RENAME, varId: 'x' });

        expect(heard(first)).to.deep.equal([Blockly.Events.VAR_RENAME]);
        expect(heard(second)).to.deep.equal([Blockly.Events.VAR_RENAME]);
      });

      it('sends every event to a block registered for all events', function () {
        const changed = append({ type: 'math_number' });
        const watcher = append({ type: 'logic_compare' });
        listen(watcher, { allEvents: true });

        dispatchBlockEvent(workspace, {
          type: Blockly.Events.BLOCK_CHANGE,
          element: 'field',
          blockId: changed.id,
        });

        expect(heard(watcher)).to.deep.equal([Blockly.Events.BLOCK_CHANGE]);
      });

      it('skips UI events', function () {
        const block = append({ type: 'logic_compare' });
        listen(block, { allEvents: true });

        dispatchBlockEvent(workspace, {
          type: Blockly.Events.SELECTED,
          newElementId: block.id,
          isUiEvent: true,
        });

        expect(heard(block)).to.deep.equal([]);
      });

      it("gives a deleted block's handler its own delete event, then removes it", function () {
        const block = append({ type: 'logic_compare' });
        const id = block.id;
        listen(block);
        block.dispose();
        const deleted = { type: Blockly.Events.BLOCK_DELETE, blockId: id, ids: [id] };

        dispatchBlockEvent(workspace, deleted);
        dispatchBlockEvent(workspace, deleted);

        expect(seen).to.deep.equal([[id, Blockly.Events.BLOCK_DELETE]]);
        expect(blockHandlerRegistry.has(id)).to.equal(false);
      });

      it('reports a throwing handler and still runs the others and the delete cleanup', function () {
        const thrower = append({ type: 'logic_compare' });
        const block = append({ type: 'logic_compare' });
        const id = block.id;
        const failure = new Error('handler failed');
        registerBlockHandler(
          thrower,
          () => {
            throw failure;
          },
          { allEvents: true }
        );
        listen(block);
        block.dispose();

        const logged = [];
        let bannerText;
        const originalConsoleError = console.error;
        console.error = (...args) => logged.push(args);
        try {
          dispatchBlockEvent(workspace, { type: Blockly.Events.BLOCK_DELETE, blockId: id, ids: [id] });
          bannerText = [...document.querySelectorAll('.flock-banner')]
            .map((banner) => banner.textContent)
            .join('\n');
        } finally {
          console.error = originalConsoleError;
          dismissBanner('block-handler');
        }

        expect(seen).to.deep.equal([[id, Blockly.Events.BLOCK_DELETE]]);
        expect(logged.some((args) => args.includes(failure))).to.equal(true);
        expect(bannerText).to.contain(translate('error_block_handler'));
        expect(blockHandlerRegistry.has(id)).to.equal(false);
      });
    });
  });
}
