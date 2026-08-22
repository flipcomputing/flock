import { expect } from 'chai';
import {
  areBlockHintsEnabled,
  setBlockHintsEnabled,
  showBlockHint,
  showBlockHintMessage,
  clearBlockHint,
  hideBlockHint,
  setBlockHintsSuppressed,
} from '../ui/blockHint.js';

// blockHint.js reads `enabled` once, at module evaluation, so the mobile
// default can only be observed by re-importing with a fresh module identity.
// The module imports nothing, so a duplicate instance is fully self-contained.
// @vite-ignore keeps Vite's dynamic-import-vars plugin from rejecting the
// varying query string; the browser resolves the URL itself.
async function importWithLayout(matches) {
  const original = window.matchMedia;
  window.matchMedia = (query) => ({ matches, media: query });
  try {
    return await import(/* @vite-ignore */ `../ui/blockHint.js?blockhint-fresh=${Math.random()}`);
  } finally {
    window.matchMedia = original;
  }
}

export function runBlockHintTests(_flock) {
  describe('ui/blockHint @blockhint', function () {
    let container;
    let text;
    let originalEnabled;

    beforeEach(function () {
      // tests.html doesn't include the app's #blockHint markup, and every
      // exported function early-returns without it — so omitting this would
      // make every assertion below pass against a no-op.
      container = document.createElement('div');
      container.id = 'blockHint';
      container.hidden = true;
      text = document.createElement('p');
      text.id = 'blockHintText';
      container.appendChild(text);
      document.body.appendChild(container);

      originalEnabled = areBlockHintsEnabled();
      setBlockHintsEnabled(true);
      showBlockHint(''); // lastHintText has no accessor; this is the only reset
    });

    afterEach(function () {
      setBlockHintsSuppressed(false);
      showBlockHint('');
      setBlockHintsEnabled(originalEnabled);
      container.remove();
    });

    describe('showBlockHint', function () {
      it('reveals the container and renders the text', function () {
        showBlockHint('Move the object');
        expect(container.hidden).to.be.false;
        expect(text.textContent).to.equal('Move the object');
      });

      it("strips the trailing 'Keyword: x' search term", function () {
        showBlockHint('Move the object.\nKeyword: move');
        expect(text.textContent).to.equal('Move the object.');
      });

      it("keeps the 'Keyword: x' term for toolbox blocks", function () {
        showBlockHint('Move the object.\nKeyword: move', { keepKeyword: true });
        expect(text.textContent).to.equal('Move the object.\nKeyword: move');
      });

      it('trims surrounding whitespace', function () {
        showBlockHint('   Move the object   ');
        expect(text.textContent).to.equal('Move the object');
      });

      it('hides the container and clears content for empty text', function () {
        showBlockHint('Move the object');
        showBlockHint('');
        expect(container.hidden).to.be.true;
        expect(text.textContent).to.equal('');
      });

      it('treats undefined as empty rather than rendering "undefined"', function () {
        showBlockHint(undefined);
        expect(container.hidden).to.be.true;
        expect(text.textContent).to.equal('');
      });

      it('replaces the previous hint rather than appending to it', function () {
        showBlockHint('First');
        showBlockHint('Second');
        expect(text.textContent).to.equal('Second');
      });

      it('renders as a text node, never as markup', function () {
        showBlockHint('<b>bold</b>');
        expect(text.querySelector('b')).to.be.null;
        expect(text.textContent).to.equal('<b>bold</b>');
      });
    });

    describe('enabled toggle', function () {
      it('areBlockHintsEnabled reflects setBlockHintsEnabled', function () {
        setBlockHintsEnabled(false);
        expect(areBlockHintsEnabled()).to.be.false;
        setBlockHintsEnabled(true);
        expect(areBlockHintsEnabled()).to.be.true;
      });

      it('does not display a hint while disabled', function () {
        setBlockHintsEnabled(false);
        showBlockHint('Move the object');
        expect(container.hidden).to.be.true;
      });

      it('hides an already-visible hint when disabled', function () {
        showBlockHint('Move the object');
        expect(container.hidden).to.be.false;
        setBlockHintsEnabled(false);
        expect(container.hidden).to.be.true;
      });

      it('restores the last hint when re-enabled', function () {
        showBlockHint('Move the object');
        setBlockHintsEnabled(false);
        setBlockHintsEnabled(true);
        expect(container.hidden).to.be.false;
        expect(text.textContent).to.equal('Move the object');
      });

      it('remembers hints shown while disabled and renders them on re-enable', function () {
        setBlockHintsEnabled(false);
        showBlockHint('Move the object');
        setBlockHintsEnabled(true);
        expect(text.textContent).to.equal('Move the object');
      });
    });

    describe('clearBlockHint / hideBlockHint', function () {
      it('clearBlockHint hides the container', function () {
        showBlockHint('Move the object');
        clearBlockHint();
        expect(container.hidden).to.be.true;
      });

      it('clearBlockHint forgets the text, so re-enabling shows nothing', function () {
        showBlockHint('Move the object');
        clearBlockHint();
        setBlockHintsEnabled(false);
        setBlockHintsEnabled(true);
        expect(container.hidden).to.be.true;
        expect(text.textContent).to.equal('');
      });

      it('hideBlockHint hides without forgetting the text', function () {
        showBlockHint('Move the object');
        hideBlockHint();
        expect(container.hidden).to.be.true;
        setBlockHintsEnabled(false);
        setBlockHintsEnabled(true);
        expect(text.textContent).to.equal('Move the object');
      });

      it('hideBlockHint is not sticky — the next hint shows again', function () {
        showBlockHint('First');
        hideBlockHint();
        showBlockHint('Second');
        expect(container.hidden).to.be.false;
        expect(text.textContent).to.equal('Second');
      });
    });

    describe('temporary suppression', function () {
      it('keeps new hints hidden until suppression ends', function () {
        setBlockHintsSuppressed(true);
        showBlockHint('Move the object');
        expect(container.hidden).to.be.true;

        setBlockHintsSuppressed(false);
        expect(container.hidden).to.be.false;
        expect(text.textContent).to.equal('Move the object');
      });

      it('keeps one-off messages hidden while suppressed', function () {
        setBlockHintsSuppressed(true);
        showBlockHintMessage('Tips live in the Tools menu');
        expect(container.hidden).to.be.true;
      });

      it('remains hidden when hints are enabled during suppression', function () {
        showBlockHint('Move the object');
        setBlockHintsSuppressed(true);
        setBlockHintsEnabled(false);
        setBlockHintsEnabled(true);
        expect(container.hidden).to.be.true;
      });
    });

    describe('showBlockHintMessage', function () {
      it('renders plain text when no boldPart is given', function () {
        showBlockHintMessage('Tips live in the Tools menu');
        expect(container.hidden).to.be.false;
        expect(text.textContent).to.equal('Tips live in the Tools menu');
        expect(text.querySelector('strong')).to.be.null;
      });

      it('wraps boldPart in <strong> and keeps the surrounding text', function () {
        showBlockHintMessage('ℹ️ Show hints: in the Tools menu', { boldPart: 'Show hints' });
        const strong = text.querySelector('strong');
        expect(strong).to.exist;
        expect(strong.textContent).to.equal('Show hints');
        expect(text.textContent).to.equal('ℹ️ Show hints: in the Tools menu');
      });

      it('falls back to plain text when boldPart is absent from the message', function () {
        showBlockHintMessage('Tips live in the Tools menu', { boldPart: 'Hide hints' });
        expect(text.querySelector('strong')).to.be.null;
        expect(text.textContent).to.equal('Tips live in the Tools menu');
      });

      it('hides the container for empty text', function () {
        showBlockHintMessage('Something');
        showBlockHintMessage('');
        expect(container.hidden).to.be.true;
        expect(text.textContent).to.equal('');
      });

      it('shows even while hints are disabled (that is when the tip matters)', function () {
        setBlockHintsEnabled(false);
        showBlockHintMessage('Show hints: in the Tools menu', { boldPart: 'Show hints' });
        expect(container.hidden).to.be.false;
        expect(text.textContent).to.equal('Show hints: in the Tools menu');
      });

      it("does not strip 'Keyword:' — unlike showBlockHint, messages are not tooltips", function () {
        showBlockHintMessage('A message.\nKeyword: move');
        expect(text.textContent).to.equal('A message.\nKeyword: move');
      });

      it('renders boldPart as text, never as markup', function () {
        showBlockHintMessage('before <b>x</b> after', { boldPart: '<b>x</b>' });
        expect(text.querySelector('b')).to.be.null;
        expect(text.querySelector('strong').textContent).to.equal('<b>x</b>');
      });

      it('does not become the remembered hint — toggling hints on replaces it', function () {
        showBlockHintMessage('Show hints: in the Tools menu', { boldPart: 'Show hints' });
        expect(container.hidden).to.be.false;
        setBlockHintsEnabled(false);
        setBlockHintsEnabled(true);
        expect(container.hidden).to.be.true;
        expect(text.textContent).to.equal('');
      });

      it('hides on the next click or tap', function () {
        showBlockHintMessage('Tips live in the Tools menu');
        document.dispatchEvent(new PointerEvent('pointerdown'));
        expect(container.hidden).to.be.true;
      });

      it('removes the dismissal listener when a regular hint replaces it', function () {
        showBlockHintMessage('Tips live in the Tools menu');
        showBlockHint('Move the object');
        document.dispatchEvent(new PointerEvent('pointerdown'));
        expect(container.hidden).to.be.false;
        expect(text.textContent).to.equal('Move the object');
      });
    });

    describe('mobile layout default', function () {
      it('defaults to disabled at the mobile breakpoint', async function () {
        const mod = await importWithLayout(true);
        expect(mod.areBlockHintsEnabled()).to.be.false;
      });

      it('defaults to enabled above the mobile breakpoint', async function () {
        const mod = await importWithLayout(false);
        expect(mod.areBlockHintsEnabled()).to.be.true;
      });
    });
  });
}
