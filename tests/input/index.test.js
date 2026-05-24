import { runBindingsTests } from "./bindings.test.js";
import { runInputManagerTests } from "./inputManager.test.js";
import { runKeyboardSourceTests } from "./keyboardSource.test.js";
import { runOnScreenSourceTests } from "./onScreenSource.test.js";
import { runGamepadSourceTests } from "./gamepadSource.test.js";

export function runInputTests() {
  runBindingsTests();
  runInputManagerTests();
  runKeyboardSourceTests();
  runOnScreenSourceTests();
  runGamepadSourceTests();
}
