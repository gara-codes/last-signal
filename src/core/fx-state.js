// fx-state.js
//
// Pure JS (no Three.js) so it can be unit-tested. Holds the gameplay-driven
// screen-effect state that other systems poke, and turns it into the grade
// shader's uStress / uPulse / uWarp values each frame:
//
//   pulse(amount)    short hit that decays: alarm, damage, AI lock-on
//   warp(duration)   distortion that decays over `duration`: gravity snap-back/flip
//   setStress(v)     sustained 0..1 danger: low oxygen, countdown running out
//
// Reduce Flashing (Options screen) follows the project rule: flashing is held
// steady. Pulses (brightness hits) are held at 0. Warps aren't a flash (they
// bend the image), so they stay as a cue, scaled down.
//
// update() allocates nothing (hard constraint: no allocation in the animation loop).

const PULSE_DECAY = 2.5; // pulse falls by this much per second
const STRESS_EASE = 3; // how fast displayed stress chases its target (per second)
const TIME_WRAP = 3600; // wrap the clock every hour so float precision holds

// Reduce Flashing multipliers
const CALM_PULSE = 0; // brightness flash: held steady
const CALM_WARP = 0.35; // distortion: kept as a gentler cue

const clamp01 = (x) => Math.min(1, Math.max(0, x));

export class FxState {
  constructor() {
    this.time = 0;
    this.reduceFlashing = false;
    this._pulse = 0;
    this._warp = 0;
    this._warpDuration = 0;
    this._warpLeft = 0;
    this._stressTarget = 0;
    this._stress = 0;
  }

  /** Short hit. Overlapping hits keep the strongest instead of stacking past 1. */
  pulse(amount = 1) {
    this._pulse = Math.max(this._pulse, clamp01(amount));
  }

  /**
   * Distortion that starts at full strength and eases out over `duration`.
   * A new warp restarts the timer.
   */
  warp(duration = 0.8) {
    this._warpDuration = Math.max(0.0001, duration);
    this._warpLeft = this._warpDuration;
  }

  /** Sustained danger level, 0..1. The displayed value eases toward it. */
  setStress(value) {
    if (!Number.isFinite(value)) return; // NaN would freeze the grade
    this._stressTarget = clamp01(value);
  }

  setReduceFlashing(on) {
    this.reduceFlashing = Boolean(on);
  }

  /**
   * Advance and write the values into `uniforms` (uStress, uPulse, uWarp, uTime).
   * @param {number} delta - seconds since the last frame
   * @param {object} uniforms - the grade pass uniforms
   */
  update(delta, uniforms) {
    this.time = (this.time + delta) % TIME_WRAP;

    this._pulse = Math.max(0, this._pulse - PULSE_DECAY * delta);

    this._warpLeft = Math.max(0, this._warpLeft - delta);
    const t = this._warpDuration > 0 ? this._warpLeft / this._warpDuration : 0;
    this._warp = t * t; // ease out: strong start, gentle tail

    // Exponential ease: frame-rate independent chase toward the target
    const k = 1 - Math.exp(-STRESS_EASE * delta);
    this._stress += (this._stressTarget - this._stress) * k;

    const calm = this.reduceFlashing;
    uniforms.uTime.value = this.time;
    uniforms.uStress.value = this._stress;
    uniforms.uPulse.value = this._pulse * (calm ? CALM_PULSE : 1);
    uniforms.uWarp.value = this._warp * (calm ? CALM_WARP : 1);
  }
}
