// emergency-lighting.frag.glsl  (v2 — generalised colour + L2 support)
//
// Uniforms
//   uPower        0..1   Station power. 1 = pushed toward white, 0 = pure uColor.
//   uTime         sec    Running clock (wrapped in JS). Drives the stepped flicker.
//   uColor        RGB    This instance's danger colour: HAL red, L2 amber, L3 red.
//   uMaxWhite     0..1   How far toward white full power is allowed to go.
//                        1.0 = v1 behaviour (HAL's eye). L2 strips use ~0.25 so
//                        they still read as amber when the system is healthy.
//   uFlickerBoost 0..1   Extra instability on top of low power. Used for the
//                        L1->L2 door power dip, proximity tells, the AI reveal.
//                        0.0 = v1 behaviour.
//   uIntensity    >0     Brightness multiplier for the emissive surface.
//   uSteady       0..1   Options > Reduce Flashing. 1 holds the light steady:
//                        no dropouts and no hum. Colour and power still apply.

uniform float uPower;
uniform float uTime;
uniform vec3  uColor;
uniform float uMaxWhite;
uniform float uFlickerBoost;
uniform float uIntensity;
uniform float uSteady;

// Classic GLSL hash: take sin() of the input, scale it by a huge number and
// keep only the fractional part. It's deterministic (same input -> same
// output) but jumps wildly between neighbouring inputs, so it LOOKS random.
// The dissolve-glitch shader reuses this exact function.
float rand(float n) {
  return fract(sin(n) * 43758.5453123);
}

const float FLICKER_RATE = 12.0; // flicker decisions per second
const float STEP_WRAP    = 997.0; // keeps rand()'s input small so float precision holds

void main() {
  float power = clamp(uPower, 0.0, 1.0);

  // 1. Base colour: the danger colour drifts toward white as power rises.
  //    mix(a, b, t) = a*(1-t) + b*t.
  vec3 base = mix(uColor, vec3(1.0), power * uMaxWhite);

  // 2. Stepped time. floor() turns a smooth clock into whole-number "ticks",
  //    so the flicker changes ~12 times a second instead of every frame.
  float tick = mod(floor(uTime * FLICKER_RATE), STEP_WRAP);

  // 3. Instability: low power OR an external boost makes dropouts more likely.
  float instability = clamp((1.0 - power) + uFlickerBoost, 0.0, 1.0);

  // 4. Each tick rolls a random number. If it lands under the threshold,
  //    that tick is a "dropout" and the light dims.
  //    Even at zero power, 40% of ticks stay lit, so it never goes fully dead.
  float roll      = rand(tick);
  float threshold = instability * 0.6;
  float isLit     = step(threshold, roll);              // 1.0 if roll >= threshold
  float dropout   = mix(0.15, 0.55, rand(tick + 17.0)); // how dark a dropout gets
  float flicker   = mix(dropout, 1.0, isLit);

  // 5. A low continuous hum so the light never looks perfectly static.
  float hum = 0.96 + 0.04 * sin(uTime * 7.0);

  // 6. Reduce Flashing: blend both toward a constant 1.0, so the light holds
  //    steady. The project rule is that flashing is held, not just softened.
  flicker = mix(flicker, 1.0, uSteady);
  hum     = mix(hum, 1.0, uSteady);

  gl_FragColor = vec4(base * flicker * hum * uIntensity, 1.0);
}
