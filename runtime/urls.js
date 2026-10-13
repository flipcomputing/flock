export function flockConfigUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value, document.baseURI);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
  } catch {
    /* fall through */
  }
  console.warn('FLOCK_CONFIG: ignoring non-http(s) URL', value);
  return null;
}

// A base URL must end in '/' or `new URL(relative, base)` drops its last path
// segment. Vite's BASE_URL normally has the slash, but the GitHub Pages deployer
// passes `--base=/flock`, so guard against it (and against a slashless FLOCK_CONFIG).
function ensureTrailingSlash(url) {
  const parsed = new URL(url);
  if (!parsed.pathname.endsWith('/')) parsed.pathname += '/';
  return parsed.href;
}

export function flockRuntimeBase() {
  const configured =
    typeof window !== 'undefined' && window.FLOCK_CONFIG && window.FLOCK_CONFIG.runtimeBaseUrl;
  const base =
    flockConfigUrl(configured) || new URL(import.meta.env.BASE_URL, import.meta.url).href;
  return ensureTrailingSlash(base);
}

export function flockRuntimeUrl(relativePath) {
  return new URL(relativePath, flockRuntimeBase()).href;
}

export function flockAssetBase() {
  const configured =
    typeof window !== 'undefined' && window.FLOCK_CONFIG && window.FLOCK_CONFIG.assetBase;
  const base = flockConfigUrl(configured);
  return base ? ensureTrailingSlash(base) : flockRuntimeBase();
}
