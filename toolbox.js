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

export const toolbox = {
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
					type: "up",
					inputs: {
						UP_FORCE: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 2,
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
					type: "touching_surface",
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
				  type: "random_seeded_int",
				  inputs: {
					FROM: {
					  shadow: {
						type: "math_number",
						fields: {
						  NUM: 1
						}
					  }
					},
					TO: {
					  shadow: {
						type: "math_number",
						fields: {
						  NUM: 100
						}
					  }
					},
					SEED: {
					  shadow: {
						type: "math_number",
						fields: {
						  NUM: 42 // Default seed value
						}
					  }
					}
				  }
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
					type: "math_single",
					fields: {
						OP: "ABS",
					},
				},
				{
					kind: "block",
					type: "math_trig",
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
											PHYSICS_TYPE: "DYNAMIC",
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