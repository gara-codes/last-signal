// src/ui/screens/restart-model.js
//
// What the Restart ("Signal Lost") screen shows for a death — pure, tested in
// tests/restart-model.test.js. restart.js turns it into markup.

import { sectorLabel, levelIndex } from '../../config/levels.js';

// Order and short names on the screen; colours come from the repair consoles (theme.css).
export const RESTART_SYSTEMS = Object.freeze([
  { id: 'gravity-stabilizers', name: 'Stabilizers', theme: 'gravity' },
  { id: 'comms-array', name: 'Comms', theme: 'comms' },
  { id: 'oxygen-scrubbers', name: 'Scrubbers', theme: 'oxygen' },
]);

const STEP = { untouched: 0, partial: 1, repaired: 2 };

/**
 * @param {object} info
 * @param {string}  info.levelId            where the player died ('l1' | 'l2' | 'l3')
 * @param {number}  [info.fuelCells]        fuel cells held
 * @param {Object<string,string>|null} [info.repairs]  repairs.exportFlags(): systemId -> state.
 *   Leave it out on L1 (nothing to repair yet) and the systems row is not shown.
 * @param {boolean} [info.checkpointReached] past the one L2 checkpoint (command-centre door)
 */
export function restartView({ levelId, fuelCells = 0, repairs = null, checkpointReached = false }) {
  const systems = repairs
    ? RESTART_SYSTEMS.map((s) => ({ ...s, step: STEP[repairs[s.id]] ?? 0 }))
    : null;
  const repaired = systems ? systems.filter((s) => s.step === 2).length : 0;
  const cells = Math.max(0, Math.floor(Number(fuelCells) || 0));
  return {
    stats: [
      { id: 'cells', label: 'Fuel Cells', value: String(cells).padStart(2, '0') },
      { id: 'systems', label: 'Systems Repaired', value: `${repaired}/3` },
      {
        id: 'sectors',
        label: 'Sectors Cleared',
        value: String(levelIndex(levelId)).padStart(2, '0'),
      },
    ],
    systems,
    lastSector: sectorLabel(levelId),
    // First entry is the primary button. Past the checkpoint both restarts are offered.
    restartOptions: checkpointReached
      ? [
          { id: 'checkpoint', label: 'Restart From Checkpoint', fromCheckpoint: true },
          { id: 'level', label: 'Restart Level', fromCheckpoint: false },
        ]
      : [{ id: 'level', label: 'Restart Level', fromCheckpoint: false }],
  };
}
