// tests/lighting-rig-flicker.test.js
//
// Options > Reduce Flashing must replace the proximity flicker with a steady calm dim — no
// Math.random()/sine — instead of removing the cue entirely (see LightingRig.js).

import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import { LightingRig } from '../src/core/LightingRig.js';

function withinFlickerRadius() {
  const player = new THREE.Vector3(0, 0, 0);
  const ai = new THREE.Vector3(1, 0, 0); // well inside the default radius
  return { player, ai };
}

function outsideFlickerRadius() {
  const player = new THREE.Vector3(0, 0, 0);
  const ai = new THREE.Vector3(100, 0, 0); // well outside the default radius
  return { player, ai };
}

describe('LightingRig proximity flicker + Reduce Flashing', () => {
  const originalDocument = globalThis.document;

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it('flickers away from base intensity when Reduce Flashing is off', () => {
    globalThis.document = { body: { dataset: { reduceFlashing: 'off' } } };
    const rig = new LightingRig(new THREE.Scene(), new THREE.Group());
    const { player, ai } = withinFlickerRadius();

    let sawChange = false;
    for (let i = 0; i < 20; i++) {
      rig.updateProximityFlicker(player, ai, 1 / 60);
      if (rig.ambientLight.intensity !== rig.baseAmbientIntensity) sawChange = true;
    }
    expect(sawChange).toBe(true);
  });

  it('eases to a calm dim (not base, not off) when near and Reduce Flashing is on', () => {
    globalThis.document = { body: { dataset: { reduceFlashing: 'on' } } };
    const rig = new LightingRig(new THREE.Scene(), new THREE.Group());
    const { player, ai } = withinFlickerRadius();

    let prevAmbient = rig.ambientLight.intensity;
    for (let i = 0; i < 120; i++) {
      rig.updateProximityFlicker(player, ai, 1 / 60);
      // No single frame jumps by more than a small amount — this is an ease, not a snap.
      expect(Math.abs(rig.ambientLight.intensity - prevAmbient)).toBeLessThanOrEqual(
        0.05 * rig.baseAmbientIntensity
      );
      prevAmbient = rig.ambientLight.intensity;
    }

    expect(rig.ambientLight.intensity).toBeLessThan(rig.baseAmbientIntensity);
    expect(rig.ambientLight.intensity).toBeGreaterThan(0.5 * rig.baseAmbientIntensity);
    rig.stripLights.forEach((light, idx) => {
      expect(light.intensity).toBeLessThan(rig.baseIntensities[idx]);
      expect(light.intensity).toBeGreaterThan(0.5 * rig.baseIntensities[idx]);
    });
  });

  it('eases back to base after leaving, with Reduce Flashing on', () => {
    globalThis.document = { body: { dataset: { reduceFlashing: 'on' } } };
    const rig = new LightingRig(new THREE.Scene(), new THREE.Group());
    const near = withinFlickerRadius();
    const far = outsideFlickerRadius();

    for (let i = 0; i < 60; i++) rig.updateProximityFlicker(near.player, near.ai, 1 / 60);
    for (let i = 0; i < 180; i++) rig.updateProximityFlicker(far.player, far.ai, 1 / 60);

    expect(rig.ambientLight.intensity).toBeCloseTo(rig.baseAmbientIntensity, 2);
    rig.stripLights.forEach((light, idx) => {
      expect(light.intensity).toBeCloseTo(rig.baseIntensities[idx], 2);
    });
  });

  it('switches cleanly when Reduce Flashing is toggled mid-flicker', () => {
    globalThis.document = { body: { dataset: { reduceFlashing: 'off' } } };
    const rig = new LightingRig(new THREE.Scene(), new THREE.Group());
    const { player, ai } = withinFlickerRadius();

    for (let i = 0; i < 10; i++) rig.updateProximityFlicker(player, ai, 1 / 60);

    globalThis.document.body.dataset.reduceFlashing = 'on';
    // The switch itself can jump (leaving the noisy flicker behind); every frame after
    // that first one must settle into the smooth ease.
    rig.updateProximityFlicker(player, ai, 1 / 60);
    let prevAmbient = rig.ambientLight.intensity;
    for (let i = 0; i < 60; i++) {
      rig.updateProximityFlicker(player, ai, 1 / 60);
      expect(Math.abs(rig.ambientLight.intensity - prevAmbient)).toBeLessThanOrEqual(
        0.05 * rig.baseAmbientIntensity
      );
      prevAmbient = rig.ambientLight.intensity;
    }
    expect(rig.ambientLight.intensity).toBeLessThan(rig.baseAmbientIntensity);

    globalThis.document.body.dataset.reduceFlashing = 'off';
    let sawChangeAgain = false;
    for (let i = 0; i < 20; i++) {
      rig.updateProximityFlicker(player, ai, 1 / 60);
      if (rig.ambientLight.intensity !== rig.baseAmbientIntensity) sawChangeAgain = true;
    }
    expect(sawChangeAgain).toBe(true);
  });
});
