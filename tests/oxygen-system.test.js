// tests/oxygen-system.test.js
import { describe, it, expect } from 'vitest';
import { OxygenSystem } from '../src/systems/oxygen-system.js';
import { FuelSystem } from '../src/systems/fuel-system.js';

describe('OxygenSystem', () => {
  it('starts fully oxygenated', () => {
    const o2 = new OxygenSystem();
    expect(o2.oxygen).toBe(100);
    expect(o2.health).toBe(100);
    expect(o2.isDepleted).toBe(false);
    expect(o2.isDead).toBe(false);
    expect(o2.fraction).toBe(1);
  });

  it('drains oxygen passively over time', () => {
    const o2 = new OxygenSystem({ drainRate: 10 });
    o2.update(1); // 1 second
    expect(o2.oxygen).toBe(90);
    expect(o2.fraction).toBeCloseTo(0.9);
  });

  it('drains faster while running', () => {
    const o2 = new OxygenSystem({ drainRate: 10, runDrainMultiplier: 2.5 });
    o2.update(1, true); // 1 second running
    expect(o2.oxygen).toBe(75); // 10 * 2.5 = 25 drained
  });

  it('marks depleted when oxygen hits zero and drains health', () => {
    const o2 = new OxygenSystem({ drainRate: 100, healthDrainRate: 20 });
    o2.update(1); // drains all 100 oxygen → depleted; health drains same frame
    expect(o2.oxygen).toBe(0);
    expect(o2.isDepleted).toBe(true);
    expect(o2.health).toBe(80); // 20 * 1s health drain on the depletion frame
    o2.update(1); // 1 more second of health drain
    expect(o2.health).toBe(60);
  });

  it('kills the player when health reaches zero', () => {
    const o2 = new OxygenSystem({ drainRate: 100, healthDrainRate: 200 });
    o2.update(1); // oxygen → 0, depleted, health drains 200*1 = 200 → dead
    expect(o2.health).toBe(0);
    expect(o2.isDead).toBe(true);
  });

  it('topUp consumes one fuse cell and restores oxygen', () => {
    const o2 = new OxygenSystem({ fuseCellTopUp: 40 });
    const fuel = new FuelSystem(3);
    const result = o2.topUp(fuel);
    expect(result).toBe(true);
    expect(fuel.count).toBe(2);
    expect(o2.oxygen).toBe(100); // was already 100, clamped
  });

  it('topUp restores from depleted state and clears depleted flag', () => {
    const o2 = new OxygenSystem({ drainRate: 100, fuseCellTopUp: 40 });
    o2.update(1); // drain to 0
    expect(o2.isDepleted).toBe(true);

    const fuel = new FuelSystem(1);
    o2.topUp(fuel);
    expect(o2.oxygen).toBe(40);
    expect(o2.isDepleted).toBe(false);
  });

  it('topUp fails when player has no fuel cells', () => {
    const o2 = new OxygenSystem();
    const fuel = new FuelSystem(0);
    expect(o2.topUp(fuel)).toBe(false);
    expect(fuel.count).toBe(0);
  });

  it('respects custom maxOxygen', () => {
    const o2 = new OxygenSystem({ maxOxygen: 50 });
    expect(o2.oxygen).toBe(50);
    expect(o2.fraction).toBe(1);
  });
});
