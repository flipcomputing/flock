export const ACTIONS = Object.freeze([
  'FORWARD',
  'BACKWARD',
  'LEFT',
  'RIGHT',
  'BUTTON1',
  'BUTTON2',
  'BUTTON3',
  'BUTTON4',
  'A11Y_I',
  'A11Y_J',
  'A11Y_K',
  'A11Y_L',
]);

export const DEFAULT_BINDINGS = Object.freeze({
  FORWARD: ['w', 'z'],
  BACKWARD: ['s'],
  LEFT: ['a', 'q'],
  RIGHT: ['d'],
  BUTTON1: ['r', '1'],
  BUTTON2: ['e', '2'],
  BUTTON3: ['f', '3'],
  BUTTON4: [' ', '4'],
  // Virtual keys for gamepad-only accessibility actions (no real keyboard equivalent).
  A11Y_I: ['a11y_i'],
  A11Y_J: ['a11y_j'],
  A11Y_K: ['a11y_k'],
  A11Y_L: ['a11y_l'],
});

export function getBoundKeys(action, overrides) {
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, action)) {
    return overrides[action];
  }
  return DEFAULT_BINDINGS[action];
}

export function isKnownAction(action) {
  return ACTIONS.includes(action);
}
