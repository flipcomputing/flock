import { expect } from 'chai';
import * as Blockly from 'blockly';
import { saveWorkspace, exportCode } from '../main/files.js';
import { translate } from '../main/translation.js';
import { AUTOSAVE_KEY } from '../config.js';

export function runFilesSaveErrorTests() {
  describe('main/files save errors', function () {
    let workspace;
    let originalSetItem;
    let originalAlert;
    let alerts;
    let projectNameElement;

    const banners = () => [...document.querySelectorAll('.flock-banner')];

    beforeEach(function () {
      workspace = new Blockly.Workspace();
      Blockly.serialization.blocks.append({ type: 'text', fields: { TEXT: 'hi' } }, workspace);
      // Autosave writes are stubbed throughout: the real key holds the dev server's project.
      originalSetItem = Storage.prototype.setItem;
      stubAutosave(() => {});
      originalAlert = window.alert;
      alerts = [];
      window.alert = (message) => alerts.push(message);
      if (!document.getElementById('projectName')) {
        projectNameElement = document.createElement('input');
        projectNameElement.id = 'projectName';
        document.body.appendChild(projectNameElement);
      }
    });

    afterEach(function () {
      // A successful save resets the module's warning state for whatever runs next.
      stubAutosave(() => {});
      saveWorkspace(workspace);
      Storage.prototype.setItem = originalSetItem;
      window.alert = originalAlert;
      projectNameElement?.remove();
      projectNameElement = null;
      workspace.dispose();
      document.querySelectorAll('.flock-banner').forEach((banner) => banner.remove());
    });

    // Other keys pass through, since page listeners (e.g. on a banner click) also write.
    function stubAutosave(write) {
      Storage.prototype.setItem = function (key, value) {
        return key === AUTOSAVE_KEY ? write() : originalSetItem.call(this, key, value);
      };
    }

    const failStorage = () =>
      stubAutosave(() => {
        throw new DOMException('full', 'QuotaExceededError');
      });

    describe('browser autosave', function () {
      it('warns once when the backup cannot be stored', function () {
        failStorage();
        saveWorkspace(workspace);
        expect(banners()).to.have.length(1);
        expect(banners()[0].textContent).to.contain(translate('error_autosave'));
      });

      it('does not bring back a dismissed warning on the next autosave', function () {
        failStorage();
        saveWorkspace(workspace);
        banners()[0].querySelector('.flock-banner__close').click();
        saveWorkspace(workspace);
        expect(banners()).to.have.length(0);
      });

      it('clears the warning once a backup succeeds again', function () {
        failStorage();
        saveWorkspace(workspace);
        stubAutosave(() => {});
        saveWorkspace(workspace);
        expect(banners()).to.have.length(0);
      });
    });

    describe('save to file', function () {
      const hadPicker = 'showSaveFilePicker' in window;
      let originalPicker;

      beforeEach(function () {
        originalPicker = window.showSaveFilePicker;
      });

      afterEach(function () {
        if (hadPicker) window.showSaveFilePicker = originalPicker;
        else delete window.showSaveFilePicker;
      });

      it('stays quiet when the user cancels the file picker', async function () {
        window.showSaveFilePicker = async () => {
          throw new DOMException('cancelled', 'AbortError');
        };
        expect(await exportCode(workspace)).to.equal(false);
        expect(alerts).to.have.length(0);
      });

      it('tells the user when the write aborts after the file was chosen', async function () {
        window.showSaveFilePicker = async () => ({
          name: 'project.flock',
          createWritable: async () => ({
            write: async () => {
              throw new DOMException('aborted', 'AbortError');
            },
            close: async () => {},
          }),
        });
        expect(await exportCode(workspace)).to.equal(false);
        expect(alerts).to.deep.equal([translate('save_failed_alert')]);
      });

      it('tells the user when the file cannot be written', async function () {
        window.showSaveFilePicker = async () => ({
          name: 'project.flock',
          createWritable: async () => ({
            write: async () => {
              throw new DOMException('disk full', 'QuotaExceededError');
            },
            close: async () => {},
          }),
        });
        expect(await exportCode(workspace)).to.equal(false);
        expect(alerts).to.deep.equal([translate('save_failed_alert')]);
      });
    });
  });
}
