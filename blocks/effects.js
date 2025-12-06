import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import { getHelpUrlFor } from "./blocks.js";
import {
        translate,
        getTooltip,
        getDropdownOption,
} from "../main/translation.js";

export function defineEffectsBlocks() {
        Blockly.Blocks["main_light"] = {
                init: function () {
                        this.jsonInit({
                                type: "main_light",
                                message0: translate("main_light"),
                                args0: [
                                        {
                                                type: "input_value",
                                                name: "INTENSITY",
                                                check: "Number",
                                        },
                                        {
                                                type: "input_value",
                                                name: "DIFFUSE",
                                                check: "Colour",
                                        },
                                        {
                                                type: "input_value",
                                                name: "GROUND_COLOR",
                                                check: "Colour",
                                        },
                                ],
                                inputsInline: true,
                                previousStatement: null,
                                nextStatement: null,
                                colour: categoryColours["Scene"],
                                tooltip: getTooltip("main_light"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("scene_blocks");
                },
        };

        Blockly.Blocks["set_fog"] = {
                init: function () {
                        this.jsonInit({
                                type: "set_fog",
                                message0: translate("set_fog"),
                                args0: [
                                        {
                                                type: "input_value",
                                                name: "FOG_COLOR",
                                                colour: "#ffffff",
                                                check: "Colour",
                                        },
                                        {
                                                type: "field_dropdown",
                                                name: "FOG_MODE",
                                                options: [
                                                        getDropdownOption("LINEAR"),
                                                        getDropdownOption("NONE"),
                                                        getDropdownOption("EXP"),
                                                        getDropdownOption("EXP2"),
                                                ],
                                        },
                                        {
                                                type: "input_value",
                                                name: "DENSITY",
                                                check: "Number",
                                        },
                                        {
                                                type: "input_value",
                                                name: "START",
                                                check: "Number",
                                        },
                                        {
                                                type: "input_value",
                                                name: "END",
                                                check: "Number",
                                        },
                                ],
                                inputsInline: true,
                                previousStatement: null,
                                nextStatement: null,
                                colour: categoryColours["Scene"],
                                tooltip: getTooltip("set_fog"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("scene_blocks");
                },
        };

        Blockly.Blocks["get_light"] = {
                init: function () {
                        this.jsonInit({
                                type: "get_light",
                                message0: translate("get_light"),
                                args0: [
                                        {
                                                type: "field_variable",
                                                name: "VAR",
                                                variable: "light", // Default variable is 'camera'
                                        },
                                ],
                                previousStatement: null,
                                nextStatement: null,
                                colour: categoryColours["Scene"],
                                tooltip: getTooltip("get_light"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('scene_blocks');
                },
        };
}
