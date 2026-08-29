import * as THREE from 'three';
import { SceneManager } from './core/SceneManager.js';
import { RendererSetup } from './core/RendererSetup.js';
import { Camera } from './core/Camera.js';
import { createLevel1 } from './levels/level1-habitation-ring.js';
import { loadAstronaut } from './core/AssetLoader.js';
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// ^ removed per Yannis's go-ahead — was conflicting with the surface-basis follow cam

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

// TEMP: visual marker tracking the same surface-basis orbit as the camera,
// so orbit motion is visible even without the astronaut/player driving it yet.
// Uses its own clearance (separate from WALK_RADIUS) so it doesn't get buried
// inside the wall mesh. Remove once Alex's real getSurfaceBasis() is wired up
// and the astronaut itself is visibly walking the curve.
const markerGeometry = new THREE.SphereGeometry(1, 16, 16);
const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const marker = new THREE.Mesh(markerGeometry, markerMaterial);
scene.add(marker);
console.log('marker in scene:', scene.children.includes(marker));
console.log('total scene children:', scene.children.length);


function getMarkerPosition(axial, theta) {
    const markerRadius = (31 - 1.2) - 2;
    return new THREE.Vector3(
        axial,
        markerRadius * Math.cos(theta),
        markerRadius * Math.sin(theta),
    );
}

// Starting values — matches player spawn point (bottom of drum)
// TEMP: driving theta/axial locally until Alex exposes player.userData.getSurfaceBasis()
let axial = 0;
let theta = -Math.PI;

const clock = new THREE.Clock();

// Render loop
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (level1.update) {
        level1.update(delta, player);
    }

    theta += 0.005; // TEMP — sweeps theta to test camera across full rim

    const basis = cameraSetup.getSurfaceBasisStub(axial, theta);

    marker.position.copy(getMarkerPosition(axial, theta));
    console.log('marker pos:', marker.position.toArray());
    cameraSetup.update(basis);

    renderer.render(scene, camera);
}

animate();

// Handle browser resizing
window.addEventListener('resize', () => {
    cameraSetup.resize();
    rendererSetup.resize();
});