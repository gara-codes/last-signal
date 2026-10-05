// tests/level2-checkpoint.test.js
//
// Restart From Checkpoint: the snapshot L2 saves when the override item is collected must be
// enough for createLevel2({ checkpoint }) to rebuild the level as it was at that moment.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';

vi.mock('../src/ui/hud.js', () => ({
  setInteractPrompt: vi.fn(),
}));

vi.mock('../src/core/AssetLoader.js', () => ({
  loadFuelCell: () => new THREE.Group(),
  loadGlb: () => new THREE.Group(),
}));

let createLevel2;

beforeEach(async () => {
  ({ createLevel2 } = await import('../src/levels/level2-engineering-core.js'));
});

function fuelCellsIn(level) {
  const cells = [];
  level.group.traverse((obj) => {
    if (obj.userData.isFuelCell) cells.push(obj);
  });
  return cells;
}

/** Plays the first part of L2: one cell, one repair, the override — then the checkpoint saves. */
function playToCheckpoint() {
  const level = createLevel2({ useTextures: false, startingReserve: 4 });
  const { fuelSystem, repairs, override, oxygenSystem } = level.group.userData;

  fuelCellsIn(level)[0].userData.interact(); // 5 cells
  repairs.repair('comms-array', fuelSystem); // 3 cells, comms partial
  override.unlockTerminal(fuelSystem); // 2 cells
  override.collectOverride();
  oxygenSystem.oxygen = 40;
  oxygenSystem.health = 75;

  // Far from every cell so nothing else gets picked up; facing yaw 0.5 the way
  // FlatPhysicsController poses the model (facingYaw + PI about +Y).
  const viewer = new THREE.Object3D();
  viewer.position.set(3, 1000, 4);
  viewer.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.5 + Math.PI);
  level.update(1 / 60, viewer, {});

  return level;
}

describe('L2 checkpoint restore', () => {
  it('saves world state along with the player state', () => {
    const level = playToCheckpoint();
    const snapshot = level.group.userData.checkpoint.load();
    expect(snapshot.fuelCount).toBe(2);
    expect(snapshot.repairs['comms-array']).toBe('partial');
    expect(snapshot.override).toEqual({ terminalUnlocked: true, hasOverrideItem: true });
    expect(snapshot.collectedCells).toEqual([0]);
    expect(snapshot.yaw).toBeCloseTo(0.5);
    level.dispose();
  });

  it('createLevel2({ checkpoint }) rebuilds the level as it was there', () => {
    const before = playToCheckpoint();
    const snapshot = before.group.userData.checkpoint.load();
    const cellCount = fuelCellsIn(before).length + 1; // one was removed from the scene
    before.dispose();

    const level = createLevel2({ useTextures: false, startingReserve: 99, checkpoint: snapshot });
    const { fuelSystem, repairs, override, oxygenSystem, checkpoint } = level.group.userData;

    expect(fuelSystem.banked).toBe(2); // the snapshot's count, not startingReserve
    expect(repairs.getState('comms-array')).toBe('partial');
    expect(repairs.getState('gravity-stabilizers')).toBe('untouched');
    expect(override.hasOverrideItem).toBe(true);
    expect(override.terminalUnlocked).toBe(true);
    expect(oxygenSystem.oxygen).toBe(snapshot.oxygen); // ~40 (one frame of drain)
    expect(oxygenSystem.health).toBe(snapshot.health);
    expect(snapshot.oxygen).toBeCloseTo(40, 0);
    expect(fuelCellsIn(level)).toHaveLength(cellCount - 1); // the collected cell stays gone
    expect(checkpoint.hasSnapshot()).toBe(true); // dying again comes back here too

    const spawn = level.getPlayerSpawn();
    expect(spawn).toMatchObject({ x: 3, y: 1000, z: 4 });
    expect(spawn.yaw).toBeCloseTo(0.5);

    // The repair station seeds its prompt state from the restored allocator.
    expect(level.__anchors.stations.comms.userData.repairState).toBe('partial');
    level.dispose();
  });

  it('a fresh L2 still spawns at the level start with the carried fuel', () => {
    const level = createLevel2({ useTextures: false, startingReserve: 3 });
    expect(level.group.userData.fuelSystem.banked).toBe(3);
    expect(level.group.userData.checkpoint.hasSnapshot()).toBe(false);
    expect(level.getPlayerSpawn().y).not.toBe(1000);
    level.dispose();
  });
});
