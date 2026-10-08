import { expect } from 'chai';
import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import { defineGenerators } from '../generators/generators.js';
import '../blocks/blocks.js';
import { defineShapeBlocks } from '../blocks/shapes.js';
import { defineModifyBlocks } from '../blocks/modify.js';

const box = (name, extra = {}) => ({
  block: { type: 'create_box', fields: { ID_VAR: { name } }, ...extra },
});

export function runCombineTests(flock) {
  describe('Combine block @combine', function () {
    let workspace;
    let savedLoadingCode;

    before(function () {
      if (!Blockly.Blocks['create_box']) defineShapeBlocks();
      if (!Blockly.Blocks['combine']) defineModifyBlocks();
      if (!javascriptGenerator.forBlock['combine']) defineGenerators();
    });

    beforeEach(function () {
      savedLoadingCode = window.loadingCode;
      window.loadingCode = true;
      workspace = new Blockly.Workspace();
    });

    afterEach(function () {
      workspace.dispose();
      window.loadingCode = savedLoadingCode;
    });

    const append = (operation, inputs = {}, fields = {}) =>
      Blockly.serialization.blocks.append(
        {
          type: 'combine',
          fields: { RESULT_VAR: { name: 'combined1' }, OPERATION: operation, ...fields },
          inputs,
        },
        workspace
      );

    const generate = (block) => {
      javascriptGenerator.init(workspace);
      return javascriptGenerator.blockToCode(block);
    };

    it('has a second compartment only for subtract and embed', function () {
      const combine = append('merge');
      expect(combine.getInput('PARTS')).to.exist;
      expect(combine.getInput('TOOLS')).to.equal(null);

      combine.setFieldValue('subtract', 'OPERATION');
      expect(combine.getField('TOOLS_LABEL').getValue()).to.equal('subtract');
      expect(combine.inputList.map((input) => input.name).slice(-2)).to.deep.equal([
        'TOOLS_ROW',
        'TOOLS',
      ]);
      expect(combine.getInput('TOOLS').fieldRow).to.have.length(0);
      combine.setFieldValue('embed', 'OPERATION');
      expect(combine.getField('TOOLS_LABEL').getValue()).to.equal('embed');

      for (const operation of ['merge', 'intersect', 'hull']) {
        combine.setFieldValue('subtract', 'OPERATION');
        combine.setFieldValue(operation, 'OPERATION');
        expect(combine.getInput('TOOLS'), operation).to.equal(null);
        expect(combine.getInput('TOOLS_ROW'), operation).to.equal(null);
      }
    });

    it('bumps the second compartment out when its operation has one compartment', function () {
      const combine = append('subtract', { PARTS: box('base'), TOOLS: box('hole') });
      const hole = combine.getInputTargetBlock('TOOLS');
      combine.setFieldValue('merge', 'OPERATION');
      expect(hole.disposed).to.equal(false);
      expect(hole.getParent()).to.equal(null);
      expect(combine.getInputTargetBlock('PARTS').type).to.equal('create_box');
    });

    it('round-trips the second compartment', function () {
      const combine = append('embed', { PARTS: box('base'), TOOLS: box('gem') });
      const copy = Blockly.serialization.blocks.append(
        Blockly.serialization.blocks.save(combine),
        workspace
      );
      expect(copy.getFieldValue('OPERATION')).to.equal('embed');
      expect(copy.getInputTargetBlock('TOOLS')?.type).to.equal('create_box');
    });

    it('builds each compartment into its own group for combineMeshes', function () {
      const combine = append('subtract', { PARTS: box('base'), TOOLS: box('hole') });
      const code = generate(combine);
      const meshId = JSON.stringify(`combined1__${combine.id}`);
      expect(code.startsWith(`combined1 = await combineMeshes(${meshId}, {`)).to.equal(true);
      expect(code).to.include('operation: "subtract"');
      const [, parts] = code.match(/build: async function \((\w+)\)/);
      const [, tools] = code.match(/tools: async function \((\w+)\)/);
      expect(code).to.include(`setParent(${parts}, base)`);
      expect(code).to.include(`setParent(${tools}, hole)`);
    });

    it('omits tools for single-compartment operations', function () {
      const code = generate(append('hull', { PARTS: box('part') }));
      expect(code).to.include('operation: "hull"');
      expect(code).not.to.include('tools:');
    });

    it('runs the compartments as plain code when inactive', function () {
      const combine = append(
        'subtract',
        { PARTS: box('base'), TOOLS: box('hole') },
        { ACTIVE: false }
      );
      const code = generate(combine);
      expect(code).not.to.include('combineMeshes');
      expect(code).not.to.include('combined1 =');
      expect(code).not.to.include('setParent');
      expect(code).to.match(/base = createBox[\s\S]*hole = createBox/);
    });
  });

  describe('combineMeshes @combine', function () {
    const created = [];

    afterEach(function () {
      created.forEach((name) => {
        if (flock.scene.getMeshByName(name)) flock.dispose(name);
      });
      created.length = 0;
    });

    const addBox = (group, id, x, width = 1) => {
      const name = flock.createBox(id, { width, height: 1, depth: 1, position: [x, 0, 0] });
      created.push(name);
      flock.setParent(group, name);
      return name;
    };

    const extentX = (name) => {
      const mesh = flock.scene.getMeshByName(name);
      mesh.computeWorldMatrix(true);
      mesh.refreshBoundingInfo();
      const { minimumWorld, maximumWorld } = mesh.getBoundingInfo().boundingBox;
      return [minimumWorld.x, maximumWorld.x];
    };

    const exists = (name) => Boolean(flock.scene.getMeshByName(name));

    it('merges the meshes built in the compartment', async function () {
      let a, b;
      const id = await flock.combineMeshes('combineMerge__combineMerge', {
        build: async (group) => {
          a = addBox(group, 'combineMergeA', 0);
          b = addBox(group, 'combineMergeB', 2);
        },
      });
      created.push(id);
      expect(id).to.be.a('string');
      const [min, max] = extentX(id);
      expect(min).to.be.closeTo(-0.5, 0.01);
      expect(max).to.be.closeTo(2.5, 0.01);
      expect(exists(a) || exists(b)).to.equal(false);
    });

    it('consumes the source of a one-part merge', async function () {
      let source;
      const id = await flock.combineMeshes('combineSingle__combineSingle', {
        build: async (group) => {
          source = flock.scene.getMeshByName(addBox(group, 'combineSingleA', 1));
        },
      });
      created.push(id);
      expect(id).to.be.a('string');
      expect(source.isDisposed()).to.equal(true);
      const [min, max] = extentX(id);
      expect(min).to.be.closeTo(0.5, 0.01);
      expect(max).to.be.closeTo(1.5, 0.01);
      expect(flock.scene.getMeshByName(id).physicsBody).to.exist;
    });

    it('includes objects parented to a mesh in the compartment', async function () {
      let child;
      const id = await flock.combineMeshes('combineNested__combineNested', {
        build: async (group) => {
          const parent = addBox(group, 'combineNestedParent', 0);
          child = flock.createBox('combineNestedChild', {
            width: 1,
            height: 1,
            depth: 1,
            position: [3, 0, 0],
          });
          created.push(child);
          flock.setParent(parent, child);
        },
      });
      created.push(id);
      const [min, max] = extentX(id);
      expect(min).to.be.closeTo(-0.5, 0.01);
      expect(max).to.be.closeTo(3.5, 0.01);
      expect(exists(child)).to.equal(false);
    });

    it('merges a multi-mesh base before subtracting the tools', async function () {
      let tool;
      const id = await flock.combineMeshes('combineSub__combineSub', {
        operation: 'subtract',
        build: async (group) => {
          addBox(group, 'combineSubA', 0);
          addBox(group, 'combineSubB', 1);
        },
        tools: async (group) => {
          tool = addBox(group, 'combineSubTool', 2, 2);
        },
      });
      created.push(id);
      expect(id).to.be.a('string');
      const [min, max] = extentX(id);
      expect(min).to.be.closeTo(-0.5, 0.01);
      expect(max).to.be.closeTo(1, 0.01);
      expect(exists(tool)).to.equal(false);
      expect(flock.scene.meshes.some((mesh) => mesh.name.startsWith('combineSub_base'))).to.equal(
        false
      );
    });

    it('keeps the tools when embedding', async function () {
      let tool;
      const id = await flock.combineMeshes('combineEmbed__combineEmbed', {
        operation: 'embed',
        build: async (group) => {
          addBox(group, 'combineEmbedBase', 0, 2);
        },
        tools: async (group) => {
          tool = addBox(group, 'combineEmbedTool', 1);
        },
      });
      created.push(id);
      expect(id).to.be.a('string');
      expect(exists(tool)).to.equal(true);
      expect(flock.scene.getMeshByName(tool).parent).to.equal(null);
    });

    it('combines the members of a group, not its shell', async function () {
      const id = await flock.combineMeshes('combineHull__combineHull', {
        operation: 'hull',
        build: async (group) => {
          const inner = flock.createGroup('combineHullGroup__combineHullGroup');
          created.push(inner);
          flock.setParent(group, inner);
          addBox(inner, 'combineHullA', 0);
          addBox(inner, 'combineHullB', 3);
        },
      });
      created.push(id);
      expect(id).to.be.a('string');
      const [min, max] = extentX(id);
      expect(min).to.be.closeTo(-0.5, 0.01);
      expect(max).to.be.closeTo(3.5, 0.01);
    });

    it('intersects overlapping meshes', async function () {
      const id = await flock.combineMeshes('combineIntersect__combineIntersect', {
        operation: 'intersect',
        build: async (group) => {
          addBox(group, 'combineIntersectA', 0, 2);
          addBox(group, 'combineIntersectB', 1, 2);
        },
      });
      created.push(id);
      expect(id).to.be.a('string');
      const [min, max] = extentX(id);
      expect(min).to.be.closeTo(0, 0.01);
      expect(max).to.be.closeTo(1, 0.01);
    });

    it('returns null and leaves no group behind when the compartment is empty', async function () {
      const before = flock.scene.meshes.length;
      const id = await flock.combineMeshes('combineEmpty__combineEmpty', {
        build: async () => {},
      });
      expect(id).to.equal(null);
      expect(flock.scene.meshes.length).to.equal(before);
    });
  });
}
