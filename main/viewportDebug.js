import { isDebugModeEnabled } from './debugMode.js';

const enabled = isDebugModeEnabled();

// env() can't be read back off a custom property, so measure it as padding.
let _insetProbe = null;
const insets = () => {
  if (!document.body) return 'n/a';
  if (!_insetProbe) {
    _insetProbe = document.createElement('div');
    _insetProbe.style.cssText =
      'position:fixed;visibility:hidden;pointer-events:none;top:0;left:0;box-sizing:content-box;width:0;height:0;' +
      'padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);' +
      'padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)';
    document.body.appendChild(_insetProbe);
  }
  const cs = getComputedStyle(_insetProbe);
  return [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft]
    .map((v) => parseFloat(v))
    .join('/');
};

const box = (id) => {
  const r = document.getElementById(id)?.getBoundingClientRect();
  return r && r.height > 0 ? `${Math.round(r.top)}-${Math.round(r.bottom)}` : 'none';
};

// Every scrollable ancestor of a docked panel, as scrollTop/maxScroll. A
// non-zero scrollTop here is the canvas being dragged out of view.
const scrollers = () =>
  ['maincontent', 'canvasArea', 'info-panel', 'info-panel-body']
    .map((id) => {
      const el = document.getElementById(id);
      if (!el) return `${id}:none`;
      return `${id}:${Math.round(el.scrollTop)}/${el.scrollHeight - el.clientHeight}`;
    })
    .join(',');

// Which info tab is showing, and whether it docked or went modal — the two
// present very differently and only the docked one scrolls its ancestors.
const panelState = () => {
  const p = document.querySelector('.info-tab-panel:not(.hidden)');
  if (!p) return 'tab=none';
  const mode = p.classList.contains('shortcuts-modal') ? 'MODAL' : 'docked';
  return `tab=${p.id.replace('info-tab-panel-', '')}/${mode}/${Math.round(p.getBoundingClientRect().height)}px parent=${p.parentElement?.id || p.parentElement?.tagName}`;
};

// Read off a real phone through the debug console (three-finger tap, or
// ?debug=1 off localhost).
export const logViewport = (label) => {
  if (!enabled) return;
  const vv = window.visualViewport;
  const de = document.documentElement;
  console.log(
    `vp[${label}] app=${de.style.getPropertyValue('--app-height')} ` +
      `vv=${vv ? Math.round(vv.height) : 'n/a'}x${vv?.scale ?? '?'} inner=${window.innerHeight} ` +
      `scrollY=${Math.round(window.scrollY)} vvTop=${vv ? Math.round(vv.offsetTop) : '?'} ` +
      `scrollers=${scrollers()} ` +
      `doc=${de.scrollHeight}/${de.clientHeight} ` +
      `canvas=${box('canvasArea')} panel=${box('info-panel')} body=${box('info-panel-body')} ` +
      `tabs=${box('info-panel-tabs')} bar=${box('bottomBar')} ` +
      `insets=${insets()} kbd=${de.classList.contains('keyboard-open')} ${panelState()}`
  );
};
