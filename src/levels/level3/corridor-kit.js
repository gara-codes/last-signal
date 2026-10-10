// src/levels/level3/corridor-kit.js
//
// The tiered section kit. Every builder emits VISUALS and COLLISION from the
// same call so the two can never drift: side walls register axis-aligned
// solids (FlatPhysicsController's wallAABBs contract), catwalk railings
// register railAABBs, ramps register rampSurfaces, and open-floor breaches
// register fallVolumes (the controller's floorSpec is a global storey plane,
// so a hole in the deck can only be a volume the systems pass tests against
// — the blockout exports them, it never applies damage itself).
//
// Draw-call discipline: repeated elements (ribs, light strips, rail posts,
// pipes) are collected per type as instance matrices and become one
// InstancedMesh per type at finalize(); unique static geometry is collected
// per material and merged with mergeGeometries; anything that moves, anims
// or is disposed independently goes through addDynamic() and stays a lone
// mesh. finalize() builds all of that into the act group in one pass.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TIERS, SLAB, ENVELOPE } from './level3-data.js';

const RIB_SPACING = 7;

/**
 * Evenly spaced stops from `from` toward `to`, `step` apart, stopping before
 * the end so the last stop is at least `tol` short of `to` — matching the
 * original `while (Math.abs(along - to) > tol)` intent. Counted, not
 * condition-driven, so a step larger than the remaining run can never
 * overshoot `to` and spin forever (the exit condition would grow again).
 */
function alongStops(from, to, step, tol = 0.5) {
  const dir = from > to ? -1 : 1;
  const total = Math.abs(to - from);
  const count = Math.max(0, Math.floor((total - tol) / step) + 1);
  const stops = [];
  for (let i = 0; i < count; i += 1) stops.push(from + dir * step * i);
  return stops;
}

/** Axis helpers: a segment runs along 'z' (lateral x) or 'x' (lateral z). */
function frame(segment) {
  const axis = segment.axis;
  const length = Math.abs(segment.from - segment.to);
  const center = (segment.from + segment.to) / 2;
  return { axis, length, center, sign: segment.from > segment.to ? -1 : 1 };
}

/** Box sizes for a run of length l along the segment axis. */
function runSize(segment, w, h, l) {
  return segment.axis === 'z' ? [w, h, l] : [l, h, w];
}

/** World position of (lateral offset, height, along-coordinate). */
function atPoint(segment, lateral, y, along) {
  return segment.axis === 'z'
    ? new THREE.Vector3(segment.at + lateral, y, along)
    : new THREE.Vector3(along, y, segment.at + lateral);
}

function matrixAt(position, rotY = 0, scale = null, rotX = 0) {
  const matrix = new THREE.Matrix4();
  // Euler (not just a Y-axis angle) so beams can be rolled for x-run sections.
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, 0));
  matrix.compose(position, quaternion, scale ?? new THREE.Vector3(1, 1, 1));
  return matrix;
}

function box(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}

/** Axis-aligned solid box AABB covering a lateral span over an along-range. */
function spanAABB(segment, lateralMin, lateralMax, yMin, yMax, alongMin, alongMax) {
  const [lo, hi] = alongMin < alongMax ? [alongMin, alongMax] : [alongMax, alongMin];
  if (segment.axis === 'z') {
    return {
      minX: segment.at + lateralMin,
      maxX: segment.at + lateralMax,
      minY: yMin,
      maxY: yMax,
      minZ: lo,
      maxZ: hi,
      name: 'kit-wall',
    };
  }
  return {
    minX: lo,
    maxX: hi,
    minY: yMin,
    maxY: yMax,
    minZ: segment.at + lateralMin,
    maxZ: segment.at + lateralMax,
    name: 'kit-wall',
  };
}

/**
 * The shared alcove builder: a forward-exit duct spur off a spine/passage
 * segment. Built as explicit per-run slabs and wall panels so the junction
 * gaps are exact (reusing ductSection would either seal the T-junctions or
 * leave the runs wall-less). Host segments are axis 'z' and walk toward -Z,
 * so the spur runs along 'x': in at entryZ, along behind the host wall,
 * out at exitZ (strictly ahead of entry). Returns the doorway entries the
 * caller must pass to spineSection/passageSection so the host wall's visual
 * AND collision solid open at both mouths, plus the alcove's interior anchor.
 */
export function buildAlcoveDucts(kit, alcove, host, y) {
  const baseY = y ?? 0;
  const tier = TIERS.duct;
  const hw = (host.tier === 'spine' || host.tier === 'hall' ? TIERS.spine : TIERS.passage).width / 2;
  const wallX = alcove.side * hw; // host wall face the mouths punch through
  const backX = alcove.side * (hw + alcove.depth); // outer limit of the spur
  const midX = (wallX + backX) / 2;
  const [zA, zB] = alcove.entryZ < alcove.exitZ ? [alcove.entryZ, alcove.exitZ] : [alcove.exitZ, alcove.entryZ];
  const midZ = (zA + zB) / 2;
  const spanZ = zB - zA;

  const slab = (w, d, x, z) => {
    kit.addStatic(box(w, SLAB, d), 'floor', matrixAt(new THREE.Vector3(x, baseY - SLAB / 2, z)));
    kit.addStatic(box(w, SLAB, d), 'frame', matrixAt(new THREE.Vector3(x, baseY + tier.height + SLAB / 2, z)));
  };
  // Wall panel along z at a fixed x, spanning [z0, z1]; visual + solid.
  const wallZ = (x, z0, z1, name) => {
    const d = Math.abs(z1 - z0);
    if (d < 0.1) return;
    const z = (z0 + z1) / 2;
    kit.addStatic(box(0.4, tier.height, d), 'frame', matrixAt(new THREE.Vector3(x, baseY + tier.height / 2, z)));
    kit.addSolid({ minX: x - 0.2, maxX: x + 0.2, minY: baseY, maxY: baseY + tier.height, minZ: z - d / 2, maxZ: z + d / 2 }, name);
  };
  // Wall panel along x at a fixed z, spanning [x0, x1]; visual + solid.
  const wallX_ = (z, x0, x1, name) => {
    const w = Math.abs(x1 - x0);
    if (w < 0.1) return;
    const x = (x0 + x1) / 2;
    kit.addStatic(box(w, tier.height, 0.4), 'frame', matrixAt(new THREE.Vector3(x, baseY + tier.height / 2, z)));
    kit.addSolid({ minX: x - w / 2, maxX: x + w / 2, minY: baseY, maxY: baseY + tier.height, minZ: z - 0.2, maxZ: z + 0.2 }, name);
  };

  // In-run (entryZ): open at the host mouth and at the back junction.
  slab(Math.abs(backX - wallX), tier.width, midX, alcove.entryZ);
  wallX_(alcove.entryZ + tier.width / 2, wallX, backX, `${alcove.id}-in-far`);
  wallX_(alcove.entryZ - tier.width / 2, wallX, backX, `${alcove.id}-in-near`);
  // Along-run (behind the host wall): solid back wall, open both z-ends.
  slab(tier.width, spanZ, backX, midZ);
  wallZ(backX + alcove.side * tier.width / 2, zA, zB, `${alcove.id}-back`);
  // Out-run (exitZ): open at the back junction and at the host mouth.
  slab(Math.abs(backX - wallX), tier.width, midX, alcove.exitZ);
  wallX_(alcove.exitZ + tier.width / 2, wallX, backX, `${alcove.id}-out-far`);
  wallX_(alcove.exitZ - tier.width / 2, wallX, backX, `${alcove.id}-out-near`);

  const doorways = [
    { side: alcove.side, along: alcove.entryZ, width: tier.width, height: tier.height },
    { side: alcove.side, along: alcove.exitZ, width: tier.width, height: tier.height },
  ];
  // Interior anchor: mid-depth of the along-run, where contents props stand.
  const anchor = [backX - alcove.side * (tier.width / 2 - 0.6), baseY, midZ];
  return { doorways, anchor };
}

export class KitBuilder {
  constructor(materials) {
    this.materials = materials;
    this.instances = new Map(); // type -> Matrix4[]
    this.statics = new Map(); // materialKey -> { geometry, matrix }[]
    this.dynamics = [];
    this.solids = [];
    this.rails = [];
    this.ramps = [];
    this.fallVolumes = [];
  }

  addInstanced(type, matrix) {
    if (!this.instances.has(type)) this.instances.set(type, []);
    this.instances.get(type).push(matrix);
  }

  addStatic(geometry, materialKey, matrix) {
    if (!this.statics.has(materialKey)) this.statics.set(materialKey, []);
    this.statics.get(materialKey).push({ geometry, matrix });
  }

  /** Lone mesh for anything animated/interactive; optionally registers AABBs. */
  addDynamic(mesh, { solid = null, rail = null } = {}) {
    this.dynamics.push(mesh);
    if (solid) this.solids.push({ ...solid, name: mesh.name });
    if (rail) this.rails.push({ ...rail, name: mesh.name });
    return mesh;
  }

  addSolid(aabb, name = 'kit-solid') {
    this.solids.push({ ...aabb, name });
  }

  addRail(aabb, name = 'kit-rail') {
    this.rails.push({ ...aabb, name });
  }

  addRamp(ramp) {
    this.ramps.push(ramp);
  }

  addFallVolume(aabb, name = 'fall-volume') {
    this.fallVolumes.push({ ...aabb, name });
  }

  /** Instance prototypes: one geometry+material per type key. */
  prototype(type) {
    const m = this.materials;
    switch (type) {
      case 'rib-spine':
        return { geometry: box(0.7, TIERS.spine.height, 0.7), material: m.frame };
      case 'rib-passage':
        return { geometry: box(0.6, TIERS.passage.height, 0.6), material: m.frame };
      case 'rib-hall':
        return { geometry: box(0.9, TIERS.hall.heightMin, 0.9), material: m.frame };
      case 'strip':
        return { geometry: box(0.22, 2.4, 0.28), material: m.light };
      case 'post':
        return { geometry: box(0.14, 1.1, 0.14), material: m.trim };
      case 'pipe':
        return { geometry: new THREE.CylinderGeometry(0.16, 0.16, 4, 6), material: m.trim };
      case 'panel':
        return { geometry: box(2.6, 1.5, 0.12), material: m.panel };
      default:
        return { geometry: box(0.5, 0.5, 0.5), material: m.frame };
    }
  }

  /** Builds InstancedMeshes + merged statics + dynamics into `group`. */
  finalize(group) {
    for (const [type, matrices] of this.instances) {
      const { geometry, material } = this.prototype(type);
      const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.name = `instanced-${type}`;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    for (const [materialKey, entries] of this.statics) {
      const cloned = entries.map(({ geometry, matrix }) => {
        const clone = geometry.clone();
        clone.applyMatrix4(matrix);
        geometry.dispose();
        return clone;
      });
      const merged = mergeGeometries(cloned, false);
      cloned.forEach((clone) => clone.dispose());
      const mesh = new THREE.Mesh(merged, this.materials[materialKey]);
      mesh.name = `merged-${materialKey}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    for (const mesh of this.dynamics) group.add(mesh);
  }

  // ── Section builders ────────────────────────────────────────────────

  /**
   * Enclosed tier-1 spine: floor slab, ceiling slab, both walls, ribs and
   * light strips every RIB_SPACING, wall panelling. `openCeiling`/`openFloor`
   * spans (along-ranges) omit the slab there and register a fall volume for
   * open floors (crown breaches keep the floor — only the ceiling goes).
   */
  spineSection(segment, { openCeiling = [], openFloor = [], walls = [true, true], y, doorways = [] } = {}) {
    // Resolve the cross-section from the segment's own tier: passageSection
    // and turnChamber delegate here, and building them at spine size leaves
    // the section's real walls missing — the 9×7 slabs float outside the
    // 6×5 section and the doorway cuts land in the void beside the room.
    const tier = { turn: TIERS.passage }[segment.tier] ?? TIERS[segment.tier] ?? TIERS.spine;
    const baseY = y ?? 0;
    const { length } = frame(segment);
    const inOpen = (spans, along) => spans.some(([a, b]) => along >= Math.min(a, b) && along <= Math.max(a, b));

    // Floor + ceiling as per-rib-bay slabs so breach spans can omit bays.
    const bays = Math.max(1, Math.round(length / RIB_SPACING));
    const bayLen = length / bays;
    for (let i = 0; i < bays; i += 1) {
      const along = segment.from + (i + 0.5) * bayLen * (segment.from > segment.to ? -1 : 1);
      if (!openFloor.some(([a, b]) => along >= Math.min(a, b) && along <= Math.max(a, b))) {
        this.addStatic(box(...runSize(segment, tier.width, SLAB, bayLen)), 'floor', matrixAt(atPoint(segment, 0, baseY - SLAB / 2, along)));
      } else {
        this.addFallVolume(
          spanAABB(segment, -tier.width / 2, tier.width / 2, baseY - 4, baseY + 0.5, along - bayLen / 2, along + bayLen / 2),
          'deck-fall-volume'
        );
      }
      if (!inOpen(openCeiling, along)) {
        this.addStatic(box(...runSize(segment, tier.width, SLAB, bayLen)), 'frame', matrixAt(atPoint(segment, 0, baseY + tier.height + SLAB / 2, along)));
      }
    }

    // Side walls, built per bay. A doorway overlapping a bay cuts a
    // width x height opening into it — jambs beside, header above — instead
    // of opening the whole 7u-tall bay, so no void (or starfield) shows over
    // or around the opening. Doorways carry { side, along, width, height? };
    // height defaults to the tier height (a full-height opening).
    const dir = segment.from > segment.to ? -1 : 1;
    const doorwayOn = (side, from, to) =>
      doorways.find((d) => {
        if (d.side !== side) return false;
        const half = (d.width ?? 3) / 2;
        return Math.min(from, to) <= d.along + half && Math.max(from, to) >= d.along - half;
      });
    const wallPiece = (side, yMin, yMax, from, to) => {
      const len = Math.abs(to - from);
      if (len < 0.05 || yMax - yMin < 0.05) return;
      this.addStatic(
        box(...runSize(segment, 0.5, yMax - yMin, len)),
        'frame',
        matrixAt(atPoint(segment, (side * tier.width) / 2 - side * 0.25, baseY + (yMin + yMax) / 2, (from + to) / 2))
      );
      this.addSolid(
        spanAABB(
          segment,
          (side * tier.width) / 2 - side * 0.5,
          (side * tier.width) / 2,
          baseY + yMin,
          baseY + yMax,
          from,
          to
        ),
        `wall-${segment.id}-${side}-${((from + to) / 2).toFixed(2)}`
      );
    };
    for (const side of [-1, 1]) {
      const idx = side === -1 ? 0 : 1;
      if (!walls[idx]) continue;
      for (let i = 0; i < bays; i += 1) {
        const bayMin = Math.min(segment.from + i * bayLen * dir, segment.from + (i + 1) * bayLen * dir);
        const bayMax = Math.max(segment.from + i * bayLen * dir, segment.from + (i + 1) * bayLen * dir);
        const door = doorwayOn(side, bayMin, bayMax);
        if (!door) {
          wallPiece(side, 0, tier.height, bayMin, bayMax);
          continue;
        }
        const half = (door.width ?? 3) / 2;
        const openMin = Math.max(door.along - half, bayMin);
        const openMax = Math.min(door.along + half, bayMax);
        wallPiece(side, 0, tier.height, bayMin, openMin); // jamb
        wallPiece(side, 0, tier.height, openMax, bayMax); // jamb
        wallPiece(side, door.height ?? tier.height, tier.height, openMin, openMax); // header
      }
      // Panelling + strips ride the wall face, skipping pieces that would
      // land inside a doorway span so nothing floats in an opening, and
      // pieces the rib-offset would push past a section end (the last
      // stop's offset can overshoot into the next room or the void).
      const innerLo = Math.min(segment.from, segment.to) + 0.15;
      const innerHi = Math.max(segment.from, segment.to) - 0.15;
      for (const along of alongStops(segment.from, segment.to, RIB_SPACING, 1)) {
        const rotY = segment.axis === 'z' ? (side === -1 ? Math.PI / 2 : -Math.PI / 2) : side === -1 ? 0 : Math.PI;
        const panelAt = along - (segment.from > segment.to ? 2 : -2);
        if (panelAt >= innerLo && panelAt <= innerHi && !doorwayOn(side, panelAt - 1.3, panelAt + 1.3)) {
          this.addInstanced('panel', matrixAt(atPoint(segment, (side * tier.width) / 2 - side * 0.35, baseY + 2.2, panelAt), rotY));
        }
        const stripAt = along - (segment.from > segment.to ? 3.5 : -3.5);
        if (stripAt >= innerLo && stripAt <= innerHi && !doorwayOn(side, stripAt - 0.14, stripAt + 0.14)) {
          // Strip geometry is thin in X (faces ±x); an x-run wall faces ±z,
          // so the bar needs a quarter turn to stay flush.
          this.addInstanced('strip', matrixAt(atPoint(segment, (side * tier.width) / 2 - side * 0.4, baseY + 3.4, stripAt), segment.axis === 'x' ? Math.PI / 2 : 0));
        }
      }
    }

    // Ribs: two posts + a header per spacing, instanced. A rib whose line
    // falls inside a doorway span would leave a post floating in the
    // opening, so the whole rib is skipped there.
    for (const along of alongStops(segment.from, segment.to, RIB_SPACING)) {
      if (doorways.some((d) => Math.abs(d.along - along) <= (d.width ?? 3) / 2 + 0.35)) continue;
      for (const side of [-1, 1]) {
        this.addInstanced('rib-spine', matrixAt(atPoint(segment, (side * tier.width) / 2, baseY + tier.height / 2, along)));
      }
      this.addStatic(box(...runSize(segment, tier.width + 0.7, 0.7, 0.7)), 'frame', matrixAt(atPoint(segment, 0, baseY + tier.height, along)));
    }
  }

  /** Tier-2 octagonal chamfered passage: narrower, with 45° corner chamfers. */
  passageSection(segment, { y, openCeiling = [], openFloor = [], doorways = [] } = {}) {
    const tier = TIERS.passage;
    const baseY = y ?? 0;
    const { length, center } = frame(segment);
    this.spineSection(segment, { y: baseY, openCeiling, openFloor, doorways });
    // Chamfer strips removed after visual review: short tilted beams at the
    // corners read as random floating blocks instead of octagonal-passage
    // identity. Clean walls are clearer for the blockout; chamfers can return
    // later as actual chamfered corners or thin wall panels.
  }

  /** Tier-3 duct: bare box tunnel, segments <= 15 u by design rule. */
  ductSection(segment, { y, doorways = [] } = {}) {
    const tier = TIERS.duct;
    const baseY = y ?? 0;
    const { length, center } = frame(segment);
    this.addStatic(box(...runSize(segment, tier.width, SLAB, length)), 'floor', matrixAt(atPoint(segment, 0, baseY - SLAB / 2, center)));
    this.addStatic(box(...runSize(segment, tier.width, SLAB, length)), 'frame', matrixAt(atPoint(segment, 0, baseY + tier.height + SLAB / 2, center)));
    for (const side of [-1, 1]) {
      const open = doorways.some((d) => d.side === side);
      if (!open) {
        this.addStatic(box(...runSize(segment, 0.4, tier.height, length)), 'frame', matrixAt(atPoint(segment, (side * tier.width) / 2 - side * 0.2, baseY + tier.height / 2, center)));
        this.addSolid(
          spanAABB(segment, (side * tier.width) / 2 - side * 0.4, (side * tier.width) / 2, baseY, baseY + tier.height, segment.from, segment.to),
          `duct-wall-${segment.id}-${side}`
        );
      }
    }
    for (const along of alongStops(segment.from, segment.to, 5)) {
      this.addInstanced('pipe', matrixAt(atPoint(segment, -1.1, baseY + tier.height - 0.4, along), segment.axis === 'z' ? Math.PI / 2 : 0, new THREE.Vector3(1, 1.2, 1)));
    }
  }

  /** Hall shell: big walls + truss ribs; interior dressed by the act. */
  hallShell(segment, { width, height, y } = {}) {
    const baseY = y ?? 0;
    const { length, center } = frame(segment);
    this.addStatic(box(...runSize(segment, width, SLAB, length)), 'floor', matrixAt(atPoint(segment, 0, baseY - SLAB / 2, center)));
    this.addStatic(box(...runSize(segment, width, SLAB, length)), 'frame', matrixAt(atPoint(segment, 0, baseY + height + SLAB / 2, center)));
    for (const side of [-1, 1]) {
      this.addStatic(box(...runSize(segment, 0.6, height, length)), 'frame', matrixAt(atPoint(segment, (side * width) / 2 - side * 0.3, baseY + height / 2, center)));
      this.addSolid(
        spanAABB(segment, (side * width) / 2 - side * 0.6, (side * width) / 2, baseY, baseY + height, segment.from, segment.to),
        `hall-wall-${segment.id}-${side}`
      );
    }
    for (const along of alongStops(segment.from, segment.to, RIB_SPACING)) {
      for (const side of [-1, 1]) this.addInstanced('rib-hall', matrixAt(atPoint(segment, (side * width) / 2, baseY + height / 2, along)));
      this.addStatic(box(...runSize(segment, width + 0.9, 0.9, 0.9)), 'frame', matrixAt(atPoint(segment, 0, baseY + height, along)));
    }
  }

  /**
   * Transition end-wall: closes a section end down to the cross-section of
   * the section continuing through it (e.g. the 22×13 hall meeting the 9×7
   * spine, or the hall meeting the 3×3 bypass duct). Without it the tier-size
   * mismatch is open void straight out to the starfield. The opening is
   * centered and floor-level (no sill); omit the opening for a solid cap.
   */
  endWall(segment, { at, width, height, openingWidth = 0, openingHeight = 0, y } = {}) {
    const baseY = y ?? 0;
    const t = 0.6; // wall thickness
    const piece = (latFrom, latTo, yMin, yMax) => {
      const w = latTo - latFrom;
      const h = yMax - yMin;
      if (w < 0.05 || h < 0.05) return;
      const mid = (latFrom + latTo) / 2;
      const geometry =
        segment.axis === 'z' ? new THREE.BoxGeometry(w, h, t) : new THREE.BoxGeometry(t, h, w);
      this.addStatic(
        geometry,
        'frame',
        new THREE.Matrix4().makeTranslation(
          ...(segment.axis === 'z'
            ? [segment.at + mid, baseY + (yMin + yMax) / 2, at]
            : [at, baseY + (yMin + yMax) / 2, segment.at + mid])
        )
      );
      this.addSolid(
        segment.axis === 'z'
          ? { minX: segment.at + latFrom, maxX: segment.at + latTo, minY: baseY + yMin, maxY: baseY + yMax, minZ: at - t / 2, maxZ: at + t / 2 }
          : { minX: at - t / 2, maxX: at + t / 2, minY: baseY + yMin, maxY: baseY + yMax, minZ: segment.at + latFrom, maxZ: segment.at + latTo },
        `endwall-${segment.id}-${at}-${mid.toFixed(2)}`
      );
    };
    const half = width / 2;
    const ow = openingWidth;
    const oh = openingHeight;
    piece(-half, -ow / 2, 0, height); // left of the opening
    piece(ow / 2, half, 0, height); // right of the opening
    piece(-ow / 2, ow / 2, oh, height); // header above the opening
  }

  /**
   * Turn chamber: passage-scale box at a route corner. The angled reveal
   * panels that used to dress the turn read as random floating slabs in
   * visual review, so the corner chamfers alone carry the turn identity.
   */
  turnChamber(segment, { y, doorways = [] } = {}) {
    this.passageSection(segment, { y, doorways });
  }

  /** Railed catwalk run across a wound or deck breach. */
  catwalk(segment, from, to, width, y, { railHeight = 1.1 } = {}) {
    const baseY = y ?? 0;
    const length = Math.abs(from - to);
    const center = (from + to) / 2;
    const mesh = new THREE.Mesh(box(...runSize(segment, width, SLAB, length)), this.materials.catwalk);
    mesh.name = `catwalk-${segment.id}`;
    mesh.position.copy(atPoint(segment, 0, baseY - SLAB / 2, center));
    mesh.receiveShadow = true;
    this.addDynamic(mesh);
    for (const side of [-1, 1]) {
      const lateral = (side * width) / 2;
      const rail = new THREE.Mesh(box(...runSize(segment, 0.16, railHeight, length)), this.materials.trim);
      rail.name = `catwalk-rail-${segment.id}-${side}`;
      rail.position.copy(atPoint(segment, lateral, baseY + railHeight / 2, center));
      this.addDynamic(rail, {
        rail: spanAABB(segment, lateral - 0.08, lateral + 0.08, baseY, baseY + railHeight + 0.6, from, to),
      });
      for (const along of alongStops(from, to, 3)) {
        this.addInstanced('post', matrixAt(atPoint(segment, lateral, baseY + 0.55, along)));
      }
    }
  }

  /** Girder beam walkway (1 u wide, no rails — a skill crossing). */
  girder(segment, from, to, y, lateral = 0) {
    const baseY = y ?? 0;
    const length = Math.abs(from - to);
    const center = (from + to) / 2;
    const mesh = new THREE.Mesh(box(...runSize(segment, 1, 0.4, length)), this.materials.trim);
    mesh.name = `girder-${segment.id}`;
    mesh.position.copy(atPoint(segment, lateral, baseY - 0.2, center));
    this.addDynamic(mesh);
  }

  /** Walkable ramp between storey-plane heights (<= ENVELOPE.maxStep rise per run). */
  ramp(segment, from, to, side, lowSide, yLow, yHigh) {
    const length = Math.abs(from - to);
    const center = (from + to) / 2;
    const rise = yHigh - yLow;
    const geometry = box(...runSize(segment, 3, 0.3, Math.hypot(length, rise)));
    const tilt = Math.atan2(rise, length);
    const matrix = new THREE.Matrix4();
    const position = atPoint(segment, side, (yLow + yHigh) / 2, center);
    const quaternion = new THREE.Quaternion().setFromAxisAngle(
      segment.axis === 'z' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1),
      tilt
    );
    matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1));
    this.addStatic(geometry, 'catwalk', matrix);
    const [lo, hi] = from < to ? [from, to] : [to, from];
    if (segment.axis === 'z') {
      this.addRamp({ minX: segment.at + side - 1.5, maxX: segment.at + side + 1.5, minZ: lo, maxZ: hi, lowSide });
    } else {
      this.addRamp({ minX: lo, maxX: hi, minZ: segment.at + side - 1.5, maxZ: segment.at + side + 1.5, lowSide });
    }
  }

  /** Crate stack: jump-envelope steps (each <= ENVELOPE.maxStep). */
  crateStack(position, count = 2) {
    for (let i = 0; i < count; i += 1) {
      const size = 1.6 - i * 0.2;
      const mesh = new THREE.Mesh(box(size, ENVELOPE.maxStep, size), this.materials.container);
      mesh.name = `crate-${i}`;
      mesh.position.set(position[0], position[1] + ENVELOPE.maxStep * (i + 0.5), position[2]);
      mesh.castShadow = true;
      this.addDynamic(mesh, {
        solid: {
          minX: position[0] - size / 2,
          maxX: position[0] + size / 2,
          minY: position[1] + ENVELOPE.maxStep * i,
          maxY: position[1] + ENVELOPE.maxStep * (i + 1),
          minZ: position[2] - size / 2,
          maxZ: position[2] + size / 2,
        },
      });
    }
  }
}
