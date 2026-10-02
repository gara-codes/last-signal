import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

/**
 * Generic GLB loader — the upgrade hook for every primitive-built prop.
 * Returns a Group immediately and fills it with the model once the load
 * finishes (same async pattern as the hardcoded loaders below), so callers
 * can position it before the asset arrives.
 * @param {string} path - path to the .glb, e.g. './assets/models/pylon.glb'
 * @param {number} [scale] - uniform scale applied to the loaded model
 * @param {(error: Error) => void} [onError] - called if the load fails;
 *   the holder Group is returned empty so the caller can react.
 * @returns {THREE.Group}
 */
export function loadGlb(path, scale = 1, onError) {
  const holder = new THREE.Group();
  loader.load(
    path,
    (gltf) => {
      gltf.scene.scale.setScalar(scale);
      holder.add(gltf.scene);
      console.log(`${path} loaded!`);
    },
    undefined,
    (error) => {
      console.error(`Failed to load ${path}: `, error);
      if (onError) onError(error);
    }
  );
  return holder;
}

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
