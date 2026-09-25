//main.js
import * as THREE from 'three';
import { SceneManager } from './core/SceneManager.js';
import { RendererSetup } from './core/RendererSetup.js';
import { LightingRig } from './core/LightingRig.js';
import { Camera } from './core/Camera.js';
import { FlyCam } from './core/FlyCam.js';
import { getCappedDelta } from './core/capped-delta.js';
import { createLevel1 } from './levels/level1-habitation-ring.js';
import { createLevel2 } from './levels/level2-engineering-core.js';
import { loadAstronaut } from './core/AssetLoader.js';
import { PlayerController } from './systems/physics-controller.js';
import { InputManager } from './core/InputManager.js';
import './ui/theme.css';
import { initUI, STATES } from './ui/index.js';

// Dev swap: ?level=l2 loads the Engineering Core blockout with a flycam.
// Default (no param) = L1 untouched.
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

let level, cameraSetup, flyCam, player, playerController, fuelSystem;

if (isL2) {
  // L2 blockout — flycam validation, no player model or drum physics yet.
  ui.setLevel('l2');
  level = createLevel2();
  scene.add(level.group);

  flyCam = new FlyCam();
  cameraSetup = null; // FlyCam owns its own PerspectiveCamera

  const spawnView = level.getSpawnView();
  flyCam.setPositionAndLook(spawnView.position, spawnView.lookAt);

  player = null; // L2 blockout has no player model — flycam is the viewer
  playerController = null; // Alex's flat controller lands later
  fuelSystem = level.group.userData.fuelSystem;

  window.__game = { level2: level, flyCam };
} else {
  // L1 — the shipped level, drum-locked PlayerController + third-person camera.
  level = createLevel1();
  level.group.rotation.z = Math.PI / 2;
  scene.add(level.group);

  cameraSetup = new Camera();
  flyCam = null;

  player = loadAstronaut();
  scene.add(player);

  playerController = new PlayerController(player);
  level.attachCollision(playerController);

  fuelSystem = level.group.userData.fuelSystem;
  if (!fuelSystem) {
    console.warn(
      'main.js: level1.group.userData.fuelSystem not found — the fuel counter will read 00.'
    );
  }

  window.__game = { level1: level, player, playerController };
}

const inputManager = new InputManager(renderer.domElement);
const clock = new THREE.Clock();

// Space pressed on a menu button also queues a jump in InputManager; flush it so resuming
// doesn't launch the player.
ui.subscribe((state) => {
  if (state === STATES.PLAYING) inputManager.getInput();
});

// TODO(wire): see the WIRING notes at the top of src/ui/index.js —
//   ui.registerHooks({ resetLevel })   Alex: resetLevel({ full }) — restart without location.reload()
//   ui.registerHooks({ lockPointer })  mouse-look: re-lock the mouse when Resume is clicked

// L1-only systems — LightingRig + HAL proximity flicker are drum-specific.
const lightingRig = !isL2
  ? new LightingRig(scene, level.group, { lightCount: 8, radius: 28, ceilingHeight: 8 })
  : null;

const halObject = !isL2 ? level.group.getObjectByName('hal-9000') : null;
if (!isL2 && !halObject) {
  console.warn('main.js: "hal-9000" not found in level group — proximity flicker will be disabled for this level.');
}
const halWorldPosition = halObject ? new THREE.Vector3() : null;
if (halObject) halObject.getWorldPosition(halWorldPosition);

function animate() {
  requestAnimationFrame(animate);

  // Capped so a tab-refocus pause (or coming back from a menu) can't produce one giant step —
  // that would tunnel the player straight through the wall blockers
  const delta = getCappedDelta(clock);
  const uiState = ui.getState();

  // Menus, loading and options cover the canvas entirely, so nothing to update or draw.
  // Paused keeps drawing the (frozen) scene behind the dimmed overlay.
  if (uiState === STATES.PAUSED) {
    const cam = isL2 ? flyCam.getCamera() : cameraSetup.getCamera();
    renderer.render(scene, cam);
    return;
  }
  if (uiState !== STATES.PLAYING) return;

  const input = inputManager.getInput();

  if (isL2) {
    // L2 flycam path — no player physics, camera is the viewer.
    flyCam.applyLookDelta(input.mouseDX, input.mouseDY);
    flyCam.update(delta, input);
    const camera = flyCam.getCamera();
    level.update(delta, camera, input);
  } else {
    // L1 drum path — player physics + third-person camera.
    playerController.update(delta, input);
    cameraSetup.applyLookDelta(input.mouseDX, input.mouseDY);
    level.update(delta, player, input);

    // Camera now reads live data straight from the player, via the shared
    // interface Alex exposes on player.userData.
    const basis = player.userData.getSurfaceBasis();
    cameraSetup.update(basis);
  }

  // Read the live count rather than hooking pickup(), so spending fuel on a door shows too.
  if (fuelSystem) ui.setFuelCount(fuelSystem.banked);

  // L1-only: HAL proximity flicker.
  if (!isL2 && halWorldPosition) {
    lightingRig.updateProximityFlicker(player.position, halWorldPosition, delta);
  }

  const cam = isL2 ? flyCam.getCamera() : cameraSetup.getCamera();
  renderer.render(scene, cam);
}

animate();

window.addEventListener('resize', () => {
  if (isL2) {
    flyCam.resize();
  } else {
    cameraSetup.resize();
  }
  rendererSetup.resize();
});