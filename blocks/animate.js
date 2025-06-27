import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
  nextVariableIndexes,
  handleBlockCreateEvent,
  getHelpUrlFor,
} from "../blocks.js";
import {
  animationNames,
} from "../config.js";

export function defineAnimateBlocks() {
	Blockly.Blocks["glide_to"] = {
		init: function () {
		  this.jsonInit({
			type: "glide_to",
			message0:
			  "glide %1 to x %2 y %3 z %4 in %5 ms\n%6 return? %7 loop? %8 %9",
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
				  ["await", "AWAIT"],
				  ["start", "START"],
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
				  ["Linear", "Linear"],
				  ["SineEase", "SineEase"],
				  ["CubicEase", "CubicEase"],
				  ["QuadraticEase", "QuadraticEase"],
				  ["ExponentialEase", "ExponentialEase"],
				  ["BounceEase", "BounceEase"],
				  ["ElasticEase", "ElasticEase"],
				  ["BackEase", "BackEase"],
				],
			  },
			],
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Animate"],
			tooltip:
			  "Glide to a specified position over a duration with options for reversing, looping, and easing.",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["glide_to_seconds"] = {
		init: function () {
		  this.jsonInit({
			type: "glide_to_seconds",
			message0:
			  "glide %1 to x %2 y %3 z %4 in %5 seconds \n%6 return? %7 loop? %8 %9",
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
				  ["await", "AWAIT"],
				  ["start", "START"],
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
				  ["Linear", "Linear"],
				  ["SineEase", "SineEase"],
				  ["CubicEase", "CubicEase"],
				  ["QuadraticEase", "QuadraticEase"],
				  ["ExponentialEase", "ExponentialEase"],
				  ["BounceEase", "BounceEase"],
				  ["ElasticEase", "ElasticEase"],
				  ["BackEase", "BackEase"],
				],
			  },
			],
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Animate"],
			tooltip:
			  "Glide to a specified position over a duration with options for reversing, looping, and easing.",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["rotate_anim"] = {
		init: function () {
		  this.jsonInit({
			type: "rotate_anim",
			message0:
			  "rotate %1 to x %2 y %3 z %4 in %5 ms\n%6 reverse? %7 loop? %8  %9",
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
				  ["await", "AWAIT"],
				  ["start", "START"],
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
				  ["Linear", "Linear"],
				  ["SineEase", "SineEase"],
				  ["CubicEase", "CubicEase"],
				  ["QuadraticEase", "QuadraticEase"],
				  ["ExponentialEase", "ExponentialEase"],
				  ["BounceEase", "BounceEase"],
				  ["ElasticEase", "ElasticEase"],
				  ["BackEase", "BackEase"],
				],
			  },
			],
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Animate"],
			tooltip:
			  "Rotate a mesh to specified angles over a duration with options for reverse, looping, and easing.",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["rotate_anim_seconds"] = {
		init: function () {
		  this.jsonInit({
			type: "rotate_anim_seconds",
			message0:
			  "rotate %1 to x %2 y %3 z %4 in %5 seconds\n%6 reverse? %7 loop? %8  %9",
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
				  ["await", "AWAIT"],
				  ["start", "START"],
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
				  ["Linear", "Linear"],
				  ["SineEase", "SineEase"],
				  ["CubicEase", "CubicEase"],
				  ["QuadraticEase", "QuadraticEase"],
				  ["ExponentialEase", "ExponentialEase"],
				  ["BounceEase", "BounceEase"],
				  ["ElasticEase", "ElasticEase"],
				  ["BackEase", "BackEase"],
				],
			  },
			],
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Animate"],
			tooltip:
			  "Rotate a mesh to specified angles over a duration with options for reverse, looping, and easing.",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["animate_property"] = {
		init: function () {
		  this.jsonInit({
			type: "animate_property",
			message0: "animate %1 %2 to %3 in %4 ms reverse? %5 loop? %6 %7",
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
				  ["diffuse color", "diffuseColor"],
				  ["emissive color", "emissiveColor"],
				  ["ambient color", "ambientColor"],
				  ["specular color", "specularColor"],
				  ["alpha", "alpha"],
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
				  ["start", "start"],
				  ["await", "await"],
				],
			  },
			],
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Animate"],
			tooltip: "Animate a material property of the mesh and its children.",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["colour_keyframe"] = {
		init: function () {
		  this.jsonInit({
			type: "colour_keyframe",
			message0: "at %1 color: %2",
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
			tooltip: "Set a colour and duration for a keyframe.",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["number_keyframe"] = {
		init: function () {
		  this.jsonInit({
			type: "number_keyframe",
			message0: "at: %1 value: %2",
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
			tooltip: "Set a number and duration for a keyframe.",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["xyz_keyframe"] = {
		init: function () {
		  this.jsonInit({
			type: "xyz_keyframe",
			message0: "at: %1 x: %2 y: %3 z: %4",
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
			tooltip: "Set an XYZ keyframe with duration.",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["animate_keyframes"] = {
		init: function () {
		  this.jsonInit({
			type: "animate_keyframes",
			message0:
			  "animate keyframes on %1 property %2\nkeyframes %3\neasing %4 loop %5 reverse %6 %7",
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
				  ["color", "color"],
				  ["alpha", "alpha"],
				  ["position", "position"],
				  ["rotation", "rotation"],
				  ["scaling", "scaling"],
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
				  ["linear", "LINEAR"],
				  ["ease-in", "EASEIN"],
				  ["ease-out", "EASEOUT"],
				  ["ease-in-out", "EASEINOUT"],
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
				  ["await", "AWAIT"],
				  ["start", "START"],
				],
			  },
			],
			inputsInline: true,
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Animate"],
			tooltip:
			  "Animate an array of keyframes on the selected mesh, with easing, optional looping, and reversing.",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["animation"] = {
		init: function () {
		  const variableNamePrefix = "animation";
		  let nextVariableName =
			variableNamePrefix + nextVariableIndexes[variableNamePrefix];

		  this.jsonInit({
			type: "animation",
			message0:
			  "animate keyframes on %1 property %2 group %3\nkeyframes %4\neasing %5 loop %6 reverse %7 mode %8",
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
				  ["color", "color"],
				  ["alpha", "alpha"],
				  ["position", "position"],
				  ["rotation", "rotation"],
				  ["scaling", "scaling"],
				  ["position.x", "position.x"],
				  ["position.y", "position.y"],
				  ["position.z", "position.z"],
				  ["rotation.x", "rotation.x"],
				  ["rotation.y", "rotation.y"],
				  ["rotation.z", "rotation.z"],
				  ["scaling.x", "scaling.x"],
				  ["scaling.y", "scaling.y"],
				  ["scaling.z", "scaling.z"],
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
				  ["linear", "LINEAR"],
				  ["ease-in", "EASEIN"],
				  ["ease-out", "EASEOUT"],
				  ["ease-in-out", "EASEINOUT"],
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
				  ["start", "START"],
				  ["await", "AWAIT"],
				  ["create", "CREATE"],
				],
			  },
			],
			inputsInline: true,
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Animate"],
			tooltip:
			  "Create an animation group for the selected mesh and property, with keyframes, easing, optional looping, and reversing. Choose create, start, or await to control behaviour.",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
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
			message0: "animation group %1 %2",
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
				  ["▶️ Play", "play"],
				  ["⏸️ Pause", "pause"],
				  ["⏹️ Stop", "stop"],
				],
			  },
			],
			inputsInline: true,
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Animate"],
			tooltip:
			  "Control the animation group by playing, pausing, or stopping it.",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["animate_from"] = {
		init: function () {
		  this.jsonInit({
			type: "animate_from",
			message0: "animate group %1 from %2 seconds",
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
			tooltip:
			  "Start animating the group from the specified time (in seconds).",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["stop_animations"] = {
		init: function () {
		  this.jsonInit({
			type: "stop_animations",
			message0: "stop animations %1",
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
			tooltip:
			  "Stop all keyframe animations on the selected mesh.\nKeyword: stop",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	Blockly.Blocks["switch_animation"] = {
		init: function () {
		  this.jsonInit({
			type: "switch_model_animation",
			message0: "switch animation of %1 to %2",
			args0: [
			  {
				type: "field_variable",
				name: "MODEL",
				variable: window.currentMesh,
			  },
			  {
				type: "field_dropdown",
				name: "ANIMATION_NAME",
				options: animationNames,
			  },
			],
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Animate"],
			tooltip:
			  "Changes the animation of the specified mesh to the given animation.\nKeyword: switch",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["play_animation"] = {
		init: function () {
		  this.jsonInit({
			type: "play_model_animation_once",
			message0: "play animation %1 on %2",
			args0: [
			  {
				type: "field_dropdown",
				name: "ANIMATION_NAME",
				options: animationNames,
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
			tooltip:
			  "Play the selected animation once on the specified mesh.\nKeyword: play",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };
}
