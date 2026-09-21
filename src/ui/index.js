// src/ui/index.js
//
// Entry point for all in-game UI: main menu, options, pause, loading, credits, and the HUD.
//
//   const ui = initUI({ canvas: renderer.domElement });   // BEFORE any asset loads
//   ui.getState() / ui.subscribe(fn)                      // gate the game loop on 'playing'
//
// ---------------------------------------------------------------------------------------------
// WIRING — things that are built and waiting on game systems. Grep for TODO(wire) to find them.
//
//   resetLevel()   Alex — restart without location.reload(). Register it and Pause > Restart
//                  Level, plus New Game after "Quit to Main Menu", switch on by themselves:
//                    ui.registerHooks({ resetLevel });                       (see main.js)
//   lockPointer()  Nonku's mouse-look — Resume calls it (from a click, as browsers require) to
//                  re-lock the mouse:  ui.registerHooks({ lockPointer });
//   fuel count     Whoever owns FuelSystem — call ui.setFuelCount(n) whenever it changes.
//                  (No FuelSystem instance exists in main.js yet, so the panel reads 00.)
//   interact       Partly wired: the level calls setInteractPrompt() from ui/hud.js directly
//                  (labels, denied state and detail, object anchor — see the header of hud.js).
//                  Still to wire on the level side: per-object labels ("Collect Fuel Cell",
//                  "Open Door" + "2 / 4 Fuel Cells" when denied) and the anchor position.
//   sfx / music    Audio manager — settings.subscribe() and read sfxVolume / musicVolume (0-100).
//   captions       The AI-voice caption bar reads settings.get().captions (also mirrored on
//                  body[data-captions]); the bar itself is not built yet.
//   level theme    Level-transition code calls ui.setLevel('l2' | 'l3') so the accent/backdrop,
//                  pause overlay and loading screen follow the level.
//   Continue       Whether "Quit to Main Menu" keeps the run is Alex's call — flip
//                  keepSessionOnQuit below.
// ---------------------------------------------------------------------------------------------

import './ui.css';
import { installStageScaling } from './stage.js';
import { createUiState, STATES } from './ui-state.js';
import { createSettings, brightnessToFactor, hudOpacityToCss } from './settings.js';
import { createTipPicker } from './tips.js';
import { trackAssetProgress } from './asset-progress.js';
import { createHud } from './hud.js';
import { createScreenManager } from './screen-manager.js';
import { FIRST_LEVEL_ID } from '../config/levels.js';

export { STATES };

/**
 * @param {object} [options]
 * @param {HTMLCanvasElement} [options.canvas] the game canvas (Brightness is applied to it)
 */
export function initUI({ canvas = null } = {}) {
  // Must run before the level and player start loading so their assets are counted.
  const progress = trackAssetProgress();

  installStageScaling();

  const settings = createSettings();
  const state = createUiState({ keepSessionOnQuit: true });
  const hooks = {};
  const hud = createHud();

  let levelId = FIRST_LEVEL_ID;
  function setLevel(id) {
    levelId = id;
    document.body.dataset.level = id;
  }
  setLevel(levelId);

  function applySettings(values) {
    document.documentElement.style.setProperty(
      '--hud-opacity',
      String(hudOpacityToCss(values.hudOpacity))
    );
    if (canvas) {
      const factor = brightnessToFactor(values.brightness);
      canvas.style.filter = factor === 1 ? '' : `brightness(${factor})`;
    }
    document.body.dataset.captions = values.captions ? 'on' : 'off';
  }
  settings.subscribe(applySettings);
  applySettings(settings.get());

  const manager = createScreenManager({
    state,
    settings,
    hooks,
    progress,
    tipPicker: createTipPicker(),
    hud,
    getLevelId: () => levelId,
    setLevel,
    firstLevelId: FIRST_LEVEL_ID,
  });
  document.body.append(manager.root);

  return {
    settings,
    getState: () => state.getState(),
    subscribe: (listener) => state.subscribe(listener),
    registerHooks: (partial) => Object.assign(hooks, partial),
    setLevel,
    setFuelCount: (count) => hud.setFuelCount(count),
  };
}
