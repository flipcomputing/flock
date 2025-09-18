import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
	nextVariableIndexes,
	findCreateBlock,
	handleBlockCreateEvent,
	handleMeshLifecycleChange,
	handleFieldOrChildChange,
	addDoMutatorWithToggleBehavior,
	getHelpUrlFor,
} from "../blocks.js";
import { mapNames } from "../config.js";
import { updateOrCreateMeshFromBlock } from "../ui/blockmesh.js";
import {
	translate,
	getTooltip,
	getOption,
	getDropdownOption,
} from "../main/translation.js";

export function defineSceneBlocks() {
	Blockly.Blocks["set_sky_color"] = {
		init: function () {
			this.jsonInit({
				type: "set_sky_color",
				message0: translate("set_sky_color"),
				args0: [
					{
						type: "input_value",
						name: "COLOR",
						colour: "#6495ED",
						check: ["Colour", "Array", "Material"],
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Scene"],
				tooltip: getTooltip("set_sky_color"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("scene_blocks");
			this.setOnChange((changeEvent) => {
				if (
					changeEvent.type === Blockly.Events.BLOCK_CREATE ||
					changeEvent.type === Blockly.Events.BLOCK_CHANGE ||
					changeEvent.type === Blockly.Events.BLOCK_MOVE
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
							updateOrCreateMeshFromBlock(this, changeEvent);
							//window.updateCurrentMeshName(this, "ID_VAR");
						}
					}
				}
			});
		},
	};

	Blockly.Blocks["create_ground"] = {
		init: function () {
			this.jsonInit({
				type: "create_ground",
				message0: translate("create_ground"),
				args0: [
					{
						type: "input_value",
						name: "COLOR",
						colour: "#71BC78",
						check: "Colour",
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Scene"],
				tooltip: getTooltip("create_ground"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("scene_blocks");
			this.setOnChange((changeEvent) => {
				if (
					changeEvent.type === Blockly.Events.BLOCK_CREATE ||
					changeEvent.type === Blockly.Events.BLOCK_CHANGE
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
							updateOrCreateMeshFromBlock(this, changeEvent);
						}
					}
				}
			});
		},
	};

	Blockly.Blocks["set_background_color"] = {
		init: function () {
			this.jsonInit({
				type: "set_background_color",
				message0: translate("set_background_color"),
				args0: [
					{
						type: "input_value",
						name: "COLOR",
						colour: "#6495ED",
						check: ["Colour", "Array", "Material"],
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Scene"],
				tooltip: getTooltip("set_background_color"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("scene_blocks");
			this.setOnChange((changeEvent) => {
				if (
					changeEvent.type === Blockly.Events.BLOCK_CREATE ||
					changeEvent.type === Blockly.Events.BLOCK_CHANGE
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
							updateOrCreateMeshFromBlock(this, changeEvent);
							//window.updateCurrentMeshName(this, "ID_VAR");
						}
					}
				}
			});
		},
	};

	Blockly.Blocks["create_map"] = {
		init: function () {
			this.jsonInit({
				type: "create_map",
				message0: translate("create_map"),
				args0: [
					{
						type: "field_dropdown",
						name: "MAP_NAME",
						options: [[getOption("FLAT"), "NONE"]].concat(
							mapNames(),
						),
					},
					{
						type: "input_value",
						name: "MATERIAL",
						check: ["Material", "Array"],
					},
				],
				previousStatement: null,
				nextStatement: null,
				inputsInline: true,
				colour: categoryColours["Scene"],
				tooltip: getTooltip("create_map"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("scene_blocks");
			this.setOnChange((changeEvent) => {
				if (
					changeEvent.type === Blockly.Events.BLOCK_CREATE ||
					changeEvent.type === Blockly.Events.BLOCK_CHANGE
				) {
					const parent = findCreateBlock(
						Blockly.getMainWorkspace().getBlockById(
							changeEvent.blockId,
						),
					);

					if (parent === this) {
						const blockInWorkspace =
							Blockly.getMainWorkspace().getBlockById(this.id);

						if (handleMeshLifecycleChange(this, changeEvent))
							return;
						if (handleFieldOrChildChange(this, changeEvent)) return;
					}
				}
			});
		},
	};

	Blockly.Blocks["show"] = {
		init: function () {
			this.jsonInit({
				type: "show",
				message0: translate("show"),
				args0: [
					{
						type: "field_variable",
						name: "MODEL_VAR",
						variable: window.currentMesh,
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Scene"],
				tooltip: getTooltip("show"),
			});

			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("scene_blocks");
		},
	};

	Blockly.Blocks["hide"] = {
		init: function () {
			this.jsonInit({
				type: "hide",
				message0: translate("hide"),
				args0: [
					{
						type: "field_variable",
						name: "MODEL_VAR",
						variable: window.currentMesh,
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Scene"],
				tooltip: getTooltip("hide"),
			});

			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("scene_blocks");
		},
	};

	Blockly.Blocks["dispose"] = {
		init: function () {
			this.jsonInit({
				type: "dispose",
				message0: translate("dispose"),
				args0: [
					{
						type: "field_variable",
						name: "MODEL_VAR",
						variable: window.currentMesh,
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Scene"],
				tooltip: getTooltip("dispose"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("scene_blocks");
		},
	};

	Blockly.Blocks["clone_mesh"] = {
		init: function () {
			const variableNamePrefix = "clone";
			let nextVariableName =
				variableNamePrefix + nextVariableIndexes[variableNamePrefix]; // Start with "clone1"

			this.jsonInit({
				message0: translate("clone_mesh"),
				args0: [
					{
						type: "field_variable",
						name: "CLONE_VAR",
						variable: nextVariableName, // Dynamic variable name
					},
					{
						type: "field_variable",
						name: "SOURCE_MESH",
						variable: window.currentMesh,
					},
				],
				inputsInline: true,
				colour: categoryColours["Scene"],
				tooltip: getTooltip("clone_mesh"),
				helpUrl: "",
				previousStatement: null,
				nextStatement: null,
			});

			// Set dynamic variable name handling
			this.setOnChange((changeEvent) => {
				handleBlockCreateEvent(
					this,
					changeEvent,
					variableNamePrefix,
					nextVariableIndexes,
				);
			});

			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("scene_blocks");
			// Add mutator for "constructor-like" initialisation
			addDoMutatorWithToggleBehavior(this);
		},
	};
	/*Blockly.Blocks["create_custom_map"] = {
		init: function () {
		  this.jsonInit({
			type: "create_custom_map",
			message0: `custom map\n%1 %2 %3 %4 %5\n%6 %7 %8 %9 %10\n%11 %12 %13 %14 %15\n%16 %17 %18 %19 %20\n%21 %22 %23 %24 %25`,
			args0: [
			  { type: "input_value", name: "COLOR_1", check: "Colour" },
			  { type: "input_value", name: "COLOR_2", check: "Colour" },
			  { type: "input_value", name: "COLOR_3", check: "Colour" },
			  { type: "input_value", name: "COLOR_4", check: "Colour" },
			  { type: "input_value", name: "COLOR_5", check: "Colour" },
			  { type: "input_value", name: "COLOR_6", check: "Colour" },
			  { type: "input_value", name: "COLOR_7", check: "Colour" },
			  { type: "input_value", name: "COLOR_8", check: "Colour" },
			  { type: "input_value", name: "COLOR_9", check: "Colour" },
			  { type: "input_value", name: "COLOR_10", check: "Colour" },
			  { type: "input_value", name: "COLOR_11", check: "Colour" },
			  { type: "input_value", name: "COLOR_12", check: "Colour" },
			  { type: "input_value", name: "COLOR_13", check: "Colour" },
			  { type: "input_value", name: "COLOR_14", check: "Colour" },
			  { type: "input_value", name: "COLOR_15", check: "Colour" },
			  { type: "input_value", name: "COLOR_16", check: "Colour" },
			  { type: "input_value", name: "COLOR_17", check: "Colour" },
			  { type: "input_value", name: "COLOR_18", check: "Colour" },
			  { type: "input_value", name: "COLOR_19", check: "Colour" },
			  { type: "input_value", name: "COLOR_20", check: "Colour" },
			  { type: "input_value", name: "COLOR_21", check: "Colour" },
			  { type: "input_value", name: "COLOR_22", check: "Colour" },
			  { type: "input_value", name: "COLOR_23", check: "Colour" },
			  { type: "input_value", name: "COLOR_24", check: "Colour" },
			  { type: "input_value", name: "COLOR_25", check: "Colour" },
			],
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Scene"],
			tooltip:
			  "Creates a 5x5 ground map with specified elevation colors.\nKeyword:map",
			helpUrl: "",
		  });
		},
	  };*/
}
