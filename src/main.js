//main.js
import * as THREE from 'three';
import { SceneManager } from './core/SceneManager.js';
import { RendererSetup } from './core/RendererSetup.js';
import { LightingRig } from './core/LightingRig.js';
import { Camera } from './core/Camera.js';
import { createLevel1 } from './levels/level1-habitation-ring.js';
import { loadAstronaut } from './core/AssetLoader.js';
import { PlayerController } from './systems/physics-controller.js';
import { InputManager } from './core/InputManager.js';
import './ui/theme.css';
import { initUI, STATES } from './ui/index.js';

const sceneManager = new SceneManager();
const scene = sceneManager.getScene();

const rendererSetup = new RendererSetup();
const renderer = rendererSetup.getRenderer();

// UI (main menu, loading, pause, options, credits, HUD). Must run before the level and player
// are created so their asset loads are counted by the loading screen.
const ui = initUI({ canvas: renderer.domElement });

const cameraSetup = new Camera();
const camera = cameraSetup.getCamera();

// Level 1 — must exist before LightingRig, since lights are parented to its group
const level1 = createLevel1();
level1.group.rotation.z = Math.PI / 2;
scene.add(level1.group);

const lightingRig = new LightingRig(scene, level1.group, {
  lightCount: 8,
  radius: 28,
  ceilingHeight: 8,
});

const halObject = level1.group.getObjectByName('hal-9000');
if (!halObject) {
  console.warn('main.js: "hal-9000" not found in level group — proximity flicker will be disabled for this level.');
}
const halWorldPosition = halObject ? new THREE.Vector3() : null;
if (halObject) halObject.getWorldPosition(halWorldPosition);

// Player Model
const player = loadAstronaut();
scene.add(player);

const playerController = new PlayerController(player);
const inputManager = new InputManager();

const clock = new THREE.Clock();

// Space pressed on a menu button also queues a jump in InputManager; flush it so resuming
// doesn't launch the player.
ui.subscribe((state) => {
  if (state === STATES.PLAYING) inputManager.getInput();
});

// TODO(wire): see the WIRING notes at the top of src/ui/index.js —
//   ui.registerHooks({ resetLevel })   Alex: restart without location.reload()
//   ui.registerHooks({ lockPointer })  mouse-look: re-lock the mouse when Resume is clicked
//   ui.setFuelCount(fuelSystem.banked) whenever the fuel count changes

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const uiState = ui.getState();

  // Menus, loading and options cover the canvas entirely, so nothing to update or draw.
  // Paused keeps drawing the (frozen) scene behind the dimmed overlay.
  if (uiState === STATES.PAUSED) {
    renderer.render(scene, camera);
    return;
  }
  if (uiState !== STATES.PLAYING) return;

  playerController.update(delta, inputManager.getInput());

  if (level1.update) {
    level1.update(delta, player);
  }

  if (halWorldPosition) {
    lightingRig.updateProximityFlicker(player.position, halWorldPosition, delta);
  }

  // Camera now reads live data straight from the player, via the shared
  // interface Alex exposes on player.userData.
  const basis = player.userData.getSurfaceBasis();
  cameraSetup.update(basis);

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  cameraSetup.resize();
  rendererSetup.resize();
});