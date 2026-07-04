import { expect } from "chai";
import {
  MICROBIT_IMAGE_GRID_SIZE,
  MICROBIT_IMAGE_DEFAULT,
  MICROBIT_IMAGE_PRESETS,
  MICROBIT_IMAGE_PICTURE_NAMES,
  normaliseImagePattern,
  isImageCellOn,
  setImageCell,
  toggleImageCell,
  makeMicrobitImageDataUri,
} from "../../blocks/microbitImagePattern.js";

// Pure pattern/editor logic only — FieldMicrobitImage itself needs Blockly
// and a DOM, so its behaviour is covered by these helpers plus the generator
// suite in the browser harness.
export function runMicrobitFieldTests() {
  describe("micro:bit image field helpers @microbit", function () {
    it("has an all-off default of the right size", function () {
      expect(MICROBIT_IMAGE_DEFAULT).to.equal("0".repeat(25));
      expect(MICROBIT_IMAGE_GRID_SIZE).to.equal(5);
    });

    it("normalises field values like the wire format", function () {
      // The field's value is the wire pattern; shared normalisation means a
      // hand-edited save can never render differently from what is sent.
      expect(normaliseImagePattern("99")).to.equal("99" + "0".repeat(23));
      expect(normaliseImagePattern("9".repeat(40))).to.equal("9".repeat(25));
      expect(normaliseImagePattern("#.#" + "9".repeat(22))).to.equal(
        "000" + "9".repeat(22),
      );
      expect(normaliseImagePattern({})).to.equal(
        normaliseImagePattern(String({})),
      );
    });

    it("presets are valid patterns", function () {
      expect(MICROBIT_IMAGE_PRESETS.clear).to.equal(MICROBIT_IMAGE_DEFAULT);
      expect(MICROBIT_IMAGE_PRESETS.full).to.equal("9".repeat(25));
      // The sun from the spec:
      //   # . # . #
      //   . # # # .
      //   # # # # #
      //   . # # # .
      //   # . # . #
      expect(MICROBIT_IMAGE_PRESETS.sun).to.equal(
        "9090909990999990999090909",
      );
      for (const pattern of Object.values(MICROBIT_IMAGE_PRESETS)) {
        expect(normaliseImagePattern(pattern)).to.equal(pattern);
      }
    });

    it("every picture-menu entry names a preset", function () {
      expect(MICROBIT_IMAGE_PICTURE_NAMES).to.deep.equal(["sun"]);
      for (const name of MICROBIT_IMAGE_PICTURE_NAMES) {
        expect(MICROBIT_IMAGE_PRESETS).to.have.property(name);
      }
    });

    it("reads and writes cells row-major from the top-left", function () {
      expect(isImageCellOn(MICROBIT_IMAGE_PRESETS.sun, 0, 0)).to.equal(true);
      expect(isImageCellOn(MICROBIT_IMAGE_PRESETS.sun, 0, 1)).to.equal(false);
      expect(isImageCellOn(MICROBIT_IMAGE_PRESETS.sun, 2, 4)).to.equal(true);

      const pattern = setImageCell(MICROBIT_IMAGE_DEFAULT, 1, 3, "9");
      expect(pattern).to.equal("0".repeat(8) + "9" + "0".repeat(16));
      expect(isImageCellOn(pattern, 1, 3)).to.equal(true);
    });

    it("toggle returns the new pattern and the digit a drag paints with", function () {
      const on = toggleImageCell(MICROBIT_IMAGE_DEFAULT, 4, 4);
      expect(on.digit).to.equal("9");
      expect(isImageCellOn(on.pattern, 4, 4)).to.equal(true);

      const off = toggleImageCell(on.pattern, 4, 4);
      expect(off.digit).to.equal("0");
      expect(off.pattern).to.equal(MICROBIT_IMAGE_DEFAULT);
    });

    it("painting with the first cell's digit is idempotent over a sweep", function () {
      // Drag from an off cell: it toggles on, and sweeping back over painted
      // cells must not toggle them off again.
      let { pattern, digit } = toggleImageCell(MICROBIT_IMAGE_DEFAULT, 0, 0);
      for (const [row, col] of [[0, 1], [0, 2], [0, 1], [0, 0]]) {
        pattern = setImageCell(pattern, row, col, digit);
      }
      expect(pattern).to.equal("999" + "0".repeat(22));
    });

    it("renders 25 rounded squares as an SVG data URI", function () {
      const uri = makeMicrobitImageDataUri(MICROBIT_IMAGE_PRESETS.sun);
      expect(uri).to.match(/^data:image\/svg\+xml,/);
      const svg = decodeURIComponent(uri.slice("data:image/svg+xml,".length));
      const cells = svg.match(/<rect [^>]*rx="3"/g) ?? [];
      expect(cells.length).to.equal(25);
      expect((svg.match(/#ff8a80/g) ?? []).length).to.equal(17); // lit sun LEDs
      const unlit = makeMicrobitImageDataUri(MICROBIT_IMAGE_DEFAULT);
      expect(unlit).to.not.include(encodeURIComponent("#ff8a80"));
      expect(unlit).to.not.equal(uri);
    });
  });
}
