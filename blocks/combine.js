import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
        getHelpUrlFor,
        nextVariableIndexes,
        handleBlockCreateEvent,
} from "./blocks.js";
import { translate, getTooltip } from "../main/translation.js";

export function defineCombineBlocks() {
        Blockly.Blocks["merge_meshes"] = {
                init: function () {
                        const variableNamePrefix = "merged";
                        const nextVariableName =
                                variableNamePrefix +
                                nextVariableIndexes[variableNamePrefix];

                        this.jsonInit({
                                type: "merge_meshes",
                                message0: translate("merge_meshes"),
                                args0: [
                                        {
                                                type: "field_variable",
                                                name: "RESULT_VAR",
                                                variable: nextVariableName,
                                        },
                                        {
                                                type: "input_value",
                                                name: "MESH_LIST",
                                                check: "Array",
                                        },
                                ],
                                colour: categoryColours["Transform"],
                                tooltip: getTooltip("merge_meshes"),
                                previousStatement: null,
                                nextStatement: null,
                        });

                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("transform_blocks");

                        this.setOnChange((changeEvent) =>
                                handleBlockCreateEvent(
                                        this,
                                        changeEvent,
                                        variableNamePrefix,
                                        nextVariableIndexes,
                                        "RESULT_VAR",
                                ),
                        );
                },
        };

        Blockly.Blocks["subtract_meshes"] = {
                init: function () {
                        const variableNamePrefix = "subtracted";
                        const nextVariableName =
                                variableNamePrefix +
                                nextVariableIndexes[variableNamePrefix];

                        this.jsonInit({
                                type: "subtract_meshes",
                                message0: translate("subtract_meshes"),
                                args0: [
                                        {
                                                type: "field_variable",
                                                name: "RESULT_VAR",
                                                variable: nextVariableName,
                                        },
                                        {
                                                type: "field_variable",
                                                name: "BASE_MESH",
                                                variable: "object",
                                        },
                                        {
                                                type: "input_value",
                                                name: "MESH_LIST",
                                                check: "Array",
                                        },
                                ],
                                colour: categoryColours["Transform"],
                                tooltip: getTooltip("subtract_meshes"),
                                previousStatement: null,
                                nextStatement: null,
                        });

                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("transform_blocks");

                        this.setOnChange((changeEvent) =>
                                handleBlockCreateEvent(
                                        this,
                                        changeEvent,
                                        variableNamePrefix,
                                        nextVariableIndexes,
                                        "RESULT_VAR",
                                ),
                        );
                },
        };

        Blockly.Blocks["intersection_meshes"] = {
                init: function () {
                        const variableNamePrefix = "intersection";
                        const nextVariableName =
                                variableNamePrefix +
                                nextVariableIndexes[variableNamePrefix];

                        this.jsonInit({
                                type: "intersection_meshes",
                                message0: translate("intersection_meshes"),
                                args0: [
                                        {
                                                type: "field_variable",
                                                name: "RESULT_VAR",
                                                variable: nextVariableName,
                                        },
                                        {
                                                type: "input_value",
                                                name: "MESH_LIST",
                                                check: "Array",
                                        },
                                ],
                                colour: categoryColours["Transform"],
                                tooltip: getTooltip("intersection_meshes"),
                                previousStatement: null,
                                nextStatement: null,
                        });

                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("transform_blocks");

                        this.setOnChange((changeEvent) =>
                                handleBlockCreateEvent(
                                        this,
                                        changeEvent,
                                        variableNamePrefix,
                                        nextVariableIndexes,
                                        "RESULT_VAR",
                                ),
                        );
                },
        };

        Blockly.Blocks["hull_meshes"] = {
                init: function () {
                        const variableNamePrefix = "hull";
                        const nextVariableName =
                                variableNamePrefix +
                                nextVariableIndexes[variableNamePrefix];

                        this.jsonInit({
                                type: "hull_meshes",
                                message0: translate("hull_meshes"),
                                args0: [
                                        {
                                                type: "field_variable",
                                                name: "RESULT_VAR",
                                                variable: nextVariableName,
                                        },
                                        {
                                                type: "input_value",
                                                name: "MESH_LIST",
                                                check: "Array",
                                        },
                                ],
                                colour: categoryColours["Transform"],
                                tooltip: getTooltip("hull_meshes"),
                                previousStatement: null,
                                nextStatement: null,
                        });

                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("transform_blocks");

                        this.setOnChange((changeEvent) =>
                                handleBlockCreateEvent(
                                        this,
                                        changeEvent,
                                        variableNamePrefix,
                                        nextVariableIndexes,
                                        "RESULT_VAR",
                                ),
                        );
                },
        };
}
