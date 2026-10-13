import { expect } from 'chai';
import * as Blockly from 'blockly';
import { addMetadata } from 'meta-png';
import { importSnippetFile, loadExample, newProject } from '../main/files.js';
import { translate } from '../main/translation.js';

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
      topBlocksBefore = new Set(Blockly.getMainWorkspace().getTopBlocks(false).map((b) => b.id));
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
        window.loadingCode = false;
      });

      it('says when an example cannot be opened, and keeps the project name', async function () {
        await loadExample('examples/missing.flock', 'Missing example', () => {});
        expect(alerts).to.deep.equal([translate('example_load_failed_alert')]);
        expect(window.loadingCode).to.equal(false);
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
