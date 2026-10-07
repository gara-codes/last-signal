// dissolve-glitch.js — material factory for the dissolve/glitch-hologram shader.
//
// Usage (L2->L3 AI reveal):
//   const { material, animator } = createDissolveEffect('aiHologram');
//   mesh.material = material;
//   animator.setReduceFlashing(settings.reduceFlashing);
//   animator.reveal(1.6, () => startHostileLine());
//   // every frame: animator.update(delta);
//
// L3 Tier 2 pop-ins reuse the SAME material + animator: call reveal()/vanish()
// again at each scripted trigger. No new shader code needed.

import * as THREE from 'three';
import vertexShader from './dissolve-glitch.vert.glsl?raw';
import fragmentShader from './dissolve-glitch.frag.glsl?raw';
import { DissolveAnimator } from './dissolve-animator.js';

export { DissolveAnimator };

// `glitch` is both the material's starting glitch and the level reveal()
// settles to: one source of truth. `vanishGlitch` is where vanish() ends.
export const DISSOLVE_PRESETS = Object.freeze({
  aiHologram: {
    baseColor: '#ff2626', // matches HAL so the AI is recognisably the same entity
    edgeColor: '#ff7a1a', // saturated orange: reads as a burning edge against the red body
    progress: 1, // starts hidden; reveal() brings it in
    glitch: 0.6, // stays visibly corrupted once revealed
    vanishGlitch: 1, // breaks apart glitching
    hologram: 1,
  },
  debris: {
    baseColor: '#5a5f66',
    edgeColor: '#ff8a2a',
    progress: 0,
    glitch: 0, // clean metal: no banding, flicker or jitter
    vanishGlitch: 0, // dissolves cleanly
    hologram: 0,
  },
});

// Same raw-sRGB approach as emergency-lighting.js: the hex in is the colour on
// screen. A ShaderMaterial without Three's colorspace chunk writes its output
// straight to the canvas, so the numbers pass through unconverted.
function hexToShaderRGB(hex, target = new THREE.Color()) {
  const n = parseInt(hex.replace('#', ''), 16);
  return target.setRGB(
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
    THREE.LinearSRGBColorSpace // = "don't convert"
  );
}

/**
 * @param {object} [options] - a `preset` name and/or any of the cfg keys below
 * @returns {{ material: THREE.ShaderMaterial, uniforms: object }}
 */
export function createDissolveGlitchMaterial(options = {}) {
  const preset = options.preset ? DISSOLVE_PRESETS[options.preset] : null;
  if (options.preset && !preset) {
    console.warn(`[dissolve-glitch] unknown preset "${options.preset}", using defaults`);
  }
  const cfg = {
    baseColor: '#ff2626',
    edgeColor: '#ff8a2a',
    progress: 0,
    glitch: 0,
    hologram: 0,
    edgeWidth: 0.08,
    noiseScale: 8.0,
    jitter: 0.15,
    bandScale: 6.0,
    opacity: 1,
    ...preset,
    ...options,
  };

  const uniforms = {
    uProgress: { value: cfg.progress },
    uGlitch: { value: cfg.glitch },
    uTime: { value: 0 },
    uBaseColor: { value: hexToShaderRGB(cfg.baseColor) },
    uEdgeColor: { value: hexToShaderRGB(cfg.edgeColor) },
    uEdgeWidth: { value: cfg.edgeWidth },
    uNoiseScale: { value: cfg.noiseScale },
    uHologram: { value: cfg.hologram },
    uOpacity: { value: cfg.opacity },
    uJitter: { value: cfg.jitter },
    uBandScale: { value: cfg.bandScale },
  };

  const isHologram = cfg.hologram > 0;
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: isHologram,
    depthWrite: !isHologram, // holograms shouldn't hide what's behind them
    blending: isHologram ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: isHologram ? THREE.DoubleSide : THREE.FrontSide,
    toneMapped: false,
  });
  material.name = `dissolve-glitch-${options.preset ?? 'custom'}`;

  return { material, uniforms };
}

/**
 * Material + animator configured from one preset, so the glitch levels can't
 * drift apart between the two.
 * @param {keyof DISSOLVE_PRESETS} preset
 * @param {object} [options] - material overrides, plus `reduceFlashing`
 * @returns {{ material: THREE.ShaderMaterial, uniforms: object, animator: DissolveAnimator }}
 */
export function createDissolveEffect(preset, { reduceFlashing = false, ...options } = {}) {
  const p = DISSOLVE_PRESETS[preset];
  if (!p) throw new Error(`[dissolve-glitch] unknown preset "${preset}"`);
  const { material, uniforms } = createDissolveGlitchMaterial({ preset, ...options });
  const animator = new DissolveAnimator(uniforms, {
    settleGlitch: options.glitch ?? p.glitch,
    vanishGlitch: options.vanishGlitch ?? p.vanishGlitch,
    reduceFlashing,
  });
  return { material, uniforms, animator };
}
