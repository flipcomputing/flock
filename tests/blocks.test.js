import { expect } from 'chai';
import * as Blockly from 'blockly';
import { handleBlockCreateEvent } from '../blocks/blocks.js';

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
        window.loadingCode = false;
      });

      afterEach(function () {
        delete window.loadingCode;
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
        window.loadingCode = true;
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
    });
  });
}
