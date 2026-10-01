// tests/win-loss-conditions.test.js
import { describe, it, expect } from 'vitest';
import { checkLossState } from '../src/systems/win-loss-conditions.js';

describe('checkLossState', () => {
  it('reports no loss when the player is alive', () => {
    const result = checkLossState({ isDead: false });
    expect(result.hasLost).toBe(false);
    expect(result.reason).toBe(null);
  });

  it("reports a loss with reason 'health' when isDead is true", () => {
    const result = checkLossState({ isDead: true });
    expect(result.hasLost).toBe(true);
    expect(result.reason).toBe('health');
  });

  it('is duck-typed — works with any object exposing isDead', () => {
    expect(checkLossState({ isDead: true, somethingElse: 123 }).hasLost).toBe(true);
  });

  it('treats a missing/undefined oxygenSystem as no loss rather than throwing', () => {
    expect(() => checkLossState(undefined)).not.toThrow();
    expect(checkLossState(undefined).hasLost).toBe(false);
    expect(checkLossState(null).hasLost).toBe(false);
  });
});
