import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
	nextVariableIndexes,
	findCreateBlock,
	handleBlockCreateEvent,
	handleMeshLifecycleChange,
	handleFieldOrChildChange,
	addDoMutatorWithToggleBehavior,
	handleParentLinkedUpdate,
	getHelpUrlFor,
} from "../blocks.js";
import {
	characterNames,
	objectNames,
	multiObjectNames,
	objectColours,
	modelNames,
} from "../config.js";
import { flock } from "../flock.js";

export function defineModelBlocks() {
	Blockly.Blocks["load_character"] = {
		init: function () {
			const variableNamePrefix = "character";
			let nextVariableName =
				variableNamePrefix + nextVariableIndexes[variableNamePrefix];
			this.jsonInit({
				message0: `set %1 to %2 scale: %3 x: %4 y: %5 z: %6
					Hair: %7 |  Skin: %8 |  Eyes: %9 |  T-Shirt: %10 |  Shorts: %11 |  Detail: %12`,
				args0: [
					{
						type: "field_variable",
						name: "ID_VAR",
						variable: nextVariableName,
					},
					{
						type: "field_grid_dropdown",
						name: "MODELS",
						columns: 6,
						options: characterNames.map((name) => {
							const baseName = name.replace(/\.[^/.]+$/, "");
							return [
								{
									src: `${flock.imagePath}${baseName}.png`,
									width: 50,
									height: 50,
									alt: baseName,
								},
								name,
							];
						}),
					},
					{
						type: "input_value",
						name: "SCALE",
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
					{
						type: "input_value",
						name: "HAIR_COLOR",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "SKIN_COLOR",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "EYES_COLOR",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "TSHIRT_COLOR",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "SHORTS_COLOR",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "SLEEVES_COLOR",
						check: "Colour",
					},
				],
				inputsInline: true,
				colour: categoryColours["Scene"],
				tooltip: "Create a configurable character.\nKeyword: character",
				previousStatement: null,
				nextStatement: null,
			});
			this.setHelpUrl(getHelpUrlFor(this.type));

			this.setOnChange((changeEvent) => {
				// Always handle variable naming first (even if mesh is skipped)
				handleBlockCreateEvent(
					this,
					changeEvent,
					variableNamePrefix,
					nextVariableIndexes,
				);

				// Mesh lifecycle events on this block directly (e.g. enable/disable, move)
				if (changeEvent.blockId === this.id) {
					if (handleMeshLifecycleChange(this, changeEvent)) return;
				}

				// Linked children like MODELS or color inputs
				if (handleParentLinkedUpdate(this, changeEvent)) {
					// 🔹 Additional side-effect unique to this block type
					window.updateCurrentMeshName(this, "ID_VAR");
					return;
				}

				if (handleFieldOrChildChange(this, changeEvent)) {
					return;
				}
			});

			addDoMutatorWithToggleBehavior(this);
		},
	};

	Blockly.Blocks["load_object"] = {
		init: function () {
			const defaultObject = "Star.glb";
			const defaultColours = objectColours[defaultObject];
			const defaultColour = Array.isArray(defaultColours)
				? defaultColours[0]
				: defaultColours || "#FFD700";
			const variableNamePrefix = "object";
			let nextVariableName =
				variableNamePrefix + nextVariableIndexes[variableNamePrefix];

			// Add the main inputs of the block
			this.jsonInit({
				message0: `set %1 to %2 %3 scale: %4 x: %5 y: %6 z: %7`,
				args0: [
					{
						type: "field_variable",
						name: "ID_VAR",
						variable: nextVariableName,
					},
					{
						type: "field_grid_dropdown",
						name: "MODELS",
						columns: 6,
						options: objectNames.map((name) => {
							const baseName = name.replace(/\.[^/.]+$/, "");
							return [
								{
									src: `${flock.imagePath}${baseName}.png`,
									width: 50,
									height: 50,
									alt: baseName,
								},
								name,
							];
						}),
					},
					{
						type: "input_value",
						name: "COLOR",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "SCALE",
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
				colour: categoryColours["Scene"],
				tooltip: "Create an object.\nKeyword: object",
				previousStatement: null,
				nextStatement: null,
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			// Function to update the COLOR field based on the selected model
			const updateColorField = () => {
				const selectedObject = this.getFieldValue("MODELS");
				const configColors = objectColours[selectedObject];
				const colour = Array.isArray(configColors)
					? configColors[0]
					: configColors || defaultColour;
				const colorInput = this.getInput("COLOR");
				const colorField = colorInput.connection.targetBlock();
				if (colorField) {
					colorField.setFieldValue(colour, "COLOR"); // Update COLOR field
				}
			};

			updateColorField();

			this.setOnChange((changeEvent) => {
				handleBlockCreateEvent(
					this,
					changeEvent,
					variableNamePrefix,
					nextVariableIndexes,
				);

				if (
					this.id !== changeEvent.blockId &&
					changeEvent.type !== Blockly.Events.BLOCK_CHANGE
				)
					return;

				if (handleMeshLifecycleChange(this, changeEvent)) return;
				if (handleFieldOrChildChange(this, changeEvent)) return;
			});

			addDoMutatorWithToggleBehavior(this);
		},
	};

	Blockly.Blocks["load_multi_object"] = {
		init: function () {
			const variableNamePrefix = "object";
			let nextVariableName =
				variableNamePrefix + nextVariableIndexes[variableNamePrefix];

			this.jsonInit({
				message0:
					"set %1 to %2 scale: %3 x: %4 y: %5 z: %6\ncolors: %7",
				args0: [
					{
						type: "field_variable",
						name: "ID_VAR",
						variable: nextVariableName,
					},
					{
						type: "field_grid_dropdown",
						name: "MODELS",
						columns: 6,
						options: multiObjectNames.map((name) => {
							const baseName = name.replace(/\.[^/.]+$/, "");
							return [
								{
									src: `${flock.imagePath}/${baseName}.png`,
									width: 50,
									height: 50,
									alt: baseName,
								},
								name,
							];
						}),
					},
					{
						type: "input_value",
						name: "SCALE",
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
					{
						type: "input_value",
						name: "COLORS",
						check: "Array",
					},
				],
				inputsInline: true,
				colour: categoryColours["Scene"],
				tooltip: "Create an object with colours.\nKeyword: object",
				previousStatement: null,
				nextStatement: null,
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			// Change from a local constant to a method on the block prototype
			Blockly.Blocks["load_multi_object"].updateColorsField =
				function () {
					const selectedObject = this.getFieldValue("MODELS");
					const colours = objectColours[selectedObject] || [
						"#000000",
						"#FFFFFF",
						"#CCCCCC",
					];
					const requiredItemCount = colours.length;
					const colorsInput = this.getInput("COLORS");
					let listBlock = colorsInput.connection?.targetBlock();

					// Create a mutation element with the correct number of items.
					const mutation = document.createElement("mutation");
					mutation.setAttribute("items", requiredItemCount);

					if (listBlock && listBlock.type === "lists_create_with") {
						// Apply the mutation to update the block's inputs.
						listBlock.domToMutation(mutation);

						// Remove any extra inputs beyond the required count.
						listBlock.inputList
							.filter(
								(input) =>
									input.name && input.name.startsWith("ADD"),
							)
							.forEach((input) => {
								const index = parseInt(input.name.substring(3));
								if (index >= requiredItemCount) {
									listBlock.removeInput(input.name);
								}
							});

						// For each required input, update or create its shadow colour block.
						for (let i = 0; i < requiredItemCount; i++) {
							let input = listBlock.getInput("ADD" + i);
							if (!input) {
								input = listBlock
									.appendValueInput("ADD" + i)
									.setCheck("Colour");
							}
							let shadowBlock = input.connection?.targetBlock();
							if (!shadowBlock || !shadowBlock.isShadow()) {
								shadowBlock =
									listBlock.workspace.newBlock("colour");
								shadowBlock.setFieldValue(
									colours[i] || "#000000",
									"COLOR",
								);
								shadowBlock.setShadow(true);
								shadowBlock.initSvg();
								input.connection.connect(
									shadowBlock.outputConnection,
								);
							} else {
								shadowBlock.setFieldValue(
									colours[i] || "#000000",
									"COLOR",
								);
							}
						}
						listBlock.initSvg();
						listBlock.render();
					} else if (!listBlock) {
						// Create a new list block.
						listBlock =
							this.workspace.newBlock("lists_create_with");
						listBlock.setShadow(true);
						listBlock.domToMutation(mutation);
						for (let i = 0; i < requiredItemCount; i++) {
							let input = listBlock.getInput("ADD" + i);
							if (!input) {
								input = listBlock
									.appendValueInput("ADD" + i)
									.setCheck("Colour");
							}
							const shadowBlock =
								listBlock.workspace.newBlock("colour");
							shadowBlock.setFieldValue(
								colours[i] || "#000000",
								"COLOR",
							);
							shadowBlock.setShadow(true);
							shadowBlock.initSvg();
							input.connection.connect(
								shadowBlock.outputConnection,
							);
						}
						listBlock.setInputsInline(true);
						listBlock.setTooltip(
							Blockly.Msg["LISTS_CREATE_WITH_TOOLTIP"] ||
								"Create a list of colours.",
						);
						listBlock.setHelpUrl(
							"https://developers.google.com/blockly/guides/create-custom-blocks/define-blocks",
						);
						listBlock.initSvg();
						listBlock.render();
						colorsInput.connection.connect(
							listBlock.outputConnection,
						);
					}
				};

			Blockly.Blocks["load_multi_object"].updateColorAtIndex = function (
				colour,
				colourIndex,
			) {
				//console.log("Update colour", colour, colourIndex);
				const colorsInput = this.getInput("COLORS");
				if (!colorsInput || !colorsInput.connection) {
					return;
				}
				const listBlock = colorsInput.connection.targetBlock();
				if (!listBlock || listBlock.type !== "lists_create_with") {
					console.log("List block not found or of incorrect type.");
					return;
				}

				const inputName = "ADD" + colourIndex;
				let input = listBlock.getInput(inputName);
				if (!input) {
					//input = listBlock.appendValueInput(inputName).setCheck("Colour");
					return;
				}

				let shadowBlock = input.connection?.targetBlock();
				if (!shadowBlock || !shadowBlock.isShadow()) {
					shadowBlock = listBlock.workspace.newBlock("colour");
					shadowBlock.setShadow(true);
					shadowBlock.initSvg();
					input.connection.connect(shadowBlock.outputConnection);
				}

				shadowBlock.setFieldValue(colour, "COLOR");
				shadowBlock.render();
				listBlock.render();
			};

			this.setOnChange((changeEvent) => {
				handleBlockCreateEvent(
					this,
					changeEvent,
					variableNamePrefix,
					nextVariableIndexes,
				);

				// Always handle mesh lifecycle if the event targets this block
				if (changeEvent.blockId === this.id) {
					if (handleMeshLifecycleChange(this, changeEvent)) return;
				}

				// For attached children or value inputs
				if (
					handleParentLinkedUpdate(this, changeEvent) ||
					handleFieldOrChildChange(this, changeEvent)
				) {
					return;
				}

				// Special case: refresh color options when model field changes
				if (
					changeEvent.type === Blockly.Events.BLOCK_CHANGE &&
					changeEvent.element === "field" &&
					changeEvent.name === "MODELS" &&
					changeEvent.blockId === this.id
				) {
					const blockInWorkspace =
						Blockly.getMainWorkspace().getBlockById(this.id);
					if (blockInWorkspace) {
						this.updateColorsField();
					}
				}
			});

			addDoMutatorWithToggleBehavior(this);
		},
	};

	Blockly.Blocks["load_model"] = {
		init: function () {
			const variableNamePrefix = "model";
			let nextVariableName =
				variableNamePrefix + nextVariableIndexes[variableNamePrefix]; // Start with "model1"

			this.jsonInit({
				message0: "set %1 to %2 scale: %3 x: %4 y: %5 z: %6",
				args0: [
					{
						type: "field_variable",
						name: "ID_VAR",
						variable: nextVariableName,
					},
					{
						type: "field_grid_dropdown",
						name: "MODELS",
						columns: 6,
						options: modelNames.map((name) => {
							const baseName = name.replace(/\.[^/.]+$/, "");
							return [
								{
									src: `${flock.imagePath}${baseName}.png`,
									width: 50,
									height: 50,
									alt: baseName,
								},
								name,
							];
						}),
					},
					{
						type: "input_value",
						name: "SCALE",
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
				colour: categoryColours["Scene"],
				tooltip: "Load a model.\nKeyword: model",
				previousStatement: null,
				nextStatement: null,
			});

			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setOnChange((changeEvent) => {
				handleBlockCreateEvent(
					this,
					changeEvent,
					variableNamePrefix,
					nextVariableIndexes,
				);

				if (
					this.id !== changeEvent.blockId &&
					changeEvent.type !== Blockly.Events.BLOCK_CHANGE
				)
					return;

				if (handleMeshLifecycleChange(this, changeEvent)) return;
				if (handleFieldOrChildChange(this, changeEvent)) return;
			});

			addDoMutatorWithToggleBehavior(this);
		},
	};
}
