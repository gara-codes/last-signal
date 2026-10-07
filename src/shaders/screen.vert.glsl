// screen.vert.glsl
// Flat screen quad: pass the UVs through.

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
