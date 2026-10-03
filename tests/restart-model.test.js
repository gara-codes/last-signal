import { describe, it, expect } from 'vitest';
import { restartView } from '../src/ui/screens/restart-model.js';

describe('restartView', () => {
  it('builds the L2 death summary from the repair flags', () => {
    const view = restartView({
      levelId: 'l2',
      fuelCells: 3,
      repairs: {
        'oxygen-scrubbers': 'partial',
        'gravity-stabilizers': 'untouched',
        'comms-array': 'repaired',
      },
    });
    expect(view.stats.map((s) => s.value)).toEqual(['03', '1/3', '01']);
    expect(view.systems.map((s) => [s.name, s.step])).toEqual([
      ['Stabilizers', 0],
      ['Comms', 2],
      ['Scrubbers', 1],
    ]);
    expect(view.lastSector).toBe('Engineering Core // Sec. 2');
    expect(view.restartLabel).toBe('Restart Level');
  });

  it('switches the button once the L2 checkpoint is passed', () => {
    expect(restartView({ levelId: 'l2', repairs: {}, checkpointReached: true }).restartLabel).toBe(
      'Restart From Checkpoint'
    );
  });

  it('has no systems row before L2 and reads unknown states as untouched', () => {
    expect(restartView({ levelId: 'l1' }).systems).toBeNull();
    expect(restartView({ levelId: 'l3', repairs: {} }).systems.every((s) => s.step === 0)).toBe(
      true
    );
    expect(restartView({ levelId: 'l3', repairs: {} }).stats[2].value).toBe('02');
  });
});
