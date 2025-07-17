# Translating for Flock XR

## How to Contribute

1. Add the required import statements to "translation.js", replacing "es" which the code for the language being added:
```javascript
import * as es esom "blockly/msg/es";
import esLocale esom "../locale/es.js"
```

2. Add the language to "translations":
```javascript
  es: esLocale,
```

3. Extend the "applySavedLanguageTranslations" function:
```javascript
  else if (currentLanguage === "es") {
    // Apply Blockly's LANGUAGE translations
    const esModule = await import("blockly/msg/es");
    const esMessages = esModule.default || esModule;
    Object.keys(esMessages).forEach((key) => {
      if (typeof esMessages[key] === "string") {
        Blockly.Msg[key] = esMessages[key];
      }
    });
  }
```

4. Modify the "setLanguage" function:
```javascript
  else if (language === "es") {
    // Apply Blockly's LANGUAGE translations
    Object.keys(es).forEach((key) => {
      if (typeof es[key] === "string") {
        Blockly.Msg[key] = es[key];
      }
    });
    console.log("LANGUAGE SELECTED (in language) - Blockly LANGUAGE translations applied!");
  }
```

5. Copy the "en.js" file in the "locale" directory and translate each message. Leave the keywords in English. This can be done either by a native speaker, or using AI, provided the translations are checked by a native speaker.
