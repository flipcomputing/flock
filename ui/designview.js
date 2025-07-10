import * as Blockly from "blockly";
import { meshMap, meshBlockIdMap} from "../generators";
import { flock } from "../flock.js";
import "./addmenu.js";
import { 
  gizmoManager, 
  enableGizmos, 
  setGizmoManager, 
  disposeGizmoManager,
  toggleGizmo 
} from "./gizmos.js";
import { 
  updateOrCreateMeshFromBlock,
  deleteMeshFromBlock,
  getMeshFromBlock,
  updateBlockColorAndHighlight
} from "./blockmesh.js";

export { gizmoManager };



window.selectedColor = "#ffffff"; // Default color

document.addEventListener("DOMContentLoaded", function () {
  const colorInput = document.getElementById("colorPickerButton");

  window.addEventListener("keydown", (event) => {
    // Check if both Ctrl and the comma key (,) are pressed
    if (event.ctrlKey && event.code === "Comma") {
      focusCameraOnMesh();
    }
  });

  // Attach the event listener to capture color changes when user interacts with the input
  colorInput?.addEventListener("input", (event) => {
    window.selectedColor = event.target.value; // Store the selected color

    // Delay the blur to ensure the color selection is processed first
    setTimeout(() => {
      colorInput.blur(); // Close the picker after a brief delay
      colorInput.setAttribute("type", "text");
      colorInput.setAttribute("type", "color");
    }, 100); // Adjust the delay time as needed
    // Call a function to handle the selected color
    pickMeshFromCanvas();
  });
});

function pickMeshFromCanvas() {
  const canvas = flock.scene.getEngine().getRenderingCanvas(); // Get the flock.BABYLON.js canvas

  document.body.style.cursor = "crosshair"; // Change cursor to indicate picking mode

  const onPickMesh = function (event) {
    // Get the canvas bounds relative to the window
    const canvasRect = canvas.getBoundingClientRect();

    // Check if the click happened outside the canvas
    if (
      event.clientX < canvasRect.left ||
      event.clientX > canvasRect.right ||
      event.clientY < canvasRect.top ||
      event.clientY > canvasRect.bottom
    ) {
      window.removeEventListener("click", onPickMesh);
      document.body.style.cursor = "default";
      return;
    }

    // Calculate the click position relative to the canvas, not the window
    const canvasX = event.clientX - canvasRect.left;
    const canvasY = event.clientY - canvasRect.top;

    // Create a picking ray using the adjusted canvas coordinates
    const pickRay = flock.scene.createPickingRay(
      canvasX,
      canvasY,
      flock.BABYLON.Matrix.Identity(),
      flock.scene.activeCamera,
    );

    // Perform the picking
    const pickResult = flock.scene.pickWithRay(
      pickRay,
      (mesh) => mesh.isPickable,
    );

    flock.changeColorMesh(pickResult.pickedMesh, selectedColor);
    updateBlockColorAndHighlight(pickResult.pickedMesh, selectedColor);

    document.body.style.cursor = "default"; // Reset the cursor
    window.removeEventListener("click", onPickMesh); // Remove the event listener after picking
  };

  // Add event listener to pick the mesh on the next click
  window.addEventListener("click", onPickMesh);
}




function openAboutPage() {
  window.open("https://flockxr.com/", "_blank");
}

window.openAboutPage = openAboutPage;













