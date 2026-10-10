// src/levels/level3/breaches.js
//
// The breach grammar: crown (ceiling gone), deck (floor gone), wound (full
// section gone — a railed bridge across open space) and the decorative
// viewport cracks. Plus the two time-based devices:
//
//   createCollapseRig() — a scripted, AEGIS-caused collapse with the locked
//   three-phase life: telegraph (3-5 s klaxon blink) -> eased collapse (the
//   existing bulkhead/debris animation style) -> seal-behind (a debris pile
//   scales in across the route, making the level forward-only). The rig is
//   fire-once: the assembler calls begin() when the viewer crosses the
//   trigger, and the rig reports phase changes through an onCue callback so
//   level.group.userData.lightingCues stays the single cue channel.
//
//   createCrackMotif() — the ONE escalating visual countdown: the pod-bay
//   window row accumulates hairline -> spiderweb -> starred fracture at act
//   boundaries. Pure material-state swaps, zero traversal impact.
//
// Blockout boundary: rigs animate and seal visually; nothing here damages,
// kills or drains. Fall volumes are exported data for the systems pass.

import * as THREE from 'three';
import { TIERS, CRACK_STATES } from './level3-data.js';

const COLLAPSE_SECONDS = 1.25; // matches the original blockout's eased drop
const SEAL_SECONDS = 0.6;

function ease(t) {
  return t * t * (3 - 2 * t); // smoothstep, same curve as the old bulkhead
}

function alongSpan(segment, span) {
  const half = span / 2;
  return [segment.axis === 'z' ? segment.at : segment.at, segment.from, segment.to, half];
}

/** Jagged torn-hull rim around an opening: rotated debris boxes, static. */
function tornRim(kit, segment, center, half, y, width, materialKey = 'debris') {
  const count = 6;
  for (let i = 0; i < count; i += 1) {
    const t = (i / (count - 1) - 0.5) * 2 * half;
    const lateral = (i % 2 === 0 ? -1 : 1) * (width / 2 - 0.4);
    const geometry = new THREE.BoxGeometry(1.4, 0.5, 1.1);
    const matrix = new THREE.Matrix4();
    const position =
      segment.axis === 'z'
        ? new THREE.Vector3(segment.at + lateral, y, center + t)
        : new THREE.Vector3(center + t, y, segment.at + lateral);
    const quaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(Math.random() * 0.5, Math.random() * 0.8, Math.random() * 0.5)
    );
    matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1));
    kit.addStatic(geometry, materialKey, matrix);
  }
}

/** Crown breach dressing: torn ceiling rim + half-dropped shutter + rubble. */
export function dressCrown(kit, segment, breach, materials, y) {
  const baseY = y ?? 0;
  const height = TIERS.spine.height;
  const [, , , half] = alongSpan(segment, breach.span);
  tornRim(kit, segment, breach.z, half, baseY + height, TIERS.spine.width);
  if (breach.shutter) {
    const shutter = new THREE.Mesh(new THREE.BoxGeometry(TIERS.spine.width - 1, 3.4, 0.3), materials.frame);
    shutter.name = `crown-shutter-${breach.id}`;
    shutter.position.set(segment.at, baseY + height - 1.7, breach.z);
    kit.addDynamic(shutter);
  }
  // Rubble ramp under the fall: a walkable mound within the step envelope.
  const rubble = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 3), materials.debris);
  rubble.name = `crown-rubble-${breach.id}`;
  rubble.position.set(segment.at + 2, baseY + 0.7, breach.z);
  rubble.rotation.y = 0.4;
  kit.addDynamic(rubble, {
    solid: {
      minX: segment.at + 0.5,
      maxX: segment.at + 3.5,
      minY: baseY,
      maxY: baseY + 1.4,
      minZ: breach.z - 1.5,
      maxZ: breach.z + 1.5,
    },
  });
}

/** Deck breach dressing: torn floor rim; the fall volume came from the kit. */
export function dressDeck(kit, segment, breach, materials, y) {
  const baseY = y ?? 0;
  const [, , , half] = alongSpan(segment, breach.span);
  tornRim(kit, segment, breach.z, half, baseY - 0.2, TIERS.spine.width);
  // Girder fragments left across the hole: the crossing puzzle.
  kit.girder(segment, breach.z - half + 2, breach.z + half - 2, baseY, -1.5);
}

/**
 * Wound: the full-section breach. No floor, no ceiling, one wall gone —
 * a railed catwalk bridge with edge beams and a 270-degree star panorama.
 * doubleScale (wound 2) widens the bridge and tallies the edge beams.
 */
export function woundSection(kit, segment, breach, materials, y) {
  const baseY = y ?? 0;
  const half = breach.span / 2;
  const width = breach.doubleScale ? 20 : 14;
  const height = breach.doubleScale ? 14 : 12;

  // The one surviving wall (side -1); side +1 is open to space.
  const length = breach.span;
  kit.addStatic(
    segment.axis === 'z' ? new THREE.BoxGeometry(0.6, height, length) : new THREE.BoxGeometry(length, height, 0.6),
    'frame',
    new THREE.Matrix4().makeTranslation(
      ...(segment.axis === 'z'
        ? [segment.at - width / 2, baseY + height / 2, breach.z]
        : [breach.z, baseY + height / 2, segment.at - width / 2])
    )
  );
  kit.addSolid(
    segment.axis === 'z'
      ? { minX: segment.at - width / 2 - 0.6, maxX: segment.at - width / 2, minY: baseY, maxY: baseY + height, minZ: breach.z - half, maxZ: breach.z + half }
      : { minX: breach.z - half, maxX: breach.z + half, minY: baseY, maxY: baseY + height, minZ: segment.at - width / 2 - 0.6, maxZ: segment.at - width / 2 },
    `wound-wall-${breach.id}`
  );

  // Edge beams both sides + torn rims; the open side registers the fall.
  for (const side of [-1, 1]) {
    const lateral = (side * width) / 2;
    kit.addStatic(
      segment.axis === 'z' ? new THREE.BoxGeometry(1, 1.2, length) : new THREE.BoxGeometry(length, 1.2, 1),
      'frame',
      new THREE.Matrix4().makeTranslation(
        ...(segment.axis === 'z' ? [segment.at + lateral, baseY - 0.6, breach.z] : [breach.z, baseY - 0.6, segment.at + lateral])
      )
    );
    tornRim(kit, segment, breach.z, half, baseY - 0.2, width);
  }
  kit.addFallVolume(
    segment.axis === 'z'
      ? { minX: segment.at - width / 2, maxX: segment.at + width / 2, minY: baseY - 30, maxY: baseY - 0.5, minZ: breach.z - half, maxZ: breach.z + half }
      : { minX: breach.z - half, maxX: breach.z + half, minY: baseY - 30, maxY: baseY - 0.5, minZ: segment.at - width / 2, maxZ: segment.at + width / 2 },
    `wound-fall-${breach.id}`
  );

  // The bridge itself: railed catwalk, narrower than the wound so the
  // panorama reads around it.
  kit.catwalk(segment, breach.z - half + 2, breach.z + half - 2, breach.doubleScale ? 6 : 4.2, baseY);
}

/** Decorative viewport breach: shattered panel + crack strips. */
export function viewportCrack(kit, segment, breach, materials, y) {
  const baseY = y ?? 0;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, breach.span), materials.glass);
  panel.name = `viewport-${breach.id}`;
  panel.position.set(segment.at - TIERS.passage.width / 2 + 0.3, baseY + 2.6, breach.z);
  if (segment.axis === 'x') panel.rotation.y = Math.PI / 2;
  kit.addDynamic(panel);
  for (let i = 0; i < 3; i += 1) {
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, breach.span * (0.3 + i * 0.2)), materials.warning);
    crack.name = `viewport-crack-${breach.id}-${i}`;
    crack.position.copy(panel.position);
    crack.position.y += 0.4 - i * 0.4;
    crack.rotation.z = (i - 1) * 0.2;
    if (segment.axis === 'x') crack.rotation.y = Math.PI / 2;
    kit.addDynamic(crack);
  }
}

/**
 * Scripted collapse rig. Phases: 'idle' -> 'telegraph' -> 'collapse' ->
 * 'sealed'. begin() starts the telegraph once; update(delta) walks the
 * phases; onCue(type, position) fires at each transition so the assembler
 * can push lightingCues without the rig knowing about the channel.
 */
export function createCollapseRig(breach, segment, materials, onCue = () => {}) {
  const group = new THREE.Group();
  group.name = `collapse-${breach.id}`;
  const baseY = segment.plane === 'lower' ? -7 : 0;
  const height = TIERS.spine.height;
  const at = (lateral, y, along) =>
    segment.axis === 'z'
      ? new THREE.Vector3(segment.at + lateral, y, along)
      : new THREE.Vector3(along, y, segment.at + lateral);

  const bulkhead = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 1.6), materials.debris);
  bulkhead.name = `bulkhead-${breach.id}`;
  bulkhead.position.copy(at(0, baseY + height, breach.z));
  group.add(bulkhead);

  const fallingDebris = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.6, 3.8), materials.debris);
  fallingDebris.name = `falling-debris-${breach.id}`;
  fallingDebris.position.copy(at(-1.4, baseY + height - 2, breach.z - 2));
  group.add(fallingDebris);

  // Seal-behind pile: invisible until the collapse lands, then scales in
  // across the route behind the player (forward-only, no backtracking).
  const seal = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 2.2), materials.debris);
  seal.name = `seal-${breach.id}`;
  seal.position.copy(at(0, baseY + 3, breach.z + 4));
  seal.scale.setScalar(0.001);
  group.add(seal);

  const klaxon = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), materials.warning);
  klaxon.name = `klaxon-${breach.id}`;
  klaxon.position.copy(at(4, baseY + 4, breach.z + 3));
  group.add(klaxon);

  const rig = {
    group,
    breach,
    phase: 'idle',
    elapsed: 0,
    begin() {
      if (rig.phase !== 'idle') return;
      rig.phase = 'telegraph';
      rig.elapsed = 0;
      onCue('telegraph', at(0, baseY + 3, breach.z));
    },
    update(delta) {
      if (rig.phase === 'idle' || rig.phase === 'sealed') return;
      rig.elapsed += delta;
      if (rig.phase === 'telegraph') {
        // Klaxon blink: square wave on the emissive-intensity-free scale cue.
        klaxon.visible = Math.floor(rig.elapsed * 6) % 2 === 0;
        if (rig.elapsed >= breach.telegraph) {
          rig.phase = 'collapse';
          rig.elapsed = 0;
          klaxon.visible = true;
          onCue('collapse', at(0, baseY + 3, breach.z));
        }
        return;
      }
      // collapse phase: the eased bulkhead/debris drop from the old blockout
      const progress = Math.min(1, rig.elapsed / COLLAPSE_SECONDS);
      const eased = ease(progress);
      bulkhead.position.y = THREE.MathUtils.lerp(baseY + height, baseY + 3.5, eased);
      fallingDebris.position.y = THREE.MathUtils.lerp(baseY + height - 2, baseY + 0.8, eased);
      if (progress >= 1) {
        rig.phase = 'seal';
        rig.elapsed = 0;
      }
      return;
    },
  };
  // Seal phase folded into update via a second check (keeps one entry point).
  const baseUpdate = rig.update;
  rig.update = (delta) => {
    baseUpdate(delta);
    if (rig.phase === 'seal') {
      rig.elapsed += delta;
      const t = Math.min(1, rig.elapsed / SEAL_SECONDS);
      seal.scale.setScalar(Math.max(0.001, ease(t)));
      if (t >= 1) {
        rig.phase = 'sealed';
        if (breach.sealBehind) onCue('seal', at(0, baseY + 3, breach.z + 4));
      }
    }
  };
  return rig;
}

/**
 * The growing-crack motif: a row of pod-bay windows with three stacked crack
 * overlay states. setState(0..2) reveals hairline -> spiderweb -> starred.
 */
export function createCrackMotif(materials, position, count = 4) {
  const group = new THREE.Group();
  group.name = 'growing-crack-motif';
  const overlays = [];
  for (let i = 0; i < count; i += 1) {
    const window = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.4, 3), materials.glass);
    window.name = `podbay-window-${i}`;
    window.position.set(0, 0, i * 3.4);
    group.add(window);
    const states = [];
    for (let s = 0; s < CRACK_STATES.length; s += 1) {
      const crack = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05 + s * 0.04, 1 + s * 0.8), materials.warning);
      crack.name = `crack-${i}-${CRACK_STATES[s]}`;
      crack.position.set(0.06, 0.5 - s * 0.5, i * 3.4);
      crack.rotation.z = s * 0.3;
      crack.visible = false;
      group.add(crack);
      states.push(crack);
    }
    overlays.push(states);
  }
  group.position.set(...position);
  return {
    group,
    setState(state) {
      for (const states of overlays) {
        states.forEach((crack, s) => {
          crack.visible = s <= state;
        });
      }
    },
  };
}
