import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import { getHelpUrlFor } from "./blocks.js";
import { translate, getTooltip } from "../main/translation.js";

export function defineColourBlocks() {

  // Basic colour picker block
  Blockly.Blocks["colour_picker"] = {
    init: function () {
      this.jsonInit({
        type: "colour_picker",
        message0: "%1",
        args0: [
          {
            type: "field_colour",
            name: "COLOUR",
            colour: "#ff0000"
          }
        ],
        output: "Colour",
        colour: categoryColours["Materials"],
        tooltip: getTooltip("colour_picker"),
        helpUrl: ""
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('materials_blocks');
    }
  };

  // Random colour block
  Blockly.Blocks["colour_random"] = {
    init: function () {
      this.jsonInit({
        type: "colour_random",
        message0: translate("colour_random"),
        output: "Colour",
        colour: categoryColours["Materials"],
        tooltip: getTooltip("colour_random"),
        helpUrl: ""
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('materials_blocks');
    }
  };

  // RGB colour block
  Blockly.Blocks["colour_rgb"] = {
    init: function () {
      this.jsonInit({
        type: "colour_rgb",
        message0: translate("colour_rgb"),
        args0: [
          {
            type: "input_value",
            name: "RED",
            check: "Number"
          },
          {
            type: "input_value",
            name: "GREEN", 
            check: "Number"
          },
          {
            type: "input_value",
            name: "BLUE",
            check: "Number"
          }
        ],
        inputsInline: true,
        output: "Colour",
        colour: categoryColours["Materials"],
        tooltip: getTooltip("colour_rgb"),
        helpUrl: ""
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('materials_blocks');
    }
  };

  // Blend colours block
  Blockly.Blocks["colour_blend"] = {
    init: function () {
      this.jsonInit({
        type: "colour_blend",
        message0: translate("colour_blend"),
        args0: [
          {
            type: "input_value",
            name: "COLOUR1",
            check: "Colour"
          },
          {
            type: "input_value",
            name: "COLOUR2",
            check: "Colour"
          },
          {
            type: "input_value",
            name: "RATIO",
            check: "Number"
          }
        ],
        inputsInline: true,
        output: "Colour",
        colour: categoryColours["Materials"],
        tooltip: getTooltip("colour_blend"),
        helpUrl: ""
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('materials_blocks');
    }
  };
}