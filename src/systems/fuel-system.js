// fuel-system.js
// Layer 1 "Fuel-cell pickup +
// banked-count persistence into L2" and feeds Layer 2's progression +
// system-repair pools.

export class FuelSystem {
  /**
   * @param {number} startingReserve - cells carried in from the previous
   *   level's banked count (0 for a fresh L1 run).
   */
  constructor(startingReserve = 0) {
    this.count = startingReserve;
  }

  pickup(amount = 1) {
    this.count += amount;
  }

  /**
   * @returns {boolean} true if the spend succeeded
   */
  spend(amount) {
    if (this.count < amount) return false;
    this.count -= amount;
    return true;
  }

  canAfford(amount) {
    return this.count >= amount;
  }

  /**
   * Cells not spent on progression doors are what's left to bank forward
   * (L1 -> L2 starting reserve) or hand to the L2 repair-allocation pool.
   */
  get banked() {
    return this.count;
  }
}
