// Translation module for Flock XR
// Currently supports English and Spanish
import * as Blockly from "blockly";

import * as en from "blockly/msg/en";
import enLocale from "../locale/en.js";
import * as es from "blockly/msg/es";
import esLocale from "../locale/es.js";

/*
// Add when human translations are available
import * as fr from "blockly/msg/fr";
import * as it from "blockly/msg/it";
import * as sv from "blockly/msg/sv";
import * as pt from "blockly/msg/pt";
import * as pl from "blockly/msg/pl";
import * as de from "blockly/msg/de";

import frLocale from "../locale/fr.js";
import itLocale from "../locale/it.js";
import svLocale from "../locale/sv.js";
import ptLocale from "../locale/pt.js";
import plLocale from "../locale/pl.js";
import deLocale from "../locale/de.js";
*/

// Store original English messages when first loaded
let originalEnglishMessages = {};
let isOriginalMessagesCached = false;
// Load locale files
const translations = {
  en: enLocale,
  es: esLocale,
  /* it: itLocale,
  fr: frLocale,
  sv: svLocale,
  pt: ptLocale,
  pl: plLocale,
  de: deLocale,*/
};

export function getDropdownOption(key) {
  return [getOption(key), key];
}

let currentLanguage = "en";

// Save language preference to localStorage
function saveLanguagePreference(language) {
  localStorage.setItem("flock-language", language);
}

function cacheOriginalMessages() {
  if (!isOriginalMessagesCached) {
    // Cache all current Blockly messages (which are English by default)
    Object.keys(Blockly.Msg).forEach((key) => {
      originalEnglishMessages[key] = Blockly.Msg[key];
    });
    isOriginalMessagesCached = true;
  }
}

function applyContextMenuShortcutTranslations() {
  // Ensure copy/paste/cut shortcuts use localized labels even when Blockly's
  // built-in locale packs leave them untranslated.
  Blockly.Msg["COPY_SHORTCUT"] = translate("context_copy_option");
  Blockly.Msg["PASTE_SHORTCUT"] = translate("context_paste_option");
  Blockly.Msg["CUT_SHORTCUT"] = translate("context_cut_option");

  // Normalize the delete label to a single localized string without block
  // counts.
  const deleteLabel = translate("context_delete_option");
  Blockly.Msg["DELETE_BLOCK"] = deleteLabel;
  Blockly.Msg["DELETE_X_BLOCKS"] = deleteLabel;
}

export async function setLanguage(language) {
  // Cache original messages on first use
  cacheOriginalMessages();

  currentLanguage = language;
  saveLanguagePreference(language);

  if (language === "es") {
    // Apply Blockly's Spanish translations
    Object.keys(es).forEach((key) => {
      if (typeof es[key] === "string") {
        Blockly.Msg[key] = es[key];
      }
    });
  } else {
    // Official Blockly English first
    Object.keys(en).forEach((key) => {
      Blockly.Msg[key] = en[key];
    });
    // Custom keys (overrides built-in if keys overlap)
    Object.keys(enLocale).forEach((key) => {
      Blockly.Msg[key] = enLocale[key];
    });
  }

  applyTranslations();

  // Apply custom translations for the selected language
  Object.keys(translations[currentLanguage]).forEach((key) => {
    Blockly.Msg[key] = translations[currentLanguage][key];
  });

  applyContextMenuShortcutTranslations();

  // Update colour picker translations if it exists
  if (window.flockColorPicker?.refreshTranslations) {
    window.flockColorPicker.refreshTranslations();
  }

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

    if (workspace.flockSearchCategory?.blockSearcher?.indexBlocks) {
      workspace.flockSearchCategory.blockSearcher.indexBlocks();
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

const keywordHintLabels = {
  en: "Keyword",
  es: "Palabra clave",
};

function getTooltipKeywordLabel() {
  return keywordHintLabels[currentLanguage] || keywordHintLabels.en;
}

function tooltipHasKeywordHint(tooltip) {
  return /(?:keyword|palabra clave)\s*:/iu.test(tooltip);
}

function findToolboxKeyword(blockType) {
  const workspace =
    globalThis.window?.mainWorkspace || Blockly.getMainWorkspace();
  const languageTree = workspace?.options?.languageTree;

  function searchContents(contents) {
    if (!Array.isArray(contents)) {
      return "";
    }

    for (const item of contents) {
      if (item?.kind === "block" && item.type === blockType) {
        return item.keyword || "";
      }

      const nestedKeyword = searchContents(item?.contents);
      if (nestedKeyword) {
        return nestedKeyword;
      }
    }

    return "";
  }

  return searchContents(languageTree?.contents);
}

// Helper function to get translated tooltips
export function getTooltip(blockType) {
  return () => {
    const tooltipKey = blockType + "_tooltip";
    const translatedTooltip =
      translations[currentLanguage]?.[tooltipKey] ||
      translations["en"]?.[tooltipKey] ||
      "";
    const keyword = findToolboxKeyword(blockType);

    if (!keyword || tooltipHasKeywordHint(translatedTooltip)) {
      return translatedTooltip;
    }

    const keywordHint = `${getTooltipKeywordLabel()}: ${keyword}`;
    return translatedTooltip
      ? `${translatedTooltip}\n${keywordHint}`
      : keywordHint;
  };
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
  const optionKey =
    key == " "
      ? "space_option"
      : key == ","
        ? "comma_option"
        : key == "."
          ? "dot_option"
          : key == "/"
            ? "slash_option"
            : (/^\d$/.test(key[0]) ? "_" : "") +
              key.replace(".", "_").replace("-", "_").replace("/", "_") +
              "_option";
  return (
    translations[currentLanguage]?.[optionKey] ||
    translations["en"]?.[optionKey] ||
    key
  );
}

export function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n + "_ui";
    const translation = translate(key) || key;

    if (el.dataset.i18nAttrs) {
      el.dataset.i18nAttrs
        .split(",")
        .map((attr) => attr.trim())
        .filter(Boolean)
        .forEach((attr) => el.setAttribute(attr, translation));
    }

    const hasOnlyTextOrStrongChildren = Array.from(el.childNodes).every(
      (node) => node.nodeType === Node.TEXT_NODE || node.nodeName === "STRONG",
    );

    if (hasOnlyTextOrStrongChildren) {
      // Replace the element's textual content only to avoid injecting HTML
      el.textContent = translation;
      return;
    }

    if (el.hasAttribute("title")) {
      el.title = translation;
    }
    if (el.hasAttribute("aria-label")) {
      el.setAttribute("aria-label", translation);
    }
    if (el.hasAttribute("placeholder")) {
      el.setAttribute("placeholder", translation);
    }
  });
}
document.addEventListener("DOMContentLoaded", () => applyTranslations());

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

function getSubmenuInitializationElements({
  itemId,
  submenuId,
  optionSelector,
  warningMessage,
}) {
  const menuItem = document.getElementById(itemId);
  const submenu = document.getElementById(submenuId);

  if (!menuItem || !submenu) {
    console.warn(warningMessage);
    return null;
  }

  const options = submenu.querySelectorAll(optionSelector);
  if (!options.length) {
    console.warn(warningMessage);
    return null;
  }

  return { menuItem, submenu, options };
}

// Initialize language menu functionality
export function initializeLanguageMenu() {
  const languageMenu = getSubmenuInitializationElements({
    itemId: "language-menu-item",
    submenuId: "language-submenu",
    optionSelector: "a[data-lang]",
    warningMessage: "Language menu elements not found",
  });

  if (!languageMenu) {
    return;
  }

  const {
    menuItem: languageMenuItem,
    submenu: languageSubmenu,
    options: languageOptions,
  } = languageMenu;

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

    applyContextMenuShortcutTranslations();
  }
}
