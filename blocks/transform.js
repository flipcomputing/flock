import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import { 
  getHelpUrlFor,
  handleFieldOrChildChange,
} from "../blocks.js";
import { translate, getTooltip, getDropdownOption } from "../main/translation.js";
import { updateOrCreateMeshFromBlock } from "../ui/blockmesh.js";
import { flock } from "../flock.js";

export function defineTransformBlocks() {
	function handleBlockChange(block, changeEvent) {
		// if (flock.blockDebug) console.log("TODO: Buy Matrix DVD");
		const changeEventBlock = Blockly.getMainWorkspace().getBlockById(changeEvent.blockId);
		if (!changeEventBlock) return;
		if (flock.blockDebug) console.log("The ID of this change event is", changeEventBlock.id);
		const changeEventParentBlock = changeEventBlock.getParent();
		if (!changeEventParentBlock) return;
		const changeEventBlockType = changeEventParentBlock.type;
		if (flock.blockDebug) console.log("The type of this change event is", changeEventBlockType);
		if (changeEventBlockType != "rotate_to") return;
		const handleChange = handleFieldOrChildChange(block, changeEvent)
		if (flock.blockDebug) console.log(handleChange);
	}

	Blockly.Blocks["move_by_xyz"] = {
		init: function () {
			this.jsonInit({
				type: "move_by_xyz",
				message0: translate("move_by_xyz"),
				args0: [
					{
						type: "field_variable",
						name: "BLOCK_NAME",
						variable: window.currentMesh,
					},
					{
						type: "input_value",
						name: "X",
						check: "Number",
						align: "RIGHT",
					},
					{
						type: "input_value",
						name: "Y",
						check: "Number",
						align: "RIGHT",
					},
					{
						type: "input_value",
						name: "Z",
						check: "Number",
						align: "RIGHT",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Transform"],
				inputsInline: true,
				tooltip: getTooltip("move_by_xyz"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle('transform_blocks');

			// Set up the change handler.
			this.setOnChange((changeEvent) =>
				handleBlockChange(this, changeEvent),
			);
		},
	};

	Blockly.Blocks["move_by_xyz_single"] = {
		init: function () {
			this.jsonInit({
				type: "move_by_xyz_single",
				message0: translate("move_by_xyz_single"),
				args0: [
					{
						type: "field_variable",
						name: "BLOCK_NAME",
						variable: window.currentMesh,
					},
					{
						type: "field_dropdown",
						name: "COORDINATE",
						options: [
							getDropdownOption("x_coordinate"),
							getDropdownOption("y_coordinate"),
							getDropdownOption("z_coordinate"),
						]
					},
					{
						type: "input_value",
						name: "VALUE",
						check: "Number",
						align: "RIGHT",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Transform"],
				inputsInline: true,
				tooltip: getTooltip("move_by_xyz_single"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle('transform_blocks');

			// Set up the change handler.
			this.setOnChange((changeEvent) =>
				handleBlockChange(this, changeEvent),
			);
		},
	};

	Blockly.Blocks["move_to_xyz"] = {
		init: function () {
			this.jsonInit({
				type: "move_to_xyz",
				message0: translate("move_to_xyz"),
				args0: [
					{
						type: "field_variable",
						name: "MODEL",
						variable: window.currentMesh,
					},
					{
						type: "input_value",
						name: "X",
						check: "Number",
						align: "RIGHT",
					},
					{
						type: "input_value",
						name: "Y",
						check: "Number",
						align: "RIGHT",
					},
					{
						type: "input_value",
						name: "Z",
						check: "Number",
						align: "RIGHT",
					},
					{
						type: "field_checkbox",
						name: "USE_Y",
						checked: true,
						text: "Use Y axis",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Transform"],
				inputsInline: true,
				tooltip: getTooltip("move_to_xyz"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle('transform_blocks');

			// Set up the change handler.
			this.setOnChange((changeEvent) =>
				handleBlockChange(this, changeEvent),
			);
		},
	};

	Blockly.Blocks["move_to_xyz_single"] = {
		init: function () {
			this.jsonInit({
				type: "move_to_xyz_single",
				message0: translate("move_to_xyz_single"),
				args0: [
					{
						type: "field_variable",
						name: "MODEL",
						variable: window.currentMesh,
					},
					{
						type: "field_dropdown",
						name: "COORDINATE",
						options: [
							getDropdownOption("x_coordinate"),
							getDropdownOption("y_coordinate"),
							getDropdownOption("z_coordinate"),
						]
					},
					{
						type: "input_value",
						name: "VALUE",
						check: "Number",
						align: "RIGHT",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Transform"],
				inputsInline: true,
				tooltip: getTooltip("move_to_xyz_single"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle('transform_blocks');

			// Set up the change handler.
			this.setOnChange((changeEvent) =>
				handleBlockChange(this, changeEvent),
			);
		},
	};

	Blockly.Blocks["move_to"] = {
		init: function () {
			this.jsonInit({
				type: "move_to",
				message0: translate("move_to"),
				args0: [
					{
						type: "field_variable",
						name: "MODEL1",
						variable: window.currentMesh,
					},
					{
						type: "field_variable",
						name: "MODEL2",
						variable: "mesh2",
					},
					{
						type: "field_checkbox",
						name: "USE_Y",
						checked: false,
						text: "Use Y axis",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Transform"],
				inputsInline: true,
				tooltip: getTooltip("move_to"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle('transform_blocks');

			// Set up the change handler.
			this.setOnChange((changeEvent) =>
				handleBlockChange(this, changeEvent),
			);
		},
	};

	Blockly.Blocks["scale"] = {
		init: function () {
			this.jsonInit({
				type: "scale",
				message0: translate("scale"),
				args0: [
					{
						type: "field_variable",
						name: "BLOCK_NAME",
						variable: window.currentMesh,
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
						type: "field_dropdown",
						name: "X_ORIGIN",
						options: [
							getDropdownOption("CENTRE"),
							getDropdownOption("LEFT"),
							getDropdownOption("RIGHT"),
						],
					},
					{
						type: "field_dropdown",
						name: "Y_ORIGIN",
						options: [
							getDropdownOption("BASE"),
							getDropdownOption("CENTRE"),
							getDropdownOption("TOP"),
						],
					},
					{
						type: "field_dropdown",
						name: "Z_ORIGIN",
						options: [
							getDropdownOption("CENTRE"),
							getDropdownOption("FRONT"),
							getDropdownOption("BACK"),
						],
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Transform"],
				inputsInline: true,
				tooltip: getTooltip("scale"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle('transform_blocks');

			// Set up the change handler.
			this.setOnChange((changeEvent) =>
				handleBlockChange(this, changeEvent),
			);
		},
	};

	Blockly.Blocks["resize"] = {
		init: function () {
			this.jsonInit({
				type: "resize",
				message0: translate("resize"),
				args0: [
					{
						type: "field_variable",
						name: "BLOCK_NAME",
						variable: window.currentMesh,
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
						type: "field_dropdown",
						name: "X_ORIGIN",
						options: [
							getDropdownOption("CENTRE"),
							getDropdownOption("LEFT"),
							getDropdownOption("RIGHT"),
						],
					},
					{
						type: "field_dropdown",
						name: "Y_ORIGIN",
						options: [
							getDropdownOption("BASE"),
							getDropdownOption("CENTRE"),
							getDropdownOption("TOP"),
						],
					},
					{
						type: "field_dropdown",
						name: "Z_ORIGIN",
						options: [
							getDropdownOption("CENTRE"),
							getDropdownOption("FRONT"),
							getDropdownOption("BACK"),
						],
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Transform"],
				inputsInline: true,
				tooltip: getTooltip("resize"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle('transform_blocks');

			// Set up the change handler.
			this.setOnChange((changeEvent) =>
				handleBlockChange(this, changeEvent),
			);
		},
	};

	Blockly.Blocks["rotate_model_xyz"] = {
		init: function () {
			this.jsonInit({
				type: "rotate_model_xyz",
				message0: translate("rotate_model_xyz"),
				args0: [
					{
						type: "field_variable",
						name: "MODEL",
						variable: window.currentMesh,
					},
					{
						type: "input_value",
						name: "X",
						check: "Number",
						align: "RIGHT",
					},
					{
						type: "input_value",
						name: "Y",
						check: "Number",
						align: "RIGHT",
					},
					{
						type: "input_value",
						name: "Z",
						check: "Number",
						align: "RIGHT",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Transform"],
				inputsInline: true,
				tooltip: getTooltip("rotate_model_xyz"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle('transform_blocks');

			// Set up the change handler.
			this.setOnChange((changeEvent) =>
				handleBlockChange(this, changeEvent),
			);
		},
	};

	Blockly.Blocks["rotate_to"] = {
		init: function () {
			this.jsonInit({
				type: "rotate_to",
				message0: translate("rotate_to"),
				args0: [
					{
						type: "field_variable",
						name: "MODEL",
						variable: window.currentMesh,
					},
					{
						type: "input_value",
						name: "X",
						check: "Number",
						align: "RIGHT",
					},
					{
						type: "input_value",
						name: "Y",
						check: "Number",
						align: "RIGHT",
					},
					{
						type: "input_value",
						name: "Z",
						check: "Number",
						align: "RIGHT",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Transform"],
				inputsInline: true,
				tooltip: getTooltip("rotate_to"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle('transform_blocks');

			// Set up the change handler.
			this.setOnChange((changeEvent) =>
				handleBlockChange(this, changeEvent),
			);
		},
	};

	Blockly.Blocks["look_at"] = {
		init: function () {
			this.jsonInit({
				type: "look_at",
				message0: translate("look_at"),
				args0: [
					{
						type: "field_variable",
						name: "MODEL1",
						variable: window.currentMesh,
					},
					{
						type: "field_variable",
						name: "MODEL2",
						variable: "mesh2",
					},
					{
						type: "field_checkbox",
						name: "USE_Y",
						checked: false,
						text: "Use Y axis",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Transform"],
				inputsInline: true,
				tooltip: getTooltip("look_at"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle('transform_blocks');

			// Set up the change handler.
			this.setOnChange((changeEvent) =>
				handleBlockChange(this, changeEvent),
			);
		},
	};

	Blockly.Blocks["set_pivot"] = {
		init: function () {
			this.jsonInit({
				type: "set_pivot",
				message0: translate("set_pivot"),
				args0: [
					{
						type: "field_variable",
						name: "MESH",
						variable: window.currentMesh, // Assuming the mesh is stored here
					},
					{
						type: "input_value",
						name: "X_PIVOT",
						check: ["Number", "String"],
					},
					{
						type: "input_value",
						name: "Y_PIVOT",
						check: ["Number", "String"],
					},
					{
						type: "input_value",
						name: "Z_PIVOT",
						check: ["Number", "String"],
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Transform"],
				tooltip: getTooltip("set_pivot"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle('transform_blocks');

			// Set up the change handler.
			this.setOnChange((changeEvent) =>
				handleBlockChange(this, changeEvent),
			);
		},
	};

	Blockly.Blocks["min_centre_max"] = {
		init: function () {
			this.jsonInit({
				type: "min_centre_max",
				message0: translate("min_centre_max"),
				args0: [
					{
						type: "field_dropdown",
						name: "PIVOT_OPTION",
						options: [
							getDropdownOption("MIN"),
							getDropdownOption("CENTER"),
							getDropdownOption("MAX"),
						],
					},
				],
				output: "String", // Now returns a symbolic string
				colour: categoryColours["Transform"],
				tooltip: getTooltip("min_centre_max"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle('transform_blocks');

			// Set up the change handler.
			this.setOnChange((changeEvent) =>
				handleBlockChange(this, changeEvent),
			);
		},
	};
}

