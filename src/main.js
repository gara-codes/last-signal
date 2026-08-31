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
import { initMenu } from './ui/menu.js';

const sceneManager = new SceneManager();
const scene = sceneManager.getScene();

const rendererSetup = new RendererSetup();
const renderer = rendererSetup.getRenderer();

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

initMenu();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

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