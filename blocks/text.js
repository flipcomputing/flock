import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import { 
  getHelpUrlFor, 
  nextVariableIndexes,
} from "./blocks.js";
import { translate, getTooltip, getDropdownOption } from "../main/translation.js";

export function defineTextBlocks() {
        Blockly.Blocks["comment"] = {
                init: function () {
                        this.jsonInit({
                                type: "comment",
                                message0: translate("comment"),
                                args0: [
                                        {
                                                type: "input_value",
                                                name: "COMMENT",
                                                check: "String",
                                        },
                                ],
                                inputsInline: true,
                                previousStatement: null,
                                nextStatement: null,
                                colour: "#d3d3d3",
                                tooltip: getTooltip("comment"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('text_blocks');
                },
        };

        Blockly.Blocks["print_text"] = {
                init: function () {
                        this.jsonInit({
                                type: "print_text",
                                message0: translate("print_text"),
                                args0: [
                                        {
                                                type: "input_value",
                                                name: "TEXT",
                                                check: ["String", "Number", "Array"],
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
                                tooltip: getTooltip("print_text"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('text_blocks');
                },
        };

        Blockly.Blocks["say"] = {
                init: function () {
                        this.jsonInit({
                                type: "say",
                                message0: translate("say"),
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
                                                variable: window.currentMesh,
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
                                                        getDropdownOption("ADD"),
                                                        getDropdownOption("REPLACE"),
                                                ],
                                        },
                                        {
                                                type: "field_dropdown",
                                                name: "ASYNC",
                                                options: [
                                                        getDropdownOption("START"),
                                                        getDropdownOption("AWAIT"),
                                                ],
                                        },
                                ],
                                inputsInline: true,
                                previousStatement: null,
                                nextStatement: null,
                                colour: 160,
                                tooltip: getTooltip("say"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('text_blocks');
                },
        };

        Blockly.Blocks["ui_text"] = {
                init: function () {
                        this.jsonInit({
                                type: "ui_text",
                                message0: translate("ui_text"),
                                args0: [
                                        {
                                                type: "input_value",
                                                name: "TEXT",
                                                check: "String",
                                        },
                                        {
                                                type: "field_variable",
                                                name: "TEXTBLOCK_VAR", // Variable to store the TextBlock reference
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
                                                name: "FONT_SIZE",
                                                check: "Number",
                                        },
                                        {
                                                type: "input_value",
                                                name: "DURATION",
                                                check: "Number",
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
                                colour: categoryColours["Text"],
                                tooltip: getTooltip("ui_text"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('text_blocks');
                },
        };

        Blockly.Blocks["ui_button"] = {
                init: function () {
                        this.jsonInit({
                                type: "ui_button",
                                message0: translate("ui_button"),
                                args0: [
                                        {
                                                type: "input_value",
                                                name: "TEXT",
                                                check: "String",
                                        },
                                        {
                                                type: "field_variable",
                                                name: "BUTTON_VAR", // Variable to store the Button reference
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
                                                type: "field_dropdown",
                                                name: "SIZE",
                                                options: [
                                                        getDropdownOption("SMALL"),
                                                        getDropdownOption("MEDIUM"),
                                                        getDropdownOption("LARGE"),
                                                ],
                                        },
                                        {
                                                type: "field_dropdown",
                                                name: "TEXT_SIZE",
                                                options: [
                                                        getDropdownOption("14px"),
                                                        getDropdownOption("18px"),
                                                        getDropdownOption("24px"),
                                                ],
                                        },
                                        {
                                                type: "input_value",
                                                name: "TEXT_COLOR",
                                                check: "Colour",
                                        },
                                        {
                                                type: "input_value",
                                                name: "BACKGROUND_COLOR",
                                                check: "Colour",
                                        },
                                ],
                                inputsInline: true,
                                previousStatement: null,
                                nextStatement: null,
                                colour: categoryColours["Text"],
                                tooltip: getTooltip("ui_button"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('text_blocks');
                },
        };

        Blockly.Blocks["ui_input"] = {
          init: function () {
                this.jsonInit({
                  type: "ui_input",
                  message0: translate("ui_input"),
                  args0: [
                        {
                          type: "field_variable",
                          name: "INPUT_VAR",
                        },
                        {
                          type: "input_value",
                          name: "TEXT",
                          check: "String",
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
                          type: "field_dropdown",
                          name: "SIZE",
                          options: [
                                getDropdownOption("SMALL"),
                                getDropdownOption("MEDIUM"),
                                getDropdownOption("LARGE"),
                          ],
                        },
                        {
                          type: "input_value",
                          name: "TEXT_SIZE",
                          check: "Number",
                        },
                        {
                          type: "input_value",
                          name: "TEXT_COLOR",
                          check: "Colour",
                        },
                        {
                          type: "input_value",
                          name: "BACKGROUND_COLOR",
                          check: "Colour",
                        },
                  ],
                  inputsInline: true,
                  previousStatement: null,
                  nextStatement: null,
                  colour: categoryColours["Text"],
                  tooltip: getTooltip("ui_input"),
                });

                this.setHelpUrl(getHelpUrlFor(this.type));
                  this.setStyle('text_blocks');
          },
        };


        Blockly.Blocks["create_3d_text"] = {
                init: function () {
                        const variableNamePrefix = "text";
                        let nextVariableName =
                                variableNamePrefix + nextVariableIndexes[variableNamePrefix];

                        this.jsonInit({
                                message0: translate("create_3d_text"),
                                args0: [
                                        {
                                                type: "field_variable",
                                                name: "ID_VAR",
                                                variable: nextVariableName,
                                        },
                                        {
                                                type: "input_value",
                                                name: "TEXT",
                                                check: "String",
                                        },
                                        {
                                                type: "field_dropdown",
                                                name: "FONT",
                                                options: [
              getDropdownOption("__fonts_FreeSans_Bold_json"),
            ],
                                        },
                                        {
                                                type: "input_value",
                                                name: "SIZE",
                                                check: "Number",
                                        },
                                        {
                                                type: "input_value",
                                                name: "COLOR",
                                                check: "Colour",
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
                                inputsInline: true,
                                colour: categoryColours["Text"],
                                tooltip: getTooltip("create_3d_text"),
                                previousStatement: null,
                                nextStatement: null,
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('text_blocks');
                },
        };
}
