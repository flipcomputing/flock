/**
 * Compact Custom Color Picker for Flock XR
 * Designed for young users with focus on simplicity and accessibility
 */

import { translate } from '../main/translation.js';

class CustomColorPicker {
  constructor(options = {}) {
    this.currentColor = options.color || '#ff0000';
    this.onColorChange = options.onColorChange || (() => {});
    this.onClose = options.onClose || (() => {});
    this.targetElement = options.target || document.body;
    
    this.isOpen = false;
    
    // Compact preset colors 
    this.presetColors = [
      '#ff0000', '#ff8000', '#ffff00', '#80ff00',
      '#00ff00', '#00ff80', '#00ffff', '#0080ff',
      '#0000ff', '#8000ff', '#ff00ff', '#ff0080',
      '#ffffff', '#cccccc', '#666666', '#000000'
    ];
    
    this.createElement();
    this.bindEvents();
  }
  
  generateSkinPalette() {
    const skinColors = [
      '#FDBCB4', '#F1C27D', '#E0AC69', '#C68642',
      '#8D5524', '#C67856', '#A0522D', '#8B4513'
    ];
    return skinColors.map((color) => 
      `<button class="color-swatch" style="background-color: ${color}" data-color="${color}" aria-label="Skin tone ${color}" tabindex="0"></button>`
    ).join('');
  }
  
  initializeColorWheel() {
    this.drawColorWheel();
    this.currentHue = 0;
    this.currentLightness = 50;
  }
  
  drawColorWheel() {
    const centerX = 40;
    const centerY = 40;
    const radius = 35;
    
    // Draw hue wheel
    for (let angle = 0; angle < 360; angle++) {
      const startAngle = (angle - 1) * Math.PI / 180;
      const endAngle = angle * Math.PI / 180;
      
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      this.ctx.lineWidth = 8;
      this.ctx.strokeStyle = `hsl(${angle}, 100%, 50%)`;
      this.ctx.stroke();
    }
    
    // Draw center circle for saturation/lightness
    const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 25);
    gradient.addColorStop(0, 'white');
    gradient.addColorStop(1, `hsl(${this.currentHue}, 100%, 50%)`);
    
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, 25, 0, 2 * Math.PI);
    this.ctx.fillStyle = gradient;
    this.ctx.fill();
  }
  
  hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }
  
  createElement() {
    this.container = document.createElement('div');
    this.container.className = 'custom-color-picker';
    this.container.style.display = 'none';
    
    this.container.innerHTML = `
      <div class="color-picker-backdrop"></div>
      <div class="color-picker-content">
        <div class="color-picker-body">
          <div class="color-picker-left">
            <div class="color-wheel-section">
              <canvas class="color-wheel-canvas" width="100" height="100"></canvas>
            </div>
          </div>
          
          <div class="color-picker-right">
            <div class="color-picker-section">
              <div class="color-palette">
                ${this.presetColors.map((color) => 
                  `<button class="color-swatch" style="background-color: ${color}" data-color="${color}" tabindex="0"></button>`
                ).join('')}
              </div>
              <div class="color-controls">
                <div class="hue-slider-container" tabindex="0" role="slider" aria-label="Hue slider" aria-valuemin="0" aria-valuemax="360" aria-valuenow="0">
                  <canvas class="hue-slider-canvas" width="150" height="20"></canvas>
                  <div class="hue-slider-handle"></div>
                </div>
                <button class="color-picker-eyedropper" aria-label="Pick color from screen" title="Pick color from screen">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor">
                    <path d="M405.6 93.2L304 194.8L294.6 185.4C282.1 172.9 261.8 172.9 249.3 185.4C236.8 197.9 236.8 218.2 249.3 230.7L409.3 390.7C421.8 403.2 442.1 403.2 454.6 390.7C467.1 378.2 467.1 357.9 454.6 345.4L445.2 336L546.8 234.4C585.8 195.4 585.8 132.2 546.8 93.3C507.8 54.4 444.6 54.3 405.7 93.3zM119.4 387.3C104.4 402.3 96 422.7 96 443.9L96 486.3L69.4 526.2C60.9 538.9 62.6 555.8 73.4 566.6C84.2 577.4 101.1 579.1 113.8 570.6L153.7 544L196.1 544C217.3 544 237.7 535.6 252.7 520.6L362.1 411.2L316.8 365.9L207.4 475.3C204.4 478.3 200.3 480 196.1 480L160 480L160 443.9C160 439.7 161.7 435.6 164.7 432.6L274.1 323.2L228.8 277.9L119.4 387.3z"/>
                  </svg>
                </button>
                <button class="color-picker-more-options" aria-label="More options" title="More options">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor">
                    <path d="M535.1 342.6C547.6 330.1 547.6 309.8 535.1 297.3L375.1 137.3C362.6 124.8 342.3 124.8 329.8 137.3C317.3 149.8 317.3 170.1 329.8 182.6L467.2 320L329.9 457.4C317.4 469.9 317.4 490.2 329.9 502.7C342.4 515.2 362.7 515.2 375.2 502.7L535.2 342.7zM183.1 502.6L343.1 342.6C355.6 330.1 355.6 309.8 343.1 297.3L183.1 137.3C170.6 124.8 150.3 124.8 137.8 137.3C125.3 149.8 125.3 170.1 137.8 182.6L275.2 320L137.9 457.4C125.4 469.9 125.4 490.2 137.9 502.7C150.4 515.2 170.7 515.2 183.2 502.7z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="color-advanced-options" style="display: none;">
          <div class="advanced-options-row">
            <div class="css-input-container">
              <span class="css-prefix">#</span>
              <input type="text" id="css-color-input" class="css-color-input" placeholder="ff0000 or red" />
            </div>
            
            <div class="rgb-inputs">
              <div class="rgb-input-group">
                <input type="number" id="rgb-r" class="rgb-input" min="0" max="255" value="255" />
                <label for="rgb-r">R</label>
              </div>
              <div class="rgb-input-group">
                <input type="number" id="rgb-g" class="rgb-input" min="0" max="255" value="0" />
                <label for="rgb-g">G</label>
              </div>
              <div class="rgb-input-group">
                <input type="number" id="rgb-b" class="rgb-input" min="0" max="255" value="0" />
                <label for="rgb-b">B</label>
              </div>
            </div>
          </div>
        </div>
        
        <div class="color-picker-footer">
          <div class="current-color-display" style="background-color: ${this.currentColor}"></div>
          <button class="color-picker-use" type="button" aria-label="Use color">✓</button>
          <button class="color-picker-cancel" type="button" aria-label="Cancel">✕</button>
        </div>
        
      </div>
    `;
    
    // Append to canvas area for proper positioning
    const canvasArea = document.getElementById('canvasArea');
    if (canvasArea) {
      canvasArea.appendChild(this.container);
    } else {
      this.targetElement.appendChild(this.container);
    }
    
    // Store references
    this.canvas = this.container.querySelector('.color-wheel-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.hueCanvas = this.container.querySelector('.hue-slider-canvas');
    this.hueCtx = this.hueCanvas.getContext('2d');
    this.currentColorDisplay = this.container.querySelector('.current-color-display');
    this.currentColorText = this.container.querySelector('.current-color-text');
    
    // Initialize current hue for the slider
    this.currentHue = 0;
    
    // Initialize advanced options state
    this.advancedOptionsOpen = false;
    
    // Initialize color wheel and hue slider
    this.drawColorWheel();
    this.drawHueSlider();
  }
  
  drawColorWheel() {
    const centerX = 50;
    const centerY = 50;
    const radius = 48;
    
    // Clear canvas
    this.ctx.clearRect(0, 0, 100, 100);
    
    // Create gradient from center (white) to edge (colors)
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 100; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= radius) {
          // Calculate hue based on angle
          const hue = Math.atan2(dy, dx) * 180 / Math.PI;
          const normalizedHue = (hue + 360) % 360;
          
          // Calculate saturation based on distance from center
          const saturation = Math.min(100, (distance / radius) * 100);
          
          // Set pixel color
          this.ctx.fillStyle = `hsl(${normalizedHue}, ${saturation}%, 60%)`;
          this.ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    
    // Draw border
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    this.ctx.strokeStyle = '#ddd';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }

  bindEvents() {
    // Close events - only backdrop click now
    const backdrop = this.container.querySelector('.color-picker-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => this.close());
    }
    
    // Click outside to close
    this.outsideClickHandler = (e) => {
      if (this.isOpen && !this.container.contains(e.target)) {
        this.close();
      }
    };
    
    // Eyedropper tool
    this.container.querySelector('.color-picker-eyedropper').addEventListener('click', () => this.startEyedropper());
    
    // Color wheel canvas
    this.canvas.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.handleCanvasClick(x, y);
    });
    
    // Make color wheel keyboard focusable
    this.canvas.setAttribute('tabindex', '0');
    this.canvas.setAttribute('role', 'slider');
    this.canvas.setAttribute('aria-label', 'Color wheel: use arrow keys to select hue and saturation');
    this.canvas.setAttribute('aria-valuenow', '0');
    this.canvas.setAttribute('aria-valuemin', '0');
    this.canvas.setAttribute('aria-valuemax', '360');
    
    // Color wheel keyboard navigation
    this.canvas.addEventListener('keydown', (e) => this.handleColorWheelKeydown(e));
    
    // Initialize color wheel position tracking
    this.colorWheelPosition = { x: 50, y: 50 }; // Center position
    this.createColorWheelIndicator();
    
    // Hue slider canvas
    this.hueCanvas.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = this.hueCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      this.handleHueSliderClick(x);
    });
    
    // Hue slider dragging
    this.initHueSliderDragging();
    
    // More options button
    this.container.querySelector('.color-picker-more-options').addEventListener('click', () => this.toggleAdvancedOptions());
    
    // CSS color input
    const cssInput = this.container.querySelector('.css-color-input');
    cssInput.addEventListener('input', (e) => this.handleCssColorInput(e.target.value));
    
    // Track when user is actively typing in CSS input
    cssInput.addEventListener('focus', () => {
      this.cssInputFocused = true;
      // Select all text when clicking in the input for easy replacement
      cssInput.select();
    });
    cssInput.addEventListener('blur', () => {
      this.cssInputFocused = false;
      // Update to show current color when user finishes editing
      this.updateCssInput();
    });
    
    // RGB inputs
    const rgbInputs = this.container.querySelectorAll('.rgb-input');
    rgbInputs.forEach(input => {
      input.addEventListener('input', () => this.handleRgbInput());
    });
    
    // Color swatches with grid navigation
    this.setupColorSwatchNavigation();
    
    this.container.addEventListener('click', (e) => {
      if (e.target.classList.contains('color-swatch')) {
        this.setColor(e.target.dataset.color);
      }
    });
    
    // Action buttons
    this.container.querySelector('.color-picker-use').addEventListener('click', () => this.confirmColor());
    this.container.querySelector('.color-picker-cancel').addEventListener('click', () => this.close());
    
    // Keyboard navigation
    this.container.addEventListener('keydown', (e) => this.handleKeydown(e));
    
    // Setup focus trapping
    this.setupFocusTrapping();
    
    // Setup hue slider keyboard controls
    this.setupHueSliderKeyboard();
  }
  
  handleCanvasClick(x, y) {
    const centerX = 50;
    const centerY = 50;
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const radius = 48;
    
    if (distance <= radius) {
      // Update position tracking
      this.colorWheelPosition = { x, y };
      this.updateColorWheelIndicator();
      
      // Calculate hue based on angle
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const hue = (angle + 360) % 360;
      
      // Calculate saturation based on distance from center
      const saturation = Math.min(100, (distance / radius) * 100);
      
      // Convert to hex color
      const color = this.hslToHex(hue, saturation, 60);
      this.setColor(color);
    }
  }
  
  hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }
  
  setupFocusTrapping() {
    // Get all focusable elements within the color picker
    this.focusableElements = this.container.querySelectorAll(
      'button, input, [tabindex]:not([tabindex="-1"])'
    );
    this.firstFocusableElement = this.focusableElements[0];
    this.lastFocusableElement = this.focusableElements[this.focusableElements.length - 1];
    
    // Add tab key event listener for focus trapping
    this.container.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          // Shift + Tab (backward)
          if (document.activeElement === this.firstFocusableElement) {
            e.preventDefault();
            this.lastFocusableElement.focus();
          }
        } else {
          // Tab (forward)
          if (document.activeElement === this.lastFocusableElement) {
            e.preventDefault();
            this.firstFocusableElement.focus();
          }
        }
      }
    });
  }

  setupHueSliderKeyboard() {
    const hueSlider = this.container.querySelector('.hue-slider-container');
    if (!hueSlider) return;
    
    // Dedicated event listener for hue slider keyboard controls
    hueSlider.addEventListener('keydown', (e) => {
      // Only handle if the hue slider is focused
      if (document.activeElement !== hueSlider) return;
      
      let currentHue = this.getCurrentHue();
      let newHue = currentHue;
      let handled = false;
      
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          newHue = Math.max(0, currentHue - 5);
          handled = true;
          break;
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          newHue = Math.min(360, currentHue + 5);
          handled = true;
          break;
        case 'Home':
          e.preventDefault();
          e.stopPropagation();
          newHue = 0;
          handled = true;
          break;
        case 'End':
          e.preventDefault();
          e.stopPropagation();
          newHue = 360;
          handled = true;
          break;
        case 'PageUp':
          e.preventDefault();
          e.stopPropagation();
          newHue = Math.min(360, currentHue + 30);
          handled = true;
          break;
        case 'PageDown':
          e.preventDefault();
          e.stopPropagation();
          newHue = Math.max(0, currentHue - 30);
          handled = true;
          break;
      }
      
      if (handled) {
        // Update hue and regenerate color
        this.setHueFromKeyboard(newHue);
        hueSlider.setAttribute('aria-valuenow', Math.round(newHue));
      }
    });
    
    // Add focus styling to match other interactive elements
    hueSlider.addEventListener('focus', () => {
      hueSlider.style.outline = '3px solid var(--color-focus)';
      hueSlider.style.outlineOffset = '2px';
    });
    
    hueSlider.addEventListener('blur', () => {
      hueSlider.style.outline = 'none';
    });
  }

  getCurrentHue() {
    // Convert current color to HSL to get hue
    const rgb = this.hexToRgb(this.currentColor);
    if (!rgb) return 0;
    
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    
    if (delta === 0) return 0;
    
    let hue;
    if (max === r) {
      hue = ((g - b) / delta) % 6;
    } else if (max === g) {
      hue = (b - r) / delta + 2;
    } else {
      hue = (r - g) / delta + 4;
    }
    
    hue = hue * 60;
    if (hue < 0) hue += 360;
    
    return hue;
  }

  setHueFromKeyboard(hue) {
    // Get current saturation and lightness, or use defaults for better color range
    const rgb = this.hexToRgb(this.currentColor);
    if (!rgb) return;
    
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    
    let lightness = (max + min) / 2;
    let saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
    
    // If we have a very low saturation color, boost it to make hue changes visible
    if (saturation < 0.3) {
      saturation = 0.8;
    }
    
    // Ensure reasonable lightness for visibility
    if (lightness < 0.2) {
      lightness = 0.5;
    } else if (lightness > 0.9) {
      lightness = 0.7;
    }
    
    
    // Create new color with updated hue
    const newColor = this.hslToHex(hue, saturation * 100, lightness * 100);
    this.setColor(newColor);
    
    // Update the hue slider handle position
    this.updateHueSliderPosition(hue);
  }

  updateHueSliderPosition(hue) {
    const handle = this.container.querySelector('.hue-slider-handle');
    const container = this.container.querySelector('.hue-slider-container');
    if (!handle || !container) return;
    
    // Calculate position (hue 0-360 maps to 0-150px width)
    const position = (hue / 360) * 150;
    handle.style.left = `${Math.max(0, Math.min(150 - 6, position - 6))}px`;
  }

  updateHueSliderFromColor() {
    // Get the hue from the current color and update slider position
    const hue = this.getCurrentHue();
    this.updateHueSliderPosition(hue);
  }
  
  setupColorSwatchNavigation() {
    const swatches = this.container.querySelectorAll('.color-swatch');
    if (swatches.length === 0) return;
    
    // Make only the first swatch tabbable initially
    swatches.forEach((swatch, index) => {
      swatch.setAttribute('tabindex', index === 0 ? '0' : '-1');
      swatch.setAttribute('role', 'gridcell');
    });
    
    // Add ARIA attributes to the container
    const palette = this.container.querySelector('.color-palette');
    if (palette) {
      palette.setAttribute('role', 'grid');
      palette.setAttribute('aria-label', 'Color palette: use arrow keys to navigate');
    }
    
    // Add keyboard navigation
    swatches.forEach(swatch => {
      swatch.addEventListener('keydown', (e) => this.handleSwatchKeydown(e, swatches));
    });
  }
  
  handleSwatchKeydown(e, swatches) {
    const currentIndex = Array.from(swatches).indexOf(e.target);
    const cols = 8; // Color palette has 8 columns
    const rows = Math.ceil(swatches.length / cols);
    let newIndex = currentIndex;
    
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        newIndex = currentIndex + 1;
        if (newIndex >= swatches.length) newIndex = 0; // Wrap to start
        break;
      case 'ArrowLeft':
        e.preventDefault();
        newIndex = currentIndex - 1;
        if (newIndex < 0) newIndex = swatches.length - 1; // Wrap to end
        break;
      case 'ArrowDown':
        e.preventDefault();
        newIndex = currentIndex + cols;
        if (newIndex >= swatches.length) {
          // Go to same column in first row
          newIndex = currentIndex % cols;
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        newIndex = currentIndex - cols;
        if (newIndex < 0) {
          // Go to same column in last row
          const col = currentIndex % cols;
          const lastRowStart = Math.floor((swatches.length - 1) / cols) * cols;
          newIndex = Math.min(lastRowStart + col, swatches.length - 1);
        }
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = swatches.length - 1;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.setColor(e.target.dataset.color);
        return;
      default:
        return;
    }
    
    // Update focus
    swatches[currentIndex].setAttribute('tabindex', '-1');
    swatches[newIndex].setAttribute('tabindex', '0');
    swatches[newIndex].focus();
  }

  createColorWheelIndicator() {
    // Create position indicator ring
    const indicator = document.createElement('div');
    indicator.className = 'color-wheel-indicator';
    indicator.style.cssText = `
      position: absolute;
      width: 8px;
      height: 8px;
      border: 2px solid #ffff00;
      border-radius: 50%;
      pointer-events: none;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3), 0 0 4px rgba(255, 255, 0, 0.5);
      z-index: 10;
      transform: translate(-50%, -50%);
    `;
    
    // Add to color wheel container
    const wheelContainer = this.canvas.parentElement;
    wheelContainer.style.position = 'relative';
    wheelContainer.appendChild(indicator);
    this.colorWheelIndicator = indicator;
    
    // Update initial position
    this.updateColorWheelIndicator();
  }
  
  updateColorWheelIndicator() {
    if (!this.colorWheelIndicator) return;
    
    const x = this.colorWheelPosition.x;
    const y = this.colorWheelPosition.y;
    
    this.colorWheelIndicator.style.left = `${x}px`;
    this.colorWheelIndicator.style.top = `${y}px`;
  }
  
  handleColorWheelKeydown(e) {
    const step = 2; // pixels per step
    let newX = this.colorWheelPosition.x;
    let newY = this.colorWheelPosition.y;
    
    // Handle keyboard navigation as 2D movement
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        newX = Math.max(2, newX - step);
        break;
      case 'ArrowRight':
        e.preventDefault();
        newX = Math.min(98, newX + step);
        break;
      case 'ArrowUp':
        e.preventDefault();
        newY = Math.max(2, newY - step);
        break;
      case 'ArrowDown':
        e.preventDefault();
        newY = Math.min(98, newY + step);
        break;
      case 'Home':
        e.preventDefault();
        newX = 98; // Right edge (red)
        newY = 50; // Center
        break;
      case 'End':
        e.preventDefault();
        newX = 50; // Center
        newY = 50; // Center
        break;
      default:
        return; // Don't handle other keys
    }
    
    // Keep within circle bounds
    const centerX = 50;
    const centerY = 50;
    const dx = newX - centerX;
    const dy = newY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = 48;
    
    if (distance > maxRadius) {
      // Constrain to circle edge
      const angle = Math.atan2(dy, dx);
      newX = centerX + Math.cos(angle) * maxRadius;
      newY = centerY + Math.sin(angle) * maxRadius;
    }
    
    // Update position and color
    this.colorWheelPosition = { x: newX, y: newY };
    this.updateColorWheelIndicator();
    this.handleCanvasClick(newX, newY);
  }

  handleKeydown(e) {
    if (e.key === 'Escape') {
      this.close();
      return;
    }
    
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      
      // If Enter is pressed on a specific button, handle it
      if (e.target.classList.contains('color-picker-btn')) {
        e.target.click();
        return;
      }
      
      // Otherwise, confirm the color selection (like clicking the tick)
      this.confirmColor();
      return;
    }
    
    if ((e.key === ' ' || e.key === 'Enter') && e.target.classList.contains('color-swatch')) {
      e.preventDefault();
      this.setColor(e.target.dataset.color);
      return;
    }
  }
  
  async startEyedropper() {
    if (!window.EyeDropper) {
      alert('Color picker tool is not supported in this browser. Try using Chrome or Edge.');
      return;
    }
    
    try {
      const eyeDropper = new EyeDropper();
      const result = await eyeDropper.open();
      this.setColor(result.sRGBHex);
    } catch (e) {
      // User cancelled or error occurred
      console.log('Eyedropper cancelled');
    }
  }

  setColor(color) {
    this.currentColor = color;
    const colorDisplay = this.container.querySelector('.color-picker-footer .current-color-display');
    if (colorDisplay) {
      colorDisplay.style.backgroundColor = color;
    }
    
    // Update CSS input and RGB inputs to show current color
    this.updateCssInput();
    this.updateRgbInputs();
    
    // Update hue slider position to match new color
    this.updateHueSliderFromColor();
  }
  
  updateCssInput() {
    const cssInput = this.container.querySelector('.css-color-input');
    if (cssInput && this.currentColor && !this.cssInputFocused) {
      // Only update if user is not actively typing in the CSS input
      // Remove the # from the hex value since we have a visual prefix
      const displayValue = this.currentColor.startsWith('#') ? this.currentColor.slice(1) : this.currentColor;
      cssInput.value = displayValue;
    }
  }
  
  hslToHex(h, s, l) {
    // Convert HSL to RGB
    s /= 100;
    l /= 100;
    
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    
    let r = 0;
    let g = 0;
    let b = 0;
    
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
    
    // Convert to 0-255 range and then to hex
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
  
  getContrastColor(hexcolor) {
    const rgb = this.hexToRgb(hexcolor);
    if (!rgb) return '#000000';
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
  }
  
  open(color = this.currentColor) {
    this.setColor(color);
    this.container.style.display = 'block';
    this.isOpen = true;
    
    // Position above the color button over the canvas
    const colorButton = document.getElementById('colorPickerButton');
    const canvasArea = document.getElementById('canvasArea');
    
    if (colorButton && canvasArea) {
      const buttonRect = colorButton.getBoundingClientRect();
      const canvasRect = canvasArea.getBoundingClientRect();
      
      // Position relative to canvas area, ABOVE the button
      this.container.style.position = 'absolute';
      this.container.style.left = `${buttonRect.left - canvasRect.left}px`;
      this.container.style.top = `${buttonRect.top - canvasRect.top - 180}px`; // Above button
      
      // Adjust if it goes off screen horizontally
      const containerWidth = 280;
      if (buttonRect.left - canvasRect.left + containerWidth > canvasRect.width) {
        this.container.style.left = `${canvasRect.width - containerWidth - 10}px`;
      }
      
      // Ensure it's not too high up
      if (buttonRect.top - canvasRect.top - 180 < 10) {
        this.container.style.top = '10px';
      }
    }
    
    // Add outside click listener with delay to prevent immediate close
    setTimeout(() => {
      document.addEventListener('click', this.outsideClickHandler, true);
    }, 100);
    
    // Focus the color wheel for immediate keyboard interaction
    setTimeout(() => {
      this.canvas.focus();
    }, 150);
  }
  
  close() {
    this.container.style.display = 'none';
    this.isOpen = false;
    
    // Remove outside click listener
    document.removeEventListener('click', this.outsideClickHandler, true);
  }
  
  drawHueSlider() {
    // Clear canvas
    this.hueCtx.clearRect(0, 0, 150, 20);
    
    // Draw horizontal hue gradient from left (red) to right (red again through spectrum)
    const gradient = this.hueCtx.createLinearGradient(0, 0, 150, 0);
    gradient.addColorStop(0, 'hsl(0, 100%, 50%)');    // Red
    gradient.addColorStop(0.17, 'hsl(60, 100%, 50%)'); // Yellow
    gradient.addColorStop(0.33, 'hsl(120, 100%, 50%)'); // Green
    gradient.addColorStop(0.5, 'hsl(180, 100%, 50%)');  // Cyan
    gradient.addColorStop(0.67, 'hsl(240, 100%, 50%)'); // Blue
    gradient.addColorStop(0.83, 'hsl(300, 100%, 50%)'); // Magenta
    gradient.addColorStop(1, 'hsl(360, 100%, 50%)');    // Red
    
    this.hueCtx.fillStyle = gradient;
    this.hueCtx.fillRect(0, 0, 150, 20);
    
    // Draw border
    this.hueCtx.strokeStyle = '#ddd';
    this.hueCtx.lineWidth = 1;
    this.hueCtx.strokeRect(0, 0, 150, 20);
    
    // Update handle position
    this.updateHueHandle();
  }
  
  updateHueHandle() {
    const handle = this.container.querySelector('.hue-slider-handle');
    if (handle) {
      const position = (this.currentHue / 360) * 150;
      handle.style.left = `${position - 6}px`; // Offset by half handle width (12px / 2)
    }
  }
  
  handleHueSliderClick(x) {
    // Calculate hue from click position
    const hue = (x / 150) * 360;
    this.currentHue = Math.max(0, Math.min(360, hue));
    
    // Convert HSL to RGB hex for proper color handling
    const newColor = this.hslToHex(this.currentHue, 100, 50);
    this.setColor(newColor);
    
    // Update hue slider display
    this.updateHueHandle();
    
    // Update color wheel with new hue
    this.drawColorWheel();
  }

  initHueSliderDragging() {
    const handle = this.container.querySelector('.hue-slider-handle');
    const container = this.container.querySelector('.hue-slider-container');
    let isDragging = false;
    
    const startDrag = (e) => {
      isDragging = true;
      e.preventDefault();
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', endDrag);
    };
    
    const handleDrag = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      
      const rect = this.hueCanvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(150, e.clientX - rect.left));
      this.handleHueSliderClick(x);
    };
    
    const endDrag = (e) => {
      isDragging = false;
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', endDrag);
    };
    
    // Add event listeners
    handle.addEventListener('mousedown', startDrag);
    container.addEventListener('mousedown', (e) => {
      const rect = this.hueCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      this.handleHueSliderClick(x);
      startDrag(e);
    });
  }

  toggleAdvancedOptions() {
    const advancedSection = this.container.querySelector('.color-advanced-options');
    this.advancedOptionsOpen = !this.advancedOptionsOpen;
    
    if (this.advancedOptionsOpen) {
      advancedSection.style.display = 'block';
      // Update RGB inputs to match current color
      this.updateRgbInputs();
    } else {
      advancedSection.style.display = 'none';
    }
  }
  
  handleCssColorInput(value) {
    if (!value) return;
    
    // Create a temporary element to validate and convert the color
    const tempDiv = document.createElement('div');
    tempDiv.style.color = value;
    document.body.appendChild(tempDiv);
    
    const computedColor = window.getComputedStyle(tempDiv).color;
    document.body.removeChild(tempDiv);
    
    if (computedColor && computedColor !== 'rgba(0, 0, 0, 0)') {
      // Convert RGB to hex if needed
      const rgbMatch = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgbMatch) {
        const hex = this.rgbToHex(parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3]));
        this.setColor(hex);
        this.updateRgbInputs();
      }
    }
  }
  
  handleRgbInput() {
    const r = parseInt(this.container.querySelector('#rgb-r').value) || 0;
    const g = parseInt(this.container.querySelector('#rgb-g').value) || 0;
    const b = parseInt(this.container.querySelector('#rgb-b').value) || 0;
    
    const hex = this.rgbToHex(Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b)));
    this.setColor(hex);
  }
  
  updateRgbInputs() {
    const rgb = this.hexToRgb(this.currentColor);
    if (rgb) {
      const rInput = this.container.querySelector('#rgb-r');
      const gInput = this.container.querySelector('#rgb-g');
      const bInput = this.container.querySelector('#rgb-b');
      
      // Only update if the input is not currently being edited by the user
      if (rInput && !rInput.matches(':focus')) rInput.value = rgb.r;
      if (gInput && !gInput.matches(':focus')) gInput.value = rgb.g;
      if (bInput && !bInput.matches(':focus')) bInput.value = rgb.b;
    }
  }
  
  rgbToHex(r, g, b) {
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  confirmColor() {
    this.onColorChange(this.currentColor);
    this.close();
    // Trigger mesh selection after color picker closes
    if (this.onClose) {
      setTimeout(() => {
        this.onClose();
      }, 100);
    }
  }
  
  // Color conversion utilities
  hexToHSL(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
      h = s = 0; // achromatic
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
    
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }
  
  hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }
}

// Make it global for now to test
window.CustomColorPicker = CustomColorPicker;
