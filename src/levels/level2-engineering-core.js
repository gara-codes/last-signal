// src/levels/level2-engineering-core.js
//
// Orchestrator for the Engineering Core blockout. Mirrors the L1 contract:
//
//   const level = createLevel2();
//   scene.add(level.group);
//   level.update(delta, viewer, input);   // viewer = camera or player proxy
//   level.dispose();
//
// The flat controller (main.js) and third-person Camera now drive this
// level in place of the dev flycam. collisionData is the documented
// hand-off: plain AABBs + floorSpec, consumed as-is by FlatPhysicsController.
//
// Scope parked (named owners, not wired here):
//   gravity snap-back, AI dialogue/lying, L1→L2 transition beat,
//   banked-fuel handoff. Oxygen drain IS wired (see update() below).

import * as THREE from 'three';
import { validateLayout, PLACEMENTS, cellToWorld, DECK_Y, GROUND_Y } from './level2/grid-data.js';
import { createBlockoutMaterials, releaseHullTexture } from './level2/props.js';
import { buildLevelGeometry, placeAnchors } from './level2/maze-builder.js';
import { FuelSystem } from '../systems/fuel-system.js';
import { SystemRepairAllocation } from '../systems/system-repair-allocation.js';
import { CommandCenterOverride, Checkpoint } from '../systems/command-center.js';
import { OxygenSystem } from '../systems/oxygen-system.js';
import { updateInteractables, isSharedDoorResource } from '../systems/door-system.js';
import { setInteractPrompt } from '../ui/hud.js';
import { promptForInteractable } from '../ui/prompt-copy.js';
import {
  isRepairConsoleOpen,
  closeRepairConsole,
} from '../ui/screens/repair-console/repair-console.js';

const INTERACT_RADIUS = 3.5; // max world distance for the E-key prompt
const FUEL_PICKUP_RADIUS = 2.5; // proximity collection radius for fuel cells
const FUEL_HINT_RADIUS = 7; // fuel cells within this range get the "Collect Fuel Cell" hint
const EYE_HEIGHT = 1.7; // flycam spawn eye height above the deck/ground

// Reusable scratch vectors — module-level singletons, never allocated inside
// the per-frame loop. Concurrent L2 instances are not supported (the level
// is a singleton in main.js), so shared scratch state is safe.
const scratchPosition = new THREE.Vector3();
const scratchEuler = new THREE.Euler();

/** FlatPhysicsController's facingYaw, read back off the player model (it sets the model's
 *  quaternion to facingYaw + PI about +Y). 'YXZ' so a pure yaw doesn't come back as an X/Z flip. */
function facingYawOf(viewer) {
  const yaw = scratchEuler.setFromQuaternion(viewer.quaternion, 'YXZ').y - Math.PI;
  return Math.atan2(Math.sin(yaw), Math.cos(yaw)); // back into -PI..PI
}
const interactBox = new THREE.Box3();

// ---------------------------------------------------------------------------
// Registries — the three lists placeAnchors fills and the orchestrator reads.
// ---------------------------------------------------------------------------

function createRegistries() {
  return {
    interactables: [], // prompt + E-key dispatch candidates
    updatables: [], // per-frame animation tick
    fuelCells: [], // proximity pickup candidates
    collision: null, // set by buildLevelGeometry
  };
}

// ---------------------------------------------------------------------------
// Placeholder lighting — dim warm ambient + hemisphere. The real amber
// identity is Gara's pass; this is just enough to judge scale and mood.
// ---------------------------------------------------------------------------

function addPlaceholderLighting(group) {
  const ambient = new THREE.AmbientLight(0x8a7a5a, 1.2);
  const hemi = new THREE.HemisphereLight(0xc0b090, 0x3a2a10, 1.0);
  group.add(ambient, hemi);
  return { ambient, hemi };
}

// ---------------------------------------------------------------------------
// Per-frame helpers — proximity pickup, nearest-interactable prompt.
// ---------------------------------------------------------------------------

/**
 * Finds the closest interactable within maxDistance of the viewer.
 * Uses world AABBs (setFromObject) so rotated/scaled props measure correctly.
 */
function findNearestInteractable(interactables, viewer, maxDistance) {
  let best = null;
  let bestDist = maxDistance;
  for (const obj of interactables) {
    if (!obj.userData?.interactable) continue;
    interactBox.setFromObject(obj);
    const distance = interactBox.distanceToPoint(viewer.position);
    if (distance < bestDist) {
      best = obj;
      bestDist = distance;
    }
  }
  return best;
}

/**
 * Auto-collects fuel cells the viewer walks within FUEL_PICKUP_RADIUS of.
 * Returns nothing — the cell's interact() credits the FuelSystem and
 * removes itself from the scene graph.
 */
function tickFuelProximity(fuelCells, viewer) {
  for (const cell of fuelCells) {
    if (cell.userData.collected) continue;
    cell.getWorldPosition(scratchPosition);
    if (scratchPosition.distanceTo(viewer.position) < FUEL_PICKUP_RADIUS) {
      cell.userData.interact();
    }
  }
}

/** Closest uncollected fuel cell within maxDistance of the viewer, or null. */
function nearestFuelCell(fuelCells, viewer, maxDistance) {
  let best = null;
  let bestDist = maxDistance;
  for (const cell of fuelCells) {
    if (cell.userData.collected) continue;
    cell.getWorldPosition(scratchPosition);
    const distance = scratchPosition.distanceTo(viewer.position);
    if (distance < bestDist) {
      best = cell;
      bestDist = distance;
    }
  }
  return best;
}

/**
 * Dispatches the HUD prompt from the nearest interactable (copy in
 * ui/prompt-copy.js), locked onto that object. Doors mid-open or already
 * open get no prompt (E has no effect) but still receive the key press if
 * the viewer is in range. With nothing in reach, the nearest fuel cell gets
 * a hint prompt.
 * @returns {object|null} the nearby interactable (for the caller to dispatch)
 */
function resolvePrompt(registries, viewer) {
  const nearby = findNearestInteractable(registries.interactables, viewer, INTERACT_RADIUS);
  // An open repair console: walking away from its station closes it; while it stays open the
  // console shows its own prompt, so the world prompt hides.
  if (isRepairConsoleOpen()) {
    const repairId = nearby?.userData.repairId;
    if (repairId && isRepairConsoleOpen(repairId)) {
      setInteractPrompt(null);
      return nearby;
    }
    closeRepairConsole();
  }
  const prompt = promptForInteractable(nearby, registries.fuelSystem);
  if (prompt) {
    setInteractPrompt(prompt.label, { ...prompt, target: nearby });
    return nearby;
  }
  const cell = nearestFuelCell(registries.fuelCells, viewer, FUEL_HINT_RADIUS);
  if (cell)
    setInteractPrompt(cell.userData.prompt.label, { ...cell.userData.prompt, target: cell });
  else setInteractPrompt(null);
  return nearby;
}

// ---------------------------------------------------------------------------
// Spawn view — flycam starting pose. Upper-deck centre south, overlooking
// the atrium (L1 transit shaft arrives here).
// ---------------------------------------------------------------------------

function computeSpawnView() {
  const spot = PLACEMENTS.spawn;
  const { x, z } = cellToWorld(spot.col, spot.row);
  const floorY = spot.storey === 'upper' ? DECK_Y : GROUND_Y;
  const position = new THREE.Vector3(x, floorY + EYE_HEIGHT, z);
  // Face the hall centre (x=0, z=0) at deck height — the establishing shot
  // frames the atrium void and the far command-door end-cap.
  const lookAt = new THREE.Vector3(0, DECK_Y + EYE_HEIGHT, 0);
  return { position, lookAt };
}

/**
 * Floor-level spawn for the player controller (as opposed to computeSpawnView's
 * eye-height flycam pose) — feet at the spawn cell's storey floor, facing the
 * hall centre so the starting orientation matches the flycam's establishing shot.
 * @returns {{x:number, y:number, z:number, yaw:number}}
 */
function computePlayerSpawn() {
  const spot = PLACEMENTS.spawn;
  const { x, z } = cellToWorld(spot.col, spot.row);
  const floorY = spot.storey === 'upper' ? DECK_Y : GROUND_Y;
  // yaw=0 in FlatPhysicsController faces +Z; atan2(dx, dz) toward the hall
  // centre matches that convention.
  const yaw = Math.atan2(0 - x, 0 - z);
  return { x, y: floorY, z, yaw };
}

// ---------------------------------------------------------------------------
// createLevel2 — the public factory.
// ---------------------------------------------------------------------------

/**
 * @param {object} [options]
 * @param {boolean} [options.useTextures] - force texture loading on/off;
 *   defaults to auto-detect (on when `document` exists — i.e. not in tests).
 * @param {number} [options.startingReserve] - fuel cells carried from L1
 *   (0 for a fresh run or dev swap).
 * @param {object|null} [options.checkpoint] - a snapshot from a previous L2's
 *   `checkpoint.load()`. Rebuilds the level as it was at the checkpoint (Restart From
 *   Checkpoint): fuel, repairs, override, collected cells, oxygen/health and the player's
 *   spot. `startingReserve` is ignored when this is given.
 */
export function createLevel2(options = {}) {
  const useTextures = options.useTextures ?? typeof document !== 'undefined';
  const startingReserve = options.startingReserve ?? 0;
  const restore = options.checkpoint ?? null;

  // Layout lint — throws with human-readable problems if the maze data is
  // broken (anchor on solid cell, ramp footprint missing, etc.).
  const problems = validateLayout();
  if (problems.length > 0) {
    throw new Error(`L2 layout invalid:\n  • ${problems.join('\n  • ')}`);
  }

  const group = new THREE.Group();
  group.name = 'level-2';

  const mats = createBlockoutMaterials({ useTextures });
  const registries = createRegistries();

  const geometry = buildLevelGeometry(mats);
  registries.collision = geometry.collision;
  group.add(geometry.group);

  const fuelSystem = new FuelSystem(restore ? restore.fuelCount : startingReserve);
  registries.fuelSystem = fuelSystem;
  group.userData.fuelSystem = fuelSystem; // debug / HUD read

  const repairs = new SystemRepairAllocation(restore?.repairs ?? {});
  registries.repairs = repairs;
  group.userData.repairs = repairs; // debug / HUD read, and L3's exportFlags() source

  const override = new CommandCenterOverride();
  if (restore?.override) {
    override.terminalUnlocked = Boolean(restore.override.terminalUnlocked);
    override.hasOverrideItem = Boolean(restore.override.hasOverrideItem);
  }
  registries.override = override;
  group.userData.override = override; // debug read

  const checkpoint = new Checkpoint();
  if (restore) checkpoint.save(restore); // so a second death goes back to the same spot
  group.userData.checkpoint = checkpoint; // debug read

  // Ticked every frame in update() below; exposed on group.userData so
  // main.js can read oxygenSystem.fraction and push it to the HUD, same
  // pattern as fuelSystem/repairs/override/checkpoint above.
  const oxygenSystem = new OxygenSystem();
  if (restore) {
    oxygenSystem.oxygen = restore.oxygen;
    oxygenSystem.health = restore.health;
    oxygenSystem.isDepleted = restore.oxygen <= 0;
  }
  group.userData.oxygenSystem = oxygenSystem; // debug / HUD read

  // hasOverrideItem flips false -> true exactly once (inside the override
  // terminal's interact(), dispatched below); watched here so the checkpoint
  // is saved at that one moment rather than every frame after.
  let hadOverrideItem = override.hasOverrideItem;

  // Stub: the late-L2 lying phase (strip reprogramming, cold HUD lines)
  // wires here once power-allocation lands.
  function onCommandDoorOpen() {
    console.log('L2: command door opened — AI override phase begins');
  }

  const anchors = placeAnchors(mats, group, registries, onCommandDoorOpen);

  // Cells picked up before the checkpoint stay gone (fuelCells is in PLACEMENTS order).
  for (const index of restore?.collectedCells ?? []) {
    const cell = registries.fuelCells[index];
    if (!cell || cell.userData.collected) continue;
    cell.userData.collected = true;
    cell.removeFromParent();
  }
  const lighting = addPlaceholderLighting(group);

  // ----- update ----------------------------------------------------------

  function update(delta, viewer, input) {
    if (!viewer) {
      updateInteractables(registries.updatables, delta);
      return;
    }

    updateInteractables(registries.updatables, delta);
    tickFuelProximity(registries.fuelCells, viewer);

    // isRunning: input.running is the same raw value FlatPhysicsController's
    // own isRunning is set from each frame (flat-physics-controller.js:
    // "this.isRunning = running; // read by the oxygen system") — reading
    // it here avoids threading a playerController reference through
    // level.update()'s existing (delta, viewer, input) contract, since only
    // the player model (viewer), not the controller, is passed in.
    oxygenSystem.update(delta, input?.running ?? false);

    // Fall damage: FlatPhysicsController exposes a one-shot event the same
    // way it exposes getSurfaceBasis() — only non-zero on the frame a
    // snap-back-triggered fall lands hard enough to hurt (see its header
    // comment). This file owns applying it to health, same seam as the
    // oxygen drain above; the controller itself never touches OxygenSystem.
    const fallDamage = viewer.userData.consumeFallDamage?.() ?? 0;
    if (fallDamage > 0) oxygenSystem.takeDamage(fallDamage);

    const nearby = resolvePrompt(registries, viewer);
    if (input?.interact && nearby) {
      nearby.userData.interact?.();
    }

    // Checkpoint right before the backtrack begins: the moment the override
    // item is collected, the player is about to head back toward the
    // command door, so this is where the design doc's "checkpoint right
    // before the backtrack begins" lands.
    if (override.hasOverrideItem && !hadOverrideItem) {
      checkpoint.save({
        x: viewer.position.x,
        y: viewer.position.y,
        z: viewer.position.z,
        facing: viewer.rotation.y,
        yaw: facingYawOf(viewer),
        oxygen: oxygenSystem.oxygen,
        health: oxygenSystem.health,
        fuelCount: fuelSystem.count,
        // World state, so Restart From Checkpoint can rebuild the level as it was here.
        repairs: repairs.exportFlags(),
        override: {
          terminalUnlocked: override.terminalUnlocked,
          hasOverrideItem: override.hasOverrideItem,
        },
        collectedCells: registries.fuelCells.flatMap((cell, i) =>
          cell.userData.collected ? [i] : []
        ),
      });
    }
    hadOverrideItem = override.hasOverrideItem;
  }

  // ----- dispose ---------------------------------------------------------

  function dispose() {
    setInteractPrompt(null);
    closeRepairConsole();
    group.traverse((obj) => {
      if (obj.geometry && !isSharedDoorResource(obj.geometry)) {
        obj.geometry.dispose();
      }
      if (obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of materials) {
          if (!isSharedDoorResource(mat)) mat.dispose();
        }
      }
    });
    registries.interactables.length = 0;
    registries.updatables.length = 0;
    registries.fuelCells.length = 0;
    releaseHullTexture();
  }

  // ----- public surface --------------------------------------------------

  return {
    group,
    dispose,
    update,
    collisionData: geometry.collision.finalize(),
    getSpawnView: computeSpawnView,
    // From a checkpoint the player starts where the snapshot was taken.
    getPlayerSpawn: () =>
      restore
        ? { x: restore.x, y: restore.y, z: restore.z, yaw: restore.yaw ?? 0 }
        : computePlayerSpawn(),
    // Debug handles — console access for the flycam and fuel reads.
    __anchors: anchors,
    __lighting: lighting,
  };
}
