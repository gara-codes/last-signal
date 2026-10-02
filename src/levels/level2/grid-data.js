// src/levels/level2/grid-data.js
//
// THE MAZE LIVES HERE. This file is authored data plus pure grid helpers —
// no THREE imports, no side effects, fully unit-testable.
//
// Authorship contract (Yannis owns this data):
//   • GROUND_GRID / UPPER_GRID are 10 rows of 16 characters each.
//       col 0 = west end-cap (x -32..-28), col 15 = east end-cap.
//       row 0 = north wall   (z -20..-16), row 9 = south wall.
//   • '#'  solid module (ground: energy pylon, upper: partition block)
//   • '.'  walkable floor
//   • '~'  atrium void — UPPER grid only: no deck slab, railed edge
//   • Ramp footprints (RAMPS below) are auto-carved to '.' on both storeys,
//     so draw them either way — the carve wins.
//   • PLACEMENTS pins every gameplay anchor to a cell. validateLayout()
//     (run at build time and in tests) reports authoring errors in prose.
//   • tests/level2-grid.test.js enforces solvability — if a maze edit bricks
//     a route, the test names exactly which one.
//
// The shipped maze is a PLACEHOLDER v0 satisfying the zoning locked in the
// L2 design interview — redraw the '#'/'.'/'.~' art freely, keep the anchors
// and the fixed corridors (south row 9 + east col 14 on ground) reachable.

export const CELL_SIZE = 4;
export const GRID_COLS = 16;
export const GRID_ROWS = 10;

// Hall extents in world units — the geometry modules read these.
export const HALL = { minX: -32, maxX: 32, minZ: -20, maxZ: 20 };
export const GROUND_Y = 0; // ground-floor walking surface
export const DECK_Y = 8; // upper deck walking surface
export const CEILING_Y = 16;

export const STOREYS = ['ground', 'upper'];

// ---------------------------------------------------------------------------
// Grids — row strings, north first. Placeholder v0 maze.
// ---------------------------------------------------------------------------

export const GROUND_GRID = [
  // 0123456789012345
  '.##.####.####.#.', // r0  north edge pockets
  '..##.###.##.##..', // r1
  '###..#.....#...#', // r2  O2 alcove open to the east corridor
  '#.##.##.##.###.#', // r3
  '#.##...#.##..#..', // r4
  '..##.#####.#.#.#', // r5
  '##.#..#.##.###.#', // r6
  '#.#.###..#.###.#', // r7  Grav alcove open to the south
  '....#.#.##...#..', // r8
  '................', // r9  south boulevard (fixed corridor)
];

export const UPPER_GRID = [
  // 0123456789012345
  '.##.####.####...', // r0  north deck pockets + NE ramp mouth
  '.##..#~~~~###..#', // r1  Comms niche far north-west
  '.#.#.#~~~~####.#', // r2
  '.#.###~~~~#..#.#', // r3
  '...###~~~~.###.#', // r4  command door cell at col 0
  '#..#.#~~~~##.#.#', // r5
  '#..###~~~~####.#', // r6
  '#..#.#########.#', // r7
  '#..............#', // r8  south boulevard (spawn row)
  '#..##.########.#', // r9  south deck pockets
];

// ---------------------------------------------------------------------------
// Ramps — 2x2-cell footprints auto-carved walkable on both storeys.
// lowSide: which edge of the footprint sits at ground level; the slab rises
// toward the opposite edge, exiting onto the deck cell beyond it.
// ---------------------------------------------------------------------------

export const RAMPS = [
  { id: 'ramp-sw', cols: [1, 2], rows: [8, 9], lowSide: 'S' },
  { id: 'ramp-ne', cols: [13, 14], rows: [0, 1], lowSide: 'N' },
];

// ---------------------------------------------------------------------------
// Placements — every gameplay anchor pinned to a cell (or wall position).
// ---------------------------------------------------------------------------

export const PLACEMENTS = {
  spawn: { storey: 'upper', col: 7, row: 8 }, // L1 transit shaft arrives here
  commandDoor: { storey: 'upper', col: 0, row: 4 }, // west end-cap, upper level
  stations: {
    oxygen: { storey: 'ground', col: 12, row: 2 },
    gravity: { storey: 'ground', col: 3, row: 7 },
    comms: { storey: 'upper', col: 0, row: 0 }, // far NW corner
  },
  overrideTerminal: { storey: 'ground', col: 14, row: 9 }, // deep SE corner
  fuelCells: [
    { storey: 'ground', col: 0, row: 1 },
    { storey: 'ground', col: 5, row: 4 },
    { storey: 'ground', col: 10, row: 3 },
    { storey: 'ground', col: 7, row: 7 },
    { storey: 'ground', col: 12, row: 5 },
    { storey: 'ground', col: 6, row: 9 },
    { storey: 'upper', col: 12, row: 8 },
    { storey: 'upper', col: 3, row: 0 },
    { storey: 'upper', col: 0, row: 3 }, // NW wing, along the strip route
  ],
};

// Wall/ceiling camera mounts — positions in world space, each facing the hall
// centre so the pan sweep covers the maze (design doc: cameras watch; the
// red tracking light and flicker warning wire up with the gravity system).
export const CAMERA_MOUNTS = [
  { position: [0, 12.5, -19.4] }, // north wall, mid
  { position: [0, 12.5, 19.4] }, // south wall, mid
  { position: [-29.5, 11.5, -17.5] }, // NW corner
  { position: [29.5, 11.5, -17.5] }, // NE corner
  { position: [-29.5, 11.5, 17.5] }, // SW corner
  { position: [29.5, 11.5, 17.5] }, // SE corner
];

// Honest wayfinding strips (amber floor lights). Each route is a chain of
// 4-adjacent cells on one storey; maze-builder lays one segment per cell.
// The AI-lying phase later flips per-segment state — routes are data.
export const STRIP_ROUTES = [
  {
    id: 'to-door',
    storey: 'upper',
    cells: [
      [7, 8], [6, 8], [5, 8], [4, 8], [3, 8], [2, 8],
      [1, 8], [1, 7], [1, 6], [1, 5], [1, 4], [0, 4],
    ],
  },
  {
    id: 'to-comms',
    storey: 'upper',
    cells: [
      [7, 8], [6, 8], [5, 8], [4, 8], [3, 8], [2, 8],
      [2, 7], [1, 7], [1, 6], [1, 5], [1, 4], [0, 4], [0, 3], [0, 2], [0, 1], [0, 0],
    ],
  },
  {
    id: 'descent-ne',
    storey: 'upper',
    cells: [
      [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
      [14, 7], [14, 6], [14, 5], [14, 4], [14, 3], [14, 2], [14, 1],
    ],
  },
  {
    id: 'backtrack-south',
    storey: 'ground',
    cells: [
      [1, 9], [2, 9], [3, 9], [4, 9], [5, 9], [6, 9], [7, 9],
      [8, 9], [9, 9], [10, 9], [11, 9], [12, 9], [13, 9], [14, 9],
    ],
  },
  {
    id: 'override-to-ramp-ne',
    storey: 'ground',
    cells: [
      [14, 9], [14, 8], [14, 7], [14, 6], [14, 5],
      [14, 4], [14, 3], [14, 2], [14, 1],
    ],
  },
];

// ---------------------------------------------------------------------------
// Pure grid helpers — the tests build on these, so does maze-builder.
// ---------------------------------------------------------------------------

export function getCell(grid, col, row) {
  if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return null;
  return grid[row][col];
}

export const isWalkable = (ch) => ch === '.';
export const isSolid = (ch) => ch === '#';
export const isVoid = (ch) => ch === '~';

export function countCells(grid, predicate) {
  let n = 0;
  for (const row of grid) for (const ch of row) if (predicate(ch)) n += 1;
  return n;
}

/** World-space centre of a cell at floor level. */
export function cellToWorld(col, row) {
  return {
    x: HALL.minX + (col + 0.5) * CELL_SIZE,
    z: HALL.minZ + (row + 0.5) * CELL_SIZE,
  };
}

/** Walking-surface height of a storey. */
export function storeyFloorY(storey) {
  return storey === 'upper' ? DECK_Y : GROUND_Y;
}

/**
 * Returns a NEW grid with every ramp footprint cell forced to '.', leaving
 * the authored arrays pristine. Run before walkability checks — the carve
 * is part of the layout contract.
 */
export function carveRamps(grid, ramps = RAMPS) {
  const carved = grid.map((row) => row.split(''));
  for (const ramp of ramps) {
    for (const col of ramp.cols) {
      for (const row of ramp.rows) {
        carved[row][col] = '.';
      }
    }
  }
  return carved.map((row) => row.join(''));
}

/** Cell key used by the walk graph: 'upper:7,8'. */
export const keyOf = (storey, col, row) => `${storey}:${col},${row}`;

export function parseKey(key) {
  const [storey, rest] = key.split(':');
  const [col, row] = rest.split(',').map(Number);
  return { storey, col, row };
}

/**
 * Combined walk graph over both storeys: 4-neighbour edges within a storey
 * plus a ground<->upper edge on every ramp footprint cell (the ramp itself
 * is the vertical connection).
 * @returns {Map<string, string[]>} adjacency list
 */
export function buildWalkGraph(groundGrid, upperGrid, ramps = RAMPS) {
  const grids = { ground: groundGrid, upper: upperGrid };
  const graph = new Map();
  const addNode = (storey, col, row) => {
    const key = keyOf(storey, col, row);
    if (!graph.has(key)) graph.set(key, []);
    return key;
  };

  for (const storey of STOREYS) {
    const grid = grids[storey];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (!isWalkable(grid[row][col])) continue;
        const key = addNode(storey, col, row);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (isWalkable(getCell(grid, col + dc, row + dr))) {
            graph.get(key).push(keyOf(storey, col + dc, row + dr));
          }
        }
      }
    }
  }

  for (const ramp of ramps) {
    for (const col of ramp.cols) {
      for (const row of ramp.rows) {
        const ground = keyOf('ground', col, row);
        const upper = keyOf('upper', col, row);
        if (graph.has(ground) && graph.has(upper)) {
          graph.get(ground).push(upper);
          graph.get(upper).push(ground);
        }
      }
    }
  }
  return graph;
}

/**
 * Breadth-first search on the walk graph.
 * @param {Map<string, string[]>} graph
 * @param {string} fromKey - keyOf(storey, col, row)
 * @param {string} toKey
 * @returns {string[]|null} path including both ends, or null when unreachable
 */
export function findPath(graph, fromKey, toKey) {
  if (!graph.has(fromKey) || !graph.has(toKey)) return null;
  const cameFrom = new Map([[fromKey, null]]);
  const queue = [fromKey];
  for (let i = 0; i < queue.length; i++) {
    const key = queue[i];
    if (key === toKey) {
      const path = [];
      for (let k = key; k !== null; k = cameFrom.get(k)) path.unshift(k);
      return path;
    }
    for (const next of graph.get(key)) {
      if (!cameFrom.has(next)) {
        cameFrom.set(next, key);
        queue.push(next);
      }
    }
  }
  return null;
}

/** Which ramp footprints a path touches — used to prove the backtrack loop. */
export function rampsOnPath(path, ramps = RAMPS) {
  const used = new Set();
  for (const key of path) {
    const { col, row } = parseKey(key);
    for (const ramp of ramps) {
      if (ramp.cols.includes(col) && ramp.rows.includes(row)) used.add(ramp.id);
    }
  }
  return used;
}

/**
 * Layout lint — returns a list of human-readable problems (empty = valid).
 * Build time throws on any problem; the test suite asserts it stays empty.
 */
export function validateLayout(
  groundGrid = GROUND_GRID,
  upperGrid = UPPER_GRID,
  placements = PLACEMENTS
) {
  const problems = [];
  const ground = carveRamps(groundGrid);
  const upper = carveRamps(upperGrid);
  const grids = { ground, upper };

  problems.push(...validateGridShape(groundGrid), ...validateGridShape(upperGrid));

  const anchorCells = [];
  const checkAnchor = (name, spot) => {
    const ch = getCell(grids[spot.storey], spot.col, spot.row);
    if (!isWalkable(ch)) {
      problems.push(`${name} sits on '${ch ?? 'outside'}' at ${spot.storey} (${spot.col},${spot.row})`);
      return;
    }
    anchorCells.push(keyOf(spot.storey, spot.col, spot.row));
  };

  checkAnchor('spawn', placements.spawn);
  checkAnchor('command door', placements.commandDoor);
  checkAnchor('override terminal', placements.overrideTerminal);
  for (const [system, spot] of Object.entries(placements.stations)) {
    checkAnchor(`${system} station`, spot);
  }
  placements.fuelCells.forEach((spot, i) => checkAnchor(`fuel cell #${i}`, spot));

  const duplicated = anchorCells.filter((key, i) => anchorCells.indexOf(key) !== i);
  if (duplicated.length) problems.push(`anchors share cells: ${[...new Set(duplicated)].join(' ')}`);

  problems.push(...validateRampFootprints(grids), ...validateStripRoutes(grids));
  return problems;
}

function validateGridShape(grid) {
  const problems = [];
  if (grid.length !== GRID_ROWS) {
    problems.push(`expected ${GRID_ROWS} rows, found ${grid.length}`);
  }
  grid.forEach((row, i) => {
    if (row.length !== GRID_COLS) problems.push(`row ${i} has ${row.length} cells, expected ${GRID_COLS}`);
    for (const ch of row) {
      if (!'#'.includes(ch) && ch !== '.' && ch !== '~') {
        problems.push(`row ${i} has unknown code '${ch}'`);
      }
    }
  });
  // '~' is an upper-storey concept; a void under the atrium would be a pit.
  if (grid === GROUND_GRID && grid.some((row) => row.includes('~'))) {
    problems.push('GROUND_GRID must not contain atrium voids (~)');
  }
  return problems;
}

function validateRampFootprints(grids) {
  const problems = [];
  for (const ramp of RAMPS) {
    for (const col of ramp.cols) {
      for (const row of ramp.rows) {
        for (const storey of STOREYS) {
          if (!isWalkable(getCell(grids[storey], col, row))) {
            problems.push(`${ramp.id} footprint not walkable on ${storey} (${col},${row})`);
          }
        }
      }
    }
  }
  return problems;
}

function validateStripRoutes(grids) {
  const problems = [];
  for (const route of STRIP_ROUTES) {
    route.cells.forEach(([col, row], i) => {
      if (!isWalkable(getCell(grids[route.storey], col, row))) {
        problems.push(`strip '${route.id}'[${i}] not on walkable ${route.storey} (${col},${row})`);
      }
      if (i > 0) {
        const [pc, pr] = route.cells[i - 1];
        if (Math.abs(pc - col) + Math.abs(pr - row) !== 1) {
          problems.push(`strip '${route.id}'[${i}] is not 4-adjacent to [${i - 1}]`);
        }
      }
    });
  }
  return problems;
}
