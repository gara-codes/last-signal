// tests/level2-props.test.js
//
// Validates the userData contract every prop builder must satisfy:
// interactable flag, prompt shape, update hooks, and per-prop state.
// Uses useTextures:false to keep the test DOM-free.

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
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

const mats = createBlockoutMaterials({ useTextures: false });

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
    expect(station.userData.prompt.label).toContain('Oxygen');
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
    expect(station.userData.prompt.label).toContain('Comms');
  });

  it('createCommandDoor returns an interactable door with slab', () => {
    const door = createCommandDoor(mats);
    expect(door.userData.id).toBe('l2-command-door');
    expect(door.userData.interactable).toBe(true);
    expect(door.userData.door).toBeDefined();
    expect(door.userData.prompt.label).toContain('Override');
    expect(typeof door.userData.update).toBe('function');
  });

  it('createOverrideTerminal returns an interactable terminal', () => {
    const terminal = createOverrideTerminal(mats);
    expect(terminal.userData.id).toBe('override-terminal');
    expect(terminal.userData.interactable).toBe(true);
    expect(terminal.userData.prompt.label).toContain('Reroute');
  });

  it('createCameraMount returns a Group with update (pan sweep)', () => {
    const camera = createCameraMount(mats);
    expect(camera.userData.id).toBe('surveillance-camera');
    expect(typeof camera.userData.update).toBe('function');
  });

  // Skipped: createFuelCellSpawn calls loadFuelCell() which tries to parse
  // a relative URL in node — requires a browser environment.
  it.skip('createFuelCellSpawn returns a pickup-ready cell (requires browser)', () => {
    const fuelSystem = new FuelSystem(0);
    const cell = createFuelCellSpawn(fuelSystem);
    expect(cell.userData.isFuelCell).toBe(true);
    expect(cell.userData.collected).toBe(false);
    expect(cell.userData.interactable).toBe(true);
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
