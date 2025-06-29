import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import { getHelpUrlFor } from "../blocks.js";

export function defineCombineBlocks() {
	Blockly.Blocks["merge_meshes"] = {
		init: function () {
			this.jsonInit({
				message0: "add %1 as merge %2",
				args0: [
					{
						type: "field_variable",
						name: "RESULT_VAR",
						variable: "result",
					},
					{
						type: "input_value",
						name: "MESH_LIST",
						check: "Array",
					},
				],
				colour: categoryColours["Transform"],
				tooltip:
					"Merge a list of meshes into one and store the result.\nKeyword: merge",
				previousStatement: null,
				nextStatement: null,
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["subtract_meshes"] = {
		init: function () {
			this.jsonInit({
				message0: "add %1 as %2 subtract %3",
				args0: [
					{
						type: "field_variable",
						name: "RESULT_VAR",
						variable: "result",
					},
					{
						type: "field_variable",
						name: "BASE_MESH",
						variable: "mesh",
					},
					{
						type: "input_value",
						name: "MESH_LIST",
						check: "Array",
					},
				],
				colour: categoryColours["Transform"],
				tooltip:
					"Subtract a list of meshes from a base mesh and store the result.\nKeyword: subtract",
				previousStatement: null,
				nextStatement: null,
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};
	Blockly.Blocks["intersection_meshes"] = {
		init: function () {
			this.jsonInit({
				message0: "add %1 as intersect %2",
				args0: [
					{
						type: "field_variable",
						name: "RESULT_VAR",
						variable: "result",
					},
					{
						type: "input_value",
						name: "MESH_LIST",
						check: "Array",
					},
				],
				colour: categoryColours["Transform"],
				tooltip:
					"Intersect a list of meshes and store the resulting geometry.\nKeyword: intersect",
				previousStatement: null,
				nextStatement: null,
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["hull_meshes"] = {
		init: function () {
			this.jsonInit({
				message0: "add %1 as hull of %2",
				args0: [
					{
						type: "field_variable",
						name: "RESULT_VAR",
						variable: "result",
					},
					{
						type: "input_value",
						name: "MESH_LIST",
						check: "Array",
					},
				],
				colour: categoryColours["Transform"],
				tooltip:
					"Create a convex hull from a list of meshes and store the result.\nKeyword: hull",
				previousStatement: null,
				nextStatement: null,
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};
}
