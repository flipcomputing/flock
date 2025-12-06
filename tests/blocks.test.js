import { expect } from "chai";
import { handleBlockCreateEvent } from "../blocks/blocks.js";

export function runBlocksTests() {
        describe("blocks.js tests", function () {
                this.timeout(5000);

                describe("handleBlockCreateEvent variable naming", function () {
                        let mockWorkspace;
                        let mockBlock;
                        let mockVariableField;
                        let nextVariableIndexes;
                        let createdVariables;

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
      return [mockBlock];
    },
  };

  mockVariableField = {
    currentValue: null,
    getValue: function () { return this.currentValue; },
    setValue: function (value) { this.currentValue = value; }
  };

  mockBlock = {
    id: "block123",
    isInFlyout: false,
    workspace: mockWorkspace,
    getField: function (fieldName) {
      return fieldName === "ID_VAR" ? mockVariableField : null;
    }
  };

  mockVariableField.currentValue = null;
  window.loadingCode = false;
});


                        afterEach(function () {
                                delete window.loadingCode;
                        });

      it("should add numbers to custom variable names on duplicate", function () {
        const customVariable = mockWorkspace.createVariable("myCustomStar", null);
        mockVariableField.setValue(customVariable.getId());

        const changeEvent = {
            type: "create",
            blockId: "block123", 
            ids: ["block123"],
            recordUndo: true
        };

        handleBlockCreateEvent(
            mockBlock,
            changeEvent,
            "star",
            nextVariableIndexes,
            "ID_VAR"
        );

        const newVariable = mockWorkspace.getVariableById(mockVariableField.getValue());
        expect(newVariable.name).to.equal("myCustomStar1");
      });

                        it("should rename numbered variables to next number on duplicate", function () {
                                const star1Variable = mockWorkspace.createVariable("star1", null);
                                mockVariableField.setValue(star1Variable.getId());

                                nextVariableIndexes.star = 2;

                                const changeEvent = {
                                        type: "create",
                                        blockId: "block123",
                                        ids: ["block123"],
                                        recordUndo: true
                                };

                                handleBlockCreateEvent(
                                        mockBlock,
                                        changeEvent,
                                        "star",
                                        nextVariableIndexes,
                                        "ID_VAR"
                                );

                                const newVariable = mockWorkspace.getVariableById(mockVariableField.getValue());
                                expect(newVariable.name).to.equal("star2");
                        });

      it("should not rename variables during code loading", function () {
        window.loadingCode = true;

        const customVariable = mockWorkspace.createVariable("myCustomStar", null);
        mockVariableField.setValue(customVariable.getId());

        const changeEvent = {
            type: "create",
            blockId: "block123",
            ids: ["block123"],
            recordUndo: true
        };

        handleBlockCreateEvent(
            mockBlock,
            changeEvent,
            "star",
            nextVariableIndexes,
            "ID_VAR"
        );

        const variable = mockWorkspace.getVariableById(mockVariableField.getValue());
        expect(variable.name).to.equal("myCustomStar");
      });

      it("should skip renaming for undo operations", function () {
        const customVariable = mockWorkspace.createVariable("myCustomStar", null);
        mockVariableField.setValue(customVariable.getId());

        const changeEvent = {
            type: "create",
            blockId: "block123",
            ids: ["block123"],
            recordUndo: false
        };

        handleBlockCreateEvent(
            mockBlock,
            changeEvent,
            "star",
            nextVariableIndexes,
            "ID_VAR"
        );

        const variable = mockWorkspace.getVariableById(mockVariableField.getValue());
        expect(variable.name).to.equal("myCustomStar");
      });

      it("should handle blocks in flyout correctly", function () {
        mockBlock.isInFlyout = true;

        const customVariable = mockWorkspace.createVariable("myCustomStar", null);
        mockVariableField.setValue(customVariable.getId());

        const changeEvent = {
            type: "create",
            blockId: "block123",
            ids: ["block123"],
            recordUndo: true
        };

        handleBlockCreateEvent(
            mockBlock,
            changeEvent,
            "star",
            nextVariableIndexes,
            "ID_VAR"
        );

        const variable = mockWorkspace.getVariableById(mockVariableField.getValue());
        expect(variable.name).to.equal("myCustomStar");
      });

      it("should ignore events for different blocks", function () {
        const customVariable = mockWorkspace.createVariable("myCustomStar", null);
        mockVariableField.setValue(customVariable.getId());

        const changeEvent = {
            type: "create",
            blockId: "different_block",
            ids: ["different_block"],
            recordUndo: true
        };

        handleBlockCreateEvent(
            mockBlock,
            changeEvent,
            "star",
            nextVariableIndexes,
            "ID_VAR"
        );

        const variable = mockWorkspace.getVariableById(mockVariableField.getValue());
        expect(variable.name).to.equal("myCustomStar");
      });

      it("should handle custom names that already have numbers", function () {
        const customNumberedVariable = mockWorkspace.createVariable("myStar3", null);
        mockVariableField.setValue(customNumberedVariable.getId());

        const changeEvent = {
            type: "create",
            blockId: "block123",
            ids: ["block123"],
            recordUndo: true
        };

        handleBlockCreateEvent(
            mockBlock,
            changeEvent,
            "star",
            nextVariableIndexes,
            "ID_VAR"
        );

        const newVariable = mockWorkspace.getVariableById(mockVariableField.getValue());
        expect(newVariable.name).to.equal("myStar4");
      });

      it("should handle missing variable field gracefully", function () {
        mockBlock.getField = function() { return null; };

        const changeEvent = {
            type: "create",
            blockId: "block123",
            ids: ["block123"],
            recordUndo: true
        };

        expect(() => {
            handleBlockCreateEvent(
                mockBlock,
                changeEvent,
                "star",
                nextVariableIndexes,
                "ID_VAR"
            );
        }).to.not.throw();
      });

      it("should handle missing variable gracefully", function () {
        mockVariableField.setValue("invalid_id");

        const changeEvent = {
            type: "create",
            blockId: "block123",
            ids: ["block123"],
            recordUndo: true
        };

        expect(() => {
            handleBlockCreateEvent(
                mockBlock,
                changeEvent,
                "star",
                nextVariableIndexes,
                "ID_VAR"
            );
        }).to.not.throw();
      });

      it("should handle sequential duplications correctly", function () {
        // First duplication: myCustomStar -> myCustomStar1
        let currentVariable = mockWorkspace.createVariable("myCustomStar", null);
        mockVariableField.setValue(currentVariable.getId());

        let changeEvent = {
            type: "create",
            blockId: "block123",
            ids: ["block123"],
            recordUndo: true
        };

        handleBlockCreateEvent(mockBlock, changeEvent, "star", nextVariableIndexes, "ID_VAR");

        let newVariable = mockWorkspace.getVariableById(mockVariableField.getValue());
        expect(newVariable.name).to.equal("myCustomStar1");

        // Second duplication: myCustomStar1 -> myCustomStar2
        mockBlock.id = "block456";
        changeEvent.blockId = "block456";
        changeEvent.ids = ["block456"];

        handleBlockCreateEvent(mockBlock, changeEvent, "star", nextVariableIndexes, "ID_VAR");

        newVariable = mockWorkspace.getVariableById(mockVariableField.getValue());
        expect(newVariable.name).to.equal("myCustomStar2");
      });
    });
        });
}