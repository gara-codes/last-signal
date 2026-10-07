import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';

// Camera.js reads window.innerWidth/innerHeight in its constructor; vitest runs in node here.
vi.stubGlobal('window', { innerWidth: 800, innerHeight: 600 });

let Camera;
beforeAll(async () => {
  ({ Camera } = await import('../src/core/Camera.js'));
});

// Player at the origin, flat level: up = +Y, facing +Z. With yaw/pitch 0 the camera wants to
// sit at (0, 9, -9) — 9 up and 9 behind — looking at the head point (0, 4, 0).
function makeBasis() {
  return {
    position: new THREE.Vector3(0, 0, 0),
    up: new THREE.Vector3(0, 1, 0),
    forward: new THREE.Vector3(0, 0, 1),
  };
}

function box(minX, maxX, minY, maxY, minZ, maxZ) {
  return { minX, maxX, minY, maxY, minZ, maxZ, name: 'test' };
}

describe('Camera blockers', () => {
  it('sits at its normal orbit position when nothing is in the way', () => {
    const cam = new Camera();
    cam.update(makeBasis());
    const p = cam.getCamera().position;
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.y).toBeCloseTo(9, 5);
    expect(p.z).toBeCloseTo(-9, 5);
  });

  it('is unaffected by blockers that are not on its line to the player', () => {
    const cam = new Camera();
    cam.setBlockers([box(20, 30, 0, 10, -20, 20)]);
    cam.update(makeBasis());
    expect(cam.getCamera().position.z).toBeCloseTo(-9, 5);
  });

  it('stops in front of a wall between the player and the camera', () => {
    const cam = new Camera();
    cam.setBlockers([box(-10, 10, 0, 10, -6, -5)]); // wall behind the player
    cam.update(makeBasis());
    // Must end up on the player's side of the wall, not behind it.
    expect(cam.getCamera().position.z).toBeGreaterThan(-5);
  });

  it('stays under a deck slab instead of rising above it (ground floor, pitching up)', () => {
    const cam = new Camera();
    cam.setBlockers([box(-10, 10, 6, 6.4, -10, 10)]); // slab overhead, player below it
    cam.update(makeBasis());
    expect(cam.getCamera().position.y).toBeLessThan(6);
  });

  it('cannot pass through a wall the player is pressed against', () => {
    const cam = new Camera();
    // Wall 0.1 behind the player: the player's head point is inside the padded box, so this
    // exercises the true-size fallback.
    cam.setBlockers([box(-10, 10, 0, 10, -1, -0.1)]);
    cam.update(makeBasis());
    expect(cam.getCamera().position.z).toBeGreaterThanOrEqual(-0.1 - 1e-6);
  });

  it('setBlockers(null) turns it off again', () => {
    const cam = new Camera();
    cam.setBlockers([box(-10, 10, 0, 10, -6, -5)]);
    cam.setBlockers(null);
    cam.update(makeBasis());
    expect(cam.getCamera().position.z).toBeCloseTo(-9, 5);
  });
});
