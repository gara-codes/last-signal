// src/core/capped-delta.js
//
// Caps the frame delta so a tab-refocus pause (or coming back from a menu)
// can't produce one giant step — that would tunnel the player straight
// through wall blockers. Shared between L1 and L2 so the cap stays
// consistent as more levels land.

const MAX_DELTA = 0.05; // seconds — ~20fps floor before clamping

/**
 * @param {THREE.Clock} clock
 * @returns {number} clamped seconds since last frame
 */
export function getCappedDelta(clock) {
  return Math.min(clock.getDelta(), MAX_DELTA);
}
