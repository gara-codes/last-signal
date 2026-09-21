// hud.js — minimal HUD layer (screen-space DOM, not 3D).
// Alpha scope: just the interact prompt shown when the player is in reach
// of something usable. It lives in DOM so it stays upright and readable no
// matter how far around the ring the player walks (the camera rolls with
// them); fuel and oxygen readouts join here in later layers.

let promptEl = null;

/**
 * Lazily creates the shared prompt element on first use.
 * @returns {HTMLDivElement}
 */
function ensurePrompt() {
  if (!promptEl) {
    promptEl = document.createElement('div');
    promptEl.style.position = 'fixed';
    promptEl.style.bottom = '16%';
    promptEl.style.left = '50%';
    promptEl.style.transform = 'translateX(-50%)';
    promptEl.style.padding = '8px 18px';
    promptEl.style.background = 'rgba(8, 12, 16, 0.78)';
    promptEl.style.color = '#cfe3ef';
    promptEl.style.font = '600 14px/1 system-ui, sans-serif';
    promptEl.style.letterSpacing = '0.12em';
    promptEl.style.textTransform = 'uppercase';
    promptEl.style.border = '1px solid rgba(120, 180, 210, 0.4)';
    promptEl.style.borderRadius = '6px';
    promptEl.style.pointerEvents = 'none'; // Never block clicks on the canvas
    promptEl.style.display = 'none';
    document.body.appendChild(promptEl);
  }
  return promptEl;
}

/**
 * Shows, updates, or hides the interact prompt.
 * @param {string|null} label - action label to place next to the key
 *   (e.g. 'Interact'), or null to hide the prompt
 */
export function setInteractPrompt(label) {
  const el = ensurePrompt();
  if (label) {
    el.textContent = `[ E ] ${label}`;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}
