import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
	nextVariableIndexes,
	handleBlockCreateEvent,
	getHelpUrlFor,
} from "../blocks.js";
import { animationNames } from "../config.js";
import {
	translate,
	getTooltip,
	getOption,
	getDropdownOption,
} from "../main/translation.js";

export function defineAnimateBlocks() {
	Blockly.Blocks["glide_to"] = {
		init: function () {
			this.jsonInit({
				type: "glide_to",
				message0: translate("glide_to"),
				args0: [
					{
						type: "field_variable",
						name: "MESH_VAR",
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
						type: "input_value",
						name: "DURATION",
						check: "Number",
					},
					{
						type: "field_dropdown",
						name: "MODE",
						options: [
							getDropdownOption("AWAIT"),
							getDropdownOption("START"),
						],
					},
					{
						type: "field_checkbox",
						name: "REVERSE",
						checked: false,
						text: "reverse",
					},
					{
						type: "field_checkbox",
						name: "LOOP",
						checked: false,
						text: "loop",
					},
					{
						type: "field_dropdown",
						name: "EASING",
						options: [
							getDropdownOption("Linear"),
							getDropdownOption("SineEase"),
							getDropdownOption("CubicEase"),
							getDropdownOption("QuadraticEase"),
							getDropdownOption("ExponentialEase"),
							getDropdownOption("BounceEase"),
							getDropdownOption("ElasticEase"),
							getDropdownOption("BackEase"),
						],
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Animate"],
				tooltip: getTooltip("glide_to"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("animate_blocks");
		},
	};

	Blockly.Blocks["glide_to_seconds"] = {
		init: function () {
			this.jsonInit({
				type: "glide_to_seconds",
				message0: translate("glide_to_seconds"),
				args0: [
					{
						type: "field_variable",
						name: "MESH_VAR",
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
						type: "input_value",
						name: "DURATION",
						check: "Number",
					},
					{
						type: "field_dropdown",
						name: "MODE",
						options: [
							getDropdownOption("AWAIT"),
							getDropdownOption("START"),
						],
					},
					{
						type: "field_checkbox",
						name: "REVERSE",
						checked: false,
						text: "reverse",
					},
					{
						type: "field_checkbox",
						name: "LOOP",
						checked: false,
						text: "loop",
					},
					{
						type: "field_dropdown",
						name: "EASING",
						options: [
							getDropdownOption("Linear"),
							getDropdownOption("SineEase"),
							getDropdownOption("CubicEase"),
							getDropdownOption("QuadraticEase"),
							getDropdownOption("ExponentialEase"),
							getDropdownOption("BounceEase"),
							getDropdownOption("ElasticEase"),
							getDropdownOption("BackEase"),
						],
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Animate"],
				tooltip: getTooltip("glide_to_seconds"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("animate_blocks");
		},
	};

	Blockly.Blocks["glide_to_object"] = {
		init: function () {
			this.jsonInit({
				type0: "glide_to_object",
				message0: "glide_to_object",
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
						type: "input_value",
						name: "DURATION",
						check: "Number",
					},
					{
						type: "field_dropdown",
						name: "MODE",
						options: [
							getDropdownOption("AWAIT"),
							getDropdownOption("START"),
						],
					},
					{
						type: "field_checkbox",
						name: "REVERSE",
						checked: false,
						text: "reverse",
					},
					{
						type: "field_checkbox",
						name: "LOOP",
						checked: false,
						text: "loop",
					},
					{
						type: "field_dropdown",
						name: "EASING",
						options: [
							getDropdownOption("Linear"),
							getDropdownOption("SineEase"),
							getDropdownOption("CubicEase"),
							getDropdownOption("QuadraticEase"),
							getDropdownOption("ExponentialEase"),
							getDropdownOption("BounceEase"),
							getDropdownOption("ElasticEase"),
							getDropdownOption("BackEase"),
						],
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Animate"],
				tooltip: getTooltip("glide_to_object"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("animate_blocks");
		},
	};

	Blockly.Blocks["rotate_anim"] = {
		init: function () {
			this.jsonInit({
				type: "rotate_anim",
				message0: translate("rotate_anim"),
				args0: [
					{
						type: "field_variable",
						name: "MESH_VAR",
						variable: window.currentMesh,
					},
					{
						type: "input_value",
						name: "ROT_X",
						check: "Number",
					},
					{
						type: "input_value",
						name: "ROT_Y",
						check: "Number",
					},
					{
						type: "input_value",
						name: "ROT_Z",
						check: "Number",
					},
					{
						type: "input_value",
						name: "DURATION",
						check: "Number",
					},
					{
						type: "field_dropdown",
						name: "MODE",
						options: [
							getDropdownOption("AWAIT"),
							getDropdownOption("START"),
						],
					},
					{
						type: "field_checkbox",
						name: "REVERSE",
						checked: false,
						text: "reverse",
					},
					{
						type: "field_checkbox",
						name: "LOOP",
						checked: false,
						text: "loop",
					},
					{
						type: "field_dropdown",
						name: "EASING",
						options: [
							getDropdownOption("Linear"),
							getDropdownOption("SineEase"),
							getDropdownOption("CubicEase"),
							getDropdownOption("QuadraticEase"),
							getDropdownOption("ExponentialEase"),
							getDropdownOption("BounceEase"),
							getDropdownOption("ElasticEase"),
							getDropdownOption("BackEase"),
						],
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Animate"],
				tooltip: getTooltip("rotate_anim"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("animate_blocks");
		},
	};

	Blockly.Blocks["rotate_anim_seconds"] = {
		init: function () {
			this.jsonInit({
				type: "rotate_anim_seconds",
				message0: translate("rotate_anim_seconds"),
				args0: [
					{
						type: "field_variable",
						name: "MESH_VAR",
						variable: window.currentMesh,
					},
					{
						type: "input_value",
						name: "ROT_X",
						check: "Number",
					},
					{
						type: "input_value",
						name: "ROT_Y",
						check: "Number",
					},
					{
						type: "input_value",
						name: "ROT_Z",
						check: "Number",
					},
					{
						type: "input_value",
						name: "DURATION",
						check: "Number",
					},
					{
						type: "field_dropdown",
						name: "MODE",
						options: [
							getDropdownOption("AWAIT"),
							getDropdownOption("START"),
						],
					},
					{
						type: "field_checkbox",
						name: "REVERSE",
						checked: false,
						text: "reverse",
					},
					{
						type: "field_checkbox",
						name: "LOOP",
						checked: false,
						text: "loop",
					},
					{
						type: "field_dropdown",
						name: "EASING",
						options: [
							getDropdownOption("Linear"),
							getDropdownOption("SineEase"),
							getDropdownOption("CubicEase"),
							getDropdownOption("QuadraticEase"),
							getDropdownOption("ExponentialEase"),
							getDropdownOption("BounceEase"),
							getDropdownOption("ElasticEase"),
							getDropdownOption("BackEase"),
						],
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Animate"],
				tooltip: getTooltip("rotate_anim_seconds"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("animate_blocks");
		},
	};

	Blockly.Blocks["animate_property"] = {
		init: function () {
			this.jsonInit({
				type: "animate_property",
				message0: translate("animate_property"),
				args0: [
					{
						type: "field_variable",
						name: "MESH_VAR",
						variable: window.currentMesh,
					},
					{
						type: "field_dropdown",
						name: "PROPERTY",
						options: [
							getDropdownOption("diffuseColor"),
							getDropdownOption("emissiveColor"),
							getDropdownOption("ambientColor"),
							getDropdownOption("specularColor"),
							getDropdownOption("alpha"),
						],
					},
					{
						type: "input_value",
						name: "TO",
					},
					{
						type: "input_value",
						name: "DURATION",
						check: "Number",
					},
					{
						type: "field_checkbox",
						name: "REVERSE",
						checked: false,
						text: "reverse",
					},
					{
						type: "field_checkbox",
						name: "LOOP",
						checked: false,
						text: "loop",
					},
					{
						type: "field_dropdown",
						name: "START_AWAIT",
						options: [
							getDropdownOption("AWAIT"),
							getDropdownOption("START"),
						],
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Animate"],
				tooltip: getTooltip("animate_property"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			  this.setStyle('animate_blocks');  
		},
	};

	Blockly.Blocks["colour_keyframe"] = {
		init: function () {
			this.jsonInit({
				type: "colour_keyframe",
				message0: translate("colour_keyframe"),
				args0: [
					{
						type: "input_value",
						name: "DURATION",
						check: "Number",
					},
					{
						type: "input_value",
						name: "VALUE",
						check: "Colour", // Reusing your existing colour block
					},
				],
				colour: categoryColours["Animate"],
				inputsInline: true,
				output: "Keyframe",
				tooltip: getTooltip("colour_keyframe"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("animate_blocks");
		},
	};

	Blockly.Blocks["number_keyframe"] = {
		init: function () {
			this.jsonInit({
				type: "number_keyframe",
				message0: translate("number_keyframe"),
				args0: [
					{
						type: "input_value",
						name: "DURATION",
						check: "Number",
					},
					{
						type: "input_value",
						name: "VALUE",
						check: "Number", // Reusing your existing colour block
					},
				],
				colour: categoryColours["Animate"],
				inputsInline: true,
				output: "Keyframe",
				tooltip: getTooltip("number_keyframe"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("animate_blocks");
		},
	};

	Blockly.Blocks["xyz_keyframe"] = {
		init: function () {
			this.jsonInit({
				type: "xyz_keyframe",
				message0: translate("xyz_keyframe"),
				args0: [
					{
						type: "input_value",
						name: "DURATION",
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
				colour: categoryColours["Animate"],
				inputsInline: true,
				output: "Keyframe",
				tooltip: getTooltip("xyz_keyframe"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("animate_blocks");
		},
	};

	Blockly.Blocks["animate_keyframes"] = {
		init: function () {
			this.jsonInit({
				type: "animate_keyframes",
				message0: translate("animate_keyframes"),
				args0: [
					{
						type: "field_variable",
						name: "MESH",
						variable: window.currentMesh, // Assuming current mesh is stored here
					},
					{
						type: "field_dropdown",
						name: "PROPERTY",
						options: [
							getDropdownOption("color"),
							getDropdownOption("alpha"),
							getDropdownOption("position"),
							getDropdownOption("rotation"),
							getDropdownOption("scaling"),
						],
					},
					{
						type: "input_value",
						name: "KEYFRAMES",
						check: "Array", // Accepts an array of keyframes
					},
					{
						type: "field_dropdown",
						name: "EASING",
						options: [
							getDropdownOption("LINEAR"),
							getDropdownOption("EASEIN"),
							getDropdownOption("EASEOUT"),
							getDropdownOption("EASEINOUT"),
						],
					},
					{
						type: "field_checkbox",
						name: "LOOP",
						checked: false, // Checkbox for looping
					},
					{
						type: "field_checkbox",
						name: "REVERSE",
						checked: false, // Checkbox for reversing the animation
					},
					{
						type: "field_dropdown",
						name: "MODE",
						options: [
							getDropdownOption("AWAIT"),
							getDropdownOption("START"),
						],
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Animate"],
				tooltip: getTooltip("animate_keyframes"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("animate_blocks");
		},
	};

	Blockly.Blocks["animation"] = {
		init: function () {
			const variableNamePrefix = "animation";
			let nextVariableName =
				variableNamePrefix + nextVariableIndexes[variableNamePrefix];

			this.jsonInit({
				type: "animation",
				message0: translate("animation"),
				args0: [
					{
						type: "field_variable",
						name: "MESH",
						variable: window.currentMesh, // Assuming current mesh is stored here
					},
					{
						type: "field_dropdown",
						name: "PROPERTY",
						options: [
							getDropdownOption("color"),
							getDropdownOption("alpha"),
							getDropdownOption("position"),
							getDropdownOption("rotation"),
							getDropdownOption("scaling"),
							getDropdownOption("position.x"),
							getDropdownOption("position.y"),
							getDropdownOption("position.z"),
							getDropdownOption("rotation.x"),
							getDropdownOption("rotation.y"),
							getDropdownOption("rotation.z"),
							getDropdownOption("scaling.x"),
							getDropdownOption("scaling.y"),
							getDropdownOption("scaling.z"),
						],
					},
					{
						type: "field_variable",
						name: "ANIMATION_GROUP",
						variable: nextVariableName, // Use the dynamic variable name
					},
					{
						type: "input_value",
						name: "KEYFRAMES",
						check: "Array",
					},
					{
						type: "field_dropdown",
						name: "EASING",
						options: [
							getDropdownOption("LINEAR"),
							getDropdownOption("EASEIN"),
							getDropdownOption("EASEOUT"),
							getDropdownOption("EASEINOUT"),
						],
					},
					{
						type: "field_checkbox",
						name: "LOOP",
						checked: false,
					},
					{
						type: "field_checkbox",
						name: "REVERSE",
						checked: false,
					},
					{
						type: "field_dropdown",
						name: "MODE",
						options: [
							getDropdownOption("AWAIT"),
							getDropdownOption("START"),
							getDropdownOption("CREATE"),
						],
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Animate"],
				tooltip: getTooltip("animation"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("animate_blocks");
			this.setOnChange((changeEvent) => {
				handleBlockCreateEvent(
					this,
					changeEvent,
					variableNamePrefix,
					nextVariableIndexes,
					"ANIMATION_GROUP",
				);

				if (window.loadingCode) return;
			});
		},
	};

	Blockly.Blocks["control_animation_group"] = {
		init: function () {
			this.jsonInit({
				type: "animation_group_control",
				message0: translate("control_animation_group"),
				args0: [
					{
						type: "field_variable",
						name: "GROUP_NAME",
						variable: "animation1",
					},
					{
						type: "field_dropdown",
						name: "ACTION",
						options: [
							getDropdownOption("play"),
							getDropdownOption("pause"),
							getDropdownOption("stop"),
						],
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Animate"],
				tooltip: getTooltip("control_animation_group"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("animate_blocks");
		},
	};

	Blockly.Blocks["animate_from"] = {
		init: function () {
			this.jsonInit({
				type: "animate_from",
				message0: translate("animate_from"),
				args0: [
					{
						type: "field_variable",
						name: "GROUP_NAME",
						variable: "animation1",
					},
					{
						type: "input_value",
						name: "TIME",
						check: "Number",
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Animate"],
				tooltip: getTooltip("animate_from"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("animate_blocks");
		},
	};

	Blockly.Blocks["stop_animations"] = {
		init: function () {
			this.jsonInit({
				type: "stop_animations",
				message0: translate("stop_animations"),
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
				colour: categoryColours["Animate"],
				tooltip: getTooltip("stop_animations"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("animate_blocks");
		},
	};

	Blockly.Blocks["switch_animation"] = {
		init: function () {
			this.jsonInit({
				type: "switch_model_animation",
				message0: translate("switch_animation"),
				args0: [
					{
						type: "field_dropdown",
						name: "ANIMATION_NAME",
						options: animationNames(),
					},
					{
						type: "field_variable",
						name: "MODEL",
						variable: window.currentMesh,
					},		
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Animate"],
				tooltip: getTooltip("switch_animation"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("animate_blocks");
		},
	};

	Blockly.Blocks["play_animation"] = {
		init: function () {
			this.jsonInit({
				type: "play_model_animation_once",
				message0: translate("play_animation"),
				args0: [
					{
						type: "field_dropdown",
						name: "ANIMATION_NAME",
						options: animationNames(),
					},
					{
						type: "field_variable",
						name: "MODEL",
						variable: window.currentMesh,
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Animate"],
				tooltip: getTooltip("play_animation"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("animate_blocks");
		},
	};
}
