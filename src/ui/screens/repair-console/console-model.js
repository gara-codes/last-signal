// src/ui/screens/repair-console/console-model.js
//
// What the repair console's shell shows for a system's repair state and the player's fuel —
// pure (no DOM), tested in tests/repair-console-model.test.js. The panels themselves only need
// the step index (0 untouched, 1 partial, 2 full).

import { REPAIR_STATES } from '../../../systems/system-repair-allocation.js';

export const STEP_NAMES = Object.freeze(['Untouched', 'Partial', 'Full']);

/** 'untouched' | 'partial' | 'repaired' -> 0 | 1 | 2 (unknown reads as untouched). */
export function repairStep(state) {
  if (state === REPAIR_STATES.REPAIRED) return 2;
  if (state === REPAIR_STATES.PARTIAL) return 1;
  return 0;
}

function cellsText(n) {
  return `${n} Fuel Cell${n === 1 ? '' : 's'}`;
}

/**
 * @param {string} state   repair state from SystemRepairAllocation.getState()
 * @param {number} banked  fuel cells the player has
 * @param {number} cost    fuel cells one repair step costs
 * @returns {{
 *   step: 0|1|2,
 *   stepName: string,
 *   segments: Array<'bad'|'done'|'now'|''>,
 *   prompt: { label: string, denied: boolean, done: boolean },
 * }}
 *   segments: the three System state cells. Steps already passed are 'done', the current one is
 *   'now', and Untouched is outlined red ('bad') while it is current.
 *   prompt: "Repair (2 Fuel Cells)"; muted "Repair (0 / 2 Fuel Cells)" when unaffordable (same
 *   have / need rule as the world prompts); "System Restored" with no [E] once fully repaired.
 */
export function consoleView(state, banked, cost) {
  const step = repairStep(state);
  const have = Math.max(0, Math.floor(Number(banked) || 0));
  const segments = [0, 1, 2].map((i) => {
    if (step === 0 && i === 0) return 'bad';
    if (i < step) return 'done';
    if (i === step) return 'now';
    return '';
  });

  let prompt;
  if (step === 2) prompt = { label: 'System Restored', denied: false, done: true };
  else if (have >= cost)
    prompt = { label: `Repair (${cellsText(cost)})`, denied: false, done: false };
  else prompt = { label: `Repair (${have} / ${cellsText(cost)})`, denied: true, done: false };

  return { step, stepName: STEP_NAMES[step], segments, prompt };
}
