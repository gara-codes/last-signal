import { describe, it, expect } from 'vitest';
import { consoleView, repairStep } from '../src/ui/screens/repair-console/console-model.js';

describe('repairStep', () => {
  it('maps repair states to steps', () => {
    expect(repairStep('untouched')).toBe(0);
    expect(repairStep('partial')).toBe(1);
    expect(repairStep('repaired')).toBe(2);
    expect(repairStep(undefined)).toBe(0);
  });
});

describe('consoleView', () => {
  it('untouched: red-outlined first cell, repair prompt with the cost', () => {
    const view = consoleView('untouched', 3, 2);
    expect(view.step).toBe(0);
    expect(view.stepName).toBe('Untouched');
    expect(view.segments).toEqual(['bad', '', '']);
    expect(view.prompt).toEqual({ label: 'Repair (2 Fuel Cells)', denied: false, done: false });
  });

  it('partial: first cell done, second current', () => {
    const view = consoleView('partial', 2, 2);
    expect(view.segments).toEqual(['done', 'now', '']);
    expect(view.prompt.denied).toBe(false);
  });

  it('denied shows have / need', () => {
    expect(consoleView('partial', 1, 2).prompt).toEqual({
      label: 'Repair (1 / 2 Fuel Cells)',
      denied: true,
      done: false,
    });
    expect(consoleView('untouched', 0, 1).prompt.label).toBe('Repair (0 / 1 Fuel Cell)');
  });

  it('full: all cells lit, restored prompt with no key', () => {
    const view = consoleView('repaired', 0, 2);
    expect(view.segments).toEqual(['done', 'done', 'now']);
    expect(view.stepName).toBe('Full');
    expect(view.prompt).toEqual({ label: 'System Restored', denied: false, done: true });
  });
});
