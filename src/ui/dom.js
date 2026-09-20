// src/ui/dom.js
//
// Tiny DOM helpers shared by the screens. Everything is built with createElement/textContent
// (never innerHTML with data), so copy and credits entries can never inject markup.

/**
 * el('button', { className: 'ui-button', text: 'Back', attrs: { type: 'button' },
 *                on: { click: handler } }, child1, child2)
 */
export function el(tag, options = {}, ...children) {
  const node = document.createElement(tag);
  const { className, text, attrs, on } = options;

  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  if (attrs) {
    for (const [name, value] of Object.entries(attrs)) {
      if (value === false || value === null || value === undefined) continue;
      node.setAttribute(name, value === true ? '' : String(value));
    }
  }
  if (on) {
    for (const [type, handler] of Object.entries(on)) node.addEventListener(type, handler);
  }
  for (const child of children.flat()) {
    if (child !== null && child !== undefined && child !== false) node.append(child);
  }
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Build an SVG element (with its attributes) from a plain description. */
export function svg(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  for (const child of children) node.append(child);
  return node;
}

// Corner bracket paths from the mockup, one per viewport corner.
const CORNERS = [
  ['is-tl', 'M2 20 V2 H20'],
  ['is-tr', 'M50 20 V2 H32'],
  ['is-bl', 'M2 32 V50 H20'],
  ['is-br', 'M50 32 V50 H32'],
];

/** The four accent-coloured corner brackets pinned to the viewport corners. */
export function cornerBrackets() {
  return el(
    'div',
    { className: 'ui-corners', attrs: { 'aria-hidden': 'true' } },
    CORNERS.map(([corner, path]) =>
      svg(
        'svg',
        { class: corner, width: 52, height: 52, viewBox: '0 0 52 52' },
        svg('path', { d: path, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 })
      )
    )
  );
}

/** Build a row of pips; `filled` of `total` are lit. Returns { element, setFilled }. */
export function createPips(total, className = '') {
  const pips = Array.from({ length: total }, () => el('div', { className: 'ui-pip' }));
  const element = el('div', { className: `ui-pips ${className}`.trim() }, pips);

  function setFilled(filled) {
    pips.forEach((pip, index) => pip.classList.toggle('is-on', index < filled));
  }

  return { element, setFilled };
}
