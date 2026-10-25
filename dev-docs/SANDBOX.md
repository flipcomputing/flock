# Sandbox security

User programs must only be able to reach the Flock API. This page explains how that boundary works
and the rules for API and generator code that keep it intact.

## Threat model

In the editor, code reaches `flock.runCode` only through the Blockly generators. A project file
(shared, imported, or loaded with `?project=`) is untrusted JSON. There are two lines of defence:

1. **Generators** must never let field text become code.
2. **The sandbox** must stop generated code reaching anything except the API.

Standalone pages run raw JavaScript, but their author controls the whole page, so the sandbox is not
a security boundary there.

## How the sandbox works

`runCode` (`flock.js`) runs user code in an SES `Compartment` inside a hidden same-origin iframe
whose realm has been locked down. The API, Babylon and the editor UI live in the host page, which is
**not** locked down. Any host object that user code can reach exposes the host's untamed `Function`
through `.constructor.constructor`, which is a full escape.

The API is exposed through `createWhitelist`. Every function is wrapped by `__flockWrapHostFn`, a
sandbox-side script injected before `lockdown()`. The wrapper converts everything that crosses the
boundary:

| Crossing | Handling |
| --- | --- |
| Return values | Primitives and sandbox values pass; host arrays are copied; host promises become sandbox promises; prototype-free frozen objects (vectors) pass; **any other host value becomes `undefined`** with a `Flock sandbox: dropped a host object from <api>` warning |
| Errors (sync or async) | Never passed to user code. User code gets a sandbox `AbortError`; the original error goes to the host page's normal reporting |
| Functions passed in (top level, or inside options objects and arrays) | Wrapped once (cached, so identity is stable for `loadSection`/`unloadSection`). Arguments the host calls them with go through the same return-value rules |

The AST check in `validateUserCodeAST` is a lint. It is not a security boundary: computed property
names bypass it.

## Rules for API code

- Return primitives, or names and IDs that the API looks up later (meshes, instruments, sounds).
  Don't return Babylon objects, plain host objects or functions; they'll arrive as `undefined`.
- If a function only needs to wait, resolve to nothing. Watch for `Promise.all` and `whenModelReady`
  resolving to arrays of meshes or to a mesh.
- For small structured values, return a frozen object with no prototype (see `createVector3`).
- Don't pass user callbacks straight to Babylon observables, which call them with
  `(eventData, eventState)`. Call them yourself with just the values they need:
  `observable.add((data) => handler(data))`.
- Don't hand host objects to generated code. If a block needs to react to a control, take a callback
  option (see `UISlider`'s `onChange`).

## Rules for generators

- Put field values and other text into code with `JSON.stringify(value)`, which always produces a
  single string literal.
- The one exception is text written into a code comment (the comment block), which uses
  `sanitizeForCode`, because a comment is not a string literal.
- Identifiers come from `nameDB_.getName`, which sanitises them.

## Tests

The `@sandbox` suite (`tests/sandbox.test.js`, `npm run test:api sandbox`) runs real code through
`runCode` and covers each crossing above, including escape attempts. Add a case there for any new
API that returns, resolves to, or calls back with anything other than primitives.

To check for escapes by hand, run code like this through `runCode` and confirm it throws or is
dropped:

```js
const k = 'con' + 'structor';
someApiCall()[k][k]('return document')();
```
