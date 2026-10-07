// screen.frag.glsl
//
// Animated console screen. The content is a canvas texture (rows of data, or
// a grid of status blocks); this shader makes it feel alive:
//
//   1. Scroll      data rows crawl upward (uScroll > 0)
//   2. Blink       status-block screens toggle cells on and off (uBlink = 1)
//   3. Glitch      every so often a thin band tears sideways for one tick
//   4. Scanlines   fine horizontal lines, like an old CRT
//   5. Cursor      a blinking block in the bottom-left corner
//   6. Frame       a soft glowing border
//   7. Power       uPower < 1 dims the screen and adds static (power dip)
//
// Uniforms
//   uMap        content texture (sRGB canvas; sampled as linear)
//   uTime       sec, shared by every screen
//   uSeed       0..1 per screen, so they don't animate in lockstep
//   uScroll     scroll speed in screen-heights per second (0 = still)
//   uBlink      0 = no cell blinking, 1 = status-block blinking
//   uPower      0..1 station power feeding the screen
//   uIntensity  brightness multiplier (raise it once bloom is on)
//   uFrameColor linear RGB of the border glow

uniform sampler2D uMap;
uniform float uTime;
uniform float uSeed;
uniform float uScroll;
uniform float uBlink;
uniform float uPower;
uniform float uIntensity;
uniform vec3  uFrameColor;

varying vec2 vUv;

// Same sin/fract hash as every other shader in the project.
float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453123);
}

const float SCANLINES  = 140.0; // lines across the screen height
const float GLITCH_RATE = 8.0;  // glitch rolls per second
const vec2  BLOCK_GRID = vec2(6.0, 4.0); // matches drawScreen's status grid

void main() {
  vec2 uv = vUv;

  // ---------- 1. Scroll ----------
  // fract() wraps the texture so the rows loop forever.
  uv.y = fract(uv.y + uTime * uScroll);

  // ---------- 3. Glitch ----------
  // Each tick rolls a number; ~4% of ticks tear a thin band sideways.
  float tick = floor(uTime * GLITCH_RATE);
  float glitchOn = step(0.96, rand(vec2(tick, uSeed * 31.0)));
  float bandY = rand(vec2(tick * 1.7, uSeed));
  float inBand = 1.0 - step(0.04, abs(vUv.y - bandY));
  uv.x += glitchOn * inBand * (rand(vec2(tick, 9.1)) - 0.5) * 0.2;

  vec3 color = texture2D(uMap, uv).rgb;

  // ---------- 2. Blink ----------
  // Which status cell is this pixel in? Each cell re-rolls twice a second
  // and goes dim ~20% of the time.
  vec2 cell = floor(vUv * BLOCK_GRID);
  float cellOn = step(0.2, rand(cell + floor(uTime * 2.0) + uSeed * 17.0));
  color *= mix(1.0, mix(0.25, 1.0, cellOn), uBlink);

  // ---------- 4. Scanlines ----------
  color *= 0.86 + 0.14 * sin(vUv.y * SCANLINES * 3.1415927);

  // ---------- 5. Cursor ----------
  // A small block, on for half of each 0.66 s blink.
  float inCursor = step(0.05, vUv.x) * step(vUv.x, 0.09) * step(0.06, vUv.y) * step(vUv.y, 0.13);
  float cursorOn = step(0.5, fract(uTime * 1.5 + uSeed));
  color += vec3(0.25, 0.75, 1.0) * inCursor * cursorOn * (1.0 - uBlink);

  // ---------- 6. Frame ----------
  // Distance to the nearest edge; glow fades out over the outer 2%.
  float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  color += uFrameColor * (1.0 - smoothstep(0.0, 0.02, edge));

  // ---------- 7. Power ----------
  // Low power: dimmer, with static creeping in.
  float staticNoise = rand(vUv * 300.0 + tick);
  color = mix(vec3(staticNoise) * 0.15, color, uPower);
  // Faint whole-screen flicker so it never looks perfectly static
  color *= (0.94 + 0.06 * rand(vec2(tick, uSeed))) * uIntensity;

  gl_FragColor = vec4(color, 1.0);

  // Three's standard tail: tone mapping (off for this material) and
  // linear -> sRGB when drawing straight to the screen.
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
