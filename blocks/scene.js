import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
  nextVariableIndexes,
  handleBlockCreateEvent,
  handleMeshLifecycleChange,
  handleFieldOrChildChange,
  addDoMutatorWithToggleBehavior,
  getHelpUrlFor,
  registerBlockHandler,
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
      options: [[getOption("FLAT"), "NONE"]].concat(mapNames()),
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
    return rootBlock.getDescendants(false).some((x) => x.id === b.id);
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
    changeEvent.type === Blockly.Events.UI && changeEvent.element === "dragStop"
  );
}

export function changeEventHitsTouches(changeEvent, touches) {
  return (
    touches(changeEvent.blockId) ||
    (Array.isArray(changeEvent.ids) && changeEvent.ids.some(touches)) ||
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

  const touches = makeTouchesInputSubtree(block, ws, config.subtreeInputName);

  block.setOnChange((changeEvent) => {
    if (!eventTypes.includes(changeEvent.type)) return;

    const relevant =
      (config.includeSelfDelete && wasBlockDeleted(changeEvent, block.id)) ||
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

  if (cfg.inputColor) {
    const input = block.getInput(inputName);
    if (input?.connection) {
      const shadowDom = Blockly.utils.xml.textToDom(
        `<shadow type="colour"><field name="COLOR">${cfg.inputColor}</field></shadow>`,
      );
      input.connection.setShadowDom(shadowDom);
      input.connection.respawnShadow_();
    }
  }
}

// ---------------------------------------------------------------------------
// Shadow-container machinery
//
// A "shadow container" input keeps a shadow block (e.g. a `material` or a
// `text_join`) as its default. To let users drag blocks *into* that container
// it is promoted to a real block on the canvas (a shadow cannot hold non-shadow
// children); to leave a placeholder behind when the container is dragged out it
// is respawned. State is cached so edits survive the respawn. These generic
// helpers are parameterised by `opts`:
//   { inputName, containerType, cacheKey, makeDefault(ws) -> Block }
// ---------------------------------------------------------------------------

export function cacheContainerState(block, opts) {
  const c = block.getInputTargetBlock(opts.inputName);
  if (!c || c.type !== opts.containerType) return;
  if (c.isShadow?.()) return;

  block[opts.cacheKey] = Blockly.serialization.blocks.save(c);
}

function refillContainerFromCache(block, opts) {
  const ws = block.workspace;
  if (!ws || ws.isFlyout) return false;

  const conn = block.getInput(opts.inputName)?.connection;
  if (!conn || conn.isConnected()) return false;

  const state = block[opts.cacheKey];
  if (!state) return false;

  const clone = Blockly.serialization.blocks.append(state, ws);
  if (!clone?.outputConnection) return false;

  clone.outputConnection.connect(conn);
  return true;
}

export function replaceShadowContainerWithCache(block, opts) {
  const ws = block.workspace;
  if (!ws || ws.isFlyout) return false;

  const state = block[opts.cacheKey];
  if (!state) return false;

  const c = block.getInputTargetBlock(opts.inputName);
  if (!c || c.type !== opts.containerType) return false;
  if (!c.isShadow?.()) return false;

  const conn = block.getInput(opts.inputName)?.connection;
  if (!conn) return false;

  c.dispose(false);

  const clone = Blockly.serialization.blocks.append(state, ws);
  if (!clone?.outputConnection) return false;

  clone.outputConnection.connect(conn);
  return true;
}

export function promoteContainerFromShadow(block, opts) {
  const ws = block.workspace;
  if (!ws || ws.isFlyout) return;

  const c = block.getInputTargetBlock(opts.inputName);
  if (!c || c.type !== opts.containerType) return;

  if (!c.isShadow?.()) return;

  // setShadow(false) alone doesn't re-initialise the field DOM, so the
  // blocklyDropdownRect is never created and keyboard-focus styling is lost.
  // Instead, dispose the shadow and recreate as a real block so the field
  // initialises with isShadow()===false and gets its border rect.
  const state = Blockly.serialization.blocks.save(c);
  if (!state) {
    c.setShadow(false);
    return;
  }
  delete state.shadow;

  const conn = block.getInput(opts.inputName)?.connection;
  if (!conn) return;

  c.dispose(false);

  const clone = Blockly.serialization.blocks.append(state, ws);
  if (!clone?.outputConnection) return;

  clone.outputConnection.connect(conn);
}

export function respawnContainer(block, opts) {
  const ws = block.workspace;
  if (!ws || ws.isFlyout) return;

  const conn = block.getInput(opts.inputName)?.connection;
  if (!conn || conn.isConnected()) return;

  if (refillContainerFromCache(block, opts)) return;

  const fresh = opts.makeDefault(ws);
  if (typeof fresh.initSvg === "function") fresh.initSvg();
  if (typeof fresh.render === "function") fresh.render();

  if (fresh?.outputConnection) {
    fresh.outputConnection.connect(conn);
  }
}

// Wires the full shadow-container lifecycle to a block's onChange handler.
export function attachShadowContainerOnChange(block, opts) {
  const ws = block.workspace;
  const touches = makeTouchesInputSubtree(block, ws, opts.inputName);

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
        changeEvent.oldInputName === opts.inputName);

    if (!relevant) return;

    if (replaceShadowContainerWithCache(block, opts)) return;

    promoteContainerFromShadow(block, opts);

    if (!block.getInputTargetBlock(opts.inputName)) {
      respawnContainer(block, opts);
      return;
    }

    cacheContainerState(block, opts);
  });
}

// Material-specific wrappers (preserve the original API used by materials.js).
const MATERIAL_OPTS = {
  inputName: "MATERIAL",
  containerType: "material",
  cacheKey: "_cachedMaterialState",
  makeDefault: (ws) => ws.newBlock("material"),
};

export function cacheMaterialState(mapBlock) {
  return cacheContainerState(mapBlock, MATERIAL_OPTS);
}

export function replaceShadowMaterialWithCache(mapBlock) {
  return replaceShadowContainerWithCache(mapBlock, MATERIAL_OPTS);
}

export function promoteMaterialContainerFromShadow(mapBlock) {
  return promoteContainerFromShadow(mapBlock, MATERIAL_OPTS);
}

export function respawnMaterialShadow(mapBlock) {
  return respawnContainer(mapBlock, MATERIAL_OPTS);
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
        variableNamePrefix + nextVariableIndexes[variableNamePrefix];

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

      registerBlockHandler(this, (changeEvent) => {
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
