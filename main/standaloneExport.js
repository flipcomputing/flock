import { FLOCK_FORMAT_VERSION } from '../config.js';
import { saveBlob } from './saveFile.js';

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function flockAppBase() {
  return new URL(import.meta.env.BASE_URL || '/', window.location.href).href;
}

export function standaloneHtml({ project, name, runtimeBase = flockAppBase(), lang = 'en' }) {
  const origin = new URL(runtimeBase).origin;
  const json = JSON.stringify(project).replace(/</g, '\\u003c');
  const title = escapeHtml(name);
  const base = escapeHtml(runtimeBase);
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} — made with Flock XR</title>

    <meta
      http-equiv="Content-Security-Policy"
      content="
        default-src 'self';
        base-uri 'self';
        object-src 'none';
        script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' ${origin};
        style-src 'self' 'unsafe-inline' ${origin};
        img-src 'self' data: blob: ${origin};
        media-src 'self' data: blob: ${origin};
        font-src 'self' data: ${origin};
        connect-src 'self' https: ${origin};
        worker-src 'self' blob:;
        frame-src 'self'
      "
    />

    <link rel="icon" href="${base}images/favicon.ico" type="image/x-icon" />
    <link rel="icon" href="${base}images/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="${base}standalone.css" />
  </head>
  <body>
    <canvas id="renderCanvas" touch-action="none" tabindex="0" role="application" aria-label="${title}"></canvas>
    <noscript>This Flock XR project needs JavaScript to run.</noscript>

    <script id="flock" type="application/flock+json" data-flock-version="${FLOCK_FORMAT_VERSION}">
${json}
    </script>

    <script type="module">
      import '${base}flock.js';
    </script>
  </body>
</html>
`;
}

const escapeNonAscii = (s) => s.replace(/[^\p{ASCII}]/gu, (c) => `&#${c.codePointAt(0)};`);

export function embedCode(options) {
  const title = escapeHtml(`${options.name} — made with Flock XR`);
  return escapeNonAscii(`<iframe
  title="${title}"
  width="640"
  height="480"
  style="border: 0; max-width: 100%"
  allow="fullscreen; xr-spatial-tracking; accelerometer; gyroscope"
  srcdoc="${escapeHtml(standaloneHtml(options))}"
></iframe>`);
}

export const EMBED_APP_BASE = 'https://flipcomputing.github.io/flock/';

export function hostedEmbedCode({ projectUrl, comment, appBase = EMBED_APP_BASE }) {
  const src = `${appBase}?embed=true&amp;controls=playstop&amp;project=${escapeHtml(projectUrl)}`;
  return escapeNonAscii(`<!-- ${comment.replace(/--/g, '-')} -->
<iframe
  title="Made with Flock XR"
  width="640"
  height="480"
  style="border: 0; max-width: 100%"
  allow="fullscreen; xr-spatial-tracking; accelerometer; gyroscope"
  src="${src}"
></iframe>`);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function singleFileZip(fileName, text) {
  const name = new TextEncoder().encode(fileName);
  const data = new TextEncoder().encode(text);
  const crc = crc32(data);
  const header = (signature, size) => {
    const view = new DataView(new ArrayBuffer(size));
    view.setUint32(0, signature, true);
    return view;
  };

  const local = header(0x04034b50, 30);
  local.setUint16(4, 20, true);
  local.setUint16(6, 0x0800, true);
  local.setUint32(14, crc, true);
  local.setUint32(18, data.length, true);
  local.setUint32(22, data.length, true);
  local.setUint16(26, name.length, true);

  const central = header(0x02014b50, 46);
  central.setUint16(4, 20, true);
  central.setUint16(6, 20, true);
  central.setUint16(8, 0x0800, true);
  central.setUint32(16, crc, true);
  central.setUint32(20, data.length, true);
  central.setUint32(24, data.length, true);
  central.setUint16(28, name.length, true);

  const centralOffset = 30 + name.length + data.length;
  const end = header(0x06054b50, 22);
  end.setUint16(8, 1, true);
  end.setUint16(10, 1, true);
  end.setUint32(12, 46 + name.length, true);
  end.setUint32(16, centralOffset, true);

  return new Blob([local, name, data, central, name, end], { type: 'application/zip' });
}

export function downloadStandaloneHtml(options, { fileDescription = 'Web page' } = {}) {
  const blob = new Blob([standaloneHtml(options)], { type: 'text/html' });
  return saveBlob(blob, `${options.name}.html`, '.html', fileDescription);
}

export function downloadStandaloneZip(options, { fileDescription = 'ZIP file' } = {}) {
  const blob = singleFileZip('index.html', standaloneHtml(options));
  return saveBlob(blob, `${options.name}.zip`, '.zip', fileDescription);
}
