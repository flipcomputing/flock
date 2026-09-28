import { expect } from 'chai';
import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import { blockHandlerRegistry } from '../blocks/blocks.js';
import { defineModelBlocks } from '../blocks/models.js';
import { defineColourBlocks } from '../blocks/colour.js';
import { registerSceneGenerators } from '../generators/generators-scene.js';
import { registerMaterialGenerators } from '../generators/generators-material.js';
import { buildColorsListShadowSpec } from '../ui/blocklyshadowutil.js';
import { objectColours } from '../config.js';
import { updateMeshFromBlock, readColourList } from '../ui/blockmesh.js';

export function runLoadModelTests(flock) {
  describe('load_model colours @loadmodel', function () {
    let ws;

    before(function () {
      if (!Blockly.Blocks['load_model']) defineModelBlocks();
      if (!Blockly.Blocks['colour_picker']) defineColourBlocks();
      registerSceneGenerators(javascriptGenerator);
      registerMaterialGenerators(javascriptGenerator);
    });

    beforeEach(function () {
      ws = new Blockly.Workspace();
    });

    afterEach(function () {
      ws.dispose();
    });

    function makeModelBlock(workspace, modelName = 'lion.glb', extraState) {
      const number = (value) => ({ shadow: { type: 'math_number', fields: { NUM: value } } });
      return Blockly.serialization.blocks.append(
        {
          type: 'load_model',
          fields: { MODELS: modelName },
          ...(extraState ? { extraState } : {}),
          inputs: {
            SCALE: number(1),
            X: number(0),
            Y: number(0),
            Z: number(0),
            COLORS: { shadow: buildColorsListShadowSpec(modelName) },
          },
        },
        workspace
      );
    }

    function colourBlocks(block) {
      const list = block.getInputTargetBlock('COLORS');
      return list.inputList
        .filter((input) => input.name?.startsWith('ADD'))
        .map((input) => input.connection.targetBlock());
    }

    function colours(block) {
      return colourBlocks(block).map((b) => b.getFieldValue('COLOR').toUpperCase());
    }

    function withHeadlessRendering(fn) {
      const proto = Blockly.Block.prototype;
      const hadInitSvg = Object.prototype.hasOwnProperty.call(proto, 'initSvg');
      const hadRender = Object.prototype.hasOwnProperty.call(proto, 'render');
      if (!proto.initSvg) proto.initSvg = function () {};
      if (!proto.render) proto.render = function () {};
      try {
        fn();
      } finally {
        if (!hadInitSvg) delete proto.initSvg;
        if (!hadRender) delete proto.render;
      }
    }

    function dispatch(block, event) {
      blockHandlerRegistry.get(block.id)(event);
    }

    function captureEvents(fn) {
      const events = [];
      const listener = (e) => events.push(e);
      ws.addChangeListener(listener);
      fn();
      return new Promise((resolve) =>
        setTimeout(() => {
          ws.removeChangeListener(listener);
          resolve(events);
        }, 0)
      );
    }

    function generate(block) {
      javascriptGenerator.init(block.workspace);
      return javascriptGenerator.blockToCode(block, true);
    }

    it('starts with the config default colours and colours unedited', function () {
      const block = makeModelBlock(ws);
      expect(colours(block)).to.deep.equal(objectColours['lion.glb']);
      expect(block.colorsEdited).to.equal(false);
    });

    it('omits colors from generated code until a colour is edited', function () {
      const block = makeModelBlock(ws);
      expect(generate(block)).to.not.include('colors:');
    });

    it('marks colours edited when a list colour changes', function () {
      const block = makeModelBlock(ws);
      const colour = colourBlocks(block)[1];
      const old = colour.getFieldValue('COLOR');
      colour.setFieldValue('#123456', 'COLOR');
      dispatch(block, new Blockly.Events.BlockChange(colour, 'field', 'COLOR', old, '#123456'));

      expect(block.colorsEdited).to.equal(true);
      const code = generate(block);
      expect(code).to.include('colors:');
      expect(code).to.include('#123456');
    });

    it('resets colours and the edited flag when the model changes', async function () {
      const block = makeModelBlock(ws);
      block.colorsEdited = true;

      const events = await captureEvents(() =>
        withHeadlessRendering(() => {
          block.setFieldValue('rhino.glb', 'MODELS');
          dispatch(
            block,
            new Blockly.Events.BlockChange(block, 'field', 'MODELS', 'lion.glb', 'rhino.glb')
          );
        })
      );

      expect(block.colorsEdited).to.equal(false);
      expect(colours(block)).to.deep.equal(objectColours['rhino.glb']);

      // The reset's own colour events arrive afterwards and must not count as edits.
      events.filter((e) => e.name !== 'MODELS').forEach((e) => dispatch(block, e));
      expect(block.colorsEdited).to.equal(false);
    });

    it('persists the edited flag through serialization', function () {
      const block = makeModelBlock(ws);
      block.colorsEdited = true;
      const saved = Blockly.serialization.blocks.save(block);

      const ws2 = new Blockly.Workspace();
      try {
        const copy = Blockly.serialization.blocks.append(saved, ws2);
        expect(copy.colorsEdited).to.equal(true);
      } finally {
        ws2.dispose();
      }
    });

    it('marks colours edited when the list changes size', function () {
      const block = makeModelBlock(ws);
      const list = block.getInputTargetBlock('COLORS');
      dispatch(
        block,
        new Blockly.Events.BlockChange(
          list,
          'mutation',
          '',
          '<mutation items="4"></mutation>',
          '<mutation items="5"></mutation>'
        )
      );
      expect(block.colorsEdited).to.equal(true);
    });

    it('keeps colours edited when a custom array survives a model change', function () {
      const block = makeModelBlock(ws);
      const custom = ws.newBlock('lists_repeat');
      block.getInput('COLORS').connection.connect(custom.outputConnection);
      block.colorsEdited = true;

      withHeadlessRendering(() => {
        block.setFieldValue('rhino.glb', 'MODELS');
        dispatch(
          block,
          new Blockly.Events.BlockChange(block, 'field', 'MODELS', 'lion.glb', 'rhino.glb')
        );
      });

      expect(block.getInputTargetBlock('COLORS')).to.equal(custom);
      expect(block.colorsEdited).to.equal(true);
    });

    it('reads colour lists slot by slot, including colour pickers', function () {
      const list = Blockly.serialization.blocks.append(
        {
          type: 'lists_create_with',
          extraState: { itemCount: 3 },
          inputs: {
            ADD1: { block: { type: 'colour', fields: { COLOR: '#123456' } } },
            ADD2: { block: { type: 'colour_picker', fields: { COLOUR: '#abcdef' } } },
          },
        },
        ws
      );

      const read = readColourList(list);
      expect(read).to.have.length(3);
      expect(read[0]).to.equal(null);
      expect(read[1]).to.equal('#123456');
      expect(read[2]).to.equal('#abcdef');
    });

    it('loads blocks saved before the flag existed as unedited', function () {
      const block = makeModelBlock(ws, 'lion.glb', '<mutation has_do="false"></mutation>');
      expect(block.colorsEdited).to.equal(false);
    });
  });

  describe('load_model live model change @loadmodel @slow', function () {
    this.timeout(15000);

    let ws;
    let previousMain;

    before(function () {
      if (!Blockly.Blocks['load_model']) defineModelBlocks();
      previousMain = Blockly.getMainWorkspace();
      ws = new Blockly.Workspace();
      Blockly.common.setMainWorkspace(ws);
    });

    after(function () {
      if (previousMain) Blockly.common.setMainWorkspace(previousMain);
      ws.dispose();
    });

    const ready = (id) => new Promise((resolve) => flock.whenModelReady(id, resolve));

    async function pollUntil(predicate, timeout = 8000) {
      const start = Date.now();
      while (!predicate() && Date.now() - start < timeout) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return predicate();
    }

    const partNames = (mesh) =>
      flock
        .getColorSlots(mesh)
        .map(({ mesh: part }) => part.name)
        .sort();

    const slots = (mesh) =>
      Object.fromEntries(flock.getColorSlots(mesh).map((slot) => [slot.mesh.name, slot.index]));

    const baseY = (mesh) => {
      const parts = flock.getColorSlots(mesh).map((slot) => slot.mesh);
      parts.forEach((part) => part.computeWorldMatrix(true));
      return Math.min(...parts.map((part) => part.getBoundingInfo().boundingBox.minimumWorld.y));
    };

    it('swaps in the new model without nesting a second wrapper', async function () {
      const referenceId = flock.createModel({ modelName: 'Flock.glb', modelId: 'flockref' });
      const reference = await ready(referenceId);
      const expectedSlots = slots(reference);
      flock.dispose(referenceId);

      const block = Blockly.serialization.blocks.append(
        { type: 'load_model', fields: { MODELS: 'rhino.glb' } },
        ws
      );
      const meshId = flock.createModel({
        modelName: 'rhino.glb',
        modelId: `rhino.glb__${block.id}`,
        position: { x: 3, y: 0, z: -2 },
      });
      const mesh = await ready(meshId);
      const oldBase = baseY(mesh);

      try {
        block.getField('MODELS').setValue('Flock.glb');
        updateMeshFromBlock(
          [mesh],
          block,
          new Blockly.Events.BlockChange(block, 'field', 'MODELS', 'rhino.glb', 'Flock.glb')
        );

        await pollUntil(() => partNames(mesh).includes('Left_Wing'));
        await new Promise((resolve) => setTimeout(resolve, 300));

        expect(slots(mesh)).to.deep.equal(expectedSlots);
        expect(mesh.getChildren().map((child) => child.name)).to.deep.equal(['__root__']);
        expect(mesh.metadata.modelName).to.equal('Flock.glb');
        expect(flock.scene.meshes.some((m) => m.name.includes('__temp__'))).to.equal(false);
        expect(baseY(mesh)).to.be.closeTo(oldBase, 0.01);
      } finally {
        flock.dispose(meshId);
      }
    });
  });
}
