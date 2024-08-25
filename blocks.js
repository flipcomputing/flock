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

const options = {
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

export const workspace = Blockly.inject("blocklyDiv", options);

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
	};

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
export function defineBlocks() {
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
				tooltip:
					"Glide to a specified position over a duration\nKeyword: glide",
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
				tooltip: "Load a model.\nKeyword: model",
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
					"Creates a colored box with specified dimensions and position.\nKeyword: box",
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
					"Creates a colored sphere with specified dimensions and position.\nKeyword: sphere",
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
					"Creates a colored cylinder with specified dimensions and position.\nKeyword: cylinder",
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
					"Creates a colored capsule with specified dimensions and position.\nKeyword: capsule",
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
				handleBlockCreateEvent(
					this,
					changeEvent,
					variableNamePrefix,
					nextVariableIndexes,
				);
			});
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
							 ["floor/roof", "FLOOR"]
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
					"Changes the animation of the specified model to the given animation.\nKeyword: switch",
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
						variable: "mesh",
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
					"Moves a mesh a given amount in x y and z directions.\nKeyword: move",
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
				tooltip:
					"Resizes a mesh to the given x, y and z.\nKeyword: scale",
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
					"Rotates the model based on its current rotation plus additional x, y, z values.\nKeyword: rotate",
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
					"Executes the blocks inside when the mesh intersects or no longer intersects with another mesh.\nKeyword: touches",
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
				message1: "do %1",
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
				message1: "do %1",
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
				message1: "do %1",
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
						variable: "mesh",
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
						variable: "mesh",
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
					"Apply a selected material with a colour tint to the specified object.\nKeyword: material",
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
						variable: "mesh",
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
					"Makes the camera follow a model specified by the variable.\nKeyword: follow",
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
				tooltip:
					"Moves the model forward in the direction it's pointing.\nKeyword: forward",
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
						variable: "mesh",
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
				const shadowBlock = workspace.newBlock(input.shadow.type);
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

				workspace.cleanUp();
			}
		}
	}
}
