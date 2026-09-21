// tests/stage.test.js
import { describe, it, expect } from 'vitest';
import { computeScale } from '../src/ui/stage.js';

describe('computeScale', () => {
  it('is 1 at the 1600x900 design size', () => {
    expect(computeScale(1600, 900)).toBe(1);
  });

  it('fits the limiting dimension', () => {
    expect(computeScale(1920, 1080)).toBeCloseTo(1.2);
    expect(computeScale(1366, 768)).toBeCloseTo(0.8538, 3);
    // ultrawide: height is the limit, so the frame letterboxes horizontally
    expect(computeScale(3440, 1440)).toBeCloseTo(1.6);
    // portrait-ish window: width is the limit
    expect(computeScale(800, 1000)).toBeCloseTo(0.5);
  });
});
