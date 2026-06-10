import { ContextManager } from "./context.js";

// Work out what key combo was pressed (e.g. Ctrl+Shift+KeyA)
function _keyCombo(event) {
  const mods = [
    (event.ctrlKey || event.metaKey) && "Mod",
    event.altKey && "Alt",
    event.shiftKey && "Shift",
  ].filter(Boolean);
  return mods.length ? `${mods.join("+")}+${event.code}` : event.code;
}

const KeyboardDispatcher = {
  _registry: {},
  _modeStack: [],

  on(context, code, handler) {
    this._registry[`${context}:${code}`] = handler;
  },

  off(context, code) {
    delete this._registry[`${context}:${code}`];
  },

  pushMode(handler, name = "modal") {
    this._modeStack.push({ handler, name });
  },

  popMode() {
    this._modeStack.pop();
  },

  clearModes() {
    this._modeStack.length = 0;
  },

  _dispatch(event) {
    const context = ContextManager.getCurrentContext();
    if (this._modeStack.length > 0) {
      if (context === "TYPING" || context === "OVERLAY") return;
      const mode = this._modeStack[this._modeStack.length - 1];
      mode.handler(event);
      if (event.cancelBubble) {
        _debugShow(_keyCombo(event), mode.name);
        return;
      }
    }
    const combo = _keyCombo(event);
    const handler =
      this._registry[`${context}:${combo}`] ||
      this._registry[`*:${combo}`] ||
      this._registry[`${context}:${event.code}`] ||
      this._registry[`*:${event.code}`]; // Wildcard context *
    _debugShow(combo, handler ? `${context}:${combo}` : "external");
    if (handler) handler(event);
  },
};

// Print debug info for all key presses
let _debugTimer = null;
function _debugShow(code, label) {
  const el = document.getElementById("input-debug-value");
  if (!el) return;
  el.textContent = `${code} → ${label}`;
  clearTimeout(_debugTimer);
  _debugTimer = setTimeout(() => {
    el.textContent = "-";
  }, 2000);
}

KeyboardDispatcher.connect = function (inputManager) {
  inputManager.onRawKeyDownObservable.add((e) => KeyboardDispatcher._dispatch(e));
};

export { KeyboardDispatcher };
