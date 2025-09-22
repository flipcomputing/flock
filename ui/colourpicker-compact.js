import { translate } from "../main/translation.js";

const COLOR_PALETTES = {
  Default: [
    { hex: "#EF292B", name: "Red" },
    { hex: "#F8932A", name: "Orange" },
    { hex: "#FFF120", name: "Yellow" },
    { hex: "#07A951", name: "Green" },
    { hex: "#0E8142", name: "Dark Green" },
    { hex: "#01AFCA", name: "Cyan" },
    { hex: "#353A98", name: "Blue" },
    { hex: "#632A9F", name: "Purple" },
    { hex: "#ED84F7", name: "Pink" },
    { hex: "#652700", name: "Brown" },
    { hex: "#000000", name: "Black" },
    { hex: "#FFFFFF", name: "White" },
  ],
  Earthy: [
    { hex: "#28673B", name: "Forest Green" },
    { hex: "#AA7C49", name: "Clay" },
    { hex: "#976030", name: "Walnut" },
    { hex: "#A1C458", name: "Olive" },
    { hex: "#ACD62A", name: "Lime" },
    { hex: "#3492E4", name: "Sky Blue" },
    { hex: "#66C1E1", name: "Water" },
    { hex: "#FFD441", name: "Sunflower" },
    { hex: "#F6C178", name: "Sand" },
    { hex: "#C77546", name: "Terracotta" },
    { hex: "#000000", name: "Black" },
    { hex: "#FFFFFF", name: "White" },
  ],
  Pastel: [
    { hex: "#FBF8CC", name: "Cream" },
    { hex: "#FDE4CF", name: "Peach" },
    { hex: "#FFCFD2", name: "Rose" },
    { hex: "#F1C0E8", name: "Lilac" },
    { hex: "#CFBAF0", name: "Lavender" },
    { hex: "#A3C4F3", name: "Sky" },
    { hex: "#90DBF4", name: "Aqua" },
    { hex: "#8EECF5", name: "Turquoise" },
    { hex: "#98F5E1", name: "Mint" },
    { hex: "#B9FBC0", name: "Pale Green" },
    { hex: "#000000", name: "Black" },
    { hex: "#FFFFFF", name: "White" },
  ],
  Neon: [
    { hex: "#DB01EC", name: "Magenta" },
    { hex: "#C330F6", name: "Violet" },
    { hex: "#029CFF", name: "Electric Blue" },
    { hex: "#0CE2EA", name: "Cyan Glow" },
    { hex: "#02FF67", name: "Neon Green" },
    { hex: "#97FC03", name: "Lime Glow" },
    { hex: "#FDFF66", name: "Lemon" },
    { hex: "#FEDB1B", name: "Amber" },
    { hex: "#FF6600", name: "Neon Orange" },
    { hex: "#FF0066", name: "Hot Pink" },
    { hex: "#000000", name: "Black" },
    { hex: "#FFFFFF", name: "White" },
  ],
  Sunset: [
    { hex: "#21215C", name: "Midnight" },
    { hex: "#3B55A7", name: "Indigo" },
    { hex: "#4E385F", name: "Plum" },
    { hex: "#66479D", name: "Amethyst" },
    { hex: "#9875B4", name: "Orchid" },
    { hex: "#D8499A", name: "Fuchsia" },
    { hex: "#DE4D6D", name: "Rose Red" },
    { hex: "#E58644", name: "Coral" },
    { hex: "#E69B79", name: "Apricot" },
    { hex: "#F1CB85", name: "Golden" },
    { hex: "#000000", name: "Black" },
    { hex: "#FFFFFF", name: "White" },
  ],
};

// Keep visible color; avoid pure black/white
const L_MIN = 15;
const L_MAX = 95;
const clampL = (L) => Math.max(L_MIN, Math.min(L_MAX, Math.round(L)));

class CustomColorPicker {
  constructor(options = {}) {
    this.currentColor = options.color || "#ff0000";
    this.onColorChange = options.onColorChange || (() => {});
    this.onClose = options.onClose || (() => {});
    this.targetElement = options.target || document.body;

    this.isOpen = false;

    // Eyedropper state
    this._eyedropperActive = false;
    this._preEyeDropperFocusEl = null;

    // Compact preset colors
    this.presetColors = [
      "red", // #ff0000
      "darkorange", // ~#ff8000
      "yellow", // #ffff00
      "teal", // #008080
      "lime", // #00ff00
      "forestgreen", // #228B22
      "aqua", // #00ffff (aka cyan)
      "dodgerblue", // ~#0080ff
      "blue", // #0000ff
      "blueviolet", // ~#8000ff
      "fuchsia", // #ff00ff (aka magenta)
      "deeppink", // ~#ff0080
      "white", // #ffffff
      "lightgray", // ~#cccccc
      "dimgray", // ~#666666
      "black", // #000000
      "saddlebrown", // #8B4513
      "lightcoral", // ~#ff7f7f
    ];

    this.colorLabels = {
      red: "Red",
      darkorange: "Dark orange",
      yellow: "Yellow",
      teal: "Teal",
      lime: "Lime",
      forestgreen: "Forest green",
      aqua: "Aqua",
      dodgerblue: "Dodger blue",
      blue: "Blue",
      blueviolet: "Blue violet",
      fuchsia: "Fuchsia",
      deeppink: "Deep pink",
      white: "White",
      lightgray: "Light gray",
      dimgray: "Dim gray",
      black: "Black",
      saddlebrown: "Saddle brown",
      lightcoral: "Light coral",
    };

    this.createElement();
    this.bindEvents();
  }

  generateSkinPalette() {
    const skinColors = [
      "#FDBCB4",
      "#F1C27D",
      "#E0AC69",
      "#C68642",
      "#8D5524",
      "#C67856",
      "#A0522D",
      "#8B4513",
    ];
    return skinColors
      .map(
        (color) =>
          `<button class="color-swatch" style="background-color: ${color}" data-color="${color}" aria-label="Skin tone ${color}" tabindex="0"></button>`,
      )
      .join("");
  }

  /* =========================
   * LIGHTNESS SLIDER
   * ========================= */

  _getLightTrackMetrics() {
    const rect = this.lightSlider.getBoundingClientRect();
    const hRect = this.lightHandle.getBoundingClientRect();
    const handleH = Math.max(1, hRect.height || 0); // fallback if hidden early
    const handleHalf = handleH / 2;

    // Effective track is the area the *center* of the handle can travel
    const trackH = Math.max(1, rect.height - handleH);
    return { rect, handleH, handleHalf, trackH };
  }

  // Scale canvas safely (works even if initially hidden)
  setupLightnessCanvasScaling() {
    if (!this.lightCanvas || !this.lightCtx) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    const host = this.lightSlider || this.lightCanvas;
    const rect = host.getBoundingClientRect();
    const cssW = Math.max(
      1,
      Math.round(rect.width || parseFloat(getComputedStyle(host).width) || 15),
    );
    const cssH = Math.max(
      1,
      Math.round(
        rect.height || parseFloat(getComputedStyle(host).height) || 120,
      ),
    );

    this._lightCssW = cssW;
    this._lightCssH = cssH;

    this.lightCanvas.width = Math.max(1, Math.round(cssW * dpr));
    this.lightCanvas.height = Math.max(1, Math.round(cssH * dpr));

    this.lightCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.lightCtx.imageSmoothingEnabled = false;
  }

  // Draw gradient using current H & S; L varies top(100) → bottom(0)
  drawLightnessSlider() {
    if (!this.lightCtx || !this.lightCanvas) return;

    const cssW = this._lightCssW ?? 15;
    const cssH = this._lightCssH ?? 120;
    if (!(cssW > 0 && cssH > 0)) return;

    const hsl = this.hexToHSL(this.currentColor) || { h: 0, s: 100, l: 60 };
    const H = hsl.h,
      S = hsl.s;

    const g = this.lightCtx.createLinearGradient(0, 0, 0, cssH);
    g.addColorStop(0, `hsl(${hsl.h}, ${hsl.s}%, ${L_MAX}%)`);
    g.addColorStop(
      0.5,
      `hsl(${hsl.h}, ${hsl.s}%, ${Math.round((L_MIN + L_MAX) / 2)}%)`,
    );
    g.addColorStop(1, `hsl(${hsl.h}, ${hsl.s}%, ${L_MIN}%)`);

    this.lightCtx.clearRect(0, 0, cssW, cssH);
    this.lightCtx.fillStyle = g;
    this.lightCtx.fillRect(0, 0, cssW, cssH);

    this.updateLightnessHandle();
  }

  _lightnessFromClientY(clientY) {
    const { rect, handleHalf, trackH } = this._getLightTrackMetrics();

    // Convert pointer Y to a 0..1 along the usable track (for the handle center)
    let t = (clientY - (rect.top + handleHalf)) / trackH;
    t = Math.max(0, Math.min(1, t)); // clamp to [0,1]

    // Top = L_MAX, Bottom = L_MIN
    const L = L_MIN + (1 - t) * (L_MAX - L_MIN);
    return Math.round(L);
  }

  updateLightnessHandle() {
    if (!this.lightHandle || !this.lightSlider) return;

    const { rect, handleHalf, trackH } = this._getLightTrackMetrics();
    const L = clampL(this.currentLightness ?? 60);

    // Map L within [L_MIN..L_MAX] to t in [0..1]
    const t = (L - L_MIN) / (L_MAX - L_MIN);

    // y coordinate for the *center* of the handle, then offset by -handleHalf
    const yCenter = (1 - t) * trackH + handleHalf;
    const yCSS = yCenter - handleHalf;

    this.lightHandle.style.top = `${yCSS}px`;
    this.lightSlider.setAttribute("aria-valuenow", String(Math.round(L)));
  }

  _lightnessFromClientY(clientY) {
    const rect = this.lightSlider.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const L = L_MIN + (1 - t) * (L_MAX - L_MIN); // top -> L_MAX, bottom -> L_MIN
    return Math.round(L);
  }

  setLightness(L) {
    L = clampL(L);
    this.currentLightness = L;

    const hsl = this.hexToHSL(this.currentColor) || { h: 0, s: 0, l: L };
    const hex = this.hslToHex(hsl.h, hsl.s, L);

    // forceLightness ensures we don't bounce after HSL→HEX→HSL round-trip
    this.setColor(hex, { skipLightnessSync: true, forceLightness: L });
    this.updateLightnessHandle();
  }

  // Repaint gradient ONLY when H or S changed; always move the thumb
  updateLightnessFromColor() {
    const hsl = this.hexToHSL(this.currentColor);
    if (!hsl) return;

    this.currentLightness = clampL(hsl.l); // keep within [1..75]

    this.setupLightnessCanvasScaling();
    this.drawLightnessSlider(); // uses the current H/S
    this.updateLightnessHandle();
  }

  /* =========================
   * /LIGHTNESS SLIDER (fixed)
   * ========================= */

  createElement() {
    this.container = document.createElement("div");
    this.container.className = "custom-color-picker";
    this.container.style.display = "none";
    this.container.style.transition = "opacity 120ms ease";

    this.container.innerHTML = `
      <div class="color-picker-backdrop"></div>
      <div class="color-picker-content">
        <div class="color-picker-body">
          <div class="color-picker-left">
            <div class="color-wheel-section">
              <canvas class="color-wheel-canvas" width="100" height="100"></canvas>
            </div>

            <!-- Vertical Lightness slider -->
           <div class="lightness-slider" aria-label="Lightness" role="slider"
            aria-valuemin="1" aria-valuemax="99" aria-valuenow="60" tabindex="0">
              <canvas class="lightness-canvas" width="20" height="100"></canvas>
              <div class="lightness-handle" aria-hidden="true"></div>
            </div>
            <!-- /Vertical Lightness slider -->
          </div>

          <div class="color-picker-right">
           <div class="color-picker-section">
             <div class="palette-row">
               <label for="palette-select" class="sr-only">Palette</label>
               <select id="palette-select" class="palette-dropdown" aria-label="Palette"></select>
             </div>
             <div class="color-palette" aria-label="Color palette"></div>
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
    const canvasArea = document.getElementById("canvasArea");
    if (canvasArea) {
      canvasArea.appendChild(this.container);
    } else {
      this.targetElement.appendChild(this.container);
    }

    // Store references
    this.canvas = this.container.querySelector(".color-wheel-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.hueCanvas = this.container.querySelector(".hue-slider-canvas");
    this.hueCtx = this.hueCanvas.getContext("2d");
    this.currentColorDisplay = this.container.querySelector(
      ".current-color-display",
    );
    this.currentColorText = this.container.querySelector(".current-color-text");

    // Lightness slider refs
    this.lightSlider = this.container.querySelector(".lightness-slider");
    this.lightCanvas = this.container.querySelector(".lightness-canvas");
    this.lightCtx = this.lightCanvas.getContext("2d");
    this.lightHandle = this.container.querySelector(".lightness-handle");

    // Palette UI refs
    this.paletteSelect = this.container.querySelector("#palette-select");
    this.paletteGrid = this.container.querySelector(".color-palette");

    // Build dropdown options + render default swatches before events bind
    this._initPaletteUI();

    // Initial lightness paint

    //this.drawLightnessSlider();
    //this.updateLightnessHandle();

    // Initialize
    this.advancedOptionsOpen = false;

    // NOTE: leaving the color wheel & hue logic as-is (no changes)
    this.drawColorWheel();
    this.drawHueSlider();
    this.setupLightnessCanvasScaling();
  }

  _initPaletteUI() {
    // 1) Populate dropdown from COLOR_PALETTES keys
    this.paletteSelect.innerHTML = "";
    Object.keys(COLOR_PALETTES).forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      this.paletteSelect.appendChild(opt);
    });

    // 2) Default on first open
    this.paletteSelect.value = "Default";

    // 3) Render swatches for Default (2×6)
    this._renderSwatches("Default");

    // 4) Change handler to switch palettes
    this.paletteSelect.addEventListener("change", () => {
      this._renderSwatches(this.paletteSelect.value);
    });
  }

  // change signature to accept an options bag (optional)
  _renderSwatches(paletteName, opts = {}) {
    const list = COLOR_PALETTES[paletteName] || [];
    const twelve = list.slice(0, 12);

    this.paletteGrid.innerHTML = twelve
      .map((c, i) => {
        const label = c.name || c.hex;
        const hex = c.hex;
        return `
        <button 
          class="color-swatch" 
          style="background-color: ${hex}"
          data-color="${hex}"
          title="${label}"
          aria-label="${label}"
          role="gridcell"
          tabindex="${i === 0 ? "0" : "-1"}"
        ></button>`;
      })
      .join("");

    this.paletteGrid.setAttribute("role", "grid");
    this.paletteGrid.setAttribute("aria-rowcount", "2");
    this.paletteGrid.setAttribute("aria-colcount", "6");

    // 🔧 Recompute grid + reattach per-swatch keydown handlers
    this.setupColorSwatchNavigation();

    // 🔧 Optional: put focus on the first swatch so arrows work right away
    if (opts.focusFirst) {
      const first = this.paletteGrid.querySelector(".color-swatch");
      first?.focus();
    }
  }

  setupHueSliderCanvas() {
    const toolsRow = this.container.querySelector(".color-picker-tools-row");
    const buttonsContainer = this.container.querySelector(
      ".color-picker-buttons",
    );

    const apply = () => {
      const toolsRect = toolsRow.getBoundingClientRect();
      const buttonsRect = buttonsContainer.getBoundingClientRect();
      const availableWidth = Math.max(
        120,
        Math.round(toolsRect.width - buttonsRect.width - 12),
      );

      // Set BOTH intrinsic and CSS width so getBoundingClientRect() is non-zero
      this.hueCanvas.width = availableWidth;
      this.hueCanvas.style.width = `${availableWidth}px`;

      // Ensure a real CSS height as well
      const h = this.hueCanvas.height || 20;
      this.hueCanvas.style.height = `${h}px`;
    };

    if (toolsRow && buttonsContainer) {
      apply();
    } else {
      // Try again next frame if layout isn't ready yet
      requestAnimationFrame(() => this.setupHueSliderCanvas());
    }
  }

  // Put this method in the class (anywhere with the other helpers)
  updateColorWheelFromColor() {
    const hsl = this.hexToHSL(this.currentColor);
    if (!hsl) return;

    const centerX = 50,
      centerY = 50,
      radius = 48;
    const angle = (hsl.h * Math.PI) / 180;
    const r = (hsl.s / 100) * radius;

    const x = centerX + Math.cos(angle) * r;
    const y = centerY + Math.sin(angle) * r;

    this.colorWheelPosition = { x, y };
    this.updateColorWheelIndicator?.();
  }

  // === Crisp canvas + aligned hit-testing ===
  setupWheelCanvasScaling() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    // Keep visual size at 100×100 CSS px
    this.canvas.style.width = "100px";
    this.canvas.style.height = "100px";
    // Backing store = CSS * DPR
    this.canvas.width = 100 * dpr;
    this.canvas.height = 100 * dpr;
    // Draw in CSS pixel coordinates
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  drawColorWheel() {
    // Render in CSS pixels; setupWheelCanvasScaling() aligns the backing store
    const w = 100,
      h = 100;
    const cx = w / 2;
    const cy = h / 2;
    const R = 48;
    // Sample at pixel centers; stop exactly at R - 0.5 so the border sits on a clean ring
    const fillR = R - 0.5;
    const img = this.ctx.createImageData(w, h);
    const data = img.data;

    // Paint interior directly into the pixel buffer (no AA at the boundary)
    let i = 0;
    for (let y = 0; y < h; y++) {
      const py = y + 0.5; // pixel center
      const dy = py - cy;
      for (let x = 0; x < w; x++, i += 4) {
        const px = x + 0.5; // pixel center
        const dx = px - cx;
        const dist = Math.hypot(dx, dy);
        if (dist <= fillR) {
          // HSL at fixed L=60% like before
          const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
          const sat = Math.min(100, (dist / fillR) * 100);
          // HSL → RGB (fast inline)
          const s = sat / 100,
            l = 0.6;
          const c = (1 - Math.abs(2 * l - 1)) * s;
          const hp = hue / 60;
          const xcol = c * (1 - Math.abs((hp % 2) - 1));
          let r = 0,
            g = 0,
            b = 0;
          if (hp >= 0 && hp < 1) {
            r = c;
            g = xcol;
          } else if (hp < 2) {
            r = xcol;
            g = c;
          } else if (hp < 3) {
            g = c;
            b = xcol;
          } else if (hp < 4) {
            g = xcol;
            b = c;
          } else if (hp < 5) {
            r = xcol;
            b = c;
          } else {
            r = c;
            b = xcol;
          }
          const m = l - c / 2;
          data[i] = Math.round((r + m) * 255);
          data[i + 1] = Math.round((g + m) * 255);
          data[i + 2] = Math.round((b + m) * 255);
          data[i + 3] = 255; // opaque
        } else {
          // fully transparent outside: hard edge, no fuzz
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 0;
        }
      }
    }

    // Clear and blit
    this.ctx.clearRect(0, 0, w, h);

    // Ensure crisp pixel rendering
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.putImageData(img, 0, 0);

    // Draw single white outline
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, R - 0.5, 0, Math.PI * 2);
    this.ctx.strokeStyle = "#ffffff"; // Pure white outline
    this.ctx.lineWidth = 1;

    // Ensure crisp line rendering
    this.ctx.lineCap = "butt";
    this.ctx.lineJoin = "miter";

    this.ctx.stroke();
    this.ctx.restore();
  }

  bindEvents() {
    // Close on backdrop click
    const backdrop = this.container.querySelector(".color-picker-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", () => this.close());
    }

    // Click outside to close (guarded during eyedropper)
    this.outsideClickHandler = (e) => {
      if (this._eyedropperActive) return; // don't close while eyedropper overlay is up
      if (this.isOpen && !this.container.contains(e.target)) {
        this.close();
      }
    };

    // Random color
    this.container
      .querySelector(".color-picker-random")
      .addEventListener("click", () => this.generateRandomColor());

    // Eyedropper tool
    this.container
      .querySelector(".color-picker-eyedropper")
      .addEventListener("click", () => this.startEyedropper());

    // === Color wheel: pointer-based picking (unchanged) ===
    let wheelDragging = false;

    const pickFromEvent = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Normalize to 0–100 space so it matches keyboard & math
      const nx = (x / rect.width) * 100;
      const ny = (y / rect.height) * 100;

      this.handleCanvasPickAt(nx, ny); // expects 0–100 coords
      this.colorWheelPosition = { x: nx, y: ny }; // store normalized
      this.updateColorWheelIndicator(); // will scale to px for display
    };

    this.canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.canvas.setPointerCapture?.(e.pointerId);
      wheelDragging = true;
      pickFromEvent(e);
    });

    this.canvas.addEventListener("pointermove", (e) => {
      if (!wheelDragging) return;
      e.preventDefault();
      pickFromEvent(e);
    });

    const endWheelDrag = (e) => {
      wheelDragging = false;
      try {
        this.canvas.releasePointerCapture?.(e.pointerId);
      } catch {}
    };

    this.canvas.addEventListener("pointerup", endWheelDrag);
    this.canvas.addEventListener("pointercancel", endWheelDrag);

    // Make color wheel keyboard-focusable & ARIA-described
    this.canvas.setAttribute("tabindex", "0");
    this.canvas.setAttribute("role", "slider");
    this.canvas.setAttribute(
      "aria-label",
      "Color wheel: use arrow keys to select hue and saturation",
    );
    this.canvas.setAttribute("aria-valuenow", "0");
    this.canvas.setAttribute("aria-valuemin", "0");
    this.canvas.setAttribute("aria-valuemax", "360");

    // Keyboard navigation for the wheel (unchanged)
    this.canvas.addEventListener("keydown", (e) =>
      this.handleColorWheelKeydown(e),
    );

    // Initialize color wheel position tracking + indicator
    if (!this.colorWheelPosition) this.colorWheelPosition = { x: 50, y: 50 };

    this.createColorWheelIndicator();
    this.updateColorWheelFromColor();

    // Hue slider click (unchanged)
    this.hueCanvas.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = this.hueCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      this.handleHueSliderClick(x);
    });

    // Hue slider dragging (unchanged)
    this.initHueSliderDragging();

    // More options (advanced inputs)
    this.container
      .querySelector(".color-picker-more-options")
      .addEventListener("click", () => this.toggleAdvancedOptions());

    // CSS color input
    const cssInput = this.container.querySelector(".css-color-input");
    cssInput.addEventListener("input", (e) =>
      this.handleCssColorInput(e.target.value),
    );
    cssInput.addEventListener("focus", () => {
      this.cssInputFocused = true;
      cssInput.select();
    });
    cssInput.addEventListener("blur", () => {
      this.cssInputFocused = false;
      this.updateCssInput();
    });

    // RGB inputs
    const rgbInputs = this.container.querySelectorAll(".rgb-input");
    rgbInputs.forEach((input) => {
      input.addEventListener("input", () => this.handleRgbInput());
    });

    // Color swatches with grid navigation
    this.setupColorSwatchNavigation();

    // Click to choose a preset swatch
    this.container.addEventListener("click", (e) => {
      if (e.target.classList.contains("color-swatch")) {
        this.setColor(e.target.dataset.color); // lightness strip will repaint via updateLightnessFromColor()
      }
    });

    // Confirm / general keyboard handling on the container (Esc/Enter/Space)
    this.container
      .querySelector(".color-picker-use")
      .addEventListener("click", () => this.confirmColor());
    this.container.addEventListener("keydown", (e) => this.handleKeydown(e));

    // === Lightness slider interactions (fixed) ===
    if (this.lightSlider) {
      let dragging = false;
      let rafId = null;

      const updateFromClientY = (clientY) => {
        const L = this._lightnessFromClientY(clientY);
        this.setLightness(L);
      };

      this.lightSlider.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        dragging = true;
        this.lightSlider.setPointerCapture?.(e.pointerId);
        updateFromClientY(e.clientY);
      });

      this.lightSlider.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        e.preventDefault();
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          rafId = null;
          updateFromClientY(e.clientY);
        });
      });

      const endDrag = (e) => {
        dragging = false;
        try {
          this.lightSlider.releasePointerCapture?.(e.pointerId);
        } catch {}
      };
      this.lightSlider.addEventListener("pointerup", endDrag);
      this.lightSlider.addEventListener("pointercancel", endDrag);

      // Keyboard control (unchanged)
      this.lightSlider.addEventListener("keydown", (e) => {
        let delta = 0;
        // inside this.lightSlider.addEventListener("keydown", (e) => { ... })
        switch (e.key) {
          case "ArrowUp":
            delta = +2;
            break;
          case "ArrowDown":
            delta = -2;
            break;
          case "PageUp":
            delta = +10;
            break;
          case "PageDown":
            delta = -10;
            break;
          case "Home":
            this.setLightness(L_MAX); // was 100
            e.preventDefault();
            return;
          case "End":
            this.setLightness(L_MIN); // was 0
            e.preventDefault();
            return;
          default:
            return;
        }
        e.preventDefault();
        this.setLightness(clampL((this.currentLightness ?? 60) + delta));
        e.preventDefault();
        this.setLightness(clampL((this.currentLightness ?? 60) + delta));
      });

      // Keep gradient correct on size/DPR changes
      if (!this._lightResizeObs) {
        this._lightResizeObs = new ResizeObserver(() => {
          this.setupLightnessCanvasScaling();
          this.updateLightnessFromColor();
        });
        this._lightResizeObs.observe(this.lightSlider);
      }

      window.addEventListener("resize", () => {
        this.setupLightnessCanvasScaling();
        this.updateLightnessFromColor();
      });
    }

    // Focus trap + hue slider keyboard
    this.setupFocusTrapping();
    this.setupHueSliderKeyboard();
  }

  handleCanvasPickAt(x, y) {
    const centerX = 50;
    const centerY = 50;
    const radius = 48;

    const dx = x - centerX;
    const dy = y - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist > radius + 0.5) return; // ignore clicks outside the wheel

    const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    const saturation = Math.min(100, (dist / radius) * 100);

    // Blender-like: keep current L when changing H/S from the wheel
    const keepL = this.lockLightnessOnWheel
      ? (this.currentLightness ?? this.hexToHSL(this.currentColor)?.l ?? 60)
      : 60;

    const color = this.hslToHex(hue, saturation, keepL);
    this.setColor(color); // will repaint lightness bar (since H/S changed)
  }

  _setWheelNormalized(nx, ny) {
    // normalize to 0–100
    nx = Math.max(0, Math.min(100, nx));
    ny = Math.max(0, Math.min(100, ny));

    // clamp to circle (center 50,50; radius 48)
    const cx = 50,
      cy = 50,
      R = 48;
    let dx = nx - cx,
      dy = ny - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > R) {
      const k = R / dist;
      nx = cx + dx * k;
      ny = cy + dy * k;
    }

    this.colorWheelPosition = { x: nx, y: ny };
    this.updateColorWheelIndicator?.();
    this.handleCanvasPickAt(nx, ny); // expects 0–100 space
  }

  createColorWheelIndicator() {
    const indicator = document.createElement("div");
    indicator.className = "color-wheel-indicator";
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
    wheelContainer.style.position = "relative";
    wheelContainer.appendChild(indicator);
    this.colorWheelIndicator = indicator;
    this.updateColorWheelIndicator();
  }

  updateColorWheelIndicator() {
    if (!this.colorWheelIndicator || !this.canvas) return;

    const parent = this.canvas.parentElement; // indicator is absolutely positioned here
    if (!parent) return;

    const canvasRect = this.canvas.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();

    // Canvas offset inside its parent (handles padding/centering)
    const offX = canvasRect.left - parentRect.left;
    const offY = canvasRect.top - parentRect.top;

    const p = this.colorWheelPosition || { x: 50, y: 50 };
    const w = canvasRect.width || 100;
    const h = canvasRect.height || 100;

    // If values look like 0–100, treat them as normalized and scale to CSS px.
    // Otherwise assume they're already in canvas-local px.
    const isNormalized = p.x <= 100 && p.y <= 100;
    const xpx = isNormalized ? (p.x / 100) * w : p.x;
    const ypx = isNormalized ? (p.y / 100) * h : p.y;

    this.colorWheelIndicator.style.left = `${offX + xpx}px`;
    this.colorWheelIndicator.style.top = `${offY + ypx}px`;
  }

  handleColorWheelKeydown(e) {
    const p = this.colorWheelPosition || { x: 50, y: 50 };
    const step = 2;
    let nx = p.x,
      ny = p.y;

    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        nx -= step;
        break;
      case "ArrowRight":
        e.preventDefault();
        nx += step;
        break;
      case "ArrowUp":
        e.preventDefault();
        ny -= step;
        break;
      case "ArrowDown":
        e.preventDefault();
        ny += step;
        break;
      case "Home":
        e.preventDefault();
        nx = 98;
        ny = 50;
        break; // max sat at 0°
      case "End":
        e.preventDefault();
        nx = 50;
        ny = 50;
        break; // center
      default:
        return;
    }

    this._setWheelNormalized(nx, ny);
  }

  handleKeydown(e) {
    const t = e.target;

    // Always allow Esc to close
    if (e.key === "Escape") {
      this.close();
      return;
    }

    // SPACE/ENTER on swatches should *pick* but not close
    if (
      (e.key === " " || e.key === "Enter") &&
      t.classList.contains("color-swatch")
    ) {
      e.preventDefault();
      this.setColor(t.dataset.color);
      return;
    }

    // Only the "Use" (paintbrush) button should confirm + close on Enter
    if (e.key === "Enter") {
      // Is the Use button (or inside it)?
      if (t.closest(".color-picker-use")) {
        e.preventDefault();
        this.confirmColor();
        return;
      }

      // If focused element is any of these interactive controls,
      // DO NOT close on Enter.
      const isNonCommitControl =
        t.id === "palette-select" || // palette dropdown
        t.closest(".palette-dropdown") || // (defensive)
        t.closest(".color-picker-random") || // random button
        t.closest(".color-picker-eyedropper") || // eyedropper
        t.closest(".color-picker-more-options") || // more options
        t === this.canvas || // color wheel canvas
        t.closest(".hue-slider-container") || // hue slider wrapper
        t.closest(".lightness-slider") || // lightness slider wrapper
        t.classList.contains("rgb-input") || // R/G/B inputs
        t.classList.contains("css-color-input"); // hex/css input

      if (isNonCommitControl) {
        // Let the control handle Enter normally (e.g., open select, click button)
        return;
      }

      // Fallback: do not auto-close from miscellaneous elements
      return;
    }
  }

  // === Eyedropper visibility control ===
  hideUIForEyedropper() {
    if (!this.isOpen) return;
    this._eyedropperActive = true;
    this._preEyeDropperFocusEl = document.activeElement || null;
    this.container.setAttribute("aria-hidden", "true");
    this.container.style.opacity = "0";
    this.container.style.pointerEvents = "none";
  }

  restoreUIAfterEyedropper() {
    if (!this.isOpen) return;
    this.container.removeAttribute("aria-hidden");
    this.container.style.opacity = "1";
    this.container.style.pointerEvents = "auto";
    this._eyedropperActive = false;

    const useBtn = this.container.querySelector(".color-picker-use");
    if (useBtn) useBtn.focus();
    else if (this.canvas) this.canvas.focus();
    else if (this._preEyeDropperFocusEl?.focus)
      this._preEyeDropperFocusEl.focus();

    this._preEyeDropperFocusEl = null;
  }

  async startEyedropper() {
    if (!window.EyeDropper) {
      alert(
        "Color picker tool is not supported in this browser. Try using Chrome or Edge.",
      );
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
  // Normalize any CSS color string to #RRGGBB (returns null if invalid)
  normalizeToHex(input) {
    if (!input || typeof input !== "string") return null;
    let s = input.trim();

    // Already hex? handle #RGB and #RRGGBB
    if (/^#([0-9a-f]{3})$/i.test(s)) {
      const r = s[1],
        g = s[2],
        b = s[3];
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    if (/^#([0-9a-f]{6})$/i.test(s)) {
      return s.toLowerCase();
    }

    // Try to resolve any CSS color (names, rgb(), hsl(), etc.) via the browser
    const el = document.createElement("div");
    el.style.color = s;
    document.body.appendChild(el);
    const computed = getComputedStyle(el).color; // e.g., "rgb(255, 0, 0)"
    document.body.removeChild(el);

    const m =
      computed && computed.match(/^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/i);
    if (!m) return null;

    const r = parseInt(m[1], 10);
    const g = parseInt(m[2], 10);
    const b = parseInt(m[3], 10);
    return this.rgbToHex(r, g, b).toLowerCase();
  }

  hexToRgb(hex) {
    if (!hex || typeof hex !== "string") return null;
    let s = hex.trim().toLowerCase();
    if (s[0] !== "#") s = "#" + s;

    // #RGB → #RRGGBB
    if (/^#([0-9a-f]{3})$/i.test(s)) {
      const r = s[1],
        g = s[2],
        b = s[3];
      s = `#${r}${r}${g}${g}${b}${b}`;
    }

    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(s);
    return m
      ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
      : null;
  }

  setColor(color, opts = {}) {
    const normalized = this.normalizeToHex(color) || color;
    this.currentColor = normalized;

    // Track lightness (0–100). If caller provides a specific L (e.g. slider drag),
    // trust that value instead of re-deriving from hex to avoid bounce.
    const seedHsl = this.hexToHSL(this.currentColor) || { l: 60, h: 0, s: 0 };
    if (opts && typeof opts.forceLightness === "number") {
      this.currentLightness = clampL(opts.forceLightness);
    } else {
      this.currentLightness = clampL(seedHsl.l);
    }

    // Update swatch display
    const colorDisplay = this.container.querySelector(
      ".color-picker-footer .current-color-display",
    );
    if (colorDisplay) {
      colorDisplay.style.backgroundColor = this.currentColor;
    }

    // Sync inputs + sliders
    this.updateCssInput();
    this.updateRgbInputs();
    this.updateHueSliderFromColor();
    this.updateColorWheelFromColor();

    // Lightness bar: repaint unless we're dragging the L handle
    if (!opts.skipLightnessSync && this.lightSlider) {
      this.updateLightnessFromColor();
    }
  }

  updateCssInput() {
    const cssInput = this.container.querySelector(".css-color-input");
    if (cssInput && this.currentColor && !this.cssInputFocused) {
      const displayValue = this.currentColor.startsWith("#")
        ? this.currentColor.slice(1)
        : this.currentColor;
      cssInput.value = displayValue;
    }
  }

  setupFocusTrapping() {
    this.focusableElements = this.container.querySelectorAll(
      'button, input, [tabindex]:not([tabindex="-1"])',
    );
    this.firstFocusableElement = this.focusableElements[0];
    this.lastFocusableElement =
      this.focusableElements[this.focusableElements.length - 1];

    this.container.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
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
    const hueSlider = this.container.querySelector(".hue-slider-container");
    if (!hueSlider) return;

    hueSlider.addEventListener("keydown", (e) => {
      if (document.activeElement !== hueSlider) return;

      let currentHue = this.getCurrentHue();
      let newHue = currentHue;
      let handled = false;

      switch (e.key) {
        case "ArrowLeft":
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          newHue = Math.max(0, currentHue - 5);
          handled = true;
          break;
        case "ArrowRight":
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          newHue = Math.min(360, currentHue + 5);
          handled = true;
          break;
        case "Home":
          e.preventDefault();
          e.stopPropagation();
          newHue = 0;
          handled = true;
          break;
        case "End":
          e.preventDefault();
          e.stopPropagation();
          newHue = 360;
          handled = true;
          break;
        case "PageUp":
          e.preventDefault();
          e.stopPropagation();
          newHue = Math.min(360, currentHue + 30);
          handled = true;
          break;
        case "PageDown":
          e.preventDefault();
          e.stopPropagation();
          newHue = Math.max(0, currentHue - 30);
          handled = true;
          break;
      }

      if (handled) {
        this.setHueFromKeyboard(newHue);
        hueSlider.setAttribute("aria-valuenow", Math.round(newHue));
      }
    });

    hueSlider.addEventListener("focus", () => {
      hueSlider.style.outline = "3px solid var(--color-focus)";
      hueSlider.style.outlineOffset = "2px";
    });
    hueSlider.addEventListener("blur", () => {
      hueSlider.style.outline = "none";
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
    let saturation =
      delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

    if (saturation < 0.3) saturation = 0.8;
    if (lightness < 0.2) lightness = 0.5;
    else if (lightness > 0.9) lightness = 0.7;

    const newColor = this.hslToHex(hue, saturation * 100, lightness * 100);
    this.setColor(newColor);
    this.updateHueSliderPosition(hue);
  }

  updateHueSliderPosition(hue) {
    const handle = this.container.querySelector(".hue-slider-handle");
    const canvas = this.container.querySelector(".hue-slider-canvas");
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
    const palette = this.container.querySelector(".color-palette");
    const swatches = this.container.querySelectorAll(".color-swatch");
    if (!palette || swatches.length === 0) return;

    // ARIA
    palette.setAttribute("role", "grid");
    palette.setAttribute(
      "aria-label",
      "Color palette: use arrow keys to navigate",
    );

    // Only first is tabbable initially
    swatches.forEach((swatch, i) => {
      swatch.setAttribute("tabindex", i === 0 ? "0" : "-1");
      swatch.setAttribute("role", "gridcell");
      // Delegate keydown per swatch to a shared handler
      swatch.addEventListener("keydown", (e) => this.handleSwatchKeydown(e));
    });

    // Compute grid metrics initially and when layout changes
    this._computeSwatchGrid(); // initial
    // Recompute when the palette resizes (responsive wrap)
    if (!this._paletteResizeObs) {
      this._paletteResizeObs = new ResizeObserver(() =>
        this._computeSwatchGrid(),
      );
      this._paletteResizeObs.observe(palette);
    }
    // Also recompute when the palette gains focus (e.g., after opening)
    palette.addEventListener("focusin", () => this._computeSwatchGrid());
  }

  _computeSwatchGrid() {
    const swatches = Array.from(
      this.container.querySelectorAll(".color-swatch"),
    );
    if (swatches.length === 0) {
      this._swatchCols = 1;
      this._swatchRows = 1;
      return;
    }

    const firstTop = swatches[0].offsetTop;
    let cols = 0;
    for (const el of swatches) {
      if (el.offsetTop !== firstTop) break;
      cols++;
    }
    cols = Math.max(1, cols);
    const rows = Math.ceil(swatches.length / cols);

    this._swatchCols = cols;
    this._swatchRows = rows;
  }

  handleSwatchKeydown(e) {
    const swatches = Array.from(
      this.container.querySelectorAll(".color-swatch"),
    );
    if (swatches.length === 0) return;

    const currentIndex = swatches.indexOf(e.target);
    if (currentIndex === -1) return;

    const cols = this._swatchCols || 8; // fallback
    const total = swatches.length;

    const moveFocus = (newIndex) => {
      if (newIndex < 0) newIndex = 0;
      if (newIndex >= total) newIndex = total - 1;
      swatches[currentIndex].setAttribute("tabindex", "-1");
      swatches[newIndex].setAttribute("tabindex", "0");
      swatches[newIndex].focus();
    };

    switch (e.key) {
      case "ArrowRight": {
        e.preventDefault();
        moveFocus((currentIndex + 1) % total);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        moveFocus((currentIndex - 1 + total) % total);
        break;
      }
      case "ArrowDown": {
        e.preventDefault();
        let newIndex = currentIndex + cols;
        if (newIndex >= total) {
          newIndex = currentIndex % cols;
        }
        moveFocus(newIndex);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        let newIndex = currentIndex - cols;
        if (newIndex < 0) {
          const col = currentIndex % cols;
          const lastRowStart = Math.floor((total - 1) / cols) * cols;
          newIndex = Math.min(lastRowStart + col, total - 1);
        }
        moveFocus(newIndex);
        break;
      }
      case "Home": {
        e.preventDefault();
        moveFocus(0);
        break;
      }
      case "End": {
        e.preventDefault();
        moveFocus(total - 1);
        break;
      }
      case "Enter":
      case " ": {
        e.preventDefault();
        this.setColor(e.target.dataset.color);
        break;
      }
      default:
        break;
    }
  }

  drawHueSlider() {
    const sliderWidth = this.hueCanvas.width;
    const sliderHeight = this.hueCanvas.height;

    this.hueCtx.clearRect(0, 0, sliderWidth, sliderHeight);

    const gradient = this.hueCtx.createLinearGradient(0, 0, sliderWidth, 0);
    gradient.addColorStop(0, "hsl(0, 100%, 50%)");
    gradient.addColorStop(0.17, "hsl(60, 100%, 50%)");
    gradient.addColorStop(0.33, "hsl(120, 100%, 50%)");
    gradient.addColorStop(0.5, "hsl(180, 100%, 50%)");
    gradient.addColorStop(0.67, "hsl(240, 100%, 50%)");
    gradient.addColorStop(0.83, "hsl(300, 100%, 50%)");
    gradient.addColorStop(1, "hsl(360, 100%, 50%)");

    this.hueCtx.fillStyle = gradient;
    this.hueCtx.fillRect(0, 0, sliderWidth, sliderHeight);

    this.hueCtx.strokeStyle = "#ddd";
    this.hueCtx.lineWidth = 1;
    this.hueCtx.strokeRect(0, 0, sliderWidth, sliderHeight);

    this.updateHueHandle();
  }

  updateHueHandle() {
    const handle = this.container.querySelector(".hue-slider-handle");
    if (!handle) return;
    const sliderWidth = this.hueCanvas.width;
    const position = (this.currentHue / 360) * sliderWidth;
    handle.style.left = `${position - 6}px`;
  }

  handleHueSliderClick(x) {
    const sliderWidth = this.hueCanvas.width;
    const hue = (x / sliderWidth) * 360;
    this.currentHue = Math.max(0, Math.min(360, hue));

    // Keep current S & L (Blender-like)
    const hsl = this.hexToHSL(this.currentColor) || { h: 0, s: 100, l: 50 };
    const newColor = this.hslToHex(this.currentHue, hsl.s, hsl.l);

    this.setColor(newColor);
    this.updateHueHandle();
    this.drawColorWheel();
  }

  initHueSliderDragging() {
    const handle = this.container.querySelector(".hue-slider-handle");
    const container = this.container.querySelector(".hue-slider-container");
    let isDragging = false;

    const startDrag = (e) => {
      isDragging = true;
      e.preventDefault();
      document.addEventListener("mousemove", handleDrag);
      document.addEventListener("mouseup", endDrag);
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
      document.removeEventListener("mousemove", handleDrag);
      document.removeEventListener("mouseup", endDrag);
    };

    handle.addEventListener("mousedown", startDrag);
    container.addEventListener("mousedown", (e) => {
      const rect = this.hueCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      this.handleHueSliderClick(x);
      startDrag(e);
    });
  }

  generateRandomColor() {
    const letters = "0123456789ABCDEF";
    let color = "#";
    for (let i = 0; i < 6; i++)
      color += letters[Math.floor(Math.random() * 16)];
    this.setColor(color);
  }

  toggleAdvancedOptions() {
    const advancedSection = this.container.querySelector(
      ".color-advanced-options",
    );
    this.advancedOptionsOpen = !this.advancedOptionsOpen;
    advancedSection.style.display = this.advancedOptionsOpen ? "block" : "none";
    if (this.advancedOptionsOpen) this.updateRgbInputs();
  }

  handleCssColorInput(value) {
    if (!value) return;
    let processedValue = value.trim();
    let isCompleteColor = false;

    if (
      /^#?[0-9a-fA-F]{6}$/.test(processedValue) ||
      /^#?[0-9a-fA-F]{3}$/.test(processedValue)
    ) {
      isCompleteColor = true;
      if (!processedValue.startsWith("#"))
        processedValue = "#" + processedValue;
    } else {
      const tempDiv = document.createElement("div");
      tempDiv.style.color = processedValue;
      document.body.appendChild(tempDiv);
      const computedColor = window.getComputedStyle(tempDiv).color;
      document.body.removeChild(tempDiv);
      if (computedColor && computedColor !== "rgba(0, 0, 0, 0)")
        isCompleteColor = true;
    }

    if (isCompleteColor) {
      const tempDiv = document.createElement("div");
      tempDiv.style.color = processedValue;
      document.body.appendChild(tempDiv);
      const computedColor = window.getComputedStyle(tempDiv).color;
      document.body.removeChild(tempDiv);

      if (computedColor && computedColor !== "rgba(0, 0, 0, 0)") {
        const rgbMatch = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
          const hex = this.rgbToHex(
            parseInt(rgbMatch[1]),
            parseInt(rgbMatch[2]),
            parseInt(rgbMatch[3]),
          );
          this.setColor(hex);
          this.updateRgbInputs();
        }
      }
    }
  }

  handleRgbInput() {
    const r = parseInt(this.container.querySelector("#rgb-r").value) || 0;
    const g = parseInt(this.container.querySelector("#rgb-g").value) || 0;
    const b = parseInt(this.container.querySelector("#rgb-b").value) || 0;

    const hex = this.rgbToHex(
      Math.max(0, Math.min(255, r)),
      Math.max(0, Math.min(255, g)),
      Math.max(0, Math.min(255, b)),
    );
    this.setColor(hex);
  }

  updateRgbInputs() {
    const rgb = this.hexToRgb(this.currentColor);
    if (!rgb) return;
    const rInput = this.container.querySelector("#rgb-r");
    const gInput = this.container.querySelector("#rgb-g");
    const bInput = this.container.querySelector("#rgb-b");
    if (rInput && !rInput.matches(":focus")) rInput.value = rgb.r;
    if (gInput && !gInput.matches(":focus")) gInput.value = rgb.g;
    if (bInput && !bInput.matches(":focus")) bInput.value = rgb.b;
  }

  rgbToHex(r, g, b) {
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  getContrastColor(hexcolor) {
    const rgb = this.hexToRgb(hexcolor);
    if (!rgb) return "#000000";
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness > 128 ? "#000000" : "#ffffff";
  }

  // Keep the indicator fully inside the wheel (accounts for its own size + outline)
  // Keep the indicator fully inside the ring (accounts for its size & border)
  _indicatorPad() {
    const el = this.colorWheelIndicator;
    if (!el) return 6; // default for 8px dot + 2px border
    const rect = el.getBoundingClientRect();
    if (rect.width) return rect.width / 2 + 1; // +1 to avoid overlapping the white outline
    const cs = getComputedStyle(el);
    const inner = parseFloat(cs.width) || 8;
    const bw = parseFloat(cs.borderWidth) || 2;
    return inner / 2 + bw + 1;
  }

  // HSL/HEX conversion
  hslToHex(h, s, l) {
    // ✅ normalize hue into [0,360)
    h = ((h % 360) + 360) % 360;

    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0,
      g = 0,
      b = 0;

    if (0 <= h && h < 60) {
      r = c;
      g = x;
      b = 0;
    } else if (60 <= h && h < 120) {
      r = x;
      g = c;
      b = 0;
    } else if (120 <= h && h < 180) {
      r = 0;
      g = c;
      b = x;
    } else if (180 <= h && h < 240) {
      r = 0;
      g = x;
      b = c;
    } else if (240 <= h && h < 300) {
      r = x;
      g = 0;
      b = c;
    } /* 300 <= h < 360 */ else {
      r = c;
      g = 0;
      b = x;
    }

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  hexToHSL(hex) {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return null;

    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s;
    const l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }

  open(color = this.currentColor) {
    // Show first so layout has real sizes
    this.container.style.display = "block";
    this.container.style.opacity = "1";
    this.container.style.pointerEvents = "auto";
    this.isOpen = true;

    // --- Positioning (unchanged) ---
    const colorButton = document.getElementById("colorPickerButton");
    const canvasArea = document.getElementById("canvasArea");
    if (colorButton && canvasArea) {
      const buttonRect = colorButton.getBoundingClientRect();
      const canvasRect = canvasArea.getBoundingClientRect();

      this.container.style.position = "absolute";
      const isMobile = window.innerWidth <= 600;

      if (isMobile) {
        this.container.style.left = "0px";
        this.container.style.right = "0px";
        this.container.style.width = `${canvasRect.width - 20}px`;
        this.container.style.maxWidth = "none";
        this.container.style.marginLeft = "10px";
        this.container.style.marginRight = "10px";
        const topPosition = Math.max(10, buttonRect.top - canvasRect.top - 200);
        const pickerHeight = 250;
        const bottomBarHeight = 40;
        const maxTop = canvasRect.height - pickerHeight - bottomBarHeight;
        this.container.style.top = `${Math.min(topPosition, Math.max(10, maxTop))}px`;
      } else {
        this.container.style.left = `${buttonRect.left - canvasRect.left}px`;
        this.container.style.top = `${buttonRect.top - canvasRect.top - 180}px`;
        this.container.style.width = "360px";
        this.container.style.right = "auto";

        const containerWidth = 360;
        if (
          buttonRect.left - canvasRect.left + containerWidth >
          canvasRect.width
        ) {
          this.container.style.left = `${canvasRect.width - containerWidth - 10}px`;
        }
        if (buttonRect.top - canvasRect.top - 180 < 10) {
          this.container.style.top = "10px";
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

    // After visible: size canvases, pick a usable start color, then draw & place handles
    requestAnimationFrame(() => {
      // 1) Ensure canvases have correct sizes
      this.setupHueSliderCanvas();
      this.setupLightnessCanvasScaling();

      // 2) Choose starting color
      //    - use saved/explicit color if valid and not a "dead" extreme (pure white/black with S≈0)
      //    - otherwise, pick a random color (same as pressing Random)
      const normalized = this.normalizeToHex(color);
      let useRandom = true;

      if (normalized) {
        const hsl = this.hexToHSL(normalized);
        if (hsl) {
          const isGray = hsl.s === 0; // greyscale
          const extremeL = hsl.l <= 2 || hsl.l >= 98; // near black/white
          if (!(isGray && extremeL)) {
            useRandom = false; // keep saved color if it's not a dead extreme
          }
        }
      }

      if (useRandom) {
        this.generateRandomColor(); // calls setColor(...)
      } else {
        this.setColor(normalized); // preserves saved color exactly
      }

      // 3) Draw sliders & place handles/indicator to match current color
      this.drawHueSlider();
      this._lastLightnessHS = { h: NaN, s: NaN }; // ensure update doesn’t skip
      this.setupLightnessCanvasScaling(); // size with real layout
      this.drawLightnessSlider(); // uses current H/S for the gradient
      this.updateHueSliderFromColor?.(); // position hue handle from current color
      this.updateLightnessHandle?.(); // position lightness thumb from current L
      this.updateColorWheelFromColor?.(); // move the wheel indicator to current H/S

      // Ensure footer swatch reflects the actual color
      const colorDisplay = this.container.querySelector(
        ".color-picker-footer .current-color-display",
      );
      if (colorDisplay) colorDisplay.style.backgroundColor = this.currentColor;
    });

    // Outside click to close
    setTimeout(() => {
      document.addEventListener("click", this.outsideClickHandler, true);
    }, 100);

    // Focus for keyboard nav
    setTimeout(() => {
      this.canvas?.focus();
    }, 150);
  }

  close() {
    this.container.style.display = "none";
    this.isOpen = false;
    document.removeEventListener("click", this.outsideClickHandler, true);
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
