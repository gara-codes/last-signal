import * as THREE from 'three';
import { SceneManager } from './core/SceneManager.js';
import { RendererSetup } from './core/RendererSetup.js';
import { createLevel1 } from './levels/level1-habitation-ring.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadAstronaut } from './core/AssetLoader.js';
import { PlayerController } from './systems/physics-controller.js'; 
import { InputManager } from './core/InputManager.js';
  
const sceneManager = new SceneManager();
const scene = sceneManager.getScene();

const rendererSetup = new RendererSetup();
const renderer = rendererSetup.getRenderer();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const orbitRadius = 10;
const cameraHeight = 0;

camera.position.set(orbitRadius, cameraHeight, 0);
camera.lookAt(0,0,0);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);


//Level 1
const level1 = createLevel1();
level1.group.rotation.z = Math.PI /2;
scene.add(level1.group);

//Player Model
const player = loadAstronaut();
scene.add(player);

const playerController = new PlayerController(player);   
const inputManager = new InputManager();                 

const clock = new THREE.Clock();


const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

controls.target.copy(player.position);
// Render loop
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    playerController.update(delta, inputManager.getInput());   


    if(level1.update){
      level1.update(delta, player);
    }
    controls.update();
    

    renderer.render(scene, camera);
}

animate();

animate();

// Handle browser resizing
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  rendererSetup.resize();
});
