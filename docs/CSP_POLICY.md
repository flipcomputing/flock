# CSP policy rationale

## Where the policy lives

Every Content Security Policy (CSP) is defined once, in `vite.config.mjs`:

| Defined as | Used for |
| --- | --- |
| `productionMetaPolicy()` | The production policy. The build computes it once and uses it in the `<meta http-equiv="Content-Security-Policy">` tag, and, with `frame-ancestors 'self'` added, in `dist/_headers`. `vite preview` sends the policy from `dist/_headers` |
| `CSP_DEV_META_POLICY` / `CSP_DEV_POLICY` | The dev server's meta and header policies: no analytics domains, `ws:` for Vite's hot reload, and `'unsafe-inline'` scripts (see below) |

`index.html` holds a `__FLOCK_CSP_META__` placeholder. The `inject-csp-meta` plugin fills it with the dev
policy when serving, and with the production policy at the end of the build. The build fails if a
placeholder is left in any HTML file, because a page with no valid meta policy would have no CSP at all
on GitHub Pages.

## Script hashes instead of `'unsafe-inline'`

The production `script-src` has no `'unsafe-inline'`. Instead it lists a SHA-256 hash for each inline
script the page runs, so an injected `<script>` is blocked:

- every inline script left in the built HTML. These are hashed from the final output, after Vite has
  moved inline module scripts into files;
- the SES script that `runtime/sandbox.js` injects into the sandbox iframe. Its hash is the same one used
  for its integrity check;
- the wrapper script in `runtime/sandboxWrap.js`, which `runtime/sandbox.js` imports with `?raw` and
  injects into the sandbox iframe.

The hashes are computed on every build, so editing an inline script needs no manual step. Two things
still break it:

- **Inline event handlers** (`onclick="…"`) and `javascript:` URLs can't be allowed by a hash. Use
  `addEventListener` instead.
- **Inline scripts added at runtime**, other than the two sandbox scripts, are blocked. Load them from a
  file, or add their source to the build's hash list.

The dev server keeps `'unsafe-inline'`, because its header is fixed while it serves pages such as
`tests.html` with their own inline scripts. `npm run test:csp-smoke` checks the production policy.

## Deployments

| Deployment | Policy |
| --- | --- |
| `app.flockxr.com` (Cloudflare Pages) | `_headers` (the production policy, `X-Frame-Options: SAMEORIGIN` and others), plus the meta tag |
| `flipcomputing.github.io/flock/` (GitHub Pages) | The meta tag only. GitHub Pages can't send custom headers |
| Dev server | `CSP_DEV_POLICY` header, plus the dev meta tag |

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

Project code runs in an SES compartment inside a hidden iframe (see `dev-docs/SANDBOX.md`). The iframe has
its own policy, set in `runtime/sandbox.js`:

```text
default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' 'unsafe-eval'
```

The iframe is created with `srcdoc`, so it also inherits the page's policy, and both apply. The iframe is
same-origin, so this policy only limits code that stays inside the SES compartment. Code that escaped would
reach the editor page and its policy. The compartment and the code check (see `dev-docs/SANDBOX.md`) are
what prevent that.

## Why each non-self origin is allowed

- `https://www.googletagmanager.com`
  - `script-src`: loads the `gtag.js` analytics script.
  - `connect-src` / `img-src`: analytics requests made by those tags.
- `https://www.google-analytics.com`, `https://region1.google-analytics.com`, `https://stats.g.doubleclick.net`
  - `connect-src` (and `img-src` for the first): Google Analytics collection endpoints.
- `https://static.cloudflareinsights.com`
  - `script-src`: Cloudflare's analytics script, added by Cloudflare on `app.flockxr.com`.

These analytics scripts run with full access to the editor page. That's an accepted trade-off.

## Directives set to `'none'`

- `object-src 'none'`: Flock embeds no plugins.
- `base-uri 'none'`: Flock has no `<base>` element, so injected markup can't change where relative
  URLs resolve.
- `form-action 'none'`: Flock submits no forms. Saving and importing use downloads and file inputs, which
  this doesn't cover.

## Why the broad allowances are needed

- `'unsafe-eval'` in `script-src`: SES evaluates project code inside the sandbox iframe, which inherits the
  page policy.
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
- no `securitypolicyviolation` events were recorded;
- analytics requests were made.

It writes a summary to `artifacts/csp-smoke-summary.json`.
