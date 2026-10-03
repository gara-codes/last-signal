import { describe, it, expect } from 'vitest';
import {
  fuelCellsText,
  costPrompt,
  stationPrompt,
  promptForInteractable,
} from '../src/ui/prompt-copy.js';

const fuel = (banked) => ({ banked });

describe('fuelCellsText', () => {
  it('pluralises', () => {
    expect(fuelCellsText(1)).toBe('1 Fuel Cell');
    expect(fuelCellsText(2)).toBe('2 Fuel Cells');
    expect(fuelCellsText(0)).toBe('0 Fuel Cells');
  });
});

describe('costPrompt', () => {
  it('always shows the cost, muted only when unaffordable', () => {
    expect(costPrompt('Open Door', 2, 3)).toEqual({
      label: 'Open Door',
      detail: '2 Fuel Cells',
      denied: false,
    });
    expect(costPrompt('Open Door', 2, 1).denied).toBe(true);
    expect(costPrompt('Open Door', 2, 2).denied).toBe(false);
  });
});

describe('stationPrompt', () => {
  it('opens the console, naming the system until it is fully repaired', () => {
    expect(stationPrompt('gravity-stabilizers', false)).toEqual({
      label: 'Access Console',
      detail: 'Gravity Stabilizers',
    });
    expect(stationPrompt('comms-array', true).detail).toBe('Fully Repaired');
  });
});

describe('promptForInteractable', () => {
  it('returns null for nothing and for fuel cells (hinted separately)', () => {
    expect(promptForInteractable(null, fuel(0))).toBeNull();
    expect(promptForInteractable({ userData: { isFuelCell: true } }, fuel(0))).toBeNull();
  });

  it('gates a locked fuel door on cost, and hides while opening/open', () => {
    const door = { userData: { state: 'locked', fuelGate: { cost: 2 } } };
    expect(promptForInteractable(door, fuel(1))).toEqual({
      label: 'Open Door',
      detail: '2 Fuel Cells',
      denied: true,
    });
    expect(promptForInteractable(door, fuel(2)).denied).toBe(false);
    door.userData.state = 'unlocked';
    expect(promptForInteractable(door, fuel(0))).toEqual({ label: 'Open Door' });
    door.userData.state = 'opening';
    expect(promptForInteractable(door, fuel(0))).toBeNull();
  });

  it('prefers getPrompt, then a static prompt', () => {
    const dynamic = { userData: { getPrompt: (f) => costPrompt('Reroute Power', 1, f.banked) } };
    expect(promptForInteractable(dynamic, fuel(0)).denied).toBe(true);
    expect(promptForInteractable({ userData: { prompt: { label: 'X' } } }, fuel(0))).toEqual({
      label: 'X',
    });
    expect(promptForInteractable({ userData: {} }, fuel(0))).toEqual({ label: 'Interact' });
  });
});
