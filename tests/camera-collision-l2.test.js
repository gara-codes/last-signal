// tests/camera-collision-l2.test.js
//
// Property test against the REAL L2 level: wherever the player stands and however the camera is
// aimed, the camera must never end up inside a blocker, and no blocker may cut the line from the
// player's head to the camera. (Hand-picked cases miss things — a randomised sweep over the real
// geometry found camera positions inside pylons that no small unit test had thought of.)

import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';

vi.stubGlobal('window', { innerWidth: 800, innerHeight: 600 });

vi.mock('../src/ui/hud.js', () => ({
  setInteractPrompt: vi.fn(),
}));

vi.mock('../src/core/AssetLoader.js', () => ({
  loadFuelCell: () => new THREE.Group(),
  loadGlb: () => new THREE.Group(),
}));

let Camera;
let createLevel2;
let HALL;
let GROUND_Y;
let DECK_Y;
let CEILING_Y;

beforeAll(async () => {
  ({ Camera } = await import('../src/core/Camera.js'));
  ({ createLevel2 } = await import('../src/levels/level2-engineering-core.js'));
  ({ HALL, GROUND_Y, DECK_Y, CEILING_Y } = await import('../src/levels/level2/grid-data.js'));
}, 60000); // loads the whole L2 module graph; the default 10s can trip on a busy machine

// Seeded so a failure reproduces.
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EPS = 1e-6;

function strictlyInside(p, b) {
  return (
    p.x > b.minX + EPS && p.x < b.maxX - EPS &&
    p.y > b.minY + EPS && p.y < b.maxY - EPS &&
    p.z > b.minZ + EPS && p.z < b.maxZ - EPS
  );
}

/** Does the open segment a->b pass through the interior of `b`? Independent of Camera.js. */
function segmentCutsBox(a, bpt, box) {
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
}

describe('camera blockers on the real L2 level', () => {
  it('never ends up inside a blocker, and no blocker cuts the head-to-camera line', () => {
    const level = createLevel2({ useTextures: false });
    const lists = level.cameraBlockers;
    const all = lists.flat();
    expect(all.length).toBeGreaterThan(50); // walls/modules AND deck slabs, not an empty list

    const cam = new Camera();
    cam.setBounds({
      type: 'box',
      minX: HALL.minX, maxX: HALL.maxX,
      minY: GROUND_Y, maxY: CEILING_Y,
      minZ: HALL.minZ, maxZ: HALL.maxZ,
      margin: 1,
    });
    cam.setOrbitDistance(13.5);
    cam.setBlockers(lists);

    const rand = mulberry32(20261008);
    const head = new THREE.Vector3();
    const basis = {
      position: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      forward: new THREE.Vector3(),
    };

    let tested = 0;
    let failures = 0;
    let firstFailure = null;
    for (let i = 0; i < 4000; i++) {
      const floorY = rand() < 0.5 ? GROUND_Y : DECK_Y;
      basis.position.set(
        HALL.minX + 2 + rand() * (HALL.maxX - HALL.minX - 4),
        floorY,
        HALL.minZ + 2 + rand() * (HALL.maxZ - HALL.minZ - 4)
      );
      const facing = rand() * Math.PI * 2;
      basis.forward.set(Math.sin(facing), 0, Math.cos(facing));
      cam.yaw = (rand() - 0.5) * Math.PI * 2;
      cam.pitch = (rand() - 0.5) * 2 * (Math.PI / 2 - 0.15);

      head.copy(basis.position).setY(basis.position.y + 4);
      // Only judge stands the player could really take: not inside a wall, head not inside a box.
      const feet = basis.position;
      if (all.some((b) => strictlyInside(feet, b) || strictlyInside(head, b))) continue;

      cam.update(basis);
      tested++;

      const p = cam.getCamera().position;
      const insideBox = all.find((b) => strictlyInside(p, b));
      const cutBy = all.find((b) => segmentCutsBox(head, p, b));
      if (insideBox || cutBy) {
        failures++;
        firstFailure ??= {
          i,
          feet: feet.toArray().map((n) => +n.toFixed(2)),
          camera: p.toArray().map((n) => +n.toFixed(2)),
          insideBox: insideBox?.name,
          cutBy: cutBy?.name,
        };
      }
    }

    expect(tested).toBeGreaterThan(1000);
    expect(firstFailure).toBeNull();
    expect(failures).toBe(0);
  }, 60000);

  it('includes the command door and elevator gates, and follows a gate being spliced out', () => {
    const level = createLevel2({ useTextures: false });
    const walls = level.collisionData.wallAABBs;
    const names = walls.map((b) => b.name);
    expect(names).toContain('command-door-slab'); // added by placeAnchors, after the geometry

    // The camera's wall list is the same array the level mutates, not a copy.
    expect(level.cameraBlockers[0]).toBe(walls);
    const before = walls.length;
    const removed = walls.pop();
    expect(level.cameraBlockers[0].length).toBe(before - 1);
    walls.push(removed);
  });
});
