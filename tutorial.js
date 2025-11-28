import * as Blockly from "blockly";
import { CrossTabCopyPaste } from "@blockly/plugin-cross-tab-copy-paste";
import * as BlockDynamicConnection from "@blockly/block-dynamic-connection";
import { defineBlocks, CustomZelosRenderer } from "./blocks.js";
import { defineBaseBlocks } from "./blocks/base";
import { defineShapeBlocks } from "./blocks/shapes";
import { registerFieldColour } from "@blockly/field-colour";
import { translate } from "./main/translation.js";

defineBaseBlocks();
defineBlocks();
defineShapeBlocks();

console.log(Blockly.Blocks['wait']);

// Register the custom renderer
Blockly.registry.register(
	Blockly.registry.Type.RENDERER,
	"custom_zelos_renderer",
	CustomZelosRenderer,
);

// Initialize Blockly workspace
const workspace = Blockly.inject("blocklyDiv", {
	theme: Blockly.Themes.Modern,
	renderer: "custom_zelos_renderer",
	readOnly: true,
	toolbox: null,
	zoom: {
		controls: false,   
		wheel: false,  
		startScale: 0.75,         // 
	  },
	plugins: {
		connectionPreviewer: BlockDynamicConnection.decoratePreviewer(),
	},
});

const originalShowContextMenu = workspace.showContextMenu_;

workspace.showContextMenu_ = function(e) {
  console.log('Blockly context menu triggered');
  originalShowContextMenu.call(this, e);
};
workspace.configureContextMenu = function(menuOptions, e) {
  // Add custom menu options or modify existing ones
  // For example, to add a "Copy" option:
  menuOptions.push({
	text: 'Copy',
	enabled: true,
	callback: function() {
	  // Implement the copy functionality here
	},
  });
};






// Initialize the CrossTabCopyPaste plugin
const crossTabCopyPaste = new CrossTabCopyPaste();
crossTabCopyPaste.init({ contextMenu: true, shortcut: true });

document.getElementById('copyButton').addEventListener('click', () => {
  try {
        const topBlock = workspace.getTopBlocks(false)[0]; // Get the first top-level block
        if (topBlock) {
          // Use the plugin's storage mechanism to copy the block
          localStorage.setItem('blocklyStash', JSON.stringify(topBlock.toCopyData()));
          alert(translate("blocks_copied_alert"));
        } else {
          alert(translate("no_blocks_to_copy_alert"));
        }
  } catch (err) {
        console.error('Error copying blocks:', err);
        alert(translate("copy_blocks_failed_alert"));
  }
});
let blocklyJson = {
	  "type": "wait",
	  "id": "5CTD]keF.g82U/~Oci~b",
	  "inputs": {
		"DURATION": {
		  "shadow": {
			"type": "math_number",
			"id": "rm9RN(41w%N[=3?4[#~N",
			"fields": {
			  "NUM": 1000
			}
		  }
		}
	  }
	};


blocklyJson = {
  "blocks": {
	"languageVersion": 0,
	"blocks": [
	  {
		"type": "controls_repeat_ext",
		"id": "test-block",
		"inputs": {
		  "TIMES": {
			"shadow": {
			  "type": "math_number",
			  "fields": {
				"NUM": 10
			  }
			}
		  }
		}
	  }
	]
  }
};

blocklyJson = {
	  "blocks": {
		"languageVersion": 0,
		"blocks": [
		  {
			"type": "wait",
			"id": "test-block",
			"inputs": {
			  "DURATION": {
				"shadow": {
				  "type": "math_number",
				  "fields": {
					"NUM": 1000
				  }
				}
			  }
			}
		  }
		]
	  }
	};

/*blocklyJson = {
		kind: "block",
		type: "start",
		inputs: {
			DO: {
				block: {
					type: "load_character",
					fields: {
						MODELS: "Character1.glb",
						ID_VAR: {
							name: "player",
							type: "",
						},
					},
					inputs: {
						SCALE: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 1,
								},
							},
						},
						X: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						Y: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						Z: {
							shadow: {
								type: "math_number",
								fields: {
									NUM: 0,
								},
							},
						},
						HAIR_COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#000000",
								},
							},
						},
						SKIN_COLOR: {
							shadow: {
								type: "skin_colour",
								fields: {
									COLOR: "#a15c33",
								},
							},
						},
						EYES_COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#000000",
								},
							},
						},
						SLEEVES_COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#008b8b",
								},
							},
						},
						SHORTS_COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#00008b",
								},
							},
						},
						TSHIRT_COLOR: {
							shadow: {
								type: "colour",
								fields: {
									COLOR: "#ff8f60",
								},
							},
						},
					},
					next: {
						block: {
							type: "add_physics",
							fields: {
								MODEL_VAR: {
									name: "player",
									type: "",
								},
								PHYSICS_TYPE: "DYNAMIC",
							},
							next: {
								block: {
									type: "camera_follow",
									fields: {
										MESH_VAR: {
											name: "player",
											type: "",
										},
									},
									inputs: {
										RADIUS: {
											block: {
												type: "math_number",
												fields: {
													NUM: 7,
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
	};*/

blocklyJson = {
  "blocks": {
	"languageVersion": 0,
	"blocks": [
	  {
		"type": "wait",
		"id": "test-block",
		"inputs": {
		  "DURATION": {
			"shadow": {
			  "type": "math_number",
			  "fields": {
				"NUM": 1000
			  }
			},
			"block": {
			  "type": "math_number",
			  "fields": {
				"NUM": 2000
			  }
			}
		  }
		}
	  }
	]
  }
};

blocklyJson ={
	  "blocks": {
		"languageVersion": 0,
		"blocks": [
		  {
			"type": "start",
			"id": "hP1(8=@A.+kG[L4(yPaZ",
			"inputs": {
			  "DO": {
				"block": {
				  "type": "set_sky_color",
				  "id": "LvX7C$m$;68`G_Qvq=pL",
				  "inputs": {
					"COLOR": {
					  "shadow": {
						"type": "colour",
						"id": "Mlh8zzfY)p3!M2.q:a(8",
						"fields": {
						  "COLOR": "#6495ed"
						}
					  }
					}
				  },
				  "next": {
					"block": {
					  "type": "create_ground",
					  "id": "S%:d.e-l98E_Phu`CHx?",
					  "inputs": {
						"COLOR": {
						  "shadow": {
							"type": "colour",
							"id": "Pe/-b7d5B1Qr*:EvoPsA",
							"fields": {
							  "COLOR": "#71bc78"
							}
						  }
						}
					  },
					  "next": {
						"block": {
						  "type": "print_text",
						  "id": "dVTxJPUi_sO!AuNY#oor",
						  "inputs": {
							"TEXT": {
							  "shadow": {
								"type": "text",
								"id": "=L-/-1HT`]edbp63Mo8Q",
								"fields": {
								  "TEXT": "Hold left mouse button down to look around"
								}
							  }
							},
							"DURATION": {
							  "shadow": {
								"type": "math_number",
								"id": "PAPV5~p4xMSO]ZA,_=pN",
								"fields": {
								  "NUM": 30
								}
							  }
							},
							"COLOR": {
							  "shadow": {
								"type": "colour",
								"id": "w+iegX|E(VYe9KaiAi;Q",
								"fields": {
								  "COLOR": "#000080"
								}
							  }
							}
						  },
						  "next": {
							"block": {
							  "type": "print_text",
							  "id": "C2d:3-H=Y=ZcI:RlzSA+",
							  "inputs": {
								"TEXT": {
								  "shadow": {
									"type": "text",
									"id": "rDKLD?S[.4^HZ(g*vX^y",
									"fields": {
									  "TEXT": "W - forward; S backward; Space - Jump"
									}
								  }
								},
								"DURATION": {
								  "shadow": {
									"type": "math_number",
									"id": "V.~W]u#$|n]}Z.DA(vN3",
									"fields": {
									  "NUM": 30
									}
								  }
								},
								"COLOR": {
								  "shadow": {
									"type": "colour",
									"id": "T=:hhU7UFGsFu|G!a8J!",
									"fields": {
									  "COLOR": "#000080"
									}
								  }
								}
							  }
							}
						  }
						}
					  }
					}
				  }
				}
			  }
			}
		  }
		]
	  }
	};


Blockly.serialization.workspaces.load(blocklyJson, workspace);

function fitWorkspaceToBlocks(workspace) {
  const blocksBoundingBox = workspace.getBlocksBoundingBox();

  if (blocksBoundingBox) {
	console.log("Blocks bounding box:", blocksBoundingBox);

	// Account for workspace scale (zoom level)
	const scale = workspace.scale; // Typically 0.75, 1, etc.
	console.log("Workspace scale (zoom):", scale);

	const width = (blocksBoundingBox.right - blocksBoundingBox.left) * scale;
	const height = (blocksBoundingBox.bottom - blocksBoundingBox.top) * scale;

	console.log("Calculated width (scaled):", width, "Calculated height (scaled):", height);

	// Optional padding for better visual spacing
	const padding = 20;
	const totalWidth = Math.ceil(width + padding);
	const totalHeight = Math.ceil(height + padding);

	console.log("Total width with padding:", totalWidth, "Total height with padding:", totalHeight);

	// Resize the parent container (blocklyDiv)
	const blocklyDiv = document.getElementById('blocklyDiv');
	if (blocklyDiv) {
	  console.log("Resizing blocklyDiv...");
	  blocklyDiv.style.width = `${totalWidth}px`;
	  blocklyDiv.style.height = `${totalHeight}px`;
	} else {
	  console.warn("blocklyDiv not found. Ensure the container element exists.");
	}

	// Trigger Blockly to resize
	console.log("Triggering Blockly SVG resize...");
	Blockly.svgResize(workspace);
  } else {
	console.warn("No blocks bounding box found. Ensure the workspace contains blocks.");
  }
}

// Call this function after workspace changes
fitWorkspaceToBlocks(workspace);