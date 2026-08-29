import * as THREE from 'three';
import vertexShader from './emergency-lighting.vert.glsl?raw';
import fragmentShader from './emergency-lighting.frag.glsl?raw';

export function createEmergencyLightingMaterial() {
  const uniforms = {
    powerRemaining: { value: 0.8 }, // hardcoded for now — Alex's power system wires this later
    time: { value: 0 }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader
  });

  return { material, uniforms };
}