import * as THREE from 'three';
import { SceneManager } from './core/SceneManager.js';
import { RendererSetup } from './core/RendererSetup.js';
import { Camera } from './core/Camera.js';
import { createLevel1 } from './levels/level1-habitation-ring.js';
import { loadAstronaut } from './core/AssetLoader.js';
import { PlayerController } from './systems/physics-controller.js';
import { InputManager } from './core/InputManager.js';
import { initMenu } from './ui/menu.js';

const sceneManager = new SceneManager();
const scene = sceneManager.getScene();

const rendererSetup = new RendererSetup();
const renderer = rendererSetup.getRenderer();

const cameraSetup = new Camera();
const camera = cameraSetup.getCamera();

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// Level 1
const level1 = createLevel1();
level1.group.rotation.z = Math.PI / 2;
scene.add(level1.group);

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
