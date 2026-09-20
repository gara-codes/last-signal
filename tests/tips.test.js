// tests/tips.test.js
import { describe, it, expect } from 'vitest';
import { TIPS, createTipPicker } from '../src/ui/tips.js';

describe('createTipPicker', () => {
  it('draws from the requested level pool', () => {
    const picker = createTipPicker({ random: () => 0 });
    expect(TIPS.l1).toContain(picker.next('l1'));
  });

  it('falls back to the generic pool for a level with no tips of its own', () => {
    const picker = createTipPicker({ random: () => 0 });
    expect(TIPS.generic).toContain(picker.next('l3'));
    expect(TIPS.generic).toContain(picker.next('nope'));
  });

  it('never repeats the previous tip when there is a choice', () => {
    const tips = { generic: ['x'], l1: ['a', 'b', 'c'] };
    // random() = 0 would pick index 0 every time if repeats were allowed.
    const picker = createTipPicker({ tips, random: () => 0 });
    let previous = picker.next('l1');
    for (let i = 0; i < 20; i++) {
      const next = picker.next('l1');
      expect(next).not.toBe(previous);
      previous = next;
    }
  });

  it('still returns something when a pool has a single tip', () => {
    const picker = createTipPicker({ tips: { generic: ['only'] }, random: () => 0.99 });
    expect(picker.next('l1')).toBe('only');
    expect(picker.next('l1')).toBe('only');
  });
});

describe('L1 tips', () => {
  it('has several, and none are the retired Level 2 line', () => {
    expect(TIPS.l1.length).toBeGreaterThanOrEqual(4);
    for (const tip of TIPS.l1) {
      expect(tip).not.toMatch(/beacon/i);
      expect(tip).not.toMatch(/repaired/i);
    }
  });

  it('carries no "Tip:" prefix (the screen adds it)', () => {
    for (const pool of Object.values(TIPS)) {
      for (const tip of pool) expect(tip).not.toMatch(/^tip:/i);
    }
  });
});
