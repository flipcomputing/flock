# CSP policy rationale

Flock XR now defines Content Security Policy (CSP) in two places:

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

```text
default-src 'self';
base-uri 'self';
form-action 'self';
object-src 'none';
frame-ancestors 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://www.googletagmanager.com https://unpkg.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://www.google-analytics.com https://www.googletagmanager.com;
font-src 'self' data:;
connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://stats.g.doubleclick.net https://unpkg.com;
media-src 'self' data: blob:;
worker-src 'self' blob:;
frame-src 'self';
manifest-src 'self'
```

## Notes on tightening

Policy was tightened to strict defaults (`default-src 'self'`, `object-src 'none'`, explicit `connect-src`/`script-src`/`worker-src`) while preserving required runtime behavior.

Two allowances remain intentionally broad enough for current implementation:

- `'unsafe-inline'` in `script-src` / `style-src` due to inline scripts/styles in `index.html` and iframe sandbox bootstrap.
- `'unsafe-eval'` + `'wasm-unsafe-eval'` in `script-src` to support current sandbox/runtime execution stack.

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
