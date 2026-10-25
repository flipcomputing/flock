import { expect } from 'chai';
import {
  showBanner,
  dismissBanner,
  handleError,
  isBenignAbort,
  isXRAssetFetch,
  reportXRModelUnavailable,
  isResizeObserverLoop,
  isOpaqueScriptError,
  isExtensionError,
  isChunkLoadError,
} from '../ui/notifications.js';
import { translate } from '../main/translation.js';
import en from '../locale/en.js';

const reportingSources = import.meta.glob(['../api/*.js', '../runtime/*.js'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

export function runNotificationTests(flock) {
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

    it('treats ResizeObserver loop warnings as browser noise', function () {
      expect(
        isResizeObserverLoop('ResizeObserver loop completed with undelivered notifications.')
      ).to.equal(true);
      expect(isResizeObserverLoop('ResizeObserver loop limit exceeded')).to.equal(true);
      expect(isResizeObserverLoop('ResizeObserver is not defined')).to.equal(false);
    });

    it('treats a detail-free cross-origin Script error as noise', function () {
      expect(isOpaqueScriptError({ message: 'Script error.', error: null })).to.equal(true);
      expect(isOpaqueScriptError({ message: 'Script error.', error: new Error('real') })).to.equal(
        false
      );
    });

    it('treats errors thrown from a browser extension as noise', function () {
      expect(isExtensionError(null, 'chrome-extension://abc/content.js')).to.equal(true);
      const fromExtension = new Error('x');
      fromExtension.stack = [
        'Error: x',
        '    at f (moz-extension://abc/inject.js:1:1)',
        '    at g (https://flipcomputing.github.io/flock/a.js:1:1)',
      ].join('\n');
      expect(isExtensionError(fromExtension)).to.equal(true);
      const throughExtension = new Error('y');
      throughExtension.stack = [
        'Error: y',
        '    at f (https://flipcomputing.github.io/flock/a.js:1:1)',
        '    at g (chrome-extension://abc/hook.js:1:1)',
      ].join('\n');
      expect(isExtensionError(throughExtension)).to.equal(false);
      expect(
        isExtensionError(new Error('plain'), 'https://flipcomputing.github.io/flock/a.js')
      ).to.equal(false);
    });

    it('recognises a failed chunk load in each browser wording', function () {
      expect(
        isChunkLoadError(
          new TypeError('Failed to fetch dynamically imported module: https://x/assets/a.js')
        )
      ).to.equal(true);
      expect(
        isChunkLoadError(
          new TypeError('error loading dynamically imported module: https://x/assets/a.js')
        )
      ).to.equal(true);
      expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).to.equal(true);
      expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/a.css'))).to.equal(true);
      expect(isChunkLoadError(new Error('mesh is not defined'))).to.equal(false);
    });

    it('shows a reloadable chunk-load banner, not a project crash', function () {
      handleError(new TypeError('Failed to fetch dynamically imported module'), {
        source: 'chunk-load',
        fatal: true,
      });
      const banner = document.querySelector('.flock-banner');
      expect(banner.textContent).to.contain(translate('error_chunk_load'));
      expect(banner.textContent).to.not.contain(translate('error_project_crash'));
      expect(banner.querySelector('.flock-banner__action')).to.exist;
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

    describe('block error logging', function () {
      const BLOCK_ID = 'a1B2c3D4e5F6g7H8i9J0';

      // Reports one error with logging on; returns the logged line and what onBlockError saw.
      const report = (values) => {
        const originalWarn = console.warn;
        const savedDebugLogging = flock._debugLogging;
        const previousOnBlockError = flock.onBlockError;
        const warnings = [];
        const reported = [];
        console.warn = (...args) => warnings.push(args);
        flock.onBlockError = (info) => reported.push(info);
        try {
          flock._debugLogging = true;
          flock._lastErrorSig = undefined;
          flock.reportBlockError({ key: 'object_not_found', api: 'test', values });
        } finally {
          console.warn = originalWarn;
          flock._debugLogging = savedDebugLogging;
          flock.onBlockError = previousOnBlockError;
        }
        return { line: warnings[0]?.[0], reported };
      };
      const expectedLine = (object) =>
        `[flock] test: object_not_found: ${translate('object_not_found').replace('{object}', object)}`;

      it('logs the message with the name the user wrote', function () {
        expect(report({ object: `box1__${BLOCK_ID}` }).line).to.equal(expectedLine('box1'));
      });

      it('removes a block ID that contains __ whole', function () {
        expect(report({ object: 'box1__ab__cdEFghIJklMNopQR' }).line).to.equal(
          expectedLine('box1')
        );
      });

      it("shows a repeated object's name as it is", function () {
        expect(report({ object: 'box1_17' }).line).to.equal(expectedLine('box1_17'));
      });

      it('keeps __ that is part of the name the user wrote', function () {
        expect(report({ object: `my__box__${BLOCK_ID}` }).line).to.equal(expectedLine('my__box'));
      });

      it("shows a real object's name whole, even with __ in it", function () {
        const name = flock._reserveName('log_my__box');
        try {
          expect(report({ object: name }).line).to.equal(expectedLine('log_my__box'));
        } finally {
          flock._releaseName(name);
        }
      });

      it('keeps the placeholder, and still reports, when a value cannot be read', function () {
        const values = {
          get object() {
            throw new Error('getter');
          },
        };
        const { line, reported } = report(values);
        expect(line).to.equal(expectedLine('{object}'));
        expect(reported).to.have.length(1);
      });

      it('does not convert a value that is not text or a number', function () {
        let converted = false;
        const object = {
          toString() {
            converted = true;
            return 'box1';
          },
        };
        expect(report({ object }).line).to.equal(expectedLine('{object}'));
        expect(converted).to.be.false;
      });
    });

    it('has English text for every block error key', function () {
      const keys = new Set();
      for (const source of Object.values(reportingSources)) {
        for (const [, key] of source.matchAll(/reportBlockError[?.]*\(\s*\{\s*key:\s*'(\w+)'/g)) {
          keys.add(key);
        }
      }
      expect(keys.size).to.be.greaterThan(10);
      expect([...keys].filter((key) => !en[key])).to.deep.equal([]);
    });

    it('does not stack unsupported-physics banners across repeated runs', function () {
      handleError(new Error('no simd'), { source: 'physics-unsupported' });
      handleError(new Error('no simd'), { source: 'physics-unsupported' });
      expect(document.querySelectorAll('.flock-banner').length).to.equal(1);
    });
  });
}
