# Additional Developer Documentation

Details of the FlockXR API and its methods are in [API.md](../API.md).

## Synchronisation between Blockly blocks and Babylon.js canvas

The blocks *themselves*, for each mesh, transformation (such as rotation) and other characteristic and operation, are defined in either `blocks.js` or `blocks/`, with the latter typically storing block definitions in multiple files depending on their purpose. For example, `blocks/transform.js` stores the Blockly definitions for the blocks that handle transformations. For example, `create_box` in `blocks/shapes.js` creates a box mesh in the Babylon.js canvas, while `load_object` in `blocks/models.js` loads a mesh onto the canvas (where the actual game view is). Each block has an `init` function and inside that function is *meant* to contain an event handler (`this.setOnChange((changeEvent) => {...})`) that enacts the change onto the mesh in the canvas itself once it is enacted inside the block. For example, the `create_box` block definition in `blocks/shapes.js` calls a `handleBlockChange(block, changeEvent)` method when a modification is detected, whether that be within a field of the block or it simply being added to the existing FlockXR code. For many blocks, this has already been implemented, and implementing synchronisation for the blocks that still require it is an ongoing work in progress.

Each block has code generated for it through Blockly (as described in [CONTRIBUTING.md](../CONTRIBUTING.md)). Every time the canvas is initialised, whether that be at the start of running FlockXR or through the play button, this generated code is run via the `executeCode` function in `execution.js`.

When a change happens in the *canvas* editor, the blocks themselves *also* get updated. `ui/gizmos.js` handles all of this live updating through the way of a "gizmo" manager that observes changes from the editor and updates the related blocks as they are enacted.

Within this code are several methods that get called to enact these changes within blocks to items in the canvas. These functions are **not** in the FlockXR API.

### Details on specific methods in code that handle block changes

#### `getMeshFromBlock(block)`

Defined in: `ui/blockmesh.js`

Called within [`updateOrCreateMeshFromBlock`](#updateorcreatemeshfromblockblock-changeevent) and [`updateMeshFromBlock`](#updatemeshfromblockmesh-block-changeevent)

Retrieves the mesh associated with a particular block (`block`).

#### `updateOrCreateMeshFromBlock(block, changeEvent)`

Defined in: `ui/blockmesh.js`

Called within `handleBlockChange` in each block's event handler.

Enacts an event (`changeEvent`) on a mesh associated with a particular block (`block`), whether that be the creation of that mesh itself or a transformation on it.

#### `updateMeshFromBlock(mesh, block, changeEvent)`

Defined in `ui/blockmesh.js`

Called within [`updateOrCreateMeshFromBlock`](#updateorcreatemeshfromblockblock-changeevent)

Enacts an update (`changeEvent`) on an existing mesh (`mesh`) associated with a particular block (`block`) using data entered within said block.

#### `createMeshOnCanvas(block)`

Defined in `ui/addmeshes.js`

Called within [`updateOrCreateMeshFromBlock`](#updateorcreatemeshfromblockblock-changeevent)

Creates a mesh on the Babylon.js canvas.

#### `deleteMeshFromBlock(blockId)`

Defined in `ui/blockmesh.js`

Called within `handleBlockDelete(event)` and `handleMeshLifecycleChange(block, changeEvent)` in [`blocks.js`](../blocks.js)

Removes a mesh associated with a particular block `blockId` from the mesh map (`meshMap` in the FlockXR codebase).
