uniform float powerRemaining; // 0.0 = no power (full red), 1.0 = full power (white)
uniform float time;
varying vec2 vUv;

// cheap pseudo-random value from a single float, no texture needed
float rand(float n) {
  return fract(sin(n) * 43758.5453123);
}

void main() {
  vec3 white = vec3(1.0, 1.0, 1.0);
  vec3 red = vec3(1.0, 0.15, 0.15);
  vec3 baseColor = mix(red, white, powerRemaining);

  // flicker gets stronger as power drops; steps ~12x/sec so it reads as
  // a flicker instead of smooth pulsing or buzzing static
  float flickerStrength = (1.0 - powerRemaining) * 0.4;
  float flicker = rand(floor(time * 12.0)) * flickerStrength;

  gl_FragColor = vec4(baseColor - vec3(flicker), 1.0);
}