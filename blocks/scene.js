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
} from "../blocks.js";
import { mapNames } from "../config.js";
import { updateOrCreateMeshFromBlock } from "../ui/blockmesh.js";
import {
	translate,
	getTooltip,
	getOption,
	getDropdownOption,
} from "../main/translation.js";
import { flock } from "../flock.js";

function createSceneColorBlock(config) {
	return {
		init: function () {
			const args0 = [];
			
			if (config.hasDropdown) {
				args0.push({
					type: "field_dropdown",
					name: "MAP_NAME",
					options: [[getOption("FLAT"), "NONE"]].concat(mapNames()),
				});
			}
			
			args0.push({
				type: "input_value",
				name: config.inputName || "COLOR",
				colour: config.inputColor,
				check: ["Colour", "Array", "Material"],
			});

			this.jsonInit({
				type: config.type,
				message0: translate(config.type),
				args0: args0,
				previousStatement: null,
				nextStatement: null,
				inputsInline: true,
				colour: categoryColours["Scene"],
				tooltip: getTooltip(config.type),
			});
			
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("scene_blocks");
			
			this.setOnChange((changeEvent) => {
				if (flock.eventDebug && config.debugEvents) {
					console.log(changeEvent.type);
				}
				
				const eventTypes = config.listenToMove
					? [Blockly.Events.BLOCK_CREATE, Blockly.Events.BLOCK_CHANGE, Blockly.Events.BLOCK_MOVE]
					: [Blockly.Events.BLOCK_CREATE, Blockly.Events.BLOCK_CHANGE];
				
				if (eventTypes.includes(changeEvent.type)) {
					const parent = findCreateBlock(
						Blockly.getMainWorkspace().getBlockById(changeEvent.blockId)
					);
					
					if (parent === this) {
						const blockInWorkspace = Blockly.getMainWorkspace().getBlockById(this.id);
						
						if (blockInWorkspace) {
							if (config.useMeshLifecycle) {
								if (handleMeshLifecycleChange(this, changeEvent)) return;
								if (handleFieldOrChildChange(this, changeEvent)) return;
							} else {
								updateOrCreateMeshFromBlock(this, changeEvent);
							}
						}
					}
				}
			});
		},
	};
}

export function defineSceneBlocks() {
	Blockly.Blocks["set_sky_color"] = createSceneColorBlock({
		type: "set_sky_color",
		inputColor: "#6495ED",
		debugEvents: true,
		listenToMove: true,
	});

	Blockly.Blocks["create_ground"] = createSceneColorBlock({
		type: "create_ground",
		inputColor: "#71BC78",
	});

	Blockly.Blocks["set_background_color"] = createSceneColorBlock({
		type: "set_background_color",
		inputColor: "#6495ED",
	});

	// Standalone block definition for create_map
	Blockly.Blocks['create_map'] = {
	  init: function () {
		// Build args0 to keep the same UX (dropdown + a value input for MATERIAL)
		const args0 = [];

		// Dropdown for map name (kept for parity with your original)
		args0.push({
		  type: 'field_dropdown',
		  name: 'MAP_NAME',
		  options: [[getOption('FLAT'), 'NONE']].concat(mapNames()),
		});

		// Value input for MATERIAL. Accept both material AND array (and colour),
		// plus optional union/custom types used elsewhere in your workspace.
		args0.push({
		  type: 'input_value',
		  name: 'MATERIAL',
		  check: ['Material', 'Array', 'Colour', 'material_like', 'colour_array'],
		});

		this.jsonInit({
		  type: 'create_map',
		  message0: translate('create_map'),
		  args0,
		  previousStatement: null,
		  nextStatement: null,
		  inputsInline: true,
		  colour: categoryColours['Scene'],
		  tooltip: getTooltip('create_map'),
		});

		this.setHelpUrl(getHelpUrlFor(this.type));
		this.setStyle('scene_blocks');

		// Event handling preserved; works with your lifecycle helpers if present.
		this.setOnChange((changeEvent) => {
		  // Respect your debug flag if it exists
		  if (typeof flock !== 'undefined' && flock.eventDebug && this.debugEvents) {
			console.log(changeEvent.type);
		  }

			this.setOnChange(function (event) {
			  if (event.type === Blockly.Events.BLOCK_MOVE ||
				  event.type === Blockly.Events.BLOCK_CHANGE) {

				const mat = this.getInputTargetBlock('MATERIAL');
				if (mat && mat.isShadow && mat.isShadow()) {
				  mat.setShadow(false); // promote shadow material to real
				}

				// Optional: if MATERIAL becomes empty, re-insert the default shadow XML
				if (!this.getInputTargetBlock('MATERIAL')) {
				  const ws = this.workspace;
				  const shadowDom = Blockly.utils.xml.textToDom(`
					<shadow type="material">
					  <value name="BASE_COLOR">
						<shadow type="colour">
						  <field name="COLOR">#71BC78</field>
						</shadow>
					  </value>
					  <value name="ALPHA">
						<shadow type="math_number">
						  <field name="NUM">1.0</field>
						</shadow>
					  </value>
					</shadow>`);
				  this.getInput('MATERIAL').connection.setShadowDom(shadowDom);
				  this.getInput('MATERIAL').connection.respawnShadow_();
				}
			  }
			});

		  // Same event filtering as before (no move-listening by default)
		  const eventTypes = [Blockly.Events.BLOCK_CREATE, Blockly.Events.BLOCK_CHANGE];

		  if (!eventTypes.includes(changeEvent.type)) return;

		  // Ensure we only react when this block (or its fields/children) actually changed
		  const root = Blockly.getMainWorkspace().getBlockById(changeEvent.blockId);
		  const parent = root && typeof findCreateBlock === 'function'
			? findCreateBlock(root)
			: null;

		  if (parent !== this) return;

		  const blockInWorkspace = Blockly.getMainWorkspace().getBlockById(this.id);
		  if (!blockInWorkspace) return;

		  // Prefer your mesh lifecycle flow if available
		  if (typeof handleMeshLifecycleChange === 'function') {
			if (handleMeshLifecycleChange(this, changeEvent)) return;
		  }
		  if (typeof handleFieldOrChildChange === 'function') {
			if (handleFieldOrChildChange(this, changeEvent)) return;
		  }

		  // Fallback to your updater if lifecycle handlers are not used
		  if (typeof updateOrCreateMeshFromBlock === 'function') {
			updateOrCreateMeshFromBlock(this, changeEvent);
		  }
		});
	  }
	};


	Blockly.Blocks["show"] = {
		init: function () {
			this.jsonInit({
				type: "show",
				message0: translate("show"),
				args0: [
					{
						type: "field_variable",
						name: "MODEL_VAR",
						variable: window.currentMesh,
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Scene"],
				tooltip: getTooltip("show"),
			});

			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("scene_blocks");
		},
	};

	Blockly.Blocks["hide"] = {
		init: function () {
			this.jsonInit({
				type: "hide",
				message0: translate("hide"),
				args0: [
					{
						type: "field_variable",
						name: "MODEL_VAR",
						variable: window.currentMesh,
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Scene"],
				tooltip: getTooltip("hide"),
			});

			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("scene_blocks");
		},
	};

	Blockly.Blocks["dispose"] = {
		init: function () {
			this.jsonInit({
				type: "dispose",
				message0: translate("dispose"),
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
				colour: categoryColours["Scene"],
				tooltip: getTooltip("dispose"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("scene_blocks");
		},
	};

	Blockly.Blocks["clone_mesh"] = {
		init: function () {
			const variableNamePrefix = "clone";
			let nextVariableName =
				variableNamePrefix + nextVariableIndexes[variableNamePrefix];

			this.jsonInit({
				message0: translate("clone_mesh"),
				args0: [
					{
						type: "field_variable",
						name: "CLONE_VAR",
						variable: nextVariableName,
					},
					{
						type: "field_variable",
						name: "SOURCE_MESH",
						variable: window.currentMesh,
					},
				],
				inputsInline: true,
				colour: categoryColours["Scene"],
				tooltip: getTooltip("clone_mesh"),
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

			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("scene_blocks");
			addDoMutatorWithToggleBehavior(this);
		},
	};
}
