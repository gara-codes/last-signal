import * as THREE from 'three';
import vertexShader from './emergency-lighting.vert.glsl?raw';
import fragmentShader from './emergency-lighting.frag.glsl?raw';

// Matches v1's original hardcoded red (~#ff2626), so existing callers
// like HAL's eye are visually unaffected unless they opt into a new colour.
const DEFAULT_COLOR = new THREE.Vector3(1.0, 0.15, 0.15);

/**
 * Creates the emergency-lighting ShaderMaterial. Mixes from `color` (low power)
 * to white (full power), with noise-driven flicker that intensifies as power drops.
 * @param {{ color?: THREE.Vector3 }} options - normalised 0-1 RGB target colour.
 */
export function createEmergencyLightingMaterial({ color = DEFAULT_COLOR.clone() } = {}) {
  const uniforms = {
    uPower: { value: 0.8 },
    uTime: { value: 0 },
    uColor: { value: color },
  };

  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
  return { material, uniforms };
}
