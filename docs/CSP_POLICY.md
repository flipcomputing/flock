# CSP policy rationale

## Where the policy lives

Every Content Security Policy (CSP) is defined once, in `vite.config.mjs`:

| Defined as | Used for |
| --- | --- |
| `productionMetaPolicy()` | The production policy. The build computes it once and uses it in the `<meta http-equiv="Content-Security-Policy">` tag, and, with `frame-ancestors 'self'` added, in `dist/_headers`. `vite preview` sends the policy from `dist/_headers` |
| `CSP_DEV_META_POLICY` / `CSP_DEV_POLICY` | The dev server's meta and header policies: no analytics domains, `ws:` for Vite's hot reload, `'unsafe-inline'` scripts (see below), and `'unsafe-eval'`, because the browser tests compile generated code |
| `sandboxDocument()` | The sandbox iframe's document, `sandbox.html`, with its own meta policy (see "The sandbox iframe"). The build emits it, and the dev server serves it from the same function |

`index.html` holds a `__FLOCK_CSP_META__` placeholder. The `inject-csp-meta` plugin fills it with the dev
policy when serving, and with the production policy at the end of the build. The build fails if a
placeholder is left in any HTML file, because a page with no valid meta policy would have no CSP at all
on GitHub Pages.

## A strict policy

The production editor page has a strict CSP in Google's sense, and passes Lighthouse's "CSP is
effective against XSS" check: scripts are trusted by hash and `'strict-dynamic'`, never by host, and
there is no `'unsafe-inline'` or `'unsafe-eval'`.

- **Hashes.** The policy lists a SHA-256 hash for each inline script in the built HTML, hashed from the
  final output. An injected `<script>`, inline or with a `src`, is blocked.
- **`'strict-dynamic'`.** A script a hashed script creates is trusted, and so is everything it imports.
  Nothing else is: browsers that support `'strict-dynamic'` ignore `'self'` and
  `https://www.googletagmanager.com`, which are only a fallback for browsers that don't. So an injected
  `<script src>` is blocked whatever host it names, including a Tag Manager container or one of Flock's
  own files.
- **No `'unsafe-eval'`.** The editor page can't turn a string into code with `eval`, `new Function` or a
  string `setTimeout`, so no bug or library can be tricked into running text as code. Only the sandbox
  document allows it (see "The sandbox iframe"). This also closes a known bypass: a Tag Manager container
  runs its custom code with `eval`.

How the page loads its scripts under this policy:

- **The app.** The build replaces Vite's `<script type="module" src>` entry with a `modulepreload` link,
  so the fetch still starts early, and a hashed loader at the end of `<body>` creates the module script.
  A hashed inline module can't simply `import` the entry: its imports would count as parser-inserted.
  The loader must run while the page parses, because Firefox doesn't hold the `load` event for a script
  created later, and `main.js` starts the app from `window.onload`.
- **`gtag.js`.** The hashed analytics snippet in `index.html` adds the script itself.
- **The service worker.** `injectRegister: 'inline'` makes its registration an inline script, so it is
  hashed.

The build fails if any `<script>` with a `src` is left in the HTML, since the policy would block it.

Modules created by the loader can run after `DOMContentLoaded`, which browsers don't hold for them. App
code therefore uses `whenDomReady` (`main/domReady.js`) instead of a `DOMContentLoaded` listener, and an
ESLint rule enforces it. `whenDomReady` waits for the event if it hasn't started, and otherwise runs its
callbacks, in order, once every module has been evaluated.

The hashes are computed on every build, so editing an inline script needs no manual step. These break
the policy:

- **Inline event handlers** (`onclick="…"`) and `javascript:` URLs can't be allowed by a hash. Use
  `addEventListener` instead.
- **A `<script src>` tag in the HTML.** Create the script from an existing hashed script instead.
- **Inline scripts added at runtime** are blocked. Load them from a file, or add their source to the
  build's hash list.
- **Code that compiles strings** in the editor page, in Flock or in a dependency, throws an `EvalError`.
  `npm run test:csp-smoke` catches it.

`'strict-dynamic'` trusts whatever trusted code loads, so Flock code must never create a script from
data: a project file, a URL parameter or anything a user supplies.

The dev server keeps `'unsafe-inline'`, because its header is fixed while it serves pages such as
`tests.html` with their own inline scripts. `npm run test:csp-smoke` checks the production policy.
The dev policy has no analytics domains, so in dev the console shows `gtag.js` blocked. That is expected.

## Deployments

| Deployment | Policy |
| --- | --- |
| `app.flockxr.com` (Cloudflare Pages) | `_headers` (the production policy, `X-Frame-Options: SAMEORIGIN` and others), plus the meta tag. `_headers` removes the policy header from `sandbox.html`, which Cloudflare also serves as `/sandbox`, so the sandbox document has only its own meta policy |
| `flipcomputing.github.io/flock/` (GitHub Pages) | The meta tag only. GitHub Pages can't send custom headers |
| Dev server | `CSP_DEV_POLICY` header, plus the dev meta tag |

The sandbox document must never get the editor's policy as well. Both would apply, and the editor's would
block SES. `vite preview` leaves it out the same way.

Browsers ignore `frame-ancestors` in a meta tag, so on GitHub Pages nothing in the policy stops another
site from framing the editor. Instead, the editor refuses to start when another site frames it
(`isFramedByOtherSite` in `main/files.js`). It shows a message with a link to open Flock XR in a new tab.

## Other headers

`_headers` also sends:

- `Strict-Transport-Security: max-age=31536000`. Once a browser has received it over HTTPS, it uses
  HTTPS for `app.flockxr.com` for the next year. It doesn't cover a browser's first visit: that request
  can still go over HTTP, which Cloudflare redirects to HTTPS. Only `preload` would cover first visits,
  and it is left out with `includeSubDomains` because both are hard to undo. GitHub Pages sends its own.
- `Cross-Origin-Opener-Policy: same-origin`, so a page on another site that opens Flock, or that Flock
  opens, gets no window reference to it. Flock never talks to another site's window: external links
  use `noopener`, and the Inspector's pop-outs are blocked (`main/view.js`). The dev and preview servers
  send it too, so the tests run under it.
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy`.

Cloudflare Pages adds `Access-Control-Allow-Origin: *` to every file. That lets scripts on other sites
read the responses to requests sent without credentials. A request made with credentials can still send
cookies, but the browser doesn't show its response to the requesting script, because `*` doesn't allow
that. Flock's files are public and the same for everyone, so either way nothing private is exposed.

## The sandbox iframe

Project code runs in an SES compartment inside a hidden iframe (see `dev-docs/SANDBOX.md`). The iframe
loads `sandbox.html`, a same-origin document with its own policy:

```text
default-src 'none'; base-uri 'none'; form-action 'none'; style-src 'unsafe-inline';
script-src <SES hash> <sandboxWrap.js hash> 'unsafe-eval'
```

The hashes allow the two scripts `runtime/sandbox.js` injects: the SES script, whose hash is also its
integrity check, and `runtime/sandboxWrap.js`, imported with `?raw`. The dev server hashes the wrapper on
each request, so editing it needs no restart.

It's a document of its own, not `srcdoc`, because a `srcdoc` iframe inherits the editor's policy, and SES
needs `'unsafe-eval'`. Browsers check the policy of the document that owns the `eval` or `Function` being
called, not the caller's, so SES can compile project code in the iframe while the editor page can't
compile anything. Chromium, Firefox and WebKit all behave this way.

`runCode` refuses an iframe whose document lacks the `data-flock-sandbox` marker. That stops a 404 page
or the service worker's offline fallback (`index.html`) standing in for it. The service worker
precaches `sandbox.html` and leaves it out of the navigation fallback.

The iframe is same-origin, so this policy only limits code that stays inside the SES compartment. Code
that escaped would reach the editor page and its policy. The compartment and the code check (see
`dev-docs/SANDBOX.md`) are what prevent that.

## Why each non-self origin is allowed

- `https://www.googletagmanager.com`
  - `script-src`: a fallback for browsers without `'strict-dynamic'`, which load `gtag.js` by host. Other
    browsers trust it because the hashed snippet creates it.
  - `connect-src` / `img-src`: analytics requests made by those tags.
- `https://www.google-analytics.com`, `https://region1.google-analytics.com`, `https://stats.g.doubleclick.net`
  - `connect-src` (and `img-src` for the first): Google Analytics collection endpoints.

Cloudflare Web Analytics is not used: Cloudflare would inject its beacon as a `<script src>` tag, which
the policy blocks. Its automatic setup must stay off for `app.flockxr.com` in the Cloudflare dashboard.

These analytics scripts run with full access to the editor page. That's an accepted trade-off.

## Directives set to `'none'`

- `object-src 'none'`: Flock embeds no plugins.
- `base-uri 'none'`: Flock has no `<base>` element, so injected markup can't change where relative
  URLs resolve.
- `form-action 'none'`: Flock submits no forms. Saving and importing use downloads and file inputs, which
  this doesn't cover.

## Why the broad allowances are needed

- `'unsafe-eval'` in the sandbox document only: SES evaluates project code there.
- `'wasm-unsafe-eval'` in `script-src`: the Havok physics and Manifold WebAssembly modules.
- `'unsafe-inline'` in `style-src`: Blockly and Babylon.js add inline styles.
- `https:` in `connect-src`: Flock can load a project file from any `https://` address the user approves
  (`?project=`). Project code itself has no `fetch`, and the sandbox iframe's own policy blocks connections.

## Regression check before merge

```bash
npm run build
npm run test:csp-smoke
```

`test:csp-smoke` serves `dist/` with `vite preview`, which sends the production headers. It then loads the
editor, runs a project, triggers save and import, and checks that:

- the SES and wrapper scripts ran in the sandbox iframe, so their hashes match;
- no `securitypolicyviolation` events were recorded, in the editor page or the sandbox document;
- the editor page blocks `eval`;
- analytics requests were made.

It writes a summary to `artifacts/csp-smoke-summary.json`.
