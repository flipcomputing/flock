import { translate } from "./translation.js";

// Function to hide loading screen
export function hideLoadingScreen() {
  const loadingScreen = document.getElementById("loadingScreen");
  const body = document.body;

  if (loadingScreen) {
    // First fade out loading screen
    loadingScreen.classList.add("fade-out");
    body.setAttribute("aria-busy", "false");

    const announcements = document.getElementById("announcements");
    if (announcements) {
      announcements.textContent = "";
      setTimeout(() => {
        announcements.textContent = translate("loading_success_ui");
      }, 20);
    }

    // Then show main content after a brief delay
    setTimeout(() => {
      body.classList.remove("loading");
    }, 250);

    // Remove loading screen from DOM after transition
    setTimeout(() => {
      if (loadingScreen.parentNode) {
        loadingScreen.parentNode.removeChild(loadingScreen);
      }
    }, 500);
  }
}
