import * as Blockly from "blockly";

export const categoryColours = {
	Events: 200,
	Scene: 90,
	Transform: 240,
	Animate: 45,
	Materials: 280,
	Sound: 25,
	Sensing: 180,
	Snippets: 5,
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
			name: "Events",
			icon: "./images/events.svg",
			colour: categoryColours["Events"],
			contents: [
				{
					kind: "block",
					type: "start",
					keyword: "start",
				},
				{
					kind: "block",
					type: "forever",
					keyword: "ever",
				},
				{
					kind: "block",
					type: "when_clicked",
					keyword: "click",
				},
				{
					kind: "block",
					type: "when_touches",
					keyword: "touches",
				},
				{
					kind: "block",
					type: "when_key_pressed",
					keyword: "press",
				},
				{
					kind: "block",
					type: "when_key_released",
					keyword: "release",
				},
				{
					kind: "block",
					type: "broadcast_event",
					keyword: "broadcast",
					inputs: {
						EVENT_NAME: {
							shadow: {
								type: "text",
								fields: {
									TEXT: "go",
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "on_event",
					keyword: "on",
					inputs: {
						EVENT_NAME: {
							shadow: {
								type: "text",
								fields: {
									TEXT: "go",
								},
							},
						},
					},
				},
			],
		},
		{
			kind: "category",
			name: "Scene",
			icon: "./images/scene.svg",
			colour: categoryColours["Scene"],
			contents: [
				{
					kind: "block",
					type: "set_sky_color",
					keyword: "sky",
					inputs: {
						COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#6495ED",
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "create_ground",
					keyword: "ground",
					inputs: {
						COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#71BC78",
								},
							},
						},
					},
				},
				/*{
					kind: "block",
					type: "create_custom_map",
					inputs: {
						COLOR_1: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#000000",
								},
							},
						},
						COLOR_2: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#333333",
								},
							},
						},
						COLOR_3: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#666666",
								},
							},
						},
						COLOR_4: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#999999",
								},
							},
						},
						COLOR_5: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#CCCCCC",
								},
							},
						},
						COLOR_6: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#333333",
								},
							},
						},
						COLOR_7: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#666666",
								},
							},
						},
						COLOR_8: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#999999",
								},
							},
						},
						COLOR_9: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#CCCCCC",
								},
							},
						},
						COLOR_10: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#FFFFFF",
								},
							},
						},
						COLOR_11: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#666666",
								},
							},
						},
						COLOR_12: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#999999",
								},
							},
						},
						COLOR_13: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#CCCCCC",
								},
							},
						},
						COLOR_14: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#FFFFFF",
								},
							},
						},
						COLOR_15: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#000000",
								},
							},
						},
						COLOR_16: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#999999",
								},
							},
						},
						COLOR_17: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#CCCCCC",
								},
							},
						},
						COLOR_18: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#FFFFFF",
								},
							},
						},
						COLOR_19: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#000000",
								},
							},
						},
						COLOR_20: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#333333",
								},
							},
						},
						COLOR_21: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#CCCCCC",
								},
							},
						},
						COLOR_22: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#FFFFFF",
								},
							},
						},
						COLOR_23: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#000000",
								},
							},
						},
						COLOR_24: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#333333",
								},
							},
						},
						COLOR_25: {
							shadow: {
								type: "greyscale_colour",
								fields: {
									COLOR: "#666666",
								},
							},
						},
					},
				},*/
				{
					kind: "block",
					type: "load_model",
					keyword: "model",
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
					type: "load_character",
					keyword: "character",
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
						HAIR_COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#000000",
								},
							},
						},
						SKIN_COLOR: {
							shadow: {
								type: "skin_colour",
								fields: {
									COLOR: "A15C33",
								},
							},
						},
						EYES_COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#000000",
								},
							},
						},
						SLEEVES_COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#008B8B",
								},
							},
						},
						SHORTS_COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "00008B",
								},
							},
						},
						TSHIRT_COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#FF8F60",
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "load_object",
					keyword: "object",
					inputs: {
						COLOR: {
							shadow: {
								type: "colour", // Correct type for color field
								fields: {
									COLOR: "#FFD700", // Gold
								},
							},
						},
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
									NUM: 2,
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
					keyword: "box",
					inputs: {
						COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#9932CC",
								},
							},
						},
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
					keyword: "sphere",
					inputs: {
						COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#9932CC",
								},
							},
						},
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
					type: "create_cylinder",
					keyword: "cylinder",
					inputs: {
						COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#9932CC",
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
						DIAMETER_TOP: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
						DIAMETER_BOTTOM: {
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
					type: "create_capsule",
					keyword: "capsule",
					inputs: {
						COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#9932CC",
								},
							},
						},
						RADIUS: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0.5,
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
					type: "create_plane",
					keyword: "plane",
					inputs: {
						COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#9932CC",
								},
							},
						},
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
					type: "merge_meshes",
					inputsInline: true,
					inputs: {
						MESH_LIST: {
							block: {
								type: "lists_create_with",
								inline: true,
								extraState: {
									itemCount: 1,
								},
								inputs: {
									ADD0: {
										block: {
											type: "variables_get",
											fields: {
												VAR: "mesh1", // Default variable for a mesh
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
					type: "subtract_meshes",
					inputsInline: true,
					inputs: {
						MESH_LIST: {
							block: {
								type: "lists_create_with",
								inline: true,
								extraState: {
									itemCount: 1,
								},
								inputs: {
									ADD0: {
										block: {
											type: "variables_get",
											fields: {
												VAR: "mesh2", // Default variable for a mesh to subtract
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
					type: "create_wall",
					keyword: "wall",
					inputs: {
						COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#9932CC",
								},
							},
						},
						START_X: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						START_Z: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						END_X: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
						END_Z: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						Y_POSITION: {
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
					type: "show",
					keyword: "show",
				},
				{
					kind: "block",
					type: "hide",
					keyword: "hide",
				},
				{
					kind: "block",
					type: "parent_child",
					keyword: "parent",
					inputs: {
						X_OFFSET: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						Y_OFFSET: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						Z_OFFSET: {
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
					type: "follow",
					keyword: "follow",
					inputs: {
						X_OFFSET: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						Y_OFFSET: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						Z_OFFSET: {
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
					type: "stop_follow",
					keyword: "fstop",
				},
				{
					kind: "block",
					type: "hold",
					keyword: "hold",
					inputs: {
						X_OFFSET: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						Y_OFFSET: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						Z_OFFSET: {
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
					type: "drop",
					keyword: "drop",
				},
				{
					kind: "block",
					type: "remove_parent",
					keyword: "noparent",
				},
				{
					kind: "block",
					type: "set_background_color",
					keyword: "background",
					inputs: {
						COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#6495ED",
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "create_map",
					keyword: "map",
					inputs: {
						COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#71BC78",
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "set_fog",
					keyword: "fog",
					inputs: {
						FOG_COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#ffffff",
								},
							},
						},
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
					type: "dispose",
					keyword: "dispose",
				},
				{
					kind: "block",
					type: "export_mesh",
					keyword: "export",
				},
			],
		},
		{
			kind: "category",
			name: "Animate",
			icon: "./images/animate.svg",
			colour: categoryColours["Animate"],
			contents: [
				{
					kind: "block",
					type: "switch_animation",
					keyword: "switch",
				},
				{
					kind: "block",
					type: "play_animation",
					keyword: "play",
				},
				{
					kind: "block",
					type: "glide_to",
					keyword: "glide",
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
					type: "rotate_anim",
					keyword: "rotate",
					inputs: {
						ROT_X: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0, // Default rotation for X-axis
								},
							},
						},
						ROT_Y: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0, // Default rotation for Y-axis
								},
							},
						},
						ROT_Z: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0, // Default rotation for Z-axis
								},
							},
						},
						DURATION: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1000, // Default duration in milliseconds
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "animate_keyframes",
					keyword: "animate_keyframes",
					inputsInline: true, // Set lists to be inline
					inputs: {
						KEYFRAMES: {
							block: {
								type: "lists_create_with",
								extraState: {
									itemCount: 1,
								},
								inputs: {
									ADD0: {
										block: {
											type: "colour_keyframe",
											inputs: {
												VALUE: {
													shadow: {
														type: "colour",
														fields: {
															COLOR: "#ff0000", // Default colour: Red
														},
													},
												},
												DURATION: {
													shadow: {
														type: "math_number",
														fields: {
															NUM: 1, // Default duration: 1 second
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
				{
					kind: "block",
					type: "colour_keyframe",
					inputs: {
						VALUE: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#000080",
								},
							},
						},
						DURATION: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 5,
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "number_keyframe",
					inputs: {
						VALUE: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
						DURATION: {
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
					type: "xyz_keyframe",
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
									NUM: 1,
								},
							},
						},
						Z: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
						DURATION: {
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
					type: "animate_property",
					keyword: "anp",
				},
			],
		},

		{
			kind: "category",
			name: "Transform",
			icon: "./images/motion.svg",
			colour: categoryColours["Transform"],
			contents: [
				{
					kind: "block",
					type: "move_by_vector",
					keyword: "move",
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
					keyword: "rotate",
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
					type: "rotate_camera",
					keyword: "",
					inputs: {
						DEGREES: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 5,
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "look_at",
					keyword: "look",
				},
				{
					kind: "block",
					type: "move_to",
					keyword: "goto",
				},
				{
					kind: "block",
					type: "rotate_to",
					keyword: "rxyz",
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
					},
				},
				{
					kind: "block",
					type: "position_at",
					keyword: "pos",
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
					},
				},
				{
					kind: "block",
					type: "move_forward",
					keyword: "forward",
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
					type: "vector", // Use the block's actual type name defined when you created it
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
					},
				},
				{
					kind: "block",
					type: "set_pivot",
					inputs: {
						X_PIVOT: {
							shadow: {
								type: "min_centre_max",
								fields: {
									PIVOT_OPTION: "0", // Use the value "0" for "centre"
								},
							},
						},
						Y_PIVOT: {
							shadow: {
								type: "min_centre_max",
								fields: {
									PIVOT_OPTION: "Number.MIN_SAFE_INTEGER", // Use the actual value for "min"
								},
							},
						},
						Z_PIVOT: {
							shadow: {
								type: "min_centre_max",
								fields: {
									PIVOT_OPTION: "0", // Use the value "0" for "centre"
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "move_sideways",
					keyword: "sideways",
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
					type: "strafe",
					keyword: "strafe",
					inputs: {
						SPEED: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1, // Default speed of 1
								},
							},
						},
					},
				},
				/*				{
					kind: "block",
					type: "up",
					keyword: "up",
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
				},*/
				{
					kind: "block",
					type: "apply_force",
					keyword: "push",
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
									NUM: 2,
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
					type: "camera_follow",
					keyword: "follow",
					inputs: {
						RADIUS: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 7,
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "get_camera",
					keyword: "cam",
				},
				{
					kind: "block",
					type: "camera_control",
					keyword: "cc",
				},
				{
					kind: "block",
					type: "add_physics",
					keyword: "physics",
				},
			],
		},
		{
			kind: "category",
			name: "Control",
			icon: "./images/control.svg",
			colour: categoryColours["Control"],
			contents: [
				{
					kind: "block",
					type: "wait",
					keyword: "wait",
					inputs: {
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
					type: "wait_until",
					keyword: "until",
				},
				{
					kind: "block",
					type: "controls_repeat_ext",
					keyword: "repeat",
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
					keyword: "while",
				},
				{
					kind: "block",
					type: "controls_forEach",
					keyword: "each",
				},
				{
					kind: "block",
					type: "controls_for",
					keyword: "for",
				},
				{
					kind: "block",
					type: "local_variable",
					keyword: "local",
				},
			],
		},
		{
			kind: "category",
			name: "Condition",
			icon: "./images/conditions.svg",
			colour: categoryColours["Logic"],
			contents: [
				{
					kind: "block",
					type: "controls_if",
					keyword: "if",
				},
				{
					kind: "block",
					type: "controls_ifelse",
					keyword: "else",
				},
				{
					kind: "block",
					type: "logic_compare",
					keyword: "compare",
				},
				{
					kind: "block",
					type: "logic_operation",
					keyword: "op",
				},
				{
					kind: "block",
					type: "logic_negate",
					keyword: "not",
				},
				{
					kind: "block",
					type: "logic_boolean",
					keyword: "bool",
				},
				{
					kind: "block",
					type: "logic_null",
					keyword: "null",
				},
				{
					kind: "block",
					type: "logic_ternary",
					keyword: "ternary",
				},
			],
		},
		{
			kind: "category",
			name: "Sensing",
			icon: "./images/sensing.svg",
			colour: categoryColours["Sensing"],
			contents: [
				{
					kind: "block",
					type: "key_pressed",
					keyword: "ispressed",
				},
				{
					kind: "block",
					type: "touching_surface",
					keyword: "surface",
				},
				{
					kind: "block",
					type: "meshes_touching",
					keyword: "istouching",
				},
				{
					kind: "block",
					type: "get_property",
					keyword: "get",
				},
				{
					kind: "block",
					type: "distance_to",
					keyword: "dist",
				},
				{
					kind: "block",
					type: "time",
					keyword: "time",
				},
				{
					kind: "block",
					type: "canvas_controls",
					keyword: "canvas",
				},
				{
					kind: "block",
					type: "button_controls",
					keyword: "button",
					inputs: {
						COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#FFFFFF",
								},
							},
						},
					},
				},
			],
		},
		{
			kind: "category",
			name: "Text",
			icon: "./images/text.svg",
			categorystyle: "text_category",
			contents: [
				{
					kind: "block",
					type: "print_text",
					keyword: "print",
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
				{
					kind: "block",
					type: "ui_text",
					keyword: "ui",
					inputs: {
						TEXT: {
							shadow: {
								type: "text",
								fields: {
									TEXT: "Info",
								},
							},
						},
						DURATION: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
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
						X: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 100,
								},
							},
						},
						Y: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 50,
								},
							},
						},
						FONT_SIZE: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 24,
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "say",
					keyword: "say",
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
									NUM: 20,
								},
							},
						},
						TEXT_COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#000000",
								},
							},
						},
						BACKGROUND_COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#ffffff",
								},
							},
						},
					},
					fields: {
						MODE: "ADD",
					},
				},
				{
					kind: "block",
					type: "text",
					keyword: "text",
				},
				{
					kind: "block",
					type: "text_print",
					keyword: "alert",
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
					keyword: "join",
				},
				{
					kind: "block",
					type: "text_append",
					keyword: "join",
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
					keyword: "length",
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
					keyword: "isempty",
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
					keyword: "index",
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
					keyword: "charat",
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
					keyword: "substring",
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
					keyword: "case",
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
					keyword: "trim",
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
					keyword: "count",
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
					keyword: "replace",
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
					keyword: "reverse",
					inputs: {
						TEXT: {
							shadow: {
								type: "text",
							},
						},
					},
				},
				/*{
					kind: "label",
					text: "Input/Output:",
					"web-class": "ioLabel",
				},*/
				{
					kind: "block",
					type: "text_prompt_ext",
					keyword: "prompt",
					tooltip: "Ask the user for input.\nKeyword: prompt",
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
			name: "Materials",
			icon: "./images/looks.svg",
			colour: categoryColours["Materials"],
			contents: [
				{
					kind: "block",
					type: "tint",
					keyword: "tint",
					inputs: {
						COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#AA336A",
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "highlight",
					keyword: "highlight",
					inputs: {
						COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#FFD700",
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "change_colour",
					keyword: "colour",
					inputs: {
						COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#008080",
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "change_material",
					keyword: "material",
					inputs: {
						COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#008080",
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "material",
					inputs: {
						BASE_COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#FFFFFF",
								},
							},
						},
						EMISSIVE_COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#000000", // Default emissive color: black (no emission)
								},
							},
						},
						METALLIC: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0, // Default metallic value: 0 (non-metallic)
								},
							},
						},
						ROUGHNESS: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1, // Default roughness value: 1 (fully rough)
								},
							},
						},
						ALPHA: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1, // Default alpha value: 1 (fully opaque)
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "text_material",
					inputs: {
						TEXT: {
							shadow: {
								type: "text",
								fields: {
									TEXT: "😊",
								},
							},
						},
						COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#FF5733",
								},
							},
						},
						BACKGROUND_COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#FF5733",
								},
							},
						},
						WIDTH: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 50,
								},
							},
						},
						HEIGHT: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 50,
								},
							},
						},
						TEXT_SIZE: {
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
					type: "set_material",
					inputs: {
						MATERIAL: {
							shadow: {
								type: "material",
								inputs: {
									BASE_COLOR: {
										shadow: {
											type: "colour",
											fields: {
												COLOR: "#ff0000", // Default base color: red
											},
										},
									},
									EMISSIVE_COLOR: {
										shadow: {
											type: "colour",
											fields: {
												COLOR: "#000000", // Default emissive color: black (no emission)
											},
										},
									},
									METALLIC: {
										shadow: {
											type: "math_number",
											fields: {
												NUM: 0.0, // Default metallic value: 0
											},
										},
									},
									ROUGHNESS: {
										shadow: {
											type: "math_number",
											fields: {
												NUM: 1.0, // Default roughness value: 1 (fully rough)
											},
										},
									},
									ALPHA: {
										shadow: {
											type: "math_number",
											fields: {
												NUM: 1.0, // Default alpha value: 1 (fully opaque)
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
					type: "decal",
					inputs: {
						POSITION_X: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						POSITION_Y: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						POSITION_Z: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						NORMAL_X: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						NORMAL_Y: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
						NORMAL_Z: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						SIZE_X: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
						SIZE_Y: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
						SIZE_Z: {
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
					type: "place_decal",
					inputs: {
						ANGLE: {
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
					type: "set_alpha",
					keyword: "alpha",
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
					keyword: "clear",
				},
				{
					kind: "block",
					type: "colour",
					keyword: "color",
				},
				{
					kind: "block",
					type: "random_colour",
					keyword: "randcol",
				},
				{
					kind: "block",
					type: "colour_from_string",
					keyword: "colstr",
					inputs: {
						COLOR: {
							shadow: {
								type: "text",
								fields: {
									TEXT: "#800080",
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "scale",
					keyword: "scale",
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
									NUM: 1,
								},
							},
						},
						Z: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
					},
				},
			],
		},
		{
			kind: "category",
			name: "Sound",
			icon: "./images/sound.svg",
			colour: categoryColours["Sound"],
			contents: [
				{
					kind: "block",
					type: "play_sound",
					keyword: "sound",
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
				{
					kind: "block",
					type: "midi_note",
					fields: {
						NOTE: 60,
					},
				},
				{
					kind: "block",
					type: "rest",
				},
				{
					kind: "block",
					type: "play_notes",
					keyword: "play_notes",
					inputsInline: true, // Set lists to be inline
					inputs: {
						NOTES: {
							block: {
								type: "lists_create_with",
								inline: true,
								extraState: {
									itemCount: 1,
								},
								inputs: {
									ADD0: {
										block: {
											type: "midi_note",
											fields: {
												NOTE: 60, // Default MIDI note: 60 (Middle C)
											},
										},
									},
								},
							},
						},
						DURATIONS: {
							block: {
								type: "lists_create_with",
								inline: true,
								extraState: {
									itemCount: 1,
								},
								inputs: {
									ADD0: {
										block: {
											type: "math_number",
											fields: {
												NUM: 1, // Default duration: 1 beat
											},
										},
									},
								},
							},
						},
						INSTRUMENT: {
							shadow: {
								type: "instrument",
								fields: {
									INSTRUMENT_TYPE: "default", // Default instrument selection
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "set_scene_bpm",
					inputs: {
						BPM: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 60,
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "set_mesh_bpm",
					inputs: {
						BPM: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 60,
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "instrument",
				},
				{
					kind: "block",
					type: "create_instrument",
				},
			],
		},
		{
			kind: "category",
			name: "Variables",
			icon: "./images/variables.svg",
			colour: categoryColours["Variables"],
			custom: "VARIABLE",
			contents: [],
		},
		{
			kind: "category",
			name: "Lists",
			icon: "./images/lists.svg",
			colour: categoryColours["Lists"],
			contents: [
				{
					kind: "block",
					type: "lists_create_empty",
					keyword: "list",
				},
				{
					kind: "block",
					type: "lists_create_with",
					keyword: "these",
				},
				{
					kind: "block",
					type: "lists_repeat",
					keyword: "item*",
				},
				{
					kind: "block",
					type: "lists_length",
					keyword: "items",
				},
				{
					kind: "block",
					type: "lists_isEmpty",
					keyword: "noitems",
				},
				{
					kind: "block",
					type: "lists_indexOf",
					keyword: "find",
				},
				{
					kind: "block",
					type: "lists_getIndex",
					keyword: "lget",
				},
				{
					kind: "block",
					type: "lists_setIndex",
					keyword: "lset",
				},
				{
					kind: "block",
					type: "lists_getSublist",
					keyword: "sublist",
				},
				{
					kind: "block",
					type: "lists_split",
					keyword: "split",
				},
				{
					kind: "block",
					type: "lists_sort",
					keyword: "sort",
				},
			],
		},
		{
			kind: "category",
			name: "Math",
			icon: "./images/math.svg",
			colour: categoryColours["Math"],
			contents: [
				{
					kind: "block",
					type: "math_arithmetic",
					keyword: "math",
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
					keyword: "randint",
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
						SEED: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 123456, // Default seed value
								},
							},
						},
					},
				},
				{
					kind: "block",
					type: "math_number",
					keyword: "num",
					fields: {
						NUM: 0,
					},
				},
				{
					kind: "block",
					type: "to_number",
					keyword: "ton",
				},
				{
					kind: "block",
					type: "math_constant",
					keyword: "pi",
				},
				{
					kind: "block",
					type: "math_number_property",
					keyword: "even",
				},
				{
					kind: "block",
					type: "math_round",
					keyword: "round",
				},
				{
					kind: "block",
					type: "math_single",
					keyword: "abs",
					fields: {
						OP: "ABS",
					},
				},
				{
					kind: "block",
					type: "math_trig",
					keyword: "trig",
				},
				{
					kind: "block",
					type: "math_on_list",
					keyword: "lmath",
				},
				{
					kind: "block",
					type: "math_modulo",
					keyword: "mod",
				},
				{
					kind: "block",
					type: "math_constrain",
					keyword: "constrain",
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
					keyword: "randf",
				},
			],
		},
		{
			kind: "category",
			name: "Functions",
			icon: "./images/functions.svg",
			custom: "PROCEDURE",
			colour: "%{BKY_PROCEDURES_HUE}",
		},
		{
			kind: "category",
			icon: "./images/snippets.svg",
			colour: categoryColours["Snippets"],
			name: "Snippets",
			contents: [
				{
					kind: "block",
					type: "start",
					inputs: {
						DO: {
							block: {
								type: "load_character",
								fields: {
									MODELS: "Character1.glb",
									ID_VAR: {
										name: "player",
										type: "",
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
									HAIR_COLOR: {
										shadow: {
											type: "colour",
											fields: {
												COLOR: "#000000",
											},
										},
									},
									SKIN_COLOR: {
										shadow: {
											type: "skin_colour",
											fields: {
												COLOR: "#a15c33",
											},
										},
									},
									EYES_COLOR: {
										shadow: {
											type: "colour",
											fields: {
												COLOR: "#000000",
											},
										},
									},
									SLEEVES_COLOR: {
										shadow: {
											type: "colour",
											fields: {
												COLOR: "#008b8b",
											},
										},
									},
									SHORTS_COLOR: {
										shadow: {
											type: "colour",
											fields: {
												COLOR: "#00008b",
											},
										},
									},
									TSHIRT_COLOR: {
										shadow: {
											type: "colour",
											fields: {
												COLOR: "#ff8f60",
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
												type: "",
											},
											PHYSICS_TYPE: "DYNAMIC",
										},
										next: {
											block: {
												type: "camera_follow",
												fields: {
													MESH_VAR: {
														name: "player",
														type: "",
													},
												},
												inputs: {
													RADIUS: {
														block: {
															type: "math_number",
															fields: {
																NUM: 7,
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
				{
					kind: "block",
					type: "forever",
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
												KEY: "w",
											},
										},
									},
									DO0: {
										block: {
											type: "move_forward",
											fields: {
												MODEL: {
													name: "player",
													type: "",
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
															type: "",
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
												KEY: "s",
											},
										},
									},
									DO1: {
										block: {
											type: "move_forward",
											fields: {
												MODEL: {
													name: "player",
													type: "",
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
															type: "",
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
													type: "",
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

export const initialBlocksJson = {
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

class IconCategory extends Blockly.ToolboxCategory {
	constructor(categoryDef, toolbox, opt_parent) {
		super(categoryDef, toolbox, opt_parent);
	}

	addColourBorder_() {
		// Do nothing to prevent the colored block from being added
	}

	/** @override */
	createIconDom_() {
		const img = document.createElement("img");
		img.src = this.toolboxItemDef_.icon || "./default_icon.svg"; // Use a default icon if none provided
		img.alt = this.toolboxItemDef_.name + " icon";
		img.width = "24"; // Adjust as needed
		img.height = "24"; // Adjust as needed
		img.classList.add("customToolboxIcon");
		return img;
	}

	/** @override */
	createDom_() {
		super.createDom_();

		// Use the stored colour_ property for the tab colour
		const tabColour = this.colour_;

		// Apply custom class to the rowDiv_
		this.rowDiv_.classList.add("custom-category");

		// Set the background color of the category to match the tab colour
		if (tabColour) {
			this.rowDiv_.style.setProperty(
				"background-color",
				tabColour,
				"important",
			);
		}

		return this.htmlDiv_;
	}

	/** @override */
	setSelected(isSelected) {
		super.setSelected(isSelected);

		// Get the category color
		const categoryColour = this.colour_;

		// Change background color when selected/deselected
		if (isSelected) {
		} else {
			this.rowDiv_.style.setProperty(
				"background-color",
				categoryColour,
				"important",
			);
		}
	}
}

// Register the custom category
Blockly.registry.register(
	Blockly.registry.Type.TOOLBOX_ITEM,
	Blockly.ToolboxCategory.registrationName,
	IconCategory,
	true,
);

//iconImg.alt = this.toolboxItemDef_.name + ' icon';
