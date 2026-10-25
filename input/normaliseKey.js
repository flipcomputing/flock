export function normaliseKey(key) {
  if (typeof key !== 'string') return '';
  if (key === ' ' || key === 'Spacebar') return ' ';
  if (key.length === 1) return key.toLowerCase();
  return key;
}
