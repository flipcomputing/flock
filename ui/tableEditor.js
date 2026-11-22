import * as Blockly from 'blockly';
import { translate } from '../main/translation.js';
import { h, svgIcon } from './dom.js';
import {
  deleteStartColumn,
  deleteStartRow,
  insertStartColumn,
  insertStartRow,
  moveStartColumn,
  renameStartColumn,
  setStartCell,
  startColumns,
  startRows,
} from '../blocks/tableData.js';

const PAGE_ROWS = 10;
const MARGIN = 10;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 320;
const RESIZE_STEP = 20;

const ICONS = {
  addRow: [
    ['rect', { x: 3, y: 3, width: 18, height: 10, rx: 2 }],
    ['path', { d: 'M3 8h18M12 16v6M9 19h6' }],
  ],
  deleteRow: [
    ['rect', { x: 3, y: 3, width: 18, height: 10, rx: 2 }],
    ['path', { d: 'M3 8h18M8 19h8' }],
  ],
  addColumn: [
    ['rect', { x: 3, y: 3, width: 10, height: 18, rx: 2 }],
    ['path', { d: 'M8 3v18M19 9v6M16 12h6' }],
  ],
  deleteColumn: [
    ['rect', { x: 3, y: 3, width: 10, height: 18, rx: 2 }],
    ['path', { d: 'M8 3v18M15 12h7' }],
  ],
  moveLeft: [['path', { d: 'M14 5l-7 7 7 7M7 12h13' }]],
  moveRight: [['path', { d: 'M10 5l7 7-7 7M17 12H4' }]],
  close: [['path', { d: 'M6 6l12 12M18 6L6 18' }]],
};

const icon = (shapes) =>
  svgIcon(
    {
      viewBox: '0 0 24 24',
      width: 20,
      height: 20,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    shapes
  );

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

function visibleArea() {
  const view = window.visualViewport;
  return view
    ? { left: view.offsetLeft, top: view.offsetTop, width: view.width, height: view.height }
    : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

function focusBlockButton(block) {
  for (const node of [block.getField('EDIT_DATA'), block]) {
    try {
      Blockly.getFocusManager().focusNode(node);
      return;
    } catch {
      continue;
    }
  }
}

class TableEditor {
  constructor() {
    this.block = null;
    this.workspace = null;
    this.columns = [];
    this.rows = [];
    this.active = { row: 0, column: 0 };
    this.editing = null;
    this.size = null;
    this.onChange = (event) => this.workspaceChanged(event);
    this.onViewportChange = () => this.fitToViewport();
    this.build();
  }

  liveBlock() {
    if (this.block?.isDeadOrDying()) {
      this.block = this.workspace?.getBlockById(this.block.id) ?? null;
    }
    return this.block;
  }

  dataStamp() {
    const block = this.liveBlock();
    return block ? JSON.stringify([startColumns(block), startRows(block)]) : '';
  }

  build() {
    this.buttons = {};
    const button = (name, action) => {
      const element = h(
        'button',
        { type: 'button', class: 'gizmo-button table-editor-button' },
        icon(ICONS[name])
      );
      element.addEventListener('click', action);
      this.buttons[name] = element;
      return element;
    };

    this.title = h('h2', { id: 'tableEditorTitle', class: 'table-editor-title' });
    this.hint = h('p', { id: 'tableEditorHint', class: 'table-editor-hint' });
    this.message = h('p', { class: 'table-editor-message' });
    this.status = h('div', { class: 'sr-only', 'aria-live': 'polite' });
    this.grid = h('table', {
      class: 'table-editor-grid',
      role: 'grid',
      'aria-labelledby': 'tableEditorTitle',
      'aria-describedby': 'tableEditorHint',
    });
    this.scroller = h('div', { class: 'table-editor-scroll' }, this.grid);
    this.handle = h('div', { class: 'color-picker-drag-handle', 'aria-hidden': 'true' });
    this.resizer = h('button', { type: 'button', class: 'table-editor-resize' });

    this.container = h(
      'div',
      {
        class: 'table-editor',
        role: 'dialog',
        'aria-modal': 'false',
        'aria-labelledby': 'tableEditorTitle',
        hidden: true,
      },
      h(
        'div',
        { class: 'table-editor-content' },
        this.handle,
        h(
          'div',
          { class: 'table-editor-inner' },
          h(
            'div',
            { class: 'table-editor-header' },
            this.title,
            button('close', () => this.close({ restoreFocus: true }))
          ),
          h(
            'div',
            { class: 'table-editor-toolbar' },
            button('addRow', () => this.addRow()),
            button('deleteRow', () => this.deleteRow()),
            button('addColumn', () => this.addColumn()),
            button('deleteColumn', () => this.deleteColumn()),
            button('moveLeft', () => this.moveColumn(-1)),
            button('moveRight', () => this.moveColumn(1))
          ),
          this.message,
          this.scroller,
          this.hint,
          this.status
        ),
        this.resizer
      )
    );
    this.content = this.container.firstElementChild;
    document.body.append(this.container);

    this.container.addEventListener('keydown', (event) => this.onKeydown(event));
    this.grid.addEventListener('keydown', (event) => this.onGridKeydown(event));
    this.grid.addEventListener('pointerdown', (event) => this.onGridPointerDown(event));
    document.addEventListener('translationsapplied', () =>
      requestAnimationFrame(() => {
        if (!this.block || this.container.hidden) return;
        this.applyTranslations();
        this.workspaceChanged({});
      })
    );
    this.setupDragHandle();
    this.setupResizer();
  }

  applyTranslations() {
    const labels = {
      close: 'table_editor_close',
      addRow: 'table_editor_add_row',
      deleteRow: 'table_editor_delete_row',
      addColumn: 'table_editor_add_column',
      deleteColumn: 'table_editor_delete_column',
      moveLeft: 'table_editor_move_column_left',
      moveRight: 'table_editor_move_column_right',
    };
    for (const [name, key] of Object.entries(labels)) {
      this.buttons[name].setAttribute('aria-label', translate(key));
      this.buttons[name].title = translate(key);
    }
    this.hint.textContent = translate('table_editor_keys');
    this.resizer.setAttribute('aria-label', translate('table_editor_resize'));
    this.resizer.title = translate('table_editor_resize');
  }

  open(block) {
    if (this.editing) this.finishEdit(true);
    if (this.workspace !== block.workspace) {
      this.workspace?.removeChangeListener(this.onChange);
      this.workspace = block.workspace;
      this.workspace.addChangeListener(this.onChange);
    }
    const reopening = this.block === block && !this.container.hidden;
    this.block = block;
    if (!reopening) this.active = { row: 0, column: 0 };
    if (this.container.hidden) {
      window.visualViewport?.addEventListener('resize', this.onViewportChange);
      window.visualViewport?.addEventListener('scroll', this.onViewportChange);
      window.addEventListener('resize', this.onViewportChange);
    }
    this.container.hidden = false;
    this.applySize();
    this.applyTranslations();
    this.render();
    if (!reopening) this.position();
    this.focusActive();
  }

  close({ restoreFocus = false } = {}) {
    if (this.editing) this.finishEdit(true);
    const block = this.liveBlock();
    this.container.hidden = true;
    window.visualViewport?.removeEventListener('resize', this.onViewportChange);
    window.visualViewport?.removeEventListener('scroll', this.onViewportChange);
    window.removeEventListener('resize', this.onViewportChange);
    this.workspace?.removeChangeListener(this.onChange);
    this.workspace = null;
    this.block = null;
    if (restoreFocus && block && !block.isDeadOrDying()) focusBlockButton(block);
  }

  workspaceChanged(event) {
    if (event.isUiEvent || !this.block) return;
    const block = this.liveBlock();
    if (!block || !this.workspace.getBlockById(block.id)) {
      this.close();
      return;
    }
    if (!this.editing) this.render();
    else if (this.editing.stamp !== this.dataStamp()) this.finishEdit(false);
  }

  render() {
    const block = this.liveBlock();
    const hadFocus = this.grid.contains(document.activeElement);
    const name = block.getField('VAR')?.getText() ?? '';
    this.title.textContent = translate('table_editor_title').replace('%1', name);
    this.columns = startColumns(block);
    const editable = this.columns !== null;
    this.rows = editable ? startRows(block, this.columns) : [];
    const hasColumns = editable && this.columns.length > 0;

    this.message.hidden = hasColumns;
    this.message.textContent = translate(
      editable ? 'table_editor_no_columns' : 'table_editor_computed_columns'
    );
    this.scroller.hidden = !hasColumns;
    this.hint.hidden = !hasColumns;

    const lastRow = this.rows.length - 1;
    this.active = {
      row: clamp(this.active.row, -1, lastRow),
      column: clamp(this.active.column, 0, Math.max(0, (this.columns?.length ?? 0) - 1)),
    };

    this.grid.replaceChildren();
    if (hasColumns) this.buildGrid();
    this.updateButtons();
    if (hadFocus) this.focusActive();
  }

  buildGrid() {
    const columnCount = this.columns.length;
    this.grid.setAttribute('aria-rowcount', String(this.rows.length + 1));
    this.grid.setAttribute('aria-colcount', String(columnCount + 1));
    const cell = (tag, role, row, column, text) =>
      h(
        tag,
        {
          role,
          tabindex: row === this.active.row && column === this.active.column ? '0' : '-1',
          'data-row': row,
          'data-column': column,
          'aria-colindex': column + 2,
        },
        text
      );
    const header = h(
      'tr',
      { role: 'row', 'aria-rowindex': 1 },
      h(
        'th',
        { role: 'columnheader', class: 'table-editor-corner', 'aria-colindex': 1 },
        translate('table_editor_row_header')
      ),
      this.columns.map((name, c) => cell('th', 'columnheader', -1, c, name))
    );
    const body = this.rows.map((values, r) =>
      h(
        'tr',
        { role: 'row', 'aria-rowindex': r + 2 },
        h('th', { role: 'rowheader', 'aria-colindex': 1 }, String(r)),
        values.map((value, c) => cell('td', 'gridcell', r, c, String(value)))
      )
    );
    this.grid.append(h('thead', {}, header), h('tbody', {}, body));
  }

  updateButtons() {
    const editable = this.columns !== null;
    const columnCount = this.columns?.length ?? 0;
    const hasColumns = editable && columnCount > 0;
    const { row, column } = this.active;
    const disabled = {
      addRow: !hasColumns,
      deleteRow: !hasColumns || row < 0 || this.rows.length === 0,
      addColumn: !editable,
      deleteColumn: !hasColumns,
      moveLeft: !hasColumns || column <= 0,
      moveRight: !hasColumns || column >= columnCount - 1,
    };
    for (const [name, off] of Object.entries(disabled)) this.buttons[name].disabled = off;
  }

  cellAt(row, column) {
    return this.grid.querySelector(`[data-row="${row}"][data-column="${column}"]`);
  }

  focusActive() {
    const cell = this.cellAt(this.active.row, this.active.column);
    if (cell) {
      cell.focus();
      cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    } else {
      (this.buttons.addColumn.disabled ? this.buttons.close : this.buttons.addColumn).focus();
    }
  }

  setActive(row, column) {
    this.cellAt(this.active.row, this.active.column)?.setAttribute('tabindex', '-1');
    this.active = { row, column };
    this.cellAt(row, column)?.setAttribute('tabindex', '0');
    this.updateButtons();
    this.focusActive();
  }

  announce(text) {
    this.status.textContent = '';
    requestAnimationFrame(() => {
      this.status.textContent = text;
    });
  }

  onKeydown(event) {
    if (!event.altKey) event.stopPropagation();
    if (this.editing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close({ restoreFocus: true });
      return;
    }
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'z' || key === 'y') {
      event.preventDefault();
      this.workspace?.undo(key === 'y' || event.shiftKey);
    }
  }

  onGridKeydown(event) {
    if (this.editing) return;
    const { row, column } = this.active;
    const lastRow = this.rows.length - 1;
    const lastColumn = this.columns.length - 1;
    const mod = event.ctrlKey || event.metaKey;
    const moves = {
      ArrowUp: [row - 1, column],
      ArrowDown: [row + 1, column],
      ArrowLeft: [row, column - 1],
      ArrowRight: [row, column + 1],
      Home: mod ? [-1, 0] : [row, 0],
      End: mod ? [lastRow, lastColumn] : [row, lastColumn],
      PageUp: [row - PAGE_ROWS, column],
      PageDown: [row + PAGE_ROWS, column],
    };
    if (Object.hasOwn(moves, event.key) && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      const [r, c] = moves[event.key];
      this.setActive(clamp(r, -1, lastRow), clamp(c, 0, lastColumn));
      return;
    }
    if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault();
      this.startEdit();
      return;
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && row >= 0) {
      event.preventDefault();
      setStartCell(this.liveBlock(), row, column, '');
      this.render();
      return;
    }
    if (event.key.length === 1 && !mod && !event.altKey) {
      event.preventDefault();
      this.startEdit(event.key);
    }
  }

  onGridPointerDown(event) {
    if (event.button !== 0) return;
    const cell = event.target.closest?.('[data-row]');
    if (!cell || !this.grid.contains(cell)) return;
    if (this.editing?.input.contains(event.target)) return;
    event.preventDefault();
    const row = Number(cell.dataset.row);
    const column = Number(cell.dataset.column);
    const again =
      !this.editing &&
      row === this.active.row &&
      column === this.active.column &&
      document.activeElement === cell;
    if (this.editing) this.finishEdit(true);
    this.setActive(row, column);
    if (again) this.startEdit();
  }

  startEdit(initial) {
    const { row, column } = this.active;
    const cell = this.cellAt(row, column);
    if (!cell || !this.columns) return;
    const original = row === -1 ? this.columns[column] : String(this.rows[row][column]);
    const label =
      row === -1
        ? translate('table_editor_column_name')
        : translate('table_editor_cell_label')
            .replace('%1', this.columns[column])
            .replace('%2', String(row));
    const input = h('input', {
      type: 'text',
      class: 'table-editor-input',
      'aria-label': label,
      autocomplete: 'off',
      spellcheck: 'false',
    });
    input.value = initial ?? original;
    cell.replaceChildren(input);
    this.editing = { row, column, input, original, stamp: this.dataStamp() };
    input.addEventListener('keydown', (event) => this.onInputKeydown(event));
    input.addEventListener('blur', () => this.finishEdit(true));
    input.focus();
    if (initial === undefined) input.select();
  }

  onInputKeydown(event) {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      this.finishEdit(true, 'down');
    } else if (event.key === 'Tab') {
      event.preventDefault();
      this.finishEdit(true, event.shiftKey ? 'previous' : 'next');
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.finishEdit(false, 'stay');
    }
  }

  finishEdit(commit, move = null) {
    const editing = this.editing;
    if (!editing) return;
    this.editing = null;
    const { row, column, input, original } = editing;
    const text = row === -1 ? input.value.trim() : input.value;
    if (commit && text !== original) {
      if (row === -1) renameStartColumn(this.liveBlock(), column, text);
      else setStartCell(this.liveBlock(), row, column, text);
    }
    if (!this.liveBlock()) return;
    const target = move && this.nextCell(row, column, move);
    this.render();
    if (target) this.setActive(target.row, target.column);
  }

  nextCell(row, column, move) {
    const lastRow = this.rows.length - 1;
    const lastColumn = this.columns.length - 1;
    if (move === 'down') return { row: Math.min(row + 1, lastRow), column };
    if (move === 'previous') {
      if (column > 0) return { row, column: column - 1 };
      return row > -1 ? { row: row - 1, column: lastColumn } : { row, column };
    }
    if (move === 'next') {
      if (column < lastColumn) return { row, column: column + 1 };
      if (row < lastRow) return { row: row + 1, column: 0 };
      if (row === -1) return { row, column };
      insertStartRow(this.liveBlock(), row + 1);
      this.announce(translate('table_editor_row_added').replace('%1', String(row + 1)));
      return { row: row + 1, column: 0 };
    }
    return { row, column };
  }

  addRow() {
    const index = this.active.row + 1;
    insertStartRow(this.liveBlock(), index);
    this.render();
    this.setActive(index, this.active.column);
    this.announce(translate('table_editor_row_added').replace('%1', String(index)));
  }

  deleteRow() {
    const { row, column } = this.active;
    if (row < 0) return;
    deleteStartRow(this.liveBlock(), row);
    this.render();
    this.setActive(Math.min(row, this.rows.length - 1), column);
    this.announce(translate('table_editor_row_deleted').replace('%1', String(row)));
  }

  addColumn() {
    const index = this.columns.length ? this.active.column + 1 : 0;
    const name = insertStartColumn(this.liveBlock(), index);
    if (name === null) return;
    this.render();
    this.setActive(-1, index);
    this.announce(translate('table_editor_column_added').replace('%1', name));
    this.startEdit();
  }

  deleteColumn() {
    const { row, column } = this.active;
    const name = deleteStartColumn(this.liveBlock(), column);
    if (name === null) return;
    this.render();
    this.setActive(row, Math.max(0, column - 1));
    this.announce(translate('table_editor_column_deleted').replace('%1', name));
  }

  moveColumn(step) {
    const { row, column } = this.active;
    const name = moveStartColumn(this.liveBlock(), column, column + step);
    if (name === null) return;
    this.render();
    this.setActive(row, column + step);
    const key = step < 0 ? 'table_editor_column_moved_left' : 'table_editor_column_moved_right';
    this.announce(translate(key).replace('%1', name));
  }

  position() {
    const rect = this.liveBlock()?.getSvgRoot?.()?.getBoundingClientRect();
    this.container.style.left = `${rect ? rect.left : MARGIN}px`;
    this.container.style.top = `${rect ? rect.bottom + 8 : MARGIN}px`;
    this.fitToViewport();
  }

  fitToViewport() {
    if (this.container.hidden) return;
    const area = visibleArea();
    const content = this.content;
    content.style.maxHeight = `${Math.max(MIN_HEIGHT, area.height - 2 * MARGIN)}px`;
    content.style.maxWidth = `${Math.max(MIN_WIDTH, area.width - 2 * MARGIN)}px`;
    const left = parseInt(this.container.style.left, 10) || 0;
    const top = parseInt(this.container.style.top, 10) || 0;
    const right = area.left + area.width - content.offsetWidth - MARGIN;
    const bottom = area.top + area.height - content.offsetHeight - MARGIN;
    this.container.style.left = `${clamp(left, area.left + MARGIN, Math.max(area.left + MARGIN, right))}px`;
    this.container.style.top = `${clamp(top, area.top + MARGIN, Math.max(area.top + MARGIN, bottom))}px`;
    const target = this.editing?.input ?? this.cellAt(this.active.row, this.active.column);
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  resizeTo(width, height) {
    const area = visibleArea();
    const left = parseInt(this.container.style.left, 10) || 0;
    const top = parseInt(this.container.style.top, 10) || 0;
    const maxWidth = Math.max(MIN_WIDTH, area.left + area.width - left - MARGIN);
    const maxHeight = Math.max(MIN_HEIGHT, area.top + area.height - top - MARGIN);
    this.size = {
      width: clamp(Math.round(width), MIN_WIDTH, maxWidth),
      height: clamp(Math.round(height), MIN_HEIGHT, maxHeight),
    };
    this.applySize();
  }

  applySize() {
    if (!this.size) return;
    this.container.classList.add('table-editor-sized');
    this.content.style.width = `${this.size.width}px`;
    this.content.style.height = `${this.size.height}px`;
  }

  setupResizer() {
    let start = null;
    this.resizer.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.resizer.setPointerCapture(event.pointerId);
      start = {
        x: event.clientX,
        y: event.clientY,
        width: this.content.offsetWidth,
        height: this.content.offsetHeight,
      };
    });
    this.resizer.addEventListener('pointermove', (event) => {
      if (!start) return;
      event.preventDefault();
      this.resizeTo(start.width + event.clientX - start.x, start.height + event.clientY - start.y);
    });
    const end = () => {
      start = null;
    };
    this.resizer.addEventListener('pointerup', end);
    this.resizer.addEventListener('pointercancel', end);
    this.resizer.addEventListener('keydown', (event) => {
      const step = event.shiftKey ? RESIZE_STEP * 4 : RESIZE_STEP;
      const change = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }[event.key];
      if (!change) return;
      event.preventDefault();
      this.resizeTo(this.content.offsetWidth + change[0], this.content.offsetHeight + change[1]);
    });
  }

  setupDragHandle() {
    let start = null;
    this.handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.handle.setPointerCapture(event.pointerId);
      start = {
        x: event.clientX,
        y: event.clientY,
        left: parseInt(this.container.style.left, 10) || 0,
        top: parseInt(this.container.style.top, 10) || 0,
      };
    });
    this.handle.addEventListener('pointermove', (event) => {
      if (!start) return;
      event.preventDefault();
      const width = this.container.firstElementChild.offsetWidth;
      const left = clamp(start.left + event.clientX - start.x, 0, window.innerWidth - width);
      const top = clamp(start.top + event.clientY - start.y, 0, window.innerHeight - 24);
      this.container.style.left = `${Math.max(0, left)}px`;
      this.container.style.top = `${Math.max(0, top)}px`;
    });
    const end = () => {
      start = null;
    };
    this.handle.addEventListener('pointerup', end);
    this.handle.addEventListener('pointercancel', end);
  }
}

let editor = null;

export function openTableEditor(block) {
  editor ??= new TableEditor();
  editor.open(block);
}
