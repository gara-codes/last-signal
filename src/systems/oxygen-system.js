// oxygen-system.js
// Layer 2 "Oxygen hazard system" — continuous drain (faster while running),
// top-up via fuse cell, rapid health drain at zero.
// Pure logic module — no Three.js dependency, candidate for unit tests.

// Tunable constants — not hardcoded in the logic below
const DEFAULT_MAX_OXYGEN = 100;
const DEFAULT_DRAIN_RATE = 2; // units/sec passive
const DEFAULT_RUN_DRAIN_MULTIPLIER = 2.5; // running multiplies drain
const DEFAULT_HEALTH_DRAIN_RATE = 10; // HP/sec when oxygen hits zero
const DEFAULT_FUSE_CELL_TOP_UP = 40; // oxygen restored per fuse cell

export class OxygenSystem {
  /**
   * @param {Object} [config]
   * @param {number} [config.maxOxygen] - ceiling for the oxygen bar
   * @param {number} [config.drainRate] - passive drain units/sec
   * @param {number} [config.runDrainMultiplier] - multiplier applied while running
   * @param {number} [config.healthDrainRate] - HP/sec lost when oxygen = 0
   * @param {number} [config.fuseCellTopUp] - oxygen restored per fuse cell
   */
  constructor({
    maxOxygen = DEFAULT_MAX_OXYGEN,
    drainRate = DEFAULT_DRAIN_RATE,
    runDrainMultiplier = DEFAULT_RUN_DRAIN_MULTIPLIER,
    healthDrainRate = DEFAULT_HEALTH_DRAIN_RATE,
    fuseCellTopUp = DEFAULT_FUSE_CELL_TOP_UP,
  } = {}) {
    this.maxOxygen = maxOxygen;
    this.drainRate = drainRate;
    this.runDrainMultiplier = runDrainMultiplier;
    this.healthDrainRate = healthDrainRate;
    this.fuseCellTopUp = fuseCellTopUp;

    this.oxygen = maxOxygen;
    this.health = 100;
    this.isDepleted = false; // true once oxygen hits 0 (health draining)
  }

  /**
   * Advances oxygen drain and health damage by `delta` seconds.
   * @param {number} delta - seconds since last frame
   * @param {boolean} isRunning - whether the player is currently running
   */
  update(delta, isRunning = false) {
    if (this.oxygen > 0) {
      const rate = isRunning ? this.drainRate * this.runDrainMultiplier : this.drainRate;
      this.oxygen = Math.max(0, this.oxygen - rate * delta);

      if (this.oxygen <= 0) {
        this.isDepleted = true;
      }
    }

    // Rapid health drain when oxygen is fully depleted
    if (this.isDepleted && this.health > 0) {
      this.health = Math.max(0, this.health - this.healthDrainRate * delta);
    }
  }

  /**
   * Consumes one fuse cell to restore oxygen.
   * @param {FuelSystem} fuelSystem - the shared fuel cell pool
   * @returns {boolean} true if a cell was consumed and oxygen was restored
   */
  topUp(fuelSystem) {
    if (!fuelSystem.canAfford(1)) return false;
    fuelSystem.spend(1);
    this.oxygen = Math.min(this.maxOxygen, this.oxygen + this.fuseCellTopUp);
    // If oxygen is restored above zero, the player is no longer depleted
    if (this.oxygen > 0) {
      this.isDepleted = false;
    }
    return true;
  }

  /** @returns {number} oxygen as a 0-1 fraction (for HUD) */
  get fraction() {
    return this.oxygen / this.maxOxygen;
  }

  /** @returns {boolean} true if the player is dead (health = 0) */
  get isDead() {
    return this.health <= 0;
  }
}
