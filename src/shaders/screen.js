// screen.js — animated console-screen material.
//
// Usage:
//   const clock = { value: 0 };                       // one clock for every screen
//   const mat = createScreenMaterial(canvasTexture, { clock, scroll: 0.05, seed: 0.3 });
//   // every frame: clock.value = (clock.value + delta) % 3600;
//
// Sharing one `clock` uniform object across all screens means one write per
// frame animates every console in the level.

import * as THREE from 'three';
import vertexShader from './screen.vert.glsl?raw';
import fragmentShader from './screen.frag.glsl?raw';

/**
 * @param {THREE.Texture | null} map - screen content (null in node tests)
 * @param {object} [options]
 * @param {{ value: number }} [options.clock] - shared time uniform
 * @param {number} [options.scroll] - screen-heights per second; 0 = still
 * @param {boolean} [options.blink] - status-block cell blinking
 * @param {number} [options.seed] - 0..1, de-syncs screens
 * @param {number} [options.intensity] - brightness multiplier
 * @param {string} [options.frameColor] - border glow (sRGB hex)
 */
export function createScreenMaterial(
  map,
  {
    clock = { value: 0 },
    scroll = 0.04,
    blink = false,
    seed = 0,
    intensity = 1,
    frameColor = '#1f4a63',
  } = {}
) {
  const uniforms = {
    uMap: { value: map },
    uTime: clock, // shared object, not a copy
    uSeed: { value: seed },
    uScroll: { value: scroll },
    uBlink: { value: blink ? 1 : 0 },
    uPower: { value: 1 },
    uIntensity: { value: intensity },
    uFrameColor: { value: new THREE.Color(frameColor) }, // sRGB hex -> linear
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    toneMapped: false, // screens are light sources: keep their colour
  });
  material.name = 'console-screen';
  return material;
}
