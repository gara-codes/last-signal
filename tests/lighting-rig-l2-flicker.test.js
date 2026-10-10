// tests/lighting-rig-l2-flicker.test.js
//
// Options > Reduce Flashing must stop L2's unstable-strip dropout/stutter and the warning
// cue's noise, the same way LightingRig.js handles the HAL proximity flicker.

import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import { LightingRigL2, L2_LIGHT_LAYOUT } from '../src/core/LightingRigL2.js';

const UNSTABLE_INDICES = L2_LIGHT_LAYOUT.reduce((acc, spec, i) => {
  if (spec.unstable) acc.push(i);
  return acc;
}, []);

describe('LightingRigL2 + Reduce Flashing', () => {
  const originalDocument = globalThis.document;

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it('unstable strips dip below their steady-drift band when Reduce Flashing is off', () => {
    globalThis.document = { body: { dataset: { reduceFlashing: 'off' } } };
    const rig = new LightingRigL2(new THREE.Scene(), new THREE.Group());

    let sawDeepDip = false;
    for (let i = 0; i < 600; i++) {
      rig.update(1 / 60);
      for (const idx of UNSTABLE_INDICES) {
        if (rig.stripLights[idx].intensity < 0.5 * rig.baseIntensities[idx]) sawDeepDip = true;
      }
    }
    expect(sawDeepDip).toBe(true);
  });

  it('unstable strips stay within a small, steady band when Reduce Flashing is on', () => {
    globalThis.document = { body: { dataset: { reduceFlashing: 'on' } } };
    const rig = new LightingRigL2(new THREE.Scene(), new THREE.Group());

    const prev = rig.stripLights.map((l) => l.intensity);
    for (let i = 0; i < 600; i++) {
      rig.update(1 / 60);
      rig.stripLights.forEach((light, idx) => {
        expect(Math.abs(light.intensity - prev[idx])).toBeLessThanOrEqual(
          0.05 * rig.baseIntensities[idx]
        );
        expect(light.intensity).toBeGreaterThan(0.5 * rig.baseIntensities[idx]);
        prev[idx] = light.intensity;
      });
    }
  });

  it('the warning cue is noisy when Reduce Flashing is off', () => {
    globalThis.document = { body: { dataset: { reduceFlashing: 'off' } } };
    const rig = new LightingRigL2(new THREE.Scene(), new THREE.Group());
    rig.triggerWarningFlicker(1);

    let sawJump = false;
    let prev = rig.stripLights[0].intensity;
    for (let i = 0; i < 60; i++) {
      rig.update(1 / 60);
      if (Math.abs(rig.stripLights[0].intensity - prev) > 0.1 * rig.baseIntensities[0]) {
        sawJump = true;
      }
      prev = rig.stripLights[0].intensity;
    }
    expect(sawJump).toBe(true);
  });

  it('the warning cue is a smooth eased dim when Reduce Flashing is on', () => {
    globalThis.document = { body: { dataset: { reduceFlashing: 'on' } } };
    const rig = new LightingRigL2(new THREE.Scene(), new THREE.Group());
    rig.triggerWarningFlicker(1);

    let prev = rig.stripLights[0].intensity;
    let sawDim = false;
    for (let i = 0; i < 60; i++) {
      rig.update(1 / 60);
      expect(Math.abs(rig.stripLights[0].intensity - prev)).toBeLessThanOrEqual(
        0.1 * rig.baseIntensities[0]
      );
      if (rig.stripLights[0].intensity < rig.baseIntensities[0]) sawDim = true;
      prev = rig.stripLights[0].intensity;
    }
    expect(sawDim).toBe(true);

    // The cue ends and the strip returns to its steady band.
    rig.update(1 / 60);
    expect(rig.stripLights[0].intensity).toBeGreaterThan(0.9 * rig.baseIntensities[0]);
  });
});
