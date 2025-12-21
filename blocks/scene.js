import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
        nextVariableIndexes,
        handleBlockCreateEvent,
        handleMeshLifecycleChange,
        handleFieldOrChildChange,
        addDoMutatorWithToggleBehavior,
        getHelpUrlFor,
} from "./blocks.js";
import { mapNames } from "../config.js";
import { updateOrCreateMeshFromBlock } from "../ui/blockmesh.js";
import { translate, getTooltip, getOption } from "../main/translation.js";

function initSceneJsonBlock(block, { type, args0, inputsInline = true }) {
        block.jsonInit({
                type,
                message0: translate(type),
                args0,
                previousStatement: null,
                nextStatement: null,
                inputsInline,
                colour: categoryColours["Scene"],
                tooltip: getTooltip(type),
        });

        block.setHelpUrl(getHelpUrlFor(block.type));
        block.setStyle("scene_blocks");
}

function buildMapNameDropdownArgs() {
        return [
                {
                        type: "field_dropdown",
                        name: "MAP_NAME",
                        options: [[getOption("FLAT"), "NONE"]].concat(
                                mapNames(),
                        ),
                },
        ];
}

function buildInputValueArg({ name, check, colour }) {
        const arg = { type: "input_value", name };
        if (check) arg.check = check;
        if (colour) arg.colour = colour;
        return arg;
}

function makeInSubtree(ws) {
        return (rootBlock, id) => {
                if (!id || !rootBlock) return false;
                const b = ws.getBlockById(id);
                if (!b) return false;
                if (b === rootBlock) return true;
                return rootBlock
                        .getDescendants(false)
                        .some((x) => x.id === b.id);
        };
}

export function makeTouchesInputSubtree(block, ws, inputName) {
        const inSubtree = makeInSubtree(ws);
        return (id) => {
                if (!id) return false;
                if (id === block.id) return true;
                const child = block.getInputTargetBlock(inputName);
                if (!child) return false;
                return inSubtree(child, id);
        };
}

function isDragStop(changeEvent) {
        return (
                changeEvent.type === Blockly.Events.UI &&
                changeEvent.element === "dragStop"
        );
}

export function changeEventHitsTouches(changeEvent, touches) {
        return (
                touches(changeEvent.blockId) ||
                (Array.isArray(changeEvent.ids) &&
                        changeEvent.ids.some(touches)) ||
                touches(changeEvent.newParentId) ||
                touches(changeEvent.oldParentId) ||
                isDragStop(changeEvent)
        );
}

export function wasBlockDeleted(changeEvent, blockId) {
        return (
                changeEvent.type === Blockly.Events.BLOCK_DELETE &&
                Array.isArray(changeEvent.ids) &&
                changeEvent.ids.includes(blockId)
        );
}

function attachMeshSyncOnChange(block, config) {
        const ws = block.workspace;

        const eventTypes = config.listenToMove
                ? [
                          Blockly.Events.BLOCK_CREATE,
                          Blockly.Events.BLOCK_CHANGE,
                          Blockly.Events.BLOCK_MOVE,
                          Blockly.Events.BLOCK_DELETE,
                          Blockly.Events.UI,
                  ]
                : [
                          Blockly.Events.BLOCK_CREATE,
                          Blockly.Events.BLOCK_CHANGE,
                          Blockly.Events.BLOCK_DELETE,
                          Blockly.Events.UI,
                  ];

        const touches = makeTouchesInputSubtree(
                block,
                ws,
                config.subtreeInputName,
        );

        block.setOnChange((changeEvent) => {
                if (!eventTypes.includes(changeEvent.type)) return;

                const relevant =
                        (config.includeSelfDelete &&
                                wasBlockDeleted(changeEvent, block.id)) ||
                        changeEventHitsTouches(changeEvent, touches);

                if (!relevant) return;

                if (handleMeshLifecycleChange(block, changeEvent)) return;
                if (handleFieldOrChildChange(block, changeEvent)) return;

                updateOrCreateMeshFromBlock(block, changeEvent);
        });
}

function initSceneColourLikeBlock(block, cfg) {
        const inputName = cfg.inputName || "COLOR";

        const args0 = [];
        if (cfg.hasDropdown) args0.push(...buildMapNameDropdownArgs());
        args0.push(
                buildInputValueArg({
                        name: inputName,
                        colour: cfg.inputColor,
                        check: cfg.check || ["Colour", "Array", "Material"],
                }),
        );

        initSceneJsonBlock(block, { type: cfg.type, args0 });
        attachMeshSyncOnChange(block, {
                listenToMove: !!cfg.listenToMove,
                subtreeInputName: inputName,
                includeSelfDelete: false,
        });
}

export function cacheMaterialState(mapBlock) {
        const mat = mapBlock.getInputTargetBlock("MATERIAL");
        if (!mat || mat.type !== "material") return;
        if (mat.isShadow?.()) return;

        mapBlock._cachedMaterialState = Blockly.serialization.blocks.save(mat);
}

function refillMaterialFromCache(mapBlock) {
        const ws = mapBlock.workspace;
        if (!ws || ws.isFlyout) return false;

        const input = mapBlock.getInput("MATERIAL");
        const conn = input?.connection;
        if (!conn || conn.isConnected()) return false;

        const state = mapBlock._cachedMaterialState;
        if (!state) return false;

        const clone = Blockly.serialization.blocks.append(state, ws);
        if (!clone?.outputConnection) return false;

        clone.outputConnection.connect(conn);
        return true;
}

export function replaceShadowMaterialWithCache(mapBlock) {
        const ws = mapBlock.workspace;
        if (!ws || ws.isFlyout) return false;

        const state = mapBlock._cachedMaterialState;
        if (!state) return false;

        const mat = mapBlock.getInputTargetBlock("MATERIAL");
        if (!mat || mat.type !== "material") return false;
        if (!mat.isShadow?.()) return false;

        const input = mapBlock.getInput("MATERIAL");
        const conn = input?.connection;
        if (!conn) return false;

        mat.dispose(false);

        const clone = Blockly.serialization.blocks.append(state, ws);
        if (!clone?.outputConnection) return false;

        clone.outputConnection.connect(conn);
        return true;
}

export function promoteMaterialContainerFromShadow(mapBlock) {
        const ws = mapBlock.workspace;
        if (!ws || ws.isFlyout) return;

        const mat = mapBlock.getInputTargetBlock("MATERIAL");
        if (!mat || mat.type !== "material") return;

        if (mat.isShadow?.()) {
                mat.setShadow(false);
        }
}

export function respawnMaterialShadow(mapBlock) {
        const ws = mapBlock.workspace;
        if (!ws || ws.isFlyout) return;

        const input = mapBlock.getInput("MATERIAL");
        const conn = input?.connection;
        if (!conn || conn.isConnected()) return;

        const restored = refillMaterialFromCache(mapBlock);
        if (restored) return;

        const block = ws.newBlock("material");
        if (typeof block.initSvg === "function") block.initSvg();
        if (typeof block.render === "function") block.render();

        if (block?.outputConnection) {
                block.outputConnection.connect(conn);
        }
}

function attachCreateMapOnChange(block) {
        const ws = block.workspace;
        const touches = makeTouchesInputSubtree(block, ws, "MATERIAL");

        block.setOnChange((changeEvent) => {
                const eventTypes = [
                        Blockly.Events.BLOCK_CREATE,
                        Blockly.Events.BLOCK_CHANGE,
                        Blockly.Events.BLOCK_MOVE,
                        Blockly.Events.BLOCK_DELETE,
                        Blockly.Events.UI,
                ];
                if (!eventTypes.includes(changeEvent.type)) return;

                const relevant =
                        wasBlockDeleted(changeEvent, block.id) ||
                        changeEventHitsTouches(changeEvent, touches) ||
                        (changeEvent.type === Blockly.Events.BLOCK_CREATE &&
                                changeEvent.blockId === block.id) ||
                        (changeEvent.type === Blockly.Events.BLOCK_MOVE &&
                                changeEvent.oldParentId === block.id &&
                                changeEvent.oldInputName === "MATERIAL");

                if (!relevant) return;

                if (replaceShadowMaterialWithCache(block)) return;

                promoteMaterialContainerFromShadow(block);

                if (!block.getInputTargetBlock("MATERIAL")) {
                        respawnMaterialShadow(block);
                        return;
                }

                cacheMaterialState(block);

                if (handleMeshLifecycleChange(block, changeEvent)) return;
                if (handleFieldOrChildChange(block, changeEvent)) return;

                updateOrCreateMeshFromBlock(block, changeEvent);
        });
}

export function defineSceneBlocks() {
        Blockly.Blocks["set_sky_color"] = {
                init: function () {
                        initSceneColourLikeBlock(this, {
                                type: "set_sky_color",
                                inputColor: "#6495ED",
                                listenToMove: true,
                        });
                },
        };

        Blockly.Blocks["create_ground"] = {
                init: function () {
                        initSceneColourLikeBlock(this, {
                                type: "create_ground",
                                inputColor: "#71BC78",
                                listenToMove: true,
                        });
                },
        };

        Blockly.Blocks["set_background_color"] = {
                init: function () {
                        initSceneColourLikeBlock(this, {
                                type: "set_background_color",
                                inputColor: "#6495ED",
                                check: ["Colour"],
                                listenToMove: true,
                        });
                },
        };

        Blockly.Blocks["create_map"] = {
                init: function () {
                        const args0 = [
                                ...buildMapNameDropdownArgs(),
                                buildInputValueArg({
                                        name: "MATERIAL",
                                        check: [
                                                "Material",
                                                "Array",
                                                "Colour",
                                                "material_like",
                                                "colour_array",
                                        ],
                                }),
                        ];

                        initSceneJsonBlock(this, { type: "create_map", args0 });
                        attachCreateMapOnChange(this);
                },
        };

        Blockly.Blocks["show"] = {
                init: function () {
                        initSceneJsonBlock(this, {
                                type: "show",
                                args0: [
                                        {
                                                type: "field_variable",
                                                name: "MODEL_VAR",
                                                variable: window.currentMesh,
                                        },
                                ],
                                inputsInline: false,
                        });
                },
        };

        Blockly.Blocks["hide"] = {
                init: function () {
                        initSceneJsonBlock(this, {
                                type: "hide",
                                args0: [
                                        {
                                                type: "field_variable",
                                                name: "MODEL_VAR",
                                                variable: window.currentMesh,
                                        },
                                ],
                                inputsInline: false,
                        });
                },
        };

        Blockly.Blocks["dispose"] = {
                init: function () {
                        initSceneJsonBlock(this, {
                                type: "dispose",
                                args0: [
                                        {
                                                type: "field_variable",
                                                name: "MODEL_VAR",
                                                variable: window.currentMesh,
                                        },
                                ],
                        });
                },
        };

        Blockly.Blocks["clone_mesh"] = {
                init: function () {
                        const variableNamePrefix = "clone";
                        const nextVariableName =
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
