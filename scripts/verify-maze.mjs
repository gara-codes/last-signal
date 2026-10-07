// Temporary maze verification: validateLayout + reachability BFS from pins.
// Not part of the test suite — a dev probe for the v1 maze redraw.
import {
  GROUND_GRID,
  UPPER_GRID,
  PLACEMENTS,
  TRANSIT,
  validateLayout,
  buildWalkGraph,
  findPath,
  keyOf,
  parseKey,
} from '../src/levels/level2/grid-data.js';

const problems = validateLayout();
console.log('validateLayout problems:', problems.length === 0 ? 'NONE' : '');
problems.forEach((p) => console.log('  -', p));

const graph = buildWalkGraph(GROUND_GRID, UPPER_GRID);

// Reachable set from the spawn through the whole graph (pins included).
const spawn = PLACEMENTS.spawn;
const startKey = keyOf(spawn.storey, spawn.col, spawn.row);
const visited = new Set([startKey]);
const queue = [startKey];
while (queue.length) {
  const key = queue.shift();
  for (const next of graph.get(key) ?? []) {
    if (!visited.has(next)) {
      visited.add(next);
      queue.push(next);
    }
  }
}

const anchors = [
  ['spawn', spawn],
  ['commandDoor', PLACEMENTS.commandDoor],
  ['override', PLACEMENTS.overrideTerminal],
  ...Object.entries(PLACEMENTS.stations).map(([k, v]) => [`station:${k}`, v]),
  ...PLACEMENTS.fuelCells.map((v, i) => [`fuel:${i}`, v]),
  ...Object.values(TRANSIT).map((v, i) => [`transit:${i}`, v]),
];
console.log('\n-- anchor reachability from spawn --');
for (const [name, spot] of anchors) {
  const key = keyOf(spot.storey, spot.col, spot.row);
  console.log(`${name} (${spot.storey} ${spot.col},${spot.row}):`, visited.has(key) ? 'OK' : '*** UNREACHABLE ***');
}

// Every walkable cell reachable? List isolated components.
console.log('\n-- isolated walkable components (not reachable from spawn) --');
const allWalkable = [...graph.keys()];
const isolated = allWalkable.filter((k) => !visited.has(k));
const components = [];
const seen = new Set();
for (const key of isolated) {
  if (seen.has(key)) continue;
  const comp = [];
  const q = [key];
  seen.add(key);
  while (q.length) {
    const k = q.shift();
    comp.push(k);
    for (const next of graph.get(k) ?? []) {
      if (isolated.includes(next) && !seen.has(next)) {
        seen.add(next);
        q.push(next);
      }
    }
  }
  components.push(comp);
}
if (components.length === 0) console.log('none — fully connected');
components.forEach((c, i) => console.log(`component ${i}:`, c.join(' ')));
