// src/ui/prompt-copy.js
//
// What the interaction prompt says for each kind of object, in one place so L1 and L2 read the
// same. Pure (no DOM, no Three.js) — tested in tests/prompt-copy.test.js.
//
// Copy rules (Shannon, Oct 2026):
//   - Anything that costs fuel shows what it costs, always: "[E] Open Door | 2 Fuel Cells".
//     When the player can't afford it the same prompt goes muted (denied). No "1 / 2" fraction —
//     the Fuel Cells panel already shows what they have.
//   - Fuel cells are auto-pickup, so their prompt is a hint: brackets + label, no [E] badge.
//   - Repair stations always open their console: "[E] Access Console | Gravity Stabilizers",
//     detail "Fully Repaired" once done. The cost/denial lives inside the console.

/** "1 Fuel Cell" / "2 Fuel Cells" */
export function fuelCellsText(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  return `${n} Fuel Cell${n === 1 ? '' : 's'}`;
}

/**
 * A prompt for an action that spends fuel: always shows the cost, muted when unaffordable.
 * @param {string} label   e.g. 'Open Door'
 * @param {number} cost    fuel cells the action spends
 * @param {number} banked  fuel cells the player has
 */
export function costPrompt(label, cost, banked) {
  return { label, detail: fuelCellsText(cost), denied: !(Number(banked) >= cost) };
}

export const FUEL_CELL_HINT = Object.freeze({ label: 'Collect Fuel Cell', hint: true });

export const SYSTEM_NAMES = Object.freeze({
  'oxygen-scrubbers': 'Oxygen Scrubbers',
  'gravity-stabilizers': 'Gravity Stabilizers',
  'comms-array': 'Comms Array',
});

/** Repair station prompt: always opens the console. */
export function stationPrompt(systemId, repaired) {
  return {
    label: 'Access Console',
    detail: repaired ? 'Fully Repaired' : (SYSTEM_NAMES[systemId] ?? ''),
  };
}

// Door states (door-system.js) in which E still does something.
const ACTIONABLE_DOOR_STATES = new Set(['locked', 'unlocked']);

/**
 * The prompt for whatever interactable the player is nearest, or null for none.
 *   - userData.getPrompt(fuelSystem)  dynamic copy (stations, terminal, command door)
 *   - userData.prompt                 static copy
 *   - door-system doors: "Open Door", with the fuel gate's cost while locked (applyFuelGate
 *     stores the gate on userData.fuelGate); nothing while opening/open
 * Fuel cells return null here: they are hinted separately (see FUEL_CELL_HINT).
 * @param {{userData?: object}|null} object
 * @param {{banked:number}|null} fuelSystem
 * @returns {{label:string, detail?:string, denied?:boolean, hint?:boolean, tone?:string}|null}
 */
export function promptForInteractable(object, fuelSystem) {
  const data = object?.userData;
  if (!data || data.isFuelCell) return null;
  if (typeof data.getPrompt === 'function') return data.getPrompt(fuelSystem) ?? null;

  if (data.state !== undefined) {
    if (!ACTIONABLE_DOOR_STATES.has(data.state)) return null;
    if (data.state === 'locked' && data.fuelGate) {
      return costPrompt('Open Door', data.fuelGate.cost, fuelSystem?.banked ?? 0);
    }
    return { label: 'Open Door' };
  }
  return data.prompt ?? { label: 'Interact' };
}
