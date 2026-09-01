import * as THREE from 'three';
import vertexShader from './dissolve-glitch.vert.glsl?raw';
import fragmentShader from './dissolve-glitch.frag.glsl?raw';

/**
 * Creates the dissolve/glitch-hologram ShaderMaterial. One material, two uses:
 * - L3 debris: high dissolveProgress over time, glitchIntensity near 0.
 * - AI hologram: dissolveProgress near 0 (mostly solid), glitchIntensity high.
 * @param {{ baseColor?: THREE.Color, edgeColor?: THREE.Color }} options
 */
export function createDissolveGlitchMaterial({
  baseColor = new THREE.Color(0x888888),
  edgeColor = new THREE.Color(0xff6600),
} = {}) {
  const uniforms = {
    dissolveProgress: { value: 0 },
    glitchIntensity: { value: 0 },
    time: { value: 0 },
    baseColor: { value: baseColor },
    edgeColor: { value: edgeColor },
  };

  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
  return { material, uniforms };
}
