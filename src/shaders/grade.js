// grade.js — the per-level colour grade + screen effects pass.
//
// Usage (post-fx.js does this):
//   const pass = new ShaderPass(createGradeShader());
//   applyGradePreset(pass.uniforms, 'l2');
//
// Presets carry the level's escalation (level design doc): L1 clean and
// cool, L2 amber and grimy, L3 red and harsh. The bloom/AO numbers live
// beside the grade so one preset name sets the whole look.

import * as THREE from 'three';
import vertexShader from './grade.vert.glsl?raw';
import fragmentShader from './grade.frag.glsl?raw';

export const FX_PRESETS = Object.freeze({
  // L1 Habitation Ring: clean white/light blue, almost no grit
  l1: {
    tint: [0.98, 1.01, 1.06],
    lift: [0.0, 0.004, 0.012],
    contrast: 1.04,
    saturation: 0.96,
    vignette: 0.22,
    grain: 0.012,
    aberration: 0.0006,
    // Threshold is in linear HDR, before tone mapping. Lit white walls sit
    // below ~1, so only light sources (emissive > 1) bloom, not the walls.
    bloom: { strength: 0.6, radius: 0.15, threshold: 1.05 },
    ao: { enabled: true, intensity: 0.8 },
  },
  // L2 Engineering Core: amber, crushed blacks, grimy
  l2: {
    tint: [1.08, 0.97, 0.84],
    lift: [0.012, 0.006, 0.0],
    contrast: 1.15,
    saturation: 0.9,
    vignette: 0.42,
    grain: 0.035,
    aberration: 0.0012,
    bloom: { strength: 0.85, radius: 0.25, threshold: 0.95 },
    ao: { enabled: true, intensity: 1.0 },
  },
  // L3 Docking Corridor: red, high contrast, unstable
  l3: {
    tint: [1.1, 0.9, 0.88],
    lift: [0.02, 0.0, 0.0],
    contrast: 1.25,
    saturation: 1.05,
    vignette: 0.52,
    grain: 0.045,
    aberration: 0.002,
    bloom: { strength: 1.0, radius: 0.3, threshold: 0.9 },
    ao: { enabled: true, intensity: 1.0 },
  },
});

/** A fresh shader definition for ShaderPass (ShaderPass clones the uniforms). */
export function createGradeShader() {
  return {
    name: 'GradeShader',
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTint: { value: new THREE.Vector3(1, 1, 1) },
      uLift: { value: new THREE.Vector3(0, 0, 0) },
      uContrast: { value: 1 },
      uSaturation: { value: 1 },
      uVignette: { value: 0 },
      uGrain: { value: 0 },
      uAberration: { value: 0 },
      uStress: { value: 0 },
      uPulse: { value: 0 },
      uWarp: { value: 0 },
    },
    vertexShader,
    fragmentShader,
  };
}

/**
 * Copies a preset's grade values into the pass uniforms. Mutates in place,
 * so it's safe to call on a level change without allocating.
 * @param {object} uniforms - the ShaderPass's uniforms
 * @param {keyof FX_PRESETS} name
 */
export function applyGradePreset(uniforms, name) {
  const p = FX_PRESETS[name];
  if (!p) throw new Error(`[grade] unknown preset "${name}"`);
  uniforms.uTint.value.fromArray(p.tint);
  uniforms.uLift.value.fromArray(p.lift);
  uniforms.uContrast.value = p.contrast;
  uniforms.uSaturation.value = p.saturation;
  uniforms.uVignette.value = p.vignette;
  uniforms.uGrain.value = p.grain;
  uniforms.uAberration.value = p.aberration;
  return p;
}
