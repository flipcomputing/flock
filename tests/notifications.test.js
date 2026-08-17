import { expect } from 'chai';
import {
  showBanner,
  dismissBanner,
  handleError,
  isBenignAbort,
  isXRAssetFetch,
  reportXRModelUnavailable,
} from '../ui/notifications.js';
import { translate } from '../main/translation.js';

export function runNotificationTests() {
  describe('error notification banners', function () {
    afterEach(function () {
      document.querySelectorAll('.flock-banner').forEach((banner) => banner.remove());
    });

    it('shows a banner with the given message and alert role', function () {
      showBanner('test-show', { message: 'Something went wrong' });
      const banner = document.querySelector('.flock-banner');
      expect(banner).to.exist;
      expect(banner.textContent).to.contain('Something went wrong');
      expect(banner.getAttribute('role')).to.equal('alert');
    });

    it('reuses one banner per id instead of stacking duplicates', function () {
      showBanner('test-dedupe', { message: 'First' });
      showBanner('test-dedupe', { message: 'Second' });
      const banners = document.querySelectorAll('.flock-banner');
      expect(banners.length).to.equal(1);
      expect(banners[0].textContent).to.contain('Second');
    });

    it('dismissBanner removes the banner', function () {
      showBanner('test-dismiss', { message: 'Dismiss me' });
      dismissBanner('test-dismiss');
      expect(document.querySelector('.flock-banner')).to.not.exist;
    });

    it('renders a working action button when an action is supplied', function () {
      let clicked = false;
      showBanner('test-action', {
        message: 'With action',
        action: { label: 'Do it', onClick: () => (clicked = true) },
      });
      const actionButton = document.querySelector('.flock-banner__action');
      expect(actionButton).to.exist;
      expect(actionButton.textContent).to.equal('Do it');
      actionButton.click();
      expect(clicked).to.equal(true);
    });

    it('handleError shows a fatal banner with a reload action', function () {
      handleError(new Error('boom'), { source: 'startup', fatal: true });
      expect(document.querySelector('.flock-banner')).to.exist;
      expect(document.querySelector('.flock-banner__action')).to.exist;
    });

    it('handleError shows a non-fatal banner with no reload action', function () {
      handleError(new Error('boom'), {
        source: 'project-run',
        fatal: false,
      });
      expect(document.querySelector('.flock-banner')).to.exist;
      expect(document.querySelector('.flock-banner__action')).to.not.exist;
    });

    // TEMPORARY (Aug 2026): the banner carries the raw detail so errors can be read on a
    // phone. Restore "never leaks the raw error detail to the banner" when that comes out.
    it('shows the raw error detail on the banner', function () {
      handleError(new Error('SECRET_STACK_DETAIL'), {
        source: 'project-run',
        fatal: false,
      });
      const banner = document.querySelector('.flock-banner');
      expect(banner.textContent).to.contain('SECRET_STACK_DETAIL');
    });

    it('treats AbortError and plain aborts as benign', function () {
      expect(isBenignAbort(new DOMException('Aborted', 'AbortError'))).to.equal(true);
      expect(isBenignAbort(new Error('The operation was aborted'))).to.equal(true);
    });

    it('does not treat a physics WASM out-of-memory abort as benign', function () {
      const wasmError = new WebAssembly.RuntimeError('abort: out of memory');
      expect(isBenignAbort(wasmError)).to.equal(false);
    });

    it('does not treat ordinary errors as benign', function () {
      expect(isBenignAbort(new Error('something else broke'))).to.equal(false);
    });

    it('treats a failed XR model fetch as an asset fetch, however it is reported', function () {
      expect(
        isXRAssetFetch(
          'Unable to load from https://immersive-web.github.io/webxr-input-profiles/packages/viewer/dist/profiles/meta-quest-touch-plus/left.glb'
        )
      ).to.equal(true);
      expect(
        isXRAssetFetch(
          new Error(
            'Unable to load from https://assets.babylonjs.com/core/HandMeshes/r_hand_rhs.glb'
          )
        )
      ).to.equal(true);
      expect(
        isXRAssetFetch({
          request: { responseURL: 'https://controllers.babylonjs.com/oculus/left.glb' },
        })
      ).to.equal(true);
    });

    it('does not treat an ordinary model load failure as an XR asset fetch', function () {
      expect(isXRAssetFetch(new Error('Unable to load from /models/Block1.glb'))).to.equal(false);
      expect(isXRAssetFetch(null)).to.equal(false);
    });

    it('reports a missing XR model as a dismissable notice, not a project crash', function () {
      reportXRModelUnavailable(new Error('Unable to load from https://controllers.babylonjs.com/'));
      const banner = document.querySelector('.flock-banner');
      expect(banner).to.exist;
      expect(banner.textContent).to.contain(translate('error_xr_models_offline'));
      expect(banner.textContent).to.not.contain(translate('error_project_crash'));
      // Reloading offline cannot fetch the model.
      expect(banner.querySelector('.flock-banner__close')).to.exist;
      expect(banner.querySelector('.flock-banner__action')).to.not.exist;
    });

    it('shows one XR model notice however many controllers fail', function () {
      reportXRModelUnavailable(new Error('left'));
      reportXRModelUnavailable(new Error('right'));
      expect(document.querySelectorAll('.flock-banner').length).to.equal(1);
    });

    it('shows a translated unsupported-physics banner with no reload action', function () {
      handleError(new Error('no simd'), { source: 'physics-unsupported' });
      const banner = document.querySelector('.flock-banner');
      expect(banner).to.exist;
      expect(banner.className).to.contain('flock-banner--error');
      expect(banner.textContent).to.contain(translate('error_physics_unsupported'));
      // Reloading cannot add SIMD support, so offering it would mislead.
      expect(document.querySelector('.flock-banner__action')).to.not.exist;
    });

    it('does not stack unsupported-physics banners across repeated runs', function () {
      handleError(new Error('no simd'), { source: 'physics-unsupported' });
      handleError(new Error('no simd'), { source: 'physics-unsupported' });
      expect(document.querySelectorAll('.flock-banner').length).to.equal(1);
    });
  });
}
