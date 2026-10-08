// command-center.js
// Layer 2 "Command-centre override" — the override-terminal fetch routed
// through fuel spending (unlock the terminal, then collect the override
// item it holds), plus the one checkpoint exception to the game's
// full-restart-on-death policy, placed right before the backtrack begins.
// Pure logic modules — no Three.js dependency, unit-test candidates.

export const TERMINAL_UNLOCK_COST = 1;

export class CommandCenterOverride {
  constructor() {
    this.terminalUnlocked = false;
    this.hasOverrideItem = false;
  }

  /**
   * Spends one fuel cell to unlock the override terminal. Idempotent once
   * unlocked.
   * @param {FuelSystem} fuelSystem
   * @returns {boolean} true if unlocked (already-unlocked also returns true)
   */
  unlockTerminal(fuelSystem) {
    if (this.terminalUnlocked) return true;
    if (fuelSystem.spend(TERMINAL_UNLOCK_COST)) {
      this.terminalUnlocked = true;
      return true;
    }
    return false;
  }

  /**
   * Grants the override item once the terminal is unlocked.
   * @returns {boolean} true if the item was (or already is) collected
   */
  collectOverride() {
    if (!this.terminalUnlocked) return false;
    this.hasOverrideItem = true;
    return true;
  }

  /**
   * The command-centre door refuses fuel cells entirely (design doc) —
   * only the collected override item can open it.
   * @returns {boolean}
   */
  tryOpenDoor() {
    return this.hasOverrideItem;
  }
}

export class Checkpoint {
  constructor() {
    this.snapshot = null;
  }

  /** @param {object} state - arbitrary player-state snapshot to restore later */
  save(state) {
    this.snapshot = { ...state };
  }

  hasSnapshot() {
    return this.snapshot !== null;
  }

  load() {
    return this.snapshot;
  }
}
