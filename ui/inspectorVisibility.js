// Babylon's inspector skips any entity whose reservedDataStore.hidden is true.
// Set flock.showInternalNodes = true to reveal Flock's internal nodes again.

let showInternalNodes = false;

function applyHidden(node) {
  const store = node.reservedDataStore || (node.reservedDataStore = {});
  store.flockInternal = true;
  store.hidden = !showInternalNodes;
}

export function hideFromInspector(node) {
  if (node) applyHidden(node);
  return node;
}

export function getShowInternalNodes() {
  return showInternalNodes;
}

export function setShowInternalNodes(show, scene) {
  showInternalNodes = !!show;

  const nodes = [...(scene?.meshes ?? []), ...(scene?.transformNodes ?? [])];
  nodes.forEach((node) => {
    if (node?.reservedDataStore?.flockInternal) applyHidden(node);
  });

  return showInternalNodes;
}
