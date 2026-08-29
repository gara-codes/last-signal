// tests/fuel-system.test.js
import { describe, it, expect } from 'vitest';
import { FuelSystem } from '../src/systems/fuel-system.js';

describe('FuelSystem', () => {
  it('starts with the given reserve', () => {
    const fuel = new FuelSystem(5);
    expect(fuel.count).toBe(5);
  });

  it('spend fails and leaves count unchanged when not enough cells', () => {
    const fuel = new FuelSystem(2);
    expect(fuel.spend(3)).toBe(false);
    expect(fuel.count).toBe(2);
  });

  it('spend succeeds and deducts on success', () => {
    const fuel = new FuelSystem(5);
    expect(fuel.spend(3)).toBe(true);
    expect(fuel.count).toBe(2);
  });

  it('canAfford reflects current count', () => {
    const fuel = new FuelSystem(3);
    expect(fuel.canAfford(3)).toBe(true);
    expect(fuel.canAfford(4)).toBe(false);
  });
});