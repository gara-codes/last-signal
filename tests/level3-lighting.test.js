// tests/level3-lighting.test.js
//
// LightingRigL3 runtime contract, headless. The build test proves the level
// assembles; this proves what main.js wires at runtime: the rig owns the
// scene devices (fog/background/starfield), parents Act-1's six dynamic
// lights to the act band so they cull with it, drains the level's cue
// channel (telegraph -> strobe, collapse -> flash + working-light death),
// and dispose() hands the scene back untouched.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import { createLevel3 } from '../src/levels/level3/level3-docking-corridor.js';
import { LightingRigL3 } from '../src/core/LightingRigL3.js';

if (typeof globalThis.window === 'undefined') {
  globalThis.window = { performance: { now: () => Date.now() } };
}

describe('LightingRigL3 Act-1 rig', () => {
  let scene;
  let level;
  let rig;

  beforeAll(() => {
    scene = new THREE.Scene();
    level = createLevel3();
    scene.add(level.group);
    rig = new LightingRigL3(scene, level.group);
  });

  afterAll(() => {
    rig?.dispose();
    level?.dispose();
  });

  it('owns the scene devices: near-black fog, background, starfield, base fill', () => {
    expect(scene.fog).toBeInstanceOf(THREE.Fog);
    expect(scene.fog.color.getHex()).toBe(0x030104);
    expect(scene.background).toBeInstanceOf(THREE.Color);
    expect(scene.background.getHex()).toBe(0x010102);
    const starfield = scene.getObjectByName('starfield');
    expect(starfield).toBeTruthy();
    expect(starfield.material.fog).toBe(false); // stars must survive the fog
    // Base fill: one ambient + one hemisphere, red-tilted near-black.
    expect(rig.ambient.isAmbientLight).toBe(true);
    expect(rig.hemi.isHemisphereLight).toBe(true);
  });

  it('strips residual placeholder fill from the built level group', () => {
    let fill = 0;
    level.group.traverse((o) => {
      if (o.isAmbientLight || o.isHemisphereLight || o.isDirectionalLight) fill += 1;
    });
    expect(fill).toBe(0);
  });

  it('parents the eight Act-1 lights to the act band (culling + budget)', () => {
    const act1 = level.group.getObjectByName('act-1');
    expect(act1).toBeTruthy();
    const names = act1.children.map((c) => c.name);
    for (const id of [
      'a1-red-pool-1', 'a1-red-pool-2', 'a1-red-pool-3',
      'a1-working-spawn', 'a1-cargo-wash', 'a1-duct-guide', 'a1-terminus',
      'a1-shaft-p1',
    ]) {
      expect(names).toContain(id);
    }
    const lights = act1.children.filter((c) => c.isLight);
    expect(lights).toHaveLength(8);
    // The p1 shaft is the one shadow-caster (hero device).
    const shaft = act1.getObjectByName('a1-shaft-p1');
    expect(shaft.isSpotLight).toBe(true);
    expect(shaft.castShadow).toBe(true);
    expect(shaft.target.parent).toBe(act1); // target must be in the graph
  });

  it('drains cues: telegraph arms a strobing strobe, collapse flashes + kills the white light', () => {
    const cues = level.group.userData.lightingCues;
    cues.push({ type: 'telegraph', t: 0, position: [0, 3, -45] });
    rig.update(1 / 60);
    expect(rig.strobes).toHaveLength(1);
    const strobe = rig.strobes[0];
    expect(strobe.phase).toBe('telegraph');
    expect(strobe.light.parent?.name).toBe('act-1'); // parented by cue position
    const working = level.group.getObjectByName('a1-working-spawn');
    const base = working.intensity;

    cues.push({ type: 'collapse', t: 0, position: [0, 3, -45] });
    rig.update(1 / 60);
    expect(strobe.phase).toBe('flash');

    // Working light dies over its fade window.
    for (let i = 0; i < 60; i++) rig.update(1 / 60);
    expect(working.intensity).toBeLessThan(base * 0.25);

    // Flash decays and the transient strobe frees itself.
    for (let i = 0; i < 90; i++) rig.update(1 / 60);
    expect(rig.strobes).toHaveLength(0);
    expect(working.intensity).toBe(0);
  });

  it('keeps the static lights near their base intensities (flicker is subtle)', () => {
    const pool = level.group.getObjectByName('a1-red-pool-1');
    rig.update(1 / 60);
    expect(pool.intensity).toBeGreaterThan(40 * 0.9);
    expect(pool.intensity).toBeLessThan(40 * 1.1);
  });

  it('dispose() restores the scene and frees every rig-owned object', () => {
    const act1 = level.group.getObjectByName('act-1');
    rig.dispose();
    expect(scene.fog).toBeNull();
    expect(scene.background).toBeNull();
    expect(scene.getObjectByName('starfield')).toBeUndefined();
    expect(act1.children.filter((c) => c.isLight)).toHaveLength(0);
    rig = null; // afterAll guard
  });
});
