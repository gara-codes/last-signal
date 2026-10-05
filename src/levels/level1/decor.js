// src/levels/level1/decor.js
//
// L1 visual pass: the clean white Discovery-style interior from the
// reference sheet. Purely visual. Nothing here is interactable, nothing
// registers collision, and every prop stays inside the band the player
// and camera can't reach (|axial| > 9, see physics-controller.js
// AXIAL_CLAMP and the camera's 1.5 margin in main.js).
//
// Coordinates are LEVEL-LOCAL (before main.js's rotation.z = PI/2): the
// drum axis is local Y (axial, -10..10), and a rim angle phi sits at
// (cos(phi) * r, axial, sin(phi) * r). phi = PI is the world floor where
// the player spawns; phi = 0 is the far-side band with the transit chamber.
//
// Every texture is drawn on a canvas at runtime, so there are no new asset
// files and nothing to add to CREDITS.md.

import * as THREE from 'three';

const RADIUS = 31; // mirrors level1-habitation-ring.js
const HALF_HEIGHT = 10;
export const DECK_RADIUS = RADIUS - 1.2; // = physics WALK_RADIUS: feet land on the deck
const PILLAR_RADIUS = RADIUS / 5;

// Deck tiles: picked so a whole number of tiles wraps the circumference,
// which removes the seam where the cylinder's UVs meet.
const TILES_AROUND = 94;
const TILE = (2 * Math.PI * DECK_RADIUS) / TILES_AROUND; // ~1.99 units

// Transit chamber footprint on the far-side band (see createTransitPoint):
// side walls at z = +-5, axial -9.5..-4.5. The deck leaves this gap open
// so the chamber's own floor strips and the exit hatch's shaft show through.
const CHAMBER_HALF_ANGLE = Math.asin(5 / DECK_RADIUS);
const CHAMBER_AXIAL_START = -4.5;

// How far a wall prop may stand out from its end cap. The player is
// clamped to |axial| <= 9, so anything under 1 unit can never be walked into.
export const MAX_PROP_DEPTH = 0.95;

// Rim angles kept clear on each end cap: pods + HAL on the +10 cap,
// door 1 + the transit chamber on the -10 cap.
export const END_WALL_EXCLUSIONS = Object.freeze({
  [1]: [[2.7, 4.35]],
  [-1]: [[-0.5, 0.5]],
});

const BUNK_WIDTH = 5.5;
const PROP_SLOT_ANGLE = 0.3; // ~9 units of rim per slot
// Repeating rhythm along each wall, as in the reference berths: two bunks,
// then a console bank. Widths are rim lengths in units.
const PROP_RHYTHM = [
  { type: 'bunk', width: BUNK_WIDTH },
  { type: 'bunk', width: BUNK_WIDTH },
  { type: 'console', width: 6.0 },
];

/**
 * Lays props into evenly spaced slots around both end caps, skipping any
 * slot whose footprint touches an exclusion range. The -10 cap is offset by
 * half a slot so the two walls don't mirror each other exactly.
 * @returns {{ side: 1 | -1, phi: number, type: 'bunk' | 'console', width: number }[]}
 */
export function layoutEndWallProps() {
  const props = [];
  const slots = Math.floor((Math.PI * 2) / PROP_SLOT_ANGLE);
  for (const side of [1, -1]) {
    let beat = side === 1 ? 0 : 1;
    for (let i = 0; i < slots; i++) {
      const phi = (i + (side === 1 ? 0 : 0.5)) * PROP_SLOT_ANGLE;
      const { type, width } = PROP_RHYTHM[beat % PROP_RHYTHM.length];
      if (isExcluded(side, phi, width / 2 / DECK_RADIUS)) continue;
      props.push({ side, phi, type, width });
      beat++;
    }
  }
  return props;
}

/** True if `phi` falls inside one of `side`'s exclusion ranges (any wrap). */
export function isExcluded(side, phi, halfWidth = 0) {
  const tau = Math.PI * 2;
  for (const [lo, hi] of END_WALL_EXCLUSIONS[side]) {
    for (const k of [-1, 0, 1]) {
      const p = phi + k * tau;
      if (p + halfWidth > lo && p - halfWidth < hi) return true;
    }
  }
  return false;
}

/**
 * Orients `obj` so it stands on the deck against an end cap: its local +X
 * runs along the rim, +Y points up off the deck (toward the drum axis) and
 * +Z faces into the room. Its origin sits where the deck meets the wall.
 * @param {THREE.Object3D} obj
 * @param {number} phi - rim angle
 * @param {1 | -1} side - which end cap
 * @param {number} [radius] - distance from the axis (DECK_RADIUS = floor level)
 */
export function placeOnEndWall(obj, phi, side, radius = DECK_RADIUS) {
  const up = new THREE.Vector3(-Math.cos(phi), 0, -Math.sin(phi));
  const facing = new THREE.Vector3(0, -side, 0);
  // tangent = up x facing keeps the basis right-handed on both caps
  const tangent = new THREE.Vector3().crossVectors(up, facing);
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tangent, up, facing));
  obj.position.set(Math.cos(phi) * radius, side * HALF_HEIGHT, Math.sin(phi) * radius);
}

// --- Canvas textures -------------------------------------------------------

function makeCanvas(w, h) {
  if (typeof document === 'undefined') return null; // node tests: no textures
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function toTexture(canvas, repeat = true) {
  if (!canvas) return null;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Small deterministic PRNG so the screens look the same on every load
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One floor tile: a white plate with a 4 x 4 perforation grid and a centre bolt. */
function drawDeckTile() {
  const s = 128;
  const canvas = makeCanvas(s, s);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e9edf0';
  ctx.fillRect(0, 0, s, s);

  ctx.strokeStyle = '#cfd6dc'; // fine sub-grid
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const p = (i * s) / 4 + 0.5;
    ctx.beginPath();
    ctx.moveTo(p, 4);
    ctx.lineTo(p, s - 4);
    ctx.moveTo(4, p);
    ctx.lineTo(s - 4, p);
    ctx.stroke();
  }

  ctx.strokeStyle = '#a9b3bc'; // plate seam
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, s - 3, s - 3);

  ctx.fillStyle = '#4c5560'; // bolt
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, 4, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(canvas);
}

/** End-cap wall: large white panels with soft seams. */
function drawWallPanel() {
  const s = 128;
  const canvas = makeCanvas(s, s);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#eef1f3';
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = '#c9d0d6';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, s - 2, s - 2);
  return toTexture(canvas);
}

/** A data screen: dark glass with cyan text rows and red/amber status blocks. */
function drawScreen(seed) {
  const w = 256;
  const h = 160;
  const canvas = makeCanvas(w, h);
  if (!canvas) return null;
  const rand = mulberry32(seed);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#071017';
  ctx.fillRect(0, 0, w, h);

  const warm = rand() < 0.4; // some screens are all red/amber blocks
  if (warm) {
    const cols = 6;
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rand() < 0.25) continue;
        ctx.fillStyle = rand() < 0.6 ? '#ff4a2e' : '#ffae3a';
        ctx.globalAlpha = 0.55 + rand() * 0.45;
        ctx.fillRect(14 + c * 39, 16 + r * 34, 28, 18);
      }
    }
  } else {
    for (let y = 14; y < h - 10; y += 13) {
      let x = 12;
      while (x < w - 30) {
        const len = 8 + rand() * 40;
        ctx.fillStyle = rand() < 0.08 ? '#ff6a4a' : '#66e0ff';
        ctx.globalAlpha = 0.5 + rand() * 0.5;
        ctx.fillRect(x, y, Math.min(len, w - 12 - x), 6);
        x += len + 6 + rand() * 10;
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(120, 200, 255, 0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  return toTexture(canvas, false);
}

/** Desk control strip: rows of small lit keys. */
function drawKeypad(seed) {
  const w = 256;
  const h = 64;
  const canvas = makeCanvas(w, h);
  if (!canvas) return null;
  const rand = mulberry32(seed);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1a1f26';
  ctx.fillRect(0, 0, w, h);
  const palette = ['#ff5a3c', '#ffb340', '#ffe9b0', '#5fd0ff', '#3a4250'];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 16; c++) {
      ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
      ctx.fillRect(8 + c * 15, 8 + r * 18, 11, 11);
    }
  }
  return toTexture(canvas, false);
}

// --- Shared materials ------------------------------------------------------

function createMaterials() {
  const screenMaps = [11, 23, 37, 41, 53, 67].map(drawScreen);
  const keypadMaps = [5, 9, 13].map(drawKeypad);
  const glow = (map, color = 0xffffff) =>
    // Unlit and not tone-mapped, so screens keep their colour under ACES
    // and read as light sources whatever the lighting rig is doing.
    new THREE.MeshBasicMaterial({ map, color, toneMapped: false });

  return {
    deck: new THREE.MeshStandardMaterial({
      map: drawDeckTile(),
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0.05,
      side: THREE.BackSide, // seen from inside the cylinder
    }),
    wall: new THREE.MeshStandardMaterial({
      map: drawWallPanel(),
      color: 0xffffff,
      roughness: 0.7,
      metalness: 0.0,
    }),
    shell: new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.35, metalness: 0.05 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x9aa4ad, roughness: 0.4, metalness: 0.6 }),
    recess: new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.6, metalness: 0.2 }),
    mattress: new THREE.MeshStandardMaterial({ color: 0x23345a, roughness: 0.9, metalness: 0.0 }),
    cove: new THREE.MeshBasicMaterial({ color: 0xe8f3ff, toneMapped: false, side: THREE.DoubleSide }),
    skirting: new THREE.MeshBasicMaterial({ color: 0x9fd8ff, toneMapped: false, side: THREE.DoubleSide }),
    screens: screenMaps.map((map) => glow(map)),
    keypads: keypadMaps.map((map) => glow(map)),
    statusAmber: new THREE.MeshBasicMaterial({ color: 0xffb340, toneMapped: false }),
    statusGreen: new THREE.MeshBasicMaterial({ color: 0x6dffa8, toneMapped: false }),
  };
}

// --- Deck ------------------------------------------------------------------

/**
 * Rewrites a cylinder's UVs into world units (one unit = one tile) so
 * separate deck pieces line up tile-for-tile across their shared seam.
 */
function tileCylinderUVs(geometry, radius, axialMin, height, thetaStart, thetaLength) {
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const theta = thetaStart + uv.getX(i) * thetaLength;
    const axial = axialMin + uv.getY(i) * height;
    uv.setXY(i, (theta * radius) / TILE, (axial + HALF_HEIGHT) / TILE);
  }
  uv.needsUpdate = true;
}

function createDeckPiece(material, axialMin, axialMax, thetaStart = 0, thetaLength = Math.PI * 2) {
  const height = axialMax - axialMin;
  const geometry = new THREE.CylinderGeometry(
    DECK_RADIUS, DECK_RADIUS, height, 188, 1, true, thetaStart, thetaLength
  );
  tileCylinderUVs(geometry, DECK_RADIUS, axialMin, height, thetaStart, thetaLength);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = (axialMin + axialMax) / 2;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * The walkable deck: a tiled shell at exactly the player's walking radius,
 * so feet meet the floor (the textured hull at r = 31 sits 1.2 below them).
 * Two pieces leave a gap at the transit chamber.
 */
function createDeck(materials) {
  const group = new THREE.Group();
  group.name = 'l1-deck';
  group.add(createDeckPiece(materials.deck, CHAMBER_AXIAL_START, HALF_HEIGHT));
  // CylinderGeometry measures theta from +Z toward +X, so the far-side band
  // (phi = 0, local +X) sits at theta = PI / 2.
  group.add(createDeckPiece(
    materials.deck,
    -HALF_HEIGHT,
    CHAMBER_AXIAL_START,
    Math.PI / 2 + CHAMBER_HALF_ANGLE,
    Math.PI * 2 - CHAMBER_HALF_ANGLE * 2
  ));
  return group;
}

// --- End-cap walls ---------------------------------------------------------

function createEndWalls(materials) {
  const group = new THREE.Group();
  group.name = 'l1-end-walls';

  // RingGeometry's UVs are planar (0..1 across the outer diameter), so a
  // repeat of 15 gives roughly 4-unit square panels.
  if (materials.wall.map) materials.wall.map.repeat.set(15, 15);
  const wallGeometry = new THREE.RingGeometry(PILLAR_RADIUS, DECK_RADIUS, 96, 1);
  const coveGeometry = new THREE.RingGeometry(20.4, 21.0, 128, 1);
  const lipGeometry = new THREE.CylinderGeometry(21.0, 21.0, 0.5, 128, 1, true);
  const skirtGeometry = new THREE.RingGeometry(DECK_RADIUS - 0.35, DECK_RADIUS - 0.2, 128, 1);
  // Rail just above the props' tops (~3.5 off the deck), tying them into one band
  const railGeometry = new THREE.CylinderGeometry(25.9, 25.9, 0.3, 128, 1, true);

  for (const side of [1, -1]) {
    // Ring faces +Z by default; turn it so its front faces the room.
    const facing = side === 1 ? Math.PI / 2 : -Math.PI / 2;
    const at = (mesh, axialInset) => {
      mesh.rotation.x = facing;
      mesh.position.y = side * (HALF_HEIGHT - axialInset);
      group.add(mesh);
    };

    at(new THREE.Mesh(wallGeometry, materials.wall), 0.02);
    // Light cove: a glowing band under a short lip, high on the wall.
    at(new THREE.Mesh(coveGeometry, materials.cove), 0.04);
    // Skirting light just above the deck: traces the floor's curve.
    at(new THREE.Mesh(skirtGeometry, materials.skirting), 0.04);

    const lip = new THREE.Mesh(lipGeometry, materials.shell);
    lip.position.y = side * (HALF_HEIGHT - 0.25);
    group.add(lip);

    const rail = new THREE.Mesh(railGeometry, materials.trim);
    rail.position.y = side * (HALF_HEIGHT - 0.15);
    group.add(rail);
  }
  return group;
}

// --- Wall props ------------------------------------------------------------

function box(w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * A console bank (reference: curved white control room): a white desk with
 * a sloped key strip, and a wall housing above it with a row of data screens.
 * Built in the placeOnEndWall frame: X along the rim, Y up, Z into the room.
 */
function createConsole(materials, width, index) {
  const group = new THREE.Group();
  group.name = 'l1-console';

  group.add(box(width, 1.1, 0.9, materials.shell, 0, 0.55, 0.45)); // desk
  group.add(box(width, 0.06, 0.92, materials.trim, 0, 1.13, 0.46)); // desk edge

  const keypad = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.85, 0.45),
    materials.keypads[index % materials.keypads.length]
  );
  keypad.rotation.x = -Math.PI / 2 + 0.35; // tilted toward the operator
  keypad.position.set(0, 1.2, 0.5);
  group.add(keypad);

  group.add(box(width, 1.9, 0.3, materials.shell, 0, 2.55, 0.15)); // screen housing

  const screenCount = width >= 5 ? 3 : 2;
  const gap = 0.18;
  const screenW = (width - 0.5 - gap * (screenCount - 1)) / screenCount;
  for (let i = 0; i < screenCount; i++) {
    const x = -width / 2 + 0.25 + screenW / 2 + i * (screenW + gap);
    group.add(box(screenW + 0.1, 1.25, 0.04, materials.recess, x, 2.6, 0.31));
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(screenW, 1.1),
      materials.screens[(index * 3 + i) % materials.screens.length]
    );
    screen.position.set(x, 2.6, 0.335);
    group.add(screen);
  }
  return group;
}

/**
 * A crew bunk (reference: the centrifuge sleeping berths): a white plinth
 * with a navy mattress, a dark backboard, and a lit status tab.
 */
function createBunk(materials, w, index) {
  const group = new THREE.Group();
  group.name = 'l1-bunk';

  group.add(box(w, 1.0, 0.92, materials.shell, 0, 0.5, 0.46)); // plinth
  group.add(box(w - 0.3, 0.22, 0.8, materials.mattress, 0, 1.11, 0.44)); // mattress
  group.add(box(w, 1.3, 0.12, materials.recess, 0, 1.75, 0.06)); // backboard
  group.add(box(w + 0.2, 0.18, 0.5, materials.shell, 0, 2.5, 0.25)); // canopy lip
  group.add(box(0.5, 0.3, 0.02, materials.recess, w / 2 - 0.45, 0.6, 0.93)); // status plate
  const lamp = materials[index % 2 ? 'statusGreen' : 'statusAmber'];
  group.add(box(0.12, 0.12, 0.01, lamp, w / 2 - 0.6, 0.6, 0.945));
  group.add(box(0.12, 0.12, 0.01, materials.statusGreen, w / 2 - 0.3, 0.6, 0.945));
  return group;
}

function createWallProps(materials) {
  const group = new THREE.Group();
  group.name = 'l1-wall-props';
  layoutEndWallProps().forEach((spec, i) => {
    const prop = spec.type === 'console'
      ? createConsole(materials, spec.width, i)
      : createBunk(materials, spec.width, i);
    placeOnEndWall(prop, spec.phi, spec.side);
    group.add(prop);
  });
  return group;
}

/**
 * Builds the whole L1 visual pass.
 * @returns {{ group: THREE.Group, dispose: () => void }} `dispose` frees the
 *   canvas textures; the level's own traverse already frees geometry and materials.
 */
export function createLevel1Decor() {
  const materials = createMaterials();
  const group = new THREE.Group();
  group.name = 'l1-decor';
  group.add(createDeck(materials));
  group.add(createEndWalls(materials));
  group.add(createWallProps(materials));

  function dispose() {
    const all = Object.values(materials).flat();
    for (const material of all) material.map?.dispose();
  }
  return { group, dispose };
}
