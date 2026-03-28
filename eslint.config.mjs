import globals from "globals";
import pluginJs from "@eslint/js";

/** @type {import('eslint').Linter.Config[]} */
export default [
  { ignores: ["node_modules/", "dev-dist/", "dist/", "examples/"] },
  { languageOptions: { globals: globals.browser } },
  {
    files: ["tests/**/*.test.js"],
    languageOptions: {
      globals: {
        ...globals.mocha,
      },
    },
  },
  pluginJs.configs.recommended,
];
