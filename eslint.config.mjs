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
        ...globals.chai,
        ...globals.mocha,
        chai: "readonly",
      },
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  pluginJs.configs.recommended,
];
