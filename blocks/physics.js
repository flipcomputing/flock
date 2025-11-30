import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
        getHelpUrlFor,
} from "./blocks.js";
import { translate, getTooltip, getDropdownOption } from "../main/translation.js";

export function definePhysicsBlocks() {
          Blockly.Blocks["add_physics"] = {
                init: function () {
                  this.jsonInit({
                        type: "add_physics",
                        message0: translate("add_physics"),
                        args0: [
                          {
                                type: "field_variable",
                                name: "MODEL_VAR",
                                variable: window.currentMesh,
                          },
                          {
                                type: "field_dropdown",
                                name: "PHYSICS_TYPE",
                                options: [
                                  getDropdownOption("DYNAMIC"),
                                  getDropdownOption("ANIMATED"),
                                  getDropdownOption("STATIC"),
                                  getDropdownOption("NONE"),
                                ],
                                default: "DYNAMIC",
                          },
                        ],
                        previousStatement: null,
                        nextStatement: null,
                        colour: categoryColours["Transform"],
                        tooltip: getTooltip("add_physics"),
                  });
                  this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('transform_blocks');

                },
          };

          Blockly.Blocks["add_physics_shape"] = {
                init: function () {
                  this.jsonInit({
                        type: "add_physics_shape",
                        message0: translate("add_physics_shape"),
                        args0: [
                          {
                                type: "field_variable",
                                name: "MODEL_VAR",
                                variable: window.currentMesh,
                          },
                          {
                                type: "field_dropdown",
                                name: "SHAPE_TYPE",
                                options: [
                                  getDropdownOption("MESH"),
                                  getDropdownOption("CAPSULE"),
                                ],
                                default: "MESH",
                          },
                        ],
                        previousStatement: null,
                        nextStatement: null,
                        colour: categoryColours["Transform"],
                        tooltip: getTooltip("add_physics_shape"),
                  });
                  this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('transform_blocks');

                },
          };

          Blockly.Blocks["apply_force"] = {
                init: function () {
                  this.jsonInit({
                        type: "apply_force",
                        message0: translate("apply_force"),
                        args0: [
                          {
                                type: "field_variable",
                                name: "MESH_VAR",
                                variable: window.currentMesh,
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
                        colour: categoryColours["Transform"],
                        tooltip: getTooltip("apply_force"),
                  });
                  this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('transform_blocks');

                },
          };

          Blockly.Blocks["show_physics"] = {
                init: function () {
                  this.jsonInit({
                        type: "show_physics",
                        message0: translate("show_physics"),
                        args0: [
                          {
                                type: "field_checkbox",
                                name: "SHOW",
                                checked: true,
                          },
                        ],
                        previousStatement: null,
                        nextStatement: null,
                        colour: categoryColours["Transform"],
                        tooltip: getTooltip("show_physics"),
                  });
                  this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('transform_blocks');

                },
          };

      Blockly.Blocks["move_forward"] = {
            init: function () {
                  this.jsonInit({
                        type: "move",
                        message0: translate("move_forward"),
                        args0: [
                              {
                                    type: "field_variable",
                                    name: "MODEL",
                                    variable: window.currentMesh,
                              },
                              {
                                    type: "field_dropdown",
                                    name: "DIRECTION",
                                    options: [
                                          getDropdownOption("forward"),
                                          getDropdownOption("sideways"),
                                          getDropdownOption("strafe"),
                                    ],
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
                        colour: categoryColours["Transform"],
                        tooltip: getTooltip("move_forward"),
                  });
                  this.setHelpUrl(getHelpUrlFor(this.type));
                  this.setStyle('transform_blocks');
            },
      };
}

