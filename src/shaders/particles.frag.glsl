// particles.frag.glsl
//
// Draws each point sprite as a soft round dot. uHardness sharpens the core
// for sparks and embers; low values give soft puffs for steam and dust.
//
// Uniforms
//   uColorStart / uColorEnd  linear RGB at spawn / end of life
//   uOpacity                 overall alpha
//   uHardness                0 = soft puff, 1 = hard bright core
//   uFlicker                 0..1 per-particle brightness flicker (embers)
//   uTime                    sec

uniform vec3  uColorStart;
uniform vec3  uColorEnd;
uniform float uOpacity;
uniform float uHardness;
uniform float uFlicker;
uniform float uTime;

varying float vAge;
varying float vAlpha;
varying float vSeed;

void main() {
  // gl_PointCoord runs 0..1 across the sprite; d = 0 at the centre, 0.5 at the edge
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard; // square sprite -> circle

  // Soft falloff from centre to edge; pow() pulls brightness into the core
  float shape = 1.0 - smoothstep(0.0, 0.5, d);
  shape = pow(shape, mix(1.0, 3.0, uHardness));

  float flick = 1.0 - uFlicker * 0.5 * (0.5 + 0.5 * sin(uTime * 18.0 + vSeed * 40.0));

  vec3 color = mix(uColorStart, uColorEnd, vAge) * flick;
  gl_FragColor = vec4(color, shape * vAlpha * uOpacity);

  // Three's standard tail: tone mapping (if the material allows it) and
  // linear -> output colour space when drawing straight to the screen. Inside
  // a post-processing chain both are skipped and OutputPass does them instead,
  // so the particles look the same either way.
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
