// tests/emergency-lighting.test.js
//
// Material factory checks for the emergency-lighting shader:
// - colours are THREE.Color, the same convention as dissolve-glitch.js
//   (review on #11: a Vector3 colour would lose setHex / colour-space handling)
// - a uniform-name contract between the GLSL and the JS. GLSL doesn't error
//   on a uniform the JS never sets: it reads 0 forever, silently. That froze
//   HAL's flicker once during the uPower/uTime rename.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import * as THREE from 'three';
import {
  createEmergencyLightingMaterial,
  setEmergencyColor,
  EMERGENCY_PRESETS,
  readReduceFlashing,
} from '../src/shaders/emergency-lighting.js';

function declaredUniforms(file) {
  const src = readFileSync(new URL(`../src/shaders/${file}`, import.meta.url), 'utf8');
  return [...src.matchAll(/^\s*uniform\s+\w+\s+(\w+)\s*;/gm)].map((m) => m[1]);
}

describe('emergency-lighting uniform contract', () => {
  const { uniforms } = createEmergencyLightingMaterial();
  const jsNames = Object.keys(uniforms);
  const glsl = new Set([
    ...declaredUniforms('emergency-lighting.vert.glsl'),
    ...declaredUniforms('emergency-lighting.frag.glsl'),
  ]);

  it('sets every uniform the shaders declare', () => {
    for (const name of glsl) expect(jsNames).toContain(name);
  });

  it('declares every uniform the JS sets in at least one shader', () => {
    for (const name of jsNames) expect(glsl.has(name)).toBe(true);
  });
});

describe('emergency-lighting colours', () => {
  it('uses THREE.Color for uColor', () => {
    const { uniforms } = createEmergencyLightingMaterial({ preset: 'l2Warning' });
    expect(uniforms.uColor.value).toBeInstanceOf(THREE.Color);
  });

  it('passes hex colours through unconverted (hex in = colour on screen)', () => {
    const { uniforms } = createEmergencyLightingMaterial({ preset: 'hal' });
    // #cc0000 = (0.8, 0, 0): the value Gara tuned HAL's eye to in #24
    expect(uniforms.uColor.value.r).toBeCloseTo(0.8);
    expect(uniforms.uColor.value.g).toBe(0);
    expect(uniforms.uColor.value.b).toBe(0);
  });

  it('gives red and amber distinct colours through the same shader', () => {
    const red = createEmergencyLightingMaterial({ preset: 'hal' });
    const amber = createEmergencyLightingMaterial({ preset: 'l2Warning' });
    expect(red.material.fragmentShader).toBe(amber.material.fragmentShader);
    expect(amber.uniforms.uColor.value.equals(red.uniforms.uColor.value)).toBe(false);
  });

  it('setEmergencyColor() changes the colour in place, without allocating', () => {
    const { uniforms } = createEmergencyLightingMaterial({ preset: 'hal' });
    const before = uniforms.uColor.value;
    setEmergencyColor(uniforms, '#f2a93c');
    expect(uniforms.uColor.value).toBe(before);
    expect(uniforms.uColor.value.r).toBeCloseTo(0xf2 / 255);
  });

  it('keeps HAL at #24 tuning: dark red at power 0.05', () => {
    expect(EMERGENCY_PRESETS.hal).toMatchObject({ color: '#cc0000', power: 0.05 });
  });
});

describe('emergency-lighting Reduce Flashing', () => {
  it('materials start with the light free to flicker (uSteady 0)', () => {
    const { uniforms } = createEmergencyLightingMaterial({ preset: 'hal' });
    expect(uniforms.uSteady.value).toBe(0);
  });

  it('readReduceFlashing() is false without a DOM (node tests, no crash)', () => {
    expect(readReduceFlashing()).toBe(false);
  });
});
