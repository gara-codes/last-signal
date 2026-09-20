// src/ui/hud.js
//
// Always-on HUD overlay. For now it holds one panel — the Fuel Cells counter (Tier 1 item 1) —
// because that is the element the pause overlay dims in the mockup. More panels (oxygen, health,
// AI-link chip, prompts) land here as their values exist.
//
// Panels are edge-anchored (see .ui-anchor in ui.css): they hug the real screen edges at any
// window size or aspect ratio, and scale with the window like the menus do.

import './hud.css';
import { el, svg } from './dom.js';

function fuelIcon() {
  return svg(
    'svg',
    {
      class: 'hud-fuel__icon',
      width: 22,
      height: 22,
      viewBox: '0 0 20 20',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.6,
      'aria-hidden': 'true',
    },
    svg('rect', { x: 7, y: 1.5, width: 6, height: 3 }),
    svg('rect', { x: 5, y: 4.5, width: 10, height: 13.5, rx: 1 }),
    svg('line', { x1: 5, y1: 9.5, x2: 15, y2: 9.5, 'stroke-opacity': 0.5 })
  );
}

export function createHud() {
  const count = el('div', { className: 'hud-fuel__count' });

  const fuel = el(
    'div',
    { className: 'hud-fuel ui-anchor ui-anchor--tl ui-panel ui-chamfer-panel' },
    fuelIcon(),
    el(
      'div',
      { className: 'hud-fuel__body' },
      el('div', { className: 'hud-fuel__label ui-label', text: 'Fuel Cells' }),
      count
    )
  );

  const element = el(
    'div',
    { className: 'ui-hud', attrs: { hidden: true, 'aria-label': 'Heads-up display' } },
    fuel
  );

  function setFuelCount(value) {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    count.textContent = String(n).padStart(2, '0');
  }

  setFuelCount(0);

  return {
    element,
    setFuelCount,
    setVisible(visible) {
      element.hidden = !visible;
    },
    /** Pause dims the HUD (35% opacity, desaturated) under the scrim. */
    setDimmed(dimmed) {
      element.classList.toggle('is-dimmed', dimmed);
    },
  };
}
