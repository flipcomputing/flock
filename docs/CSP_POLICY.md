# CSP policy rationale

Content Security Policy (CSP) is defined in two places:

1. **Primary enforcement**: response headers via Vite `server.headers` and `preview.headers`.
2. **Fallback**: `<meta http-equiv="Content-Security-Policy">` in `index.html`.

## Runtime source inventory (observed)

Core flows tested (app load, Blockly interaction, run code in sandbox, project export/import trigger, analytics path) observed these runtime source origins:

- **document / stylesheet / image / font / xhr**: `self` (`http://127.0.0.1:4173` in local smoke run)
- **script**: `self`, `https://www.googletagmanager.com`
- **fetch / connect**: `self`, `https://www.google-analytics.com`

## Why each non-self origin is required

- `https://www.googletagmanager.com`
  - `script-src`: loads `gtag.js` analytics bootstrap script.
  - `connect-src` / `img-src`: analytics ping traffic originating from GTM tags.
- `https://www.google-analytics.com`
  - `img-src` / `connect-src`: receives analytics `g/collect` requests (beacon/pixel and fetch transport).
  - Not required in `script-src`; GA scripts are served via GTM, not directly from this origin.
- `https://stats.g.doubleclick.net`
  - `connect-src`: optional Google Analytics transport endpoint used by some environments.
- `https://region1.google-analytics.com`
  - `connect-src`: regional Google Analytics endpoint used by some environments.
- `https:` (wildcard HTTPS) in `connect-src`
  - User programs running in the sandboxed iframe share the host page's origin, so their `fetch()` calls and asset loads are governed by this CSP. `https:` allows user programs to connect to arbitrary HTTPS endpoints without triggering CSP violations.

## Current CSP

Header policy (authoritative):

```text
default-src 'self';
base-uri 'self';
form-action 'self';
object-src 'none';
script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://www.googletagmanager.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://www.google-analytics.com https://www.googletagmanager.com;
font-src 'self' data:;
connect-src 'self' https: https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://stats.g.doubleclick.net;
media-src 'self' data: blob:;
worker-src 'self' blob:;
frame-src 'self';
manifest-src 'self';
frame-ancestors 'self'
```

Meta fallback policy (for static hosting without headers): same as above but without `frame-ancestors`, because browsers ignore that directive when delivered in a `<meta>` tag.

## Notes on tightening

The policy uses strict defaults (`default-src 'self'`, `object-src 'none'`, explicit `connect-src`/`script-src`/`worker-src`) while preserving required runtime behavior.

Three allowances remain intentionally broad:

- `'unsafe-inline'` in `script-src` / `style-src` due to inline scripts/styles in `index.html` and iframe sandbox bootstrap.
- `'unsafe-eval'` + `'wasm-unsafe-eval'` in `script-src` to support current sandbox/runtime execution stack.
- `https:` in `connect-src` to allow user programs to make outbound HTTPS fetch requests (see above).

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
