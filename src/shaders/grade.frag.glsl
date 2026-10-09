// grade.frag.glsl
//
// The per-level "look" in one full-screen pass, run after bloom and before
// OutputPass (which applies tone mapping + sRGB). Colours here are linear HDR.
//
//   1. Warp       barrel distortion pulse (gravity snap-back / gravity flip)
//   2. Aberration R and B sampled at offset UVs, G centred (lens fringe)
//   3. Grade      tint, lift (colour pushed into the shadows), contrast, saturation
//   4. Stress     desaturation + a heartbeat-timed vignette squeeze (low oxygen, countdown)
//   5. Vignette   darkened edges
//   6. Grain      animated film noise
//
// Uniforms
//   tDiffuse      the frame so far (set by ShaderPass)
//   uTime         sec, wrapped in JS
//   uResolution   px, drives grain size
//   uTint         RGB multiplier: the level's colour cast
//   uLift         RGB added to dark areas only
//   uContrast     1 = unchanged, >1 = punchier
//   uSaturation   1 = unchanged, 0 = greyscale
//   uVignette     0..1 edge darkening strength
//   uGrain        0..~0.1 noise amplitude
//   uAberration   base RGB split (UV units at the screen edge)
//   uStress       0..1 sustained danger (desaturate, squeeze, heartbeat)
//   uPulse        0..1 short hit, decays in JS (alarm, damage, AI lock-on)
//   uWarp         0..1 distortion pulse, decays in JS

uniform sampler2D tDiffuse;
uniform float uTime;
uniform vec2  uResolution;
uniform vec3  uTint;
uniform vec3  uLift;
uniform float uContrast;
uniform float uSaturation;
uniform float uVignette;
uniform float uGrain;
uniform float uAberration;
uniform float uStress;
uniform float uPulse;
uniform float uWarp;

varying vec2 vUv;

// Same sin/fract hash as the emergency and dissolve shaders.
float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453123);
}

// Rec. 709 luma weights: how bright each channel looks to the eye.
const vec3  LUMA        = vec3(0.2126, 0.7152, 0.0722);
const float MID_GREY    = 0.18; // contrast pivots around this (linear mid grey)
const float HEART_RATE  = 1.6;  // beats per second when stress is high
const float GRAIN_RATE  = 24.0; // new grain pattern this many times a second

void main() {
  vec2 centre = vec2(0.5);
  vec2 fromCentre = vUv - centre;
  float r2 = dot(fromCentre, fromCentre); // squared distance from the middle

  // ---------- 1. Warp ----------
  // Push UVs outward more at the edges (r2) than the middle: a lens bulge.
  // The sin() makes it wobble while uWarp decays, so it reads as a shockwave.
  float wobble = sin(uTime * 30.0) * 0.5 + 0.5;
  vec2 uv = centre + fromCentre * (1.0 - uWarp * (0.08 + 0.04 * wobble) * r2 * 4.0);

  // ---------- 2. Chromatic aberration ----------
  // Real lenses bend red and blue slightly differently. Offsetting their UVs
  // along the line from the centre fakes that fringe, strongest at the edges.
  float split = uAberration + uPulse * 0.006 + uWarp * 0.01 + uStress * 0.002;
  vec2 offset = fromCentre * split * 2.0;
  vec3 color;
  color.r = texture2D(tDiffuse, uv + offset).r;
  color.g = texture2D(tDiffuse, uv).g;
  color.b = texture2D(tDiffuse, uv - offset).b;

  // ---------- 3. Grade ----------
  color *= uTint;
  float luma = dot(color, LUMA);
  // Lift: 1 in pure black, fading to 0 by mid grey, so only shadows get the cast.
  color += uLift * (1.0 - smoothstep(0.0, MID_GREY, luma));
  // Contrast around mid grey; max() stops negatives before saturation.
  color = max(MID_GREY + (color - MID_GREY) * uContrast, 0.0);
  luma = dot(color, LUMA);
  color = mix(vec3(luma), color, uSaturation);

  // ---------- 4. Stress ----------
  color = mix(color, vec3(luma), uStress * 0.55);
  // Heartbeat: pow() sharpens a smooth sine into a short thump each beat.
  float beat = pow(0.5 + 0.5 * sin(uTime * HEART_RATE * 6.2831853), 12.0);
  float squeeze = uStress * (0.35 + 0.25 * beat);

  // ---------- 5. Vignette ----------
  // 1 in the middle, falling off toward the corners. Stress pulls it inward.
  float vig = 1.0 - smoothstep(0.25 - squeeze * 0.2, 0.95 - squeeze * 0.35, r2 * 2.0);
  color *= mix(1.0, vig, clamp(uVignette + squeeze, 0.0, 1.0));
  color *= 1.0 + uPulse * 0.25; // a hit flashes slightly brighter

  // ---------- 6. Grain ----------
  // Fresh noise per pixel and per grain tick; centred on 0 so it doesn't brighten.
  float tick = floor(uTime * GRAIN_RATE);
  float n = rand(floor(vUv * uResolution) + tick) - 0.5;
  color += n * uGrain * (0.5 + luma); // more visible in the mids than in black

  gl_FragColor = vec4(color, 1.0);
}
