// tests/dissolve-glitch.test.js
//
// DissolveAnimator timing/state, plus a uniform-name contract between the
// GLSL files and the JS factory. GLSL doesn't error on a uniform the JS never
// sets (or sets under another name): it just reads 0 forever, silently. The
// contract test turns that class of bug into a failing test.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { DissolveAnimator } from '../src/shaders/dissolve-animator.js';
import { createDissolveGlitchMaterial, DISSOLVE_PRESETS } from '../src/shaders/dissolve-glitch.js';

const uniformsFor = (progress = 0, glitch = 0) => ({
  uProgress: { value: progress },
  uGlitch: { value: glitch },
  uTime: { value: 0 },
});

function declaredUniforms(file) {
  const src = readFileSync(new URL(`../src/shaders/${file}`, import.meta.url), 'utf8');
  return [...src.matchAll(/^\s*uniform\s+\w+\s+(\w+)\s*;/gm)].map((m) => m[1]);
}

describe('dissolve-glitch uniform contract', () => {
  const { uniforms } = createDissolveGlitchMaterial({ preset: 'aiHologram' });
  const jsNames = Object.keys(uniforms);

  it('sets every uniform the shaders declare', () => {
    for (const file of ['dissolve-glitch.vert.glsl', 'dissolve-glitch.frag.glsl']) {
      for (const name of declaredUniforms(file)) expect(jsNames).toContain(name);
    }
  });

  it('declares every uniform the JS sets in at least one shader', () => {
    const glsl = new Set([
      ...declaredUniforms('dissolve-glitch.vert.glsl'),
      ...declaredUniforms('dissolve-glitch.frag.glsl'),
    ]);
    for (const name of jsNames) expect(glsl.has(name)).toBe(true);
  });

  it('exposes uProgress, as GAME-25 specifies', () => {
    expect(uniforms.uProgress.value).toBe(DISSOLVE_PRESETS.aiHologram.progress);
  });

  it('makes holograms transparent and debris opaque', () => {
    expect(createDissolveGlitchMaterial({ preset: 'aiHologram' }).material.transparent).toBe(true);
    expect(createDissolveGlitchMaterial({ preset: 'debris' }).material.transparent).toBe(false);
  });
});

describe('DissolveAnimator', () => {
  it('reveal() runs uProgress 1 -> 0 and settles glitch', () => {
    const u = uniformsFor(0, 0);
    const a = new DissolveAnimator(u, { settleGlitch: 0.6 });
    a.reveal(1);
    expect(u.uProgress.value).toBe(1); // restarts fully dissolved
    expect(u.uGlitch.value).toBe(1);
    a.update(0.5);
    expect(u.uProgress.value).toBeCloseTo(0.5); // smoothstep midpoint
    a.update(0.5);
    expect(u.uProgress.value).toBe(0);
    expect(u.uGlitch.value).toBeCloseTo(0.6);
    expect(a.isPlaying).toBe(false);
  });

  it('vanish() runs from the current state to fully gone', () => {
    const u = uniformsFor(0, 0.6);
    const a = new DissolveAnimator(u);
    a.vanish(2);
    a.update(1);
    expect(u.uProgress.value).toBeCloseTo(0.5);
    a.update(1);
    expect(u.uProgress.value).toBe(1);
    expect(u.uGlitch.value).toBe(1);
  });

  it('fires onComplete exactly once', () => {
    const done = vi.fn();
    const a = new DissolveAnimator(uniformsFor());
    a.reveal(0.2, done);
    for (let i = 0; i < 10; i++) a.update(0.1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('lets onComplete chain the next animation (Tier 2 pop-in: reveal, then vanish)', () => {
    const u = uniformsFor();
    const a = new DissolveAnimator(u);
    a.reveal(0.5, () => a.vanish(0.5));
    a.update(0.5); // reveal ends, vanish starts
    expect(a.isPlaying).toBe(true);
    a.update(0.5);
    expect(u.uProgress.value).toBe(1);
    expect(a.isPlaying).toBe(false);
  });

  it('re-triggered reveal() restarts from fully dissolved, no reset needed', () => {
    const u = uniformsFor();
    const a = new DissolveAnimator(u);
    a.reveal(1);
    a.update(1);
    a.reveal(1);
    expect(u.uProgress.value).toBe(1);
  });

  it('keeps uTime running and wraps it', () => {
    const u = uniformsFor();
    const a = new DissolveAnimator(u);
    a.update(0.25);
    expect(u.uTime.value).toBeCloseTo(0.25);
    a.update(3600);
    expect(u.uTime.value).toBeCloseTo(0.25);
  });

  it('survives a zero-length duration', () => {
    const u = uniformsFor();
    const a = new DissolveAnimator(u);
    a.reveal(0);
    a.update(0.016);
    expect(u.uProgress.value).toBe(0);
    expect(Number.isFinite(u.uGlitch.value)).toBe(true);
  });
});
