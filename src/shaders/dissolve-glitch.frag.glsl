uniform float dissolveProgress; // 0 = fully solid, 1 = fully dissolved
uniform float glitchIntensity;  // 0 = none, 1 = max
uniform float time;
uniform vec3 baseColor;
uniform vec3 edgeColor;

varying vec2 vUv;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = rand(i);
  float b = rand(i + vec2(1.0, 0.0));
  float c = rand(i + vec2(0.0, 1.0));
  float d = rand(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  float mask = noise(vUv * 8.0);
  if (mask < dissolveProgress) {
    discard;
  }

  float edgeWidth = 0.08;
  float edgeFactor = smoothstep(dissolveProgress, dissolveProgress + edgeWidth, mask);
  vec3 color = mix(edgeColor, baseColor, edgeFactor);

  float scanline = floor(vUv.y * 40.0);
  float glitchNoise = rand(vec2(scanline, floor(time * 10.0)));
  color += (glitchNoise - 0.5) * glitchIntensity * 0.4;

  float flicker = 1.0 - (rand(vec2(floor(time * 15.0), 0.0)) * glitchIntensity * 0.3);

  gl_FragColor = vec4(color * flicker, 1.0);
}