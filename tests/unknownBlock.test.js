import { expect } from 'chai';
import * as Blockly from 'blockly';
import {
  defineUnknownBlock,
  replaceUnrecognisedBlocks,
  UNKNOWN_BLOCK_TYPE,
  UNRECOGNISED_BLOCK_REASON,
} from '../blocks/unknownBlock.js';
import { compileFlockProject } from '../flockCompiler.js';

function projectWithUnknownBlocks() {
  return {
    blocks: {
      blocks: [
        {
          type: 'controls_whileUntil',
          id: 'loop',
          x: 10,
          y: 20,
          fields: { MODE: 'WHILE' },
          inputs: {
            BOOL: { block: { type: 'future_value', id: 'fv', fields: { LEVEL: 3 } } },
            DO: {
              block: {
                type: 'future_statement',
                id: 'fs',
                extraState: { count: 2 },
                fields: { NAME: 'spin' },
                inputs: {
                  SPEED: { block: { type: 'math_number', id: 'num', fields: { NUM: 5 } } },
                  STACK: { block: { type: 'text_print', id: 'inner' } },
                },
                next: { block: { type: 'text_print', id: 'after' } },
              },
            },
          },
        },
        { type: 'future_hat', id: 'top', x: 300, y: 20 },
      ],
    },
  };
}

export function runUnknownBlockTests() {
  describe('unrecognised blocks @unknownblock', function () {
    let workspace;

    before(function () {
      if (!Blockly.Blocks[UNKNOWN_BLOCK_TYPE]) defineUnknownBlock();
    });

    beforeEach(function () {
      workspace = new Blockly.Workspace();
    });

    afterEach(function () {
      workspace.dispose();
      delete Blockly.Blocks['future_statement'];
    });

    function load(json) {
      const unrecognised = replaceUnrecognisedBlocks(json);
      Blockly.serialization.workspaces.load(json, workspace);
      return unrecognised;
    }

    it('loads the rest of the project around unknown blocks', function () {
      expect(load(projectWithUnknownBlocks())).to.equal(3);
      for (const id of ['loop', 'fv', 'fs', 'num', 'inner', 'after', 'top']) {
        expect(workspace.getBlockById(id), id).to.exist;
      }
      expect(workspace.getBlockById('fs').getParent().id).to.equal('loop');
      expect(workspace.getBlockById('after').getPreviousBlock().id).to.equal('fs');
      expect(workspace.getBlockById('inner').getParent().id).to.equal('fs');
      expect(workspace.getBlockById('num').getParent().id).to.equal('fs');
    });

    it('matches each placeholder to the connection it sits in', function () {
      load(projectWithUnknownBlocks());
      const value = workspace.getBlockById('fv');
      const statement = workspace.getBlockById('fs');
      expect(value.outputConnection).to.exist;
      expect(value.previousConnection).to.not.exist;
      expect(statement.previousConnection).to.exist;
      expect(statement.outputConnection).to.not.exist;
      expect(statement.getInput('STACK').type).to.equal(Blockly.inputs.inputTypes.STATEMENT);
      expect(statement.getInput('SPEED').type).to.equal(Blockly.inputs.inputTypes.VALUE);
      expect(workspace.getBlockById('top').previousConnection).to.exist;
    });

    it('disables placeholders with a reason the Enable option does not clear', function () {
      load(projectWithUnknownBlocks());
      const block = workspace.getBlockById('fs');
      expect(block.type).to.equal(UNKNOWN_BLOCK_TYPE);
      expect(block.getFieldValue('TYPE_NAME')).to.equal('future_statement');
      block.setDisabledReason(false, Blockly.constants.MANUALLY_DISABLED);
      expect(block.isEnabled()).to.equal(false);
      expect(block.hasDisabledReason(UNRECOGNISED_BLOCK_REASON)).to.equal(true);
      expect(workspace.getBlockById('loop').isEnabled()).to.equal(true);
    });

    it('restores the original block once its type is known', function () {
      load(projectWithUnknownBlocks());
      const saved = Blockly.serialization.workspaces.save(workspace);

      Blockly.Blocks['future_statement'] = {
        init() {
          this.appendValueInput('SPEED');
          this.appendStatementInput('STACK');
          this.setPreviousStatement(true);
          this.setNextStatement(true);
        },
        saveExtraState() {
          return this.state_;
        },
        loadExtraState(state) {
          this.state_ = state;
        },
      };
      expect(replaceUnrecognisedBlocks(saved)).to.equal(2);
      const restored = saved.blocks.blocks[0].inputs.DO.block;
      expect(restored.type).to.equal('future_statement');
      expect(restored.id).to.equal('fs');
      expect(restored.fields).to.deep.equal({ NAME: 'spin' });
      expect(restored.extraState).to.deep.equal({ count: 2 });
      expect(restored.inputs.STACK.block.id).to.equal('inner');
      expect(restored.next.block.id).to.equal('after');
    });

    it('compiles a project containing unknown blocks', async function () {
      const res = await fetch('/examples/alien_planet.flock');
      const json = await res.json();
      json.blocks.blocks.push({ type: 'future_hat', x: 0, y: 0 });
      const code = compileFlockProject(json);
      expect(code).to.include('createCharacter(');
      expect(code).to.not.include('future_hat');
    });
  });
}
