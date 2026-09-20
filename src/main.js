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
import { FuelSystem } from './systems/fuel-system.js';
import { DoorGate } from './systems/door-gate.js';
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

// Fuel-cell pickups + the blast door they pay for. Cells/door are children
// of level1.group (which carries its own rotation), so world positions are
// snapshotted once here the same way halWorldPosition is above — these
// objects don't move, so there's no need to recompute every frame.
const FUEL_PICKUP_RADIUS = 3;
// The door mesh is mounted deep in the wall (createBlastDoor's wallRadius is
// 24 vs the player's WALK_RADIUS of ~29.8), so it sits recessed almost 9.5
// units radially inward from the surface the player actually walks on —
// verified by snapshotting the door's real getWorldPosition and comparing it
// against every reachable (axial, theta) player position. A tight radius
// like 4 is never reachable; 12 comfortably covers that ~9.5-unit gap.
const DOOR_INTERACT_RADIUS = 12;

const fuelSystem = new FuelSystem();
const blastDoorGate = new DoorGate('l1-blastdoor-1', 2);

const fuelCellsGroup = level1.group.getObjectByName('fuel-cells');
if (!fuelCellsGroup) {
  console.warn('main.js: "fuel-cells" not found in level group — fuel pickups will be disabled for this level.');
}
const fuelCells = (fuelCellsGroup ? fuelCellsGroup.children.slice() : []).map((cell) => {
  const worldPosition = new THREE.Vector3();
  cell.getWorldPosition(worldPosition);
  return { object: cell, worldPosition, collected: false };
});

const blastDoorObject = level1.group.getObjectByName('l1-blastdoor-1');
if (!blastDoorObject) {
  console.warn('main.js: "l1-blastdoor-1" not found in level group — door interaction will be disabled for this level.');
}
const blastDoorWorldPosition = blastDoorObject ? new THREE.Vector3() : null;
if (blastDoorObject) blastDoorObject.getWorldPosition(blastDoorWorldPosition);

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

  // Fuel-cell pickup: walking within range banks the cell and removes it.
  for (const cell of fuelCells) {
    if (cell.collected) continue;
    if (player.position.distanceTo(cell.worldPosition) < FUEL_PICKUP_RADIUS) {
      cell.collected = true;
      fuelSystem.pickup();
      cell.object.parent?.remove(cell.object);
    }
  }

  // Door-open interaction: walking within range of the blast door spends
  // banked fuel cells to unlock it (DoorGate is the "can we afford this"
  // check; the door's own unlock()/interact() trigger its slide-open visual).
  if (blastDoorObject && blastDoorWorldPosition) {
    if (player.position.distanceTo(blastDoorWorldPosition) < DOOR_INTERACT_RADIUS) {
      if (blastDoorGate.tryOpen(fuelSystem)) {
        blastDoorObject.userData.unlock();
        blastDoorObject.userData.interact();
      }
    }
    blastDoorObject.userData.update?.(delta);
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