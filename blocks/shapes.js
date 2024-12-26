import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
	nextVariableIndexes,
	findCreateBlock,
	handleBlockCreateEvent,
	addDoMutatorWithToggleBehavior,
} from "../blocks.js";
import { updateOrCreateMeshFromBlock } from "../ui/designview.js";

export function defineShapeBlocks() {
	function createShapeBlockDefinition({
		type,
		variableNamePrefix,
		message0,
		additionalArgs0,
		tooltip,
	}) {
		Blockly.Blocks[type] = {
			init: function () {
				// Generate the next variable name based on the prefix
				let nextVariableName =
					variableNamePrefix +
					nextVariableIndexes[variableNamePrefix];

				// Common arguments for all shape blocks
				let args0 = [
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
					...additionalArgs0, // Shape-specific arguments
					{ type: "input_value", name: "X", check: "Number" },
					{ type: "input_value", name: "Y", check: "Number" },
					{ type: "input_value", name: "Z", check: "Number" },
				];

				// Initialize the block with JSON definition
				this.jsonInit({
					type: type,
					message0: message0,
					args0: args0,
					previousStatement: null,
					nextStatement: null,
					inputsInline: true,
					colour: categoryColours["Scene"],
					tooltip: tooltip,
					helpUrl: "",
				});

				// Set up an event handler to manage changes to the block
				this.setOnChange((changeEvent) =>
					handleBlockChange(this, changeEvent, variableNamePrefix),
				);

				// Add the mutator with toggle behavior
				addDoMutatorWithToggleBehavior(this);
			},
		};

		Blockly.Blocks["create_particle_effect"] = {
			init: function () {
				this.jsonInit({
					message0: `set %1 to particle effect with emitter mesh: %2 
						shape: %3 colors: start %4 end %5 alpha: %6 to %7 
						with rate: %8 size: %9 to %10 lifetime: %11 to %12 
						gravity: %13 force x: %14 y: %15 z: %16`,
					args0: [
						{
							type: "field_variable",
							name: "ID_VAR",
							variable: "particleEffect", // Default particle effect variable
						},
						{
							type: "field_variable",
							name: "EMITTER_MESH",
							variable: "meshEmitter", // Default mesh emitter variable
						},
						{
							type: "field_grid_dropdown",
							name: "SHAPE",
							options: [
								[{src: "./textures/circle_texture.png", width: 32, height: 32, alt: "Circle"}, "circle_texture.png"],
								[{src: "./textures/heart_texture.png", width: 32, height: 32, alt: "Heart"}, "heart_texture.png"],
								[{src: "./textures/star_texture.png", width: 32, height: 32, alt: "Star"}, "star_texture.png"],
								[{src: "./textures/butterfly_texture.png", width: 32, height: 32, alt: "Butterfly"}, "butterfly_texture.png"],
								[{src: "./textures/strip_texture.png", width: 32, height: 32, alt: "Strip"}, "strip_texture.png"],
								[{src: "./textures/leaf_texture.png", width: 32, height: 32, alt: "Leaf"}, "leaf_texture.png"],
								[{src: "./textures/crescent_texture.png", width: 32, height: 32, alt: "Crescent"}, "crescent_texture.png"],
								[{src: "./textures/lightning_texture.png", width: 32, height: 32, alt: "Lightning bolt"}, "lightning_texture.png"],
								[{src: "./textures/droplet_texture.png", width: 32, height: 32, alt: "Droplet"}, "droplet_texture.png"],
								[{src: "./textures/shard_texture.png", width: 32, height: 32, alt: "Shard"}, "shard_texture.png"],
								[{src: "./textures/square_texture.png", width: 32, height: 32, alt: "Square"}, "square_texture.png"]
							],
						},
						{
							type: "input_value",
							name: "START_COLOR",
							check: "Colour",
						},
						{
							type: "input_value",
							name: "END_COLOR",
							check: "Colour",
						},
						{
							type: "input_value",
							name: "START_ALPHA",
							check: "Number",
						},
						{
							type: "input_value",
							name: "END_ALPHA",
							check: "Number",
						},
						{
							type: "input_value",
							name: "RATE",
							check: "Number",
						},
						{
							type: "input_value",
							name: "MIN_SIZE",
							check: "Number",
						},
						{
							type: "input_value",
							name: "MAX_SIZE",
							check: "Number",
						},
						{
							type: "input_value",
							name: "MIN_LIFETIME",
							check: "Number",
						},
						{
							type: "input_value",
							name: "MAX_LIFETIME",
							check: "Number",
						},
						{
							type: "field_checkbox",
							name: "GRAVITY",
							checked: false,
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
						}
					],
					inputsInline: true,
					colour: categoryColours["Scene"],
					tooltip: "Create a particle effect attached to a mesh with configurable shape, gravity, size, colour, transparency, lifetime, and force.",
					helpUrl: "",
					previousStatement: null,
					nextStatement: null,
				});
			},
		};

		Blockly.Blocks["control_particle_system"] = {
		  init: function () {
			this.jsonInit({
			  type: "particle_system_control",
			  message0: "particle system %1 %2",
			  args0: [
				{
				  type: "field_variable",
				  name: "SYSTEM_NAME",
				  variable: "particles1",
				},
				{
				  type: "field_dropdown",
				  name: "ACTION",
				  options: [
					["▶️ Start", "start"],
					["⏹️ Stop", "stop"],
					["🔄 Reset", "reset"],
				  ],
				},
			  ],
			  inputsInline: true,
			  previousStatement: null,
			  nextStatement: null,
			  colour: categoryColours["Scene"],
			  tooltip:
				"Controls the particle system by starting, stopping, or resetting it.",
			  helpUrl: "",
			});
		  },
		};

		
	}

	// Extracted common change handler
	function handleBlockChange(block, changeEvent, variableNamePrefix) {

		
		if (
			(changeEvent.type === Blockly.Events.BLOCK_CREATE ||
				changeEvent.type === Blockly.Events.BLOCK_CHANGE) &&
			changeEvent.workspaceId === Blockly.getMainWorkspace().id
		) {
			
			// Update the mesh or create a new one if necessary
			const parent = findCreateBlock(
				Blockly.getMainWorkspace().getBlockById(changeEvent.blockId),
			);

			if (parent === block) {

				const blockInWorkspace =
					Blockly.getMainWorkspace().getBlockById(block.id);
				if (blockInWorkspace) {
					
		updateOrCreateMeshFromBlock(block, changeEvent);
				}
			}

			handleBlockCreateEvent(
				block,
				changeEvent,
				variableNamePrefix,
				nextVariableIndexes,
			);
		}
	}

	// Define all shape blocks with a shared function
	const shapes = [
		{
			type: "create_box",
			variableNamePrefix: "box",
			message0:
				"set %1 to box %2 width %3 height %4 depth %5 \nat x %6 y %7 z %8",
			additionalArgs0: [
				{ type: "input_value", name: "WIDTH", check: "Number" },
				{ type: "input_value", name: "HEIGHT", check: "Number" },
				{ type: "input_value", name: "DEPTH", check: "Number" },
			],
			tooltip:
				"Creates a colored box with specified dimensions and position.\nKeyword: box",
		},
		{
			type: "create_sphere",
			variableNamePrefix: "sphere",
			message0:
				"set %1 to sphere %2 diameter x %3 diameter y %4 diameter z %5\nat x %6 y %7 z %8",
			additionalArgs0: [
				{ type: "input_value", name: "DIAMETER_X", check: "Number" },
				{ type: "input_value", name: "DIAMETER_Y", check: "Number" },
				{ type: "input_value", name: "DIAMETER_Z", check: "Number" },
			],
			tooltip:
				"Creates a colored sphere with specified dimensions and position.\nKeyword: sphere",
		},
		{
			type: "create_cylinder",
			variableNamePrefix: "cylinder",
			message0:
				"set %1 to cylinder %2 height %3 top %4 bottom %5 sides %6\nat x %7 y %8 z %9",
			additionalArgs0: [
				{ type: "input_value", name: "HEIGHT", check: "Number" },
				{ type: "input_value", name: "DIAMETER_TOP", check: "Number" },
				{
					type: "input_value",
					name: "DIAMETER_BOTTOM",
					check: "Number",
				},
				  { type: "input_value", name: "TESSELLATIONS", check: "Number" },
			],
			tooltip:
				"Creates a colored cylinder with specified dimensions and position.\nKeyword: cylinder",
		},
		{
			type: "create_capsule",
			variableNamePrefix: "capsule",
			message0:
				"set %1 to capsule %2 radius %3 height %4 \nat x %5 y %6 z %7",
			additionalArgs0: [
				{ type: "input_value", name: "RADIUS", check: "Number" },
				{ type: "input_value", name: "HEIGHT", check: "Number" },
			],
			tooltip:
				"Creates a colored capsule with specified dimensions and position.\nKeyword: capsule",
		},
		{
			type: "create_plane",
			variableNamePrefix: "plane",
			message0:
				"set %1 to plane %2 width %3 height %4 \nat x %5 y %6 z %7",
			additionalArgs0: [
				{ type: "input_value", name: "WIDTH", check: "Number" },
				{ type: "input_value", name: "HEIGHT", check: "Number" },
			],
			tooltip:
				"Creates a colored 2D plane with specified width, height, and position.\nKeyword: plane",
		},
	];

	// Register shape blocks using the common definition
	shapes.forEach((shape) => createShapeBlockDefinition(shape));
}
