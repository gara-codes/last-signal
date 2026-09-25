// tests/level2-dispose.test.js
//
// Validates that createLevel2() + dispose() cleans up without throwing,
// and that the level can be recreated after dispose. This test requires
// a DOM environment (hud.js imports CSS and DOM utilities).
//
// If vitest is not configured with jsdom/happy-dom, this test will be
// skipped automatically.

import { describe, it, expect } from 'vitest';

// Guard: skip if document is not available (node environment).
const hasDOM = typeof document !== 'undefined';

describe.skipIf(!hasDOM)('L2 dispose safety', () => {
  it('createLevel2() + dispose() does not throw', async () => {
    const { createLevel2 } = await import('../src/levels/level2-engineering-core.js');
    const level = createLevel2();
    expect(() => level.dispose()).not.toThrow();
  });

  it('level can be recreated after dispose', async () => {
    const { createLevel2 } = await import('../src/levels/level2-engineering-core.js');
    const level1 = createLevel2();
    level1.dispose();
    const level2 = createLevel2();
    expect(level2.group).toBeDefined();
    level2.dispose();
  });

  it('collisionData is exposed and has expected shape', async () => {
    const { createLevel2 } = await import('../src/levels/level2-engineering-core.js');
    const level = createLevel2();
    expect(level.collisionData).toBeDefined();
    expect(level.collisionData.wallAABBs).toBeInstanceOf(Array);
    expect(level.collisionData.railAABBs).toBeInstanceOf(Array);
    expect(level.collisionData.rampSurfaces).toBeInstanceOf(Array);
    expect(level.collisionData.floorSpec).toBeDefined();
    level.dispose();
  });

  it('getSpawnView returns position and lookAt', async () => {
    const { createLevel2 } = await import('../src/levels/level2-engineering-core.js');
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
