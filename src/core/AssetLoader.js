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

/**
 * Fuel cell pickup GLB (shared with L1's proximity-collection contract).
 * @param {{ scale?: [number, number, number] }} [options] - per-axis model
 *   scale; defaults to L1's 2 x 4 x 2, L2 passes 1.25 x 2.5 x 1.25
 *   (interactive ×0.625 of the revision plan).
 * @returns {THREE.Group}
 */
export function loadFuelCell({ scale = [2, 4, 2] } = {}) {
  const fuelCell = new THREE.Group();
  loader.load(
    './assets/models/l600_primary_fuel_cell.glb',
    (gltf) => {
      const model = gltf.scene;

      model.scale.set(...scale);
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
/**
 * Astronaut GLB — the shared player model.
 * @param {{ scale?: number, useDefaultPosition?: boolean }} [options]
 *   scale — uniform model scale (L1's default 4; L2 passes 2.5 per the
 *   revision plan's astronaut reference, ~4.6 units tall).
 *   useDefaultPosition — bake L1's drum spawn (0, -30.9, 0); L2 passes
 *   false and places the model itself.
 * @returns {THREE.Group}
 */
export function loadAstronaut({ scale = 4, useDefaultPosition = true } = {}) {
  const player = new THREE.Group();
  loader.load(
    './assets/models/astronaut.glb',
    (gltf) => {
      const model = gltf.scene;

      //Initial scaling and rotation
      model.scale.setScalar(scale);
      model.rotation.y = Math.PI; //Face forward

      player.add(model);

      if (useDefaultPosition) player.position.set(0, -30.9, 0);

      console.log('Astronaut model loaded!');
    },
    undefined,
    (error) => {
      console.error('Failed to load the astronaut: ', error);
    }
  );
  return player;
}
