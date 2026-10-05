// tests/level2-props.test.js
//
// Validates the userData contract every prop builder must satisfy:
// interactable flag, prompt shape, update hooks, and per-prop state.
// Uses useTextures:false to keep the test DOM-free.

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

// Mock loadFuelCell so createFuelCellSpawn can run without a browser
// (GLTFLoader fails on relative URLs in node).
vi.mock('../src/core/AssetLoader.js', () => ({
  loadFuelCell: () => new THREE.Group(),
  loadGlb: (path, scale) => new THREE.Group(),
}));

import {
  createBlockoutMaterials,
  createPylon,
  createOxygenStation,
  createGravityStation,
  createCommsStation,
  createCommandDoor,
  createOverrideTerminal,
  createCameraMount,
  createFuelCellSpawn,
  createStrip,
  createBeacon,
} from '../src/levels/level2/props.js';
import { FuelSystem } from '../src/systems/fuel-system.js';
import { createElevator, createLadder, createStarfield } from '../src/levels/level2/transit.js';
import { TRANSIT, DECK_Y, cellToWorld } from '../src/levels/level2/grid-data.js';

const mats = createBlockoutMaterials({ useTextures: false });

// Minimal stand-ins for the orchestrator's registries and maze-builder's
// collision registry, so the transit builders run DOM-free.
function fakeCollision() {
  const wallAABBs = [];
  const railAABBs = [];
  const push =
    (list) =>
    (cx, cy, cz, sx, sy, sz, name) =>
      list.push({
        minX: cx - sx / 2,
        maxX: cx + sx / 2,
        minY: cy - sy / 2,
        maxY: cy + sy / 2,
        minZ: cz - sz / 2,
        maxZ: cz + sz / 2,
        name,
      });
  return {
    wallAABBs,
    railAABBs,
    rampSurfaces: [],
    addWall: push(wallAABBs),
    addRail: push(railAABBs),
  };
}

function fakeRegistries() {
  return {
    interactables: [],
    updatables: [],
    transit: { onTeleport: null, onRide: null },
    collision: fakeCollision(),
  };
}

describe('L2 prop builders — userData contract', () => {
  it('createPylon returns a Group with id and setPowered', () => {
    const pylon = createPylon(mats);
    expect(pylon).toBeInstanceOf(THREE.Group);
    expect(pylon.userData.id).toBe('energy-pylon');
    expect(typeof pylon.userData.setPowered).toBe('function');
    // setPowered toggles emissive intensity
    pylon.userData.setPowered(false);
    expect(pylon.userData.glow.emissiveIntensity).toBeCloseTo(0.05);
    pylon.userData.setPowered(true);
    expect(pylon.userData.glow.emissiveIntensity).toBeCloseTo(1.4);
  });

  it('createOxygenStation returns an interactable station', () => {
    const station = createOxygenStation(mats);
    expect(station).toBeInstanceOf(THREE.Group);
    expect(station.userData.interactable).toBe(true);
    expect(station.userData.system).toBe('oxygen');
    expect(station.userData.repairState).toBe('untouched');
    expect(station.userData.getPrompt()).toEqual({
      label: 'Access Console',
      detail: 'Oxygen Scrubbers',
    });
    expect(typeof station.userData.interact).toBe('function');
    expect(typeof station.userData.update).toBe('function');
  });

  it('createGravityStation has spinning rings', () => {
    const station = createGravityStation(mats);
    expect(station.userData.system).toBe('gravity');
    expect(station.userData.rings).toHaveLength(3);
    for (const ring of station.userData.rings) {
      expect(ring.userData.spinAxis).toBeDefined();
    }
  });

  it('createCommsStation returns an interactable station', () => {
    const station = createCommsStation(mats);
    expect(station.userData.system).toBe('comms');
    expect(station.userData.getPrompt().detail).toBe('Comms Array');
  });

  it('createCommandDoor returns an interactable door with slab', () => {
    const door = createCommandDoor(mats);
    expect(door.userData.id).toBe('l2-command-door');
    expect(door.userData.interactable).toBe(true);
    expect(door.userData.door).toBeDefined();
    expect(door.userData.getPrompt()).toEqual({
      label: 'Open Door',
      detail: 'Override Required',
      denied: true,
    });
    expect(typeof door.userData.update).toBe('function');
  });

  it('createOverrideTerminal returns an interactable terminal', () => {
    const terminal = createOverrideTerminal(mats);
    expect(terminal.userData.id).toBe('override-terminal');
    expect(terminal.userData.interactable).toBe(true);
    expect(terminal.userData.getPrompt(new FuelSystem(0))).toEqual({
      label: 'Reroute Power',
      detail: '0 / 1 Fuel Cell',
      denied: true,
    });
    expect(terminal.userData.getPrompt(new FuelSystem(1)).denied).toBe(false);
  });

  it('createCameraMount yaw-tracks the viewer with a fixed 30° tilt', () => {
    const camera = createCameraMount(mats);
    expect(camera.userData.id).toBe('surveillance-camera');
    expect(typeof camera.userData.update).toBe('function');

    camera.position.set(0, 22.5, -29.1);
    const viewer = new THREE.Object3D();
    viewer.position.set(5, 2, 3);
    camera.userData.update(1 / 60, viewer);
    expect(camera.rotation.order).toBe('YXZ');
    expect(camera.rotation.y).toBeCloseTo(Math.atan2(5, 3 + 29.1));
    expect(camera.rotation.x).toBeCloseTo(Math.PI / 6);

    // No viewer (tests / pre-spawn frames) — holds the last pose, no throw.
    expect(() => camera.userData.update(1 / 60, undefined)).not.toThrow();
  });

  it('createFuelCellSpawn returns a pickup-ready cell', () => {
    const fuelSystem = new FuelSystem(0);
    const cell = createFuelCellSpawn(fuelSystem);
    expect(cell.userData.isFuelCell).toBe(true);
    expect(cell.userData.collected).toBe(false);
    expect(cell.userData.interactable).toBe(true);
    expect(cell.userData.prompt).toEqual({ label: 'Collect Fuel Cell', hint: true });
    expect(typeof cell.userData.interact).toBe('function');
    // Interact credits the fuel system and marks collected
    cell.userData.interact();
    expect(cell.userData.collected).toBe(true);
    expect(fuelSystem.count).toBe(1);
  });

  it('createStrip returns a Group with setHonest hook', () => {
    const strip = createStrip(mats, 'test-route', 0);
    expect(strip.userData.routeId).toBe('test-route');
    expect(strip.userData.index).toBe(0);
    expect(strip.userData.honest).toBe(true);
    expect(typeof strip.userData.setHonest).toBe('function');
  });

  it('createBeacon returns a Group', () => {
    const beacon = createBeacon(mats, 0x35d6e8);
    expect(beacon).toBeInstanceOf(THREE.Group);
  });
});

describe('L2 transit — elevator', () => {
  it('builds the cab, sealed gates and shaft collision in idle-ground state', () => {
    const registries = fakeRegistries();
    const elevator = createElevator(mats, registries, registries.collision, TRANSIT.elevator);

    expect(elevator.userData.id).toBe('l2-elevator');
    expect(elevator.userData.state).toBe('idle-ground');
    expect(elevator.userData.cab.name).toBe('elevator-cab');
    expect(elevator.userData.gates.ground.userData.state).toBe('locked');
    expect(elevator.userData.gates.upper.userData.state).toBe('locked');
    expect(elevator.userData.cabDoor.userData.state).toBe('locked');

    const names = registries.collision.wallAABBs.map((a) => a.name);
    expect(names).toContain('elevator-shaft-east');
    expect(names).toContain('elevator-shaft-west');
    expect(names).toContain('elevator-shaft-south');
    expect(names).toContain('elevator-gate-ground');
    expect(names).toContain('elevator-gate-upper');

    expect(registries.interactables.map((o) => o.name)).toEqual(
      expect.arrayContaining([
        'l2-elevator-call-ground',
        'l2-elevator-call-upper',
        'l2-elevator-send',
      ])
    );
    expect(registries.updatables).toContain(elevator);
  });

  it('calling the cab to its current floor opens the gates and splices their AABBs', () => {
    const registries = fakeRegistries();
    const elevator = createElevator(mats, registries, registries.collision, TRANSIT.elevator);

    elevator.userData.callTo('ground');
    for (let i = 0; i < 60; i++) elevator.userData.update(1 / 20, null); // 3 s > 1.5 s doors

    expect(elevator.userData.gates.ground.userData.state).toBe('open');
    expect(elevator.userData.cabDoor.userData.state).toBe('open');
    const names = registries.collision.wallAABBs.map((a) => a.name);
    expect(names).not.toContain('elevator-gate-ground'); // spliced while open
    expect(names).toContain('elevator-gate-upper'); // other floor stays sealed
  });

  it('send() closes up, restores the gate AABBs and rides to the upper deck', () => {
    const registries = fakeRegistries();
    const elevator = createElevator(mats, registries, registries.collision, TRANSIT.elevator);

    elevator.userData.send();
    for (let i = 0; i < 200; i++) elevator.userData.update(1 / 20, null); // 10 s > 4 s travel

    expect(elevator.userData.state).toBe('idle-upper');
    expect(elevator.userData.cab.position.y).toBeCloseTo(DECK_Y);
    expect(elevator.userData.gates.upper.userData.state).toBe('open');
    const names = registries.collision.wallAABBs.map((a) => a.name);
    expect(names).not.toContain('elevator-gate-upper'); // arrival opened it
    expect(names).toContain('elevator-gate-ground'); // re-seated when sealed
  });

  it('carries a viewer standing in the cab (default direct mutation)', () => {
    const registries = fakeRegistries();
    const elevator = createElevator(mats, registries, registries.collision, TRANSIT.elevator);

    const viewer = new THREE.Object3D();
    viewer.position.set(cellToWorld(TRANSIT.elevator.col, TRANSIT.elevator.row).x, 0, 33.6);

    elevator.userData.send();
    for (let i = 0; i < 200; i++) elevator.userData.update(1 / 20, viewer);

    expect(elevator.userData.state).toBe('idle-upper');
    expect(viewer.position.y).toBeCloseTo(DECK_Y, 1);
  });

  it('routes the carry through the onRide handler when one is wired', () => {
    const registries = fakeRegistries();
    const elevator = createElevator(mats, registries, registries.collision, TRANSIT.elevator);

    const viewer = new THREE.Object3D();
    viewer.position.set(cellToWorld(TRANSIT.elevator.col, TRANSIT.elevator.row).x, 0, 33.6);

    const rides = [];
    registries.transit.onRide = (cabFloorY) => {
      rides.push(cabFloorY);
      // What main.js's setSpawn effectively does — the viewer follows.
      viewer.position.y = cabFloorY;
    };

    elevator.userData.send();
    for (let i = 0; i < 200; i++) elevator.userData.update(1 / 20, viewer);

    expect(rides.length).toBeGreaterThan(0);
    expect(rides[rides.length - 1]).toBeCloseTo(DECK_Y, 1);
  });

  it('carries the viewer through descent even when physics snaps to storey floor', () => {
    // Simulates FlatPhysicsController snapping the player to the nearest storey floor
    // (y=12 when above y=6). The riding flag + x/z-only check should keep the carry
    // working even though the viewer's y is snapped away from the cab mid-descent.
    const registries = fakeRegistries();
    const elevator = createElevator(mats, registries, registries.collision, TRANSIT.elevator);

    const viewer = new THREE.Object3D();
    viewer.position.set(cellToWorld(TRANSIT.elevator.col, TRANSIT.elevator.row).x, DECK_Y, 33.6);

    const rides = [];
    registries.transit.onRide = (cabFloorY) => {
      rides.push(cabFloorY);
      viewer.position.y = cabFloorY;
    };

    // First, send the elevator to the upper deck (it starts at ground)
    elevator.userData.send();
    for (let i = 0; i < 200; i++) elevator.userData.update(1 / 20, viewer);
    expect(elevator.userData.state).toBe('idle-upper');

    // Now send it back down — this is the descent test
    rides.length = 0; // clear the rides from the ascent
    elevator.userData.send();
    for (let i = 0; i < 200; i++) {
      elevator.userData.update(1 / 20, viewer);
    }

    expect(elevator.userData.state).toBe('idle-ground');
    expect(rides.length).toBeGreaterThan(0);
    expect(rides[rides.length - 1]).toBeCloseTo(0, 1);
  });
});

describe('L2 transit — ladder and starfield', () => {
  it('registers an interactable + updatable with rail collision', () => {
    const registries = fakeRegistries();
    const ladder = createLadder(mats, registries, TRANSIT.ladder);

    expect(ladder.userData.id).toBe('l2-ladder');
    expect(ladder.userData.interactable).toBe(true);
    expect(registries.interactables).toContain(ladder);
    expect(registries.updatables).toContain(ladder);
    expect(registries.collision.railAABBs).toHaveLength(3);
  });

  it('teleports direction-aware via direct mutation (default path)', () => {
    const registries = fakeRegistries();
    const ladder = createLadder(mats, registries, TRANSIT.ladder);

    const viewer = new THREE.Object3D();
    const { x, z } = cellToWorld(TRANSIT.ladder.col, TRANSIT.ladder.row);

    viewer.position.set(x, DECK_Y, z);
    ladder.userData.update(1 / 60, viewer);
    expect(ladder.userData.prompt.label).toBe('Climb Down');
    ladder.userData.interact();
    expect(viewer.position.y).toBe(0);

    ladder.userData.update(1 / 60, viewer);
    expect(ladder.userData.prompt.label).toBe('Climb Up');
    ladder.userData.interact();
    expect(viewer.position.y).toBe(DECK_Y);
  });

  it('routes the teleport through the onTeleport handler when wired', () => {
    const registries = fakeRegistries();
    const ladder = createLadder(mats, registries, TRANSIT.ladder);
    const teleports = [];
    registries.transit.onTeleport = (x, y, z, yaw) => teleports.push([x, y, z, yaw]);

    const viewer = new THREE.Object3D();
    viewer.position.set(0, DECK_Y, 0);
    ladder.userData.update(1 / 60, viewer);
    ladder.userData.interact();

    expect(teleports).toHaveLength(1);
    expect(teleports[0][1]).toBe(0); // deck side → down
    expect(teleports[0][3]).toBe(0); // yaw faces away from the wall
    expect(viewer.position.y).toBe(DECK_Y); // never mutated directly
  });

  it('createStarfield returns a ~2k-point sphere beyond the shaft', () => {
    const stars = createStarfield(TRANSIT.elevator);
    expect(stars).toBeInstanceOf(THREE.Points);
    expect(stars.geometry.getAttribute('position').count).toBe(2000);
  });

  it('teleport targets do not overlap rail collision AABBs', () => {
    const registries = fakeRegistries();
    const ladder = createLadder(mats, registries, TRANSIT.ladder);
    const { x, z } = cellToWorld(TRANSIT.ladder.col, TRANSIT.ladder.row);

    // UP target: z + 2.6 (clears ladder-rail-south max z = 1.95)
    // DOWN target: z + 0.5 (clears ladder-rail-south min z = 1.35)
    const upTarget = { x, y: DECK_Y, z: z + 2.6 };
    const downTarget = { x, y: 0, z: z + 0.5 };

    // Player capsule radius 0.6 — check AABB doesn't overlap any rail
    const playerRadius = 0.6;
    for (const rail of registries.collision.railAABBs) {
      // UP target AABB
      const upMinX = upTarget.x - playerRadius;
      const upMaxX = upTarget.x + playerRadius;
      const upMinZ = upTarget.z - playerRadius;
      const upMaxZ = upTarget.z + playerRadius;
      const upOverlaps = !(upMaxX < rail.minX || upMinX > rail.maxX || upMaxZ < rail.minZ || upMinZ > rail.maxZ);
      expect(upOverlaps).toBe(false);

      // DOWN target AABB
      const downMinX = downTarget.x - playerRadius;
      const downMaxX = downTarget.x + playerRadius;
      const downMinZ = downTarget.z - playerRadius;
      const downMaxZ = downTarget.z + playerRadius;
      const downOverlaps = !(downMaxX < rail.minX || downMinX > rail.maxX || downMaxZ < rail.minZ || downMinZ > rail.maxZ);
      expect(downOverlaps).toBe(false);
    }
  });
});
