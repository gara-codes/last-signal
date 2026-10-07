// src/levels/level2/transit.js
//
// Vertical transit for the Engineering Core — the exterior glass elevator
// on the south face and the ladder through a deck hatch. The ramps were
// scrapped in the revision interview; the two TRANSIT pins in grid-data.js
// are the only ground<->deck connections.
//
//   elevator — exterior cab breaching the south wall at its pin: plain metal
//     interior, floor-to-ceiling glass on the three space-facing walls, a
//     door on the hall side plus two hall-side metal gates (ground + deck
//     openings) so the hull only ever opens onto the cab itself.
//   ladder   — circular deck hatch + rungs; a direction-aware teleport
//     (blockout scaffolding — deleted when the real controller lands).
//
// Both route viewer movement through registries.transit handlers when main.js
// wires them (playerController.setSpawn / position.y pin for the ride); the
// default mutates the viewer directly, which serves the flycam and tests.

import * as THREE from 'three';
import { createDoor } from '../../systems/door-system.js';
import { HALL, DECK_Y, CEILING_Y, GROUND_Y, cellToWorld } from './grid-data.js';

// Mirrors maze-builder.js's WALL_THICKNESS (x1.5 blockout scale) — keep in
// sync if the hull is retuned.
const WALL_THICKNESS = 0.75;

// Exported for maze-builder.js — the segmented south wall must cut its
// breach around exactly these extents (same keep-in-sync role as
// WALL_THICKNESS below).
export const OPENING_HALF_WIDTH = 3; // the wall breach is one cell (6) wide
export const OPENING_HEIGHT = 6; // ground opening y 0-6, deck opening y 12-18
const CAB_SIZE = 6;
const TRAVEL_SPEED = 3; // 12-unit rise in ~4 s
const DOOR_DURATION = 1.5; // gates + cab door

/** Shared shaft geometry — the breach cell's centre plus exterior offsets. */
function shaftCenter(pin) {
  const { x } = cellToWorld(pin.col, pin.row);
  const wallZ = HALL.maxZ;
  const wallOuterZ = wallZ + WALL_THICKNESS / 2;
  const cabNorthZ = wallOuterZ + 0.225; // cab face just clear of the wall
  return { breachX: x, wallZ, wallOuterZ, cabNorthZ, cabCenterZ: cabNorthZ + CAB_SIZE / 2 };
}

function box(width, height, depth, material, position = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(...position);
  return mesh;
}

// ---------------------------------------------------------------------------
// Elevator — exterior cab, hall gates, call panels, send console.
// ---------------------------------------------------------------------------

export function createElevator(mats, registries, collision, pin) {
  const { breachX, wallZ, wallOuterZ, cabNorthZ, cabCenterZ } = shaftCenter(pin);

  const elevator = new THREE.Group();
  elevator.name = 'l2-elevator';

  // -- Static containment: the shaft's collision envelope (east/west/south).
  // Sits entirely beyond the wall plane, so it never touches in-hall motion;
  // with the gates closed it is what keeps a rider inside during travel.
  collision.addWall(
    breachX + OPENING_HALF_WIDTH + 0.3,
    CEILING_Y / 2,
    cabCenterZ,
    0.6,
    CEILING_Y,
    CAB_SIZE + 0.9,
    'elevator-shaft-east'
  );
  collision.addWall(
    breachX - OPENING_HALF_WIDTH - 0.3,
    CEILING_Y / 2,
    cabCenterZ,
    0.6,
    CEILING_Y,
    CAB_SIZE + 0.9,
    'elevator-shaft-west'
  );
  collision.addWall(
    breachX,
    CEILING_Y / 2,
    cabNorthZ + CAB_SIZE + 0.3,
    OPENING_HALF_WIDTH * 2 + 1.2,
    CEILING_Y,
    0.6,
    'elevator-shaft-south'
  );

  // -- Open guide-rail frame (visual, structural dims) up to the ceiling.
  const frame = new THREE.Group();
  frame.name = 'elevator-frame';
  const postZ = [wallOuterZ - 0.025, cabNorthZ + CAB_SIZE + 0.25];
  const postX = [breachX - OPENING_HALF_WIDTH - 0.5, breachX + OPENING_HALF_WIDTH + 0.5];
  for (const z of postZ) {
    for (const x of postX) {
      frame.add(box(0.45, CEILING_Y, 0.45, mats.metalDark, [x, CEILING_Y / 2, z]));
    }
  }
  for (const y of [6, 12, 18, 23.4]) {
    for (const z of postZ) {
      frame.add(box(7.45, 0.3, 0.3, mats.metal, [breachX, y, z]));
    }
    for (const x of postX) {
      frame.add(box(0.3, 0.3, 6.8, mats.metal, [x, y, cabCenterZ]));
    }
  }
  elevator.add(frame);

  // -- Hall-side metal gates: one per opening, closed (locked) at build.
  function makeGate(id, baseY) {
    const gate = createDoor(id, null, {
      width: OPENING_HALF_WIDTH * 2 + 0.6,
      height: OPENING_HEIGHT + 0.2,
      thickness: 0.4,
      color: 0x465059,
      metalness: 0.65,
      roughness: 0.45,
      centred: true,
      openDuration: DOOR_DURATION,
    });
    gate.position.set(breachX, baseY, wallZ);
    elevator.add(gate);
    return gate;
  }
  const gateGround = makeGate('l2-elevator-gate-ground', OPENING_HEIGHT / 2);
  const gateUpper = makeGate('l2-elevator-gate-upper', DECK_Y + OPENING_HEIGHT / 2);

  // Gate collision — plain AABBs matching the openings exactly, spliced out
  // of collision.wallAABBs while a gate is open and re-seated once it closes.
  function makeGateAabb(baseY, name) {
    return {
      minX: breachX - OPENING_HALF_WIDTH,
      maxX: breachX + OPENING_HALF_WIDTH,
      minY: baseY,
      maxY: baseY + OPENING_HEIGHT,
      minZ: wallZ - WALL_THICKNESS / 2,
      maxZ: wallZ + WALL_THICKNESS / 2,
      name,
    };
  }
  const gateAABBs = {
    ground: makeGateAabb(GROUND_Y, 'elevator-gate-ground'),
    upper: makeGateAabb(DECK_Y, 'elevator-gate-upper'),
  };
  collision.wallAABBs.push(gateAABBs.ground, gateAABBs.upper);

  // -- The cab: plain metal interior, glass on the three space-facing walls.
  const glass = new THREE.MeshStandardMaterial({
    color: 0x9fc3d8,
    transparent: true,
    opacity: 0.22,
    metalness: 0.1,
    roughness: 0.05,
    side: THREE.DoubleSide,
  });

  const cab = new THREE.Group();
  cab.name = 'elevator-cab';
  cab.position.set(breachX, GROUND_Y, cabCenterZ); // y animates 0 <-> DECK_Y

  // Floor top sits 0.06 above the cab origin so the sunk cab door never ends
  // coplanar with the walking surface (see slideDirection below).
  cab.add(box(CAB_SIZE, 0.56, CAB_SIZE, mats.metal, [0, -0.22, 0]));
  cab.add(box(CAB_SIZE, 0.4, CAB_SIZE, mats.metal, [0, 6.2, 0])); // ceiling
  cab.add(box(0.12, 6, CAB_SIZE - 0.3, glass, [2.94, 3, 0])); // east glass
  cab.add(box(0.12, 6, CAB_SIZE - 0.3, glass, [-2.94, 3, 0])); // west glass
  cab.add(box(CAB_SIZE - 0.3, 6, 0.12, glass, [0, 3, 2.94])); // south glass
  cab.add(box(0.25, 6, 0.4, mats.metal, [2.875, 3, -2.8])); // door-frame posts
  cab.add(box(0.25, 6, 0.4, mats.metal, [-2.875, 3, -2.8]));

  // Cab door on the hall side — sinks below the floor when open (a rising
  // slab would punch through the 6-unit cab ceiling).
  const cabDoor = createDoor('l2-elevator-cab-door', null, {
    width: 5.5,
    height: 5.7,
    thickness: 0.35,
    color: 0x555c66,
    metalness: 0.7,
    roughness: 0.35,
    centred: true,
    openDuration: DOOR_DURATION,
    slideDirection: -1,
  });
  cabDoor.position.set(0, 2.85, -2.85);
  cab.add(cabDoor);
  elevator.add(cab);

  // -- Call panels (hall side, one per floor) + send console (in the cab).
  function makeCallPanel(floorId, baseY, detail) {
    const panel = new THREE.Group();
    panel.name = `l2-elevator-call-${floorId}`;
    panel.add(box(0.7, 1.0, 0.12, mats.metalDark));
    panel.add(box(0.45, 0.6, 0.05, mats.screen, [0, 0.06, -0.06]));
    panel.position.set(
      breachX + OPENING_HALF_WIDTH + 1.15,
      baseY + 2.8,
      wallZ - WALL_THICKNESS / 2 - 0.08
    );
    panel.userData = {
      id: panel.name,
      interactable: true,
      prompt: { label: 'Call Elevator', detail, denied: false },
      interact() {
        callTo(floorId);
      },
    };
    elevator.add(panel);
    registries.interactables.push(panel);
    return panel;
  }
  makeCallPanel('ground', GROUND_Y, 'Ground Floor');
  makeCallPanel('upper', DECK_Y, 'Upper Deck');

  const sendConsole = new THREE.Group();
  sendConsole.name = 'l2-elevator-send';
  sendConsole.add(box(0.6, 1.8, 0.6, mats.metalDark, [0, 0.9, 0]));
  sendConsole.add(box(0.07, 0.7, 0.45, mats.screen, [-0.34, 1.35, 0]));
  sendConsole.position.set(2.35, 0, -2.3); // cab-local: NE corner
  sendConsole.userData = {
    id: 'l2-elevator-send',
    interactable: true,
    prompt: { label: 'Ride to Upper Deck', detail: 'Send Elevator', denied: false },
    interact() {
      send();
    },
  };
  cab.add(sendConsole);
  registries.interactables.push(sendConsole);

  // ----- State machine: idle-ground -> moving-up -> idle-upper -> moving-down
  let cabState = 'idle-ground';

  const gateFor = (floor) => (floor === 'ground' ? gateGround : gateUpper);
  const aabbFor = (floor) => gateAABBs[floor === 'ground' ? 'ground' : 'upper'];

  function spliceAabb(floor) {
    const list = collision.wallAABBs;
    const i = list.indexOf(aabbFor(floor));
    if (i !== -1) list.splice(i, 1);
  }

  function restoreAabb(floor) {
    const list = collision.wallAABBs;
    if (!list.includes(aabbFor(floor))) list.push(aabbFor(floor));
  }

  function openFloor(floor) {
    const gate = gateFor(floor);
    if (gate.userData.state === 'locked') gate.userData.unlock();
    if (gate.userData.state === 'unlocked') gate.userData.interact();
    spliceAabb(floor);
    if (cabDoor.userData.state === 'locked') cabDoor.userData.unlock();
    if (cabDoor.userData.state === 'unlocked') cabDoor.userData.interact();
  }

  function beginTravel(direction) {
    // Force all doors toward closed — close() only acts on 'open', so reverse
    // mid-open doors manually to avoid a softlock where doorsSeated() never
    // becomes true.
    for (const door of [cabDoor, gateGround, gateUpper]) {
      const ud = door.userData;
      if (ud.state === 'open') {
        ud.close();
      } else if (ud.state === 'opening') {
        ud.state = 'closing'; // reverse mid-open animation
      }
    }
    cabState = direction;
  }

  function callTo(floor) {
    if (cabState === `idle-${floor}`) {
      openFloor(floor);
      return;
    }
    if (floor === 'upper' && cabState === 'idle-ground') beginTravel('moving-up');
    else if (floor === 'ground' && cabState === 'idle-upper') beginTravel('moving-down');
    // In transit: ignored (blockout — no queueing).
  }

  function send() {
    if (cabState === 'idle-ground') beginTravel('moving-up');
    else if (cabState === 'idle-upper') beginTravel('moving-down');
  }

  function doorsSeated() {
    return (
      cabDoor.userData.openProgress === 0 &&
      gateGround.userData.openProgress === 0 &&
      gateUpper.userData.openProgress === 0
    );
  }

  /** Carry test: inside the cab's box, past the wall plane (flycam-proof). */
  function viewerInsideCab(viewer) {
    const p = viewer.position;
    return (
      Math.abs(p.x - breachX) < 3.4 &&
      p.z > wallZ + 0.3 &&
      p.z < cabNorthZ + CAB_SIZE + 0.4 &&
      Math.abs(p.y - cab.position.y) < 5.5
    );
  }

  /** X/Z-only carry test — used once riding is established, so the physics
   *  controller's storey-floor snap doesn't break the carry mid-descent. */
  function viewerInCabXZ(viewer) {
    const p = viewer.position;
    return (
      Math.abs(p.x - breachX) < 3.4 &&
      p.z > wallZ + 0.3 &&
      p.z < cabNorthZ + CAB_SIZE + 0.4
    );
  }

  // Riding flag — set once on the first moving frame if the viewer is in the cab,
  // cleared when the cab arrives (state goes idle) or the viewer leaves the cab's X/Z box.
  let riding = false;

  elevator.userData = {
    id: 'l2-elevator',
    cab,
    gates: { ground: gateGround, upper: gateUpper },
    cabDoor,
    callTo,
    send,
    get state() {
      return cabState;
    },
    get cabFloorY() {
      return cab.position.y;
    },

    update(delta, viewer) {
      cabDoor.userData.update(delta);
      gateGround.userData.update(delta);
      gateUpper.userData.update(delta);

      // Re-seat a gate's collision once it has fully closed again.
      for (const floor of ['ground', 'upper']) {
        const gate = gateFor(floor);
        if (gate.userData.openProgress === 0 && gate.userData.state !== 'opening') {
          restoreAabb(floor);
        }
      }

      if (cabState === 'moving-up' || cabState === 'moving-down') {
        if (doorsSeated()) {
          const dir = cabState === 'moving-up' ? 1 : -1;
          cab.position.y = THREE.MathUtils.clamp(
            cab.position.y + dir * TRAVEL_SPEED * delta,
            GROUND_Y,
            DECK_Y
          );

          // Blockout-only viewer carry. On the first moving frame, check if the
          // viewer is inside the cab (full x/y/z test). Once riding is established,
          // use x/z-only check so the physics controller's storey-floor snap doesn't
          // break the carry mid-descent. Cleared on arrival or if the viewer leaves.
          if (viewer) {
            if (!riding && viewerInsideCab(viewer)) {
              riding = true;
            }
            if (riding) {
              if (viewerInCabXZ(viewer)) {
                const ride = registries.transit.onRide;
                if (ride) ride(cab.position.y);
                else viewer.position.y = cab.position.y;
              } else {
                riding = false; // viewer left the cab's X/Z box (flycam escape)
              }
            }
          }

          if (cab.position.y === GROUND_Y) {
            cabState = 'idle-ground';
            riding = false;
            openFloor('ground');
          } else if (cab.position.y === DECK_Y) {
            cabState = 'idle-upper';
            riding = false;
            openFloor('upper');
          }
        }
      }

      // Keep the send console's prompt honest about where the cab is heading.
      sendConsole.userData.prompt =
        cabState === 'idle-ground'
          ? { label: 'Ride to Upper Deck', detail: 'Send Elevator', denied: false }
          : cabState === 'idle-upper'
            ? { label: 'Ride to Ground Floor', detail: 'Send Elevator', denied: false }
            : { label: 'In Transit', detail: '', denied: true };
    },
  };

  registries.updatables.push(elevator);
  return elevator;
}

// ---------------------------------------------------------------------------
// Ladder — deck hatch with rungs against the wall; teleport interactable.
// ---------------------------------------------------------------------------

export function createLadder(mats, registries, pin) {
  const { x, z } = cellToWorld(pin.col, pin.row);
  const HOLE_RADIUS = 1.5;
  const RING_RADIUS = 1.95;
  const GAP_ANGLE = 0.85; // ~49-degree rail gap on the wall side
  const RAIL_HEIGHT = 1.575; // matches the atrium rails (x1.5 blockout scale)
  const RUNG_Z_OFFSET = -1.2; // rungs sit toward the hole's north rim

  const ladder = new THREE.Group();
  ladder.name = 'l2-ladder';

  // Deck ring piece — replaces this cell's slab: 6x6 patch with the hole.
  const shape = new THREE.Shape();
  shape.moveTo(-3, -3);
  shape.lineTo(3, -3);
  shape.lineTo(3, 3);
  shape.lineTo(-3, 3);
  const hole = new THREE.Path();
  hole.absarc(0, 0, HOLE_RADIUS, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const ring = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: false }),
    mats.deck
  );
  ring.rotation.x = -Math.PI / 2; // extrusion runs upward, top flush with the deck
  ring.position.set(x, DECK_Y - 0.6, z);
  ladder.add(ring);

  // Ring rail with the gap facing the wall (north) — climb-through side.
  const rail = new THREE.Mesh(
    new THREE.TorusGeometry(RING_RADIUS, 0.09, 10, 48, Math.PI * 2 - GAP_ANGLE),
    mats.rail
  );
  rail.rotation.order = 'YXZ'; // lay flat first, then swing the gap north
  rail.rotation.x = -Math.PI / 2;
  rail.rotation.y = Math.PI / 2 + GAP_ANGLE / 2;
  rail.position.set(x, DECK_Y + RAIL_HEIGHT, z);
  ladder.add(rail);

  // Rail posts on the three closed sides (south, east, west).
  for (const [dx, dz] of [[0, 1], [1, 0], [-1, 0]]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, RAIL_HEIGHT, 10),
      mats.metalDark
    );
    post.position.set(x + dx * RING_RADIUS, DECK_Y + RAIL_HEIGHT / 2, z + dz * RING_RADIUS);
    ladder.add(post);
  }

  // Rungs — two stiles plus rungs, under the hole's north side.
  for (const sx of [-0.55, 0.55]) {
    const stile = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, DECK_Y + 1.2, 10),
      mats.rail
    );
    stile.position.set(x + sx, (DECK_Y + 1.2) / 2, z + RUNG_Z_OFFSET);
    ladder.add(stile);
  }
  for (let i = 0; i <= 10; i++) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 10), mats.rail);
    rung.rotation.z = Math.PI / 2;
    rung.position.set(x, 0.65 + i * 1.17, z + RUNG_Z_OFFSET);
    ladder.add(rung);
  }

  // Rail collision on the three closed arcs — the gap stays open for climbing.
  const collision = registries.collision;
  collision.addRail(x + 1.65, DECK_Y + RAIL_HEIGHT / 2, z, 0.6, RAIL_HEIGHT, 2.8, 'ladder-rail-east');
  collision.addRail(x, DECK_Y + RAIL_HEIGHT / 2, z + 1.65, 2.8, RAIL_HEIGHT, 0.6, 'ladder-rail-south');
  collision.addRail(x - 1.65, DECK_Y + RAIL_HEIGHT / 2, z, 0.6, RAIL_HEIGHT, 2.8, 'ladder-rail-west');

  // Teleport targets — land on solid floor, facing away from the wall.
  // UP z offset (2.6) clears ladder-rail-south (max z = 1.95 + capsule radius 0.6).
  const DOWN = { x, y: GROUND_Y, z: z + 0.5, yaw: 0 };
  const UP = { x, y: DECK_Y, z: z + 2.6, yaw: 0 };

  let lastViewer = null;
  ladder.userData = {
    id: 'l2-ladder',
    interactable: true,
    prompt: { label: 'Climb Down', detail: 'Ladder to ground floor', denied: false },

    update(delta, viewer) {
      if (!viewer) return;
      lastViewer = viewer;
      ladder.userData.prompt =
        viewer.position.y > DECK_Y / 2
          ? { label: 'Climb Down', detail: 'Ladder to ground floor', denied: false }
          : { label: 'Climb Up', detail: 'Ladder to upper deck', denied: false };
    },

    interact() {
      const viewer = lastViewer;
      if (!viewer) return;
      const target = viewer.position.y > DECK_Y / 2 ? DOWN : UP;
      const teleport = registries.transit.onTeleport;
      if (teleport) teleport(target.x, target.y, target.z, target.yaw);
      else viewer.position.set(target.x, target.y, target.z);
    },
  };

  registries.interactables.push(ladder);
  registries.updatables.push(ladder);
  return ladder;
}

// ---------------------------------------------------------------------------
// Starfield — one Points sphere beyond the shaft. No other sightline reaches
// past the hull, so space is visible only through the cab's glass.
// ---------------------------------------------------------------------------

export function createStarfield(pin) {
  const { breachX, cabCenterZ } = shaftCenter(pin);
  const COUNT = 2000;
  const RADIUS = 300;

  const positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const u = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    positions[i * 3] = r * Math.cos(phi) * RADIUS;
    positions[i * 3 + 1] = u * RADIUS;
    positions[i * 3 + 2] = r * Math.sin(phi) * RADIUS;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xd8e2f2, size: 2.2, sizeAttenuation: true });

  const stars = new THREE.Points(geometry, material);
  stars.name = 'l2-starfield';
  stars.position.set(breachX, DECK_Y / 2, cabCenterZ);
  return stars;
}
