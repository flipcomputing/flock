import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import { getHelpUrlFor } from "../blocks.js";

export function defineConnectBlocks() {
	Blockly.Blocks["parent"] = {
		init: function () {
			this.jsonInit({
				type: "parent",
				message0: "parent %1 child %2",
				args0: [
					{
						type: "field_variable",
						name: "PARENT_MESH",
						variable: "parent",
					},
					{
						type: "field_variable",
						name: "CHILD_MESH",
						variable: window.currentMesh,
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Transform"],
				inputsInline: true,
				tooltip:
					"Set a parent-child relationship between two meshes and keeps the child in its world position\nKeyword:parent",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["parent_child"] = {
		init: function () {
			this.jsonInit({
				type: "parent_child",
				message0: "parent %1 child %2\noffset x: %3 y: %4 z: %5",
				args0: [
					{
						type: "field_variable",
						name: "PARENT_MESH",
						variable: "parent",
					},
					{
						type: "field_variable",
						name: "CHILD_MESH",
						variable: window.currentMesh,
					},
					{
						type: "input_value",
						name: "X_OFFSET",
						check: "Number",
					},
					{
						type: "input_value",
						name: "Y_OFFSET",
						check: "Number",
					},
					{
						type: "input_value",
						name: "Z_OFFSET",
						check: "Number",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Transform"],
				inputsInline: true,
				tooltip:
					"Set a parent-child relationship between two meshes with a specified offset in x, y, and z directions.\nKeyword: child",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["remove_parent"] = {
		init: function () {
			this.jsonInit({
				type: "remove_parent",
				message0: "remove parent from %1",
				args0: [
					{
						type: "field_variable",
						name: "CHILD_MESH",
						variable: window.currentMesh,
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Transform"],
				tooltip:
					"Remove the parent relationship from the specified mesh.\nKeyword: unparent",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["stop_follow"] = {
		init: function () {
			this.jsonInit({
				type: "stop_follow",
				message0: "stop following %1",
				args0: [
					{
						type: "field_variable",
						name: "FOLLOWER_MESH",
						variable: window.currentMesh,
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Transform"],
				tooltip:
					"Stop the specified mesh from following another.\nKeyword: stopfollow",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["hold"] = {
		init: function () {
			this.jsonInit({
				type: "hold",
				message0: "make %1 hold %2\noffset x: %3 y: %4 z: %5",
				args0: [
					{
						type: "field_variable",
						name: "TARGET_MESH",
						variable: "target",
					},
					{
						type: "field_variable",
						name: "MESH_TO_ATTACH",
						variable: "mesh",
					},
					{
						type: "input_value",
						name: "X_OFFSET",
						check: "Number",
						align: "RIGHT",
					},
					{
						type: "input_value",
						name: "Y_OFFSET",
						check: "Number",
						align: "RIGHT",
					},
					{
						type: "input_value",
						name: "Z_OFFSET",
						check: "Number",
						align: "RIGHT",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Transform"],
				inputsInline: true,
				tooltip:
					"Attach a mesh to the specified bone of another mesh with a specified offset in x, y, and z directions.\nKeyword: hold",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["drop"] = {
		init: function () {
			this.jsonInit({
				type: "drop",
				message0: "drop %1",
				args0: [
					{
						type: "field_variable",
						name: "MESH_TO_DETACH",
						variable: "mesh",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Transform"],
				inputsInline: true,
				tooltip:
					"Detach a mesh from its currently attached bone.\nKeyword: drop",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["follow"] = {
		init: function () {
			this.jsonInit({
				type: "follow",
				message0: "make %1 follow %2 at %3\noffset x: %4 y: %5 z: %6",
				args0: [
					{
						type: "field_variable",
						name: "FOLLOWER_MESH",
						variable: "follower",
					},
					{
						type: "field_variable",
						name: "TARGET_MESH",
						variable: "target",
					},
					{
						type: "field_dropdown",
						name: "FOLLOW_POSITION",
						options: [
							["top", "TOP"],
							["center", "CENTER"],
							["bottom", "BOTTOM"],
						],
					},
					{
						type: "input_value",
						name: "X_OFFSET",
						check: "Number",
					},
					{
						type: "input_value",
						name: "Y_OFFSET",
						check: "Number",
					},
					{
						type: "input_value",
						name: "Z_OFFSET",
						check: "Number",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Transform"],
				inputsInline: true,
				tooltip:
					"Make one mesh follow another at a specified position (top, center, or bottom) with offset in x, y, and z directions. \nKeyword: follow",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["export_mesh"] = {
	  init: function () {
		this.jsonInit({
		  type: "export_mesh",
		  message0: "export %1 as %2",
		  args0: [
			{
			  type: "field_variable",
			  name: "MESH_VAR",
			  variable: window.currentMesh,
			},
			{
			  type: "field_dropdown",
			  name: "FORMAT",
			  options: [
				["STL", "STL"],
				["OBJ", "OBJ"],
				["GLB", "GLB"],
			  ],
			},
		  ],
		  previousStatement: null,
		  nextStatement: null,
		  colour: categoryColours["Scene"],
		  tooltip: "Export a mesh as STL, OBJ, or GLB.\nKeyword: export",
		});
		this.setHelpUrl(getHelpUrlFor(this.type));
	  },
	};
}
