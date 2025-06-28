import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import { getHelpUrlFor, nextVariableIndexes } from "../blocks.js";

export function defineTextBlocks() {
	Blockly.Blocks["comment"] = {
		init: function () {
			this.jsonInit({
				type: "comment",
				message0: "// %1",
				args0: [
					{
						type: "input_value",
						name: "COMMENT",
						check: "String",
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: "#d3d3d3",
				tooltip: "A comment line to help people understand your code.",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["print_text"] = {
		init: function () {
			this.jsonInit({
				type: "print_text",
				message0: "print %1 for %2 seconds %3",
				args0: [
					{
						type: "input_value",
						name: "TEXT",
						check: ["String", "Number", "Array"],
					},
					{
						type: "input_value",
						name: "DURATION",
						check: "Number",
					},
					{
						type: "input_value",
						name: "COLOR",
						colour: "#000080",
						check: "Colour",
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: 160,
				tooltip: "A text to the output panel.\nKeyword: print",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["say"] = {
		init: function () {
			this.jsonInit({
				type: "say",
				message0:
					"say %1 for %2 s %3 \ntext %4 on %5 alpha %6 size %7 %8 %9",
				args0: [
					{
						type: "input_value",
						name: "TEXT",
						check: "String",
					},
					{
						type: "input_value",
						name: "DURATION",
						check: "Number",
					},
					{
						type: "field_variable",
						name: "MESH_VAR",
						variable: window.currentMesh,
					},
					{
						type: "input_value",
						name: "TEXT_COLOR",
						colour: "#000000",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "BACKGROUND_COLOR",
						colour: "#ffffff",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "ALPHA",
						check: "Number",
					},
					{
						type: "input_value",
						name: "SIZE",
						check: "Number",
					},
					{
						type: "field_dropdown",
						name: "MODE",
						options: [
							["add", "ADD"],
							["replace", "REPLACE"],
						],
					},
					{
						type: "field_dropdown",
						name: "ASYNC",
						options: [
							["start", "START"],
							["await", "AWAIT"],
						],
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: 160,
				tooltip:
					"Display a piece of text as a speech bubble on a mesh.\nKeyword: say",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["ui_text"] = {
		init: function () {
			this.jsonInit({
				type: "ui_text",
				message0:
					"ui text %1 %2 at x: %3 y: %4\nsize: %5 for %6 seconds color: %7",
				args0: [
					{
						type: "input_value",
						name: "TEXT",
						check: "String",
					},
					{
						type: "field_variable",
						name: "TEXTBLOCK_VAR", // Variable to store the TextBlock reference
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
						name: "FONT_SIZE",
						check: "Number",
					},
					{
						type: "input_value",
						name: "DURATION",
						check: "Number",
					},
					{
						type: "input_value",
						name: "COLOR",
						check: "Colour",
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Text"],
				tooltip:
					"Add text to the UI screen, and store control in a variable for later use or disposal.",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["ui_button"] = {
		init: function () {
			this.jsonInit({
				type: "ui_button",
				message0:
					"ui button %1 %2 at x: %3 y: %4\nsize: %5 text size: %6 text color: %7 background color: %8",
				args0: [
					{
						type: "input_value",
						name: "TEXT",
						check: "String",
					},
					{
						type: "field_variable",
						name: "BUTTON_VAR", // Variable to store the Button reference
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
						type: "field_dropdown",
						name: "SIZE",
						options: [
							["small", "SMALL"],
							["medium", "MEDIUM"],
							["large", "LARGE"],
						],
					},
					{
						type: "field_dropdown",
						name: "TEXT_SIZE",
						options: [
							["small", "14px"],
							["medium", "18px"],
							["large", "24px"],
						],
					},
					{
						type: "input_value",
						name: "TEXT_COLOR",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "BACKGROUND_COLOR",
						check: "Colour",
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Text"],
				tooltip:
					"Add a 2D button to the UI screen with a preset size, and store control in a variable for later use or disposal.",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["ui_input"] = {
	  init: function () {
		this.jsonInit({
		  type: "ui_input",
		  message0:
			"ui input %1 %2 at x: %3 y: %4\nsize: %5 text size: %6 text: %7 background: %8",
		  args0: [
			{
			  type: "field_variable",
			  name: "INPUT_VAR",
			},
			{
			  type: "input_value",
			  name: "TEXT",
			  check: "String",
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
			  type: "field_dropdown",
			  name: "SIZE",
			  options: [
				["small", "SMALL"],
				["medium", "MEDIUM"],
				["large", "LARGE"],
			  ],
			},
			{
			  type: "input_value",
			  name: "TEXT_SIZE",
			  check: "Number",
			},
			{
			  type: "input_value",
			  name: "TEXT_COLOR",
			  check: "Colour",
			},
			{
			  type: "input_value",
			  name: "BACKGROUND_COLOR",
			  check: "Colour",
			},
		  ],
		  inputsInline: true,
		  previousStatement: null,
		  nextStatement: null,
		  colour: categoryColours["Text"],
		  tooltip: "Ask the user a question and wait for input. Stores the result in a variable.",
		});

		this.setHelpUrl(getHelpUrlFor(this.type));
	  },
	};


	Blockly.Blocks["create_3d_text"] = {
		init: function () {
			const variableNamePrefix = "text";
			let nextVariableName =
				variableNamePrefix + nextVariableIndexes[variableNamePrefix];

			this.jsonInit({
				message0: `set %1 to 3D text: %2 font: %3 size: %4 color: %5
					depth: %6 x: %7 y: %8 z: %9 `,
				args0: [
					{
						type: "field_variable",
						name: "ID_VAR",
						variable: nextVariableName,
					},
					{
						type: "input_value",
						name: "TEXT",
						check: "String",
					},
					{
						type: "field_dropdown",
						name: "FONT",
						options: [["Sans Bold", "./fonts/FreeSans_Bold.json"]],
					},
					{
						type: "input_value",
						name: "SIZE",
						check: "Number",
					},
					{
						type: "input_value",
						name: "COLOR",
						check: "Colour",
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
				inputsInline: true,
				colour: categoryColours["Text"],
				tooltip: "Create 3D text in the scene.",
				previousStatement: null,
				nextStatement: null,
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};
}
