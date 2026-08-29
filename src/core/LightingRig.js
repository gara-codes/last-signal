// src/core/LightingRig.js
import * as THREE from 'three';

const L1_AMBIENT_COLOR = 0xcfe8ff;
const L1_AMBIENT_INTENSITY = 0.5;

const L1_HEMI_SKY_COLOR = 0xdfeeff;
const L1_HEMI_GROUND_COLOR = 0x8899aa;
const L1_HEMI_INTENSITY = 0.5;

const L1_STRIP_COLOR = 0xffffff;
const L1_STRIP_INTENSITY = 1.2;
const L1_STRIP_DISTANCE = 25;
const L1_STRIP_DECAY = 2;

const FLICKER_RADIUS = 8;

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
  }

updateProximityFlicker(playerPosition, aiWorldPosition, delta) {
    this.flickerTime += delta;
    const distance = playerPosition.distanceTo(aiWorldPosition);
    const isNear = distance < this.flickerRadius;

    if (isNear) {
      const ambientFlicker = Math.sin(this.flickerTime * 15) * 0.1 + Math.random() * 0.1;
      this.ambientLight.intensity = Math.max(0.1, this.baseAmbientIntensity - Math.abs(ambientFlicker));
    } else {
      this.ambientLight.intensity = this.baseAmbientIntensity;
    }

    this.stripLights.forEach((light, i) => {
      const base = this.baseIntensities[i];
      if (isNear) {
        const flicker = Math.sin(this.flickerTime * 20 + i * 3) * 0.5 + Math.random() * 0.3;
        light.intensity = Math.max(0.1, base + flicker);
      } else {
        light.intensity = base;
      }
    });
  }

  dispose() {
    this.scene.remove(this.ambientLight);
    this.scene.remove(this.hemiLight);
  }
}