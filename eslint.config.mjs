import globals from 'globals';
import pluginJs from '@eslint/js';

const DOM_CONTENT_LOADED = {
  selector: "CallExpression[callee.property.name='addEventListener'][arguments.0.value='DOMContentLoaded']",
  message: "Use whenDomReady from main/domReady.js: in production the app's modules can run after DOMContentLoaded.",
};

// Flock never turns strings into HTML (see AGENTS.md): build elements with ui/dom.js.
const HTML_MESSAGE =
  'Build elements with h/s/svgIcon from ui/dom.js and set text with textContent; authored pages go through renderAuthoredContent.';
const HTML_STRINGS = [
  { selector: "AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]", message: HTML_MESSAGE },
  {
    selector: "CallExpression[callee.property.name=/^(insertAdjacentHTML|setHTMLUnsafe|createContextualFragment)$/]",
    message: HTML_MESSAGE,
  },
  { selector: "CallExpression[callee.object.name='document'][callee.property.name=/^write(ln)?$/]", message: HTML_MESSAGE },
];
const DOM_PARSER = { selector: "NewExpression[callee.name='DOMParser']", message: HTML_MESSAGE };

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      'node_modules/',
      'dev-dist/',
      'dist/',
      'examples/',
      '.local/',
      '**/.local/',
      'test-playwright.js',
      'test-visual.js',
    ],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        __FLOCK_SES_SRI__: 'readonly',
      },
    },
  },
  {
    files: ['tests/**/*.test.js'],
    languageOptions: {
      globals: {
        ...globals.chai,
        ...globals.mocha,
        chai: 'readonly',
      },
    },
  },
  {
    files: ['scripts/**/*.mjs', 'scripts/**/*.js', '**/scripts/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: [
      '*.config.js',
      '*.config.mjs',
      '*.config.cjs',
      '**/*.config.js',
      '**/*.config.mjs',
      '**/*.config.cjs',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  pluginJs.configs.recommended,
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['tests/**', 'scripts/**', 'main/domReady.js', 'ui/authoredContent.js'],
    rules: { 'no-restricted-syntax': ['error', DOM_CONTENT_LOADED, ...HTML_STRINGS, DOM_PARSER] },
  },
  {
    files: ['main/domReady.js'],
    rules: { 'no-restricted-syntax': ['error', ...HTML_STRINGS, DOM_PARSER] },
  },
  {
    files: ['ui/authoredContent.js'],
    rules: { 'no-restricted-syntax': ['error', DOM_CONTENT_LOADED, ...HTML_STRINGS] },
  },
];
