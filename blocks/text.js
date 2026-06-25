import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
  getHelpUrlFor,
  nextVariableIndexes,
  handleBlockCreateEvent,
  handleBlockChange,
  registerBlockHandler,
} from "./blocks.js";
import {
  translate,
  getTooltip,
  getDropdownOption,
} from "../main/translation.js";
import { attachShadowContainerOnChange } from "./scene.js";

// print_text keeps a text_join in its TEXT input as a "shadow container": it is
// promoted to a real block on the canvas (so blocks can be dropped into its
// items) and respawned when dragged out. See attachShadowContainerOnChange.
const PRINT_TEXT_LIST_OPTS = {
  inputName: "TEXT",
  containerType: "text_join",
  cacheKey: "_cachedTextListState",
  makeDefault: (ws) => {
    const list = ws.newBlock("text_join");
    if (list.loadExtraState) list.loadExtraState({ itemCount: 1 });
    list.setInputsInline(true);
    const item = ws.newBlock("text");
    item.setShadow(true);
    item.setFieldValue("Hello 🌈", "TEXT");
    if (typeof item.initSvg === "function") item.initSvg();
    const add0 = list.getInput("ADD0");
    if (add0?.connection) add0.connection.connect(item.outputConnection);
    return list;
  },
};

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
      this.setStyle("text_blocks");
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
        // The message words ("print"/"for"/"seconds") don't read well as
        // per-input labels, so label each input explicitly.
        ariaLabels: { TEXT: "text", DURATION: "seconds", COLOR: "color" },
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: 160,
        tooltip: getTooltip("print_text"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("text_blocks");
      attachShadowContainerOnChange(this, PRINT_TEXT_LIST_OPTS);
    },
  };

  Blockly.Blocks["subtitle"] = {
    init: function () {
      this.jsonInit({
        type: "subtitle",
        message0: translate("subtitle"),
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
        ],
        // Label each input explicitly so the message words read well.
        ariaLabels: { TEXT: "text", DURATION: "seconds" },
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: 160,
        tooltip: getTooltip("subtitle"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("text_blocks");
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
            options: [getDropdownOption("ADD"), getDropdownOption("REPLACE")],
          },
          {
            type: "field_dropdown",
            name: "ASYNC",
            options: [getDropdownOption("START"), getDropdownOption("AWAIT")],
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: 160,
        tooltip: getTooltip("say"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("text_blocks");
    },
  };

  Blockly.Blocks["ui_text"] = {
    init: function () {
      const variableNamePrefix = "uitext";
      const nextVariableName =
        variableNamePrefix + nextVariableIndexes[variableNamePrefix];

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
            name: "TEXTBLOCK_VAR",
            variable: nextVariableName,
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
      this.setStyle("text_blocks");

      registerBlockHandler(this, (changeEvent) =>
        handleBlockCreateEvent(
          this,
          changeEvent,
          variableNamePrefix,
          nextVariableIndexes,
          "TEXTBLOCK_VAR",
        ),
      );
    },
  };

  Blockly.Blocks["ui_button"] = {
    init: function () {
      const variableNamePrefix = "button";
      const nextVariableName =
        variableNamePrefix + nextVariableIndexes[variableNamePrefix];

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
            name: "BUTTON_VAR",
            variable: nextVariableName,
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
      this.setStyle("text_blocks");

      registerBlockHandler(this, (changeEvent) =>
        handleBlockCreateEvent(
          this,
          changeEvent,
          variableNamePrefix,
          nextVariableIndexes,
          "BUTTON_VAR",
        ),
      );
    },
  };

  Blockly.Blocks["ui_input"] = {
    init: function () {
      const variableNamePrefix = "input";
      const nextVariableName =
        variableNamePrefix + nextVariableIndexes[variableNamePrefix];

      this.jsonInit({
        type: "ui_input",
        message0: translate("ui_input"),
        args0: [
          {
            type: "field_variable",
            name: "INPUT_VAR",
            variable: nextVariableName,
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
      this.setStyle("text_blocks");

      registerBlockHandler(this, (changeEvent) =>
        handleBlockCreateEvent(
          this,
          changeEvent,
          variableNamePrefix,
          nextVariableIndexes,
          "INPUT_VAR",
        ),
      );
    },
  };

  Blockly.Blocks["describe"] = {
    init: function () {
      this.jsonInit({
        type: "describe",
        message0: translate("describe"),
        args0: [
          {
            type: "field_variable",
            name: "MESH_VAR",
            variable: window.currentMesh,
          },
          {
            type: "input_value",
            name: "TEXT",
            check: "String",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Text"],
        tooltip: getTooltip("describe"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("text_blocks");
    },
  };

  Blockly.Blocks["create_3d_text"] = {
    init: function () {
      const variableNamePrefix = "3dtext";
      const nextVariableName =
        variableNamePrefix + nextVariableIndexes[variableNamePrefix];

      this.jsonInit({
        type: "create_3d_text",
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
            options: [getDropdownOption("__fonts_FreeSans_Bold_json")],
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
      this.setStyle("text_blocks");

      registerBlockHandler(this, (changeEvent) =>
        handleBlockChange(this, changeEvent, variableNamePrefix),
      );
    },
  };
}
