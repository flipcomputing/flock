import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
        getHelpUrlFor,
} from "../blocks.js";
import {
  materialNames,
} from "../config.js";
import { flock } from "../flock.js";
import { translate, getTooltip } from "../main/translation.js";

export function defineMaterialsBlocks() {

          Blockly.Blocks["change_color"] = {
                init: function () {
                  this.jsonInit({
                        type: "change_color",
                        message0: translate("change_color"),
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
                        tooltip: getTooltip("change_color"),
                  });
                  this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('materials_blocks');

                },
          };

          Blockly.Blocks["change_material"] = {
                init: function () {
                  this.jsonInit({
                        message0: translate("change_material"),
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
                        tooltip: getTooltip("change_material"),
                        previousStatement: null,
                        nextStatement: null,
                  });
                  this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('materials_blocks');

                },
          };

          Blockly.Blocks["text_material"] = {
                init: function () {
                  this.jsonInit({
                        type: "text_material",
                        message0: translate("text_material"),
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
                        tooltip: getTooltip("text_material"),
                  });
                  this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('materials_blocks');
                },
          };

          Blockly.Blocks["place_decal"] = {
                init: function () {
                  this.jsonInit({
                        message0: translate("place_decal"),
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
                        tooltip: getTooltip("place_decal"),
                  });
                  this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('materials_blocks');
                },
          };

          Blockly.Blocks["decal"] = {
                init: function () {
                  this.jsonInit({
                        type: "decal",
                        message0: translate("decal"),
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
                        tooltip: getTooltip("decal"),
                  });
                  this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('materials_blocks');
                },
          };

          Blockly.Blocks["highlight"] = {
                init: function () {
                  this.jsonInit({
                        type: "highlight",
                        message0: translate("highlight"),
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
                        tooltip: getTooltip("highlight"),
                  });
                  this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('materials_blocks');
                },
          };

          Blockly.Blocks["glow"] = {
                init: function () {
                  this.jsonInit({
                        type: "glow",
                        message0: translate("glow"),
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
                        tooltip: getTooltip("glow"),
                  });
                  this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('materials_blocks');
                },
          };

          Blockly.Blocks["tint"] = {
                init: function () {
                  this.jsonInit({
                        type: "tint",
                        message0: translate("tint"),
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
                        tooltip: getTooltip("tint"),
                  });
                  this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('materials_blocks');
                },
          };

          Blockly.Blocks["set_alpha"] = {
                init: function () {
                  this.jsonInit({
                        type: "set_mesh_material_alpha",
                        message0: translate("set_alpha"),
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
                        tooltip: getTooltip("set_alpha"),
                  });
                  this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('materials_blocks');
                },
          };

          Blockly.Blocks["clear_effects"] = {
                init: function () {
                  this.jsonInit({
                        type: "clear_effects",
                        message0: translate("clear_effects"),
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
                        tooltip: getTooltip("clear_effects"),
                  });
                  this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('materials_blocks');
                },
          };

        Blockly.Blocks["colour"] = {
                init: function () {
                  this.jsonInit({
                        type: "colour",
                        message0: translate("colour"),
                        args0: [
                          {
                                type: "field_colour",
                                name: "COLOR",
                                colour: "#9932CC",
                          },
                        ],
                        output: "Colour",
                        colour: categoryColours["Materials"],
                        tooltip: getTooltip("colour"),
                  });
                  this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('materials_blocks');
                },
          };

      // put this near your blocks file top
      const SKIN_HEXES = [
        "#2E1A1B","#37221D","#442B22","#6E473C","#926451","#966456","#D8A190","#E1BCB0","#EACDC7",
        "#290A0E","#34130A","#602C14","#884B2C","#C27753","#E89878","#EEA98A","#FECCC0","#FCDACE",
        "#2F2018","#41291C","#5A3C26","#845B40","#B98459","#D39E74","#E4BB9D","#EFCFB1","#ECD8C6",
        "#231304","#3E1C0A","#572E15","#AC6534","#D8945D","#F4B077","#FCC292","#FFD2AA","#FEE0C7",
        "#2D2113","#4F351F","#694831","#8F633E","#AD7D43","#C59B69","#DAB485","#E6CEAA","#E9D4B8",
        "#251601","#3F1F03","#5D340F","#8D521E","#D2894A","#F2AF6C","#F1C387","#F4D0A4","#F5DDBE",
        "#302418","#3C2D1B","#563E28","#7C6041","#957345","#9F7D4B","#CCB081","#DFCCA5","#E7DBC5",
        "#271D07","#442E0F","#64421B","#976E2F","#C69045","#D9A756","#EBC57E","#F4DBA6","#FBE6C1"
      ];

      // Use the hex strings themselves as the hover titles
      const SKIN_TITLES = SKIN_HEXES.map(h => h);

      Blockly.Blocks["skin_colour"] = {
        init: function () {
          this.jsonInit({
            type: "skin_colour",
            message0: translate("skin_colour"),
            args0: [
              {
                type: "field_colour",
                name: "COLOR",
                colour: "#FFE0BD",
                colourOptions: SKIN_HEXES,
                colourTitles: SKIN_TITLES,
                columns: 9  
              },
            ],
            output: "Colour",
            colour: categoryColours["Materials"],
            tooltip: getTooltip("skin_colour"),
          });
          this.setHelpUrl(getHelpUrlFor(this.type));
          this.setStyle('materials_blocks');
        },
      };

          Blockly.Blocks["greyscale_colour"] = {
                init: function () {
                  this.jsonInit({
                        type: "greyscale_colour",
                        message0: translate("greyscale_colour"),
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
                        tooltip: getTooltip("greyscale_colour"),
                  });
                  this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('materials_blocks');
                },
          };

          Blockly.Blocks["colour_from_string"] = {
                init: function () {
                  this.jsonInit({
                        message0: translate("colour_from_string"),
                        args0: [
                          {
                                type: "field_input",
                                name: "COLOR",
                                text: "#800080",
                          },
                        ],
                        output: "Colour",
                  });

                  const colorField = this.getField("COLOR");
                  colorField.setValidator(function (newVal) {
                        try {
                          const validatedVal = flock.getColorFromString(newVal) || "#000000";
                          this.sourceBlock_.setColour(validatedVal);
                          return newVal;
                        } catch (e) {
                          this.sourceBlock_.setColour("#000000");
                          return newVal;
                        }
                  });
                  
                  // Set initial block color based on the field's initial value
                  try {
                    const initialVal = colorField.getValue();
                    const validatedVal = flock.getColorFromString(initialVal) || "#000000";
                    this.setColour(validatedVal);
                  } catch (e) {
                    this.setColour("#000000");
                  }
                },
          };

          Blockly.Blocks["random_colour"] = {
                init: function () {
                  this.jsonInit({
                        type: "random_colour_block",
                        message0: translate("random_colour"),
                        output: "Colour",
                        colour: categoryColours["Materials"],
                        tooltip: getTooltip("random_colour"),
                  });
                  this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('materials_blocks');
                },
          };

          Blockly.Blocks["material"] = {
                init: function () {
                  this.jsonInit({
                        type: "material",
                        message0: translate("material"),

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
                        tooltip: getTooltip("material"),
                  });
                  this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('materials_blocks');
                },
          };

          Blockly.Blocks["gradient_material"] = {
                init: function () {
                  this.jsonInit({
                        type: "material",
                        message0: translate("gradient_material"),
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
                        tooltip: getTooltip("gradient_material"),
                  });
                  this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('materials_blocks');
                },
          };

          Blockly.Blocks["set_material"] = {
                init: function () {
                  this.jsonInit({
                        type: "set_material",
                        message0: translate("set_material"),
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
                        tooltip: getTooltip("set_material"),
                  });
                  this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('materials_blocks');
                },
          };
}

