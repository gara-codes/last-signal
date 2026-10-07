import { describe, it, expect } from 'vitest';
import {
  EmergencyLightingController,
  flickerAt,
  readPowerFraction,
} from '../src/shaders/emergency-lighting-controller.js';

const makeUniforms = () => ({
  uPower: { value: 1 },
  uTime: { value: 0 },
  uFlickerBoost: { value: 0 },
});

describe('flickerAt (JS mirror of the shader)', () => {
  it('never drops out at full power with no boost', () => {
    for (let t = 0; t < 10; t += 1 / 60) {
      expect(flickerAt(t, 1, 0)).toBeGreaterThanOrEqual(0.92);
    }
  });

  it('drops out sometimes at low power, but never fully dark', () => {
    let dropouts = 0;
    for (let t = 0; t < 10; t += 1 / 12) {
      const f = flickerAt(t, 0, 0);
      expect(f).toBeGreaterThan(0.1);
      if (f < 0.6) dropouts++;
    }
    expect(dropouts).toBeGreaterThan(0);
  });
});

describe('EmergencyLightingController', () => {
  it('smooths power toward the target instead of snapping', () => {
    const c = new EmergencyLightingController({ initialPower: 1 });
    c.setPower(0);
    c.update(1 / 60);
    expect(c.displayPower).toBeLessThan(1);
    expect(c.displayPower).toBeGreaterThan(0.5);
    for (let i = 0; i < 300; i++) c.update(1 / 60);
    expect(c.displayPower).toBeLessThan(0.01);
  });

  it('spike decays back to zero on its own', () => {
    const c = new EmergencyLightingController();
    c.spike(1);
    expect(c.boost).toBe(1);
    for (let i = 0; i < 120; i++) c.update(1 / 60);
    expect(c.boost).toBe(0);
  });

  it('dip lowers power temporarily then recovers', () => {
    const c = new EmergencyLightingController({ initialPower: 1 });
    c.dip(0.6, 0.8);
    c.update(0.4); // halfway = deepest point
    expect(c.effectivePower).toBeCloseTo(0.4, 1);
    c.update(0.5);
    expect(c.effectivePower).toBeCloseTo(1, 5);
  });

  it('writes into existing uniform objects (no per-frame allocation)', () => {
    const c = new EmergencyLightingController({ initialPower: 0.5 });
    const u = makeUniforms();
    const powerRef = u.uPower;
    c.addUniforms(u);
    c.update(1 / 60);
    expect(u.uPower).toBe(powerRef);
    expect(u.uPower.value).toBeCloseTo(0.5);
    expect(u.uTime.value).toBeGreaterThan(0);
  });

  it('drives registered lights with the same flicker as the shader', () => {
    const c = new EmergencyLightingController({ initialPower: 1 });
    const light = { intensity: 2 };
    c.addLight(light);
    c.update(1 / 60);
    expect(light.intensity).toBeCloseTo(2 * flickerAt(c.time, c.effectivePower, c.boost));
  });

  it('Reduce Flashing holds materials and lights steady, even at low power with a spike', () => {
    const c = new EmergencyLightingController({ initialPower: 0 });
    const u = { ...makeUniforms(), uSteady: { value: 0 } };
    const light = { intensity: 2 };
    c.addUniforms(u).addLight(light);
    c.setReduceFlashing(true);
    c.spike(1);
    for (let i = 0; i < 120; i++) {
      c.update(1 / 12); // one shader flicker tick per step
      expect(u.uSteady.value).toBe(1);
      expect(light.intensity).toBe(2); // no dropouts
    }
    expect(u.uPower.value).toBeCloseTo(0); // power itself still applies
  });

  it('turning Reduce Flashing off restores the flicker', () => {
    const c = new EmergencyLightingController({ initialPower: 1 });
    const u = { ...makeUniforms(), uSteady: { value: 0 } };
    c.addUniforms(u);
    c.setReduceFlashing(true);
    c.update(1 / 60);
    c.setReduceFlashing(false);
    c.update(1 / 60);
    expect(u.uSteady.value).toBe(0);
  });

  it('still works with uniform sets that predate uSteady', () => {
    const c = new EmergencyLightingController();
    const u = makeUniforms();
    c.addUniforms(u);
    c.setReduceFlashing(true);
    expect(() => c.update(1 / 60)).not.toThrow();
  });
});

describe('readPowerFraction', () => {
  it('handles a property, a method, and a missing source', () => {
    expect(readPowerFraction({ powerFraction: 0.3 })).toBe(0.3);
    expect(readPowerFraction({ powerFraction: () => 0.7 })).toBe(0.7);
    expect(readPowerFraction({ powerFraction: 2 })).toBe(1);
    expect(readPowerFraction(null)).toBeNull();
    expect(readPowerFraction({})).toBeNull();
  });
});
