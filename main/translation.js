
// Translation module for Flock XR
// Currently supports English and French
import * as Blockly from 'blockly';
import * as fr from 'blockly/msg/fr';

const translations = {
  en: {
    // Add English translations here in the future
  },
  fr: {
    // Add French translations here in the future
  }
};

let currentLanguage = 'en';

export function setLanguage(language) {
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
    // Reset to English - reload the page to get default English messages
    console.log('English selected - reloading to reset to English translations');
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }
}

export function getCurrentLanguage() {
  return currentLanguage;
}

export function translate(key) {
  // For now, return the key itself
  // In the future, this will return translated text
  return translations[currentLanguage]?.[key] || key;
}
