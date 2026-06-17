export function normaliseKey(key) {
  if (key === ' ' || key === 'Spacebar') return ' ';
  if (key.length === 1) return key.toLowerCase();
  return key;
}
