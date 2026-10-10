// tests/level3-breaches.test.js
//
// Breach-grammar invariants: exactly three wounds, a ~40% pre-breach share,
// every scripted collapse telegraphed 3-5 s, and the collapse rig is fire-once.
// The rig check imports THREE (headless geometry only — no GL context).

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { BREACHES, getSegment } from '../src/levels/level3/level3-data.js';
import { createCollapseRig } from '../src/levels/level3/breaches.js';

const materials = new Proxy({}, { get: () => new THREE.MeshBasicMaterial() });

describe('L3 breach grammar', () => {
  it('has exactly three wounds (W1 refit, W2 double-scale, W3 pod approach)', () => {
    const wounds = BREACHES.filter((b) => b.type === 'wound');
    expect(wounds).toHaveLength(3);
    expect(wounds.filter((w) => w.doubleScale)).toHaveLength(1); // W2 only
  });
  it('uses all four grammar types', () => {
    const types = new Set(BREACHES.map((b) => b.type));
    expect([...types].sort()).toEqual(['crown', 'deck', 'viewport', 'wound']);
  });
  it('every breach references a real segment and sits within its span', () => {
    for (const b of BREACHES) {
      const seg = getSegment(b.segment);
      expect(seg, `${b.id} segment`).toBeTruthy();
      const lo = Math.min(seg.from, seg.to);
      const hi = Math.max(seg.from, seg.to);
      expect(b.z).toBeGreaterThanOrEqual(lo);
      expect(b.z).toBeLessThanOrEqual(hi);
    }
  });
});

describe('L3 two-layer breach model', () => {
  it('is ~40% static pre-breaches visible from frame one', () => {
    const pre = BREACHES.filter((b) => !b.scripted).length;
    const ratio = pre / BREACHES.length;
    expect(ratio).toBeGreaterThan(0.3);
    expect(ratio).toBeLessThanOrEqual(0.5);
  });
  it('the rest are scripted, AEGIS-caused collapses', () => {
    const scripted = BREACHES.filter((b) => b.scripted);
    expect(scripted.length).toBeGreaterThan(BREACHES.filter((b) => !b.scripted).length);
  });
});

describe('L3 scripted collapse telegraphs', () => {
  it('every scripted collapse telegraphs for 3-5 s', () => {
    for (const b of BREACHES.filter((x) => x.scripted)) {
      expect(b.telegraph, `${b.id} telegraph`).toBeGreaterThanOrEqual(3);
      expect(b.telegraph).toBeLessThanOrEqual(5);
    }
  });
});

describe('L3 collapse rig is fire-once', () => {
  it('begin() starts the telegraph and ignores repeat calls', () => {
    const breach = BREACHES.find((b) => b.scripted && b.sealBehind);
    const seg = getSegment(breach.segment);
    const cues = [];
    const rig = createCollapseRig(breach, seg, materials, (type) => cues.push(type));
    expect(rig.phase).toBe('idle');
    rig.begin();
    expect(rig.phase).toBe('telegraph');
    rig.update(0.016);
    const elapsedAfterFirst = rig.elapsed;
    rig.begin(); // second call must be a no-op
    expect(rig.phase).toBe('telegraph');
    expect(rig.elapsed).toBe(elapsedAfterFirst);
    expect(cues).toContain('telegraph');
  });

  it('walks telegraph -> collapse -> seal -> sealed and emits cues', () => {
    const breach = BREACHES.find((b) => b.scripted && b.sealBehind);
    const seg = getSegment(breach.segment);
    const cues = [];
    const rig = createCollapseRig(breach, seg, materials, (type) => cues.push(type));
    rig.begin();
    // Drive well past telegraph + collapse + seal durations.
    for (let i = 0; i < 600; i += 1) rig.update(0.05);
    expect(rig.phase).toBe('sealed');
    expect(cues).toEqual(expect.arrayContaining(['telegraph', 'collapse', 'seal']));
  });
});
