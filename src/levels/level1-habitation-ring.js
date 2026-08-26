import * as THREE from 'three';
import { segmentWidth, ringSegmentTransform, spokeTransform } from '../core/ringLayout';
import { createDoor, createPowerPanel, updateInteractables } from '../systems/door-system';

const SEGMENTS = 40;
const OUTER_RADIUS = 12;
const INNER_RADIUS = 8;
const SPOKE_WIDTH = 2;
const WALL_HEIGHT = 3;
const WALL_THICKNESS = 0.3;

const START_SEGMENT = 0; // player spawn reference, no geometry here
const POD_BAY_SPOKE_SEGMENT = 6; // inward branch
const ENGINEERING_SPOKE_SEGMENT = 14; // outward branch, roughly opposite spawn

const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
const outerWallGeometry = new THREE.BoxGeometry(
  segmentWidth(SEGMENTS, OUTER_RADIUS),
  WALL_HEIGHT,
  WALL_THICKNESS
);

const innerWallGeometry = new THREE.BoxGeometry(
  segmentWidth(SEGMENTS, INNER_RADIUS),
  WALL_HEIGHT,
  WALL_THICKNESS
);

const floorGeometry = new THREE.RingGeometry(INNER_RADIUS, OUTER_RADIUS, SEGMENTS);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, side: THREE.DoubleSide });
const spokeFloorMaterial = floorMaterial;

function buildRingWalls(radius, geometry, skipSegments, doorSegments) {
  const group = new THREE.Group();

  for (let i = 0; i < SEGMENTS; i++) {
    if (skipSegments.has(i)) continue; //leave a gap here for a branch corridor

    const { x, z, rotationY } = ringSegmentTransform(i, SEGMENTS, radius);


    const panel = new THREE.Mesh(geometry, wallMaterial);
    panel.position.set(x, WALL_HEIGHT / 2, z);
    panel.rotation.y = rotationY;
    group.add(panel);
  }
  return group;
}

/*Build a straight corridor(two side walls + a floor strip), running from start radius to end radius at a fixed angle */
function buildSpoke(startRadius, endRadius, angle) {
  const { x, z, rotationY, length } = spokeTransform(startRadius, endRadius, angle);
  const group = new THREE.Group();

  const offset = SPOKE_WIDTH / 2;
  const perpX = Math.cos(Math.PI / 2) * offset;
  const perpZ = Math.sin(Math.PI / 2) * offset;

  const wallL = new THREE.Mesh(
    new THREE.BoxGeometry(length, WALL_HEIGHT, WALL_THICKNESS),
    wallMaterial
  );
  wallL.position.set(x + perpX, WALL_HEIGHT / 2, z + perpZ);
  wallL.rotation.y = rotationY;

  const wallR = new THREE.Mesh(
    new THREE.BoxGeometry(length, WALL_HEIGHT, WALL_THICKNESS),
    wallMaterial
  );
  wallR.position.set(x + perpX, WALL_HEIGHT / 2, z + perpZ);
  wallR.rotation.y = rotationY;

  group.add(wallL, wallR);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(SPOKE_WIDTH, length), floorMaterial);
  floor.rotation.x = -Math.PI / 2; // planes are vertical (XY) by default; lay it flat
  floor.rotation.z = -angle; // align the floor strip with the spoke's direction
  floor.position.set(x, 0, z);
  group.add(floor);

  return group;
}

function buildCentralHub(x, z) {
  const group = new THREE.Group();

  const room = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3, WALL_HEIGHT, 16, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x99aabb, side: THREE.DoubleSide })
  );
  room.position.set(x, WALL_HEIGHT / 2, z);
  group.add(room);

  const aiMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x3388ff })
  );
  aiMarker.position.set(x, WALL_HEIGHT / 2, z);
  group.add(aiMarker);

  return group;
}

function buildPodBay(x, z) {
  const group = new THREE.Group();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(5, WALL_HEIGHT, 4),
    new THREE.MeshStandardMaterial({ color: 0x778877 })
  );
  room.position.set(x, WALL_HEIGHT / 2, z);
  group.add(room);
  return group;
}

export function createLevel1() {
  const level1Group = new THREE.Group();
  level1Group.name = 'level1-habitation-ring';

  const innerSkip = new Set([POD_BAY_SPOKE_SEGMENT]);
  const outerSkip = new Set([ENGINEERING_SPOKE_SEGMENT]);

  const outerWalls = buildRingWalls(OUTER_RADIUS, outerWallGeometry, outerSkip);
  const innerWalls = buildRingWalls(INNER_RADIUS, innerWallGeometry, outerSkip);

  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;

  level1Group.add(outerWalls, innerWalls, floor);

  const interactables = [];

  //Pod Bay branch: ring -> Pod Bay -> Hub
  const podBayAngle = ringSegmentTransform(POD_BAY_SPOKE_SEGMENT, SEGMENTS, INNER_RADIUS).angle;
  const podBayInnerEdge = INNER_RADIUS - 4; // how far inward Pod Bay's room sits

  level1Group.add(buildSpoke(INNER_RADIUS, podBayInnerEdge, podBayAngle));

  const podBayX = Math.cos(podBayAngle) * podBayInnerEdge;
  const podBayZ = Math.sin(podBayAngle) * podBayInnerEdge;
  level1Group.add(buildPodBay(podBayX, podBayZ));

  // Hub sits further along the SAME angle, deeper toward the centre —
  // this is what makes it "behind" Pod Bay rather than its own
  // separate branch off the ring.
  const hubRadius = podBayInnerEdge - 4;
  level1Group.add(buildSpoke(podBayInnerEdge - 2.5, hubRadius, podBayAngle));

  const hubX = Math.cos(podBayAngle) * hubRadius;
  const hubZ = Math.sin(podBayAngle) * hubRadius;
  level1Group.add(buildCentralHub(hubX, hubZ));

  //Engineering Core branch: ring -> Door 1 -> threshold
  const engAngle = ringSegmentTransform(ENGINEERING_SPOKE_SEGMENT, SEGMENTS, OUTER_RADIUS).angle;
  const engOuterEdge = OUTER_RADIUS + 3;

  level1Group.add(buildSpoke(OUTER_RADIUS, engOuterEdge, engAngle));

  const doorX = Math.cos(engAngle) * OUTER_RADIUS;
  const doorZ = Math.sin(engAngle) * OUTER_RADIUS;
  const doorRotationY = ringSegmentTransform(
    ENGINEERING_SPOKE_SEGMENT,
    SEGMENTS,
    OUTER_RADIUS
  ).rotationY;

  const door1 = createDoor('l1-door-1', () => {
    level1Group.dispatchEvent?.({type: 'door-1-opened'});
  });
  door1.position.set(doorX, 0, doorZ);
  door1.rotation.y = doorRotationY;
  level1Group.add(door1);
  interactables.push(door1);

  // Threshold marker — a simple placeholder box at the outer end of
  // the spoke, standing in for "this is where Level 2 begins." Actual
  // Engineering Core geometry lives in level2-engineering-core.js;
  // this is just enough for L1 to have a visible, walkable endpoint.
  const thresholdX = Math.cos(engAngle) * engOuterEdge;
  const thresholdZ = Math.sin(engAngle) * engOuterEdge;
  const threshold = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, WALL_HEIGHT, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x334455 })
  );
  threshold.position.set(thresholdX, WALL_HEIGHT / 2, thresholdZ);
  threshold.rotation.y = doorRotationY;
  level1Group.add(threshold);

  const panel1 = createPowerPanel('l1-panel-1', [door1]);
  panel1.position.set(podBayX, 1.4, podBayZ+1);
  level1Group.add(panel1);
  interactables.push(panel1);

  function update(delta){
    updateInteractables(interactables, delta);
  }

  function dispose(){
    level1Group.traverse((obj) => {
      const ownsGeometry = obj.geometry
        && obj.geometry !== floorGeometry
        && obj.geometry !== outerWallGeometry
        && obj.geometry !== innerWallGeometry;
        if(ownsGeometry) obj.geometry.dispose();

        const ownsMaterial = obj.material
          && obj.material !== floorMaterial
          && obj.material !== wallMaterial
        if(ownsMaterial) obj.material.dispose();
    });
    // Shared geometries/materials are module-level and intentionally
    // NOT disposed here, since Level 1 might be rebuilt later in the
    // same session. Dispose those only on full app teardown.

  }
  return { group: level1Group, interactables, update, dispose};
}
