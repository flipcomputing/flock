// UI-only confirm modal; the caller decides what save/discard/cancel do.

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
  return document.getElementById('unsavedChangesModal');
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

// Resolves 'save', 'discard', or 'cancel'; 'discard' if the modal markup is missing.
export function openUnsavedChangesModal() {
  const modal = getModal();
  if (!modal) return Promise.resolve('discard');

  return new Promise((resolve) => {
    activeResolve = resolve;
    previouslyFocused = document.activeElement;

    modal.classList.remove('hidden');

    setTimeout(() => {
      document.getElementById('unsavedChangesSaveButton')?.focus();
    }, 0);
  });
}

function installModal() {
  const modal = getModal();
  if (!modal) return;

  document
    .getElementById('unsavedChangesSaveButton')
    ?.addEventListener('click', () => closeModal('save'));
  document
    .getElementById('unsavedChangesDiscardButton')
    ?.addEventListener('click', () => closeModal('discard'));
  document
    .getElementById('unsavedChangesCancelButton')
    ?.addEventListener('click', () => closeModal('cancel'));
  document
    .getElementById('closeUnsavedChangesModal')
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
