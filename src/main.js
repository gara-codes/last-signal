import * as THREE from 'three';
import { SceneManager } from './core/SceneManager.js';
import { RendererSetup } from './core/RendererSetup.js';
import { Camera } from './core/Camera.js';
import { createLevel1 } from './levels/level1-habitation-ring.js';
import { loadAstronaut } from './core/AssetLoader.js';
import { PlayerController } from './systems/physics-controller.js';
import { InputManager } from './core/InputManager.js';

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

// TEMP: visual marker, kept for now until real getSurfaceBasis() integration
// is confirmed working — safe to delete once camera is driven by the real player.
const markerGeometry = new THREE.SphereGeometry(1, 16, 16);
const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const marker = new THREE.Mesh(markerGeometry, markerMaterial);
scene.add(marker);

function getMarkerPosition(axial, theta) {
    const markerRadius = (31 - 1.2) - 2;
    return new THREE.Vector3(
        axial,
        markerRadius * Math.cos(theta),
        markerRadius * Math.sin(theta),
    );
}

// TEMP: still driving the camera off the stub sweep for now — see note below
let axial = 0;
let theta = -Math.PI;

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    playerController.update(delta, inputManager.getInput());

    if (level1.update) {
        level1.update(delta, player);
    }

    theta += 0.005; // TEMP — still stub-driven, see note below

    const basis = cameraSetup.getSurfaceBasisStub(axial, theta);

    marker.position.copy(getMarkerPosition(axial, theta));
    cameraSetup.update(basis);

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    cameraSetup.resize();
    rendererSetup.resize();
});