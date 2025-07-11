
// Translation module for Flock XR
// Currently supports English and French
import * as Blockly from 'blockly';
import * as fr from 'blockly/msg/fr';

// Store original English messages when first loaded
let originalEnglishMessages = {};
let isOriginalMessagesCached = false;

// Custom translations for Flock-specific blocks
const translations = {
  en: {
    // Add English translations for custom blocks here
    createBox: "create box",
    setSky: "set sky color",
    wait: "wait",
    // Add more custom block translations as needed
  },
  fr: {
    // Add French translations for custom blocks here
    createBox: "créer boîte",
    setSky: "définir couleur du ciel", 
    wait: "attendre",
    // Add more custom block translations as needed
  }
};

let currentLanguage = 'en';

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
    console.log('Français sélectionné - Blockly French translations applied!');
  } else {
    // Restore original English messages
    Object.keys(originalEnglishMessages).forEach(key => {
      Blockly.Msg[key] = originalEnglishMessages[key];
    });
    console.log('English selected - Original English messages restored!');
  }
  
  // Refresh the toolbox to show updated language
  const workspace = Blockly.getMainWorkspace();
  if (workspace && workspace.getToolbox()) {
    workspace.getToolbox().refreshSelection();
    workspace.refreshToolboxSelection();
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
