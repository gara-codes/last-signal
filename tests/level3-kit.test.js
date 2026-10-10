// tests/level3-kit.test.js
//
// Data-level invariant: the movement envelope (from the untouched
// FlatPhysicsController) must fit inside every section tier, and the tiers
// must keep the locked camera-contract ratios. No renderer — pure constants.

import { describe, it, expect } from 'vitest';
import {
  ENVELOPE,
  TIERS,
  BOOM_CONTRACT,
  MAIN_Y,
  LOWER_Y,
  SLAB,
  LOWER_CLEAR,
  SEGMENTS,
} from '../src/levels/level3/level3-data.js';

describe('L3 movement envelope', () => {
  it('mandatory gap is jumpable at walk speed', () => {
    expect(ENVELOPE.gapMandatory).toBeLessThanOrEqual(ENVELOPE.walkSpeed * ENVELOPE.jumpAirtime);
  });
  it('skill gap is jumpable at run speed', () => {
    expect(ENVELOPE.gapSkill).toBeLessThanOrEqual(ENVELOPE.runSpeed * ENVELOPE.jumpAirtime);
  });
  it('walk < run and both positive', () => {
    expect(ENVELOPE.walkSpeed).toBeLessThan(ENVELOPE.runSpeed);
    expect(ENVELOPE.walkSpeed).toBeGreaterThan(0);
  });
});

describe('L3 section tiers vs envelope', () => {
  const tiers = ['spine', 'passage', 'duct'];
  for (const name of tiers) {
    it(`${name} clears the capsule height`, () => {
      expect(TIERS[name].height).toBeGreaterThanOrEqual(ENVELOPE.capsuleHeight);
    });
    it(`${name} is wider than the capsule diameter + min passage`, () => {
      expect(TIERS[name].width).toBeGreaterThanOrEqual(ENVELOPE.capsuleRadius * 2 + ENVELOPE.minPassage);
    });
  }

  it('hall tier bounds are ordered and above spine scale', () => {
    expect(TIERS.hall.widthMin).toBeLessThanOrEqual(TIERS.hall.widthMax);
    expect(TIERS.hall.heightMin).toBeLessThanOrEqual(TIERS.hall.heightMax);
    expect(TIERS.hall.widthMin).toBeGreaterThan(TIERS.spine.width);
  });

  it('tier widths descend spine > passage > duct (pacing instrument)', () => {
    expect(TIERS.spine.width).toBeGreaterThan(TIERS.passage.width);
    expect(TIERS.passage.width).toBeGreaterThan(TIERS.duct.width);
  });

  it('duct honours its own max-segment rule constant', () => {
    expect(TIERS.duct.maxSegment).toBe(15);
  });

  it('the 6u boom contract fits the narrowest walkable tier height', () => {
    expect(BOOM_CONTRACT).toBeLessThanOrEqual(TIERS.spine.height);
    expect(BOOM_CONTRACT).toBeGreaterThan(0);
  });
});

describe('L3 storey planes', () => {
  it('has exactly two planes 7u apart with a 6.4u lower clear height', () => {
    expect(MAIN_Y).toBe(0);
    expect(LOWER_Y).toBe(-7);
    expect(LOWER_CLEAR).toBeCloseTo(6.4, 5);
    expect(MAIN_Y - SLAB - LOWER_Y).toBeCloseTo(LOWER_CLEAR, 5);
  });
  it('lower clear height still clears the capsule', () => {
    expect(LOWER_CLEAR).toBeGreaterThanOrEqual(ENVELOPE.capsuleHeight);
  });
  it('every segment sits on one of the two planes', () => {
    for (const s of SEGMENTS) expect(['main', 'lower']).toContain(s.plane);
  });
});
