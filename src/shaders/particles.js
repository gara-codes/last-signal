// particles.js — GPU particle effects, one draw call each.
//
// Usage:
//   const dust = createParticles('dust', { box: [10, 6, 30] });
//   levelGroup.add(dust.points);
//   // every frame: dust.update(delta);
//   // teardown:    dust.dispose();
//
//   const sparks = createParticles('sparks', { position: [x, y, z] });
//
// Kinds (presets): dust (L1, drifting motes), steam (light wisps off vents,
// crates, machinery), haze (faint floor haze, one per room), sparks (L2
// damaged machinery), embers (L3 fires/breaches). Any preset value can be
// overridden in the options.
//
// Colours are THREE.Color, so hex strings are converted sRGB -> linear and the
// shader ends with Three's colour-space step: correct with or without post-fx.

import * as THREE from 'three';
import vertexShader from './particles.vert.glsl?raw';
import fragmentShader from './particles.frag.glsl?raw';

const TIME_WRAP = 3600;

export const PARTICLE_PRESETS = Object.freeze({
  dust: {
    mode: 'volume',
    count: 600,
    box: [10, 8, 10], // half-extents
    drift: [0.04, 0.02, 0.05],
    turbulence: 0.25,
    size: 0.05,
    sizeEnd: 1,
    colorStart: '#dfeeff',
    colorEnd: '#dfeeff',
    opacity: 0.35,
    hardness: 0.2,
    flicker: 0,
    blending: 'additive',
  },
  // A light wisp rising off a crate, vent or machine (tuned with Natasha on
  // the test page: reads as atmosphere, not fog). Add a few, not one per prop.
  steam: {
    mode: 'emitter',
    count: 70,
    life: 3.2,
    period: 3.2,
    burst: 0,
    velocity: [0, 1.0, 0],
    spread: [0.35, 0.3, 0.35],
    gravity: [0, 0.15, 0],
    turbulence: 0.6,
    emitRadius: 0.3,
    size: 0.6,
    sizeEnd: 3,
    colorStart: '#c9c2b6',
    colorEnd: '#6d6a66',
    opacity: 0.12,
    hardness: 0,
    flicker: 0,
    blending: 'normal',
  },
  // Faint haze rolling along the floor over a wide area. One per room.
  haze: {
    mode: 'emitter',
    count: 90,
    life: 6,
    period: 6,
    burst: 0,
    velocity: [0, 0.1, 0],
    spread: [0.4, 0.04, 0.4],
    gravity: [0, 0, 0],
    turbulence: 1.0,
    emitRadius: 3.5,
    size: 1.2,
    sizeEnd: 4,
    colorStart: '#c9c2b6',
    colorEnd: '#6d6a66',
    opacity: 0.05,
    hardness: 0,
    flicker: 0,
    blending: 'normal',
  },
  sparks: {
    mode: 'emitter',
    count: 90,
    life: 0.9,
    period: 2.4, // gaps between bursts
    burst: 0.92,
    velocity: [0, 2.2, 0],
    spread: [2.6, 1.6, 2.6],
    gravity: [0, -9.8, 0],
    turbulence: 0,
    emitRadius: 0.05,
    size: 0.14,
    sizeEnd: 0.4,
    colorStart: '#fff1c2',
    colorEnd: '#ff5a14',
    opacity: 1,
    hardness: 1,
    flicker: 0.3,
    blending: 'additive',
  },
  embers: {
    mode: 'emitter',
    count: 220,
    life: 4,
    period: 4,
    burst: 0,
    velocity: [0, 1.1, 0],
    spread: [0.5, 0.4, 0.5],
    gravity: [0, 0.2, 0],
    turbulence: 0.6,
    emitRadius: 1.5,
    size: 0.13,
    sizeEnd: 0.5,
    colorStart: '#ffb347',
    colorEnd: '#ff2a10',
    opacity: 0.9,
    hardness: 0.8,
    flicker: 0.8,
    blending: 'additive',
  },
});

// Small deterministic PRNG so a layout looks the same on every load
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Builds the particle geometry: spawn offsets + per-particle seeds. */
export function buildParticleGeometry(cfg, seed = 1) {
  const rand = mulberry32(seed);
  const positions = new Float32Array(cfg.count * 3);
  const seeds = new Float32Array(cfg.count * 4);
  for (let i = 0; i < cfg.count; i++) {
    if (cfg.mode === 'volume') {
      // Anywhere in the box
      for (let a = 0; a < 3; a++) positions[i * 3 + a] = (rand() * 2 - 1) * cfg.box[a];
    } else {
      // Inside a flat disc of emitRadius around the emitter (sqrt keeps it even)
      const r = Math.sqrt(rand()) * cfg.emitRadius;
      const theta = rand() * Math.PI * 2;
      positions[i * 3] = Math.cos(theta) * r;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = Math.sin(theta) * r;
    }
    for (let a = 0; a < 4; a++) seeds[i * 4 + a] = rand();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  // Positions move in the shader, so the CPU-side bounds would be wrong.
  // Give a sphere that covers everywhere a particle can reach.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), reachRadius(cfg));
  return geometry;
}

/** How far from the emitter a particle can get, for culling. */
export function reachRadius(cfg) {
  if (cfg.mode === 'volume') return Math.hypot(...cfg.box) + cfg.turbulence;
  const t = cfg.life;
  let reach = 0;
  for (let a = 0; a < 3; a++) {
    const v = Math.abs(cfg.velocity[a]) + Math.abs(cfg.spread[a]);
    reach = Math.max(reach, v * t + 0.5 * Math.abs(cfg.gravity[a]) * t * t);
  }
  return reach + cfg.emitRadius + cfg.turbulence + 1;
}

/**
 * @param {keyof PARTICLE_PRESETS} kind
 * @param {object} [options] - any preset key, plus `position` [x,y,z] and `seed`
 * @returns {{ points: THREE.Points, uniforms: object, update: (delta: number) => void,
 *   setScale: (screenHeightPx: number, fovDeg?: number) => void, dispose: () => void }}
 */
export function createParticles(kind, options = {}) {
  const preset = PARTICLE_PRESETS[kind];
  if (!preset) throw new Error(`[particles] unknown kind "${kind}"`);
  const cfg = { ...preset, ...options };
  const geometry = buildParticleGeometry(cfg, options.seed ?? 1);

  const uniforms = {
    uTime: { value: 0 },
    uMode: { value: cfg.mode === 'volume' ? 1 : 0 },
    uLife: { value: cfg.life ?? 1 },
    uPeriod: { value: Math.max(cfg.period ?? cfg.life ?? 1, cfg.life ?? 1) },
    uBurst: { value: cfg.burst ?? 0 },
    uVelocity: { value: new THREE.Vector3().fromArray(cfg.velocity ?? [0, 0, 0]) },
    uSpread: { value: new THREE.Vector3().fromArray(cfg.spread ?? [0, 0, 0]) },
    uGravity: { value: new THREE.Vector3().fromArray(cfg.gravity ?? [0, 0, 0]) },
    uTurbulence: { value: cfg.turbulence },
    uDrift: { value: new THREE.Vector3().fromArray(cfg.drift ?? [0, 0, 0]) },
    uBox: { value: new THREE.Vector3().fromArray(cfg.box ?? [1, 1, 1]) },
    uSize: { value: cfg.size },
    uSizeEnd: { value: cfg.sizeEnd },
    uScale: { value: 400 }, // replaced by setScale()
    uColorStart: { value: new THREE.Color(cfg.colorStart) },
    uColorEnd: { value: new THREE.Color(cfg.colorEnd) },
    uOpacity: { value: cfg.opacity },
    uHardness: { value: cfg.hardness },
    uFlicker: { value: cfg.flicker },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false, // particles mustn't hide each other or what's behind
    blending: cfg.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  material.name = `particles-${kind}`;

  const points = new THREE.Points(geometry, material);
  points.name = `particles-${kind}`;
  if (options.position) points.position.fromArray(options.position);

  let time = 0;
  return {
    points,
    uniforms,
    /** Advance the clock. Call every frame. Allocates nothing. */
    update(delta) {
      time = (time + delta) % TIME_WRAP;
      uniforms.uTime.value = time;
    },
    /**
     * Keep sizes in world units: call on resize with the canvas height in px
     * and the camera's vertical fov in degrees. A world-space size s at
     * distance z covers s / (2 z tan(fov/2)) of the screen height.
     */
    setScale(screenHeightPx, fovDeg = 75) {
      const halfFov = THREE.MathUtils.degToRad(fovDeg) / 2;
      uniforms.uScale.value = screenHeightPx / (2 * Math.tan(halfFov));
    },
    dispose() {
      points.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}
