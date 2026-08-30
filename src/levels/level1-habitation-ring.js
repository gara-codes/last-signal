import * as THREE from 'three';
import { createEmergencyLightingMaterial } from '../shaders/emergency-lighting.js';

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
  const angle = Math.PI + 0.25; // Same bottom alignment as pod bays
  const wallRadius = RADIUS - 0.125; // Flush with the wall (accounting for half-thickness of 0.125)

  const x = -RADIUS + height / 2;
  const z = Math.sin(angle) * RADIUS;

  // The pods occupy space from y = -3 to +3.
  // We place the AI at y = 5.5 to sit "right after" them along the corridor.
  const y = 9;

  halGroup.position.set(x, y, z);

  // Rotate panel so it faces directly toward the center pillar
  halGroup.rotation.y = 0;

  return { group: halGroup, emergencyUniforms };
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

  level1Group.add(ring);
  level1Group.add(pillar);
  level1Group.add(podBays);
  level1Group.add(hal);

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
    emergencyUniforms.time.value += delta;
  }

  return { group: level1Group, dispose, update };
}
