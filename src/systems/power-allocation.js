// power-allocation.js
// Layer 2 power distribution — tracks how much power is allocated to each
// system (life support, gravity, comms) from the available reactor output.
// Powers the emergency shader's uPower uniform (0 = no power → full colour,
// 1 = full power → white) and feeds the oxygen drain rate.

export const POWER_SYSTEMS = ['life-support', 'gravity', 'comms'];

const DEFAULT_TOTAL_POWER = 100;

export class PowerAllocation {
  /**
   * @param {number} [totalPower] - maximum power units available
   */
  constructor(totalPower = DEFAULT_TOTAL_POWER) {
    this.totalPower = totalPower;
    this.allocated = {};
    for (const id of POWER_SYSTEMS) {
      this.allocated[id] = 0;
    }
  }

  /**
   * Set the power allocation for a system. Clamped so total never exceeds
   * totalPower.
   * @param {string} systemId
   * @param {number} value - power units to allocate
   */
  setAllocation(systemId, value) {
    if (!POWER_SYSTEMS.includes(systemId)) return;
    this.allocated[systemId] = Math.max(0, value);
  }

  /**
   * Validate that total allocations don't exceed totalPower. If they do,
   * proportionally scale down the largest allocation.
   * @returns {boolean} true if allocations are within budget
   */
  validate() {
    const total = this.getTotalAllocated();
    if (total <= this.totalPower) return true;

    // Find the largest allocation and reduce it to fit
    let largest = POWER_SYSTEMS[0];
    for (const id of POWER_SYSTEMS) {
      if (this.allocated[id] > this.allocated[largest]) largest = id;
    }
    const overshoot = total - this.totalPower;
    this.allocated[largest] = Math.max(0, this.allocated[largest] - overshoot);
    return false;
  }

  /** @returns {number} total power currently allocated */
  getTotalAllocated() {
    let total = 0;
    for (const id of POWER_SYSTEMS) {
      total += this.allocated[id];
    }
    return total;
  }

  /** @returns {number} 0-1 fraction of total power in use */
  get powerFraction() {
    if (this.totalPower <= 0) return 0;
    return Math.min(1, this.getTotalAllocated() / this.totalPower);
  }

  /** @returns {number} 0-1 fraction for a specific system (for shader/HUD) */
  getSystemFraction(systemId) {
    // Each system's "full" share is totalPower / systemCount
    const fairShare = this.totalPower / POWER_SYSTEMS.length;
    if (fairShare <= 0) return 0;
    return Math.min(1, (this.allocated[systemId] || 0) / fairShare);
  }

  /** @returns {number} unallocated power remaining */
  get remaining() {
    return Math.max(0, this.totalPower - this.getTotalAllocated());
  }
}
