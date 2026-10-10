// src/levels/level3/hazards.js
//
// The nine-hazard ladder (teach -> test -> combine -> chase -> final exam).
// Every factory returns { group, data, update(delta, viewer) } where `data`
// is the exported contract for the systems pass: type, act, telegraph and
// cycle windows, and the damage volume AABB. The blockout animates the
// VISUAL cycle only — nothing here damages, kills or drains.
//
// Conventions:
//   - Cycled hazards (steam, pads, beams, shutters, crane) run their loop
//     from t=0 so flycam reviews see the rhythm immediately.
//   - Triggered hazards (purge chase) wait for begin() from the assembler.
//   - Reactive hazards (collapsing planks) watch the viewer position each
//     frame and fire once per plank, so the flycam pass can rehearse them.

import * as THREE from 'three';
import { TIERS } from './level3-data.js';

function volumeAt(segment, z, lateralHalf, yMin, yMax, alongHalf) {
  if (segment.axis === 'z') {
    return {
      minX: segment.at - lateralHalf,
      maxX: segment.at + lateralHalf,
      minY: yMin,
      maxY: yMax,
      minZ: z - alongHalf,
      maxZ: z + alongHalf,
    };
  }
  return {
    minX: z - alongHalf,
    maxX: z + alongHalf,
    minY: yMin,
    maxY: yMax,
    minZ: segment.at - lateralHalf,
    maxZ: segment.at + lateralHalf,
  };
}

function baseYOf(segment) {
  return segment.plane === 'lower' ? -7 : 0;
}

function place(mesh, segment, lateral, y, along) {
  if (segment.axis === 'z') mesh.position.set(segment.at + lateral, y, along);
  else mesh.position.set(along, y, segment.at + lateral);
  return mesh;
}

/** 1 — debris fall: hanging slab swings, drops, crumbles, respawns. */
function debrisFall(spec, segment, materials) {
  const group = new THREE.Group();
  const baseY = baseYOf(segment);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 3), materials.debris);
  slab.name = `${spec.id}-slab`;
  place(slab, segment, 0, baseY + TIERS.spine.height - 1, spec.z);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.04, 0.16, 3.04), materials.warning);
  stripe.position.y = -0.45; // hazard band along the slab's lower edge
  slab.add(stripe);
  group.add(slab);
  const data = { ...spec, volume: volumeAt(segment, spec.z, 1.8, baseY, baseY + TIERS.spine.height, 1.8) };
  return {
    group,
    data,
    update(delta) {
      const t = (window.performance.now() / 1000) % spec.cycle;
      if (t < spec.telegraph) {
        // Hang + shiver; the warning stripe marks it as a timed drop.
        slab.visible = true;
        slab.scale.setScalar(1);
        slab.position.y = baseY + TIERS.spine.height - 1 + Math.sin(t * 20) * 0.05;
      } else if (t < spec.telegraph + 0.6) {
        const p = (t - spec.telegraph) / 0.6;
        slab.position.y = baseY + TIERS.spine.height - 1 - p * p * (TIERS.spine.height - 1.6);
      } else if (t < spec.telegraph + 1.1) {
        // Crumble into the deck instead of popping out, then wait for the
        // cycle wrap to respawn at ceiling height.
        slab.scale.setScalar(Math.max(0.001, 1 - (t - spec.telegraph - 0.6) / 0.5));
      } else {
        slab.visible = false;
      }
      void delta;
    },
  };
}

/** 2 — steam jet: nozzle hiss tell, then a bursting cone. */
function steamJet(spec, segment, materials) {
  const group = new THREE.Group();
  const baseY = baseYOf(segment);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.8, 8), materials.trim);
  place(nozzle, segment, -TIERS.spine.width / 2 + 0.6, baseY + 1.2, spec.z);
  group.add(nozzle);
  const jet = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4, 8, 1, true), materials.steam);
  jet.rotation.z = -Math.PI / 2;
  place(jet, segment, -TIERS.spine.width / 2 + 2.6, baseY + 1.2, spec.z);
  group.add(jet);
  const data = { ...spec, volume: volumeAt(segment, spec.z, 3, baseY, baseY + 2.4, 1) };
  return {
    group,
    data,
    update() {
      const t = window.performance.now() / 1000 % spec.cycle;
      const on = t > spec.telegraph && t < spec.telegraph + 1.4;
      jet.visible = on;
      jet.scale.setScalar(on ? 0.6 + 0.4 * Math.sin(t * 30) : 0.001);
    },
  };
}

/** 3 — shutter cycle: slab slams down, holds, rises; miss it -> duct detour. */
function shutterCycle(spec, segment, materials) {
  const group = new THREE.Group();
  const baseY = baseYOf(segment);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(TIERS.hall.widthMin, 6, 0.5), materials.frame);
  place(slab, segment, 0, baseY + 3, spec.z);
  group.add(slab);
  const data = { ...spec, volume: volumeAt(segment, spec.z, 5, baseY, baseY + 6, 0.4) };
  return {
    group,
    data,
    update() {
      const t = window.performance.now() / 1000 % spec.cycle;
      const down = t > spec.telegraph && t < spec.cycle - 2;
      slab.position.y = down ? baseY + 3 : baseY + 7.5;
    },
  };
}

/** 4 — crane sweep: container rides the hall rail across the route. */
function craneSweep(spec, segment, materials) {
  const group = new THREE.Group();
  const baseY = baseYOf(segment);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(20, 0.8, 1.2), materials.frame);
  place(beam, segment, 0, baseY + 9, spec.z);
  group.add(beam);
  const container = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.2, 5.5), materials.container);
  container.name = `${spec.id}-container`;
  place(container, segment, 0, baseY + 6, spec.z);
  group.add(container);
  const data = { ...spec, volume: volumeAt(segment, spec.z, 10, baseY, baseY + 8, 3) };
  return {
    group,
    data,
    update() {
      const t = window.performance.now() / 1000 % spec.cycle;
      const lateral = Math.sin((t / spec.cycle) * Math.PI * 2) * 8;
      if (segment.axis === 'z') container.position.x = segment.at + lateral;
      else container.position.z = segment.at + lateral;
    },
  };
}

/** 5 — electrified condensate pad: arc flicker on/off cycle. */
function electrifiedPad(spec, segment, materials) {
  const group = new THREE.Group();
  const baseY = baseYOf(segment);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 3), materials.trim);
  place(pad, segment, 0, baseY + 0.06, spec.z);
  group.add(pad);
  const arc = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.5, 0.1), materials.light);
  place(arc, segment, 0, baseY + 0.4, spec.z);
  group.add(arc);
  const data = { ...spec, volume: volumeAt(segment, spec.z, 2, baseY, baseY + 1, 1.5) };
  return {
    group,
    data,
    update() {
      const t = window.performance.now() / 1000 % spec.cycle;
      arc.visible = t > spec.telegraph && t < spec.cycle - 1 && Math.floor(t * 12) % 2 === 0;
    },
  };
}

/** 6 — collapsing planks: creak then drop ~0.8 s after the viewer steps on. */
function collapsingPlanks(spec, segment, materials) {
  const group = new THREE.Group();
  const baseY = baseYOf(segment);
  const planks = [];
  for (let i = 0; i < 8; i += 1) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(4, 0.18, 2), materials.catwalk);
    plank.name = `${spec.id}-plank-${i}`;
    place(plank, segment, 0, baseY - 0.09, spec.z - 14 + i * 4);
    group.add(plank);
    planks.push({ mesh: plank, timer: null, fallen: false, along: spec.z - 14 + i * 4 });
  }
  const data = { ...spec, volume: volumeAt(segment, spec.z, 2.2, baseY - 2, baseY + 1, 16) };
  return {
    group,
    data,
    update(delta, viewer) {
      if (!viewer?.position) return;
      for (const plank of planks) {
        if (plank.fallen) continue;
        const near =
          Math.abs(viewer.position.z - plank.along) < 1.2 &&
          Math.abs(viewer.position.x - segment.at) < 2.5 &&
          Math.abs(viewer.position.y - baseY) < 2;
        if (near && plank.timer === null) plank.timer = spec.telegraph; // creak
        if (plank.timer !== null) {
          plank.timer -= delta;
          plank.mesh.rotation.x = Math.sin(plank.timer * 40) * 0.02; // creak shiver
          if (plank.timer <= 0) {
            plank.fallen = true;
            plank.mesh.rotation.x = Math.PI / 2.2;
            plank.mesh.position.y = baseY - 4;
          }
        }
      }
    },
  };
}

/** 7 — fire/plasma vent: persistent damage field shaping a narrow safe line. */
function fireVent(spec, segment, materials) {
  const group = new THREE.Group();
  const baseY = baseYOf(segment);
  for (const lateral of [-3, -1.5, 1.5, 3]) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3.4, 6, 1, true), materials.fire);
    place(flame, segment, lateral, baseY + 1.7, spec.z);
    flame.name = `${spec.id}-flame-${lateral}`;
    group.add(flame);
  }
  const data = { ...spec, volume: volumeAt(segment, spec.z, 4.5, baseY, baseY + 3.4, 1.5), safeGap: 0.6 };
  return {
    group,
    data,
    update() {
      const t = window.performance.now() / 1000;
      group.children.forEach((flame, i) => {
        flame.scale.y = 0.85 + 0.15 * Math.sin(t * 9 + i * 1.7);
      });
    },
  };
}

/** 8 — AEGIS purge chase: a steam front advancing at frontSpeed once begun. */
function purgeChase(spec, segment, materials) {
  const group = new THREE.Group();
  const baseY = baseYOf(segment);
  const front = new THREE.Mesh(new THREE.BoxGeometry(TIERS.spine.width, TIERS.spine.height, 1.2), materials.steam);
  front.name = `${spec.id}-front`;
  place(front, segment, 0, baseY + TIERS.spine.height / 2, spec.z);
  front.visible = false;
  group.add(front);
  let begun = false;
  let along = spec.z;
  const data = { ...spec, volume: volumeAt(segment, spec.z, 4.5, baseY, baseY + TIERS.spine.height, 22) };
  return {
    group,
    data,
    begin() {
      begun = true;
      front.visible = true;
    },
    update(delta) {
      if (!begun) return;
      along -= spec.frontSpeed * delta;
      const end = spec.z - 45;
      if (along < end) {
        front.visible = false;
        return;
      }
      if (segment.axis === 'z') front.position.z = along;
      else front.position.x = along;
    },
  };
}

/** 9 — security beam grid: cycling lattice, alternating groups on/off. */
function beamGrid(spec, segment, materials) {
  const group = new THREE.Group();
  const baseY = baseYOf(segment);
  const beams = [];
  for (let i = 0; i < 6; i += 1) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.12, TIERS.spine.height - 1, 0.12), materials.warning);
    place(beam, segment, -3 + (i % 2) * 6, baseY + (TIERS.spine.height - 1) / 2, spec.z - 5 + i * 2);
    beam.name = `${spec.id}-beam-${i}`;
    group.add(beam);
    beams.push(beam);
  }
  const data = { ...spec, volume: volumeAt(segment, spec.z, 4, baseY, baseY + TIERS.spine.height, 6) };
  return {
    group,
    data,
    update() {
      const t = window.performance.now() / 1000 % spec.cycle;
      const phase = t < spec.cycle / 2 ? 0 : 1;
      beams.forEach((beam, i) => {
        beam.visible = i % 2 === phase;
      });
    },
  };
}

const FACTORIES = {
  'debris-fall': debrisFall,
  'steam-jet': steamJet,
  'shutter-cycle': shutterCycle,
  'crane-sweep': craneSweep,
  'electrified-pad': electrifiedPad,
  'collapsing-planks': collapsingPlanks,
  'fire-vent': fireVent,
  'purge-chase': purgeChase,
  'beam-grid': beamGrid,
};

/** Builds one hazard from its HAZARDS table entry. */
export function createHazard(spec, segment, materials) {
  const factory = FACTORIES[spec.type];
  if (!factory) throw new Error(`level3 hazards: unknown type ${spec.type}`);
  return factory(spec, segment, materials);
}
