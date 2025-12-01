import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
        getHelpUrlFor,
        addToggleButton,
        mutationToDom,
        domToMutation,
        inlineIcon,
        updateShape,
} from "./blocks.js";
import {
        translate,
        getTooltip,
        getOption,
        getDropdownOption,
} from "../main/translation.js";

export function defineSensingBlocks() {
        Blockly.Blocks["key_pressed"] = {
                init: function () {
                        this.jsonInit({
                                type: "key_pressed",
                                message0: translate("key_pressed"),
                                args0: [
                                        {
                                                type: "field_dropdown",
                                                name: "KEY",
                                                options: [
                                                        getDropdownOption("ANY"),
                                                        getDropdownOption("NONE"),
                                                        getDropdownOption("w"),
                                                        getDropdownOption("a"),
                                                        getDropdownOption("s"),
                                                        getDropdownOption("d"),
                                                        [getOption("space_infinity"), " "],
                                                        [getOption("q_icon"), "q"],
                                                        [getOption("e_icon"), "e"],
                                                        [getOption("f_icon"), "f"],
                                                ],
                                        },
                                ],
                                output: "Boolean",
                                colour: categoryColours["Sensing"],
                                tooltip: getTooltip("key_pressed"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("sensing_blocks");
                },
        };

        Blockly.Blocks["action_pressed"] = {
                init: function () {
                        this.jsonInit({
                                type: "action_pressed",
                                message0: translate("action_pressed"),
                                args0: [
                                        {
                                                type: "field_dropdown",
                                                name: "ACTION",
                                                options: [
                                                        getDropdownOption("ACTION_FORWARD"),
                                                        getDropdownOption("ACTION_BACKWARD"),
                                                        getDropdownOption("ACTION_LEFT"),
                                                        getDropdownOption("ACTION_RIGHT"),
                                                        getDropdownOption("ACTION_BUTTON1"),
                                                        getDropdownOption("ACTION_BUTTON2"),
                                                        getDropdownOption("ACTION_BUTTON3"),
                                                        getDropdownOption("ACTION_BUTTON4"),
                                                ],
                                        },
                                ],
                                output: "Boolean",
                                colour: categoryColours["Sensing"],
                                tooltip: getTooltip("action_pressed"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("sensing_blocks");
                },
        };

        Blockly.Blocks["meshes_touching"] = {
                init: function () {
                        this.jsonInit({
                                type: "meshes_are_touching",
                                message0: translate("meshes_touching"),
                                args0: [
                                        {
                                                type: "field_variable",
                                                name: "MESH1",
                                                variable: window.currentMesh,
                                        },
                                        {
                                                type: "field_variable",
                                                name: "MESH2",
                                                variable: "object2",
                                        },
                                ],
                                output: "Boolean",
                                colour: categoryColours["Sensing"],
                                tooltip: getTooltip("meshes_touching"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("sensing_blocks");
                },
        };

        Blockly.Blocks["time"] = {
                init: function () {
                        this.jsonInit({
                                type: "time",
                                message0: translate("time"),
                                args0: [],
                                output: "Number",
                                colour: categoryColours["Sensing"], // Adjust the colour category as necessary
                                inputsInline: true,
                                tooltip: getTooltip("time"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("sensing_blocks");
                },
        };

        Blockly.Blocks["distance_to"] = {
                init: function () {
                        this.jsonInit({
                                type: "distance_to",
                                message0: translate("distance_to"),
                                args0: [
                                        {
                                                type: "field_variable",
                                                name: "MODEL1",
                                                variable: window.currentMesh,
                                        },
                                        {
                                                type: "field_variable",
                                                name: "MODEL2",
                                                variable: "object2",
                                        },
                                ],
                                output: "Number",
                                colour: categoryColours["Sensing"],
                                inputsInline: true,
                                tooltip: getTooltip("distance_to"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("sensing_blocks");
                },
        };

        Blockly.Blocks["touching_surface"] = {
                init: function () {
                        this.jsonInit({
                                type: "touching_surface",
                                message0: translate("touching_surface"),
                                args0: [
                                        {
                                                type: "field_variable",
                                                name: "MODEL_VAR",
                                                variable: window.currentMesh,
                                        },
                                ],
                                output: "Boolean",
                                colour: categoryColours["Sensing"],
                                tooltip: getTooltip("touching_surface"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("sensing_blocks");
                },
        };

        Blockly.Blocks["mesh_exists"] = {
                init: function () {
                        this.jsonInit({
                                type: "mesh_exists",
                                message0: "%1 exists",
                                args0: [
                                        {
                                                type: "field_variable",
                                                name: "MODEL_VAR",
                                                variable: window.currentMesh,
                                        },
                                ],
                                output: "Boolean",
                                colour: categoryColours["Sensing"],
                                tooltip:
                                        "Returns true if the mesh with this name is present in the scene.",
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("sensing_blocks");
                },
        };

        Blockly.Blocks["get_property"] = {
                init: function () {
                        this.jsonInit({
                                type: "get_property",
                                message0: translate("get_property"),
                                args0: [
                                        {
                                                type: "field_dropdown",
                                                name: "PROPERTY",
                                                options: [
                                                        getDropdownOption("POSITION_X"),
                                                        getDropdownOption("POSITION_Y"),
                                                        getDropdownOption("POSITION_Z"),
                                                        getDropdownOption("ROTATION_X"),
                                                        getDropdownOption("ROTATION_Y"),
                                                        getDropdownOption("ROTATION_Z"),
                                                        getDropdownOption("MIN_X"),
                                                        getDropdownOption("MAX_X"),
                                                        getDropdownOption("MIN_Y"),
                                                        getDropdownOption("MAX_Y"),
                                                        getDropdownOption("MIN_Z"),
                                                        getDropdownOption("MAX_Z"),
                                                        getDropdownOption("SCALE_X"),
                                                        getDropdownOption("SCALE_Y"),
                                                        getDropdownOption("SCALE_Z"),
                                                        getDropdownOption("SIZE_X"),
                                                        getDropdownOption("SIZE_Y"),
                                                        getDropdownOption("SIZE_Z"),
                                                        getDropdownOption("VISIBLE"),
                                                        getDropdownOption("ALPHA"),
                                                        getDropdownOption("COLOUR"),
                                                ],
                                        },
                                        {
                                                type: "field_variable",
                                                name: "MESH",
                                                variable: window.currentMesh,
                                        },
                                ],
                                output: null,
                                colour: categoryColours["Sensing"],
                                tooltip: getTooltip("get_property"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("sensing_blocks");
                },
        };

        Blockly.Blocks["canvas_controls"] = {
                init: function () {
                        this.jsonInit({
                                type: "canvas_controls",
                                message0: translate("canvas_controls"),
                                args0: [
                                        {
                                                type: "field_checkbox",
                                                name: "CONTROLS",
                                                checked: true,
                                        },
                                ],
                                previousStatement: null,
                                nextStatement: null,
                                colour: categoryColours["Sensing"],
                                tooltip: getTooltip("canvas_controls"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("sensing_blocks");
                },
        };

        Blockly.Blocks["button_controls"] = {
                init: function () {
                        this.jsonInit({
                                type: "button_controls",
                                message0: translate("button_controls"),
                                args0: [
                                        {
                                                type: "field_dropdown",
                                                name: "CONTROL",
                                                options: [
                                                        getDropdownOption("BOTH"),
                                                        getDropdownOption("ARROWS"),
                                                        getDropdownOption("ACTIONS"),
                                                ],
                                        },
                                        {
                                                type: "field_checkbox",
                                                name: "ENABLED",
                                                checked: true,
                                        },
                                        {
                                                type: "input_value",
                                                name: "COLOR",
                                                check: "Colour",
                                        },
                                ],
                                previousStatement: null,
                                nextStatement: null,
                                colour: categoryColours["Sensing"],
                                tooltip: getTooltip("button_controls"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("sensing_blocks");
                },
        };

        Blockly.Blocks["microbit_input"] = {
                init: function () {
                        this.jsonInit({
                                type: "microbit_input",
                                message0: translate("microbit_input"),
                                args0: [
                                        {
                                                type: "field_dropdown",
                                                name: "EVENT",
                                                options: [
                                                        [getOption("pin_0"), "0"],
                                                        [getOption("pin_1"), "1"],
                                                        [getOption("pin_2"), "2"],
                                                        [getOption("pin_l"), "l"],
                                                        [getOption("pin_j"), "j"],
                                                        [getOption("pin_h"), "h"],
                                                        [getOption("pin_k"), "k"],
                                                        [getOption("pin_space"), " "],
                                                        [getOption("pin_q"), "q"],
                                                        [getOption("pin_r"), "r"],
                                                        [getOption("pin_t"), "t"],
                                                        [getOption("pin_o"), "o"],
                                                        [getOption("pin_p"), "p"],
                                                        [getOption("pin_a"), "a"],
                                                        [getOption("pin_d"), "d"],
                                                        [getOption("pin_y"), "y"],
                                                        [getOption("pin_h"), "h"],
                                                        [getOption("pin_i"), "i"],
                                                ],
                                        },
                                ],
                                message1: "%1",
                                args1: [
                                        {
                                                type: "input_statement",
                                                name: "DO",
                                        },
                                ],
                                colour: categoryColours["Sensing"],
                                tooltip: getTooltip("microbit_input"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("sensing_blocks");

                        addToggleButton(this);
                },
                mutationToDom: function () {
                        return mutationToDom(this);
                },
                domToMutation: function (xmlElement) {
                        domToMutation(this, xmlElement);
                },
                updateShape_: function (isInline) {
                        updateShape(this, isInline);
                },
                toggleDoBlock: function () {
                        this.updateShape_(!this.isInline);
                },
        };
        Blockly.Blocks["ui_slider"] = {
                init: function () {
                        this.jsonInit({
                                type: "ui_slider",
                                message0: translate("ui_slider"),
                                args0: [
                                        {
                                                type: "field_variable",
                                                name: "SLIDER_VAR",
                                        },
                                        {
                                                type: "input_value",
                                                name: "MIN",
                                                check: "Number",
                                        },
                                        {
                                                type: "input_value",
                                                name: "MAX",
                                                check: "Number",
                                        },
                                        {
                                                type: "input_value",
                                                name: "VALUE",
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
                                                name: "COLOR",
                                                check: "Colour",
                                        },
                                        {
                                                type: "input_value",
                                                name: "BACKGROUND",
                                                check: "Colour",
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
                                ],
                                inputsInline: true,
                                previousStatement: null,
                                nextStatement: null,
                                colour: categoryColours["Text"],
                                tooltip: getTooltip("ui_slider"),
                        });

                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("text_blocks");
                },
        };
}
