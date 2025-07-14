import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
	getHelpUrlFor,
	addToggleButton,
	mutationToDom,
	domToMutation,
	inlineIcon,
	updateShape,
} from "../blocks.js";
import { translate, getTooltip } from "../main/translation.js";

export function defineSensingBlocks() {
	Blockly.Blocks["key_pressed"] = {
		init: function () {
			this.jsonInit({
				type: "key_pressed",
				message0: translate("key_pressed"),
				args0: [
					{
						type: "field_dropdown",
						name: "KEY",
						options: [
							["any", "ANY"],
							["none", "NONE"],
							["W", "w"],
							["A", "a"],
							["S", "s"],
							["D", "d"],
							["space ∞", " "],
							["Q ■", "q"],
							["E ✿", "e"],
							["F ✱", "f"],
						],
					},
				],
				output: "Boolean",
				colour: categoryColours["Sensing"],
				tooltip: getTooltip("key_pressed"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["meshes_touching"] = {
		init: function () {
			this.jsonInit({
				type: "meshes_are_touching",
				message0: translate("meshes_touching"),
				args0: [
					{
						type: "field_variable",
						name: "MESH1",
						variable: window.currentMesh,
					},
					{
						type: "field_variable",
						name: "MESH2",
						variable: "mesh2",
					},
				],
				output: "Boolean",
				colour: categoryColours["Sensing"],
				tooltip: getTooltip("meshes_touching"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["time"] = {
		init: function () {
			this.jsonInit({
				type: "time",
				message0: translate("time"),
				args0: [],
				output: "Number",
				colour: categoryColours["Sensing"], // Adjust the colour category as necessary
				inputsInline: true,
				tooltip: getTooltip("time"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["distance_to"] = {
		init: function () {
			this.jsonInit({
				type: "distance_to",
				message0: translate("distance_to"),
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
				],
				output: "Number",
				colour: categoryColours["Sensing"],
				inputsInline: true,
				tooltip: getTooltip("distance_to"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["touching_surface"] = {
		init: function () {
			this.jsonInit({
				type: "touching_surface",
				message0: translate("touching_surface"),
				args0: [
					{
						type: "field_variable",
						name: "MODEL_VAR",
						variable: window.currentMesh,
					},
				],
				output: "Boolean",
				colour: categoryColours["Sensing"],
				tooltip: getTooltip("touching_surface"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["mesh_exists"] = {
	  init: function () {
		this.jsonInit({
		  type: "mesh_exists",
		  message0: "%1 exists",
		  args0: [
			{
			  type: "field_variable",
			  name: "MODEL_VAR",
			  variable: window.currentMesh,
			},
		  ],
		  output: "Boolean",
		  colour: categoryColours["Sensing"],
		  tooltip: "Returns true if the mesh with this name is present in the scene.",
		});
		this.setHelpUrl(getHelpUrlFor(this.type));
	  },
	};


	Blockly.Blocks["get_property"] = {
		init: function () {
			this.jsonInit({
				type: "get_property",
				message0: translate("get_property"),
				args0: [
					{
						type: "field_dropdown",
						name: "PROPERTY",
						options: [
							["position x", "POSITION_X"],
							["position y", "POSITION_Y"],
							["position z", "POSITION_Z"],
							["rotation x", "ROTATION_X"],
							["rotation y", "ROTATION_Y"],
							["rotation z", "ROTATION_Z"],
							["min x", "MIN_X"],
							["max x", "MAX_X"],
							["min y", "MIN_Y"],
							["max y", "MAX_Y"],
							["min z", "MIN_Z"],
							["max z", "MAX_Z"],
							["scale x", "SCALE_X"],
							["scale y", "SCALE_Y"],
							["scale z", "SCALE_Z"],
							["size x", "SIZE_X"],
							["size y", "SIZE_Y"],
							["size z", "SIZE_Z"],
							["visible", "VISIBLE"],
							["alpha", "ALPHA"],
							["colour", "COLOUR"],
						],
					},
					{
						type: "field_variable",
						name: "MESH",
						variable: window.currentMesh,
					},
				],
				output: null,
				colour: categoryColours["Sensing"],
				tooltip: getTooltip("get_property"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["canvas_controls"] = {
		init: function () {
			this.jsonInit({
				type: "canvas_controls",
				message0: translate("canvas_controls"),
				args0: [
					{
						type: "field_checkbox",
						name: "CONTROLS",
						checked: true,
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Sensing"],
				tooltip: getTooltip("canvas_controls"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["button_controls"] = {
		init: function () {
			this.jsonInit({
				type: "button_controls",
				message0: translate("button_controls"),
				args0: [
					{
						type: "field_dropdown",
						name: "CONTROL",
						options: [
							["both", "BOTH"],
							["arrows", "ARROWS"],
							["actions", "ACTIONS"],
						],
					},
					{
						type: "field_checkbox",
						name: "ENABLED",
						checked: true,
					},
					{
						type: "input_value",
						name: "COLOR",
						check: "Colour",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Sensing"],
				tooltip: getTooltip("button_controls"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["microbit_input"] = {
		init: function () {
			this.jsonInit({
				type: "microbit_input",
				message0: translate("microbit_input"),
				args0: [
					{
						type: "field_dropdown",
						name: "EVENT",
						options: [
							["Pin P0 released", "0"],
							["Pin P1 released", "1"],
							["Pin P2 released", "2"],
							["Logo long pressed", "l"],
							["Logo touched", "j"],
							["Logo pressed", "h"],
							["Logo released", "k"],
							["Button A pressed", " "],
							["Button B pressed", "q"],
							["Button A+B pressed", "r"],
							["Gesture: FreeFall", "t"],
							["Gesture: LogoUp", "o"],
							["Gesture: LogoDown", "p"],
							["Gesture: TiltLeft", "a"],
							["Gesture: TiltRight", "d"],
							["Gesture: ScreenUp", "y"],
							["Gesture: ScreenDown", "h"],
							["Gesture: Shake", "i"],
						],
					},
				],
				message1: "%1",
				args1: [
					{
						type: "input_statement",
						name: "DO",
					},
				],
				colour: categoryColours["Sensing"],
				tooltip: getTooltip("microbit_input"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			addToggleButton(this);
		},
		mutationToDom: function () {
			return mutationToDom(this);
		},
		domToMutation: function (xmlElement) {
			domToMutation(this, xmlElement);
		},
		updateShape_: function (isInline) {
			updateShape(this, isInline);
		},
		toggleDoBlock: function () {
			this.updateShape_(!this.isInline);
		},
	};
	Blockly.Blocks["ui_slider"] = {
		init: function () {
			this.jsonInit({
				type: "ui_slider",
				message0: translate("ui_slider"),
				args0: [
					{
						type: "field_variable",
						name: "SLIDER_VAR",
					},
					{
						type: "input_value",
						name: "MIN",
						check: "Number",
					},
					{
						type: "input_value",
						name: "MAX",
						check: "Number",
					},
					{
						type: "input_value",
						name: "VALUE",
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
						name: "COLOR",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "BACKGROUND",
						check: "Colour",
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
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Text"],
				tooltip: getTooltip("ui_slider"),
			});

			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};
}

