// grade.vert.glsl
// Full-screen pass: the quad already covers the screen, so just hand the UVs on.

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
