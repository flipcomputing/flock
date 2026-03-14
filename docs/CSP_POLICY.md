# CSP policy rationale

Content Security Policy (CSP) is defined in two places:

1. **Primary enforcement**: response headers via Vite `server.headers` and `preview.headers`.
2. **Fallback**: `<meta http-equiv="Content-Security-Policy">` in `index.html`.

## Runtime source inventory (observed)

Core flows tested (app load, Blockly interaction, run code in sandbox, project export/import trigger, analytics path) observed these runtime source origins:

- **document / stylesheet / image / font / xhr**: `self` (`http://127.0.0.1:4173` in local smoke run)
- **script**: `self`, `https://www.googletagmanager.com`, `https://unpkg.com`
- **fetch / connect**: `self`, `https://www.google-analytics.com`, `https://unpkg.com`

## Why each non-self origin is required

- `https://www.googletagmanager.com`
  - Loads `gtag.js` analytics bootstrap script.
- `https://www.google-analytics.com`
  - Receives analytics `g/collect` requests.
- `https://stats.g.doubleclick.net`
  - Optional Google Analytics transport endpoint used by some environments.
- `https://region1.google-analytics.com`
  - Regional Google Analytics endpoint used by some environments.
- `https://unpkg.com`
  - Used by `manifold-3d` runtime assets (`manifold.js` / `manifold.wasm`) in browser execution.

## Current CSP

Header policy (authoritative):

```text
default-src 'self';
base-uri 'self';
form-action 'self';
object-src 'none';
script-src 'self' 'wasm-unsafe-eval' https://www.googletagmanager.com https://unpkg.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://www.google-analytics.com https://www.googletagmanager.com;
font-src 'self' data:;
connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://stats.g.doubleclick.net https://unpkg.com;
media-src 'self' data: blob:;
worker-src 'self' blob:;
frame-src 'self';
manifest-src 'self';
frame-ancestors 'self'
```

Meta fallback policy (for static hosting without headers): same as above but without `frame-ancestors`, because browsers ignore that directive when delivered in a `<meta>` tag.

## Notes on tightening

The policy uses strict defaults (`default-src 'self'`, `object-src 'none'`, explicit `connect-src`/`script-src`/`worker-src`) while preserving required runtime behavior.

One allowance remains intentionally broad:

- `'unsafe-inline'` in `style-src` — required for Blockly's runtime-injected inline styles (block colours, toolbox layout). Dynamically injected styles cannot be hashed, so this cannot be removed without modifying Blockly's theming internals.

`script-src` no longer requires `'unsafe-inline'` or `'unsafe-eval'`:

- The Google Analytics initialisation script was moved from an inline `<script>` block to `ga-init.js` (served from `self`), eliminating the only inline script in `index.html`.
- The `new Function(code)` syntax-check in `validateCode()` was removed; the AST-based `validateUserCodeAST()` already provides a stricter check before code reaches the sandbox.
- WASM execution (Draco, Manifold) is covered by `'wasm-unsafe-eval'`, which allows only WASM compilation rather than arbitrary JS `eval`.
- The sandbox iframe sets its own CSP (`script-src 'unsafe-inline' 'unsafe-eval'`) inside the iframe document — this is separate from the parent page's policy and governs only sandboxed user-code execution.

## CSP regression checks before merge

Run:

```bash
npm run build
npm run test:csp-smoke
```

Smoke check expectations:

- App shell loads and Blockly toolbox is interactive.
- Run button creates sandbox iframe execution path.
- Import/export controls can be triggered.
- Analytics request path is observed.
- No `securitypolicyviolation` events are recorded.
