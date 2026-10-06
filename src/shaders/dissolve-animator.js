// dissolve-animator.js
//
// Pure JS (no Three.js import) so it can be unit-tested, like
// emergency-lighting-controller.js. Animates a dissolve-glitch material's
// uProgress + uGlitch uniforms and keeps its uTime clock running.
//
//   reveal()  materialise: fully dissolved -> solid, glitch spikes then settles
//   vanish()  dematerialise: solid -> gone, glitch ramps up as it breaks apart
//
// L3 Tier 2 pop-ins reuse the same material + animator: call reveal()/vanish()
// again at each scripted trigger. reveal() always restarts from fully
// dissolved, so re-triggering needs no reset.
//
// update() allocates nothing (hard constraint: no allocation in the animation loop).

const TIME_WRAP = 3600; // wrap uTime every hour so float precision never degrades

// Ease in and out: slow start, fast middle, slow finish (same curve as GLSL smoothstep)
const smooth = (t) => t * t * (3 - 2 * t);

export class DissolveAnimator {
  /**
   * @param {object} uniforms - from createDissolveGlitchMaterial(); needs
   *   uProgress, uGlitch and uTime
   * @param {object} [options]
   * @param {number} [options.settleGlitch] - glitch level left after reveal(),
   *   so the AI stays visibly corrupted (0 = clean)
   */
  constructor(uniforms, { settleGlitch = 0.6 } = {}) {
    this.uniforms = uniforms;
    this.settleGlitch = settleGlitch;
    this._time = 0;
    this._active = false;
    this._t = 0;
    this._duration = 1;
    this._fromProgress = 0;
    this._toProgress = 0;
    this._fromGlitch = 0;
    this._toGlitch = 0;
    this._onComplete = null;
  }

  get isPlaying() {
    return this._active;
  }

  _start(toProgress, toGlitch, duration, onComplete) {
    this._fromProgress = this.uniforms.uProgress.value;
    this._fromGlitch = this.uniforms.uGlitch.value;
    this._toProgress = toProgress;
    this._toGlitch = toGlitch;
    this._duration = Math.max(0.0001, duration);
    this._t = 0;
    this._onComplete = onComplete;
    this._active = true;
  }

  /**
   * Materialise from fully dissolved to solid. Glitch starts at max and
   * settles to `settleGlitch`.
   * @param {number} [duration] - seconds
   * @param {(() => void) | null} [onComplete] - fired once, when fully solid
   */
  reveal(duration = 1.6, onComplete = null) {
    this.uniforms.uProgress.value = 1;
    this.uniforms.uGlitch.value = 1;
    this._start(0, this.settleGlitch, duration, onComplete);
  }

  /**
   * Dissolve away from wherever it currently is. Glitch ramps to max.
   * @param {number} [duration] - seconds
   * @param {(() => void) | null} [onComplete] - fired once, when fully gone
   */
  vanish(duration = 1.0, onComplete = null) {
    this._start(1, 1, duration, onComplete);
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
    this.uniforms.uGlitch.value = this._fromGlitch + (this._toGlitch - this._fromGlitch) * e;

    if (this._t >= 1) {
      this._active = false;
      const cb = this._onComplete;
      this._onComplete = null; // cleared first, so a callback can start the next animation
      if (cb) cb();
    }
  }
}
