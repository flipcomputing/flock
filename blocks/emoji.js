function rgiPattern() {
  try {
    return new RegExp(String.raw`^\p{RGI_Emoji}$`, 'v');
  } catch {
    return null;
  }
}

const rgiEmoji = rgiPattern();

const VS16 = '\u{FE0F}';
const ZWJ = '\u{200D}';

const LOOSE_PART = String.raw`(?:\p{Emoji_Modifier_Base}\p{Emoji_Modifier}|(?![\p{Regional_Indicator}\p{Emoji_Modifier}])\p{Emoji_Presentation}|\p{Extended_Pictographic}\u{FE0F})`;
const LOOSE_EMOJI = new RegExp(
  String.raw`^(?:\p{Regional_Indicator}{2}|[#*0-9]\u{FE0F}\u{20E3}|\u{1F3F4}[\u{E0020}-\u{E007E}]+\u{E007F}|${LOOSE_PART}(?:\u{200D}${LOOSE_PART})*)$`,
  'u'
);

export function isEmoji(text) {
  if (typeof text !== 'string' || text === '') return false;
  return rgiEmoji ? rgiEmoji.test(text) : LOOSE_EMOJI.test(text);
}

const isVariant = (text) => (rgiEmoji ? isEmoji(text) : !text.includes(ZWJ) && isEmoji(text));

const qualify = (text) =>
  text
    .replace(/([#*0-9])\u{20E3}/gu, `$1${VS16}\u{20E3}`)
    .replace(/\p{Emoji}(?![\u{FE0F}\u{20E3}\p{Emoji_Modifier}])/gu, (ch) =>
      /\p{Emoji_Presentation}|\p{Emoji_Modifier}|[#*0-9]/u.test(ch) ? ch : ch + VS16
    );

export function normaliseEmoji(value) {
  const text = String(value ?? '').trim();
  if (isEmoji(text)) return text;
  const bare = text.replace(/\u{FE0F}/gu, '');
  for (const candidate of [qualify(text), qualify(bare), bare]) {
    if (isEmoji(candidate)) return candidate;
  }
  return null;
}

export const SKIN_TONES = Object.freeze([
  '',
  '\u{1F3FB}',
  '\u{1F3FC}',
  '\u{1F3FD}',
  '\u{1F3FE}',
  '\u{1F3FF}',
]);

const TONE = /[\u{1F3FB}-\u{1F3FF}]/gu;
const HANDSHAKE = '\u{1F91D}';
const FAMILY = '\u{1F46A}';

export function toneOf(emoji) {
  return String(emoji ?? '').match(TONE)?.[0] ?? '';
}

function applyTone(plain, tone, skip) {
  const parts = [...plain];
  let result = '';
  for (let i = 0; i < parts.length; i++) {
    result += parts[i];
    if (parts[i] !== FAMILY && !skip(parts[i]) && /\p{Emoji_Modifier_Base}/u.test(parts[i])) {
      result += tone;
      if (parts[i + 1] === VS16) i++;
    }
  }
  return result;
}

export function withTone(emoji, tone) {
  const stripped = String(emoji ?? '').replace(TONE, '');
  const plain = normaliseEmoji(stripped) ?? stripped;
  if (!tone) return plain;
  for (const skip of [() => false, (part) => part === HANDSHAKE]) {
    const toned = applyTone(plain, tone, skip);
    if (toned !== plain && isVariant(toned)) return toned;
  }
  return plain;
}

export const PERSON_STYLES = Object.freeze(['', 'woman', 'man']);

const WHOLE = new Map([
  ['\u{1F9D1}\u{200D}\u{1F91D}\u{200D}\u{1F9D1}', ['\u{1F46D}', '\u{1F46C}']],
]);
const LEADING = new Map([
  ['\u{1F9D1}', ['\u{1F469}', '\u{1F468}']],
  ['\u{1F9D2}', ['\u{1F467}', '\u{1F466}']],
  ['\u{1F9D3}', ['\u{1F475}', '\u{1F474}']],
]);
const SIGNS = ['\u{2640}\u{FE0F}', '\u{2642}\u{FE0F}'];
const SIGNS_NEWER_THAN_WINDOWS_10 = new Set(['\u{1F9D4}']);

const leadsSequence = (rest) => rest.length === 0 || rest[0] === ZWJ;

function neutralForm(plain) {
  for (const [neutral, forms] of WHOLE) {
    if (forms.includes(plain)) return neutral;
  }
  const unsigned = plain.replace(/\u{200D}[\u{2640}\u{2642}]\u{FE0F}?$/u, '');
  const [first, ...rest] = [...unsigned];
  for (const [neutral, forms] of LEADING) {
    if (forms.includes(first) && leadsSequence(rest)) {
      const swapped = neutral + rest.join('');
      if (isEmoji(swapped)) return swapped;
    }
  }
  return unsigned !== plain && isEmoji(unsigned) ? unsigned : plain;
}

export function withPersonStyle(emoji, style) {
  const tone = toneOf(emoji);
  const neutral = neutralForm(withTone(emoji, ''));
  const index = PERSON_STYLES.indexOf(style) - 1;
  if (index < 0) return withTone(neutral, tone);
  const [first, ...rest] = [...neutral];
  const signed = neutral + ZWJ + SIGNS[index];
  const candidates = [
    WHOLE.get(neutral)?.[index],
    LEADING.has(first) && leadsSequence(rest) ? LEADING.get(first)[index] + rest.join('') : null,
    !SIGNS_NEWER_THAN_WINDOWS_10.has(neutral) && isVariant(signed) ? signed : null,
  ];
  const styled = candidates.find((candidate) => candidate && isEmoji(candidate)) ?? neutral;
  return withTone(styled, tone);
}

export function personStyleOf(emoji) {
  const plain = withTone(emoji, '');
  const neutral = neutralForm(plain);
  if (neutral === plain) return '';
  return PERSON_STYLES.find((style) => style && withPersonStyle(neutral, style) === plain) ?? '';
}

export function emojiVariant(emoji, tone, style) {
  return withTone(withPersonStyle(emoji, style), tone);
}

export function hasTones(emoji) {
  return withTone(emoji, SKIN_TONES[3]) !== withTone(emoji, '');
}

export function hasPersonStyles(emoji) {
  return withPersonStyle(emoji, 'woman') !== withPersonStyle(emoji, '');
}
