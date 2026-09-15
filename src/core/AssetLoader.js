import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

export function loadFuelCell(){
  const fuelCell = new THREE.Group();
  loader.load(
    './assets/models/l600_primary_fuel_cell.glb',
    (gltf) => {
      const model = gltf.scene;

      model.scale.set(2, 4, 2);
      fuelCell.add(model);

      //fuelCell.position.set(24, -10, 0);
      console.log('Fuel cell model loaded!');
    },
    undefined,
    (error) => {
      console.error('Failed to load the fuel cell: ', error);
    }
  );
  return fuelCell;
}
export function loadAstronaut() {
  const player = new THREE.Group();
  loader.load(
    './assets/models/astronaut.glb',
    (gltf) => {
      const model = gltf.scene;

      //Initial scaling and rotation
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
