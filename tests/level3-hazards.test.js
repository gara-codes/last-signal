// tests/level3-hazards.test.js
//
// The nine-hazard ladder: teach -> test -> combine -> chase -> final exam,
// each hazard telegraphed, placed on a real segment, and (via the factory)
// emitting a damage volume AABB for the systems pass. Headless THREE only.

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { HAZARDS, getSegment } from '../src/levels/level3/level3-data.js';
import { createHazard } from '../src/levels/level3/hazards.js';

const materials = new Proxy({}, { get: () => new THREE.MeshBasicMaterial() });

describe('L3 nine-hazard ladder', () => {
  it('has exactly nine hazards', () => {
    expect(HAZARDS).toHaveLength(9);
  });
  it('uses nine distinct hazard types', () => {
    expect(new Set(HAZARDS.map((h) => h.type)).size).toBe(9);
  });
  it('follows the teach -> test -> combine -> chase -> final ladder', () => {
    expect(HAZARDS.map((h) => h.role)).toEqual([
      'teach', 'teach', 'test', 'combine', 'teach', 'test', 'combine', 'chase', 'final',
    ]);
  });
  it('escalates by act (never goes back an act)', () => {
    const acts = HAZARDS.map((h) => h.act);
    expect(acts).toEqual([...acts].sort((a, b) => a - b));
  });
  it('the chase hazard has a front speed below the player run speed', () => {
    const chase = HAZARDS.find((h) => h.role === 'chase');
    expect(chase.frontSpeed).toBeGreaterThan(0);
    expect(chase.frontSpeed).toBeLessThan(9.6); // catchable-but-escapable tension
  });
});

describe('L3 hazard placement', () => {
  it('each hazard sits on a real segment, within its span', () => {
    for (const h of HAZARDS) {
      const seg = getSegment(h.segment);
      expect(seg, `${h.id} segment`).toBeTruthy();
      expect(seg.act).toBe(h.act);
      const lo = Math.min(seg.from, seg.to);
      const hi = Math.max(seg.from, seg.to);
      expect(h.z).toBeGreaterThanOrEqual(lo);
      expect(h.z).toBeLessThanOrEqual(hi);
    }
  });
  it('each hazard defines a telegraph window (>= 0)', () => {
    for (const h of HAZARDS) {
      expect(typeof h.telegraph).toBe('number');
      expect(h.telegraph).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('L3 hazard factory contract', () => {
  for (const h of HAZARDS) {
    it(`${h.id} builds a group, data and a damage volume AABB`, () => {
      const seg = getSegment(h.segment);
      const hazard = createHazard(h, seg, materials);
      expect(hazard.group).toBeInstanceOf(THREE.Object3D);
      expect(typeof hazard.update).toBe('function');
      const v = hazard.data.volume;
      expect(v).toBeTruthy();
      expect(v.maxX).toBeGreaterThan(v.minX);
      expect(v.maxY).toBeGreaterThan(v.minY);
      expect(v.maxZ).toBeGreaterThan(v.minZ);
    });
  }
  it('throws on an unknown hazard type', () => {
    expect(() => createHazard({ id: 'x', type: 'nope' }, getSegment('a1-spine'), materials)).toThrow();
  });
});
