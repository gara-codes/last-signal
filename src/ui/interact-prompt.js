// src/ui/interact-prompt.js
//
// Pure logic for the "[E] Do Something" interaction prompt (no DOM, so it is unit-testable).
// hud.js turns the result into markup. The prompt has three looks in the mockup (HUD L1):
//
//   normal   "[E] Collect Fuel Cell"                  level accent on the key badge
//   denied   "[E] Open Door | 2 / 4 Fuel Cells"      muted, no accent, no red — reads as "not yet"
//   anchored either of the above, with corner brackets and a stem locked onto the object in
//            view (third person, so there is no screen-centre reticle)
//
// Callers describe what they want; this file decides what is shown.

/**
 * @typedef {object} PromptOptions
 * @property {boolean} [denied]  the action is currently unavailable (e.g. not enough fuel cells)
 * @property {string}  [detail]  short reason/requirement shown after the label ("2 / 4 Fuel Cells")
 * @property {{x:number,y:number}} [anchor]  screen position (CSS px from the top-left of the
 *   window) of the object the prompt belongs to. Omit it and the prompt sits docked near the
 *   bottom-centre of the screen instead.
 */

/**
 * @typedef {object} PromptView
 * @property {boolean} visible
 * @property {string}  label
 * @property {boolean} denied
 * @property {string}  detail
 * @property {{x:number,y:number}|null} anchor  rounded to whole pixels
 * @property {string}  key  changes whenever something visible changes, so callers that run
 *   every frame (the level does) can skip DOM writes on identical frames
 */

/** @type {PromptView} */
export const HIDDEN_PROMPT = Object.freeze({
  visible: false,
  label: '',
  denied: false,
  detail: '',
  anchor: null,
  key: 'hidden',
});

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * @param {string|null|undefined} label  action label ("Interact"); empty/null hides the prompt
 * @param {PromptOptions} [options]
 * @returns {PromptView}
 */
export function resolvePrompt(label, options = {}) {
  const text = cleanText(label);
  if (!text) return HIDDEN_PROMPT;

  const denied = options?.denied === true;
  const detail = cleanText(options?.detail);

  const rawAnchor = options?.anchor;
  const anchor =
    rawAnchor && Number.isFinite(rawAnchor.x) && Number.isFinite(rawAnchor.y)
      ? { x: Math.round(rawAnchor.x), y: Math.round(rawAnchor.y) }
      : null;

  const key = [
    text,
    denied ? 'denied' : 'ok',
    detail,
    anchor ? `${anchor.x},${anchor.y}` : '-',
  ].join('|');
  return { visible: true, label: text, denied, detail, anchor, key };
}
