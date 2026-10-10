// tests/level3-carryover.test.js
//
// The three L2 repair booleans carried into L3 as build-time multipliers
// (zero route branches), plus the unspent-L2-fuel -> O2-reserve conversion.

import { describe, it, expect } from 'vitest';
import { CARRYOVER } from '../src/levels/level3/level3-data.js';

describe('L3 carry-over: exactly three repair booleans', () => {
  it('carries oxygen, gravity and comms — and nothing else', () => {
    expect(Object.keys(CARRYOVER).sort()).toEqual(['comms', 'fuelToO2', 'gravity', 'oxygen']);
  });
});

describe('L3 oxygen repair multiplier', () => {
  it('halves vacuum drain when O2 was repaired in L2', () => {
    expect(CARRYOVER.oxygen.vacuumDrainMultiplier).toBe(0.5);
  });
});

describe('L3 gravity repair multipliers', () => {
  it('extends telegraph windows x1.5', () => {
    expect(CARRYOVER.gravity.telegraphMultiplier).toBe(1.5);
  });
  it('reduces fall damage (halved)', () => {
    expect(CARRYOVER.gravity.fallDamageMultiplier).toBe(0.5);
    expect(CARRYOVER.gravity.fallDamageMultiplier).toBeLessThan(1);
  });
});

describe('L3 comms repair effects', () => {
  it('pre-warns ~2 s early', () => {
    expect(CARRYOVER.comms.earlyWarningSecs).toBe(2);
  });
  it('unlocks a comms-locked alcove per act and clamp readouts', () => {
    expect(CARRYOVER.comms.commsAlcovePerAct).toBe(true);
    expect(CARRYOVER.comms.clampReadouts).toBe(true);
  });
});

describe('L3 unspent L2 fuel -> starting O2 reserve', () => {
  it('converts at +8 s per cell', () => {
    expect(CARRYOVER.fuelToO2.secondsPerCell).toBe(8);
  });
  it('caps the starting reserve bonus at +25 s', () => {
    expect(CARRYOVER.fuelToO2.startingCapSecs).toBe(25);
  });
  it('cap is reachable with a realistic cell count and not trivially exceeded', () => {
    const { secondsPerCell, startingCapSecs } = CARRYOVER.fuelToO2;
    // 4 cells * 8 s = 32 s would exceed the 25 s cap -> the cap binds.
    expect(4 * secondsPerCell).toBeGreaterThan(startingCapSecs);
    // 3 cells * 8 s = 24 s sits just under the cap.
    expect(3 * secondsPerCell).toBeLessThanOrEqual(startingCapSecs);
  });
});
