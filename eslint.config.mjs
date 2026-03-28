import globals from "globals";
import pluginJs from "@eslint/js";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      "node_modules/",
      "dev-dist/",
      "dist/",
      "examples/",
      ".local/",
      "**/.local/",
    ],
  },
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
    files: ["scripts/**/*.mjs", "scripts/**/*.js", "**/scripts/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: [
      "*.config.js",
      "*.config.mjs",
      "*.config.cjs",
      "**/*.config.js",
      "**/*.config.mjs",
      "**/*.config.cjs",
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["vite.config.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },
  pluginJs.configs.recommended,
];
