/**
 * Custom Color Picker for Flock XR
 * Designed for accessibility and ease of use for ages 9-14
 */

import { translate } from '../main/translation.js';

export class CustomColorPicker {
  constructor(options = {}) {
    this.currentColor = options.color || '#ff0000';
    this.onColorChange = options.onColorChange || (() => {});
    this.onClose = options.onClose || (() => {});
    this.targetElement = options.target || document.body;
    
    // State management
    this.isOpen = false;
    this.showAdvanced = false;
    this.isPickingFromScreen = false;
    
    // Common colors for quick selection
    this.presetColors = [
      '#ff0000', '#ff8000', '#ffff00', '#80ff00',
      '#00ff00', '#00ff80', '#00ffff', '#0080ff',
      '#0000ff', '#8000ff', '#ff00ff', '#ff0080',
      '#ffffff', '#cccccc', '#999999', '#666666',
      '#333333', '#000000', '#8b4513', '#654321'
    ];
    
    // Skin tone colors
    this.skinTones = [
      '#ffdfc4', '#f0d5b1', '#e1b899', '#d1a36a',
      '#c68642', '#a86b38', '#8d5524', '#654321'
    ];
    
    this.createElement();
    this.bindEvents();
  }
  
  createElement() {
    // Main container
    this.container = document.createElement('div');
    this.container.className = 'custom-color-picker';
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-label', 'Color Picker');
    this.container.style.display = 'none';
    
    this.container.innerHTML = `
      <div class="color-picker-backdrop"></div>
      <div class="color-picker-content">
        <div class="color-picker-header">
          <h3 data-i18n="choose_a_color">Choose a Color</h3>
          <button class="color-picker-close" aria-label="Close color picker" data-i18n-aria-label="close_color_picker">&times;</button>
        </div>
        
        <!-- Current color display -->
        <div class="color-picker-current">
          <div class="current-color-display" style="background-color: ${this.currentColor}" aria-label="Current color"></div>
          <span class="current-color-text">${this.currentColor}</span>
        </div>
        
        <!-- Preset colors section -->
        <div class="color-picker-section">
          <h4 data-i18n="quick_colors">Quick Colors</h4>
          <div class="color-palette" role="group" aria-label="Quick color selection">
            ${this.presetColors.map((color, index) => 
              `<button class="color-swatch" 
                      style="background-color: ${color}" 
                      data-color="${color}"
                      aria-label="Select ${this.getColorName(color)}"
                      tabindex="0"></button>`
            ).join('')}
          </div>
        </div>
        
        <!-- Skin tones section -->
        <div class="color-picker-section">
          <h4 data-i18n="skin_tones">Skin Tones</h4>
          <div class="color-palette skin-tones" role="group" aria-label="Skin tone selection">
            ${this.skinTones.map((color, index) => 
              `<button class="color-swatch" 
                      style="background-color: ${color}" 
                      data-color="${color}"
                      aria-label="Select skin tone ${index + 1}"
                      tabindex="0"></button>`
            ).join('')}
          </div>
        </div>
        
        <!-- Color wheel/picker -->
        <div class="color-picker-section">
          <h4 data-i18n="custom_color">Custom Color</h4>
          <div class="color-wheel-container">
            <canvas class="color-wheel" width="200" height="200" tabindex="0" aria-label="Color wheel - use arrow keys to navigate"></canvas>
            <canvas class="color-brightness" width="200" height="20" tabindex="0" aria-label="Brightness slider - use left and right arrows"></canvas>
          </div>
        </div>
        
        <!-- Screen color picker -->
        <div class="color-picker-section">
          <button class="screen-color-picker-btn" type="button" tabindex="0">
            <span aria-hidden="true">🎯</span> <span data-i18n="pick_from_screen">Pick from Screen</span>
          </button>
        </div>
        
        <!-- Progressive disclosure toggle -->
        <div class="color-picker-section">
          <button class="advanced-toggle" type="button" aria-expanded="false" tabindex="0">
            <span class="toggle-text" data-i18n="more_colors">More Colors</span>
            <span class="toggle-arrow">▼</span>
          </button>
        </div>
        
        <!-- Advanced options (hidden by default) -->
        <div class="color-picker-advanced" style="display: none;">
          <div class="rgb-inputs">
            <h4 data-i18n="rgb_values">RGB Values</h4>
            <div class="rgb-controls">
              <label>
                R: <input type="range" class="rgb-slider" data-channel="r" min="0" max="255" value="255">
                <input type="number" class="rgb-number" data-channel="r" min="0" max="255" value="255">
              </label>
              <label>
                G: <input type="range" class="rgb-slider" data-channel="g" min="0" max="255" value="0">
                <input type="number" class="rgb-number" data-channel="g" min="0" max="255" value="0">
              </label>
              <label>
                B: <input type="range" class="rgb-slider" data-channel="b" min="0" max="255" value="0">
                <input type="number" class="rgb-number" data-channel="b" min="0" max="255" value="0">
              </label>
            </div>
          </div>
          
          <div class="css-input">
            <h4 data-i18n="css_color">CSS Color</h4>
            <input type="text" class="css-color-input" placeholder="Enter color name or hex code" value="${this.currentColor}">
          </div>
        </div>
        
        <!-- Action buttons -->
        <div class="color-picker-actions">
          <button class="color-picker-btn cancel-btn" type="button" data-i18n="cancel">Cancel</button>
          <button class="color-picker-btn confirm-btn" type="button" data-i18n="use_this_color">Use This Color</button>
        </div>
      </div>
    `;
    
    // Add to target element
    this.targetElement.appendChild(this.container);
    
    // Store references to key elements
    this.currentColorDisplay = this.container.querySelector('.current-color-display');
    this.currentColorText = this.container.querySelector('.current-color-text');
    this.colorWheel = this.container.querySelector('.color-wheel');
    this.brightnessSlider = this.container.querySelector('.color-brightness');
    this.advancedToggle = this.container.querySelector('.advanced-toggle');
    this.advancedSection = this.container.querySelector('.color-picker-advanced');
    this.rgbSliders = this.container.querySelectorAll('.rgb-slider');
    this.rgbNumbers = this.container.querySelectorAll('.rgb-number');
    this.cssInput = this.container.querySelector('.css-color-input');
    
    // Initialize color wheel
    this.initializeColorWheel();
  }
  
  bindEvents() {
    // Close button
    this.container.querySelector('.color-picker-close').addEventListener('click', () => this.close());
    
    // Backdrop click to close
    this.container.querySelector('.color-picker-backdrop').addEventListener('click', () => this.close());
    
    // Color swatches
    this.container.addEventListener('click', (e) => {
      if (e.target.classList.contains('color-swatch')) {
        this.setColor(e.target.dataset.color);
      }
    });
    
    // Advanced toggle
    this.advancedToggle.addEventListener('click', () => this.toggleAdvanced());
    
    // RGB controls
    this.rgbSliders.forEach(slider => {
      slider.addEventListener('input', () => this.updateFromRGB());
    });
    
    this.rgbNumbers.forEach(input => {
      input.addEventListener('input', () => this.updateFromRGB());
    });
    
    // CSS input
    this.cssInput.addEventListener('input', () => this.updateFromCSS());
    
    // Screen color picker
    this.container.querySelector('.screen-color-picker-btn').addEventListener('click', () => this.startScreenColorPicking());
    
    // Action buttons
    this.container.querySelector('.cancel-btn').addEventListener('click', () => this.close());
    this.container.querySelector('.confirm-btn').addEventListener('click', () => this.confirmColor());
    
    // Keyboard navigation
    this.container.addEventListener('keydown', (e) => this.handleKeydown(e));
    
    // Color wheel events
    this.colorWheel.addEventListener('click', (e) => this.handleColorWheelClick(e));
    this.colorWheel.addEventListener('keydown', (e) => this.handleColorWheelKeydown(e));
    
    // Brightness slider events
    this.brightnessSlider.addEventListener('click', (e) => this.handleBrightnessClick(e));
    this.brightnessSlider.addEventListener('keydown', (e) => this.handleBrightnessKeydown(e));
  }
  
  initializeColorWheel() {
    const canvas = this.colorWheel;
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;
    
    // Draw color wheel
    for (let angle = 0; angle < 360; angle += 1) {
      const startAngle = (angle - 1) * Math.PI / 180;
      const endAngle = angle * Math.PI / 180;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.lineWidth = 2;
      ctx.strokeStyle = `hsl(${angle}, 100%, 50%)`;
      ctx.stroke();
    }
    
    // Draw brightness slider
    this.updateBrightnessSlider();
  }
  
  updateBrightnessSlider() {
    const canvas = this.brightnessSlider;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    
    // Get current hue from color
    const hsl = this.hexToHSL(this.currentColor);
    
    gradient.addColorStop(0, `hsl(${hsl.h}, ${hsl.s}%, 0%)`);
    gradient.addColorStop(1, `hsl(${hsl.h}, ${hsl.s}%, 100%)`);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  handleColorWheelClick(e) {
    const rect = this.colorWheel.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const x = e.clientX - rect.left - centerX;
    const y = e.clientY - rect.top - centerY;
    
    const angle = Math.atan2(y, x) * 180 / Math.PI;
    const hue = (angle + 360) % 360;
    
    const currentHSL = this.hexToHSL(this.currentColor);
    const newColor = this.hslToHex(hue, currentHSL.s, currentHSL.l);
    this.setColor(newColor);
  }
  
  handleColorWheelKeydown(e) {
    const currentHSL = this.hexToHSL(this.currentColor);
    let newHue = currentHSL.h;
    
    switch(e.key) {
      case 'ArrowLeft':
        newHue = (newHue - 5 + 360) % 360;
        break;
      case 'ArrowRight':
        newHue = (newHue + 5) % 360;
        break;
      case 'ArrowUp':
        newHue = (newHue - 15 + 360) % 360;
        break;
      case 'ArrowDown':
        newHue = (newHue + 15) % 360;
        break;
      default:
        return;
    }
    
    e.preventDefault();
    const newColor = this.hslToHex(newHue, currentHSL.s, currentHSL.l);
    this.setColor(newColor);
  }
  
  handleBrightnessClick(e) {
    const rect = this.brightnessSlider.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const lightness = Math.max(0, Math.min(100, percentage * 100));
    
    const currentHSL = this.hexToHSL(this.currentColor);
    const newColor = this.hslToHex(currentHSL.h, currentHSL.s, lightness);
    this.setColor(newColor);
  }
  
  handleBrightnessKeydown(e) {
    const currentHSL = this.hexToHSL(this.currentColor);
    let newLightness = currentHSL.l;
    
    switch(e.key) {
      case 'ArrowLeft':
        newLightness = Math.max(0, newLightness - 5);
        break;
      case 'ArrowRight':
        newLightness = Math.min(100, newLightness + 5);
        break;
      default:
        return;
    }
    
    e.preventDefault();
    const newColor = this.hslToHex(currentHSL.h, currentHSL.s, newLightness);
    this.setColor(newColor);
  }
  
  handleKeydown(e) {
    // Handle ESC to close
    if (e.key === 'Escape') {
      this.close();
      return;
    }
    
    // Handle Enter to confirm on action buttons
    if (e.key === 'Enter' && e.target.classList.contains('color-picker-btn')) {
      e.target.click();
      return;
    }
    
    // Handle Space and Enter on color swatches
    if ((e.key === ' ' || e.key === 'Enter') && e.target.classList.contains('color-swatch')) {
      e.preventDefault();
      this.setColor(e.target.dataset.color);
      return;
    }
    
    // Handle arrow key navigation for color swatches
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      if (e.target.classList.contains('color-swatch')) {
        this.navigateColorSwatches(e.target, e.key);
        e.preventDefault();
        return;
      }
    }
    
    // Handle Tab navigation within dialog
    if (e.key === 'Tab') {
      this.handleTabNavigation(e);
    }
  }
  
  navigateColorSwatches(currentSwatch, direction) {
    const palette = currentSwatch.closest('.color-palette');
    const swatches = Array.from(palette.querySelectorAll('.color-swatch'));
    const currentIndex = swatches.indexOf(currentSwatch);
    let newIndex = currentIndex;
    
    // Calculate grid dimensions (assuming roughly square swatches in rows)
    const cols = Math.floor(Math.sqrt(swatches.length)) || 4; // fallback to 4 columns
    
    switch(direction) {
      case 'ArrowLeft':
        newIndex = currentIndex > 0 ? currentIndex - 1 : swatches.length - 1;
        break;
      case 'ArrowRight':
        newIndex = currentIndex < swatches.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'ArrowUp':
        newIndex = currentIndex - cols;
        if (newIndex < 0) newIndex = currentIndex + Math.floor(swatches.length / cols) * cols;
        if (newIndex >= swatches.length) newIndex = swatches.length - 1;
        break;
      case 'ArrowDown':
        newIndex = currentIndex + cols;
        if (newIndex >= swatches.length) newIndex = currentIndex % cols;
        break;
    }
    
    if (swatches[newIndex]) {
      swatches[newIndex].focus();
    }
  }
  
  handleTabNavigation(e) {
    const focusableElements = this.container.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), canvas[tabindex="0"], [tabindex]:not([tabindex="-1"])'
    );
    const focusableArray = Array.from(focusableElements);
    const currentIndex = focusableArray.indexOf(e.target);
    
    if (e.shiftKey) {
      // Shift+Tab - go backwards
      if (currentIndex === 0) {
        focusableArray[focusableArray.length - 1].focus();
        e.preventDefault();
      }
    } else {
      // Tab - go forwards  
      if (currentIndex === focusableArray.length - 1) {
        focusableArray[0].focus();
        e.preventDefault();
      }
    }
  }
  
  toggleAdvanced() {
    this.showAdvanced = !this.showAdvanced;
    this.advancedSection.style.display = this.showAdvanced ? 'block' : 'none';
    this.advancedToggle.setAttribute('aria-expanded', this.showAdvanced.toString());
    
    const arrow = this.container.querySelector('.toggle-arrow');
    const text = this.container.querySelector('.toggle-text');
    
    arrow.textContent = this.showAdvanced ? '▲' : '▼';
    text.textContent = this.showAdvanced ? 'Hide RGB & CSS Options' : 'Show RGB & CSS Options';
  }
  
  updateFromRGB() {
    const r = parseInt(this.container.querySelector('[data-channel="r"].rgb-slider').value);
    const g = parseInt(this.container.querySelector('[data-channel="g"].rgb-slider').value);
    const b = parseInt(this.container.querySelector('[data-channel="b"].rgb-slider').value);
    
    // Sync number inputs
    this.container.querySelector('[data-channel="r"].rgb-number').value = r;
    this.container.querySelector('[data-channel="g"].rgb-number').value = g;
    this.container.querySelector('[data-channel="b"].rgb-number').value = b;
    
    const hex = this.rgbToHex(r, g, b);
    this.setColor(hex, false); // false to prevent circular updates
  }
  
  updateFromCSS() {
    const value = this.cssInput.value.trim();
    if (this.isValidColor(value)) {
      this.setColor(value, false);
    }
  }
  
  setColor(color, updateInputs = true) {
    this.currentColor = color;
    
    // Update visual display
    this.currentColorDisplay.style.backgroundColor = color;
    this.currentColorText.textContent = color;
    
    if (updateInputs) {
      // Update RGB controls
      const rgb = this.hexToRGB(color);
      this.container.querySelector('[data-channel="r"].rgb-slider').value = rgb.r;
      this.container.querySelector('[data-channel="g"].rgb-slider').value = rgb.g;
      this.container.querySelector('[data-channel="b"].rgb-slider').value = rgb.b;
      this.container.querySelector('[data-channel="r"].rgb-number').value = rgb.r;
      this.container.querySelector('[data-channel="g"].rgb-number').value = rgb.g;
      this.container.querySelector('[data-channel="b"].rgb-number').value = rgb.b;
      
      // Update CSS input
      this.cssInput.value = color;
    }
    
    // Update brightness slider
    this.updateBrightnessSlider();
    
    // Trigger change callback
    this.onColorChange(color);
  }
  
  startScreenColorPicking() {
    this.isPickingFromScreen = true;
    document.body.style.cursor = 'crosshair';
    
    // Add instructions
    const instructions = document.createElement('div');
    instructions.className = 'screen-pick-instructions';
    instructions.innerHTML = `
      <div class="instructions-content">
        <p>Click anywhere to pick a color from that location</p>
        <p>Press Escape to cancel</p>
      </div>
    `;
    document.body.appendChild(instructions);
    
    // Add event listeners for screen picking
    const pickFromScreen = (e) => {
      if (e.target === instructions || instructions.contains(e.target)) {
        return;
      }
      
      e.preventDefault();
      e.stopPropagation();
      
      // Get color from element
      const style = getComputedStyle(e.target);
      const bgColor = style.backgroundColor;
      
      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
        const hex = this.rgbStringToHex(bgColor);
        if (hex) {
          this.setColor(hex);
        }
      }
      
      this.stopScreenColorPicking();
    };
    
    const cancelPicking = (e) => {
      if (e.key === 'Escape') {
        this.stopScreenColorPicking();
      }
    };
    
    document.addEventListener('click', pickFromScreen, true);
    document.addEventListener('keydown', cancelPicking, true);
    
    // Store references for cleanup
    this.screenPickEvents = { pickFromScreen, cancelPicking };
    this.screenPickInstructions = instructions;
  }
  
  stopScreenColorPicking() {
    this.isPickingFromScreen = false;
    document.body.style.cursor = '';
    
    if (this.screenPickEvents) {
      document.removeEventListener('click', this.screenPickEvents.pickFromScreen, true);
      document.removeEventListener('keydown', this.screenPickEvents.cancelPicking, true);
      this.screenPickEvents = null;
    }
    
    if (this.screenPickInstructions) {
      this.screenPickInstructions.remove();
      this.screenPickInstructions = null;
    }
  }
  
  confirmColor() {
    this.onColorChange(this.currentColor);
    this.close();
  }
  
  open(color = this.currentColor) {
    this.setColor(color);
    this.container.style.display = 'block';
    this.isOpen = true;
    
    // Focus the first focusable element
    const firstFocusable = this.container.querySelector('button, input, [tabindex="0"]');
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }
  
  close() {
    this.container.style.display = 'none';
    this.isOpen = false;
    this.stopScreenColorPicking();
    this.onClose();
  }
  
  // Utility functions
  getColorName(hex) {
    const colorNames = {
      '#ff0000': 'red',
      '#ff8000': 'orange',
      '#ffff00': 'yellow',
      '#80ff00': 'lime',
      '#00ff00': 'green',
      '#00ff80': 'spring green',
      '#00ffff': 'cyan',
      '#0080ff': 'sky blue',
      '#0000ff': 'blue',
      '#8000ff': 'purple',
      '#ff00ff': 'magenta',
      '#ff0080': 'pink',
      '#ffffff': 'white',
      '#cccccc': 'light gray',
      '#999999': 'gray',
      '#666666': 'dark gray',
      '#333333': 'very dark gray',
      '#000000': 'black',
      '#8b4513': 'brown',
      '#654321': 'dark brown'
    };
    
    return colorNames[hex.toLowerCase()] || hex;
  }
  
  hexToRGB(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
  
  rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  
  hexToHSL(hex) {
    const rgb = this.hexToRGB(hex);
    if (!rgb) return { h: 0, s: 0, l: 0 };
    
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }
  
  hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    
    if (0 <= h && h < 60) {
      r = c; g = x; b = 0;
    } else if (60 <= h && h < 120) {
      r = x; g = c; b = 0;
    } else if (120 <= h && h < 180) {
      r = 0; g = c; b = x;
    } else if (180 <= h && h < 240) {
      r = 0; g = x; b = c;
    } else if (240 <= h && h < 300) {
      r = x; g = 0; b = c;
    } else if (300 <= h && h < 360) {
      r = c; g = 0; b = x;
    }
    
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    
    return this.rgbToHex(r, g, b);
  }
  
  rgbStringToHex(rgbString) {
    const matches = rgbString.match(/\d+/g);
    if (matches && matches.length >= 3) {
      const r = parseInt(matches[0]);
      const g = parseInt(matches[1]);
      const b = parseInt(matches[2]);
      return this.rgbToHex(r, g, b);
    }
    return null;
  }
  
  isValidColor(color) {
    const s = new Option().style;
    s.color = color;
    return s.color !== '';
  }
}