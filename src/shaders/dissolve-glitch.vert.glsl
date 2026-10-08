// dissolve-glitch.vert.glsl
// Two jobs:
//   1. Pass UVs, normal and view direction to the fragment shader.
//   2. The "vertex jitter" half of the glitch: horizontal slices of the mesh
//      get shoved sideways for one tick, then snap back.

uniform float uTime;
uniform float uGlitch;    // 0 = no jitter, 1 = max
uniform float uJitter;    // max sideways shift, in the mesh's local units
uniform float uBandScale; // slices per local unit of height

varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewDir;

// Same hash as emergency-lighting.frag.glsl.
float rand(float n) {
  return fract(sin(n) * 43758.5453123);
}

void main() {
  vUv = uv;
  vec3 pos = position;

  // Same stepped-clock trick as the emergency shader (15 ticks/sec here).
  float tick = mod(floor(uTime * 15.0), 997.0);

  // Which horizontal slice is this vertex in?
  float band = floor(pos.y * uBandScale);

  // Per slice, per tick: roll to see if this slice glitches.
  // At uGlitch 0 the threshold is 1.0 so nothing fires; at 1.0 ~35% of slices fire.
  float roll      = rand(band * 13.0 + tick);
  float glitching = step(1.0 - uGlitch * 0.35, roll);

  // How far, and which way (-1..1).
  float shift = (rand(band + tick * 7.0) - 0.5) * 2.0;
  pos.x += glitching * shift * uJitter * uGlitch;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  vNormalView = normalize(normalMatrix * normal);
  vViewDir    = normalize(-mvPosition.xyz); // camera sits at the origin in view space
  gl_Position = projectionMatrix * mvPosition;
}
