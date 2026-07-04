import { runMicrobitProtocolTests } from "./protocol.test.js";
import { runMicrobitManagerTests } from "./manager.test.js";
import { runMicrobitFieldTests } from "./field.test.js";
import { runMicrobitGeneratorTests } from "./generators.test.js";

// Browser entry point (tests.html). The node runner
// (scripts/run-microbit-tests.mjs) imports the protocol, manager, and field
// suites directly — the generator suite needs the full Blockly environment.
export function runMicrobitTests() {
  runMicrobitProtocolTests();
  runMicrobitManagerTests();
  runMicrobitFieldTests();
  runMicrobitGeneratorTests();
}
