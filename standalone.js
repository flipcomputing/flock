import { flock } from './flock.js';
import { isTrustedProjectUrl } from './config';
import {
  flockAssetBase,
  flockConfigUrl,
  flockRuntimeBase,
  flockRuntimeUrl,
} from './runtime/urls.js';

function injectStandaloneChrome() {
  const doc = flock.document;
  const body = doc.body;
  if (!body) return;

  const assetBase = flockAssetBase();
  const brandImg = (name, className, alt) => {
    const el = doc.createElement('img');
    el.src = new URL('images/' + name, assetBase).href;
    if (className) el.className = className;
    el.alt = alt;
    return el;
  };

  if (!doc.getElementById('loadingScreen')) {
    const screen = doc.createElement('div');
    screen.id = 'loadingScreen';
    screen.className = 'flock-loading';
    screen.setAttribute('role', 'status');
    screen.setAttribute('aria-label', 'Loading');

    const content = doc.createElement('div');
    content.className = 'flock-loading-content';

    const bird = brandImg('flock-bird-mascot.svg', 'flock-loading-bird', '');
    bird.width = 120;
    bird.height = 120;

    const spinner = doc.createElement('div');
    spinner.className = 'flock-loading-spinner';
    spinner.setAttribute('aria-hidden', 'true');

    const text = doc.createElement('p');
    text.className = 'flock-loading-text';
    text.textContent = 'Loading…';

    content.append(
      bird,
      brandImg('inline-flock-xr.svg', 'flock-loading-logo', 'Flock XR'),
      spinner,
      text
    );
    screen.appendChild(content);
    body.appendChild(screen);
  }
  body.setAttribute('aria-busy', 'true');

  if (!doc.querySelector('.flock-credit')) {
    const footer = doc.createElement('footer');
    footer.className = 'flock-credit';

    const made = doc.createElement('a');
    made.href = 'https://flockxr.com/';
    made.target = '_blank';
    made.rel = 'noopener noreferrer';
    const madeText = doc.createElement('span');
    madeText.textContent = 'Made with Flock XR';
    made.append(brandImg('inline-flock-xr.svg', '', 'Flock XR'), madeText);

    const open = doc.createElement('a');
    open.className = 'flock-credit-open';
    open.setAttribute('data-flock-open-in-editor', '');
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.textContent = 'Open in Flock';
    open.href = flockRuntimeBase();

    footer.append(made, open);
    body.appendChild(footer);
  }
}

function hideStandaloneLoadingScreen() {
  flock.document.body?.setAttribute('aria-busy', 'false');
  if (typeof window.hideLoadingScreen === 'function') {
    window.hideLoadingScreen();
    return;
  }
  const el = flock.document.getElementById('loadingScreen');
  if (!el) return;
  el.classList.add('fade-out');
  setTimeout(() => el.remove(), 600);
}

const MAX_EDITOR_LINK_LENGTH = 1500000;

async function compressedProjectFragment(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function isTrustedProjectPage(editorOrigin) {
  const here = new URL(window.location.href);
  if (here.protocol !== 'http:' && here.protocol !== 'https:') return false;
  if (!/(\.html?|\/)$/.test(here.pathname.toLowerCase())) return false;
  return isTrustedProjectUrl(here, editorOrigin);
}

function wireOpenInEditorLink() {
  const link = flock.document.querySelector('[data-flock-open-in-editor]');
  if (!link) return;
  const cfg = (typeof window !== 'undefined' && window.FLOCK_CONFIG) || {};
  const editor = new URL(flockConfigUrl(cfg.editorUrl) || flockRuntimeBase());
  link.hidden = true;
  const showPageAddressLink = () => {
    const here = window.location;
    if (here.protocol !== 'http:' && here.protocol !== 'https:') return;
    const pageLink = new URL(editor);
    pageLink.searchParams.set('project', here.href);
    pageLink.hash = '';
    link.href = pageLink.href;
    link.hidden = false;
  };

  const scriptElement = flock.document.getElementById('flock');
  const type = (scriptElement?.type || '').toLowerCase();
  const isProjectJson = type === 'application/flock+json' || type === 'application/vnd.flock+json';
  if (!/^https?:$/.test(editor.protocol)) return;
  if (!isProjectJson || isTrustedProjectPage(editor.origin)) {
    showPageAddressLink();
    return;
  }

  compressedProjectFragment(scriptElement.textContent.trim())
    .then((data) => {
      editor.hash = `project=${data}`;
      if (editor.href.length > MAX_EDITOR_LINK_LENGTH) {
        showPageAddressLink();
        return;
      }
      link.href = editor.href;
      link.hidden = false;
    })
    .catch((error) => {
      console.warn('Could not build Open in Flock link:', error);
      showPageAddressLink();
    });
}

const MAX_STANDALONE_PROJECT_LENGTH = 4 * 1024 * 1024;

async function resolveStandaloneProjectCode(scriptElement) {
  const source = scriptElement.textContent;
  if (source.length > MAX_STANDALONE_PROJECT_LENGTH) {
    throw new Error('Embedded project is too large');
  }
  const type = (scriptElement.type || '').toLowerCase();
  if (type === 'application/flock+json' || type === 'application/vnd.flock+json') {
    const { compileFlockProject } = await import('./flockCompiler.js');
    return compileFlockProject(JSON.parse(source));
  }
  return source;
}

export function initializeFlock() {
  const scriptElement = flock.document.getElementById('flock');
  if (!scriptElement) return;
  injectStandaloneChrome();
  wireOpenInEditorLink();
  flock
    .initialize()
    .then(async () => {
      const assetBase = flockAssetBase();
      flock.modelPath = new URL('models/', assetBase).href;
      flock.soundPath = new URL('sounds/', assetBase).href;
      flock.imagePath = new URL('images/', assetBase).href;
      flock.texturePath = new URL('textures/', assetBase).href;
      flock.animationPath = new URL('animations/', assetBase).href;
      flock.BABYLON.DracoCompression.Configuration = {
        decoder: {
          wasmUrl: flockRuntimeUrl('draco/draco_wasm_wrapper_gltf.js'),
          wasmBinaryUrl: flockRuntimeUrl('draco/draco_decoder_gltf.wasm'),
          fallbackUrl: flockRuntimeUrl('draco/draco_decoder_gltf.js'),
        },
      };

      const code = await resolveStandaloneProjectCode(scriptElement);
      await flock.runCode(code);
    })
    .catch((error) => {
      console.error('Error initializing flock:', error);
    })
    .finally(() => {
      hideStandaloneLoadingScreen();
    });
}

function startStandalone() {
  const scriptElement = document.getElementById('flock');
  if (scriptElement) {
    console.log('Standalone Flock 🐦');
    initializeFlock();
    setTimeout(hideStandaloneLoadingScreen, 15000);
  }
}

export function startStandaloneWhenReady() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startStandalone);
  } else {
    startStandalone();
  }
}
