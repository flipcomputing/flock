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
  FORWARD: ["w", "z"],
  BACKWARD: ["s"],
  LEFT: ["a", "q"],
  RIGHT: ["d"],
  BUTTON1: ["r", "1"],
  BUTTON2: ["e", "2"],
  BUTTON3: ["f", "3"],
  BUTTON4: [" ", "4"],
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
