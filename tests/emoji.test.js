import { expect } from 'chai';
import { EMOJI_CATEGORIES } from '../config.js';
import {
  SKIN_TONES,
  emojiVariant,
  hasPersonStyles,
  hasTones,
  normaliseEmoji,
  personStyleOf,
  toneOf,
  withPersonStyle,
  withTone,
} from '../blocks/emoji.js';
import { createEmojiPicker } from '../ui/emojiPicker.js';

const MEDIUM = SKIN_TONES[3];
const ASTRONAUT = '\u{1F9D1}\u{200D}\u{1F680}';
const HOLDING_HANDS = '\u{1F9D1}\u{200D}\u{1F91D}\u{200D}\u{1F9D1}';

export function runEmojiTests() {
  describe('blocks/emoji @emoji', function () {
    it('accepts one emoji of any shape and nothing else', function () {
      for (const emoji of [
        '\u{1F431}',
        '\u{1F44D}\u{1F3FD}',
        '\u{1F3F3}\u{FE0F}\u{200D}\u{1F308}',
        '\u{1F1EC}\u{1F1E7}',
        '5\u{FE0F}\u{20E3}',
        '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}',
      ]) {
        expect(normaliseEmoji(emoji), emoji).to.equal(emoji);
      }
      for (const text of ['', 'cat', 'A', '1', '\u{1F431}\u{1F436}', '\u{1F1EC}']) {
        expect(normaliseEmoji(text), text).to.equal(null);
      }
    });

    it('trims spaces and adds the emoji marker when it is missing', function () {
      expect(normaliseEmoji(' \u{1F431} ')).to.equal('\u{1F431}');
      expect(normaliseEmoji('\u{2764}')).to.equal('\u{2764}\u{FE0F}');
      expect(normaliseEmoji('\u{2639}')).to.equal('\u{2639}\u{FE0F}');
      expect(normaliseEmoji('1\u{20E3}')).to.equal('1\u{FE0F}\u{20E3}');
      expect(normaliseEmoji('\u{1F575}\u{1F3FD}\u{200D}\u{2640}')).to.equal(
        '\u{1F575}\u{1F3FD}\u{200D}\u{2640}\u{FE0F}'
      );
      expect(normaliseEmoji('\u{1F436}\u{200D}\u{2640}\u{FE0F}')).to.equal(null);
    });

    it('lists only real emoji, each once, with the group icon in its group', function () {
      const all = EMOJI_CATEGORIES.flatMap((category) => category.emojis);
      expect(all.filter((emoji) => normaliseEmoji(emoji) !== emoji)).to.deep.equal([]);
      expect(new Set(all).size).to.equal(all.length);
      for (const category of EMOJI_CATEGORIES) {
        expect(category.emojis).to.include(category.icon);
      }
    });

    it('adds and removes skin tones, including on every person in a group', function () {
      expect(withTone('\u{1F44D}', MEDIUM)).to.equal('\u{1F44D}\u{1F3FD}');
      expect(withTone('\u{261D}\u{FE0F}', MEDIUM)).to.equal('\u{261D}\u{1F3FD}');
      expect(withTone('\u{261D}\u{1F3FD}', '')).to.equal('\u{261D}\u{FE0F}');
      expect(withTone(HOLDING_HANDS, MEDIUM)).to.equal(
        '\u{1F9D1}\u{1F3FD}\u{200D}\u{1F91D}\u{200D}\u{1F9D1}\u{1F3FD}'
      );
      expect(withTone('\u{1F436}', MEDIUM)).to.equal('\u{1F436}');
      expect(toneOf('\u{1F44D}\u{1F3FD}')).to.equal(MEDIUM);
      expect(hasTones('\u{1F44D}')).to.equal(true);
      expect(hasTones('\u{1F436}')).to.equal(false);
    });

    it('swaps between person, woman and man forms', function () {
      expect(withPersonStyle(ASTRONAUT, 'woman')).to.equal('\u{1F469}\u{200D}\u{1F680}');
      expect(withPersonStyle('\u{1F46E}', 'man')).to.equal('\u{1F46E}\u{200D}\u{2642}\u{FE0F}');
      expect(withPersonStyle(HOLDING_HANDS, 'woman')).to.equal('\u{1F46D}');
      expect(withPersonStyle('\u{1F9D2}', 'man')).to.equal('\u{1F466}');
      expect(withPersonStyle('\u{1F469}\u{200D}\u{1F680}', '')).to.equal(ASTRONAUT);
      expect(emojiVariant('\u{1F3C3}', MEDIUM, 'woman')).to.equal(
        '\u{1F3C3}\u{1F3FD}\u{200D}\u{2640}\u{FE0F}'
      );
      expect(personStyleOf('\u{1F3C3}\u{1F3FD}\u{200D}\u{2640}\u{FE0F}')).to.equal('woman');
      expect(hasPersonStyles('\u{1F44D}')).to.equal(false);
      expect(hasPersonStyles('\u{1F46A}')).to.equal(false);
      expect(hasPersonStyles('\u{1F9D4}')).to.equal(false);
    });

    describe('picker', function () {
      let picker;
      const open = (options) => {
        picker = createEmojiPicker(options);
        document.body.append(picker.element);
        return picker.element;
      };
      const grid = (element) =>
        [...element.querySelectorAll('.emoji-picker-emoji')].map((button) => button.textContent);

      afterEach(function () {
        picker?.element.remove();
        picker = null;
      });

      it('opens on the group of the current emoji with its tone and form chosen', function () {
        const runner = '\u{1F3C3}\u{1F3FD}\u{200D}\u{2640}\u{FE0F}';
        const element = open({ value: runner });
        expect(grid(element)).to.include(runner);
        expect(element.querySelector('[aria-current="true"]').textContent).to.equal(runner);
        const checked = [...element.querySelectorAll('[role="radio"][aria-checked="true"]')];
        expect(checked.map((button) => button.textContent)).to.deep.equal([
          '\u{270B}\u{1F3FD}',
          '\u{1F469}',
        ]);
      });

      it('picks from the grid, and takes a typed emoji only when it is one emoji', function () {
        const picked = [];
        const element = open({ value: '\u{1F436}', onPick: (emoji) => picked.push(emoji) });
        element.querySelector('[aria-current="true"]').click();
        const input = element.querySelector('.emoji-picker-input');
        const enter = () =>
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        input.value = 'dog';
        input.dispatchEvent(new Event('input'));
        enter();
        expect(input.getAttribute('aria-invalid')).to.equal('true');
        input.value = '\u{1F984}';
        input.dispatchEvent(new Event('input'));
        enter();
        expect(picked).to.deep.equal(['\u{1F436}', '\u{1F984}']);
      });

      it('moves through the grid with arrow keys and cancels with Escape', function () {
        let cancelled = false;
        const element = open({ value: '\u{1F436}', onCancel: () => (cancelled = true) });
        picker.focus();
        const start = document.activeElement;
        start.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        expect(document.activeElement).to.equal(start.nextElementSibling);
        expect(document.activeElement.tabIndex).to.equal(0);
        document.activeElement.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        );
        expect(cancelled).to.equal(true);
        expect(element.isConnected).to.equal(true);
      });
    });
  });
}
