import * as Blockly from "blockly";
import "@blockly/block-plus-minus";
import { categoryColours, toolbox } from "./toolbox.js";
import {
	audioNames,
	characterNames,
	objectNames,
	objectColours,
	mapNames,
	modelNames,
	animationNames,
	materialNames,
} from "./config.js";
/*import {
  ScrollOptions,
  ScrollBlockDragger,
  ScrollMetricsManager,
} from '@blockly/plugin-scroll-options';*/
/*import {Multiselect, MultiselectBlockDragger} from '@mit-app-inventor/blockly-plugin-workspace-multiselect';*/

let nextVariableIndexes = {};

window.currentMesh = "mesh";
window.currentBlock = null;

export function handleBlockSelect(event) {
	if (event.type === Blockly.Events.SELECTED) {
		const block = Blockly.getMainWorkspace().getBlockById(
			event.newElementId,
		); // Get the selected block

		if (
			block &&
			block.type !== "create_ground" &&
			(block.type.startsWith("create_") || block.type.startsWith("load_"))
		) {
			// If the block is a create block, update the window.currentMesh variable
			window.updateCurrentMeshName(block, "ID_VAR");
		}
	}
}

export function handleBlockDelete(event) {
	if (event.type === Blockly.Events.BLOCK_DELETE) {
		window.deleteMeshFromBlock(event.blockId);
	}
}

function findCreateBlock(block) {
	if (!block || typeof block.getParent !== "function") {
		console.warn("Invalid block provided to findParentCreateOrLoad.");
		return null;
	}

	let parent = block;

	while (parent) {
		if (
			parent.type.startsWith("create_") ||
			parent.type.startsWith("load_")
		) {
			return parent;
		}

		// Move up the hierarchy
		parent = parent.getParent();
	}

	// No matching parent found
	return null;
}

export default Blockly.Theme.defineTheme("flock", {
	base: Blockly.Themes.Modern,
	componentStyles: {
		workspaceBackgroundColour: "white",
		toolboxBackgroundColour: "#ffffff66",
		//'toolboxForegroundColour': '#fff',
		//'flyoutBackgroundColour': '#252526',
		//'flyoutForegroundColour': '#ccc',
		//'flyoutOpacity': 1,
		//'scrollbarColour': '#797979',
		insertionMarkerColour: "#defd6c",
		insertionMarkerOpacity: 0.3,
		scrollbarOpacity: 0.4,
		cursorColour: "#defd6c",
		//'blackBackground': '#333',
	},
});

export const options = {
	theme: Blockly.Themes.Modern, // "flock"
	renderer: "zelos",
	zoom: {
		controls: true,
		wheel: false,
		startScale: 0.7,
		maxScale: 3,
		minScale: 0.3,
		scaleSpeed: 1.2,
	},
	move: {
		scrollbars: {
			horizontal: true,
			vertical: true,
		},
		drag: true,
		wheel: true,
	},
	toolbox: toolbox,
	plugins: {
		// blockDragger: ScrollBlockDragger,
		//metricsManager: ScrollMetricsManager,
	},
	/*plugins: {
		, // Required to work
	},
blockDragger: MultiselectBlockDragger,
	// // For integration with other plugins that also
	// // need to change the blockDragger above (such as
	// // scroll-options).
	baseBlockDragger: ScrollBlockDragger,

	// Double click the blocks to collapse/expand
	// them (A feature from MIT App Inventor).
	useDoubleClick: false,
	// Bump neighbours after dragging to avoid overlapping.
	bumpNeighbours: false,

	// Keep the fields of multiple selected same-type blocks with the same value
	multiFieldUpdate: true,

	// Auto focus the workspace when the mouse enters.
	workspaceAutoFocus: true,

	// Use custom icon for the multi select controls.
	multiselectIcon: {
		hideIcon: false,
		weight: 3,
		enabledIcon:
			"https://github.com/mit-cml/workspace-multiselect/raw/main/test/media/select.svg",
		disabledIcon:
			"https://github.com/mit-cml/workspace-multiselect/raw/main/test/media/unselect.svg",
	},

	multiselectCopyPaste: {
		// Enable the copy/paste accross tabs feature (true by default).
		crossTab: true,
		// Show the copy/paste menu entries (true by default).
		menu: true,
	},*/
};

/*const multiselectPlugin = new Multiselect(workspace);
multiselectPlugin.init(options);*/

/*const plugin = new ScrollOptions(workspace);
plugin.init();*/

export function initializeVariableIndexes() {
	nextVariableIndexes = {
		model: 1,
		box: 1,
		sphere: 1,
		cylinder: 1,
		capsule: 1,
		plane: 1,
		wall: 1,
		text: 1,
		sound: 1,
		character: 1,
		object: 1,
		instrument: 1,
	};

	const allVariables = Blockly.getMainWorkspace().getAllVariables(); // Retrieve all variables in the workspace

	// Process each type of variable
	Object.keys(nextVariableIndexes).forEach(function (type) {
		let maxIndex = 0; // To keep track of the highest index used so far
		// Regular expression to match variable names like 'type1', 'type2', etc.
		const varPattern = new RegExp(`^${type}(\\d+)$`);

		allVariables.forEach(function (variable) {
			const match = variable.name.match(varPattern);
			if (match) {
				const currentIndex = parseInt(match[1], 10);
				if (currentIndex > maxIndex) {
					maxIndex = currentIndex;
				}
			}
		});

		nextVariableIndexes[type] = maxIndex + 1;
	});

	// Optionally return the indexes if needed elsewhere
	return nextVariableIndexes;
}
export function defineBlocks() {
	Blockly.Blocks["start"] = {
		init: function () {
			this.jsonInit({
				type: "start",
				message0: "start\n%1",
				args0: [
					{
						type: "input_statement",
						name: "DO",
					},
				],
				colour: categoryColours["Events"],
				tooltip:
					"Run the attached blocks when the project starts.\nKeyword: start",
			});
		},
	};

	Blockly.Blocks["create_ground"] = {
		init: function () {
			this.jsonInit({
				type: "create_ground",
				message0: "ground %1",
				args0: [
					{
						type: "input_value",
						name: "COLOR",
						colour: "#71BC78",
						check: "Colour",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Scene"],
				tooltip:
					"Adds a ground plane with collisions enabled to the scene, with specified color.\nKeyword: ground",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["create_custom_map"] = {
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
	};

	Blockly.Blocks["get_property"] = {
		init: function () {
			this.jsonInit({
				type: "get_property",
				message0: "get %1 of %2",
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
				tooltip:
					"Gets the value of the selected property of a mesh.\nKeyword: get",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["canvas_controls"] = {
		init: function () {
			this.jsonInit({
				type: "canvas_controls",
				message0: "canvas controls %1",
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
				tooltip:
					"Add or removes canvas motion controls.\nKeyword: canvas",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["button_controls"] = {
		init: function () {
			this.jsonInit({
				type: "button_controls",
				message0: "button controls %1 enabled %2 color %3",
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
				tooltip: "Configure button controls.\nKeyword: button",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["wait"] = {
		init: function () {
			this.jsonInit({
				type: "wait",
				message0: "wait %1 ms",
				args0: [
					{
						type: "input_value",
						name: "DURATION",
						check: "Number",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Control"],
				tooltip:
					"Wait for a specified time in milliseconds.\nKeyword: wait",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["wait_until"] = {
		init: function () {
			this.jsonInit({
				type: "wait_until",
				message0: "wait until %1",
				args0: [
					{
						type: "input_value",
						name: "CONDITION",
						check: "Boolean",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Control"],
				tooltip: "Wait until the condition is true.",
				helpUrl: "",
			});
		},
	};

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
				colour: categoryColours["Motion"],
				tooltip:
					"Glide to a specified position over a duration with options for reversing, looping, and easing.",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["rotate_anim"] = {
		init: function () {
			this.jsonInit({
				type: "rotate_anim",
				message0:
					"rotate %1 to x %2 y %3 z %4 in %5 ms %6 reverse? %7 loop? %8  %9",
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
				colour: categoryColours["Motion"],
				tooltip:
					"Rotate a mesh to specified angles over a duration with options for reverse, looping, and easing.",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["animate_property"] = {
		init: function () {
			this.jsonInit({
				type: "animate_property",
				message0:
					"animate %1 %2 to %3 in %4 ms reverse? %5 loop? %6 %7",
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
				colour: categoryColours["Looks"],
				tooltip:
					"Animates a material property of the mesh and its children.",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["colour_keyframe"] = {
		init: function () {
			this.jsonInit({
				type: "colour_keyframe",
				message0: "duration: %1 colour: %2",
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
				colour: categoryColours["Motion"],
				inputsInline: true,
				output: "Keyframe",
				tooltip: "Set a colour and duration for a keyframe.",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["number_keyframe"] = {
		init: function () {
			this.jsonInit({
				type: "number_keyframe",
				message0: "duration: %1 colour: %2",
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
				colour: categoryColours["Motion"],
				inputsInline: true,
				output: "Keyframe",
				tooltip: "Set a number and duration for a keyframe.",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["xyz_keyframe"] = {
		init: function () {
			this.jsonInit({
				type: "xyz_keyframe",
				message0: "duration: %1 x: %2 y: %3 z: %4",
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
				colour: categoryColours["Motion"],
				inputsInline: true,
				output: "Keyframe",
				tooltip: "Set an XYZ keyframe with duration.",
				helpUrl: "",
			});
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
				colour: categoryColours["Motion"],
				tooltip:
					"Animates an array of keyframes on the selected mesh, with easing, optional looping, and reversing.",
				helpUrl: "",
			});
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
							["min", "Number.MIN_SAFE_INTEGER"],
							["centre", "0"],
							["max", "Number.MAX_SAFE_INTEGER"],
						],
					},
				],
				output: "Number", // Returns a numeric value
				colour: categoryColours["Motion"],
				tooltip: "Choose min, centre, or max for the pivot point",
				helpUrl: "",
			});
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
						check: "Number", // Accepts numeric input for X
					},
					{
						type: "input_value",
						name: "Y_PIVOT",
						check: "Number", // Accepts numeric input for Y
					},
					{
						type: "input_value",
						name: "Z_PIVOT",
						check: "Number", // Accepts numeric input for Z
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Motion"],
				tooltip:
					"Sets the pivot point for a mesh on the X, Y, and Z axes",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["set_sky_color"] = {
		init: function () {
			this.jsonInit({
				type: "set_sky_color",
				message0: "sky %1",
				args0: [
					{
						type: "input_value",
						name: "COLOR",
						colour: "#6495ED",
						check: "Colour",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Scene"],
				tooltip: "Sets the sky color of the scene.\nKeyword: sky",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["set_fog"] = {
		init: function () {
			this.jsonInit({
				type: "set_fog",
				message0: "set fog color %1 mode %2 density %3",
				args0: [
					{
						type: "input_value",
						name: "FOG_COLOR",
						colour: "#ffffff",
						check: "Colour",
					},
					{
						type: "field_dropdown",
						name: "FOG_MODE",
						options: [
							["Linear", "LINEAR"],
							["None", "NONE"],
							["Exp", "EXP"],
							["Exp2", "EXP2"],
						],
					},
					{
						type: "input_value",
						name: "DENSITY",
						check: "Number",
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Scene"],
				tooltip: "Configures the scene's fog.\nKeyword: fog",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["load_character"] = {
		init: function () {
			const variableNamePrefix = "character";
			let nextVariableName =
				variableNamePrefix + nextVariableIndexes[variableNamePrefix];
			this.jsonInit({
				message0: `new %1 %2 scale: %3 x: %4 y: %5 z: %6
				Hair: %7 Skin: %8 Eyes: %9 Sleeves: %10 Shorts: %11 T-Shirt: %12`,
				args0: [
					{
						type: "field_grid_dropdown",
						name: "MODELS",
						columns: 6,
						options: characterNames.map((name) => {
							const baseName = name.replace(/\.[^/.]+$/, "");
							return [
								{
									src: `./images/${baseName}.png`,
									width: 50,
									height: 50,
									alt: baseName,
								},
								name,
							];
						}),
					},
					{
						type: "field_variable",
						name: "ID_VAR",
						variable: nextVariableName,
					},
					{
						type: "input_value",
						name: "SCALE",
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
					{
						type: "input_value",
						name: "HAIR_COLOR",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "SKIN_COLOR",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "EYES_COLOR",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "SLEEVES_COLOR",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "SHORTS_COLOR",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "TSHIRT_COLOR",
						check: "Colour",
					},
				],
				inputsInline: true,
				colour: categoryColours["Scene"],
				tooltip: "Create a configurable character.\nKeyword: character",
				helpUrl: "",
				previousStatement: null,
				nextStatement: null,
			});

			this.setOnChange((changeEvent) => {
				if (
					changeEvent.type === Blockly.Events.BLOCK_CREATE ||
					changeEvent.type === Blockly.Events.BLOCK_CHANGE
				) {
					const blockInWorkspace =
						Blockly.getMainWorkspace().getBlockById(this.id); // Check if block is in the main workspace

					if (blockInWorkspace) {
						window.updateCurrentMeshName(this, "ID_VAR"); // Call the function to update window.currentMesh
					}
				}

				handleBlockCreateEvent(
					this,
					changeEvent,
					variableNamePrefix,
					nextVariableIndexes,
				);
			});

			addDoMutatorWithToggleBehavior(this);
		},
	};

	Blockly.Blocks["load_object"] = {
		init: function () {
			const defaultObject = "Star.glb";
			const defaultColour = objectColours[defaultObject] || "#000000";
			const variableNamePrefix = "object";
			let nextVariableName =
				variableNamePrefix + nextVariableIndexes[variableNamePrefix];

			// Add the main inputs of the block
			this.jsonInit({
				message0: `new %1 %2 %3 scale: %4 x: %5 y: %6 z: %7`,
				args0: [
					{
						type: "field_grid_dropdown",
						name: "MODELS",
						columns: 6,
						options: objectNames.map((name) => {
							const baseName = name.replace(/\.[^/.]+$/, "");
							return [
								{
									src: `./images/${baseName}.png`,
									width: 50,
									height: 50,
									alt: baseName,
								},
								name,
							];
						}),
					},
					{
						type: "field_variable",
						name: "ID_VAR",
						variable: nextVariableName,
					},
					{
						type: "input_value",
						name: "COLOR",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "SCALE",
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
				colour: categoryColours["Scene"],
				tooltip: "Create an object.\nKeyword: object",
				helpUrl: "",
				previousStatement: null,
				nextStatement: null,
			});

			// Function to update the COLOR field based on the selected model
			const updateColorField = () => {
				const selectedObject = this.getFieldValue("MODELS");
				const colour = objectColours[selectedObject] || defaultColour;
				const colorInput = this.getInput("COLOR");
				const colorField = colorInput.connection.targetBlock();
				if (colorField) {
					colorField.setFieldValue(colour, "COLOR"); // Update COLOR field
				}
			};

			this.setOnChange((changeEvent) => {
				if (
					changeEvent.type === Blockly.Events.BLOCK_CREATE ||
					changeEvent.type === Blockly.Events.BLOCK_CHANGE
				) {
					const blockInWorkspace =
						Blockly.getMainWorkspace().getBlockById(this.id); // Check if block is in the main workspace

					if (blockInWorkspace) {
						window.updateCurrentMeshName(this, "ID_VAR"); // Call the function to update window.currentMesh
					}
				}

				handleBlockCreateEvent(
					this,
					changeEvent,
					variableNamePrefix,
					nextVariableIndexes,
				);

				if (window.loadingCode) return;
				if (
					changeEvent.type === Blockly.Events.CHANGE &&
					changeEvent.element === "field" &&
					changeEvent.name === "MODELS"
				) {
					updateColorField();
				}
			});

			addDoMutatorWithToggleBehavior(this);
		},
	};

	function addDoMutatorWithToggleBehavior(block) {
		// Custom function to toggle the "do" block mutation
		block.toggleDoBlock = function () {
			const hasDo = this.getInput("DO") ? true : false;
			if (hasDo) {
				this.removeInput("DO");
			} else {
				this.appendStatementInput("DO")
					.setCheck(null)
					.appendField("then do");
			}
		};

		// Add the toggle button to the block
		const toggleButton = new Blockly.FieldImage(
			"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCAzMCAzMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4gPHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xNSA2djloLTl2M2g5djloM3YtOWg5di0zaC05di05eiIvPjwvc3ZnPg==", // Custom icon
			30,
			30,
			"*", // Width, Height, Alt text
			block.toggleDoBlock.bind(block), // Bind the event handler to the block
		);

		// Add the button to the block
		block.appendDummyInput().appendField(toggleButton, "TOGGLE_BUTTON");

		// Save the mutation state
		block.mutationToDom = function () {
			const container = document.createElement("mutation");
			container.setAttribute(
				"has_do",
				this.getInput("DO") ? "true" : "false",
			);
			return container;
		};

		// Restore the mutation state
		block.domToMutation = function (xmlElement) {
			const hasDo = xmlElement.getAttribute("has_do") === "true";
			if (hasDo) {
				this.appendStatementInput("DO")
					.setCheck(null)
					.appendField("then do");
			}
		};
	}

	Blockly.Blocks["load_model"] = {
		init: function () {
			const variableNamePrefix = "model";
			let nextVariableName =
				variableNamePrefix + nextVariableIndexes[variableNamePrefix]; // Start with "model1"

			this.jsonInit({
				message0: "new %1 %2 scale: %3 x: %4 y: %5 z: %6",
				args0: [
					{
						type: "field_grid_dropdown",
						name: "MODELS",
						columns: 6,
						options: modelNames.map((name) => {
							const baseName = name.replace(/\.[^/.]+$/, "");
							return [
								{
									src: `./images/${baseName}.png`,
									width: 50,
									height: 50,
									alt: baseName,
								},
								name,
							];
						}),
					},
					{
						type: "field_variable",
						name: "ID_VAR",
						variable: nextVariableName,
					},
					{
						type: "input_value",
						name: "SCALE",
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
				colour: categoryColours["Scene"],
				tooltip: "Load a model.\nKeyword: model",
				helpUrl: "",
				previousStatement: null,
				nextStatement: null,
			});

			this.setOnChange((changeEvent) => {
				if (
					changeEvent.type === Blockly.Events.BLOCK_CREATE ||
					changeEvent.type === Blockly.Events.BLOCK_CHANGE
				) {
					const blockInWorkspace =
						Blockly.getMainWorkspace().getBlockById(this.id); // Check if block is in the main workspace

					if (blockInWorkspace) {
						window.updateOrCreateMeshFromBlock(this);
					}
				}

				handleBlockCreateEvent(
					this,
					changeEvent,
					variableNamePrefix,
					nextVariableIndexes,
				);
			});

			addDoMutatorWithToggleBehavior(this);
		},
	};

	function handleBlockCreateEvent(
		blockInstance,
		changeEvent,
		variableNamePrefix,
		nextVariableIndexes,
	) {
		if (window.loadingCode) return; // Don't rename variables

		if (
			!blockInstance.isInFlyout &&
			changeEvent.type === Blockly.Events.BLOCK_CREATE &&
			changeEvent.ids.includes(blockInstance.id)
		) {
			// Check if the ID_VAR field already has a value
			const idVarField = blockInstance.getField("ID_VAR");
			if (idVarField) {
				const variableId = idVarField.getValue();
				const variable =
					blockInstance.workspace.getVariableById(variableId);

				// Check if the variable name matches the pattern "prefixn"
				const variableNamePattern = new RegExp(
					`^${variableNamePrefix}\\d+$`,
				);
				const variableName = variable ? variable.name : "";

				if (!variableNamePattern.test(variableName)) {
					// Don't change
				} else {
					// If the variable name matches the pattern, create and set a new variable
					if (!nextVariableIndexes[variableNamePrefix]) {
						nextVariableIndexes[variableNamePrefix] = 1; // Initialize if not already present
					}
					let newVariableName =
						variableNamePrefix +
						nextVariableIndexes[variableNamePrefix];
					let newVariable =
						blockInstance.workspace.getVariable(newVariableName);
					if (!newVariable) {
						newVariable = blockInstance.workspace.createVariable(
							newVariableName,
							null,
						);
					}
					idVarField.setValue(newVariable.getId());

					// Increment the variable index for the next variable name
					nextVariableIndexes[variableNamePrefix] += 1;
				}
			}
		}
	}

	function updateCurrentMeshName(block, variableFieldName) {
		const variableName = block.getField(variableFieldName).getText(); // Get the selected variable name

		if (variableName) {
			window.currentMesh = variableName;
			window.currentBlock = block;
		}
	}

	window.updateCurrentMeshName = updateCurrentMeshName;

	Blockly.Blocks["create_box"] = {
		init: function () {
			const variableNamePrefix = "box";
			let nextVariableName =
				variableNamePrefix + nextVariableIndexes[variableNamePrefix]; // Start with "box1";

			this.jsonInit({
				type: "create_box",
				message0:
					"new box %1 %2 width %3 height %4 depth %5 \n at x %6 y %7 z %8",
				args0: [
					{
						type: "field_variable",
						name: "ID_VAR",
						variable: nextVariableName,
					},
					{
						type: "input_value",
						name: "COLOR",
						colour: "#9932CC",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "WIDTH",
						check: "Number",
					},
					{
						type: "input_value",
						name: "HEIGHT",
						check: "Number",
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
				previousStatement: null,
				nextStatement: null,
				inputsInline: true,
				colour: categoryColours["Scene"],
				tooltip:
					"Creates a colored box with specified dimensions and position.\nKeyword: box",
				helpUrl: "",
			});

			this.setOnChange((changeEvent) => {
				if (
					changeEvent.type === Blockly.Events.BLOCK_CREATE ||
					changeEvent.type === Blockly.Events.BLOCK_CHANGE
				) {
					const parent = findCreateBlock(this);
					if (parent == this) {
						const blockInWorkspace =
							Blockly.getMainWorkspace().getBlockById(this.id);

						if (blockInWorkspace) {
							window.updateOrCreateMeshFromBlock(this);
						}
					}
				}

				handleBlockCreateEvent(
					this,
					changeEvent,
					variableNamePrefix,
					nextVariableIndexes,
				);
			});
			addDoMutatorWithToggleBehavior(this);
		},
	};

	Blockly.Blocks["create_sphere"] = {
		init: function () {
			const variableNamePrefix = "sphere";
			let nextVariableName =
				variableNamePrefix + nextVariableIndexes[variableNamePrefix];
			this.jsonInit({
				type: "create_sphere",
				message0:
					"new sphere %1 %2 diameter x %3 diameter y %4 diameter z %5\nat x %6 y %7 z %8",
				args0: [
					{
						type: "field_variable",
						name: "ID_VAR",
						variable: nextVariableName,
					},
					{
						type: "input_value",
						name: "COLOR",
						colour: "#9932CC",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "DIAMETER_X",
						check: "Number",
					},
					{
						type: "input_value",
						name: "DIAMETER_Y",
						check: "Number",
					},
					{
						type: "input_value",
						name: "DIAMETER_Z",
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
				previousStatement: null,
				nextStatement: null,
				inputsInline: true,
				colour: categoryColours["Scene"],
				tooltip:
					"Creates a colored sphere with specified dimensions and position.\nKeyword: sphere",
				helpUrl: "",
			});

			this.setOnChange((changeEvent) => {
				if (
					changeEvent.type === Blockly.Events.BLOCK_CREATE ||
					changeEvent.type === Blockly.Events.BLOCK_CHANGE
				) {
					const parent = findCreateBlock(this);
					if (parent == this) {
						const blockInWorkspace =
							Blockly.getMainWorkspace().getBlockById(this.id);

						if (blockInWorkspace) {
							window.updateOrCreateMeshFromBlock(this);
						}
					}
				}

				handleBlockCreateEvent(
					this,
					changeEvent,
					variableNamePrefix,
					nextVariableIndexes,
				);
			});

			addDoMutatorWithToggleBehavior(this);
		},
	};

	Blockly.Blocks["create_cylinder"] = {
		init: function () {
			const variableNamePrefix = "cylinder";
			let nextVariableName =
				variableNamePrefix + nextVariableIndexes[variableNamePrefix];
			this.jsonInit({
				type: "create_cylinder",
				message0:
					"new cylinder %1 %2 height %3 top %4 bottom %5 \nat x %6 y %7 z %8",
				args0: [
					{
						type: "field_variable",
						name: "ID_VAR",
						variable: nextVariableName,
					},
					{
						type: "input_value",
						name: "COLOR",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "HEIGHT",
						check: "Number",
					},
					{
						type: "input_value",
						name: "DIAMETER_TOP",
						check: "Number",
					},
					{
						type: "input_value",
						name: "DIAMETER_BOTTOM",
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
				previousStatement: null,
				nextStatement: null,
				inputsInline: true,
				colour: categoryColours["Scene"],
				tooltip:
					"Creates a colored cylinder with specified dimensions and position.\nKeyword: cylinder",
				helpUrl: "",
			});

			this.setOnChange((changeEvent) => {
				if (
					changeEvent.type === Blockly.Events.BLOCK_CREATE ||
					changeEvent.type === Blockly.Events.BLOCK_CHANGE
				) {
					const parent = findCreateBlock(this);
					if (parent == this) {
						const blockInWorkspace =
							Blockly.getMainWorkspace().getBlockById(this.id);

						if (blockInWorkspace) {
							window.updateOrCreateMeshFromBlock(this);
						}
					}
				}
				handleBlockCreateEvent(
					this,
					changeEvent,
					variableNamePrefix,
					nextVariableIndexes,
				);
			});

			addDoMutatorWithToggleBehavior(this);
		},
	};
	Blockly.Blocks["create_capsule"] = {
		init: function () {
			const variableNamePrefix = "capsule";
			let nextVariableName =
				variableNamePrefix + nextVariableIndexes[variableNamePrefix];
			this.jsonInit({
				type: "create_capsule",
				message0:
					"new capsule %1 %2 radius %3 height %4 \n at x %5 y %6 z %7",
				args0: [
					{
						type: "field_variable",
						name: "ID_VAR",
						variable: nextVariableName,
					},
					{
						type: "input_value",
						name: "COLOR",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "RADIUS",
						check: "Number",
					},
					{
						type: "input_value",
						name: "HEIGHT",
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
				previousStatement: null,
				nextStatement: null,
				inputsInline: true,
				colour: categoryColours["Scene"],
				tooltip:
					"Creates a colored capsule with specified dimensions and position.\nKeyword: capsule",
				helpUrl: "",
			});

			this.setOnChange((changeEvent) => {
				if (
					changeEvent.type === Blockly.Events.BLOCK_CREATE ||
					changeEvent.type === Blockly.Events.BLOCK_CHANGE
				) {
					const parent = findCreateBlock(this);
					if (parent == this) {
						const blockInWorkspace =
							Blockly.getMainWorkspace().getBlockById(this.id);

						if (blockInWorkspace) {
							window.updateOrCreateMeshFromBlock(this);
						}
					}
				}

				handleBlockCreateEvent(
					this,
					changeEvent,
					variableNamePrefix,
					nextVariableIndexes,
				);
			});

			addDoMutatorWithToggleBehavior(this);
		},
	};

	Blockly.Blocks["create_plane"] = {
		init: function () {
			const variableNamePrefix = "plane";
			let nextVariableName =
				variableNamePrefix + nextVariableIndexes[variableNamePrefix]; // Ensure 'plane' is managed in your nextVariableIndexes
			this.jsonInit({
				type: "create_plane",
				message0:
					"new plane %1 %2 width %3 height %4 \n at x %5 y %6 z %7",
				args0: [
					{
						type: "field_variable",
						name: "ID_VAR",
						variable: nextVariableName,
					},
					{
						type: "input_value",
						name: "COLOR",
						colour: "#9932CC",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "WIDTH",
						check: "Number",
					},
					{
						type: "input_value",
						name: "HEIGHT",
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
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Scene"],
				tooltip:
					"Creates a colored 2D plane with specified width, height, and position.\nKeyword: plane",
				helpUrl: "",
			});

			this.setOnChange((changeEvent) => {
				if (
					changeEvent.type === Blockly.Events.BLOCK_CREATE ||
					changeEvent.type === Blockly.Events.BLOCK_CHANGE
				) {
					const blockInWorkspace =
						Blockly.getMainWorkspace().getBlockById(this.id); // Check if block is in the main workspace

					if (blockInWorkspace) {
						window.updateOrCreateMeshFromBlock(this);
					}
				}

				handleBlockCreateEvent(
					this,
					changeEvent,
					variableNamePrefix,
					nextVariableIndexes,
				);
			});

			addDoMutatorWithToggleBehavior(this);
		},
	};

	Blockly.Blocks["create_wall"] = {
		init: function () {
			const variableNamePrefix = "wall";
			let nextVariableName =
				variableNamePrefix + nextVariableIndexes[variableNamePrefix]; // Start with "wall1";
			this.jsonInit({
				type: "create_wall",
				message0:
					"new wall %1 type %2 colour %3 \n start x %4 z %5 end x %6 z %7 y position %8",
				args0: [
					{
						type: "field_variable",
						name: "ID_VAR",
						variable: nextVariableName,
					},
					{
						type: "field_dropdown",
						name: "WALL_TYPE",
						options: [
							["solid", "SOLID_WALL"],
							["door", "WALL_WITH_DOOR"],
							["window", "WALL_WITH_WINDOW"],
							["floor/roof", "FLOOR"],
						],
					},
					{
						type: "input_value",
						name: "COLOR",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "START_X",
						check: "Number",
					},
					{
						type: "input_value",
						name: "START_Z",
						check: "Number",
					},
					{
						type: "input_value",
						name: "END_X",
						check: "Number",
					},
					{
						type: "input_value",
						name: "END_Z",
						check: "Number",
					},
					{
						type: "input_value",
						name: "Y_POSITION",
						check: "Number",
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Scene"],
				tooltip:
					"Creates a wall with the selected type and color between specified start and end positions.\nKeyword: wall",
				helpUrl: "",
			});

			this.setOnChange((changeEvent) => {
				if (
					changeEvent.type === Blockly.Events.BLOCK_CREATE ||
					changeEvent.type === Blockly.Events.BLOCK_CHANGE
				) {
					const blockInWorkspace =
						Blockly.getMainWorkspace().getBlockById(this.id); // Check if block is in the main workspace

					if (blockInWorkspace) {
						window.updateCurrentMeshName(this, "ID_VAR"); // Call the function to update window.currentMesh
					}
				}

				handleBlockCreateEvent(
					this,
					changeEvent,
					variableNamePrefix,
					nextVariableIndexes,
				);
			});
		},
	};

	Blockly.Blocks["set_background_color"] = {
		init: function () {
			this.jsonInit({
				type: "set_background_color",
				message0: "set background color %1",
				args0: [
					{
						type: "input_value",
						name: "COLOR",
						colour: "#6495ED",
						check: "Colour",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Scene"],
				tooltip:
					"Set the scene's background color.\nKeyword: background",
				helpUrl: "",
			});
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
						check: "String",
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
				helpUrl: "",
			});
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
					"Displays a piece of text as a billboard on a mesh.\nKeyword: say",
				helpUrl: "",
			});
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
				colour: categoryColours["Looks"],
				tooltip:
					"Changes the animation of the specified model to the given animation.\nKeyword: switch",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["ui_text"] = {
		init: function () {
			this.jsonInit({
				type: "ui_text",
				message0:
					"ui text %1 %2 at x: %3 y: %4  size: %5 for %6 seconds color: %7",
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
				colour: 160,
				tooltip:
					"Add text to the UI screen, and store control in a variable for later use or disposal.",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["create_map"] = {
		init: function () {
			this.jsonInit({
				type: "create_map",
				message0: "map %1 %2",
				args0: [
					{
						type: "field_dropdown",
						name: "MAP_NAME",
						options: mapNames,
					},
					{
						type: "input_value",
						name: "COLOR",
						colour: "#71BC78",
						check: "Colour",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Scene"],
				tooltip: "Creates a map based on the choice.\nKeyword: map",
				helpUrl: "",
			});
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
				colour: categoryColours["Looks"],
				tooltip:
					"Plays a selected animation once on the specified model.\nKeyword: play",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["move_by_vector"] = {
		init: function () {
			this.jsonInit({
				type: "move_by_vector",
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
				colour: categoryColours["Motion"],
				inputsInline: true,
				tooltip:
					"Moves a mesh a given amount in x y and z directions.\nKeyword: move",
			});
		},
	};

	Blockly.Blocks["parent_child"] = {
		init: function () {
			this.jsonInit({
				type: "parent_child",
				message0: "parent %1 child %2 offset x: %3 y: %4 z: %5",
				args0: [
					{
						type: "field_variable",
						name: "PARENT_MESH",
						variable: "parentMesh",
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
				colour: categoryColours["Scene"],
				inputsInline: true,
				tooltip:
					"Sets a parent-child relationship between two meshes with a specified offset in x, y, and z directions.\nKeyword: parent, child, offset, remove",
			});
		},
	};

	Blockly.Blocks["remove_parent"] = {
		init: function () {
			this.jsonInit({
				type: "remove_parent",
				message0: "remove parent %1",
				args0: [
					{
						type: "field_variable",
						name: "CHILD_MESH",
						variable: window.currentMesh,
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Scene"],
				tooltip:
					"Removes the parent relationship from the specified mesh.\nKeyword: remove, parent, child",
			});
		},
	};

	Blockly.Blocks["scale"] = {
		init: function () {
			this.jsonInit({
				type: "scale",
				message0: "scale %1 x: %2 y: %3 z: %4",
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
				message1: "\norigin x: %1 y: %2 z: %3",
				args1: [
					{
						type: "field_dropdown",
						name: "X_ORIGIN",
						options: [
							["centre", "CENTRE"],
							["left", "LEFT"],
							["right", "RIGHT"],
						],
					},
					{
						type: "field_dropdown",
						name: "Y_ORIGIN",
						options: [
							["centre", "CENTRE"],
							["base", "BASE"],
							["top", "TOP"],
						],
					},
					{
						type: "field_dropdown",
						name: "Z_ORIGIN",
						options: [
							["centre", "CENTRE"],
							["front", "FRONT"],
							["back", "BACK"],
						],
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Looks"],
				inputsInline: true,
				tooltip:
					"Resizes a mesh to the given x, y, and z and controls the origin of scaling.",
			});
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
				colour: categoryColours["Motion"],
				inputsInline: true,
				tooltip:
					"Rotates the model based on its current rotation plus additional x, y, z values.\nKeyword: rotate",
				helpUrl: "",
			});
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
				colour: categoryColours["Motion"],
				inputsInline: true,
				tooltip:
					"Rotates the first model towards the position of the second model.\nKeyword: look",
				helpUrl: "",
			});
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
				colour: categoryColours["Motion"],
				inputsInline: true,
				tooltip:
					"Teleports the first model to the location of the second model.",
				helpUrl: "",
			});
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
				colour: categoryColours["Motion"],
				inputsInline: true,
				tooltip: "Rotates the model to face the specified coordinates.",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["position_at"] = {
		init: function () {
			this.jsonInit({
				type: "position_at",
				message0: "position %1 at x: %2 y: %3 z: %4 y? %5",
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
				colour: categoryColours["Motion"],
				inputsInline: true,
				tooltip:
					"Positions the model at the specified coordinates. Optionally, use the Y axis.",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["time"] = {
		init: function () {
			this.jsonInit({
				type: "time",
				message0: "time in ms",
				args0: [],
				output: "Number",
				colour: categoryColours["Sensing"], // Adjust the colour category as necessary
				inputsInline: true,
				tooltip: "Returns the current time in milliseconds.",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["distance_to"] = {
		init: function () {
			this.jsonInit({
				type: "distance_to",
				message0: "distance from %1 to %2",
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
				tooltip: "Calculates the distance between two meshes.",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["camera_control"] = {
		init: function () {
			this.jsonInit({
				type: "camera_control",
				message0: "camera %1 %2",
				args0: [
					{
						type: "field_dropdown",
						name: "ACTION",
						options: [
							["Rotate Left", "rotateLeft"],
							["Rotate Right", "rotateRight"],
							["Look Up", "rotateUp"],
							["Look Down", "rotateDown"],
							["Move Up", "moveUp"],
							["Move Down", "moveDown"],
							["Move Left", "moveLeft"],
							["Move Right", "moveRight"],
						],
					},
					{
						type: "field_dropdown",
						name: "KEY",
						options: [
							["A", "65"], // A key
							["D", "68"], // D key
							["W", "87"], // W key
							["S", "83"], // S key
							["Q", "81"], // Q key
							["E", "69"], // E key
							["F", "70"], // F key
							["Space", "32"], // Space key
							["Up Arrow", "38"], // Up arrow key
							["Down Arrow", "40"], // Down arrow key
							["Left Arrow", "37"], // Left arrow key
							["Right Arrow", "39"], // Right arrow key
						],
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Motion"],
				tooltip: "Bind a specific key to a camera control action.",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["get_camera"] = {
		init: function () {
			this.jsonInit({
				type: "get_camera",
				message0: "get camera as %1",
				args0: [
					{
						type: "field_variable",
						name: "VAR",
						variable: "camera", // Default variable is 'camera'
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Motion"],
				tooltip: "Gets the current scene camera",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["play_sound"] = {
		init: function () {
			let nextVariableName = "sound" + nextVariableIndexes["sound"];
			this.jsonInit({
				type: "play_sound",
				message0:
					"set %1 to play sound %2 \nspeed %3 volume %4 mode %5 %6",
				args0: [
					{
						type: "field_variable",
						name: "ID_VAR",
						variable: nextVariableName,
					},
					{
						type: "field_dropdown",
						name: "SOUND_NAME",
						options: function () {
							return audioNames.map((name) => [name, name]);
						},
					},
					{
						type: "input_value",
						name: "SPEED",
						value: 1,
						min: 0.1,
						max: 3,
						precision: 0.1,
					},
					{
						type: "input_value",
						name: "VOLUME",
						value: 1,
						min: 0,
						max: 1,
						precision: 0.1,
					},
					{
						type: "field_dropdown",
						name: "MODE",
						options: [
							["once", "ONCE"],
							["loop", "LOOP"],
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
				colour: categoryColours["Sound"],
				tooltip:
					"Plays the selected sound with adjustable speed and volume, and chooses to play once or loop.\nKeyword: sound",
				helpUrl: "",
			});

			this.setOnChange(function (changeEvent) {
				if (
					!this.isInFlyout &&
					changeEvent.type === Blockly.Events.BLOCK_CREATE &&
					changeEvent.ids.includes(this.id)
				) {
					let variable = this.workspace.getVariable(nextVariableName);
					if (!variable) {
						variable = this.workspace.createVariable(
							nextVariableName,
							null,
						);
						this.getField("ID_VAR").setValue(variable.getId());
					}

					nextVariableIndexes["sound"] += 1;
				}
			});
		},
	};

	Blockly.Blocks["stop_all_sounds"] = {
		init: function () {
			this.jsonInit({
				message0: "stop all sounds",
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Sound"],
				tooltip:
					"Stops all sounds currently playing in the scene.\nKeyword:nosound",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["midi_note"] = {
		init: function () {
			this.jsonInit({
				type: "midi_note",
				message0: "MIDI note %1",
				args0: [
					{
						type: "field_number",
						name: "NOTE",
						value: 60, // Default is Middle C
						min: 0,
						max: 127,
						precision: 1,
					},
				],
				output: "Number",
				colour: categoryColours["Sound"],
				tooltip: "Represents a MIDI note value between 0 and 127.",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["rest"] = {
		init: function () {
			this.jsonInit({
				type: "rest",
				message0: "rest",
				output: "Null",
				colour: categoryColours["Sound"],
				tooltip: "Represents a rest (silence) in a musical sequence.",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["play_notes"] = {
		init: function () {
			this.jsonInit({
				type: "play_notes",
				message0:
					"play notes on %1\nnotes %2\ndurations %3\ninstrument %4 mode %5",
				args0: [
					{
						type: "field_variable",
						name: "MESH",
						variable: window.currentMesh,
					},
					{
						type: "input_value",
						name: "NOTES",
						check: "Array",
					},
					{
						type: "input_value",
						name: "DURATIONS",
						check: "Array",
					},
					{
						type: "input_value",
						name: "INSTRUMENT",
						check: "Instrument",
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
				colour: categoryColours["Sound"],
				tooltip:
					"Plays a sequence of MIDI notes and rests with corresponding durations, using mesh for panning. Can return immediately or after the notes have finished playing.",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["set_scene_bpm"] = {
		init: function () {
			this.jsonInit({
				type: "set_scene_bpm",
				message0: "set scene BPM to %1",
				args0: [
					{
						type: "input_value",
						name: "BPM",
						check: "Number",
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Sound"], // Assuming "Sound" category
				tooltip: "Sets the BPM for the entire scene",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["set_mesh_bpm"] = {
		init: function () {
			this.jsonInit({
				type: "set_mesh_bpm",
				message0: "set BPM of %1 to %2",
				args0: [
					{
						type: "field_variable",
						name: "MESH",
						variable: window.currentMesh,
					},
					{
						type: "input_value",
						name: "BPM",
						check: "Number",
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Sound"], // Assuming "Sound" category
				tooltip: "Sets the BPM for a selected mesh",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["create_instrument"] = {
		init: function () {
			const variableNamePrefix = "instrument";
			let nextVariableName =
				variableNamePrefix + nextVariableIndexes[variableNamePrefix];
			this.jsonInit({
				type: "create_instrument",
				message0:
					"instrument %1 wave %2 frequency %3 attack %4 decay %5 sustain %6 release %7",
				args0: [
					{
						type: "field_variable",
						name: "INSTRUMENT",
						variable: nextVariableName,
					},
					{
						type: "field_dropdown",
						name: "TYPE",
						options: [
							["sine", "sine"],
							["square", "square"],
							["sawtooth", "sawtooth"],
							["triangle", "triangle"],
						],
					},
					{
						type: "field_number",
						name: "FREQUENCY",
						value: 440,
						min: 20,
						max: 20000,
						precision: 1,
					},
					{
						type: "field_number",
						name: "ATTACK",
						value: 0.1,
						min: 0,
						max: 5,
						precision: 0.01,
					},
					{
						type: "field_number",
						name: "DECAY",
						value: 0.5,
						min: 0,
						max: 5,
						precision: 0.01,
					},
					{
						type: "field_number",
						name: "SUSTAIN",
						value: 0.7,
						min: 0,
						max: 1,
						precision: 0.01,
					},
					{
						type: "field_number",
						name: "RELEASE",
						value: 1.0,
						min: 0,
						max: 5,
						precision: 0.01,
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Sound"],
				tooltip:
					"Creates an instrument and assigns it to the selected variable.",
				helpUrl: "",
			});

			this.setOnChange((changeEvent) => {
				handleBlockCreateEvent(
					this,
					changeEvent,
					variableNamePrefix,
					nextVariableIndexes,
				);
			});
		},
	};

	Blockly.Blocks["instrument"] = {
		init: function () {
			this.jsonInit({
				type: "instrument",
				message0: "instrument %1",
				args0: [
					{
						type: "field_dropdown",
						name: "INSTRUMENT_TYPE",
						options: [
							["Default Instrument (Sine)", "default"],
							["Piano (Square)", "piano"],
							["Guitar (Sawtooth)", "guitar"],
							["Violin (Triangle)", "violin"],
						],
					},
				],
				output: "Instrument",
				colour: categoryColours["Sound"],
				tooltip: "Select an instrument to use for playing notes.",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["forever"] = {
		init: function () {
			this.jsonInit({
				type: "forever",
				message0: "forever\n%1",
				args0: [
					{
						type: "input_statement",
						name: "DO",
						check: null,
					},
				],
				colour: categoryColours["Events"],
				tooltip:
					"Executes the enclosed blocks each frame in the render loop.\nKeyword: ever",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["when_clicked"] = {
		init: function () {
			this.jsonInit({
				type: "model_clicked",
				message0: "when %1 is %2",
				args0: [
					{
						type: "field_variable",
						name: "MODEL_VAR",
						variable: window.currentMesh,
					},
					{
						type: "field_dropdown",
						name: "TRIGGER",
						options: [
							["clicked", "OnPickTrigger"],
							["double-clicked", "OnDoublePickTrigger"],
							["mouse down", "OnPickDownTrigger"],
							["mouse up", "OnPickUpTrigger"],
							["mouse out", "OnPickOutTrigger"],
							["left-clicked", "OnLeftPickTrigger"],
							[
								"right-clicked / long pressed",
								"OnRightOrLongPressTrigger",
							],
							["pointer over", "OnPointerOverTrigger"],
							["pointer out", "OnPointerOutTrigger"],
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
				//previousStatement: null,
				//nextStatement: null,
				colour: categoryColours["Events"],
				tooltip:
					"Executes the blocks inside when the specified model trigger occurs.\nKeyword: click",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["when_touches"] = {
		init: function () {
			this.jsonInit({
				type: "when_touches",
				message0: "when %1 intersect %2 %3",
				args0: [
					{
						type: "field_variable",
						name: "MODEL_VAR",
						variable: window.currentMesh,
					},
					{
						type: "field_dropdown",
						name: "TRIGGER",
						options: [
							["enter", "OnIntersectionEnterTrigger"],
							["exit", "OnIntersectionExitTrigger"],
						],
					},
					{
						type: "field_variable",
						name: "OTHER_MODEL_VAR",
						variable: "mesh2",
					},
				],
				message1: "%1",
				args1: [
					{
						type: "input_statement",
						name: "DO",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Events"],
				tooltip:
					"Executes the blocks inside when the mesh intersects or no longer intersects with another mesh.\nKeyword: touches",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["local_variable"] = {
		init: function () {
			this.jsonInit({
				type: "local_variable",
				message0: "local %1",
				args0: [
					{
						type: "field_variable",
						name: "VAR",
						variable: "item", // default variable name
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Control"],
				tooltip: "Declare a local version of a selected variable",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["when_key_pressed"] = {
		init: function () {
			this.jsonInit({
				type: "when_key_pressed",
				message0: "when key pressed %1",
				args0: [
					{
						type: "field_grid_dropdown",
						name: "KEY",
						columns: 10,
						options: [
							["0", "0"],
							["1", "1"],
							["2", "2"],
							["3", "3"],
							["4", "4"],
							["5", "5"],
							["6", "6"],
							["7", "7"],
							["8", "8"],
							["9", "9"],
							["a", "a"],
							["b", "b"],
							["c", "c"],
							["d", "d"],
							["e", "e"],
							["f", "f"],
							["g", "g"],
							["h", "h"],
							["i", "i"],
							["j", "j"],
							["k", "k"],
							["l", "l"],
							["m", "m"],
							["n", "n"],
							["o", "o"],
							["p", "p"],
							["q", "q"],
							["r", "r"],
							["s", "s"],
							["t", "t"],
							["u", "u"],
							["v", "v"],
							["w", "w"],
							["x", "x"],
							["y", "y"],
							["z", "z"],
							[" ", " "],
							[",", ","],
							[".", "."],
							["/", "/"],
							["⯇", "ArrowLeft"],
							["⯅", "ArrowUp"],
							["⯈", "ArrowRight"],
							["⯆", "ArrowDown"],
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
				colour: categoryColours["Events"],
				tooltip:
					"Executes the blocks inside when the specified key is pressed.\nKeyword: pressed",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["when_key_released"] = {
		init: function () {
			this.jsonInit({
				type: "when_key_released",
				message0: "when key released %1",
				args0: [
					{
						type: "field_grid_dropdown",
						name: "KEY",
						columns: 10,
						options: [
							["0", "0"],
							["1", "1"],
							["2", "2"],
							["3", "3"],
							["4", "4"],
							["5", "5"],
							["6", "6"],
							["7", "7"],
							["8", "8"],
							["9", "9"],
							["a", "a"],
							["b", "b"],
							["c", "c"],
							["d", "d"],
							["e", "e"],
							["f", "f"],
							["g", "g"],
							["h", "h"],
							["i", "i"],
							["j", "j"],
							["k", "k"],
							["l", "l"],
							["m", "m"],
							["n", "n"],
							["o", "o"],
							["p", "p"],
							["q", "q"],
							["r", "r"],
							["s", "s"],
							["t", "t"],
							["u", "u"],
							["v", "v"],
							["w", "w"],
							["x", "x"],
							["y", "y"],
							["z", "z"],
							[" ", " "],
							[",", ","],
							[".", "."],
							["/", "/"],
							["⯇", "ArrowLeft"],
							["⯅", "ArrowUp"],
							["⯈", "ArrowRight"],
							["⯆", "ArrowDown"],
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
				colour: categoryColours["Events"],
				tooltip:
					"Executes the blocks inside when the specified key is released.\nKeyword: released",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["broadcast_event"] = {
		init: function () {
			this.jsonInit({
				type: "broadcast_event",
				message0: "broadcast event %1",
				args0: [
					{
						type: "input_value",
						name: "EVENT_NAME",
						check: "String",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Events"],
				tooltip:
					"Broadcast an event that can be handled with on event.\nKeyword: broadcast",
				helpUrl: "",
			});
		},
	};
	// Block definition for on_event
	Blockly.Blocks["on_event"] = {
		init: function () {
			this.jsonInit({
				type: "on_event",
				message0: "on event %1",
				args0: [
					{
						type: "input_value",
						name: "EVENT_NAME",
						check: "String",
					},
				],
				message1: "%1",
				args1: [
					{
						type: "input_statement",
						name: "DO",
					},
				],
				colour: categoryColours["Events"],
				tooltip: "Handle a broadcast event.\nKeyword: on",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["show"] = {
		init: function () {
			this.jsonInit({
				type: "show",
				message0: "show %1",
				args0: [
					{
						type: "field_variable",
						name: "MODEL_VAR",
						variable: window.currentMesh,
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Looks"],
				tooltip: "Shows the selected model.\nKeyword: show",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["hide"] = {
		init: function () {
			this.jsonInit({
				type: "hide",
				message0: "hide %1",
				args0: [
					{
						type: "field_variable",
						name: "MODEL_VAR",
						variable: window.currentMesh,
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Looks"],
				tooltip: "Hides the selected model.\nKeyword: hide",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["change_color"] = {
		init: function () {
			this.jsonInit({
				type: "change_color",
				message0: "change color of %1 to %2",
				args0: [
					{
						type: "field_variable",
						name: "MODEL_VAR",
						variable: window.currentMesh,
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
				colour: categoryColours["Looks"],
				tooltip:
					"Changes the color of the selected model.\nKeyword: colour",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["change_material"] = {
		init: function () {
			this.jsonInit({
				message0: "apply material %1 to %2 with colour %3",
				args0: [
					{
						type: "field_grid_dropdown",
						name: "MATERIALS",
						columns: 4,
						options: materialNames.map((name) => {
							const baseName = name.replace(/\.[^/.]+$/, "");
							return [
								{
									src: `./textures/${baseName}.png`,
									width: 50,
									height: 50,
									alt: baseName,
								},
								name,
							];
						}),
					},
					{
						type: "field_variable",
						name: "ID_VAR",
						variable: window.currentMesh,
					},
					{
						type: "input_value",
						name: "COLOR",
						check: "Colour",
					},
				],
				inputsInline: true,
				colour: categoryColours["Looks"],
				tooltip:
					"Apply a selected material with a colour tint to the specified object.\nKeyword: material",
				helpUrl: "",
				previousStatement: null,
				nextStatement: null,
			});
		},
	};

	Blockly.Blocks["text_material"] = {
		init: function () {
			this.jsonInit({
				type: "text_material",
				message0:
					"material %1 text %2 color %3 background %4\nwidth %5 height %6 size %7",
				args0: [
					{
						type: "field_variable",
						name: "MATERIAL_VAR",
						variable: "material",
					},
					{
						type: "input_value",
						name: "TEXT",
						check: "String",
					},
					{
						type: "input_value",
						name: "COLOR",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "BACKGROUND_COLOR",
						check: "Colour",
					},
					{
						type: "input_value",
						name: "WIDTH",
						check: "Number",
					},
					{
						type: "input_value",
						name: "HEIGHT",
						check: "Number",
					},
					{
						type: "input_value",
						name: "TEXT_SIZE",
						check: "Number",
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Looks"],
				tooltip:
					"Create a material with text or emoji, specifying width, height, background color, and text size.",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["place_decal"] = {
		init: function () {
			this.jsonInit({
				message0: "decal %1 angle %2",
				args0: [
					{
						type: "field_variable",
						name: "MATERIAL",
						variable: "material",
					},
					{
						type: "input_value",
						name: "ANGLE",
						check: "Number",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Looks"],
				tooltip: "Place a decal on a mesh using the selected material.",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["decal"] = {
		init: function () {
			this.jsonInit({
				type: "decal",
				message0:
					"decal on %1 from x %2 y %3 z %4 \nangle x %5 y %6 z %7\nsize x %8 y %9 z %10 material %11",
				args0: [
					{
						type: "field_variable",
						name: "MESH",
						variable: window.currentMesh,
					},
					{
						type: "input_value",
						name: "POSITION_X",
						check: "Number",
					},
					{
						type: "input_value",
						name: "POSITION_Y",
						check: "Number",
					},
					{
						type: "input_value",
						name: "POSITION_Z",
						check: "Number",
					},
					{
						type: "input_value",
						name: "NORMAL_X",
						check: "Number",
					},
					{
						type: "input_value",
						name: "NORMAL_Y",
						check: "Number",
					},
					{
						type: "input_value",
						name: "NORMAL_Z",
						check: "Number",
					},
					{
						type: "input_value",
						name: "SIZE_X",
						check: "Number",
					},
					{
						type: "input_value",
						name: "SIZE_Y",
						check: "Number",
					},
					{
						type: "input_value",
						name: "SIZE_Z",
						check: "Number",
					},
					{
						type: "input_value",
						name: "MATERIAL",
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Looks"],
				tooltip:
					"Create a decal on a mesh with position, normal, size, and material.",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["highlight"] = {
		init: function () {
			this.jsonInit({
				type: "highlight",
				message0: "highlight %1 %2",
				args0: [
					{
						type: "field_variable",
						name: "MODEL_VAR",
						variable: window.currentMesh,
					},
					{
						type: "input_value",
						name: "COLOR",
						colour: "#FFD700",
						check: "Colour",
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Looks"],
				tooltip: "Highlights the selected model.\nKeyword: highlight",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["tint"] = {
		init: function () {
			this.jsonInit({
				type: "tint",
				message0: "tint %1 %2",
				args0: [
					{
						type: "field_variable",
						name: "MODEL_VAR",
						variable: window.currentMesh,
					},
					{
						type: "input_value",
						name: "COLOR",
						colour: "#AA336A",
						check: "Colour",
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Looks"],
				tooltip: "Add colour tint effect.\nKeyword: tint",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["change_colour"] = {
		init: function () {
			this.jsonInit({
				type: "change_colour",
				message0: "colour %1 %2",
				args0: [
					{
						type: "field_variable",
						name: "MODEL_VAR",
						variable: window.currentMesh,
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
				colour: categoryColours["Looks"],
				tooltip:
					"Changes the color of the selected model.\nKeyword: colour",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["set_alpha"] = {
		init: function () {
			this.jsonInit({
				type: "set_mesh_material_alpha",
				message0: "set alpha of %1 to %2",
				args0: [
					{
						type: "field_variable",
						name: "MESH",
						variable: window.currentMesh,
					},
					{
						type: "input_value",
						name: "ALPHA",
						check: "Number",
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Looks"],
				tooltip:
					"Sets the alpha (transparency) of the material(s) on a specified mesh. Values should be 0 to 1.\nKeyword:alpha",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["clear_effects"] = {
		init: function () {
			this.jsonInit({
				type: "clear_effects",
				message0: "clear effects %1",
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
				colour: categoryColours["Looks"],
				tooltip:
					"Clear visual effects from selected model.\nKeyword: clear",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["camera_follow"] = {
		init: function () {
			this.jsonInit({
				type: "camera_follow",
				message0: "camera follow %1 with radius %2",
				args0: [
					{
						type: "field_variable",
						name: "MESH_VAR",
						variable: window.currentMesh,
					},
					{
						type: "input_value",
						name: "RADIUS",
						check: "Number",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Motion"],
				tooltip:
					"Makes the camera follow a model with a customizable distance (radius) from the target.\nKeyword: follow",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["add_physics"] = {
		init: function () {
			this.jsonInit({
				type: "add_physics",
				message0: "add physics %1 type %2",
				args0: [
					{
						type: "field_variable",
						name: "MODEL_VAR",
						variable: window.currentMesh,
					},
					{
						type: "field_dropdown",
						name: "PHYSICS_TYPE",
						options: [
							["dynamic", "DYNAMIC"],
							["animated", "ANIMATED"],
							["static", "STATIC"],
							["none", "NONE"],
						],
						default: "DYNAMIC",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Motion"],
				tooltip:
					"Adds physics to the mesh. Choose between static, dynamic, and animated.\nKeyword:physics",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["dispose"] = {
		init: function () {
			this.jsonInit({
				type: "dispose",
				message0: "dispose %1",
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
				colour: categoryColours["Scene"], // Use appropriate category color
				tooltip:
					"Removes the specified mesh from the scene.\nKeyword: dispose",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["key_pressed"] = {
		init: function () {
			this.jsonInit({
				type: "key_pressed",
				message0: "key pressed is %1",
				args0: [
					{
						type: "field_dropdown",
						name: "KEY",
						options: [
							["any", "ANY"],
							["none", "NONE"],
							["space", " "],
							["W", "w"],
							["A", "a"],
							["S", "s"],
							["D", "d"],
							["Q", "q"],
							["E", "e"],
							["F", "f"],
						],
					},
				],
				output: "Boolean",
				colour: categoryColours["Sensing"],
				tooltip:
					"Returns true if the specified key is pressed.\nKeyword:ispressed",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["meshes_touching"] = {
		init: function () {
			this.jsonInit({
				type: "meshes_are_touching",
				message0: "%1 touching %2",
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
				tooltip:
					"Returns true if the two selected meshes are touching, with retries for loading.\nKeyword: istouching",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["move_forward"] = {
		init: function () {
			this.jsonInit({
				type: "move_forward",
				message0: "forward %1 speed %2",
				args0: [
					{
						type: "field_variable",
						name: "MODEL",
						variable: window.currentMesh,
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
				colour: categoryColours["Motion"],
				tooltip:
					"Moves the model forward in the direction it's pointing.\nKeyword: forward",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["move_sideways"] = {
		init: function () {
			this.jsonInit({
				type: "move_sideways",
				message0: "move sideways %1 speed %2",
				args0: [
					{
						type: "field_variable",
						name: "MODEL",
						variable: window.currentMesh,
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
				colour: categoryColours["Motion"],
				tooltip:
					"Turns the model and moves it sideways relative to the camera's direction. Positive speed moves right, negative moves left.\nKeyword: move sideways",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["strafe"] = {
		init: function () {
			this.jsonInit({
				type: "strafe",
				message0: "strafe %1 speed %2",
				args0: [
					{
						type: "field_variable",
						name: "MODEL",
						variable: window.currentMesh, // Default to currentMesh
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
				colour: categoryColours["Motion"],
				tooltip:
					"Moves the model sideways relative to the camera. Positive speed moves right, negative moves left.\nKeyword: sideways",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["rotate_camera"] = {
		init: function () {
			this.jsonInit({
				type: "rotate_camera",
				message0: "rotate camera by %1 degrees",
				args0: [
					{
						type: "input_value",
						name: "DEGREES",
						check: "Number",
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Motion"],
				tooltip:
					"Rotates the camera left or right by the given degrees.\nKeyword: rotate",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["apply_force"] = {
		init: function () {
			this.jsonInit({
				type: "apply_force",
				message0: "apply force to %1 by x: %2 y: %3 z: %4",
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
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Motion"],
				tooltip:
					"Apply a force to a mesh in XYZ directions.\nKeyword: force",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["up"] = {
		init: function () {
			this.jsonInit({
				type: "up",
				message0: "up %1 force %2",
				args0: [
					{
						type: "field_variable",
						name: "MODEL_VAR",
						variable: window.currentMesh,
					},
					{
						type: "input_value",
						name: "UP_FORCE",
						check: "Number",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Motion"],
				tooltip: "Apply the specified upwards force.\nKeyword: up",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["touching_surface"] = {
		init: function () {
			this.jsonInit({
				type: "touching_surface",
				message0: "is %1 touching surface",
				args0: [
					{
						type: "field_variable",
						name: "MODEL_VAR",
						variable: window.currentMesh,
					},
				],
				output: "Boolean",
				colour: categoryColours["Sensing"],
				tooltip:
					"Check if the model is touching a surface.\nKeyword: surface",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["colour"] = {
		init: function () {
			this.jsonInit({
				type: "colour",
				message0: "%1",
				args0: [
					{
						type: "field_colour",
						name: "COLOR",
						colour: "#9932CC",
					},
				],
				output: "Colour",
				colour: categoryColours["Looks"],
				tooltip: "Pick a colour.\nKeyword: color",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["skin_colour"] = {
		init: function () {
			this.jsonInit({
				type: "skin_colour",
				message0: "%1",
				args0: [
					{
						type: "field_colour",
						name: "COLOR",
						colour: "#FFE0BD", // A neutral starting color
						colourOptions: [
							"#3F2A1D",
							"#5C4033",
							"#6F4E37",
							"#7A421D",
							"#8D5524",
							"#A86B38",
							"#C68642",
							"#D1A36A",
							"#E1B899",
							"#F0D5B1",
							"#FFDFC4",
							"#FFF5E1",
						],
						colourTitles: [
							"color 1",
							"color 2",
							"color 3",
							"color 4",
							"color 5",
							"color 6",
							"color 7",
							"color 8",
							"color 9",
							"color 10",
							"color 11",
							"color 12",
						],
						columns: 4,
					},
				],
				output: "Colour",
				colour: categoryColours["Looks"],
				tooltip: "Pick a skin colour.\nKeyword: skin",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["greyscale_colour"] = {
		init: function () {
			this.jsonInit({
				type: "greyscale_colour",
				message0: "%1",
				args0: [
					{
						type: "field_colour",
						name: "COLOR",
						colour: "#808080", // A neutral starting color (grey)
						colourOptions: [
							"#000000", // Black
							"#1a1a1a",
							"#333333",
							"#4d4d4d",
							"#666666",
							"#808080", // Middle grey
							"#999999",
							"#b3b3b3",
							"#cccccc",
							"#e6e6e6",
							"#ffffff", // White
						],
						colourTitles: [
							"Black",
							"Dark Grey 1",
							"Dark Grey 2",
							"Dark Grey 3",
							"Grey 1",
							"Middle Grey",
							"Grey 2",
							"Light Grey 1",
							"Light Grey 2",
							"Light Grey 3",
							"White",
						],
						columns: 4,
					},
				],
				output: "Colour",
				colour: categoryColours["Looks"], // You can set this to any colour category you prefer
				tooltip:
					"Pick a greyscale colour for elevation.\nKeyword: grey",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["colour_from_string"] = {
		init: function () {
			this.jsonInit({
				type: "colour_from_string",
				message0: "colour %1",
				args0: [
					{
						type: "input_value",
						name: "COLOR",
						check: "String",
					},
				],
				output: "Colour",
				colour: categoryColours["Looks"],
				tooltip:
					"Returns a colour from a hex code or CSS colour name.\nKeyword: #color",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["random_colour"] = {
		init: function () {
			this.jsonInit({
				type: "random_colour_block",
				message0: "random colour",
				output: "Colour",
				colour: categoryColours["Looks"],
				tooltip: "Generate a random colour.\nKeyword: randcol",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["material"] = {
		init: function () {
			this.jsonInit({
				type: "material",
				message0:
					"material %1 emissive %2 texture %3 \nmetallic %4 roughness %5 alpha %6",
				args0: [
					{
						type: "input_value",
						name: "BASE_COLOR",
						colour: "#ffffff", // Default to white
					},
					{
						type: "input_value",
						name: "EMISSIVE_COLOR",
						colour: "#000000", // Default to black (no emission)
					},
					{
						type: "field_grid_dropdown",
						name: "TEXTURE_SET",
						columns: 4,
						options: materialNames.map((name) => {
							const baseName = name.replace(/\.[^/.]+$/, "");
							return [
								{
									src: `./textures/${baseName}.png`,
									width: 50,
									height: 50,
									alt: baseName,
								},
								name,
							];
						}),
					},
					{
						type: "input_value",
						name: "METALLIC",
						value: 0,
						min: 0,
						max: 1,
						precision: 0.01,
					},
					{
						type: "input_value",
						name: "ROUGHNESS",
						value: 1,
						min: 0,
						max: 1,
						precision: 0.01,
					},
					{
						type: "input_value",
						name: "ALPHA",
						value: 1,
						min: 0,
						max: 1,
						precision: 0.01,
					},
				],
				output: "Material",
				inputsInline: true,
				colour: categoryColours["Looks"],
				tooltip: "Define material properties",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["set_material"] = {
		init: function () {
			this.jsonInit({
				type: "set_material",
				message0: "set material of %1 to %2",
				args0: [
					{
						type: "field_variable",
						name: "MESH",
						variable: window.currentMesh,
					},
					{
						type: "input_value",
						name: "MATERIAL",
						check: "Material", // Ensure it only accepts blocks that output a Material
					},
				],
				previousStatement: null,
				nextStatement: null,
				inputsInline: true,
				colour: categoryColours["Looks"],
				tooltip: "Set the specified material on the given mesh.",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["random_seeded_int"] = {
		init: function () {
			this.jsonInit({
				type: "random_seeded_int",
				message0: "random integer from %1 to %2 seed: %3",
				args0: [
					{
						type: "input_value",
						name: "FROM",
						check: "Number",
						align: "RIGHT",
					},
					{
						type: "input_value",
						name: "TO",
						check: "Number",
						align: "RIGHT",
					},
					{
						type: "input_value",
						name: "SEED",
						check: "Number",
						align: "RIGHT",
					},
				],
				inputsInline: true,
				output: "Number",
				colour: 230,
				tooltip:
					"Generate a random integer with a seed.\n Keyword: seed",
				helpUrl: "",
			});
		},
	};

	Blockly.Blocks["to_number"] = {
		init: function () {
			this.jsonInit({
				type: "to_number",
				message0: "convert %1 to %2",
				args0: [
					{
						type: "input_value",
						name: "STRING",
						check: "String",
					},
					{
						type: "field_dropdown",
						name: "TYPE",
						options: [
							["integer", "INT"],
							["float", "FLOAT"],
						],
					},
				],
				inputsInline: true,
				output: "Number",
				colour: 230,
				tooltip: "Converts a string to an integer or float.",
				helpUrl: "",
			});
		},
	};
	// Define the placeholder block
	Blockly.Blocks["keyword_block"] = {
		init: function () {
			// Add a dummy input field with a text input where users can type a keyword
			this.appendDummyInput().appendField(
				new Blockly.FieldTextInput("type a keyword to add a block"),
				"KEYWORD",
			);
			this.setTooltip("Type a keyword to change this block.");
			this.setHelpUrl("");

			// Add the onchange event handler
			this.setOnChange(function (changeEvent) {
				// Prevent infinite loop by checking if block is already replaced
				if (this.isDisposed() || this.isReplaced) {
					return;
				}

				// Get the keyword entered by the user
				const keyword = this.getFieldValue("KEYWORD").trim();

				// Look up the block type based on the keyword
				const blockType = findBlockTypeByKeyword(keyword);

				if (blockType) {
					// Mark the block as replaced to prevent further changes
					this.isReplaced = true;

					// Replace with the corresponding block
					const workspace = this.workspace;
					const newBlock = workspace.newBlock(blockType);

					// Find the block definition in the toolbox and apply shadow blocks
					const blockDefinition =
						findBlockDefinitionInToolbox(blockType);

					if (blockDefinition && blockDefinition.inputs) {
						applyToolboxSettings(newBlock, blockDefinition.inputs);
					}

					// Initialize and render the new block
					newBlock.initSvg();
					newBlock.render();

					// Safeguard against NaN values
					const posX = this.getRelativeToSurfaceXY().x || 0;
					const posY = this.getRelativeToSurfaceXY().y || 0;

					// Move the new block to the original block's position
					newBlock.moveBy(posX, posY);

					// Select the new block for immediate editing
					newBlock.select();

					// Dispose of the original placeholder block
					this.dispose();
				}
			});
		},
	};

	// Function to find the block type based on the keyword
	function findBlockTypeByKeyword(keyword) {
		for (const category of toolbox.contents) {
			if (Array.isArray(category.contents)) {
				for (const item of category.contents) {
					if (item.kind === "block" && item.keyword === keyword) {
						return item.type; // Return the block type if the keyword matches
					}
				}
			}
		}
		return null; // Return null if not found
	}

	// Function to find block definition in the toolbox by block type
	function findBlockDefinitionInToolbox(blockType) {
		for (const category of toolbox.contents) {
			for (const item of category.contents) {
				if (item.kind === "block" && item.type === blockType) {
					return item; // Return the block definition
				}
			}
		}
		return null; // Return null if not found
	}

	// Function to apply settings from the toolbox definition to the new block
	function applyToolboxSettings(newBlock, inputs) {
		for (const inputName in inputs) {
			const input = inputs[inputName];
			if (input.shadow) {
				const shadowBlock = Blockly.getMainWorkspace().newBlock(
					input.shadow.type,
				);
				shadowBlock.setShadow(true);
				// Apply fields (default values) to the shadow block
				for (const fieldName in input.shadow.fields) {
					shadowBlock.setFieldValue(
						input.shadow.fields[fieldName],
						fieldName,
					);
				}
				shadowBlock.initSvg();
				shadowBlock.render();
				newBlock
					.getInput(inputName)
					.connection.connect(shadowBlock.outputConnection);

				Blockly.getMainWorkspace().cleanUp();
			}
		}
	}
}

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
			tooltip: "Exports a mesh as STL, OBJ, or GLB.",
			helpUrl: "",
		});
	},
};


// Remove 'do' text to save space
Blockly.Msg['CONTROLS_REPEAT_INPUT_DO'] = '';
Blockly.Msg['CONTROLS_WHILEUNTIL_INPUT_DO'] = '';
Blockly.Msg['CONTROLS_FOR_INPUT_DO'] = '';
Blockly.Msg['CONTROLS_FOREACH_INPUT_DO'] = '';
Blockly.Msg['CONTROLS_IF_MSG_THEN'] = ''; 
Blockly.Msg['CONTROLS_IF_MSG_ELSE'] = 'else\n';