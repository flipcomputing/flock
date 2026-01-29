# Translating for Flock XR

This guide describes how to improve existing translations, add new locales, and keep language files in sync with English. Follow these steps to keep translations consistent and easy to validate.

## Improving existing translations

1. Open the locale file you want to improve in `locale/<lang>.js`.
2. Review each string and update wording, tone, or terminology as needed.
3. Keep the **keys** identical to the English file (`locale/en.js`). Only edit the values.
4. When AI assists with wording, add a short comment near the changed strings (for example, `// AI-generated; needs validation`) until a native speaker reviews them.
5. Re-run the translation check (see [Checking for missing locale strings](#checking-for-missing-locale-strings)) to confirm no keys were added or removed unintentionally.

## Adding a new locale

Follow these steps to wire a new locale into the app:

1. **Create the locale file**
   - Copy `locale/en.js` to `locale/<lang>.js` and translate the values. Leave keys and Blockly keywords unchanged.
   - If AI is used for initial strings, keep a comment at the top noting that the file needs native-speaker validation.

2. **Import the locale in the translation module**
   - In `main/translation.js`, add the Blockly pack import (if it exists) and the custom locale import:
     ```javascript
     import * as xx from "blockly/msg/xx";
     import xxLocale from "../locale/xx.js";
     ```
   - Add the locale to the `translations` map (e.g., `xx: xxLocale,`).
   - Extend `applySavedLanguageTranslations` and `setLanguage` with a branch that applies the Blockly pack for the new language (mirroring the existing languages).

3. **Expose the language in the UI**
   - Add a menu entry in `index.html` (or the relevant menu fragment) with `data-lang="xx"` and the localized name.

4. **Generate initial translations**
   - You may use AI to populate `locale/<lang>.js`, but clearly mark AI-generated strings for validation.
   - Ask a fluent speaker to review and remove the comments after validation.

5. **Verify coverage**
   - Run the translation check script to make sure the new file contains every key in `en.js`.

## When new English strings are added

1. Add the new English strings to `locale/en.js` using the existing naming conventions.
2. Use AI to populate the same keys in every other `locale/*.js` file. Add a `// AI-generated; needs validation` comment next to each new AI-produced line.
3. Update `main/translation.js` if the new strings require new Blockly message hooks or menu entries.
4. Run the translation check script to confirm all locale files include the new keys.
5. Leave the validation comments in place until native speakers review and update the translations.

### Developer flow for adding new messages

When you introduce new UI text in the codebase, wire it to the translation system immediately:

1. Add the English string to `locale/en.js` with the right suffix (for example `_ui` for visible labels, `_tooltip` for help text).
2. Use a translation helper instead of hard-coded strings. Examples:
   - **HTML** (auto-updated by `applyTranslations()`):
     ```html
     <button data-i18n="start_button">Start</button>
     ```
     Add `start_button_ui: "Start",` to `locale/en.js` and translate the same key in other locale files.
   - **JavaScript** (manual assignment):
     ```javascript
     import { translate } from "../main/translation.js";

     const snackbar = document.querySelector("#snackbar");
     snackbar.textContent = translate("snackbar_saved_ui");
     ```
     Add `snackbar_saved_ui: "Saved",` to `locale/en.js` and provide translations for the same key.
3. If the text belongs to Blockly context menus or block tooltips, also ensure the corresponding key exists in the locale files (for example `my_block_tooltip`) and that your block code calls the matching helper (`getTooltip`, `getOption`, or `translate`).
4. After wiring the strings, follow the steps above to generate AI drafts for other locales and run the translation check script.

## Checking for missing locale strings

Use the translation utility to spot missing or extra keys compared to English:

```bash
cd util
./check-translations.sh
```

The script compares every `locale/*.js` file against `locale/en.js` and reports missing and extra keys. Fix any issues it reports before committing.

## Configuring new text to use the translation system

1. Replace hard-coded text with the translation helper or add a `data-i18n` tag in HTML so `applyTranslations()` can update it.
2. Add the English strings to `locale/en.js` with the correct suffix (such as `_ui`, `_tooltip`, or `_option`).
3. Translate the same keys into other locale files (AI is fine for drafts; mark them for validation).
4. File or update a GitHub issue tagged `translation` so contributors know to review and validate the new strings.
