# Blockly Editor – Performance Review

> Reviewed: 2026-03-14
> Scope: `main/blocklyinit.js`, `main/blockhandling.js`, `blocks/blocks.js`, `ui/blockmesh.js`, `vite.config.mjs`

---

## Summary

The Blockly editor is well-structured and already includes several meaningful
optimisations: a centralised event-handler registry, RAF-throttled hover
highlights, debounced workspace cleanup, and PWA service-worker caching.
This review documents the remaining bottlenecks, ranked by impact, and
proposes concrete improvements for each.

---

## Already-Good Practices (for reference)

| Practice | Location |
|---|---|
| Single consolidated workspace listener (O(1) instead of O(N)) | `blockhandling.js:399` |
| `blockHandlerRegistry` Map – per-block dispatch | `blocks/blocks.js:33` |
| RAF-throttled mousemove / hover highlight | `blockhandling.js:505-625` |
| 300 ms debounced `workspace.cleanUp()` on structural events | `blockhandling.js:413-425` |
| `Blockly.Events.setGroup()` batching during block creation | various |
| PWA `CacheFirst` for static assets (365-day TTL) | `vite.config.mjs` |
| `requestIdleCallback` for search index construction | `blocklyinit.js:1943-1963` |
| In-source `flock.performanceOverlay` profiling tool | `blocklyinit.js:2120-2330` |

---

## Issue 1 – Handler snapshot allocated on every workspace event (High)

**File:** `blockhandling.js:450`

```js
// Current code — runs for EVERY workspace event (BLOCK_MOVE, viewport pan, …)
const handlers = [...blockHandlerRegistry.values()];
for (const handler of handlers) {
    handler(event);
}
```

The spread `[...blockHandlerRegistry.values()]` allocates a fresh array on
**every** workspace event, including high-frequency ones such as viewport pans
and renders. With dozens of registered blocks the heap pressure accumulates.

**Recommendation:** Only copy the registry when it has actually changed — track
a dirty flag, or iterate the map directly and guard against mid-iteration
mutation by disabling the events that would mutate the map inside a handler:

```js
// Option A – iterate directly (safe when handlers don't add/remove blocks)
for (const handler of blockHandlerRegistry.values()) {
    handler(event);
}

// Option B – rebuild snapshot only when the map changes (cheap dirty flag)
let handlerCache = null;

export function registerBlockHandler(block, handler) {
    if (!block.workspace || block.workspace.isFlyout) return;
    blockHandlerRegistry.set(block.id, handler);
    handlerCache = null; // invalidate
}
// … similarly in the delete purge path
// Then in the listener:
if (!handlerCache) handlerCache = [...blockHandlerRegistry.values()];
for (const handler of handlerCache) handler(event);
```

---

## Issue 2 – O(N) linear scans in mesh lookups (High)

**File:** `ui/blockmesh.js:102-124`

```js
// Both functions scan the entire map on every call:
export function getBlockKeyFromBlock(block) {
    return Object.keys(meshMap).find((key) => meshMap[key] === block);
}
export function getBlockKeyFromBlockID(blockId) {
    return Object.keys(meshBlockIdMap).find(
        (key) => meshBlockIdMap[key] === blockId,
    );
}

// These scan ALL scene meshes:
export function getMeshFromBlockKey(blockKey) {
    return flock.scene?.meshes?.find(
        (mesh) => mesh.metadata?.blockKey === blockKey,
    );
}
export function getMeshesFromBlockKey(blockKey) {
    return flock.scene?.meshes?.filter(
        (mesh) => mesh.metadata?.blockKey === blockKey,
    ) || [];
}
```

Every call to `getMeshFromBlock`, `deleteMeshFromBlock`, and related functions
triggers at least one O(N) scan of `meshMap` or `scene.meshes`. In a scene
with many objects these are called on every block-change event, so the cost
compounds.

**Recommendation:** Add reverse-lookup Maps:

```js
// In generators.js (or blockmesh.js) alongside meshMap / meshBlockIdMap:
export const blockToKeyMap  = new Map(); // mesh → blockKey
export const blockIdToKeyMap = new Map(); // blockId → blockKey

// Keep them in sync with meshMap writes, then replace the linear finds:
export function getBlockKeyFromBlock(block)    { return blockToKeyMap.get(block) ?? null; }
export function getBlockKeyFromBlockID(blockId) { return blockIdToKeyMap.get(blockId) ?? null; }
```

For `getMeshFromBlockKey` / `getMeshesFromBlockKey`: maintain a
`blockKeyToMeshes` Map updated whenever a mesh is added or disposed, instead
of scanning `scene.meshes`.

---

## Issue 3 – Immediate `cleanUp()` on block collapse/expand (Medium)

**File:** `blockhandling.js:427-436`

```js
// Collapse/expand triggers a synchronous cleanUp() with no debounce:
if (
    event.type === Blockly.Events.BLOCK_CHANGE &&
    event.element === "collapsed"
) {
    const block = workspace.getBlockById(event.blockId);
    if (block && !block.getParent()) {
        workspace.cleanUp(); // synchronous, re-positions ALL top-level blocks
    }
}
```

`workspace.cleanUp()` iterates and repositions every top-level block. Calling
it synchronously on collapse/expand is fine for small workspaces, but in large
projects with many top-level blocks this causes a visible layout stall.

**Recommendation:** Route this through the same debounced path:

```js
if (
    event.type === Blockly.Events.BLOCK_CHANGE &&
    event.element === "collapsed"
) {
    const block = workspace.getBlockById(event.blockId);
    if (block && !block.getParent()) {
        clearTimeout(cleanupTimeout);
        cleanupTimeout = setTimeout(() => { /* … same debounced body */ }, 150);
    }
}
```

---

## Issue 4 – `Blockly.getMainWorkspace()` called inside each handler on every event (Medium)

**File:** `ui/blockmesh.js:19`

```js
function isMainWorkspaceEvent(changeEvent, block) {
    const mainWs = Blockly.getMainWorkspace(); // global lookup, every call
    …
}
```

`isMainWorkspaceEvent` is invoked from every registered block handler on every
workspace event. `Blockly.getMainWorkspace()` performs a global registry
lookup; while inexpensive in isolation, it multiplies with the number of
handlers and events.

**Recommendation:** Cache the workspace reference once at module initialisation
time, or pass it in as a parameter:

```js
// blockmesh.js — top-level
let _mainWorkspace = null;
export function setMainWorkspace(ws) { _mainWorkspace = ws; }

function isMainWorkspaceEvent(changeEvent, block) {
    const mainWs = _mainWorkspace ?? Blockly.getMainWorkspace();
    …
}
```

Call `setMainWorkspace(workspace)` once from `blockhandling.js` after the
workspace is created.

---

## Issue 5 – Remaining per-block `setOnChange` listeners bypassing the registry (Medium)

Several blocks (including `keyword_block` and some shape blocks) still register
individual `setOnChange` listeners rather than going through
`blockHandlerRegistry`. Each `setOnChange` adds another workspace-level
listener, partially undoing the centralisation work.

**Recommendation:** Audit all block files for `setOnChange` usage and migrate
them to `registerBlockHandler`. A quick way to find candidates:

```bash
grep -rn "setOnChange" blocks/
```

For cases where `setOnChange` is needed for per-block side effects at
definition time, ensure the handler is always registered via
`registerBlockHandler` so it participates in the single consolidated dispatch.

---

## Issue 6 – `handleBlockDelete` traverses the full deleted-block JSON tree (Low–Medium)

**File:** `blocks/blocks.js:116-153`

```js
function deleteMeshesRecursively(blockJson) {
    // walks every input and `next` link recursively
}
deleteMeshesRecursively(event.oldJson);
```

For deeply nested or large stacks this is O(N) across all descendant blocks.
While deletes are infrequent, a user deleting a large snippet triggers this
immediately on the event thread.

**Recommendation:** Defer to the next microtask or idle callback, or flatten
the recursion into an iterative queue to avoid deep stack frames on large
deletions:

```js
function deleteMeshesFlat(rootJson) {
    const queue = [rootJson];
    while (queue.length) {
        const node = queue.shift();
        // process node …
        if (node.inputs) {
            for (const key of Object.keys(node.inputs)) {
                if (node.inputs[key].block) queue.push(node.inputs[key].block);
            }
        }
        if (node.next?.block) queue.push(node.next.block);
    }
}
```

---

## Issue 7 – Search index: all dropdown options added to `searchTerms` per block (Low)

**File:** `blocklyinit.js:1731-1768`

For blocks with large dropdowns (e.g. `shapes`, `materials`, `models`) every
dropdown option is added to the block's `searchTerms` Set. This inflates the
search index string produced at line 1857 and causes the fuzzy matcher to
compare against many irrelevant tokens.

This is a one-time startup cost but does increase memory and first-search
latency for large toolboxes.

**Recommendation:** Limit dropdown option indexing to the first
option (i.e. the default label) unless the user has specifically searched in a
way that suggests option-level matching:

```js
// Index only the currently selected/first option, not all options:
if (field instanceof Blockly.FieldDropdown) {
    const options = field.getOptions(true);
    if (options.length > 0) {
        const label = typeof options[0][0] === "string"
            ? options[0][0]
            : options[0][0]?.alt;
        if (label) searchTerms.add(label);
    }
}
```

---

## Issue 8 – `cleanUp()` runs on ALL structural changes (consideration)

The 300 ms debounce on `workspace.cleanUp()` is triggered by
`BLOCK_MOVE`, `BLOCK_CREATE`, and `BLOCK_DELETE`. In a typical editing session
these events fire frequently. `cleanUp()` re-positions every top-level block on
the canvas, which can cause disorienting jumps for users who have manually laid
out their workspace.

**Recommendation (UX + Performance):** Consider whether auto-cleanup should
run at all, or whether it should be opt-in (e.g. a "tidy" button). If kept,
track whether a user has manually moved blocks and suppress cleanup in that
case. At minimum, consider raising the debounce window to 500–1000 ms to
reduce interruptions during rapid editing.

---

## Issue 9 – Build: no code-splitting for Blockly (Low)

**File:** `vite.config.mjs`

The project uses `cssInjectedByJsPlugin()` (CSS inlined into JS) and does not
configure manual chunk splitting. The Blockly library (~1 MB+ minified),
BabylonJS, and application code are bundled into a single entry chunk.

**Recommendation:** Add a `manualChunks` entry in `build.rollupOptions` to
split Blockly into its own chunk, allowing parallel loading and better
long-term cache reuse:

```js
build: {
    rollupOptions: {
        output: {
            manualChunks: {
                blockly: ['blockly'],
                babylon: ['@babylonjs/core'],
            },
        },
    },
},
```

This ensures that a change to application code does not bust the cached
Blockly bundle.

---

## Prioritised Recommendations

| # | Issue | Impact | Effort |
|---|---|---|---|
| 1 | Avoid per-event handler-array allocation | High | Low |
| 2 | Reverse-lookup Maps for mesh/block lookups | High | Medium |
| 3 | Debounce collapse/expand `cleanUp()` | Medium | Low |
| 4 | Cache `getMainWorkspace()` result | Medium | Low |
| 5 | Migrate remaining `setOnChange` to registry | Medium | Medium |
| 6 | Flatten recursive block-delete traversal | Low–Med | Low |
| 7 | Limit dropdown option indexing in search | Low | Low |
| 8 | Reconsider auto-`cleanUp()` on every edit | Low–Med | Medium |
| 9 | Split Blockly into its own Rollup chunk | Low | Low |

---

## How to Verify Improvements

The project ships a built-in performance overlay (`flock.performanceOverlay` in
`blocklyinit.js:2120`). Enable it to baseline and compare:
- **EPS** (events/sec) — should drop after reducing allocations.
- **Render time** — watch for spikes during block moves/collapses.
- **SVG node count** — useful for detecting runaway DOM growth.
- **Pan FPS** — confirms hover-highlight throttle is working.

For the mesh lookup changes, add `console.time` / `console.timeEnd` guards
around `getMeshesFromBlockKey` calls before and after introducing the reverse
Map.
