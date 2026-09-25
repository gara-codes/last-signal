// src/levels/level2/maze-builder.js
//
// Turns grid-data into THREE geometry plus the collision contract Alex's
// flat controller will consume. Pure assembly: every piece is a small
// function so the maze's construction reads like a parts list.
//
// Collision contract (world space, plain objects — serialisable/testable):
//   collisionData.wallAABBs    solid boxes { minX..maxZ, name }
//   collisionData.railAABBs    atrium railings (solid, full height of deck)
//   collisionData.rampSurfaces walkable slopes { minX..maxZ, lowSide }
//   collisionData.floorSpec    storey heights so the controller can resolve floors

import * as THREE from 'three';
import {
  CELL_SIZE,
  GRID_COLS,
  GRID_ROWS,
  HALL,
  DECK_Y,
  CEILING_Y,
  GROUND_GRID,
  UPPER_GRID,
  RAMPS,
  PLACEMENTS,
  CAMERA_MOUNTS,
  STRIP_ROUTES,
  carveRamps,
  cellToWorld,
  getCell,
  isSolid,
  isVoid,
  keyOf,
} from './grid-data.js';
import {
  createPylon,
  createOxygenStation,
  createGravityStation,
  createCommsStation,
  createCommandDoor,
  createOverrideTerminal,
  createCameraMount,
  createFuelCellSpawn,
  createStrip,
} from './props.js';

const WALL_THICKNESS = 0.5;
const DECK_THICKNESS = 0.4;
const RAIL_HEIGHT = 1.05;

// ---------------------------------------------------------------------------
// Collision registry — collects plain AABBs while geometry is built.
// ---------------------------------------------------------------------------

function createCollisionRegistry() {
  const wallAABBs = [];
  const railAABBs = [];
  const rampSurfaces = [];

  function addBox(list, cx, cy, cz, sx, sy, sz, name) {
    list.push({
      minX: cx - sx / 2,
      maxX: cx + sx / 2,
      minY: cy - sy / 2,
      maxY: cy + sy / 2,
      minZ: cz - sz / 2,
      maxZ: cz + sz / 2,
      name,
    });
  }

  return {
    wallAABBs,
    railAABBs,
    rampSurfaces,
    addWall: (cx, cy, cz, sx, sy, sz, name = 'wall') => addBox(wallAABBs, cx, cy, cz, sx, sy, sz, name),
    addRail: (cx, cy, cz, sx, sy, sz, name = 'rail') => addBox(railAABBs, cx, cy, cz, sx, sy, sz, name),
    finalize() {
      return {
        wallAABBs,
        railAABBs,
        rampSurfaces,
        floorSpec: { groundY: 0, deckY: DECK_Y, cellSize: CELL_SIZE, hall: { ...HALL } },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Hull — floor, ceiling, and the four walls. The west wall is built in
// pieces around the command-door opening (see doorOpening()).
// ---------------------------------------------------------------------------

function doorOpening() {
  const { z } = cellToWorld(PLACEMENTS.commandDoor.col, PLACEMENTS.commandDoor.row);
  return { minZ: z - 3.2, maxZ: z + 3.2, minY: DECK_Y, maxY: DECK_Y + 6.4 };
}

function addPlane(group, width, height, material, position, rotation) {
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  plane.position.set(...position);
  plane.rotation.set(...rotation);
  group.add(plane);
  return plane;
}

function addHull(group, mats, collision) {
  const lengthX = HALL.maxX - HALL.minX; // 64
  const widthZ = HALL.maxZ - HALL.minZ; // 40
  const midX = (HALL.minX + HALL.maxX) / 2;
  const midZ = (HALL.minZ + HALL.maxZ) / 2;

  // Floor + ceiling
  addPlane(group, lengthX, widthZ, mats.hull, [midX, 0, midZ], [-Math.PI / 2, 0, 0]);
  addPlane(group, lengthX, widthZ, mats.hull, [midX, CEILING_Y, midZ], [Math.PI / 2, 0, 0]);

  // North + south walls
  addPlane(group, lengthX, CEILING_Y, mats.hull, [midX, CEILING_Y / 2, HALL.minZ], [0, 0, 0]);
  addPlane(group, lengthX, CEILING_Y, mats.hull, [midX, CEILING_Y / 2, HALL.maxZ], [0, Math.PI, 0]);
  collision.addWall(midX, CEILING_Y / 2, HALL.minZ, lengthX, CEILING_Y, WALL_THICKNESS, 'wall-north');
  collision.addWall(midX, CEILING_Y / 2, HALL.maxZ, lengthX, CEILING_Y, WALL_THICKNESS, 'wall-south');

  // East wall (solid)
  addPlane(group, widthZ, CEILING_Y, mats.hull, [HALL.maxX, CEILING_Y / 2, midZ], [0, -Math.PI / 2, 0]);
  collision.addWall(HALL.maxX, CEILING_Y / 2, midZ, WALL_THICKNESS, CEILING_Y, widthZ, 'wall-east');

  // West wall — lower band full width, upper band split around the doorway
  const opening = doorOpening();
  addPlane(group, widthZ, DECK_Y, mats.hull, [HALL.minX, DECK_Y / 2, midZ], [0, Math.PI / 2, 0]);
  collision.addWall(HALL.minX, DECK_Y / 2, midZ, WALL_THICKNESS, DECK_Y, widthZ, 'wall-west-lower');

  const westSegments = [
    { zMin: HALL.minZ, zMax: opening.minZ, yMin: DECK_Y, yMax: CEILING_Y },
    { zMin: opening.maxZ, zMax: HALL.maxZ, yMin: DECK_Y, yMax: CEILING_Y },
    { zMin: opening.minZ, zMax: opening.maxZ, yMin: opening.maxY, yMax: CEILING_Y },
  ];
  for (const seg of westSegments) {
    const segWidth = seg.zMax - seg.zMin;
    const segHeight = seg.yMax - seg.yMin;
    if (segWidth <= 0 || segHeight <= 0) continue;
    const cz = (seg.zMin + seg.zMax) / 2;
    const cy = (seg.yMin + seg.yMax) / 2;
    addPlane(group, segWidth, segHeight, mats.hull, [HALL.minX, cy, cz], [0, Math.PI / 2, 0]);
    collision.addWall(HALL.minX, cy, cz, WALL_THICKNESS, segHeight, segWidth, 'wall-west-upper');
  }
}

// ---------------------------------------------------------------------------
// Upper deck — one instanced slab per covered cell ('.' or '#'); '~' atrium
// cells get nothing (their edges become railings in addAtriumRails).
// ---------------------------------------------------------------------------

export function listDeckCells(upperGrid) {
  const cells = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      if (!isVoid(getCell(upperGrid, col, row))) cells.push({ col, row });
    }
  }
  return cells;
}

function addDeck(group, mats, upperGrid) {
  const cells = listDeckCells(upperGrid);
  const slab = new THREE.InstancedMesh(
    new THREE.BoxGeometry(CELL_SIZE, DECK_THICKNESS, CELL_SIZE),
    mats.deck,
    cells.length
  );
  const matrix = new THREE.Matrix4();
  cells.forEach(({ col, row }, i) => {
    const { x, z } = cellToWorld(col, row);
    matrix.setPosition(x, DECK_Y - DECK_THICKNESS / 2, z);
    slab.setMatrixAt(i, matrix);
  });
  group.add(slab);
}

// ---------------------------------------------------------------------------
// Atrium rails — a rail on every edge shared by a void cell and a deck cell.
// ---------------------------------------------------------------------------

const EDGE_DIRECTIONS = [
  { dc: 0, dr: -1, axis: 'x' }, // neighbour north -> rail spans x on the north edge
  { dc: 0, dr: 1, axis: 'x' },
  { dc: -1, dr: 0, axis: 'z' },
  { dc: 1, dr: 0, axis: 'z' },
];

function addAtriumRails(group, mats, upperGrid, collision) {
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      if (!isVoid(getCell(upperGrid, col, row))) continue;
      const { x, z } = cellToWorld(col, row);
      for (const dir of EDGE_DIRECTIONS) {
        const neighbour = getCell(upperGrid, col + dir.dc, row + dir.dr);
        if (neighbour === null || isVoid(neighbour)) continue;
        const cx = x + dir.dc * (CELL_SIZE / 2);
        const cz = z + dir.dr * (CELL_SIZE / 2);
        const sx = dir.axis === 'x' ? CELL_SIZE : 0.16;
        const sz = dir.axis === 'z' ? CELL_SIZE : 0.16;
        const rail = new THREE.Mesh(new THREE.BoxGeometry(sx, RAIL_HEIGHT, sz), mats.rail);
        rail.position.set(cx, DECK_Y + RAIL_HEIGHT / 2, cz);
        group.add(rail);
        collision.addRail(cx, DECK_Y + RAIL_HEIGHT / 2, cz, sx, RAIL_HEIGHT, sz, 'atrium-rail');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Ramps — a 2x2-cell slab inclined from lowSide (ground level) to the
// opposite edge (deck level), exiting onto the deck cell beyond.
// ---------------------------------------------------------------------------

function rampFootprintWorld(ramp) {
  const min = cellToWorld(ramp.cols[0], ramp.rows[0]);
  const max = cellToWorld(ramp.cols[1], ramp.rows[1]);
  return {
    minX: min.x - CELL_SIZE / 2,
    maxX: max.x + CELL_SIZE / 2,
    minZ: min.z - CELL_SIZE / 2,
    maxZ: max.z + CELL_SIZE / 2,
  };
}

function addRamp(group, mats, ramp, collision) {
  const fp = rampFootprintWorld(ramp);
  const widthX = fp.maxX - fp.minX;
  const depthZ = fp.maxZ - fp.minZ;
  const run = ramp.lowSide === 'S' || ramp.lowSide === 'N' ? depthZ : widthX;
  const slopeLength = Math.hypot(run, DECK_Y);

  const slab = new THREE.Mesh(new THREE.BoxGeometry(widthX, 0.4, slopeLength), mats.ramp);
  const midX = (fp.minX + fp.maxX) / 2;
  const midZ = (fp.minZ + fp.maxZ) / 2;
  slab.position.set(midX, DECK_Y / 2, midZ);

  // Tilt: a 'S'-low ramp rises toward -Z (north), so rotate about X by +angle
  // (box's long axis is z, already aligned with the run).
  const angle = Math.atan2(DECK_Y, run);
  slab.rotation.x = ramp.lowSide === 'S' ? angle : -angle;
  group.add(slab);

  collision.rampSurfaces.push({ ...fp, lowSide: ramp.lowSide, id: ramp.id });
}

// ---------------------------------------------------------------------------
// Grid modules — '#' becomes an energy pylon on the ground floor and a
// partition block on the upper deck; every solid registers its AABB.
// ---------------------------------------------------------------------------

function addGridModules(group, mats, grid, storey, collision) {
  const floorY = storey === 'upper' ? DECK_Y : 0;
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      if (!isSolid(getCell(grid, col, row))) continue;
      const { x, z } = cellToWorld(col, row);
      const module = storey === 'ground' ? createPylon(mats) : createPartition(mats);
      module.position.set(x, floorY, z);
      group.add(module);
      const height = storey === 'ground' ? 7.6 : 3.4;
      collision.addWall(x, floorY + height / 2, z, 3.2, height, 3.2, `${storey}-module`);
    }
  }
}

function createPartition(mats) {
  const block = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.4, 3.6), mats.metal);
  body.position.y = 1.7;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.2, 3.8), mats.metalDark);
  cap.position.y = 3.5;
  block.add(body, cap);
  return block;
}

// ---------------------------------------------------------------------------
// Gameplay anchors — stations, command door, override terminal, fuel cells,
// camera mounts, and the honest-hint strip routes.
// ---------------------------------------------------------------------------

function placeAtCell(group, object, spot, yOffset = 0) {
  const { x, z } = cellToWorld(spot.col, spot.row);
  const floorY = spot.storey === 'upper' ? DECK_Y : 0;
  object.position.set(x, floorY + yOffset, z);
  group.add(object);
  return object;
}

function addCommandDoor(group, mats, collision, onDoorOpen) {
  const spot = PLACEMENTS.commandDoor;
  const { z } = cellToWorld(spot.col, spot.row);
  const door = createCommandDoor(mats, { onOpen: onDoorOpen });
  door.position.set(HALL.minX + WALL_THICKNESS / 2 + 0.31, DECK_Y + 3.2, z);
  group.add(door);
  // Locked slab blocks the doorway until the override phase unlocks it.
  collision.addWall(HALL.minX + 0.6, DECK_Y + 3.2, z, 0.6, 6.4, 6.4, 'command-door-slab');
  return door;
}

function addCameraMounts(group, mats, updatables) {
  for (const mount of CAMERA_MOUNTS) {
    const camera = createCameraMount(mats);
    camera.position.set(...mount.position);
    camera.userData.baseYaw = Math.atan2(-mount.position[0], -mount.position[2]); // face hall centre
    camera.rotation.y = camera.userData.baseYaw;
    group.add(camera);
    updatables.push(camera);
  }
}

function addStrips(group, mats, storeyFilter) {
  const strips = [];
  for (const route of STRIP_ROUTES) {
    if (route.storey !== storeyFilter) continue;
    route.cells.forEach(([col, row], index) => {
      const strip = createStrip(mats, route.id, index);
      const { x, z } = cellToWorld(col, row);
      const floorY = route.storey === 'upper' ? DECK_Y : 0;
      const [nextCol, nextRow] = route.cells[Math.min(index + 1, route.cells.length - 1)];
      const [prevCol, prevRow] = route.cells[Math.max(index - 1, 0)];
      const dCol = nextCol - prevCol;
      const dRow = nextRow - prevRow;
      strip.rotation.y = Math.abs(dCol) > Math.abs(dRow) ? Math.PI / 2 : 0;
      strip.position.set(x, floorY, z);
      group.add(strip);
      strips.push(strip);
    });
  }
  return strips;
}

/**
 * Builds the static world. Returns the level subgroup and the collision
 * registry so the orchestrator can own both.
 */
export function buildLevelGeometry(mats) {
  const group = new THREE.Group();
  group.name = 'l2-geometry';
  const collision = createCollisionRegistry();
  const ground = carveRamps(GROUND_GRID);
  const upper = carveRamps(UPPER_GRID);

  addHull(group, mats, collision);
  addDeck(group, mats, upper);
  addAtriumRails(group, mats, upper, collision);
  for (const ramp of RAMPS) addRamp(group, mats, ramp, collision);
  addGridModules(group, mats, ground, 'ground', collision);
  addGridModules(group, mats, upper, 'upper', collision);

  return { group, collision, ground, upper };
}

/**
 * Places every dynamic anchor. Registries are filled in place:
 *   interactables — prompt + E-key dispatch
 *   updatables    — per-frame animation tick
 *   fuelCells     — proximity pickup candidates
 */
export function placeAnchors(mats, levelGroup, registries, onDoorOpen) {
  const { interactables, updatables, fuelCells } = registries;

  const stations = {
    oxygen: createOxygenStation(mats),
    gravity: createGravityStation(mats),
    comms: createCommsStation(mats),
  };
  for (const [system, object] of Object.entries(stations)) {
    placeAtCell(levelGroup, object, PLACEMENTS.stations[system]);
    interactables.push(object);
    updatables.push(object);
  }

  const commandDoor = addCommandDoor(levelGroup, mats, registries.collision, onDoorOpen);
  interactables.push(commandDoor);
  updatables.push(commandDoor);

  const overrideTerminal = createOverrideTerminal(mats);
  placeAtCell(levelGroup, overrideTerminal, PLACEMENTS.overrideTerminal);
  interactables.push(overrideTerminal);

  for (const spot of PLACEMENTS.fuelCells) {
    const cell = createFuelCellSpawn(registries.fuelSystem);
    placeAtCell(levelGroup, cell, spot);
    fuelCells.push(cell);
    updatables.push(cell);
  }

  addCameraMounts(levelGroup, mats, updatables);
  addStrips(levelGroup, mats, 'ground');
  addStrips(levelGroup, mats, 'upper');

  return { stations, commandDoor, overrideTerminal };
}

// Re-exported so the orchestrator can key lookups without importing twice.
export { keyOf };
