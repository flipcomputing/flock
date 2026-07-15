import { expect } from "chai";
import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";
import { initializeBlocks } from "../../main/blocklyinit.js";

initializeBlocks(); // registers all Flock custom blocks + generators

const allBlockTypes = Object.keys(Blockly.Blocks).sort();
function classifyField(field) {
  if (field instanceof Blockly.FieldVariable) return "variable-name";
  if (field instanceof Blockly.FieldDropdown) return "dropdown";
  if (field instanceof Blockly.FieldTextInput) return "free-text";
  return null; // labels, checkboxes, numbers, images — not a text surface
}

function scanRegisteredBlocks(workspace) {
  const found = [];
  for (const type of Object.keys(Blockly.Blocks)) {
    let block;
    try {
      block = workspace.newBlock(type);
    } catch {
      continue; // blocks whose init needs a full UI environment
    }
    for (const input of block.inputList) {
      for (const field of input.fieldRow) {
        const kind = classifyField(field);
        if (kind === "free-text") {
          found.push(`${type}.${field.name}`);
        }
      }
    }
    block.dispose();
  }
  return found.sort();
}

const TESTED_TEXT_FIELDS = [
  "text.TEXT",
  "colour_from_string.COLOR",
  "procedures_defnoreturn.NAME",
  "procedures_defreturn.NAME",
  "text_prompt.TEXT",
];

const payload = "\"; alert(1); //"

export function runTextFieldValidationTests() {
  describe("Text Field Validation @security", function () {
    this.timeout(5000);

    let workspace = new Blockly.Workspace();

    // colour_from_string is a value block, so blockToCode returns
    // [code, order] — unwrap to just the code string.
    function generate(block) {
      javascriptGenerator.init(workspace);
      const code = javascriptGenerator.blockToCode(block);
      return Array.isArray(code) ? code[0] : code;
    }

    for (const block of scanRegisteredBlocks(workspace)) {
      it(block + " has a test", function () {
        expect(TESTED_TEXT_FIELDS).to.include(block);
      });
    }

    it("stringifies text field", function () {
      const block = Blockly.serialization.blocks.append(
      {
        type: "text",
        fields: { TEXT: payload },
      },
      workspace,
      );
      expect(generate(block)).to.equal(JSON.stringify(payload));
    });

    it("fixes name of procedure without return", function () {
      const block = Blockly.serialization.blocks.append(
      {
        type: "procedures_defnoreturn",
        fields: { NAME: payload },
      },
      workspace,
      );
      block.argData_ = [];
      expect(generate(block)).not.to.include(payload);
    });

    it("fixes name of procedure with return", function () {
      const block = Blockly.serialization.blocks.append(
      {
        type: "procedures_defreturn",
        fields: { NAME: payload },
      },
      workspace,
      );
      block.argData_ = [];
      expect(generate(block)).not.to.include(payload);
    });

    it("stringifies text prompt input", function () {
      const block = Blockly.serialization.blocks.append(
      {
        type: "text_prompt",
        fields: { TEXT: payload },
      },
      workspace,
      );
      expect(generate(block)).to.equal("window.prompt('" + JSON.stringify(payload) + "')");
    });

    it("play tune block", function () {
      const block = Blockly.serialization.blocks.append(
      {
        type: "play_tune",
      },
      workspace,
      );
      expect(generate(block)).to.equal("window.prompt('" + JSON.stringify(payload) + "')");
    });
  });
}
