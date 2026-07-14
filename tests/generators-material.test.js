import { expect } from "chai";
import { javascriptGenerator } from "blockly/javascript";
import { registerMaterialGenerators } from "../generators/generators-material.js";

export function runMaterialGeneratorTests() {
  describe("generators/generators-material @materialgenerators", function () {
    before(function () {
      registerMaterialGenerators(javascriptGenerator);
    });

    // The colour_from_string generator only reads the COLOR field, so a minimal
    // stub block is enough to exercise it without a full Blockly workspace.
    function colourFromString(value) {
      const block = { getFieldValue: () => value };
      const [code] = javascriptGenerator.forBlock["colour_from_string"](block);
      return JSON.parse(code);
    }

    it("expands 3-digit hex to lowercase 6-digit hex", function () {
      expect(colourFromString("f0c")).to.equal("#ff00cc");
      expect(colourFromString("#f0c")).to.equal("#ff00cc");
      expect(colourFromString("FFF")).to.equal("#ffffff");
    });

    it("preserves 6-digit hex (with or without #)", function () {
      expect(colourFromString("800080")).to.equal("#800080");
      expect(colourFromString("#800080")).to.equal("#800080");
    });

    it("preserves named and functional CSS colours", function () {
      expect(colourFromString("red")).to.equal("red");
      expect(colourFromString("rgb(1, 2, 3)")).to.equal("rgb(1, 2, 3)");
    });

    it("falls back to black for invalid input", function () {
      expect(colourFromString("notacolour")).to.equal("#000000");
    });
  });
}
