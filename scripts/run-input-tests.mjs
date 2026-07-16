#!/usr/bin/env node
if (!globalThis.window) globalThis.window = new EventTarget();
if (!globalThis.document) globalThis.document = new EventTarget();
if (!globalThis.KeyboardEvent) {
  globalThis.KeyboardEvent = class KeyboardEvent extends Event {
    constructor(type, init = {}) {
      super(type, init);
      this.key = init.key ?? "";
      this.code = init.code ?? "";
      this.keyCode = init.keyCode ?? 0;
      this.which = init.which ?? 0;
      this.repeat = init.repeat ?? false;
      this.ctrlKey = init.ctrlKey ?? false;
      this.metaKey = init.metaKey ?? false;
      this.altKey = init.altKey ?? false;
      this.shiftKey = init.shiftKey ?? false;
    }
  };
}
if (!globalThis.PointerEvent) {
  globalThis.PointerEvent = class PointerEvent extends Event {
    constructor(type, init = {}) {
      super(type, { bubbles: init.bubbles, cancelable: init.cancelable });
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? "";
      this.clientX = init.clientX ?? 0;
      this.clientY = init.clientY ?? 0;
      this.button = init.button ?? 0;
      this.buttons = init.buttons ?? 0;
    }
  };
}

import Mocha from "mocha";
import { runInputTests } from "../tests/input/index.test.js";

const mocha = new Mocha({ reporter: "spec" });

// Register all input tests
mocha.suite.emit("pre-require", globalThis, null, mocha);
runInputTests();
mocha.suite.emit("require", null, null, mocha);
mocha.suite.emit("post-require", globalThis, null, mocha);

mocha.run((failures) => {
  process.exitCode = failures ? 1 : 0;
});
