import * as Blockly from "blockly";
import { categoryColours} from "../toolbox.js";
import { nextVariableIndexes, handleBlockCreateEvent, findCreateBlock, addDoMutatorWithToggleBehavior} from "../blocks.js";
import { updateOrCreateMeshFromBlock } from "../ui/designview.js";

export function defineShapeBlocks() {
	Blockly.Blocks["create_box"] = {
		init: function () {
			const variableNamePrefix = "box";
			let nextVariableName =
				variableNamePrefix + nextVariableIndexes[variableNamePrefix]; // Start with "box1";

			this.jsonInit({
				type: "create_box",
				message0:
					"new box %1 %2 width %3 height %4 depth %5 \n at x %6 y %7 z %8",
				args0: [
					{
						type: "field_variable",
						name: "ID_VAR",
						variable: nextVariableName,
					},
					{
						type: "input_value",
						name: "COLOR",
						colour: "#9932CC",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "WIDTH",
						check: "Number",
					},
					{
						type: "input_value",
						name: "HEIGHT",
						check: "Number",
					},
					{
						type: "input_value",
						name: "DEPTH",
						check: "Number",
					},
					{
						type: "input_value",
						name: "X",
						check: "Number",
					},
					{
						type: "input_value",
						name: "Y",
						check: "Number",
					},
					{
						type: "input_value",
						name: "Z",
						check: "Number",
					},
				],
				previousStatement: null,
				nextStatement: null,
				inputsInline: true,
				colour: categoryColours["Scene"],
				tooltip:
					"Creates a colored box with specified dimensions and position.\nKeyword: box",
				helpUrl: "",
			});

			this.setOnChange((changeEvent) => {
				if (
					(changeEvent.type === Blockly.Events.BLOCK_CREATE ||
						changeEvent.type === Blockly.Events.BLOCK_CHANGE) &&
					changeEvent.workspaceId === Blockly.getMainWorkspace().id
				) {
					const parent = findCreateBlock(
						Blockly.getMainWorkspace().getBlockById(
							changeEvent.blockId,
						),
					);

					if (parent === this) {
						const blockInWorkspace =
							Blockly.getMainWorkspace().getBlockById(this.id);

						if (blockInWorkspace) {
							updateOrCreateMeshFromBlock(this);
						}
					}
				}

				handleBlockCreateEvent(
					this,
					changeEvent,
					variableNamePrefix,
					nextVariableIndexes,
				);
			});
			addDoMutatorWithToggleBehavior(this);
		},
	};

	Blockly.Blocks["create_sphere"] = {
		init: function () {
			const variableNamePrefix = "sphere";
			let nextVariableName =
				variableNamePrefix + nextVariableIndexes[variableNamePrefix];
			this.jsonInit({
				type: "create_sphere",
				message0:
					"new sphere %1 %2 diameter x %3 diameter y %4 diameter z %5\nat x %6 y %7 z %8",
				args0: [
					{
						type: "field_variable",
						name: "ID_VAR",
						variable: nextVariableName,
					},
					{
						type: "input_value",
						name: "COLOR",
						colour: "#9932CC",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "DIAMETER_X",
						check: "Number",
					},
					{
						type: "input_value",
						name: "DIAMETER_Y",
						check: "Number",
					},
					{
						type: "input_value",
						name: "DIAMETER_Z",
						check: "Number",
					},
					{
						type: "input_value",
						name: "X",
						check: "Number",
					},
					{
						type: "input_value",
						name: "Y",
						check: "Number",
					},
					{
						type: "input_value",
						name: "Z",
						check: "Number",
					},
				],
				previousStatement: null,
				nextStatement: null,
				inputsInline: true,
				colour: categoryColours["Scene"],
				tooltip:
					"Creates a colored sphere with specified dimensions and position.\nKeyword: sphere",
				helpUrl: "",
			});

			this.setOnChange((changeEvent) => {
				if (
					(changeEvent.type === Blockly.Events.BLOCK_CREATE ||
						changeEvent.type === Blockly.Events.BLOCK_CHANGE) &&
					changeEvent.workspaceId === Blockly.getMainWorkspace().id
				) {
					const parent = findCreateBlock(
						Blockly.getMainWorkspace().getBlockById(
							changeEvent.blockId,
						),
					);
					if (parent == this) {
						const blockInWorkspace =
							Blockly.getMainWorkspace().getBlockById(this.id);

						if (blockInWorkspace) {
							updateOrCreateMeshFromBlock(this);
						}
					}
				}

				handleBlockCreateEvent(
					this,
					changeEvent,
					variableNamePrefix,
					nextVariableIndexes,
				);
			});

			addDoMutatorWithToggleBehavior(this);
		},
	};

	Blockly.Blocks["create_cylinder"] = {
		init: function () {
			const variableNamePrefix = "cylinder";
			let nextVariableName =
				variableNamePrefix + nextVariableIndexes[variableNamePrefix];
			this.jsonInit({
				type: "create_cylinder",
				message0:
					"new cylinder %1 %2 height %3 top %4 bottom %5 \nat x %6 y %7 z %8",
				args0: [
					{
						type: "field_variable",
						name: "ID_VAR",
						variable: nextVariableName,
					},
					{
						type: "input_value",
						name: "COLOR",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "HEIGHT",
						check: "Number",
					},
					{
						type: "input_value",
						name: "DIAMETER_TOP",
						check: "Number",
					},
					{
						type: "input_value",
						name: "DIAMETER_BOTTOM",
						check: "Number",
					},
					{
						type: "input_value",
						name: "X",
						check: "Number",
					},
					{
						type: "input_value",
						name: "Y",
						check: "Number",
					},
					{
						type: "input_value",
						name: "Z",
						check: "Number",
					},
				],
				previousStatement: null,
				nextStatement: null,
				inputsInline: true,
				colour: categoryColours["Scene"],
				tooltip:
					"Creates a colored cylinder with specified dimensions and position.\nKeyword: cylinder",
				helpUrl: "",
			});

			this.setOnChange((changeEvent) => {
				if (
					(changeEvent.type === Blockly.Events.BLOCK_CREATE ||
						changeEvent.type === Blockly.Events.BLOCK_CHANGE) &&
					changeEvent.workspaceId === Blockly.getMainWorkspace().id
				) {
					const parent = findCreateBlock(
						Blockly.getMainWorkspace().getBlockById(
							changeEvent.blockId,
						),
					);

					if (parent && parent === this) {
						const blockInWorkspace =
							Blockly.getMainWorkspace().getBlockById(this.id);

						if (blockInWorkspace) {
							updateOrCreateMeshFromBlock(this);
						}
					}
				}
				handleBlockCreateEvent(
					this,
					changeEvent,
					variableNamePrefix,
					nextVariableIndexes,
				);
			});

			addDoMutatorWithToggleBehavior(this);
		},
	};
	Blockly.Blocks["create_capsule"] = {
		init: function () {
			const variableNamePrefix = "capsule";
			let nextVariableName =
				variableNamePrefix + nextVariableIndexes[variableNamePrefix];
			this.jsonInit({
				type: "create_capsule",
				message0:
					"new capsule %1 %2 radius %3 height %4 \n at x %5 y %6 z %7",
				args0: [
					{
						type: "field_variable",
						name: "ID_VAR",
						variable: nextVariableName,
					},
					{
						type: "input_value",
						name: "COLOR",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "RADIUS",
						check: "Number",
					},
					{
						type: "input_value",
						name: "HEIGHT",
						check: "Number",
					},
					{
						type: "input_value",
						name: "X",
						check: "Number",
					},
					{
						type: "input_value",
						name: "Y",
						check: "Number",
					},
					{
						type: "input_value",
						name: "Z",
						check: "Number",
					},
				],
				previousStatement: null,
				nextStatement: null,
				inputsInline: true,
				colour: categoryColours["Scene"],
				tooltip:
					"Creates a colored capsule with specified dimensions and position.\nKeyword: capsule",
				helpUrl: "",
			});

			this.setOnChange((changeEvent) => {
				if (
					(changeEvent.type === Blockly.Events.BLOCK_CREATE ||
						changeEvent.type === Blockly.Events.BLOCK_CHANGE) &&
					changeEvent.workspaceId === Blockly.getMainWorkspace().id
				) {
					const parent = findCreateBlock(
						Blockly.getMainWorkspace().getBlockById(
							changeEvent.blockId,
						),
					);
					if (parent == this) {
						const blockInWorkspace =
							Blockly.getMainWorkspace().getBlockById(this.id);

						if (blockInWorkspace) {
							updateOrCreateMeshFromBlock(this);
						}
					}
				}

				handleBlockCreateEvent(
					this,
					changeEvent,
					variableNamePrefix,
					nextVariableIndexes,
				);
			});

			addDoMutatorWithToggleBehavior(this);
		},
	};

	Blockly.Blocks["create_plane"] = {
		init: function () {
			const variableNamePrefix = "plane";
			let nextVariableName =
				variableNamePrefix + nextVariableIndexes[variableNamePrefix]; // Ensure 'plane' is managed in your nextVariableIndexes
			this.jsonInit({
				type: "create_plane",
				message0:
					"new plane %1 %2 width %3 height %4 \n at x %5 y %6 z %7",
				args0: [
					{
						type: "field_variable",
						name: "ID_VAR",
						variable: nextVariableName,
					},
					{
						type: "input_value",
						name: "COLOR",
						colour: "#9932CC",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "WIDTH",
						check: "Number",
					},
					{
						type: "input_value",
						name: "HEIGHT",
						check: "Number",
					},
					{
						type: "input_value",
						name: "X",
						check: "Number",
					},
					{
						type: "input_value",
						name: "Y",
						check: "Number",
					},
					{
						type: "input_value",
						name: "Z",
						check: "Number",
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Scene"],
				tooltip:
					"Creates a colored 2D plane with specified width, height, and position.\nKeyword: plane",
				helpUrl: "",
			});

			this.setOnChange((changeEvent) => {
				if (
					changeEvent.type === Blockly.Events.BLOCK_CREATE ||
					changeEvent.type === Blockly.Events.BLOCK_CHANGE  &&
					changeEvent.workspaceId === Blockly.getMainWorkspace().id
				) {
					const blockInWorkspace =
						Blockly.getMainWorkspace().getBlockById(this.id); // Check if block is in the main workspace

					if (blockInWorkspace) {
						updateOrCreateMeshFromBlock(this);
					}
				}

				handleBlockCreateEvent(
					this,
					changeEvent,
					variableNamePrefix,
					nextVariableIndexes,
				);
			});

			addDoMutatorWithToggleBehavior(this);
		},
	};

}
