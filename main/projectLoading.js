// True while a saved project is being loaded into the workspace, so block
// handlers can tell its replayed events from the user's own edits.
let projectLoading = false;

export function isProjectLoading() {
  return projectLoading;
}

export function setProjectLoading(loading) {
  projectLoading = loading;
}

// Read-only, for test scripts that wait on the page from outside.
Object.defineProperty(window, 'loadingCode', {
  get: isProjectLoading,
  configurable: true,
});
