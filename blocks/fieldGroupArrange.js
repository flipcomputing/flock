import * as Blockly from 'blockly';
import { translate } from '../main/translation.js';
import { announceToScreenReader } from '../main/input.js';
import { getCurrentIconColor, makeIconDataUrl } from './blockIcons.js';
import {
  ARRANGE_AXES,
  ARRANGE_MODES,
  arrangeGroup,
  getArrangeMembers,
  minMembersFor,
} from '../ui/groupArrange.js';

const ICON_SIZE = 28;
const AXIS_COLOURS = { x: '#0072B2', y: '#009E73', z: '#D55E00' };
const BUTTON_ICON_PATH = 'M11 3h2v18h-2zM4 6h16v4H4zM7 14h10v4H7z';

const MODE_ICONS = {
  min: '<rect x="3" y="3" width="2" height="18"/><rect x="5" y="6" width="14" height="4"/><rect x="5" y="14" width="8" height="4"/>',
  centre:
    '<rect x="11" y="3" width="2" height="18"/><rect x="4" y="6" width="16" height="4"/><rect x="7" y="14" width="10" height="4"/>',
  max: '<rect x="19" y="3" width="2" height="18"/><rect x="5" y="6" width="14" height="4"/><rect x="11" y="14" width="8" height="4"/>',
  distribute:
    '<rect x="2" y="7" width="4" height="10"/><rect x="10" y="4" width="4" height="16"/><rect x="18" y="8" width="4" height="8"/>',
};

function modeIcon(axis, mode) {
  // Y and Z use the X icons turned a quarter, so min is at the bottom.
  const transform = axis === 'x' ? '' : ' transform="rotate(-90 12 12)"';
  return `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="currentColor"><g${transform}>${MODE_ICONS[mode]}</g></svg>`;
}

function arrangeText(key, axis) {
  return translate(key).replace('{axis}', axis);
}

// An image field with a click handler, like the section icon: clickable and
// keyboard-reachable without holding a value, so nothing is saved.
export class FieldGroupArrange extends Blockly.FieldImage {
  constructor() {
    super(
      makeIconDataUrl('0 0 24 24', BUTTON_ICON_PATH, getCurrentIconColor()),
      ICON_SIZE,
      ICON_SIZE,
      translate('group_arrange_button'),
      () => this._openEditor()
    );
    this._buttons = null;
  }

  // Borderless fields otherwise report the whole block's size, which puts
  // the dropdown under the block's far corner.
  getScaledBBox() {
    const r = this.getSvgRoot().getBoundingClientRect();
    return new Blockly.utils.Rect(
      r.top + window.scrollY,
      r.bottom + window.scrollY,
      r.left + window.scrollX,
      r.right + window.scrollX
    );
  }

  _openEditor() {
    Blockly.DropDownDiv.hideWithoutAnimation();
    const editor = this._createEditor();
    const buttons = this._buttons;
    Blockly.DropDownDiv.getContentDiv().appendChild(editor);
    Blockly.DropDownDiv.showPositionedByField(this, () => {
      if (this._buttons === buttons) this._buttons = null;
    });
    this._refreshButtons();
    buttons.flat().find((button) => !button.disabled)?.focus();
  }

  _createEditor() {
    const grid = document.createElement('div');
    grid.className = 'group-arrange-editor';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', translate('group_arrange_button'));
    grid.addEventListener('keydown', (e) => this._onUndoKey(e));

    this._buttons = ARRANGE_AXES.map((axis, row) => {
      const axisLabel = document.createElement('span');
      axisLabel.className = 'group-arrange-axis';
      axisLabel.style.color = AXIS_COLOURS[axis];
      axisLabel.textContent = axis;
      grid.appendChild(axisLabel);

      return ARRANGE_MODES.map((mode, col) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'group-arrange-button';
        button.style.setProperty('--axis-colour', AXIS_COLOURS[axis]);
        const label = arrangeText(`group_arrange_${mode}_label`, axis);
        button.title = label;
        button.setAttribute('aria-label', label);
        button.innerHTML = modeIcon(axis, mode);
        const caption = document.createElement('span');
        caption.textContent = arrangeText(`group_arrange_${mode}`, axis);
        button.appendChild(caption);
        button.addEventListener('click', () => {
          arrangeGroup(this.getSourceBlock(), axis, mode).catch((error) =>
            console.warn('Group arrange failed:', error)
          );
        });
        button.addEventListener('keydown', (e) => this._onKeyDown(e, row, col));
        grid.appendChild(button);
        return button;
      });
    });

    return grid;
  }

  _refreshButtons() {
    const count = getArrangeMembers(this.getSourceBlock()).length;
    ARRANGE_AXES.forEach((_, row) =>
      ARRANGE_MODES.forEach((mode, col) => {
        this._buttons[row][col].disabled = count < minMembersFor(mode);
      })
    );
  }

  // Focus is in the dropdown, so the workspace's own undo keys don't fire.
  _onUndoKey(e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const redo = e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey);
    if (!redo && e.code !== 'KeyZ') return;
    e.preventDefault();
    e.stopPropagation();
    this.getSourceBlock()?.workspace.undo(redo);
    announceToScreenReader(translate(redo ? 'redo_performed' : 'undo_performed'), {
      requireCanvasFocus: false,
    });
  }

  _onKeyDown(e, row, col) {
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    const rows = this._buttons.length;
    const cols = this._buttons[0].length;
    let r = row;
    let c = col;
    for (let step = 0; step < rows * cols; step++) {
      r = (r + move[0] + rows) % rows;
      c = (c + move[1] + cols) % cols;
      const target = this._buttons[r][c];
      if (!target.disabled) {
        target.focus();
        return;
      }
    }
  }
}
