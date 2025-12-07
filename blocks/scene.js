import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
        nextVariableIndexes,
        findCreateBlock,
        handleBlockCreateEvent,
        handleMeshLifecycleChange,
        handleFieldOrChildChange,
        addDoMutatorWithToggleBehavior,
        getHelpUrlFor,
} from "./blocks.js";
import { mapNames } from "../config.js";
import { updateOrCreateMeshFromBlock } from "../ui/blockmesh.js";
import {
        translate,
        getTooltip,
        getOption,
        getDropdownOption,
} from "../main/translation.js";
import { flock } from "../flock.js";

function createSceneColorBlock(config) {
        return {
                init: function () {
                        const args0 = [];

                        if (config.hasDropdown) {
                                args0.push({
                                        type: "field_dropdown",
                                        name: "MAP_NAME",
                                        options: [
                                                [getOption("FLAT"), "NONE"],
                                        ].concat(mapNames()),
                                });
                        }

                        args0.push({
                                type: "input_value",
                                name: config.inputName || "COLOR",
                                colour: config.inputColor,
                                check: config.check || [
                                        "Colour",
                                        "Array",
                                        "Material",
                                ],
                        });

                        this.jsonInit({
                                type: config.type,
                                message0: translate(config.type),
                                args0: args0,
                                previousStatement: null,
                                nextStatement: null,
                                inputsInline: true,
                                colour: categoryColours["Scene"],
                                tooltip: getTooltip(config.type),
                        });

                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("scene_blocks");

                        // --- NEW onChange logic modelled on create_map ---

                        let debounceTimer = null;
                        const ws = this.workspace;

                        const runtimeReady = () =>
                                typeof window !== "undefined" &&
                                window.flock &&
                                flock.BABYLON &&
                                flock.scene;

                        const inSubtree = (rootBlock, id) => {
                                if (!id) return false;
                                const b = ws.getBlockById(id);
                                if (!b) return false;
                                if (b === rootBlock) return true;
                                return rootBlock
                                        .getDescendants(false)
                                        .some((x) => x.id === b.id);
                        };

                        const runAfterLayout = (evt) => {
                                // Let Blockly finalise connections first
                                Promise.resolve().then(() => {
                                        requestAnimationFrame(() => {
                                                if (!runtimeReady()) return;

                                                const colorInputName =
                                                        config.inputName ||
                                                        "COLOR";
                                                const colorBlock =
                                                        this.getInputTargetBlock(
                                                                colorInputName,
                                                        );

                                                // (No de-shadowing logic here unless you want colour shadows too)

                                                if (config.useMeshLifecycle) {
                                                        if (
                                                                typeof handleMeshLifecycleChange ===
                                                                "function"
                                                        ) {
                                                                if (
                                                                        handleMeshLifecycleChange(
                                                                                this,
                                                                                evt,
                                                                        )
                                                                )
                                                                        return;
                                                        }
                                                        if (
                                                                typeof handleFieldOrChildChange ===
                                                                "function"
                                                        ) {
                                                                if (
                                                                        handleFieldOrChildChange(
                                                                                this,
                                                                                evt,
                                                                        )
                                                                )
                                                                        return;
                                                        }
                                                }

                                                if (
                                                        typeof updateOrCreateMeshFromBlock ===
                                                        "function"
                                                ) {
                                                        updateOrCreateMeshFromBlock(
                                                                this,
                                                                evt,
                                                        );
                                                }
                                        });
                                });
                        };

                        this.setOnChange((evt) => {
                                const eventTypes = config.listenToMove
                                        ? [
                                                  Blockly.Events.BLOCK_CREATE,
                                                  Blockly.Events.BLOCK_CHANGE,
                                                  Blockly.Events.BLOCK_MOVE,
                                                  Blockly.Events.BLOCK_DELETE,
                                                  Blockly.Events.UI, // dragStop path
                                          ]
                                        : [
                                                  Blockly.Events.BLOCK_CREATE,
                                                  Blockly.Events.BLOCK_CHANGE,
                                                  Blockly.Events.BLOCK_DELETE,
                                                  Blockly.Events.UI,
                                          ];

                                if (!eventTypes.includes(evt.type)) return;

                                if (flock.eventDebug && config.debugEvents) {
                                        console.log("scene color onchange", {
                                                sceneBlockType: this.type,
                                                evtType: evt.type,
                                                blockId: evt.blockId,
                                                element: evt.element,
                                        });
                                }

                                const colorInputName =
                                        config.inputName || "COLOR";

                                const touchesScene = (id) => {
                                        if (!id) return false;
                                        if (id === this.id) return true; // direct change to this block

                                        const colorBlock =
                                                this.getInputTargetBlock(
                                                        colorInputName,
                                                );
                                        if (!colorBlock) return false;

                                        return inSubtree(colorBlock, id);
                                };

                                const relevant =
                                        touchesScene(evt.blockId) ||
                                        (Array.isArray(evt.ids) &&
                                                evt.ids.some((id) =>
                                                        touchesScene(id),
                                                )) ||
                                        touchesScene(evt.newParentId) ||
                                        touchesScene(evt.oldParentId) ||
                                        (evt.type === Blockly.Events.UI &&
                                                evt.element === "dragStop");

                                if (!relevant) return;

                                if (debounceTimer) clearTimeout(debounceTimer);
                                debounceTimer = setTimeout(
                                        () => runAfterLayout(evt),
                                        30,
                                );
                        });
                },
        };
}

export function defineSceneBlocks() {
        Blockly.Blocks["set_sky_color"] = createSceneColorBlock({
                type: "set_sky_color",
                inputColor: "#6495ED",
                debugEvents: true,
                listenToMove: true,
        });

        Blockly.Blocks["create_ground"] = createSceneColorBlock({
                type: "create_ground",
                inputColor: "#71BC78",
                listenToMove: true,
        });

        Blockly.Blocks["set_background_color"] = createSceneColorBlock({
                type: "set_background_color",
                inputColor: "#6495ED",
                check: ["Colour"],
        });

        Blockly.Blocks["create_map"] = {
                init: function () {
                        const args0 = [];

                        args0.push({
                                type: "field_dropdown",
                                name: "MAP_NAME",
                                options: [[getOption("FLAT"), "NONE"]].concat(
                                        mapNames(),
                                ),
                        });

                        args0.push({
                                type: "input_value",
                                name: "MATERIAL",
                                check: [
                                        "Material",
                                        "Array",
                                        "Colour",
                                        "material_like",
                                        "colour_array",
                                ],
                        });

                        this.jsonInit({
                                type: "create_map",
                                message0: translate("create_map"),
                                args0,
                                previousStatement: null,
                                nextStatement: null,
                                inputsInline: true,
                                colour: categoryColours["Scene"],
                                tooltip: getTooltip("create_map"),
                        });

                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("scene_blocks");

                        let debounceTimer = null;
                        const ws = this.workspace;

                        // Is Flock runtime initialized yet?
                        const runtimeReady = () =>
                                typeof window !== "undefined" &&
                                window.flock &&
                                flock.BABYLON &&
                                flock.scene;

                        const inSubtree = (rootBlock, id) => {
                                if (!id) return false;
                                const b = ws.getBlockById(id);
                                if (!b) return false;
                                if (b === rootBlock) return true;
                                return rootBlock
                                        .getDescendants(false)
                                        .some((x) => x.id === b.id);
                        };

                        const respawnMaterialShadow = () => {
                                const input = this.getInput("MATERIAL");
                                if (!input || !input.connection) return;
                                const shadowDom = Blockly.utils.xml.textToDom(`
                        <shadow type="material">
                          <value name="BASE_COLOR">
                                <shadow type="colour">
                                  <field name="COLOR">#71BC78</field>
                                </shadow>
                          </value>
                          <value name="ALPHA">
                                <shadow type="math_number">
                                  <field name="NUM">1.0</field>
                                </shadow>
                          </value>
                        </shadow>
                  `);
                                input.connection.setShadowDom(shadowDom);
                                input.connection.respawnShadow_();
                        };

                        const runAfterLayout = (evt) => {
                                // Let Blockly finalize connections first
                                Promise.resolve().then(() => {
                                        requestAnimationFrame(() => {
                                                // Bail out quietly until Flock is ready to avoid
                                                // `flock.materialsDebug` / `flock.texturePath` undefined errors.
                                                if (!runtimeReady()) return;

                                                const mat =
                                                        this.getInputTargetBlock(
                                                                "MATERIAL",
                                                        );

                                                // De-shadow only when editing inside the material subtree.
                                                if (
                                                        mat &&
                                                        mat.isShadow &&
                                                        mat.isShadow()
                                                ) {
                                                        const touchesMat =
                                                                inSubtree(
                                                                        mat,
                                                                        evt.blockId,
                                                                ) ||
                                                                inSubtree(
                                                                        mat,
                                                                        evt.newParentId,
                                                                ) ||
                                                                inSubtree(
                                                                        mat,
                                                                        evt.oldParentId,
                                                                );
                                                        if (touchesMat)
                                                                mat.setShadow(
                                                                        false,
                                                                );
                                                }

                                                // If MATERIAL cleared entirely, respawn default shadow.
                                                if (
                                                        !this.getInputTargetBlock(
                                                                "MATERIAL",
                                                        )
                                                ) {
                                                        respawnMaterialShadow();
                                                }

                                                // Update pipeline (only when runtime is ready)
                                                if (
                                                        typeof handleMeshLifecycleChange ===
                                                        "function"
                                                ) {
                                                        if (
                                                                handleMeshLifecycleChange(
                                                                        this,
                                                                        evt,
                                                                )
                                                        )
                                                                return;
                                                }
                                                if (
                                                        typeof handleFieldOrChildChange ===
                                                        "function"
                                                ) {
                                                        if (
                                                                handleFieldOrChildChange(
                                                                        this,
                                                                        evt,
                                                                )
                                                        )
                                                                return;
                                                }
                                                if (
                                                        typeof updateOrCreateMeshFromBlock ===
                                                        "function"
                                                ) {
                                                        updateOrCreateMeshFromBlock(
                                                                this,
                                                                evt,
                                                        );
                                                }
                                        });
                                });
                        };

                        this.setOnChange((evt) => {
                                const eventTypes = [
                                        Blockly.Events.BLOCK_CREATE,
                                        Blockly.Events.BLOCK_CHANGE,
                                        Blockly.Events.BLOCK_MOVE,
                                        Blockly.Events.BLOCK_DELETE,
                                        Blockly.Events.UI, // dragStop path
                                ];
                                if (!eventTypes.includes(evt.type)) return;

                                // Only treat changes to this block or its MATERIAL subtree as relevant
                                const touchesMap = (id) => {
                                        if (!id) return false;
                                        if (id === this.id) return true;

                                        const matBlock =
                                                this.getInputTargetBlock(
                                                        "MATERIAL",
                                                );
                                        if (!matBlock) return false;

                                        return inSubtree(matBlock, id);
                                };

                                const wasThisBlockDeleted =
                                        evt.type ===
                                                Blockly.Events.BLOCK_DELETE &&
                                        Array.isArray(evt.ids) &&
                                        evt.ids.includes(this.id);

                                const relevant =
                                        wasThisBlockDeleted ||
                                        touchesMap(evt.blockId) ||
                                        (Array.isArray(evt.ids) &&
                                                evt.ids.some((id) =>
                                                        touchesMap(id),
                                                )) ||
                                        touchesMap(evt.newParentId) ||
                                        touchesMap(evt.oldParentId) ||
                                        (evt.type === Blockly.Events.UI &&
                                                evt.element === "dragStop");

                                if (!relevant) return;

                                if (!relevant) return;

                                if (debounceTimer) clearTimeout(debounceTimer);
                                debounceTimer = setTimeout(
                                        () => runAfterLayout(evt),
                                        30,
                                );
                        });
                },
        };

        Blockly.Blocks["show"] = {
                init: function () {
                        this.jsonInit({
                                type: "show",
                                message0: translate("show"),
                                args0: [
                                        {
                                                type: "field_variable",
                                                name: "MODEL_VAR",
                                                variable: window.currentMesh,
                                        },
                                ],
                                previousStatement: null,
                                nextStatement: null,
                                colour: categoryColours["Scene"],
                                tooltip: getTooltip("show"),
                        });

                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("scene_blocks");
                },
        };

        Blockly.Blocks["hide"] = {
                init: function () {
                        this.jsonInit({
                                type: "hide",
                                message0: translate("hide"),
                                args0: [
                                        {
                                                type: "field_variable",
                                                name: "MODEL_VAR",
                                                variable: window.currentMesh,
                                        },
                                ],
                                previousStatement: null,
                                nextStatement: null,
                                colour: categoryColours["Scene"],
                                tooltip: getTooltip("hide"),
                        });

                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("scene_blocks");
                },
        };

        Blockly.Blocks["dispose"] = {
                init: function () {
                        this.jsonInit({
                                type: "dispose",
                                message0: translate("dispose"),
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
                                colour: categoryColours["Scene"],
                                tooltip: getTooltip("dispose"),
                        });
                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("scene_blocks");
                },
        };

        Blockly.Blocks["clone_mesh"] = {
                init: function () {
                        const variableNamePrefix = "clone";
                        let nextVariableName =
                                variableNamePrefix +
                                nextVariableIndexes[variableNamePrefix];

                        this.jsonInit({
                                message0: translate("clone_mesh"),
                                args0: [
                                        {
                                                type: "field_variable",
                                                name: "CLONE_VAR",
                                                variable: nextVariableName,
                                        },
                                        {
                                                type: "field_variable",
                                                name: "SOURCE_MESH",
                                                variable: window.currentMesh,
                                        },
                                ],
                                inputsInline: true,
                                colour: categoryColours["Scene"],
                                tooltip: getTooltip("clone_mesh"),
                                helpUrl: "",
                                previousStatement: null,
                                nextStatement: null,
                        });

                        this.setOnChange((changeEvent) => {
                                handleBlockCreateEvent(
                                        this,
                                        changeEvent,
                                        variableNamePrefix,
                                        nextVariableIndexes,
                                );
                        });

                        this.setHelpUrl(getHelpUrlFor(this.type));
                        this.setStyle("scene_blocks");
                        addDoMutatorWithToggleBehavior(this);
                },
        };
}
