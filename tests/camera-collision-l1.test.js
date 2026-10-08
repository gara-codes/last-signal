// tests/camera-collision-l1.test.js
//
// L1 camera blockers: the transit chamber's walls and door 1, as world boxes read off the real
// meshes (L1's own solids are (axial, theta) rectangles on the player controller, which the
// camera can't use). Also a randomised sweep on the drum: wherever the player stands, the camera
// must never end up inside a blocker or have one cut its line to the player's head.

import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';

vi.stubGlobal('window', { innerWidth: 800, innerHeight: 600 });

// level1-habitation-ring.js loads its textures at import time through THREE.TextureLoader, which
// needs a browser `document`. Hand it empty textures instead — only the geometry matters here.
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal();
  class StubTextureLoader {
    load() {
      return new actual.Texture();
    }
  }
  return { ...actual, TextureLoader: StubTextureLoader };
});

vi.mock('../src/ui/hud.js', () => ({
  setInteractPrompt: vi.fn(),
}));

vi.mock('../src/core/AssetLoader.js', () => ({
  loadFuelCell: () => new THREE.Group(),
  loadGlb: () => new THREE.Group(),
}));

let Camera;
let createLevel1;

beforeAll(async () => {
  ({ Camera } = await import('../src/core/Camera.js'));
  ({ createLevel1 } = await import('../src/levels/level1-habitation-ring.js'));
}, 60000);

/** Level as main.js sets it up: group rotated, collision attached to a fake controller. */
function makeLevel() {
  const level = createLevel1();
  level.group.rotation.z = Math.PI / 2; // main.js does this right after createLevel1()
  const controller = {
    addWallBlocker: (rect) => ({ ...rect, active: true }),
    removeWallBlocker: () => {},
  };
  level.attachCollision(controller);
  return level;
}

function byName(boxes, name) {
  return boxes.find((b) => b.name === name);
}

describe('L1 camera blockers', () => {
  it('builds world boxes for the chamber walls, ceiling and door 1', () => {
    const level = makeLevel();
    const [boxes] = level.getCameraBlockers();
    for (const name of [
      'chamber-wall-left',
      'chamber-wall-right',
      'chamber-wall-far',
      'chamber-ceiling',
      'blast-door-1',
    ]) {
      expect(byName(boxes, name), name).toBeDefined();
    }
  });

  it('puts them where the player controller puts the same solids', () => {
    const level = makeLevel();
    const [boxes] = level.getCameraBlockers();
    const pad = 0.05 + 1e-6;

    // Side walls: world z = +-5, axial x in [4.5, 9.5] (the controller's 4.5..9.5 blockers).
    const left = byName(boxes, 'chamber-wall-left');
    const right = byName(boxes, 'chamber-wall-right');
    expect(Math.min(left.maxZ, right.maxZ)).toBeLessThanOrEqual(-5 + pad); // one wall at -5
    expect(Math.max(left.minZ, right.minZ)).toBeGreaterThanOrEqual(5 - pad); // one wall at +5
    // Every box is the mesh's bounds grown by 0.05 on each side (so thin planes can be hit).
    const near = (actual, expected) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(pad);
    for (const wall of [left, right]) {
      near(wall.minX, 4.5);
      near(wall.maxX, 9.5);
      near(wall.minY, 19.8);
      near(wall.maxY, 29.8);
    }

    // Door 1's slab: the controller's doorway blocker is axial 3.2..4.5 across z +-5.
    const door = byName(boxes, 'blast-door-1');
    near(door.maxX, 4.5);
    near(door.minX, 3.5);
    near(door.minZ, -5);
    near(door.maxZ, 5);
    near(door.minY, 19.8);
    near(door.maxY, 29.8);
  });

  it('drops door 1 from the camera list at the moment its collision opens', () => {
    const level = makeLevel();
    const blockers = level.getCameraBlockers();
    const [boxes] = blockers;
    expect(byName(boxes, 'blast-door-1')).toBeDefined();

    const door = level.group.getObjectByName('l1-blastdoor-1');
    door.userData.openProgress = 0.2; // still low: the player can't pass yet
    level.update(1 / 60, null, null);
    expect(byName(boxes, 'blast-door-1')).toBeDefined();

    door.userData.openProgress = 0.3; // same threshold the player's blocker uses
    level.update(1 / 60, null, null);
    expect(byName(boxes, 'blast-door-1')).toBeUndefined();
    expect(boxes.length).toBe(4); // the chamber's own walls stay
  });

  it('is live: the list the camera holds is the one the level edits', () => {
    const level = makeLevel();
    const blockers = level.getCameraBlockers();
    const cam = new Camera();
    cam.setBlockers(blockers);
    expect(cam._blockers[0]).toBe(blockers[0]);
  });

  it('keeps the camera out of the chamber walls and door, wherever the player stands', () => {
    const level = makeLevel();
    const lists = level.getCameraBlockers();
    const all = lists.flat();
    const cam = new Camera();
    cam.setBounds({ type: 'cylinder', radius: 31, axialHalfLength: 10, margin: 1.5 });
    cam.setBlockers(lists);

    // Seeded so a failure reproduces.
    let seed = 20261008;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const EPS = 1e-6;
    const inside = (p, b) =>
      p.x > b.minX + EPS && p.x < b.maxX - EPS &&
      p.y > b.minY + EPS && p.y < b.maxY - EPS &&
      p.z > b.minZ + EPS && p.z < b.maxZ - EPS;
    const cuts = (a, bpt, box) => {
      let tEnter = 0;
      let tExit = 1;
      for (const [o, d, min, max] of [
        [a.x, bpt.x - a.x, box.minX, box.maxX],
        [a.y, bpt.y - a.y, box.minY, box.maxY],
        [a.z, bpt.z - a.z, box.minZ, box.maxZ],
      ]) {
        if (Math.abs(d) < 1e-12) {
          if (o <= min + EPS || o >= max - EPS) return false;
          continue;
        }
        let t1 = (min - o) / d;
        let t2 = (max - o) / d;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tEnter = Math.max(tEnter, t1);
        tExit = Math.min(tExit, t2);
        if (tEnter >= tExit - 1e-9) return false;
      }
      return true;
    };

    const WALK_RADIUS = 29.8;
    const basis = {
      position: new THREE.Vector3(),
      up: new THREE.Vector3(),
      forward: new THREE.Vector3(),
    };
    const head = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const axial = new THREE.Vector3(1, 0, 0);

    let tested = 0;
    for (let i = 0; i < 4000; i++) {
      // Bias toward the far-side band around the chamber (theta ~ PI/2 here: world +Y).
      const theta = Math.PI / 2 + (rand() - 0.5) * (rand() < 0.7 ? 0.7 : 6.2);
      const x = (rand() - 0.5) * 18;
      basis.position.set(x, WALK_RADIUS * Math.cos(theta), WALK_RADIUS * Math.sin(theta));
      basis.up.set(0, -Math.cos(theta), -Math.sin(theta)); // toward the ring axis
      tangent.set(0, -Math.sin(theta), Math.cos(theta));
      const facing = rand() * Math.PI * 2;
      basis.forward.copy(axial).multiplyScalar(Math.cos(facing)).addScaledVector(tangent, Math.sin(facing));
      cam.yaw = (rand() - 0.5) * Math.PI * 2;
      cam.pitch = (rand() - 0.5) * 2 * (Math.PI / 2 - 0.15);

      head.copy(basis.position).addScaledVector(basis.up, 4);
      // Skip stands the player couldn't take (inside the chamber walls/door, head inside a box).
      if (all.some((b) => inside(basis.position, b) || inside(head, b))) continue;

      cam.update(basis);
      tested++;
      const p = cam.getCamera().position;
      expect(all.find((b) => inside(p, b))?.name).toBeUndefined();
      expect(all.find((b) => cuts(head, p, b))?.name).toBeUndefined();
    }
    expect(tested).toBeGreaterThan(1000);
  }, 60000);
});
