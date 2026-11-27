import { expect } from 'chai';
import * as Blockly from 'blockly';
import { compileFlockProject } from './utils/flockCompilerTestUtils.js';
import { terrainGrid, terrainHeightAt, terrainLayout } from '../api/terrain.js';
import { defineTableBlocks, tableStartRows } from '../blocks/tables.js';
import { defineSceneBlocks } from '../blocks/scene.js';

const text = (TEXT) => ({ shadow: { type: 'text', fields: { TEXT } } });
const list = (...items) => ({
  block: {
    type: 'lists_create_with',
    extraState: { itemCount: items.length },
    inputs: Object.fromEntries(items.map((item, i) => [`ADD${i}`, item])),
  },
});
const green = {
  shadow: {
    type: 'material',
    inputs: { BASE_COLOR: { shadow: { type: 'colour', fields: { COLOR: '#71BC78' } } } },
  },
};

const createHills = (rows) => ({
  type: 'table_create',
  fields: { VAR: { name: 'Hills' } },
  inputs: { COLUMNS: list(text('a'), text('b'), text('c')) },
  extraState: { columns: ['a', 'b', 'c'], rows },
});
const mapFromHills = () => ({
  type: 'create_map_table',
  fields: { TABLE: { name: 'Hills' } },
  inputs: { MATERIAL: green },
});

const project = (...stack) => ({
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'start',
        inputs: {
          DO: {
            block: stack.reduceRight((next, b) => ({ ...b, next: { block: next } })),
          },
        },
      },
    ],
  },
});

const HILL = [
  [0, 0, 0],
  [0, 4, 0],
  [0, 0, 0],
];

export function runTerrainTests(flock) {
  describe('Terrain from tables @terrain', function () {
    this.timeout(20000);

    describe('height grid', function () {
      it('keeps numbers, including decimals and negatives', function () {
        const grid = terrainGrid([
          [1, -2.5],
          ['3', 0],
        ]);
        expect(grid.heights).to.deep.equal([
          [1, -2.5],
          [3, 0],
        ]);
        expect(grid.problems).to.deep.equal([]);
      });

      it('uses 0 for blank and text cells and reports the first one', function () {
        const grid = terrainGrid([
          [1, ''],
          ['hill', 2],
        ]);
        expect(grid.heights).to.deep.equal([
          [1, 0],
          [0, 2],
        ]);
        expect(grid.problems).to.deep.equal([
          { key: 'map_table_not_number', values: { row: 0, column: 1, value: '' } },
        ]);
      });

      it('keeps at most 32 rows and columns', function () {
        const rows = Array.from({ length: 40 }, () => Array(35).fill(1));
        const grid = terrainGrid(rows);
        expect([grid.rows, grid.columns]).to.deep.equal([32, 32]);
        expect(grid.problems.map((p) => p.key)).to.deep.equal(['map_table_too_big']);
      });

      it('reports heights far outside the usual range but keeps them', function () {
        const grid = terrainGrid([[100, 0]]);
        expect(grid.heights).to.deep.equal([[100, 0]]);
        expect(grid.problems.map((p) => p.key)).to.deep.equal(['map_table_far']);
      });

      it('makes a single flat cell from an empty table', function () {
        expect(terrainGrid([]).heights).to.deep.equal([[0]]);
      });
    });

    describe('layout', function () {
      it('fits the longest side to 100 and keeps cells square', function () {
        const layout = terrainLayout({ rows: 4, columns: 5 });
        expect(layout.width).to.equal(100);
        expect(layout.depth).to.equal(80);
        expect(layout.subdivisionsX).to.equal(64);
        expect(layout.subdivisionsY).to.equal(51);
      });

      it('puts row 0 at the far edge and column 0 on the left', function () {
        const grid = terrainGrid([
          [1, 2],
          [3, 4],
        ]);
        const layout = terrainLayout(grid);
        expect(terrainHeightAt(grid, layout, -25, 25)).to.equal(1);
        expect(terrainHeightAt(grid, layout, 25, 25)).to.equal(2);
        expect(terrainHeightAt(grid, layout, -25, -25)).to.equal(3);
        expect(terrainHeightAt(grid, layout, 25, -25)).to.equal(4);
      });
    });

    describe('API', function () {
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
        if (flock.ground) {
          flock.disposeMesh(flock.ground);
          flock.ground = null;
        }
      });

      it('builds ground at the heights in the table', function () {
        flock.createTable('Hills', ['a', 'b', 'c'], HILL);
        flock.createMapFromTable('Hills', '#71BC78');
        expect(flock.ground.metadata.heightMapImage).to.equal('TABLE');
        expect(flock.getGroundLevelAt(0, 0)).to.be.closeTo(4, 0.01);
        expect(flock.getGroundLevelAt(-40, 40)).to.be.closeTo(0, 0.01);
        expect(flock.ground.physics).to.exist;
        expect(reported).to.deep.equal([]);
      });

      it('keeps the same mesh when only the material changes', function () {
        flock.createTable('Hills', ['a', 'b', 'c'], HILL);
        flock.createMapFromTable('Hills', '#71BC78');
        const first = flock.ground;
        flock.createMapFromTable('Hills', '#cc8833');
        expect(flock.ground).to.equal(first);
      });

      it('rebuilds when the heights change', function () {
        flock.createTable('Hills', ['a', 'b', 'c'], HILL);
        flock.createMapFromTable('Hills', '#71BC78');
        const first = flock.ground;
        flock.setTableValue('Hills', 1, 'b', 6);
        flock.createMapFromTable('Hills', '#71BC78');
        expect(flock.ground).to.not.equal(first);
        expect(flock.getGroundLevelAt(0, 0)).to.be.closeTo(6, 0.01);
      });

      it('names the column of a cell that is not a number', function () {
        flock.createTable('Hills', ['a', 'b'], [[1, 'top']]);
        flock.createMapFromTable('Hills', '#71BC78');
        expect(reported).to.have.length(1);
        expect(reported[0].key).to.equal('map_table_not_number');
        expect(reported[0].values).to.include({ table: 'Hills', row: 0, column: 'b' });
      });

      it('makes flat ground and reports a missing table', function () {
        flock.createMapFromTable('Nowhere', '#71BC78');
        expect(reported.map((p) => p.key)).to.include('table_not_found');
        expect(flock.getGroundLevelAt(10, 10)).to.be.closeTo(0, 0.01);
      });
    });

    describe('blocks', function () {
      let workspace;

      before(function () {
        if (!Blockly.Blocks.table_create) defineTableBlocks();
        if (!Blockly.Blocks.create_map_table) defineSceneBlocks();
      });

      beforeEach(function () {
        workspace = new Blockly.Workspace();
      });

      afterEach(function () {
        workspace.dispose();
      });

      it("reads the start data of the table's create block", function () {
        Blockly.serialization.workspaces.load(
          project(createHills(HILL), mapFromHills()),
          workspace
        );
        const map = workspace.getBlocksByType('create_map_table', false)[0];
        expect(tableStartRows(map)).to.deep.equal(HILL);
      });

      it('generates a createMapFromTable call', function () {
        const code = compileFlockProject(project(createHills(HILL), mapFromHills()));
        expect(code).to.match(/createMapFromTable\(\w+, /);
      });
    });

    describe('running projects', function () {
      before(async function () {
        await flock.disposeOldScene();
      });

      it('makes the ground from start data when the project runs', async function () {
        await flock.runCode(compileFlockProject(project(createHills(HILL), mapFromHills())), {
          focusCanvas: false,
        });
        for (let i = 0; i < 100 && flock.ground?.metadata?.heightMapImage !== 'TABLE'; i++) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        expect(flock.ground?.metadata?.heightMapImage).to.equal('TABLE');
        expect(flock.getGroundLevelAt(0, 0)).to.be.closeTo(4, 0.01);
      });
    });
  });
}
