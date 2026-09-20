// tests/win-loss-conditions.test.js
import { describe, it, expect } from 'vitest';
import { WinLossConditions } from '../src/systems/win-loss-conditions.js';

describe('WinLossConditions', () => {
  describe('with scrubbers repaired', () => {
    it('starts with full countdown', () => {
      const wlc = new WinLossConditions({ escapeTime: 120, scrubbersRepaired: true });
      expect(wlc.countdown).toBe(120);
      expect(wlc.remainingTime).toBe(120);
      expect(wlc.isActive).toBe(true);
    });

    it('player wins if they reach the pod in time', () => {
      const wlc = new WinLossConditions({ escapeTime: 120, scrubbersRepaired: true });
      wlc.update(60); // 60 seconds pass
      const won = wlc.reachEscapePod();
      expect(won).toBe(true);
      expect(wlc.hasWon).toBe(true);
      expect(wlc.isActive).toBe(false);
    });
  });

  describe('with scrubbers broken', () => {
    it('starts with a reduced countdown', () => {
      const wlc = new WinLossConditions({
        escapeTime: 120,
        scrubbersRepaired: false,
        brokenScrubberPenalty: 45,
      });
      expect(wlc.countdown).toBe(75); // 120 - 45
    });

    it('player still wins if they reach the pod before timeout', () => {
      const wlc = new WinLossConditions({
        escapeTime: 120,
        scrubbersRepaired: false,
        brokenScrubberPenalty: 45,
      });
      wlc.update(30);
      const won = wlc.reachEscapePod();
      expect(won).toBe(true);
    });
  });

  describe('loss conditions', () => {
    it('player loses when countdown expires', () => {
      const wlc = new WinLossConditions({ escapeTime: 10, scrubbersRepaired: true });
      wlc.update(11);
      expect(wlc.hasLost).toBe(true);
      expect(wlc.lossReason).toBe('timeout');
      expect(wlc.isActive).toBe(false);
      expect(wlc.remainingTime).toBe(0);
    });

    it('player loses from oxygen death', () => {
      const wlc = new WinLossConditions({ escapeTime: 120, scrubbersRepaired: true });
      wlc.onOxygenDeath();
      expect(wlc.hasLost).toBe(true);
      expect(wlc.lossReason).toBe('oxygen');
    });

    it('cannot win after loss', () => {
      const wlc = new WinLossConditions({ escapeTime: 10, scrubbersRepaired: true });
      wlc.update(11); // timeout
      const won = wlc.reachEscapePod();
      expect(won).toBe(false);
      expect(wlc.hasWon).toBe(false);
    });

    it('cannot lose after win', () => {
      const wlc = new WinLossConditions({ escapeTime: 120, scrubbersRepaired: true });
      wlc.reachEscapePod(); // win
      wlc.onOxygenDeath(); // attempt loss
      expect(wlc.hasWon).toBe(true);
      expect(wlc.hasLost).toBe(false);
    });
  });

  describe('fromRepairFlags factory', () => {
    it('reads scrubbers state from repair flags', () => {
      const flags = {
        'oxygen-scrubbers': 'repaired',
        'gravity-stabilizers': 'untouched',
        'comms-array': 'partial',
      };
      const wlc = WinLossConditions.fromRepairFlags(flags, { escapeTime: 120 });
      expect(wlc.scrubbersRepaired).toBe(true);
      expect(wlc.countdown).toBe(120);
    });

    it('applies penalty when scrubbers not repaired', () => {
      const flags = {
        'oxygen-scrubbers': 'partial',
        'gravity-stabilizers': 'untouched',
        'comms-array': 'untouched',
      };
      const wlc = WinLossConditions.fromRepairFlags(flags, { escapeTime: 120 });
      expect(wlc.scrubbersRepaired).toBe(false);
      expect(wlc.countdown).toBe(75);
    });
  });
});
