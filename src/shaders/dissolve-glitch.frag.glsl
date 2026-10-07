// dissolve-glitch.frag.glsl
//
// One shader, two uses:
//   AI hologram -> uProgress animates 1 -> 0 to materialise, high uGlitch, uHologram = 1
//   L3 debris   -> uProgress animates 0 -> 1 to fall apart, uGlitch ~0, uHologram = 0
//
// Uniforms
//   uProgress   0..1  0 = solid, 1 = completely gone (the dissolve threshold)
//   uGlitch     0..1  colour banding + whole-object flicker strength
//   uTime       sec   running clock (wrapped in JS)
//   uBaseColor  RGB   colour away from the dissolve edge
//   uEdgeColor  RGB   glow colour right at the dissolving boundary
//   uEdgeWidth  0..1  how thick the glowing edge is (in noise units)
//   uNoiseScale >0    noise cells across the UVs (8.0 = blob size)
//   uHologram   0..1  0 = solid object, 1 = see-through hologram look
//   uOpacity    0..1  overall fade

uniform float uProgress;
uniform float uGlitch;
uniform float uTime;
uniform vec3  uBaseColor;
uniform vec3  uEdgeColor;
uniform float uEdgeWidth;
uniform float uNoiseScale;
uniform float uHologram;
uniform float uOpacity;

varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewDir;

// 2D version of the emergency shader's rand(): squash the 2D point to one
// number with dot(), then the same sin/fract hash. Deterministic, but jumps
// wildly between neighbouring inputs, so it looks random.
float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453123);
}

// Value noise: a random value at each grid corner, smoothly blended between
// corners. Gives soft blobs instead of per-pixel static, so the mesh gets
// eaten in organic chunks rather than fading as a flat sheet.
float valueNoise(vec2 p) {
  vec2 i = floor(p); // which grid cell
  vec2 f = fract(p); // where inside the cell (0..1)
  float a = rand(i);
  float b = rand(i + vec2(1.0, 0.0));
  float c = rand(i + vec2(0.0, 1.0));
  float d = rand(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f); // smoothstep curve, hides grid seams
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

const float GLITCH_RATE = 12.0; // glitch decisions per second, same as the emergency flicker
const float STEP_WRAP   = 997.0; // keeps rand()'s input small so float precision holds
const vec3  GLITCH_TINT = vec3(0.3, 0.9, 1.0); // cyan
// Edge boost: above 1 so the edge outshines the body, below 2 so it
// doesn't clip to white and lose its colour.
const float EDGE_BOOST  = 1.5;

void main() {
  // ---------- Dissolve ----------
  // Two layers of noise (big blobs + finer detail) for a ragged edge.
  float n = valueNoise(vUv * uNoiseScale) * 0.65
          + valueNoise(vUv * uNoiseScale * 2.7) * 0.35;

  // Every pixel has its own threshold n. Once progress passes it, the pixel
  // is thrown away entirely: not drawn, not even transparent.
  if (n < uProgress) discard;

  // 1.0 right at the boundary, fading to 0.0 by uEdgeWidth above it.
  float edge = 1.0 - smoothstep(0.0, uEdgeWidth, n - uProgress);
  edge *= step(0.001, uProgress); // no glow when fully solid

  // ---------- Glitch: colour banding ----------
  // Stepped clock: floor() turns smooth time into whole-number ticks.
  float tick    = mod(floor(uTime * GLITCH_RATE), STEP_WRAP);
  float bandId  = floor(vUv.y * 24.0);
  float bandHit = step(1.0 - uGlitch * 0.4, rand(vec2(bandId, tick)));

  vec3 color = uBaseColor;
  // In a glitched band, push halfway toward cyan. Red + cyan is the classic
  // chromatic-aberration fringe, and at 50% the AI's red still dominates.
  color = mix(color, GLITCH_TINT, bandHit * 0.5);

  // ---------- Hologram extras ----------
  // Fresnel: surfaces seen edge-on glow more (normal perpendicular to view).
  float fresnel = pow(1.0 - abs(dot(normalize(vNormalView), normalize(vViewDir))), 2.5);
  // Screen-space scanlines rolling upward.
  float scan = 0.75 + 0.25 * sin(gl_FragCoord.y * 1.2 + uTime * 8.0);
  color *= mix(1.0, scan, uHologram);
  color += uBaseColor * fresnel * 1.5 * uHologram;

  // Whole-object flicker, stronger as glitch rises.
  float flick = mix(1.0, 0.55 + 0.45 * rand(vec2(tick, 4.2)), uGlitch);
  color *= flick;

  // Edge glow applied last so it stays bright.
  color = mix(color, uEdgeColor * EDGE_BOOST, edge);

  // Solid: alpha 1. Hologram: mostly see-through in the middle, opaque at the rim.
  float alpha = mix(1.0, (0.35 + 0.65 * fresnel) * flick, uHologram) * uOpacity;
  alpha = max(alpha, edge * uOpacity); // the burning edge always shows

  gl_FragColor = vec4(color, alpha);
}
