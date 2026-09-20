import * as THREE from 'three';
import { createEmergencyLightingMaterial } from '../shaders/emergency-lighting.js';
import { loadFuelCell } from '../core/AssetLoader.js';
import { createDoor, applyFuelGate, updateInteractables, isSharedDoorResource } from '../systems/door-system.js';
import { FuelSystem } from '../systems/fuel-system.js';
import { DoorGate } from '../systems/door-gate.js';
import { setInteractPrompt } from '../ui/hud.js';

const SEGMENTS = 30;
const RADIUS = 31;
const HEIGHT = 20;
// Transit chamber: a flat-floored room whose 10 x 10 cross-section matches
// blast door 1's slab. Its centre sits this far from the ring axis so the
// floor lands exactly on the player's walking radius (RADIUS - 1.2 = 29.8),
// flush with the corridor surface — no step at the entry.
const CHAMBER_CENTRE_RADIUS = RADIUS - 1.2 - 5; // = 24.8
// Player walking radius — mirrors physics-controller.js (RADIUS - 1.2);
// used to convert world-z extents into rim angles for collision blockers
const WALK_RADIUS = RADIUS - 1.2;

// Initialize texture loader (shared across module)
const textureLoader = new THREE.TextureLoader();
const ringTexture = textureLoader.load('./assets/textures/spaceship-hull.png');
const pillarTexture = textureLoader.load('./assets/textures/spaceship-pillar.png');

/**
 * Creates the outer textured ring wall of the level.
 * @returns {THREE.Mesh}
 */
function createOuterRing() {
  const ringGeometry = new THREE.CylinderGeometry(RADIUS, RADIUS, HEIGHT, SEGMENTS);
  const ringMaterial = new THREE.MeshStandardMaterial({
    map: ringTexture,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(ringGeometry, ringMaterial);
}

/**
 * Creates the central decorative or structural pillar.
 * @returns {THREE.Mesh}
 */
function createCenterPillar() {
  const pillarGeometry = new THREE.CylinderGeometry(RADIUS / 5, RADIUS / 5, HEIGHT - 1, 50);
  const pillarMaterial = new THREE.MeshStandardMaterial({ map: pillarTexture });
  return new THREE.Mesh(pillarGeometry, pillarMaterial);
}

/**
 * Creates a cluster of 3 capsule-based pod bays side-by-side at the bottom of the curved hull.
 * @returns {THREE.Group}
 */
function createPodBays() {
  const group = new THREE.Group();
  group.name = 'pod-bays';

  const capRadius = 1.5;
  const capLength = 3.0;
  const capsuleGeometry = new THREE.CapsuleGeometry(capRadius, capLength, 8, 16);
  const capsuleMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a6a8a,
    metalness: 0.2,
    roughness: 0.4,
  });

  const spawnRadius = RADIUS - capRadius; // Sit just inside the outer curved hull
  const numPods = 3;

  // Since level1.group.rotation.z = Math.PI / 2, local -X (angle = Math.PI)
  // rotates to become the world -Y axis (the bottom curved hull of the spaceship).
  const centerAngle = Math.PI;
  const angleSpacing = 0.15; // Tight angular separation to place them closely side-by-side

  for (let i = 0; i < numPods; i++) {
    // Offset angles: -0.15, 0, and +0.15 relative to the bottom center
    const angle = centerAngle + (i - 1) * angleSpacing;
    const pod = new THREE.Mesh(capsuleGeometry, capsuleMaterial);

    const x = Math.cos(angle) * spawnRadius;
    const z = Math.sin(angle) * spawnRadius;
    const y = 7; // world x = -7 — clear of the transit chamber at the +x end

    pod.position.set(x, y, z);
    group.add(pod);
  }

  return group;
}

/**
 * Creates the HAL 9000 AI terminal mounted on the wall just past the pod bays.
 * @returns {THREE.Group}
 */
function createAI() {
  const halGroup = new THREE.Group();
  halGroup.name = 'hal-9000';

  const height = 14.0;
  const width = 5;
  const thickness = 1;

  // 1. Black panel body (the main box)
  const bodyGeometry = new THREE.BoxGeometry(height, thickness, width);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x0c0c0c,
    roughness: 0.15,
    metalness: 0.8,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  halGroup.add(body);

  // 2. Metallic bezel for the lens eye
  const bezelGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 24);
  const bezelMaterial = new THREE.MeshStandardMaterial({
    color: 0x888888,
    metalness: 0.9,
    roughness: 0.1,
  });
  const bezel = new THREE.Mesh(bezelGeometry, bezelMaterial);
  bezel.rotation.x = -Math.PI; // Point forward out of the panel
  bezel.position.set(2.5, -thickness / 2 - 0.05, 0); // Place in the upper portion of the panel
  halGroup.add(bezel);

  // 3. Glowing camera eye — custom emergency-lighting shader
  const eyeGeometry = new THREE.SphereGeometry(0.5, 16, 16);
  const { material: eyeMaterial, uniforms: emergencyUniforms } = createEmergencyLightingMaterial();
  const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  eye.position.set(2.5, -thickness / 2 - 0.15, 0); // Seat inside the bezel
  halGroup.add(eye);

  // 4. Positioning on the curved wall
  const wallRadius = RADIUS - 3; // Flush with the wall (accounting for half-thickness of 0.125)

  const x = -wallRadius * Math.cos(7 * Math.PI / 25);
  const z = Math.sin(-Math.PI / 6) * wallRadius;

  // The pod bays sit on the floor band around world x = -7; HAL mounts at
  // world x = -9, higher up the curved hull, so it stays clear of them.
  const y = 9;

  halGroup.position.set(x, y, z);

  // Rotate panel so it faces directly toward the center pillar
  halGroup.rotation.y = Math.atan2(halGroup.position.z, -halGroup.position.x);

  return { group: halGroup, emergencyUniforms };
}

/**
 * Builds the sealed transit chamber on the far side of the ring (the
 * world +Y band, at the +x end) — diametrically opposite the walking
 * floor where the AI and pod bays sit, so the player must traverse
 * around the rim to reach it. Its 10 x 10 cross-section exactly matches
 * blast door 1's slab, so the closed door caps the entry face flush; the
 * exit is blast door 2, a floor hatch that slides open toward the entry
 * and reveals a dark shaft below. Registers the hatch in the
 * interactables registry so its open animation ticks every frame.
 *
 * Room-local axis map (before the level group's rotation.z = Math.PI / 2):
 * +X -> world +Y (the far-side band — the room's floor face), +Y -> world
 * -X (axial, toward the entry), +Z -> world +Z (across the tube).
 * @param {THREE.Object3D[]} interactables - shared registry of updatable objects
 * @param {() => void} onExitOpen - fired when the exit hatch finishes opening
 * @returns {{ room: THREE.Group, exitDoor: THREE.Group }}
 */
function createTransitPoint(interactables, onExitOpen) {
  const room = new THREE.Group();
  room.name = 'transit-point';

  const width = 10; // local X -> world vertical (matches door 1's slab height)
  const height = 5; // local Y -> world axial (the room's length along the ring)
  const depth = 10; // local Z -> world across the tube (matches door 1's slab width)

  const sideWallGeometry = new THREE.PlaneGeometry(width, height); // 10 x 5: side walls + ceiling (depth === width)
  const endWallGeometry = new THREE.PlaneGeometry(width, depth); // 10 x 10: far end cap
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: ringTexture,
    side: THREE.DoubleSide,
  });

  // No plane on the local +Y end — that is the entry face (world x = +4.5),
  // capped flush by blast door 1's closed slab.

  // Floor (local +X face, flush with the far-side walking radius) — built
  // as two strips so the middle stays open below the hatch: local y in
  // [-2, 0] is the hatch footprint, full width across the tube.
  const floorFarStrip = new THREE.Mesh(new THREE.PlaneGeometry(depth, 0.5), wallMaterial);
  floorFarStrip.rotation.y = -Math.PI / 2;
  floorFarStrip.position.set(width / 2, -2.25, 0);
  room.add(floorFarStrip);

  const floorEntryStrip = new THREE.Mesh(new THREE.PlaneGeometry(depth, 2.5), wallMaterial);
  floorEntryStrip.rotation.y = -Math.PI / 2;
  floorEntryStrip.position.set(width / 2, 1.25, 0);
  room.add(floorEntryStrip);

  // Unlit black plane one unit beyond the floor (toward the hull): through
  // the open hatch it reads as a dark transit shaft instead of the curved hull.
  const shaft = new THREE.Mesh(
    new THREE.PlaneGeometry(depth, 2),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  shaft.rotation.y = -Math.PI / 2;
  shaft.position.set(width / 2 + 1, -1, 0);
  room.add(shaft);

  // Ceiling (local -X face — world y = +19.8, level with door 1's risen slab)
  const ceiling = new THREE.Mesh(sideWallGeometry, wallMaterial);
  ceiling.rotation.y = Math.PI / 2;
  ceiling.position.x = -width / 2;
  room.add(ceiling);

  // Side walls (local -Z and +Z faces)
  const leftWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
  leftWall.position.z = -depth / 2;
  room.add(leftWall);

  const rightWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
  rightWall.rotation.y = Math.PI;
  rightWall.position.z = depth / 2;
  room.add(rightWall);

  // Far end wall (local -Y face — world x = +9.5, just inside the hull cap)
  const farWall = new THREE.Mesh(endWallGeometry, wallMaterial);
  farWall.rotation.x = -Math.PI / 2;
  farWall.position.y = -height / 2;
  room.add(farWall);

  // Exit blast door — a floor hatch lying in the local +X floor plane.
  // rotation.y = -Math.PI / 2 turns the panel's thickness axis toward the
  // ring axis (the walkable face) and its slide axis along room-local +Y,
  // so slideDirection 1 (the default) slides it 2 units toward the entry:
  // local y in [-2, 0] closed, [0, 2] open — always inside the 5-unit room.
  const blastDoor = createDoor('l1-blastdoor-2', onExitOpen, {
    width: 10, // across the tube — spans the room's full depth
    height: 2, // axial length; also the slide distance (see door-system)
    thickness: 0.4,
    color: 0xFF2600,
    metalness: 0.9,
    roughness: 0.1,
    openDuration: 2.5,
    centred: true,
  });
  // The extra +0.15 seats the 0.4-thick panel so its walkable face sits
  // 0.05 inside the floor strips — no z-fighting, near-flush to walk over.
  blastDoor.rotation.y = -Math.PI / 2;
  blastDoor.position.set(width / 2 + 0.15, -1, 0);
  room.add(blastDoor);
  interactables.push(blastDoor); // Register for updates

  // Level y = -7 maps to world x = +7; level +X maps to world +Y (the far
  // side). The room spans world x in [4.5, 9.5] on the far-side band
  // (world y in [19.8, 29.8]) — opposite the AI and pod bays on the
  // walking floor, reachable only by traversing around the rim.
  room.position.set(CHAMBER_CENTRE_RADIUS, -7, 0);

  return { room, exitDoor: blastDoor };
}

// Fuel cell spawn spots in level-local space — deliberately scattered so
// the player has to work the whole ring: both z sides of the walking
// floor, a side band halfway up the rim, and one on the far side as the
// breadcrumb that reveals the ring is walkable all the way around.
// Five cells vs 1 (door 1) + 2 (door 2) spent banks 2 for L2.
const FUEL_CELL_PLACEMENTS = [
  { x: -(RADIUS - 3), y: 7, z: 8 },   // world (-7, -28,   8) — pod-bay end, +z side of the floor band
  { x: -(RADIUS - 3), y: -3, z: -9 }, // world ( 3, -28,  -9) — +x half, -z side of the floor band
  { x: 0, y: 2, z: RADIUS - 3 },      // world (-2,   0,  28) — +z side band, halfway up the rim
  { x: -(RADIUS - 3), y: 8, z: -8 },  // world (-8, -28,  -8) — deep -x end, -z side of the floor band
  { x: RADIUS - 3, y: -2, z: 0 },     // world ( 2,  28,   0) — far side, just before door 1
];
const PICKUP_RADIUS = 2.5;
const scratchVec = new THREE.Vector3(); // Module scope — reused every frame, never allocated in the loop
const INTERACT_RADIUS = 3; // Max distance from the player to an interactable's world AABB for the E-key
const interactBox = new THREE.Box3();
function findNearestInteractable(interactables, player, maxDistance){
  let best = null;
  let bestDist = maxDistance;
  for(const obj of interactables){
    if(!obj.userData?.interactable) continue;
    interactBox.setFromObject(obj);                        // world AABB incl. all descendants + rotations
    const distance = interactBox.distanceToPoint(player.position);
    if(distance < bestDist) {best = obj; bestDist=distance;}
  }
  return best;
}
/**
 * Spawns one fuel cell per FUEL_CELL_PLACEMENTS entry. Collection is
 * proximity-based (driven from the level update loop), so no interact
 * key is required at alpha.
 * @param {FuelSystem} fuelSystem - banked reserve to credit on pickup
 * @param {THREE.Object3D[]} interactables - registry the cells join at
 *   creation; each cell removes itself from it when collected
 * @returns {THREE.Group}
 */
function createFuelCells(fuelSystem, interactables) {
  const cells = new THREE.Group();
  cells.name = 'fuel-cells';

  for (const placement of FUEL_CELL_PLACEMENTS) {
    const cell = loadFuelCell();
    cell.position.set(placement.x, placement.y, placement.z);

    cell.userData = {
      isFuelCell: true,
      collected: false,
      interactable: true,
      interact() {
        if (cell.userData.collected) return;
        cell.userData.collected = true;
        fuelSystem.pickup(1);
        // Leave the update registry so the collected cell stops ticking
        const index = interactables.indexOf(cell);
        if (index !== -1) interactables.splice(index, 1);
        cell.removeFromParent();
      },
      update(delta) {
        cell.rotation.y += delta * 1.5;
      },
    };

    cells.add(cell);
  }

  return cells;
}

/**
 * Creates the first blast door: a 10x10 fuel-gated bulkhead across the
 * corridor, placed with HAL-style polar positioning plus a roll that keeps
 * the door's edges vertical at any wall angle.
 * @returns {THREE.Group}
 */
function createBlastDoor() {
  const blastDoorOne = createDoor('l1-blastdoor-1', undefined, {  //When we later want the open sound cue, replace undefined with () => playDoorOpenSound()
    width: 10,
    height: 10,
    thickness: 1,
    color: 0xFF2600,
    metalness: 0.9,
    roughness: 0.1,
    openDuration: 2.5,
    centred: true,
    // On the far-side band the door's local +Y points outward (toward the
    // hull), so -1 flips the rise toward the ring axis — player-up there —
    // keeping the open slab inside the drum, clear of the hull and pillar.
    slideDirection: -1,
  });
  // Door centre sits at the transit chamber's centre height (see
  // CHAMBER_CENTRE_RADIUS), so the slab's outer edge is flush with the
  // far-side walking radius and its 10 x 10 face exactly caps the chamber's
  // entry. wallAngle Math.PI puts it on the far-side band (level-local +X
  // -> world +Y). doorAngle must still come from the FINAL x/z so the
  // upright roll compensates the true wall angle.
  const wallRadius = CHAMBER_CENTRE_RADIUS;
  const wallAngle = Math.PI;
  const x = -Math.cos(wallAngle) * wallRadius;
  const z = Math.sin(wallAngle) * wallRadius;
  const doorAngle = Math.atan2(z, x);
  // Euler 'YXZ': X tips the face to look down the corridor, Y faces the ring
  // centre (HAL's atan2 facing), Z rolls the door upright in its own plane.
  blastDoorOne.rotation.set(Math.PI / 2, Math.atan2(z, -x), Math.PI / 2 - doorAngle, 'YXZ');
  // Level y = -4 maps to world x = +4, so the 1-thick slab spans world
  // x in [3.5, 4.5] — its inner face flush with the chamber entry at 4.5.
  blastDoorOne.position.set(x, -4, z);
  return blastDoorOne;
}
/**
 * Main orchestration function for Level 1.
 * @returns {{ group: THREE.Group, dispose: () => void, update: (delta: number, player: THREE.Object3D, input: Object) => void, attachCollision: (playerController: Object) => void }}
 */
export function createLevel1() {
  const level1Group = new THREE.Group();
  level1Group.name = 'level-1';

  // Instantiate and add the sub-components
  const ring = createOuterRing();
  const pillar = createCenterPillar();
  const podBays = createPodBays();
  const { group: hal, emergencyUniforms } = createAI();

  const fuelSystem = new FuelSystem(0); // Constructor takes the starting reserve
  const interactables = [];

  const blastDoorOne = createBlastDoor();
  applyFuelGate(blastDoorOne, new DoorGate('l1-blastdoor-1', 1), fuelSystem);
  interactables.push(blastDoorOne);

  const { room, exitDoor } = createTransitPoint(interactables, () => {
    console.log(`LEVEL 1 COMPLETE - banked for L2: ${fuelSystem.banked}`);
    //Beta: level-swap lives here; `banked` becomes L2's starting reserve
  });
  applyFuelGate(exitDoor, new DoorGate('l1-blastdoor-2', 2), fuelSystem);

  const cells = createFuelCells(fuelSystem, interactables);
  for (const cell of cells.children) interactables.push(cell);

  level1Group.add(ring);
  level1Group.add(pillar);
  level1Group.add(podBays);
  level1Group.add(hal);
  level1Group.add(blastDoorOne);
  level1Group.add(room);
  level1Group.add(cells);

  level1Group.userData.fuelSystem = fuelSystem; // Console/debug access

  // --- Collision ---------------------------------------------------------
  // Walls are solid rectangles in the drum's own (axial, theta) coordinates:
  // a wall standing on the walking surface blocks a contiguous theta range
  // at every axial position it spans, so the curved geometry reduces to
  // simple 2D rectangles the controller can push the player out of.
  let attachedController = null;
  const wallBlockers = [];
  let doorBlocker = null;

  /**
   * Registers this level's solid geometry with the player controller.
   * Call once, after the controller exists (main.js does this).
   * @param {Object} playerController - the PlayerController (systems/physics-controller.js)
   */
  function attachCollision(playerController) {
    attachedController = playerController;

    // Rim angle where the player's WALK_RADIUS path crosses the z = ±5
    // planes shared by door 1's slab and the room's side walls
    const thetaBand = Math.asin(5 / WALK_RADIUS);

    // Closed door 1 — blocks axial passage through the doorway and rim
    // passage across the slab. Deactivated in update() once the rising
    // slab leaves walk-through headroom. Padded 0.3 on the approach face.
    doorBlocker = playerController.addWallBlocker({
      aMin: 3.2,
      aMax: 4.5,
      tMin: -thetaBand - 0.01,
      tMax: thetaBand + 0.01,
    });
    wallBlockers.push(doorBlocker);

    // Room side walls (world z = ±5, axial x in [4.5, 9.5]) — stop
    // rim-walking through the chamber from outside and strolling out
    // through the walls from inside. The far wall needs no blocker: the
    // controller's AXIAL_CLAMP (9) already stops the player before 9.5.
    wallBlockers.push(playerController.addWallBlocker({
      aMin: 4.5,
      aMax: 9.5,
      tMin: thetaBand - 0.02,
      tMax: thetaBand + 0.02,
    }));
    wallBlockers.push(playerController.addWallBlocker({
      aMin: 4.5,
      aMax: 9.5,
      tMin: -thetaBand - 0.02,
      tMax: -thetaBand + 0.02,
    }));
  }

  /**
   * Cleans up level resources when transitioned or destroyed.
   */
  function dispose() {
    setInteractPrompt(null); // Hide the HUD prompt along with the level
    if (attachedController) {
      for (const blocker of wallBlockers) attachedController.removeWallBlocker(blocker);
    }
    level1Group.traverse((obj) => {
      if (obj.geometry && !isSharedDoorResource(obj.geometry)) {
        obj.geometry.dispose();
      }
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) {
          if (!isSharedDoorResource(mat)) mat.dispose();
        }
      }
    });
  }

  /**
   * Advances time-driven effects: the emergency-lighting shader, every
   * registered interactable (door animations, fuel cell spin), proximity
   * pickup of fuel cells when the player is in range, interact-key
   * dispatch to the nearest interactable in reach (mirrored by the
   * on-screen "[ E ] Interact" prompt), and door 1's collision blocker
   * deactivation once its slab has risen clear.
   * @param {number} delta - seconds since the last frame
   * @param {THREE.Object3D} player - astronaut group, used for pickup range
   * @param {Object} input - frame input from InputManager.getInput(); its
   *   `interact` flag is true only on the frame the key goes down
   */
  function update(delta, player, input) {
    // Collision upkeep: once door 1's slab has risen past 3 units of
    // headroom (30% of its travel), open the doorway for passage
    if (doorBlocker?.active && blastDoorOne.userData.openProgress >= 0.3) {
      doorBlocker.active = false;
    }

    emergencyUniforms.time.value += delta;
    updateInteractables(interactables, delta);

    if (!player) return;
    // Copy the list first: interact() removes the cell from `cells` mid-iteration
    for (const cell of [...cells.children]) {
      if (cell.userData.collected) continue;
      cell.getWorldPosition(scratchVec);
      if (scratchVec.distanceTo(player.position) < PICKUP_RADIUS) {
        cell.userData.interact();
      }
    }
    // Nearest interactable in reach drives both the E-key dispatch and
    // the on-screen prompt. Doors mid-animation or already open are
    // excluded from the prompt (E has no effect there) but still receive
    // the key press.
    const nearby = findNearestInteractable(interactables, player, INTERACT_RADIUS);
    const promptable =
      nearby && (!nearby.userData.state || nearby.userData.state === 'locked' || nearby.userData.state === 'unlocked');
    setInteractPrompt(promptable ? 'Interact' : null);
    if (input?.interact) nearby?.userData.interact?.();
  }

  return { group: level1Group, dispose, update, attachCollision };
}