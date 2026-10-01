// tests/command-center.test.js
import { describe, it, expect } from 'vitest';
import { CommandCenterOverride, Checkpoint } from '../src/systems/command-center.js';
import { FuelSystem } from '../src/systems/fuel-system.js';

describe('CommandCenterOverride', () => {
  it('starts locked with no override item', () => {
    const override = new CommandCenterOverride();
    expect(override.terminalUnlocked).toBe(false);
    expect(override.hasOverrideItem).toBe(false);
    expect(override.tryOpenDoor()).toBe(false);
  });

  it('unlockTerminal spends one fuel cell on success', () => {
    const override = new CommandCenterOverride();
    const fuel = new FuelSystem(1);
    expect(override.unlockTerminal(fuel)).toBe(true);
    expect(fuel.count).toBe(0);
    expect(override.terminalUnlocked).toBe(true);
  });

  it('unlockTerminal fails and spends nothing without enough fuel', () => {
    const override = new CommandCenterOverride();
    const fuel = new FuelSystem(0);
    expect(override.unlockTerminal(fuel)).toBe(false);
    expect(override.terminalUnlocked).toBe(false);
  });

  it('unlockTerminal is idempotent once unlocked (no double charge)', () => {
    const override = new CommandCenterOverride();
    const fuel = new FuelSystem(5);
    override.unlockTerminal(fuel);
    expect(override.unlockTerminal(fuel)).toBe(true);
    expect(fuel.count).toBe(4); // only charged once
  });

  it('collectOverride fails before the terminal is unlocked', () => {
    const override = new CommandCenterOverride();
    expect(override.collectOverride()).toBe(false);
    expect(override.hasOverrideItem).toBe(false);
  });

  it('collectOverride succeeds after unlocking, and the door then opens', () => {
    const override = new CommandCenterOverride();
    const fuel = new FuelSystem(1);
    override.unlockTerminal(fuel);
    expect(override.collectOverride()).toBe(true);
    expect(override.hasOverrideItem).toBe(true);
    expect(override.tryOpenDoor()).toBe(true);
  });

  it('the door never opens without the override item, regardless of fuel', () => {
    const override = new CommandCenterOverride();
    const fuel = new FuelSystem(99);
    expect(override.tryOpenDoor()).toBe(false);
    override.unlockTerminal(fuel);
    expect(override.tryOpenDoor()).toBe(false); // unlocked terminal alone isn't enough
  });
});

describe('Checkpoint', () => {
  it('has no snapshot initially', () => {
    const checkpoint = new Checkpoint();
    expect(checkpoint.hasSnapshot()).toBe(false);
    expect(checkpoint.load()).toBeNull();
  });

  it('save() stores a snapshot copy, load() returns it', () => {
    const checkpoint = new Checkpoint();
    const state = { x: 1, y: 2, z: 3, facing: 0, oxygen: 100, health: 100, fuelCount: 4 };
    checkpoint.save(state);
    expect(checkpoint.hasSnapshot()).toBe(true);
    expect(checkpoint.load()).toEqual(state);
  });

  it('save() copies the object rather than aliasing it', () => {
    const checkpoint = new Checkpoint();
    const state = { x: 1 };
    checkpoint.save(state);
    state.x = 999;
    expect(checkpoint.load().x).toBe(1);
  });

  it('a later save() overwrites the earlier snapshot', () => {
    const checkpoint = new Checkpoint();
    checkpoint.save({ x: 1 });
    checkpoint.save({ x: 2 });
    expect(checkpoint.load()).toEqual({ x: 2 });
  });
});
