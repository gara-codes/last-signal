// src/levels/level2/props.js
//
// Primitive-built prop builders for the Engineering Core blockout — one
// small function per prop family, each returning an interactable-ready
// THREE.Group whose userData carries the blockout contract:
//
//   userData.interactable   shows up in the E-key / prompt dispatch
//   userData.prompt         { label, detail, denied, hint } for the HUD prompt, or
//   userData.getPrompt(fuelSystem)  the same, worked out each frame (copy: ui/prompt-copy.js)
//   userData.update(delta)  animation tick (registered by the orchestrator)
//
// Art upgrade path: every builder accepts { modelPath, texturePath } —
// give a prop a GLB later and the primitives swap out in one place
// (loadGlb fills a holder Group with the same async pattern as the fuel cell).

import * as THREE from 'three';
import { createDoor } from '../../systems/door-system.js';
import { loadFuelCell, loadGlb } from '../../core/AssetLoader.js';
import { REPAIR_STATES, REPAIR_COST } from '../../systems/system-repair-allocation.js';
import { TERMINAL_UNLOCK_COST } from '../../systems/command-center.js';
import { costPrompt, stationPrompt, FUEL_CELL_HINT } from '../../ui/prompt-copy.js';
import {
  openRepairConsole,
  isRepairConsoleOpen,
} from '../../ui/screens/repair-console/repair-console.js';

// props.js's own 'oxygen'/'gravity'/'comms' station ids never matched
// system-repair-allocation.js's SYSTEM_IDS vocabulary — map between them.
const REPAIR_SYSTEM_IDS = {
  oxygen: 'oxygen-scrubbers',
  gravity: 'gravity-stabilizers',
  comms: 'comms-array',
};

// Beacon colours double as the honest-hint identity (interview decision):
// each repair station advertises itself across the dark hall.
export const BEACON_COLORS = {
  oxygen: 0x35d6e8, // cyan
  gravity: 0x9a6cf0, // violet
  comms: 0x4ce07a, // green
};

const HULL_TEXTURE_PATH = './assets/textures/spaceship-hull.png';

// ---------------------------------------------------------------------------
// Materials — one factory per level instance. Per-instance materials that
// need independent state (pylon glow, strip honesty) are built in the
// prop, not here. useTextures:false keeps the module DOM-free for tests.
// ---------------------------------------------------------------------------

let cachedHullTexture = null;
function loadHullTexture() {
  if (!cachedHullTexture) {
    cachedHullTexture = new THREE.TextureLoader().load(HULL_TEXTURE_PATH);
  }
  return cachedHullTexture;
}

/** Frees the shared hull texture (L2's dispose() calls this). The next L2 loads it afresh. */
export function releaseHullTexture() {
  cachedHullTexture?.dispose();
  cachedHullTexture = null;
}

export function createBlockoutMaterials({ useTextures = true } = {}) {
  const hullMap = useTextures ? loadHullTexture() : null;
  return {
    hull: new THREE.MeshStandardMaterial({
      map: hullMap,
      color: hullMap ? 0xffffff : 0x6a6f76, // flat grey stand-in without DOM
      side: THREE.DoubleSide,
    }),
    deck: new THREE.MeshStandardMaterial({
      map: hullMap,
      color: hullMap ? 0xb8bcc2 : 0x565b63,
    }),
    metal: new THREE.MeshStandardMaterial({ color: 0x4c525a, metalness: 0.6, roughness: 0.5 }),
    metalDark: new THREE.MeshStandardMaterial({ color: 0x2e3238, metalness: 0.7, roughness: 0.4 }),
    ramp: new THREE.MeshStandardMaterial({ color: 0x3f454d, metalness: 0.5, roughness: 0.6 }),
    rail: new THREE.MeshStandardMaterial({ color: 0x8a9099, metalness: 0.8, roughness: 0.35 }),
    amber: new THREE.MeshStandardMaterial({
      color: 0x3a2405,
      emissive: 0xff9a1f,
      emissiveIntensity: 1.2,
    }),
    lensRed: new THREE.MeshStandardMaterial({
      color: 0x220505,
      emissive: 0xff2a1a,
      emissiveIntensity: 1.6,
    }),
    screen: new THREE.MeshStandardMaterial({
      color: 0x1a1206,
      emissive: 0xffb545,
      emissiveIntensity: 1.0,
    }),
  };
}

// ---------------------------------------------------------------------------
// Tiny mesh helpers — keep each builder reading like a parts list.
// ---------------------------------------------------------------------------

function box(width, height, depth, material, position = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(...position);
  return mesh;
}

function cylinder(radiusTop, radiusBottom, height, material, position = [0, 0, 0], segments = 20) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    material
  );
  mesh.position.set(...position);
  return mesh;
}

/** Wraps a GLB upgrade hook: model file wins, primitives are the fallback. */
function maybeModel(modelPath, scale, buildPrimitives) {
  const group = new THREE.Group();
  if (modelPath) {
    group.add(loadGlb(modelPath, scale));
  } else {
    buildPrimitives(group);
  }
  return group;
}

// ---------------------------------------------------------------------------
// Energy pylon — the maze border. Solid collision, swappable glow.
// ---------------------------------------------------------------------------

export function createPylon(mats, { modelPath } = {}) {
  const group = maybeModel(modelPath, 1, (g) => {
    // Per-instance core material: the AI-sabotage / power phase flips
    // pylons individually — never share this material between pylons.
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x2a1600,
      emissive: 0xff9a1f,
      emissiveIntensity: 1.4,
    });
    const post = (sx, sz) => box(0.22, 7.5, 0.22, mats.metalDark, [sx * 1.45, 3.85, sz * 1.45]);
    g.add(box(3.4, 0.25, 3.4, mats.metal, [0, 0.125, 0])); // base plate
    g.add(cylinder(1.15, 1.15, 7.3, coreMat, [0, 3.9, 0])); // glowing core
    g.add(box(3.0, 0.3, 3.0, mats.metal, [0, 7.65, 0])); // top plate
    g.add(post(-1, -1), post(-1, 1), post(1, -1), post(1, 1));
    g.userData.glow = coreMat;
  });
  group.userData = {
    ...group.userData,
    id: 'energy-pylon',
    setPowered(on) {
      group.userData.glow.emissiveIntensity = on ? 1.4 : 0.05;
    },
  };
  return group;
}

// ---------------------------------------------------------------------------
// Repair stations — the three-slot choice layer. Spending is wired later
// with power-allocation; the blockout ships them untouched and prompted.
// ---------------------------------------------------------------------------

function createStationShell(mats, beaconColor) {
  const group = new THREE.Group();
  group.add(box(3.2, 0.3, 3.2, mats.metal, [0, 0.15, 0])); // plinth
  group.add(createBeacon(mats, beaconColor));
  return group;
}

export function createOxygenStation(mats, { modelPath, repairs, fuelSystem } = {}) {
  const group = maybeModel(modelPath, 1, (g) => {
    g.add(createStationShell(mats, BEACON_COLORS.oxygen));
    for (let i = -1; i <= 1; i++) {
      g.add(cylinder(0.5, 0.5, 2.2, mats.metal, [i * 0.9, 1.4, -0.6])); // scrubber tanks
    }
    g.add(box(2.8, 0.35, 0.5, mats.metalDark, [0, 2.6, -0.6])); // manifold
    g.add(cylinder(0.12, 0.12, 2.2, mats.rail, [1.4, 1.4, 0.8])); // vent pipe
  });
  return finishStation(group, 'oxygen', { repairs, fuelSystem });
}

export function createGravityStation(mats, { modelPath, repairs, fuelSystem } = {}) {
  const group = maybeModel(modelPath, 1, (g) => {
    g.add(createStationShell(mats, BEACON_COLORS.gravity));
    g.add(box(1.2, 1.0, 1.2, mats.metalDark, [0, 0.8, 0])); // pedestal
    // Gyroscope rings — each spins on its own axis in update().
    const rings = [1.0, 0.75, 0.5].map((radius, i) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.06, 10, 32), mats.rail);
      ring.position.set(0, 2.0, 0);
      ring.userData.spinAxis = ['x', 'y', 'z'][i];
      return ring;
    });
    g.add(...rings);
    g.userData.rings = rings;
  });
  return finishStation(group, 'gravity', { repairs, fuelSystem });
}

export function createCommsStation(mats, { modelPath, repairs, fuelSystem } = {}) {
  const group = maybeModel(modelPath, 1, (g) => {
    g.add(createStationShell(mats, BEACON_COLORS.comms));
    g.add(box(1.4, 2.0, 0.8, mats.metal, [0, 1.3, -0.7])); // equipment cabinet
    const dish = cylinder(0.75, 0.15, 0.35, mats.rail, [0, 2.5, 0.2]);
    dish.rotation.x = -Math.PI / 3; // tilted toward the ceiling void
    g.add(dish);
    g.add(cylinder(0.04, 0.04, 1.6, mats.rail, [0.5, 2.4, -0.6])); // antenna
  });
  return finishStation(group, 'comms', { repairs, fuelSystem });
}

// E at a station opens its repair console (ui/screens/repair-console/); E again, with the console
// open, repairs one step. Esc or walking away closes it (screen-manager.js / the L2 orchestrator).
function finishStation(group, system, { repairs, fuelSystem } = {}) {
  const rings = group.userData.rings ?? [];
  const repairId = REPAIR_SYSTEM_IDS[system];
  // Seeded from the real allocator when one is wired (main.js/level2-engineering-core.js);
  // falls back to 'untouched' so callers that build a station standalone (existing
  // level2-props.test.js) still get a sensible default.
  const initialState = repairs ? repairs.getState(repairId) : REPAIR_STATES.UNTouched;
  group.userData = {
    ...group.userData,
    id: `${system}-station`,
    interactable: true,
    system,
    repairId, // SYSTEM_IDS name, also the console's id
    repairState: initialState, // 'untouched' | 'partial' | 'repaired' — flags L3 reads
    getPrompt: () =>
      stationPrompt(repairId, group.userData.repairState === REPAIR_STATES.REPAIRED),
    interact() {
      if (!repairs || !fuelSystem) return; // no allocator wired — inert in isolation/tests
      if (!isRepairConsoleOpen(repairId)) {
        openRepairConsole({
          systemId: repairId,
          getState: () => repairs.getState(repairId),
          getBanked: () => fuelSystem.banked,
          cost: REPAIR_COST,
        });
        return;
      }
      const result = repairs.repair(repairId, fuelSystem);
      if (!result.success) return; // can't afford it: the console's prompt already says so
      group.userData.repairState = result.newState;
    },
    update(delta) {
      for (const ring of rings) ring.rotation[ring.userData.spinAxis] += delta * 0.8;
    },
  };
  return group;
}

// ---------------------------------------------------------------------------
// Command-centre door — refuses fuel cells (design doc); the override item
// gates it in a later phase. Visual: torus vault frame around a createDoor
// slab so the state machine (locked->open) comes free and fuel-gateable.
// ---------------------------------------------------------------------------

export function createCommandDoor(mats, { modelPath, onOpen, override } = {}) {
  const group = new THREE.Group();
  group.name = 'l2-command-door';

  if (modelPath) {
    group.add(loadGlb(modelPath, 1));
  } else {
    const frame = new THREE.Mesh(new THREE.TorusGeometry(4.1, 0.55, 12, 40), mats.metalDark);
    frame.rotation.y = Math.PI / 2; // ring plane faces into the hall (+X)
    group.add(frame, box(1.2, 8.4, 1.2, mats.metal, [0, 4.2, -4.4]), box(1.2, 8.4, 1.2, mats.metal, [0, 4.2, 4.4]));
  }

  const slab = createDoor('l2-command-door-slab', onOpen, {
    width: 6.4,
    height: 6.4,
    thickness: 0.6,
    color: 0x8a2a1a,
    metalness: 0.85,
    roughness: 0.3,
    centred: true,
    openDuration: 3,
  });
  slab.rotation.y = Math.PI / 2; // slab faces +X; slides up along Y
  group.add(slab);

  group.userData = {
    id: 'l2-command-door',
    door: slab,
    interactable: true,
    // No fuel accepted (design doc): only the override item opens it. Nothing while it opens.
    getPrompt() {
      const state = slab.userData.state;
      if (state !== 'locked' && state !== 'unlocked') return null;
      if (override?.hasOverrideItem) return { label: 'Open Door', detail: 'Override Ready' };
      return { label: 'Open Door', detail: 'Override Required', denied: true };
    },
    interact() {
      // No fuel accepted (design doc) — only the collected override item
      // can unlock this. No-op in isolation/tests when override isn't wired.
      if (!override || !override.tryOpenDoor()) return;
      if (slab.userData.state === 'locked') slab.userData.unlock();
      slab.userData.interact();
    },
    update(delta) {
      slab.userData.update(delta);
    },
  };
  return group;
}

// ---------------------------------------------------------------------------
// Override terminal — the backtrack objective. Deep in the maze, powers the
// engineering log beat once power-allocation exists.
// ---------------------------------------------------------------------------

export function createOverrideTerminal(mats, { modelPath, fuelSystem, override } = {}) {
  const group = maybeModel(modelPath, 1, (g) => {
    g.add(box(1.4, 1.1, 0.9, mats.metalDark, [0, 0.55, 0])); // pedestal
    g.add(box(1.2, 0.7, 0.12, mats.screen, [0, 1.45, -0.3])); // amber screen
    g.add(box(0.5, 0.18, 0.35, mats.rail, [0, 1.05, 0.15])); // override module slot
  });
  group.userData = {
    ...group.userData,
    id: 'override-terminal',
    interactable: true,
    getPrompt(fuel) {
      if (override?.hasOverrideItem) return { label: 'Override Acquired', hint: true };
      return costPrompt('Reroute Power', TERMINAL_UNLOCK_COST, fuel?.banked ?? 0);
    },
    interact() {
      if (!override || !fuelSystem) return; // no-op in isolation/tests
      if (override.hasOverrideItem) return; // already collected
      if (!override.unlockTerminal(fuelSystem)) return; // can't afford yet
      override.collectOverride();
    },
  };
  return group;
}

// ---------------------------------------------------------------------------
// Surveillance camera — the AI's watching eyes. Idles on a slow pan sweep;
// once the player is within TRACK_RANGE it servos round to follow them, with
// a red cone + brighter lens as the tracking light. The level feeds it the
// player's position each frame via setTarget(). (Servo whir audio and the
// gravity-system flicker coupling are still to come.)
// ---------------------------------------------------------------------------

const CAMERA_SWEEP_SPEED = 0.3; // rad/s of the sweep clock
const CAMERA_SWEEP_RANGE = Math.PI / 3; // ±60°
const TRACK_RANGE = 32; // world units — player inside this gets tracked
const TRACK_TURN_SPEED = 1.6; // rad/s the servo can turn
const TRACK_YAW_LIMIT = 1.4; // max yaw from the mount's base facing (stay wall-side)
const TRACK_PITCH_LIMIT = 0.9;
const TRACK_AIM_HEIGHT = 1.2; // aim at the player's chest, not their feet
const LOCK_RATE = 3; // how fast the red light fades in/out (1/s)
const LENS_IDLE_INTENSITY = 1.6;
const LENS_LOCKED_INTENSITY = 4.5;
const CONE_LENGTH = 16;
const CONE_RADIUS = 3.2;
const CONE_MAX_OPACITY = 0.16;

// Scratch values — module-level so the per-frame update never allocates.
const trackTo = new THREE.Vector3();

function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function stepToward(current, target, maxStep) {
  return current + THREE.MathUtils.clamp(target - current, -maxStep, maxStep);
}

export function createCameraMount(mats, { modelPath } = {}) {
  // Per-camera lens material so each one can light up independently.
  const lensMat = mats.lensRed.clone();
  const group = maybeModel(modelPath, 1, (g) => {
    g.add(box(0.3, 0.3, 0.8, mats.metalDark, [0, 0, -0.4])); // wall bracket
    g.add(box(0.55, 0.55, 1.1, mats.metal, [0, 0, 0.35])); // body
    const lens = cylinder(0.16, 0.2, 0.2, lensMat, [0, 0, 1.0], 14);
    lens.rotation.x = Math.PI / 2;
    g.add(lens);
  });
  group.rotation.order = 'YXZ'; // yaw first, then pitch about the yawed X axis

  // Red tracking-light cone: apex at the lens, opening along local +Z.
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xff2a1a,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(CONE_RADIUS, CONE_LENGTH, 20, 1, true), coneMat);
  cone.rotation.x = -Math.PI / 2; // apex (+Y) -> -Z side, base -> +Z
  cone.position.set(0, 0, 1.0 + CONE_LENGTH / 2);
  cone.visible = false;
  group.add(cone);

  let sweepClock = Math.random() * Math.PI * 2; // desynchronise the mounts
  let target = null; // player position (live reference), or null
  let lock = 0; // 0 = idle sweep, 1 = fully locked on
  let yaw = null; // current servo angles; yaw seeded from baseYaw on first update
  let pitch = 0;

  group.userData = {
    ...group.userData,
    id: 'surveillance-camera',
    /** Called by the level each frame with the player's position (or null). */
    setTarget(position) {
      target = position;
    },
    update(delta) {
      const baseYaw = group.userData.baseYaw;
      if (yaw === null) yaw = baseYaw;
      sweepClock += delta * CAMERA_SWEEP_SPEED;

      // Is the player in range? Lock fades in/out so the light doesn't pop.
      let tracking = false;
      if (target) {
        trackTo.set(target.x, target.y + TRACK_AIM_HEIGHT, target.z).sub(group.position);
        tracking = trackTo.length() < TRACK_RANGE;
      }
      lock = stepToward(lock, tracking ? 1 : 0, LOCK_RATE * delta);

      // Desired aim: toward the player (kept within the wall-side arc), else the idle sweep.
      let desiredYaw = baseYaw + Math.sin(sweepClock) * CAMERA_SWEEP_RANGE;
      let desiredPitch = 0;
      if (tracking) {
        const offset = THREE.MathUtils.clamp(
          wrapAngle(Math.atan2(trackTo.x, trackTo.z) - baseYaw),
          -TRACK_YAW_LIMIT,
          TRACK_YAW_LIMIT
        );
        desiredYaw = baseYaw + offset;
        const horizontal = Math.hypot(trackTo.x, trackTo.z);
        desiredPitch = THREE.MathUtils.clamp(
          Math.atan2(-trackTo.y, horizontal),
          -TRACK_PITCH_LIMIT,
          TRACK_PITCH_LIMIT
        );
      }

      const maxStep = TRACK_TURN_SPEED * delta;
      yaw += THREE.MathUtils.clamp(wrapAngle(desiredYaw - yaw), -maxStep, maxStep);
      pitch = stepToward(pitch, desiredPitch, maxStep);
      group.rotation.y = yaw;
      group.rotation.x = pitch;

      // Red tracking light.
      lensMat.emissiveIntensity = THREE.MathUtils.lerp(
        LENS_IDLE_INTENSITY,
        LENS_LOCKED_INTENSITY,
        lock
      );
      coneMat.opacity = CONE_MAX_OPACITY * lock;
      cone.visible = lock > 0.01;
    },
  };
  return group;
}

// ---------------------------------------------------------------------------
// Fuel cell pickup — reuses the L1 GLB and proximity-collection contract.
// ---------------------------------------------------------------------------

export function createFuelCellSpawn(fuelSystem) {
  const cell = loadFuelCell();
  cell.userData = {
    id: 'fuel-cell',
    isFuelCell: true,
    collected: false,
    interactable: true,
    prompt: FUEL_CELL_HINT, // auto-pickup: hint only, no [E]
    interact() {
      if (cell.userData.collected) return;
      cell.userData.collected = true;
      fuelSystem.pickup(1);
      cell.removeFromParent();
    },
    update(delta) {
      cell.rotation.y += delta * 1.5;
    },
  };
  return cell;
}

// ---------------------------------------------------------------------------
// Honest-hint kit — amber floor strips (per-segment state = the AI-lying
// hook) and coloured station beacons.
// ---------------------------------------------------------------------------

export function createStrip(mats, routeId, index) {
  const material = mats.amber.clone(); // per-segment: lying phase recolours it
  const group = new THREE.Group();
  group.add(box(3.4, 0.06, 0.7, material, [0, 0.03, 0]));
  group.userData = {
    id: `strip-${routeId}-${index}`,
    routeId,
    index,
    honest: true,
    setHonest(honest) {
      group.userData.honest = honest;
      material.emissive.setHex(honest ? 0xff9a1f : 0x7a1a12); // amber vs dull red
    },
  };
  return group;
}

export function createBeacon(mats, color) {
  const beacon = new THREE.Group();
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: 1.6 })
  );
  beacon.add(cylinder(0.06, 0.06, 1.1, mats.metalDark, [0, 0.55, 0]), lamp);
  lamp.position.set(0, 1.25, 0);
  return beacon;
}
