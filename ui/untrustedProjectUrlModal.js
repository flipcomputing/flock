// UI-only confirm modal for opening a project from a URL outside the trusted list.

import { translate } from '../main/translation.js';

let previouslyFocused = null;
let activeResolve = null;

function canRestoreFocus(element) {
  if (!element || !element.isConnected) {
    return false;
  }

  let currentElement = element;
  while (currentElement) {
    const style = window.getComputedStyle(currentElement);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }
    currentElement = currentElement.parentElement;
  }

  return true;
}

function getModal() {
  return document.getElementById('untrustedProjectUrlModal');
}

function closeModal(result) {
  const modal = getModal();
  modal?.classList.add('hidden');

  if (canRestoreFocus(previouslyFocused)) {
    previouslyFocused.focus();
  }
  previouslyFocused = null;

  const resolve = activeResolve;
  activeResolve = null;
  resolve?.(result);
}

function setTranslatedText(id, key) {
  const element = document.getElementById(id);
  if (!element) return;
  element.dataset.i18n = key;
  element.textContent = translate(`${key}_ui`);
}

// Resolves 'open' or 'cancel'; 'cancel' if the modal markup is missing.
// With newTabHref the project can only be opened in a new tab, never here.
export function openUntrustedProjectUrlModal(origin, { newTabHref = null } = {}) {
  const modal = getModal();
  if (!modal) return Promise.resolve('cancel');

  const kind = origin ? 'url' : 'link';
  setTranslatedText('untrusted-project-url-modal-title', `untrusted_project_${kind}_title`);
  setTranslatedText(
    'untrustedProjectUrlMessage',
    newTabHref ? 'untrusted_project_url_framed_message' : `untrusted_project_${kind}_message`
  );

  const newTabLink = document.getElementById('untrustedProjectUrlNewTabLink');
  newTabLink?.classList.toggle('hidden', !newTabHref);
  if (newTabLink && newTabHref) newTabLink.href = newTabHref;
  document
    .getElementById('untrustedProjectUrlOpenButton')
    ?.classList.toggle('hidden', !!newTabHref);

  const originElement = document.getElementById('untrustedProjectUrlOrigin');
  if (originElement) {
    originElement.textContent = origin;
    originElement.parentElement.hidden = !origin;
  }

  return new Promise((resolve) => {
    activeResolve = resolve;
    previouslyFocused = document.activeElement;

    modal.classList.remove('hidden');

    setTimeout(() => {
      document.getElementById('untrustedProjectUrlCancelButton')?.focus();
    }, 0);
  });
}

function installModal() {
  const modal = getModal();
  if (!modal) return;

  document
    .getElementById('untrustedProjectUrlOpenButton')
    ?.addEventListener('click', () => closeModal('open'));
  document
    .getElementById('untrustedProjectUrlNewTabLink')
    ?.addEventListener('click', () => closeModal('cancel'));
  document
    .getElementById('untrustedProjectUrlCancelButton')
    ?.addEventListener('click', () => closeModal('cancel'));
  document
    .getElementById('closeUntrustedProjectUrlModal')
    ?.addEventListener('click', () => closeModal('cancel'));

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeModal('cancel');
    } else if (e.key === 'Tab') {
      const focusable = Array.from(
        modal.querySelectorAll(
          'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.tabIndex !== -1 && !el.disabled && el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', installModal);
