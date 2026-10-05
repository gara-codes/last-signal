// emergency-lighting.vert.glsl
// The vertex shader has no special job here: it just places each vertex on
// screen. All the interesting work (colour + flicker) happens per pixel in the
// fragment shader. Three.js ShaderMaterial supplies `position`,
// `modelViewMatrix` and `projectionMatrix` automatically.

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
