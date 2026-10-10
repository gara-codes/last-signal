// tests/level3-gates.test.js
//
// Gate economy invariants: NO fuel gates in L3; three single-use keycards each
// with a route card + an alcove spare; three hazard-guarded pod clamps; the
// purge event gate bound to the h8 chase; two airlock breathing doors.

import { describe, it, expect } from 'vitest';
import { GATES, ALCOVES, HAZARDS, PICKUPS } from '../src/levels/level3/level3-data.js';

describe('L3 has no fuel gates', () => {
  it('exposes no fuel-cost gate anywhere in the gate table', () => {
    expect(GATES.fuelGate).toBeUndefined();
    expect(GATES.fuelGates).toBeUndefined();
    const blob = JSON.stringify(GATES).toLowerCase();
    expect(blob.includes('fuelgate')).toBe(false);
  });
  it('fuel cells are pickups, not gate currency', () => {
    expect(PICKUPS.fuel.length).toBe(4);
  });
});

describe('L3 keycards', () => {
  it('has three single-use keycards at act boundaries', () => {
    expect(GATES.keycards).toHaveLength(3);
    expect(GATES.keycards.map((k) => k.boundary)).toEqual(['1-2', '2-3', '3-4']);
  });
  it('each has a route card position and an alcove spare', () => {
    for (const k of GATES.keycards) {
      expect(k.routeCard).toHaveLength(3);
      const spare = ALCOVES.find((a) => a.id === k.spareAlcove);
      expect(spare, `${k.id} spare alcove`).toBeTruthy();
    }
  });
  it('each reader door sits on a real turn segment', () => {
    for (const k of GATES.keycards) {
      expect(k.doorSegment).toMatch(/^t[123]$/);
      expect(typeof k.doorZ).toBe('number');
    }
  });
});

describe('L3 pod clamps (final exam)', () => {
  it('has exactly three clamps, each hazard-guarded', () => {
    expect(GATES.clamps).toHaveLength(3);
    for (const c of GATES.clamps) {
      expect(c.guard).toBeTruthy();
      expect(c.position).toHaveLength(3);
    }
  });
  it('one clamp is guarded by the h9 beam grid final hazard', () => {
    const beamGuarded = GATES.clamps.filter((c) => c.guard === 'h9-beams');
    expect(beamGuarded).toHaveLength(1);
    expect(HAZARDS.find((h) => h.id === 'h9-beams')).toBeTruthy();
  });
});

describe('L3 override console + event gate', () => {
  it('has a 3-stage hold-E override console in Act 2', () => {
    expect(GATES.overrideConsole.stages).toBe(3);
    expect(GATES.overrideConsole.act).toBe(2);
  });
  it('the event gate opens only when the purge chase initiates', () => {
    expect(GATES.eventGate.opensOn).toBe('h8-purge');
    expect(HAZARDS.find((h) => h.id === 'h8-purge')).toBeTruthy();
  });
});

describe('L3 airlock breathing doors', () => {
  it('has two, in Acts 1 and 3, each holding a log', () => {
    expect(GATES.airlocks).toHaveLength(2);
    expect(GATES.airlocks.map((a) => a.act)).toEqual([1, 3]);
    for (const a of GATES.airlocks) {
      expect(a.cycle).toBeCloseTo(6, 5);
      expect(PICKUPS.logs.find((l) => l.id === a.contains)).toBeTruthy();
    }
  });
});
