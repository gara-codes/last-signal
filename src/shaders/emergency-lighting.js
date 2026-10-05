// emergency-lighting.js — material factory for the emergency-lighting shader.
//
// Usage:
//   const { material, uniforms } = createEmergencyLightingMaterial({ preset: 'l2Warning' });
//   stripMesh.material = material;
//   controller.addUniforms(uniforms);   // see emergency-lighting-controller.js

import * as THREE from 'three';
import vertexShader from './emergency-lighting.vert.glsl?raw';
import fragmentShader from './emergency-lighting.frag.glsl?raw';

// Colours come straight from theme.css so HUD, scene lighting and shader stay
// one visual system. HAL keeps its own more saturated red on purpose.
export const EMERGENCY_PRESETS = Object.freeze({
  // AI eye / tracking light. Values from Gara's #24 tuning: (0.8, 0, 0) red at
  // power 0.05, so the eye reads dark red (~0.81, 0.05, 0.05) and flickers visibly.
  // Alex's power system drives uPower later.
  hal:       { color: '#cc0000', maxWhite: 1.0,  intensity: 1.0, power: 0.05 },
  l1Clean:   { color: '#cfe8ff', maxWhite: 1.0,  intensity: 1.0 }, // --state-clean
  l2Warning: { color: '#f2a93c', maxWhite: 0.25, intensity: 1.4 }, // --state-warning
  l3Hostile: { color: '#b23a30', maxWhite: 0.1,  intensity: 1.2 }, // --state-hostile
});

// Theme hexes are sRGB. A ShaderMaterial without Three's colorspace chunk
// writes its output straight to the canvas, so we pass the raw sRGB numbers
// through unconverted: the hex in theme.css is exactly what appears on screen.
function hexToShaderRGB(hex, target = new THREE.Color()) {
  const n = parseInt(hex.replace('#', ''), 16);
  return target.setRGB(
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
    THREE.LinearSRGBColorSpace // = "don't convert" (ignored on older Three versions, same result)
  );
}

export function createEmergencyLightingMaterial(options = {}) {
  const preset = options.preset ? EMERGENCY_PRESETS[options.preset] : null;
  if (options.preset && !preset) {
    console.warn(`[emergency-lighting] unknown preset "${options.preset}", using defaults`);
  }
  const cfg = {
    color: '#ff2626',
    maxWhite: 1,
    intensity: 1,
    power: 1,
    ...preset,
    ...options,
  };

  const uniforms = {
    uPower:        { value: cfg.power },
    uTime:         { value: 0 },
    uColor:        { value: hexToShaderRGB(cfg.color) },
    uMaxWhite:     { value: cfg.maxWhite },
    uFlickerBoost: { value: 0 },
    uIntensity:    { value: cfg.intensity },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    toneMapped: false,
  });
  material.name = `emergency-lighting-${options.preset ?? 'custom'}`;

  return { material, uniforms };
}

// Change colour at runtime (e.g. HAL shifting to hostile) without allocating.
export function setEmergencyColor(uniforms, hex) {
  hexToShaderRGB(hex, uniforms.uColor.value);
}
