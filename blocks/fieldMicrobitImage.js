// Custom Blockly field for the micro:bit LED image: the block face shows the
// current 5×5 pattern as an SVG, and clicking opens a DropDownDiv editor with
// preset buttons and a paintable grid. The value is the wire pattern itself
// (25 brightness digits, row-major; the editor writes only 0 and 9), so
// XML/JSON save, undo/redo, and copy/paste all use the plain string.
import * as Blockly from "blockly";
import { translate } from "../main/translation.js";
import {
  MICROBIT_IMAGE_GRID_SIZE,
  MICROBIT_IMAGE_DEFAULT,
  MICROBIT_IMAGE_PRESETS,
  MICROBIT_IMAGE_PICTURE_NAMES,
  MICROBIT_IMAGE_LIT_COLOUR,
  MICROBIT_IMAGE_UNLIT_COLOUR,
  MICROBIT_IMAGE_PLATE_COLOUR,
  normaliseImagePattern,
  isImageCellOn,
  setImageCell,
  toggleImageCell,
  makeMicrobitImageDataUri,
} from "./microbitImagePattern.js";

const FIELD_IMAGE_SIZE = 50; // px on the block face, same as material previews
const PRESET_PREVIEW_SIZE = 28;
const PICTURE_PREVIEW_SIZE = 50; // menu entries, same size as material swatches
const CELL_SIZE = 26;
const CELL_ON_COLOUR = MICROBIT_IMAGE_LIT_COLOUR;
const CELL_OFF_COLOUR = MICROBIT_IMAGE_UNLIT_COLOUR;

export class FieldMicrobitImage extends Blockly.Field {
  SERIALIZABLE = true;
  EDITABLE = true;
  CURSOR = "pointer";

  constructor(value = MICROBIT_IMAGE_DEFAULT) {
    super(value);
    this.size_ = new Blockly.utils.Size(FIELD_IMAGE_SIZE, FIELD_IMAGE_SIZE);
    this._cellButtons = null; // 25 editor buttons, row-major, while open
    this._paintDigit = null; // digit being painted during a pointer drag
  }

  static fromJson(options) {
    return new FieldMicrobitImage(options?.value);
  }

  // Any input is accepted and normalised to 25 digits, so a hand-edited or
  // corrupt save never breaks the block.
  doClassValidation_(newValue) {
    return normaliseImagePattern(newValue);
  }

  initView() {
    this.imageElement_ = Blockly.utils.dom.createSvgElement(
      Blockly.utils.Svg.IMAGE,
      {
        height: `${FIELD_IMAGE_SIZE}px`,
        width: `${FIELD_IMAGE_SIZE}px`,
      },
      this.fieldGroup_,
    );
    this._updateFaceImage();
  }

  render_() {
    this._updateFaceImage();
    super.render_();
  }

  // Fixed-size image field. Without this override the base render_ measures
  // the (nonexistent) text element and shrinks the reported size, so the
  // block outline is drawn short and the image hangs off its end — the same
  // reason core FieldImage no-ops this method.
  updateSize_() {}

  _updateFaceImage() {
    this.imageElement_?.setAttributeNS(
      Blockly.utils.dom.XLINK_NS,
      "xlink:href",
      makeMicrobitImageDataUri(this.getValue()),
    );
  }

  // The 25-digit value is meaningless read aloud; describe the field instead.
  getText_() {
    return translate("microbit_image_field_label");
  }

  computeAriaLabel() {
    return translate("microbit_image_field_label");
  }

  // ------------------------------------------------------------------ editor

  showEditor_() {
    Blockly.DropDownDiv.getContentDiv().appendChild(this._createEditor());
    Blockly.DropDownDiv.showPositionedByField(
      this,
      this._disposeEditor.bind(this),
    );
    this._cellButtons?.[0]?.focus();
  }

  _disposeEditor() {
    this._cellButtons = null;
    this._paintDigit = null;
  }

  _createEditor() {
    const container = document.createElement("div");
    container.style.padding = "8px";

    const presetRow = document.createElement("div");
    presetRow.style.display = "flex";
    presetRow.style.gap = "6px";
    presetRow.style.marginBottom = "8px";
    presetRow.style.alignItems = "stretch";
    for (const name of ["clear", "full"]) {
      presetRow.appendChild(
        this._createPresetButton(name, MICROBIT_IMAGE_PRESETS[name]),
      );
    }
    presetRow.appendChild(this._createPictureMenu());
    container.appendChild(presetRow);
    container.appendChild(this._createGrid());
    return container;
  }

  // Dropdown of ready-made pictures (currently just the sun), presented like
  // the material dropdowns: each menu entry is the picture itself, rendered
  // by the same SVG used on the block face.
  _createPictureMenu() {
    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.setAttribute("aria-label", translate("microbit_image_picture_menu"));
    trigger.setAttribute("aria-haspopup", "true");
    trigger.setAttribute("aria-expanded", "false");
    trigger.style.cursor = "pointer";
    trigger.style.height = "100%";
    trigger.style.padding = "2px 4px";
    trigger.style.border = "1px solid #666";
    trigger.style.borderRadius = "4px";
    trigger.style.background = "transparent";
    trigger.style.display = "flex";
    trigger.style.alignItems = "center";
    trigger.style.gap = "2px";
    const triggerPreview = document.createElement("img");
    triggerPreview.src = makeMicrobitImageDataUri(
      MICROBIT_IMAGE_PRESETS[MICROBIT_IMAGE_PICTURE_NAMES[0]],
    );
    triggerPreview.alt = "";
    triggerPreview.width = PRESET_PREVIEW_SIZE;
    triggerPreview.height = PRESET_PREVIEW_SIZE;
    triggerPreview.style.display = "block";
    trigger.appendChild(triggerPreview);
    trigger.appendChild(document.createTextNode("▾"));

    const panel = document.createElement("div");
    panel.style.position = "absolute";
    panel.style.top = "calc(100% + 2px)";
    panel.style.left = "0";
    panel.style.zIndex = "1";
    panel.style.padding = "4px";
    panel.style.background = "#fff";
    panel.style.border = "1px solid #666";
    panel.style.borderRadius = "4px";
    panel.style.display = "none";
    panel.style.gridTemplateColumns = `repeat(${Math.min(
      4,
      MICROBIT_IMAGE_PICTURE_NAMES.length,
    )}, auto)`;
    panel.style.gap = "4px";

    const setOpen = (open) => {
      panel.style.display = open ? "grid" : "none";
      trigger.setAttribute("aria-expanded", String(open));
    };

    for (const name of MICROBIT_IMAGE_PICTURE_NAMES) {
      const option = document.createElement("button");
      option.type = "button";
      option.setAttribute(
        "aria-label",
        translate(`microbit_image_preset_${name}`),
      );
      option.style.cursor = "pointer";
      option.style.padding = "2px";
      option.style.border = "none";
      option.style.borderRadius = "4px";
      option.style.background = "transparent";
      const preview = document.createElement("img");
      preview.src = makeMicrobitImageDataUri(MICROBIT_IMAGE_PRESETS[name]);
      preview.alt = "";
      preview.width = PICTURE_PREVIEW_SIZE;
      preview.height = PICTURE_PREVIEW_SIZE;
      preview.style.display = "block";
      option.appendChild(preview);
      option.addEventListener("click", () => {
        this.setValue(MICROBIT_IMAGE_PRESETS[name]);
        this._refreshCells();
        setOpen(false);
        trigger.focus();
      });
      panel.appendChild(option);
    }

    trigger.addEventListener("click", () => {
      const open = panel.style.display === "none";
      setOpen(open);
      if (open) panel.querySelector("button")?.focus();
    });
    // Escape closes just the picture menu, not the whole field editor.
    wrapper.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || panel.style.display === "none") return;
      event.stopPropagation();
      setOpen(false);
      trigger.focus();
    });

    wrapper.appendChild(trigger);
    wrapper.appendChild(panel);
    return wrapper;
  }

  _createPresetButton(name, pattern) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute(
      "aria-label",
      translate(`microbit_image_preset_${name}`),
    );
    button.style.cursor = "pointer";
    button.style.padding = "2px";
    button.style.border = "1px solid #666";
    button.style.borderRadius = "4px";
    button.style.background = "transparent";
    const preview = document.createElement("img");
    preview.src = makeMicrobitImageDataUri(pattern);
    preview.alt = "";
    preview.width = PRESET_PREVIEW_SIZE;
    preview.height = PRESET_PREVIEW_SIZE;
    preview.style.display = "block";
    button.appendChild(preview);
    button.addEventListener("click", () => {
      this.setValue(pattern);
      this._refreshCells();
    });
    return button;
  }

  _createGrid() {
    const grid = document.createElement("div");
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", translate("microbit_image_grid_label"));
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = `repeat(${MICROBIT_IMAGE_GRID_SIZE}, ${CELL_SIZE}px)`;
    grid.style.gap = "4px";
    grid.style.padding = "6px";
    grid.style.background = MICROBIT_IMAGE_PLATE_COLOUR;
    grid.style.borderRadius = "6px";
    grid.style.width = "fit-content";
    grid.style.touchAction = "none";

    this._cellButtons = [];
    for (let row = 0; row < MICROBIT_IMAGE_GRID_SIZE; row++) {
      for (let col = 0; col < MICROBIT_IMAGE_GRID_SIZE; col++) {
        grid.appendChild(this._createCell(row, col));
      }
    }
    this._refreshCells();

    // Pointer-drag painting: the first cell toggles and every cell swept
    // afterwards takes the digit the first cell became.
    grid.addEventListener("pointerdown", (event) => {
      const cell = this._cellAt(event);
      if (!cell) return;
      event.preventDefault(); // no text-selection/drag artefacts while painting
      const { pattern, digit } = toggleImageCell(
        this.getValue(),
        cell.row,
        cell.col,
      );
      this._paintDigit = digit;
      this.setValue(pattern);
      this._refreshCells();
    });
    grid.addEventListener("pointermove", (event) => {
      if (this._paintDigit === null) return;
      const cell = this._cellAt(event);
      if (!cell) return;
      this.setValue(
        setImageCell(this.getValue(), cell.row, cell.col, this._paintDigit),
      );
      this._refreshCells();
    });
    const endPaint = () => {
      this._paintDigit = null;
    };
    grid.addEventListener("pointerup", endPaint);
    grid.addEventListener("pointercancel", endPaint);

    grid.addEventListener("keydown", (event) => this._onGridKeyDown(event));
    return grid;
  }

  _createCell(row, col) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.row = String(row);
    button.dataset.col = String(col);
    // Roving tabindex: one tab stop for the whole grid, arrows move within.
    button.tabIndex = row === 0 && col === 0 ? 0 : -1;
    button.style.width = `${CELL_SIZE}px`;
    button.style.height = `${CELL_SIZE}px`;
    button.style.border = "none";
    button.style.borderRadius = "4px";
    button.style.cursor = "pointer";
    button.style.padding = "0";
    // Keyboard activation only: pointer input is handled by the grid's
    // painting listeners, and a mouse click would otherwise toggle twice.
    button.addEventListener("click", (event) => {
      if (event.detail !== 0) return;
      this.setValue(toggleImageCell(this.getValue(), row, col).pattern);
      this._refreshCells();
    });
    this._cellButtons.push(button);
    return button;
  }

  _cellAt(event) {
    // elementFromPoint rather than event.target: touch input implicitly
    // captures the pointer on the pressed cell, so during a drag the events
    // keep targeting that first cell rather than the one under the finger.
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const button = element?.closest?.("button[data-row]");
    if (!button || !this._cellButtons?.includes(button)) return null;
    return { row: Number(button.dataset.row), col: Number(button.dataset.col) };
  }

  _refreshCells() {
    if (!this._cellButtons) return;
    const pattern = this.getValue();
    for (const button of this._cellButtons) {
      const row = Number(button.dataset.row);
      const col = Number(button.dataset.col);
      const on = isImageCellOn(pattern, row, col);
      button.style.background = on ? CELL_ON_COLOUR : CELL_OFF_COLOUR;
      button.setAttribute(
        "aria-label",
        translate("microbit_image_cell_label")
          .replace("%1", String(row + 1))
          .replace("%2", String(col + 1))
          .replace(
            "%3",
            translate(on ? "microbit_image_cell_on" : "microbit_image_cell_off"),
          ),
      );
    }
  }

  _onGridKeyDown(event) {
    const target = event.target?.closest?.("button[data-row]");
    if (!target || !this._cellButtons) return;
    let row = Number(target.dataset.row);
    let col = Number(target.dataset.col);
    switch (event.key) {
      case "ArrowUp":
        row = Math.max(0, row - 1);
        break;
      case "ArrowDown":
        row = Math.min(MICROBIT_IMAGE_GRID_SIZE - 1, row + 1);
        break;
      case "ArrowLeft":
        col = Math.max(0, col - 1);
        break;
      case "ArrowRight":
        col = Math.min(MICROBIT_IMAGE_GRID_SIZE - 1, col + 1);
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    const next = this._cellButtons[row * MICROBIT_IMAGE_GRID_SIZE + col];
    target.tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
  }
}

Blockly.fieldRegistry.register("field_microbit_image", FieldMicrobitImage);
