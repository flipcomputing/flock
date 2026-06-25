/**
 * Re-registers the `text_join_mutator` so that clicking the `+` adds a new item
 * pre-filled with an empty `text` shadow block (instead of an empty socket).
 *
 * The mutator body below is taken from @blockly/block-plus-minus
 * (src/text_join.js, Apache-2.0); only `plus` is changed to seed the shadow.
 * This module must be imported AFTER "@blockly/block-plus-minus" so it wins the
 * registration, and before any workspace/blocks are created.
 */

import * as Blockly from "blockly";
import { createPlusField } from "@blockly/block-plus-minus/src/field_plus.js";
import { createMinusField } from "@blockly/block-plus-minus/src/field_minus.js";

const textJoinMutator = {
  itemCount_: 0,

  mutationToDom: function () {
    const container = Blockly.utils.xml.createElement("mutation");
    container.setAttribute("items", this.itemCount_);
    return container;
  },

  domToMutation: function (xmlElement) {
    const targetCount = parseInt(xmlElement.getAttribute("items"), 10);
    this.updateShape_(targetCount);
  },

  saveExtraState: function () {
    return {
      itemCount: this.itemCount_,
    };
  },

  loadExtraState: function (state) {
    this.updateShape_(state["itemCount"]);
  },

  updateShape_: function (targetCount) {
    while (this.itemCount_ < targetCount) {
      this.addPart_();
    }
    while (this.itemCount_ > targetCount) {
      this.removePart_();
    }
    this.updateMinus_();
  },

  /**
   * Callback for the plus image. Adds an input to the block, seeds it with an
   * empty text shadow, and updates the state of the minus.
   * @this {Blockly.Block}
   */
  plus: function () {
    this.addPart_();
    const input = this.getInput("ADD" + (this.itemCount_ - 1));
    if (input && input.connection && !input.connection.targetBlock()) {
      const shadow = this.workspace.newBlock("text"); // TEXT defaults to ""
      shadow.setShadow(true);
      shadow.initSvg();
      shadow.render();
      input.connection.connect(shadow.outputConnection);
    }
    this.updateMinus_();
  },

  minus: function () {
    if (this.itemCount_ == 0) {
      return;
    }
    this.removePart_();
    this.updateMinus_();
  },

  addPart_: function () {
    if (this.itemCount_ == 0) {
      if (this.getInput("EMPTY")) {
        this.removeInput("EMPTY");
      }
      this.topInput_ = this.appendValueInput("ADD" + this.itemCount_)
        .appendField(createPlusField(), "PLUS")
        .appendField(Blockly.Msg["TEXT_JOIN_TITLE_CREATEWITH"]);
    } else {
      this.appendValueInput("ADD" + this.itemCount_);
    }
    // Because item inputs are 0-index we decrement first, increment last.
    this.itemCount_++;
  },

  removePart_: function () {
    this.itemCount_--;
    this.removeInput("ADD" + this.itemCount_);
    if (this.itemCount_ == 0) {
      this.topInput_ = this.appendDummyInput("EMPTY")
        .appendField(createPlusField(), "PLUS")
        .appendField(this.newQuote_(true))
        .appendField(this.newQuote_(false));
    }
  },

  updateMinus_: function () {
    const minusField = this.getField("MINUS");
    if (!minusField && this.itemCount_ > 0) {
      this.topInput_.insertFieldAt(1, createMinusField(), "MINUS");
    } else if (minusField && this.itemCount_ < 1) {
      this.topInput_.removeField("MINUS");
    }
  },
};

const textJoinHelper = function () {
  Blockly.Extensions.apply("quote_image_mixin", this, false);
  this.updateShape_(2);
};

if (Blockly.Extensions.isRegistered("text_join_mutator")) {
  Blockly.Extensions.unregister("text_join_mutator");
}
Blockly.Extensions.registerMutator(
  "text_join_mutator",
  textJoinMutator,
  textJoinHelper,
);
