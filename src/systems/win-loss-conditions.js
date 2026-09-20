// win-loss-conditions.js
// Layer 3 "Countdown / escape-pod win condition" — core win state, layering
// an oxygen countdown if Scrubbers are left broken.
// Pure logic module — candidate for unit tests.

const DEFAULT_ESCAPE_TIME = 120; // seconds to reach the escape pod
const DEFAULT_BROKEN_SCRUBBER_PENALTY = 45; // seconds deducted if Scrubbers broken

export class WinLossConditions {
  /**
   * @param {Object} [config]
   * @param {number} [config.escapeTime] - base countdown in seconds
   * @param {boolean} [config.scrubbersRepaired] - whether Oxygen Scrubbers were repaired in L2
   * @param {number} [config.brokenScrubberPenalty] - seconds deducted if broken
   */
  constructor({
    escapeTime = DEFAULT_ESCAPE_TIME,
    scrubbersRepaired = false,
    brokenScrubberPenalty = DEFAULT_BROKEN_SCRUBBER_PENALTY,
  } = {}) {
    this.baseEscapeTime = escapeTime;
    this.scrubbersRepaired = scrubbersRepaired;
    this.brokenScrubberPenalty = brokenScrubberPenalty;

    // Effective countdown: if scrubbers are broken, the player has less time
    // because the atmosphere is degrading faster
    this.countdown = scrubbersRepaired
      ? escapeTime
      : escapeTime - brokenScrubberPenalty;

    this.hasWon = false;
    this.hasLost = false;
    this.lossReason = null; // 'timeout' | 'oxygen' | null
  }

  /**
   * Called when the player reaches the escape pod.
   * @returns {boolean} true if the player wins (countdown > 0)
   */
  reachEscapePod() {
    if (this.hasLost) return false;
    if (this.countdown > 0) {
      this.hasWon = true;
      return true;
    }
    return false;
  }

  /**
   * Advances the countdown timer.
   * @param {number} delta - seconds since last frame
   */
  update(delta) {
    if (this.hasWon || this.hasLost) return;

    this.countdown -= delta;
    if (this.countdown <= 0) {
      this.countdown = 0;
      this.hasLost = true;
      this.lossReason = 'timeout';
    }
  }

  /**
   * Called when the oxygen system kills the player.
   */
  onOxygenDeath() {
    if (this.hasWon) return;
    this.hasLost = true;
    this.lossReason = 'oxygen';
  }

  /** @returns {number} remaining countdown in seconds (clamped to 0) */
  get remainingTime() {
    return Math.max(0, this.countdown);
  }

  /** @returns {boolean} true if the game is still in progress */
  get isActive() {
    return !this.hasWon && !this.hasLost;
  }

  /**
   * Creates an instance from L2 repair flags (the persisted state object).
   * @param {Object} repairFlags - from SystemRepairAllocation.exportFlags()
   * @param {Object} [config] - additional overrides
   */
  static fromRepairFlags(repairFlags, config = {}) {
    return new WinLossConditions({
      ...config,
      scrubbersRepaired: repairFlags['oxygen-scrubbers'] === 'repaired',
    });
  }
}
