import { expect } from 'chai';
import * as Blockly from 'blockly';
import { addMetadata } from 'meta-png';
import { importSnippetFile, loadExample, newProject } from '../main/files.js';
import { translate } from '../main/translation.js';
import { isProjectLoading, setProjectLoading } from '../main/projectLoading.js';

// A 1x1 PNG with no Flock metadata, like a picture a child might drop in.
const PLAIN_PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  ),
  (c) => c.charCodeAt(0)
);
const SNIPPET = { type: 'text', fields: { TEXT: 'imported' } };

export function runFilesImportErrorTests() {
  describe('main/files import errors', function () {
    let originalAlert;
    let alerts;
    let topBlocksBefore;
    let container;
    let injected;

    // Snippets land at the main workspace's viewport, so this needs a rendered one.
    before(function () {
      if (Blockly.getMainWorkspace()) return;
      container = document.createElement('div');
      container.style.cssText = 'position:absolute;left:-10000px;width:600px;height:400px';
      document.body.appendChild(container);
      injected = Blockly.inject(container, {});
    });

    after(function () {
      if (!injected) return;
      injected.dispose();
      container.remove();
    });

    beforeEach(function () {
      originalAlert = window.alert;
      alerts = [];
      window.alert = (message) => alerts.push(message);
      topBlocksBefore = new Set(
        Blockly.getMainWorkspace()
          .getTopBlocks(false)
          .map((b) => b.id)
      );
    });

    afterEach(function () {
      window.alert = originalAlert;
      for (const block of Blockly.getMainWorkspace().getTopBlocks(false)) {
        if (!topBlocksBefore.has(block.id)) block.dispose();
      }
    });

    const added = () =>
      Blockly.getMainWorkspace()
        .getTopBlocks(false)
        .filter((block) => !topBlocksBefore.has(block.id));

    describe('snippets', function () {
      it('imports a valid snippet without an alert', async function () {
        await importSnippetFile(new File([JSON.stringify(SNIPPET)], 'snippet.fsnip'));
        expect(alerts).to.have.length(0);
        expect(added()).to.have.length(1);
      });

      it('imports blocks saved inside a picture', async function () {
        const png = addMetadata(
          PLAIN_PNG,
          'blockJson',
          encodeURIComponent(JSON.stringify(SNIPPET))
        );
        await importSnippetFile(new File([png], 'blocks.png', { type: 'image/png' }));
        expect(alerts).to.have.length(0);
        expect(added()).to.have.length(1);
      });

      it('says when a picture has no blocks in it', async function () {
        await importSnippetFile(new File([PLAIN_PNG], 'photo.png', { type: 'image/png' }));
        expect(alerts).to.deep.equal([translate('snippet_png_no_blocks_alert')]);
      });

      it('says when a file is too large', async function () {
        const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.fsnip');
        await importSnippetFile(big);
        expect(alerts).to.deep.equal([translate('snippet_too_large_alert')]);
      });

      it('says when a file is not valid JSON', async function () {
        await importSnippetFile(new File(['{not json'], 'broken.fsnip'));
        expect(alerts).to.deep.equal([translate('invalid_snippet_alert')]);
        expect(added()).to.have.length(0);
      });

      describe('set position from before the y checkbox was removed', function () {
        const moveSnippet = (useY) => ({
          type: 'move_to_xyz',
          fields: { MODEL: { id: 'legacyUseYVar', name: 'legacyUseYBox' }, USE_Y: useY },
          inputs: {
            X: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
            Y: { shadow: { type: 'math_number', fields: { NUM: 5 } } },
            Z: { shadow: { type: 'math_number', fields: { NUM: 2 } } },
          },
        });

        afterEach(function () {
          const variable = Blockly.getMainWorkspace().getVariableById('legacyUseYVar');
          if (variable) Blockly.getMainWorkspace().deleteVariableById(variable.getId());
        });

        it('keeps the height of an unticked block by reading its own y', async function () {
          await importSnippetFile(new File([JSON.stringify(moveSnippet(false))], 'move.fsnip'));
          const [move] = added();
          const y = move.getInputTargetBlock('Y');
          expect(y.type).to.equal('get_property');
          expect(y.getFieldValue('PROPERTY')).to.equal('POSITION_Y');
          expect(y.getFieldValue('MESH')).to.equal(move.getFieldValue('MODEL'));
        });

        it('keeps the y value of a ticked block', async function () {
          await importSnippetFile(new File([JSON.stringify(moveSnippet(true))], 'move.fsnip'));
          const [move] = added();
          const y = move.getInputTargetBlock('Y');
          expect(y.type).to.equal('math_number');
          expect(y.getFieldValue('NUM')).to.equal(5);
        });

        const moveToSnippet = (useY) => ({
          type: 'move_to',
          fields: {
            MODEL1: { id: 'legacyUseYVar', name: 'legacyUseYBox' },
            MODEL2: { id: 'legacyUseYTarget', name: 'legacyUseYTree' },
            USE_Y: useY,
          },
        });

        afterEach(function () {
          const variable = Blockly.getMainWorkspace().getVariableById('legacyUseYTarget');
          if (variable) Blockly.getMainWorkspace().deleteVariableById(variable.getId());
        });

        it('moves an unticked block to the other object at its own height', async function () {
          await importSnippetFile(new File([JSON.stringify(moveToSnippet(false))], 'move.fsnip'));
          const [move] = added();
          expect(move.type).to.equal('move_to_xyz');
          const read = (axis) => {
            const input = move.getInputTargetBlock(axis);
            return [input.getField('MESH').getText(), input.getFieldValue('PROPERTY')];
          };
          expect(read('X')).to.deep.equal(['legacyUseYTree', 'POSITION_X']);
          expect(read('Y')).to.deep.equal(['legacyUseYBox', 'POSITION_Y']);
          expect(read('Z')).to.deep.equal(['legacyUseYTree', 'POSITION_Z']);
        });

        it('keeps a ticked block moving to the other object', async function () {
          await importSnippetFile(new File([JSON.stringify(moveToSnippet(true))], 'move.fsnip'));
          const [move] = added();
          expect(move.type).to.equal('move_to');
          expect(move.getField('MODEL2').getText()).to.equal('legacyUseYTree');
          for (const name of ['X_OFFSET', 'Y_OFFSET', 'Z_OFFSET']) {
            expect(move.getInputTargetBlock(name).getFieldValue('NUM')).to.equal(0);
          }
        });

        for (const [position, side] of [
          ['TOP', 'PLACE_ON_TOP'],
          ['CENTER', 'PLACE_CENTER'],
          ['BOTTOM', 'PLACE_AT'],
        ]) {
          it(`turns an old follow ${position} into ${side}`, async function () {
            const snippet = {
              type: 'follow',
              fields: {
                FOLLOWER_MESH: { id: 'legacyUseYVar', name: 'legacyUseYBox' },
                TARGET_MESH: { id: 'legacyUseYTarget', name: 'legacyUseYTree' },
                FOLLOW_POSITION: position,
              },
            };
            await importSnippetFile(new File([JSON.stringify(snippet)], 'follow.fsnip'));
            const [follow] = added();
            expect(follow.getFieldValue('SIDE')).to.equal(side);
          });
        }
      });

      it('says when a file is not a snippet type', async function () {
        await importSnippetFile(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
        expect(alerts).to.deep.equal([translate('invalid_snippet_alert')]);
      });
    });

    describe('examples and new project', function () {
      const originalFetch = window.fetch;
      let projectName;
      let savedName;

      beforeEach(function () {
        window.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
        projectName = document.getElementById('projectName');
        savedName = projectName?.value;
      });

      afterEach(function () {
        window.fetch = originalFetch;
        if (projectName) projectName.value = savedName;
        setProjectLoading(false);
      });

      it('says when an example cannot be opened, and keeps the project name', async function () {
        await loadExample('examples/missing.flock', 'Missing example', () => {});
        expect(alerts).to.deep.equal([translate('example_load_failed_alert')]);
        expect(isProjectLoading()).to.equal(false);
        if (projectName) expect(projectName.value).to.equal(savedName);
      });

      it('says when a new project cannot be opened, and keeps the project name', async function () {
        await newProject();
        expect(alerts).to.deep.equal([translate('example_load_failed_alert')]);
        if (projectName) expect(projectName.value).to.equal(savedName);
      });
    });
  });
}
