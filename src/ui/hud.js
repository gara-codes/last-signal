// src/ui/hud.js
//
// Always-on HUD overlay: the Fuel Cells counter (Tier 1 item 1) and the interaction prompt.
// More panels (oxygen, health, AI-link chip, captions) land here as their values exist.
//
// Panels are edge-anchored (see .ui-anchor in ui.css): they hug the real screen edges at any
// window size or aspect ratio, and scale with the window like the menus do.
//
// The interaction prompt is fed by the level, not by the UI state machine:
//
//   import { setInteractPrompt } from '../ui/hud.js';
//   setInteractPrompt('Collect Fuel Cell');                       // normal
//   setInteractPrompt('Open Door', { denied: true, detail: '2 / 4 Fuel Cells' });
//   setInteractPrompt('Interact', { anchor: { x, y } });          // locked onto an object
//   setInteractPrompt(null);                                      // hide
//
// It is safe to call every frame (identical calls do no DOM work). The prompt lives inside the
// HUD element, so it hides with the menus, dims under the pause scrim and follows the HUD
// Opacity slider along with the rest of the HUD.

import './hud.css';
import { el, svg } from './dom.js';
import { resolvePrompt, HIDDEN_PROMPT } from './interact-prompt.js';

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

// Four corner brackets that frame the object the prompt belongs to (from the mockup).
function reticle() {
  const bracket = (d) =>
    svg('path', { d, 'stroke-width': 1.6, fill: 'none', stroke: 'currentColor' });
  return el(
    'div',
    { className: 'hud-prompt__reticle', attrs: { 'aria-hidden': 'true' } },
    svg(
      'svg',
      { width: 40, height: 40, viewBox: '0 0 40 40' },
      bracket('M2 12 V2 H12'),
      bracket('M28 2 H38 V12'),
      bracket('M2 28 V38 H12'),
      bracket('M38 28 V38 H28')
    ),
    el('div', { className: 'hud-prompt__stem' })
  );
}

function createInteractPrompt() {
  const labelEl = el('span', { className: 'hud-prompt__label ui-label' });
  const detailEl = el('span', { className: 'hud-prompt__detail ui-mono', attrs: { hidden: true } });
  const box = el(
    'div',
    { className: 'hud-prompt__box ui-panel ui-chamfer-row' },
    el('span', { className: 'hud-prompt__key ui-mono', text: 'E' }),
    labelEl,
    detailEl
  );
  const element = el(
    'div',
    { className: 'hud-prompt ui-anchor ui-anchor--b-mid', attrs: { hidden: true } },
    reticle(),
    box
  );

  let shownKey = HIDDEN_PROMPT.key;

  function show(view) {
    if (view.key === shownKey) return; // called every frame — only touch the DOM on change
    shownKey = view.key;

    element.hidden = !view.visible;
    if (!view.visible) return;

    labelEl.textContent = view.label;
    detailEl.textContent = view.detail;
    detailEl.hidden = view.detail === '';
    element.classList.toggle('is-denied', view.denied);

    // Anchored: brackets + stem, positioned on the object. Otherwise docked bottom-centre.
    const anchored = view.anchor !== null;
    element.classList.toggle('is-anchored', anchored);
    element.classList.toggle('ui-anchor--b-mid', !anchored);
    if (anchored) {
      element.style.setProperty('--px', `${view.anchor.x}px`);
      element.style.setProperty('--py', `${view.anchor.y}px`);
    } else {
      element.style.removeProperty('--px');
      element.style.removeProperty('--py');
    }
  }

  return { element, show };
}

// The prompt of the HUD created most recently. The level imports setInteractPrompt() directly
// (it has no handle on the UI), so this is the one piece of module-level state in the HUD.
let activePrompt = null;

/**
 * Show, update or hide the interaction prompt. See the header of this file for the options.
 * @param {string|null} label  action label ("Interact"), or null to hide the prompt
 * @param {import('./interact-prompt.js').PromptOptions} [options]
 */
export function setInteractPrompt(label, options) {
  activePrompt?.show(resolvePrompt(label, options));
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

  const prompt = createInteractPrompt();
  activePrompt = prompt;

  const element = el(
    'div',
    { className: 'ui-hud', attrs: { hidden: true, 'aria-label': 'Heads-up display' } },
    fuel,
    prompt.element
  );

  function setFuelCount(value) {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    count.textContent = String(n).padStart(2, '0');
  }

  setFuelCount(0);

  return {
    element,
    setFuelCount,
    setInteractPrompt,
    setVisible(visible) {
      element.hidden = !visible;
    },
    /** Pause dims the HUD (35% opacity, desaturated) under the scrim. */
    setDimmed(dimmed) {
      element.classList.toggle('is-dimmed', dimmed);
    },
  };
}
