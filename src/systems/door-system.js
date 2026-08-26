import * as THREE from 'three';

const DOOR_WIDTH = 2;
const DOOR_HEIGHT = 3;
const DOOR_THICKNESS = 0.4;
const OPEN_HEIGHT_OFFSET = DOOR_HEIGHT; // door slides up by its own height when opened
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

/**
 * Creates a door. Starts locked. Call door.userData.unlock() to allow
 * opening, then door.userData.interact() (typically from InputManager
 * on keypress) to trigger the open animation.
 *
 * @param {string} id - unique identifier, e.g. 'l1-door-1'
 * @param {() => void} [onOpen] - optional callback fired once, when
 *   the door finishes opening. Level code uses this to trigger the
 *   flicker/malfunction-sound cue on Door 1.
 */
export function createDoor(id, onOpen) {
  const group = new THREE.Group();
  group.name = id;

  const panel = new THREE.Mesh(doorGeometry, doorMaterialLocked);
  panel.position.y = DOOR_HEIGHT / 2;
  group.add(panel);

  group.userData = {
    id,
    interactable: true,
    state: 'locked', // 'locked', 'unlocked', 'opening', 'open'
    openProgress: 0,
    basePanelY: panel.position.y,

    unlock() {
      if (group.userData.state !== 'locked') return;
      group.userData.state = 'unlocked';
      panel.material = doorMaterialUnlocked;
    },

    interact() {
      if (group.userData.state !== 'unlocked') return;
      group.userData.state = 'opening';
    },

    update(delta) {
      if (group.userData.state !== 'opening') return;
      group.userData.openProgress = Math.min(
        1,
        group.userData.openProgress + delta / OPEN_DURATION
      );
      panel.position.y =
        group.userData.basePanelY + OPEN_HEIGHT_OFFSET * group.userData.openProgress;
      if (group.userData.openProgress >= 1) {
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

export function updateInteractables(interactables, delta){
    for(const obj of interactables){
        obj.userData.update?.(delta);
    }
}
