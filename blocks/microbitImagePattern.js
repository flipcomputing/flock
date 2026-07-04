// Pure helpers for the micro:bit LED image field: pattern maths and the SVG
// preview. No Blockly and no DOM, so everything here runs in the node test
// runner alongside the protocol suites. A pattern is 25 brightness digits,
// row-major from the top-left; the editor only ever writes 0 (off) and 9
// (on). On the wire the pattern travels as five short row lines — see
// serialiseImageRows in microbit/protocol.js.
import { normaliseImagePattern } from "../microbit/protocol.js";

export const MICROBIT_IMAGE_GRID_SIZE = 5;
export const MICROBIT_IMAGE_OFF = "0";
export const MICROBIT_IMAGE_ON = "9";
export const MICROBIT_IMAGE_DEFAULT = MICROBIT_IMAGE_OFF.repeat(
  MICROBIT_IMAGE_GRID_SIZE * MICROBIT_IMAGE_GRID_SIZE,
);

// Named preset patterns. clear and full appear as one-click buttons in the
// editor; the names listed in MICROBIT_IMAGE_PICTURE_NAMES appear in the
// editor's picture dropdown.
export const MICROBIT_IMAGE_PRESETS = Object.freeze({
  clear: MICROBIT_IMAGE_DEFAULT,
  full: MICROBIT_IMAGE_ON.repeat(MICROBIT_IMAGE_DEFAULT.length),
  sun: "9090909990999990999090909",
});

// Dropdown pictures, in menu order. To add one: add its pattern to
// MICROBIT_IMAGE_PRESETS, its name here, and a microbit_image_preset_<name>
// string to the locales.
export const MICROBIT_IMAGE_PICTURE_NAMES = Object.freeze(["sun"]);

export { normaliseImagePattern };

// High-contrast LED colours, shared by the block-face SVG and the editor
// grid: bright red on near-black reads at block-icon sizes.
export const MICROBIT_IMAGE_LIT_COLOUR = "#ff8a80";
export const MICROBIT_IMAGE_UNLIT_COLOUR = "#303030";
export const MICROBIT_IMAGE_PLATE_COLOUR = "#0d0d0d";

/** True when the LED at (row, col) is lit (any non-zero brightness). */
export function isImageCellOn(pattern, row, col) {
  return (
    normaliseImagePattern(pattern)[row * MICROBIT_IMAGE_GRID_SIZE + col] !==
    MICROBIT_IMAGE_OFF
  );
}

/** Set the LED at (row, col) to the given brightness digit. */
export function setImageCell(pattern, row, col, digit) {
  const normalised = normaliseImagePattern(pattern);
  const index = row * MICROBIT_IMAGE_GRID_SIZE + col;
  return (
    normalised.slice(0, index) + digit + normalised.slice(index + 1)
  );
}

/**
 * Toggle the LED at (row, col) between off and full brightness. Returns the
 * new pattern; the digit the cell became is what a pointer-drag paints onto
 * every other cell it sweeps.
 */
export function toggleImageCell(pattern, row, col) {
  const digit = isImageCellOn(pattern, row, col)
    ? MICROBIT_IMAGE_OFF
    : MICROBIT_IMAGE_ON;
  return { pattern: setImageCell(pattern, row, col, digit), digit };
}

/**
 * Render a pattern as an SVG data URI (25 rounded squares on a dark plate,
 * micro:bit style, lit LEDs red). Used for the block-face image and the
 * editor's preset previews.
 */
export function makeMicrobitImageDataUri(pattern) {
  const normalised = normaliseImagePattern(pattern);
  const cell = 16;
  const gap = 4;
  const padding = 6;
  const size =
    MICROBIT_IMAGE_GRID_SIZE * cell +
    (MICROBIT_IMAGE_GRID_SIZE - 1) * gap +
    2 * padding;
  let squares = "";
  for (let row = 0; row < MICROBIT_IMAGE_GRID_SIZE; row++) {
    for (let col = 0; col < MICROBIT_IMAGE_GRID_SIZE; col++) {
      const lit =
        normalised[row * MICROBIT_IMAGE_GRID_SIZE + col] !==
        MICROBIT_IMAGE_OFF;
      const x = padding + col * (cell + gap);
      const y = padding + row * (cell + gap);
      squares +=
        `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="3" ` +
        `fill="${lit ? MICROBIT_IMAGE_LIT_COLOUR : MICROBIT_IMAGE_UNLIT_COLOUR}"/>`;
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" rx="8" fill="${MICROBIT_IMAGE_PLATE_COLOUR}"/>` +
    squares +
    `</svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}
