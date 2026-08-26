import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

export function loadAstronaut() {
  const player = new THREE.Group();
  loader.load(
    './assets/models/astronaut.glb',
    (gltf) => {
      const model = gltf.scene;

      //INital scaling and rotation
      model.scale.set(4, 4, 4);
      model.rotation.y = Math.PI; //Face forward

      player.add(model);

      player.position.set(0, -30.9, 0);

      console.log('Astronaut model loaded!');
    },
    undefined,
    (error) => {
      console.error('Failed to load the astronaut: ', error);
    }
  );
  return player;
}
