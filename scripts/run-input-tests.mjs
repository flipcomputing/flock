#!/usr/bin/env node
if (!globalThis.window) globalThis.window = new EventTarget();
if (!globalThis.KeyboardEvent) {
  globalThis.KeyboardEvent = class KeyboardEvent extends Event {
    constructor(type, init = {}) { super(type, init); this.key = init.key ?? ""; }
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
