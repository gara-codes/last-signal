// src/core/LightingRigL3.js
//
// Level 3 (Docking Corridor) lighting — the locked dual-temperature identity:
//
//   INTERIOR / EMERGENCY — red emergency wash + white telegraph strobes. The
//   red is the level identity: hostile AEGIS, meltdown in progress. Strobes
//   arm on the 'telegraph' cue (6 Hz white blink at the rig's position) and
//   hard-cut to a debris-fire flash on 'collapse'.
//   EXTERIOR / STARLIGHT — cool blue-white pouring through every breach: a
//   shaft down the corridor at crown breaches, rim light at wounds, cold
//   pools at deck breaches.
//
// Plus the two global devices: ONE slow-rotating THREE.Points starfield so
// breaches render outer space instead of void, and near-black distance fog
// tuned to roughly one act of route for depth stacking and free culling of
// far geometry.
//
// PASS STATUS — Act 1 (the refit) is authored here. Acts 2–4 currently get
// only the base fill + the kit's emissive strips/props until their own
// passes; extend the per-act builders below one act at a time.
//
// The rig CONSUMES the level's cue channel (level.group.userData.lightingCues,
// appended by the collapse rigs as the viewer crosses triggers) and never
// feeds back into it. Mirrors LightingRigL2's shape: constructor / update /
// dispose; main.js constructs it right after createLevel3() and updates it
// per frame.
//
// Light units: three r155+ physical falloff (intensity / distance^2 with
// decay 2) under ACESFilmic exposure 1.3 — calibration follows the
// LightingRigL2 family, NOT L1's pre-physical intensities.

import * as THREE from 'three';
import { ACTS, ACT_BOUNDS } from '../levels/level3/level3-data.js';
import { createStarfield } from '../levels/level3/props3.js';

// ---- Global devices ---------------------------------------------------------
const STARFIELD_COUNT = 2500;
const STARFIELD_RADIUS = 900;

// Near-black fog. Linear (not exp2) so the spawn establishing shot stays
// readable; `far` ~= one act of route. Anything beyond ~150 u drowns
// regardless of act-band culling.
const FOG_COLOR = 0x030104;
const FOG_NEAR = 10;
const FOG_FAR = 150;
const BACKGROUND_COLOR = 0x010102;

// ---- Base fill: never pitch black, but close -------------------------------
const BASE_AMBIENT_COLOR = 0x200806;
const BASE_AMBIENT_INTENSITY = 2.2;
const BASE_HEMI_SKY = 0x38100a;
const BASE_HEMI_GROUND = 0x040202;
const BASE_HEMI_INTENSITY = 1.8;

// ---- Act 1 static lights (8: the locked 6 + 2 guide lights) -----------------
// role  id                  color     position           intensity distance
// pool  a1-red-pool-1       0xff2012  (0, 5.0, -14)      40        24
// pool  a1-red-pool-2       0xff2012  (0, 5.0, -32)      40        24
// pool  a1-red-pool-3       0xff2012  (0, 5.0, -44)      40        24
// work  a1-working-spawn    0xfff0d8  (0, 5.5,   3)      55        30  dies at first collapse
// wash  a1-cargo-wash       0xff2012  (0, 10.5, -60)     160       46
// guide a1-duct-guide       0xff8a3a  (0, 2.3, -82)      9         13  bypass crawl
// guide a1-terminus         0xff2012  (0, 3.8, -92.2)    26        20  kc1 door face + turn
// The two guides were added after the first visual pass: the duct bypass and
// the turn/terminus had no authored light at all (base fill only), which
// read as "the rest of the level is barely visible" once the hall sealed.
const RED = 0xff2012;
const ACT1_LIGHTS = [
  { id: 'a1-red-pool-1', color: RED, position: [0, 5.0, -14], intensity: 40, distance: 24 },
  { id: 'a1-red-pool-2', color: RED, position: [0, 5.0, -32], intensity: 40, distance: 24 },
  { id: 'a1-red-pool-3', color: RED, position: [0, 5.0, -44], intensity: 40, distance: 24 },
  { id: 'a1-working-spawn', color: 0xfff0d8, position: [0, 5.5, 3], intensity: 55, distance: 30, working: true },
  { id: 'a1-cargo-wash', color: RED, position: [0, 10.5, -60], intensity: 160, distance: 46 },
  { id: 'a1-duct-guide', color: 0xff8a3a, position: [0, 2.3, -82], intensity: 9, distance: 13 },
  { id: 'a1-terminus', color: RED, position: [0, 3.8, -92.2], intensity: 26, distance: 20 },
];
// The p1 crown pre-breach (z -18…-32) is its own device: a cool spot parked
// above the roof line pouring through the opening — Act 1's one exterior
// beat and its one shadow-caster (the torn rim/debris read in the beam).
const SHAFT_P1 = {
  id: 'a1-shaft-p1',
  color: 0xbdd2ff,
  position: [0, 12, -25],
  target: [0, 0, -25],
  intensity: 200,
  distance: 45,
  angle: 0.6,
  penumbra: 0.55,
};

// ---- Shadows (the hero shaft only, per budget) ------------------------------
const SHADOW_MAP_SIZE = 1024;
const SHADOW_NEAR = 2;
const SHADOW_BIAS = -0.002;
const SHADOW_NORMAL_BIAS = 0.05;

// ---- Telegraph strobe / collapse flash ---------------------------------------
const STROBE_COLOR = 0xfff6e8;
const STROBE_ON_INTENSITY = 220; // 6 Hz blink while a rig telegraphs
const STROBE_DISTANCE = 32;
const STROBE_TOGGLE_RATE = 12; // square-wave toggles per second (6 Hz on/off)
const FLASH_PEAK_INTENSITY = 340; // hard-cut debris-fire flash…
const FLASH_DECAY_SECONDS = 1.25; // …decaying over the collapse drop duration

// ---- Flicker (same value-noise family as L2, cheap + allocation-free) -------
const STEADY_DRIFT_DEPTH = 0.05;
const STEADY_DRIFT_RATE = 0.7;
const UNSTABLE_DEPTH = 0.85; // the working light once a telegraph begins
const UNSTABLE_RATE = 16;
const DEATH_FADE_SECONDS = 0.5; // white light dying after the first collapse
const SEED_STRIDE = 17.31;
const NOISE_HASH_X = 127.1;
const NOISE_HASH_SCALE = 43758.5453;

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

export class LightingRigL3 {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Group} levelGroup - level-3 group; userData.lightingCues is
   *   the cue channel this rig consumes.
   */
  constructor(scene, levelGroup) {
    this.scene = scene;
    this.levelGroup = levelGroup;
    this.cueCursor = 0;
    this.time = 0;

    this.lights = []; // every static light (flicker + dispose)
    this.seeds = [];
    this.baseIntensities = [];
    this.strobes = []; // transient telegraph/flash lights
    this.shaftTarget = null;
    this.workingLight = null; // the one white pocket — Act 1's "healthy" read
    this.telegraphSeen = false; // Act-1 arc: white pockets failing, red wins
    this.workingDying = false;
    this.deathElapsed = 0;

    // Strip any residual top-level fill from the level group (the blockout
    // used to ship a placeholder ambient/hemi/directional rig at this spot).
    for (const child of [...levelGroup.children]) {
      if (child.isAmbientLight || child.isHemisphereLight || child.isDirectionalLight) {
        levelGroup.remove(child);
      }
    }

    // Scene devices — saved and restored so teardown never leaks L3's
    // near-black world into another level loaded afterwards.
    this._priorFog = scene.fog ?? null;
    this._priorBackground = scene.background ?? null;
    scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);
    scene.background = new THREE.Color(BACKGROUND_COLOR);

    // Starfield: single Points sphere, slow rotation. material.fog=false is
    // mandatory — at r=900 every star would otherwise be fully fogged out
    // and breaches would read as void instead of space.
    this.starfield = createStarfield(STARFIELD_COUNT, STARFIELD_RADIUS);
    this.starfield.group.material.fog = false;
    scene.add(this.starfield.group);

    // Base fill: near-black with a red tilt (the identity floor).
    this.ambient = new THREE.AmbientLight(BASE_AMBIENT_COLOR, BASE_AMBIENT_INTENSITY);
    scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(BASE_HEMI_SKY, BASE_HEMI_GROUND, BASE_HEMI_INTENSITY);
    scene.add(this.hemi);

    // Act groups looked up by name so static lights ride act-band culling:
    // when the assembler hides act N, its lights go with it.
    this.actGroups = {};
    for (const child of levelGroup.children) {
      const m = /^act-(\d)$/.exec(child.name);
      if (m) this.actGroups[Number(m[1])] = child;
    }

    this.buildAct1Lights();
  }

  buildAct1Lights() {
    const act1 = this.actGroups[1] ?? this.levelGroup;
    for (const spec of ACT1_LIGHTS) {
      const light = new THREE.PointLight(spec.color, spec.intensity, spec.distance, 2);
      light.name = spec.id;
      light.position.set(...spec.position);
      act1.add(light);
      this.lights.push(light);
      this.seeds.push(this.lights.length * SEED_STRIDE);
      this.baseIntensities.push(spec.intensity);
      if (spec.working) this.workingLight = light;
    }

    // The p1 starlight shaft. Spot target is a separate Object3D that must be
    // parented into the same graph or the matrix never updates (three gotcha).
    const shaft = new THREE.SpotLight(
      SHAFT_P1.color, SHAFT_P1.intensity, SHAFT_P1.distance,
      SHAFT_P1.angle, SHAFT_P1.penumbra, 2
    );
    shaft.name = SHAFT_P1.id;
    shaft.position.set(...SHAFT_P1.position);
    shaft.target.position.set(...SHAFT_P1.target);
    shaft.castShadow = true;
    shaft.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    shaft.shadow.camera.near = SHADOW_NEAR;
    shaft.shadow.camera.far = SHAFT_P1.distance;
    shaft.shadow.bias = SHADOW_BIAS;
    shaft.shadow.normalBias = SHADOW_NORMAL_BIAS;
    act1.add(shaft, shaft.target);
    this.shaftTarget = shaft.target;
    this.lights.push(shaft);
    this.seeds.push(this.lights.length * SEED_STRIDE);
    this.baseIntensities.push(SHAFT_P1.intensity);
  }

  /** Cue position -> owning act group (fallback: the level group itself). */
  actGroupFor(position) {
    const [x, y, z] = position;
    for (const act of ACTS) {
      const b = ACT_BOUNDS[act];
      if (b && x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ &&
          y >= b.minY - 6 && y <= b.maxY + 6) {
        return this.actGroups[act] ?? this.levelGroup;
      }
    }
    return this.levelGroup;
  }

  update(delta) {
    this.time += delta;
    const t = this.time;

    // Drain the level's cue channel (collapse rigs append as triggers fire).
    const cues = this.levelGroup?.userData?.lightingCues;
    if (cues) {
      while (this.cueCursor < cues.length) {
        this.onCue(cues[this.cueCursor]);
        this.cueCursor += 1;
      }
    }

    this.starfield.update(delta);

    // Static-light flicker.
    for (let i = 0; i < this.lights.length; i++) {
      const light = this.lights[i];
      if (light === this.workingLight) {
        if (this.workingDying) {
          // Act-1 arc turn: AEGIS's first collapse kills the last white light.
          this.deathElapsed += delta;
          const k = Math.max(0, 1 - this.deathElapsed / DEATH_FADE_SECONDS);
          light.intensity = this.baseIntensities[i] * k * k;
          continue;
        }
        let factor = 1 + (smoothNoise(t * STEADY_DRIFT_RATE + this.seeds[i]) - 0.5) * 2 * STEADY_DRIFT_DEPTH;
        if (this.telegraphSeen) {
          factor *= 1 - UNSTABLE_DEPTH * smoothNoise(t * UNSTABLE_RATE + this.seeds[i]);
        }
        light.intensity = this.baseIntensities[i] * factor;
        continue;
      }
      const factor = 1 + (smoothNoise(t * STEADY_DRIFT_RATE + this.seeds[i]) - 0.5) * 2 * STEADY_DRIFT_DEPTH;
      light.intensity = this.baseIntensities[i] * factor;
    }

    // Transient strobes: 6 Hz telegraph blink, then the flash decay.
    for (let i = this.strobes.length - 1; i >= 0; i--) {
      const strobe = this.strobes[i];
      if (strobe.phase === 'telegraph') {
        strobe.light.visible = Math.floor(t * STROBE_TOGGLE_RATE) % 2 === 0;
        strobe.light.intensity = STROBE_ON_INTENSITY;
        continue;
      }
      strobe.elapsed += delta;
      const k = Math.max(0, 1 - strobe.elapsed / FLASH_DECAY_SECONDS);
      strobe.light.visible = true;
      strobe.light.intensity = FLASH_PEAK_INTENSITY * k * k;
      if (k <= 0) {
        strobe.light.removeFromParent();
        strobe.light.dispose?.();
        this.strobes.splice(i, 1);
      }
    }
  }

  /** Cue -> light mapping. Cues: { type, t, position:[x,y,z] }. */
  onCue(cue) {
    const position = Array.isArray(cue.position)
      ? cue.position
      : [cue.position.x, cue.position.y, cue.position.z];

    if (cue.type === 'telegraph') {
      // Arm a white strobe at the rig's position — blinks until 'collapse'.
      const light = new THREE.PointLight(STROBE_COLOR, 0, STROBE_DISTANCE, 2);
      light.name = 'strobe-telegraph';
      light.position.set(...position);
      this.actGroupFor(position).add(light);
      this.strobes.push({ light, phase: 'telegraph', elapsed: 0 });
      // Act-1 arc: the failing white pocket stutters hard once AEGIS begins.
      this.telegraphSeen = true;
      return;
    }

    if (cue.type === 'collapse') {
      // Every live telegraph strobe hard-cuts to the debris-fire flash…
      for (const strobe of this.strobes) {
        if (strobe.phase === 'telegraph') strobe.phase = 'flash';
      }
      // …and the ship's last working light dies. Red wins.
      this.workingDying = true;
      return;
    }

    // 'seal' — route closed behind. No authored Act-1 shaft to kill (the
    // scripted crown is not pre-lit); acts 2–4 map their breach shafts here.
    // 'checkpoint' / 'act' — not emitted by the blockout yet; future pass.
  }

  dispose() {
    for (const light of this.lights) {
      if (light.shadow?.map) light.shadow.map.dispose();
      light.removeFromParent();
      light.dispose?.();
    }
    this.lights.length = 0;
    this.shaftTarget?.removeFromParent();
    this.shaftTarget = null;
    for (const strobe of this.strobes) {
      strobe.light.removeFromParent();
      strobe.light.dispose?.();
    }
    this.strobes.length = 0;
    this.ambient.removeFromParent();
    this.ambient.dispose?.();
    this.hemi.removeFromParent();
    this.hemi.dispose?.();
    if (this.starfield) {
      this.scene.remove(this.starfield.group);
      this.starfield.group.geometry.dispose();
      this.starfield.group.material.dispose();
    }
    this.scene.fog = this._priorFog;
    this.scene.background = this._priorBackground;
  }
}
