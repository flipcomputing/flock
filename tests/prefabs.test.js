import { expect } from 'chai';
import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import { defineGenerators } from '../generators/generators.js';
import '../blocks/blocks.js';
import { defineMaterialsBlocks } from '../blocks/materials.js';
import { defineColourBlocks } from '../blocks/colour.js';
import {
  definePrefabBlocks,
  prefabFlyoutItems,
  PREFAB_DEF_TYPE,
  PREFAB_CALL_TYPE,
  MATERIAL_ARG,
} from '../blocks/prefabs.js';
import { getWorkspaceProcedures, procedureDefDefaultFields } from '../main/blocksearch.js';

function appendDefinition(workspace, params = [], extra = {}) {
  return Blockly.serialization.blocks.append(
    {
      type: PREFAB_DEF_TYPE,
      fields: { NAME: 'bookcase' },
      ...(params.length && {
        extraState: {
          params: [
            ...params.map((name) => ({ name, argId: name })),
            { name: 'material', argId: MATERIAL_ARG },
          ],
        },
      }),
      ...extra,
    },
    workspace
  );
}

function appendCaller(workspace, params, extra = {}) {
  return Blockly.serialization.blocks.append(
    {
      type: PREFAB_CALL_TYPE,
      extraState: { name: 'bookcase', params: [...params, 'material'] },
      fields: { ID_VAR: { name: 'bookcase1' } },
      ...extra,
    },
    workspace
  );
}

const inputNames = (block) => block.inputList.map((input) => input.name).filter(Boolean);

export function runPrefabTests(flock) {
  describe('Prefab blocks @prefabs', function () {
    let workspace;
    let savedLoadingCode;

    before(function () {
      if (!Blockly.Blocks['material']) defineMaterialsBlocks();
      if (!Blockly.Blocks['colour']) defineColourBlocks();
      if (!Blockly.Blocks[PREFAB_DEF_TYPE]) definePrefabBlocks();
      if (!javascriptGenerator.forBlock[PREFAB_CALL_TYPE]) defineGenerators();
    });

    beforeEach(function () {
      savedLoadingCode = window.loadingCode;
      window.loadingCode = false;
      workspace = new Blockly.Workspace();
    });

    afterEach(function () {
      workspace.dispose();
      window.loadingCode = savedLoadingCode;
    });

    it('gives a new definition a fixed material parameter above x, y and z', function () {
      const definition = appendDefinition(workspace);
      expect(definition.argData_.map((arg) => arg.argId)).to.deep.equal([MATERIAL_ARG]);
      expect(definition.getField(MATERIAL_ARG).EDITABLE).to.equal(false);
      expect(definition.getField(MATERIAL_ARG).SERIALIZABLE).to.equal(false);
      const expected = [
        'PARAMS_ROW',
        MATERIAL_ARG,
        'TRANSFORM_ROW',
        'X',
        'Y',
        'Z',
        'ROTATE_Y',
        'STACK',
      ];
      expect(definition.getInput(`${MATERIAL_ARG}_ROW`)).to.equal(null);
      expect(inputNames(definition).filter((name) => expected.includes(name))).to.deep.equal(
        expected
      );
    });

    it('starts material on its own row without doubling a break on the last parameter', function () {
      const definition = appendDefinition(workspace, ['width', 'height']);
      const before = (name) => inputNames(definition)[inputNames(definition).indexOf(name) - 1];
      expect(before(MATERIAL_ARG)).to.equal('PARAMS_ROW');
      definition.setRowBreak_('height', true);
      expect(definition.getInput('PARAMS_ROW')).to.equal(null);
      expect(before(MATERIAL_ARG)).to.equal('height_ROW');
      definition.removeArg_('height');
      expect(before(MATERIAL_ARG)).to.equal('PARAMS_ROW');
    });

    it('defaults the material to a material shadow', function () {
      const material = appendDefinition(workspace).getInputTargetBlock(MATERIAL_ARG);
      expect(material.type).to.equal('material');
      expect(material.isShadow()).to.equal(true);
    });

    it('puts added parameters before the fixed inputs', function () {
      const definition = appendDefinition(workspace);
      definition.plus();
      expect(definition.argData_.at(-1).argId).to.equal(MATERIAL_ARG);
      const names = inputNames(definition);
      expect(names.indexOf(definition.argData_[0].argId)).to.be.below(names.indexOf('X'));
    });

    it('round-trips custom parameters and row breaks with material last', function () {
      const definition = appendDefinition(workspace, ['width', 'shelves']);
      definition.setRowBreak_('width', true);
      const state = Blockly.serialization.blocks.save(definition);
      const copy = Blockly.serialization.blocks.append(state, workspace);
      expect(copy.argData_.map((arg) => arg.argId)).to.deep.equal([
        'width',
        'shelves',
        MATERIAL_ARG,
      ]);
      expect(copy.argData_[0].rowBreak).to.equal(true);
      expect(copy.getProcedureDef()[1]).to.deep.equal(['width', 'shelves', 'material']);
    });

    it('lays out the add block as parameters, then material, then pin, position and rotation', function () {
      appendDefinition(workspace, ['width']);
      const caller = appendCaller(workspace, ['width']);
      expect(inputNames(caller)).to.deep.equal([
        'TOPROW',
        'ARG0',
        'PARAMS_ROW',
        'ARG1',
        'TRANSFORM_ROW',
        'PICK',
        'X',
        'Y',
        'Z',
        'ROTATE_Y',
      ]);
      expect(caller.getField('WITH')).to.equal(null);
      expect(caller.getFieldValue('NAME')).to.equal('bookcase');
    });

    it('does not add a second break before material for a row break on the last parameter', function () {
      const definition = appendDefinition(workspace, ['width', 'height']);
      const caller = appendCaller(workspace, ['width', 'height']);
      definition.setRowBreak_('width', true);
      definition.setRowBreak_('height', true);
      Blockly.Procedures.mutateCallers(definition);
      expect(inputNames(caller).slice(1, 6)).to.deep.equal([
        'ARG0',
        'ROW_0',
        'ARG1',
        'PARAMS_ROW',
        'ARG2',
      ]);
    });

    it('copies the material default to a new add block', function () {
      appendDefinition(workspace, ['width']);
      const caller = appendCaller(workspace, ['width']);
      const material = caller.getInputTargetBlock('ARG1');
      expect(material.type).to.equal('material');
      expect(material.isShadow()).to.equal(true);
    });

    it('follows the definition when parameters change and it is renamed', function () {
      const definition = appendDefinition(workspace, ['width']);
      const caller = appendCaller(workspace, ['width']);
      definition.plus();
      expect(caller.arguments_).to.have.length(3);
      expect(caller.arguments_.at(-1)).to.equal('material');
      expect(inputNames(caller).slice(1, 5)).to.deep.equal(['ARG0', 'ARG1', 'PARAMS_ROW', 'ARG2']);

      definition.setFieldValue('shelf', 'NAME');
      expect(caller.getProcedureCall()).to.equal('shelf');
    });

    it('lists the definition and one add block per prefab in the flyout', function () {
      appendDefinition(workspace, [], {
        inputs: { X: { shadow: { type: 'math_number', fields: { NUM: 4 } } } },
      });
      const { definition, callers } = prefabFlyoutItems(workspace, (name) => `${name}1`);
      expect(definition.type).to.equal(PREFAB_DEF_TYPE);
      expect(callers).to.have.length(1);
      expect(callers[0]).to.deep.include({
        type: PREFAB_CALL_TYPE,
        extraState: { name: 'bookcase', params: ['material'] },
        fields: { ID_VAR: { name: 'bookcase1' } },
      });
      expect(callers[0].inputs.X.shadow.fields.NUM).to.equal(4);
    });

    it('offers prefabs to block search', function () {
      appendDefinition(workspace);
      expect(getWorkspaceProcedures(workspace)).to.deep.include({
        name: 'bookcase',
        params: ['material'],
        hasReturn: false,
        isPrefab: true,
      });
      expect(procedureDefDefaultFields(PREFAB_DEF_TYPE)).to.have.property('NAME');
    });

    it('generates a function that builds into the group and an addPrefab call', function () {
      const definition = appendDefinition(workspace, ['width']);
      const caller = appendCaller(workspace, ['width'], {
        inputs: {
          ARG0: { shadow: { type: 'math_number', fields: { NUM: 2 } } },
          X: { shadow: { type: 'math_number', fields: { NUM: 3 } } },
          ROTATE_Y: { shadow: { type: 'math_number', fields: { NUM: 90 } } },
        },
      });
      javascriptGenerator.init(workspace);
      const defCode = javascriptGenerator.blockToCode(definition);
      const callCode = javascriptGenerator.blockToCode(caller);

      const [, params] = defCode.match(/^async function bookcase\((.*)\)/);
      const groupParam = params.split(', ').at(-1);
      expect(params.split(', ')).to.have.length(3);
      const meshId = JSON.stringify(`bookcase1__${caller.id}`);
      expect(callCode.startsWith(`bookcase1 = await addPrefab(${meshId}, {`)).to.equal(true);
      expect(callCode).to.include('x: 3');
      expect(callCode).to.include('rotationY: 90');
      expect(callCode).to.match(/args: \[2, \{.*\}\],\n/s);
      expect(callCode).to.match(
        /build: async function \((prefab\w*), (args\w*)\) \{\n\s*await bookcase\(\.\.\.\2, \1\);/
      );
      expect(groupParam).to.match(/^prefab/);
    });

    it('declares the add block variable', function () {
      appendDefinition(workspace);
      const start = Blockly.serialization.blocks.append({ type: 'start' }, workspace);
      const caller = appendCaller(workspace, []);
      start.getInput('DO').connection.connect(caller.previousConnection);
      expect(javascriptGenerator.workspaceToCode(workspace)).to.match(/^let .*\bbookcase1\b/m);
    });

    it('parents body meshes to the group parameter', function () {
      const definition = appendDefinition(workspace, [], {
        inputs: {
          STACK: {
            block: {
              type: 'variables_set',
              fields: { VAR: { name: 'n' } },
              inputs: { VALUE: { shadow: { type: 'math_number', fields: { NUM: 1 } } } },
            },
          },
        },
      });
      javascriptGenerator.init(workspace);
      const code = javascriptGenerator.blockToCode(definition);
      expect(code).to.match(/^async function bookcase\(material, prefab\w*\)/);
    });
  });

  describe('addPrefab API @prefabs', function () {
    const created = [];

    afterEach(function () {
      created.splice(0).forEach((name) => flock.disposeMesh(flock.scene.getMeshByName(name)));
    });

    it('keeps the group hidden until it is placed', async function () {
      let enabledDuringBuild = null;
      const name = await flock.addPrefab('shelfA__prefabblock1', {
        x: 4,
        y: 0,
        z: -2,
        rotationY: 90,
        build: async (group) => {
          const box = flock.createBox('shelfPart__inner1', { width: 1, height: 1, depth: 1 });
          await flock.setParent(group, box);
          enabledDuringBuild = flock.scene.getMeshByName(group).isEnabled();
        },
      });
      created.push(name);
      const group = flock.scene.getMeshByName(name);

      expect(enabledDuringBuild).to.equal(false);
      expect(group.isEnabled()).to.equal(true);
      expect(group.metadata.isPrefab).to.equal(true);
      expect(group.metadata.blockKey).to.equal('prefabblock1');
      expect(group.getChildMeshes()).to.have.length(1);
      expect(group.position.x).to.be.closeTo(4, 0.01);
      expect(group.position.z).to.be.closeTo(-2, 0.01);
      const bounds = group.getHierarchyBoundingVectors(true);
      expect(bounds.min.y).to.be.closeTo(0, 0.01);
      const yaw = group.rotationQuaternion.toEulerAngles().y;
      expect(flock.BABYLON.Tools.ToDegrees(yaw)).to.be.closeTo(90, 0.5);
    });

    it('tags each use of a shared material separately without changing it', async function () {
      const shared = { color: '#00ff00', materialName: 'none.png', alpha: 1 };
      const name = await flock.addPrefab('shelfC__prefabblock3', {
        args: [shared, shared],
        build: async (group, [shelfMaterial, material]) => {
          const shelf = flock.createBox('partC__inner4', { color: shelfMaterial });
          const frame = flock.createBox('partD__inner5', { color: material });
          await flock.setParent(group, shelf);
          await flock.setParent(group, frame);
        },
      });
      created.push(name);
      const parts = flock.scene.getMeshByName(name).getChildMeshes();
      expect(parts.map((part) => part.metadata.prefabMaterialIndex)).to.deep.equal([0, 1]);
      expect(Object.getOwnPropertyNames(shared)).to.not.include('__prefabSlot');
    });

    it('records which material argument each part was made with', async function () {
      const name = await flock.addPrefab('shelfB__prefabblock2', {
        args: [2, { color: '#00ff00', materialName: 'none.png', alpha: 1 }, '#ff0000'],
        build: async (group, [width, shelfMaterial, material]) => {
          const shelf = flock.createBox('partA__inner2', { width, color: shelfMaterial });
          const frame = flock.createBox('partB__inner3', { color: material });
          await flock.setParent(group, shelf);
          await flock.setParent(group, frame);
        },
      });
      created.push(name);
      const parts = flock.scene.getMeshByName(name).getChildMeshes();
      expect(parts.map((part) => part.metadata.prefabMaterialIndex)).to.deep.equal([1, 2]);
    });
  });
}
