import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import { getHelpUrlFor } from "../blocks.js";

export function defineTransformBlocks() {
	Blockly.Blocks["move_by_xyz"] = {
		init: function () {
			this.jsonInit({
				type: "move_by_xyz",
				message0: "move %1 by x: %2 y: %3 z: %4",
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
				tooltip:
					"Move a mesh a given amount in x y and z directions.\nKeyword: move",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["move_to_xyz"] = {
		init: function () {
			this.jsonInit({
				type: "move_to_xyz",
				message0: "move %1 to x: %2 y: %3 z: %4 y? %5",
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
				tooltip:
					"Teleport the mesh to the coordinates. Optionally, use the Y axis.\nKeyword: moveby",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["move_to"] = {
		init: function () {
			this.jsonInit({
				type: "move_to",
				message0: "move %1 to %2 y? %3",
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
				tooltip:
					"Teleport the first mesh to the location of the second mesh.\nKeyword: moveto",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["scale"] = {
		init: function () {
			this.jsonInit({
				type: "scale",
				message0:
					"scale %1 x: %2 y: %3 z: %4\norigin x: %5 y: %6 z: %7",
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
							["center", "CENTRE"],
							["left", "LEFT"],
							["right", "RIGHT"],
						],
					},
					{
						type: "field_dropdown",
						name: "Y_ORIGIN",
						options: [
							["base", "BASE"],
							["center", "CENTRE"],
							["top", "TOP"],
						],
					},
					{
						type: "field_dropdown",
						name: "Z_ORIGIN",
						options: [
							["center", "CENTRE"],
							["front", "FRONT"],
							["back", "BACK"],
						],
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Transform"],
				inputsInline: true,
				tooltip:
					"Resize a mesh to the given x, y, and z and controls the origin of scaling. \nKeyword: scale",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["resize"] = {
		init: function () {
			this.jsonInit({
				type: "resize",
				message0:
					"resize %1 x: %2 y: %3 z: %4\norigin x: %5 y: %6 z: %7",
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
							["center", "CENTRE"],
							["left", "LEFT"],
							["right", "RIGHT"],
						],
					},
					{
						type: "field_dropdown",
						name: "Y_ORIGIN",
						options: [
							["base", "BASE"],
							["center", "CENTRE"],
							["top", "TOP"],
						],
					},
					{
						type: "field_dropdown",
						name: "Z_ORIGIN",
						options: [
							["center", "CENTRE"],
							["front", "FRONT"],
							["back", "BACK"],
						],
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Transform"],
				inputsInline: true,
				tooltip:
					"Resize a mesh to the given x, y, and z and controls the origin of scaling.\nKeyword: resize",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["rotate_model_xyz"] = {
		init: function () {
			this.jsonInit({
				type: "rotate_model_xyz",
				message0: "rotate %1 by x: %2 y: %3 z: %4",
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
				tooltip:
					"Rotate the mesh by the given x, y, z values.\nKeyword: rotate\nKeyword: rotateby",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["rotate_to"] = {
		init: function () {
			this.jsonInit({
				type: "rotate_to",
				message0: "rotate %1 to x: %2 y: %3 z: %4",
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
				tooltip:
					"Rotate the mesh to point towards the  coordinates.\nKeyword: rotateto",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["look_at"] = {
		init: function () {
			this.jsonInit({
				type: "look_at",
				message0: "look %1 at %2 y? %3",
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
				tooltip:
					"Rotate the first mesh towards the position of the second mesh.\nKeyword: look",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["move_forward"] = {
		init: function () {
			this.jsonInit({
				type: "move",
				message0: "move %1 %2 speed %3",
				args0: [
					{
						type: "field_variable",
						name: "MODEL",
						variable: window.currentMesh,
					},
					{
						type: "field_dropdown",
						name: "DIRECTION",
						options: [
							["forward", "forward"],
							["sideways", "sideways"],
							["strafe", "strafe"],
						],
					},
					{
						type: "input_value",
						name: "SPEED",
						check: "Number",
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Transform"],
				tooltip:
					"Move the mesh in the specified direction. 'Forward' moves it in the direction it's pointing, 'sideways' moves it relative to the camera's direction, and 'strafe' moves it sideways relative to the camera's direction.\nKeyword: push",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["set_pivot"] = {
		init: function () {
			this.jsonInit({
				type: "set_pivot",
				message0: "set pivot of %1 x: %2 y: %3 z: %4",
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
				tooltip:
					"Set the pivot point for a mesh on the X, Y, and Z axes\nKeyword: pivot",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["min_centre_max"] = {
		init: function () {
			this.jsonInit({
				type: "min_centre_max",
				message0: "%1",
				args0: [
					{
						type: "field_dropdown",
						name: "PIVOT_OPTION",
						options: [
							["min", "MIN"],
							["center", "CENTER"],
							["max", "MAX"],
						],
					},
				],
				output: "String", // Now returns a symbolic string
				colour: categoryColours["Transform"],
				tooltip:
					"Choose min, center, or max for the pivot point\nKeyword: minmax",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};
}
