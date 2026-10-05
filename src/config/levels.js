// src/config/levels.js
//
// Level ids match the body[data-level] hooks in src/ui/theme.css ('l2', 'l3'; L1 is the
// default look). Display names are what the loading screen shows as the sector name.

// sector: the number the HUD and the Restart screen show ("ENGINEERING CORE // SEC. 2").
export const LEVELS = {
  l1: { id: 'l1', name: 'Habitation Ring', sector: 1 },
  l2: { id: 'l2', name: 'Engineering Core', sector: 2 },
  l3: { id: 'l3', name: 'Docking Corridor', sector: 3 },
};

export const FIRST_LEVEL_ID = 'l1';

export function getLevel(id) {
  return LEVELS[id] ?? LEVELS[FIRST_LEVEL_ID];
}

/** "Engineering Core // Sec. 2" (callers upper-case it where the design does). */
export function sectorLabel(id) {
  const level = getLevel(id);
  return `${level.name} // Sec. ${level.sector}`;
}

/** How many levels come before this one (L1 0, L2 1, L3 2) — "Sectors Cleared". */
export function levelIndex(id) {
  return Math.max(0, Object.keys(LEVELS).indexOf(getLevel(id).id));
}
