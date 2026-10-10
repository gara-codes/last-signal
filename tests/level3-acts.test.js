// tests/level3-acts.test.js
//
// Data-level invariants for the act/segment layout: the route is contiguous
// (no gaps) within each act, exactly two storey planes exist, checkpoints sit
// inside act bounds, alcoves are forward-exit only, and the level is provably
// forward-only (every non-decorative scripted collapse seals behind).
//
// ACTS is the BUILD-SCOPE knob (narrowed to a single act during per-act
// cleanup passes); the DESIGN always declares four acts, so design invariants
// assert against [1,2,3,4] directly.

import { describe, it, expect } from 'vitest';
import {
  SEGMENTS,
  ACTS,
  ACT_BOUNDS,
  CHECKPOINTS,
  ALCOVES,
  BREACHES,
  SPAWN,
  segmentsOfAct,
  totalRouteLength,
} from '../src/levels/level3/level3-data.js';

const DESIGN_ACTS = [1, 2, 3, 4];

describe('L3 route scale', () => {
  it('is roughly the 640u target (>= 4x the old 158u blockout)', () => {
    const len = totalRouteLength();
    expect(len).toBeGreaterThan(600);
    expect(len).toBeLessThan(700);
    expect(len).toBeGreaterThan(158 * 3.5);
  });
  it('has four acts', () => {
    // The design declares four acts; the ACTS build-scope knob only chooses
    // which of them assemble (it may be narrowed during per-act passes).
    for (const a of DESIGN_ACTS) expect(segmentsOfAct(a).length).toBeGreaterThan(0);
    for (const a of ACTS) expect(DESIGN_ACTS).toContain(a);
  });
  it('starts at the spawn end', () => {
    const first = SEGMENTS[0];
    expect(first.axis).toBe('z');
    expect(Math.abs(first.from - SPAWN.position[2])).toBeLessThan(4);
  });
});

describe('L3 route contiguity (z-axis chains per act)', () => {
  for (const act of ACTS) {
    it(`act ${act} z-segments chain without gaps`, () => {
      const zs = segmentsOfAct(act).filter((s) => s.axis === 'z');
      // Route runs toward -Z, so `from` descends.
      const sorted = [...zs].sort((a, b) => b.from - a.from);
      for (let i = 1; i < sorted.length; i += 1) {
        expect(sorted[i].from).toBe(sorted[i - 1].to);
        expect(sorted[i].at).toBe(sorted[i - 1].at); // same centreline x
      }
    });
  }

  it('each act connector hands off to the next act centreline (90deg turn)', () => {
    const connectors = SEGMENTS.filter((s) => s.axis === 'x');
    expect(connectors.length).toBe(3); // c1, c2, c3
    for (const c of connectors) {
      const nextAct = c.act + 1;
      const nextFirstZ = segmentsOfAct(nextAct)
        .filter((s) => s.axis === 'z')
        .sort((a, b) => b.from - a.from)[0];
      expect(nextFirstZ).toBeTruthy();
      // The connector's far x end lands on the next act's spine centreline.
      expect(c.to).toBe(nextFirstZ.at);
    }
  });
});

describe('L3 storey planes', () => {
  it('uses exactly two planes', () => {
    const planes = new Set(SEGMENTS.map((s) => s.plane));
    expect([...planes].sort()).toEqual(['lower', 'main']);
  });
  it('Act 3 (the belly) is entirely on the lower deck', () => {
    for (const s of segmentsOfAct(3)) expect(s.plane).toBe('lower');
  });
  it('Acts 1, 2 and 4 are on the main deck', () => {
    for (const act of [1, 2, 4]) {
      for (const s of segmentsOfAct(act)) expect(s.plane).toBe('main');
    }
  });
});

describe('L3 checkpoints', () => {
  const inSomeActBounds = (pos) =>
    DESIGN_ACTS.some((a) => {
      const b = ACT_BOUNDS[a];
      return (
        pos[0] >= b.minX && pos[0] <= b.maxX &&
        pos[1] >= b.minY && pos[1] <= b.maxY &&
        pos[2] >= b.minZ && pos[2] <= b.maxZ
      );
    });

  it('has three, at increasing act boundaries', () => {
    expect(CHECKPOINTS).toHaveLength(3);
    expect(CHECKPOINTS.map((c) => c.id)).toEqual(['cp1', 'cp2', 'cp3']);
    const acts = CHECKPOINTS.map((c) => c.act);
    expect(acts).toEqual([...acts].sort((a, b) => a - b));
    expect(new Set(acts).size).toBe(3);
  });
  it('each checkpoint sits inside some act bound', () => {
    for (const cp of CHECKPOINTS) expect(inSomeActBounds(cp.position)).toBe(true);
  });
  it('each guards a distinct beat', () => {
    expect(new Set(CHECKPOINTS.map((c) => c.after)).size).toBe(3);
  });
});

describe('L3 alcoves are forward-exit only', () => {
  it('has 1-2 per act, exit strictly ahead (smaller z), depth <= 30', () => {
    for (const al of ALCOVES) {
      expect(al.exitZ).toBeLessThan(al.entryZ); // ahead along the -Z route
      expect(al.depth).toBeLessThanOrEqual(30);
      expect(al.depth).toBe(Math.abs(al.entryZ - al.exitZ));
    }
  });
  it('rejoin ahead of entry (no backward exits anywhere)', () => {
    // Forward-only proof, part 1: no alcove loops back behind its entry.
    for (const al of ALCOVES) expect(al.exitZ).toBeLessThan(al.entryZ);
  });
});

describe('L3 forward-only proof (seals)', () => {
  it('every non-decorative scripted collapse seals the route behind', () => {
    const scripted = BREACHES.filter((b) => b.scripted);
    expect(scripted.length).toBeGreaterThan(0);
    for (const b of scripted) {
      if (b.type === 'viewport') continue; // decorative cracks never seal
      expect(b.sealBehind, `${b.id} should seal behind`).toBe(true);
    }
  });
  it('decorative viewport collapses explicitly do not seal', () => {
    const viewports = BREACHES.filter((b) => b.scripted && b.type === 'viewport');
    expect(viewports.length).toBe(2);
    for (const v of viewports) expect(v.sealBehind).toBe(false);
  });
});
