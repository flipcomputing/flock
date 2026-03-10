# Blockly Editor Performance Review

## Summary

This review covers the Blockly editor implementation across the following key files:

- `main/blockhandling.js` — event handling, workspace cleanup, drag logic, hover highlight
- `main/blocklyinit.js` — workspace initialization, search plugin, connection checker
- `blocks/blocks.js` — custom block definitions, renderer, variable management

Performance issues are ranked by severity: **Critical**, **Significant**, and **Minor**.

---

## Critical Issues

### 1. Unthrottled `mousemove` in Drag Logic

**Location:** `blockhandling.js:457–573`

**Problem:**
When a `when_clicked` block is dragged, a `mousemove` listener is attached to the canvas that calls `checkIfOverAnyBlock` on _every single mouse movement pixel_:

```js
workspace.getCanvas().addEventListener("mousemove", onMouseMove);

function checkIfOverAnyBlock(sourceBlock) {
    const allBlocks = workspace.getAllBlocks();  // O(n) — every frame!
    for (let i = 0; i < allBlocks.length; i++) {
        if (isBlockOverAnotherBlock(sourceBlock, allBlocks[i])) { ... }
    }
}

function isBlockOverAnotherBlock(source, target) {
    const sourcePosition = sourceBlock.getRelativeToSurfaceXY(); // DOM read
    const targetPosition = targetBlock.getRelativeToSurfaceXY(); // DOM read
    ...
}
```

This fires raw DOM events with no throttling. For a workspace with 100 blocks, every mouse
movement triggers: 1× `getAllBlocks()` + 100× `getRelativeToSurfaceXY()` calls.

Contrast this with the well-implemented `installHoverHighlight()` in the same file, which uses
`requestAnimationFrame` to batch mousemove events to once per frame.

**Recommendation:**
Throttle using `requestAnimationFrame`, the same pattern already used in `installHoverHighlight`:

```js
let rafPending = false;

function onMouseMove(event) {
    if (!draggedBlock || rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
        rafPending = false;
        if (draggedBlock) checkIfOverAnyBlock(draggedBlock);
    });
}
```

Additionally, the feature this code implements (adding dummy `next_statement` / `previous_statement`
blocks during drag) appears incomplete and non-functional — the block types used (`next_statement`,
`previous_statement`) don't appear to be registered blocks. Consider removing this dead code
entirely, which would eliminate the performance cost altogether.

---

### 2. O(n²) Variable Scanning in `adoptIsolatedDefaultVarsTo`

**Location:** `blocks/blocks.js:538–607`

**Problem:**
For each descendant block in a copy/paste subtree, the function calls `workspace.getAllBlocks(false)`
to check if a variable is used outside the subtree:

```js
for (const b of collectInputDescendants(rootBlock)) {   // O(d) descendants
    const fields = getVariableFieldsOnBlock(b, BlocklyNS);
    for (const f of fields) {
        let usedOutside = false;
        const allBlocks = workspace.getAllBlocks(false);  // O(n) — per descendant!
        for (const bb of allBlocks) {                    // O(n) scan — per field!
            ...
        }
    }
}
```

For a paste of a block with 10 descendants in a workspace of 100 blocks, this triggers up to
1,000 block iterations per paste event.

**Recommendation:**
Pre-compute a single workspace-wide map of `varId → Set<blockId>` once before the loops, then use
that map for O(1) lookups:

```js
// Build a reverse-index once: varId -> Set of blockIds using it
const varUsageMap = new Map();
for (const b of workspace.getAllBlocks(false)) {
    for (const f of getVariableFieldsOnBlock(b, BlocklyNS)) {
        const vid = f.getValue?.();
        if (vid) {
            if (!varUsageMap.has(vid)) varUsageMap.set(vid, new Set());
            varUsageMap.get(vid).add(b.id);
        }
    }
}

// Then check usedOutside in O(1):
const usedOutside = [...(varUsageMap.get(vid) ?? [])].some(id => !descendantIds.has(id));
```

This reduces the overall complexity from O(d × n) to O(n + d).

---

### 3. Per-Block `setOnChange` Listener Explosion

**Location:** `blocks/blocks.js`, `blocks/shapes.js`, `blocks/transform.js`, etc. (40 occurrences across 11 files)

**Problem:**
Every `create_*` and `load_*` block registers its own `setOnChange` listener via `this.setOnChange(...)`.
Blockly's `setOnChange` registers a listener on the block itself, but every workspace event is
dispatched to every block's listener. With 50 create/load blocks in a workspace, a single field
change event invokes `handleBlockChange` 50 times.

Each invocation of `handleBlockChange` performs:
- `handleBlockCreateEvent()` — variable naming logic
- `findCreateBlock()` — walks the parent chain
- `isValueInputDescendantOf()` — walks the input chain
- Potentially `updateOrCreateMeshFromBlock()` — 3D preview update

**Recommendation:**
Consolidate into a single workspace-level change listener that dispatches to only the relevant block:

```js
// Single workspace listener (in blocklyinit.js or blockhandling.js)
workspace.addChangeListener((event) => {
    if (event.type !== Blockly.Events.BLOCK_CHANGE &&
        event.type !== Blockly.Events.BLOCK_CREATE &&
        event.type !== Blockly.Events.BLOCK_MOVE) return;

    // Only process the directly affected block and its ancestors
    const affectedBlock = workspace.getBlockById(event.blockId);
    if (!affectedBlock) return;

    const createBlock = findCreateBlock(affectedBlock);
    if (createBlock) {
        handleBlockChange(createBlock, event, variableNamePrefixFor(createBlock));
    }
});
```

This would reduce the N-block fan-out to a single lookup per event.

---

## Significant Issues

### 4. Duplicate `initSvg()` and `render()` in Ctrl+. Keyboard Shortcut

**Location:** `blockhandling.js:199–213`

**Problem:**
The keyboard shortcut for creating a `keyword_block` (Ctrl+.) calls `initSvg()` and `render()`
twice before the block is positioned:

```js
const placeholderBlock = workspace.newBlock("keyword_block");
placeholderBlock.initSvg();   // ← renders at (0,0)
placeholderBlock.render();

// ... compute coordinates ...

placeholderBlock.initSvg();   // ← renders again (redundant)
placeholderBlock.render();    // ← another layout pass
placeholderBlock.moveTo(blockCoordinates);
```

The first `initSvg()` + `render()` pair causes the block to be rendered at (0,0), causing a
visible flash and an unnecessary layout pass. The second pair re-renders at the same state.

**Recommendation:**
Remove the first `initSvg()` / `render()` call pair. Initialize the SVG only once, after computing
the position:

```js
const placeholderBlock = workspace.newBlock("keyword_block");
let workspaceCoordinates = workspace.getMetricsManager().getViewMetrics(true);
let posx = workspaceCoordinates.left + workspaceCoordinates.width / 2;
let posy = workspaceCoordinates.top + workspaceCoordinates.height / 2;
let blockCoordinates = new Blockly.utils.Coordinate(posx, posy);

placeholderBlock.initSvg();
placeholderBlock.render();
placeholderBlock.moveTo(blockCoordinates);
```

---

### 5. `cleanUp` Z-Ordering Iterates All Blocks on Every Cleanup

**Location:** `blockhandling.js:83–107`

**Problem:**
The custom `cleanUp` function calls `workspace.getAllBlocks(false)` and performs `canvas.appendChild(svg)`
for every non-shadow, non-flyout top-level block. This runs (debounced at 300ms) on every
BLOCK_MOVE, BLOCK_CREATE, and BLOCK_DELETE event:

```js
for (const b of workspace.getAllBlocks(false) || []) {
    if (!b || b.isInFlyout || b.isShadow?.()) continue;
    const hasParent = ...;
    if (hasParent) continue;
    const svg = b.getSvgRoot?.();
    if (svg && svg.parentNode === canvas) {
        canvas.appendChild(svg);  // DOM mutation for every top-level block
    }
}
```

For a workspace with 30 top-level blocks, every debounced cleanup triggers 30 `appendChild` calls.
Each `appendChild` causes a DOM reflow.

**Recommendation:**
Restrict z-order updates to only the block that was just moved or created, rather than all blocks.
The z-order of other blocks is not affected by a single block's move:

```js
// Only bring the most recently moved/created block to the front
workspace.addChangeListener((event) => {
    if (event.type === Blockly.Events.BLOCK_MOVE ||
        event.type === Blockly.Events.BLOCK_CREATE) {
        const block = workspace.getBlockById(event.blockId);
        if (block && !block.getParent()) {
            const svg = block.getSvgRoot?.();
            if (svg) canvas.appendChild(svg);
        }
    }
});
```

---

### 6. Repeated Full Workspace Scans in Variable Utilities

**Location:** `blocks/blocks.js:407–536`

**Problem:**
Several variable utility functions independently call `workspace.getAllBlocks(false)`:

- `isVariableUsedElsewhere()` (line 413): iterates all blocks to check if a variable is used
- `countVarUses()` (line 528): iterates all blocks to count variable uses
- `adoptIsolatedDefaultVarsTo()` (line 577): calls `getAllBlocks` per descendant (see Issue #2)

These are called during every block creation/duplication event, potentially chained together.

**Recommendation:**
Pass a pre-computed variable-usage map as a parameter, or memoize per event group. Since variable
operations are batched within `Blockly.Events.setGroup()` blocks, compute the usage map once at
the start of the group and reuse it across all calls:

```js
function buildVarUsageMap(workspace, BlocklyNS) {
    const map = new Map(); // varId -> Set<blockId>
    for (const b of workspace.getAllBlocks(false)) {
        for (const f of getVariableFieldsOnBlock(b, BlocklyNS)) {
            const vid = f.getValue?.();
            if (vid) {
                if (!map.has(vid)) map.set(vid, new Set());
                map.get(vid).add(b.id);
            }
        }
    }
    return map;
}
```

---

### 7. `lowestAvailableSuffix` and `createFreshVariable` Linear Scans

**Location:** `blocks/blocks.js:443–466`, `609–613`

**Problem:**
Both `lowestAvailableSuffix` and `createFreshVariable` use a while-loop calling
`workspace.getVariable()` until they find an unused name:

```js
function lowestAvailableSuffix(workspace, prefix, type) {
    let n = 1;
    while (workspace.getVariable(`${prefix}${n}`, type)) n += 1;  // O(k) where k = existing count
    return n;
}

function createFreshVariable(workspace, prefix, type, nextVariableIndexes) {
    let n = 1;
    while (workspace.getVariable(`${prefix}${n}`, type)) n += 1;  // same pattern
    ...
}
```

For a block type used 20 times, the 21st block creation requires 20 `getVariable()` lookups.

**Recommendation:**
The `nextVariableIndexes` map is already being maintained for exactly this purpose. Use it as the
starting point instead of starting from 1 each time:

```js
function lowestAvailableSuffix(workspace, prefix, type, nextVariableIndexes) {
    // Start from the tracked counter, which is already near the correct value
    let n = nextVariableIndexes[prefix] ?? 1;
    while (workspace.getVariable(`${prefix}${n}`, type)) n += 1;
    return n;
}
```

---

## Minor Issues

### 8. `MutationObserver` Watching Entire `document.body`

**Location:** `blockhandling.js:600–619`

**Problem:**
`observeBlocklyInputs` observes `document.body` with `childList: true, subtree: true`. This fires
the callback for every DOM insertion anywhere in the entire page, just to catch Blockly's input
elements.

```js
observer.observe(document.body, { childList: true, subtree: true });
```

**Recommendation:**
Observe only the Blockly injection div instead:

```js
const blocklyContainer = workspace.getInjectionDiv?.() || document.getElementById("blocklyDiv");
observer.observe(blocklyContainer, { childList: true, subtree: true });
```

This scopes the observer to only the Blockly DOM tree, eliminating noise from other page mutations.

---

### 9. Multiple Independent Workspace Change Listeners

**Location:** `blockhandling.js:8–240`

**Problem:**
Four separate `addChangeListener` calls are registered on the workspace in `initializeBlockHandling`:

1. Toolbox item select / flyout show handler
2. `disableOrphans` handler
3. Debounced cleanup handler (BLOCK_MOVE/CREATE/DELETE)
4. Block collapse/expand handler

Each listener is invoked for every workspace event, even if the event type doesn't match. While
each individual check is fast, the combined overhead of four dispatch invocations per event adds up
in high-event-rate scenarios (e.g., during rapid typing in a field).

**Recommendation:**
Consolidate into a single change listener with a type-based dispatch:

```js
workspace.addChangeListener((event) => {
    switch (event.type) {
        case Blockly.Events.TOOLBOX_ITEM_SELECT:
        case Blockly.Events.FLYOUT_SHOW:
            handleToolboxEvent(event);
            break;
        case Blockly.Events.BLOCK_MOVE:
        case Blockly.Events.BLOCK_CREATE:
        case Blockly.Events.BLOCK_DELETE:
            scheduleCleanup();
            break;
        case Blockly.Events.BLOCK_CHANGE:
            if (event.element === "collapsed") handleCollapseChange(event);
            break;
    }
});
```

---

### 10. Debug Logging in Hot Event Paths

**Location:** `blocks/blocks.js:334–374`

**Problem:**
Multiple `if (flock.blockDebug) console.log(...)` calls appear inside `handleBlockChange`, which is
invoked for every workspace event:

```js
if (flock.blockDebug) console.log("The changed block is", changeEvent.block);
if (flock.blockDebug) console.log("The changed block is", changeEvent.blockId);
// ... several more ...
```

Even though the guard `flock.blockDebug` prevents actual logging when disabled, the property
lookups and conditional evaluations still execute on every single event dispatch across every block.

**Recommendation:**
Remove these debug log statements from the production code, or move them behind a compile-time
constant that tree-shaking can eliminate.

---

### 11. `handleParentLinkedUpdate` Calls `getMainWorkspace()` Twice

**Location:** `blocks/blocks.js:254–259`

**Problem:**
```js
const ws = Blockly.getMainWorkspace();
const changedBlocks = changeEvent.type === Blockly.Events.BLOCK_CREATE && ...
    ? changeEvent.ids.map((id) => ws.getBlockById(id)).filter(Boolean)
    : [ws.getBlockById(changeEvent.blockId)].filter(Boolean);
```

The workspace is retrieved once via `getMainWorkspace()` but this is called from `handleBlockChange`
which is itself called from a `setOnChange` listener on a block — which already has a reference to
`block.workspace`. Using `block.workspace` directly avoids the global lookup.

**Recommendation:**
Pass `block.workspace` or use it directly instead of calling `Blockly.getMainWorkspace()`:

```js
const ws = block.workspace ?? Blockly.getMainWorkspace();
```

---

## Dead Code

### Commented-Out Keyboard Shortcut Handler

**Location:** `blockhandling.js:305–432`

A large block of commented-out code remains in the file, including an implementation for Ctrl+\[
(add block inside), a Ctrl+Shift+K keyboard nav toggle, and a Ctrl+Shift+L scene-category shortcut.

These are not active functionality and add ~130 lines of dead code. They should either be
re-enabled with proper testing or removed entirely.

---

## Summary Table

| # | Issue | Location | Severity | Category |
|---|-------|----------|----------|----------|
| 1 | Unthrottled mousemove in drag logic | `blockhandling.js:457` | Critical | CPU / Frame Rate |
| 2 | O(n²) variable scan in `adoptIsolatedDefaultVarsTo` | `blocks/blocks.js:538` | Critical | CPU / Paste Latency |
| 3 | Per-block `setOnChange` listener fan-out | 11 block files | Critical | CPU / Event Handling |
| 4 | Duplicate `initSvg()`/`render()` in Ctrl+. handler | `blockhandling.js:200` | Significant | Rendering |
| 5 | `cleanUp` z-ordering iterates all blocks | `blockhandling.js:83` | Significant | DOM / Layout |
| 6 | Repeated full workspace scans in variable utils | `blocks/blocks.js:407` | Significant | CPU |
| 7 | `lowestAvailableSuffix` linear scan ignores counter | `blocks/blocks.js:443` | Significant | CPU |
| 8 | `MutationObserver` on full `document.body` | `blockhandling.js:601` | Minor | CPU |
| 9 | Four separate workspace change listeners | `blockhandling.js:8` | Minor | Event Handling |
| 10 | Debug logging in hot event path | `blocks/blocks.js:334` | Minor | CPU |
| 11 | `getMainWorkspace()` called instead of `block.workspace` | `blocks/blocks.js:254` | Minor | CPU |

---

## Recommended Priorities

1. **Fix #1 (mousemove throttle)** — highest user-visible impact; causes jank during every drag on
   large workspaces. A 2-line RAF fix resolves it entirely. Also evaluate removing the dead drag
   feature entirely.

2. **Fix #3 (setOnChange fan-out)** — architectural change with broad impact. A single workspace
   listener replacing 40 per-block listeners dramatically reduces event processing overhead.

3. **Fix #2 (O(n²) variable scan)** — affects paste/duplicate performance on large workspaces.
   Pre-computing the variable usage map converts it from quadratic to linear.

4. **Fix #5 + #6 (DOM thrash + workspace scans)** — reduces cleanup overhead on every block
   structural change.

5. **Fixes #4, #7–#11** — lower effort, lower impact; address when convenient.
