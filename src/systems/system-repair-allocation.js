// system-repair-allocation.js
// Layer 2 "Three-slot system-repair allocation" — tracks repaired/partial/
// untouched per system (Oxygen Scrubbers / Gravity Stabilizers / Comms Array)
// and exposes flags for L3 to read on level load.
// Cell spending correctly deducts from the shared fuel pool.

export const REPAIR_STATES = {
  UNTouched: 'untouched',
  PARTIAL: 'partial',
  REPAIRED: 'repaired',
};

// The three systems the player can allocate repair cells to
export const SYSTEM_IDS = ['oxygen-scrubbers', 'gravity-stabilizers', 'comms-array'];

// Cost to fully repair each system
const REPAIR_COST = 2; // fuel cells per full repair

export class SystemRepairAllocation {
  /**
   * @param {Object<string, string>} [initialStates] - optional pre-loaded
   *   states (e.g. from a saved game or level transition). Keys are system
   *   IDs, values are one of REPAIR_STATES.
   */
  constructor(initialStates = {}) {
    this.states = {};
    for (const id of SYSTEM_IDS) {
      this.states[id] = initialStates[id] || REPAIR_STATES.UNTouched;
    }
  }

  /**
   * Attempt to repair a system. Costs REPAIR_COST fuel cells.
   * - untouched → partial (if cost met)
   * - partial → repaired (if cost met)
   * - repaired → no-op (already done)
   *
   * @param {string} systemId - one of SYSTEM_IDS
   * @param {FuelSystem} fuelSystem - the shared fuel cell pool
   * @returns {{ success: boolean, newState: string }} result of the attempt
   */
  repair(systemId, fuelSystem) {
    if (!SYSTEM_IDS.includes(systemId)) {
      return { success: false, newState: this.states[systemId] };
    }

    const current = this.states[systemId];
    if (current === REPAIR_STATES.REPAIRED) {
      return { success: false, newState: REPAIR_STATES.REPAIRED };
    }

    if (!fuelSystem.canAfford(REPAIR_COST)) {
      return { success: false, newState: current };
    }

    fuelSystem.spend(REPAIR_COST);
    this.states[systemId] =
      current === REPAIR_STATES.UNTouched ? REPAIR_STATES.PARTIAL : REPAIR_STATES.REPAIRED;

    return { success: true, newState: this.states[systemId] };
  }

  /** @returns {string} the repair state for a given system */
  getState(systemId) {
    return this.states[systemId] || REPAIR_STATES.UNTouched;
  }

  /** @returns {boolean} true if the system is fully repaired */
  isRepaired(systemId) {
    return this.states[systemId] === REPAIR_STATES.REPAIRED;
  }

  /**
   * Exports a flags object for L3 to read on level load.
   * @returns {Object<string, string>} map of systemId → repair state
   */
  exportFlags() {
    return { ...this.states };
  }

  /** @returns {number} total cells spent on repairs so far */
  get totalSpent() {
    let spent = 0;
    for (const id of SYSTEM_IDS) {
      if (this.states[id] === REPAIR_STATES.PARTIAL) spent += REPAIR_COST;
      if (this.states[id] === REPAIR_STATES.REPAIRED) spent += REPAIR_COST * 2;
    }
    return spent;
  }
}
