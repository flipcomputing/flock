import * as Blockly from "blockly";
import { categoryColours} from "../toolbox.js";
import { nextVariableIndexes, findCreateBlock, handleBlockCreateEvent} from "../blocks.js";
import { updateOrCreateMeshFromBlock } from "../ui/designview.js";

export function defineShapeBlocks() {

	function createShapeBlockDefinition({
		type,
		variableNamePrefix,
		message0,
		additionalArgs0,
		tooltip,
	}) {
		Blockly.Blocks[type] = {
			init: function () {
				// Generate the next variable name based on the prefix
				let nextVariableName =
					variableNamePrefix + nextVariableIndexes[variableNamePrefix];

				// Common arguments for all shape blocks
				let args0 = [
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
					...additionalArgs0, // Shape-specific arguments
					{ type: "input_value", name: "X", check: "Number" },
					{ type: "input_value", name: "Y", check: "Number" },
					{ type: "input_value", name: "Z", check: "Number" },
				];

				// Initialize the block with JSON definition
				this.jsonInit({
					type: type,
					message0: message0,
					args0: args0,
					previousStatement: null,
					nextStatement: null,
					inputsInline: true,
					colour: categoryColours["Scene"],
					tooltip: tooltip,
					helpUrl: "",
				});

				// Set up an event handler to manage changes to the block
				this.setOnChange((changeEvent) => handleBlockChange(this, changeEvent, variableNamePrefix));
			},
		};
	}

	// Extracted common change handler
	function handleBlockChange(block, changeEvent, variableNamePrefix) {
		if (
			(changeEvent.type === Blockly.Events.BLOCK_CREATE ||
				changeEvent.type === Blockly.Events.BLOCK_CHANGE) &&
			changeEvent.workspaceId === Blockly.getMainWorkspace().id
		) {
			// Update the mesh or create a new one if necessary
			const parent = findCreateBlock(
				Blockly.getMainWorkspace().getBlockById(changeEvent.blockId)
			);

			if (parent === block) {
				const blockInWorkspace = Blockly.getMainWorkspace().getBlockById(block.id);
				if (blockInWorkspace) {
					updateOrCreateMeshFromBlock(block);
				}
			}

			handleBlockCreateEvent(block, changeEvent, variableNamePrefix, nextVariableIndexes);
		}
	}

	// Define all shape blocks with a shared function
	const shapes = [
		{
			type: "create_box",
			variableNamePrefix: "box",
			message0: "new box %1 %2 width %3 height %4 depth %5 \nat x %6 y %7 z %8",
			additionalArgs0: [
				{ type: "input_value", name: "WIDTH", check: "Number" },
				{ type: "input_value", name: "HEIGHT", check: "Number" },
				{ type: "input_value", name: "DEPTH", check: "Number" },
			],
			tooltip: "Creates a colored box with specified dimensions and position.\nKeyword: box",
		},
		{
			type: "create_sphere",
			variableNamePrefix: "sphere",
			message0: "new sphere %1 %2 diameter x %3 diameter y %4 diameter z %5\nat x %6 y %7 z %8",
			additionalArgs0: [
				{ type: "input_value", name: "DIAMETER_X", check: "Number" },
				{ type: "input_value", name: "DIAMETER_Y", check: "Number" },
				{ type: "input_value", name: "DIAMETER_Z", check: "Number" },
			],
			tooltip: "Creates a colored sphere with specified dimensions and position.\nKeyword: sphere",
		},
		{
			type: "create_cylinder",
			variableNamePrefix: "cylinder",
			message0: "new cylinder %1 %2 height %3 top %4 bottom %5 \nat x %6 y %7 z %8",
			additionalArgs0: [
				{ type: "input_value", name: "HEIGHT", check: "Number" },
				{ type: "input_value", name: "DIAMETER_TOP", check: "Number" },
				{ type: "input_value", name: "DIAMETER_BOTTOM", check: "Number" },
			],
			tooltip: "Creates a colored cylinder with specified dimensions and position.\nKeyword: cylinder",
		},
		{
			type: "create_capsule",
			variableNamePrefix: "capsule",
			message0: "new capsule %1 %2 radius %3 height %4 \nat x %5 y %6 z %7",
			additionalArgs0: [
				{ type: "input_value", name: "RADIUS", check: "Number" },
				{ type: "input_value", name: "HEIGHT", check: "Number" },
			],
			tooltip: "Creates a colored capsule with specified dimensions and position.\nKeyword: capsule",
		},
		{
			type: "create_plane",
			variableNamePrefix: "plane",
			message0: "new plane %1 %2 width %3 height %4 \nat x %5 y %6 z %7",
			additionalArgs0: [
				{ type: "input_value", name: "WIDTH", check: "Number" },
				{ type: "input_value", name: "HEIGHT", check: "Number" },
			],
			tooltip: "Creates a colored 2D plane with specified width, height, and position.\nKeyword: plane",
		},
	];

	// Register shape blocks using the common definition
	shapes.forEach((shape) => createShapeBlockDefinition(shape));
}
