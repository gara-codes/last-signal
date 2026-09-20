uniform float glitchIntensity; // 0 = none (debris), higher = more jitter (AI hologram)
uniform float time;
varying vec2 vUv;

float rand(float n) {
  return fract(sin(n) * 43758.5453123);
}

void main() {
  vUv = uv;

  vec3 pos = position;

  float band = floor(position.y * 6.0 + time * 3.0);
  float jitter = (rand(band) - 0.5) * glitchIntensity * 0.15;
  pos.x += jitter;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}