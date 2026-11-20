import { expect } from 'chai';
import { compileFlockProject } from './utils/flockCompilerTestUtils.js';
import { toolbox } from '../toolbox.js';
import { EXAMPLES } from '../main/examples.js';
import { tableRowText } from '../api/tables.js';

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
              print(value(block('table_row_count', { fields: { TABLE: table('Buildings') } })))
            )
          )
        );
        expect(code, code).to.include(`Buildings = createTable("Buildings", ['Name', 'Height']);`);
        expect(code, code).to.include("addTableRow(Buildings, ['Burj Khalifa', 828]);");
        expect(code, code).to.include("setTableValue(Buildings, 0, 'Height', 830);");
        expect(code, code).to.include("getTableValue(Buildings, 1, 'Name')");
        expect(code, code).to.include('getTableRow(Buildings, 0)');
        expect(code, code).to.include("getTableColumn(Buildings, 'Name')");
        expect(code, code).to.include('getTableRowCount(Buildings)');
        expect(() => flock.prepareUserCode(code)).not.to.throw();
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

    describe('feature flag', function () {
      it('shows Tables under Data and lists the table example while the flag is on', function () {
        const data = toolbox.contents.find((item) => item.name === '%{BKY_CATEGORY_VARIABLES}');
        expect(data.contents.map((item) => item.name)).to.include('%{BKY_CATEGORY_TABLES}');
        expect(EXAMPLES.map((ex) => ex.i18nKey)).to.include('tallest_buildings_tables');
      });

      it('gives every table block a keyword no other toolbox block uses', function () {
        const entries = [];
        const walk = (node) => {
          if (node?.kind === 'block' && node.keyword) entries.push(node);
          node?.contents?.forEach(walk);
        };
        walk(toolbox);
        const tableEntries = entries.filter((entry) => entry.type.startsWith('table_'));
        expect(tableEntries.length).to.be.greaterThan(0);
        for (const entry of tableEntries) {
          const sharing = entries.filter(
            (other) => other.keyword === entry.keyword && other.type !== entry.type
          );
          expect(
            sharing.map((other) => other.type),
            entry.keyword
          ).to.deep.equal([]);
        }
      });
    });
  });
}
