// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limited - flipcomputing.com

import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";
import { registerFieldColour } from "@blockly/field-colour";
import { FieldGridDropdown } from "@blockly/field-grid-dropdown";
import * as BABYLON from "@babylonjs/core";
import * as BABYLON_GUI from "@babylonjs/gui";
import HavokPhysics from "@babylonjs/havok";
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import { flock } from "./flock.js";
import { toolbox, categoryColours } from "./toolbox.js";
import { FlowGraphLog10Block } from "babylonjs";
flock.BABYLON = BABYLON;
flock.GUI = BABYLON_GUI;

registerFieldColour();
Blockly.ContextMenuItems.registerCommentOptions();

flock.canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(flock.canvas, true, { stencil: true });
engine.enableOfflineSupport = false;
engine.setHardwareScalingLevel(1 / window.devicePixelRatio);
let hk = null;
flock.scene = null;
flock.document = document;
let havokInstance = null;
let engineReady = false;
let gizmoManager = null;

const workspace = Blockly.inject("blocklyDiv", {
	theme: Blockly.Themes.Modern,
	renderer: "zelos",
	zoom: {
		controls: true,
		wheel: true,
		startScale: 0.7,
		maxScale: 3,
		minScale: 0.3,
		scaleSpeed: 1.2,
	},
	toolbox: toolbox,
});

const audioNames = [
	"highDown.ogg",
	"highUp.ogg",
	"laser1.ogg",
	"laser2.ogg",
	"laser3.ogg",
	"laser4.ogg",
	"laser5.ogg",
	"laser6.ogg",
	"laser7.ogg",
	"laser8.ogg",
	"laser9.ogg",
	"lowDown.ogg",
	"lowRandom.ogg",
	"lowThreeTone.ogg",
	"pepSound1.ogg",
	"pepSound2.ogg",
	"pepSound3.ogg",
	"pepSound4.ogg",
	"pepSound5.ogg",
	"phaseJump1.ogg",
	"phaseJump2.ogg",
	"phaseJump3.ogg",
	"phaseJump4.ogg",
	"phaseJump5.ogg",
	"phaserDown1.ogg",
	"phaserDown2.ogg",
	"phaserDown3.ogg",
	"phaserUp1.ogg",
	"phaserUp2.ogg",
	"phaserUp3.ogg",
	"phaserUp4.ogg",
	"phaserUp5.ogg",
	"phaserUp6.ogg",
	"phaserUp7.ogg",
	"powerUp10.ogg",
	"powerUp11.ogg",
	"powerUp12.ogg",
	"powerUp1.ogg",
	"powerUp2.ogg",
	"powerUp3.ogg",
	"powerUp4.ogg",
	"powerUp5.ogg",
	"powerUp6.ogg",
	"powerUp7.ogg",
	"powerUp8.ogg",
	"powerUp9.ogg",
	"spaceTrash1.ogg",
	"spaceTrash2.ogg",
	"spaceTrash3.ogg",
	"spaceTrash4.ogg",
	"spaceTrash5.ogg",
	"threeTone1.ogg",
	"threeTone2.ogg",
	"tone1.ogg",
	"twoTone1.ogg",
	"twoTone2.ogg",
	"zap1.ogg",
	"zap2.ogg",
	"zapThreeToneDown.ogg",
	"zapThreeToneUp.ogg",
	"zapTwoTone2.ogg",
	"zapTwoTone.ogg",
];

const characterNames = [
	"Character1.glb",
	"Character2.glb",
	"Character3.glb",
	"Character4.glb",
];

const objectNames = [
	"Star.glb",
	"Heart.glb",
	"Coin.glb",
	"Gem1.glb",
	"Gem2.glb",
	"Gem3.glb",
];

const objectColours = {
	"Star.glb": "#FFD700", // Gold
	"Heart.glb": "#FF69B4", // Hot Pink
	"Coin.glb": "#F4C542", // Light Gold
	"Gem1.glb": "#00BFFF", // Deep Sky Blue
	"Gem2.glb": "#8A2BE2", // Blue Violet
	"Gem3.glb": "#FF4500", // Orange Red
};
const modelNames = [
	"Character_Female_1.gltf",
	"Character_Female_2.gltf",
	"Character_Male_1.gltf",
	"Character_Male_2.gltf",
	//"Seagull.glb",
	"tree_fat.glb",
	"tree_fat_fall.glb",
	"tree_fat_darkh.glb",
	//"boat1.glb",
	//"bear_anim.glb",
];

const mapNames = [
	["Circular Depression", "circular_depression.png"],
	["Checkerboard", "checkerboard.png"],
	["Sloped Plane", "sloped_plane.png"],
	["Cove Plateau", "cove_plateau.png"],
	["Random Hills", "random_hills.png"],
	["Diagonal Ridge", "diagonal_ridge.png"],
	["Mixed Heights", "mixed_heights.png"],
	["Uneven Terrain", "uneven_terrain.png"],
];

console.log("Welcome to Flock 🐑🐑🐑");

workspace.addChangeListener(function (event) {
	if (event.type === Blockly.Events.FINISHED_LOADING) {
		initializeVariableIndexes();
	}
	//workspace.cleanUp();
});

workspace.addChangeListener(Blockly.Events.disableOrphans);

javascriptGenerator.forBlock["procedures_defnoreturn"] = function (block) {
	const functionName = block.getFieldValue("NAME");
	// Retrieve the parameters as a comma-separated list
	const params = block.arguments_;
	console.log(block);
	const branch =
		javascriptGenerator.statementToCode(
			block,
			"STACK",
			javascriptGenerator.ORDER_NONE,
		) || "";

	// Generate the function code with async and parameters
	const code = `async function ${functionName}(${params.join(", ")}) {\n${branch}\n}`;
	return code;
};

// Generator for asynchronous function call with arguments
javascriptGenerator.forBlock["procedures_callnoreturn"] = function (block) {
	const functionName = block.getFieldValue("NAME");
	// Retrieve the arguments as a comma-separated list that should match the parameters
	const args = [];
	const variables = block.arguments_;
	for (let i = 0; i < variables.length; i++) {
		args[i] =
			javascriptGenerator.valueToCode(
				block,
				"ARG" + i,
				javascriptGenerator.ORDER_NONE,
			) || "null";
	}
	const code = `await ${functionName}` + "(" + args.join(", ") + ");\n";
	return code;
};

javascriptGenerator.forBlock["procedures_defreturn"] = function (block) {
	const functionName = block.getFieldValue("NAME");
	const params = block.arguments_ || []; // Ensuring this array is initialized correctly
	const paramsCode = params.join(", "); // Creating a comma-separated string of parameters
	const branch =
		javascriptGenerator.statementToCode(
			block,
			"STACK",
			javascriptGenerator.ORDER_NONE,
		) || "";
	const returnValue =
		javascriptGenerator.valueToCode(
			block,
			"RETURN",
			javascriptGenerator.ORDER_NONE,
		) || "";

	// Generate the function code with async, parameters, and return statement
	const code = `async function ${functionName}(${paramsCode}) {\n${branch}return ${returnValue};\n}`;
	return code;
};

javascriptGenerator.forBlock["procedures_callreturn"] = function (block) {
	const functionName = block.getFieldValue("NAME");
	const args = [];
	const variables = block.arguments_ || []; // Ensure 'arguments_' is populated with the argument names
	for (let i = 0; i < variables.length; i++) {
		args[i] =
			javascriptGenerator.valueToCode(
				block,
				"ARG" + i,
				javascriptGenerator.ORDER_NONE,
			) || "null";
	}

	// Generate the asynchronous function call code using await, and capture the return value
	const code = `await ${functionName}\n(${args.join(", ")});\n`;
	// Return the code and specify that this should be treated as an expression with a return value
	return [code, javascriptGenerator.ORDER_ATOMIC];
};

Blockly.Blocks["start"] = {
	init: function () {
		this.jsonInit({
			type: "start",
			message0: "start %1",
			args0: [
				{
					type: "input_statement",
					name: "DO",
				},
			],
			colour: categoryColours["Events"],
			tooltip: "Run the attached block when the project starts.",
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
				"Adds a ground plane with collisions enabled to the scene, with specified color.",
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
				"Creates a 5x5 ground map with specified elevation colors.",
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
					variable: "mesh",
				},
			],
			output: null,
			colour: categoryColours["Sensing"],
			tooltip: "Gets the value of the selected property of a mesh.",
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
					type: "field_number",
					name: "DURATION",
					value: 1000,
					min: 0,
				},
			],
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Control"],
			tooltip: "Wait for a specified time in milliseconds",
			helpUrl: "",
		});
	},
};

Blockly.Blocks["glide_to"] = {
	init: function () {
		this.jsonInit({
			type: "glide_to",
			message0: "glide %1 to x %2 y %3 z %4 in %5 ms %6",
			args0: [
				{
					type: "field_variable",
					name: "MESH_VAR",
					variable: "mesh1",
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
			],
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Motion"],
			tooltip: "Glide to a specified position over a duration",
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
			tooltip: "Sets the sky color of the scene.",
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
			colour: categoryColours["Motion"],
			tooltip: "Add or removes canvas motion controls.",
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
			tooltip: "Configures the scene's fog.",
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
			tooltip: "",
			helpUrl: "",
			previousStatement: null,
			nextStatement: null,
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

Blockly.Blocks["load_object"] = {
	init: function () {
		const defaultObject = "Star.glb";
		const defaultColour = objectColours[defaultObject] || "#000000";
		const variableNamePrefix = "object";
		let nextVariableName =
			variableNamePrefix + nextVariableIndexes[variableNamePrefix]++;

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
			tooltip: "",
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
			//this.setColour(colour);
		};

		// Listen for changes in the MODELS field and update the COLOR field
		this.setOnChange((changeEvent) => {
			if (
				changeEvent.type === Blockly.Events.CHANGE &&
				changeEvent.element === "field" &&
				changeEvent.name === "MODELS"
			) {
				updateColorField();
			}
		});
	},
};

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
			tooltip: "",
			helpUrl: "",
			previousStatement: null,
			nextStatement: null,
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
				"Creates a colored box with specified dimensions and position.",
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
				"Creates a colored sphere with specified dimensions and position.",
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
				"Creates a colored cylinder with specified dimensions and position.",
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
				"Creates a colored capsule with specified dimensions and position.",
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

Blockly.Blocks["create_plane"] = {
	init: function () {
		const variableNamePrefix = "plane";
		let nextVariableName =
			variableNamePrefix + nextVariableIndexes[variableNamePrefix]; // Ensure 'plane' is managed in your nextVariableIndexes
		this.jsonInit({
			type: "create_plane",
			message0: "new plane %1 %2 width %3 height %4 \n at x %5 y %6 z %7",
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
				"Creates a colored 2D plane with specified width, height, and position.",
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
			tooltip: "Set the scene's background color",
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
			tooltip: "",
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
					variable: "mesh",
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
			tooltip: "Displays a piece of text as a billboard on a mesh.",
			helpUrl: "",
		});
	},
};

const animationNames = [
	["Idle", "Idle"],
	["Walk", "Walk"],
	["Run", "Run"],
	["Wave", "Wave"],
	["Yes", "Yes"],
	["No", "No"],
	["Duck", "Duck"],
	["Fall", "Death"],
	["Hit React", "HitReact"],
	["Idle Attack", "Idle_Attack"],
	["Idle_Hold", "Idle_Hold"],
	["Jump", "Jump"],
	["Jump Idle", "Jump_Idle"],
	["Jump Land", "Jump_Land"],
	["Punch", "Punch"],
	["Run Attack", "Run_Attack"],
	["Run Hold", "Run_Hold"],
	["Walk Hold", "Walk_Hold"],
];

const materialNames = [
	"brick.png",
	"rough.png",
	"grass.png",
	"tiles.png",
	"wood.png",
];
Blockly.Blocks["switch_animation"] = {
	init: function () {
		this.jsonInit({
			type: "switch_model_animation",
			message0: "switch animation of %1 to %2",
			args0: [
				{
					type: "field_variable",
					name: "MODEL",
					variable: "mesh",
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
				"Changes the animation of the specified model to the given animation.",
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
			tooltip: "Creates a map based on the choice.",
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
					variable: "mesh",
				},
			],
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Looks"],
			tooltip: "Plays a selected animation once on the specified model.",
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
					variable: "mesh",
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
					variable: "mesh",
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
			colour: categoryColours["Looks"],
			inputsInline: true,
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
					variable: "mesh",
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
				"Rotates the model based on its current rotation plus additional x, y, z values.",
			helpUrl: "",
		});
	},
};

Blockly.Blocks["play_sound"] = {
	init: function () {
		let nextVariableName = "sound" + nextVariableIndexes["sound"];
		this.jsonInit({
			type: "play_sound",
			message0: "set %1 to play sound %2 \nspeed %3 volume %4 mode %5 %6",
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
				"Plays the selected sound with adjustable speed and volume, and chooses to play once or loop.",
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
			tooltip: "Stops all sounds currently playing in the scene.",
			helpUrl: "",
		});
	},
};

Blockly.Blocks["forever"] = {
	init: function () {
		this.jsonInit({
			type: "forever",
			message0: "forever %1",
			args0: [
				{
					type: "input_statement",
					name: "DO",
					check: null,
				},
			],
			colour: categoryColours["Events"],
			tooltip:
				"Executes the enclosed blocks each frame in the render loop.",
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
					variable: "mesh", // Default variable name
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
			message1: "do %1",
			args1: [
				{
					type: "input_statement",
					name: "DO",
				},
			],
			colour: categoryColours["Events"],
			tooltip:
				"Executes the blocks inside when the specified model trigger occurs.",
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
					variable: "mesh1",
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
			message1: "do %1",
			args1: [
				{
					type: "input_statement",
					name: "DO",
				},
			],
			colour: categoryColours["Events"],
			tooltip:
				"Executes the blocks inside when the mesh intersects or no longer intersects with another mesh.",
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
						[" ", "Space"],
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
			message1: "do %1",
			args1: [
				{
					type: "input_statement",
					name: "DO",
				},
			],
			colour: categoryColours["Events"],
			tooltip:
				"Executes the blocks inside when the specified key is pressed.",
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
						[" ", "Space"],
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
			message1: "do %1",
			args1: [
				{
					type: "input_statement",
					name: "DO",
				},
			],
			colour: categoryColours["Events"],
			tooltip:
				"Executes the blocks inside when the specified key is released.",
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
					type: "field_input",
					name: "EVENT_NAME",
					text: "go",
				},
			],
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Events"],
			tooltip: "",
			helpUrl: "",
		});
	},
};

Blockly.Blocks["on_event"] = {
	init: function () {
		this.jsonInit({
			type: "on_event",
			message0: "on event %1",
			args0: [
				{
					type: "field_input",
					name: "EVENT_NAME",
					text: "go",
				},
			],
			message1: "do %1",
			args1: [
				{
					type: "input_statement",
					name: "DO",
				},
			],
			colour: categoryColours["Events"],
			tooltip: "",
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
					variable: "mesh",
				},
			],
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Looks"],
			tooltip: "Shows the selected model.",
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
					variable: "mesh",
				},
			],
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Looks"],
			tooltip: "Hides the selected model.",
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
					variable: "mesh",
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
			tooltip: "Changes the color of the selected model.",
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
					variable: "mesh",
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
				"Apply a selected material with a colour tint to the specified object.",
			helpUrl: "",
			previousStatement: null,
			nextStatement: null,
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
					variable: "mesh", // Default variable name, ensure it's defined in your environment
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
			tooltip: "Highlights the selected model.",
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
					variable: "mesh",
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
			tooltip: "Add colour tint effect.",
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
					variable: "mesh",
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
			tooltip: "Changes the color of the selected model.",
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
					variable: "mesh",
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
				"Sets the alpha (transparency) of the material(s) on a specified mesh. Values should be 0 to 1.",
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
					variable: "mesh",
				},
			],
			inputsInline: true,
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Looks"],
			tooltip: "Clear visual effects from selected model.",
			helpUrl: "",
		});
	},
};

Blockly.Blocks["camera_follow"] = {
	init: function () {
		this.jsonInit({
			type: "camera_follow",
			message0: "camera follow %1",
			args0: [
				{
					type: "field_variable",
					name: "MESH_VAR",
					variable: "mesh1",
				},
			],
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Motion"],
			tooltip:
				"Makes the camera follow a model specified by the variable.",
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
					variable: "mesh",
				},
				{
					type: "field_dropdown",
					name: "PHYSICS_TYPE",
					options: [
						["static", "STATIC"],
						["dynamic", "DYNAMIC"],
						["animated", "ANIMATED"],
						["none", "NONE"],
					],
					default: "DYNAMIC",
				},
			],
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Motion"],
			tooltip:
				"Adds physics to the mesh. Choose between static, dynamic, and animated.",
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
			tooltip: "Returns true if the specified key is pressed.",
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
					variable: "mesh1",
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
				"Returns true if the two selected meshes are touching, with retries for loading.",
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
					variable: "mesh",
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
			tooltip: "Moves the model forward in the direction it's pointing.",
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
					variable: "mesh",
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
			tooltip: "Apply a force to a mesh in XYZ directions",
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
					variable: "mesh",
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
			tooltip: "Apply the specified upwards force.",
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
					variable: "mesh",
				},
			],
			output: "Boolean",
			colour: categoryColours["Sensing"],
			tooltip: "Check if the model is touching a surface",
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
			tooltip: "Pick a colour",
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
			tooltip: "Pick a skin colour",
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
			tooltip: "Pick a greyscale colour for elevation",
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
			tooltip: "Returns a colour from a hex code or CSS colour name",
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
			tooltip: "Generate a random colour",
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
			tooltip: "Generate a random integer with a seed",
			helpUrl: "",
		});
	},
};

javascriptGenerator.forBlock["show"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);

	return `await show(${modelName});\n`;
};

javascriptGenerator.forBlock["hide"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);

	return `await hide(${modelName});\n`;
};

function generateUUID() {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
		/[xy]/g,
		function (c) {
			const r = (Math.random() * 16) | 0,
				v = c == "x" ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		},
	);
}

function getFieldValue(block, fieldName, defaultValue) {
	return (
		javascriptGenerator.valueToCode(
			block,
			fieldName,
			javascriptGenerator.ORDER_ATOMIC,
		) || defaultValue
	);
}

javascriptGenerator.forBlock["wait"] = function (block) {
	const duration = block.getFieldValue("DURATION");

	return `await wait(${duration});\n`;
};

javascriptGenerator.forBlock["glide_to"] = function (block) {
	const x = getFieldValue(block, "X", "0");
	const y = getFieldValue(block, "Y", "0");
	const z = getFieldValue(block, "Z", "0");
	const meshName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MESH_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);
	const duration = getFieldValue(block, "DURATION", "0");
	const mode = block.getFieldValue("MODE");

	return `await glideTo(${meshName}, ${x}, ${y}, ${z}, ${duration}, "${mode}");\n`;
};

javascriptGenerator.forBlock["start"] = function (block) {
	const branch = javascriptGenerator.statementToCode(block, "DO");
	return `(async () => {\n${branch}})();\n`;
};

javascriptGenerator.forBlock["create_ground"] = function (block) {
	const color = getFieldValue(block, "COLOR", "#6495ED");
	return `createGround(${color});\n`;
};

javascriptGenerator.forBlock["create_custom_map"] = function (block) {
	const colors = [];
	for (let i = 1; i <= 25; i++) {
		const color =
			javascriptGenerator.valueToCode(
				block,
				`COLOR_${i}`,
				javascriptGenerator.ORDER_ATOMIC,
			) || "#808080";
		colors.push(color);
	}
	return `await createCustomMap([${colors.join(", ")}]);\n`;
};

javascriptGenerator.forBlock["set_sky_color"] = function (block) {
	const color = getFieldValue(block, "COLOR", "#6495ED");
	return `setSky(${color});\n`;
};

javascriptGenerator.forBlock["print_text"] = function (block) {
	const text =
		javascriptGenerator.valueToCode(
			block,
			"TEXT",
			javascriptGenerator.ORDER_ATOMIC,
		) || "''";
	const duration =
		javascriptGenerator.valueToCode(
			block,
			"DURATION",
			javascriptGenerator.ORDER_ATOMIC,
		) || "0";
	const color = getFieldValue(block, "COLOR", "#9932CC");
	return `printText(${text}, ${duration}, ${color});\n`;
};

javascriptGenerator.forBlock["set_fog"] = function (block) {
	const fogColorHex = getFieldValue(block, "FOG_COLOR", "#9932CC");
	const fogMode = block.getFieldValue("FOG_MODE");
	const fogDensity =
		javascriptGenerator.valueToCode(
			block,
			"DENSITY",
			javascriptGenerator.ORDER_ATOMIC,
		) || "0.1"; // Default density

	return `setFog(${fogColorHex}, "${fogMode}", ${fogDensity});\n`;
};

javascriptGenerator.forBlock["say"] = function (block) {
	const text =
		javascriptGenerator.valueToCode(
			block,
			"TEXT",
			javascriptGenerator.ORDER_ATOMIC,
		) || '""';
	const duration =
		javascriptGenerator.valueToCode(
			block,
			"DURATION",
			javascriptGenerator.ORDER_ATOMIC,
		) || "0";
	const meshVariable = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MESH_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);
	const textColor = getFieldValue(block, "TEXT_COLOR", "#000000");
	const backgroundColor = getFieldValue(block, "BACKGROUND_COLOR", "#ffffff");
	const alpha =
		javascriptGenerator.valueToCode(
			block,
			"ALPHA",
			javascriptGenerator.ORDER_ATOMIC,
		) || "1";
	const size =
		javascriptGenerator.valueToCode(
			block,
			"SIZE",
			javascriptGenerator.ORDER_ATOMIC,
		) || "24";
	const mode = block.getFieldValue("MODE");
	const asyncMode = block.getFieldValue("ASYNC");

	// Wrap in an asynchronous IIFE if async mode is enabled
	const asyncWrapper = asyncMode === "AWAIT" ? "await " : "";

	return `${asyncWrapper}say(${meshVariable}, ${text}, ${duration}, ${textColor}, ${backgroundColor}, ${alpha}, ${size}, "${mode}");\n`;
};

javascriptGenerator.forBlock["load_model"] = function (block) {
	const modelName = block.getFieldValue("MODELS");
	const scale = getFieldValue(block, "SCALE", "1");
	const x = getFieldValue(block, "X", "0");
	const y = getFieldValue(block, "Y", "0");
	const z = getFieldValue(block, "Z", "0");
	const variableName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("ID_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);

	const meshId = modelName + "_" + flock.scene.getUniqueId();
	meshMap[meshId] = block;

	return `${variableName} = newModel('${modelName}', '${meshId}', ${scale}, ${x}, ${y}, ${z});\n`;
};

javascriptGenerator.forBlock["load_character"] = function (block) {
	const modelName = block.getFieldValue("MODELS");
	const scale = getFieldValue(block, "SCALE", "1");
	const x = getFieldValue(block, "X", "0");
	const y = getFieldValue(block, "Y", "0");
	const z = getFieldValue(block, "Z", "0");
	const hairColor = getFieldValue(block, "HAIR_COLOR", "#000000");
	const skinColor = getFieldValue(block, "SKIN_COLOR", "#FFE0BD");
	const eyesColor = getFieldValue(block, "EYES_COLOR", "#0000FF");
	const sleevesColor = getFieldValue(block, "SLEEVES_COLOR", "#FFFFFF");
	const shortsColor = getFieldValue(block, "SHORTS_COLOR", "#000000");
	const tshirtColor = getFieldValue(block, "TSHIRT_COLOR", "#FF0000");
	const variableName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("ID_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);

	const meshId = modelName + "_" + flock.scene.getUniqueId();
	meshMap[meshId] = block;

	return `${variableName} = newCharacter('${modelName}', '${meshId}', ${scale}, ${x}, ${y}, ${z}, ${hairColor}, ${skinColor}, ${eyesColor}, ${sleevesColor}, ${shortsColor}, ${tshirtColor});\n`;
};

javascriptGenerator.forBlock["load_object"] = function (block) {
	const modelName = block.getFieldValue("MODELS");
	const scale = getFieldValue(block, "SCALE", "1");
	const x = getFieldValue(block, "X", "0");
	const y = getFieldValue(block, "Y", "0");
	const z = getFieldValue(block, "Z", "0");
	const color = getFieldValue(block, "COLOR", "#000000");
	const variableName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("ID_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);

	const meshId = modelName + "_" + flock.scene.getUniqueId();
	meshMap[meshId] = block;

	return `${variableName} = newObject('${modelName}', '${meshId}', ${scale}, ${x}, ${y}, ${z}, ${color});\n`;
};

javascriptGenerator.forBlock["create_box"] = function (block) {
	const color = getFieldValue(block, "COLOR", "#9932CC");
	const width = getFieldValue(block, "WIDTH", "1");
	const height = getFieldValue(block, "HEIGHT", "1");
	const depth = getFieldValue(block, "DEPTH", "1");
	const posX = getFieldValue(block, "X", "0");
	const posY = getFieldValue(block, "Y", "0");
	const posZ = getFieldValue(block, "Z", "0");

	let variableName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("ID_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);

	const boxId = `box_${generateUUID()}`;
	meshMap[boxId] = block;

	return `${variableName} = newBox(${color}, ${width}, ${height}, ${depth}, ${posX}, ${posY}, ${posZ}, "${boxId}");\n`;
};

javascriptGenerator.forBlock["create_sphere"] = function (block) {
	const color = getFieldValue(block, "COLOR", "#9932CC");
	const diameterX = getFieldValue(block, "DIAMETER_X", "1");
	const diameterY = getFieldValue(block, "DIAMETER_Y", "1");
	const diameterZ = getFieldValue(block, "DIAMETER_Z", "1");
	const posX = getFieldValue(block, "X", "0");
	const posY = getFieldValue(block, "Y", "0.5");
	const posZ = getFieldValue(block, "Z", "0");

	let variableName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("ID_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);

	const sphereId = `sphere_${generateUUID()}`;
	meshMap[sphereId] = block;

	return `${variableName} = newSphere(${color}, ${diameterX}, ${diameterY}, ${diameterZ}, ${posX}, ${posY}, ${posZ}, "${sphereId}");\n`;
};

javascriptGenerator.forBlock["create_cylinder"] = function (block) {
	const color = getFieldValue(block, "COLOR", "#9932CC");
	const height = getFieldValue(block, "HEIGHT", "2");
	const diameterTop = getFieldValue(block, "DIAMETER_TOP", "1");
	const diameterBottom = getFieldValue(block, "DIAMETER_BOTTOM", "1");
	const posX = getFieldValue(block, "X", "0");
	const posY = getFieldValue(block, "Y", "0.5");
	const posZ = getFieldValue(block, "Z", "0");

	let variableName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("ID_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);

	const cylinderId = `cylinder_${generateUUID()}`;
	meshMap[cylinderId] = block;

	return `${variableName} = newCylinder(${color}, ${height}, ${diameterTop}, ${diameterBottom}, ${posX}, ${posY}, ${posZ}, "${cylinderId}");\n`;
};

javascriptGenerator.forBlock["create_capsule"] = function (block) {
	const color = getFieldValue(block, "COLOR", "#9932CC");
	const radius = getFieldValue(block, "RADIUS", "1");
	const height = getFieldValue(block, "HEIGHT", "2");
	const posX = getFieldValue(block, "X", "0");
	const posY = getFieldValue(block, "Y", "1");
	const posZ = getFieldValue(block, "Z", "0");

	let variableName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("ID_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);

	const capsuleId = `capsule_${generateUUID()}`;
	meshMap[capsuleId] = block;

	return `${variableName} = newCapsule(${color}, ${radius}, ${height}, ${posX}, ${posY}, ${posZ}, "${capsuleId}");\n`;
};

javascriptGenerator.forBlock["create_plane"] = function (block) {
	const color = getFieldValue(block, "COLOR", "#9932CC");
	const width = getFieldValue(block, "WIDTH", "1");
	const height = getFieldValue(block, "HEIGHT", "1");
	const posX = getFieldValue(block, "X", "0");
	const posY = getFieldValue(block, "Y", "0");
	const posZ = getFieldValue(block, "Z", "0");

	let variableName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("ID_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);

	const planeId = `plane_${generateUUID()}`;
	meshMap[planeId] = block;

	return `${variableName} = newPlane(${color}, ${width}, ${height}, ${posX}, ${posY}, ${posZ}, "${planeId}");`;
};

javascriptGenerator.forBlock["set_background_color"] = function (block) {
	const color = getFieldValue(block, "COLOR", "#6495ED");
	return `flock.scene.clearColor = BABYLON.Color4.FromHexString(${color} + "FF");\n`;
};

javascriptGenerator.forBlock["move_by_vector"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("BLOCK_NAME"),
		Blockly.Names.NameType.VARIABLE,
	);

	const x = getFieldValue(block, "X", "0");
	const y = getFieldValue(block, "Y", "0");
	const z = getFieldValue(block, "Z", "0");

	return `await moveByVector(${modelName}, ${x}, ${y}, ${z});\n`;
};

javascriptGenerator.forBlock["scale"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("BLOCK_NAME"),
		Blockly.Names.NameType.VARIABLE,
	);
	const x = getFieldValue(block, "X", "0");
	const y = getFieldValue(block, "Y", "0");
	const z = getFieldValue(block, "Z", "0");

	return `await scaleMesh(${modelName}, ${x}, ${y}, ${z});\n`;
};

javascriptGenerator.forBlock["rotate_model_xyz"] = function (block) {
	const meshName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL"),
		Blockly.Names.NameType.VARIABLE,
	);

	const x = getFieldValue(block, "X", "0");
	const y = getFieldValue(block, "Y", "0");
	const z = getFieldValue(block, "Z", "0");

	return `await rotate(${meshName}, ${x}, ${y}, ${z});\n`;
};

javascriptGenerator.forBlock["get_property"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MESH"),
		Blockly.Names.NameType.VARIABLE,
	);
	const propertyName = block.getFieldValue("PROPERTY");

	const code = `await getProperty(${modelName}, '${propertyName}')`;
	return [code, javascriptGenerator.ORDER_NONE];
};

javascriptGenerator.forBlock["rotate_model_xyz"] = function (block) {
	const meshName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL"),
		Blockly.Names.NameType.VARIABLE,
	);

	const x = getFieldValue(block, "X", "0");
	const y = getFieldValue(block, "Y", "0");
	const z = getFieldValue(block, "Z", "0");

	return `await rotate(${meshName}, ${x}, ${y}, ${z});\n`;
};

javascriptGenerator.forBlock["forever"] = function (block) {
	const branch = javascriptGenerator.statementToCode(block, "DO");

	const code = `forever(async () => {\n${branch}});\n`;
	return code;
};

javascriptGenerator.forBlock["play_animation"] = function (block) {
	const animationName = block.getFieldValue("ANIMATION_NAME");
	const modelVar = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL"),
		Blockly.Names.NameType.VARIABLE,
	);

	return `await playAnimation(${modelVar}, "${animationName}");\n`;
};

javascriptGenerator.forBlock["play_sound"] = function (block) {
	const soundName = block.getFieldValue("SOUND_NAME");
	const speed = parseFloat(getFieldValue(block, "SPEED", 1));
	const volume = parseFloat(getFieldValue(block, "VOLUME", 1));
	const mode = block.getFieldValue("MODE");
	const async = block.getFieldValue("ASYNC");

	let options = {
		playbackRate: speed,
		volume: volume,
		loop: mode === "LOOP",
	};

	const optionsString = JSON.stringify(options);

	return async === "AWAIT"
		? `await flock.playSoundAsync(flock.scene, "${soundName}", ${optionsString});\n`
		: `new flock.BABYLON.Sound("${soundName}", "sounds/${soundName}", flock.scene, null, { autoplay: true, ...${optionsString} });\n`;
};

javascriptGenerator.forBlock["stop_all_sounds"] = function (block) {
	// JavaScript code to stop all sounds in a Babylon.js scene
	return "flock.scene.sounds.forEach(function(sound) { sound.stop(); });\n";
};

javascriptGenerator.forBlock["when_clicked"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);

	const trigger = block.getFieldValue("TRIGGER");
	const doCode = javascriptGenerator.statementToCode(block, "DO");

	return `onTrigger(${modelName}, "${trigger}", async function() {
			${doCode}
		});\n`;
};

javascriptGenerator.forBlock["when_touches"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL_VAR"),
		Blockly.Names.NameType.VARIABLE,
		true,
	);

	const otherModelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("OTHER_MODEL_VAR"),
		Blockly.Names.NameType.VARIABLE,
		true,
	);

	const trigger = block.getFieldValue("TRIGGER");
	const doCode = javascriptGenerator.statementToCode(block, "DO");

	// Ensure the trigger is an intersection trigger
	if (
		trigger === "OnIntersectionEnterTrigger" ||
		trigger === "OnIntersectionExitTrigger"
	) {
		return `onIntersect(${modelName}, ${otherModelName}, "${trigger}", async function() {
	  ${doCode}
	});\n`;
	} else {
		console.error(
			"Invalid trigger type for 'when_touches' block:",
			trigger,
		);
		return "";
	}
};

javascriptGenerator.forBlock["when_key_pressed"] = function (block) {
	const key = block.getFieldValue("KEY");
	const statements_do = javascriptGenerator.statementToCode(block, "DO");

	return `whenKeyPressed("${key}", async () => {${statements_do}});\n`;
};

javascriptGenerator.forBlock["when_key_released"] = function (block) {
	const key = block.getFieldValue("KEY");
	const statements_do = javascriptGenerator.statementToCode(block, "DO");

	return `flock.scene.onKeyboardObservable.add( async (kbInfo) => {
	switch (kbInfo.type) {
	  case BABYLON.KeyboardEventTypes.KEYUP:
	  if (kbInfo.event.key === "${key}") {
		${statements_do}
	  }
	  break;
	}
	});
	`;
};

javascriptGenerator.forBlock["broadcast_event"] = function (block) {
	const eventName = block.getFieldValue("EVENT_NAME");

	return `broadcastEvent("${eventName}");\n`;
};

javascriptGenerator.forBlock["on_event"] = function (block) {
	const eventName = block.getFieldValue("EVENT_NAME");
	const statements_do = javascriptGenerator.statementToCode(block, "DO");

	return `onEvent("${eventName}", async function() {\n${statements_do}});\n`;
};

function removeEventListeners() {
	flock.scene.eventListeners.forEach(({ event, handler }) => {
		document.removeEventListener(event, handler);
	});
	flock.scene.eventListeners.length = 0; // Clear the array
}

javascriptGenerator.forBlock["highlight"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);
	const color = getFieldValue(block, "COLOR", "#FFD700");
	return `await highlight(${modelName}, ${color});\n`;
};

javascriptGenerator.forBlock["tint"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);
	const color = getFieldValue(block, "COLOR", "#AA336A");

	return `await tint(${modelName}, ${color});\n`;
};

javascriptGenerator.forBlock["change_colour"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);
	const color = getFieldValue(block, "COLOR", "#ffffff");

	return `await changeColour(${modelName}, ${color});\n`;
};

javascriptGenerator.forBlock["change_material"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("ID_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);
	const material = block.getFieldValue("MATERIALS");
	const color = getFieldValue(block, "COLOR", "#ffffff");

	console.log(modelName, material, color);
	return `await changeMaterial(${modelName}, "${material}", ${color});\n`;
};

javascriptGenerator.forBlock["set_alpha"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MESH"),
		Blockly.Names.NameType.VARIABLE,
	);

	const alphaValue = javascriptGenerator.valueToCode(
		block,
		"ALPHA",
		javascriptGenerator.ORDER_ATOMIC,
	);

	return `await setAlpha(${modelName}, ${alphaValue});\n`;
};

javascriptGenerator.forBlock["clear_effects"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);

	return `await clearEffects(${modelName});\n`;
};

javascriptGenerator.forBlock["switch_animation"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL"),
		Blockly.Names.NameType.VARIABLE,
	);
	const animationName = block.getFieldValue("ANIMATION_NAME");

	return `await switchAnimation(${modelName}, "${animationName}");\n`;
};

javascriptGenerator.forBlock["create_map"] = function (block) {
	const mapName = block.getFieldValue("MAP_NAME");
	const color = getFieldValue(block, "COLOR", "#6495ED");

	return `createMap("${mapName}", ${color});\n`;
};

javascriptGenerator.forBlock["move_forward"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL"),
		Blockly.Names.NameType.VARIABLE,
	);
	const speed =
		javascriptGenerator.valueToCode(
			block,
			"SPEED",
			javascriptGenerator.ORDER_ATOMIC,
		) || "0";

	return `moveForward(${modelName}, ${speed});\n`;
};

javascriptGenerator.forBlock["up"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);
	const upForce = getFieldValue(block, "UP_FORCE", "1"); // Default up force

	return `up(${modelName}, ${upForce});\n`;
};

javascriptGenerator.forBlock["apply_force"] = function (block) {
	// Get the name of the mesh variable
	const mesh = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MESH_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);

	// Get the force values
	const forceX =
		javascriptGenerator.valueToCode(
			block,
			"X",
			javascriptGenerator.ORDER_ATOMIC,
		) || "0";
	const forceY =
		javascriptGenerator.valueToCode(
			block,
			"Y",
			javascriptGenerator.ORDER_ATOMIC,
		) || "0";
	const forceZ =
		javascriptGenerator.valueToCode(
			block,
			"Z",
			javascriptGenerator.ORDER_ATOMIC,
		) || "0";

	// Generate the code
	var code = `applyForce(${mesh}, ${forceX}, ${forceY}, ${forceZ});\n`;
	return code;
};

javascriptGenerator.forBlock["touching_surface"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);

	return [`isTouchingSurface(${modelName})`, javascriptGenerator.ORDER_NONE];
};

javascriptGenerator.forBlock["camera_follow"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MESH_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);
	return `await attachCamera(${modelName});\n`;
};
javascriptGenerator.forBlock["add_physics"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);

	const physicsType = block.getFieldValue("PHYSICS_TYPE");

	// Note: Ensure that the execution environment supports async/await at this level
	return `await setPhysics(${modelName}, "${physicsType}");\n`;
};

javascriptGenerator.forBlock["canvas_controls"] = function (block) {
	const controls = block.getFieldValue("CONTROLS") == "TRUE";
	return `canvasControls(${controls});\n`;
};

javascriptGenerator.forBlock["key_pressed"] = function (block) {
	const key = block.getFieldValue("KEY");
	return [`keyPressed("${key}")`, javascriptGenerator.ORDER_NONE];
};

// Blockly code generator for checking if two meshes are touching
javascriptGenerator.forBlock["meshes_touching"] = function (block) {
	const mesh1VarName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MESH1"),
		Blockly.Names.NameType.VARIABLE,
	);
	const mesh2VarName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MESH2"),
		Blockly.Names.NameType.VARIABLE,
	);

	const code = `checkMeshesTouching(${mesh1VarName}, ${mesh2VarName})`;
	return [code, javascriptGenerator.ORDER_ATOMIC];
};

const createScene = function () {
	flock.scene = new BABYLON.Scene(engine);
	flock.scene.eventListeners = [];
	hk = new BABYLON.HavokPlugin(true, havokInstance);
	flock.scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), hk);
	flock.hk = hk;
	flock.highlighter = new BABYLON.HighlightLayer("highlighter", flock.scene);
	gizmoManager = new BABYLON.GizmoManager(flock.scene);

	flock.BABYLON.Effect.ShadersStore["customVertexShader"] = `
		precision highp float;

		attribute vec3 position;
		attribute vec3 normal;
		attribute vec2 uv;

		uniform mat4 worldViewProjection;
		uniform mat4 world; // Add the world matrix

		varying vec3 vWorldPosition; // Pass the world position
		varying vec2 vUV;

		void main() {
			vec4 worldPosition = world * vec4(position, 1.0);
			vWorldPosition = worldPosition.xyz; // Store the world position
			vUV = uv;

			gl_Position = worldViewProjection * vec4(position, 1.0);
		}
	`;
	BABYLON.Effect.ShadersStore["customFragmentShader"] = `
		precision highp float;

		varying vec3 vWorldPosition; // Receive the world position
		varying vec2 vUV;

		void main() {
			vec3 color;

			// Determine color based on the y-coordinate of the world position
			if (vWorldPosition.y > 10.0) {
				color = vec3(1.0, 1.0, 1.0); // Snow
			} else if (vWorldPosition.y > 8.0) {
				color = vec3(0.5, 0.5, 0.5); // Grey rocks
			} else if (vWorldPosition.y > 0.0) {
				color = vec3(0.13, 0.55, 0.13); // Grass
			} else if (vWorldPosition.y > -1.0) {
				color = vec3(0.55, 0.27, 0.07); // Brown rocks
			} else {
				color = vec3(0.96, 0.87, 0.20); // Beach
			}

			gl_FragColor = vec4(color, 1.0);
		}
	`;

	/*
	  const ground = BABYLON.MeshBuilder.CreateGroundFromHeightMap("heightmap", './textures/simple_height_map.png', {
		width: 100,
		height: 100,
		minHeight: -5,
		maxHeight: 5,
		subdivisions: 25,
		onReady: (groundMesh) => {
		   const groundAggregate = new BABYLON.PhysicsAggregate(groundMesh, BABYLON.PhysicsShapeType.MESH, { mass: 0 }, flock.scene);
		}
	  }, flock.scene);*/

	const camera = new BABYLON.FreeCamera(
		"camera",
		new BABYLON.Vector3(0, 3, -10),
		flock.scene,
	);
	camera.setTarget(BABYLON.Vector3.Zero());
	camera.rotation.x = BABYLON.Tools.ToRadians(0);
	camera.angularSensibilityX = 2000;
	camera.angularSensibilityY = 2000;
	flock.scene.createDefaultLight();
	flock.scene.collisionsEnabled = true;
	createTouchGUI();
	const advancedTexture =
		flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

	// Create a stack panel to hold the text lines
	const stackPanel = new flock.GUI.StackPanel();
	stackPanel.isVertical = true;
	stackPanel.width = "100%";
	stackPanel.height = "100%";
	stackPanel.left = "0px";
	stackPanel.top = "0px";
	advancedTexture.addControl(stackPanel);

	// Function to print text with scrolling
	const textLines = []; // Array to keep track of text lines
	flock.printText = function (text, duration, color) {
		if (text === "" || !flock.scene) {
			// Ensure scene is valid
			return; // Return early if scene is invalid or text is empty
		}

		try {
			flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

			// Create a rectangle background
			const bg = new flock.GUI.Rectangle("textBackground");
			bg.background = "rgba(255, 255, 255, 0.5)";
			bg.adaptWidthToChildren = true; // Adjust width based on child elements
			bg.adaptHeightToChildren = true; // Adjust height based on child elements
			bg.cornerRadius = 2;
			bg.thickness = 0; // Remove border
			bg.horizontalAlignment =
				flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
			bg.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
			bg.left = "5px"; // Position with some margin from left
			bg.top = "5px"; // Position with some margin from top

			// Create a text block
			const textBlock = new flock.GUI.TextBlock("textBlock", text);
			textBlock.color = color;
			textBlock.fontSize = "20";
			textBlock.height = "25px";
			textBlock.paddingLeft = "10px";
			textBlock.paddingRight = "10px";
			textBlock.paddingTop = "2px";
			textBlock.paddingBottom = "2px";
			textBlock.textVerticalAlignment =
				flock.GUI.Control.VERTICAL_ALIGNMENT_TOP; // Align text to top
			textBlock.textHorizontalAlignment =
				flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT; // Align text to left
			textBlock.textWrapping = flock.GUI.TextWrapping.WordWrap;
			textBlock.resizeToFit = true;
			textBlock.forceResizeWidth = true;

			// Add the text block to the rectangle
			bg.addControl(textBlock);

			// Add the container to the stack panel
			stackPanel.addControl(bg);
			textLines.push(bg);

			// Remove the text after the specified duration
			setTimeout(() => {
				if (flock.scene) {
					// Ensure scene is still valid before removing
					stackPanel.removeControl(bg);
					textLines.splice(textLines.indexOf(bg), 1);
				}
			}, duration * 1000);
		} catch (error) {
			//console.warn("Unable to print text:", error);
		}
	};

	return flock.scene;
};

javascriptGenerator.forBlock["random_colour"] = function (block) {
	const code = `randomColour()`;
	return [code, javascriptGenerator.ORDER_ATOMIC];
};

javascriptGenerator.forBlock["random_seeded_int"] = function (block) {
	const value_from = getFieldValue(block, "FROM", 0);
	const value_to = getFieldValue(block, "TO", FlowGraphLog10Block);
	const value_seed = getFieldValue(block, "SEED", 123456);

	const code = `seededRandom(${value_from}, ${value_to}, ${value_seed})`;

	return [code, javascriptGenerator.ORDER_NONE];
};

javascriptGenerator.forBlock["colour"] = function (block) {
	const colour = block.getFieldValue("COLOR");
	const code = `"${colour}"`;
	return [code, javascriptGenerator.ORDER_ATOMIC];
};

javascriptGenerator.forBlock["skin_colour"] = function (block) {
	const colour = block.getFieldValue("COLOR");
	const code = `"${colour}"`;
	return [code, javascriptGenerator.ORDER_ATOMIC];
};

javascriptGenerator.forBlock["greyscale_colour"] = function (block) {
	const colour = block.getFieldValue("COLOR");
	const code = `"${colour}"`;
	return [code, javascriptGenerator.ORDER_ATOMIC];
};

javascriptGenerator.forBlock["colour_from_string"] = function (block) {
	const color =
		javascriptGenerator.valueToCode(
			block,
			"COLOR",
			javascriptGenerator.ORDER_ATOMIC,
		) || "''";
	console.log(color);
	const code = `${color}`;
	return [code, javascriptGenerator.ORDER_ATOMIC];
};

async function initialize() {
	BABYLON.Database.IDBStorageEnabled = true;
	BABYLON.Engine.CollisionsEpsilon = 0.00005;
	havokInstance = await HavokPhysics();

	engineReady = true;
	flock.scene = createScene();
	flock.scene.eventListeners = [];

	engine.runRenderLoop(function () {
		flock.scene.render();
	});
}

initialize();
const meshMap = {};

let nextVariableIndexes = {};

function initializeVariableIndexes() {
	nextVariableIndexes = {
		model: 1,
		box: 1,
		sphere: 1,
		cylinder: 1,
		capsule: 1,
		plane: 1,
		text: 1,
		sound: 1,
		character: 1,
		object: 1,
	};

	const workspace = Blockly.getMainWorkspace(); // Get the current Blockly workspace
	const allVariables = workspace.getAllVariables(); // Retrieve all variables in the workspace

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

const initialBlocksJson = {
	blocks: {
		languageVersion: 0,
		blocks: [
			{
				type: "start",
				x: 10,
				y: 10,
				inputs: {
					DO: {
						block: {
							type: "set_sky_color",
							inputs: {
								COLOR: {
									shadow: {
										type: "colour",
										fields: {
											COLOR: "#6495ed",
										},
									},
								},
							},
							next: {
								block: {
									type: "create_ground",
									inputs: {
										COLOR: {
											shadow: {
												type: "colour",
												fields: {
													COLOR: "#71bc78",
												},
											},
										},
									},
									next: {
										block: {
											type: "print_text",
											inputs: {
												TEXT: {
													shadow: {
														type: "text",
														fields: {
															TEXT: "🌈 Hello",
														},
													},
												},
												DURATION: {
													shadow: {
														type: "math_number",
														fields: {
															NUM: 30,
														},
													},
												},
												COLOR: {
													shadow: {
														type: "colour",
														fields: {
															COLOR: "#000080",
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		],
	},
};

// Load the JSON into the workspace
Blockly.serialization.workspaces.load(initialBlocksJson, workspace);

executeCode();

function stripFilename(inputString) {
	const removeEnd = inputString.replace(/\(\d+\)/g, "");
	// Find the last occurrence of '/' or '\'
	let lastIndex = Math.max(
		removeEnd.lastIndexOf("/"),
		removeEnd.lastIndexOf("\\"),
	);

	if (lastIndex === -1) {
		return removeEnd.trim();
	}

	return removeEnd.substring(lastIndex + 1).trim();
}

function exportCode() {
	const projectName =
		document.getElementById("projectName").value || "default_project";

	const json = Blockly.serialization.workspaces.save(workspace);
	const jsonString = JSON.stringify(json, null, 2); // Pretty-print the JSON

	const element = document.createElement("a");
	element.setAttribute(
		"href",
		"data:text/json;charset=utf-8," + encodeURIComponent(jsonString),
	);
	element.setAttribute("download", projectName + ".json");

	document.body.appendChild(element); // Required for Firefox
	element.click();
	document.body.removeChild(element);
}

window.onload = function () {
	window.loadingCode = true;
	workspace.addChangeListener(function (event) {
		if (
			event.type === Blockly.Events.TOOLBOX_ITEM_SELECT ||
			event.type === Blockly.Events.FLYOUT_SHOW
		) {
			const toolbox = workspace.getToolbox();
			const selectedItem = toolbox.getSelectedItem();

			if (selectedItem && selectedItem.getName() === "Snippets") {
				window.loadingCode = true;
			} else {
				window.loadingCode = false;
			}
		}
	});

	document
		.getElementById("fileInput")
		.addEventListener("change", function (event) {
			const reader = new FileReader();
			reader.onload = function () {
				const text = reader.result;
				const json = JSON.parse(text);

				// Set the project name as the value of the projectName input field
				document.getElementById("projectName").value = stripFilename(
					document
						.getElementById("fileInput")
						.value.replace(".json", ""),
				);

				Blockly.serialization.workspaces.load(json, workspace);

				executeCode();
			};
			reader.readAsText(event.target.files[0]);
		});

	// Add event listener to file input
	document
		.getElementById("importFile")
		.addEventListener("change", handleSnippetUpload);

	// Create a set to keep track of pressed keys
	flock.canvas.pressedKeys = new Set();

	flock.canvas.addEventListener("keydown", function (event) {
		flock.canvas.currentKeyPressed = event.key;
		flock.canvas.pressedKeys.add(event.key);
	});

	flock.canvas.addEventListener("keyup", function (event) {
		flock.canvas.pressedKeys.delete(event.key);
	});
};

function executeCode() {
	if (engineReady) {
		if (flock.scene) {
			flock.scene.dispose();
			removeEventListeners();
		}
		flock.scene = createScene();

		const code = javascriptGenerator.workspaceToCode(workspace);
		try {
			console.log(code);
			//new Function(`(async () => { ${code} })()`)();
			runCode(code);
			document.getElementById("renderCanvas").focus();
		} catch (error) {
			console.error("Error executing Blockly code:", error);
		}
	} else {
		// Check again in 100 milliseconds
		setTimeout(executeCode, 100);
	}
}

function stopCode() {
	flock.scene.dispose();
	removeEventListeners();
	switchView(codeMode);
}

window.stopCode = stopCode;

function toggleGizmo(gizmoType) {
	// Disable all gizmos
	gizmoManager.positionGizmoEnabled = false;
	gizmoManager.rotationGizmoEnabled = false;
	gizmoManager.scaleGizmoEnabled = false;
	gizmoManager.boundingBoxGizmoEnabled = false;

	// Enable the selected gizmo
	switch (gizmoType) {
		case "position":
			gizmoManager.positionGizmoEnabled = true;
			gizmoManager.gizmos.positionGizmo.snapDistance = 0.1;
			gizmoManager.gizmos.positionGizmo.updateGizmoPositionToMatchAttachedMesh = true;

			gizmoManager.gizmos.positionGizmo.onDragStartObservable.add(
				function () {
					const mesh = gizmoManager.attachedMesh;
					const motionType = mesh.physics.getMotionType();
					mesh.savedMotionType = motionType;
					//console.log(motionType);
					if (
						mesh.physics &&
						mesh.physics.getMotionType() !=
							BABYLON.PhysicsMotionType.STATIC
					) {
						mesh.physics.setMotionType(
							BABYLON.PhysicsMotionType.STATIC,
						);
						mesh.physics.disablePreStep = false;
					}

					const block = meshMap[mesh.blockKey];
					highlightBlockById(workspace, block);
				},
			);

			gizmoManager.gizmos.positionGizmo.onDragEndObservable.add(
				function () {
					// Retrieve the mesh associated with the position gizmo
					const mesh = gizmoManager.attachedMesh;
					if (mesh.savedMotionType) {
						mesh.physics.setMotionType(mesh.savedMotionType);
						mesh.physics.disablePreStep = true;
					}

					const block = meshMap[mesh.blockKey];

					if (block) {
						block
							.getInput("X")
							.connection.targetBlock()
							.setFieldValue(
								String(Math.round(mesh.position.x * 10) / 10),
								"NUM",
							);
						block
							.getInput("Y")
							.connection.targetBlock()
							.setFieldValue(
								String(Math.round(mesh.position.y * 10) / 10),
								"NUM",
							);
						block
							.getInput("Z")
							.connection.targetBlock()
							.setFieldValue(
								String(Math.round(mesh.position.z * 10) / 10),
								"NUM",
							);
					}
				},
			);

			break;
		case "rotation":
			gizmoManager.rotationGizmoEnabled = true;
			break;
		case "scale":
			gizmoManager.scaleGizmoEnabled = true;
			break;
		case "boundingBox":
			gizmoManager.boundingBoxGizmoEnabled = true;
			break;
		default:
			break;
	}
}

window.toggleGizmo = toggleGizmo;

function turnOffAllGizmos() {
	gizmoManager.positionGizmoEnabled = false;
	gizmoManager.rotationGizmoEnabled = false;
	gizmoManager.scaleGizmoEnabled = false;
	gizmoManager.boundingBoxGizmoEnabled = false;
}

window.turnOffAllGizmos = turnOffAllGizmos;

function highlightBlockById(workspace, block) {
	if (block) {
		block.select();
		workspace.centerOnBlock(block.id, true);
	}
}

document
	.getElementById("fullscreenToggle")
	.addEventListener("click", function () {
		if (!document.fullscreenElement) {
			// Go fullscreen
			if (document.documentElement.requestFullscreen) {
				document.documentElement.requestFullscreen();
			} else if (document.documentElement.mozRequestFullScreen) {
				/* Firefox */
				document.documentElement.mozRequestFullScreen();
			} else if (document.documentElement.webkitRequestFullscreen) {
				/* Chrome, Safari & Opera */
				document.documentElement.webkitRequestFullscreen();
			} else if (document.documentElement.msRequestFullscreen) {
				/* IE/Edge */
				document.documentElement.msRequestFullscreen();
			}
		} else {
			// Exit fullscreen
			if (document.exitFullscreen) {
				document.exitFullscreen();
			} else if (document.mozCancelFullScreen) {
				/* Firefox */
				document.mozCancelFullScreen();
			} else if (document.webkitExitFullscreen) {
				/* Chrome, Safari & Opera */
				document.webkitExitFullscreen();
			} else if (document.msExitFullscreen) {
				/* IE/Edge */
				document.msExitFullscreen();
			}
		}
	});

document.getElementById("toggleDebug").addEventListener("click", function () {
	const blocklyArea = document.getElementById("codePanel");
	const canvasArea = document.getElementById("rightArea");
	const menu = document.getElementById("menu");
	const gizmoButtons = document.getElementById("gizmoButtons");

	if (flock.scene.debugLayer.isVisible()) {
		switchView(viewMode);
		flock.scene.debugLayer.hide();
	} else {
		blocklyArea.style.display = "none";
		blocklyArea.style.width = "0";
		canvasArea.style.width = "100%";
		menu.style.right = "unset";
		flock.scene.debugLayer.show();
	}
});

async function exportBlockSnippet(block) {
	try {
		// Save the block and its children to a JSON object
		const blockJson = Blockly.serialization.blocks.save(block);

		// Convert the JSON object to a pretty-printed JSON string
		const jsonString = JSON.stringify(blockJson, null, 2);

		// Check if the File System Access API is available
		if ("showSaveFilePicker" in window) {
			// Define the options for the file picker
			const options = {
				suggestedName: "blockly_snippet.json",
				types: [
					{
						description: "JSON Files",
						accept: {
							"application/json": [".json"],
						},
					},
				],
			};

			// Show the save file picker
			const fileHandle = await window.showSaveFilePicker(options);

			// Create a writable stream
			const writable = await fileHandle.createWritable();

			// Write the JSON string to the file
			await writable.write(jsonString);

			// Close the writable stream
			await writable.close();
		} else {
			// Fallback for browsers that don't support the File System Access API
			const filename =
				prompt(
					"Enter a filename for the snippet:",
					"blockly_snippet",
				) || "blockly_snippet";
			const blob = new Blob([jsonString], { type: "application/json" });
			const link = document.createElement("a");
			link.href = URL.createObjectURL(blob);
			link.download = `${filename}.json`;
			link.click();
		}
	} catch (e) {
		console.error("Error exporting block:", e);
	}
}

// Function to handle file upload and import JSON snippet into workspace
function handleSnippetUpload(event) {
	window.loadingCode = true;
	const file = event.target.files[0];
	const reader = new FileReader();
	reader.onload = function (event) {
		const jsonText = event.target.result;

		try {
			const json = JSON.parse(jsonText);
			Blockly.serialization.blocks.append(json, workspace);
		} catch (e) {
			console.error("Error importing JSON:", e);
		}
	};
	reader.readAsText(file);
}

// Function to trigger file input for importing snippet
function importSnippet() {
	document.getElementById("importFile").click();
}

function addExportContextMenuOption() {
	Blockly.ContextMenuRegistry.registry.register({
		id: "exportBlock",
		weight: 200,
		displayText: function () {
			return "Export block as JSON snippet";
		},
		preconditionFn: function (scope) {
			return scope.block ? "enabled" : "hidden";
		},
		callback: function (scope) {
			exportBlockSnippet(scope.block);
		},
		scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
		checkbox: false,
	});
}

// Initialize Blockly and add custom context menu options
addExportContextMenuOption();

// Extend Blockly with custom context menu for importing snippets in the workspace
function addImportContextMenuOption() {
	Blockly.ContextMenuRegistry.registry.register({
		id: "importSnippet",
		weight: 100,
		displayText: function () {
			return "Import snippet";
		},
		preconditionFn: function (scope) {
			return "enabled";
		},
		callback: function (scope) {
			importSnippet();
		},
		scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
		checkbox: false,
	});
}

function openAboutPage() {
	window.open("https://github.com/flipcomputing/flock/", "_blank");
}

window.openAboutPage = openAboutPage;

addImportContextMenuOption();

function loadExample() {
	window.loadingCode = true;

	const exampleFile = document.getElementById("exampleSelect").value;
	if (exampleFile) {
		fetch(exampleFile)
			.then((response) => response.json())
			.then((json) => {
				Blockly.serialization.workspaces.load(json, workspace);
				executeCode();
			})
			.catch((error) => {
				console.error("Error loading example:", error);
			});
	}
}

window.executeCode = executeCode;
window.exportCode = exportCode;
window.loadExample = loadExample;

const runCode = (code) => {
	// Create a new sandboxed environment
	try {
		// Create a sandboxed function by embedding code into a new Function
		const sandboxedFunction = new Function(
			"flock",
			`
			"use strict";

			const {
				playAnimation,
				switchAnimation,
				highlight,
				newCharacter,
				newObject,
				newModel,
				newBox,
				newSphere,
				newCylinder,
				newCapsule,
				newPlane,
				createGround,
				createMap,
				createCustomMap,
				setSky,
				up,
				applyForce,
				moveByVector,
				glideTo,
				rotate,
				wait,
				show,
				hide,
				clearEffects,
				tint,
				setAlpha,
				setFog,
				keyPressed,
				isTouchingSurface,
				seededRandom,
				randomColour,
				scaleMesh,
				changeColour,
				changeMaterial,
				moveForward,
				attachCamera,
				canvasControls,
				setPhysics,
				checkMeshesTouching,
				say,
				onTrigger,
				onEvent,
				broadcastEvent,
				forever,
				whenKeyPressed,
				printText,
				onIntersect,
				getProperty,
			} = flock;
			

			// The code should be executed within the function context
			return function() {
				${code}
			};
		`,
		)(flock);

		// Execute the sandboxed function
		sandboxedFunction();
	} catch (error) {
		console.error("Error executing sandboxed code:", error);
	}
};

// Function to maintain a 16:9 aspect ratio for the canvas
function resizeCanvas() {
	const canvasArea = document.getElementById("rightArea");
	const canvas = document.getElementById("renderCanvas");

	const areaWidth = canvasArea.clientWidth;
	const areaHeight = canvasArea.clientHeight - 100; // Deducting menu height

	const aspectRatio = 16 / 9;

	let newWidth, newHeight;

	if (areaWidth / areaHeight > aspectRatio) {
		newHeight = areaHeight;
		newWidth = newHeight * aspectRatio;
	} else {
		newWidth = areaWidth;
		newHeight = newWidth / aspectRatio;
	}

	canvas.style.width = `${newWidth}px`;
	canvas.style.height = `${newHeight}px`;
}

// Resize Blockly workspace and Babylon.js canvas when the window is resized
window.addEventListener("resize", onResize);
function onResize() {
	Blockly.svgResize(workspace);
	resizeCanvas();
	engine.resize();
}

let viewMode = "both";
let codeMode = "both";
window.viewMode = viewMode;
window.codeMode = codeMode;

// Function to switch views
function switchView(view) {
	const blocklyArea = document.getElementById("codePanel");
	const canvasArea = document.getElementById("rightArea");
	const menu = document.getElementById("menu");
	const gizmoButtons = document.getElementById("gizmoButtons");
	const menuControl = document.getElementById("blocklyMenuButton");

	if (view === "both") {
		//flock.scene.debugLayer.hide();
		viewMode = "both";
		codeMode = "both";
		blocklyArea.style.display = "block";
		canvasArea.style.width = "50%";
		blocklyArea.style.width = "50%";
		gizmoButtons.style.display = "flex";
		menu.style.display = "flex";
		//menu.style.right = "unset";
		menuControl.style.display = "none";
	} else if (view === "blockly") {
		//flock.scene.debugLayer.hide();
		viewMode = "blockly";
		codeMode = "blockly";
		blocklyArea.style.display = "block";
		blocklyArea.style.width = "100%";
		canvasArea.style.width = "0%";
		gizmoButtons.style.display = "none";
		menu.style.display = "none";
		//menu.style.right = "0";
		menuControl.style.display = "block";
	} else if (view === "canvas") {
		//flock.scene.debugLayer.hide();
		viewMode = "canvas";
		blocklyArea.style.display = "none";
		canvasArea.style.width = "100%";
		gizmoButtons.style.display = "flex";
		menu.style.display = "flex";
		//menu.style.top = "unset";
		menuControl.style.display = "none";
	}

	onResize(); // Ensure both Blockly and Babylon.js canvas resize correctly
}

// Function to toggle dropdown visibility
function toggleDropdown() {
	const dropdownContent = document.getElementById("dropdown-content");
	dropdownContent.style.display =
		dropdownContent.style.display === "block" ? "none" : "block";
}

// Initial view setup
switchView("both");
window.switchView = switchView;
window.onResize = onResize;

let toolboxVisible = false;
window.toolboxVisible = toolboxVisible;
workspace.getToolbox().setVisible(false);
onResize();

function toggleToolbox() {
	const toolboxControl = document.getElementById("toolboxControl");
	if (toolboxVisible) {
		toolboxVisible = false;
		workspace.getToolbox().setVisible(false);
		//onResize();
	} else {
		toolboxVisible = true;
		workspace.getToolbox().setVisible(true);
		// Delay binding the click event listener
		setTimeout(() => {
			document.addEventListener("click", handleClickOutside);
		}, 100); // Small delay to ensure the menu is shown before adding the listener
	}

	function handleClickOutside(event) {
		if (!toolboxControl.contains(event.target)) {
			workspace.getToolbox().setVisible(false);
			document.removeEventListener("click", handleClickOutside);
		}
	}
}

window.toggleToolbox = toggleToolbox;

function observeFlyoutVisibility(workspace) {
	// Access the flyout using Blockly's API
	const flyout = workspace.getToolbox().getFlyout();
	const flyoutSvgGroup = flyout.svgGroup_;

	// Check if the flyout SVG group is available
	if (!flyoutSvgGroup) {
		console.error("Flyout SVG group not found.");
		return;
	}

	// Create a MutationObserver to watch for style changes
	const observer = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
			if (mutation.attributeName === "style") {
				const displayStyle =
					window.getComputedStyle(flyoutSvgGroup).display;
				if (displayStyle != "none") {
					// Flyout is hidden
					const toolboxControl =
						document.getElementById("toolboxControl");
					toolboxControl.style.zIndex = "2";
					workspace.getToolbox().setVisible(false);
					// Trigger any resize or UI adjustments if necessary
					onResize();
				}
			}
		});
	});

	// Start observing the flyout SVG group for attribute changes
	observer.observe(flyoutSvgGroup, {
		attributes: true,
		attributeFilter: ["style"],
	});
}

observeFlyoutVisibility(workspace);

function runMenu() {
	switchView("canvas");
	executeCode();
}

window.runMenu = runMenu;

function toggleMenu() {
	const menu = document.getElementById("menu");
	const currentDisplay = window.getComputedStyle(menu).display;

	console.log("Current display:", currentDisplay);

	if (currentDisplay != "none") {
		menu.style.display = "none";
		document.removeEventListener("click", handleClickOutside);
	} else {
		console.log("Showing menu");
		menu.style.display = "flex";

		// Delay binding the click event listener
		setTimeout(() => {
			document.addEventListener("click", handleClickOutside);
		}, 100); // Small delay to ensure the menu is shown before adding the listener
	}

	function handleClickOutside(event) {
		if (!menu.contains(event.target)) {
			menu.style.display = "none";
			document.removeEventListener("click", handleClickOutside);
		}
	}
}

window.toggleMenu = toggleMenu;

const gridKeyPressObservable = new flock.BABYLON.Observable();
const gridKeyReleaseObservable = new flock.BABYLON.Observable();
flock.gridKeyPressObservable = gridKeyPressObservable;
flock.gridKeyReleaseObservable = gridKeyReleaseObservable;
flock.canvas.pressedButtons = new Set();

function createTouchGUI() {
	//if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
	// Create an AdvancedDynamicTexture to hold the UI elements

	const advancedTexture =
		flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

	// Create a grid
	const grid = new flock.GUI.Grid();
	grid.width = "240px";
	grid.height = "160px"; 
	grid.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
	grid.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
	grid.addRowDefinition(1);
	grid.addRowDefinition(1);
	grid.addColumnDefinition(1);
	grid.addColumnDefinition(1);
	grid.addColumnDefinition(1);
	advancedTexture.addControl(grid);

	function createSmallButton(text, key) {
		const button = flock.GUI.Button.CreateSimpleButton("but", text);
		button.width = "70px"; // Small size
		button.height = "70px";
		button.color = "white";
		button.background = "transparent";
		button.border = "4px solid white";
		button.fontSize = "40px"

		button.onPointerDownObservable.add(() => {
			console.log("Button pressed for key:", key);
			flock.canvas.pressedButtons.add(key);
			flock.gridKeyPressObservable.notifyObservers(key);
		});

		button.onPointerUpObservable.add(() => {
			console.log("Button released for key:", key);
			flock.canvas.pressedButtons.delete(key);
			flock.gridKeyReleaseObservable.notifyObservers(key);
		});
		return button;
	}

	const upButton = createSmallButton("▲", "w");
	const downButton = createSmallButton("▼", "s");
	const leftButton = createSmallButton("◀", "a");
	const rightButton = createSmallButton("▶", "d");

	// Add buttons to the grid
	grid.addControl(upButton, 0, 1); // Add to row 0, column 1
	grid.addControl(leftButton, 1, 0); // Add to row 1, column 0
	grid.addControl(downButton, 1, 1); // Add to row 1, column 1
	grid.addControl(rightButton, 1, 2); // Add to row 1, column 2

	// Create another grid for the buttons on the right
	const rightGrid = new flock.GUI.Grid();
	rightGrid.width = "160px"; // Adjust width to fit two buttons
	rightGrid.height = "160px"; // Adjust height to fit two buttons
	rightGrid.horizontalAlignment =
		flock.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
	rightGrid.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
	rightGrid.addRowDefinition(1);
	rightGrid.addRowDefinition(1);
	rightGrid.addColumnDefinition(1);
	rightGrid.addColumnDefinition(1);
	advancedTexture.addControl(rightGrid);

	// Create buttons for the right grid
	const button1 = createSmallButton("💖", "q");
	const button2 = createSmallButton("⭐", "e");
	const button3 = createSmallButton("🌸", "f");
	const button4 = createSmallButton("💎", " ");

	// Add buttons to the right grid in a 2x2 layout
	rightGrid.addControl(button1, 0, 0); // Row 0, Column 0
	rightGrid.addControl(button2, 0, 1); // Row 0, Column 1
	rightGrid.addControl(button3, 1, 0); // Row 1, Column 0
	rightGrid.addControl(button4, 1, 1); // Row 1, Column 1

	// Extend handleInput function to handle these actions
	function handleInput(input) {
		switch (input) {
			case "up":
				console.log("Move Up");
				break;
			case "down":
				console.log("Move Down");
				break;
			case "left":
				console.log("Move Left");
				break;
			case "right":
				console.log("Move Right");
				break;
			case "q":
				console.log("Action Q");
				break;
			case "e":
				console.log("Action E");
				break;
			case "f":
				console.log("Action F");
				break;
			case "space":
				console.log("Space Action");
				break;
		}
	}

	// Update keyboard input handling for the new buttons

	//}
}
