import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
  nextVariableIndexes,
  findCreateBlock,
  handleBlockCreateEvent,
  handleMeshLifecycleChange,
  handleFieldOrChildChange,
  addDoMutatorWithToggleBehavior,
  getHelpUrlFor,
  getDropdownOption,
} from "../blocks.js";
import {
  deleteMeshFromBlock,
  updateOrCreateMeshFromBlock,
  getMeshFromBlock,
} from "../ui/blockmesh.js";
import { translate, getTooltip } from "../main/translation.js";

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
				// Create a unique group id for creation and record it on the block.
				const groupId = Blockly.utils.idGenerator.genUid();
				Blockly.Events.setGroup(groupId);
				this._creationGroup = groupId;
				this._creationTime = Date.now();
				try {
					// Generate the next variable name based on the prefix.
					let nextVariableName =
						variableNamePrefix +
						nextVariableIndexes[variableNamePrefix];
					// Build the JSON args for the block.
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
							//check: ["Colour", "Array"], // FUTURE
						},
						...additionalArgs0,
						{ type: "input_value", name: "X", check: "Number" },
						{ type: "input_value", name: "Y", check: "Number" },
						{ type: "input_value", name: "Z", check: "Number" },
					];
					// Initialise the block via jsonInit.
					this.jsonInit({
						type: type,
						message0: message0,
						args0: args0,
						previousStatement: null,
						nextStatement: null,
						inputsInline: true,
						colour: categoryColours["Scene"],
						tooltip: tooltip,
					});
					this.setHelpUrl(getHelpUrlFor(this.type));
					// Set up the change handler.
					this.setOnChange((changeEvent) =>
						handleBlockChange(
							this,
							changeEvent,
							variableNamePrefix,
						),
					);
					// Add the mutator with toggle behaviour.
					addDoMutatorWithToggleBehavior(this);
				} finally {
					Blockly.Events.setGroup(null);
				}
			},
		};
	}

	function handleBlockChange(block, changeEvent, variableNamePrefix) {
	  // Always run first to handle variable naming
	  handleBlockCreateEvent(
		block,
		changeEvent,
		variableNamePrefix,
		nextVariableIndexes
	  );

	  // Handle lifecycle events like enable/disable/move on the block directly
	  if (changeEvent.blockId === block.id) {
		if (handleMeshLifecycleChange(block, changeEvent)) return;
	  }

	  // Handle field changes on self or attached unchainable children
	  if (handleFieldOrChildChange(block, changeEvent)) return;

	  // Handle BLOCK_CREATE or BLOCK_CHANGE if a child is attached
	  if (
		(changeEvent.type === Blockly.Events.BLOCK_CREATE ||
		  changeEvent.type === Blockly.Events.BLOCK_CHANGE) &&
		changeEvent.workspaceId === Blockly.getMainWorkspace().id
	  ) {
		const changedBlock = Blockly.getMainWorkspace().getBlockById(changeEvent.blockId);
		const parent = findCreateBlock(changedBlock);

		if (parent === block) {
		  const blockInWorkspace = Blockly.getMainWorkspace().getBlockById(block.id);
		  if (blockInWorkspace) {
			updateOrCreateMeshFromBlock(block, changeEvent);
		  }
		}
	  }
	}


	// Define the particle effect block.
	Blockly.Blocks["create_particle_effect"] = {
		init: function () {
			this.jsonInit({
				message0: translate("create_particle_effect"),
				args0: [
					{
						type: "field_variable",
						name: "ID_VAR",
						variable: "particleEffect",
					},
					{
						type: "field_variable",
						name: "EMITTER_MESH",
						variable: window.currentMesh,
					},
					{
						type: "field_grid_dropdown",
						name: "SHAPE",
						options: [
							[
								{
									src: "./textures/circle_texture.png",
									width: 32,
									height: 32,
									alt: "Circle",
								},
								"circle_texture.png",
							],
							[
								{
									src: "./textures/heart_texture.png",
									width: 32,
									height: 32,
									alt: "Heart",
								},
								"heart_texture.png",
							],
							[
								{
									src: "./textures/splat_texture.png",
									width: 32,
									height: 32,
									alt: "Splat",
								},
								"splat_texture.png",
							],
							[
								{
									src: "./textures/star_texture.png",
									width: 32,
									height: 32,
									alt: "Star",
								},
								"star_texture.png",
							],
							[
								{
									src: "./textures/butterfly_texture.png",
									width: 32,
									height: 32,
									alt: "Butterfly",
								},
								"butterfly_texture.png",
							],
							[
								{
									src: "./textures/flower_texture.png",
									width: 32,
									height: 32,
									alt: "Flower",
								},
								"flower_texture.png",
							],
							[
								{
									src: "./textures/music_texture.png",
									width: 32,
									height: 32,
									alt: "Music",
								},
								"music_texture.png",
							],
							[
								{
									src: "./textures/flame_texture.png",
									width: 32,
									height: 32,
									alt: "Flame",
								},
								"flame_texture.png",
							],
							[
								{
									src: "./textures/ripple_texture.png",
									width: 32,
									height: 32,
									alt: "Ripple",
								},
								"ripple_texture.png",
							],
							[
								{
									src: "./textures/smoke_texture.png",
									width: 32,
									height: 32,
									alt: "Smoke",
								},
								"smoke_texture.png",
							],
							[
								{
									src: "./textures/snowflake_texture.png",
									width: 32,
									height: 32,
									alt: "Snowflake",
								},
								"snowflake_texture.png",
							],
							[
								{
									src: "./textures/wind_texture.png",
									width: 32,
									height: 32,
									alt: "Wind",
								},
								"wind_texture.png",
							],
							[
								{
									src: "./textures/strip_texture.png",
									width: 32,
									height: 32,
									alt: "Strip",
								},
								"strip_texture.png",
							],
							[
								{
									src: "./textures/leaf_texture.png",
									width: 32,
									height: 32,
									alt: "Leaf",
								},
								"leaf_texture.png",
							],
							[
								{
									src: "./textures/crescent_texture.png",
									width: 32,
									height: 32,
									alt: "Crescent",
								},
								"crescent_texture.png",
							],
							[
								{
									src: "./textures/lightning_texture.png",
									width: 32,
									height: 32,
									alt: "Lightning bolt",
								},
								"lightning_texture.png",
							],
							[
								{
									src: "./textures/droplet_texture.png",
									width: 32,
									height: 32,
									alt: "Droplet",
								},
								"droplet_texture.png",
							],
							[
								{
									src: "./textures/shard_texture.png",
									width: 32,
									height: 32,
									alt: "Shard",
								},
								"shard_texture.png",
							],
							[
								{
									src: "./textures/square_texture.png",
									width: 32,
									height: 32,
									alt: "Square",
								},
								"square_texture.png",
							],
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
					},
					{
						type: "input_value",
						name: "MIN_ANGULAR_SPEED",
						check: "Number",
					},
					{
						type: "input_value",
						name: "MAX_ANGULAR_SPEED",
						check: "Number",
					},
					{
						type: "input_value",
						name: "MIN_INITIAL_ROTATION",
						check: "Number",
					},
					{
						type: "input_value",
						name: "MAX_INITIAL_ROTATION",
						check: "Number",
					},
				],
				inputsInline: true,
				colour: categoryColours["Scene"],
				tooltip: getTooltip("create_particle_effect"),
				previousStatement: null,
				nextStatement: null,
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["control_particle_system"] = {
		init: function () {
			this.jsonInit({
				type: "particle_system_control",
				message0: translate("control_particle_system"),
				args0: [
					{
						type: "field_variable",
						name: "SYSTEM_NAME",
						variable: window.currentMesh,
					},
					{
						type: "field_dropdown",
						name: "ACTION",
						options: [
							getDropdownOption("start"),
							getDropdownOption("stop"),
							getDropdownOption("reset"),
						],
					},
				],
				inputsInline: true,
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Scene"],
				tooltip: getTooltip("control_particle_system"),
				helpUrl: "",
			});
		this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	const shapes = [
		{
			type: "create_box",
			variableNamePrefix: "box",
			message0: translate("create_box"),
			additionalArgs0: [
				{ type: "input_value", name: "WIDTH", check: "Number" },
				{ type: "input_value", name: "HEIGHT", check: "Number" },
				{ type: "input_value", name: "DEPTH", check: "Number" },
			],
			tooltip: getTooltip("create_box"),
		},
		{
			type: "create_sphere",
			variableNamePrefix: "sphere",
			message0: translate("create_sphere"),
			additionalArgs0: [
				{ type: "input_value", name: "DIAMETER_X", check: "Number" },
				{ type: "input_value", name: "DIAMETER_Y", check: "Number" },
				{ type: "input_value", name: "DIAMETER_Z", check: "Number" },
			],
			tooltip: getTooltip("create_sphere"),
		},
		{
			type: "create_cylinder",
			variableNamePrefix: "cylinder",
			message0: translate("create_cylinder"),
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
			tooltip: getTooltip("create_cylinder"),
		},
		{
			type: "create_capsule",
			variableNamePrefix: "capsule",
			message0: translate("create_capsule"),
			additionalArgs0: [
				{ type: "input_value", name: "DIAMETER", check: "Number" },
				{ type: "input_value", name: "HEIGHT", check: "Number" },
			],
			tooltip: getTooltip("create_capsule"),
		},
		{
			type: "create_plane",
			variableNamePrefix: "plane",
			message0: translate("create_plane"),
			additionalArgs0: [
				{ type: "input_value", name: "WIDTH", check: "Number" },
				{ type: "input_value", name: "HEIGHT", check: "Number" },
			],
			tooltip: getTooltip("create_plane"),
		},
	];

	shapes.forEach((shape) => createShapeBlockDefinition(shape));
}

