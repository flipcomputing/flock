let _canvas = null;
const _twins = new Map(); // id → { elements: HTMLElement[], cleanup: () => void }
// Off-screen position container — holds invisible but screen-reader-accessible elements
let _srRoot = null;
let _canvasTabHandler = null;

export function initUIAccessibility(canvas) {
  if (_canvas === canvas && _srRoot) return;
  if (_canvas && _canvasTabHandler) {
    _canvas.removeEventListener('keydown', _canvasTabHandler);
    _canvasTabHandler = null;
  }
  _canvas = canvas;
  _srRoot = _createSrRoot();
  _installCanvasTabHandler(canvas);
}

export function clearUIControls() {
  for (const id of [..._twins.keys()]) {
    unregisterUIControl(id);
  }
}

function _createSrRoot() {
  let root = document.getElementById('flock-ui-a11y-root');
  if (root) return root;

  root = document.createElement('div');
  root.id = 'flock-ui-a11y-root';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'UI controls');
  // Visually hidden but accessible; individual elements are moved into view on focus
  root.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;';
  document.body.appendChild(root);
  return root;
}

// Tab from canvas moves into the first shadow control; Shift+Tab goes to the last
function _installCanvasTabHandler(canvas) {
  _canvasTabHandler = (e) => {
    if (e.key !== 'Tab' || e.ctrlKey || e.altKey || e.metaKey) return;
    const focusable = _getFocusableElements();
    if (!focusable.length) return;
    e.preventDefault();
    (e.shiftKey ? focusable[focusable.length - 1] : focusable[0]).focus();
  };
  canvas.addEventListener('keydown', _canvasTabHandler);
}

function _getFocusableElements() {
  if (!_srRoot) return [];
  return Array.from(_srRoot.querySelectorAll('[data-flock-twin]')).filter(
    (el) =>
      el.tagName === 'BUTTON' ||
      el.tagName === 'INPUT' ||
      el.tagName === 'P' ||
      el.tagName === 'SPAN'
  );
}

// Cycle focus within shadow controls; return to canvas at either end
function _onTwinKeydown(e) {
  if (e.key !== 'Tab' || e.ctrlKey || e.altKey || e.metaKey) return;
  const focusable = _getFocusableElements();
  const idx = focusable.indexOf(e.currentTarget);
  e.preventDefault();
  if (!e.shiftKey) {
    (idx < focusable.length - 1 ? focusable[idx + 1] : _canvas)?.focus();
  } else {
    (idx > 0 ? focusable[idx - 1] : _canvas)?.focus();
  }
}

// Compute the viewport-fixed CSS rect for a Babylon GUI control.
// Position params are passed directly from ui.js (raw x/y/w/h in Babylon GUI pixels).
function _computeFixedRect({ x, y, w, h }) {
  if (!_canvas) return null;
  const cr = _canvas.getBoundingClientRect();
  const cw = cr.width;
  const ch = cr.height;

  // Babylon GUI pixels map to canvas CSS pixels via the canvas/buffer scale
  const scaleX = cw / (_canvas.width || cw);
  const scaleY = ch / (_canvas.height || ch);

  const pw = w * scaleX;
  const ph = h * scaleY;
  const px = x * scaleX;
  const py = y * scaleY;

  // Negative coordinates mean right/bottom alignment (same logic as ui.js)
  const cssLeft = x < 0 ? cw - Math.abs(px) - pw : px;
  const cssTop = y < 0 ? ch - Math.abs(py) - ph : py;

  return {
    left: cr.left + cssLeft,
    top: cr.top + cssTop,
    width: pw,
    height: ph,
  };
}

// Attach focus/blur handlers that move the element into view (fixed position) when focused
function _attachFocusBehavior(el, posParams) {
  el.tabIndex = 0;
  // Keep the element itself off-screen; only the visible state uses fixed positioning
  el.style.position = 'static';
  el.style.opacity = '0';
  el.style.pointerEvents = 'auto';
  el.style.background = 'transparent';
  el.style.border = 'none';
  el.style.outline = 'none';
  el.style.color = 'transparent';

  // Floating focus-indicator div that appears over the canvas control
  const indicator = document.createElement('div');
  indicator.style.cssText =
    'display:none;position:fixed;pointer-events:none;z-index:9999;' +
    'outline:3px solid #005fcc;outline-offset:2px;border-radius:3px;box-sizing:border-box;';
  document.body.appendChild(indicator);

  el.addEventListener('focus', () => {
    const rect = _computeFixedRect(posParams);
    if (rect) {
      indicator.style.left = `${rect.left}px`;
      indicator.style.top = `${rect.top}px`;
      indicator.style.width = `${rect.width}px`;
      indicator.style.height = `${rect.height}px`;
      indicator.style.display = 'block';
    }
    el.style.opacity = '1';
    el.style.color = '';
  });
  el.addEventListener('blur', () => {
    indicator.style.display = 'none';
    el.style.opacity = '0';
    el.style.color = 'transparent';
  });

  el.addEventListener('keydown', _onTwinKeydown);

  return indicator;
}

// ─── UIButton twin ────────────────────────────────────────────────────────────

export function registerUIButton(id, text, babylonButton, posParams) {
  if (!_srRoot) return;
  unregisterUIControl(id);

  const btn = document.createElement('button');
  btn.setAttribute('data-flock-twin', id);
  btn.setAttribute('type', 'button');
  btn.textContent = text;
  const indicator = _attachFocusBehavior(btn, posParams);

  const onClick = () => {
    babylonButton.onPointerUpObservable.notifyObservers({});
    babylonButton.onPointerClickObservable.notifyObservers({});
  };
  btn.addEventListener('click', onClick);

  const disposeObs = babylonButton.onDisposeObservable.add(() => unregisterUIControl(id));

  _srRoot.appendChild(btn);
  _twins.set(id, {
    elements: [btn, indicator],
    cleanup() {
      btn.removeEventListener('click', onClick);
      btn.removeEventListener('keydown', _onTwinKeydown);
      indicator.remove();
      try {
        babylonButton.onDisposeObservable.remove(disposeObs);
      } catch {
        /* already gone */
      }
    },
  });
}

// ─── UISlider twin ────────────────────────────────────────────────────────────

export function registerUISlider(id, babylonSlider, posParams) {
  if (!_srRoot) return;
  unregisterUIControl(id);

  const range = document.createElement('input');
  range.setAttribute('data-flock-twin', id);
  range.type = 'range';
  range.min = String(babylonSlider.minimum ?? 0);
  range.max = String(babylonSlider.maximum ?? 100);
  range.value = String(babylonSlider.value ?? 0);
  range.setAttribute('aria-label', id);
  const indicator = _attachFocusBehavior(range, posParams);

  const onInput = () => {
    const val = parseFloat(range.value);
    babylonSlider.value = val;
    babylonSlider.onValueChangedObservable.notifyObservers(val);
  };
  range.addEventListener('input', onInput);

  const valueObs = babylonSlider.onValueChangedObservable.add((val) => {
    if (parseFloat(range.value) !== val) range.value = String(val);
  });

  const disposeObs = babylonSlider.onDisposeObservable.add(() => unregisterUIControl(id));

  _srRoot.appendChild(range);
  _twins.set(id, {
    elements: [range, indicator],
    cleanup() {
      range.removeEventListener('input', onInput);
      range.removeEventListener('keydown', _onTwinKeydown);
      indicator.remove();
      try {
        babylonSlider.onValueChangedObservable.remove(valueObs);
      } catch {
        /* already gone */
      }
      try {
        babylonSlider.onDisposeObservable.remove(disposeObs);
      } catch {
        /* already gone */
      }
    },
  });
}

// ─── UIInput twin ─────────────────────────────────────────────────────────────

export function registerUIInput(
  inputId,
  submitId,
  babylonInput,
  babylonSubmit,
  inputPosParams,
  submitPosParams
) {
  if (!_srRoot) return;
  unregisterUIControl(inputId);

  // Real <input type="text"> so the SR stays in forms mode and keypresses reach
  // this element directly — no canvas redirect needed.
  const htmlInput = document.createElement('input');
  htmlInput.type = 'text';
  htmlInput.setAttribute('data-flock-twin', inputId);
  htmlInput.setAttribute('aria-label', babylonInput.placeholderText || 'text input');
  htmlInput.placeholder = babylonInput.placeholderText || '';
  htmlInput.tabIndex = 0;

  const doSubmit = () => {
    // Capture next focus target before the twins are removed by dispose
    const focusable = _getFocusableElements();
    const idx = focusable.indexOf(submitBtn);
    const nextTarget = idx >= 0 && idx < focusable.length - 1 ? focusable[idx + 1] : _canvas;

    babylonInput.text = htmlInput.value;
    babylonSubmit.onPointerUpObservable.notifyObservers({});
    nextTarget?.focus();
  };

  // Inject a one-time stylesheet so ::placeholder can pick up the reversed colours
  const _styleId = `flock-input-ph-${inputId}`;
  const _phStyle = document.createElement('style');
  _phStyle.id = _styleId;
  document.head.appendChild(_phStyle);

  const _applyStyle = (focused) => {
    const rect = _computeFixedRect(inputPosParams);
    if (!rect) return;
    const bg = babylonInput.background || '#ffffff';
    const fg = babylonInput.color || '#000000';
    const fs = babylonInput.fontSize || '16px';
    const border = focused ? '2px solid #005fcc' : '1px solid rgba(128,128,128,0.6)';
    _phStyle.textContent = `#${_styleId}-el::placeholder { color: ${fg}; opacity: 0.5; }`;
    htmlInput.id = `${_styleId}-el`;
    htmlInput.style.cssText =
      `position:fixed;left:${rect.left}px;top:${rect.top}px;` +
      `width:${rect.width}px;height:${rect.height}px;` +
      `background:${bg};color:${fg};font-size:${fs};` +
      `border:${border};border-radius:3px;` +
      'z-index:9999;box-sizing:border-box;padding:0 8px;';
  };

  // Show immediately so text is visible from the start
  _applyStyle(false);

  htmlInput.addEventListener('focus', () => {
    if (babylonInput.text) htmlInput.value = babylonInput.text;
    _applyStyle(true);
  });

  htmlInput.addEventListener('blur', () => {
    _applyStyle(false);
  });

  const onInputKeydown = (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      doSubmit();
    } else if (e.key === 'Tab') {
      const focusable = _getFocusableElements();
      const idx = focusable.indexOf(htmlInput);
      e.preventDefault();
      (e.shiftKey
        ? idx > 0
          ? focusable[idx - 1]
          : _canvas
        : idx < focusable.length - 1
          ? focusable[idx + 1]
          : _canvas
      )?.focus();
    }
  };
  htmlInput.addEventListener('keydown', onInputKeydown);

  const submitBtn = document.createElement('button');
  submitBtn.setAttribute('data-flock-twin', submitId);
  submitBtn.setAttribute('type', 'button');
  submitBtn.setAttribute('aria-label', 'Submit');
  submitBtn.textContent = '✓';
  const submitIndicator = _attachFocusBehavior(submitBtn, submitPosParams);

  const submit = () => doSubmit();
  submitBtn.addEventListener('click', submit);

  const disposeObs = babylonInput.onDisposeObservable.add(() => {
    unregisterUIControl(inputId);
  });

  _srRoot.appendChild(htmlInput);
  _srRoot.appendChild(submitBtn);
  _twins.set(inputId, {
    elements: [htmlInput, submitBtn, submitIndicator],
    cleanup() {
      htmlInput.removeEventListener('keydown', onInputKeydown);
      submitBtn.removeEventListener('click', submit);
      submitBtn.removeEventListener('keydown', _onTwinKeydown);
      submitIndicator.remove();
      _phStyle.remove();
      try {
        babylonInput.onDisposeObservable.remove(disposeObs);
      } catch {
        /* already gone */
      }
    },
  });
}

// ─── UIText twin (aria-live + tab stop) ───────────────────────────────────────

let _textSeq = 0;

export function registerUIText(id, text, posParams) {
  if (!_srRoot) return;

  const existing = _twins.get(id);
  if (existing) {
    const p = existing.elements.find((el) => el.tagName === 'P');
    if (p) _announceToP(p, text);
    return;
  }

  const p = document.createElement('p');
  p.setAttribute('data-flock-twin', id);
  p.setAttribute('role', 'status');
  p.setAttribute('aria-live', 'polite');
  p.setAttribute('aria-atomic', 'true');
  p.style.cssText = 'margin:0;padding:0;';
  p.textContent = '';

  // Make the paragraph a tab stop so keyboard users can navigate to it
  p.tabIndex = 0;
  p.style.opacity = '0';
  p.style.outline = 'none';

  let indicator = null;
  if (posParams) {
    indicator = document.createElement('div');
    indicator.style.cssText =
      'display:none;position:fixed;pointer-events:none;z-index:9999;' +
      'outline:3px solid #005fcc;outline-offset:2px;border-radius:3px;box-sizing:border-box;';
    document.body.appendChild(indicator);

    p.addEventListener('focus', () => {
      const rect = _computeFixedRect(posParams);
      if (rect) {
        indicator.style.left = `${rect.left}px`;
        indicator.style.top = `${rect.top}px`;
        indicator.style.width = `${rect.width}px`;
        indicator.style.height = `${rect.height}px`;
        indicator.style.display = 'block';
      }
      p.style.opacity = '1';
    });
    p.addEventListener('blur', () => {
      indicator.style.display = 'none';
      p.style.opacity = '0';
    });
  }

  p.addEventListener('keydown', _onTwinKeydown);
  _srRoot.appendChild(p);

  // Set text after DOM registration so screen reader sees "" → text
  _announceToP(p, text);

  _twins.set(id, {
    elements: indicator ? [p, indicator] : [p],
    cleanup() {
      p.removeEventListener('keydown', _onTwinKeydown);
      indicator?.remove();
    },
  });
}

function _announceToP(p, text) {
  const seq = ++_textSeq;
  p.textContent = '';
  setTimeout(() => {
    if (_textSeq !== seq) return;
    p.textContent = String(text ?? '');
  }, 20);
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export function unregisterUIControl(id) {
  const twin = _twins.get(id);
  if (!twin) return;
  twin.cleanup?.();
  for (const el of twin.elements) {
    // indicator divs are appended to document.body and already removed in cleanup();
    // SR root children are removed here
    if (el.parentElement === _srRoot) el.remove();
  }
  _twins.delete(id);
}
