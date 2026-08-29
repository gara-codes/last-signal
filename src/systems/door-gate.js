// door-gate.js
// Covers "L1 door gating" and "Progression-cost door gate (L2)".
// Deliberately generic so the same class serves both levels — the design doc
// is explicit both doors use "the same verb": spend fuel cells, non-optional,
// no choice layer attached.

export class DoorGate {
  /**
   * @param {string} id - unique door id, e.g. 'l1-blast-door-1', 'l2-progression-door'
   * @param {number} cost - fuel cells required to open
   */
  constructor(id, cost) {
    this.id = id;
    this.cost = cost;
    this.isOpen = false;
  }

  /**
   * @param {FuelSystem} fuelSystem
   * @returns {boolean} true if the door opened this call
   */
  tryOpen(fuelSystem) {
    if (this.isOpen) return true;
    if (fuelSystem.spend(this.cost)) {
      this.isOpen = true;
      return true;
    }
    return false;
  }
}