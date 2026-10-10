// tests/level3-countdown.test.js
//
// The staged-reveal meltdown countdown: it arms ONLY at the Act 3 core-chamber
// boundary, freezes while the UI is up, and re-arms deterministically on a
// checkpoint replay/rebuild. Pure data — the counting logic is the systems pass.

import { describe, it, expect } from 'vitest';
import { COUNTDOWN, getSegment } from '../src/levels/level3/level3-data.js';

describe('L3 countdown arming point', () => {
  it('arms at Act 3 only', () => {
    expect(COUNTDOWN.armsAtAct).toBe(3);
    const seg = getSegment(COUNTDOWN.armsAtSegment);
    expect(seg).toBeTruthy();
    expect(seg.act).toBe(3);
  });
  it('does not arm during the environmental-dread acts (1-2)', () => {
    expect(COUNTDOWN.armsAtAct).toBeGreaterThan(2);
    // The DESIGN always declares acts 1 and 2 ahead of the arming act; the
    // ACTS build-scope knob may be narrowed during per-act cleanup passes.
    expect([1, 2, 3, 4].filter((a) => a < COUNTDOWN.armsAtAct)).toEqual([1, 2]);
  });
  it('arms on the AEGIS core-chamber screen segment', () => {
    expect(COUNTDOWN.armsAtSegment).toBe('a3-core');
  });
});

describe('L3 countdown tuning', () => {
  it('starts at ~9:00 for the remaining route', () => {
    expect(COUNTDOWN.seconds).toBe(540);
  });
});

describe('L3 countdown pause + replay determinism', () => {
  it('freezes while the UI is up (paused)', () => {
    expect(COUNTDOWN.pausesWithUi).toBe(true);
  });
  it('re-arms deterministically on checkpoint replay', () => {
    expect(COUNTDOWN.rearmsOnCheckpoint).toBe(true);
  });
  it('is frozen data, so every rebuild yields the identical clock', () => {
    expect(Object.isFrozen(COUNTDOWN)).toBe(true);
    // Re-importing the constant gives the same value (reset-on-rebuild is a
    // pure function of this frozen table — no per-instance drift).
    expect(COUNTDOWN.seconds).toBe(540);
    expect(COUNTDOWN.armsAtSegment).toBe('a3-core');
  });
});
