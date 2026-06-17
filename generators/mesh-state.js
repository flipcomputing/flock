// Code relating to meshes and their state management.
// This includes the meshMap and meshBlockIdMap, which are used to track the
// association between block keys and their corresponding blocks and block IDs.

// Reverse-lookup Maps for O(1) access: block → blockKey and blockId → blockKey.
// Maintained automatically via Proxy traps on meshMap / meshBlockIdMap.
export const blockKeyByBlock = new Map();
export const blockKeyByBlockId = new Map();

// Internal usage only
function makeTrackedMap(raw, reverseMap) {
  return new Proxy(raw, {
    set(target, key, value, receiver) {
      const old = target[key];
      if (old !== undefined) reverseMap.delete(old);
      if (value != null) reverseMap.set(value, key);
      return Reflect.set(target, key, value, receiver);
    },
    deleteProperty(target, key) {
      const old = target[key];
      if (old !== undefined) reverseMap.delete(old);
      return Reflect.deleteProperty(target, key);
    },
  });
}

const _meshMap = Object.create(null);
const _meshBlockIdMap = Object.create(null);
// ----------------------------------------------------

export const meshMap = makeTrackedMap(_meshMap, blockKeyByBlock);
export const meshBlockIdMap = makeTrackedMap(
  _meshBlockIdMap,
  blockKeyByBlockId,
);

export function clearMeshMaps() {
  for (const key of Object.keys(_meshMap)) delete meshMap[key];
  for (const key of Object.keys(_meshBlockIdMap)) delete meshBlockIdMap[key];
}

let uniqueIdCounter = 0;

export function generateUniqueId(prefix = "") {
  // Increment the counter for each call
  uniqueIdCounter++;
  // Return a string with the prefix and the counter value
  return `${prefix}_${uniqueIdCounter}`;
}
