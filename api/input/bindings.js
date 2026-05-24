export const ACTIONS = Object.freeze([
  "FORWARD",
  "BACKWARD",
  "LEFT",
  "RIGHT",
  "BUTTON1",
  "BUTTON2",
  "BUTTON3",
  "BUTTON4",
]);

export const DEFAULT_BINDINGS = Object.freeze({
  FORWARD: Object.freeze(["w", "z"]),
  BACKWARD: Object.freeze(["s"]),
  LEFT: Object.freeze(["a", "q"]),
  RIGHT: Object.freeze(["d"]),
  BUTTON1: Object.freeze(["e", "1"]),
  BUTTON2: Object.freeze(["r", "2"]),
  BUTTON3: Object.freeze(["f", "3"]),
  BUTTON4: Object.freeze([" ", "4"]),
});

export function getBoundKeys(action, overrides) {
  if (overrides && overrides[action]) {
    return overrides[action];
  }
  return DEFAULT_BINDINGS[action];
}

export function isKnownAction(action) {
  return ACTIONS.includes(action);
}
