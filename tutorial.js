import * as Blockly from "blockly";
import { CrossTabCopyPaste } from "@blockly/plugin-cross-tab-copy-paste";
import { initializeBlocks } from "./main/blocklyinit.js";
import { options, CustomZelosRenderer } from "./blocks/blocks";

import { translate } from "./main/translation.js";

initializeBlocks();

console.log(Blockly.Blocks);

Blockly.registry.register(
        Blockly.registry.Type.RENDERER,
        "custom_zelos_renderer",
        CustomZelosRenderer,
);

const workspace = Blockly.inject("blocklyDiv", {
        ...options,
        renderer: "custom_zelos_renderer",
        toolbox: null, // <-- hide by not creating it
        readOnly: true,
        trashcan: false,
        move: { scrollbars: false, drag: false, wheel: false },
        zoom: { controls: false, wheel: false, pinch: false },
});

/*

const originalShowContextMenu = workspace.showContextMenu_;

workspace.showContextMenu_ = function (e) {
        console.log("Blockly context menu triggered");
        originalShowContextMenu.call(this, e);
};
workspace.configureContextMenu = function (menuOptions, e) {
        // Add custom menu options or modify existing ones
        // For example, to add a "Copy" option:
        menuOptions.push({
                text: "Copy",
                enabled: true,
                callb
                        ack: function () {
                        // Implement the copy functionality here
                },
        });
};
*/

document.getElementById("copyButton").addEventListener("click", () => {
        try {
                const topBlock = workspace.getTopBlocks(false)[0]; // Get the first top-level block
                if (topBlock) {
                        // Use the plugin's storage mechanism to copy the block
                        localStorage.setItem(
                                "blocklyStash",
                                JSON.stringify(topBlock.toCopyData()),
                        );
                        alert(translate("blocks_copied_alert"));
                } else {
                        alert(translate("no_blocks_to_copy_alert"));
                }
        } catch (err) {
                console.error("Error copying blocks:", err);
                alert(translate("copy_blocks_failed_alert"));
        }
});
let blocklyJson = {
        type: "start",
        id: "3_f+jq-)57E:_iH=q,G=",
        inputs: {
                DO: {
                        block: {
                                type: "set_sky_color",
                                id: "X+dT+8Q%K%4*cAhGXdpt",
                                inputs: {
                                        COLOR: {
                                                shadow: {
                                                        type: "colour",
                                                        id: "Pr|GQ}pD:^7M*~XK(qUa",
                                                        fields: {
                                                                COLOR: "#6495ed",
                                                        },
                                                },
                                        },
                                },
                                next: {
                                        block: {
                                                type: "create_map",
                                                id: "3/Yv3OmTYjP/!Njv1iq$",
                                                fields: {
                                                        MAP_NAME: "NONE",
                                                },
                                                inputs: {
                                                        MATERIAL: {
                                                                shadow: {
                                                                        type: "material",
                                                                        id: "/=}t6Z#|ef8Umb%Oo-_j",
                                                                        fields: {
                                                                                TEXTURE_SET:
                                                                                        "none.png",
                                                                        },
                                                                        inputs: {
                                                                                BASE_COLOR: {
                                                                                        shadow: {
                                                                                                type: "colour",
                                                                                                id: "D@@n5(qe?9rX!#kzA1V.",
                                                                                                fields: {
                                                                                                        COLOR: "#71bc78",
                                                                                                },
                                                                                        },
                                                                                },
                                                                                ALPHA: {
                                                                                        shadow: {
                                                                                                type: "math_number",
                                                                                                id: "cS9-N;G6}bO+:YBzHve7",
                                                                                                fields: {
                                                                                                        NUM: 1,
                                                                                                },
                                                                                        },
                                                                                },
                                                                        },
                                                                },
                                                        },
                                                },
                                        },
                                },
                        },
                },
        },
};
Blockly.serialization.blocks.append(blocklyJson, workspace);

function fitWorkspaceToBlocks(workspace) {
        const blocksBoundingBox = workspace.getBlocksBoundingBox();

        if (blocksBoundingBox) {
                console.log("Blocks bounding box:", blocksBoundingBox);

                // Account for workspace scale (zoom level)
                const scale = workspace.scale; // Typically 0.75, 1, etc.
                console.log("Workspace scale (zoom):", scale);

                const width =
                        (blocksBoundingBox.right - blocksBoundingBox.left) *
                        scale;
                const height =
                        (blocksBoundingBox.bottom - blocksBoundingBox.top) *
                        scale;

                console.log(
                        "Calculated width (scaled):",
                        width,
                        "Calculated height (scaled):",
                        height,
                );

                // Optional padding for better visual spacing
                const padding = 20;
                const totalWidth = Math.ceil(width + padding);
                const totalHeight = Math.ceil(height + padding);

                console.log(
                        "Total width with padding:",
                        totalWidth,
                        "Total height with padding:",
                        totalHeight,
                );

                // Resize the parent container (blocklyDiv)
                const blocklyDiv = document.getElementById("blocklyDiv");
                if (blocklyDiv) {
                        console.log("Resizing blocklyDiv...");
                        blocklyDiv.style.width = `${totalWidth}px`;
                        blocklyDiv.style.height = `${totalHeight}px`;
                } else {
                        console.warn(
                                "blocklyDiv not found. Ensure the container element exists.",
                        );
                }

                // Trigger Blockly to resize
                console.log("Triggering Blockly SVG resize...");
                Blockly.svgResize(workspace);
        } else {
                console.warn(
                        "No blocks bounding box found. Ensure the workspace contains blocks.",
                );
        }
}

// Call this function after workspace changes
fitWorkspaceToBlocks(workspace);
