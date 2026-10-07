// dissolve-animator.js
//
// Pure JS (no Three.js import) so it can be unit-tested, like
// emergency-lighting-controller.js. Animates a dissolve-glitch material's
// uProgress + uGlitch uniforms and keeps its uTime clock running.
//
//   reveal()  materialise: fully dissolved -> solid, glitch spikes then settles
//   vanish()  dematerialise: solid -> gone, glitch moves to `vanishGlitch`
//
// L3 Tier 2 pop-ins reuse the same material + animator: call reveal()/vanish()
// again at each scripted trigger. reveal() always restarts from fully
// dissolved, so re-triggering needs no reset.
//
// Interrupting: calling reveal() or vanish() while another animation is
// running replaces it, and the replaced animation's onComplete is dropped,
// never called. Only the latest call's onComplete fires. So don't rely on
// a vanish() callback to hide or remove a mesh if something might re-trigger
// it first: make the mesh visible at the start of reveal() instead, and treat
// the callback as "this particular animation finished".
//
// Reduce Flashing (Options): setReduceFlashing(true) holds glitch at 0, so
// no flicker, colour banding or vertex jitter. The dissolve itself still plays.
//
// update() allocates nothing (hard constraint: no allocation in the animation loop).

const TIME_WRAP = 3600; // wrap uTime every hour so float precision never degrades

// Ease in and out: slow start, fast middle, slow finish (same curve as GLSL smoothstep)
const smooth = (t) => t * t * (3 - 2 * t);

export class DissolveAnimator {
  /**
   * @param {object} uniforms - from createDissolveGlitchMaterial(); needs
   *   uProgress, uGlitch and uTime
   * @param {object} [options] - createDissolveEffect() fills these from the preset
   * @param {number} [options.settleGlitch] - glitch left after reveal(), so the
   *   AI stays visibly corrupted (0 = clean)
   * @param {number} [options.vanishGlitch] - glitch reached as vanish() ends
   *   (1 = breaks apart glitching, 0 = clean dissolve, e.g. debris)
   * @param {boolean} [options.reduceFlashing] - start with Reduce Flashing on
   */
  constructor(uniforms, { settleGlitch = 0.6, vanishGlitch = 1, reduceFlashing = false } = {}) {
    this.uniforms = uniforms;
    this.settleGlitch = settleGlitch;
    this.vanishGlitch = vanishGlitch;
    this.reduceFlashing = reduceFlashing;
    this._time = 0;
    this._active = false;
    this._t = 0;
    this._duration = 1;
    this._fromProgress = 0;
    this._toProgress = 0;
    this._glitch = uniforms.uGlitch.value; // the animated value, before Reduce Flashing
    this._fromGlitch = 0;
    this._toGlitch = 0;
    this._onComplete = null;
    this._writeGlitch();
  }

  get isPlaying() {
    return this._active;
  }

  /** Options > Reduce Flashing. Takes effect immediately. */
  setReduceFlashing(on) {
    this.reduceFlashing = Boolean(on);
    this._writeGlitch();
  }

  _writeGlitch() {
    this.uniforms.uGlitch.value = this.reduceFlashing ? 0 : this._glitch;
  }

  _start(toProgress, toGlitch, duration, onComplete) {
    this._fromProgress = this.uniforms.uProgress.value;
    this._fromGlitch = this._glitch;
    this._toProgress = toProgress;
    this._toGlitch = toGlitch;
    this._duration = Math.max(0.0001, duration);
    this._t = 0;
    this._onComplete = onComplete; // replaces (drops) any running animation's callback
    this._active = true;
  }

  /**
   * Materialise from fully dissolved to solid. Glitch starts at max and
   * settles to `settleGlitch`.
   * @param {number} [duration] - seconds
   * @param {(() => void) | null} [onComplete] - fired once, when fully solid,
   *   unless another reveal()/vanish() interrupts first
   */
  reveal(duration = 1.6, onComplete = null) {
    this.uniforms.uProgress.value = 1;
    this._glitch = 1;
    this._writeGlitch();
    this._start(0, this.settleGlitch, duration, onComplete);
  }

  /**
   * Dissolve away from wherever it currently is.
   * @param {number} [duration] - seconds
   * @param {(() => void) | null} [onComplete] - fired once, when fully gone,
   *   unless another reveal()/vanish() interrupts first
   * @param {number} [glitch] - glitch level to end on (defaults to `vanishGlitch`)
   */
  vanish(duration = 1.0, onComplete = null, glitch = this.vanishGlitch) {
    this._start(1, glitch, duration, onComplete);
  }

  /**
   * Advances the clock and any running reveal/vanish. Call every frame.
   * @param {number} delta - seconds since the last frame
   */
  update(delta) {
    this._time = (this._time + delta) % TIME_WRAP;
    this.uniforms.uTime.value = this._time;

    if (!this._active) return;

    this._t = Math.min(1, this._t + delta / this._duration);
    const e = smooth(this._t);
    this.uniforms.uProgress.value =
      this._fromProgress + (this._toProgress - this._fromProgress) * e;
    this._glitch = this._fromGlitch + (this._toGlitch - this._fromGlitch) * e;
    this._writeGlitch();

    if (this._t >= 1) {
      this._active = false;
      const cb = this._onComplete;
      this._onComplete = null; // cleared first, so a callback can start the next animation
      if (cb) cb();
    }
  }
}
