import { expect } from "chai";
import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";
import { initializeVariableIndexes } from "../../blocks/blocks.js";
import { defineSensingBlocks } from "../../blocks/sensing.js";
import { registerSensingGenerators } from "../../generators/generators-sensing.js";

export function runMicrobitGeneratorTests() {
  describe("micro:bit generators @microbit", function () {
    this.timeout(5000);

    let workspace;

    before(function () {
      initializeVariableIndexes();
      if (!Blockly.Blocks["add_microbit"]) {
        defineSensingBlocks();
      }
      registerSensingGenerators(javascriptGenerator);
    });

    beforeEach(function () {
      workspace = new Blockly.Workspace();
    });

    afterEach(function () {
      workspace.dispose();
    });

    function generate(block) {
      javascriptGenerator.init(workspace);
      const code = javascriptGenerator.blockToCode(block);
      return Array.isArray(code) ? code[0] : code;
    }

    it("add_microbit generates addMicrobit with the variable name and channel", function () {
      const variable = workspace
        .getVariableMap()
        .createVariable("microbit1", "");
      const block = Blockly.serialization.blocks.append(
        {
          type: "add_microbit",
          fields: { MICROBIT_VAR: { id: variable.getId() } },
          inputs: {
            CHANNEL: { shadow: { type: "math_number", fields: { NUM: 3 } } },
          },
        },
        workspace,
      );
      expect(generate(block)).to.equal('addMicrobit("microbit1", 3);\n');
    });

    it("add_microbit defaults the channel to 1", function () {
      const variable = workspace
        .getVariableMap()
        .createVariable("microbit1", "");
      const block = Blockly.serialization.blocks.append(
        {
          type: "add_microbit",
          fields: { MICROBIT_VAR: { id: variable.getId() } },
        },
        workspace,
      );
      expect(generate(block)).to.equal('addMicrobit("microbit1", 1);\n');
    });

    it("microbit_input with a device variable generates onMicrobitEvent", function () {
      workspace.getVariableMap().createVariable("microbit1", "");
      const block = Blockly.serialization.blocks.append(
        {
          type: "microbit_input",
          fields: { EVENT: "i", DEVICE: "microbit1" },
        },
        workspace,
      );
      expect(generate(block)).to.equal(
        'onMicrobitEvent("microbit1", "i", async () => {});\n',
      );
    });

    it("microbit_input defaults to \"any\" and generates whenKeyEvent", function () {
      const block = Blockly.serialization.blocks.append(
        { type: "microbit_input", fields: { EVENT: "i" } },
        workspace,
      );
      expect(block.getFieldValue("DEVICE")).to.equal("__any__");
      expect(generate(block)).to.equal(
        'whenKeyEvent("i", async () => {});\n',
      );
    });

    it("microbit_input resolves variable-id-backed device selections", function () {
      const variable = workspace
        .getVariableMap()
        .createVariable("microbit1", "");
      const block = Blockly.serialization.blocks.append(
        {
          type: "microbit_input",
          fields: { EVENT: "i", DEVICE: variable.getId() },
        },
        workspace,
      );
      expect(generate(block)).to.equal(
        'onMicrobitEvent("microbit1", "i", async () => {});\n',
      );
    });

    it("DEVICE falls back to \"any\" when its variable is deleted", async function () {
      const variableMap = workspace.getVariableMap();
      const variable = variableMap.createVariable("microbit1", "");
      const block = Blockly.serialization.blocks.append(
        {
          type: "microbit_input",
          fields: { EVENT: "i", DEVICE: variable.getId() },
        },
        workspace,
      );
      expect(block.getFieldValue("DEVICE")).to.equal(variable.getId());

      variableMap.deleteVariable(variable);
      // Block onchange handlers run off asynchronous workspace events.
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(block.getFieldValue("DEVICE")).to.equal("__any__");
      expect(generate(block)).to.equal(
        'whenKeyEvent("i", async () => {});\n',
      );
    });

    it("DEVICE keeps its selection when the add_microbit block is deleted", async function () {
      const variable = workspace
        .getVariableMap()
        .createVariable("microbit1", "");
      const addBlock = Blockly.serialization.blocks.append(
        {
          type: "add_microbit",
          fields: { MICROBIT_VAR: { id: variable.getId() } },
        },
        workspace,
      );
      const block = Blockly.serialization.blocks.append(
        {
          type: "microbit_input",
          fields: { EVENT: "i", DEVICE: variable.getId() },
        },
        workspace,
      );

      addBlock.dispose();
      await new Promise((resolve) => setTimeout(resolve, 20));

      // The variable still exists; the selection survives (silent at runtime
      // until a board is bound) and remains renderable in the menu.
      expect(block.getFieldValue("DEVICE")).to.equal(variable.getId());
      const optionValues = block
        .getField("DEVICE")
        .getOptions(false)
        .map((option) => option[1]);
      expect(optionValues).to.include(variable.getId());
      expect(generate(block)).to.equal(
        'onMicrobitEvent("microbit1", "i", async () => {});\n',
      );
    });

    it("legacy XML (no DEVICE field) loads as \"any\" with unchanged output", function () {
      const xml =
        '<xml xmlns="https://developers.google.com/blockly/xml">' +
        '<block type="microbit_input">' +
        '<field name="EVENT">a</field>' +
        "</block></xml>";
      Blockly.Xml.domToWorkspace(
        Blockly.utils.xml.textToDom(xml),
        workspace,
      );
      const block = workspace.getBlocksByType("microbit_input", false)[0];
      expect(block.getFieldValue("DEVICE")).to.equal("__any__");
      expect(generate(block)).to.equal(
        'whenKeyEvent("a", async () => {});\n',
      );
    });
  });
}
