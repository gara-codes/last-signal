//main.js
import * as THREE from 'three';
import { SceneManager } from './core/SceneManager.js';
import { RendererSetup } from './core/RendererSetup.js';
import { LightingRig } from './core/LightingRig.js';
import { Camera } from './core/Camera.js';
import { getCappedDelta } from './core/capped-delta.js';
import { createLevel1 } from './levels/level1-habitation-ring.js';
import { createLevel2 } from './levels/level2-engineering-core.js';
import { HALL, GROUND_Y, CEILING_Y } from './levels/level2/grid-data.js';
import { loadAstronaut } from './core/AssetLoader.js';
import { PlayerController } from './systems/physics-controller.js';
import { FlatPhysicsController } from './systems/flat-physics-controller.js';
import { InputManager } from './core/InputManager.js';
import './ui/theme.css';
import { initUI, STATES } from './ui/index.js';

// Dev swap: ?level=l2 loads the Engineering Core blockout with the flat
// controller + third-person camera. Default (no param) = L1 untouched.
const urlParams = new window.URLSearchParams(window.location.search);
const isL2 = urlParams.get('level') === 'l2';

const sceneManager = new SceneManager();
const scene = sceneManager.getScene();

const rendererSetup = new RendererSetup();
const renderer = rendererSetup.getRenderer();

// UI (main menu, loading, pause, options, credits, HUD). Must run before the level and player
// are created so their asset loads are counted by the loading screen.
const ui = initUI({ canvas: renderer.domElement });

// Level + camera branch — L1 (default) vs L2 (?level=l2 dev swap).

let level, cameraSetup, player, playerController, fuelSystem;

// Which level is live. Starts from the dev param; flips to true when L1's
// exit hatch hands off to L2 (see swapToL2 below).
let inL2 = isL2;

// L1-only systems — LightingRig + HAL proximity flicker are drum-specific.
let lightingRig = null;
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
}

function loadL1() {
  // L1 — the shipped level, drum-locked PlayerController + third-person camera.
  level = createLevel1();
  level.group.rotation.z = Math.PI / 2;
  scene.add(level.group);

  if (!cameraSetup) cameraSetup = new Camera(); // reused across restarts
  // Mirrors level1-habitation-ring.js's RADIUS / physics-controller.js's
  // HEIGHT_HALF — update alongside those two if the drum size changes.
  cameraSetup.setBounds({ type: 'cylinder', radius: 31, axialHalfLength: 10, margin: 1.5 });

  if (!player) {
    player = loadAstronaut();
    scene.add(player);
  }

  playerController = new PlayerController(player); // fresh controller = fresh spawn
  level.attachCollision(playerController);

  fuelSystem = level.group.userData.fuelSystem;
  if (!fuelSystem) {
    console.warn(
      'main.js: level1.group.userData.fuelSystem not found — the fuel counter will read 00.'
    );
  }

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

  if (!cameraSetup) cameraSetup = new Camera();
  setupL2Camera();

  if (!player) {
    player = loadAstronaut();
    scene.add(player);
  }

  playerController = new FlatPhysicsController(player, level.collisionData);
  const spawn = level.getPlayerSpawn();
  playerController.setSpawn(spawn.x, spawn.y, spawn.z, spawn.yaw);

  fuelSystem = level.group.userData.fuelSystem;

  window.__game = { level2: level, player, playerController };
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

  // Reset camera look state so L2 doesn't inherit L1's orbit offset
  cameraSetup.yaw = 0;
  cameraSetup.pitch = 0;
  ui.setFuelCount(fuelSystem.banked);

  fadeTo(0, FADE_IN);
}

if (isL2) {
  loadL2();
} else {
  loadL1();
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
  faultCueTimer = null;
  ui.setWarning(null);
  deathFired = false;
}

/**
 * Restarts without reloading the page (ui hook, see WIRING in src/ui/index.js). The UI shows
 * the loading screen first, so this runs while the world is not being updated or drawn.
 *   { full: true }   New Game: back to L1 with no fuel, repairs or checkpoint.
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
  } else {
    inL2 = false;
    l1TransitionFired = false;
    ui.setLevel('l1');
    loadL1();
  }

  cameraSetup.yaw = 0;
  cameraSetup.pitch = 0;
  ui.setFuelCount(fuelSystem ? fuelSystem.banked : 0);
}

const inputManager = new InputManager(renderer.domElement);
const clock = new THREE.Clock();

// Space pressed on a menu button also queues a jump in InputManager; flush it so resuming
// doesn't launch the player.
ui.subscribe((state) => {
  if (state === STATES.PLAYING) inputManager.getInput();
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
    renderer.render(scene, cameraSetup.getCamera());
    return;
  }
  if (uiState !== STATES.PLAYING) return;

  const input = inputManager.getInput();

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

  const basis = player.userData.getSurfaceBasis();
  cameraSetup.update(basis, delta);
  ui.syncPrompt(cameraSetup.getCamera()); // brackets follow the object, never a frame behind

  // Read the live count rather than hooking pickup(), so spending fuel on a door shows too.
  if (fuelSystem) ui.setFuelCount(fuelSystem.banked);

  // L2-only: oxygen + health meters, read the same way (live value each frame, not event-hooked).
  const oxygenSystem = inL2 ? level.group.userData.oxygenSystem : null;
  if (oxygenSystem) {
    ui.setOxygen(oxygenSystem.fraction);
    ui.setHealth(oxygenSystem.health / 100);

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

  renderer.render(scene, cameraSetup.getCamera());
}

animate();

window.addEventListener('resize', () => {
  cameraSetup.resize();
  rendererSetup.resize();
});