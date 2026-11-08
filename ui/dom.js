// Builds DOM with DOM calls, never by parsing a string, so text always stays text.
// Flock never assigns HTML strings (see AGENTS.md); authored how-to and help pages go
// through renderAuthoredContent instead.
const SVG_NS = 'http://www.w3.org/2000/svg';

function build(element, attrs, children) {
  for (const [name, value] of Object.entries(attrs ?? {})) {
    if (value != null && value !== false) element.setAttribute(name, value === true ? '' : String(value));
  }
  element.append(...children.flat(Infinity).filter((child) => child != null && child !== false));
  return element;
}

// h('button', { class: 'x', type: 'button' }, 'Label', otherNode)
export function h(tag, attrs, ...children) {
  return build(document.createElement(tag), attrs, children);
}

export function s(tag, attrs, ...children) {
  return build(document.createElementNS(SVG_NS, tag), attrs, children);
}

// An <svg> holding shapes given as [tag, attrs] pairs, e.g. [['path', { d: '…' }]].
export function svgIcon(attrs, shapes) {
  return s('svg', attrs, shapes.map(([tag, shapeAttrs]) => s(tag, shapeAttrs)));
}
