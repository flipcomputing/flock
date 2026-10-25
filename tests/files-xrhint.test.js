import { expect } from 'chai';
import { hintIfXrModeMissing } from '../main/files.js';
import { clearStatus } from '../ui/status.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeWorkspace(xrModeBlockCount) {
  const ws = {
    xrModeBlockCount,
    getBlocksByType(type) {
      return type === 'set_xr_mode' ? new Array(ws.xrModeBlockCount).fill({}) : [];
    },
  };
  return ws;
}

export function runFilesXrHintTests(flock) {
  describe('main/files XR mode hint', function () {
    let element;
    let savedAutoAllowed;
    let savedHeadsetAvailable;

    beforeEach(function () {
      element = document.createElement('p');
      element.id = 'gizmoStatus';
      document.body.appendChild(element);

      savedAutoAllowed = flock._xrAutoButtonAllowed;
      savedHeadsetAvailable = flock._vrHeadsetAvailable;
      flock._xrAutoButtonAllowed = () => false;
      flock._vrHeadsetAvailable = async () => true;
    });

    afterEach(function () {
      clearStatus();
      element.remove();
      flock._xrAutoButtonAllowed = savedAutoAllowed;
      flock._vrHeadsetAvailable = savedHeadsetAvailable;
    });

    it('prompts for the block on a headset when the project has none', async function () {
      hintIfXrModeMissing(fakeWorkspace(0));
      await tick();
      expect(element.textContent).to.contain('Scene > XR');
    });

    it('stays quiet when the project already has an XR mode block', async function () {
      hintIfXrModeMissing(fakeWorkspace(1));
      await tick();
      expect(element.textContent).to.equal('');
    });

    it('stays quiet when there is no headset', async function () {
      flock._vrHeadsetAvailable = async () => false;
      hintIfXrModeMissing(fakeWorkspace(0));
      await tick();
      expect(element.textContent).to.equal('');
    });

    it('stays quiet on the dev host, where the enter-VR button appears anyway', async function () {
      flock._xrAutoButtonAllowed = () => true;
      hintIfXrModeMissing(fakeWorkspace(0));
      await tick();
      expect(element.textContent).to.equal('');
    });

    it('stays quiet when a block is added before the headset check settles', async function () {
      let settle;
      flock._vrHeadsetAvailable = () => new Promise((resolve) => (settle = resolve));

      const workspace = fakeWorkspace(0);
      hintIfXrModeMissing(workspace);

      workspace.xrModeBlockCount = 1;
      settle(true);
      await tick();

      expect(element.textContent).to.equal('');
    });
  });
}
