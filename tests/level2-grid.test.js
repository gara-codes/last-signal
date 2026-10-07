// tests/level2-grid.test.js
//
// Validates the authored maze data: grid shape, revision scale constants,
// TRANSIT pins, strip routes (v2), and BFS solvability of every critical
// path. If a maze edit bricks a route, the test names exactly which one.

import { describe, it, expect } from 'vitest';
import {
  GROUND_GRID,
  UPPER_GRID,
  GRID_ROWS,
  GRID_COLS,
  CELL_SIZE,
  HALL,
  DECK_Y,
  CEILING_Y,
  TRANSIT,
  PLACEMENTS,
  STRIP_ROUTES,
  CAMERA_MOUNTS,
  validateLayout,
  buildWalkGraph,
  findPath,
  transitPinsOnPath,
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

describe('L2 revision scale', () => {
  it('world constants run at the ×1.5 blockout scale', () => {
    expect(CELL_SIZE).toBe(6);
    expect(HALL).toEqual({ minX: -48, maxX: 48, minZ: -30, maxZ: 30 });
    expect(DECK_Y).toBe(12);
    expect(CEILING_Y).toBe(24);
  });

  it('all six camera mounts sit just under the ceiling', () => {
    expect(CAMERA_MOUNTS).toHaveLength(6);
    for (const mount of CAMERA_MOUNTS) {
      expect(mount.position[1]).toBe(22.5);
    }
  });
});

describe('L2 layout validation', () => {
  it('validateLayout() returns no problems for the shipped maze', () => {
    expect(validateLayout()).toEqual([]);
  });

  it('TRANSIT pins sit on walkable cells on BOTH storeys', () => {
    for (const grid of [GROUND_GRID, UPPER_GRID]) {
      for (const pin of Object.values(TRANSIT)) {
        expect(isWalkable(getCell(grid, pin.col, pin.row))).toBe(true);
      }
    }
  });
});

describe('L2 strip routes (v2)', () => {
  it('every strip route is 4-adjacent and on walkable cells', () => {
    const grids = { ground: GROUND_GRID, upper: UPPER_GRID };
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

  it('descent-ladder ends at the ladder pin', () => {
    const route = STRIP_ROUTES.find((r) => r.id === 'descent-ladder');
    expect(route.cells.at(-1)).toEqual([TRANSIT.ladder.col, TRANSIT.ladder.row]);
  });

  it('to-elevator ends at the elevator pin along the south boulevard', () => {
    const route = STRIP_ROUTES.find((r) => r.id === 'to-elevator');
    expect(route.storey).toBe('ground');
    expect(route.cells.at(-1)).toEqual([TRANSIT.elevator.col, TRANSIT.elevator.row]);
  });

  it('the ramp-era routes are gone (override-to-ramp-ne deleted)', () => {
    expect(STRIP_ROUTES.map((r) => r.id)).toEqual([
      'to-door',
      'to-comms',
      'descent-ladder',
      'to-elevator',
    ]);
  });
});

describe('L2 BFS solvability', () => {
  const graph = buildWalkGraph(GROUND_GRID, UPPER_GRID);

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

  it('spawn → each station (incl. comms)', () => {
    const spawn = PLACEMENTS.spawn;
    for (const spot of Object.values(PLACEMENTS.stations)) {
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

  it('spawn → ladder pin (the descent)', () => {
    const spawn = PLACEMENTS.spawn;
    expect(
      pathExists(spawn.storey, spawn.col, spawn.row, 'upper', TRANSIT.ladder.col, TRANSIT.ladder.row)
    ).toBe(true);
  });

  it('ladder foot → each station, the override terminal and every ground fuel cell', () => {
    const foot = keyOf('ground', TRANSIT.ladder.col, TRANSIT.ladder.row);
    const targets = [
      ...Object.values(PLACEMENTS.stations),
      PLACEMENTS.overrideTerminal,
      ...PLACEMENTS.fuelCells.filter((c) => c.storey === 'ground'),
    ];
    for (const spot of targets) {
      expect(findPath(graph, foot, keyOf(spot.storey, spot.col, spot.row))).not.toBeNull();
    }
  });

  it('override terminal → elevator pin (the backtrack)', () => {
    const override = PLACEMENTS.overrideTerminal;
    expect(
      pathExists(
        override.storey,
        override.col,
        override.row,
        'ground',
        TRANSIT.elevator.col,
        TRANSIT.elevator.row
      )
    ).toBe(true);
  });

  it('elevator (upper) → command door (the return leg)', () => {
    const door = PLACEMENTS.commandDoor;
    expect(
      pathExists('upper', TRANSIT.elevator.col, TRANSIT.elevator.row, door.storey, door.col, door.row)
    ).toBe(true);
  });

  it('the descent crosses the ladder pin; the backtrack the elevator pin', () => {
    const spawn = PLACEMENTS.spawn;
    const descent = findPath(
      graph,
      keyOf(spawn.storey, spawn.col, spawn.row),
      keyOf('ground', TRANSIT.ladder.col, TRANSIT.ladder.row)
    );
    expect(descent).not.toBeNull();
    expect(transitPinsOnPath(descent)).toEqual(new Set(['ladder']));

    const override = PLACEMENTS.overrideTerminal;
    const backtrack = findPath(
      graph,
      keyOf(override.storey, override.col, override.row),
      keyOf('upper', TRANSIT.elevator.col, TRANSIT.elevator.row)
    );
    expect(backtrack).not.toBeNull();
    expect(transitPinsOnPath(backtrack)).toEqual(new Set(['elevator']));
  });
});
