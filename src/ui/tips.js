// src/ui/tips.js
//
// Loading-screen tips, per level. A tip must only mention things the player can actually do (or
// see) in that level — L1 is a tutorial space, so its tips teach L1 things. Draft copy: edit
// freely, the picker just needs at least one entry per level it is asked about.
//
// The screen adds the "Tip:" prefix; do not include it here.

export const TIPS = {
  // Shown for any level that has no pool of its own yet.
  generic: ['Move with W A S D. Hold Shift to run, and press Space to jump.'],

  l1: [
    'Move with W A S D. Hold Shift to run, and press Space to jump.',
    'Fuel cells open doors. Whatever you don’t spend carries over to the next level.',
    'Locked doors have a power panel nearby. Wake the panel, then the door.',
    'Not every fuel cell is on the main path. Check the corners of the ring.',
    'Your fuel cell count sits in the top-left corner. Check it before you try a door.',
  ],

  // Not shown until Level 2 exists.
  // TODO(confirm): repairs persisting across death is Alex/Yannis's call. "Beacon" was
  // dropped on purpose — there is exactly one checkpoint (the L2 command-center door).
  l2: ['Repaired systems stay repaired, even if you die and restart from the checkpoint.'],
};

/**
 * Picks a tip for a level, never the same one twice in a row (when the pool has a choice).
 * `random` is injectable so tests are deterministic.
 */
export function createTipPicker({ tips = TIPS, random = Math.random } = {}) {
  let last = null;

  return {
    next(levelId) {
      const pool = tips[levelId]?.length ? tips[levelId] : tips.generic;
      const candidates = pool.length > 1 ? pool.filter((tip) => tip !== last) : pool;
      const pick = candidates[Math.floor(random() * candidates.length)] ?? candidates[0];
      last = pick;
      return pick;
    },
  };
}
