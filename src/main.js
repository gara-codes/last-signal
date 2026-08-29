//main.js
import * as THREE from 'three';
import { SceneManager } from './core/SceneManager.js';
import { RendererSetup } from './core/RendererSetup.js';
import { LightingRig } from './core/LightingRig.js';
import { createLevel1 } from './levels/level1-habitation-ring.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadAstronaut } from './core/AssetLoader.js';

const sceneManager = new SceneManager();
const scene = sceneManager.getScene();

const rendererSetup = new RendererSetup();
const renderer = rendererSetup.getRenderer();



const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

// Level 1
const level1 = createLevel1();
level1.group.rotation.z = Math.PI / 2; // commented out while debugging camera fit
scene.add(level1.group);

const lightingRig = new LightingRig(scene, level1.group,{
  lightCount: 8,
  radius: 25,        // slightly inside RADIUS (31) so lights sit inside the ring, not in the wall
  ceilingHeight: 8,  // tune this once you can see it — HEIGHT is 20, so ceiling is roughly y = 10
});

const halObject = level1.group.getObjectByName('hal-9000');
const halWorldPosition = new THREE.Vector3();
halObject.getWorldPosition(halWorldPosition); // computed once — AI doesn't move, so no need to redo this every frame


// Player Model
const player = loadAstronaut();
scene.add(player);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Auto-fit camera to the level's actual size instead of a guessed radius
const box = new THREE.Box3().setFromObject(level1.group);
const size = box.getSize(new THREE.Vector3());
const center = box.getCenter(new THREE.Vector3());
const maxDim = Math.max(size.x, size.y, size.z) || 10; // fallback if level is empty

const cameraDistance = maxDim * 1.5;
camera.position.set(
  center.x + cameraDistance,
  center.y + cameraDistance * 0.5,
  center.z + cameraDistance
);
camera.lookAt(center);

controls.target.copy(center);
controls.minDistance = maxDim * 0.2;
controls.maxDistance = maxDim * 3;
controls.update();

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  if (level1.update) {
    level1.update(delta, player);
  }

  lightingRig.updateProximityFlicker(player.position, halWorldPosition, delta);

  controls.update();
  renderer.render(scene, camera);
}

animate();

// Handle browser resizing
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  rendererSetup.resize();
});