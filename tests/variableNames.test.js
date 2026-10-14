import { expect } from 'chai';
import * as Blockly from 'blockly';
import { handleBlockCreateEvent } from '../blocks/blocks.js';
import {
  handleRecentObjectEvent,
  lowestFreeName,
  nextVariableName,
  objectAndCharacterTarget,
  otherObjectName,
  rememberObjectBlock,
} from '../blocks/variableNames.js';
import { separateNestedLoopVariables } from '../blocks/control.js';
import { defineShapeBlocks } from '../blocks/shapes.js';
import { defineModelBlocks } from '../blocks/models.js';
import { defineSceneBlocks } from '../blocks/scene.js';
import { defineModifyBlocks } from '../blocks/modify.js';
import { defineSensingBlocks } from '../blocks/sensing.js';
import { defineConnectBlocks } from '../blocks/connect.js';
import { highlightBlockById } from '../ui/blocklyutil.js';

export function runVariableNamesTests() {
  describe('Variable naming @variablenames', function () {
    let workspace;

    const append = (state) => Blockly.serialization.blocks.append(state, workspace);
    const varText = (block, field = 'ID_VAR') => block.getField(field).getText();
    const varId = (block, field = 'ID_VAR') => block.getFieldValue(field);
    const varsOn = (block) =>
      Object.fromEntries(
        block.inputList
          .flatMap((input) => input.fieldRow)
          .filter((field) => field instanceof Blockly.FieldVariable)
          .map((field) => [field.name, field.getText()])
      );
    const resetRecent = (ws = workspace) =>
      handleRecentObjectEvent({ type: Blockly.Events.FINISHED_LOADING, workspaceId: ws.id });

    before(function () {
      if (!Blockly.Blocks['create_box']) defineShapeBlocks();
      if (!Blockly.Blocks['load_character']) defineModelBlocks();
      if (!Blockly.Blocks['clone_mesh']) defineSceneBlocks();
      if (!Blockly.Blocks['merge_meshes']) defineModifyBlocks();
      if (!Blockly.Blocks['meshes_touching']) defineSensingBlocks();
      if (!Blockly.Blocks['attach']) defineConnectBlocks();
    });

    beforeEach(function () {
      workspace = new Blockly.Workspace();
      window.loadingCode = false;
      resetRecent();
    });

    afterEach(function () {
      resetRecent();
      workspace.dispose();
      delete window.loadingCode;
    });

    describe('default names', function () {
      it('uses the lowest unused suffix', function () {
        workspace.getVariableMap().createVariable('box1', '');
        workspace.getVariableMap().createVariable('box3', '');

        expect(lowestFreeName(workspace, 'box')).to.equal('box2');
      });

      it('compares names case-insensitively', function () {
        workspace.getVariableMap().createVariable('Box1', '');

        expect(lowestFreeName(workspace, 'box')).to.equal('box2');
      });

      it('can start from a given suffix', function () {
        expect(lowestFreeName(workspace, 'star', 4)).to.equal('star4');
      });

      it("reads a flyout block's names from its target workspace", function () {
        workspace.getVariableMap().createVariable('box1', '');
        const flyoutBlock = { workspace: { targetWorkspace: workspace } };

        expect(nextVariableName(flyoutBlock, 'box')).to.equal('box2');
      });

      it('gives each new creator block the next free name', function () {
        const first = append({ type: 'create_box' });
        const second = append({ type: 'create_box' });

        expect([varText(first), varText(second)]).to.deep.equal(['box1', 'box2']);
      });

      it('fills a gap left in the numbering', function () {
        workspace.getVariableMap().createVariable('box1', '');
        workspace.getVariableMap().createVariable('box3', '');

        expect(varText(append({ type: 'create_box' }))).to.equal('box2');
      });

      it('names blocks whose name field is not ID_VAR', function () {
        expect(varText(append({ type: 'clone_mesh' }), 'CLONE_VAR')).to.equal('clone1');
        expect(varText(append({ type: 'merge_meshes' }), 'RESULT_VAR')).to.equal('merged1');
      });
    });

    describe('duplicates', function () {
      const created = (block) => ({
        type: Blockly.Events.BLOCK_CREATE,
        blockId: block.id,
        ids: [block.id],
        recordUndo: true,
      });

      const duplicate = (source, prefix, field = 'ID_VAR') => {
        const copy = append({
          type: source.type,
          fields: { [field]: { id: varId(source, field) } },
        });
        handleBlockCreateEvent(copy, created(copy), prefix, field);
        return copy;
      };

      it('gives a copied block a fresh name', function () {
        const box1 = append({ type: 'create_box' });

        expect(varText(duplicate(box1, 'box'))).to.equal('box2');
      });

      it('counts on from the copied name', function () {
        const box1 = append({ type: 'create_box' });
        append({ type: 'create_box' });
        const box3 = duplicate(box1, 'box');

        expect(varText(duplicate(box3, 'box'))).to.equal('box4');
      });

      it('keeps a renamed base name when copying', function () {
        const box = append({ type: 'create_box' });
        workspace.renameVariableById(varId(box), 'tower');

        expect(varText(duplicate(box, 'box'))).to.equal('tower1');
      });

      it('gives copied clone blocks a fresh name', function () {
        const clone1 = append({ type: 'clone_mesh' });

        expect(varText(duplicate(clone1, 'clone', 'CLONE_VAR'), 'CLONE_VAR')).to.equal('clone2');
      });

      it('gives copied merge blocks a fresh name', function () {
        const merged1 = append({ type: 'merge_meshes' });

        expect(varText(duplicate(merged1, 'merged', 'RESULT_VAR'), 'RESULT_VAR')).to.equal(
          'merged2'
        );
      });

      it('leaves a block alone when nothing else uses its name', function () {
        const box = append({ type: 'create_box' });
        workspace.renameVariableById(varId(box), 'tower');

        handleBlockCreateEvent(box, created(box), 'box');

        expect(varText(box)).to.equal('tower');
      });

      it('does not rename while a project is loading', function () {
        const box1 = append({ type: 'create_box' });
        window.loadingCode = true;

        expect(varText(duplicate(box1, 'box'))).to.equal('box1');
      });

      // The duplicate gizmo connects the copy straight after the original, so the
      // copy's next events already see the original's other uses below it.
      it('leaves blocks added to a copy alone once it is inserted above uses of the original', function () {
        const box1 = append({ type: 'create_box' });
        const show = append({ type: 'show', fields: { MODEL_VAR: { id: varId(box1) } } });
        box1.nextConnection.connect(show.previousConnection);
        const box2 = duplicate(box1, 'box');
        box1.nextConnection.connect(box2.previousConnection);
        const later = { type: Blockly.Events.BLOCK_MOVE, blockId: box2.id, recordUndo: true };
        handleBlockCreateEvent(box2, later, 'box');

        const box9 = workspace.getVariableMap().createVariable('box9', '');
        const read = append({ type: 'variables_get', fields: { VAR: { id: box9.getId() } } });
        box2.getInput('COLOR').connection.connect(read.outputConnection);
        handleBlockCreateEvent(box2, later, 'box');

        expect(box2.getNextBlock()).to.equal(show);
        expect(varText(box2)).to.equal('box2');
        expect(varText(show, 'MODEL_VAR')).to.equal('box1');
        expect(varText(read, 'VAR')).to.equal('box9');
        expect(workspace.getVariableMap().getVariable('box9')).to.not.equal(null);
      });
    });

    describe('recent objects', function () {
      it('falls back to the default names when there are no objects', function () {
        expect(window.currentMesh).to.equal('object');
        expect(otherObjectName('object2')).to.equal('object2');
        expect(objectAndCharacterTarget('object', 'target')).to.deep.equal({
          object: 'object',
          target: 'target',
        });
      });

      it('tracks the newest and previous objects', function () {
        rememberObjectBlock(append({ type: 'create_box' }));
        rememberObjectBlock(append({ type: 'create_box' }));

        expect(window.currentMesh).to.equal('box2');
        expect(otherObjectName('object2')).to.equal('box1');
      });

      it('moves an object to the front when it is used again', function () {
        const box1 = append({ type: 'create_box' });
        rememberObjectBlock(box1);
        rememberObjectBlock(append({ type: 'create_box' }));
        rememberObjectBlock(box1);

        expect(window.currentMesh).to.equal('box1');
        expect(otherObjectName('object2')).to.equal('box2');
      });

      it('remembers objects named in other fields', function () {
        rememberObjectBlock(append({ type: 'clone_mesh' }));
        rememberObjectBlock(append({ type: 'merge_meshes' }));

        expect(window.currentMesh).to.equal('merged1');
        expect(otherObjectName('object2')).to.equal('clone1');
      });

      it('ignores blocks that are not objects', function () {
        rememberObjectBlock(append({ type: 'create_box' }));
        rememberObjectBlock(append({ type: 'math_number' }));
        rememberObjectBlock(append({ type: 'controls_for' }));

        expect(window.currentMesh).to.equal('box1');
      });

      it('remembers a newly created object block', function () {
        const box = append({ type: 'create_box' });

        handleBlockCreateEvent(
          box,
          { type: Blockly.Events.BLOCK_CREATE, blockId: box.id, ids: [box.id], recordUndo: true },
          'box'
        );

        expect(window.currentMesh).to.equal('box1');
      });

      it('remembers a selected object block', function () {
        const box = append({ type: 'create_box' });

        handleRecentObjectEvent({
          type: Blockly.Events.SELECTED,
          workspaceId: workspace.id,
          newElementId: box.id,
        });

        expect(window.currentMesh).to.equal('box1');
      });

      it('remembers an object highlighted from the canvas while the code panel is hidden', function () {
        const box = append({ type: 'create_box' });
        const existingPanel = document.getElementById('codePanel');
        const panel = existingPanel ?? document.body.appendChild(document.createElement('div'));
        const previousId = panel.id;
        const previousDisplay = panel.style.display;
        panel.id = 'codePanel';
        panel.style.display = 'none';
        try {
          highlightBlockById(workspace, box);
        } finally {
          if (existingPanel) {
            panel.style.display = previousDisplay;
          } else {
            panel.id = previousId;
            panel.remove();
          }
        }

        expect(window.currentMesh).to.equal('box1');
      });

      it('forgets a deleted object', function () {
        rememberObjectBlock(append({ type: 'create_box' }));
        const box2 = append({ type: 'create_box' });
        rememberObjectBlock(box2);

        box2.dispose();
        handleRecentObjectEvent({ type: Blockly.Events.BLOCK_DELETE, workspaceId: workspace.id });

        expect(window.currentMesh).to.equal('box1');
        expect(otherObjectName('object2')).to.equal('object2');
      });

      it('follows a renamed object', function () {
        const box = append({ type: 'create_box' });
        rememberObjectBlock(box);

        workspace.renameVariableById(varId(box), 'tower');
        handleRecentObjectEvent({ type: Blockly.Events.VAR_RENAME, workspaceId: workspace.id });

        expect(window.currentMesh).to.equal('tower');
      });

      it('starts from the last objects in a loaded project', function () {
        append({ type: 'create_box', x: 0, y: 0 });
        append({ type: 'load_character', x: 0, y: 100 });
        append({ type: 'create_box', x: 0, y: 200 });

        resetRecent();

        expect(window.currentMesh).to.equal('box2');
        expect(otherObjectName('object2')).to.equal('character1');
      });

      it('clears objects from a previous project on load', function () {
        rememberObjectBlock(append({ type: 'create_box' }));
        const other = new Blockly.Workspace();
        try {
          resetRecent(other);
          expect(window.currentMesh).to.equal('object');
        } finally {
          resetRecent();
          other.dispose();
        }
      });

      describe('character targets', function () {
        it('targets an earlier character from a newer object', function () {
          rememberObjectBlock(append({ type: 'load_character' }));
          rememberObjectBlock(append({ type: 'create_box' }));
          rememberObjectBlock(append({ type: 'create_box' }));

          expect(objectAndCharacterTarget('object', 'target')).to.deep.equal({
            object: 'box2',
            target: 'character1',
          });
        });

        it('targets the newest object when it is a character', function () {
          rememberObjectBlock(append({ type: 'create_box' }));
          rememberObjectBlock(append({ type: 'load_character' }));

          expect(objectAndCharacterTarget('object', 'target')).to.deep.equal({
            object: 'box1',
            target: 'character1',
          });
        });

        it('targets the previous object when there is no character', function () {
          rememberObjectBlock(append({ type: 'create_box' }));
          rememberObjectBlock(append({ type: 'create_box' }));

          expect(objectAndCharacterTarget('object', 'target')).to.deep.equal({
            object: 'box2',
            target: 'box1',
          });
        });

        it('falls back to the default target with only one object', function () {
          rememberObjectBlock(append({ type: 'create_box' }));

          expect(objectAndCharacterTarget('object', 'target')).to.deep.equal({
            object: 'box1',
            target: 'target',
          });
        });
      });

      describe('block defaults', function () {
        beforeEach(function () {
          rememberObjectBlock(append({ type: 'load_character' }));
          rememberObjectBlock(append({ type: 'create_box' }));
          rememberObjectBlock(append({ type: 'create_box' }));
        });

        it('defaults single-object blocks to the newest object', function () {
          expect(varsOn(append({ type: 'drop' }))).to.deep.equal({ MESH_TO_DETACH: 'box2' });
        });

        it('defaults two-object blocks to the newest and previous objects', function () {
          expect(varsOn(append({ type: 'meshes_touching' }))).to.deep.equal({
            MESH1: 'box2',
            MESH2: 'box1',
          });
        });

        it('defaults parent blocks to the newest object as the child', function () {
          expect(varsOn(append({ type: 'parent_child' }))).to.deep.equal({
            PARENT_MESH: 'box1',
            CHILD_MESH: 'box2',
          });
        });

        it('defaults attach, hold and follow to a character target', function () {
          expect(varsOn(append({ type: 'attach' }))).to.deep.equal({
            MESH_TO_ATTACH: 'box2',
            TARGET_MESH: 'character1',
          });
          expect(varsOn(append({ type: 'hold' }))).to.deep.equal({
            TARGET_MESH: 'character1',
            MESH_TO_ATTACH: 'box2',
          });
          expect(varsOn(append({ type: 'follow' }))).to.deep.equal({
            FOLLOWER_MESH: 'box2',
            TARGET_MESH: 'character1',
          });
        });
      });
    });

    describe('loop variables', function () {
      const loop = (type = 'controls_for', name) =>
        append(name ? { type, fields: { VAR: { name } } } : { type });
      const nest = (outer, inner) => {
        outer.getInput('DO').connection.connect(inner.previousConnection);
        separateNestedLoopVariables(moved(inner));
        return inner;
      };
      const moved = (block, overrides = {}) => ({
        type: Blockly.Events.BLOCK_MOVE,
        workspaceId: workspace.id,
        blockId: block.id,
        newParentId: block.getParent()?.id,
        recordUndo: true,
        isUiEvent: false,
        group: '',
        ...overrides,
      });
      const setTo = (name, valueVarId) => {
        const set = append({ type: 'variables_set', fields: { VAR: { name } } });
        const get = append({ type: 'variables_get', fields: { VAR: { id: valueVarId } } });
        set.getInput('VALUE').connection.connect(get.outputConnection);
        return { set, get };
      };
      const loopName = (block) => varText(block, 'VAR');

      it('defaults counting loops to count and list loops to element', function () {
        expect(loopName(loop('controls_for'))).to.equal('count');
        expect(loopName(loop('controls_forEach'))).to.equal('element');
      });

      it('shares one variable between loops', function () {
        expect(varId(loop(), 'VAR')).to.equal(varId(loop(), 'VAR'));
      });

      it('renames a nested loop that repeats the enclosing name', function () {
        const outer = loop();
        const inner = nest(outer, loop());

        expect([loopName(outer), loopName(inner)]).to.deep.equal(['count', 'count2']);
      });

      it('updates the nested loop body to the new name', function () {
        const outer = loop();
        const inner = loop();
        const { set, get } = setTo('total', varId(inner, 'VAR'));
        inner.getInput('DO').connection.connect(set.previousConnection);

        nest(outer, inner);

        expect(varText(get, 'VAR')).to.equal('count2');
      });

      it('numbers each level of nesting', function () {
        const outer = loop();
        const middle = nest(outer, loop());
        const inner = nest(middle, loop());

        expect([outer, middle, inner].map(loopName)).to.deep.equal(['count', 'count2', 'count3']);
      });

      it('shares the renamed variable between nested pairs', function () {
        const first = nest(loop(), loop());
        const second = nest(loop(), loop());

        expect(varId(first, 'VAR')).to.equal(varId(second, 'VAR'));
      });

      it('leaves loops of the other kind alone', function () {
        const outer = loop('controls_for');
        const inner = nest(outer, loop('controls_forEach'));

        expect(loopName(inner)).to.equal('element');
      });

      it('leaves names the user chose alone', function () {
        const outer = loop('controls_for', 'row');
        const inner = nest(outer, loop('controls_for', 'row'));

        expect(loopName(inner)).to.equal('row');
      });

      it('treats names case-insensitively', function () {
        const outer = loop('controls_for', 'Count');
        const inner = nest(outer, loop('controls_for', 'COUNT'));

        expect(loopName(inner).toLowerCase()).to.equal('count2');
      });

      it('skips a name already used by a variable outside loops', function () {
        setTo('count2', varId(append({ type: 'create_box' })));
        const inner = nest(loop(), loop());

        expect(loopName(inner)).to.equal('count3');
      });

      it('reuses a name whose variable no block uses', function () {
        const unused = workspace.getVariableMap().createVariable('count2', '');
        const inner = nest(loop(), loop());

        expect(varId(inner, 'VAR')).to.equal(unused.getId());
      });

      it('reuses a name used only inside loops of that name', function () {
        const otherInner = nest(loop(), loop());
        const { set } = setTo('total', varId(otherInner, 'VAR'));
        otherInner.getInput('DO').connection.connect(set.previousConnection);

        const inner = nest(loop(), loop());

        expect(varId(inner, 'VAR')).to.equal(varId(otherInner, 'VAR'));
      });

      it('keeps loops nested inside the moved loop separate', function () {
        const middle = loop();
        const inner = nest(middle, loop());
        const { set: middleSet, get: middleGet } = setTo('a', varId(middle, 'VAR'));
        const { set: innerSet, get: innerGet } = setTo('b', varId(inner, 'VAR'));
        inner.getInput('DO').connection.connect(middleSet.previousConnection);
        middleSet.nextConnection.connect(innerSet.previousConnection);

        nest(loop(), middle);

        expect([loopName(middle), loopName(inner)]).to.deep.equal(['count3', 'count2']);
        expect(varText(middleGet, 'VAR')).to.equal('count3');
        expect(varText(innerGet, 'VAR')).to.equal('count2');
      });

      it('separates loops inside a moved stack', function () {
        const outer = loop();
        const wrapper = append({ type: 'controls_repeat_ext' });
        const inner = loop();
        wrapper.getInput('DO').connection.connect(inner.previousConnection);
        outer.getInput('DO').connection.connect(wrapper.previousConnection);

        separateNestedLoopVariables(moved(wrapper));

        expect(loopName(inner)).to.equal('count2');
      });

      it('ignores undo, loading, top-level drops and other events', function () {
        const outer = loop();
        const inner = loop();
        outer.getInput('DO').connection.connect(inner.previousConnection);

        separateNestedLoopVariables(moved(inner, { recordUndo: false }));
        separateNestedLoopVariables(moved(inner, { newParentId: undefined }));
        separateNestedLoopVariables(moved(inner, { type: Blockly.Events.BLOCK_CHANGE }));
        window.loadingCode = true;
        separateNestedLoopVariables(moved(inner));

        expect(loopName(inner)).to.equal('count');
      });
    });
  });
}
