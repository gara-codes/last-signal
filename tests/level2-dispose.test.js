// tests/level2-dispose.test.js
//
// Validates that createLevel2() + dispose() cleans up without throwing,
// and that the level can be recreated after dispose. The HUD module is
// mocked so the test runs in node without jsdom.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';

// Mock the HUD module — setInteractPrompt is a no-op in tests.
vi.mock('../src/ui/hud.js', () => ({
  setInteractPrompt: vi.fn(),
}));

// Mock AssetLoader — loadFuelCell / loadGlb fail on relative URLs in node.
vi.mock('../src/core/AssetLoader.js', () => ({
  loadFuelCell: () => new THREE.Group(),
  loadGlb: () => new THREE.Group(),
}));

let createLevel2;

beforeEach(async () => {
  // Dynamic import so the mocks are in place before the module loads.
  ({ createLevel2 } = await import('../src/levels/level2-engineering-core.js'));
});

describe('L2 dispose safety', () => {
  it('createLevel2() + dispose() does not throw', () => {
    const level = createLevel2();
    expect(() => level.dispose()).not.toThrow();
  });

  it('level can be recreated after dispose', () => {
    const level1 = createLevel2();
    level1.dispose();
    const level2 = createLevel2();
    expect(level2.group).toBeDefined();
    level2.dispose();
  });

  it('collisionData is exposed and has expected shape', () => {
    const level = createLevel2();
    expect(level.collisionData).toBeDefined();
    expect(level.collisionData.wallAABBs).toBeInstanceOf(Array);
    expect(level.collisionData.railAABBs).toBeInstanceOf(Array);
    expect(level.collisionData.rampSurfaces).toBeInstanceOf(Array);
    expect(level.collisionData.floorSpec).toBeDefined();
    level.dispose();
  });

  it('getSpawnView returns position and lookAt', () => {
    const level = createLevel2();
    const spawn = level.getSpawnView();
    expect(spawn.position).toBeDefined();
    expect(spawn.lookAt).toBeDefined();
    expect(spawn.position.x).toBeDefined();
    expect(spawn.position.y).toBeDefined();
    expect(spawn.position.z).toBeDefined();
    level.dispose();
  });
});
