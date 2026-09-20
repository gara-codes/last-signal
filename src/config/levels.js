// src/config/levels.js
//
// Level ids match the body[data-level] hooks in src/ui/theme.css ('l2', 'l3'; L1 is the
// default look). Display names are what the loading screen shows as the sector name.

export const LEVELS = {
  l1: { id: 'l1', name: 'Habitation Ring' },
  l2: { id: 'l2', name: 'Engineering Core' },
  l3: { id: 'l3', name: 'Docking Corridor' },
};

export const FIRST_LEVEL_ID = 'l1';

export function getLevel(id) {
  return LEVELS[id] ?? LEVELS[FIRST_LEVEL_ID];
}
