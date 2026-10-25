import { expect } from 'chai';
import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import { initializeIfClauseConnectionChecker } from '../main/blocklyinit.js';
import { defineControlBlocks } from '../blocks/control.js';
import { defineTextBlocks } from '../blocks/text.js';
import { registerConditionGenerators } from '../generators/generators-condition.js';

export function runIfClauseTests() {
  describe('if clause @ifclause', function () {
    let workspace;
    let container;

    const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

    function mk(type) {
      const block = workspace.newBlock(type);
      block.initSvg();
      block.render();
      return block;
    }

    function bool(value) {
      const block = mk('logic_boolean');
      block.setFieldValue(value ? 'TRUE' : 'FALSE', 'BOOL');
      return block;
    }

    function clause(mode, cond) {
      const block = mk('if_clause');
      if (mode !== 'IF') block.setFieldValue(mode, 'MODE');
      if (cond !== undefined) block.getInput('COND').connection.connect(bool(cond).outputConnection);
      return block;
    }

    function chain(...blocks) {
      for (let i = 1; i < blocks.length; i++) {
        blocks[i - 1].nextConnection.connect(blocks[i].previousConnection);
      }
      return blocks[0];
    }

    function nest(parent, child, input = 'DO') {
      parent.getInput(input).connection.connect(child.previousConnection);
      return child;
    }

    const hasReason = (block, reason) => block.getDisabledReasons().has(reason);
    const invalidStack = (block) => hasReason(block, 'INVALID_IF_STACK');
    const invalidPosition = (block) => hasReason(block, 'INVALID_IF_CLAUSE_POSITION');

    before(function () {
      defineControlBlocks();
      if (!Blockly.Blocks['print_text']) defineTextBlocks();
      registerConditionGenerators(javascriptGenerator);
    });

    beforeEach(async function () {
      container = document.createElement('div');
      container.style.width = '600px';
      container.style.height = '400px';
      document.body.appendChild(container);
      workspace = Blockly.inject(container, {});
      initializeIfClauseConnectionChecker(workspace);
      await settle();
    });

    afterEach(function () {
      workspace?.dispose();
      container?.remove();
    });

    describe('chain validity', function () {
      it('enables IF, ELSE IF and ELSE in order', async function () {
        const ifBlock = clause('IF', true);
        const elseIf = clause('ELSEIF', false);
        const elseBlock = clause('ELSE');
        chain(ifBlock, elseIf, elseBlock);
        await settle();

        expect(ifBlock.isEnabled()).to.be.true;
        expect(elseIf.isEnabled()).to.be.true;
        expect(elseBlock.isEnabled()).to.be.true;
      });

      it('disables a loose ELSE IF', async function () {
        const elseIf = clause('ELSEIF', true);
        await settle();

        expect(invalidStack(elseIf)).to.be.true;
      });

      it('disables an ELSE IF that follows an ELSE', async function () {
        const ifBlock = clause('IF', true);
        const elseBlock = clause('ELSE');
        const elseIf = clause('ELSEIF', true);
        chain(ifBlock, elseBlock, elseIf);
        await settle();

        expect(elseBlock.isEnabled()).to.be.true;
        expect(invalidStack(elseIf)).to.be.true;
      });

      it('re-enables an ELSE IF once it is attached after an IF', async function () {
        const ifBlock = clause('IF', true);
        const elseIf = clause('ELSEIF', true);
        await settle();
        expect(invalidStack(elseIf)).to.be.true;

        ifBlock.nextConnection.connect(elseIf.previousConnection);
        await settle();

        expect(elseIf.isEnabled()).to.be.true;
      });

      it('re-enables an ELSE IF reattached after an IF nested first inside another IF', async function () {
        const outer = clause('IF', true);
        const inner = nest(outer, clause('IF', true));
        const elseIf = clause('ELSEIF', true);
        chain(outer, elseIf);
        await settle();
        expect(elseIf.isEnabled()).to.be.true;

        elseIf.unplug(true);
        await settle();
        expect(invalidStack(elseIf)).to.be.true;

        inner.nextConnection.connect(elseIf.previousConnection);
        await settle();

        expect(elseIf.getPreviousBlock()).to.equal(inner);
        expect(elseIf.isEnabled()).to.be.true;
      });

      it('re-enables an ELSE reattached three levels deep', async function () {
        const outer = clause('IF', true);
        const middle = nest(outer, clause('IF', true));
        nest(middle, clause('IF', true));
        const elseBlock = clause('ELSE');
        chain(elseBlock, mk('print_text'));
        chain(outer, elseBlock);
        await settle();

        elseBlock.unplug(true);
        await settle();
        expect(invalidStack(elseBlock)).to.be.true;

        middle.nextConnection.connect(elseBlock.previousConnection);
        await settle();

        expect(elseBlock.isEnabled()).to.be.true;
      });

      it('re-enables an ELSE IF reattached after an IF nested inside an ELSE', async function () {
        const ifBlock = clause('IF', true);
        const elseBlock = clause('ELSE');
        chain(ifBlock, elseBlock);
        const inner = nest(elseBlock, clause('IF', true));
        const elseIf = clause('ELSEIF', true);
        await settle();
        expect(invalidStack(elseIf)).to.be.true;

        inner.nextConnection.connect(elseIf.previousConnection);
        await settle();

        expect(elseIf.isEnabled()).to.be.true;
      });

      it('disables an ELSE placed first inside an IF', async function () {
        const ifBlock = clause('IF', true);
        const elseBlock = nest(ifBlock, clause('ELSE'));
        await settle();

        expect(ifBlock.isEnabled()).to.be.true;
        expect(invalidStack(elseBlock)).to.be.true;
      });

      it('disables the rest of the chain when the head is switched to ELSE', async function () {
        const head = clause('IF', true);
        const elseIf = clause('ELSEIF', false);
        chain(head, elseIf);
        await settle();

        head.setFieldValue('ELSE', 'MODE');
        await settle();

        expect(invalidStack(head)).to.be.true;
        expect(invalidStack(elseIf)).to.be.true;
      });

      it('disables an ELSE IF that follows a non-clause block', async function () {
        const print = mk('print_text');
        const elseIf = clause('ELSEIF', true);
        chain(print, elseIf);
        await settle();

        expect(invalidPosition(elseIf)).to.be.true;
      });
    });

    describe('mode switching', function () {
      it('hides the condition for ELSE and restores it when switched back', async function () {
        const ifBlock = clause('IF', true);
        const elseIf = clause('ELSEIF', false);
        chain(ifBlock, elseIf);
        await settle();

        elseIf.setFieldValue('ELSE', 'MODE');
        await settle();
        expect(elseIf.getInput('COND').isVisible()).to.be.false;
        expect(elseIf.getInputTargetBlock('COND')).to.be.null;

        elseIf.setFieldValue('ELSEIF', 'MODE');
        await settle();
        const restored = elseIf.getInputTargetBlock('COND');
        expect(elseIf.getInput('COND').isVisible()).to.be.true;
        expect(restored?.type).to.equal('logic_boolean');
        expect(restored.getFieldValue('BOOL')).to.equal('FALSE');
      });

      it('keeps the condition in saved state while the clause is an ELSE', async function () {
        const ifBlock = clause('IF', true);
        const elseIf = clause('ELSEIF', false);
        chain(ifBlock, elseIf);
        await settle();

        elseIf.setFieldValue('ELSE', 'MODE');
        const state = elseIf.saveExtraState();

        expect(state.mode).to.equal('ELSE');
        expect(state.stashedCondState?.type).to.equal('logic_boolean');
      });
    });

    describe('connection checker', function () {
      const checker = () => workspace.connectionChecker;

      it('lets an IF go inside an IF', function () {
        const outer = clause('IF', true);
        const inner = clause('IF', true);

        expect(checker().canConnect(inner.previousConnection, outer.getInput('DO').connection, false)).to
          .be.true;
      });

      for (const mode of ['ELSEIF', 'ELSE']) {
        it(`refuses ${mode} inside an IF`, function () {
          const outer = clause('IF', true);
          const inner = clause(mode);

          expect(checker().canConnect(inner.previousConnection, outer.getInput('DO').connection, false))
            .to.be.false;
        });
      }

      it('lets an ELSE IF go after an IF nested first inside another IF', function () {
        const outer = clause('IF', true);
        const inner = nest(outer, clause('IF', true));
        const elseIf = clause('ELSEIF', true);

        expect(checker().canConnect(elseIf.previousConnection, inner.nextConnection, false)).to.be.true;
      });

      it('refuses an ELSE that has clauses below it', function () {
        const ifBlock = clause('IF', true);
        const elseBlock = clause('ELSE');
        chain(elseBlock, clause('ELSEIF', true));

        expect(checker().canConnect(elseBlock.previousConnection, ifBlock.nextConnection, false)).to.be
          .false;
      });

      it('refuses a non-clause block between an IF and its ELSE IF', function () {
        const ifBlock = clause('IF', true);
        chain(ifBlock, clause('ELSEIF', true));
        const print = mk('print_text');

        expect(checker().canConnect(print.previousConnection, ifBlock.nextConnection, false)).to.be.false;
      });

      it('lets a non-clause block go after the last clause', function () {
        const ifBlock = clause('IF', true);
        const elseBlock = clause('ELSE');
        chain(ifBlock, elseBlock);
        const print = mk('print_text');

        expect(checker().canConnect(print.previousConnection, elseBlock.nextConnection, false)).to.be.true;
      });

      describe('while dragging', function () {
        beforeEach(function () {
          workspace.isDragging = () => true;
        });

        it('refuses an ELSE IF after a non-clause block', function () {
          const print = mk('print_text');
          const elseIf = clause('ELSEIF', true);

          expect(checker().canConnect(elseIf.previousConnection, print.nextConnection, false)).to.be.false;
        });

        it('refuses a clause after an ELSE', function () {
          const ifBlock = clause('IF', true);
          const elseBlock = clause('ELSE');
          chain(ifBlock, elseBlock);
          const elseIf = clause('ELSEIF', true);

          expect(checker().canConnect(elseIf.previousConnection, elseBlock.nextConnection, false)).to.be
            .false;
        });

        it('refuses an ELSE in the middle of a chain', function () {
          const ifBlock = clause('IF', true);
          chain(ifBlock, clause('ELSEIF', true));
          const elseBlock = clause('ELSE');

          expect(checker().canConnect(elseBlock.previousConnection, ifBlock.nextConnection, false)).to.be
            .false;
        });
      });
    });

    describe('code generation', function () {
      function generate(block) {
        javascriptGenerator.init(workspace);
        return javascriptGenerator.blockToCode(block, true);
      }

      it('generates if / else if / else from one chain', async function () {
        const ifBlock = clause('IF', true);
        chain(ifBlock, clause('ELSEIF', false), clause('ELSE'));
        await settle();

        const code = generate(ifBlock).replace(/\s+/g, ' ').trim();

        expect(code).to.equal('if (true) { } else if (false) { } else { }');
      });

      it('emits nothing for ELSE IF and ELSE on their own', async function () {
        const ifBlock = clause('IF', true);
        const elseIf = clause('ELSEIF', false);
        const elseBlock = clause('ELSE');
        chain(ifBlock, elseIf, elseBlock);
        await settle();

        expect(generate(elseIf)).to.equal('');
        expect(generate(elseBlock)).to.equal('');
      });

      it('stops the chain at the next IF', async function () {
        const first = clause('IF', true);
        chain(first, clause('ELSE'), clause('IF', false));
        await settle();

        const code = generate(first).replace(/\s+/g, ' ').trim();

        expect(code).to.equal('if (true) { } else { }');
      });
    });
  });
}
