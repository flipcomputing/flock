import {
  getPlayerControlsEnabled,
  setPlayerControlsEnabled,
  getGizmoControlsEnabled,
  setGizmoControlsEnabled,
  getGizmoHintsEnabled,
  setGizmoHintsEnabled,
  onControlPreferenceChange,
} from '../ui/controlPreferences.js';

const menuBtn = document.getElementById('menuBtn');
const openAbout = document.getElementById('about-menu-item');
const infoModal = document.getElementById('infoModal');
const closeInfoModal = document.getElementById('closeInfoModal');
const openTools = document.getElementById('tools-menu-item');
const toolsModal = document.getElementById('toolsModal');
const closeToolsModal = document.getElementById('closeToolsModal');
const playerControlsCheckbox = document.getElementById('playerControlsCheckbox');
const gizmoControlsCheckbox = document.getElementById('gizmoControlsCheckbox');
const gizmoHintsCheckbox = document.getElementById('gizmoHintsCheckbox');
let previouslyFocused = null;

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

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function openModal(modal, initialFocus) {
  if (!modal || !initialFocus) {
    return;
  }
  previouslyFocused = document.activeElement;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  modal.setAttribute('aria-modal', 'true');

  setTimeout(() => {
    initialFocus.focus();
  }, 0);
}

function hideModal(modal) {
  if (!modal) {
    return;
  }
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  modal.removeAttribute('aria-modal');

  if (canRestoreFocus(previouslyFocused)) {
    previouslyFocused.focus();
  } else if (menuBtn) {
    menuBtn.focus();
  }

  previouslyFocused = null;
}

function openInfoModal() {
  openModal(infoModal, closeInfoModal);
}

function hideInfoModal() {
  hideModal(infoModal);
}

function syncToolsModal() {
  if (playerControlsCheckbox) playerControlsCheckbox.checked = getPlayerControlsEnabled();
  if (gizmoControlsCheckbox) gizmoControlsCheckbox.checked = getGizmoControlsEnabled();
  if (gizmoHintsCheckbox) gizmoHintsCheckbox.checked = getGizmoHintsEnabled();
  // main.js fills in the inspector row.
  document.dispatchEvent(new CustomEvent('toolspanelsync'));
}

function openToolsModal() {
  syncToolsModal();
  openModal(toolsModal, playerControlsCheckbox ?? closeToolsModal);
}

function hideToolsModal() {
  hideModal(toolsModal);
}

class AccessibleFlyoutMenu {
  constructor() {
    this.menuButton = document.getElementById('menuBtn');
    this.menuDropdown = document.getElementById('menuDropdown');
    this.menuItems = [];
    this.isMenuOpen = false;
    this.currentFocus = -1;
    this.currentOpenSubmenu = null;

    if (!this.menuButton || !this.menuDropdown) {
      return;
    }

    this.menuItems = this.menuDropdown.querySelectorAll('.menu-item:not(.hidden)');
    this.init();
  }

  init() {
    // Main menu button events
    this.menuButton.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleMainMenu();
    });

    this.menuButton.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.openMainMenu();
        this.focusFirstMenuItem();
      } else if (e.key === 'Tab' && this.isMenuOpen) {
        this.closeAllMenus();
      }
    });

    this.menuDropdown.addEventListener('focusout', () => {
      window.requestAnimationFrame(() => {
        const activeElement = document.activeElement;
        if (
          this.isMenuOpen &&
          activeElement !== this.menuButton &&
          !this.menuDropdown.contains(activeElement)
        ) {
          this.closeAllMenus();
        }
      });
    });

    // Menu item events
    this.menuItems.forEach((item, index) => {
      // Mouse events (preserve existing functionality)
      item.addEventListener('mouseenter', () => {
        this.handleMouseEnter(item);
      });

      item.addEventListener('mouseleave', () => {
        this.handleMouseLeave(item);
      });

      // Keyboard events
      item.addEventListener('keydown', (e) => {
        this.handleMenuItemKeydown(e, item, index);
      });

      item.addEventListener('click', (e) => {
        this.handleMenuItemClick(e, item);
      });

      // Submenu events
      const submenu = item.querySelector('.submenu');
      if (submenu) {
        const submenuItems = submenu.querySelectorAll('a');
        submenuItems.forEach((subItem, subIndex) => {
          subItem.addEventListener('keydown', (e) => {
            this.handleSubmenuKeydown(e, subItem, submenuItems, subIndex, item);
          });

          subItem.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeAllMenus();
          });
        });
      }
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.menuButton.contains(e.target) && !this.menuDropdown.contains(e.target)) {
        this.closeAllMenus();
      }
    });

    // Close menu on Escape
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Escape') {
          return;
        }
        if (document.activeElement?.closest?.('#babylon-inspector-container')) {
          return;
        }

        let handled = false;

        if (infoModal && !infoModal.classList.contains('hidden')) {
          hideInfoModal();
          handled = true;
        }

        if (toolsModal && !toolsModal.classList.contains('hidden')) {
          hideToolsModal();
          handled = true;
        }

        if (this.isMenuOpen) {
          this.closeAllMenus();
          this.menuButton.focus();
          handled = true;
        }

        if (handled) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true
    ); // Fire before blockly handles escape
  }

  toggleMainMenu() {
    if (this.isMenuOpen) {
      this.closeAllMenus();
    } else {
      this.openMainMenu();
    }
  }

  openMainMenu() {
    this.isMenuOpen = true;
    this.menuDropdown.classList.remove('hidden');
    this.menuButton.setAttribute('aria-expanded', 'true');
    this.currentFocus = -1;
  }

  closeAllMenus() {
    this.isMenuOpen = false;
    this.menuDropdown.classList.add('hidden');
    this.menuButton.setAttribute('aria-expanded', 'false');
    this.closeAllSubmenus();
    this.currentFocus = -1;
  }

  closeAllSubmenus() {
    this.menuItems.forEach((item) => {
      const submenu = item.querySelector('.submenu');
      if (submenu) {
        submenu.hidden = true;
        item.setAttribute('aria-expanded', 'false');
      }
    });
    this.currentOpenSubmenu = null;
  }

  focusFirstMenuItem() {
    if (this.menuItems.length === 0) {
      return;
    }
    this.currentFocus = 0;
    this.menuItems[0].focus();
  }

  focusMenuItem(index) {
    if (index >= 0 && index < this.menuItems.length) {
      this.currentFocus = index;
      this.menuItems[index].focus();
    }
  }

  handleMouseEnter(item) {
    // Close other submenus
    this.closeAllSubmenus();

    // Open this submenu if it has one
    const submenu = item.querySelector('.submenu');
    if (submenu) {
      submenu.hidden = false;
      item.setAttribute('aria-expanded', 'true');
      this.currentOpenSubmenu = item;
    }
  }

  handleMouseLeave() {
    // Keep submenu open for keyboard navigation
    // Only close on mouse leave from the entire menu area
  }

  handleMenuItemClick(e, item) {
    const submenu = item.querySelector('.submenu');
    if (submenu) {
      e.preventDefault();
      this.toggleSubmenu(item);
    } else {
      // For leaf menu items (like "About"), trigger the actual click event
      // This will fire any existing click handlers you have attached
      if (e.type === 'keydown') {
        // If this was triggered by keyboard, create a synthetic click event
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        });
        item.dispatchEvent(clickEvent);
        return;
      }
      this.closeAllMenus();
    }
  }

  toggleSubmenu(item) {
    const submenu = item.querySelector('.submenu');
    const isOpen = !submenu.hidden;

    this.closeAllSubmenus();

    if (!isOpen) {
      submenu.hidden = false;
      item.setAttribute('aria-expanded', 'true');
      this.currentOpenSubmenu = item;
    }
  }

  handleMenuItemKeydown(e, item, index) {
    const submenu = item.querySelector('.submenu');

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.focusMenuItem((index + 1) % this.menuItems.length);
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.focusMenuItem(index === 0 ? this.menuItems.length - 1 : index - 1);
        break;

      case 'ArrowRight':
        if (submenu) {
          e.preventDefault();
          this.showSubmenu(item);
          const firstSubmenuItem = submenu.querySelector('a');
          if (firstSubmenuItem) {
            firstSubmenuItem.focus();
          }
        }
        break;

      case 'Enter':
      case ' ':
        e.preventDefault();
        this.handleMenuItemClick(e, item);
        break;

      case 'Tab':
        this.closeAllMenus();
        break;

      case 'Escape':
        this.closeAllMenus();
        this.menuButton.focus();
        break;
    }
  }

  showSubmenu(item) {
    this.closeAllSubmenus();
    const submenu = item.querySelector('.submenu');
    if (submenu) {
      submenu.hidden = false;
      item.setAttribute('aria-expanded', 'true');
      this.currentOpenSubmenu = item;
    }
  }

  handleSubmenuKeydown(e, subItem, submenuItems, subIndex, parentItem) {
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        e.stopPropagation();
        const nextIndex = (subIndex + 1) % submenuItems.length;
        submenuItems[nextIndex].focus();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        e.stopPropagation();
        const prevIndex = subIndex === 0 ? submenuItems.length - 1 : subIndex - 1;
        submenuItems[prevIndex].focus();
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        e.stopPropagation();
        parentItem.focus();
        const submenu = parentItem.querySelector('.submenu');
        if (submenu) {
          submenu.hidden = true;
          parentItem.setAttribute('aria-expanded', 'false');
        }
        break;
      }
      case 'Enter':
      case ' ':
        e.preventDefault();
        e.stopPropagation();
        subItem.click();
        break;

      case 'Tab':
        this.closeAllMenus();
        break;

      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        this.closeAllMenus();
        this.menuButton.focus();
        break;
    }
  }
}

// Initialize the menu when DOM is loaded
let menuFlyout;
document.addEventListener('DOMContentLoaded', () => {
  if (!menuBtn || !document.getElementById('menuDropdown')) {
    return;
  }
  menuFlyout = new AccessibleFlyoutMenu();
});

// Language menu interactions are now handled in main/translation.js

// Open modal when About is clicked
if (openAbout) {
  openAbout.addEventListener('click', (e) => {
    e.preventDefault();
    menuFlyout?.closeAllMenus();
    openInfoModal();
  });
}

if (openTools) {
  openTools.addEventListener('click', (e) => {
    e.preventDefault();
    menuFlyout?.closeAllMenus();
    openToolsModal();
  });
}

if (playerControlsCheckbox) {
  playerControlsCheckbox.addEventListener('change', () => {
    setPlayerControlsEnabled(playerControlsCheckbox.checked);
  });
}

if (gizmoControlsCheckbox) {
  gizmoControlsCheckbox.addEventListener('change', () => {
    setGizmoControlsEnabled(gizmoControlsCheckbox.checked);
  });
}

if (gizmoHintsCheckbox) {
  gizmoHintsCheckbox.addEventListener('change', () => {
    setGizmoHintsEnabled(gizmoHintsCheckbox.checked);
  });
}

// The gizmo shortcut key changes the same preferences behind an open panel.
onControlPreferenceChange(() => {
  if (toolsModal && !toolsModal.classList.contains('hidden')) syncToolsModal();
});

if (closeToolsModal) {
  closeToolsModal.addEventListener('click', () => {
    hideToolsModal();
  });
}

// A tool that takes over the screen closes the panel itself.
document.addEventListener('toolspanelclose', () => hideToolsModal());

// Close modal on close button
if (closeInfoModal) {
  closeInfoModal.addEventListener('click', () => {
    hideInfoModal();
  });
}

function installModalKeyHandling(modal, hide) {
  if (!modal) return;
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      hide();
    } else if (e.key === 'Tab') {
      // Only genuinely tabbable, rendered controls: a row CSS hides (the
      // inspector below 1024px) would become the last element and let Tab escape.
      const focusableElements = Array.from(
        modal.querySelectorAll(
          'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.tabIndex !== -1 && !el.disabled && el.offsetParent !== null);
      if (focusableElements.length === 0) return;
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  });

  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      hide();
    }
  });
}

installModalKeyHandling(infoModal, hideInfoModal);
installModalKeyHandling(toolsModal, hideToolsModal);
