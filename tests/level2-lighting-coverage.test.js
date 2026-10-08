// tests/level2-lighting-coverage.test.js
//
// Every walkable cell on both storeys must be reached by at least one light
// of its own tier (the deck slab blocks the other tier). Fails if someone edits
// the grid or the light layout and leaves a cell in the dark.

import { describe, it, expect } from 'vitest';
import {
  L2_LIGHT_LAYOUT,
  LIGHT_DISTANCE,
  resolveLightPosition,
} from '../src/core/LightingRigL2.js';
import {
  GROUND_GRID,
  UPPER_GRID,
  GRID_COLS,
  GRID_ROWS,
  cellToWorld,
  isWalkable,
  storeyFloorY,
} from '../src/levels/level2/grid-data.js';

// Brightness is ~35% of inverse-square at 0.8 * distance (see rig header), so
// treat 80% of the cutoff as the practical reach.
const REACH = LIGHT_DISTANCE * 0.8;
const TIER_FOR_STOREY = { ground: 'ground', upper: 'upper' };

function walkableCells(grid) {
  const cells = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      if (isWalkable(grid[row][col])) cells.push({ col, row });
    }
  }
  return cells;
}

function isLit(storey, { col, row }) {
  const { x, z } = cellToWorld(col, row);
  const y = storeyFloorY(storey);
  return L2_LIGHT_LAYOUT.some((spec) => {
    if (spec.tier !== TIER_FOR_STOREY[storey]) return false;
    const p = resolveLightPosition(spec);
    return Math.hypot(p.x - x, p.y - y, p.z - z) <= REACH;
  });
}

describe('L2 lighting coverage', () => {
  for (const [storey, grid] of [['ground', GROUND_GRID], ['upper', UPPER_GRID]]) {
    it(`every walkable ${storey} cell is reached by a light`, () => {
      const dark = walkableCells(grid).filter((cell) => !isLit(storey, cell));
      expect(dark).toEqual([]);
    });
  }

  it('limits shadow casters to 2 lights', () => {
    expect(L2_LIGHT_LAYOUT.filter((l) => l.shadow)).toHaveLength(2);
  });
});
