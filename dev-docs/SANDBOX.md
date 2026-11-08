# Sandbox security

User programs must only be able to reach the Flock API. This page explains how that boundary works
and the rules for API and generator code that keep it intact.

## Threat model

In the editor, code reaches `flock.runCode` only through the Blockly generators. A project file
(shared, imported, or loaded with `?project=`) is untrusted JSON. There are three lines of defence:

1. **Generators** must never let field text become code.
2. **The code check** refuses any program that uses syntax, names or properties the generators
   don't produce, so injected code can only do what blocks can do.
3. **The sandbox** must stop generated code reaching anything except the API.

Flock only runs projects inside its own editor, so a project never runs with another site's access.

## How the sandbox works

`runCode` (`flock.js`) runs user code in an SES `Compartment` inside a hidden same-origin iframe
whose realm has been locked down. The API, Babylon and the editor UI live in the host page, which is
**not** locked down. Any host object that user code can reach exposes the host's untamed `Function`
through `.constructor.constructor`, which is a full escape.

The API is exposed through `createWhitelist`. Every function is wrapped by `__flockWrapHostFn`, a
sandbox-side script injected before `lockdown()`. The wrapper converts everything that crosses the
boundary, in both directions.

Neither side ever receives the other side's objects. Arrays and plain objects are copied, own data
properties only, into fresh objects that only the wrapper holds. The copy never calls a method,
getter, setter or `then()` on the original. This does not depend on how an API uses its arguments,
so a new API is safe even if it calls `.map()` on an array or writes into an options object.

| Crossing | Handling |
| --- | --- |
| Arguments passed in | Primitives pass. Arrays, plain objects and prototype-free objects are deep-copied. Functions are wrapped. Promises become fresh promises whose results are converted. **Anything else is refused**: other prototypes, getters or setters, and nesting deeper than 16 levels. A refused call reports a `Flock sandbox: <api> cannot take …` error on the host page, and user code gets an `AbortError` |
| Return values | Primitives pass. Arrays (from either realm), sandbox plain objects and prototype-free objects are deep-copied (frozen if the original was). Host promises become sandbox promises. Wrapped callbacks come back as the user's original function. **Any other host value becomes `undefined`**, with a `Flock sandbox: dropped a host object from <api>` warning |
| Errors (sync or async) | Never passed to user code. User code gets a sandbox `AbortError`; the original error goes to the host page's normal reporting |
| Functions passed in (at any depth) | Wrapped once (cached, so identity is stable for `loadSection`/`unloadSection`). Arguments the host calls them with go through the return-value rules. Their results go through the argument rules, and anything they throw reaches the host as a fresh `Error` carrying only the name, message and stack as strings |
| The project's own result | `c.evaluate` is settled through `__flockSettle`, so a project error reaches `runCode` as a fresh `Error` too |
| Unhandled rejections and uncaught errors | The iframe's listeners are in the wrapper script. They convert the value like a callback error before calling the host's `__flockReportProjectError` |

## The code check

`prepareUserCode` (`runtime/sandbox.js`) parses the program before it runs and refuses it unless:

- every syntax node type is in `ALLOWED_NODE_TYPES`. There is no `this`, class, template literal,
  destructuring, rest parameter or `import()`;
- every name either is declared in an enclosing scope, or is an API name or one of `ALLOWED_GLOBALS`;
- every `.name` property access is in `ALLOWED_PROPERTIES`, which has no `constructor`, `__proto__` or
  `prototype`;
- object literals have plain keys only: no getters, setters, computed keys or `__proto__`.

It then rewrites every computed access `a[x]` to `a[__flockIndex((x))]`. `__flockIndex` is defined in
the sandbox realm by `sandboxWrap.js`. It passes primitives and integer strings (the keys `for…in`
gives) and throws for any other string, object or symbol, so no key can name `constructor` and the
like. The name is reserved: source code that mentions it is refused, and the global is read-only.

Code can only get hold of a new object through a name, a property, a computed key, syntax such as
`this`, or code the engine runs for it, such as a getter. The check closes each of these, so even if a
host object reached user code, there would be no path from it to `Function` or the page.

The iframe is same-origin, so an escape from the Compartment reaches the editor page. The code check
does not depend on SES or the wrapper, so it still holds if either has a flaw.

### Changing the allowlists

The generators are not trusted to avoid danger: anything they emit outside the allowlists is refused.
What is trusted is each allowlist entry, so every new entry needs review:

- A property must be safe on any object, including a host object that leaked by mistake. It must not
  return a constructor, a prototype or a function the code didn't already have, and must not let code
  call a function it holds with arguments of its choosing. So `constructor`, `__proto__`,
  `prototype`, `caller`, `callee`, `apply`, `call`, `bind`, `__defineGetter__` and
  `__lookupGetter__` never go in.
- A global must be one of the iframe realm's locked-down built-ins with nothing to reach but values.
  `Object`, `Reflect`, `Proxy`, `Function`, `Symbol`, `Error`, `globalThis` and anything from the
  browser never go in.
- Syntax must not hand code an object it didn't name or run code on its behalf. `this`, `arguments`,
  classes, `super`, getters, setters, tagged templates and `import()` never go in.

Prefer changing the generator. `math_on_list` min and max use spread (`Math.max(...list)`) instead
of Blockly's `Math.max.apply(null, list)` so that `apply` stays off the list. A block that needs a
string key, such as a dictionary, should go through an API helper backed by a `Map` rather than
`obj[key]`.

## Rules for API code

- Return primitives, or names and IDs that the API looks up later (meshes, instruments, sounds).
  Don't return Babylon objects, plain host objects or functions; they'll arrive as `undefined`.
- If a function only needs to wait, resolve to nothing. Watch for `Promise.all` and `whenModelReady`
  resolving to arrays of meshes or to a mesh.
- For small structured values, return a frozen object with no prototype (see `createVector3`).
- Arguments are copies, so changes the API makes to an array or options object are not seen by user
  code. Return the result instead.
- Don't pass user callbacks straight to Babylon observables, which call them with
  `(eventData, eventState)`. Call them yourself with just the values they need:
  `observable.add((data) => handler(data))`.
- Don't hand host objects to generated code. If a block needs to react to a control, take a callback
  option (see `UISlider`'s `onChange`).

## Rules for generators

- Put field values and other text into code with `JSON.stringify(value)`, which always produces a
  single string literal.
- The one exception is text written into a code comment, which uses `toLineComment`, because a
  comment is not a string literal. It splits on every JavaScript line terminator (`\r`, `\n`, U+2028,
  U+2029) before adding `// `, so no line can end the comment early. The comment block uses it, and
  so does Flock's `scrub_` override for comments attached to blocks. Blockly's own `scrub_` only
  splits on `\n`, so don't remove the override.
- Dropdown values that choose between API functions go through a fixed lookup table, never into a
  function name (see `control_animation_group`).
- Identifiers come from `nameDB_.getName`, which sanitises them.
- Generated code may only use what the code check allows. Index lists with `[]`, never with a string
  key. If a generator needs a new property, global or kind of syntax, first try to avoid it; otherwise
  add it to the allowlist in `runtime/sandbox.js` after the review in "Changing the allowlists".

## Tests

The `@sandbox` suite (`tests/sandbox.test.js`, `npm run test:api sandbox`) runs real code through
`runCode` and covers each crossing above, including escape attempts. These include user values that
carry their own `map`, `forEach`, setter or `then`. Add a case there for any new API that returns,
resolves to, or calls back with anything other than primitives. These cases stub `prepareUserCode`
so they test the sandbox on its own; the cases under "with the code check" test the check.

`tests/security/generated-code-check.test.js` (`npm run test:api security`) generates code for every
toolbox block, each short dropdown's options, and every example project, and confirms the check
accepts it. A failure there means a generator emits something the allowlists don't have yet.

To check for escapes by hand, stub `flock.prepareUserCode = (code) => code`, run code like this
through `runCode`, and confirm it throws or is dropped:

```js
const k = 'con' + 'structor';
someApiCall()[k][k]('return document')();
```
