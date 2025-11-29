import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import { getHelpUrlFor } from "../blocks.js";
import { translate, getTooltip } from "../main/translation.js";

export function defineCombineBlocks() {
	Blockly.Blocks["merge_meshes"] = {
		init: function () {
			this.jsonInit({
				message0: translate("merge_meshes"),
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
				tooltip: getTooltip("merge_meshes"),
				previousStatement: null,
				nextStatement: null,
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle('transform_blocks');

		},
	};

	Blockly.Blocks["subtract_meshes"] = {
		init: function () {
			this.jsonInit({
				message0: translate("subtract_meshes"),
				args0: [
					{
						type: "field_variable",
						name: "RESULT_VAR",
						variable: "result",
					},
					{
						type: "field_variable",
						name: "BASE_MESH",
						variable: "object",
					},
					{
						type: "input_value",
						name: "MESH_LIST",
						check: "Array",
					},
				],
				colour: categoryColours["Transform"],
				tooltip: getTooltip("subtract_meshes"),
				previousStatement: null,
				nextStatement: null,
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle('transform_blocks');

		},
	};
	Blockly.Blocks["intersection_meshes"] = {
		init: function () {
			this.jsonInit({
				message0: translate("intersection_meshes"),
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
				tooltip: getTooltip("intersection_meshes"),
				previousStatement: null,
				nextStatement: null,
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle('transform_blocks');

		},
	};

	Blockly.Blocks["hull_meshes"] = {
		init: function () {
			this.jsonInit({
				message0: translate("hull_meshes"),
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
				tooltip: getTooltip("hull_meshes"),
				previousStatement: null,
				nextStatement: null,
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle('transform_blocks');

		},
	};
}

