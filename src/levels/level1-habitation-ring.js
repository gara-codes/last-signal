import * as THREE from 'three';
import { createEmergencyLightingMaterial } from '../shaders/emergency-lighting.js';
import { createDoor } from '../systems/door-system.js';
import { loadFuelCell } from '../core/AssetLoader.js';

const SEGMENTS = 30;
const RADIUS = 31;
const HEIGHT = 20;

// Initialize texture loader (shared across module)
const textureLoader = new THREE.TextureLoader();
const ringTexture = textureLoader.load('./assets/textures/spaceship-hull.png');
const pillarTexture = textureLoader.load('./assets/textures/spaceship-pillar.png');

/**
 * Creates the outer textured ring wall of the level.
 * @returns {THREE.Mesh}
 */
function createOuterRing() {
  const ringGeometry = new THREE.CylinderGeometry(RADIUS, RADIUS, HEIGHT, SEGMENTS);
  const ringMaterial = new THREE.MeshStandardMaterial({
    map: ringTexture,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(ringGeometry, ringMaterial);
}

/**
 * Creates the central decorative or structural pillar.
 * @returns {THREE.Mesh}
 */
function createCenterPillar() {
  const pillarGeometry = new THREE.CylinderGeometry(RADIUS / 5, RADIUS / 5, HEIGHT - 1, 50);
  const pillarMaterial = new THREE.MeshStandardMaterial({ map: pillarTexture });
  return new THREE.Mesh(pillarGeometry, pillarMaterial);
}

/**
 * Creates a cluster of 3 capsule-based pod bays side-by-side at the bottom of the curved hull.
 * @returns {THREE.Group}
 */
function createPodBays() {
  const group = new THREE.Group();
  group.name = 'pod-bays';

  const capRadius = 1.5;
  const capLength = 3.0;
  const capsuleGeometry = new THREE.CapsuleGeometry(capRadius, capLength, 8, 16);
  const capsuleMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a6a8a,
    metalness: 0.2,
    roughness: 0.4,
  });

  const spawnRadius = RADIUS - capRadius; // Sit just inside the outer curved hull
  const numPods = 3;

  // Since level1.group.rotation.z = Math.PI / 2, local -X (angle = Math.PI)
  // rotates to become the world -Y axis (the bottom curved hull of the spaceship).
  const centerAngle = Math.PI;
  const angleSpacing = 0.15; // Tight angular separation to place them closely side-by-side

  for (let i = 0; i < numPods; i++) {
    // Offset angles: -0.15, 0, and +0.15 relative to the bottom center
    const angle = centerAngle + (i - 1) * angleSpacing;
    const pod = new THREE.Mesh(capsuleGeometry, capsuleMaterial);

    const x = Math.cos(angle) * spawnRadius;
    const z = Math.sin(angle) * spawnRadius;
    const y = -7; // Centered to the side of the main axis

    pod.position.set(x, y, z);
    group.add(pod);
  }
  
  return group;
}

/**
 * Creates the HAL 9000 AI terminal mounted on the wall just past the pod bays.
 * @returns {THREE.Group}
 */
function createAI() {
  const halGroup = new THREE.Group();
  halGroup.name = 'hal-9000';

  const height = 14.0;
  const width = 5;
  const thickness = 1;

  // 1. Black panel body (the main box)
  const bodyGeometry = new THREE.BoxGeometry(height, thickness, width);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x0c0c0c,
    roughness: 0.15,
    metalness: 0.8,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  halGroup.add(body);

  // 2. Metallic bezel for the lens eye
  const bezelGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 24);
  const bezelMaterial = new THREE.MeshStandardMaterial({
    color: 0x888888,
    metalness: 0.9,
    roughness: 0.1,
  });
  const bezel = new THREE.Mesh(bezelGeometry, bezelMaterial);
  bezel.rotation.x = -Math.PI; // Point forward out of the panel
  bezel.position.set(2.5, -thickness / 2 - 0.05, 0); // Place in the upper portion of the panel
  halGroup.add(bezel);

  // 3. Glowing camera eye — custom emergency-lighting shader
  const eyeGeometry = new THREE.SphereGeometry(0.5, 16, 16);
  const { material: eyeMaterial, uniforms: emergencyUniforms } = createEmergencyLightingMaterial();
  const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  eye.position.set(2.5, -thickness / 2 - 0.15, 0); // Seat inside the bezel
  halGroup.add(eye);

  // 4. Positioning on the curved wall
  //const angle = -Math.PI; // Same bottom alignment as pod bays
  const wallRadius = RADIUS-3; // Flush with the wall (accounting for half-thickness of 0.125)

  const x = -wallRadius*Math.cos(7*Math.PI/25);
  const z = Math.sin(-Math.PI / 6) * wallRadius;

  // The pods occupy space from y = -3 to +3.
  // We place the AI at y = 5.5 to sit "right after" them along the corridor.
  const y = 9;

  halGroup.position.set(x, y, z);

  // Rotate panel so it faces directly toward the center pillar
  halGroup.rotation.y = Math.atan2(halGroup.position.z, -halGroup.position.x);

  return { group: halGroup, emergencyUniforms };
}

function createTransitPoint() {
  const room = new THREE.Group();
  room.name = 'transit-point';

  const width = 14;
  const height = 10;
  const depth = 20;

  const sideWallGeometry = new THREE.PlaneGeometry(depth, height);
  const floorCeilingGeometry = new THREE.PlaneGeometry(width, depth);
  const farWallGeometry = new THREE.PlaneGeometry(width, height);
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: ringTexture,
    side: THREE.DoubleSide,
  });

  // Floor
  const floor = new THREE.Mesh(floorCeilingGeometry, wallMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -height / 2;
  room.add(floor);

  // Ceiling (open end — omitted so the player can enter from blastDoorOne above)

  // Left wall
  const leftWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.x = -width / 2;
  room.add(leftWall);

  // Right wall
  const rightWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.x = width / 2;
  room.add(rightWall);

  // Far wall (exit door mounts on this face)
  const farWall = new THREE.Mesh(farWallGeometry, wallMaterial);
  farWall.position.z = -depth / 2;
  room.add(farWall);

  // Exit blast door — placed on the far wall
  const blastDoor = createDoor('l1-blastdoor-2');
  blastDoor.position.z = -depth / 2;
  room.add(blastDoor);

  // Position the room so its open top sits flush under blastDoorOne's bottom face
  room.position.x = 24;
  room.position.y = -10.5 - height / 2;
  room.position.z = 0;

  return room;
}

function createFuelCells(){
  const cells = new THREE.Group();
  const cell1 = loadFuelCell();
  cell1.position.set(30, -8, 3);

  cells.add(cell1);

  const cell2 = loadFuelCell();
  cell2.position.set(-24, 8, -14);
  cells.add(cell2);

  return cells;
}

function createBlastDoor(){
  const blastDoorOne = createDoor('l1-blastdoor-1', undefined, {  //When we later want the open sound cue, replace undefined with () => playDoorOpenSound()
    width: 10,
    height: 10,
    thickness: 1,
    color: 0xFF2600,
    metalness: 0.9,
    roughness: 0.1,
    openDuration: 2.5
  });
  // Mounted on the hull the same way as the AI panel (see createAI, step 4):
  // polar position at wall radius + atan2 facing. One adaptation: the AI's
  // thin axis is Y, but createDoor puts thickness on Z — so the door is
  // tipped forward 90° (X spin) to bring its face around to look down the
  // corridor like HAL's face.
  const wallRadius = RADIUS - 7;    // same mount radius as the AI panel
  const wallAngle = Math.PI * 1.1;  // near-floor hull, a bit before HAL
  const x = -Math.cos(wallAngle) * wallRadius -3;
  const z = Math.sin(wallAngle) * wallRadius+12;
  const doorAngle = Math.atan2(z,x);
  blastDoorOne.rotation.set(Math.PI /2, Math.atan2(z, -x), Math.PI / 2- doorAngle, 'YXZ');
  // The -10 keeps the door at its current axial position along the corridor.
  blastDoorOne.position.set(x, -10, z);
  // Euler order 'YXZ': the X tip applies in the door's own space first, then
  // the Y facing applies in level space — same result as parenting the door
  // to a holder group with the AI's rotation.
  //blastDoorOne.rotation.set(Math.PI / 2, Math.atan2(z, -x), 0, 'YXZ');
  return blastDoorOne;
}
/**
 * Main orchestration function for Level 1.
 * @returns {{ group: THREE.Group, dispose: () => void, update: (delta: number) => void }}
 */
export function createLevel1() {
  const level1Group = new THREE.Group();
  level1Group.name = 'level-1';

  // Instantiate and add the sub-components
  const ring = createOuterRing();
  const pillar = createCenterPillar();
  const podBays = createPodBays();
  const { group: hal, emergencyUniforms } = createAI();
  
  //const transitPoint = createTransitPoint();
  const cells = createFuelCells();
  
  level1Group.add(ring);
  level1Group.add(pillar);
  level1Group.add(podBays);
  level1Group.add(hal);
  level1Group.add(createBlastDoor());
  //level1Group.add(transitPoint);
  level1Group.add(cells);

  /**
   * Cleans up level resources when transitioned or destroyed.
   */
  function dispose() {
    level1Group.traverse((obj) => {
      if (obj.geometry) {
        obj.geometry.dispose();
      }
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((mat) => mat.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }

  /**
   * Advances any time-driven effects in this level (e.g. the emergency-lighting shader).
   */
  function update(delta) {
    emergencyUniforms.uTime.value += delta;
  }

  return { group: level1Group, dispose, update };
}