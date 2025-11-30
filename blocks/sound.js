import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
        nextVariableIndexes,
        handleBlockCreateEvent,
        getHelpUrlFor,
} from "./blocks.js";
import { audioNames } from "../config.js";
import {
        translate,
        getTooltip,
        getDropdownOption,
} from "../main/translation.js";

export function defineSoundBlocks() {
        Blockly.Blocks["play_sound"] = {
                init: function () {
                        let nextVariableName = "sound" + nextVariableIndexes["sound"];
                        this.jsonInit({
                                type: "play_sound",
                                message0: translate("play_sound"),
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
                                                type: "input_dummy",
                                                name: "MESH_INPUT", // Dummy input for the dropdown
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
                                                        getDropdownOption("ONCE"),
                                                        getDropdownOption("LOOP"),
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
                                colour: categoryColours["Sound"],
                                tooltip: getTooltip("play_sound"),
                                extensions: ["dynamic_mesh_dropdown"], // Attach the extension
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('sound_blocks');
                },
        };

        Blockly.Blocks["stop_all_sounds"] = {
                init: function () {
                        this.jsonInit({
                                message0: translate("stop_all_sounds"),
                                previousStatement: null,
                                nextStatement: null,
                                colour: categoryColours["Sound"],
                                tooltip: getTooltip("stop_all_sounds"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('sound_blocks');

                },
        };

        Blockly.Blocks["midi_note"] = {
                init: function () {
                        this.jsonInit({
                                type: "midi_note",
                                message0: translate("midi_note"),
                                args0: [
                                        {
                                                type: "field_number",
                                                name: "NOTE",
                                                value: 60, // Default is Middle C
                                                min: 0,
                                                max: 127,
                                                precision: 1,
                                        },
                                ],
                                output: "Number",
                                colour: categoryColours["Sound"],
                                tooltip: getTooltip("midi_note"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('sound_blocks');

                },
        };

        Blockly.Blocks["rest"] = {
                init: function () {
                        this.jsonInit({
                                type: "rest",
                                message0: translate("rest"),
                                output: "Null",
                                colour: categoryColours["Sound"],
                                tooltip: getTooltip("rest"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('sound_blocks');

                },
        };

        Blockly.Blocks["play_notes"] = {
                init: function () {
                        this.jsonInit({
                                type: "play_notes",
                                message0: translate("play_notes"),
                                args0: [
                                        {
                                                type: "field_variable",
                                                name: "MESH",
                                                variable: window.currentMesh,
                                        },
                                        {
                                                type: "input_value",
                                                name: "NOTES",
                                                check: "Array",
                                        },
                                        {
                                                type: "input_value",
                                                name: "DURATIONS",
                                                check: "Array",
                                        },
                                        {
                                                type: "input_value",
                                                name: "INSTRUMENT",
                                                check: "Instrument",
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
                                colour: categoryColours["Sound"],
                                tooltip: getTooltip("play_notes"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('sound_blocks');

                },
        };

        Blockly.Blocks["set_scene_bpm"] = {
                init: function () {
                        this.jsonInit({
                                type: "set_scene_bpm",
                                message0: translate("set_scene_bpm"),
                                args0: [
                                        {
                                                type: "input_value",
                                                name: "BPM",
                                                check: "Number",
                                        },
                                ],
                                inputsInline: true,
                                previousStatement: null,
                                nextStatement: null,
                                colour: categoryColours["Sound"], // Assuming "Sound" category
                                tooltip: getTooltip("set_scene_bpm"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('sound_blocks');

                },
        };

        Blockly.Blocks["set_mesh_bpm"] = {
                init: function () {
                        this.jsonInit({
                                type: "set_mesh_bpm",
                                message0: translate("set_mesh_bpm"),
                                args0: [
                                        {
                                                type: "field_variable",
                                                name: "MESH",
                                                variable: window.currentMesh,
                                        },
                                        {
                                                type: "input_value",
                                                name: "BPM",
                                                check: "Number",
                                        },
                                ],
                                inputsInline: true,
                                previousStatement: null,
                                nextStatement: null,
                                colour: categoryColours["Sound"], // Assuming "Sound" category
                                tooltip: getTooltip("set_mesh_bpm"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('sound_blocks');

                },
        };

        Blockly.Blocks["create_instrument"] = {
                init: function () {
                        const variableNamePrefix = "instrument";
                        let nextVariableName =
                                variableNamePrefix + nextVariableIndexes[variableNamePrefix];
                        this.jsonInit({
                                type: "create_instrument",
                                message0: translate("create_instrument"),
                                args0: [
                                        {
                                                type: "field_variable",
                                                name: "INSTRUMENT",
                                                variable: nextVariableName,
                                        },
                                        {
                                                type: "field_dropdown",
                                                name: "TYPE",
                                                options: [
                                                        getDropdownOption("sine"),
                                                        getDropdownOption("square"),
                                                        getDropdownOption("sawtooth"),
                                                        getDropdownOption("triangle"),
                                                ],
                                        },
                                        {
                                                type: "field_number",
                                                name: "FREQUENCY",
                                                value: 440,
                                                min: 20,
                                                max: 20000,
                                                precision: 1,
                                        },
                                        {
                                                type: "field_number",
                                                name: "ATTACK",
                                                value: 0.1,
                                                min: 0,
                                                max: 5,
                                                precision: 0.01,
                                        },
                                        {
                                                type: "field_number",
                                                name: "DECAY",
                                                value: 0.5,
                                                min: 0,
                                                max: 5,
                                                precision: 0.01,
                                        },
                                        {
                                                type: "field_number",
                                                name: "SUSTAIN",
                                                value: 0.7,
                                                min: 0,
                                                max: 1,
                                                precision: 0.01,
                                        },
                                        {
                                                type: "field_number",
                                                name: "RELEASE",
                                                value: 1.0,
                                                min: 0,
                                                max: 5,
                                                precision: 0.01,
                                        },
                                ],
                                previousStatement: null,
                                nextStatement: null,
                                colour: categoryColours["Sound"],
                                tooltip: getTooltip("create_instrument"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('sound_blocks');

                        this.setOnChange((changeEvent) => {
                                handleBlockCreateEvent(
                                        this,
                                        changeEvent,
                                        variableNamePrefix,
                                        nextVariableIndexes,
                                );
                        });
                },
        };

        Blockly.Blocks["instrument"] = {
                init: function () {
                        this.jsonInit({
                                type: "instrument",
                                message0: translate("instrument"),
                                args0: [
                                        {
                                                type: "field_dropdown",
                                                name: "INSTRUMENT_TYPE",
                                                options: [
                                                        getDropdownOption("default"),
                                                        getDropdownOption("piano"),
                                                        getDropdownOption("guitar"),
                                                        getDropdownOption("violin"),
                                                ],
                                        },
                                ],
                                output: "Instrument",
                                colour: categoryColours["Sound"],
                                tooltip: getTooltip("instrument"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('sound_blocks');

                },
        };

        Blockly.Blocks["speak"] = {
                init: function () {
                        this.jsonInit({
                                type: "speak",
                                message0: translate("speak"),
                                args0: [
                                        {
                                                type: "input_value",
                                                name: "TEXT",
                                                check: "String",
                                        },
                                        {
                                                type: "input_dummy",
                                                name: "MESH_INPUT", // Dummy input for the dropdown
                                        },

                                        {
                                                type: "field_dropdown",
                                                name: "VOICE",
                                                options: [
                                                        getDropdownOption("female"),
                                                        getDropdownOption("male"),
                                                ],
                                        },
                                        {
                                                type: "field_dropdown",
                                                name: "LANGUAGE",
                                                options: [
                                                        getDropdownOption("en-GB"),
                                                        getDropdownOption("en-US"),
                                                ],
                                        },
                                        {
                                                type: "input_value",
                                                name: "RATE",
                                                check: "Number",
                                        },
                                        {
                                                type: "input_value",
                                                name: "PITCH",
                                                check: "Number",
                                        },
                                        {
                                                type: "input_value",
                                                name: "VOLUME",
                                                check: "Number",
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
                                colour: categoryColours["Sound"],
                                tooltip: getTooltip("speak"),
                                extensions: ["dynamic_mesh_dropdown"], // Attach the extension
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle('sound_blocks');

                },
        };
}
