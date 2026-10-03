import * as THREE from 'three';
import vertexShader from './emergency-lighting.vert.glsl?raw';
import fragmentShader from './emergency-lighting.frag.glsl?raw';

export function createEmergencyLightingMaterial() {
  const uniforms = {
    // hardcoded for now — Alex's power system wires this later. Low so HAL's eye
    // reads dark red with a visible flicker; 0.8 gave pale pink-white and <=8% flicker.
    powerRemaining: { value: 0.05 },
    time: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
  });

  return { material, uniforms };
}
