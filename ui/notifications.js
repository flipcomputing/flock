// Error notification banners for Flock.
// DOM-only: no dependency on the Babylon scene or the in-world text overlay,
// so it works before a scene exists (startup, WebGL, CSG2 failures).
import { translate } from "../main/translation.js";

// id -> banner element. The id makes calls idempotent: the same error
// re-firing updates the existing banner instead of stacking duplicates.
const banners = new Map();

// source -> friendly, translatable message key. Raw error detail never
// reaches the user; it goes to console.error only.
const MESSAGE_KEYS = {
  startup: "error_startup",
  "project-run": "error_project_crash",
  "webgl-lost": "error_webgl_lost",
  "physics-oom": "error_physics_oom",
  audio: "error_audio",
  speech: "error_speech",
};

function getDocument() {
  return (typeof document !== "undefined" && document) || globalThis.document;
}

export function dismissBanner(id) {
  const banner = banners.get(id);
  if (banner) {
    banner.remove();
    banners.delete(id);
  }
}

export function showBanner(id, { message, action } = {}) {
  const doc = getDocument();
  if (!doc?.body) return;

  let banner = banners.get(id);
  // A banner removed from the DOM by something other than dismissBanner()
  // (e.g. a navigation) counts as gone, so it can be shown again.
  const isNew = !banner || !banner.isConnected;

  if (isNew) {
    banner = doc.createElement("div");
    banner.className = "flock-banner flock-banner--error";
    banner.setAttribute("role", "alert");
    banner.setAttribute("aria-live", "assertive");
    banner.tabIndex = -1;
    banners.set(id, banner);
  }

  banner.replaceChildren();

  const text = doc.createElement("span");
  text.className = "flock-banner__message";
  text.textContent = message;
  banner.appendChild(text);

  if (action) {
    const actionButton = doc.createElement("button");
    actionButton.type = "button";
    actionButton.className = "flock-banner__action";
    actionButton.textContent = action.label;
    actionButton.addEventListener("click", action.onClick);
    banner.appendChild(actionButton);
  }

  const closeButton = doc.createElement("button");
  closeButton.type = "button";
  closeButton.className = "flock-banner__close";
  closeButton.setAttribute("aria-label", translate("banner_dismiss"));
  closeButton.textContent = "×";
  closeButton.addEventListener("click", () => dismissBanner(id));
  banner.appendChild(closeButton);

  banner.onkeydown = (event) => {
    if (event.key === "Escape") {
      dismissBanner(id);
    }
  };

  if (isNew) {
    doc.body.prepend(banner);
    banner.focus();
  }
}

// Single funnel: logs developer detail to the console, dedupes by source,
// and shows one friendly banner. fatal === true adds a Reload action.
export function handleError(error, { source, fatal = false } = {}) {
  console.error(`[flock] ${source} error:`, error);

  const id = source || "project-run";
  const messageKey = MESSAGE_KEYS[id] || MESSAGE_KEYS["project-run"];

  showBanner(id, {
    message: translate(messageKey),
    action: fatal
      ? {
          label: translate("banner_reload"),
          onClick: () => window.location.reload(),
        }
      : undefined,
  });
}

// AbortError and plain "aborted" messages are benign (cancelled fetches,
// teardown). A WebAssembly.RuntimeError whose message mentions "abort" is a
// genuine physics out-of-memory crash, so it must never be suppressed here.
export function isBenignAbort(error) {
  if (!error) return false;
  if (
    typeof WebAssembly !== "undefined" &&
    error instanceof WebAssembly.RuntimeError
  ) {
    return false;
  }
  if (error.name === "AbortError") return true;
  const message = `${error.message ?? error}`.toLowerCase();
  return message.includes("aborted") || message === "abort";
}

let globalHandlersInstalled = false;

export function installGlobalErrorHandlers() {
  if (globalHandlersInstalled) return;
  globalHandlersInstalled = true;

  window.addEventListener("error", (event) => {
    if (isBenignAbort(event.error)) return;
    handleError(event.error || new Error(event.message), {
      source: "project-run",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (isBenignAbort(event.reason)) return;
    handleError(event.reason, { source: "project-run" });
  });
}
