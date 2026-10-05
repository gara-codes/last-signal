// emergency-lighting-controller.js
//
// Pure JS (no Three.js import) so it can be unit-tested.
// One controller drives every emergency-lighting material in a level:
//   - smooths raw power changes so lights don't snap,
//   - handles flicker "spikes" (proximity tell, AI reveal) that decay on their own,
//   - handles a short power "dip" (L1->L2 door drawing current),
//   - mirrors the shader's flicker maths onto real THREE lights so the glowing
//     strip surfaces and the light they cast on the room flicker together.
//
// Nothing in update() allocates objects (hard constraint: no allocation in the
// animation loop).

const FLICKER_RATE = 12;   // must match FLICKER_RATE in emergency-lighting.frag.glsl
const STEP_WRAP = 997;     // must match STEP_WRAP in the shader
const TIME_WRAP = 3600;    // wrap uTime every hour so float precision never degrades

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;

// Same hash as the shader's rand(). Mirrors GLSL fract(sin(n) * 43758.5453123).
export function rand(n) {
  const x = Math.sin(n) * 43758.5453123;
  return x - Math.floor(x);
}

// JS copy of the shader's per-tick brightness, so THREE lights can match it.
// (GPU float precision can very occasionally disagree on a single tick — not visible.)
export function flickerAt(time, power, boost = 0) {
  const p = clamp01(power);
  const tick = Math.floor(time * FLICKER_RATE) % STEP_WRAP;
  const instability = clamp01((1 - p) + boost);
  const isLit = rand(tick) >= instability * 0.6 ? 1 : 0;
  const dropout = lerp(0.15, 0.55, rand(tick + 17));
  const flicker = lerp(dropout, 1, isLit);
  const hum = 0.96 + 0.04 * Math.sin(time * 7);
  return flicker * hum;
}

// Reads PowerAllocation's 0..1 power, whether it's exposed as a property or a
// method. Returns null if it isn't available yet, so the caller keeps the last value.
export function readPowerFraction(source) {
  if (!source) return null;
  const v = typeof source.powerFraction === 'function'
    ? source.powerFraction()
    : source.powerFraction;
  return Number.isFinite(v) ? clamp01(v) : null;
}

export class EmergencyLightingController {
  constructor({ initialPower = 1, powerSmoothing = 4, boostDecay = 2.5 } = {}) {
    this.targetPower = clamp01(initialPower);
    this.displayPower = this.targetPower; // smoothed value actually shown
    this.effectivePower = this.targetPower; // displayPower minus any active dip
    this.boost = 0;
    this.time = 0;
    this.powerSmoothing = powerSmoothing; // higher = snappier response
    this.boostDecay = boostDecay;         // boost lost per second

    this._dipDepth = 0;
    this._dipDuration = 0;
    this._dipRemaining = 0;

    this._uniformSets = [];
    this._lights = [];
  }

  // Register a material's uniforms ({ uPower, uTime, uFlickerBoost, ... }).
  addUniforms(uniforms) {
    this._uniformSets.push(uniforms);
    return this;
  }

  // Register a real THREE light (PointLight, SpotLight, RectAreaLight...) to
  // flicker in sync with the shader. Its current intensity becomes the base.
  addLight(light, baseIntensity = light.intensity) {
    this._lights.push({ light, baseIntensity });
    return this;
  }

  setPower(fraction) {
    this.targetPower = clamp01(fraction);
  }

  // Instant burst of instability that decays back to 0 by itself.
  spike(amount = 1) {
    this.boost = Math.max(this.boost, clamp01(amount));
  }

  // Short power sag that dips and recovers (sine-shaped) over `duration` seconds.
  dip(depth = 0.5, duration = 0.8) {
    this._dipDepth = clamp01(depth);
    this._dipDuration = Math.max(0.0001, duration);
    this._dipRemaining = this._dipDuration;
  }

  update(delta) {
    this.time = (this.time + delta) % TIME_WRAP;

    // Frame-rate independent exponential smoothing toward the target power.
    const k = 1 - Math.exp(-this.powerSmoothing * delta);
    this.displayPower += (this.targetPower - this.displayPower) * k;

    this.boost = Math.max(0, this.boost - this.boostDecay * delta);

    let dipAmount = 0;
    if (this._dipRemaining > 0) {
      this._dipRemaining = Math.max(0, this._dipRemaining - delta);
      const t = 1 - this._dipRemaining / this._dipDuration; // 0 -> 1
      dipAmount = this._dipDepth * Math.sin(Math.PI * t);    // 0 -> peak -> 0
    }
    this.effectivePower = clamp01(this.displayPower - dipAmount);

    for (let i = 0; i < this._uniformSets.length; i++) {
      const u = this._uniformSets[i];
      u.uPower.value = this.effectivePower;
      u.uTime.value = this.time;
      u.uFlickerBoost.value = this.boost;
    }

    if (this._lights.length > 0) {
      const f = flickerAt(this.time, this.effectivePower, this.boost);
      for (let i = 0; i < this._lights.length; i++) {
        const entry = this._lights[i];
        entry.light.intensity = entry.baseIntensity * f;
      }
    }
  }

  dispose() {
    this._uniformSets.length = 0;
    this._lights.length = 0;
  }
}
