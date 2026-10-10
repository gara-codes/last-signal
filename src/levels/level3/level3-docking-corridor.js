// src/levels/level3/level3-docking-corridor.js
//
// The thin L3 assembler. It builds the four acts through their layout
// modules, collects the collision/hazard/gate/trigger contracts each act
// emits, and exposes the SAME public surface main.js already drives for L2:
//
//   const level = createLevel3();
//   scene.add(level.group);
//   level.update(delta, viewer, input);  // viewer = flycam camera or player
//   level.dispose();
//   level.collisionData                   // { wallAABBs, railAABBs, rampSurfaces, floorSpec }
//
// BLOCKOUT BOUNDARY (locked in the design interview): everything VISIBLE
// ships here — geometry, collapse rigs, cycling hazard telegraphs, animating
// gates, pickups and the lighting-cue channel. Scene-level presentation
// (starfield, near-black fog, every dynamic light) is owned at RUNTIME by
// LightingRigL3 — the built group intentionally ships zero lights. Nothing
// CONSEQUENTIAL ships: damage, lethality, countdown logic, O2 drain, gate
// costs and checkpoint restart are exported as typed data on group.userData
// for the systems pass. The camera 6u boom and zero-g/gravity-flip modes land
// in the systems pass too.

import * as THREE from 'three';
import { KitBuilder } from './corridor-kit.js';
import { createHazard } from './hazards.js';
import { createCollapseRig } from './breaches.js';
import { createCheckpoint } from './props3.js';
import { buildAct1 } from './acts/act1-refit.js';
import { buildAct2 } from './acts/act2-wounds.js';
import { buildAct3 } from './acts/act3-belly.js';
import { buildAct4 } from './acts/act4-finale.js';
import {
  ACTS,
  ACT_BOUNDS,
  CHECKPOINTS,
  COUNTDOWN,
  CARRYOVER,
  ENDING,
  GATES,
  HAZARDS,
  LIGHTING_CUE_TYPES,
  MAIN_Y,
  LOWER_Y,
  SPAWN,
  getSegment,
} from './level3-data.js';

const ACT_BUILDERS = { 1: buildAct1, 2: buildAct2, 3: buildAct3, 4: buildAct4 };

/**
 * The blockout material palette. Keyed by the semantic material names every
 * kit/breach/hazard/prop module already references, so one palette drives the
 * whole level and dispose() can free it in one traverse. Placeholder reads —
 * Gara's LightingRigL3 pass replaces the emissive/colour tuning later.
 */
function createMaterials() {
  const std = (color, opts = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.15, ...opts });
  return {
    floor: std(0x2a2f38),
    frame: std(0x3b424d, { metalness: 0.4, roughness: 0.6 }),
    trim: std(0x59626e, { metalness: 0.5, roughness: 0.5 }),
    panel: std(0x333a44),
    container: std(0x4a4033),
    debris: std(0x24272c, { roughness: 1 }),
    catwalk: std(0x5a5348, { metalness: 0.3 }),
    warning: std(0x8a3b1a, { emissive: 0x3a1000, emissiveIntensity: 0.6 }),
    light: std(0xdfe8ff, { emissive: 0xff2a1a, emissiveIntensity: 1.4 }), // red emergency identity
    glass: std(0x1a2a3a, { transparent: true, opacity: 0.4, metalness: 0.6, roughness: 0.2 }),
    steam: std(0x9aa4b0, { transparent: true, opacity: 0.35 }),
    fire: std(0xff5a1a, { emissive: 0xff2a00, emissiveIntensity: 1.6, transparent: true, opacity: 0.8 }),
    screen: std(0x0a1a14, { emissive: 0x1aff88, emissiveIntensity: 0.8 }),
    pod: std(0x6a727c, { metalness: 0.6, roughness: 0.4 }),
    podWindow: std(0x0a1830, { emissive: 0x2a4a6f, emissiveIntensity: 0.6, metalness: 0.7, roughness: 0.2 }),
  };
}

function box3Of(b) {
  return new THREE.Box3(new THREE.Vector3(b.minX, b.minY, b.minZ), new THREE.Vector3(b.maxX, b.maxY, b.maxZ));
}

export function createLevel3(options = {}) {
  const restore = options.checkpoint ?? null;

  const group = new THREE.Group();
  group.name = 'level-3';
  group.userData.lightingCues = [];

  const materials = createMaterials();

  // Shared build state every act's ctx writes into.
  const updatables = [];
  const triggers = []; // { box: Box3, fn, id, fired }
  const eyes = []; // { api, act } — AEGIS eyes, darkened behind seals
  const hazardData = [];
  const gateData = [];
  const fallVolumes = [];
  const wallAABBs = [];
  const railAABBs = [];
  const rampSurfaces = [];
  const actGroups = {};

  let crackMotif = null;
  let elapsed = 0;

  const cue = (type, position) => {
    group.userData.lightingCues.push({ type, t: elapsed, position: position.toArray ? position.toArray() : [...position] });
  };

  function makeCtx(act, actGroup, kit) {
    return {
      kit,
      materials,
      act,
      segment: (id) => getSegment(id),
      baseY: (segment) => (segment.plane === 'lower' ? LOWER_Y : MAIN_Y),
      cue,
      add(obj) {
        actGroup.add(obj.group);
        if (typeof obj.update === 'function') updatables.push(obj);
        if (typeof obj.setDark === 'function') eyes.push({ api: obj, act });
        return obj;
      },
      hazard(specOrId) {
        const spec = typeof specOrId === 'string' ? HAZARDS.find((h) => h.id === specOrId) : specOrId;
        const segment = getSegment(spec.segment);
        const hazard = createHazard(spec, segment, materials);
        actGroup.add(hazard.group);
        updatables.push(hazard);
        hazardData.push(hazard.data);
        return hazard;
      },
      rig(breach, box, id) {
        const segment = getSegment(breach.segment);
        const rig = createCollapseRig(breach, segment, materials, (type, position) => cue(type, position));
        actGroup.add(rig.group);
        updatables.push(rig);
        triggers.push({ box: box3Of(box), fn: () => rig.begin(), id: id ?? breach.id, fired: false });
        return rig;
      },
      trigger(box, fn, id) {
        triggers.push({ box: box3Of(box), fn, id, fired: false });
      },
      door(id, data) {
        gateData.push({ ...data, act, key: id });
      },
      registerCrackMotif(motif) {
        crackMotif = motif;
      },
      registerEye(eye) {
        // already captured by add(); no-op kept for act readability
        void eye;
      },
    };
  }

  // ── Build the four acts ─────────────────────────────────────────────
  for (const act of ACTS) {
    const actGroup = new THREE.Group();
    actGroup.name = `act-${act}`;
    const kit = new KitBuilder(materials);
    ACT_BUILDERS[act](makeCtx(act, actGroup, kit));
    kit.finalize(actGroup);
    group.add(actGroup);
    actGroups[act] = actGroup;
    wallAABBs.push(...kit.solids);
    railAABBs.push(...kit.rails);
    rampSurfaces.push(...kit.ramps);
    fallVolumes.push(...kit.fallVolumes);
  }

  // Checkpoint markers (visual only — restart logic is the systems pass).
  for (const cp of CHECKPOINTS) {
    const marker = createCheckpoint(materials);
    marker.group.position.set(...cp.position);
    marker.group.name = `checkpoint-${cp.id}`;
    group.add(marker.group);
  }

  const collisionData = {
    wallAABBs,
    railAABBs,
    rampSurfaces,
    floorSpec: { groundY: MAIN_Y, deckY: LOWER_Y },
  };

  // Systems-pass hand-off: everything consequential, as typed data.
  group.userData.collisionData = collisionData;
  group.userData.fallVolumes = fallVolumes;
  group.userData.hazards = hazardData;
  group.userData.gates = { table: GATES, placed: gateData };
  group.userData.checkpoints = CHECKPOINTS;
  group.userData.countdown = COUNTDOWN;
  group.userData.carryover = CARRYOVER;
  group.userData.ending = ENDING;
  group.userData.lightingCueTypes = LIGHTING_CUE_TYPES;
  group.userData.triggerTable = triggers.map((t) => ({ id: t.id, box: t.box }));

  /** Which act band the viewer is in (1..4), by ACT_BOUNDS containment. */
  function activeActOf(position) {
    for (const act of ACTS) {
      const b = ACT_BOUNDS[act];
      if (
        position.x >= b.minX && position.x <= b.maxX &&
        position.z >= b.minZ && position.z <= b.maxZ &&
        position.y >= b.minY - 4 && position.y <= b.maxY + 4
      ) {
        return act;
      }
    }
    // Outside every band (flycam roaming): nearest act by z, clamped.
    let best = 1;
    let bestDist = Infinity;
    for (const act of ACTS) {
      const b = ACT_BOUNDS[act];
      const d = Math.abs(position.z - (b.minZ + b.maxZ) / 2) + Math.abs(position.x - (b.minX + b.maxX) / 2);
      if (d < bestDist) { bestDist = d; best = act; }
    }
    return best;
  }

  function update(delta, viewer, input) {
    elapsed += delta;

    for (const u of updatables) u.update(delta, viewer);

    if (viewer?.position) {
      // Fire-once triggers by viewer position (collapse telegraphs, purge).
      for (const trigger of triggers) {
        if (trigger.fired) continue;
        if (trigger.box.containsPoint(viewer.position)) {
          trigger.fired = true;
          trigger.fn();
        }
      }

      applyActState(activeActOf(viewer.position));
    }

    void input;
  }

  /** Act-band culling, crack-motif escalation and AEGIS eye darkening. */
  function applyActState(activeAct) {
    // Act-band culling with one-act look-ahead.
    for (const act of ACTS) {
      actGroups[act].visible = act >= activeAct && act <= activeAct + 1;
    }
    // The one growing-crack motif escalates per act boundary.
    if (crackMotif) crackMotif.setState(THREE.MathUtils.clamp(activeAct - 2, 0, 2));
    // AEGIS eyes darken once the player is a full act ahead (losing sight).
    for (const eye of eyes) eye.api.setDark(eye.act < activeAct);
  }

  function dispose() {
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose();
      }
    });
    for (const key of Object.keys(materials)) materials[key].dispose();
    updatables.length = 0;
    triggers.length = 0;
    eyes.length = 0;
    hazardData.length = 0;
    gateData.length = 0;
  }

  function getSpawnView() {
    return {
      position: new THREE.Vector3(...SPAWN.position),
      lookAt: new THREE.Vector3(...SPAWN.lookAt),
    };
  }

  function getPlayerSpawn() {
    if (restore) return { x: restore.x, y: restore.y, z: restore.z, yaw: restore.yaw ?? 0 };
    const [px, , pz] = SPAWN.position;
    const [lx, , lz] = SPAWN.lookAt;
    const yaw = Math.atan2(lx - px, lz - pz);
    return { x: px, y: MAIN_Y, z: pz, yaw };
  }

  return {
    group,
    dispose,
    update,
    collisionData,
    getSpawnView,
    getPlayerSpawn,
  };
}
