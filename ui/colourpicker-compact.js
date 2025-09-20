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

    // Eyedropper state
    this._eyedropperActive = false;
    this._preEyeDropperFocusEl = null;

    // Compact preset colors
    this.presetColors = [
      '#ff0000', '#ff8000', '#ffff00', '#008080',
      '#00ff00', '#00ff80', '#00ffff', '#0080ff',
      '#0000ff', '#8000ff', '#ff00ff', '#ff0080',
      '#ffffff', '#cccccc', '#666666', '#000000',
      '#8B4513', '#FF7F7F'
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

  createElement() {
    this.container = document.createElement('div');
    this.container.className = 'custom-color-picker';
    this.container.style.display = 'none';
    // Optional fade for hide/show (nice with eyedropper)
    this.container.style.transition = 'opacity 120ms ease';

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
            </div>
          </div>
        </div>

        <div class="color-picker-tools-row">
          <div class="hue-slider-container" tabindex="0" role="slider" aria-label="Hue slider" aria-valuemin="0" aria-valuemax="360" aria-valuenow="0">
            <canvas class="hue-slider-canvas" height="20"></canvas>
            <div class="hue-slider-handle"></div>
          </div>
          <div class="color-picker-buttons">
            <button class="color-picker-random" aria-label="Surprise color" title="Surprise color">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="#FFFFFF" d="M467.8 98.4C479.8 93.4 493.5 96.2 502.7 105.3L566.7 169.3C572.7 175.3 576.1 183.4 576.1 191.9C576.1 200.4 572.7 208.5 566.7 214.5L502.7 278.5C493.5 287.7 479.8 290.4 467.8 285.4C455.8 280.4 448 268.9 448 256L448 224L416 224C405.9 224 396.4 228.7 390.4 236.8L358 280L318 226.7L339.2 198.4C357.3 174.2 385.8 160 416 160L448 160L448 128C448 115.1 455.8 103.4 467.8 98.4zM218 360L258 413.3L236.8 441.6C218.7 465.8 190.2 480 160 480L96 480C78.3 480 64 465.7 64 448C64 430.3 78.3 416 96 416L160 416C170.1 416 179.6 411.3 185.6 403.2L218 360zM502.6 534.6C493.4 543.8 479.7 546.5 467.7 541.5C455.7 536.5 448 524.9 448 512L448 480L416 480C385.8 480 357.3 465.8 339.2 441.6L185.6 236.8C179.6 228.7 170.1 224 160 224L96 224C78.3 224 64 209.7 64 192C64 174.3 78.3 160 96 160L160 160C190.2 160 218.7 174.2 236.8 198.4L390.4 403.2C396.4 411.3 405.9 416 416 416L448 416L448 384C448 371.1 455.8 359.4 467.8 354.4C479.8 349.4 493.5 352.2 502.7 361.3L566.7 425.3C572.7 431.3 576.1 439.4 576.1 447.9C576.1 456.4 572.7 464.5 566.7 470.5L502.7 534.5z"/></svg>
            </button>
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
          <button class="color-picker-use" type="button" aria-label="Use your color" title="Use your color">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="#FFFFFF" d="M512.5 74.3L291.1 222C262 241.4 243.5 272.9 240.5 307.3C302.8 320.1 351.9 369.2 364.8 431.6C399.3 428.6 430.7 410.1 450.1 381L597.7 159.5C604.4 149.4 608 137.6 608 125.4C608 91.5 580.5 64 546.6 64C534.5 64 522.6 67.6 512.5 74.3zM320 464C320 402.1 269.9 352 208 352C146.1 352 96 402.1 96 464C96 467.9 96.2 471.8 96.6 475.6C98.4 493.1 86.4 512 68.8 512L64 512C46.3 512 32 526.3 32 544C32 561.7 46.3 576 64 576L208 576C269.9 576 320 525.9 320 464z"/></svg>
          </button>
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

    // Initialize
    this.currentHue = 0;
    this.advancedOptionsOpen = false;

    this.drawColorWheel();
    this.drawHueSlider();
  }

  setupHueSliderCanvas() {
    const toolsRow = this.container.querySelector('.color-picker-tools-row');
    const buttonsContainer = this.container.querySelector('.color-picker-buttons');

    if (toolsRow && buttonsContainer) {
      const toolsRect = toolsRow.getBoundingClientRect();
      const buttonsRect = buttonsContainer.getBoundingClientRect();
      const availableWidth = toolsRect.width - buttonsRect.width - 12;
      this.hueCanvas.width = Math.max(100, availableWidth);
    } else {
      setTimeout(() => this.setupHueSliderCanvas(), 10);
    }
  }

  drawColorWheel() {
    const centerX = 50;
    const centerY = 50;
    const radius = 48;

    // Clear canvas
    this.ctx.clearRect(0, 0, 100, 100);

    // Paint wheel
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 100; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= radius) {
          const hue = Math.atan2(dy, dx) * 180 / Math.PI;
          const normalizedHue = (hue + 360) % 360;
          const saturation = Math.min(100, (distance / radius) * 100);
          this.ctx.fillStyle = `hsl(${normalizedHue}, ${saturation}%, 60%)`;
          this.ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    // Border
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    this.ctx.strokeStyle = '#ddd';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }

  bindEvents() {
    // Close on backdrop
    const backdrop = this.container.querySelector('.color-picker-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => this.close());
    }

    // Click outside to close (guarded during eyedropper)
    this.outsideClickHandler = (e) => {
      if (this._eyedropperActive) return;
      if (this.isOpen && !this.container.contains(e.target)) {
        this.close();
      }
    };

    // Random colour
    this.container.querySelector('.color-picker-random')
      .addEventListener('click', () => this.generateRandomColor());

    // Eyedropper tool
    this.container.querySelector('.color-picker-eyedropper')
      .addEventListener('click', () => this.startEyedropper());

    // Color wheel click
    this.canvas.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.handleCanvasPickAt(x, y);
    });

    // Color wheel a11y
    this.canvas.setAttribute('tabindex', '0');
    this.canvas.setAttribute('role', 'slider');
    this.canvas.setAttribute('aria-label', 'Color wheel: use arrow keys to select hue and saturation');
    this.canvas.setAttribute('aria-valuenow', '0');
    this.canvas.setAttribute('aria-valuemin', '0');
    this.canvas.setAttribute('aria-valuemax', '360');

    this.canvas.addEventListener('keydown', (e) => this.handleColorWheelKeydown(e));

    // Track wheel indicator
    this.colorWheelPosition = { x: 50, y: 50 };
    this.createColorWheelIndicator();

    // Hue slider click/drag
    this.hueCanvas.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = this.hueCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      this.handleHueSliderClick(x);
    });
    this.initHueSliderDragging();

    // Advanced options
    this.container.querySelector('.color-picker-more-options')
      .addEventListener('click', () => this.toggleAdvancedOptions());

    // CSS input
    const cssInput = this.container.querySelector('.css-color-input');
    cssInput.addEventListener('input', (e) => this.handleCssColorInput(e.target.value));
    cssInput.addEventListener('focus', () => { this.cssInputFocused = true; cssInput.select(); });
    cssInput.addEventListener('blur', () => { this.cssInputFocused = false; this.updateCssInput(); });

    // RGB inputs
    const rgbInputs = this.container.querySelectorAll('.rgb-input');
    rgbInputs.forEach(input => input.addEventListener('input', () => this.handleRgbInput()));

    // Swatches
    this.setupColorSwatchNavigation();
    this.container.addEventListener('click', (e) => {
      if (e.target.classList.contains('color-swatch')) {
        this.setColor(e.target.dataset.color);
      }
    });

    // Confirm
    this.container.querySelector('.color-picker-use')
      .addEventListener('click', () => this.confirmColor());

    // Keyboard handling (Escape / Enter)
    this.container.addEventListener('keydown', (e) => this.handleKeydown(e));

    // Focus trap + hue slider keyboard
    this.setupFocusTrapping();
    this.setupHueSliderKeyboard();
  }

  handleCanvasPickAt(x, y) {
    const centerX = 50;
    const centerY = 50;
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const radius = 48;

    if (distance <= radius) {
      this.colorWheelPosition = { x, y };
      this.updateColorWheelIndicator();

      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const hue = (angle + 360) % 360;
      const saturation = Math.min(100, (distance / radius) * 100);

      const color = this.hslToHex(hue, saturation, 60);
      this.setColor(color);
    }
  }

  createColorWheelIndicator() {
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
    const wheelContainer = this.canvas.parentElement;
    wheelContainer.style.position = 'relative';
    wheelContainer.appendChild(indicator);
    this.colorWheelIndicator = indicator;
    this.updateColorWheelIndicator();
  }

  updateColorWheelIndicator() {
    if (!this.colorWheelIndicator) return;
    this.colorWheelIndicator.style.left = `${this.colorWheelPosition.x}px`;
    this.colorWheelIndicator.style.top = `${this.colorWheelPosition.y}px`;
  }

  handleColorWheelKeydown(e) {
    const step = 2;
    let newX = this.colorWheelPosition.x;
    let newY = this.colorWheelPosition.y;

    switch (e.key) {
      case 'ArrowLeft': e.preventDefault(); newX = Math.max(2, newX - step); break;
      case 'ArrowRight': e.preventDefault(); newX = Math.min(98, newX + step); break;
      case 'ArrowUp': e.preventDefault(); newY = Math.max(2, newY - step); break;
      case 'ArrowDown': e.preventDefault(); newY = Math.min(98, newY + step); break;
      case 'Home': e.preventDefault(); newX = 98; newY = 50; break;
      case 'End': e.preventDefault(); newX = 50; newY = 50; break;
      default: return;
    }

    const centerX = 50;
    const centerY = 50;
    const dx = newX - centerX;
    const dy = newY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = 48;

    if (distance > maxRadius) {
      const angle = Math.atan2(dy, dx);
      newX = centerX + Math.cos(angle) * maxRadius;
      newY = centerY + Math.sin(angle) * maxRadius;
    }

    this.colorWheelPosition = { x: newX, y: newY };
    this.updateColorWheelIndicator();
    this.handleCanvasPickAt(newX, newY);
  }

  handleKeydown(e) {
    if (e.key === 'Escape') {
      this.close();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (e.target.classList.contains('color-picker-btn')) {
        e.target.click();
        return;
      }
      this.confirmColor();
      return;
    }
    if ((e.key === ' ' || e.key === 'Enter') && e.target.classList.contains('color-swatch')) {
      e.preventDefault();
      this.setColor(e.target.dataset.color);
      return;
    }
  }

  // === Eyedropper visibility control ===
  hideUIForEyedropper() {
    if (!this.isOpen) return;
    this._eyedropperActive = true;
    this._preEyeDropperFocusEl = document.activeElement || null;
    this.container.setAttribute('aria-hidden', 'true');
    this.container.style.opacity = '0';
    this.container.style.pointerEvents = 'none';
  }

  restoreUIAfterEyedropper() {
    if (!this.isOpen) return;
    this.container.removeAttribute('aria-hidden');
    this.container.style.opacity = '1';
    this.container.style.pointerEvents = 'auto';
    this._eyedropperActive = false;

    const useBtn = this.container.querySelector('.color-picker-use');
    if (useBtn) useBtn.focus();
    else if (this.canvas) this.canvas.focus();
    else if (this._preEyeDropperFocusEl?.focus) this._preEyeDropperFocusEl.focus();

    this._preEyeDropperFocusEl = null;
  }

  async startEyedropper() {
    if (!window.EyeDropper) {
      alert('Color picker tool is not supported in this browser. Try using Chrome or Edge.');
      return;
    }

    this.hideUIForEyedropper();
    try {
      const eyeDropper = new EyeDropper();
      const result = await eyeDropper.open(); // resolves or throws on cancel
      this.setColor(result.sRGBHex);
    } catch (e) {
      // Cancel or error — just restore UI
    } finally {
      this.restoreUIAfterEyedropper();
    }
  }

  setColor(color) {
    this.currentColor = color;
    const colorDisplay = this.container.querySelector('.color-picker-footer .current-color-display');
    if (colorDisplay) colorDisplay.style.backgroundColor = color;
    this.updateCssInput();
    this.updateRgbInputs();
    this.updateHueSliderFromColor();
  }

  updateCssInput() {
    const cssInput = this.container.querySelector('.css-color-input');
    if (cssInput && this.currentColor && !this.cssInputFocused) {
      const displayValue = this.currentColor.startsWith('#') ? this.currentColor.slice(1) : this.currentColor;
      cssInput.value = displayValue;
    }
  }

  setupFocusTrapping() {
    this.focusableElements = this.container.querySelectorAll(
      'button, input, [tabindex]:not([tabindex="-1"])'
    );
    this.firstFocusableElement = this.focusableElements[0];
    this.lastFocusableElement = this.focusableElements[this.focusableElements.length - 1];

    this.container.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === this.firstFocusableElement) {
          e.preventDefault();
          this.lastFocusableElement.focus();
        }
      } else {
        if (document.activeElement === this.lastFocusableElement) {
          e.preventDefault();
          this.firstFocusableElement.focus();
        }
      }
    });
  }

  setupHueSliderKeyboard() {
    const hueSlider = this.container.querySelector('.hue-slider-container');
    if (!hueSlider) return;

    hueSlider.addEventListener('keydown', (e) => {
      if (document.activeElement !== hueSlider) return;

      let currentHue = this.getCurrentHue();
      let newHue = currentHue;
      let handled = false;

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowDown': e.preventDefault(); e.stopPropagation(); newHue = Math.max(0, currentHue - 5); handled = true; break;
        case 'ArrowRight':
        case 'ArrowUp': e.preventDefault(); e.stopPropagation(); newHue = Math.min(360, currentHue + 5); handled = true; break;
        case 'Home': e.preventDefault(); e.stopPropagation(); newHue = 0; handled = true; break;
        case 'End': e.preventDefault(); e.stopPropagation(); newHue = 360; handled = true; break;
        case 'PageUp': e.preventDefault(); e.stopPropagation(); newHue = Math.min(360, currentHue + 30); handled = true; break;
        case 'PageDown': e.preventDefault(); e.stopPropagation(); newHue = Math.max(0, currentHue - 30); handled = true; break;
      }

      if (handled) {
        this.setHueFromKeyboard(newHue);
        hueSlider.setAttribute('aria-valuenow', Math.round(newHue));
      }
    });

    hueSlider.addEventListener('focus', () => {
      hueSlider.style.outline = '3px solid var(--color-focus)';
      hueSlider.style.outlineOffset = '2px';
    });
    hueSlider.addEventListener('blur', () => {
      hueSlider.style.outline = 'none';
    });
  }

  getCurrentHue() {
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
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;

    hue *= 60;
    if (hue < 0) hue += 360;
    return hue;
    }

  setHueFromKeyboard(hue) {
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

    if (saturation < 0.3) saturation = 0.8;
    if (lightness < 0.2) lightness = 0.5;
    else if (lightness > 0.9) lightness = 0.7;

    const newColor = this.hslToHex(hue, saturation * 100, lightness * 100);
    this.setColor(newColor);
    this.updateHueSliderPosition(hue);
  }

  updateHueSliderPosition(hue) {
    const handle = this.container.querySelector('.hue-slider-handle');
    const canvas = this.container.querySelector('.hue-slider-canvas');
    if (!handle || !canvas) return;

    const canvasRect = canvas.getBoundingClientRect();
    const canvasWidth = canvasRect.width;
    const position = (hue / 360) * canvasWidth;
    const handleWidth = 12;
    handle.style.left = `${Math.max(0, Math.min(canvasWidth - handleWidth, position - handleWidth / 2))}px`;
  }

  updateHueSliderFromColor() {
    const hue = this.getCurrentHue();
    this.updateHueSliderPosition(hue);
  }

  setupColorSwatchNavigation() {
    const swatches = this.container.querySelectorAll('.color-swatch');
    if (swatches.length === 0) return;

    swatches.forEach((swatch, index) => {
      swatch.setAttribute('tabindex', index === 0 ? '0' : '-1');
      swatch.setAttribute('role', 'gridcell');
    });

    const palette = this.container.querySelector('.color-palette');
    if (palette) {
      palette.setAttribute('role', 'grid');
      palette.setAttribute('aria-label', 'Color palette: use arrow keys to navigate');
    }

    swatches.forEach(swatch => {
      swatch.addEventListener('keydown', (e) => this.handleSwatchKeydown(e, swatches));
    });
  }

  handleSwatchKeydown(e, swatches) {
    const currentIndex = Array.from(swatches).indexOf(e.target);
    const cols = 8;
    let newIndex = currentIndex;

    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); newIndex = (currentIndex + 1) % swatches.length; break;
      case 'ArrowLeft': e.preventDefault(); newIndex = (currentIndex - 1 + swatches.length) % swatches.length; break;
      case 'ArrowDown': e.preventDefault(); newIndex = currentIndex + cols; if (newIndex >= swatches.length) newIndex = currentIndex % cols; break;
      case 'ArrowUp': e.preventDefault(); newIndex = currentIndex - cols; if (newIndex < 0) { const col = currentIndex % cols; const lastRowStart = Math.floor((swatches.length - 1) / cols) * cols; newIndex = Math.min(lastRowStart + col, swatches.length - 1); } break;
      case 'Home': e.preventDefault(); newIndex = 0; break;
      case 'End': e.preventDefault(); newIndex = swatches.length - 1; break;
      case 'Enter':
      case ' ': e.preventDefault(); this.setColor(e.target.dataset.color); return;
      default: return;
    }

    swatches[currentIndex].setAttribute('tabindex', '-1');
    swatches[newIndex].setAttribute('tabindex', '0');
    swatches[newIndex].focus();
  }

  setupHueSliderKeyboard() { /* already defined above; kept for clarity */ }

  drawHueSlider() {
    const sliderWidth = this.hueCanvas.width;
    const sliderHeight = this.hueCanvas.height;

    this.hueCtx.clearRect(0, 0, sliderWidth, sliderHeight);

    const gradient = this.hueCtx.createLinearGradient(0, 0, sliderWidth, 0);
    gradient.addColorStop(0, 'hsl(0, 100%, 50%)');
    gradient.addColorStop(0.17, 'hsl(60, 100%, 50%)');
    gradient.addColorStop(0.33, 'hsl(120, 100%, 50%)');
    gradient.addColorStop(0.5, 'hsl(180, 100%, 50%)');
    gradient.addColorStop(0.67, 'hsl(240, 100%, 50%)');
    gradient.addColorStop(0.83, 'hsl(300, 100%, 50%)');
    gradient.addColorStop(1, 'hsl(360, 100%, 50%)');

    this.hueCtx.fillStyle = gradient;
    this.hueCtx.fillRect(0, 0, sliderWidth, sliderHeight);

    this.hueCtx.strokeStyle = '#ddd';
    this.hueCtx.lineWidth = 1;
    this.hueCtx.strokeRect(0, 0, sliderWidth, sliderHeight);

    this.updateHueHandle();
  }

  updateHueHandle() {
    const handle = this.container.querySelector('.hue-slider-handle');
    if (!handle) return;
    const sliderWidth = this.hueCanvas.width;
    const position = (this.currentHue / 360) * sliderWidth;
    handle.style.left = `${position - 6}px`;
  }

  handleHueSliderClick(x) {
    const sliderWidth = this.hueCanvas.width;
    const hue = (x / sliderWidth) * 360;
    this.currentHue = Math.max(0, Math.min(360, hue));
    const newColor = this.hslToHex(this.currentHue, 100, 50);
    this.setColor(newColor);
    this.updateHueHandle();
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
      const sliderWidth = this.hueCanvas.width;
      const x = Math.max(0, Math.min(sliderWidth, e.clientX - rect.left));
      this.handleHueSliderClick(x);
    };

    const endDrag = () => {
      isDragging = false;
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', endDrag);
    };

    handle.addEventListener('mousedown', startDrag);
    container.addEventListener('mousedown', (e) => {
      const rect = this.hueCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      this.handleHueSliderClick(x);
      startDrag(e);
    });
  }

  generateRandomColor() {
    const letters = "0123456789ABCDEF";
    let color = "#";
    for (let i = 0; i < 6; i++) color += letters[Math.floor(Math.random() * 16)];
    this.setColor(color);
  }

  toggleAdvancedOptions() {
    const advancedSection = this.container.querySelector('.color-advanced-options');
    this.advancedOptionsOpen = !this.advancedOptionsOpen;
    advancedSection.style.display = this.advancedOptionsOpen ? 'block' : 'none';
    if (this.advancedOptionsOpen) this.updateRgbInputs();
  }

  handleCssColorInput(value) {
    if (!value) return;
    let processedValue = value.trim();
    let isCompleteColor = false;

    if (/^#?[0-9a-fA-F]{6}$/.test(processedValue) || /^#?[0-9a-fA-F]{3}$/.test(processedValue)) {
      isCompleteColor = true;
      if (!processedValue.startsWith('#')) processedValue = '#' + processedValue;
    } else {
      const tempDiv = document.createElement('div');
      tempDiv.style.color = processedValue;
      document.body.appendChild(tempDiv);
      const computedColor = window.getComputedStyle(tempDiv).color;
      document.body.removeChild(tempDiv);
      if (computedColor && computedColor !== 'rgba(0, 0, 0, 0)') isCompleteColor = true;
    }

    if (isCompleteColor) {
      const tempDiv = document.createElement('div');
      tempDiv.style.color = processedValue;
      document.body.appendChild(tempDiv);
      const computedColor = window.getComputedStyle(tempDiv).color;
      document.body.removeChild(tempDiv);

      if (computedColor && computedColor !== 'rgba(0, 0, 0, 0)') {
        const rgbMatch = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
          const hex = this.rgbToHex(parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3]));
          this.setColor(hex);
          this.updateRgbInputs();
        }
      }
    }
  }

  handleRgbInput() {
    const r = parseInt(this.container.querySelector('#rgb-r').value) || 0;
    const g = parseInt(this.container.querySelector('#rgb-g').value) || 0;
    const b = parseInt(this.container.querySelector('#rgb-b').value) || 0;

    const hex = this.rgbToHex(
      Math.max(0, Math.min(255, r)),
      Math.max(0, Math.min(255, g)),
      Math.max(0, Math.min(255, b))
    );
    this.setColor(hex);
  }

  updateRgbInputs() {
    const rgb = this.hexToRgb(this.currentColor);
    if (!rgb) return;
    const rInput = this.container.querySelector('#rgb-r');
    const gInput = this.container.querySelector('#rgb-g');
    const bInput = this.container.querySelector('#rgb-b');
    if (rInput && !rInput.matches(':focus')) rInput.value = rgb.r;
    if (gInput && !gInput.matches(':focus')) gInput.value = rgb.g;
    if (bInput && !bInput.matches(':focus')) bInput.value = rgb.b;
  }

  rgbToHex(r, g, b) {
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

  // HSL/HEX conversion
  hslToHex(h, s, l) {
    // Convert HSL to RGB then to hex
    s /= 100; l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;

    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  hexToHSL(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s; const l = (max + min) / 2;

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
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  open(color = this.currentColor) {
    this.setColor(color);
    this.container.style.display = 'block';
    this.container.style.opacity = '1';
    this.container.style.pointerEvents = 'auto';
    this.isOpen = true;

    setTimeout(() => {
      this.setupHueSliderCanvas();
      this.drawHueSlider();
    }, 10);

    // Position above the colour button over the canvas
    const colorButton = document.getElementById('colorPickerButton');
    const canvasArea = document.getElementById('canvasArea');

    if (colorButton && canvasArea) {
      const buttonRect = colorButton.getBoundingClientRect();
      const canvasRect = canvasArea.getBoundingClientRect();

      this.container.style.position = 'absolute';
      const isMobile = window.innerWidth <= 600;

      if (isMobile) {
        this.container.style.left = '0px';
        this.container.style.right = '0px';
        this.container.style.width = `${canvasRect.width - 20}px`;
        this.container.style.maxWidth = 'none';
        this.container.style.marginLeft = '10px';
        this.container.style.marginRight = '10px';
        const topPosition = Math.max(10, buttonRect.top - canvasRect.top - 200);
        const pickerHeight = 250;
        const bottomBarHeight = 40;
        const maxTop = canvasRect.height - pickerHeight - bottomBarHeight;
        this.container.style.top = `${Math.min(topPosition, Math.max(10, maxTop))}px`;
      } else {
        this.container.style.left = `${buttonRect.left - canvasRect.left}px`;
        this.container.style.top = `${buttonRect.top - canvasRect.top - 180}px`;
        this.container.style.width = '360px';
        this.container.style.right = 'auto';

        const containerWidth = 360;
        if (buttonRect.left - canvasRect.left + containerWidth > canvasRect.width) {
          this.container.style.left = `${canvasRect.width - containerWidth - 10}px`;
        }
        if (buttonRect.top - canvasRect.top - 180 < 10) {
          this.container.style.top = '10px';
        }
        const pickerHeight = 250;
        const bottomBarHeight = 40;
        const maxTop = canvasRect.height - pickerHeight - bottomBarHeight;
        const currentTop = parseInt(this.container.style.top, 10);
        if (currentTop > maxTop) {
          this.container.style.top = `${Math.max(10, maxTop)}px`;
        }
      }
    }

    setTimeout(() => {
      document.addEventListener('click', this.outsideClickHandler, true);
    }, 100);

    setTimeout(() => {
      this.canvas?.focus();
    }, 150);
  }

  close() {
    this.container.style.display = 'none';
    this.isOpen = false;
    document.removeEventListener('click', this.outsideClickHandler, true);
  }

  confirmColor() {
    this.onColorChange(this.currentColor);
    this.close();
    if (this.onClose) {
      setTimeout(() => this.onClose(), 100);
    }
  }
}

// Make it global for testing
window.CustomColorPicker = CustomColorPicker;
