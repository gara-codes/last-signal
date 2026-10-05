import { describe, it, expect } from 'vitest';
import { shipStatusView } from '../src/ui/ship-status-model.js';

const FLAGS = {
  'gravity-stabilizers': 'untouched',
  'comms-array': 'partial',
  'oxygen-scrubbers': 'repaired',
};

describe('shipStatusView', () => {
  it('L1: everything nominal, cryo bay introduced', () => {
    const view = shipStatusView('l1', FLAGS);
    expect(view.location).toBe('HABITATION RING // COMMAND LINK');
    expect(view.objective).toMatch(/habitation door/);
    expect(view.systems.every((s) => s.word === 'Nominal' && s.step === 2)).toBe(true);
    expect(view.systems[0].segLabels[2]).toBe('NOMINAL');
    expect(view.pods).toEqual({ text: 'CRYO BAY · 3 CREW IN STASIS · ALL SUSTAINED', bad: false });
    expect(view.denied).toBe(false);
  });

  it('L2: live states, words and strips', () => {
    const view = shipStatusView('l2', FLAGS);
    expect(view.systems.map((s) => [s.word, s.tone])).toEqual([
      ['Field unstable', 'bad'],
      ['Intermittent', 'warn'],
      ['Reserve recovering', 'ok'],
    ]);
    expect(view.systems[0].segments).toEqual(['bad', '', '']);
    expect(view.systems[1].segments).toEqual(['done', 'now', '']);
    expect(view.pods.text).toBe('CRYO BAY · ALL PODS SUSTAINED');
    expect(view.aiLine).toBeNull();
  });

  it('L3: link revoked, steps faded, words carry the L2 outcome', () => {
    const view = shipStatusView('l3', { ...FLAGS, 'oxygen-scrubbers': 'partial' });
    expect(view.location).toMatch(/COMMAND LINK REVOKED$/);
    expect(view.denied).toBe(true);
    expect(view.systems.every((s) => s.segments.every((c) => c === ''))).toBe(true);
    expect(view.systems.map((s) => s.word)).toEqual([
      'Field failing',
      'Signal degraded',
      'Reserve low',
    ]);
    expect(view.pods).toEqual({ text: 'CRYO BAY · ONE POD SILENT', bad: true });
    expect(view.aiLine).toBeTruthy();
  });

  it('missing flags read as untouched', () => {
    expect(shipStatusView('l2', null).systems.every((s) => s.step === 0)).toBe(true);
  });
});
