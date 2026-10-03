// src/core/LightingRig.js
import * as THREE from 'three';

const L1_AMBIENT_COLOR = 0xcfe8ff;
const L1_AMBIENT_INTENSITY = 0.9;

const L1_HEMI_SKY_COLOR = 0xdfeeff;
const L1_HEMI_GROUND_COLOR = 0x8899aa;
const L1_HEMI_INTENSITY = 0.9;

const L1_STRIP_COLOR = 0xffffff;
const L1_STRIP_INTENSITY = 2.2;
// Raised from 25 so the falloff cutoff comfortably reaches the center pillar
// (~28-29 units from a ring light at radius=28) instead of leaving it lit by
// ambient/hemisphere fill only. `distance` is a hard cutoff, not part of the
// decay curve, so this doesn't affect brightness near the lights.
const L1_STRIP_DISTANCE = 32;
const L1_STRIP_DECAY = 2;

const FLICKER_RADIUS = 8;
// Flicker swing is a fraction of each light's base intensity, so the effect
// keeps the same relative strength if the base values are retuned.
const AMBIENT_FLICKER_SWING = 0.2;
const AMBIENT_FLICKER_NOISE = 0.2;
const STRIP_FLICKER_SWING = 0.4;
const STRIP_FLICKER_NOISE = 0.25;

export class LightingRig {
  // levelGroup: pass level1.group so lights inherit its rotation/transform
  constructor(scene, levelGroup, ringConfig = { lightCount: 8, radius: 28, ceilingHeight: 8 }) {
    this.scene = scene;
    this.stripLights = [];
    this.flickerTime = 0;
    this.flickerRadius = FLICKER_RADIUS;

    // Non-positional lights are unaffected by rotation — fine on scene directly
    this.ambientLight = new THREE.AmbientLight(L1_AMBIENT_COLOR, L1_AMBIENT_INTENSITY);
    this.baseAmbientIntensity = L1_AMBIENT_INTENSITY; 
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(
      L1_HEMI_SKY_COLOR,
      L1_HEMI_GROUND_COLOR,
      L1_HEMI_INTENSITY
    );
    this.scene.add(this.hemiLight);

    // Point lights placed in the LEVEL's local coordinate space, added as
    // children of levelGroup so they automatically follow its rotation —
    // fixes lights being placed using guessed world coords that didn't
    // match the actual rotated ring geometry.
    const { lightCount, radius, ceilingHeight } = ringConfig;
    for (let i = 0; i < lightCount; i++) {
      const angle = (i / lightCount) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const light = new THREE.PointLight(
        L1_STRIP_COLOR,
        L1_STRIP_INTENSITY,
        L1_STRIP_DISTANCE,
        L1_STRIP_DECAY
      );
      light.position.set(x, ceilingHeight, z);

      light.castShadow = i % 3 === 0;
      if (light.castShadow) {
        light.shadow.mapSize.set(512, 512);
      }

      levelGroup.add(light); // <-- child of the level group, not the scene
      this.stripLights.push(light);
    }

    this.baseIntensities = this.stripLights.map((light) => light.intensity);

    // One-shot power dip — e.g. the L1->L2 transition beat, door power
    // rerouting. Inactive (_dipTimer <= 0) until triggerPowerDip() is
    // called; when active it overrides updateProximityFlicker's writes,
    // so call updatePowerDip() after it each frame.
    this._dipTimer = 0;
    this._dipDuration = 0;
  }

  /** Starts a power dip: quick drop, brief near-dark hold, eased recovery. */
  triggerPowerDip(duration = 1.5) {
    this._dipTimer = duration;
    this._dipDuration = duration;
  }

  updatePowerDip(delta) {
    if (this._dipTimer <= 0) return;
    this._dipTimer = Math.max(0, this._dipTimer - delta);

    const u = 1 - this._dipTimer / this._dipDuration; // 0 -> 1 as the dip plays out
    const dipFactor = 1 - 0.85 * Math.sin(Math.PI * u); // 1 -> ~0.15 (mid) -> 1

    this.ambientLight.intensity = this.baseAmbientIntensity * dipFactor;
    this.hemiLight.intensity = L1_HEMI_INTENSITY * dipFactor;
    this.stripLights.forEach((light, i) => {
      light.intensity = this.baseIntensities[i] * dipFactor;
    });
  }

updateProximityFlicker(playerPosition, aiWorldPosition, delta) {
    if (this._dipTimer > 0) return; // power dip owns the lights while active
    this.flickerTime += delta;
    const distance = playerPosition.distanceTo(aiWorldPosition);
    const isNear = distance < this.flickerRadius;

    if (isNear) {
      const ambientFlicker = (Math.sin(this.flickerTime * 15) * AMBIENT_FLICKER_SWING +
          Math.random() * AMBIENT_FLICKER_NOISE) *
        this.baseAmbientIntensity;
      this.ambientLight.intensity = Math.max(0.1, this.baseAmbientIntensity - Math.abs(ambientFlicker));
    } else {
      this.ambientLight.intensity = this.baseAmbientIntensity;
    }

    this.stripLights.forEach((light, i) => {
      const base = this.baseIntensities[i];
      if (isNear) {
        const flicker = (Math.sin(this.flickerTime * 20 + i * 3) * STRIP_FLICKER_SWING +
          Math.random() * STRIP_FLICKER_NOISE) *
        base;
        light.intensity = Math.max(0.1, base + flicker);
      } else {
        light.intensity = base;
      }
    });
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