// tests/power-allocation.test.js
import { describe, it, expect } from 'vitest';
import { PowerAllocation, POWER_SYSTEMS } from '../src/systems/power-allocation.js';

describe('PowerAllocation', () => {
  it('starts with zero allocation across all systems', () => {
    const pa = new PowerAllocation();
    expect(pa.getTotalAllocated()).toBe(0);
    expect(pa.powerFraction).toBe(0);
    expect(pa.remaining).toBe(100);
  });

  it('accepts allocation for a known system', () => {
    const pa = new PowerAllocation();
    pa.setAllocation('life-support', 30);
    expect(pa.getTotalAllocated()).toBe(30);
    expect(pa.powerFraction).toBeCloseTo(0.3);
  });

  it('ignores allocation for unknown systems', () => {
    const pa = new PowerAllocation();
    pa.setAllocation('warp-drive', 50);
    expect(pa.getTotalAllocated()).toBe(0);
  });

  it('validates within budget', () => {
    const pa = new PowerAllocation();
    pa.setAllocation('life-support', 30);
    pa.setAllocation('gravity', 30);
    expect(pa.validate()).toBe(true);
  });

  it('scales down largest allocation when over budget', () => {
    const pa = new PowerAllocation(100);
    pa.setAllocation('life-support', 60);
    pa.setAllocation('gravity', 60); // total = 120, over by 20
    const valid = pa.validate();
    expect(valid).toBe(false);
    expect(pa.getTotalAllocated()).toBe(100);
  });

  it('returns per-system fraction relative to fair share', () => {
    const pa = new PowerAllocation(90); // fair share = 30 each
    pa.setAllocation('comms', 15);
    expect(pa.getSystemFraction('comms')).toBeCloseTo(0.5);
  });

  it('tracks remaining power correctly', () => {
    const pa = new PowerAllocation(100);
    pa.setAllocation('life-support', 25);
    pa.setAllocation('gravity', 25);
    pa.setAllocation('comms', 25);
    expect(pa.remaining).toBe(25);
  });

  it('clamps negative allocations to zero', () => {
    const pa = new PowerAllocation();
    pa.setAllocation('life-support', -10);
    expect(pa.getTotalAllocated()).toBe(0);
  });
});
