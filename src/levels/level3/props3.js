// src/levels/level3/props3.js
//
// Pickups, gate hardware, AEGIS presence and the space-dressing props.
// Everything here is visual-only in the blockout pass: pickups spin and
// glow but are collected by the systems pass later; reader doors open on
// setOpen(); the purge event gate opens on begin(); eyes track the viewer
// and darken on setDark(). Each factory returns { group, update?, ...api }
// and the assembler collects the updatables.

import * as THREE from 'three';
import { createEmergencyLightingMaterial } from '../../shaders/emergency-lighting.js';

/** Fuel cell: the L1 spin-and-glow pickup read, repurposed as O2 top-up. */
export function createFuelCell(materials) {
  const group = new THREE.Group();
  const cell = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.5), materials.light);
  cell.name = 'fuel-cell';
  cell.position.y = 1;
  group.add(cell);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 6, 16), materials.warning);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1;
  group.add(ring);
  return {
    group,
    update(delta) {
      cell.rotation.y += delta * 2;
      ring.rotation.z += delta;
    },
  };
}

export function createCanister(materials) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.1, 10), materials.trim);
  body.position.y = 1.1;
  group.add(body);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 8), materials.light);
  cap.position.y = 1.8;
  group.add(cap);
  return { group };
}

export function createLogTerminal(materials) {
  const group = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.3), materials.frame);
  box.position.y = 1.5;
  group.add(box);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.06), materials.screen);
  screen.position.set(0, 1.7, 0.18);
  group.add(screen);
  return { group };
}

export function createKeycard(materials) {
  const group = new THREE.Group();
  const card = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.5), materials.light);
  card.name = 'keycard';
  card.position.y = 1.1;
  card.rotation.z = 0.2;
  group.add(card);
  return {
    group,
    update(delta) {
      card.rotation.y += delta * 1.5;
    },
  };
}

/** Keycard reader door: slab + reader light; setOpen(true) slides it up. */
export function createReaderDoor(materials, width = 6, height = 5) {
  const group = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.5), materials.frame);
  slab.name = 'reader-door-slab';
  slab.position.y = height / 2;
  group.add(slab);
  const reader = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.4, 0.12), materials.warning);
  reader.position.set(width / 2 + 0.4, 1.6, 0.3);
  group.add(reader);
  let open = false;
  return {
    group,
    setOpen(value) {
      open = value;
    },
    update(delta) {
      const target = open ? height + 1 : height / 2;
      slab.position.y = THREE.MathUtils.damp(slab.position.y, target, 4, delta);
    },
  };
}

/** Hold-E console (override transfer / pod clamps): box + screen + ring. */
export function createConsole(materials, { stages = 1 } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.7), materials.warning);
  body.position.y = 0.6;
  group.add(body);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.08), materials.screen);
  screen.position.set(0, 1.3, -0.36);
  group.add(screen);
  const pips = [];
  for (let i = 0; i < stages; i += 1) {
    const pip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.1), materials.light);
    pip.position.set(-0.3 + i * 0.3, 1.62, -0.36);
    pip.visible = false;
    group.add(pip);
    pips.push(pip);
  }
  return { group, pips };
}

/** Airlock breathing door: two slabs cycling open/shut on `cycle` seconds. */
export function createAirlockDoor(materials, cycle, width = 6, height = 5) {
  const group = new THREE.Group();
  const slabs = [];
  for (const side of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(width / 2, height, 0.4), materials.frame);
    slab.position.x = (side * width) / 4;
    slab.position.y = height / 2;
    group.add(slab);
    slabs.push({ mesh: slab, side });
  }
  return {
    group,
    update() {
      const t = (window.performance.now() / 1000) % cycle;
      const shut = t < cycle - 2; // 2 s open window per cycle
      for (const { mesh, side } of slabs) {
        mesh.position.x = shut ? (side * width) / 4 : (side * width) / 2 + side * 0.4;
      }
    },
  };
}

/**
 * AEGIS watching-eye: L1's emergency-lighting shader on a lens sphere.
 * Tracks the viewer with lookAt each frame; setDark() kills the eye when a
 * seal-behind collapse closes its zone (AEGIS losing sight of the player).
 */
export function createAegisEye(materials, size = 0.5) {
  const { material, uniforms } = createEmergencyLightingMaterial();
  const lens = new THREE.Mesh(new THREE.SphereGeometry(size, 16, 12), material);
  lens.name = 'aegis-eye';
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(size * 1.2, size * 1.2, size * 0.8, 12), materials.frame);
  housing.rotation.x = Math.PI / 2;
  housing.position.z = -size * 0.6;
  const group = new THREE.Group();
  group.add(housing, lens);
  let dark = false;
  return {
    group,
    setDark(value) {
      dark = value;
      lens.visible = !value;
    },
    update(delta, viewer) {
      uniforms.time.value += delta;
      if (!dark && viewer?.position) lens.lookAt(viewer.position);
    },
  };
}

/** Starfield: one Points sphere so breaches show space, not void. */
export function createStarfield(count = 2500, radius = 900) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.6, sizeAttenuation: false });
  const points = new THREE.Points(geometry, material);
  points.name = 'starfield';
  return {
    group: points,
    update(delta) {
      points.rotation.y += delta * 0.004;
    },
  };
}

/** Shared soft-dot sprite so debris reads as dust, not square "stars". */
let debrisSprite = null;
function softDotTexture() {
  if (debrisSprite) return debrisSprite;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  debrisSprite = new THREE.CanvasTexture(canvas);
  return debrisSprite;
}

/**
 * Drifting debris particles inside a wound: vacuum read, cheap Points. Kept
 * dimmer than the starfield and rendered as soft dots (with attenuation, raw
 * square points grew into bright rectangles near the camera and read as
 * "stars inside the ship"). Headless test runs get the material without a
 * map — square points are fine where nobody renders them.
 */
export function createDebrisField(center, span, count = 220) {
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = center[0] + (Math.random() - 0.5) * span[0];
    positions[i * 3 + 1] = center[1] + (Math.random() - 0.5) * span[1];
    positions[i * 3 + 2] = center[2] + (Math.random() - 0.5) * span[2];
    speeds[i] = 0.2 + Math.random() * 0.6;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0x707a88, size: 0.12, transparent: true, depthWrite: false, alphaTest: 0.01 });
  if (typeof document !== 'undefined') {
    material.map = softDotTexture();
    material.needsUpdate = true;
  }
  const points = new THREE.Points(geometry, material);
  points.name = 'debris-field';
  points.frustumCulled = false;
  return {
    group: points,
    update(delta) {
      const attribute = geometry.getAttribute('position');
      for (let i = 0; i < count; i += 1) {
        attribute.array[i * 3 + 1] += speeds[i] * delta; // drift "up" = out
        if (attribute.array[i * 3 + 1] > center[1] + span[1] / 2) {
          attribute.array[i * 3 + 1] = center[1] - span[1] / 2;
        }
      }
      attribute.needsUpdate = true;
    },
  };
}

/** Empty pod cradles + one drifting pod silhouette: "the crew left". */
export function createCradles(materials, basePosition) {
  const group = new THREE.Group();
  group.position.set(...basePosition);
  for (let i = 0; i < 3; i += 1) {
    const cradle = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.6, 7), materials.frame);
    cradle.position.set(-6 + i * 6, 2.4, 0);
    cradle.rotation.z = 0.2;
    group.add(cradle);
  }
  const drifter = new THREE.Mesh(new THREE.CapsuleGeometry(1.2, 4, 6, 12), materials.pod);
  drifter.name = 'drifting-pod';
  drifter.position.set(14, 9, -30);
  drifter.rotation.x = Math.PI / 2.4;
  group.add(drifter);
  return {
    group,
    update(delta) {
      drifter.position.z -= delta * 0.6;
      drifter.rotation.z += delta * 0.05;
    },
  };
}

/** Planetrise: the one image of a world, reserved for the ending view. */
export function createPlanet() {
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(120, 24, 18),
    new THREE.MeshStandardMaterial({ color: 0x2b4a6f, emissive: 0x0a1830, emissiveIntensity: 0.6, roughness: 1 })
  );
  planet.name = 'planet';
  planet.position.set(300, -80, -1400);
  return { group: planet };
}

export function createCheckpoint(materials) {
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 0.4), materials.trim);
    post.position.set(side * 2.4, 2, 0);
    group.add(post);
  }
  const header = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.5, 0.5), materials.light);
  header.position.y = 4;
  group.add(header);
  return { group };
}

/** Escape pod + hatch + launch console: the finale stage. */
export function createPod(materials) {
  const group = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(1.35, 5.2, 6, 12), materials.pod);
  hull.rotation.x = Math.PI / 2;
  hull.name = 'pod-hull';
  hull.position.y = 1.8;
  hull.castShadow = true;
  group.add(hull);
  const window = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), materials.podWindow);
  window.scale.set(1, 0.24, 1);
  window.position.set(0, 1.95, -1);
  window.name = 'pod-window';
  group.add(window);
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2, 0.2), materials.trim);
  hatch.name = 'pod-hatch';
  hatch.position.set(1.2, 1.4, 1.4);
  group.add(hatch);
  let boarded = false;
  return {
    group,
    openHatch() {
      boarded = true;
    },
    update(delta) {
      if (boarded) hatch.rotation.y = THREE.MathUtils.damp(hatch.rotation.y, -1.8, 3, delta);
    },
  };
}

/** Core-chamber countdown screen: where the digits first become visible. */
export function createCountdownScreen(materials) {
  const screen = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 0.3), materials.screen);
  screen.name = 'detonation-screen';
  return { group: screen };
}
