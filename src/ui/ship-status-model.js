// src/ui/ship-status-model.js
//
// What the TAB Ship Status panel says — pure, tested in tests/ship-status-model.test.js.
// It stays vague on purpose (Yannis): states and plain words only, no readouts, costs or fuel.
//
//   L1  everything nominal in L1 blue; introduces the cryo bay
//   L2  each system's live repair state: status word + Untouched / Partial / Full strip
//   L3  the link is revoked: strips become "ACCESS DENIED", the steps fade out, and only the
//       status words still carry what L2 left behind

import { getLevel } from '../config/levels.js';

const STEP = { untouched: 0, partial: 1, repaired: 2 };

export const SHIP_SYSTEMS = Object.freeze([
  {
    id: 'gravity-stabilizers',
    theme: 'gravity',
    name: 'Gravity Stabilizers',
    where: 'ENGINEERING CORE // DECK 2',
    words: ['Field unstable', 'Field weak', 'Field stable'],
    l3Words: ['Field failing', 'Field unstable', 'Field holding'],
  },
  {
    id: 'comms-array',
    theme: 'comms',
    name: 'Comms Array',
    where: 'SIGNAL // EXT. HULL',
    words: ['No carrier', 'Intermittent', 'Link open'],
    l3Words: ['Dark', 'Signal degraded', 'Link open'],
  },
  {
    id: 'oxygen-scrubbers',
    theme: 'oxygen',
    name: 'Oxygen Scrubbers',
    where: 'LIFE SUPPORT // BAY 2',
    words: ['Reserve draining', 'Reserve holding', 'Reserve recovering'],
    l3Words: ['Offline', 'Reserve low', 'Reserve stable'],
  },
]);

const OBJECTIVES = {
  l1: 'Collect fuel cells to unlock the habitation door',
  l2: 'Restore what you can, then reach the command center',
  l3: 'Reach the escape pod before the hull breaches',
};

// Draft — to be finalised with the rest of the AI dialogue.
export const L3_AI_LINE = "You don't need to see this anymore.";

function podNote(levelId, step) {
  if (levelId === 'l1') return { text: 'CRYO BAY · 3 CREW IN STASIS · ALL SUSTAINED', bad: false };
  const sustained = [0, 2, 3][step];
  if (levelId === 'l3') {
    const read =
      sustained === 3 ? 'SIGNAL STEADY' : sustained === 0 ? 'NO LIFE SIGNS READ' : 'ONE POD SILENT';
    return { text: `CRYO BAY · ${read}`, bad: sustained < 3 };
  }
  const read =
    sustained === 3
      ? 'ALL PODS SUSTAINED'
      : sustained === 0
        ? 'ALL PODS FAILING'
        : 'ONE POD FAILING';
  return { text: `CRYO BAY · ${read}`, bad: sustained < 3 };
}

/**
 * @param {string} levelId 'l1' | 'l2' | 'l3'
 * @param {Object<string,string>|null} [repairs] systemId -> 'untouched' | 'partial' | 'repaired'
 *   (L2 live, or the flags L2 handed to L3). Ignored on L1.
 */
export function shipStatusView(levelId, repairs = null) {
  const level = getLevel(levelId);
  const id = level.id;
  const systems = SHIP_SYSTEMS.map((s) => {
    const step = id === 'l1' ? 2 : (STEP[repairs?.[s.id]] ?? 0);
    let word;
    let tone; // 'bad' red, 'warn' amber, 'ok' system colour, 'muted' grey (L3 holding up)
    if (id === 'l1') {
      word = 'Nominal';
      tone = 'ok';
    } else {
      word = (id === 'l3' ? s.l3Words : s.words)[step];
      tone = step === 0 ? 'bad' : step === 1 ? 'warn' : id === 'l3' ? 'muted' : 'ok';
    }
    // L1 says NOMINAL in the last cell instead of FULL; L3 shows no steps at all (faded)
    const segLabels = ['UNTOUCHED', 'PARTIAL', id === 'l1' ? 'NOMINAL' : 'FULL'];
    const segments =
      id === 'l3'
        ? ['', '', '']
        : [0, 1, 2].map((i) => {
            if (step === 0 && i === 0) return 'bad';
            if (i < step) return 'done';
            if (i === step) return 'now';
            return '';
          });
    return { ...s, step, word, tone, segLabels, segments };
  });
  return {
    levelId: id,
    location: `${level.name.toUpperCase()} // ${id === 'l3' ? 'COMMAND LINK REVOKED' : 'COMMAND LINK'}`,
    objective: OBJECTIVES[id],
    systems,
    pods: podNote(id, systems[2].step),
    denied: id === 'l3',
    aiLine: id === 'l3' ? L3_AI_LINE : null,
  };
}
