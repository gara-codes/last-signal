// tests/fx-pipeline.test.js
//
// Phase 0 visual pipeline: grade shader presets + uniform contract, the
// FxState hooks other systems call (pulse / warp / stress / Reduce
// Flashing), and the GPU particle geometry + uniform contract.
// PostFx itself needs WebGL, so it's checked on a test page instead.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { createGradeShader, applyGradePreset, FX_PRESETS } from '../src/shaders/grade.js';
import { FxState } from '../src/core/fx-state.js';
import {
  createParticles,
  buildParticleGeometry,
  reachRadius,
  PARTICLE_PRESETS,
} from '../src/shaders/particles.js';

function declaredUniforms(file) {
  const src = readFileSync(new URL(`../src/shaders/${file}`, import.meta.url), 'utf8');
  return [...src.matchAll(/^\s*uniform\s+\w+\s+(\w+)\s*;/gm)].map((m) => m[1]);
}

function expectContract(jsNames, glslFiles) {
  const glsl = new Set(glslFiles.flatMap(declaredUniforms));
  for (const name of glsl) expect(jsNames).toContain(name);
  for (const name of jsNames) expect(glsl.has(name)).toBe(true);
}

const gradeUniforms = () => {
  const { uniforms } = createGradeShader();
  return uniforms;
};

describe('grade shader', () => {
  it('JS and GLSL agree on every uniform name', () => {
    expectContract(Object.keys(createGradeShader().uniforms), [
      'grade.vert.glsl',
      'grade.frag.glsl',
    ]);
  });

  it('has a preset per level, each escalating grit over the last', () => {
    expect(Object.keys(FX_PRESETS)).toEqual(['l1', 'l2', 'l3']);
    const { l1, l2, l3 } = FX_PRESETS;
    for (const key of ['vignette', 'grain', 'aberration', 'contrast']) {
      expect(l1[key]).toBeLessThan(l2[key]);
      expect(l2[key]).toBeLessThan(l3[key]);
    }
  });

  it('applies a preset in place without replacing uniform objects', () => {
    const u = gradeUniforms();
    const tint = u.uTint.value;
    applyGradePreset(u, 'l2');
    expect(u.uTint.value).toBe(tint);
    expect(u.uTint.value.toArray()).toEqual(FX_PRESETS.l2.tint);
    expect(u.uGrain.value).toBe(FX_PRESETS.l2.grain);
  });

  it('rejects an unknown preset', () => {
    expect(() => applyGradePreset(gradeUniforms(), 'l9')).toThrow(/unknown preset/);
  });
});

describe('FxState (gameplay hooks)', () => {
  it('pulse() decays to zero and keeps the strongest of overlapping hits', () => {
    const s = new FxState();
    const u = gradeUniforms();
    s.pulse(0.4);
    s.pulse(0.9);
    s.update(0, u);
    expect(u.uPulse.value).toBeCloseTo(0.9);
    s.update(1, u);
    expect(u.uPulse.value).toBe(0);
  });

  it('warp() starts strong and eases out over its duration', () => {
    const s = new FxState();
    const u = gradeUniforms();
    s.warp(1);
    s.update(0, u);
    expect(u.uWarp.value).toBeCloseTo(1);
    s.update(0.5, u);
    expect(u.uWarp.value).toBeCloseTo(0.25); // (0.5)^2
    s.update(0.5, u);
    expect(u.uWarp.value).toBe(0);
  });

  it('setStress() eases toward its target, clamps, and ignores NaN', () => {
    const s = new FxState();
    const u = gradeUniforms();
    s.setStress(5);
    for (let i = 0; i < 300; i++) s.update(1 / 60, u);
    expect(u.uStress.value).toBeCloseTo(1, 2);
    s.setStress(NaN);
    s.update(1 / 60, u);
    expect(u.uStress.value).toBeCloseTo(1, 2);
  });

  it('Reduce Flashing scales pulses and warps down, but keeps the cue', () => {
    const s = new FxState();
    const u = gradeUniforms();
    s.setReduceFlashing(true);
    s.pulse(1);
    s.warp(1);
    s.update(0, u);
    expect(u.uPulse.value).toBeGreaterThan(0);
    expect(u.uPulse.value).toBeLessThan(0.5);
    expect(u.uWarp.value).toBeGreaterThan(0);
    expect(u.uWarp.value).toBeLessThan(0.5);
  });

  it('wraps its clock', () => {
    const s = new FxState();
    const u = gradeUniforms();
    s.update(3600.5, u);
    expect(u.uTime.value).toBeCloseTo(0.5);
  });
});

describe('particles', () => {
  it('JS and GLSL agree on every uniform name', () => {
    const fx = createParticles('sparks');
    expectContract(Object.keys(fx.uniforms), ['particles.vert.glsl', 'particles.frag.glsl']);
    fx.dispose();
  });

  it('builds one position + seed per particle for every kind', () => {
    for (const [kind, cfg] of Object.entries(PARTICLE_PRESETS)) {
      const g = buildParticleGeometry(cfg);
      expect(g.attributes.position.count, kind).toBe(cfg.count);
      expect(g.attributes.aSeed.itemSize).toBe(4);
      expect(g.boundingSphere.radius).toBeGreaterThan(0);
      g.dispose();
    }
  });

  it('keeps volume particles inside the box and emitter spawns on the disc', () => {
    const dust = buildParticleGeometry(PARTICLE_PRESETS.dust);
    const p = dust.attributes.position;
    for (let i = 0; i < p.count; i++) {
      expect(Math.abs(p.getX(i))).toBeLessThanOrEqual(PARTICLE_PRESETS.dust.box[0]);
      expect(Math.abs(p.getY(i))).toBeLessThanOrEqual(PARTICLE_PRESETS.dust.box[1]);
    }
    const steam = buildParticleGeometry(PARTICLE_PRESETS.steam).attributes.position;
    for (let i = 0; i < steam.count; i++) {
      expect(Math.hypot(steam.getX(i), steam.getZ(i))).toBeLessThanOrEqual(
        PARTICLE_PRESETS.steam.emitRadius + 1e-6
      );
    }
  });

  it('culling sphere covers the furthest a spark can fly', () => {
    const cfg = PARTICLE_PRESETS.sparks;
    // Worst case straight down: |v| + spread, plus gravity over a full life
    const fall =
      (cfg.spread[1] + Math.abs(cfg.velocity[1])) * cfg.life + 0.5 * 9.8 * cfg.life * cfg.life;
    expect(reachRadius(cfg)).toBeGreaterThan(fall);
  });

  it('is deterministic for a given seed', () => {
    const a = buildParticleGeometry(PARTICLE_PRESETS.embers, 7).attributes.aSeed.array;
    const b = buildParticleGeometry(PARTICLE_PRESETS.embers, 7).attributes.aSeed.array;
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('update() advances and wraps the clock; options override presets', () => {
    const fx = createParticles('steam', { opacity: 0.5, position: [1, 2, 3] });
    expect(fx.uniforms.uOpacity.value).toBe(0.5);
    expect(fx.points.position.toArray()).toEqual([1, 2, 3]);
    fx.update(3600.25);
    expect(fx.uniforms.uTime.value).toBeCloseTo(0.25);
    fx.dispose();
  });

  it('rejects an unknown kind', () => {
    expect(() => createParticles('confetti')).toThrow(/unknown kind/);
  });

  // Approved on the test page: light wisps, not fog. Guard against drifting back.
  it('keeps steam light: few particles, low opacity', () => {
    const { steam } = PARTICLE_PRESETS;
    expect(steam.count).toBeLessThanOrEqual(80);
    expect(steam.opacity).toBeLessThanOrEqual(0.15);
  });

  it('keeps haze faint and low along the floor', () => {
    const { haze } = PARTICLE_PRESETS;
    expect(haze.opacity).toBeLessThanOrEqual(0.06);
    // Highest a haze particle can climb over its life (no gravity)
    const rise = (haze.velocity[1] + haze.spread[1]) * haze.life;
    expect(rise).toBeLessThan(1.5); // stays below roughly knee-to-waist height
    expect(haze.emitRadius).toBeGreaterThan(PARTICLE_PRESETS.steam.emitRadius * 5); // wide, not a column
  });
});
