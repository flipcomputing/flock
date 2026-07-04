#!/usr/bin/env node
// Runs the pure-JS micro:bit suites (protocol, manager with fake transports,
// image-field helpers) in node. The generator suite needs Blockly and runs in
// the browser harness instead: npm run test:api microbit.
import Mocha from "mocha";
import { runMicrobitProtocolTests } from "../tests/microbit/protocol.test.js";
import { runMicrobitManagerTests } from "../tests/microbit/manager.test.js";
import { runMicrobitFieldTests } from "../tests/microbit/field.test.js";

const mocha = new Mocha({ reporter: "spec" });

mocha.suite.emit("pre-require", globalThis, null, mocha);
runMicrobitProtocolTests();
runMicrobitManagerTests();
runMicrobitFieldTests();
mocha.suite.emit("require", null, null, mocha);
mocha.suite.emit("post-require", globalThis, null, mocha);

mocha.run((failures) => {
  process.exitCode = failures ? 1 : 0;
});
