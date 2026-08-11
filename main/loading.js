import { translate } from './translation.js';
import { areBlockHintsEnabled, showBlockHintMessage } from '../ui/blockHint.js';

// Function to hide loading screen
export function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loadingScreen');
  const body = document.body;

  if (loadingScreen) {
    // First fade out loading screen
    loadingScreen.classList.add('fade-out');
    body.setAttribute('aria-busy', 'false');

    const announcements = document.getElementById('announcements');
    if (announcements) {
      announcements.textContent = '';
      setTimeout(() => {
        announcements.textContent = translate('loading_success_ui');
      }, 20);
    }

    const hintsLabelKey = areBlockHintsEnabled() ? 'hide_block_hints_ui' : 'show_block_hints_ui';
    const hintsLabel = translate(hintsLabelKey);
    showBlockHintMessage(`ℹ️ ${hintsLabel}: ${translate('block_hints_menu_location_ui')}`, {
      boldPart: hintsLabel,
    });

    // Then show main content after a brief delay
    setTimeout(() => {
      body.classList.remove('loading');
    }, 250);

    // Remove loading screen from DOM after transition
    setTimeout(() => {
      if (loadingScreen.parentNode) {
        loadingScreen.parentNode.removeChild(loadingScreen);
      }
    }, 500);
  }
}
