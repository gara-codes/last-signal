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
// Clip names as exported from the current astronaut.glb rig (confirmed via
// gltf.animations.map(a => a.name) rather than assumed — the export
// contains several duplicate/leftover takes per clip ("Run"/"run"/
// "Run.001", "Walk"/"walk"/"Walk.001-003"); per explicit instruction these
// two specific takes are used instead of the plain-named ones.
const ANIM_CLIP_NAMES = { idle: 'Idle', walk: 'Walk.003', run: 'Run.001' };

// Reverted back to the pre-replacement multiplier per explicit instruction
// (this does not match the new model's real-world export scale against the
// PLAYER_HEIGHT=1.8 capsule in flat-physics-controller.js — that was 0.93 —
// so the model will render oversized relative to the collision capsule).
const ASTRONAUT_SCALE = 4;

export function loadAstronaut() {
  const player = new THREE.Group();
  loader.load(
    './assets/models/astronaut.glb',
    (gltf) => {
      const model = gltf.scene;

      //Initial scaling and rotation
      model.scale.set(ASTRONAUT_SCALE, ASTRONAUT_SCALE, ASTRONAUT_SCALE);
      model.rotation.y = Math.PI; //Face forward

      player.add(model);

      player.position.set(0, -30.9, 0);

      const mixer = new THREE.AnimationMixer(model);
      const actions = {};
      for (const [key, clipName] of Object.entries(ANIM_CLIP_NAMES)) {
        const clip = THREE.AnimationClip.findByName(gltf.animations, clipName);
        if (clip) actions[key] = mixer.clipAction(clip);
        else console.warn(`AssetLoader: animation clip "${clipName}" not found on astronaut.glb`);
      }

      player.userData.mixer = mixer;
      player.userData.actions = actions;
      player.userData.activeActionName = null;
      if (actions.idle) {
        actions.idle.play();
        player.userData.activeActionName = 'idle';
      }

      console.log('Astronaut model loaded!');
    },
    undefined,
    (error) => {
      console.error('Failed to load the astronaut: ', error);
    }
  );
  return player;
}

/**
 * Crossfades player.userData.actions[name] in (and whatever was active out),
 * via AnimationAction.fadeIn()/fadeOut() — a no-op if that state is already
 * active or the clip wasn't found on load.
 * @param {THREE.Object3D} player - the group returned by loadAstronaut()
 * @param {string} name - key into player.userData.actions (e.g. 'idle')
 * @param {number} [duration] - crossfade duration in seconds
 */
export function crossfadeAction(player, name, duration = 0.2) {
  const actions = player.userData.actions;
  if (!actions || player.userData.activeActionName === name) return;

  const next = actions[name];
  if (!next) return;

  const current = actions[player.userData.activeActionName];
  if (current) current.fadeOut(duration);
  next.reset().fadeIn(duration).play();
  player.userData.activeActionName = name;
}
