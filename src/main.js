//main.js
import * as THREE from 'three';
import { SceneManager } from './core/SceneManager.js';
import { RendererSetup } from './core/RendererSetup.js';
import { LightingRig } from './core/LightingRig.js';
import { LightingRigL2 } from './core/LightingRigL2.js';
import { Camera } from './core/Camera.js';
import { FlyCam } from './core/FlyCam.js';
import { getCappedDelta } from './core/capped-delta.js';
import { createLevel1 } from './levels/level1-habitation-ring.js';
import { createLevel2 } from './levels/level2-engineering-core.js';
//import { createLevel3 } from './levels/level3-docking-corridor.js';
import { HALL, GROUND_Y, CEILING_Y } from './levels/level2/grid-data.js';
import { loadAstronaut } from './core/AssetLoader.js';
import { PlayerController } from './systems/physics-controller.js';
import { FlatPhysicsController } from './systems/flat-physics-controller.js';
import { InputManager } from './core/InputManager.js';
import './ui/theme.css';
import { initUI, STATES } from './ui/index.js';

// Dev swap: ?level=l2 loads the Engineering Core blockout with the flat
// controller + third-person camera; appending &cam=fly swaps in the dev
// flycam instead (blockout validation — no player model or physics).
// Default (no param) = L1 untouched.
const urlParams = new window.URLSearchParams(window.location.search);
const requestedLevel = urlParams.get('level');
const isL2 = requestedLevel === 'l2';
const isL3 = requestedLevel === 'l3';
const isBlockoutLevel = isL2 || isL3;
// Gated on isL2 so the real L1 -> L2 handoff (swapToL2) always keeps the
// player path — the flycam is for the direct blockout swap only.
const useFlyCam = isL2 && urlParams.get('cam') === 'fly';

// Where New Game goes back to (and what the HUD shows from the main menu on):
// the ?level=l2 dev start stays on L2 instead of snapping back to L1.
const START_LEVEL = isL2 ? 'l2' : 'l1';

// Astronaut reference scale on L2 (revision plan): the model's natural height
// is ~1.84 units, so 2.5 reads ~4.6 tall — the "grand hall, medium player"
// contrast the rescale is after. L1 keeps its own 4.
const ASTRONAUT_SCALE_L2 = 2.5;

const sceneManager = new SceneManager();
const scene = sceneManager.getScene();

const rendererSetup = new RendererSetup();
const renderer = rendererSetup.getRenderer();

// UI (main menu, loading, pause, options, credits, HUD). Must run before the level and player
// are created so their asset loads are counted by the loading screen.
const ui = initUI({
  canvas: renderer.domElement,
  initialLevelId: isBlockoutLevel ? requestedLevel : undefined,
});

// Level + camera branch — L1 (default) vs L2 (?level=l2 dev swap).

let level, cameraSetup, flyCam, player, playerController, fuelSystem;

// Which level is live. Starts from the dev param; flips to true when L1's
// exit hatch hands off to L2 (see swapToL2 below).
let inL2 = isL2;

// L1-only systems — LightingRig + HAL proximity flicker are drum-specific.
let lightingRig = null;
// L2 lighting pass — built in loadL2, replaces the blockout's placeholder fill lights.
let lightingRigL2 = null;
let halObject = null;
let halWorldPosition = null;
let l1TransitionFired = false;

// Fuel L2 was entered with, so restarting L2 (no checkpoint yet) gives the same start again.
let l2EntryReserve = 0;

// Death shows the Restart screen once per life (the loop stops on DEAD anyway; this makes the
// intent explicit and skips rebuilding the summary every frame).
let deathFired = false;

// L1->L2 swap state: null while idle, otherwise the countdown (seconds) until
// the swap runs. The power dip plays first; the fade starts at its darkest
// point so the dip is seen rather than hidden under the overlay.
let swapTimer = null;
let fadeStarted = false;
const SWAP_DELAY = 0.7; // dip length = time from hatch open to the swap
const FADE_OUT = 0.3; // last stretch of the dip, spent fading to black
const FADE_IN = 0.5; // seconds for the black overlay to clear after the swap
// Camera-to-head distance under which the player model is hidden. The camera sits up and behind the
// head, so beyond ~1.3 it is already clear of the model (~2.4 wide, ~4.6 tall in L2).
// Calibrated for L2's model only: L1's astronaut is scale 4 (~7.4 tall), so in L1 the camera can
// still end up inside it against a wall at distances above this. Known follow-up: make the
// distance per-level, or scale it by the model's scale.
const PLAYER_HIDE_DISTANCE = 1.3;

// L2 arrival cue: the HUD warning banner reads "Life Support Fault Detected" for this long
// (game time, so it holds while paused). The same banner slot carries the gravity warning later.
const FAULT_CUE_SECONDS = 5;
let faultCueTimer = null;

// Full-screen black overlay that hides the L1 -> L2 cut. Opacity is driven
// by CSS transitions, so there's no per-frame work.
const fadeOverlay = document.createElement('div');
fadeOverlay.style.cssText =
  'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:50;';
document.body.append(fadeOverlay);
function fadeTo(opacity, seconds) {
  fadeOverlay.style.transition = `opacity ${seconds}s ease-in-out`;
  fadeOverlay.style.opacity = String(opacity);
}

function setupL2Camera() {
  // L2's actual bounds (HALL.minX..maxX, GROUND_Y..CEILING_Y, HALL.minZ..maxZ)
  // — the drum's cylinder clamp doesn't apply here at all.
  // maxZ defaults to HALL.maxZ (30); extended to 36 dynamically when the player
  // enters the elevator shaft (z > 30) to allow the camera to follow into the cab.
  cameraSetup.setBounds({
    type: 'box',
    minX: HALL.minX,
    maxX: HALL.maxX,
    minY: GROUND_Y,
    maxY: CEILING_Y,
    minZ: HALL.minZ,
    maxZ: HALL.maxZ,
    margin: 1,
  });
  // Orbit distance ×1.5 to match the revised blockout (CELL_SIZE 4 → 6).
  cameraSetup.setOrbitDistance(13.5);
  // Walls + deck slabs: the camera stops at the first one between it and the player.
  cameraSetup.setBlockers(level.cameraBlockers);
}

function loadL1() {
  // L1 — the shipped level, drum-locked PlayerController + third-person camera.
  level = createLevel1();
  level.group.rotation.z = Math.PI / 2;
  scene.add(level.group);

  if (!cameraSetup) {
    cameraSetup = new Camera(); // reused across restarts
    scene.add(cameraSetup.getCamera()); // needed so the camera-parented flashlight renders
  }
  // Mirrors level1-habitation-ring.js's RADIUS / physics-controller.js's
  // HEIGHT_HALF — update alongside those two if the drum size changes.
  cameraSetup.setBounds({ type: 'cylinder', radius: 31, axialHalfLength: 10, margin: 1.5 });
  // The camera is reused after an L2 restart — drop L2's walls and its larger orbit distance.
  cameraSetup.setBlockers(null);
  cameraSetup.setOrbitDistance(9);

  if (!player) {
    player = loadAstronaut();
    scene.add(player);
  } else if (player.children[0]) {
    // Reused from L2 (swapToL1): restore the L1 scale (4) since L2 shrunk it to 2.5.
    player.children[0].scale.setScalar(4);
  }

  playerController = new PlayerController(player); // fresh controller = fresh spawn
  level.attachCollision(playerController);

  fuelSystem = level.group.userData.fuelSystem;
  if (!fuelSystem) {
    console.warn(
      'main.js: level1.group.userData.fuelSystem not found — the fuel counter will read 00.'
    );
  }
  showFuelTotal(0); // L1 starts empty: the total is just the cells placed in it

  lightingRig = new LightingRig(scene, level.group, { lightCount: 8, radius: 28, ceilingHeight: 8 });

  halObject = level.group.getObjectByName('hal-9000');
  if (!halObject) {
    console.warn('main.js: "hal-9000" not found in level group — proximity flicker will be disabled for this level.');
  }
  halWorldPosition = halObject ? new THREE.Vector3() : null;
  if (halObject) halObject.getWorldPosition(halWorldPosition);


  window.__game = { level1: level, player, playerController };
}

/**
 * Builds L2 from scratch (dev swap, `?level=l2`) or carrying L1's state
 * forward. The player model and camera are reused across the swap — only
 * the controller and level are replaced.
 * @param {{ startingReserve?: number, checkpoint?: object | null }} [carry]
 *   checkpoint: a snapshot from the previous L2's checkpoint (Restart From Checkpoint).
 */
function loadL2({ startingReserve = 0, checkpoint = null } = {}) {
  ui.setLevel('l2');
  if (!checkpoint) {
    l2EntryReserve = startingReserve;
    // Arrival cue only on a fresh entry, not when coming back from the checkpoint.
    ui.setWarning('Life Support Fault Detected', { pulse: true });
    faultCueTimer = FAULT_CUE_SECONDS;
  }
  level = createLevel2({ startingReserve, checkpoint });
  scene.add(level.group);

  if (useFlyCam) {
    // Dev validation path: FlyCam constructs its own PerspectiveCamera
    // (flashlight parented to it), so there's no player model, flat
    // controller or third-person rig to set up. The spawn view is the
    // eye-height establishing shot that computePlayerSpawn mirrors.
    flyCam = new FlyCam();
    const { position, lookAt } = level.getSpawnView();
    flyCam.setPositionAndLook(position, lookAt);

    // Astronaut scale reference at the spawn cell (revision plan): the flycam
    // has no player model, so this one stands in — same pose the player
    // path's spawn would have, for judging the ×1.5 world against a ~4.6-unit
    // figure. The player path gets the same read from the actual player.
    const reference = loadAstronaut({ scale: ASTRONAUT_SCALE_L2, useDefaultPosition: false });
    const spawn = level.getPlayerSpawn();
    reference.position.set(spawn.x, spawn.y, spawn.z);
    reference.rotation.y = spawn.yaw + Math.PI; // match the controller's model facing
    scene.add(reference);
  } else {
    if (!cameraSetup) {
      cameraSetup = new Camera();
      scene.add(cameraSetup.getCamera()); // dev ?level=l2 path; L1 handoff reuses the existing one
    }
    setupL2Camera();

    if (!player) {
      // Direct L2 entry (?level=l2): astronaut reference scale, and no L1
      // drum position baked in — the controller places the model at spawn.
      player = loadAstronaut({ scale: ASTRONAUT_SCALE_L2, useDefaultPosition: false });
      scene.add(player);
    } else if (player.children[0]) {
      // Reused from L1 (swapToL2): the loader options only apply at load
      // time, so re-scale the already-loaded model in place.
      player.children[0].scale.setScalar(ASTRONAUT_SCALE_L2);
    }

    playerController = new FlatPhysicsController(player, level.collisionData);
    const spawn = level.getPlayerSpawn();
    playerController.setSpawn(spawn.x, spawn.y, spawn.z, spawn.yaw);

    // Blockout transit plumbing — deleted when Alex's real controller owns
    // vertical movement. The ladder teleports through setSpawn; the elevator
    // ride re-spawns the player at the cab floor each frame (level.update
    // runs after playerController.update in the loop, so the pin wins over
    // the controller's storey-floor snap mid-shaft).
    level.setTransitHandlers({
      onTeleport: (x, y, z, yaw) => playerController.setSpawn(x, y, z, yaw),
      onRide: (cabFloorY) =>
        playerController.setSpawn(
          playerController.position.x,
          cabFloorY,
          playerController.position.z,
          playerController.facingYaw
        ),
    });

    // Clear any orbit offset carried over from L1 so the camera starts behind the player.
    cameraSetup.yaw = 0;
    cameraSetup.pitch = 0;
  }

  fuelSystem = level.group.userData.fuelSystem;
  // Fixed for the level, checkpoint restarts included: what L2 was entered with + its cells.
  showFuelTotal(l2EntryReserve);
  syncVitals(); // the meters show this level's values from the first frame (checkpoint included)

  renderer.shadowMap.enabled = true; // a couple of L2 lights cast shadows
  lightingRigL2 = new LightingRigL2(scene, level.group);

  window.__game = { level2: level, player, playerController, flyCam };
}

/**
 * The real L1 -> L2 handoff: tears L1 down (GPU resources included), then
 * builds L2 with L1's banked fuel as its starting reserve. Runs from the
 * animate loop once the transition beat has had time to play.
 */
function swapToL2() {
  const banked = fuelSystem ? fuelSystem.banked : 0;

  // L1 teardown — level.dispose() frees geometry/materials and the HUD prompt;
  // the rig's lights live in the scene/level group so they go separately.
  scene.remove(level.group);
  level.dispose();
  lightingRig.dispose();
  lightingRig = null;
  halObject = null;
  halWorldPosition = null;

  inL2 = true;
  loadL2({ startingReserve: banked });

  ui.setFuelCount(fuelSystem.banked);

  fadeTo(0, FADE_IN);
}

if (isL2) {
  loadL2();
} else {
  loadL1();
}

/**
 * The Fuel Cells panel's "/ NN": cells available this level = carried in + placed in it. Carried
 * cells count so the held number can never be higher than the total. Hidden if the level
 * doesn't say how many it places.
 */
function showFuelTotal(carriedIn) {
  const placed = level.group.userData.fuelCellsPlaced;
  ui.setFuelTotal(Number.isFinite(placed) ? carriedIn + placed : null);
}

/** Pushes the live oxygen + health to the HUD meters (L2 only). Returns the oxygen system. */
function syncVitals() {
  const oxygenSystem = inL2 ? level.group.userData.oxygenSystem : null;
  if (oxygenSystem) {
    ui.setOxygen(oxygenSystem.fraction);
    ui.setHealth(oxygenSystem.health / 100);
  }
  return oxygenSystem;
}

/** Removes the live level and clears every per-level timer, so a new one can be built. */
function teardownLevel() {
  scene.remove(level.group);
  level.dispose();
  if (lightingRig) {
    lightingRig.dispose();
    lightingRig = null;
  }
  halObject = null;
  halWorldPosition = null;
  swapTimer = null; // a restart mid L1 -> L2 transition cancels it
  fadeStarted = false;
  fadeTo(0, 0);
  if (lightingRigL2) {
    // Its ambient + hemisphere lights live on the scene, not the level group, so without this
    // every L2 restart stacked another pair and they carried on into L1.
    lightingRigL2.dispose();
    lightingRigL2 = null;
  }
  renderer.shadowMap.enabled = false; // L2 turns shadows on; L1 is lit without them
  faultCueTimer = null;
  ui.setWarning(null);
  // The vitals hold their last value while hidden; start the next level from full, not from the
  // death that ended this one.
  ui.setOxygen(1);
  ui.setHealth(1);
  deathFired = false;
}

/**
 * Restarts without reloading the page (ui hook, see WIRING in src/ui/index.js). The UI shows
 * the loading screen first, so this runs while the world is not being updated or drawn.
 *   { full: true }   New Game: back to the start level (L1, or L2 on the ?level=l2 dev start)
 *                    with no fuel, repairs or checkpoint.
 *   { full: false }  Restart Level: the current level again. L2 restarts fresh, with the fuel
 *                    carried in from L1.
 *   { full: false, fromCheckpoint: true }  Restart From Checkpoint (Restart screen, L2 past
 *                    the checkpoint): L2 rebuilt as it was at the checkpoint. Falls back to a
 *                    fresh L2 if there is no snapshot.
 */
function resetLevel({ full = false, fromCheckpoint = false } = {}) {
  const restartL2 = inL2 && !full;
  const checkpoint =
    restartL2 && fromCheckpoint ? (level.group.userData.checkpoint?.load() ?? null) : null;

  teardownLevel();

  if (restartL2) {
    loadL2({ startingReserve: l2EntryReserve, checkpoint });
  } else if (full && START_LEVEL === 'l2') {
    inL2 = true; // dev start: New Game goes back to a fresh L2
    loadL2();
  } else {
    inL2 = false;
    l1TransitionFired = false;
    ui.setLevel('l1');
    loadL1();
  }

  // The flycam dev path never builds the third-person camera; nothing to reset there.
  if (cameraSetup) {
    cameraSetup.yaw = 0;
    cameraSetup.pitch = 0;
  }
  ui.setFuelCount(fuelSystem ? fuelSystem.banked : 0);
}

const inputManager = new InputManager(renderer.domElement);
const clock = new THREE.Clock();

// Space pressed on a menu button also queues a jump in InputManager; flush it so resuming
// doesn't launch the player.
ui.subscribe((state) => {
  if (state === STATES.PLAYING) {
    if (isBlockoutLevel) ui.setLevel(requestedLevel);
    inputManager.getInput();
  }
});

// See the WIRING notes at the top of src/ui/index.js.
ui.registerHooks({
  resetLevel,
  // Resume / Restart / closing a log re-lock the mouse from their click or key press (browsers
  // only grant pointer lock from a user gesture). requestPointerLock may return a promise that
  // rejects if the browser refuses; the canvas click in InputManager still works then.
  lockPointer: () => renderer.domElement.requestPointerLock()?.catch?.(() => {}),
  // TAB Ship Status reads the live repair states (none on L1: everything shows nominal there).
  getRepairFlags: () => (inL2 ? (level.group.userData.repairs?.exportFlags() ?? null) : null),
});

function animate() {
  requestAnimationFrame(animate);

  // Capped so a tab-refocus pause (or coming back from a menu) can't produce one giant step —
  // that would tunnel the player straight through the wall blockers
  const delta = getCappedDelta(clock);
  const uiState = ui.getState();

  // Menus, loading and options cover the canvas entirely, so nothing to update or draw.
  // Paused keeps drawing the (frozen) scene behind the dimmed overlay.
  if (uiState === STATES.PAUSED) {
    renderer.render(scene, (flyCam ?? cameraSetup).getCamera());
    return;
  }
  if (uiState !== STATES.PLAYING) return;

  const input = inputManager.getInput();

  if (flyCam) {
    // Dev flycam path — no player physics. The flycam's own PerspectiveCamera
    // is the viewer, so prompts, fuel pickups and the checkpoint all measure
    // from the eye. WASD moves, Space/C flies, Shift boosts.
    flyCam.applyLookDelta(input.mouseDX, input.mouseDY);
    flyCam.update(delta, input);
    level.update(delta, flyCam.getCamera(), input);
  } else {
    // cameraYaw: FlatPhysicsController (L2) uses this to make WASD
    // camera-relative; PlayerController (L1) ignores it, since the drum's
    // own movement is relative to the player's facing instead. One-frame
    // stale (from last frame's camera), same as applyLookDelta below —
    // imperceptible at frame rate.
    input.cameraYaw = cameraSetup.getWorldYaw(player.userData.getSurfaceBasis());

    // L1 (drum) and L2 (flat maze) both drive a PlayerController-shaped
    // object + the same third-person Camera, reading position/orientation
    // through the shared player.userData.getSurfaceBasis() interface.
    playerController.update(delta, input);
    cameraSetup.applyLookDelta(input.mouseDX, input.mouseDY);
    level.update(delta, player, input);

    // Dynamic camera bounds — L2 only. Extend maxZ when the player is in the elevator
    // shaft (z > 30) so the camera can follow into the cab. Revert to HALL.maxZ
    // when the player leaves the shaft to avoid the camera clipping through walls
    // at spawn (where the south wall is at z=30).
    // Guarded on inL2: L1 uses cylinder bounds (no maxZ), so without the guard this would
    // swap L1's drum clamp for L2's box on the first frame and wreck the L1 camera.
    if (inL2) {
      const playerZ = player.position.z;
      const inShaft = playerZ > HALL.maxZ;
      const currentMaxZ = cameraSetup._bounds?.maxZ;
      const targetMaxZ = inShaft ? 36 : HALL.maxZ;
      if (currentMaxZ !== targetMaxZ) {
        cameraSetup.setBounds({
          type: 'box',
          minX: HALL.minX,
          maxX: HALL.maxX,
          minY: GROUND_Y,
          maxY: CEILING_Y,
          minZ: HALL.minZ,
          maxZ: targetMaxZ,
          margin: 1,
        });
      }
    }

    const basis = player.userData.getSurfaceBasis();
    cameraSetup.update(basis, delta);

    // Backed against a wall the camera is squeezed in close; below this the view would be from
    // inside the model, so hide it for those frames instead. (L1 has no camera blockers yet, so
    // there the camera can still pass through its door and walls — see the follow-ups on the PR.)
    player.visible = cameraSetup.headDistance > PLAYER_HIDE_DISTANCE;
  }

  // update() only touches strip-light intensities from elapsed time (no
  // camera/player reads), so it runs after the branch for both paths.
  if (lightingRigL2) lightingRigL2.update(delta);

  ui.syncPrompt((flyCam ?? cameraSetup).getCamera()); // brackets follow the object, never a frame behind

  // Read the live count rather than hooking pickup(), so spending fuel on a door shows too.
  if (fuelSystem) ui.setFuelCount(fuelSystem.banked);

  // L2-only: oxygen + health meters, read the same way (live value each frame, not event-hooked).
  const oxygenSystem = syncVitals();
  if (oxygenSystem) {

    // Death -> the Restart ("Signal Lost") screen, with this run's summary.
    if (oxygenSystem.isDead && !deathFired) {
      deathFired = true;
      const data = level.group.userData;
      ui.showRestart({
        levelId: 'l2',
        fuelCells: fuelSystem ? fuelSystem.banked : 0,
        repairs: data.repairs?.exportFlags() ?? {},
        checkpointReached: data.checkpoint?.hasSnapshot() ?? false,
      });
    }
  }

  if (!inL2 && !l1TransitionFired && level.group.userData.l1Complete) {
    l1TransitionFired = true;
    swapTimer = SWAP_DELAY;
    fadeStarted = false;
    lightingRig.triggerPowerDip(SWAP_DELAY);
  }

  // L1-only: HAL proximity flicker + power dip.
  if (!inL2 && halWorldPosition) {
    lightingRig.updateProximityFlicker(player.position, halWorldPosition, delta);
  }
  if (!inL2) lightingRig.updatePowerDip(delta);

  if (faultCueTimer !== null) {
    faultCueTimer -= delta;
    if (faultCueTimer <= 0) {
      faultCueTimer = null;
      ui.setWarning(null);
    }
  }

  // Once the pan + dip have played out, replace L1 with L2. Done at the end
  // of the frame's updates so nothing above touches a disposed level.
  if (swapTimer !== null) {
    swapTimer -= delta;
    if (!fadeStarted && swapTimer <= FADE_OUT) {
      fadeStarted = true;
      fadeTo(1, Math.max(swapTimer, 0.05)); // swapToL2() fades back in
    }
    if (swapTimer <= 0) {
      swapTimer = null;
      swapToL2();
    }
  }

  renderer.render(scene, (flyCam ?? cameraSetup).getCamera());
}

animate();

window.addEventListener('resize', () => {
  (flyCam ?? cameraSetup).resize();
  rendererSetup.resize();
});
