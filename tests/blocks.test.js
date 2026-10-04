import { expect } from 'chai';
import * as Blockly from 'blockly';
import {
  handleBlockCreateEvent,
  initializeVariableIndexes,
  nextVariableIndexes as globalNextVariableIndexes,
} from '../blocks/blocks.js';

export function runBlocksTests() {
  describe('blocks.js tests', function () {
    this.timeout(5000);

    describe('nextVariableIndexes safety', function () {
      it('should use a null-prototype object after initialization', function () {
        initializeVariableIndexes();
        expect(Object.getPrototypeOf(globalNextVariableIndexes)).to.equal(null);
      });
    });

    describe('handleBlockCreateEvent variable naming', function () {
      let mockWorkspace;
      let mockBlock;
      let mockVariableField;
      let nextVariableIndexes;
      let createdVariables;
      let workspaceBlocks;

      beforeEach(function () {
        nextVariableIndexes = { star: 1 };
        createdVariables = new Map();

        let mockVariableMap = {
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
          getVariable: function (name) {
            for (const variable of createdVariables.values()) {
              if (variable.name === name) return variable;
            }
            return null;
          },
          getVariableMap: function () {
            // Blockly returns a stable VariableMap instance, so do the same
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
        };

        workspaceBlocks = [mockBlock];
        mockVariableField.currentValue = null;
        window.loadingCode = false;
      });

      afterEach(function () {
        delete window.loadingCode;
      });

      it('should add numbers to custom variable names on duplicate', function () {
        const customVariable = mockWorkspace.createVariable('myCustomStar', null);
        mockVariableField.setValue(customVariable.getId());

        const changeEvent = {
          type: 'create',
          blockId: 'block123',
          ids: ['block123'],
          recordUndo: true,
        };

        handleBlockCreateEvent(mockBlock, changeEvent, 'star', nextVariableIndexes, 'ID_VAR');

        const newVariable = mockWorkspace.getVariableById(mockVariableField.getValue());
        expect(newVariable.name).to.equal('myCustomStar1');
      });

      it('should rename numbered variables to next number on duplicate', function () {
        // Start with a base "star" variable
        const starVariable = mockWorkspace.createVariable('star', null);
        const existingBlock = {
          id: 'existing_block',
          inputList: [{ fieldRow: [{ getValue: () => starVariable.getId() }] }],
        };
        workspaceBlocks = [existingBlock];

        // First duplication: star → star1
        mockVariableField.setValue(starVariable.getId());
        let changeEvent = {
          type: 'create',
          blockId: 'block123',
          ids: ['block123'],
          recordUndo: true,
        };

        handleBlockCreateEvent(mockBlock, changeEvent, 'star', nextVariableIndexes, 'ID_VAR');

        let newVariable = mockWorkspace.getVariableById(mockVariableField.getValue());
        expect(newVariable.name).to.equal('star1');

        // Second duplication: star1 → star2
        mockBlock.id = 'block456';
        changeEvent = {
          type: 'create',
          blockId: 'block456',
          ids: ['block456'],
          recordUndo: true,
        };

        handleBlockCreateEvent(mockBlock, changeEvent, 'star', nextVariableIndexes, 'ID_VAR');

        newVariable = mockWorkspace.getVariableById(mockVariableField.getValue());
        expect(newVariable.name).to.equal('star2');
      });

      it('should preserve renamed base names on duplicate when source has no suffix', function () {
        const asVariableField = (field) => {
          if (globalThis.Blockly?.FieldVariable?.prototype) {
            Object.setPrototypeOf(field, globalThis.Blockly.FieldVariable.prototype);
          }
          return field;
        };

        const starVariable = mockWorkspace.createVariable('star', null);
        mockVariableField.setValue(starVariable.getId());

        const externalReferenceField = asVariableField({
          getValue: () => starVariable.getId(),
          setValue: () => {},
        });
        workspaceBlocks = [
          mockBlock,
          {
            id: 'other_block',
            inputList: [{ fieldRow: [externalReferenceField] }],
          },
        ];

        const changeEvent = {
          type: 'create',
          blockId: 'block123',
          ids: ['block123'],
          recordUndo: true,
        };

        handleBlockCreateEvent(mockBlock, changeEvent, 'item', nextVariableIndexes, 'ID_VAR');

        const newVariable = mockWorkspace.getVariableById(mockVariableField.getValue());
        expect(newVariable.name).to.equal('star1');
      });

      it('should preserve renamed base names on duplicate when source has a suffix', function () {
        const asVariableField = (field) => {
          if (globalThis.Blockly?.FieldVariable?.prototype) {
            Object.setPrototypeOf(field, globalThis.Blockly.FieldVariable.prototype);
          }
          return field;
        };

        const star1Variable = mockWorkspace.createVariable('star1', null);
        mockVariableField.setValue(star1Variable.getId());

        const externalReferenceField = asVariableField({
          getValue: () => star1Variable.getId(),
          setValue: () => {},
        });
        workspaceBlocks = [
          mockBlock,
          {
            id: 'other_block',
            inputList: [{ fieldRow: [externalReferenceField] }],
          },
        ];

        const changeEvent = {
          type: 'create',
          blockId: 'block123',
          ids: ['block123'],
          recordUndo: true,
        };

        handleBlockCreateEvent(mockBlock, changeEvent, 'item', nextVariableIndexes, 'ID_VAR');

        const newVariable = mockWorkspace.getVariableById(mockVariableField.getValue());
        expect(newVariable.name).to.equal('star2');
      });

      it('should continue from existing numeric suffix for duplicate path', function () {
        const asVariableField = (field) => {
          if (globalThis.Blockly?.FieldVariable?.prototype) {
            Object.setPrototypeOf(field, globalThis.Blockly.FieldVariable.prototype);
          }
          return field;
        };

        const myStar3Variable = mockWorkspace.createVariable('myStar3', null);
        mockVariableField.setValue(myStar3Variable.getId());

        const externalReferenceField = asVariableField({
          getValue: () => myStar3Variable.getId(),
          setValue: () => {},
        });
        workspaceBlocks = [
          mockBlock,
          {
            id: 'other_block',
            inputList: [{ fieldRow: [externalReferenceField] }],
          },
        ];

        const changeEvent = {
          type: 'create',
          blockId: 'block123',
          ids: ['block123'],
          recordUndo: true,
        };

        handleBlockCreateEvent(mockBlock, changeEvent, 'item', nextVariableIndexes, 'ID_VAR');

        const newVariable = mockWorkspace.getVariableById(mockVariableField.getValue());
        expect(newVariable.name).to.equal('myStar4');
      });

      it('should not rename variables during code loading', function () {
        window.loadingCode = true;

        const customVariable = mockWorkspace.createVariable('myCustomStar', null);
        mockVariableField.setValue(customVariable.getId());

        const changeEvent = {
          type: 'create',
          blockId: 'block123',
          ids: ['block123'],
          recordUndo: true,
        };

        handleBlockCreateEvent(mockBlock, changeEvent, 'star', nextVariableIndexes, 'ID_VAR');

        const variable = mockWorkspace.getVariableById(mockVariableField.getValue());
        expect(variable.name).to.equal('myCustomStar');
      });

      it('should skip renaming for undo operations', function () {
        const customVariable = mockWorkspace.createVariable('myCustomStar', null);
        mockVariableField.setValue(customVariable.getId());

        const changeEvent = {
          type: 'create',
          blockId: 'block123',
          ids: ['block123'],
          recordUndo: false,
        };

        handleBlockCreateEvent(mockBlock, changeEvent, 'star', nextVariableIndexes, 'ID_VAR');

        const variable = mockWorkspace.getVariableById(mockVariableField.getValue());
        expect(variable.name).to.equal('myCustomStar');
      });

      it('should handle blocks in flyout correctly', function () {
        mockBlock.isInFlyout = true;

        const customVariable = mockWorkspace.createVariable('myCustomStar', null);
        mockVariableField.setValue(customVariable.getId());

        const changeEvent = {
          type: 'create',
          blockId: 'block123',
          ids: ['block123'],
          recordUndo: true,
        };

        handleBlockCreateEvent(mockBlock, changeEvent, 'star', nextVariableIndexes, 'ID_VAR');

        const variable = mockWorkspace.getVariableById(mockVariableField.getValue());
        expect(variable.name).to.equal('myCustomStar');
      });

      it('should ignore events for different blocks', function () {
        const customVariable = mockWorkspace.createVariable('myCustomStar', null);
        mockVariableField.setValue(customVariable.getId());

        const changeEvent = {
          type: 'create',
          blockId: 'different_block',
          ids: ['different_block'],
          recordUndo: true,
        };

        handleBlockCreateEvent(mockBlock, changeEvent, 'star', nextVariableIndexes, 'ID_VAR');

        const variable = mockWorkspace.getVariableById(mockVariableField.getValue());
        expect(variable.name).to.equal('myCustomStar');
      });

      it('should handle custom names that already have numbers', function () {
        const customNumberedVariable = mockWorkspace.createVariable('myStar3', null);
        mockVariableField.setValue(customNumberedVariable.getId());

        const changeEvent = {
          type: 'create',
          blockId: 'block123',
          ids: ['block123'],
          recordUndo: true,
        };

        handleBlockCreateEvent(mockBlock, changeEvent, 'star', nextVariableIndexes, 'ID_VAR');

        const newVariable = mockWorkspace.getVariableById(mockVariableField.getValue());
        expect(newVariable.name).to.equal('myStar4');
      });

      it('should handle missing variable field gracefully', function () {
        mockBlock.getField = function () {
          return null;
        };

        const changeEvent = {
          type: 'create',
          blockId: 'block123',
          ids: ['block123'],
          recordUndo: true,
        };

        expect(() => {
          handleBlockCreateEvent(mockBlock, changeEvent, 'star', nextVariableIndexes, 'ID_VAR');
        }).to.not.throw();
      });

      it('should handle missing variable gracefully', function () {
        mockVariableField.setValue('invalid_id');

        const changeEvent = {
          type: 'create',
          blockId: 'block123',
          ids: ['block123'],
          recordUndo: true,
        };

        expect(() => {
          handleBlockCreateEvent(mockBlock, changeEvent, 'star', nextVariableIndexes, 'ID_VAR');
        }).to.not.throw();
      });

      it('should handle sequential duplications correctly', function () {
        // First duplication: myCustomStar -> myCustomStar1
        let currentVariable = mockWorkspace.createVariable('myCustomStar', null);
        mockVariableField.setValue(currentVariable.getId());

        let changeEvent = {
          type: 'create',
          blockId: 'block123',
          ids: ['block123'],
          recordUndo: true,
        };

        handleBlockCreateEvent(mockBlock, changeEvent, 'star', nextVariableIndexes, 'ID_VAR');

        let newVariable = mockWorkspace.getVariableById(mockVariableField.getValue());
        expect(newVariable.name).to.equal('myCustomStar1');

        // Second duplication: myCustomStar1 -> myCustomStar2
        mockBlock.id = 'block456';
        changeEvent.blockId = 'block456';
        changeEvent.ids = ['block456'];

        handleBlockCreateEvent(mockBlock, changeEvent, 'star', nextVariableIndexes, 'ID_VAR');

        newVariable = mockWorkspace.getVariableById(mockVariableField.getValue());
        expect(newVariable.name).to.equal('myCustomStar2');
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
