// post-fx.js
//
// The post-processing pipeline:
//
//   RenderPass -> GTAOPass (ambient occlusion) -> UnrealBloomPass -> grade -> OutputPass
//
// OutputPass applies the renderer's tone mapping (ACES) and sRGB conversion,
// so everything before it works in linear HDR. The composer's targets use
// 4x MSAA, because the renderer's own `antialias: true` no longer applies
// once rendering goes through a composer (Shannon's review on #14).
//
// Phase 0: this module is standalone and not wired into main.js yet. Wiring
// (Phase 1) replaces `renderer.render(scene, camera)` with `postFx.render(delta)`
// in both render calls, and calls `postFx.setSize()` from the resize handler.
//
// Gameplay hooks, all safe to call every frame:
//   postFx.pulse(0.6)       alarm / damage / AI lock-on
//   postFx.warp(0.8)        gravity snap-back telegraph, L3 gravity flip
//   postFx.setStress(0.7)   low oxygen, countdown running out
//
// Quality: 'high' (AO full res), 'medium' (AO half res), 'low' (no AO, softer bloom).

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createGradeShader, applyGradePreset, FX_PRESETS } from '../shaders/grade.js';
import { FxState } from './fx-state.js';

const MSAA_SAMPLES = 4;
const AO_SCALE = { high: 1, medium: 0.5, low: 0 };
const LOW_BLOOM_SCALE = 0.6;

export class PostFx {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   * @param {object} [options]
   * @param {keyof FX_PRESETS} [options.preset] - 'l1' | 'l2' | 'l3'
   * @param {'high' | 'medium' | 'low'} [options.quality]
   */
  constructor(renderer, scene, camera, { preset = 'l1', quality = 'high' } = {}) {
    this.renderer = renderer;
    this.state = new FxState();
    this.quality = quality;
    this.presetName = preset;

    const size = renderer.getSize(new THREE.Vector2());
    this._size = size;
    const pixelRatio = renderer.getPixelRatio();
    const target = new THREE.WebGLRenderTarget(size.x * pixelRatio, size.y * pixelRatio, {
      type: THREE.HalfFloatType, // HDR: bright emissives can exceed 1 for bloom
      samples: MSAA_SAMPLES,
    });
    this.composer = new EffectComposer(renderer, target);

    this.renderPass = new RenderPass(scene, camera);
    this.aoPass = new GTAOPass(scene, camera, size.x, size.y);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 1, 0.4, 0.85);
    this.gradePass = new ShaderPass(createGradeShader());
    this.outputPass = new OutputPass();

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.aoPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.gradePass);
    this.composer.addPass(this.outputPass);

    this.setPreset(preset);
    this.setSize(size.x, size.y);
  }

  /** Switch the whole look: grade, bloom and AO. Call on a level change. */
  setPreset(name) {
    const p = applyGradePreset(this.gradePass.uniforms, name);
    this.presetName = name;
    const bloomScale = this.quality === 'low' ? LOW_BLOOM_SCALE : 1;
    this.bloomPass.strength = p.bloom.strength * bloomScale;
    this.bloomPass.radius = p.bloom.radius;
    this.bloomPass.threshold = p.bloom.threshold;
    this.aoPass.blendIntensity = p.ao.intensity;
    this.aoPass.enabled = p.ao.enabled && AO_SCALE[this.quality] > 0;
  }

  setQuality(quality) {
    if (!(quality in AO_SCALE)) return;
    this.quality = quality;
    this.setPreset(this.presetName);
    this.setSize(this._size.x, this._size.y);
  }

  /** Swap the scene/camera, e.g. after a level reload. */
  setView(scene, camera) {
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.aoPass.scene = scene;
    this.aoPass.camera = camera;
  }

  setSize(width, height) {
    this._size.set(width, height);
    this.composer.setSize(width, height);
    const ao = AO_SCALE[this.quality] || 0.5;
    this.aoPass.setSize(Math.max(1, width * ao), Math.max(1, height * ao));
    this.gradePass.uniforms.uResolution.value.set(width, height);
  }

  pulse(amount) {
    this.state.pulse(amount);
  }

  warp(duration) {
    this.state.warp(duration);
  }

  setStress(value) {
    this.state.setStress(value);
  }

  setReduceFlashing(on) {
    this.state.setReduceFlashing(on);
  }

  /** Replaces renderer.render(scene, camera). */
  render(delta) {
    this.state.update(delta, this.gradePass.uniforms);
    this.composer.render(delta);
  }

  dispose() {
    this.aoPass.dispose();
    this.bloomPass.dispose();
    this.gradePass.material.dispose();
    this.outputPass.dispose();
    this.composer.dispose();
  }
}

export { FX_PRESETS };
