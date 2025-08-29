# Additional Developer Documentation

Details of the FlockXR API and its methods are in [API.md](../API.md).

## Synchronisation between Blockly blocks and Babylon.js view

The blocks *themselves*, for each mesh, transformation and other characteristic and operation, are defined in either `blocks.js` or `blocks/`, with the latter typically storing block definitions in multiple files depending on their purpose. For example, `blocks/transform.js` stores the Blockly definitions for the blocks that handle transformations (for example, `rotate_to` rotates a mesh). Each block has an `init` function and inside that function is *meant* to contain an event handler (`this.setOnChange(...)`) that enacts the change onto the mesh in the view itself once it is enacted inside the block (see, for example, the `rotate_to` block definition in `blocks/transform.js`). For several blocks, this hasn't been implemented yet, and it's an ongoing work in progress.

The real-time updates between blocks and view is done like so:

Block-to-view updates are done through...

View-to-block updates are enacted with...