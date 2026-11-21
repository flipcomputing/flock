import { expect } from 'chai';
import * as Blockly from 'blockly';
import { compileFlockProject } from './utils/flockCompilerTestUtils.js';
import { toolbox, tableFlyoutBlocks } from '../toolbox.js';
import { EXAMPLES } from '../main/examples.js';
import { tableRowText } from '../api/tables.js';
import {
  defineTableBlocks,
  installTableColumnRenames,
  tableColumnWarningFor,
} from '../blocks/tables.js';
import enLocale from '../locale/en.js';
import esLocale from '../locale/es.js';

const text = (TEXT) => ({ shadow: { type: 'text', fields: { TEXT } } });
const num = (NUM) => ({ shadow: { type: 'math_number', fields: { NUM } } });
const list = (...items) => ({
  block: {
    type: 'lists_create_with',
    extraState: { itemCount: items.length },
    inputs: Object.fromEntries(items.map((item, i) => [`ADD${i}`, item])),
  },
});
const block = (type, { fields = {}, inputs = {}, next } = {}) => ({
  type,
  fields,
  inputs,
  ...(next && { next: { block: next } }),
});
const chain = (...blocks) => blocks.reduceRight((next, b) => ({ ...b, next: { block: next } }));
const value = (b) => ({ block: b });
const table = (name) => ({ name });
const countVar = () => ({ type: 'variables_get', fields: { VAR: { name: 'count' } } });
const rowVar = () => ({ block: { type: 'variables_get', fields: { VAR: { name: 'row' } } } });
const rowValue = (column) => ({
  type: 'table_row_value',
  fields: {},
  inputs: { COLUMN: text(column), ROW: rowVar() },
});

const print = (textInput) =>
  block('print_text', {
    inputs: {
      TEXT: textInput,
      DURATION: num(1),
      COLOR: { shadow: { type: 'colour', fields: { COLOR: '#000000' } } },
    },
  });

const project = (...stacks) => ({
  blocks: {
    languageVersion: 0,
    blocks: stacks.map((stack, i) => ({
      ...block('start', { inputs: { DO: { block: stack } } }),
      x: 0,
      y: i * 200,
    })),
  },
});

const createBuildings = () => [
  block('table_create', {
    fields: { VAR: table('Buildings') },
    inputs: { COLUMNS: list(text('Name'), text('Height')) },
  }),
  block('table_add_row', {
    fields: { TABLE: table('Buildings') },
    inputs: { VALUES: list(text('Burj Khalifa'), num(828)) },
  }),
  block('table_add_row', {
    fields: { TABLE: table('Buildings') },
    inputs: { VALUES: list(text('Merdeka 118'), num(679)) },
  }),
];

export function runTablesTests(flock) {
  describe('Tables @tables', function () {
    this.timeout(20000);
    let reported;
    let originalReport;

    beforeEach(function () {
      flock.tables = new Map();
      reported = [];
      originalReport = flock.reportBlockError;
      flock.reportBlockError = (problem) => reported.push(problem);
    });

    afterEach(function () {
      flock.reportBlockError = originalReport;
    });

    const keys = () => reported.map((problem) => problem.key);

    function makeShop() {
      flock.createTable('Shop', ['Name', 'Price']);
      flock.addTableRow('Shop', ['Apple', 0.5]);
      flock.addTableRow('Shop', ['Pear', 0.75]);
    }

    describe('API', function () {
      it('creates a table and returns its name', function () {
        expect(flock.createTable('Shop', ['Name', 'Price'])).to.equal('Shop');
        expect(flock.getTableRowCount('Shop')).to.equal(0);
      });

      it('reads cells, columns, rows and the row count', function () {
        makeShop();
        expect(flock.getTableValue('Shop', 1, 'Name')).to.equal('Pear');
        expect(flock.getTableValue('Shop', 0, 'Price')).to.equal(0.5);
        expect(flock.getTableColumn('Shop', 'Price')).to.deep.equal([0.5, 0.75]);
        expect(flock.getTableRowCount('Shop')).to.equal(2);
        expect(reported).to.deep.equal([]);
      });

      it('changes a cell', function () {
        makeShop();
        flock.setTableValue('Shop', 0, 'Price', 0.6);
        expect(flock.getTableValue('Shop', 0, 'Price')).to.equal(0.6);
      });

      it('accepts a row number given as text', function () {
        makeShop();
        expect(flock.getTableValue('Shop', '1', 'Name')).to.equal('Pear');
      });

      it('gives a row that reads columns by name', function () {
        makeShop();
        const row = flock.getTableRow('Shop', 1);
        expect(flock.getRowValue(row, 'Name')).to.equal('Pear');
        expect(flock.getRowValue(row, 'Price')).to.equal(0.75);
        expect(tableRowText(row)).to.equal('Name: Pear, Price: 0.75');
        expect(reported).to.deep.equal([]);
      });

      it('gives copies of columns and rows', function () {
        makeShop();
        flock.getTableColumn('Shop', 'Name').push('Plum');
        const row = flock.getTableRow('Shop', 0);
        expect(Object.isFrozen(row) && Object.isFrozen(row.values)).to.equal(true);
        flock.setTableValue('Shop', 0, 'Name', 'Changed');
        expect(flock.getRowValue(row, 'Name')).to.equal('Apple');
        expect(flock.getTableColumn('Shop', 'Name')).to.deep.equal(['Changed', 'Pear']);
      });

      it('reports a missing column in a row and values that are not rows', function () {
        makeShop();
        const row = flock.getTableRow('Shop', 0);
        expect(flock.getRowValue(row, 'Prise')).to.equal('');
        expect(flock.getRowValue(['Apple', 0.5], 'Name')).to.equal('');
        expect(flock.getRowValue(5, 'Name')).to.equal('');
        expect(keys()).to.deep.equal([
          'table_column_not_found',
          'table_not_a_row',
          'table_not_a_row',
        ]);
        expect(reported[0].values).to.deep.equal({ table: 'Shop', column: 'Prise' });
      });

      it("gives a row's values as a new list in column order", function () {
        makeShop();
        const values = flock.getRowValues(flock.getTableRow('Shop', 1));
        expect(values).to.deep.equal(['Pear', 0.75]);
        values.push('extra');
        expect(flock.getRowValues(flock.getTableRow('Shop', 1))).to.deep.equal(['Pear', 0.75]);
        expect(flock.getRowValues(['Pear', 0.75])).to.deep.equal([]);
        expect(flock.getRowValues('')).to.deep.equal([]);
        expect(keys()).to.deep.equal(['table_not_a_row']);
      });

      it('stays quiet when a row is missing because of an earlier problem', function () {
        makeShop();
        const row = flock.getTableRow('Shop', 9);
        expect(flock.getRowValue(row, 'Name')).to.equal('');
        expect(keys()).to.deep.equal(['table_row_out_of_range']);
      });

      it('empties a table that is made again and leaves it usable', function () {
        makeShop();
        flock.createTable('Shop', ['Item']);
        expect(flock.getTableRowCount('Shop')).to.equal(0);
        expect(reported).to.deep.equal([]);
        flock.addTableRow('Shop', ['Plum']);
        expect(flock.getTableValue('Shop', 0, 'Item')).to.equal('Plum');
        expect(flock.getTableRowCount('Shop')).to.equal(1);
        expect(reported).to.deep.equal([]);
        expect(flock.getTableColumn('Shop', 'Name')).to.deep.equal([]);
      });

      it('keeps only text, numbers and true/false in cells', function () {
        flock.createTable('Mixed', ['A', 'B', 'C', 'D', 'E']);
        flock.addTableRow('Mixed', ['x', 2, true, { a: 1 }, NaN]);
        expect([...flock.getTableRow('Mixed', 0).values]).to.deep.equal(['x', 2, true, '', '']);
      });

      it('reports a table that was never made', function () {
        expect(flock.getTableValue(undefined, 0, 'Name')).to.equal('');
        expect(keys()).to.deep.equal(['table_not_made']);
      });

      it('reports a missing table', function () {
        expect(flock.getTableColumn('Nope', 'Name')).to.deep.equal([]);
        expect(flock.getTableRowCount('Nope')).to.equal(0);
        expect(keys()).to.deep.equal(['table_not_found', 'table_not_found']);
        expect(reported[0].values).to.deep.equal({ table: 'Nope' });
      });

      it('reports a missing column', function () {
        makeShop();
        expect(flock.getTableValue('Shop', 0, 'Prise')).to.equal('');
        expect(reported[0]).to.include({ key: 'table_column_not_found' });
        expect(reported[0].values).to.deep.equal({ table: 'Shop', column: 'Prise' });
      });

      it('reports rows out of range for empty, one-row and longer tables', function () {
        flock.createTable('Empty', ['A']);
        flock.getTableRow('Empty', 0);
        flock.createTable('One', ['A']);
        flock.addTableRow('One', ['x']);
        flock.getTableRow('One', 1);
        makeShop();
        expect(flock.getTableValue('Shop', 7, 'Name')).to.equal('');
        flock.getTableRow('Shop', -1);
        flock.getTableRow('Shop', 0.5);
        expect(keys()).to.deep.equal([
          'table_no_rows',
          'table_row_out_of_range_one',
          'table_row_out_of_range',
          'table_row_out_of_range',
          'table_row_out_of_range',
        ]);
        expect(reported[2].values).to.deep.equal({ table: 'Shop', count: 2, last: 1, row: '7' });
      });

      it('pads a short row and drops extra values', function () {
        flock.createTable('Shop', ['Name', 'Price', 'Stock']);
        flock.addTableRow('Shop', ['Apple']);
        flock.addTableRow('Shop', ['Pear', 1, 2, 3]);
        expect([...flock.getTableRow('Shop', 0).values]).to.deep.equal(['Apple', '', '']);
        expect([...flock.getTableRow('Shop', 1).values]).to.deep.equal(['Pear', 1, 2]);
        expect(keys()).to.deep.equal(['table_row_length', 'table_row_length']);
        expect(reported[0].values).to.deep.equal({ table: 'Shop', given: 1, count: 3 });
      });

      it('renames repeated column names', function () {
        flock.createTable('Shop', ['Name', 'Name', 'Name']);
        flock.addTableRow('Shop', ['a', 'b', 'c']);
        expect(flock.getTableColumn('Shop', 'Name 3')).to.deep.equal(['c']);
        expect(keys()).to.deep.equal(['table_duplicate_column', 'table_duplicate_column']);
        expect(reported[0].values).to.deep.equal({
          table: 'Shop',
          column: 'Name',
          renamed: 'Name 2',
        });
      });

      it('changes nothing when setting a missing row or column', function () {
        makeShop();
        flock.setTableValue('Shop', 5, 'Name', 'x');
        flock.setTableValue('Shop', 0, 'Colour', 'x');
        expect([...flock.getTableRow('Shop', 0).values]).to.deep.equal(['Apple', 0.5]);
        expect(keys()).to.deep.equal(['table_row_out_of_range', 'table_column_not_found']);
      });

      it('inserts a row at a number and moves the later rows down', function () {
        makeShop();
        flock.insertTableRow('Shop', 1, ['Plum', 0.4]);
        flock.insertTableRow('Shop', 0, ['Fig', 1]);
        flock.insertTableRow('Shop', 4, ['Kiwi']);
        expect(flock.getTableColumn('Shop', 'Name')).to.deep.equal([
          'Fig',
          'Apple',
          'Plum',
          'Pear',
          'Kiwi',
        ]);
        expect(flock.getTableColumn('Shop', 'Price')).to.deep.equal([1, 0.5, 0.4, 0.75, '']);
        flock.insertTableRow('Shop', 6, ['Lime', 2]);
        flock.insertTableRow('Shop', -1, ['Lime', 2]);
        expect(flock.getTableRowCount('Shop')).to.equal(5);
        expect(keys()).to.deep.equal([
          'table_row_length',
          'table_row_out_of_range',
          'table_row_out_of_range',
        ]);
      });

      it('inserts the first row of an empty table at 0', function () {
        flock.createTable('Shop', ['Name']);
        flock.insertTableRow('Shop', 1, ['Fig']);
        flock.insertTableRow('Shop', 0, ['Fig']);
        expect(flock.getTableColumn('Shop', 'Name')).to.deep.equal(['Fig']);
        expect(keys()).to.deep.equal(['table_no_rows']);
      });

      it('replaces all the values in a row', function () {
        makeShop();
        flock.setTableRow('Shop', 1, ['Plum', 0.4]);
        flock.setTableRow('Shop', 0, ['Fig']);
        flock.setTableRow('Shop', 2, ['Kiwi', 1]);
        flock.setTableRow('Nope', 0, ['Kiwi', 1]);
        expect(flock.getTableColumn('Shop', 'Name')).to.deep.equal(['Fig', 'Plum']);
        expect(flock.getTableColumn('Shop', 'Price')).to.deep.equal(['', 0.4]);
        expect(keys()).to.deep.equal([
          'table_row_length',
          'table_row_out_of_range',
          'table_not_found',
        ]);
      });

      it('deletes one row and moves the later rows up', function () {
        makeShop();
        flock.addTableRow('Shop', ['Plum', 0.4]);
        flock.deleteTableRow('Shop', 1);
        expect(flock.getTableColumn('Shop', 'Name')).to.deep.equal(['Apple', 'Plum']);
        flock.deleteTableRow('Shop', 5);
        expect(flock.getTableRowCount('Shop')).to.equal(2);
        expect(keys()).to.deep.equal(['table_row_out_of_range']);
      });

      it('deletes all rows and keeps the columns', function () {
        makeShop();
        flock.deleteAllTableRows('Shop');
        expect(flock.getTableRowCount('Shop')).to.equal(0);
        flock.addTableRow('Shop', ['Plum', 0.4]);
        expect(flock.getTableValue('Shop', 0, 'Price')).to.equal(0.4);
        flock.deleteAllTableRows('Nope');
        expect(keys()).to.deep.equal(['table_not_found']);
      });

      it('picks the first, last and a random row', function () {
        makeShop();
        flock.addTableRow('Shop', ['Plum', 0.4]);
        expect(flock.getRowValue(flock.pickTableRow('Shop', 'first'), 'Name')).to.equal('Apple');
        const last = flock.pickTableRow('Shop', 'last');
        expect(flock.getRowValue(last, 'Name')).to.equal('Plum');
        expect(last.number).to.equal(2);
        const seen = new Set();
        for (let i = 0; i < 60; i++) seen.add(flock.pickTableRow('Shop', 'random').number);
        expect([...seen].sort()).to.deep.equal([0, 1, 2]);
        expect(reported).to.deep.equal([]);
      });

      it('reports picking a row from an empty table', function () {
        flock.createTable('Empty', ['A']);
        expect(flock.pickTableRow('Empty', 'first')).to.equal('');
        expect(flock.pickTableRow('Empty', 'random')).to.equal('');
        expect(flock.pickTableRow('Nope', 'last')).to.equal('');
        expect(keys()).to.deep.equal(['table_empty', 'table_empty', 'table_not_found']);
        expect(reported[0].values).to.deep.equal({ table: 'Empty' });
      });

      it('finds the first or last row with a value in a column', function () {
        makeShop();
        flock.addTableRow('Shop', ['Pear', 0.8]);
        expect(flock.findTableRow('Shop', 'Name', 'Pear')).to.equal(1);
        expect(flock.findTableRow('Shop', 'Price', 0.5)).to.equal(0);
        expect(flock.findTableRow('Shop', 'Price', '0.75')).to.equal(1);
        expect(flock.findTableRow('Shop', 'Name', 'pear')).to.equal(-1);
        expect(flock.findTableRow('Shop', 'Name', 'Plum')).to.equal(-1);
        expect(flock.findTableRow('Shop', 'Name', 'Pear', 'last')).to.equal(2);
        expect(flock.findTableRow('Shop', 'Name', 'Apple', 'last')).to.equal(0);
        expect(flock.findTableRow('Shop', 'Name', 'Plum', 'last')).to.equal(-1);
        expect(reported).to.deep.equal([]);
      });

      it('reports finding in a missing table or column', function () {
        makeShop();
        expect(flock.findTableRow('Nope', 'Name', 'Pear')).to.equal(-1);
        expect(flock.findTableRow('Shop', 'Colour', 'red')).to.equal(-1);
        expect(keys()).to.deep.equal(['table_not_found', 'table_column_not_found']);
      });

      it('sorts rows by a column of numbers', function () {
        flock.createTable('Scores', ['Name', 'Score']);
        for (const [name, score] of [
          ['Ana', 10],
          ['Ben', 9],
          ['Cy', -2],
          ['Di', 0.5],
          ['Ed', '100'],
        ]) {
          flock.addTableRow('Scores', [name, score]);
        }
        flock.sortTable('Scores', 'Score', 'ASCENDING');
        expect(flock.getTableColumn('Scores', 'Name')).to.deep.equal([
          'Cy',
          'Di',
          'Ben',
          'Ana',
          'Ed',
        ]);
        flock.sortTable('Scores', 'Score', 'DESCENDING');
        expect(flock.getTableColumn('Scores', 'Name')).to.deep.equal([
          'Ed',
          'Ana',
          'Ben',
          'Di',
          'Cy',
        ]);
        expect(reported).to.deep.equal([]);
      });

      it('sorts text ignoring capitals, keeps ties in order and puts numbers first', function () {
        flock.createTable('Pets', ['Name', 'Kind']);
        for (const [name, kind] of [
          ['rex', 'dog'],
          ['Ace', 'cat'],
          ['bo', 'dog'],
          ['pet 10', 'fish'],
          ['pet 2', 'fish'],
          [7, 'cat'],
        ]) {
          flock.addTableRow('Pets', [name, kind]);
        }
        flock.sortTable('Pets', 'Name', 'ASCENDING');
        expect(flock.getTableColumn('Pets', 'Name')).to.deep.equal([
          7,
          'Ace',
          'bo',
          'pet 2',
          'pet 10',
          'rex',
        ]);
        flock.sortTable('Pets', 'Kind', 'ASCENDING');
        expect(flock.getTableColumn('Pets', 'Name')).to.deep.equal([
          7,
          'Ace',
          'bo',
          'rex',
          'pet 2',
          'pet 10',
        ]);
        flock.sortTable('Pets', 'Name', 'DESCENDING');
        expect(flock.getTableColumn('Pets', 'Name')).to.deep.equal([
          'rex',
          'pet 10',
          'pet 2',
          'bo',
          'Ace',
          7,
        ]);
      });

      it('shuffles the rows into a random order and keeps every row whole', function () {
        flock.createTable('Pets', ['Name', 'Legs']);
        for (const [name, legs] of [
          ['rex', 4],
          ['tweet', 2],
          ['nemo', 0],
          ['spider', 8],
        ]) {
          flock.addTableRow('Pets', [name, legs]);
        }
        const original = Math.random;
        const picks = [0, 0, 0];
        Math.random = () => picks.shift();
        try {
          flock.shuffleTable('Pets');
        } finally {
          Math.random = original;
        }
        expect(flock.getTableColumn('Pets', 'Name')).to.deep.equal([
          'tweet',
          'nemo',
          'spider',
          'rex',
        ]);
        expect(flock.getTableColumn('Pets', 'Legs')).to.deep.equal([2, 0, 8, 4]);
        flock.shuffleTable('Nope');
        expect(keys()).to.deep.equal(['table_not_found']);
      });

      it('reports sorting a missing table or column and changes nothing', function () {
        makeShop();
        flock.sortTable('Nope', 'Name', 'ASCENDING');
        flock.sortTable('Shop', 'Colour', 'DESCENDING');
        expect(flock.getTableColumn('Shop', 'Name')).to.deep.equal(['Apple', 'Pear']);
        expect(keys()).to.deep.equal(['table_not_found', 'table_column_not_found']);
      });
    });

    describe('generators', function () {
      it('generates code that passes the code check', function () {
        const code = compileFlockProject(
          project(
            chain(
              ...createBuildings(),
              block('table_set_value', {
                fields: { TABLE: table('Buildings') },
                inputs: { ROW: num(0), COLUMN: text('Height'), VALUE: num(830) },
              }),
              print(
                value(
                  block('table_get_value', {
                    fields: { TABLE: table('Buildings') },
                    inputs: { ROW: num(1), COLUMN: text('Name') },
                  })
                )
              ),
              print(
                value(
                  block('table_get_row', {
                    fields: { TABLE: table('Buildings') },
                    inputs: { ROW: num(0) },
                  })
                )
              ),
              print(
                value(
                  block('table_get_column', {
                    fields: { TABLE: table('Buildings') },
                    inputs: { COLUMN: text('Name') },
                  })
                )
              ),
              print(value(block('table_row_count', { fields: { TABLE: table('Buildings') } }))),
              block('table_delete_row', {
                fields: { MODE: 'ROW', TABLE: table('Buildings') },
                inputs: { ROW: num(1) },
              }),
              block('table_delete_row', {
                fields: { MODE: 'ALL', TABLE: table('Buildings') },
                inputs: { ROW: num(0) },
              })
            )
          )
        );
        expect(code, code).to.include(`Buildings = createTable("Buildings", ['Name', 'Height']);`);
        expect(code, code).to.include("addTableRow(Buildings, ['Burj Khalifa', 828]);");
        expect(code, code).to.include("setTableValue(Buildings, 0, 'Height', 830);");
        expect(code, code).to.include('deleteTableRow(Buildings, 1);');
        expect(code, code).to.include('deleteAllTableRows(Buildings);');
        expect(code, code).to.include("getTableValue(Buildings, 1, 'Name')");
        expect(code, code).to.include('getTableRow(Buildings, 0)');
        expect(code, code).to.include("getTableColumn(Buildings, 'Name')");
        expect(code, code).to.include('getTableRowCount(Buildings)');
        expect(() => flock.prepareUserCode(code)).not.to.throw();
      });

      it('generates picking, finding and sorting rows', function () {
        const pick = (MODE) =>
          print(
            value(
              block('table_get_row', {
                fields: { MODE, TABLE: table('Buildings') },
                inputs: { ROW: num(3) },
              })
            )
          );
        const code = compileFlockProject(
          project(
            chain(
              ...createBuildings(),
              pick('FIRST'),
              pick('LAST'),
              pick('RANDOM'),
              print(
                value(
                  block('table_find_row', {
                    fields: { TABLE: table('Buildings') },
                    inputs: { COLUMN: text('Name'), VALUE: text('Merdeka 118') },
                  })
                )
              ),
              print(
                value(
                  block('table_find_row', {
                    fields: { WHERE: 'LAST', TABLE: table('Buildings') },
                    inputs: { COLUMN: text('Height'), VALUE: num(828) },
                  })
                )
              ),
              block('table_sort', {
                fields: { TABLE: table('Buildings'), ORDER: 'DESCENDING' },
                inputs: { COLUMN: text('Height') },
              }),
              block('table_sort', {
                fields: { TABLE: table('Buildings'), ORDER: 'ASCENDING' },
                inputs: { COLUMN: text('Name') },
              }),
              block('table_sort', {
                fields: { TABLE: table('Buildings'), ORDER: 'RANDOM' },
                inputs: { COLUMN: text('Floors') },
              })
            )
          )
        );
        expect(code, code).to.include("pickTableRow(Buildings, 'first')");
        expect(code, code).to.include("pickTableRow(Buildings, 'last')");
        expect(code, code).to.include("pickTableRow(Buildings, 'random')");
        expect(code, code).not.to.include('getTableRow(Buildings, 3)');
        expect(code, code).to.include("findTableRow(Buildings, 'Name', 'Merdeka 118', 'first')");
        expect(code, code).to.include("findTableRow(Buildings, 'Height', 828, 'last')");
        expect(code, code).to.include("sortTable(Buildings, 'Height', 'DESCENDING');");
        expect(code, code).to.include("sortTable(Buildings, 'Name', 'ASCENDING');");
        expect(code, code).to.include('shuffleTable(Buildings);');
        expect(code, code).not.to.include('Floors');
        expect(() => flock.prepareUserCode(code)).not.to.throw();
      });

      it('generates adding a row at a number and setting a whole row', function () {
        const pair = list(text('Taipei 101'), num(508));
        const code = compileFlockProject(
          project(
            chain(
              ...createBuildings(),
              block('table_add_row', {
                fields: { TABLE: table('Buildings'), POSITION: 'ROW' },
                inputs: { ROW: num(1), VALUES: pair },
              }),
              block('table_add_row', {
                fields: { TABLE: table('Buildings'), POSITION: 'END' },
                inputs: { ROW: num(7), VALUES: pair },
              }),
              block('table_set_row', {
                fields: { TABLE: table('Buildings') },
                inputs: { ROW: num(2), VALUES: pair },
              })
            )
          )
        );
        expect(code, code).to.include("insertTableRow(Buildings, 1, ['Taipei 101', 508]);");
        expect(code, code).to.include("addTableRow(Buildings, ['Taipei 101', 508]);");
        expect(code, code).not.to.include('insertTableRow(Buildings, 7');
        expect(code, code).to.include("setTableRow(Buildings, 2, ['Taipei 101', 508]);");
        expect(code, code).to.include("addTableRow(Buildings, ['Burj Khalifa', 828]);");
        expect(() => flock.prepareUserCode(code)).not.to.throw();
      });

      it('loads a saved row getter with no mode as a numbered row', function () {
        const code = compileFlockProject(
          project(
            print(
              value(
                block('table_get_row', {
                  fields: { TABLE: table('Buildings') },
                  inputs: { ROW: num(1) },
                })
              )
            )
          )
        );
        expect(code, code).to.include('getTableRow(Buildings, 1)');
      });

      it('puts each row and its number in the loop variables', function () {
        const loop = block('table_for_each_row', {
          fields: { VAR: { name: 'row' }, INDEX: { name: 'count' }, TABLE: table('A') },
          inputs: {
            DO: {
              block: chain(print(value(rowValue('x'))), print(value(countVar()))),
            },
          },
        });
        const code = compileFlockProject(project(loop));
        expect(code, code).to.include(
          'for (let row_index = 0; row_index < getTableRowCount(A); row_index++)'
        );
        expect(code, code).to.include('row = getTableRow(A, row_index);');
        expect(code, code).to.include('count = row_index;');
        expect(code, code).to.include("getRowValue(row, 'x')");
        expect(() => flock.prepareUserCode(code)).not.to.throw();
      });

      it('gives the row when one variable is picked for both the row and its number', function () {
        const loop = block('table_for_each_row', {
          fields: { VAR: { name: 'row' }, INDEX: { name: 'row' }, TABLE: table('A') },
          inputs: { DO: { block: print(value(rowValue('x'))) } },
        });
        const code = compileFlockProject(project(loop));
        expect(code, code).to.include('row = getTableRow(A, row_index);');
        expect(code, code).not.to.match(/row = row_index/);
        expect(() => flock.prepareUserCode(code)).not.to.throw();
      });
    });

    describe('running projects', function () {
      let printed;
      let originalPrintText;

      before(async function () {
        await flock.disposeOldScene();
      });

      beforeEach(function () {
        printed = [];
        originalPrintText = flock.printText;
        flock.printText = ({ text: shown }) => printed.push(shown);
      });

      afterEach(function () {
        flock.printText = originalPrintText;
      });

      const run = (json) => flock.runCode(compileFlockProject(json), { focusCanvas: false });
      const waitForPrints = async (count) => {
        for (let i = 0; i < 100 && printed.length < count; i++) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      };

      it('loops over rows with their numbers and reads whole columns', async function () {
        const loop = block('table_for_each_row', {
          fields: { VAR: { name: 'row' }, INDEX: { name: 'count' }, TABLE: table('Buildings') },
          inputs: {
            DO: {
              block: chain(print(value(rowValue('Name'))), print(value(countVar()))),
            },
          },
        });
        const tallest = print(
          value(
            block('math_on_list', {
              fields: { OP: 'MAX' },
              inputs: {
                LIST: value(
                  block('table_get_column', {
                    fields: { TABLE: table('Buildings') },
                    inputs: { COLUMN: text('Height') },
                  })
                ),
              },
            })
          )
        );
        await run(project(chain(...createBuildings(), loop, tallest)));
        await waitForPrints(5);
        expect(printed).to.deep.equal(['Burj Khalifa', 0, 'Merdeka 118', 1, 828]);
      });

      it('copies rows into another table with their values', async function () {
        const copy = block('table_create', {
          fields: { VAR: table('Copy') },
          inputs: { COLUMNS: list(text('Name'), text('Height')) },
        });
        const loop = block('table_for_each_row', {
          fields: { VAR: { name: 'row' }, INDEX: { name: 'count' }, TABLE: table('Buildings') },
          inputs: {
            DO: {
              block: block('table_add_row', {
                fields: { TABLE: table('Copy') },
                inputs: { VALUES: value(block('table_row_values', { inputs: { ROW: rowVar() } })) },
              }),
            },
          },
        });
        const last = print(
          value(
            block('table_get_value', {
              fields: { TABLE: table('Copy') },
              inputs: { ROW: num(1), COLUMN: text('Name') },
            })
          )
        );
        await run(project(chain(...createBuildings(), copy, loop, last)));
        await waitForPrints(1);
        expect(printed).to.deep.equal(['Merdeka 118']);
        expect(flock.getTableColumn('Copy', 'Height')).to.deep.equal([828, 679]);
      });

      it('still visits every row when one variable is picked for both', async function () {
        const loop = block('table_for_each_row', {
          fields: { VAR: { name: 'row' }, INDEX: { name: 'row' }, TABLE: table('Buildings') },
          inputs: { DO: { block: print(value(rowValue('Name'))) } },
        });
        await run(project(chain(...createBuildings(), loop)));
        await waitForPrints(2);
        expect(printed).to.deep.equal(['Burj Khalifa', 'Merdeka 118']);
      });

      it('starts each run with no tables', async function () {
        await run(project(chain(...createBuildings())));
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(flock.tables.has('Buildings')).to.equal(true);
        reported = [];
        await run(
          project(print(value(block('table_row_count', { fields: { TABLE: table('Buildings') } }))))
        );
        await waitForPrints(1);
        expect(flock.tables.has('Buildings')).to.equal(false);
        expect(printed).to.deep.equal([0]);
        expect(keys()).to.include('table_not_found');
      });
    });

    describe('tallest buildings example', function () {
      it('compiles to code that passes the code check and uses the table', async function () {
        const res = await fetch('/examples/tallest_buildings_tables.flock');
        const code = compileFlockProject(await res.json());
        expect(code).to.include('createTable("Buildings"');
        expect(code).to.include("getTableColumn(Buildings, 'Height')");
        expect(code).not.to.match(/lists_split|\bcompleted\b|\bstarted\b/);
        expect(() => flock.prepareUserCode(code)).not.to.throw();
      });

      async function runExample(edit = (json) => json) {
        const original = {
          wait: flock.wait,
          glideTo: flock.glideTo,
          printText: flock.printText,
          broadcastEvent: flock.broadcastEvent,
        };
        const printed = [];
        const events = [];
        flock.wait = (seconds) => original.wait.call(flock, seconds / 20);
        flock.glideTo = async () => {};
        flock.printText = ({ text: shown }) => printed.push(shown);
        flock.broadcastEvent = (name) => {
          events.push(name);
          return original.broadcastEvent.call(flock, name);
        };
        try {
          await flock.disposeOldScene();
          const res = await fetch('/examples/tallest_buildings_tables.flock');
          const code = compileFlockProject(edit(await res.json()));
          await flock.runCode(code, { focusCanvas: false });
          for (let i = 0; i < 400 && !events.includes('side'); i++) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          return {
            names: printed.filter((shown) => shown !== "World's tallest buildings "),
            events,
            problems: keys(),
          };
        } finally {
          Object.assign(flock, original);
          await flock.disposeOldScene();
        }
      }

      function removeRow(json, name) {
        const visit = (holder) => {
          const b = holder?.block;
          if (!b) return;
          const next = b.next?.block;
          const isRow = (x) =>
            x?.type === 'table_add_row' &&
            x.inputs.VALUES.block.inputs.ADD0.shadow.fields.TEXT === name;
          if (isRow(next)) b.next = next.next;
          Object.values(b.inputs ?? {}).forEach(visit);
          visit(b.next);
        };
        json.blocks.blocks.forEach((top) => visit({ block: top }));
        return json;
      }

      it('runs the timeline in start order and reaches the side tour @slow', async function () {
        this.timeout(60000);
        const { names, events, problems } = await runExample();
        expect(names).to.deep.equal([
          'Makkah Royal Clock Tower',
          'Burj Khalifa',
          'Shanghai Tower',
          'Ping An Finance Center',
          'Merdeka 118',
        ]);
        expect(events).to.include('side');
        expect(problems).to.deep.equal([]);
      });

      it('still reaches the side tour when the last building is removed @slow', async function () {
        this.timeout(60000);
        const { names, events, problems } = await runExample((json) =>
          removeRow(json, 'Merdeka 118')
        );
        expect(names).not.to.include('Merdeka 118');
        expect(names).to.have.length(4);
        expect(events).to.include('side');
        expect(problems).to.deep.equal([]);
      });
    });

    describe('variable type', function () {
      let workspace;

      before(function () {
        if (!Blockly.Blocks.table_create) defineTableBlocks();
      });

      beforeEach(function () {
        workspace = new Blockly.Workspace();
      });

      afterEach(function () {
        workspace.dispose();
      });

      const tableVariable = (name) =>
        workspace
          .getVariableMap()
          .getAllVariables()
          .find((variable) => variable.getName() === name);

      it('makes table variables that only table dropdowns and not the Variables flyout list', function () {
        Blockly.serialization.workspaces.load(project(...createBuildings().slice(0, 1)), workspace);
        workspace.createVariable('score', '', 'score-id');
        expect(tableVariable('Buildings').getType()).to.equal('Table');
        const [creator] = workspace.getBlocksByType('table_create', false);
        const options = creator
          .getField('VAR')
          .getOptions(false)
          .map(([label]) => label);
        expect(options).to.include('Buildings');
        expect(options).not.to.include('score');
        const untyped = workspace.getVariableMap().getVariablesOfType('');
        expect(untyped.map((variable) => variable.getName())).to.deep.equal(['score']);
      });

      it('words the dropdown actions for tables', function () {
        Blockly.serialization.workspaces.load(project(...createBuildings().slice(0, 1)), workspace);
        const [creator] = workspace.getBlocksByType('table_create', false);
        const labels = creator
          .getField('VAR')
          .getOptions(false)
          .map(([label]) => label);
        expect(labels).to.include.members([
          'New table...',
          "Rename the 'Buildings' table",
          "Delete the 'Buildings' table",
        ]);
      });

      it('creates a table variable from New table...', function () {
        Blockly.serialization.workspaces.load(project(...createBuildings().slice(0, 1)), workspace);
        const [creator] = workspace.getBlocksByType('table_create', false);
        workspace.getFlyout = () => null;
        let promptText;
        Blockly.dialog.setPrompt((message, _default, callback) => {
          promptText = message;
          callback('Scores');
        });
        try {
          creator
            .getField('VAR')
            .onItemSelected_(null, { getValue: () => Blockly.FieldVariable.ADD_VARIABLE_ID });
        } finally {
          Blockly.dialog.setPrompt();
        }
        expect(promptText).to.equal('New table name:');
        expect(creator.getField('VAR').getText()).to.equal('Scores');
        expect(tableVariable('Scores').getType()).to.equal('Table');
        expect(Blockly.Msg.NEW_VARIABLE_TITLE).not.to.equal('New table name:');
      });

      it('retypes an untyped variable from an older project and keeps it on the block', function () {
        const json = {
          ...project(
            block('table_create', {
              fields: { VAR: { id: 'old-id' } },
              inputs: { COLUMNS: list(text('Name')) },
            })
          ),
          variables: [{ name: 'Buildings', id: 'old-id' }],
        };
        Blockly.serialization.workspaces.load(json, workspace);
        const [creator] = workspace.getBlocksByType('table_create', false);
        expect(creator.getFieldValue('VAR')).to.equal('old-id');
        expect(workspace.getVariableById('old-id').getType()).to.equal('Table');
        expect(workspace.getVariableMap().getAllVariables()).to.have.length(1);
      });

      it('keeps a name-only getter on the same variable as its retyped table', function () {
        const json = {
          ...project(
            chain(
              block('table_create', {
                fields: { VAR: { name: 'Buildings' } },
                inputs: { COLUMNS: list(text('Name')) },
              }),
              print(value(block('variables_get', { fields: { VAR: { name: 'Buildings' } } })))
            )
          ),
          variables: [{ name: 'Buildings', id: 'old-id' }],
        };
        Blockly.serialization.workspaces.load(json, workspace);
        const [getter] = workspace.getBlocksByType('variables_get', false);
        expect(getter.getFieldValue('VAR')).to.equal('old-id');
        expect(workspace.getVariableMap().getAllVariables()).to.have.length(1);
      });

      it('reuses an untyped variable by name when the field id is stale', function () {
        const json = {
          ...project(
            block('table_create', {
              fields: { VAR: { id: 'old-id', name: 'Buildings' } },
              inputs: { COLUMNS: list(text('Name')) },
            })
          ),
          variables: [{ name: 'Buildings', id: 'current-id' }],
        };
        Blockly.serialization.workspaces.load(json, workspace);
        const [creator] = workspace.getBlocksByType('table_create', false);
        expect(creator.getFieldValue('VAR')).to.equal('current-id');
        expect(workspace.getVariableById('current-id').getType()).to.equal('Table');
        expect(workspace.getVariableMap().getAllVariables()).to.have.length(1);
      });
    });

    describe('column menu', function () {
      let workspace;
      const menu = (COLUMN) => ({ shadow: { type: 'table_column_menu', fields: { COLUMN } } });
      const getColumn = (name, column) =>
        block('table_get_column', {
          fields: { TABLE: table(name) },
          inputs: { COLUMN: menu(column) },
        });
      const creator = (name, ...items) =>
        block('table_create', {
          fields: { VAR: table(name) },
          inputs: { COLUMNS: list(...items) },
        });
      const options = (owner) =>
        owner
          .getInputTargetBlock('COLUMN')
          .getField('COLUMN')
          .getOptions(false)
          .map(([, value]) => value);

      before(function () {
        if (!Blockly.Blocks.table_create) defineTableBlocks();
      });

      beforeEach(function () {
        workspace = new Blockly.Workspace();
      });

      afterEach(function () {
        workspace.dispose();
      });

      it("lists the plain text columns of the table's create blocks once each, in order", function () {
        const joined = value(block('variables_get', { fields: { VAR: { name: 'heading' } } }));
        Blockly.serialization.workspaces.load(
          project(
            chain(
              creator('Buildings', text('Name'), text('Height')),
              creator('Buildings', text('Height'), joined, text('City')),
              creator('Other', text('Score')),
              print(value(getColumn('Buildings', 'Name')))
            )
          ),
          workspace
        );
        const [owner] = workspace.getBlocksByType('table_get_column', false);
        expect(options(owner)).to.deep.equal(['Name', 'Height', 'City']);
      });

      it("lists the loop's table for a row value in a loop, and every table outside one", function () {
        Blockly.serialization.workspaces.load(
          project(
            chain(
              creator('A', text('Name')),
              creator('B', text('Score')),
              block('table_for_each_row', {
                fields: { VAR: { name: 'row' }, INDEX: { name: 'count' }, TABLE: table('B') },
                inputs: {
                  DO: {
                    block: print(
                      value({
                        type: 'table_row_value',
                        inputs: { COLUMN: menu('Score'), ROW: rowVar() },
                      })
                    ),
                  },
                },
              }),
              print(
                value({ type: 'table_row_value', inputs: { COLUMN: menu('Name'), ROW: rowVar() } })
              )
            )
          ),
          workspace
        );
        const inLoop = (b) => {
          for (let outer = b.getSurroundParent(); outer; outer = outer.getSurroundParent()) {
            if (outer.type === 'table_for_each_row') return true;
          }
          return false;
        };
        const rowValues = workspace.getBlocksByType('table_row_value', false);
        const inside = rowValues.find(inLoop);
        const outside = rowValues.find((b) => !inLoop(b));
        expect(options(inside)).to.deep.equal(['Score']);
        expect(options(outside)).to.deep.equal(['Name', 'Score']);
      });

      it('warns when a menu or text names a column the table does not have', function () {
        Blockly.serialization.workspaces.load(
          project(
            chain(
              creator('Buildings', text('Name'), text('Height')),
              print(value(getColumn('Buildings', 'Floors'))),
              print(value(getColumn('Buildings', 'Height'))),
              print(
                value(
                  block('table_get_column', {
                    fields: { TABLE: table('Buildings') },
                    inputs: { COLUMN: text('City') },
                  })
                )
              )
            )
          ),
          workspace
        );
        const warnings = workspace
          .getBlocksByType('table_get_column', false)
          .map((owner) => tableColumnWarningFor(owner));
        expect(warnings).to.deep.equal([
          "Buildings doesn't have a column called 'Floors'. Its columns are: Name, Height.",
          null,
          "Buildings doesn't have a column called 'City'. Its columns are: Name, Height.",
        ]);
      });

      it('shows the row number of add row only when adding at a row', function () {
        const visible = (owner) =>
          owner.inputList.filter((input) => input.isVisible()).map((input) => input.name);
        const add = workspace.newBlock('table_add_row');
        expect(visible(add)).to.deep.equal(['POSITION_ROW', 'VALUES']);
        add.getField('POSITION').setValue('ROW');
        expect(visible(add)).to.deep.equal(['POSITION_ROW', 'ROW', 'VALUES']);
        Blockly.serialization.workspaces.load(
          project(block('table_add_row', { fields: { TABLE: table('A'), POSITION: 'ROW' } })),
          workspace
        );
        const [loaded] = workspace.getBlocksByType('table_add_row', false);
        expect(visible(loaded)).to.deep.equal(['POSITION_ROW', 'ROW', 'VALUES']);
      });

      it('hides the column of a random sort and does not warn about it', function () {
        Blockly.serialization.workspaces.load(
          project(
            chain(
              creator('Buildings', text('Name')),
              block('table_sort', {
                fields: { TABLE: table('Buildings'), ORDER: 'RANDOM' },
                inputs: { COLUMN: menu('Floors') },
              })
            )
          ),
          workspace
        );
        const sort = workspace.getBlocksByType('table_sort', false)[0];
        expect(sort.getInput('COLUMN').isVisible()).to.equal(false);
        expect(tableColumnWarningFor(sort)).to.equal(null);
        sort.getField('ORDER').setValue('ASCENDING');
        expect(sort.getInput('COLUMN').isVisible()).to.equal(true);
        expect(tableColumnWarningFor(sort)).to.contain("'Floors'");
      });

      it('lists and accepts the names given to repeated columns', function () {
        Blockly.serialization.workspaces.load(
          project(
            chain(
              creator('Shop', text('Name'), text('Name'), text('Name')),
              print(value(getColumn('Shop', 'Name 3'))),
              print(value(getColumn('Shop', 'Name 4')))
            )
          ),
          workspace
        );
        const [third, fourth] = workspace.getBlocksByType('table_get_column', false);
        expect(options(third)).to.deep.equal(['Name', 'Name 2', 'Name 3']);
        expect(tableColumnWarningFor(third)).to.equal(null);
        expect(tableColumnWarningFor(fourth)).to.equal(
          "Shop doesn't have a column called 'Name 4'. Its columns are: Name, Name 2, Name 3."
        );
      });

      it('does not warn when the editor cannot see every column or the table', function () {
        const heading = value(block('variables_get', { fields: { VAR: { name: 'heading' } } }));
        Blockly.serialization.workspaces.load(
          project(
            chain(
              creator('Buildings', text('Name'), heading),
              creator('Other', text('Score')),
              print(value(getColumn('Buildings', 'Floors'))),
              print(value(getColumn('Missing', 'Floors'))),
              print(
                value({
                  type: 'table_row_value',
                  inputs: { COLUMN: menu('Floors'), ROW: rowVar() },
                })
              )
            )
          ),
          workspace
        );
        const owners = [
          ...workspace.getBlocksByType('table_get_column', false),
          ...workspace.getBlocksByType('table_row_value', false),
        ];
        expect(owners).to.have.length(3);
        expect(owners.map((owner) => tableColumnWarningFor(owner))).to.deep.equal([
          null,
          null,
          null,
        ]);
      });

      it('has Spanish defaults and warning text', function () {
        for (const key of [
          'table_default_column_name',
          'table_default_value_column_name',
          'table_column_missing_warning',
          'table_column_menu_tooltip',
        ]) {
          expect(esLocale[key], key).to.be.a('string').and.not.equal(enLocale[key]);
        }
      });

      describe('renaming a column', function () {
        const settle = () => new Promise((resolve) => setTimeout(resolve, 200));
        const columnText = (name) =>
          workspace
            .getBlocksByType('text', false)
            .find(
              (b) => b.getFieldValue('TEXT') === name && b.getParent()?.type === 'lists_create_with'
            );
        const menuValues = () =>
          workspace
            .getBlocksByType('table_column_menu', false)
            .map((m) => `${m.getParent().type}:${m.getFieldValue('COLUMN')}`);

        beforeEach(function () {
          installTableColumnRenames(workspace);
          Blockly.serialization.workspaces.load(
            project(
              chain(
                creator('A', text('Name'), text('Height')),
                creator('B', text('Height')),
                print(value(getColumn('A', 'Height'))),
                print(value(getColumn('B', 'Height'))),
                print(
                  value({
                    type: 'table_row_value',
                    inputs: { COLUMN: menu('Height'), ROW: rowVar() },
                  })
                ),
                print(
                  value(
                    block('table_get_column', {
                      fields: { TABLE: table('A') },
                      inputs: { COLUMN: text('Height') },
                    })
                  )
                )
              )
            ),
            workspace
          );
          workspace.clearUndo();
        });

        it("renames only that table's menus", async function () {
          const tableA = workspace
            .getBlocksByType('table_create', false)
            .find((b) => b.getField('VAR').getText() === 'A');
          tableA
            .getInputTargetBlock('COLUMNS')
            .getInputTargetBlock('ADD1')
            .setFieldValue('Tall', 'TEXT');
          await settle();
          expect(menuValues()).to.deep.equal([
            'table_get_column:Tall',
            'table_get_column:Height',
            'table_row_value:Height',
          ]);
          const typed = workspace
            .getBlocksByType('text', false)
            .filter((b) => b.getParent()?.type === 'table_get_column');
          expect(typed.map((b) => b.getFieldValue('TEXT'))).to.deep.equal(['Height']);
        });

        it('follows typing through an empty name and a name already in use', async function () {
          const tableA = workspace
            .getBlocksByType('table_create', false)
            .find((b) => b.getField('VAR').getText() === 'A');
          const height = tableA.getInputTargetBlock('COLUMNS').getInputTargetBlock('ADD1');
          for (const step of ['', 'Na', 'Name', 'Names']) {
            height.setFieldValue(step, 'TEXT');
            await settle();
          }
          expect(menuValues()[0]).to.equal('table_get_column:Names');
        });

        it('undoes the rename and the menus in one step', async function () {
          columnText('Name').setFieldValue('Title', 'TEXT');
          const tableA = workspace
            .getBlocksByType('table_create', false)
            .find((b) => b.getField('VAR').getText() === 'A');
          tableA
            .getInputTargetBlock('COLUMNS')
            .getInputTargetBlock('ADD1')
            .setFieldValue('Tall', 'TEXT');
          await settle();
          expect(menuValues()[0]).to.equal('table_get_column:Tall');
          workspace.undo(false);
          await settle();
          expect(menuValues()[0]).to.equal('table_get_column:Height');
          expect(columnText('Height')).to.exist;
          expect(columnText('Title')).to.exist;
          workspace.undo(true);
          await settle();
          expect(menuValues()[0]).to.equal('table_get_column:Tall');
        });
      });

      it('lists the table named by a row getter', function () {
        const getRow = block('table_get_row', {
          fields: { TABLE: table('B') },
          inputs: { ROW: num(0) },
        });
        Blockly.serialization.workspaces.load(
          project(
            chain(
              creator('A', text('Name')),
              creator('B', text('Score')),
              print(
                value({
                  type: 'table_row_value',
                  inputs: { COLUMN: menu('Score'), ROW: value(getRow) },
                })
              )
            )
          ),
          workspace
        );
        const [owner] = workspace.getBlocksByType('table_row_value', false);
        expect(options(owner)).to.deep.equal(['Score']);
      });

      it('keeps a column that is not in the menu through save and load', function () {
        const json = project(
          print(value(getColumn('Buildings', 'Floors'))),
          creator('Buildings', text('Name'))
        );
        Blockly.serialization.workspaces.load(json, workspace);
        const [owner] = workspace.getBlocksByType('table_get_column', false);
        const field = owner.getInputTargetBlock('COLUMN').getField('COLUMN');
        expect(field.getValue()).to.equal('Floors');
        expect(field.getText()).to.equal('Floors');
        expect(options(owner)).to.deep.equal(['Name', 'Floors']);
        const saved = Blockly.serialization.workspaces.save(workspace);
        workspace.clear();
        Blockly.serialization.workspaces.load(saved, workspace);
        const [reloaded] = workspace.getBlocksByType('table_get_column', false);
        expect(reloaded.getInputTargetBlock('COLUMN').getFieldValue('COLUMN')).to.equal('Floors');
      });

      it('generates the same code as a text block with the same name', function () {
        const compile = (column) =>
          compileFlockProject(
            project(
              chain(
                creator('Buildings', text('Name')),
                print(
                  value(
                    block('table_get_column', {
                      fields: { TABLE: table('Buildings') },
                      inputs: { COLUMN: column },
                    })
                  )
                )
              )
            )
          );
        const code = compile(menu("Bob's name"));
        expect(code).to.equal(compile(text("Bob's name")));
        expect(code).to.include("getTableColumn(Buildings, 'Bob\\'s name')");
      });

      it('puts a column menu in every column input of the flyout', function () {
        const columnInputs = tableFlyoutBlocks('Buildings', 'table2', 'Height')
          .filter((item) => item.inputs?.COLUMN)
          .map((item) => [item.type, item.inputs.COLUMN.shadow]);
        expect(columnInputs).to.have.length(6);
        for (const [type, shadow] of columnInputs) {
          expect(shadow, type).to.deep.equal({
            type: 'table_column_menu',
            fields: { COLUMN: 'Height' },
          });
        }
      });
    });

    describe('feature flag', function () {
      it('shows Tables under Data and lists the table example while the flag is on', function () {
        const data = toolbox.contents.find((item) => item.name === '%{BKY_CATEGORY_VARIABLES}');
        expect(data.contents.map((item) => item.name)).to.include('%{BKY_CATEGORY_TABLES}');
        expect(EXAMPLES.map((ex) => ex.i18nKey)).to.include('tallest_buildings_tables');
      });
    });
  });
}
