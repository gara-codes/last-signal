// tests/system-repair-allocation.test.js
import { describe, it, expect } from 'vitest';
import {
  SystemRepairAllocation,
  REPAIR_STATES,
  SYSTEM_IDS,
} from '../src/systems/system-repair-allocation.js';
import { FuelSystem } from '../src/systems/fuel-system.js';

describe('SystemRepairAllocation', () => {
  it('initialises all systems as untouched', () => {
    const alloc = new SystemRepairAllocation();
    for (const id of SYSTEM_IDS) {
      expect(alloc.getState(id)).toBe(REPAIR_STATES.UNTouched);
      expect(alloc.isRepaired(id)).toBe(false);
    }
  });

  it('repairs a system from untouched to partial, costing cells', () => {
    const alloc = new SystemRepairAllocation();
    const fuel = new FuelSystem(5);
    const result = alloc.repair('oxygen-scrubbers', fuel);
    expect(result.success).toBe(true);
    expect(result.newState).toBe(REPAIR_STATES.PARTIAL);
    expect(fuel.count).toBe(3); // cost 2
  });

  it('repairs a system from partial to repaired on second attempt', () => {
    const alloc = new SystemRepairAllocation();
    const fuel = new FuelSystem(10);
    alloc.repair('oxygen-scrubbers', fuel); // → partial
    const result = alloc.repair('oxygen-scrubbers', fuel); // → repaired
    expect(result.success).toBe(true);
    expect(result.newState).toBe(REPAIR_STATES.REPAIRED);
    expect(alloc.isRepaired('oxygen-scrubbers')).toBe(true);
    expect(fuel.count).toBe(6); // 4 spent total
  });

  it('does not over-repair an already repaired system', () => {
    const alloc = new SystemRepairAllocation();
    const fuel = new FuelSystem(10);
    alloc.repair('comms-array', fuel);
    alloc.repair('comms-array', fuel); // now repaired
    const fuelBefore = fuel.count;
    const result = alloc.repair('comms-array', fuel);
    expect(result.success).toBe(false);
    expect(fuel.count).toBe(fuelBefore); // no extra charge
  });

  it('fails repair when player cannot afford it', () => {
    const alloc = new SystemRepairAllocation();
    const fuel = new FuelSystem(1); // not enough (cost is 2)
    const result = alloc.repair('gravity-stabilizers', fuel);
    expect(result.success).toBe(false);
    expect(alloc.getState('gravity-stabilizers')).toBe(REPAIR_STATES.UNTouched);
    expect(fuel.count).toBe(1); // unchanged
  });

  it('tracks each system independently', () => {
    const alloc = new SystemRepairAllocation();
    const fuel = new FuelSystem(10);
    alloc.repair('oxygen-scrubbers', fuel); // partial
    alloc.repair('gravity-stabilizers', fuel); // partial
    alloc.repair('oxygen-scrubbers', fuel); // repaired
    expect(alloc.isRepaired('oxygen-scrubbers')).toBe(true);
    expect(alloc.isRepaired('gravity-stabilizers')).toBe(false);
    expect(alloc.getState('gravity-stabilizers')).toBe(REPAIR_STATES.PARTIAL);
    expect(alloc.getState('comms-array')).toBe(REPAIR_STATES.UNTouched);
  });

  it('exports flags for L3 to read', () => {
    const alloc = new SystemRepairAllocation();
    const fuel = new FuelSystem(10);
    alloc.repair('oxygen-scrubbers', fuel);
    alloc.repair('oxygen-scrubbers', fuel); // repaired
    const flags = alloc.exportFlags();
    expect(flags['oxygen-scrubbers']).toBe(REPAIR_STATES.REPAIRED);
    expect(flags['gravity-stabilizers']).toBe(REPAIR_STATES.UNTouched);
  });

  it('accepts pre-loaded states (level transition)', () => {
    const preloaded = {
      'oxygen-scrubbers': REPAIR_STATES.REPAIRED,
      'gravity-stabilizers': REPAIR_STATES.PARTIAL,
      'comms-array': REPAIR_STATES.UNTouched,
    };
    const alloc = new SystemRepairAllocation(preloaded);
    expect(alloc.isRepaired('oxygen-scrubbers')).toBe(true);
    expect(alloc.getState('gravity-stabilizers')).toBe(REPAIR_STATES.PARTIAL);
  });

  it('rejects unknown system IDs', () => {
    const alloc = new SystemRepairAllocation();
    const fuel = new FuelSystem(10);
    const result = alloc.repair('warp-drive', fuel);
    expect(result.success).toBe(false);
    expect(fuel.count).toBe(10);
  });
});
