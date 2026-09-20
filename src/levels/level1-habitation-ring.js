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
    metalness: 0.3,
    roughness: 0.7,
  });
  return new THREE.Mesh(ringGeometry, ringMaterial);
}

/**
 * Creates a bright white inner lining for the ring wall.
 * This is what gives the clean white sci-fi look from the reference images.
 * Sits just inside the textured hull.
 * @returns {THREE.Mesh}
 */
function createInnerWallLining() {
  const liningRadius = RADIUS - 0.2;
  const liningGeo = new THREE.CylinderGeometry(liningRadius, liningRadius, HEIGHT - 0.5, SEGMENTS, 1, true);
  const liningMat = new THREE.MeshStandardMaterial({
    color: 0xc8ccd0,
    side: THREE.DoubleSide,
    metalness: 0.15,
    roughness: 0.6,
  });
  const lining = new THREE.Mesh(liningGeo, liningMat);
  lining.name = 'inner-wall-lining';
  return lining;
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
  cells.name = 'fuel-cells';

  const cell1 = loadFuelCell();
  cell1.name = 'fuel-cell-1';
  cell1.position.set(30, -8, 3);

  cells.add(cell1);

  const cell2 = loadFuelCell();
  cell2.name = 'fuel-cell-2';
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
 * Creates a wall-mounted control panel with an emissive screen and indicator lights.
 * Matches the reference images: dark frame, glowing blue/amber screen, small buttons.
 * @param {Object} [options]
 * @param {number} [options.width] - panel width (default 3)
 * @param {number} [options.height] - panel height (default 2)
 * @param {number} [options.screenColor] - emissive screen colour hex
 * @returns {THREE.Group}
 */
function createControlPanel({
  width = 4,
  height = 3,
  screenColor = 0x4488cc,
} = {}) {
  const group = new THREE.Group();

  // Dark frame — thicker, more prominent
  const frameGeo = new THREE.BoxGeometry(width, height, 0.25);
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a3e,
    metalness: 0.7,
    roughness: 0.3,
  });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  group.add(frame);

  // Glowing screen — much brighter emissive for bloom
  const screenGeo = new THREE.PlaneGeometry(width * 0.85, height * 0.7);
  const screenMat = new THREE.MeshStandardMaterial({
    color: screenColor,
    emissive: screenColor,
    emissiveIntensity: 2.0,
    metalness: 0.0,
    roughness: 0.1,
  });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.z = 0.13;
  screen.position.y = height * 0.05;
  group.add(screen);

  // Two rows of indicator lights — more visible
  const lightCount = 6;
  const lightSpacing = width * 0.7 / (lightCount - 1);
  const lightStartX = -(width * 0.7) / 2;
  const colors = [0xff3333, 0x33ff66, 0xffaa33, 0x3366ff, 0xff6633, 0x33ffcc];
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < lightCount; i++) {
      const lightGeo = new THREE.BoxGeometry(0.15, 0.1, 0.06);
      const lightMat = new THREE.MeshStandardMaterial({
        color: colors[(i + row * 3) % colors.length],
        emissive: colors[(i + row * 3) % colors.length],
        emissiveIntensity: 1.5,
      });
      const light = new THREE.Mesh(lightGeo, lightMat);
      light.position.set(
        lightStartX + i * lightSpacing,
        -height * 0.3 + row * 0.25,
        0.13
      );
      group.add(light);
    }
  }

  return group;
}

/**
 * Places control panels around the ring wall at specified angles and heights.
 * Panels face inward (toward the drum's central axis).
 * @returns {THREE.Group}
 */
function createWallPanels() {
  const group = new THREE.Group();
  group.name = 'wall-panels';

  const panelRadius = RADIUS - 0.3; // Mounted just inside the hull

  // Panel placements: [angle (rad), axial position (x), width, height, screen colour]
  const placements = [
    [0.3, -6, 4.5, 3.0, 0x4488cc],
    [0.8, -3, 3.5, 2.5, 0x44aacc],
    [1.3, 0, 5.0, 3.5, 0x3366aa],
    [1.8, 3, 4.0, 2.8, 0x4488cc],
    [2.3, 6, 4.5, 3.0, 0x5599dd],
    [2.8, -5, 3.5, 2.5, 0xcc8844],
    [3.3, 2, 4.0, 2.8, 0x4488cc],
    [3.8, 7, 3.5, 2.5, 0x44aacc],
    [4.3, -7, 4.5, 3.0, 0x3366aa],
    [4.8, 5, 4.0, 2.8, 0x4488cc],
    [5.3, -1, 4.0, 2.8, 0x5599dd],
    [5.8, 8, 3.5, 2.5, 0xcc8844],
  ];

  for (const [angle, axialPos, w, h, color] of placements) {
    const panel = createControlPanel({ width: w, height: h, screenColor: color });

    const x = axialPos;
    const y = Math.cos(angle) * panelRadius;
    const z = Math.sin(angle) * panelRadius;

    panel.position.set(x, y, z);
    // Face inward: rotate to point toward the drum's central axis
    panel.rotation.y = Math.atan2(z, -y) + Math.PI;
    // Tilt to sit flush on the curved wall
    panel.rotation.x = Math.PI / 2 - angle;

    group.add(panel);
  }

  return group;
}

/**
 * Creates a hexagonal tile texture for the floor using a canvas.
 * Matches the reference images' hexagonal floor panel pattern.
 * @returns {THREE.CanvasTexture}
 */
function createFloorTileTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Base colour — light grey-white like the reference
  ctx.fillStyle = '#d8dce0';
  ctx.fillRect(0, 0, size, size);

  // Hexagonal grid lines
  ctx.strokeStyle = '#b0b4b8';
  ctx.lineWidth = 1.5;

  const hexSize = 32;
  const hexH = hexSize * Math.sqrt(3);

  for (let row = -1; row < size / hexH + 1; row++) {
    for (let col = -1; col < size / (hexSize * 1.5) + 1; col++) {
      const cx = col * hexSize * 1.5;
      const cy = row * hexH + (col % 2 ? hexH / 2 : 0);

      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = cx + hexSize * 0.95 * Math.cos(a);
        const py = cy + hexSize * 0.95 * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  // Small dots at hex centres (like the reference image floor)
  ctx.fillStyle = '#909498';
  for (let row = -1; row < size / hexH + 1; row++) {
    for (let col = -1; col < size / (hexSize * 1.5) + 1; col++) {
      const cx = col * hexSize * 1.5;
      const cy = row * hexH + (col % 2 ? hexH / 2 : 0);
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  return texture;
}

/**
 * Creates the floor walking surface with hexagonal tile pattern.
 * A thin cylinder slightly inside the hull, covering the bottom arc.
 * @returns {THREE.Mesh}
 */
function createFloor() {
  // Thin cylinder shell just inside the hull, covering the bottom ~180 degrees
  const floorRadius = RADIUS - 1.0;
  const floorGeo = new THREE.CylinderGeometry(
    floorRadius, floorRadius, HEIGHT - 2, SEGMENTS, 1, true,
    0, Math.PI // Bottom half of the cylinder
  );
  const floorMat = new THREE.MeshStandardMaterial({
    map: createFloorTileTexture(),
    side: THREE.DoubleSide,
    metalness: 0.1,
    roughness: 0.6,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.name = 'floor';
  return floor;
}

/**
 * Creates ceiling structural ribs and light strips.
 * Matches the reference images' ceiling with recessed lighting.
 * @returns {THREE.Group}
 */
function createCeiling() {
  const group = new THREE.Group();
  group.name = 'ceiling';

  const ceilingRadius = RADIUS - 0.5;
  const ribCount = 8;

  for (let i = 0; i < ribCount; i++) {
    const axialPos = -9 + (i / (ribCount - 1)) * 18;

    // Structural rib — bigger, more visible
    const ribGeo = new THREE.BoxGeometry(0.5, 1.2, 5);
    const ribMat = new THREE.MeshStandardMaterial({
      color: 0xd0d4d8,
      metalness: 0.5,
      roughness: 0.3,
    });
    const rib = new THREE.Mesh(ribGeo, ribMat);

    const angle = Math.PI / 2; // Top of the drum
    rib.position.set(
      axialPos,
      Math.cos(angle) * ceilingRadius,
      Math.sin(angle) * ceilingRadius
    );
    rib.rotation.y = Math.atan2(
      Math.sin(angle) * ceilingRadius,
      -Math.cos(angle) * ceilingRadius
    );
    rib.rotation.x = Math.PI / 2 - angle;

    group.add(rib);

    // Bright light strip between ribs — high emissive for bloom
    if (i < ribCount - 1) {
      const stripGeo = new THREE.BoxGeometry(0.2, 0.15, 4.5);
      const stripMat = new THREE.MeshStandardMaterial({
        color: 0xeeffff,
        emissive: 0xaaddff,
        emissiveIntensity: 1.5,
      });
      const strip = new THREE.Mesh(stripGeo, stripMat);
      const midAxial = axialPos + 18 / (ribCount - 1) / 2;
      strip.position.set(
        midAxial,
        Math.cos(angle) * (ceilingRadius - 0.4),
        Math.sin(angle) * (ceilingRadius - 0.4)
      );
      strip.rotation.y = rib.rotation.y;
      strip.rotation.x = rib.rotation.x;
      group.add(strip);
    }
  }

  return group;
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
  const innerLining = createInnerWallLining();
  const pillar = createCenterPillar();
  const podBays = createPodBays();
  const { group: hal, emergencyUniforms } = createAI();
  
  //const transitPoint = createTransitPoint();
  const cells = createFuelCells();
  const wallPanels = createWallPanels();
  const floor = createFloor();
  const ceiling = createCeiling();
  
  level1Group.add(ring);
  level1Group.add(innerLining);
  level1Group.add(pillar);
  level1Group.add(podBays);
  level1Group.add(hal);
  level1Group.add(createBlastDoor());
  //level1Group.add(transitPoint);
  level1Group.add(cells);
  level1Group.add(wallPanels);
  level1Group.add(floor);
  level1Group.add(ceiling);

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