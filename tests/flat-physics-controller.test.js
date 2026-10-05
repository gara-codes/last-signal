// tests/flat-physics-controller.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FlatPhysicsController } from '../src/systems/flat-physics-controller.js';

const FLOOR_SPEC = { groundY: 0, deckY: 8, cellSize: 4, hall: { minX: -32, maxX: 32, minZ: -20, maxZ: 20 } };

function makeController(collisionData) {
  const player = new THREE.Group();
  const controller = new FlatPhysicsController(player, {
    wallAABBs: [],
    railAABBs: [],
    rampSurfaces: [],
    floorSpec: FLOOR_SPEC,
    ...collisionData,
  });
  return { player, controller };
}

describe('FlatPhysicsController', () => {
  it('exposes getSurfaceBasis() with world-up and starts on the ground floor', () => {
    const { player, controller } = makeController();
    controller.update(0, {});
    const basis = player.userData.getSurfaceBasis();
    expect(basis.up.equals(new THREE.Vector3(0, 1, 0))).toBe(true);
    expect(basis.position.y).toBe(0);
  });

  it('moves forward (W) along the player facing', () => {
    const { controller } = makeController();
    controller.setSpawn(0, 0, 0, 0);
    controller.update(1, { axialAxis: -1, tangentAxis: 0 });
    // W -> axialAxis -1 -> fwdInput +1 -> moves toward +Z at yaw 0.
    expect(controller.position.z).toBeGreaterThan(0);
    expect(controller.position.x).toBeCloseTo(0, 5);
  });

  it('strafes with A/D and backpedals with S without turning the player', () => {
    for (const [input, check] of [
      [{ axialAxis: 0, tangentAxis: 1 }, (c) => expect(c.position.x).toBeLessThan(0)], // D: right = -X
      [{ axialAxis: 0, tangentAxis: -1 }, (c) => expect(c.position.x).toBeGreaterThan(0)], // A: left = +X
      [{ axialAxis: 1, tangentAxis: 0 }, (c) => expect(c.position.z).toBeLessThan(0)], // S: back = -Z
    ]) {
      const { controller } = makeController();
      controller.setSpawn(0, 0, 0, 0);
      for (let i = 0; i < 30; i++) controller.update(1 / 30, input);
      check(controller);
      expect(controller.facingYaw).toBeCloseTo(0, 5);
    }
  });

  it('turns toward the diagonal on W+A (left) and W+D (right)', () => {
    const left = makeController().controller;
    left.setSpawn(0, 0, 0, 0);
    left.update(1 / 30, { axialAxis: -1, tangentAxis: -1 });
    expect(left.facingYaw).toBeGreaterThan(0); // toward +X, the player's left

    const right = makeController().controller;
    right.setSpawn(0, 0, 0, 0);
    right.update(1 / 30, { axialAxis: -1, tangentAxis: 1 });
    expect(right.facingYaw).toBeLessThan(0);
  });

  it('clamps movement into a wall on the penetrating axis but slides along the other (diagonal collision)', () => {
    // A wall spanning the full Z range at x in [1, 2] — blocks +X movement
    // but not +Z movement.
    const { controller } = makeController({
      wallAABBs: [{ minX: 1, maxX: 2, minY: 0, maxY: 3, minZ: -100, maxZ: 100, name: 'test-wall' }],
    });
    // Face the +X/+Z diagonal and walk forward: movement is relative to the
    // player's facing, so W heads straight at the wall at 45°.
    controller.setSpawn(0, 0, 0, Math.PI / 4);
    for (let i = 0; i < 30; i++) {
      controller.update(1 / 30, { axialAxis: -1, tangentAxis: 0 });
    }
    // X should have been stopped short of the wall (0.4 player radius clearance).
    expect(controller.position.x).toBeLessThan(1);
    // Z should have kept advancing — the wall only blocks X, so the slide
    // along Z was not blocked.
    expect(controller.position.z).toBeGreaterThan(0.5);
  });

  it('does not pass through a wall that spans both axes', () => {
    const { controller } = makeController({
      wallAABBs: [{ minX: -1, maxX: 1, minY: 0, maxY: 3, minZ: -1, maxZ: 1, name: 'test-wall' }],
    });
    controller.setSpawn(0, 0, -5, 0);
    for (let i = 0; i < 60; i++) {
      controller.update(1 / 30, { axialAxis: -1, tangentAxis: 0, cameraYaw: 0 });
    }
    expect(controller.position.z).toBeLessThan(-1);
  });

  it('resolves height on a ramp between ground and deck level', () => {
    const { controller } = makeController({
      rampSurfaces: [{ minX: -4, maxX: 4, minZ: -4, maxZ: 4, lowSide: 'S', id: 'ramp-test' }],
    });
    // lowSide 'S' -> low at south (+Z), rises toward north (-Z).
    controller.setSpawn(0, 0, 4, 0); // at the low edge
    controller.update(0, {});
    expect(controller.position.y).toBeCloseTo(0, 5);

    controller.setSpawn(0, 8, -4, 0); // at the high edge
    controller.update(0, {});
    expect(controller.position.y).toBeCloseTo(8, 5);
  });

  it('jump launches upward then returns to the floor (grounded again)', () => {
    const { controller } = makeController();
    controller.setSpawn(0, 0, 0, 0);
    controller.update(1 / 60, { jump: true });
    expect(controller.isGrounded).toBe(false);
    expect(controller.position.y).toBeGreaterThan(0);

    // Run enough frames for gravity to bring it back down.
    for (let i = 0; i < 120; i++) {
      controller.update(1 / 60, {});
    }
    expect(controller.isGrounded).toBe(true);
    expect(controller.position.y).toBeCloseTo(0, 5);
  });
});
