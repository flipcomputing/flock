import { expect } from "chai";
import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";
import { defineMaterialsBlocks } from "../../blocks/materials.js";
import { registerMaterialGenerators } from "../../generators/generators-material.js";



export function runColorValidationTests() {
  describe("colour_from_string generator @security", function () {
    this.timeout(5000);

    let workspace;

    before(function () {
      if (!Blockly.Blocks["colour_from_string"]) {
      defineMaterialsBlocks();
      }
      registerMaterialGenerators(javascriptGenerator);
    });

    beforeEach(function () {
      workspace = new Blockly.Workspace();
    });

    afterEach(function () {
      workspace.dispose();
    });

    // colour_from_string is a value block, so blockToCode returns
    // [code, order] — unwrap to just the code string.
    function generate(block) {
      javascriptGenerator.init(workspace);
      const code = javascriptGenerator.blockToCode(block);
      return Array.isArray(code) ? code[0] : code;
    }

    it("generates a hash-prefixed colour string from a bare hex value", function () {
      let block = Blockly.serialization.blocks.append(
      {
        type: "colour_from_string",
        fields: { COLOR: "F000F0" },
      },
      workspace,
      );
      expect(generate(block)).to.equal('"#F000F0"');
      block = Blockly.serialization.blocks.append(
      {
        type: "colour_from_string",
        fields: { COLOR: "F00" },
      },
      workspace,
      );
      expect(generate(block)).to.equal('"#ff0000"');
    });

    it("doesn't generate a hash-prefixed colour string from a bare hex value that is an invalid length", function () {
      let block = Blockly.serialization.blocks.append({ type: "colour_from_string",
        fields: { COLOR: "F000F0F" },
      },workspace,);
      expect(generate(block)).to.equal('"#000000"');
      block = Blockly.serialization.blocks.append({ type: "colour_from_string",
        fields: { COLOR: "F" },
      },workspace,);
      expect(generate(block)).to.equal('"#000000"');
      block = Blockly.serialization.blocks.append({ type: "colour_from_string",
        fields: { COLOR: "F0" },
      },workspace,);
      expect(generate(block)).to.equal('"#000000"');
      block = Blockly.serialization.blocks.append({ type: "colour_from_string",
        fields: { COLOR: "F000" },
      },workspace,);
      expect(generate(block)).to.equal('"#000000"');
      block = Blockly.serialization.blocks.append({ type: "colour_from_string",
        fields: { COLOR: "F000F" },
      },workspace,);
      expect(generate(block)).to.equal('"#000000"');
    });

    it("doesn't generate a hash-prefixed colour string from a bare hex value that is too short", function () {
      const block = Blockly.serialization.blocks.append(
      {
        type: "colour_from_string",
        fields: { COLOR: "80008" },
      },
      workspace,
      );
      expect(generate(block)).to.equal('"#000000"');
    });



    it("defaults to black when the field is empty", function () {
      const block = Blockly.serialization.blocks.append(
      {
        type: "colour_from_string",
        fields: { COLOR: "" },
      },
      workspace,
      );
      expect(generate(block)).to.equal('"#000000"');
    });



    it("generates a colour name string from a valid colour name", function () {
      const block = Blockly.serialization.blocks.append(
      {
        type: "colour_from_string",
        fields: { COLOR: "red" },
      },
      workspace,
      );
      expect(generate(block)).to.equal('"red"');
    });

    it("doesn't generate a hash-prefixed colour string from an invalid colour name", function () {
      const block = Blockly.serialization.blocks.append(
      {
        type: "colour_from_string",
        fields: { COLOR: "squirrel" },
      },
      workspace,
      );
      expect(generate(block)).to.equal('"#000000"');
    });



    it("doesn't generate a colour string from input with quotes", function () {
      const block = Blockly.serialization.blocks.append(
      {
        type: "colour_from_string",
        fields: { COLOR: "red\" + \"" },
      },
      workspace,
      );
      expect(generate(block)).to.equal('"#000000"');
    });

    it("doesn't generate a colour string from input that requires evaluating code", function () {
      const block = Blockly.serialization.blocks.append(
      {
        type: "colour_from_string",
        fields: { COLOR: "#0000\" + (255).toString(16) + \"" },
      },
      workspace,
      );
      expect(generate(block)).to.equal('"#000000"');
    });

    it("doesn't generate a colour string from input that requires invoking a Flock function", function () {
      const block = Blockly.serialization.blocks.append(
      {
        type: "colour_from_string",
        fields: { COLOR: "\" + randomColour() + \"" },
      },
      workspace,
      );
      expect(generate(block)).to.equal('"#000000"');
    });

    it("doesn't generate a colour string from input that requires invoking a Flock function later", function () {
      const block = Blockly.serialization.blocks.append(
      {
        type: "colour_from_string",
        fields: { COLOR: "000000\" + changeColor(capsule1, { color: randomColour() }) + \"" },
      },
      workspace,
      );
      expect(generate(block)).to.equal('"#000000"');
    });

    it("doesn't generate a colour string from input that requires calling a disallowed function", function () {
      const block = Blockly.serialization.blocks.append(
      {
        type: "colour_from_string",
        fields: { COLOR: "\" + eval(\"1\") + \"" },
      },
      workspace,
      );
      expect(generate(block)).to.equal('"#000000"');
    });
  });
}
