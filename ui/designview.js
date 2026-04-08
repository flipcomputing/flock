import "./addmenu.js";
import { gizmoManager } from "./gizmos.js";

export { gizmoManager };

function openAboutPage() {
  window.open("https://flockxr.com/", "_blank", "noopener,noreferrer");
}

window.openAboutPage = openAboutPage;
