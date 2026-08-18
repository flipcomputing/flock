// Shared debug-mode flag: on by default on localhost, elsewhere only via
// an explicit ?debug=1 URL param (deliberately not a menu toggle — this app
// is used by kids, and a query param is much harder to stumble into).
export function isDebugModeEnabled({
  hostname = window.location.hostname,
  search = window.location.search,
} = {}) {
  const params = new URLSearchParams(search);
  if (params.has('debug')) return params.get('debug') === '1';
  return hostname === 'localhost';
}
