const menuBtn = document.getElementById("menuBtn");
const menuDropdown = document.getElementById("menuDropdown");
const openAbout = document.getElementById("about-menu-item");
const hubMenuItem = document.getElementById("hub-menu-item");
const infoModal = document.getElementById("infoModal");
const closeInfoModal = document.getElementById("closeInfoModal");
let previouslyFocused = null;

function openInfoModal() {
  previouslyFocused = document.activeElement;
  infoModal.classList.remove("hidden");
  infoModal.setAttribute("aria-hidden", "false");
  infoModal.setAttribute("aria-modal", "true");

  setTimeout(() => {
    closeInfoModal.focus();
  }, 0);
}

function hideInfoModal() {
  infoModal.classList.add("hidden");
  infoModal.setAttribute("aria-hidden", "true");
  infoModal.removeAttribute("aria-modal");

  if (previouslyFocused) {
    previouslyFocused.focus();
    previouslyFocused = null;
  }
}

class AccessibleFlyoutMenu {
  constructor() {
    this.menuButton = document.getElementById("menuBtn");
    this.menuDropdown = document.getElementById("menuDropdown");
    this.menuItems = this.menuDropdown.querySelectorAll(".menu-item");
    this.isMenuOpen = false;
    this.currentFocus = -1;
    this.currentOpenSubmenu = null;

    this.init();
  }

  init() {
    // Main menu button events
    this.menuButton.addEventListener("click", (e) => {
      e.preventDefault();
      this.toggleMainMenu();
    });

    this.menuButton.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.openMainMenu();
        this.focusFirstMenuItem();
      }
    });

    // Menu item events
    this.menuItems.forEach((item, index) => {
      // Mouse events (preserve existing functionality)
      item.addEventListener("mouseenter", () => {
        this.handleMouseEnter(item);
      });

      item.addEventListener("mouseleave", () => {
        this.handleMouseLeave(item);
      });

      // Keyboard events
      item.addEventListener("keydown", (e) => {
        this.handleMenuItemKeydown(e, item, index);
      });

      item.addEventListener("click", (e) => {
        this.handleMenuItemClick(e, item);
      });

      // Submenu events
      const submenu = item.querySelector(".submenu");
      if (submenu) {
        const submenuItems = submenu.querySelectorAll("a");
        submenuItems.forEach((subItem, subIndex) => {
          subItem.addEventListener("keydown", (e) => {
            this.handleSubmenuKeydown(e, subItem, submenuItems, subIndex, item);
          });

          subItem.addEventListener("click", (e) => {
            e.stopPropagation();
            this.closeAllMenus();
          });
        });
      }
    });

    // Close menu when clicking outside
    document.addEventListener("click", (e) => {
      if (
        !this.menuButton.contains(e.target) &&
        !this.menuDropdown.contains(e.target)
      ) {
        this.closeAllMenus();
      }
    });

    // Close menu on Escape
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "Escape") {
          return;
        }

        let handled = false;

        if (!infoModal.classList.contains("hidden")) {
          hideInfoModal();
          handled = true;
        }

        if (this.isMenuOpen) {
          this.closeAllMenus();
          this.menuButton.focus();
          handled = true;
        }

        if (handled) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true,
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
    this.menuDropdown.classList.remove("hidden");
    this.menuButton.setAttribute("aria-expanded", "true");
    this.currentFocus = -1;
  }

  closeAllMenus() {
    this.isMenuOpen = false;
    this.menuDropdown.classList.add("hidden");
    this.menuButton.setAttribute("aria-expanded", "false");
    this.closeAllSubmenus();
    this.currentFocus = -1;
  }

  closeAllSubmenus() {
    this.menuItems.forEach((item) => {
      const submenu = item.querySelector(".submenu");
      if (submenu) {
        submenu.hidden = true;
        item.setAttribute("aria-expanded", "false");
      }
    });
    this.currentOpenSubmenu = null;
  }

  focusFirstMenuItem() {
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
    const submenu = item.querySelector(".submenu");
    if (submenu) {
      submenu.hidden = false;
      item.setAttribute("aria-expanded", "true");
      this.currentOpenSubmenu = item;
    }
  }

  handleMouseLeave() {
    // Keep submenu open for keyboard navigation
    // Only close on mouse leave from the entire menu area
  }

  handleMenuItemClick(e, item) {
    const submenu = item.querySelector(".submenu");
    if (submenu) {
      e.preventDefault();
      this.toggleSubmenu(item);
    } else {
      // For leaf menu items (like "About"), trigger the actual click event
      // This will fire any existing click handlers you have attached
      if (e.type === "keydown") {
        // If this was triggered by keyboard, create a synthetic click event
        const clickEvent = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
        });
        item.dispatchEvent(clickEvent);
      }
      this.closeAllMenus();
    }
  }

  toggleSubmenu(item) {
    const submenu = item.querySelector(".submenu");
    const isOpen = !submenu.hidden;

    this.closeAllSubmenus();

    if (!isOpen) {
      submenu.hidden = false;
      item.setAttribute("aria-expanded", "true");
      this.currentOpenSubmenu = item;
    }
  }

  handleMenuItemKeydown(e, item, index) {
    const submenu = item.querySelector(".submenu");

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this.focusMenuItem((index + 1) % this.menuItems.length);
        break;

      case "ArrowUp":
        e.preventDefault();
        this.focusMenuItem(index === 0 ? this.menuItems.length - 1 : index - 1);
        break;

      case "ArrowRight":
        if (submenu) {
          e.preventDefault();
          this.showSubmenu(item);
          const firstSubmenuItem = submenu.querySelector("a");
          if (firstSubmenuItem) {
            firstSubmenuItem.focus();
          }
        }
        break;

      case "Enter":
      case " ":
        e.preventDefault();
        this.handleMenuItemClick(e, item);
        break;

      case "Escape":
        this.closeAllMenus();
        this.menuButton.focus();
        break;
    }
  }

  showSubmenu(item) {
    this.closeAllSubmenus();
    const submenu = item.querySelector(".submenu");
    if (submenu) {
      submenu.hidden = false;
      item.setAttribute("aria-expanded", "true");
      this.currentOpenSubmenu = item;
    }
  }

  handleSubmenuKeydown(e, subItem, submenuItems, subIndex, parentItem) {
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        e.stopPropagation();
        const nextIndex = (subIndex + 1) % submenuItems.length;
        submenuItems[nextIndex].focus();
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        e.stopPropagation();
        const prevIndex =
          subIndex === 0 ? submenuItems.length - 1 : subIndex - 1;
        submenuItems[prevIndex].focus();
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        e.stopPropagation();
        parentItem.focus();
        const submenu = parentItem.querySelector(".submenu");
        if (submenu) {
          submenu.hidden = true;
          parentItem.setAttribute("aria-expanded", "false");
        }
        break;
      }
      case "Enter":
      case " ":
        e.preventDefault();
        e.stopPropagation();
        subItem.click();
        break;

      case "Escape":
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
document.addEventListener("DOMContentLoaded", () => {
  menuFlyout = new AccessibleFlyoutMenu();
});

hubMenuItem.addEventListener("click", (e) => {
  e.preventDefault();
  window.open("https://hub.flockxr.com/", "_blank", "noopener,noreferrer");
  menuFlyout.closeAllMenus();
});

// Language menu interactions are now handled in main/translation.js

// Open modal when About is clicked
openAbout.addEventListener("click", (e) => {
  e.preventDefault();
  menuFlyout?.closeAllMenus();
  openInfoModal();
});

// Close modal on close button
closeInfoModal.addEventListener("click", () => {
  hideInfoModal();
});

// Handle keyboard events for modal
infoModal.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    hideInfoModal();
  } else if (e.key === "Tab") {
    // Trap focus within modal
    const focusableElements = infoModal.querySelectorAll(
      'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])',
    );
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

// Close menu when clicking outside
window.addEventListener("click", (e) => {
  if (!menuBtn.contains(e.target) && !menuDropdown.contains(e.target)) {
    menuFlyout.closeAllMenus();
  }

  if (e.target === infoModal) {
    hideInfoModal();
  }
});
