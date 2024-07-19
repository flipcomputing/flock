// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limited - flipcomputing.com

import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";
import { registerFieldColour } from "@blockly/field-colour";
import * as BABYLON from "@babylonjs/core";
import * as BABYLON_GUI from "@babylonjs/gui";
import HavokPhysics from "@babylonjs/havok";
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";

window.BABYLON = BABYLON;
window.GUI = BABYLON_GUI;

registerFieldColour();

const categoryColours = {
	Scene: 100,
	Motion: 240,
	Looks: 300,
	Control: "%{BKY_LOOPS_HUE}",
	Logic: "%{BKY_LOGIC_HUE}",
	Variables: "%{BKY_VARIABLES_HUE}",
	Text: "%{BKY_TEXTS_HUE}",
	Lists: "%{BKY_LISTS_HUE}",
	Math: "%{BKY_MATH_HUE}",
	Procedures: "%{BKY_PROCEDURES_HUE}",
};

const canvas = document.getElementById("renderCanvas");
window.canvas = canvas;
const engine = new BABYLON.Engine(canvas, true, { stencil: true });
engine.enableOfflineSupport = true;
let hk = null;
window.scene = null;
let havokInstance = null;
let engineReady = false;
let gizmoManager = null;

const toolbox = {
	kind: "categoryToolbox",
	contents: [
		{
			kind: "category",
			name: "Flock 🐑🐑🐑",
			contents: [],
		},
		{
			kind: "category",
			name: "Scene",
			colour: categoryColours["Scene"],
			contents: [
				{
					kind: "block",
					type: "set_sky_color",
				},
				{
					kind: "block",
					type: "create_ground",
				},
				{
					kind: "block",
					type: "set_fog",
					inputs: {
						DENSITY: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0.1,
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "load_model",
					inputs: {
						SCALE: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
						X: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						Y: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						Z: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "create_box",
					fields: {
						COLOR: "#9932CC",
					},
					inputs: {
						WIDTH: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
						HEIGHT: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
						DEPTH: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
						X: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						Y: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0.5,
								},
							},
						},
						Z: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "create_sphere",
					fields: {
						COLOR: "#9932CC",
					},
					inputs: {
						DIAMETER_X: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
						DIAMETER_Y: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
						DIAMETER_Z: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
						X: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						Y: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0.5,
								},
							},
						},
						Z: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "create_plane",
					fields: {
						COLOR: "#9932CC",
					},
					inputs: {
						WIDTH: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 2,
								},
							},
						},
						HEIGHT: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 2,
								},
							},
						},
						X: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						Y: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
						Z: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "set_background_color",
				},
			],
		},
		{
			kind: "category",
			name: "Motion",
			colour: categoryColours["Motion"],
			contents: [
				{
					kind: "block",
					type: "move_by_vector",
					inputs: {
						X: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
						Y: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						Z: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "rotate_model_xyz",
					inputs: {
						X: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						Y: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 45,
								},
							},
						},
						Z: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "glide_to",
					inputs: {
						X: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						Y: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						Z: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						DURATION: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1000,
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "move_forward",
					inputs: {
						SPEED: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 3,
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "camera_follow",
				},
				{
					kind: "block",
					type: "add_physics",
				},
			],
		},
		{
			kind: "category",
			name: "Looks",
			colour: categoryColours["Looks"],
			contents: [
				{
					kind: "block",
					type: "show",
				},
				{
					kind: "block",
					type: "hide",
				},
				{
					kind: "block",
					type: "tint",
					fields: {
						COLOR: "#AA336A",
					},
				},
				{
					kind: "block",
					type: "highlight",
					fields: {
						COLOR: "#FFD700",
					},
				},
				{
					kind: "block",
					type: "set_alpha",
					inputs: {
						ALPHA: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0.5,
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "clear_effects",
				},
				{
					kind: "block",
					type: "switch_animation",
				},
				{
					kind: "block",
					type: "play_animation",
				},
			],
		},
		{
			kind: "category",
			name: "Sound",
			colour: "#D65C00",
			contents: [
				{
					kind: "block",
					type: "play_sound",
					inputs: {
						SPEED: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
						VOLUME: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "stop_all_sounds",
				},
			],
		},
		{
			kind: "category",
			name: "Control",
			colour: categoryColours["Control"],
			contents: [
				{
					kind: "block",
					type: "start",
				},
				{
					kind: "block",
					type: "on_each_update",
				},
				{
					kind: "block",
					type: "wait",
				},
				{
					kind: "block",
					type: "controls_repeat_ext",
					inputs: {
						TIMES: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 10,
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "controls_whileUntil",
				},
				{
					kind: "block",
					type: "controls_forEach",
				},
				{
					kind: "block",
					type: "controls_for",
				},
			],
		},
		{
			kind: "category",
			name: "Events",
			colour: "#FFBF00",
			contents: [
				{
					kind: "block",
					type: "when_clicked",
				},
				{
					kind: "block",
					type: "when_key_pressed",
				},
				{
					kind: "block",
					type: "when_key_released",
				},
				{
					kind: "block",
					type: "broadcast_event",
				},
				{
					kind: "block",
					type: "on_event",
				},
			],
		},
		{
			kind: "category",
			name: "Condition",
			colour: categoryColours["Logic"],
			contents: [
				{
					kind: "block",
					type: "controls_if",
				},
				{
					kind: "block",
					type: "controls_ifelse",
				},
				{
					kind: "block",
					type: "logic_compare",
				},
				{
					kind: "block",
					type: "logic_operation",
				},
				{
					kind: "block",
					type: "logic_negate",
				},
				{
					kind: "block",
					type: "logic_boolean",
				},
				{
					kind: "block",
					type: "logic_null",
				},
				{
					kind: "block",
					type: "logic_ternary",
				},
			],
		},
		{
			kind: "category",
			name: "Text",
			categorystyle: "text_category",
			contents: [
				{
					kind: "block",
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
					},
				},
				{
					kind: "block",
					type: "say",
					inputs: {
						TEXT: {
							shadow: {
								type: "text",
								fields: {
									TEXT: "Hello",
								},
							},
						},
						DURATION: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 3,
								},
							},
						},
						ALPHA: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
						SIZE: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 12,
								},
							},
						},
					},
					fields: {
						TEXT_COLOR: "#000000",
						BACKGROUND_COLOR: "#ffffff",
						MODE: "ADD",
					},
				},
				{
					kind: "block",
					type: "text",
				},
				{
					kind: "block",
					type: "text_print",
					inputs: {
						TEXT: {
							shadow: {
								type: "text",
								fields: {
									TEXT: "Something happened!",
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "text_join",
				},
				{
					kind: "block",
					type: "text_append",
					inputs: {
						TEXT: {
							shadow: {
								type: "text",
							},
						},
					},
				},
				{
					kind: "block",
					type: "text_length",
					inputs: {
						VALUE: {
							shadow: {
								type: "text",
								fields: {
									TEXT: "abc",
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "text_isEmpty",
					inputs: {
						VALUE: {
							shadow: {
								type: "text",
								fields: {
									TEXT: "",
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "text_indexOf",
					inputs: {
						VALUE: {
							block: {
								type: "variables_get",
								fields: {
									VAR: "text",
								},
							},
						},
						FIND: {
							shadow: {
								type: "text",
								fields: {
									TEXT: "abc",
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "text_charAt",
					inputs: {
						VALUE: {
							block: {
								type: "variables_get",
								fields: {
									VAR: "text",
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "text_getSubstring",
					inputs: {
						STRING: {
							block: {
								type: "variables_get",
								fields: {
									VAR: "text",
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "text_changeCase",
					inputs: {
						TEXT: {
							shadow: {
								type: "text",
								fields: {
									TEXT: "abc",
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "text_trim",
					inputs: {
						TEXT: {
							shadow: {
								type: "text",
								fields: {
									TEXT: "abc",
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "text_count",
					inputs: {
						SUB: {
							shadow: {
								type: "text",
							},
						},
						TEXT: {
							shadow: {
								type: "text",
							},
						},
					},
				},
				{
					kind: "block",
					type: "text_replace",
					inputs: {
						FROM: {
							shadow: {
								type: "text",
							},
						},
						TO: {
							shadow: {
								type: "text",
							},
						},
						TEXT: {
							shadow: {
								type: "text",
							},
						},
					},
				},
				{
					kind: "block",
					type: "text_reverse",
					inputs: {
						TEXT: {
							shadow: {
								type: "text",
							},
						},
					},
				},
				{
					kind: "label",
					text: "Input/Output:",
					"web-class": "ioLabel",
				},
				{
					kind: "block",
					type: "text_prompt_ext",
					inputs: {
						TEXT: {
							shadow: {
								type: "text",
								fields: {
									TEXT: "abc",
								},
							},
						},
					},
				},
			],
		},
		{
			kind: "category",
			name: "Variables",
			colour: categoryColours["Variables"],
			custom: "VARIABLE",
			contents: [
				{
					kind: "block",
					type: "log_variable",
				},
			],
		},
		{
			kind: "category",
			name: "Sensing",
			colour: "#ADD8E6",
			contents: [
				{
					kind: "block",
					type: "key_pressed",
				},
				{
					kind: "block",
					type: "meshes_touching",
				},
			],
		},
		{
			kind: "category",
			name: "Lists",
			colour: categoryColours["Lists"],
			contents: [
				{
					kind: "block",
					type: "lists_create_empty",
				},
				{
					kind: "block",
					type: "lists_create_with",
				},
				{
					kind: "block",
					type: "lists_repeat",
				},
				{
					kind: "block",
					type: "lists_length",
				},
				{
					kind: "block",
					type: "lists_isEmpty",
				},
				{
					kind: "block",
					type: "lists_indexOf",
				},
				{
					kind: "block",
					type: "lists_getIndex",
				},
				{
					kind: "block",
					type: "lists_setIndex",
				},
				{
					kind: "block",
					type: "lists_getSublist",
				},
				{
					kind: "block",
					type: "lists_split",
				},
				{
					kind: "block",
					type: "lists_sort",
				},
			],
		},
		{
			kind: "category",
			name: "Math",
			colour: categoryColours["Math"],
			contents: [
				{
					kind: "block",
					type: "math_arithmetic",
					fields: {
						OP: "ADD",
					},
					inputs: {
						A: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
						B: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "math_random_int",
					inputs: {
						FROM: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
						TO: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 100,
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "math_number",
					fields: {
						NUM: 0,
					},
				},
				{
					kind: "block",
					type: "math_constant",
				},
				{
					kind: "block",
					type: "math_number_property",
				},
				{
					kind: "block",
					type: "math_round",
				},
				{
					kind: "block",
					type: "math_on_list",
				},
				{
					kind: "block",
					type: "math_modulo",
				},
				{
					kind: "block",
					type: "math_constrain",
					inputs: {
						LOW: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
						HIGH: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 100,
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "math_random_float",
				},
			],
		},
		{
			kind: "category",
			name: "Functions",
			custom: "PROCEDURE",
			colour: "%{BKY_PROCEDURES_HUE}",
		},
		{
			kind: "category",
			name: "Snippets",
			contents: [
				{
					type: "start",
					kind: "block",
					inputs: {
						DO: {
							block: {
								type: "load_model",
								kind: "block",
								fields: {
									MODELS: "Character_Female_1.gltf",
									ID_VAR: {
										name: "player",
									},
								},
								inputs: {
									SCALE: {
										shadow: {
											type: "math_number",
											fields: {
												NUM: 1,
											},
										},
									},
									X: {
										shadow: {
											type: "math_number",
											fields: {
												NUM: 0,
											},
										},
									},
									Y: {
										shadow: {
											type: "math_number",
											fields: {
												NUM: 0,
											},
										},
									},
									Z: {
										shadow: {
											type: "math_number",
											fields: {
												NUM: 0,
											},
										},
									},
								},
								next: {
									block: {
										type: "add_physics",
										fields: {
											MODEL_VAR: {
												name: "player",
											},
											PHYSICS_TYPE: "ANIMATED",
										},
										next: {
											block: {
												type: "camera_follow",
												fields: {
													MESH_VAR: {
														name: "player",
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
				{
					kind: "block",
					type: "on_each_update",
					inputs: {
						DO: {
							block: {
								type: "controls_if",
								extraState: {
									elseIfCount: 1,
									hasElse: true,
								},
								inputs: {
									IF0: {
										block: {
											type: "key_pressed",
											fields: {
												KEY: "KeyW",
											},
										},
									},
									DO0: {
										block: {
											type: "move_forward",
											fields: {
												MODEL: {
													name: "player",
												},
											},
											inputs: {
												SPEED: {
													shadow: {
														type: "math_number",
														fields: {
															NUM: 3,
														},
													},
												},
											},
											next: {
												block: {
													type: "switch_animation",
													fields: {
														MODEL: {
															name: "player",
														},
														ANIMATION_NAME: "Walk",
													},
												},
											},
										},
									},
									IF1: {
										block: {
											type: "key_pressed",
											fields: {
												KEY: "KeyS",
											},
										},
									},
									DO1: {
										block: {
											type: "move_forward",
											fields: {
												MODEL: {
													name: "player",
												},
											},
											inputs: {
												SPEED: {
													shadow: {
														type: "math_number",
														fields: {
															NUM: -3,
														},
													},
												},
											},
											next: {
												block: {
													type: "switch_animation",
													fields: {
														MODEL: {
															name: "player",
														},
														ANIMATION_NAME: "Walk",
													},
												},
											},
										},
									},
									ELSE: {
										block: {
											type: "switch_animation",
											fields: {
												MODEL: {
													name: "player",
												},
												ANIMATION_NAME: "Idle",
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
	],
};

const workspace = Blockly.inject("blocklyDiv", {
	theme: Blockly.Themes.Modern,
	renderer: "zelos",
	zoom: {
		controls: true,
		wheel: true,
		startScale: 0.8,
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

const modelNames = [
	"Character_Female_1.gltf",
	"Character_Female_2.gltf",
	"Character_Male_1.gltf",
	"Character_Male_2.gltf",
	"Gem Pink.glb",
	"tree_fat.glb",
	"tree_fat_fall.glb",
	"tree_fat_darkh.glb",
];

console.log("Welcome to Flock 🐑🐑🐑");

workspace.addChangeListener(function (event) {
	if (event.type === Blockly.Events.FINISHED_LOADING) {
		initializeVariableIndexes();
	}
});

Blockly.Blocks["start"] = {
	init: function () {
		this.jsonInit({
			type: "start",
			message0: "script %1",
			args0: [
				{
					type: "input_statement",
					name: "DO",
				},
			],
			nextStatement: null,
			colour: categoryColours["Control"],
			tooltip: "Run the attached block when the project starts.",
			style: {
				hat: "cap",
			},
		});
	},
};

Blockly.Blocks["create_ground"] = {
	init: function () {
		this.jsonInit({
			type: "create_ground",
			message0: "add ground with color %1",
			args0: [
				{
					type: "field_colour",
					name: "COLOR",
					colour: "#71BC78",
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
			message0: "set sky color %1",
			args0: [
				{
					type: "field_colour",
					name: "COLOR",
					colour: "#6495ED", // Default sky color
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

Blockly.Blocks["set_fog"] = {
	init: function () {
		this.jsonInit({
			type: "set_fog",
			message0: "set fog color %1 mode %2 density %3",
			args0: [
				{
					type: "field_colour",
					name: "FOG_COLOR",
					colour: "#ffffff", // Default fog color
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

Blockly.Blocks["load_model"] = {
	init: function () {
		let nextVariableName = "model" + nextVariableIndexes["model"]; // Start with "model1"
		this.jsonInit({
			message0: "new %1 %2 scale: %3 x: %4 y: %5 z: %6",
			args0: [
				{
					type: "field_dropdown",
					name: "MODELS",
					options: modelNames.map((name) => [name, name]),
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
			colour: 230,
			tooltip: "",
			helpUrl: "",
			previousStatement: null,
			nextStatement: null,
		});

		this.setOnChange(function (changeEvent) {
			if (
				!this.isInFlyout &&
				changeEvent.type === Blockly.Events.BLOCK_CREATE &&
				changeEvent.ids.includes(this.id)
			) {
				// Check if the ID_VAR field already has a value
				const idVarField = this.getField("ID_VAR");
				if (!idVarField.getValue()) {
					// If not, create and set a new variable
					let variable = this.workspace.getVariable(nextVariableName);
					if (!variable) {
						variable = this.workspace.createVariable(
							nextVariableName,
							null,
						);
					}
					idVarField.setValue(variable.getId());

					// Increment the variable index for the next variable name
					nextVariableIndexes["model"] += 1;
				}
			}
		});
	},
};

Blockly.Blocks["create_box"] = {
	init: function () {
		let nextVariableName = "box" + nextVariableIndexes["box"];
		this.jsonInit({
			type: "create_box",
			message0:
				"new box %1 %2 width %3 height %4 depth %5 x %6 y %7 z %8",
			args0: [
				{
					type: "field_variable",
					name: "ID_VAR",
					variable: nextVariableName,
				},
				{
					type: "field_colour",
					name: "COLOR",
					colour: "#9932CC",
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

		this.setOnChange(function (changeEvent) {
			if (
				!this.isInFlyout &&
				changeEvent.type === Blockly.Events.BLOCK_CREATE &&
				changeEvent.ids.includes(this.id)
			) {
				// Check if the ID_VAR field already has a value
				const idVarField = this.getField("ID_VAR");
				if (!idVarField.getValue()) {
					// If not, create and set a new variable
					let variable = this.workspace.getVariable(nextVariableName);
					if (!variable) {
						variable = this.workspace.createVariable(
							nextVariableName,
							null,
						);
					}
					idVarField.setValue(variable.getId());

					nextVariableIndexes["box"] += 1;
				}
			}
		});
	},
};

Blockly.Blocks["create_sphere"] = {
	init: function () {
		let nextVariableName = "sphere" + nextVariableIndexes["sphere"];
		this.jsonInit({
			type: "create_sphere",
			message0:
				"new sphere %1 %2 diameter x %3 diameter y %4 diameter z %5 x %6 y %7 z %8",
			args0: [
				{
					type: "field_variable",
					name: "ID_VAR",
					variable: nextVariableName,
				},
				{
					type: "field_colour",
					name: "COLOR",
					colour: "#9932CC",
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

		this.setOnChange(function (changeEvent) {
			if (
				!this.isInFlyout &&
				changeEvent.type === Blockly.Events.BLOCK_CREATE &&
				changeEvent.ids.includes(this.id)
			) {
				// Check if the ID_VAR field already has a value
				const idVarField = this.getField("ID_VAR");
				if (!idVarField.getValue()) {
					// If not, create and set a new variable
					let variable = this.workspace.getVariable(nextVariableName);
					if (!variable) {
						variable = this.workspace.createVariable(
							nextVariableName,
							null,
						);
					}
					idVarField.setValue(variable.getId());
					nextVariableIndexes["sphere"] += 1;
				}
			}
		});
	},
};

Blockly.Blocks["create_plane"] = {
	init: function () {
		let nextVariableName = "plane" + nextVariableIndexes["plane"]; // Ensure 'plane' is managed in your nextVariableIndexes
		this.jsonInit({
			type: "create_plane",
			message0: "new plane %1 %2 width %3 height %4 x %5 y %6 z %7",
			args0: [
				{
					type: "field_variable",
					name: "ID_VAR",
					variable: nextVariableName,
				},
				{
					type: "field_colour",
					name: "COLOR",
					colour: "#9932CC", // Default color for the plane
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

		this.setOnChange(function (changeEvent) {
			if (
				!this.isInFlyout &&
				changeEvent.type === Blockly.Events.BLOCK_CREATE &&
				changeEvent.ids.includes(this.id)
			) {
				// Check if the ID_VAR field already has a value
				const idVarField = this.getField("ID_VAR");
				if (!idVarField.getValue()) {
					// If not, create and set a new variable
					let variable = this.workspace.getVariable(nextVariableName);
					if (!variable) {
						variable = this.workspace.createVariable(
							nextVariableName,
							null,
						);
					}
					idVarField.setValue(variable.getId());
					nextVariableIndexes["plane"] += 1;
				}
			}
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
					type: "field_colour",
					name: "COLOR",
					colour: "#6495ED", // Default background color
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
			message0: "print %1 for %2 seconds in color %3",
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
					type: "field_colour",
					name: "COLOR",
					colour: "#000080",
				},
			],
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
				"say %1 for %2 s %3 text %4 and background %5 alpha %6 size %7 %8 %9",
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
					variable: "mesh1",
				},
				{
					type: "field_colour",
					name: "TEXT_COLOR",
					colour: "#000000",
				},
				{
					type: "field_colour",
					name: "BACKGROUND_COLOR",
					colour: "#ffffff",
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

Blockly.Blocks["switch_animation"] = {
	init: function () {
		this.appendDummyInput()
			.appendField("switch animation of")
			.appendField(new Blockly.FieldVariable("mesh"), "MODEL")
			.appendField("to")
			.appendField(
				new Blockly.FieldDropdown(animationNames),
				"ANIMATION_NAME",
			);
		this.setPreviousStatement(true, null);
		this.setNextStatement(true, null);
		this.setColour(160);
		this.setTooltip(
			"Changes the animation of the specified model to the given animation.",
		);
		this.setHelpUrl("");
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
			colour: 230,
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

Blockly.Blocks["rotate_model_xyz"] = {
	init: function () {
		this.jsonInit({
			type: "rotate_model_xyz",
			message0: "rotate %1 by x: %2 y: %3 z: %4",
			args0: [
				{
					type: "field_variable",
					name: "MODEL",
					variable: "mesh", // Default variable name
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
			message0: "set %1 to play sound %2 speed %3 volume %4 mode %5 %6",
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
			colour: 160,
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
			colour: 210,
			tooltip: "Stops all sounds currently playing in the scene.",
			helpUrl: "",
		});
	},
};

Blockly.Blocks["on_each_update"] = {
	init: function () {
		this.jsonInit({
			type: "on_each_update",
			message0: "on each update %1",
			args0: [
				{
					type: "input_statement",
					name: "DO",
					check: null,
				},
			],
			colour: categoryColours["Control"],
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
			message0: "when %1 is clicked",
			args0: [
				{
					type: "field_variable",
					name: "MODEL_VAR",
					variable: "mesh", // Default variable name
				},
			],
			message1: "do %1",
			args1: [
				{
					type: "input_statement",
					name: "DO",
				},
			],
			colour: 120,
			tooltip:
				"Executes the blocks inside when the specified model is clicked.",
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
					type: "field_dropdown",
					name: "KEY",
					options: [["space", "SPACE"]],
				},
			],
			message1: "do %1",
			args1: [
				{
					type: "input_statement",
					name: "DO",
				},
			],
			nextStatement: null,
			colour: 120,
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
					type: "field_dropdown",
					name: "KEY",
					options: [["space", "SPACE"]],
				},
			],
			message1: "do %1",
			args1: [
				{
					type: "input_statement",
					name: "DO",
				},
			],
			nextStatement: null,
			colour: 120,
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
			colour: 160,
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
			colour: 120,
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

Blockly.Blocks["highlight"] = {
	init: function () {
		this.jsonInit({
			type: "highlight",
			message0: "highlight %1 color %2",
			args0: [
				{
					type: "field_variable",
					name: "MODEL_VAR",
					variable: "mesh", // Default variable name, ensure it's defined in your environment
				},
				{
					type: "field_colour",
					name: "COLOR",
					colour: "#9932CC",
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
			message0: "tint %1 color %2",
			args0: [
				{
					type: "field_variable",
					name: "MODEL_VAR",
					variable: "mesh",
				},
				{
					type: "field_colour",
					name: "COLOR",
					colour: "#9932CC",
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
						["space", "SPACE"],
						["W", "KeyW"],
						["A", "KeyA"],
						["S", "KeyS"],
						["D", "KeyD"],
					],
				},
			],
			output: "Boolean",
			colour: 160,
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
					variable: "mesh",
				},
				{
					type: "field_variable",
					name: "MESH2",
					variable: "mesh2",
				},
			],
			output: "Boolean",
			colour: 210,
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

function playSoundAsync(scene, soundName) {
	return new Promise((resolve, reject) => {
		// Load and play the sound
		const sound = new BABYLON.Sound(
			soundName,
			`sounds/${soundName}`,
			scene,
			null,
			{
				autoplay: true,
			},
		);

		// Register an observer to the onEndedObservable
		sound.onEndedObservable.add(() => {
			//console.log(`${soundName} finished playing`);
			resolve();
		});
	});
}

window.playSoundAsync = playSoundAsync;

javascriptGenerator.forBlock["show"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);

	return `window.whenModelReady(${modelName}, function(mesh) {
	if (mesh) {
	 mesh.setEnabled(true);
	 hk._hknp.HP_World_AddBody(hk.world, mesh.physics._pluginData.hpBodyId, mesh.physics.startAsleep);
	}
	else{
	 console.log("Model not loaded:", ${modelName});
	}
	});\n`;
};

javascriptGenerator.forBlock["hide"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);

	return `window.whenModelReady(${modelName}, function(mesh) {
	if (mesh) {
	 mesh.setEnabled(false);
	 hk._hknp.HP_World_RemoveBody(hk.world, mesh.physics._pluginData.hpBodyId);
	}
	else{
	 console.log("Mesh not loaded:", ${modelName});
	}

	});\n`;
};

function wrapCode(modelName, innerCodeBlock) {
	return `
  (function() {
	window.whenModelReady(${modelName}, function(mesh) {
	if (mesh) {
	  ${innerCodeBlock}
	}
	else {
	  console.log("Model not loaded:", modelName);
	}
	});
  })();
  `;
}

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

async function whenModelReady(meshId, callback, attempt = 1) {
	const maxAttempts = 10; // Maximum number of attempts before giving up
	const attemptInterval = 1000; // Time in milliseconds between attempts

	// Early exit if meshId is not provided
	if (!meshId) {
		console.log("Undefined model requested.", meshId);
		return;
	}

	const mesh = window.scene.getMeshByName(meshId);

	// If mesh is found, execute the callback
	if (mesh) {
		await callback(mesh);
		//console.log(`Action performed on ${meshId}`);
		return;
	}

	// Retry logic if mesh not found and max attempts not reached
	if (attempt <= maxAttempts) {
		//console.log(`Retrying model with ID '${meshId}'. Attempt ${attempt}`);
		setTimeout(
			() => window.whenModelReady(meshId, callback, attempt + 1),
			attemptInterval,
		);
	} else {
		// Log error if maximum attempts are reached
		console.error(
			`Model with ID '${meshId}' not found after ${maxAttempts} attempts.`,
		);
	}
}

window.whenModelReady = whenModelReady;

javascriptGenerator.forBlock["wait"] = function (block) {
	const duration = block.getFieldValue("DURATION");
	return `await new Promise(resolve => setTimeout(resolve, ${duration}));\n`;
};

javascriptGenerator.forBlock["glide_to"] = function (block) {
	const x = getFieldValue(block, "X", "0");
	const y = getFieldValue(block, "Y", "0");
	const z = getFieldValue(block, "Z", "0");
	const meshName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MESH_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);
	const duration = block.getFieldValue("DURATION");
	const mode = block.getFieldValue("MODE");

	return `
	await (async function() {
	  const animationPromise = new Promise(async (resolve) => {
		await window.whenModelReady(box1, async function(mesh) {
		  if (mesh) {
		  
		 	const startPosition = mesh.position.clone();
			const endPosition = new BABYLON.Vector3(${x}, ${y}, ${z});
			const fps = 30;
			const frames = 30 * (${duration}/1000);

			if(mesh.glide){ // Only allow one glide at a time
				mesh.glide.stop();
			}

			mesh.physics.disablePreStep = false;
			  
			mesh.glide = BABYLON.Animation.CreateAndStartAnimation("anim", mesh, "position", fps, 100, startPosition, endPosition, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);

		mesh.glide.onAnimationEndObservable.add(() => {		
		      mesh.physics.disablePreStep = true;
		  	  mesh.glide = null;
			  resolve();
			});
		  }
		});
	  });

${
	mode === "AWAIT"
		? `
await animationPromise;
`
		: ""
}
	})();`;
};

javascriptGenerator.forBlock["start"] = function (block) {
	const branch = javascriptGenerator.statementToCode(block, "DO");
	return `(async () => {\n${branch}})();\n`;
};

javascriptGenerator.forBlock["create_ground"] = function (block) {
	const color = block.getFieldValue("COLOR");

	return `
	(function() {
	const ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 100, height: 100, subdivisions: 2}, window.scene);
	const groundAggregate = new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, window.scene);
	ground.receiveShadows = true;
	const groundMaterial = new BABYLON.StandardMaterial("groundMaterial", window.scene);
	groundMaterial.diffuseColor = BABYLON.Color3.FromHexString("${color}");
	ground.material = groundMaterial;
	})();
	`;
};

javascriptGenerator.forBlock["set_sky_color"] = function (block) {
	const color = block.getFieldValue("COLOR");
	return `window.scene.clearColor = window.BABYLON.Color3.FromHexString("${color}");\n`;
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
	const color = block.getFieldValue("COLOR");
	return `printText(${text}, ${duration}, '${color}');\n`;
};

function hexToRgba(hex, alpha) {
	hex = hex.replace(/^#/, "");
	let r = parseInt(hex.substring(0, 2), 16);
	let g = parseInt(hex.substring(2, 4), 16);
	let b = parseInt(hex.substring(4, 6), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
window.hexToRgba = hexToRgba;

// Register the block in Blockly
javascriptGenerator.forBlock["say"] = // Function to handle the 'say' block
	function (block) {
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
		const textColor = block.getFieldValue("TEXT_COLOR");
		const backgroundColor = block.getFieldValue("BACKGROUND_COLOR");
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

		return `
	  (async function() {
		function displayText(mesh) {
		  return new Promise((resolve, reject) => {
			if (mesh) {
			// Find the first child node with a material
			let targetMesh = mesh;
			if (!mesh.material) {
			  const stack = [mesh];
			  while (stack.length > 0) {
				const current = stack.pop();
				if (current.material) {
				  targetMesh = current;
				  break;
				}
				stack.push(...current.getChildMeshes());
			  }
			}

			  // Create or get the stack panel plane
			   let plane = mesh.getChildren().find(child => child.name === "textPlane");
			  let advancedTexture;
			  if (!plane) {
				
				plane = BABYLON.MeshBuilder.CreatePlane("textPlane", { width: 1.5, height: 1.5 }, window.scene);
				plane.name = "textPlane";
				plane.parent = targetMesh;
				plane.alpha = 1;
				plane.checkCollisions = false;
				plane.isPickable = false;
				advancedTexture = window.GUI.AdvancedDynamicTexture.CreateForMesh(plane);
				plane.advancedTexture = advancedTexture;

				const stackPanel = new window.GUI.StackPanel();
				stackPanel.name = "stackPanel";
				stackPanel.horizontalAlignment = window.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
				stackPanel.verticalAlignment = window.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
				stackPanel.isVertical = true;
				stackPanel.width = "100%";
				stackPanel.adaptHeightToChildren = true;
				stackPanel.resizeToFit = true;
				stackPanel.forceResizeWidth = true;
				stackPanel.forceResizeHeight = true;
				advancedTexture.addControl(stackPanel);

			  } else {
				advancedTexture = plane.advancedTexture;
			  }

			  const stackPanel = advancedTexture.getControlByName("stackPanel");

			  // Handle REPLACE mode
			  if ("${mode}" === "REPLACE") {
				stackPanel.clearControls();
			  }

			  // Only add new text if the text value is not empty
			  if (${text}) {
				// Create a new background rectangle for the text
				const bg = new window.GUI.Rectangle("textBackground");
				bg.background = window.hexToRgba("${backgroundColor}", ${alpha});
				bg.adaptWidthToChildren = true;
				bg.adaptHeightToChildren = true;
				bg.cornerRadius = 30;
				bg.thickness = 0; // Remove border
				bg.resizeToFit = true;
				bg.forceResizeWidth = true;
				stackPanel.addControl(bg);

				const textBlock = new window.GUI.TextBlock();
				textBlock.text =  ${text};
				textBlock.color =  "${textColor}";
				textBlock.fontSize = ${size} * 10;
				textBlock.alpha = 1;
				textBlock.textWrapping =                                                                 window.GUI.TextWrapping.WordWrap;
				textBlock.resizeToFit = true;
				textBlock.forceResizeWidth = true;
				textBlock.paddingLeft = 50;
				textBlock.paddingRight = 50;
				 textBlock.paddingTop = 25;
				 textBlock.paddingBottom = 25;
				 textBlock.textVerticalAlignment = window.GUI.Control.VERTICAL_ALIGNMENT_TOP; // Align text to top
				 textBlock.textHorizontalAlignment = window.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER; // Align text to left
				bg.addControl(textBlock);   

				// Calculate the bounding box height of the mesh
				const boundingInfo = targetMesh.getBoundingInfo();
				plane.position.y = boundingInfo.boundingBox.maximum.y + 0.85;
				plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

				// Remove the text after the specified duration if duration is greater than 0
				if (${duration} * 1000 > 0) {
				  setTimeout(function() {
					stackPanel.removeControl(bg);
					bg.dispose();
					textBlock.dispose();
					resolve();
				  }, ${duration} * 1000);
				} else {
				  resolve();
				}
			  } else {
				resolve();
			  }
			} else {
			  console.error("Mesh is not defined.");
			  reject("Mesh is not defined.");
			}
		  });
		}

		if ("${asyncMode}" === "AWAIT") {
		  await new Promise((resolve, reject) => {
			window.whenModelReady(${meshVariable}, async function(mesh) {
			  try {
				await displayText(mesh);
				resolve();
			  } catch (error) {
				reject(error);
			  }
			});
		  });
		} else {
		  window.whenModelReady(${meshVariable}, function(mesh) {
			displayText(mesh);
		  });
		}
	  })();
	`;
	};

javascriptGenerator.forBlock["set_fog"] = function (block) {
	const fogColorHex = block.getFieldValue("FOG_COLOR");
	const fogMode = block.getFieldValue("FOG_MODE");
	const fogDensity =
		javascriptGenerator.valueToCode(
			block,
			"FOG_DENSITY",
			javascriptGenerator.ORDER_ATOMIC,
		) || "0.1"; // Default density

	// Convert hex color to RGB values for Babylon.js
	const fogColorRgb = `BABYLON.Color3.FromHexString('${fogColorHex}')`;

	// Generate the code for setting fog mode
	let fogModeCode = "";
	switch (fogMode) {
		case "NONE":
			fogModeCode =
				"window.scene.fogMode = BABYLON.Scene.FOGMODE_NONE;\n";
			break;
		case "EXP":
			fogModeCode = "window.scene.fogMode = BABYLON.Scene.FOGMODE_EXP;\n";
			break;
		case "EXP2":
			fogModeCode =
				"window.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;\n";
			break;
		case "LINEAR":
			fogModeCode =
				"window.scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;\n";
			break;
	}

	return `
  ${fogModeCode}
  window.scene.fogColor = ${fogColorRgb};
  window.scene.fogDensity = ${fogDensity};
  window.scene.fogStart = 50;
  window.scene.fogEnd = 100;
  `;
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

	const meshId = `${modelName}_${generateUUID()}`;
	meshMap[meshId] = block;

	return `
	//console.log("Creating", "${variableName}", "${meshId}")
		${variableName} = "${meshId}";
		loadModelIntoScene('${modelName}', '${meshId}', ${scale}, ${x}, ${y}, ${z}); 
	`;
};

function loadModelIntoScene(modelName, modelId, scale, x, y, z) {
	//console.log("Loading", modelId);

	BABYLON.SceneLoader.ImportMesh(
		"",
		"./models/",
		modelName,
		scene,
		function (meshes) {
			//console.log("Loaded", modelId);
			const mesh = meshes[0];

			//meshes[0].rotate(BABYLON.Vector3.Up(), Math.PI);
			mesh.scaling = new BABYLON.Vector3(scale, scale, scale);

			const bb =
				BABYLON.BoundingBoxGizmo.MakeNotPickableAndWrapInBoundingBox(
					mesh,
				);
			// Offsetting so that the model appears above the ground but at y=0 to make glide easier
			bb.name = modelId;
			bb.isPickable = true;
			bb.position.addInPlace(new BABYLON.Vector3(x, y, z));

			mesh.computeWorldMatrix(true);
			mesh.refreshBoundingInfo();

			stopAnimationsTargetingMesh(scene, mesh);

			const boxBody = new BABYLON.PhysicsBody(
				bb,
				BABYLON.PhysicsMotionType.STATIC,
				false,
				scene,
			);

			const boxShape = createCapsuleFromBoundingBox(bb, scene);

			boxBody.shape = boxShape;
			boxBody.setMassProperties({ mass: 1, restitution: 0.5 });
			boxBody.disablePreStep = false;
			boxBody.setAngularDamping(10000000);
			boxBody.setLinearDamping(0);
			bb.physics = boxBody;

			//console.log("Configured", modelId);
		},
		null,
		function (error) {
			console.log("Error loading", error);
		},
	);

	return modelId;
}

window.loadModelIntoScene = loadModelIntoScene;

function createCapsuleFromBoundingBox(mesh, scene) {
	// Ensure the bounding info is up to date
	mesh.computeWorldMatrix(true);
	const boundingInfo = mesh.getBoundingInfo();

	// Get bounding box dimensions
	const height =
		boundingInfo.boundingBox.maximumWorld.y -
		boundingInfo.boundingBox.minimumWorld.y;
	const width =
		boundingInfo.boundingBox.maximumWorld.x -
		boundingInfo.boundingBox.minimumWorld.x;
	const depth =
		boundingInfo.boundingBox.maximumWorld.z -
		boundingInfo.boundingBox.minimumWorld.z;

	// Calculate the radius as the average of the width and depth
	const radius = Math.max(width, depth) / 2;

	// Calculate the effective height of the capsule's cylindrical part
	const cylinderHeight = Math.max(0, height - 2 * radius);

	// Calculate the center of the bounding box
	const center = new BABYLON.Vector3(0, 0, 0);

	// Calculate the start and end points of the capsule's main segment
	const segmentStart = new BABYLON.Vector3(
		center.x,
		center.y - cylinderHeight / 2,
		center.z,
	);
	const segmentEnd = new BABYLON.Vector3(
		center.x,
		center.y + cylinderHeight / 2,
		center.z,
	);

	// Create the capsule shape
	const shape = new BABYLON.PhysicsShapeCapsule(
		segmentStart, // starting point of the capsule segment
		segmentEnd, // ending point of the capsule segment
		radius, // radius of the capsule
		scene, // scene of the shape
	);

	return shape;
}

function stopAnimationsTargetingMesh(scene, mesh) {
	// Loop through all animation groups in the scene
	scene.animationGroups.forEach(function (animationGroup) {
		// Check if the current animation group targets the specified mesh
		let targets = animationGroup.targetedAnimations.map(
			function (targetedAnimation) {
				return targetedAnimation.target;
			},
		);

		if (
			targets.includes(mesh) ||
			animationGroupTargetsDescendant(animationGroup, mesh)
		) {
			// Stop the animation group if it targets the specified mesh
			animationGroup.stop();
			//console.log("Stopping", animationGroup.name);
		}
	});
}

function animationGroupTargetsDescendant(animationGroup, parentMesh) {
	// Get all descendants of the parent mesh, including children, grandchildren, etc.
	let descendants = parentMesh.getDescendants();

	// Check each targeted animation to see if its target is among the descendants
	for (let targetedAnimation of animationGroup.targetedAnimations) {
		let target = targetedAnimation.target;
		if (descendants.includes(target)) {
			return true; // Found a descendant that is targeted by the animation group
		}
	}
	return false; // No descendants are targeted by the animation group
}

javascriptGenerator.forBlock["create_box"] = function (block) {
	const color = block.getFieldValue("COLOR");
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

	return `(function() {
	const newBox = BABYLON.MeshBuilder.CreateBox("${boxId}", {width: ${width}, height: ${height}, depth: ${depth}, scene: window.scene});
	newBox.position = new BABYLON.Vector3(${posX}, ${posY}, ${posZ});

	const boxBody = new BABYLON.PhysicsBody(newBox, BABYLON.PhysicsMotionType.STATIC, false, window.scene);

	const boxShape = new BABYLON.PhysicsShapeBox(
	  new BABYLON.Vector3(0, 0, 0),
	  new BABYLON.Quaternion(0, 0, 0, 1), 
	  new BABYLON.Vector3(${width}, ${height}, ${depth}),
	  window.scene
	);

	boxBody.setMassProperties({inertia: BABYLON.Vector3.ZeroReadOnly});

	boxBody.shape = boxShape;
	boxBody.setMassProperties({mass: 1, restitution: 0.5});

	//boxBody.setAngularDamping(1000);
	//boxBody.setLinearDamping(10);
	newBox.physics = boxBody;

	const material = new BABYLON.StandardMaterial("boxMaterial", window.scene);
	material.diffuseColor = BABYLON.Color3.FromHexString("${color}");
	newBox.material = material;
	${variableName} = "${boxId}";
	})();
	`;
};

javascriptGenerator.forBlock["create_sphere"] = function (block) {
	const color = block.getFieldValue("COLOR");
	const diameterX = getFieldValue(block, "DIAMETER_X", "1");
	const diameterY = getFieldValue(block, "DIAMETER_Y", "1");
	const diameterZ = getFieldValue(block, "DIAMETER_Z", "1");
	const posX = getFieldValue(block, "X", "0");
	const posY = getFieldValue(block, "Y", "0.5");
	const posZ = getFieldValue(block, "Z", "0");
	const variableName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("ID_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);

	const sphereId = `sphere_${generateUUID()}`;
	meshMap[sphereId] = block;

	return `(function() {
	  const newSphere = window.BABYLON.MeshBuilder.CreateSphere("${sphereId}", {
	  diameterX: ${diameterX},
	  diameterY: ${diameterY},
	  diameterZ: ${diameterZ},
	  scene: window.scene
	  });
	  newSphere.position = new BABYLON.Vector3(${posX}, ${posY}, ${posZ});

	  const sphereBody = new BABYLON.PhysicsBody(newSphere, BABYLON.PhysicsMotionType.STATIC, false, window.scene);

	  const sphereShape = new BABYLON.PhysicsShapeSphere(
	  new BABYLON.Vector3(0, 0, 0),
	  Math.max(${diameterX}, ${diameterY}, ${diameterZ}) / 2, // Approximation for irregular diameters
	  window.scene
	  );

	  sphereBody.shape = sphereShape;
	  sphereBody.setMassProperties({mass: 1, restitution: 0.5});
	  sphereBody.setAngularDamping(100);
	  sphereBody.setLinearDamping(10);
	  newSphere.physics = sphereBody;

	  const material = new BABYLON.StandardMaterial("sphereMaterial", window.scene);
	  material.diffuseColor = BABYLON.Color3.FromHexString("${color}");
	  newSphere.material = material;
	  ${variableName} = "${sphereId}";
	  \n
	})();
	`;
};

javascriptGenerator.forBlock["create_plane"] = function (block) {
	const color = block.getFieldValue("COLOR");
	const width = getFieldValue(block, "WIDTH", "1");
	const height = getFieldValue(block, "HEIGHT", "1");
	const posX = getFieldValue(block, "X", "0");
	const posY = getFieldValue(block, "Y", "0");
	const posZ = getFieldValue(block, "Z", "0");

	let variable_name = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("ID_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);

	const planeId = `plane_${generateUUID()}`;
	meshMap[planeId] = block;

	return `(function() {
	  const newPlane = BABYLON.MeshBuilder.CreatePlane("${planeId}", {width: ${width}, height: ${height}, sideOrientation: BABYLON.Mesh.DOUBLESIDE, scene: window.scene});
	  newPlane.position = new BABYLON.Vector3(${posX}, ${posY}, ${posZ});

	  const material = new BABYLON.StandardMaterial("planeMaterial", scene);
	  material.diffuseColor = BABYLON.Color3.FromHexString("${color}");
	  newPlane.material = material;

	  // Assuming there's no need to set up physics for the plane, but if needed:
	  // Setup physics properties here if the plane also needs to interact physically

	  ${variable_name} = "${planeId}";
	})();`;
};

javascriptGenerator.forBlock["set_background_color"] = function (block) {
	const color = block.getFieldValue("COLOR");
	return `window.scene.clearColor = BABYLON.Color4.FromHexString("${color}FF");\n`;
};

javascriptGenerator.forBlock["move_by_vector"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("BLOCK_NAME"),
		Blockly.Names.NameType.VARIABLE,
	);

	const x = getFieldValue(block, "X", "0");
	const y = getFieldValue(block, "Y", "0");
	const z = getFieldValue(block, "Z", "0");

	return (
		`window.whenModelReady(${modelName}, function(mesh) {
	if (mesh) {\n` +
		`  
	mesh.position.addInPlace(new BABYLON.Vector3(${x}, ${y}, ${z}));
	mesh.physics.disablePreStep = false;
	mesh.physics.setTargetTransform(mesh.position, mesh.rotationQuaternion);

	// Optionally, force an immediate update if needed
	//mesh.physicsImpostor.forceUpdate();
	}
	else{
	console.log("Model not loaded:", ${modelName});
	}

	});\n`
	);
};

javascriptGenerator.forBlock["rotate_model_xyz"] = function (block) {
	const meshName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL"),
		Blockly.Names.NameType.VARIABLE,
	);

	const x = getFieldValue(block, "X", "0");
	const y = getFieldValue(block, "Y", "0");
	const z = getFieldValue(block, "Z", "0");

	return `
	window.whenModelReady(${meshName}, function(mesh) {
	if (mesh) {

if(mesh.physics.getMotionType() != BABYLON.PhysicsMotionType.DYNAMIC){
mesh.physics.setMotionType(BABYLON.PhysicsMotionType.ANIMATED);
}

	const incrementalRotation = BABYLON.Quaternion.RotationYawPitchRoll(BABYLON.Tools.ToRadians(${y}), BABYLON.Tools.ToRadians(${x}), BABYLON.Tools.ToRadians(${z}));
	mesh.rotationQuaternion.multiplyInPlace(incrementalRotation).normalize();
	mesh.physics.disablePreStep = false;
	mesh.physics.setTargetTransform(mesh.absolutePosition, mesh.rotationQuaternion);
	//mesh.physics.setAngularVelocity(BABYLON.Vector3.Zero());

	} else {
	console.warn('Mesh named ' + ${meshName} + ' not found.');
	}
	});`;
};

javascriptGenerator.forBlock["on_each_update"] = function (block) {
	const branch = javascriptGenerator.statementToCode(block, "DO");
	return (
		"window.scene.onBeforeRenderObservable.add(() => {\n" + branch + "});\n"
	);
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

	const code = `let allMeshes = [mesh].concat(mesh.getChildMeshes(false));

	allMeshes.forEach(nextMesh => {
		if (nextMesh.material) {
		nextMesh.material.alpha = ${alphaValue};
		}
	  });`;

	return wrapCode(modelName, code);
};

javascriptGenerator.forBlock["play_animation"] = function (block) {
	const animationName = block.getFieldValue("ANIMATION_NAME");
	const modelVar = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL"),
		Blockly.Names.NameType.VARIABLE,
	);

	const code = `
async function playAnimationWithRetry(meshName, animationName) {
    //console.log("Playing animation:", animationName);
	const maxAttempts = 10;
	let attempts = 0;
	const attemptInterval = 1000; // Time in milliseconds between attempts

	const findMeshAndPlayAnimation = async () => {
		const _mesh = scene.getMeshByName(meshName);
		if (_mesh) {
			await window.playAnimation(scene, _mesh, animationName, false, true);
		} else if (attempts < maxAttempts) {
			attempts++;
			setTimeout(findMeshAndPlayAnimation, attemptInterval);
		} else {
			console.error(\`Failed to find mesh "\${meshName}" after \${maxAttempts} attempts.\`);
		}
	};

	await findMeshAndPlayAnimation();
}

await playAnimationWithRetry(${modelVar}, "${animationName}");
`;

	return code;
};

async function playAnimation(
	scene,
	model,
	animationName,
	loop,
	restart = false,
) {
	var animGroup = switchToAnimation(
		scene,
		model,
		animationName,
		loop,
		restart,
	);

	return new Promise((resolve) => {
		animGroup.onAnimationEndObservable.addOnce(() => {
			//console.log("Animation ended");
			resolve();
		});
	});
}

window.playAnimation = playAnimation;
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
		? `await window.playSoundAsync(scene, "${soundName}", ${optionsString});\n`
		: `new BABYLON.Sound("${soundName}", "sounds/${soundName}", scene, null, { autoplay: true, ...${optionsString} });\n`;
};

javascriptGenerator.forBlock["stop_all_sounds"] = function (block) {
	// JavaScript code to stop all sounds in a Babylon.js scene
	return "scene.sounds.forEach(function(sound) { sound.stop(); });\n";
};

javascriptGenerator.forBlock["when_clicked"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);

	const doCode = javascriptGenerator.statementToCode(block, "DO");

	return `(async () => {
	window.whenModelReady(${modelName}, async function(_mesh) {

	if (_mesh) {
	//console.log("Registering click action for", _mesh.name);

	 _mesh.actionManager = new BABYLON.ActionManager(window.scene);
	 //_mesh.actionManager.isRecursive = true;
	_mesh.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, async function() {
	//console.log("Model clicked:", _mesh.name);
	${doCode}
	}));

	} else {
	  console.log("No pickable parent or child found.");
	}
	})})();
	`;
};

// Mapping key names to key codes, including space
const keyCodeMap = {
	SPACE: "32",
};

javascriptGenerator.forBlock["when_key_pressed"] = function (block) {
	const key = block.getFieldValue("KEY");
	const statements_do = javascriptGenerator.statementToCode(block, "DO");

	const keyCode = keyCodeMap[key];

	return `
	window.scene.onKeyboardObservable.add(async (kbInfo) => {
	switch (kbInfo.type) {
	  case BABYLON.KeyboardEventTypes.KEYDOWN:
	  if (kbInfo.event.keyCode === ${keyCode}) {
		${statements_do}
	  }
	  break;
	}
	});
	`;
};

javascriptGenerator.forBlock["when_key_released"] = function (block) {
	const key = block.getFieldValue("KEY");
	const statements_do = javascriptGenerator.statementToCode(block, "DO");
	const keyCode = keyCodeMap[key];

	return `
	window.scene.onKeyboardObservable.add( async (kbInfo) => {
	switch (kbInfo.type) {
	  case BABYLON.KeyboardEventTypes.KEYUP:
	  if (kbInfo.event.keyCode === ${keyCode}) {
		${statements_do}
	  }
	  break;
	}
	});
	`;
};

javascriptGenerator.forBlock["broadcast_event"] = function (block) {
	var eventName = block.getFieldValue("EVENT_NAME");
	var code = `document.dispatchEvent(new CustomEvent("${eventName}"));\n`;
	return code;
};

javascriptGenerator.forBlock["on_event"] = function (block) {
	var eventName = block.getFieldValue("EVENT_NAME");
	var statements_do = javascriptGenerator.statementToCode(block, "DO");
	var code = `
  (function() {
	const handler = async function() {
	  ${statements_do}
	};
	document.addEventListener("${eventName}", handler);
	window.scene.eventListeners.push({ event: "${eventName}", handler });
  })();
  `;
	return code;
};

function removeEventListeners() {
	window.scene.eventListeners.forEach(({ event, handler }) => {
		document.removeEventListener(event, handler);
	});
	window.scene.eventListeners.length = 0; // Clear the array
}

javascriptGenerator.forBlock["tint"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);
	const color = block.getFieldValue("COLOR");

	return `window.whenModelReady(${modelName}, function(mesh) {
	if (mesh) {
  if (mesh.material) {
  mesh.renderOverlay = true;
  mesh.overlayAlpha = 0.5;
  mesh.overlayColor = BABYLON.Color3.FromHexString("${color}");
  }
  mesh.getChildMeshes().forEach(function(childMesh) {
	if (childMesh.material) {
	childMesh.renderOverlay = true;
	childMesh.overlayAlpha = 0.5;
	childMesh.overlayColor = BABYLON.Color3.FromHexString("${color}");
	//console.log("Setting overlay color:", childMesh.name)
	}
  });

	}
	else{

	console.log("Model not loaded:", ${modelName});
	}

	});\n`;
};

javascriptGenerator.forBlock["highlight"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);
	const color = block.getFieldValue("COLOR");

	return `window.whenModelReady(${modelName}, function(mesh) {
	if (mesh) {
  if (mesh.material){
  window.highlighter.addMesh(mesh, BABYLON.Color3.FromHexString("${color}"));
  }

  mesh.getChildMeshes().forEach(function(childMesh) {
	if (childMesh.material) {
	window.highlighter.addMesh(childMesh, BABYLON.Color3.FromHexString("${color}"));
	}
  });
	}
	else{

	console.log("Model not loaded:", ${modelName});
	}

	});\n`;
};

javascriptGenerator.forBlock["clear_effects"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);

	return `window.whenModelReady(${modelName}, function(mesh) {
	if (mesh) {
	window.highlighter.removeMesh(mesh);
	mesh.renderOverlay = false;

	mesh.getChildMeshes().forEach(function(childMesh) {
	if (childMesh.material) {
	  window.highlighter.removeMesh(childMesh);
	}

	childMesh.renderOverlay = false;

	});
	}
	else{
	console.log("Model not loaded:", ${modelName});
	}

	});\n`;
};

javascriptGenerator.forBlock["switch_animation"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL"),
		Blockly.Names.NameType.VARIABLE,
	);
	const animationName = block.getFieldValue("ANIMATION_NAME");

	// Wrap the logic in an asynchronous IIFE
	return `
(async function() {
	const maxAttempts = 100;
	let attempts = 0;

	const findModelAndSwitchAnimation = async () => {
		const model = scene.getMeshByName(${modelName});
		if (model) {
			window.switchToAnimation(scene, model, '${animationName}');
		} else if (attempts < maxAttempts) {
			attempts++;
			await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retrying
			findModelAndSwitchAnimation();
		} else {
			console.error('Model ' + ${modelName} + ' not found after ' + maxAttempts + ' attempts.');
		}
	};

	await findModelAndSwitchAnimation();
})();
	`;
};

function switchToAnimation(
	scene,
	mesh,
	animationName,
	loop = true,
	restart = false,
) {
	const newAnimationName = animationName;

	//console.log(`Switching ${mesh.name} to animation ${newAnimationName}`);

	//const mesh = scene.getMeshByName(meshName);
	if (!mesh) {
		console.error(`Mesh ${mesh.name} not found.`);
		return null;
	}

	let targetAnimationGroup = scene.animationGroups.find(
		(group) =>
			group.name === newAnimationName &&
			animationGroupTargetsDescendant(group, mesh),
	);

	if (!targetAnimationGroup) {
		console.error(`Animation "${newAnimationName}" not found.`);
		return null;
	}

	if (!mesh.animationGroups) {
		mesh.animationGroups = [];
		stopAnimationsTargetingMesh(scene, mesh);
		//console.log(`Stopping all animations on mesh`);
	}

	if (
		mesh.animationGroups[0] &&
		mesh.animationGroups[0].name !== newAnimationName
	) {
		stopAnimationsTargetingMesh(scene, mesh);

		//console.log(`Stopping animation ${mesh.animationGroups[0].name}`);
		mesh.animationGroups[0].stop();
		mesh.animationGroups = [];
	}

	if (
		!mesh.animationGroups[0] ||
		(mesh.animationGroups[0].name == newAnimationName && restart)
	) {
		stopAnimationsTargetingMesh(scene, mesh);
		//console.log(`Starting animation ${newAnimationName}`);
		mesh.animationGroups[0] = targetAnimationGroup;
		mesh.animationGroups[0].reset();
		mesh.animationGroups[0].stop();
		mesh.animationGroups[0].start(
			loop,
			1.0,
			targetAnimationGroup.from,
			targetAnimationGroup.to,
			false,
		);
	}

	return targetAnimationGroup;
}

window.switchToAnimation = switchToAnimation;

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
	return `

	  const model = window.scene.getMeshByName(${modelName});
	  
	  if (model) {

	  if (${speed} === 0){ return; }

	  const forwardSpeed = -${speed};  
	  const cameraForward = window.scene.activeCamera.getForwardRay().direction.normalize();

	  // Forward direction adjusted to move away from the camera
	  const moveDirection = cameraForward.scale(-forwardSpeed); 
	  const currentVelocity = model.physics.getLinearVelocity();
	  model.physics.setLinearVelocity(
		  new BABYLON.Vector3(
		  moveDirection.x,
		  currentVelocity.y,
		  moveDirection.z
		)
  );

  // Decide the facing direction based on whether steps is positive or negative
	let facingDirection;
	if (${speed} >= 0) {
	  // Face away from the camera when moving forward
	  facingDirection = new BABYLON.Vector3(-cameraForward.x, 0, -cameraForward.z).normalize();
	} else {
	  // Face towards the camera when moving backward
	  facingDirection = new BABYLON.Vector3(cameraForward.x, 0, cameraForward.z).normalize();
	}

	// Calculate the target rotation from the facing direction
	const targetRotation = BABYLON.Quaternion.FromLookDirectionLH(facingDirection, BABYLON.Vector3.Up());
	const currentRotation = model.rotationQuaternion;
	const deltaRotation = targetRotation.multiply(currentRotation.conjugate());
	const deltaEuler = deltaRotation.toEulerAngles();
	const scaledAngularVelocityY = new BABYLON.Vector3(0, deltaEuler.y * 5, 0); // Adjust the scalar as needed

	// Update angular velocity for rotation
	model.physics.setAngularVelocity(scaledAngularVelocityY);

	model.rotationQuaternion.x = 0;
	model.rotationQuaternion.z = 0;
	model.rotationQuaternion.normalize(); // Re-normalize the quaternion to maintain a valid rotation

  }
	`;
};

javascriptGenerator.forBlock["camera_follow"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MESH_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);

	return (
		`window.whenModelReady(${modelName}, function(mesh) {
	  if (mesh) {\n` +
		`  
  console.log("Attaching camera");

// Reset linear and angular velocity after physics render
window.scene.onAfterPhysicsObservable.add(() => {
  // Get current velocities
  const currentVelocity = mesh.physics.getLinearVelocity();
  const newVelocity = new BABYLON.Vector3(0, currentVelocity.y, 0); // Keep y velocity, reset x and z to 0
  
  // Set the new linear velocity
  mesh.physics.setLinearVelocity(newVelocity);
  
  // Reset angular velocity to zero
  mesh.physics.setAngularVelocity(BABYLON.Vector3.Zero());

  // Get current rotation quaternion
  const currentRotationQuaternion = mesh.rotationQuaternion;
  
  // Convert the quaternion to Euler angles to access individual rotations
  const currentEulerRotation = currentRotationQuaternion.toEulerAngles();

  // Reset x and z rotation to 0 while keeping y rotation the same
  const newRotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(currentEulerRotation.y, 0, 0);
  
  // Apply the new rotation quaternion
  mesh.rotationQuaternion.copyFrom(newRotationQuaternion);
});



	   const camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 2, Math.PI / 4, -20, mesh.position, window.scene);
	   camera.checkCollisions = true;

   // Adjust Beta limits to control the vertical angle
	camera.lowerBetaLimit = Math.PI / 2.5; // Lower angle
	camera.upperBetaLimit = Math.PI / 2; // Upper angle, prevent it from being too high
	  camera.lowerRadiusLimit = 2;
	  camera.upperRadiusLimit = 7;
	  // This targets the camera to scene origin
	  camera.setTarget(BABYLON.Vector3.Zero());
	  // This attaches the camera to the canvas
	  camera.attachControl(canvas, true);
	  camera.setTarget(mesh);
	  window.scene.activeCamera = camera;

	  }
	  else{
	   console.log("Model not loaded:", ${modelName});
	  }

	  });\n`
	);
};

javascriptGenerator.forBlock["add_physics"] = function (block) {
	const modelName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MODEL_VAR"),
		Blockly.Names.NameType.VARIABLE,
	);

	const physicsType = block.getFieldValue("PHYSICS_TYPE");

	return `window.whenModelReady(${modelName}, function(mesh) {
	  if (mesh) {
		switch ("${physicsType}") {
			case "STATIC":
mesh.physics.setMotionType(BABYLON.PhysicsMotionType.STATIC);
 break;
			case "DYNAMIC":
mesh.physics.setMotionType(BABYLON.PhysicsMotionType.DYNAMIC);
 break;
			case "ANIMATED":
mesh.physics.setMotionType(BABYLON.PhysicsMotionType.ANIMATED);
 break;
}
	  }
	  else{

	   console.log("Model not loaded:", ${modelName});
	  }

	  });\n`;
};

javascriptGenerator.forBlock["key_pressed"] = function (block) {
	const key = block.getFieldValue("KEY");
	// Code to check if the key is pressed
	let code;
	if (key === "ANY") {
		code = "window.currentKeyPressed !== null";
	} else if (key === "NONE") {
		code = "window.currentKeyPressed === null";
	} else {
		code = `window.currentKeyPressed === "${key}"`;
	}
	return [code, javascriptGenerator.ORDER_NONE];
};

javascriptGenerator.forBlock["meshes_touching"] = function (block) {
	const mesh1VarName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MESH1"),
		Blockly.Names.NameType.VARIABLE,
	);
	const mesh2VarName = javascriptGenerator.nameDB_.getName(
		block.getFieldValue("MESH2"),
		Blockly.Names.NameType.VARIABLE,
	);

	const code = `
	(function () {
	  const mesh1 = scene.getMeshByName(${mesh1VarName});
	  const mesh2 = scene.getMeshByName(${mesh2VarName});
	  if (mesh1 && mesh2 && mesh2.isEnabled()) {
		return mesh1.intersectsMesh(mesh2, false);
	  } else {
		return false;
	  }
	})()
		`;
	return [code, javascriptGenerator.ORDER_ATOMIC];
};

const createScene = function () {
	window.scene = new BABYLON.Scene(engine);
	window.scene.eventListeners = [];
	hk = new BABYLON.HavokPlugin(true, havokInstance);
	window.scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), hk);
	window.highlighter = new BABYLON.HighlightLayer(
		"highlighter",
		window.scene,
	);
	gizmoManager = new BABYLON.GizmoManager(window.scene);

	const camera = new BABYLON.FreeCamera(
		"camera",
		new BABYLON.Vector3(0, 4, -20),
		window.scene,
	);
	camera.setTarget(BABYLON.Vector3.Zero());
	camera.attachControl(canvas, true);
	window.scene.createDefaultLight();
	window.scene.collisionsEnabled = true;

	const advancedTexture =
		window.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

	// Create a stack panel to hold the text lines
	const stackPanel = new window.GUI.StackPanel();
	stackPanel.isVertical = true;
	stackPanel.width = "100%";
	stackPanel.height = "100%";
	stackPanel.left = "0px";
	stackPanel.top = "0px";
	advancedTexture.addControl(stackPanel);

	// Function to print text with scrolling
	const textLines = []; // Array to keep track of text lines
	window.printText = function (text, duration, color) {
		if (text !== "") {
			window.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

			// Create a rectangle background
			const bg = new window.GUI.Rectangle("textBackground");
			bg.background = "rgba(255, 255, 255, 0.5)";
			bg.adaptWidthToChildren = true; // Adjust width based on child elements
			bg.adaptHeightToChildren = true; // Adjust height based on child elements
			bg.cornerRadius = 2;
			bg.thickness = 0; // Remove border
			bg.horizontalAlignment =
				window.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
			bg.verticalAlignment = window.GUI.Control.VERTICAL_ALIGNMENT_TOP;
			bg.left = "5px"; // Position with some margin from left
			bg.top = "5px"; // Position with some margin from top

			// Create a text block
			const textBlock = new window.GUI.TextBlock("textBlock", text);
			textBlock.color = color;
			textBlock.fontSize = "12";
			textBlock.height = "20px";
			textBlock.paddingLeft = "10px";
			textBlock.paddingRight = "10px";
			textBlock.paddingTop = "2px";
			textBlock.paddingBottom = "2px";
			textBlock.textVerticalAlignment =
				window.GUI.Control.VERTICAL_ALIGNMENT_TOP; // Align text to top
			textBlock.textHorizontalAlignment =
				window.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT; // Align text to left
			textBlock.textWrapping = window.GUI.TextWrapping.WordWrap;
			textBlock.resizeToFit = true;
			textBlock.forceResizeWidth = true;

			// Add the text block to the rectangle
			bg.addControl(textBlock);

			// Add the container to the stack panel
			stackPanel.addControl(bg);
			textLines.push(bg);

			// Remove the text after the specified duration
			setTimeout(() => {
				stackPanel.removeControl(bg);
				textLines.splice(textLines.indexOf(bg), 1);
			}, duration * 1000);
		}
	};

	return window.scene;
};

async function initialize() {
	BABYLON.Database.IDBStorageEnabled = true;
	BABYLON.Engine.CollisionsEpsilon = 0.00005;
	havokInstance = await HavokPhysics();
	engineReady = true;
	window.scene = createScene();
	window.scene.eventListeners = [];

	engine.runRenderLoop(function () {
		window.scene.render();
	});
}

initialize();
const meshMap = {};

let nextVariableIndexes = {
	model: 1,
	box: 1,
	sphere: 1,
	plane: 1,
	text: 1,
	sound: 1,
};

function initializeVariableIndexes() {
	nextVariableIndexes = {
		model: 1,
		box: 1,
		sphere: 1,
		plane: 1,
		text: 1,
		sound: 1,
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

window.addEventListener("resize", function () {
	engine.resize();
});

// Define your starter blocks XML string
const initialBlocks = `
  <xml xmlns="http://www.w3.org/1999/xhtml">
	<block type="start">
	<statement name="DO">
	  <block type="set_sky_color">
	  <next>
		<block type="create_ground">
		<next>
		  <block type="print_text">
		  <value name="TEXT">
			<shadow type="text">
			<field name="TEXT">🌈 Hello</field>
			</shadow>
		  </value>
		  <value name="DURATION">
			<shadow type="math_number">
			<field name="NUM">30</field>
			</shadow>
		  </value>
		  </block>
		</next>
		</block>
	  </next>
	  </block>
	</statement>
	</block>
  </xml>`;

// Convert the XML string to a DOM element
const xml = Blockly.utils.xml.textToDom(initialBlocks);

// Load the XML into the workspace
Blockly.Xml.domToWorkspace(xml, workspace);
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
};

function executeCode() {
	if (engineReady) {
		if (window.scene) {
			window.scene.dispose();
			removeEventListeners();
		}
		window.scene = createScene();

		const code = javascriptGenerator.workspaceToCode(workspace);
		try {
			//eval(code);
			//console.log(code);
			new Function(`(async () => { ${code} })()`)();
		} catch (error) {
			console.error("Error executing Blockly code:", error);
		}
	} else {
		// Check again in 100 milliseconds
		setTimeout(executeCode, 100);
	}
}

function stopCode() {
	window.scene.dispose();
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
					console.log(motionType);
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

					const block = meshMap[mesh.name];
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
						console.log(
							"Restoring motion type",
							mesh.savedMotionType,
						);
					}

					const block = meshMap[mesh.name];

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
		workspace.scrollCenter(
			block.getRelativeToSurfaceXY().x,
			block.getRelativeToSurfaceXY().y,
		);
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
	if (window.scene.debugLayer.isVisible()) {
		document.getElementById("rightArea").style.width = "50%";
		document.getElementById("blocklyDiv").style.width = "50%";

		window.scene.debugLayer.hide();
	} else {
		document.getElementById("rightArea").style.width = "100%";
		document.getElementById("blocklyDiv").style.width = "0%";

		window.scene.debugLayer.show();
	}
});

window.currentKeyPressed = null;

document.addEventListener("keydown", function (event) {
	window.currentKeyPressed = event.code;
});

document.addEventListener("keyup", function (event) {
	window.currentKeyPressed = null;
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

addImportContextMenuOption();

window.executeCode = executeCode;
window.exportCode = exportCode;
