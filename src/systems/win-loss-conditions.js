// win-loss-conditions.js
// Win/loss state logic (role doc: this file is mine, not Yannis's or
// Shannon's, to fill). Currently just the loss condition: the player dies
// when health reaches zero (OxygenSystem.isDead — drained by either oxygen
// depletion or takeDamage(), e.g. zero-g fall damage).
// Pure logic module — no Three.js dependency, no rendering. Callers decide
// the actual reaction (main.js freezes movement); a "you died" screen is
// HUD/menu territory, not built here — the returned state is meant to be
// easy for that to hook into later.

/**
 * @param {{isDead: boolean}} oxygenSystem - anything exposing isDead
 *   (duck-typed so this stays decoupled from the concrete OxygenSystem class)
 * @returns {{hasLost: boolean, reason: string|null}}
 */
export function checkLossState(oxygenSystem) {
  if (oxygenSystem?.isDead) {
    return { hasLost: true, reason: 'health' };
  }
  return { hasLost: false, reason: null };
}
