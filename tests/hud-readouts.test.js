import { describe, it, expect } from 'vitest';
import {
  meterView,
  splitCountdown,
  powerText,
  OXYGEN_THRESHOLDS,
  HEALTH_THRESHOLDS,
} from '../src/ui/hud-readouts.js';

describe('meterView', () => {
  it('matches the mockup readouts', () => {
    expect(meterView(0.68, OXYGEN_THRESHOLDS)).toEqual({ pct: 68, pips: 7, tone: 'normal' });
    expect(meterView(0.22, OXYGEN_THRESHOLDS)).toEqual({ pct: 22, pips: 2, tone: 'warn' });
    expect(meterView(0.14, HEALTH_THRESHOLDS)).toEqual({ pct: 14, pips: 1, tone: 'critical' });
  });

  it('keeps one pip lit above zero and clamps bad input', () => {
    expect(meterView(0.01, HEALTH_THRESHOLDS).pips).toBe(1);
    expect(meterView(0, HEALTH_THRESHOLDS).pips).toBe(0);
    expect(meterView(7, OXYGEN_THRESHOLDS)).toEqual({ pct: 100, pips: 10, tone: 'normal' });
    expect(meterView('x', OXYGEN_THRESHOLDS)).toEqual({ pct: 0, pips: 0, tone: 'critical' });
  });

  it('health has no warn step', () => {
    expect(meterView(0.3, HEALTH_THRESHOLDS).tone).toBe('normal');
    expect(meterView(0.24, HEALTH_THRESHOLDS).tone).toBe('critical');
  });
});

describe('splitCountdown', () => {
  it('splits and pads, rounding up', () => {
    expect(splitCountdown(47)).toEqual({ min: '00', sec: '47' });
    expect(splitCountdown(46.2)).toEqual({ min: '00', sec: '47' });
    expect(splitCountdown(125)).toEqual({ min: '02', sec: '05' });
  });

  it('clamps negatives, junk and huge values', () => {
    expect(splitCountdown(-3)).toEqual({ min: '00', sec: '00' });
    expect(splitCountdown(NaN)).toEqual({ min: '00', sec: '00' });
    expect(splitCountdown(99999)).toEqual({ min: '99', sec: '59' });
  });
});

describe('powerText', () => {
  it('formats and clamps', () => {
    expect(powerText(61)).toBe('POWER 61%');
    expect(powerText(140)).toBe('POWER 100%');
    expect(powerText(-1)).toBe('POWER 0%');
  });
});
