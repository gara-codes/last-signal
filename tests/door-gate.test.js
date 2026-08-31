// tests/door-gate.test.js
import { describe, it, expect } from 'vitest';
import { DoorGate } from '../src/systems/door-gate.js';
import { FuelSystem } from '../src/systems/fuel-system.js';

describe('DoorGate', () => {
  it('stays closed and does not charge the player if they cannot afford it', () => {
    const fuel = new FuelSystem(1);
    const door = new DoorGate('test-door', 3);
    expect(door.tryOpen(fuel)).toBe(false);
    expect(door.isOpen).toBe(false);
    expect(fuel.count).toBe(1); // unchanged
  });

  it('opens and charges the player when affordable', () => {
    const fuel = new FuelSystem(5);
    const door = new DoorGate('test-door', 3);
    expect(door.tryOpen(fuel)).toBe(true);
    expect(door.isOpen).toBe(true);
    expect(fuel.count).toBe(2);
  });

  it('does not re-charge on a second tryOpen once already open', () => {
    const fuel = new FuelSystem(5);
    const door = new DoorGate('test-door', 3);
    door.tryOpen(fuel);
    expect(door.tryOpen(fuel)).toBe(true);
    expect(fuel.count).toBe(2); // unchanged from the first spend
  });
});
