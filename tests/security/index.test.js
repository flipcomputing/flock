import { runColorValidationTests } from './color-validation.test.js';
import { runTextFieldValidationTests } from './free-text-validation.test.js';
import { runDropdownInjectionTests } from './dropdown-injection.test.js';
import { runGeneratedCodeCheckTests } from './generated-code-check.test.js';

export function runSecurityTests() {
  runColorValidationTests();
  runTextFieldValidationTests();
  runDropdownInjectionTests();
  runGeneratedCodeCheckTests();
}
