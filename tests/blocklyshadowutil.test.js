import { expect } from "chai";
import {
  roundPositionValue,
  addNumberShadow,
  addXYZShadows,
  addColourShadow,
  addPositionShadows,
  addColourShadowSpec,
  buildColorsListShadowSpec,
} from "../ui/blocklyshadowutil.js";

export function runBlocklyShadowUtilTests() {
  describe("ui/blocklyshadowutil @blocklyshadowutil", function () {
    describe("roundPositionValue", function () {
      it("rounds to 1 decimal place by default", function () {
        expect(roundPositionValue(1.23456)).to.equal(1.2);
      });

      it("rounds to the requested number of decimals", function () {
        expect(roundPositionValue(1.23456, 3)).to.equal(1.235);
      });

      it("rounds to a whole number when decimals is 0", function () {
        expect(roundPositionValue(1.6, 0)).to.equal(2);
      });
    });

    describe("addNumberShadow", function () {
      it("adds a math_number shadow with the given value", function () {
        const spec = {};
        addNumberShadow(spec, "X", 5);
        expect(spec.inputs.X).to.deep.equal({
          shadow: { type: "math_number", fields: { NUM: 5 } },
        });
      });

      it("initializes spec.inputs if missing", function () {
        const spec = {};
        addNumberShadow(spec, "Y", 1);
        expect(spec.inputs).to.exist;
      });

      it("preserves existing inputs on the spec", function () {
        const spec = { inputs: { Z: { shadow: { type: "math_number", fields: { NUM: 9 } } } } };
        addNumberShadow(spec, "X", 5);
        expect(spec.inputs.Z).to.exist;
        expect(spec.inputs.X).to.exist;
      });
    });

    describe("addXYZShadows", function () {
      it("adds rounded X, Y, Z number shadows from a position", function () {
        const spec = {};
        addXYZShadows(spec, { x: 1.23456, y: 2.987, z: -3.05 });
        expect(spec.inputs.X.shadow.fields.NUM).to.equal(1.2);
        expect(spec.inputs.Y.shadow.fields.NUM).to.equal(3);
        // Math.round rounds -30.5 toward +Infinity (to -30), not away from zero.
        expect(spec.inputs.Z.shadow.fields.NUM).to.equal(-3);
      });

      it("defaults missing coordinates to 0", function () {
        const spec = {};
        addXYZShadows(spec, {});
        expect(spec.inputs.X.shadow.fields.NUM).to.equal(0);
        expect(spec.inputs.Y.shadow.fields.NUM).to.equal(0);
        expect(spec.inputs.Z.shadow.fields.NUM).to.equal(0);
      });

      it("defaults to 0,0,0 when pos is undefined", function () {
        const spec = {};
        addXYZShadows(spec, undefined);
        expect(spec.inputs.X.shadow.fields.NUM).to.equal(0);
        expect(spec.inputs.Y.shadow.fields.NUM).to.equal(0);
        expect(spec.inputs.Z.shadow.fields.NUM).to.equal(0);
      });
    });

    describe("addColourShadow", function () {
      it("adds a colour shadow of the given type with the given hex", function () {
        const spec = {};
        addColourShadow(spec, "COLOUR", "colour", "#ff0000");
        expect(spec.inputs.COLOUR).to.deep.equal({
          shadow: { type: "colour", fields: { COLOR: "#ff0000" } },
        });
      });
    });

    describe("addPositionShadows", function () {
      it("adds rounded X, Y, Z number shadows the same as addXYZShadows", function () {
        const spec = {};
        addPositionShadows(spec, { x: 1.26, y: -2.04, z: 0 });
        expect(spec.inputs.X.shadow.fields.NUM).to.equal(1.3);
        expect(spec.inputs.Y.shadow.fields.NUM).to.equal(-2);
        expect(spec.inputs.Z.shadow.fields.NUM).to.equal(0);
      });
    });

    describe("addColourShadowSpec", function () {
      it("defaults shadowType to 'colour'", function () {
        const spec = {};
        addColourShadowSpec(spec, "COLOUR", "#00ff00");
        expect(spec.inputs.COLOUR.shadow.type).to.equal("colour");
        expect(spec.inputs.COLOUR.shadow.fields.COLOR).to.equal("#00ff00");
      });

      it("accepts an explicit shadowType", function () {
        const spec = {};
        addColourShadowSpec(spec, "SKIN", "#abcdef", "skin_colour");
        expect(spec.inputs.SKIN.shadow.type).to.equal("skin_colour");
      });
    });

    describe("buildColorsListShadowSpec", function () {
      it("uses the object's own colour list when one is registered", function () {
        const listSpec = buildColorsListShadowSpec("Star.glb");
        expect(listSpec.extraState.itemCount).to.equal(3);
        expect(listSpec.inputs.ADD0.shadow.fields.COLOR).to.equal("#FFD700");
        expect(listSpec.inputs.ADD1.shadow.fields.COLOR).to.equal("#FFD700");
        expect(listSpec.inputs.ADD2.shadow.fields.COLOR).to.equal("#FFD700");
      });

      it("builds a lists_create_with spec sized to the object's colour list", function () {
        // "cat" isn't in objectColours, so this exercises the 3-colour fallback.
        const listSpec = buildColorsListShadowSpec("__unknown_object__");
        expect(listSpec.type).to.equal("lists_create_with");
        expect(listSpec.extraState.itemCount).to.equal(3);
        expect(listSpec.mutation.items).to.equal(3);
        expect(Object.keys(listSpec.inputs)).to.deep.equal([
          "ADD0",
          "ADD1",
          "ADD2",
        ]);
      });

      it("falls back to a black/white/grey palette for unknown objects", function () {
        const listSpec = buildColorsListShadowSpec("__unknown_object__");
        expect(listSpec.inputs.ADD0.shadow.fields.COLOR).to.equal("#000000");
        expect(listSpec.inputs.ADD1.shadow.fields.COLOR).to.equal("#FFFFFF");
        expect(listSpec.inputs.ADD2.shadow.fields.COLOR).to.equal("#CCCCCC");
      });

      it("every generated input is a colour shadow", function () {
        const listSpec = buildColorsListShadowSpec("__unknown_object__");
        for (const input of Object.values(listSpec.inputs)) {
          expect(input.shadow.type).to.equal("colour");
        }
      });
    });
  });
}
