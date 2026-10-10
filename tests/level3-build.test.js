// tests/level3-build.test.js
//
// Full-assembler smoke build. The seven sibling L3 test files assert on the
// THREE-free data tables; this one actually constructs the level through
// Vite's pipeline (so the `?raw` GLSL imports in shaders/emergency-lighting.js
// resolve), walks the resulting scene graph, and drives update()/dispose().
//
// It is the headless stand-in for the flycam smoke check: the sandbox browser
// cannot create a WebGL context, so the render loop can't run there — but the
// scene-graph build (the real risk in the new act/kit/breach/hazard/prop code)
// is pure CPU and is proven here.
//
// One level is built once and shared across the assertions (a full build holds
// hundreds of merged BufferGeometries, so building per-test exhausts the heap).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import { ACTS, HAZARDS } from '../src/levels/level3/level3-data.js';

// update() closures in hazards.js/props3.js read window.performance.now();
// the vitest node environment has no window, so provide a minimal one.
if (typeof globalThis.window === 'undefined') {
  globalThis.window = { performance: { now: () => Date.now() } };
}

describe('createLevel3 full assembler build', () => {
  let level;

  beforeAll(async () => {
    const { createLevel3 } = await import('../src/levels/level3/level3-docking-corridor.js');
    level = createLevel3();
  });

  afterAll(() => {
    level?.dispose();
  });

  it('builds the whole level without throwing and exposes the L2-shaped surface', () => {
    expect(level).toBeTypeOf('object');
    expect(level.group).toBeInstanceOf(THREE.Group);
    expect(level.group.name).toBe('level-3');
    expect(level.dispose).toBeTypeOf('function');
    expect(level.update).toBeTypeOf('function');
    expect(level.getSpawnView).toBeTypeOf('function');
    expect(level.getPlayerSpawn).toBeTypeOf('function');
  });

  it('emits every built act band as a named child group', () => {
    const names = level.group.children.map((c) => c.name);
    for (const act of ACTS) expect(names).toContain(`act-${act}`);
  });

  it('populates a non-trivial scene graph (geometry actually built)', () => {
    let meshes = 0;
    let instanced = 0;
    let points = 0;
    let lights = 0;
    level.group.traverse((o) => {
      if (o.isInstancedMesh) instanced++;
      else if (o.isPoints) points++;
      else if (o.isMesh) meshes++;
      if (o.isLight) lights++;
    });
    // With all four acts built the level holds hundreds of meshes; a
    // single-act focus build (ACTS=[1]) is legitimately smaller.
    const fullBuild = ACTS.length === 4;
    expect(meshes).toBeGreaterThan(fullBuild ? 100 : 20);
    expect(instanced).toBeGreaterThan(0);
    expect(points).toBeGreaterThan(0); // breach debris fields
    // Lighting is runtime-owned by LightingRigL3 (constructed in main.js),
    // never part of the built group — the rig strips any residual fill.
    expect(lights).toBe(0);
  });

  it('exports the systems-pass contracts on group.userData', () => {
    const ud = level.group.userData;

    expect(ud.collisionData).toBe(level.collisionData);
    expect(Array.isArray(level.collisionData.wallAABBs)).toBe(true);
    expect(level.collisionData.wallAABBs.length).toBeGreaterThan(0);
    expect(Array.isArray(level.collisionData.railAABBs)).toBe(true);
    expect(Array.isArray(level.collisionData.rampSurfaces)).toBe(true);
    expect(level.collisionData.floorSpec).toEqual({ groundY: 0, deckY: -7 });

    expect(Array.isArray(ud.fallVolumes)).toBe(true);
    // One entry per placed ladder hazard: the HAZARDS rows of the built acts,
    // plus the two Act-4 clamp guards synthesized at build time.
    const expectedHazards = HAZARDS.filter((h) => ACTS.includes(h.act)).length + (ACTS.includes(4) ? 2 : 0);
    expect(ud.hazards.length).toBe(expectedHazards);
    expect(ud.hazards.every((h) => h && h.id && h.volume)).toBe(true);
    expect(ud.gates.table).toBeDefined();
    expect(Array.isArray(ud.gates.placed)).toBe(true);
    expect(ud.checkpoints.length).toBe(3);
    expect(ud.countdown).toBeDefined();
    expect(ud.carryover).toBeDefined();
    expect(ud.ending).toBeDefined();
    expect(Array.isArray(ud.lightingCues)).toBe(true);
    expect(Array.isArray(ud.triggerTable)).toBe(true);
    expect(ud.triggerTable.length).toBeGreaterThan(0);
  });

  it('closes every Act-1 tier transition with an end wall (no void leaks)', () => {
    if (!ACTS.includes(1)) return;
    const walls = level.collisionData.wallAABBs;
    const covers = (z, minWidth = 0) =>
      walls.some((w) => w.minZ <= z && z <= w.maxZ && w.maxX - w.minX >= minWidth);
    // Solid cap behind the spawn (z=8, two 4.5u leaves) and junction walls at
    // the hall ends (side leaves 6.5u / 9.5u + headers). Widths are the
    // largest single leaf at each plane.
    expect(covers(8, 4)).toBe(true);
    expect(covers(-48, 6)).toBe(true);
    expect(covers(-73, 9)).toBe(true);
    // The turn chamber south end closes down to the 3u bypass duct (1.5u leaves).
    expect(covers(-91, 1)).toBe(true);
    // The turn's north stub (z=-101) is a dead end: solid cap (3u leaves).
    expect(covers(-101, 2)).toBe(true);
    // The c1 collar run is capped at its far (east) end while act 2 is
    // outside the build scope, so no void shows down the corridor.
    const coversX = (x, minWidth = 0) =>
      walls.some((w) => w.minX <= x && x <= w.maxX && w.maxZ - w.minZ >= minWidth);
    expect(coversX(40, 2)).toBe(true);
    // The junction openings stay walkable: nothing solid fills the 3×3 duct
    // mouth at z=-73 or the 9×7 spine mouth at z=-48.
    for (const z of [-48, -73]) {
      const blocker = walls.find(
        (w) => w.minZ <= z && z <= w.maxZ && w.minY < 2 && w.minX <= -0.5 && w.maxX >= 0.5
      );
      expect(blocker).toBeUndefined();
    }
  });

  it('dresses passage and turn sections at passage cross-section (not spine defaults)', () => {
    if (!ACTS.includes(1)) return;
    const walls = level.collisionData.wallAABBs;
    // c1 north wall must sit at lateral +2.5..+3 of a 6-wide section
    // (z -93.5..-93). At spine size it drifted to z -92 and floated.
    const c1North = walls.find(
      (w) => Math.abs(w.minZ - -93.5) < 0.05 && Math.abs(w.maxZ - -93.0) < 0.05 && w.maxX - w.minX >= 4 && w.maxY <= 5.5
    );
    expect(c1North).toBeDefined();
    // t1 east wall south jamb (beside the c1 mouth): x 2.5..3, z -93..-91,
    // passage height — not a 7u spine-tier slab floating in the void.
    const jamb = walls.find(
      (w) =>
        Math.abs(w.minX - 2.5) < 0.05 &&
        Math.abs(w.maxX - 3.0) < 0.05 &&
        w.minZ >= -93.2 &&
        w.maxZ <= -90.8 &&
        w.maxY <= 5.5
    );
    expect(jamb).toBeDefined();
  });

  it('drives update() with a roaming viewer without throwing and culls act bands', () => {
    const viewer = new THREE.Object3D();
    const input = { mouseDX: 0, mouseDY: 0 };

    // A few frames near spawn, then a jump to the Act 3 belly to exercise
    // act-band culling, the crack motif and eye darkening.
    viewer.position.set(0, 1.7, 0);
    for (let i = 0; i < 5; i++) level.update(1 / 60, viewer, input);

    const actGroups = {};
    for (const c of level.group.children) {
      const m = /^act-(\d)$/.exec(c.name);
      if (m) actGroups[Number(m[1])] = c;
    }
    // At spawn only the active band and its one-act look-ahead are visible.
    const first = ACTS[0];
    const lookAhead = ACTS[1] ?? first;
    const last = ACTS[ACTS.length - 1];
    expect(actGroups[first].visible).toBe(true);
    expect(actGroups[lookAhead].visible).toBe(true);
    if (last !== first && last !== lookAhead) expect(actGroups[last].visible).toBe(false);

    viewer.position.set(40, -7, -300);
    expect(() => level.update(1 / 60, viewer, input)).not.toThrow();
    if (ACTS.length > 1) {
      expect(actGroups[first].visible).toBe(false);
    } else {
      // Single-act focus build: every band is act 1, so nothing culls away.
      expect(actGroups[first].visible).toBe(true);
    }
  });

  it('provides a spawn view + player spawn', () => {
    const view = level.getSpawnView();
    expect(view.position).toBeInstanceOf(THREE.Vector3);
    expect(view.lookAt).toBeInstanceOf(THREE.Vector3);

    const spawn = level.getPlayerSpawn();
    expect(typeof spawn.x).toBe('number');
    expect(typeof spawn.z).toBe('number');
    expect(typeof spawn.yaw).toBe('number');
  });
});
