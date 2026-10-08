// tests/lighting-rig-flicker.test.js
//
// Options > Reduce Flashing must hold the proximity flicker at base intensity
// (see ship-status.js / repair-console.js for the same convention).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { LightingRig } from '../src/core/LightingRig.js';

function withinFlickerRadius(rig) {
  const player = new THREE.Vector3(0, 0, 0);
  const ai = new THREE.Vector3(1, 0, 0); // well inside the default radius
  return { player, ai };
}

describe('LightingRig proximity flicker + Reduce Flashing', () => {
  const originalDocument = global.document;

  afterEach(() => {
    global.document = originalDocument;
  });

  it('flickers away from base intensity when Reduce Flashing is off', () => {
    global.document = { body: { dataset: { reduceFlashing: 'off' } } };
    const rig = new LightingRig(new THREE.Scene(), new THREE.Group());
    const { player, ai } = withinFlickerRadius(rig);

    let sawChange = false;
    for (let i = 0; i < 20; i++) {
      rig.updateProximityFlicker(player, ai, 1 / 60);
      if (rig.ambientLight.intensity !== rig.baseAmbientIntensity) sawChange = true;
    }
    expect(sawChange).toBe(true);
  });

  it('holds ambient and strip lights at base when Reduce Flashing is on', () => {
    global.document = { body: { dataset: { reduceFlashing: 'on' } } };
    const rig = new LightingRig(new THREE.Scene(), new THREE.Group());
    const { player, ai } = withinFlickerRadius(rig);

    for (let i = 0; i < 20; i++) {
      rig.updateProximityFlicker(player, ai, 1 / 60);
      expect(rig.ambientLight.intensity).toBe(rig.baseAmbientIntensity);
      rig.stripLights.forEach((light, idx) => {
        expect(light.intensity).toBe(rig.baseIntensities[idx]);
      });
    }
  });
});
