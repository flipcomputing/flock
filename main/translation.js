// Translation module for Flock XR
// Currently supports English and French
import * as Blockly from 'blockly';
import * as fr from 'blockly/msg/fr';
import enLocale from '../locale/en.js';
import frLocale from '../locale/fr.js';

// Store original English messages when first loaded
let originalEnglishMessages = {};
let isOriginalMessagesCached = false;

// Load locale files
const translations = {
  en: enLocale,
  fr: frLocale
};

let currentLanguage = 'en';

// Initialize English translations immediately
function initializeEnglishTranslations() {
  Object.keys(translations.en).forEach(key => {
    if (key.startsWith('CATEGORY_')) {
      Blockly.Msg[key] = translations.en[key];
    }
  });
}

// Call this immediately when module loads
initializeEnglishTranslations();

function cacheOriginalMessages() {
  if (!isOriginalMessagesCached) {
    // Cache all current Blockly messages (which are English by default)
    Object.keys(Blockly.Msg).forEach(key => {
      originalEnglishMessages[key] = Blockly.Msg[key];
    });
    isOriginalMessagesCached = true;
    console.log('Original English messages cached');
  }
}

export function setLanguage(language) {
  // Cache original messages on first use
  cacheOriginalMessages();

  currentLanguage = language;
  console.log(`Language changed to: ${language}`);

  if (language === 'fr') {
    // Apply Blockly's French translations
    Object.keys(fr).forEach(key => {
      if (typeof fr[key] === 'string') {
        Blockly.Msg[key] = fr[key];
      }
    });
    // Apply custom French message overrides
    Object.keys(translations.fr).forEach(key => {
      if (key.startsWith('CONTROLS_') || key.startsWith('LISTS_') || key.startsWith('TEXT_') || key.startsWith('CATEGORY_')) {
        Blockly.Msg[key] = translations.fr[key];
      }
    });
    console.log('Français sélectionné - Blockly French translations applied!');
  } else {
    // Restore original English messages
    Object.keys(originalEnglishMessages).forEach(key => {
      Blockly.Msg[key] = originalEnglishMessages[key];
    });
    // Apply custom English message overrides
    Object.keys(translations.en).forEach(key => {
      if (key.startsWith('CONTROLS_') || key.startsWith('LISTS_') || key.startsWith('TEXT_') || key.startsWith('CATEGORY_')) {
        Blockly.Msg[key] = translations.en[key];
      }
    });
    console.log('English selected - Original English messages restored!');
  }

  // Refresh the workspace to show updated language
  const workspace = Blockly.getMainWorkspace();
  if (workspace) {
    // Refresh all blocks to pick up new translations
    workspace.getAllBlocks(false).forEach(block => {
      if (block.rendered) {
        block.render();
      }
    });
    
    // Refresh the toolbox by updating it with the original toolbox configuration
    const toolboxElement = document.getElementById('toolbox');
    if (toolboxElement) {
      workspace.updateToolbox(toolboxElement);
    } else {
      // If no toolbox element, try importing the toolbox configuration
      import('../toolbox.js').then(({ toolbox }) => {
        workspace.updateToolbox(toolbox);
      });
    }
  }
}

export function getCurrentLanguage() {
  return currentLanguage;
}

export function translate(key) {
  // Return translated text for the current language, fallback to key if not found
  return translations[currentLanguage]?.[key] || translations['en']?.[key] || key;
}

// Helper function to get a Blockly message with fallback
export function getBlocklyMessage(key) {
  return Blockly.Msg[key] || key;
}

// Helper function to get translated tooltips
export function getTooltip(blockType) {
  const tooltipKey = blockType + '_tooltip';
  return translations[currentLanguage]?.[tooltipKey] || translations['en']?.[tooltipKey] || '';
}

// Function to update custom block translations
export function updateCustomBlockTranslations() {
  // This function can be called after language change to update any custom blocks
  // that use the translate() function
  const workspace = Blockly.getMainWorkspace();
  if (workspace) {
    // Trigger a re-render of all blocks to pick up new translations
    workspace.getAllBlocks(false).forEach(block => {
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
    const toolboxElement = document.getElementById('toolbox');
    if (toolboxElement) {
      workspace.updateToolbox(toolboxElement);
    } else {
      // If no toolbox element, try importing the toolbox configuration
      import('../toolbox.js').then(({ toolbox }) => {
        workspace.updateToolbox(toolbox);
      });
    }
  }
}