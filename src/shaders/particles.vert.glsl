// particles.vert.glsl
//
// Every particle's position is worked out from time alone. Nothing is stored
// or simulated on the CPU, so thousands of particles cost one draw call and
// no per-frame JS.
//
// Two modes:
//   uMode 0 (emitter): each particle loops through a life: spawn -> fly -> fade.
//                      Steam, sparks, embers.
//   uMode 1 (volume):  particles drift through a box and wrap at its edges.
//                      Dust motes hanging in the air.
//
// Attributes
//   position  spawn offset (emitter) or start point inside the box (volume)
//   aSeed     4 random numbers in 0..1, fixed per particle
//
// Uniforms
//   uTime        sec, wrapped in JS
//   uMode        0 emitter, 1 volume
//   uLife        sec a particle is visible (emitter)
//   uPeriod      sec between respawns; > uLife leaves gaps (spark bursts)
//   uBurst       0..1 how tightly spawn times cluster (1 = all at once)
//   uVelocity    base velocity, units/sec
//   uSpread      random extra velocity per axis
//   uGravity     acceleration, units/sec^2
//   uTurbulence  sideways wobble amplitude
//   uDrift       volume drift, units/sec
//   uBox         volume half-extents
//   uSize        point size at spawn (world units)
//   uSizeEnd     size multiplier at end of life
//   uScale       px per world unit at distance 1 (screen height / (2 tan(fov/2)))

uniform float uTime;
uniform float uMode;
uniform float uLife;
uniform float uPeriod;
uniform float uBurst;
uniform vec3  uVelocity;
uniform vec3  uSpread;
uniform vec3  uGravity;
uniform float uTurbulence;
uniform vec3  uDrift;
uniform vec3  uBox;
uniform float uSize;
uniform float uSizeEnd;
uniform float uScale;

attribute vec4 aSeed;

varying float vAge;   // 0..1 through the particle's life
varying float vAlpha; // fade in/out and twinkle
varying float vSeed;

const float TAU = 6.2831853;

void main() {
  vec3 pos;
  float age;
  float alpha;

  if (uMode < 0.5) {
    // ---------- Emitter ----------
    // Each particle starts at its own point in the cycle (seed.w). uBurst
    // squeezes those start points together so particles leave in groups.
    float phase = aSeed.w * (1.0 - uBurst);
    float t = fract(uTime / uPeriod + phase) * uPeriod; // seconds since spawn
    age = clamp(t / uLife, 0.0, 1.0);
    float alive = step(t, uLife); // 0 during the gap between bursts

    // Per-particle velocity: base + a random -1..1 share of the spread
    vec3 vel = uVelocity + (aSeed.xyz * 2.0 - 1.0) * uSpread;
    // Constant-acceleration motion: p = p0 + v*t + a*t^2/2
    pos = position + vel * t + 0.5 * uGravity * t * t;
    // Wobble sideways, each particle on its own phase
    pos.x += sin(t * 3.0 + aSeed.x * TAU) * uTurbulence * age;
    pos.z += cos(t * 2.6 + aSeed.y * TAU) * uTurbulence * age;

    // Quick fade in, long fade out
    alpha = smoothstep(0.0, 0.08, age) * (1.0 - smoothstep(0.55, 1.0, age)) * alive;
  } else {
    // ---------- Volume ----------
    age = 0.5;
    pos = position + uDrift * uTime;
    pos += sin(uTime * 0.35 + aSeed.xyz * TAU) * uTurbulence;
    // Wrap into the box: mod() keeps the drift going forever without escaping
    pos = mod(pos + uBox, 2.0 * uBox) - uBox;
    // Slow twinkle as motes turn through the light
    alpha = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed.x) + aSeed.y * TAU);
  }

  vAge = age;
  vAlpha = alpha;
  vSeed = aSeed.z;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  // Perspective size: world size divided by distance, scaled to pixels
  float size = uSize * mix(1.0, uSizeEnd, age) * (0.6 + 0.8 * aSeed.y);
  gl_PointSize = size * uScale / max(-mvPosition.z, 0.001);
  gl_Position = projectionMatrix * mvPosition;
}
