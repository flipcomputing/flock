import { h, s } from './dom.js';

// How-to and help pages are authored as HTML files (src/how-tos, docs/help). They are parsed
// into an inert document and only these elements and attributes are copied across, so the
// content can't add scripts, event handlers, styles or non-web links. A new tag or attribute
// in the content needs adding here; anything else is dropped with a console warning.
const HTML_ELEMENTS = {
  a: ['href'],
  'axis-x': [],
  'axis-y': [],
  'axis-z': [],
  'block-icon': ['name'],
  button: ['class', 'id', 'type'],
  code: [],
  h3: [],
  kbd: ['data-mod-key'],
  li: [],
  'link-to': ['target'],
  p: [],
  related: [],
  'related-howto': ['slug'],
  snippet: ['block-menu', 'highlight-input', 'selected', 'src'],
  span: ['class'],
  step: [],
  'step-title': [],
  strong: [],
  tip: [],
  topic: [],
  'topic-title': [],
  'trashcan-icon': ['full'],
  'ui-button': ['target'],
  ul: [],
  vocab: [],
  'workspace-comment': [],
};
const SVG_ELEMENTS = {
  svg: ['aria-hidden', 'class', 'viewBox'],
  path: ['d', 'fill'],
};
const WEB_URL = /^https?:\/\//i;

function copyNode(node, source) {
  if (node.nodeType === Node.TEXT_NODE) return node.data;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const isSvg = node.namespaceURI === 'http://www.w3.org/2000/svg';
  const elements = isSvg ? SVG_ELEMENTS : HTML_ELEMENTS;
  const allowed = Object.hasOwn(elements, node.localName) ? elements[node.localName] : null;
  if (!allowed) {
    console.warn(`Authored content: dropped <${node.localName}> in ${source}`);
    return null;
  }
  const attrs = {};
  for (const { name, value } of node.attributes) {
    if (isSvg && name === 'xmlns') continue;
    if (!allowed.includes(name) || (name === 'href' && !WEB_URL.test(value))) {
      console.warn(`Authored content: dropped ${name}="${value}" on <${node.localName}> in ${source}`);
      continue;
    }
    attrs[name] = value;
  }
  const children = [...node.childNodes].map((child) => copyNode(child, source));
  return (isSvg ? s : h)(node.localName, attrs, children);
}

// Replaces container's children with the allowed parts of an authored page.
export function renderAuthoredContent(container, html, source = 'authored content') {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  container.replaceChildren(...[...doc.body.childNodes].map((child) => copyNode(child, source)).filter((c) => c != null));
}
