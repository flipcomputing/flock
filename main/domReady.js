// In production the app's modules can run after DOMContentLoaded: a strict CSP only trusts
// scripts that a hashed script creates, and the browser doesn't hold the event for those
// (see vite.config.mjs). Callbacks registered after the event run once every module has been
// evaluated, in registration order, as they did when the event fired.
const queued = [];

function runQueued() {
  for (const callback of queued.splice(0)) {
    try {
      callback();
    } catch (error) {
      reportError(error);
    }
  }
}

// readyState can't tell before the event from after it, and the dev server's page has two
// module scripts, so waiting for the event when it hasn't fired keeps them both ahead of it.
function domContentLoadedStarted() {
  const [navigation] = performance.getEntriesByType('navigation');
  return navigation ? navigation.domContentLoadedEventStart > 0 : document.readyState !== 'loading';
}

export function whenDomReady(callback) {
  if (!domContentLoadedStarted()) {
    document.addEventListener('DOMContentLoaded', callback);
    return;
  }
  queued.push(callback);
  if (queued.length === 1) queueMicrotask(runQueued);
}
