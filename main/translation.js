// Translation module for Flock XR
// Currently supports English and French
import * as Blockly from "blockly";
import * as fr from "blockly/msg/fr";
import * as en from "blockly/msg/en";
import * as es from "blockly/msg/es";
import enLocale from "../locale/en.js";
import frLocale from "../locale/fr.js";
import esLocale from "../locale/es.js";

// Store original English messages when first loaded
let originalEnglishMessages = {};
let isOriginalMessagesCached = false;
// Load locale files
const translations = {
  en: enLocale,
  fr: frLocale,
  es: esLocale,
};

export function getDropdownOption(key) {
  return [getOption(key), key]
}

let currentLanguage = "en";

// Load saved language preference from localStorage
async function loadSavedLanguage() {
  const savedLanguage = localStorage.getItem("flock-language");
  if (savedLanguage && translations[savedLanguage]) {
    currentLanguage = savedLanguage;
    console.log(`Loaded saved language: ${savedLanguage}`);
    // Apply the saved language translations immediately
    await applySavedLanguageTranslations();
  }
}

// Apply saved language translations (used during initialization)
async function applySavedLanguageTranslations() {
  if (currentLanguage === "fr") {
    // Apply Blockly's French translations
    const frModule = await import("blockly/msg/fr");
    const frMessages = frModule.default || frModule;
    Object.keys(frMessages).forEach((key) => {
      if (typeof frMessages[key] === "string") {
        Blockly.Msg[key] = frMessages[key];
      }
    });
  } else if (currentLanguage === "es") {
    // Apply Blockly's Spanish translations
    const esModule = await import("blockly/msg/es");
    const esMessages = esModule.default || esModule;
    Object.keys(esMessages).forEach((key) => {
      if (typeof esMessages[key] === "string") {
        Blockly.Msg[key] = esMessages[key];
      }
    });
  }

  // Apply custom translations for all languages
  Object.keys(translations[currentLanguage]).forEach((key) => {
    Blockly.Msg[key] = translations[currentLanguage][key];
  });
}

// Save language preference to localStorage
function saveLanguagePreference(language) {
  localStorage.setItem("flock-language", language);
  console.log(`Saved language preference: ${language}`);
}

// Load saved language and initialize translations
loadSavedLanguage();

function cacheOriginalMessages() {
  if (!isOriginalMessagesCached) {
    // Cache all current Blockly messages (which are English by default)
    Object.keys(Blockly.Msg).forEach((key) => {
      originalEnglishMessages[key] = Blockly.Msg[key];
    });
    isOriginalMessagesCached = true;
    console.log("Original English messages cached");
  }
}

export async function setLanguage(language) {
  // Cache original messages on first use
  cacheOriginalMessages();

  currentLanguage = language;
  saveLanguagePreference(language);
  console.log(`Language changed to: ${language}`);

  if (language === "fr") {
    // Apply Blockly's French translations
    Object.keys(fr).forEach((key) => {
      if (typeof fr[key] === "string") {
        Blockly.Msg[key] = fr[key];
      }
    });
    console.log("Français sélectionné - Blockly French translations applied!");
  } else if (language === "es") {
    // Apply Blockly's Spanish translations
    Object.keys(es).forEach((key) => {
      if (typeof es[key] === "string") {
        Blockly.Msg[key] = es[key];
      }
    });
    console.log("Español seleccionado - Blockly Spanish translations applied!");
  } else {
    // Official Blockly English first
    Object.keys(en).forEach((key) => {
      Blockly.Msg[key] = en[key];
    });
    // Custom keys (overrides built-in if keys overlap)
    Object.keys(enLocale).forEach((key) => {
      Blockly.Msg[key] = enLocale[key];
    });
    console.log(
      "English selected - Blockly English and custom translations applied!",
    );

  }

  applyTranslations()

  // Apply custom translations for the selected language
  Object.keys(translations[currentLanguage]).forEach((key) => {
    Blockly.Msg[key] = translations[currentLanguage][key];
  });

  // Refresh the workspace to show updated language
  const workspace = Blockly.getMainWorkspace();
  if (workspace) {
    // Update toolbox first to get new category translations
    const toolboxElement = document.getElementById("toolbox");
    if (toolboxElement) {
      workspace.updateToolbox(toolboxElement);
    } else {
      // If no toolbox element, try importing the toolbox configuration
      import("../toolbox.js").then(({ toolbox }) => {
        workspace.updateToolbox(toolbox);
      });
    }

    // Force blocks to update their text by serializing and reloading the workspace
    const hasBlocks = workspace.getAllBlocks(false).length > 0;
    if (hasBlocks) {
      // Serialize the current workspace
      const workspaceXml = Blockly.Xml.workspaceToDom(workspace);

      // Disable events to prevent code execution during reload
      Blockly.Events.disable();
      try {
        // Clear and reload the workspace with new translations
        workspace.clear();
        Blockly.Xml.domToWorkspace(workspaceXml, workspace);
      } finally {
        Blockly.Events.enable();
      }
    }
  }
}

export function getCurrentLanguage() {
  return currentLanguage;
}

export function translate(key) {
  // Return translated text for the current language, fallback to key if not found
  return (
    translations[currentLanguage]?.[key] || translations["en"]?.[key] || key
  );
}

// Helper function to get a Blockly message with fallback
export function getBlocklyMessage(key) {
  return Blockly.Msg[key] || key;
}

// Helper function to get translated tooltips
export function getTooltip(blockType) {
  const tooltipKey = blockType + "_tooltip";
  return (
    translations[currentLanguage]?.[tooltipKey] ||
    translations["en"]?.[tooltipKey] ||
    ""
  );
}

// Helper function to get translated snippet options
export function getSnippetOption(blockType) {
  const snippetKey = blockType + "_snippet";
  return (
    translations[currentLanguage]?.[snippetKey] ||
    translations["en"]?.[snippetKey] ||
    ""
  );
}

// Helper function to get translated dropdown options
export function getOption(key) {
  const optionKey 
    = key == " " ? "space_option"
    : key == "," ? "comma_option"
    : key == "." ? "dot_option"
    : key == "/" ? "slash_option"
    : (/^\d$/.test(key[0]) ? "_" : "") + key.replace(".", "_").replace("-", "_").replace("/", "_") + "_option";
  return (
    translations[currentLanguage]?.[optionKey] ||
    translations["en"]?.[optionKey] ||
    key
  );
}

export function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n + "_ui";

    let contents = ""
    for (const element of el.childNodes) {
      if (element.nodeType == Node.TEXT_NODE || element.nodeName == "STRONG") {
        contents += element.textContent
      }
    }
    contents = contents.trim()
    if (contents != "") { el.innerHTML = translate(key) || key }
    else if (el.hasAttribute("title")) { el.title = translate(key) || key }
    else if (el.hasAttribute("placeholder")) {el.setAttribute("placeholder", translate(key) || key) }
  });
}
document.addEventListener('DOMContentLoaded', () =>
  applyTranslations()
);

// Function to update custom block translations
export function updateCustomBlockTranslations() {
  // This function can be called after language change to update any custom blocks
  // that use the translate() function
  const workspace = Blockly.getMainWorkspace();
  if (workspace) {
    // Trigger a re-render of all blocks to pick up new translations
    workspace.getAllBlocks(false).forEach((block) => {
      if (block.rendered) {
        block.render();
      }
    });
  }
}

// Function to update toolbox translations (no longer needed with BKY format)
export function updateToolboxTranslations() {
  // No longer needed - Blockly handles BKY translations automatically
  // But we need to refresh the toolbox to pick up new translations
  const workspace = Blockly.getMainWorkspace();
  if (workspace && workspace.getToolbox()) {
    const toolboxElement = document.getElementById("toolbox");
    if (toolboxElement) {
      workspace.updateToolbox(toolboxElement);
    } else {
      // If no toolbox element, try importing the toolbox configuration
      import("../toolbox.js").then(({ toolbox }) => {
        workspace.updateToolbox(toolbox);
      });
    }
  }
}

// Initialize language menu functionality
export function initializeLanguageMenu() {
  const languageMenuItem = document.getElementById("language-menu-item");
  const languageSubmenu = document.getElementById("language-submenu");
  const languageOptions = languageSubmenu.querySelectorAll("a[data-lang]");

  if (!languageMenuItem || !languageSubmenu || !languageOptions.length) {
    console.warn("Language menu elements not found");
    return;
  }

  // Show/hide language submenu
  languageMenuItem.addEventListener("mouseenter", () => {
    languageSubmenu.classList.remove("hidden");
  });

  languageMenuItem.addEventListener("mouseleave", () => {
    setTimeout(() => {
      if (!languageSubmenu.matches(":hover")) {
        languageSubmenu.classList.add("hidden");
      }
    }, 100);
  });

  languageSubmenu.addEventListener("mouseleave", () => {
    languageSubmenu.classList.add("hidden");
  });

  // Handle language selection
  languageOptions.forEach((option) => {
    option.addEventListener("click", (e) => {
      e.preventDefault();
      const selectedLang = e.target.getAttribute("data-lang");

      // Call the setLanguage function
      setLanguage(selectedLang);

      // Close menus
      languageSubmenu.classList.add("hidden");
      const menuDropdown = document.getElementById("menuDropdown");
      if (menuDropdown) {
        menuDropdown.classList.add("hidden");
      }
      const menuBtn = document.getElementById("menuBtn");
      if (menuBtn) {
        menuBtn.setAttribute("aria-expanded", "false");
      }
    });
  });

  // Handle keyboard navigation for language menu
  languageMenuItem.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
      e.preventDefault();
      languageSubmenu.classList.remove("hidden");
      languageOptions[0].focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const openAbout = document.getElementById("openAbout");
      if (openAbout) openAbout.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const menuBtn = document.getElementById("menuBtn");
      if (menuBtn) menuBtn.focus();
    }
  });

  console.log("Language menu initialized");
}

// Initialize saved language on startup
export async function initializeSavedLanguage() {
  const savedLanguage = localStorage.getItem("flock-language");
  if (savedLanguage && translations[savedLanguage]) {
    await setLanguage(savedLanguage);
  } else {
    // Apply default English translations
    Object.keys(translations.en).forEach((key) => {
      Blockly.Msg[key] = translations.en[key];
    });
  }
}
