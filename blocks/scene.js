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

	Blockly.Blocks['create_map'] = {
	  init: function () {
		const args0 = [];

		args0.push({
		  type: 'field_dropdown',
		  name: 'MAP_NAME',
		  options: [[getOption('FLAT'), 'NONE']].concat(mapNames()),
		});

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

		// Optional: small debounce to avoid spam during slider drags
		let debounceTimer = null;
		const run = (evt) => {
		  // 1) Promote nested shadow `material` → real so its inputs accept drops
		  const mat = this.getInputTargetBlock('MATERIAL');
		  if (mat && mat.isShadow && mat.isShadow()) {
			mat.setShadow(false);
		  }

		  // 2) If MATERIAL got cleared, respawn default shadow (MakeCode feel)
		  if (!this.getInputTargetBlock('MATERIAL')) {
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
			  </shadow>
			`);
			const conn = this.getInput('MATERIAL').connection;
			conn.setShadowDom(shadowDom);
			conn.respawnShadow_();
		  }

		  // 3) Your existing lifecycle/update pipeline
		  if (typeof handleMeshLifecycleChange === 'function') {
			if (handleMeshLifecycleChange(this, evt)) return;
		  }
		  if (typeof handleFieldOrChildChange === 'function') {
			if (handleFieldOrChildChange(this, evt)) return;
		  }
		  if (typeof updateOrCreateMeshFromBlock === 'function') {
			updateOrCreateMeshFromBlock(this, evt);
		  }
		};

		this.setOnChange((evt) => {
		  // Live update: include MOVE events (like your sky block)
		  const eventTypes = [
			Blockly.Events.BLOCK_CREATE,
			Blockly.Events.BLOCK_CHANGE,
			Blockly.Events.BLOCK_MOVE,
		  ];
		  if (!eventTypes.includes(evt.type)) return;

		  // Only react when this block (or one of its children) actually changed
		  const changedRoot = Blockly.getMainWorkspace().getBlockById(evt.blockId);
		  const parent = (typeof findCreateBlock === 'function')
			? findCreateBlock(changedRoot)
			: null;
		  if (parent !== this) return;

		  // Debounce a touch to keep things smooth during drags
		  if (debounceTimer) clearTimeout(debounceTimer);
		  debounceTimer = setTimeout(() => run(evt), 30);
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
