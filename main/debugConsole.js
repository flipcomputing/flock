// On-screen console log panel — lets errors/logs be read without opening
// devtools (handy on phones/tablets). Loaded as its own <script type="module">
// tag early in index.html (not imported from main.js) so it still executes
// before the rest of the app and can catch early errors, while keeping this
// debug-only code out of the main bundle and out of index.html itself.
import { isDebugModeEnabled } from './debugMode.js';

if (isDebugModeEnabled()) {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '90%',
    bottom: '0',
    maxHeight: '45vh',
    overflowY: 'auto',
    background: 'rgba(0,0,0,.85)',
    color: '#0f0',
    font: '12px/1.4 monospace',
    padding: '8px',
    zIndex: 2147483647,
    display: 'block',
    borderRadius: '6px 6px 0 0',
    border: '1px solid #00ff00',
    borderBottom: 'none',
  });
  const toggleOverlay = () => {
    overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
  };
  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length >= 3) toggleOverlay();
    },
    { passive: true }
  );
  // Desktop fallback for devices without touch — main/main.js calls this
  // on Mod+Shift+D so the panel is reachable without a tablet.
  window.__flockToggleDebugLog = toggleOverlay;
  document.body.appendChild(overlay);

  // Sticky so the shortcut hint and close button stay visible at the
  // top as log lines fill the scrolling overlay below them.
  const stickyBar = document.createElement('div');
  Object.assign(stickyBar.style, {
    position: 'sticky',
    top: '0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  });
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
  const hint = document.createElement('span');
  hint.textContent = `ℹ️ ${isMac ? '⌘' : 'Ctrl'}+Shift+D to toggle`;
  Object.assign(hint.style, { opacity: '0.6', fontSize: '11px' });
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', 'Close debug console');
  Object.assign(closeBtn.style, {
    background: 'none',
    border: 'none',
    color: '#0f0',
    fontSize: '16px',
    lineHeight: '1',
    cursor: 'pointer',
  });
  closeBtn.addEventListener('click', toggleOverlay);
  stickyBar.appendChild(hint);
  stickyBar.appendChild(closeBtn);
  overlay.appendChild(stickyBar);

  const append = (tag, args) => {
    const line = document.createElement('div');
    line.textContent =
      `[${tag}] ` +
      args
        .map((a) => {
          try {
            return typeof a === 'string' ? a : JSON.stringify(a);
          } catch {
            return String(a);
          }
        })
        .join(' ');
    overlay.appendChild(line);
    overlay.scrollTop = overlay.scrollHeight;
  };

  const orig = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };
  console.log = (...a) => {
    append('log', a);
    orig.log.apply(console, a);
  };
  console.warn = (...a) => {
    append('warn', a);
    orig.warn.apply(console, a);
  };
  console.error = (...a) => {
    append('error', a);
    orig.error.apply(console, a);
  };

  window.addEventListener('error', (e) =>
    append('uncaught', [e.message, e.filename + ':' + e.lineno])
  );
  window.addEventListener('unhandledrejection', (e) => append('rejection', [String(e.reason)]));
}
