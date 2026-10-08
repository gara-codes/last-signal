// tests/level2-update.test.js
//
// level.update(delta, viewer, input) must tolerate a missing viewer (pre-spawn frames, tests):
// the updatables still tick, but nothing that reads the viewer's position runs. The early
// return that guarantees this was dropped once by a merge, so it is pinned here.

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

vi.mock('../src/ui/hud.js', () => ({
  setInteractPrompt: vi.fn(),
}));

vi.mock('../src/core/AssetLoader.js', () => ({
  loadFuelCell: () => new THREE.Group(),
  loadGlb: () => new THREE.Group(),
}));

import { createLevel2 } from '../src/levels/level2-engineering-core.js';

describe('L2 level.update without a viewer', () => {
  it('does not throw', () => {
    const level = createLevel2({ useTextures: false });
    expect(() => level.update(1 / 60)).not.toThrow();
    level.dispose();
  });

  it('still ticks the updatables (fuel cells keep spinning)', () => {
    const level = createLevel2({ useTextures: false });
    const cells = [];
    level.group.traverse((obj) => {
      if (obj.userData.isFuelCell) cells.push(obj);
    });
    expect(cells.length).toBeGreaterThan(0);

    const before = cells[0].rotation.y;
    level.update(0.5);
    expect(cells[0].rotation.y).toBeGreaterThan(before);
    level.dispose();
  });
});
