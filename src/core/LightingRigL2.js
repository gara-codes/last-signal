// src/core/LightingRigL2.js
//
// L2 (Engineering Core) lighting pass — the "Warning" state. Amber emergency
// strips, dark and industrial, deliberately uneven: pools of light with
// shadow between them, NOT a dimmer copy of L1's even white/blue wash.
// Mirrors LightingRig's shape: constructor / update / dispose.
//
// Units: three r155+ uses physical light units (candela, decay 2), so a point
// light's contribution falls as intensity / distance². L1's 1.2 intensity is
// effectively negligible in those units (its look comes from ambient/hemi);
// the intensities below are calibrated for the real falloff instead.
import * as THREE from 'three';
import { CEILING_Y, DECK_Y, cellToWorld } from '../levels/level2/grid-data.js';

// ---- Palette ---------------------------------------------------------------
// Single source for the amber. Mirrors --state-warning in ui/theme.css
// (proposed in the Escalation Palette, not final).
const L2_STRIP_COLOR = 0xf2a93c;

const L2_AMBIENT_COLOR = 0x3b2a1a;
const L2_AMBIENT_INTENSITY = 2.5;

const L2_HEMI_SKY_COLOR = 0x4a3a2a;
const L2_HEMI_GROUND_COLOR = 0x15100a;
const L2_HEMI_INTENSITY = 2.0;

// ---- Strip lights ----------------------------------------------------------
// Rescaled with the ×1.5 hall (revision plan): distances ×1.5, candela ×2.25
// (1.5² — inverse-square falloff) so the calibrated look is preserved, not
// retuned. The amber identity itself is still Gara's pass to own.
const UPPER_INTENSITY = 101.25; // candela, lights hung under the ceiling
const GROUND_INTENSITY = 123.75; // candela, lights under the deck slab
// Point light `distance` is a cutoff window, not a hard edge: brightness is
// already ~35% of its inverse-square value at 0.8 * distance and zero at it.
export const LIGHT_DISTANCE = 39;
const LIGHT_DECAY = 2;

// Heights, derived from the blockout so they follow if the hall is resized.
const UPPER_DROP = 4.5; // upper lights hang this far below the ceiling
const GROUND_DROP = 2.25; // ground lights sit this far below the deck
const UPPER_LIGHT_Y = CEILING_Y - UPPER_DROP;
const GROUND_LIGHT_Y = DECK_Y - GROUND_DROP;

// ---- Shadows ---------------------------------------------------------------
const SHADOW_MAP_SIZE = 512;
const SHADOW_NEAR = 0.5;
const SHADOW_BIAS = -0.002;
const SHADOW_NORMAL_BIAS = 0.05;

// ---- Flicker ---------------------------------------------------------------
// Steady strips only breathe slightly; "unstable" strips drop out irregularly.
// All driven by smooth value noise, so there is no repeating pattern.
const STEADY_DRIFT_DEPTH = 0.04;
const STEADY_DRIFT_RATE = 0.7;
const UNSTABLE_DEPTH = 0.35;
const UNSTABLE_RATE = 6;
const DROPOUT_RATE = 1.3;
const DROPOUT_THRESHOLD = 0.8; // noise above this starts a dropout
const DROPOUT_FLOOR = 0.12; // deepest dip during a dropout
const STUTTER_RATE = 22;
const SEED_STRIDE = 17.31; // per-light offset into the noise field
const NOISE_HASH_X = 127.1;
const NOISE_HASH_SCALE = 43758.5453;

const WARNING_DEPTH = 0.75; // extra dimming while the warning cue plays
const WARNING_RATE = 14;

// ---- Layout ----------------------------------------------------------------
// Positions come from grid cells (fractional cells are fine) so the lights
// track the real maze. The hall is one open volume with a deck at DECK_Y and
// an atrium void, so lights are tiered: upper ones for the deck, ground ones
// under the slab for the floor beneath it. 10 point lights total.
//   unstable — irregular flicker      shadow — casts shadows (keep to 2)
export const L2_LIGHT_LAYOUT = [
  { id: 'atrium-high', tier: 'upper', col: 7.5, row: 3.5, shadow: true },
  { id: 'deck-south-west', tier: 'upper', col: 3, row: 8 },
  { id: 'deck-south-east', tier: 'upper', col: 11, row: 8 },
  { id: 'command-door', tier: 'upper', col: 1, row: 4, unstable: true },
  { id: 'deck-north-east', tier: 'upper', col: 14, row: 3 },
  { id: 'ground-south-west', tier: 'ground', col: 3, row: 9 },
  { id: 'ground-south-east', tier: 'ground', col: 11, row: 9, unstable: true },
  { id: 'ground-centre', tier: 'ground', col: 7.5, row: 3.5, shadow: true },
  { id: 'ground-oxygen-east', tier: 'ground', col: 13, row: 2.5 },
  { id: 'ground-west', tier: 'ground', col: 1, row: 3, unstable: true },
];

const TIER_SETTINGS = {
  upper: { y: UPPER_LIGHT_Y, intensity: UPPER_INTENSITY },
  ground: { y: GROUND_LIGHT_Y, intensity: GROUND_INTENSITY },
};

/** Level-local light position for a layout entry. */
export function resolveLightPosition(spec) {
  const { x, z } = cellToWorld(spec.col, spec.row);
  return { x, y: TIER_SETTINGS[spec.tier].y, z };
}

// Cheap deterministic hash noise — no allocation, safe inside update().
function hashNoise(n) {
  const s = Math.sin(n * NOISE_HASH_X) * NOISE_HASH_SCALE;
  return s - Math.floor(s);
}

function smoothNoise(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hashNoise(i) * (1 - u) + hashNoise(i + 1) * u;
}

// Walls, floors and decks live under the maze builder's 'l2-geometry' group;
// emissive meshes (glow strips) are excluded since they're thin and self-lit.
function isStructure(mesh) {
  const emissive = mesh.material && mesh.material.emissiveIntensity > 0 &&
    mesh.material.emissive && mesh.material.emissive.getHex() !== 0;
  if (emissive) return false;
  for (let o = mesh.parent; o; o = o.parent) {
    if (o.name === 'l2-geometry') return true;
  }
  return false;
}

export class LightingRigL2 {
  // levelGroup: pass level2.group; lights are parented to it (local coords).
  constructor(scene, levelGroup, config = {}) {
    this.scene = scene;
    this.levelGroup = levelGroup;
    this.stripLights = [];
    this.unstableFlags = [];
    this.seeds = [];
    this.time = 0;
    this.warningTimeRemaining = 0;
    this.powerLevel = 1;

    // The blockout ships its own bright placeholder ambient/hemisphere in the
    // level group; left in, they would wash out the whole pass. Removed at
    // runtime so src/levels stays untouched; dispose() does NOT restore them
    // (or the mesh shadow flags below), so the rig must live as long as the level.
    // Only direct children are checked — the blockout adds them at the top level.
    const placeholders = levelGroup.children.filter(
      (child) => child.isAmbientLight || child.isHemisphereLight
    );
    if (placeholders.length === 0) {
      console.warn('LightingRigL2: no placeholder fill lights found in level group to replace.');
    }
    placeholders.forEach((light) => levelGroup.remove(light));

    this.ambientLight = new THREE.AmbientLight(L2_AMBIENT_COLOR, L2_AMBIENT_INTENSITY);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(
      L2_HEMI_SKY_COLOR,
      L2_HEMI_GROUND_COLOR,
      L2_HEMI_INTENSITY
    );
    this.scene.add(this.hemiLight);

    const layout = config.lights ?? L2_LIGHT_LAYOUT;
    let anyShadow = false;
    layout.forEach((spec, i) => {
      const { intensity } = TIER_SETTINGS[spec.tier];
      const pos = resolveLightPosition(spec);
      const light = new THREE.PointLight(L2_STRIP_COLOR, intensity, LIGHT_DISTANCE, LIGHT_DECAY);
      light.name = `l2-light-${spec.id}`;
      light.position.set(pos.x, pos.y, pos.z);

      light.castShadow = Boolean(spec.shadow);
      if (light.castShadow) {
        anyShadow = true;
        light.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
        light.shadow.camera.near = SHADOW_NEAR;
        light.shadow.camera.far = LIGHT_DISTANCE;
        light.shadow.bias = SHADOW_BIAS;
        light.shadow.normalBias = SHADOW_NORMAL_BIAS;
      }

      levelGroup.add(light); // child of the level group, not the scene
      this.stripLights.push(light);
      this.unstableFlags.push(Boolean(spec.unstable));
      this.seeds.push(i * SEED_STRIDE);
    });

    // Shadows only do anything if the level's meshes opt in (the renderer
    // must also have shadowMap.enabled — main.js does that for L2). Every mesh
    // receives, but only structure casts: props and glow meshes casting would
    // add draw cost to each of the 12 shadow passes for little visual gain.
    if (anyShadow) {
      levelGroup.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.receiveShadow = true;
        obj.castShadow = isStructure(obj);
      });
    }

    this.baseIntensities = this.stripLights.map((light) => light.intensity);
  }

  update(delta) {
    this.time += delta;
    const t = this.time;
    const warning = this.warningTimeRemaining > 0;
    if (warning) this.warningTimeRemaining = Math.max(0, this.warningTimeRemaining - delta);

    for (let i = 0; i < this.stripLights.length; i++) {
      const seed = this.seeds[i];
      let factor;

      if (this.unstableFlags[i]) {
        factor = 1 - UNSTABLE_DEPTH * smoothNoise(t * UNSTABLE_RATE + seed);
        if (smoothNoise(t * DROPOUT_RATE + seed * 2.7) > DROPOUT_THRESHOLD) {
          factor *= DROPOUT_FLOOR + (1 - DROPOUT_FLOOR) * smoothNoise(t * STUTTER_RATE + seed * 5.1);
        }
      } else {
        factor = 1 + (smoothNoise(t * STEADY_DRIFT_RATE + seed) - 0.5) * 2 * STEADY_DRIFT_DEPTH;
      }

      if (warning) factor *= 1 - WARNING_DEPTH * smoothNoise(t * WARNING_RATE + seed * 1.9);

      this.stripLights[i].intensity = this.baseIntensities[i] * this.powerLevel * factor;
    }
  }

  // Telegraph cue (e.g. before the gravity snap-back): every strip flickers hard.
  triggerWarningFlicker(durationSeconds) {
    this.warningTimeRemaining = Math.max(0, durationSeconds);
  }

  // 0–1 power level scaling the strips; ambient/hemisphere stay put so the
  // hall never goes pitch black. Not wired to anything yet.
  setPowerLevel(level) {
    if (!Number.isFinite(level)) return; // NaN would zero every strip
    this.powerLevel = THREE.MathUtils.clamp(level, 0, 1);
  }

  dispose() {
    this.scene.remove(this.ambientLight);
    this.scene.remove(this.hemiLight);
    this.stripLights.forEach((light) => {
      if (light.parent) light.parent.remove(light);
      if (light.shadow && light.shadow.map) {
        light.shadow.map.dispose();
      }
    });
  }
}
