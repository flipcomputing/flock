import { flock } from "../flock.js";
import { currentView, isNarrowScreen, showCanvasView } from "./view.js";
import { fetchProjectJson, loadWorkspaceAndExecute } from "./files.js";
import { setGizmoManager, disposeGizmoManager } from "../ui/gizmos.js";
import { javascriptGenerator } from "blockly/javascript";
import { workspace } from "./blocklyinit.js";

let isExecuting = false;

export async function executeCode(options = {}) {
  // Check if the function is already running
  if (isExecuting) {
    return; // Exit if already running
  }

  // Set the flag to indicate the function is running
  isExecuting = true;

  // Utility function for delay
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Wait until the engine is ready using a loop with an async delay
  while (!flock.engineReady) {
    await delay(100);
  }

  //console.log("Engine ready");

  // If on a narrow screen and currently showing code, switch to canvas
  if (isNarrowScreen() && currentView === "code") {
    showCanvasView();
  }

  disposeGizmoManager();

  let showDebug = flock.scene?.debugLayer?.isVisible();

  if (showDebug) {
    flock.scene.debugLayer.hide();
  }

  // Generate the code from the workspace
  const code = javascriptGenerator.workspaceToCode(workspace);

  try {
    console.log(code);
    await flock.runCode(code, options);
  } catch (error) {
    console.error("Error executing Blockly code:", error);
    isExecuting = false; // Reset the flag if there's an error

    // Load the starter project if execution fails
    const starter = "examples/starter.flock";
    fetchProjectJson(starter)
      .then((json) => {
        loadWorkspaceAndExecute(json, workspace, executeCode);
      })
      .catch((loadError) => {
        console.error(
          "Error loading starter project after execution failure:",
          loadError,
        );
      });
    return; // Exit after handling the error
  }

  // Check if the debug layer is visible and show it if necessary
  if (showDebug) {
    try {
      await flock.scene.debugLayer.show({
        embedMode: true,
        enableClose: false,
        enablePopup: false,
      });
    } catch (error) {
      console.error("Error showing debug layer:", error);
    }
  }

  setGizmoManager(new flock.BABYLON.GizmoManager(flock.scene, 8));

  await delay(1000);
  // Reset the flag to allow future executions
  isExecuting = false;
}

export function stopCode() {
  flock.stopAllSounds();

  // Stop rendering
  flock.engine.stopRenderLoop();
  //console.log("Render loop stopped.");

  // Remove event listeners
  flock.removeEventListeners();

  // If on a narrow screen and currently showing code, switch to canvas
  if (isNarrowScreen() && currentView === "code") {
    showCanvasView();
  }

  //console.log("Switched view.");
}

window.stopCode = stopCode;

window.executeCode = executeCode;
