// src/levels/level2/grid-data.js
//
// THE MAZE LIVES HERE. This file is authored data plus pure grid helpers —
// no THREE imports, no side effects, fully unit-testable.
//
// Authorship (delegated to the implementation owner — Yannis's call):
//   • GROUND_GRID / UPPER_GRID are 10 rows of 16 characters each.
//       col 0 = west end-cap (x -48..-42), col 15 = east end-cap.
//       row 0 = north wall   (z -30..-24), row 9 = south wall.
//   • '#'  solid module (ground: energy pylon, upper: partition block)
//   • '.'  walkable floor
//   • '~'  atrium void — UPPER grid only: no deck slab, railed edge
//   • TRANSIT pins the two vertical connections (elevator + ladder); both
//     must sit on walkable cells on BOTH storeys — validateLayout() enforces it.
//   • PLACEMENTS pins every gameplay anchor to a cell. validateLayout()
//     (run at build time and in tests) reports authoring errors in prose.
//   • tests/level2-grid.test.js enforces solvability — if a maze edit bricks
//     a route, the test names exactly which one.
//
// Non-uniform scale (design interview): the world runs ×1.5 versus the v0
// blockout (cells 6 wide, hall 96x60, deck at 12, ceiling at 24) while the
// player runs at astronaut scale 2.5 (~5 units tall) — the hall reads grand,
// the player reads medium.

export const CELL_SIZE = 6;
export const GRID_COLS = 16;
export const GRID_ROWS = 10;

// Hall extents in world units — the geometry modules read these.
export const HALL = { minX: -48, maxX: 48, minZ: -30, maxZ: 30 };
export const GROUND_Y = 0; // ground-floor walking surface
export const DECK_Y = 12; // upper deck walking surface
export const CEILING_Y = 24;

export const STOREYS = ['ground', 'upper'];

// ---------------------------------------------------------------------------
// Grids — row strings, north first. Maze v1 (see header for authorship).
// ---------------------------------------------------------------------------

export const GROUND_GRID = [
  // 0123456789012345
  '.##.####.####...', // r0  NE pocket — ladder foot lands at (14,0)
  '....#.##..##...#', // r1  NW mouth open to the col-1/2/3 corridor
  '#.#.....#....#.#', // r2  O2 alcove (12,2) opens north and west
  '#.#..##..#...#..', // r3
  '..##..#....##...', // r4
  '###.#..##..#....', // r5
  '#...#.###.#.##..', // r6
  '##..#....#...#.#', // r7  Grav alcove (3,7) + fuel (7,7), open north
  '#..#.#..##.#....', // r8
  '................', // r9  south boulevard (fixed corridor)
];

export const UPPER_GRID = [
  // 0123456789012345
  '.##.#########...', // r0  north deck pockets + ladder hatch at (14,0)
  '.##..#~~~~###..#', // r1  Comms niche far north-west
  '.#...#~~~~####.#', // r2
  '.#.###~~~~#....#', // r3
  '...###~~~~...#.#', // r4  command door cell at col 0
  '#....#~~~~##.#.#', // r5
  '#..###~~~~####.#', // r6
  '#..#.#########.#', // r7
  '#..............#', // r8  south boulevard (spawn row)
  '#..##.########.#', // r9  south deck pockets — elevator arrives at (1,9)
];

// ---------------------------------------------------------------------------
// Vertical transit — the two storey connections (ramps were scrapped in the
// revision interview). Each pin is one cell that must be walkable on BOTH
// storeys; the walk graph adds a ground<->upper edge through it.
//   elevator — exterior cab on the south face at (1,9): rides up next to the
//              command-door checkpoint (the return leg of the backtrack).
//   ladder   — circular deck hatch at (14,0) against the north wall: the fast
//              descent into the maze, one cell past the descent strip's end.
// ---------------------------------------------------------------------------

export const TRANSIT = {
  elevator: { col: 1, row: 9 },
  ladder: { col: 14, row: 0 },
};

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

// Wall/ceiling camera mounts — positions in world space, all just below the
// ceiling so the player looks up to see them (revision interview). Each mount
// yaw-tracks the viewer with a fixed 30-degree downward tilt; the red lens
// and flicker warning wire up with the gravity system later.
export const CAMERA_MOUNTS = [
  { position: [0, 22.5, -29.1] }, // north wall, mid
  { position: [0, 22.5, 29.1] }, // south wall, mid — clears the elevator breach
  { position: [-44.25, 22.5, -26.25] }, // NW corner
  { position: [44.25, 22.5, -26.25] }, // NE corner
  { position: [-44.25, 22.5, 26.25] }, // SW corner
  { position: [44.25, 22.5, 26.25] }, // SE corner
];

// Honest wayfinding strips (amber floor lights). Each route is a chain of
// 4-adjacent cells on one storey; maze-builder lays one segment per cell.
// The AI-lying phase later flips per-segment state — routes are data.
//   to-door / to-comms  — the upper-deck westward leg (unchanged from v0)
//   descent-ladder      — spawn east along row 8, north up col 14, ends at
//                         the ladder hatch (14,0)
//   to-elevator        — the backtrack: override terminal west along the
//                         south boulevard to the elevator (1,9)
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
    id: 'descent-ladder',
    storey: 'upper',
    cells: [
      [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
      [14, 7], [14, 6], [14, 5], [14, 4], [14, 3], [14, 2], [14, 1], [14, 0],
    ],
  },
  {
    id: 'to-elevator',
    storey: 'ground',
    cells: [
      [14, 9], [13, 9], [12, 9], [11, 9], [10, 9], [9, 9], [8, 9], [7, 9],
      [6, 9], [5, 9], [4, 9], [3, 9], [2, 9], [1, 9],
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

/** Cell key used by the walk graph: 'upper:7,8'. */
export const keyOf = (storey, col, row) => `${storey}:${col},${row}`;

export function parseKey(key) {
  const [storey, rest] = key.split(':');
  const [col, row] = rest.split(',').map(Number);
  return { storey, col, row };
}

/**
 * Combined walk graph over both storeys: 4-neighbour edges within a storey
 * plus a ground<->upper edge on every TRANSIT pin (the elevator edge assumes
 * the cab can be called — solvability treats it as traversable).
 * @returns {Map<string, string[]>} adjacency list
 */
export function buildWalkGraph(groundGrid, upperGrid, transit = TRANSIT) {
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

  for (const pin of Object.values(transit)) {
    const ground = keyOf('ground', pin.col, pin.row);
    const upper = keyOf('upper', pin.col, pin.row);
    if (graph.has(ground) && graph.has(upper)) {
      graph.get(ground).push(upper);
      graph.get(upper).push(ground);
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

/** Which ramp footprints a path touches — kept for tests that prove the
 * backtrack uses a specific transit pin (elevator vs ladder). */
export function transitPinsOnPath(path, transit = TRANSIT) {
  const used = new Set();
  for (const key of path) {
    const { col, row } = parseKey(key);
    for (const [name, pin] of Object.entries(transit)) {
      if (pin.col === col && pin.row === row) used.add(name);
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
  placements = PLACEMENTS,
  transit = TRANSIT
) {
  const problems = [];
  const grids = { ground: groundGrid, upper: upperGrid };

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

  // Transit pins — walkable on BOTH storeys, and never on an anchor cell.
  for (const [name, pin] of Object.entries(transit)) {
    for (const storey of STOREYS) {
      const ch = getCell(grids[storey], pin.col, pin.row);
      if (!isWalkable(ch)) {
        problems.push(`${name} pin sits on '${ch ?? 'outside'}' at ${storey} (${pin.col},${pin.row})`);
      }
    }
    for (const storey of STOREYS) {
      anchorCells.push(keyOf(storey, pin.col, pin.row));
    }
  }

  const duplicated = anchorCells.filter((key, i) => anchorCells.indexOf(key) !== i);
  if (duplicated.length) problems.push(`anchors share cells: ${[...new Set(duplicated)].join(' ')}`);

  problems.push(...validateStripRoutes(grids));
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
