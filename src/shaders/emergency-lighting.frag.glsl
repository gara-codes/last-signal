uniform float uPower; // 0.0 = no power (full uColor), 1.0 = full power (white)
uniform float uTime;
uniform vec3 uColor;  // the colour this instance mixes toward as power drops
varying vec2 vUv;

float rand(float n) {
  return fract(sin(n) * 43758.5453123);
}

void main() {
  vec3 white = vec3(1.0, 1.0, 1.0);
  vec3 baseColor = mix(uColor, white, uPower);

  float flickerStrength = (1.0 - uPower) * 0.4;
  float flicker = rand(floor(uTime * 12.0)) * flickerStrength;

  gl_FragColor = vec4(baseColor - vec3(flicker), 1.0);
}