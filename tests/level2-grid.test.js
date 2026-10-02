// tests/level2-grid.test.js
//
// Validates the authored maze data: grid shape, anchor placements, ramp
// footprints, strip routes, and BFS solvability of every critical path.
// If a maze edit bricks a route, the test names exactly which one.

import { describe, it, expect } from 'vitest';
import {
  GROUND_GRID,
  UPPER_GRID,
  GRID_ROWS,
  GRID_COLS,
  RAMPS,
  PLACEMENTS,
  STRIP_ROUTES,
  validateLayout,
  buildWalkGraph,
  findPath,
  rampsOnPath,
  carveRamps,
  getCell,
  isWalkable,
  keyOf,
} from '../src/levels/level2/grid-data.js';

describe('L2 grid shape', () => {
  it('has the expected row and column counts', () => {
    expect(GROUND_GRID).toHaveLength(GRID_ROWS);
    expect(UPPER_GRID).toHaveLength(GRID_ROWS);
    for (const row of GROUND_GRID) expect(row).toHaveLength(GRID_COLS);
    for (const row of UPPER_GRID) expect(row).toHaveLength(GRID_COLS);
  });

  it('GROUND_GRID contains no atrium voids (~)', () => {
    expect(GROUND_GRID.some((row) => row.includes('~'))).toBe(false);
  });

  it('every cell is a valid code (#, ., or ~)', () => {
    const valid = new Set(['#', '.', '~']);
    for (const grid of [GROUND_GRID, UPPER_GRID]) {
      for (const row of grid) {
        for (const ch of row) {
          expect(valid.has(ch)).toBe(true);
        }
      }
    }
  });
});

describe('L2 layout validation', () => {
  it('validateLayout() returns no problems for the shipped maze', () => {
    const problems = validateLayout();
    expect(problems).toEqual([]);
  });
});

describe('L2 ramp footprints', () => {
  it('ramp cells are walkable on both storeys after carving', () => {
    const ground = carveRamps(GROUND_GRID);
    const upper = carveRamps(UPPER_GRID);
    for (const ramp of RAMPS) {
      for (const col of ramp.cols) {
        for (const row of ramp.rows) {
          expect(isWalkable(getCell(ground, col, row))).toBe(true);
          expect(isWalkable(getCell(upper, col, row))).toBe(true);
        }
      }
    }
  });
});

describe('L2 strip routes', () => {
  it('every strip route is 4-adjacent and on walkable cells', () => {
    const ground = carveRamps(GROUND_GRID);
    const upper = carveRamps(UPPER_GRID);
    const grids = { ground, upper };
    for (const route of STRIP_ROUTES) {
      const grid = grids[route.storey];
      for (let i = 0; i < route.cells.length; i++) {
        const [col, row] = route.cells[i];
        expect(isWalkable(getCell(grid, col, row))).toBe(true);
        if (i > 0) {
          const [pc, pr] = route.cells[i - 1];
          expect(Math.abs(pc - col) + Math.abs(pr - row)).toBe(1);
        }
      }
    }
  });
});

describe('L2 BFS solvability', () => {
  const graph = buildWalkGraph(carveRamps(GROUND_GRID), carveRamps(UPPER_GRID));

  function pathExists(fromStorey, fromCol, fromRow, toStorey, toCol, toRow) {
    const from = keyOf(fromStorey, fromCol, fromRow);
    const to = keyOf(toStorey, toCol, toRow);
    return findPath(graph, from, to) !== null;
  }

  it('spawn → command door', () => {
    const spawn = PLACEMENTS.spawn;
    const door = PLACEMENTS.commandDoor;
    expect(pathExists(spawn.storey, spawn.col, spawn.row, door.storey, door.col, door.row)).toBe(
      true
    );
  });

  it('spawn → each station', () => {
    const spawn = PLACEMENTS.spawn;
    for (const [system, spot] of Object.entries(PLACEMENTS.stations)) {
      expect(pathExists(spawn.storey, spawn.col, spawn.row, spot.storey, spot.col, spot.row)).toBe(
        true
      );
    }
  });

  it('spawn → override terminal', () => {
    const spawn = PLACEMENTS.spawn;
    const override = PLACEMENTS.overrideTerminal;
    expect(
      pathExists(spawn.storey, spawn.col, spawn.row, override.storey, override.col, override.row)
    ).toBe(true);
  });

  it('both ramps are reachable from spawn (backtrack loop possible)', () => {
    const spawn = PLACEMENTS.spawn;
    const spawnKey = keyOf(spawn.storey, spawn.col, spawn.row);

    // Check that at least one cell from each ramp footprint is reachable
    for (const ramp of RAMPS) {
      const rampCell = keyOf('ground', ramp.cols[0], ramp.rows[0]);
      const path = findPath(graph, spawnKey, rampCell);
      expect(path).not.toBeNull();
    }
  });
});
