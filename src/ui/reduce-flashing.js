// src/ui/reduce-flashing.js
//
// Single place that reads Options > Reduce Flashing off the DOM (ui/index.js sets
// body[data-reduce-flashing] from the settings toggle). Anything that needs to react to the
// setting — lighting rigs, HUD effects, repair consoles — imports this instead of touching
// document.body.dataset directly, so there is one spot to change if the flag ever moves.
export function readReduceFlashing() {
  return typeof document !== 'undefined' && document.body?.dataset.reduceFlashing === 'on';
}
