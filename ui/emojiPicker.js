import { EMOJI_CATEGORIES } from '../config.js';
import { translate } from '../main/translation.js';
import {
  PERSON_STYLES,
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
import { h } from './dom.js';

const COLUMNS = 8;
const TONE_SAMPLE = '\u{270B}';
const STYLE_SAMPLES = { '': '\u{1F9D1}', woman: '\u{1F469}', man: '\u{1F468}' };

const remembered = { category: 0, tone: '', style: '' };
const variantCache = new Map();

function categoryVariants(index) {
  if (!variantCache.has(index)) {
    const emojis = EMOJI_CATEGORIES[index].emojis;
    variantCache.set(index, {
      tones: emojis.some(hasTones),
      styles: emojis.some(hasPersonStyles),
    });
  }
  return variantCache.get(index);
}

const baseOf = (emoji) => withPersonStyle(withTone(emoji, ''), '');

function startState(value) {
  const state = { ...remembered };
  const emoji = normaliseEmoji(value);
  if (!emoji) return state;
  if (hasTones(emoji)) state.tone = toneOf(emoji);
  if (hasPersonStyles(emoji)) state.style = personStyleOf(emoji);
  const base = baseOf(emoji);
  const found = EMOJI_CATEGORIES.findIndex((category) =>
    category.emojis.some((each) => each === base || each === emoji)
  );
  if (found !== -1) state.category = found;
  return state;
}

function rovingKeys(event, buttons, columns, choose) {
  const index = buttons.indexOf(document.activeElement);
  if (index === -1) return false;
  const last = buttons.length - 1;
  const moves = {
    ArrowRight: index + 1,
    ArrowLeft: index - 1,
    ArrowDown: index + columns,
    ArrowUp: index - columns,
    Home: 0,
    End: last,
  };
  if (!(event.key in moves)) return false;
  event.preventDefault();
  const next = Math.max(0, Math.min(last, moves[event.key]));
  buttons.forEach((button, i) => (button.tabIndex = i === next ? 0 : -1));
  buttons[next].focus();
  choose?.(next);
  return true;
}

export function createEmojiPicker({ value = '', onPick, onCancel }) {
  const state = startState(value);
  const current = normaliseEmoji(value);

  const tabs = h('div', {
    class: 'emoji-picker-tabs',
    role: 'tablist',
    'aria-label': translate('emoji_picker_categories'),
  });
  const tones = h('div', {
    class: 'emoji-picker-choices',
    role: 'radiogroup',
    'aria-label': translate('emoji_picker_skin_tone'),
  });
  const styles = h('div', {
    class: 'emoji-picker-choices',
    role: 'radiogroup',
    'aria-label': translate('emoji_picker_person'),
  });
  const variants = h('div', { class: 'emoji-picker-variants' }, tones, styles);
  const grid = h('div', { class: 'emoji-picker-grid', role: 'tabpanel', id: 'emojiPickerGrid' });
  const input = h('input', {
    type: 'text',
    class: 'emoji-picker-input',
    'aria-label': translate('emoji_picker_custom'),
    placeholder: translate('emoji_picker_custom'),
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const use = h('button', { type: 'button', class: 'emoji-picker-use', disabled: '' });
  const custom = h('div', { class: 'emoji-picker-custom' }, input, use);
  const root = h(
    'div',
    { class: 'emoji-picker', 'aria-label': translate('emoji_picker_label') },
    tabs,
    variants,
    grid,
    custom
  );

  const tabButtons = EMOJI_CATEGORIES.map((category, index) => {
    const button = h(
      'button',
      {
        type: 'button',
        role: 'tab',
        class: 'emoji-picker-tab',
        id: `emojiPickerTab${index}`,
        'aria-controls': 'emojiPickerGrid',
      },
      category.icon
    );
    button.addEventListener('click', () => {
      state.category = index;
      render();
    });
    tabs.append(button);
    return button;
  });

  const choiceButtons = (container, options, sample, key) =>
    options.map((option) => {
      const button = h(
        'button',
        { type: 'button', role: 'radio', class: 'emoji-picker-choice' },
        sample(option)
      );
      button.addEventListener('click', () => {
        state[key] = option;
        render();
      });
      container.append(button);
      return button;
    });

  const toneButtons = choiceButtons(tones, SKIN_TONES, (tone) => TONE_SAMPLE + tone, 'tone');
  const styleButtons = choiceButtons(
    styles,
    PERSON_STYLES,
    (style) => STYLE_SAMPLES[style],
    'style'
  );

  let gridButtons = [];
  let shownCategory = null;

  function pick(emoji) {
    remembered.category = state.category;
    remembered.tone = state.tone;
    remembered.style = state.style;
    onPick?.(emoji);
  }

  function markChoices(buttons, options, chosen) {
    buttons.forEach((button, i) => {
      const on = options[i] === chosen;
      button.setAttribute('aria-checked', String(on));
      button.tabIndex = on ? 0 : -1;
    });
  }

  function render() {
    tabButtons.forEach((button, i) => {
      const on = i === state.category;
      button.setAttribute('aria-selected', String(on));
      button.tabIndex = on ? 0 : -1;
    });
    const { tones: showTones, styles: showStyles } = categoryVariants(state.category);
    tones.hidden = !showTones;
    styles.hidden = !showStyles;
    variants.hidden = !showTones && !showStyles;
    markChoices(toneButtons, SKIN_TONES, state.tone);
    markChoices(styleButtons, PERSON_STYLES, state.style);
    grid.setAttribute('aria-labelledby', tabButtons[state.category].id);
    const emojis = EMOJI_CATEGORIES[state.category].emojis.map((emoji) =>
      emojiVariant(emoji, state.tone, state.style)
    );
    gridButtons = emojis.map((emoji) => {
      const button = h(
        'button',
        { type: 'button', class: 'emoji-picker-emoji', tabindex: -1 },
        emoji
      );
      if (emoji === current) button.setAttribute('aria-current', 'true');
      button.addEventListener('click', () => pick(emoji));
      return button;
    });
    const focused =
      gridButtons.find((button) => button.getAttribute('aria-current')) ?? gridButtons[0];
    if (focused) focused.tabIndex = 0;
    grid.replaceChildren(...gridButtons);
    if (shownCategory !== state.category) grid.scrollTop = 0;
    shownCategory = state.category;
  }

  function updateCustom() {
    const emoji = normaliseEmoji(input.value);
    use.textContent = emoji ?? '';
    use.disabled = !emoji;
    if (input.value.trim() !== '' && !emoji) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    return emoji;
  }

  input.addEventListener('input', updateCustom);
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const emoji = updateCustom();
    if (emoji) pick(emoji);
  });
  use.addEventListener('click', () => {
    const emoji = updateCustom();
    if (emoji) pick(emoji);
  });

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel?.();
      return;
    }
    if (event.target === input) {
      event.stopPropagation();
      return;
    }
    const handled =
      rovingKeys(event, gridButtons, COLUMNS) ||
      rovingKeys(event, tabButtons, 1, (i) => {
        state.category = i;
        render();
        tabButtons[i].focus();
      }) ||
      rovingKeys(event, toneButtons, 1, (i) => {
        state.tone = SKIN_TONES[i];
        render();
        toneButtons[i].focus();
      }) ||
      rovingKeys(event, styleButtons, 1, (i) => {
        state.style = PERSON_STYLES[i];
        render();
        styleButtons[i].focus();
      });
    if (handled) event.stopPropagation();
  });

  render();
  if (current && !gridButtons.some((button) => button.textContent === current)) {
    input.value = current;
    updateCustom();
  }

  return {
    element: root,
    focus() {
      (gridButtons.find((button) => button.tabIndex === 0) ?? input).focus();
    },
  };
}
