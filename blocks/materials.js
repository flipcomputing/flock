import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
	getHelpUrlFor,
} from "../blocks.js";
import {
  materialNames,
} from "../config.js";
import { flock } from "../flock.js";

export function defineMaterialsBlocks() {

	  Blockly.Blocks["change_color"] = {
		init: function () {
		  this.jsonInit({
			type: "change_color",
			message0: "color %1 to %2",
			args0: [
			  {
				type: "field_variable",
				name: "MODEL_VAR",
				variable: window.currentMesh,
			  },
			  {
				type: "input_value",
				name: "COLOR",
				check: ["Colour", "Array"], // Accepts either Colour or Array
			  },
			],
			inputsInline: true,
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Materials"],
			tooltip: "Change the color of the selected mesh.\nKeyword: color",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
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
				check: ["Colour", "Array"], // Accepts either Colour or Array
			  },
			],
			inputsInline: true,
			colour: categoryColours["Materials"],
			tooltip:
			  "Apply a selected material with a colour tint to the specified mesh.\nKeyword: material",
			previousStatement: null,
			nextStatement: null,
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
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
			colour: categoryColours["Materials"],
			tooltip:
			  "Create a material with text or emoji, specifying width, height, background color, and text size.",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
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
			colour: categoryColours["Materials"],
			tooltip: "Place a decal on a mesh using the selected material.",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
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
			colour: categoryColours["Materials"],
			tooltip:
			  "Create a decal on a mesh with position, normal, size, and material.",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
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
			colour: categoryColours["Materials"],
			tooltip: "Highlight the selected mesh.\nKeyword: highlight",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["glow"] = {
		init: function () {
		  this.jsonInit({
			type: "glow",
			message0: "glow %1",
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
			colour: categoryColours["Materials"],
			tooltip: "Adds a glow effect to the selected mesh.\nKeyword: glow",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
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
			colour: categoryColours["Materials"],
			tooltip: "Add colour tint effect.\nKeyword: tint",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
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
			colour: categoryColours["Materials"],
			tooltip:
			  "Set the alpha (transparency) of the material(s) on a specified mesh. Values should be 0 to 1.\nKeyword:alpha",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
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
			colour: categoryColours["Materials"],
			tooltip: "Clear visual effects from selected mesh.\nKeyword: clear",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
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
			colour: categoryColours["Materials"],
			tooltip: "Pick a colour.\nKeyword: color",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
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
				colour: "#FFE0BD",
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
			colour: categoryColours["Materials"],
			tooltip: "Pick a skin colour.\nKeyword: skin",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
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
			colour: categoryColours["Materials"], // You can set this to any colour category you prefer
			tooltip: "Pick a greyscale colour for elevation.\nKeyword: grey",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["colour_from_string"] = {
		init: function () {
		  this.jsonInit({
			message0: "- %1 -",
			args0: [
			  {
				type: "field_input",
				name: "COLOR",
				text: "#800080",
			  },
			],
			output: "Colour",
		  });

		  this.getField("COLOR").setValidator(function (newVal) {
			const validatedVal = flock.getColorFromString(newVal) || "#000000";
			this.sourceBlock_.setColour(validatedVal);
			return newVal;
		  });
		},
	  };

	  Blockly.Blocks["random_colour"] = {
		init: function () {
		  this.jsonInit({
			type: "random_colour_block",
			message0: "random color",
			output: "Colour",
			colour: categoryColours["Materials"],
			tooltip: "Generate a random colour.\nKeyword: randcol",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["material"] = {
		init: function () {
		  this.jsonInit({
			type: "material",
			message0: "material %1 %2 alpha %3",

			args0: [
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
				name: "BASE_COLOR",
				colour: "#ffffff", // Default to white
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
			colour: categoryColours["Materials"],
			tooltip: "Define material properties",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["gradient_material"] = {
		init: function () {
		  this.jsonInit({
			type: "material",
			message0: "material %1 alpha %2",
			args0: [
			  {
				type: "input_value",
				name: "COLOR",
				colour: "#6495ED",
				check: ["Colour", "Array"],
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
			colour: categoryColours["Materials"],
			tooltip: "Define material properties",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
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
				check: ["Material", "Array"], // Ensure it only accepts blocks that output a Material
			  },
			],
			previousStatement: null,
			nextStatement: null,
			inputsInline: true,
			colour: categoryColours["Materials"],
			tooltip: "Set the specified material on the given mesh.",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };
}
