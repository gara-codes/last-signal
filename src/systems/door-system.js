import * as THREE from 'three';

const DOOR_WIDTH = 2;
const DOOR_HEIGHT = 3;
const DOOR_THICKNESS = 0.4;
const OPEN_DURATION = 1.2; // seconds

// Reused across every door/panel instance — never create these inside
// a loop or per-instance
const doorGeometry = new THREE.BoxGeometry(DOOR_WIDTH, DOOR_HEIGHT, DOOR_THICKNESS);
const doorMaterialLocked = new THREE.MeshStandardMaterial({ color: 0x8a3a3a });
const doorMaterialUnlocked = new THREE.MeshStandardMaterial({ color: 0x6a8a6a });

const panelGeometry = new THREE.BoxGeometry(0.5, 0.6, 0.15);
const panelMaterialInactive = new THREE.MeshStandardMaterial({ color: 0x444444 });
const panelMaterialActive = new THREE.MeshStandardMaterial({
  color: 0x33cc88,
  emissive: 0x117744,
});

//Loads each door texture once; multiple doors sharing a path reuse it
const doorTextureLoader = new THREE.TextureLoader();
const doorTextureCache = new Map();
function getDoorTexture(path){
  if(!doorTextureCache.has(path)){
    doorTextureCache.set(path, doorTextureLoader.load(path));
  }
  return doorTextureCache.get(path);
}

/**
 * Creates a door. Starts locked. Call door.userData.unlock() to allow
 * opening, then door.userData.interact() (typically from InputManager
 * on keypress) to trigger the open animation.
 *
 * @param {string} id - unique identifier, e.g. 'l1-door-1'
 * @param {() => void} [onOpen] - optional callback fired once, when
 *   the door finishes opening. Level code uses this to trigger the
 *   flicker/malfunction-sound cue on Door 1.
 * @param {Object} [options] - optional visual overrides. If omitted
 *   entirely, the door uses the shared default geometry and materials.
 * @param {number} [options.width] - panel width (default 2)
 * @param {number} [options.height] - panel height (default 3). Also
 *   sets the slide-up distance and resting y-position.
 * @param {number} [options.thickness] - panel depth (default 0.4)
 * @param {number} [options.color] - base colour hex. Ignored if
 *   texturePath is also given (texture takes priority).
 * @param {string} [options.texturePath] - path to a texture map, e.g.
 *   './assets/textures/blast-door.png'
 * @param {number} [options.metalness] - passed to MeshStandardMaterial (default 0)
 * @param {number} [options.roughness] - passed to MeshStandardMaterial (default 1)
 * @param {number} [options.openDuration] - seconds to fully open (default 1.2)
 */
export function createDoor(id, onOpen, options = {}) {
  const {
    width = DOOR_WIDTH,
    height = DOOR_HEIGHT,
    thickness = DOOR_THICKNESS,
    color,
    texturePath,
    metalness = 0,
    roughness = 1,
    openDuration = OPEN_DURATION,
  } = options;

  const group = new THREE.Group();
  group.name = id;

  //Geometry: Shared when default-sized, per-instance when custom
  const isDefaultSize = width === DOOR_WIDTH && height === DOOR_HEIGHT && thickness === DOOR_THICKNESS;
  const geometry = isDefaultSize 
    ? doorGeometry
    : new THREE.BoxGeometry(width, height, thickness);

  // Material: A locked/unlocked pair built from texture or colour
  let lockedMaterial, unlockedMaterial;
  if(texturePath){
    const map = getDoorTexture(texturePath);
    lockedMaterial = new THREE.MeshStandardMaterial({
      map, metalness, roughness, emissive: 0x331111
    });
    unlockedMaterial = new THREE.MeshStandardMaterial({
      map, metalness, roughness, emissive: 0x113322,
    });
  } else if (color !== undefined){
    lockedMaterial = new THREE.MeshStandardMaterial({
      color, metalness, roughness, emissive: 0x3300000,
    });
    unlockedMaterial = new THREE.MeshStandardMaterial({
      color, metalness, roughness, emissive: 0x003300,
    });
  } else{
    lockedMaterial = doorMaterialLocked;
    unlockedMaterial = doorMaterialUnlocked;
  }

  const panel = new THREE.Mesh(geometry, lockedMaterial);
  panel.position.y = height/2;
  group.add(panel);

  group.userData = {
    id,
    interactable: true,
    state: 'locked',  //'locked', 'unlocked', 'opening', 'open'
    openProgress: 0,
    basePanelY: panel.position.y,

    unlock(){
      if(group.userData.state !== 'locked') return;
      group.userData.state = 'unlocked';
      panel.material = unlockedMaterial;
    },

    interact(){
      if(group.userData.state !== 'unlocked') return;
      group.userData.state = 'opening';
    },

    update(delta){
      if(group.userData.state !== 'opening') return;
      group.userData.openProgress = Math.min(
        1,
        group.userData.openProgress + delta / openDuration
      );
      panel.position.y = group.userData.basePanelY + height * group.userData.openProgress;
      if(group.userData.openProgress >= 1){
        group.userData.state = 'open';
        if (onOpen) onOpen();
      }
    },
  };

  return group;
}

export function createPowerPanel(id, linkedDoors) {
  const mesh = new THREE.Mesh(panelGeometry, panelMaterialInactive);
  mesh.name = id;

  mesh.userData = {
    id,
    interactable: true,
    activated: false,

    interact() {
      if (mesh.userData.activated) return;
      mesh.userData.activated = true;
      mesh.material = panelMaterialActive;
      linkedDoors.forEach((door) => door.userData.unlock());
    },

    update() {
      // No animation yet — placeholder so callers can treat every
      // interactable uniformly (see updateInteractables below).
    },
  };

  return mesh;
}

export function updateInteractables(interactables, delta) {
  for (const obj of interactables) {
    obj.userData.update?.(delta);
  }
}
