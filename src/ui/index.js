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
//                  One hook, told which kind of reset by its argument:
//                    resetLevel({ full: true })   New Game over an existing run: back to L1,
//                                                 zero banked fuel, no repair flags, checkpoint
//                                                 ignored.
//                    resetLevel({ full: false })  Pause > Restart Level: the current level again,
//                                                 from its checkpoint if one has been passed.
//   lockPointer()  Nonku's mouse-look — Resume calls it (from a click, as browsers require) to
//                  re-lock the mouse:  ui.registerHooks({ lockPointer });
//   fuel count     Wired: main.js reads level1.group.userData.fuelSystem.banked every frame and
//                  calls ui.setFuelCount() (which ignores repeats). If the level ever stops
//                  exposing fuelSystem there, main.js warns and the panel reads 00.
//   oxygen/health  Wired (L2): main.js reads level.group.userData.oxygenSystem every frame and
//                  calls ui.setOxygen(fraction) / ui.setHealth(health / 100). The meters only
//                  show on L2/L3 (the level sets that via setLevel).
//   warnings       Gravity (Natasha/Alex — gravity-system.js is empty so far). One banner slot:
//                    ui.setWarning('Life Support Fault Detected', { pulse: true })  L2 arrival cue
//                    ui.setWarning('Gravity Field Destabilizing', { icon: 'gravity', pulse: true })
//                    ui.setGraceWindow(0..1)   grace bar under the banner (1 = full); null hides
//                    ui.triggerAlarm()         two light drops (one slow dim w/ Reduce Flashing)
//                    ui.setWarning(null)       clears the banner and its bar
//   L3 threats     ui.setHullBreach(secondsLeft | null) and ui.setScrubbersOffline(bool) — the
//                  marker only if Scrubbers are still broken on entry to L3
//                  (repairs.getState('oxygen-scrubbers') !== 'repaired').
//   power readout  ui.setPower(0-100) once power-allocation.js is live; until then each level
//                  shows the mockup's value (100 / 61 / 19).
//   interact       Wired: the levels call setInteractPrompt() from ui/hud.js with per-object
//                  copy from ui/prompt-copy.js and the object as `target`; main.js calls
//                  ui.syncPrompt(camera) after the camera moves to lock the brackets onto it.
//                  New interactables: give them userData.prompt or userData.getPrompt().
//   sfx / music    Audio manager — settings.subscribe() and read sfxVolume / musicVolume (0-100).
//   captions       Whoever plays an AI voice line calls ui.setCaption('line') and
//                  ui.setCaption(null) when it ends. Options > AI Voice Captions hides the bar
//                  (body[data-captions]).
//   flashing       Options > Reduce Flashing sets body[data-reduce-flashing]; hud.css handles
//                  it, nothing to wire.
//   level theme    Level-transition code calls ui.setLevel('l2' | 'l3') so the accent/backdrop,
//                  pause overlay and loading screen follow the level.
//   level loads    ui.enterLevel('l2' | 'l3') during a transition: sets the theme and shows the
//                  loading screen (real asset progress, min 0.7s), then play resumes on its own.
//                  main.js does this for L1 -> L2; L2 -> L3 should do the same.
//   Continue       Whether "Quit to Main Menu" keeps the run is Alex's call — flip
//                  keepSessionOnQuit below.
// ---------------------------------------------------------------------------------------------

import './ui.css';
import { installStageScaling } from './stage.js';
import { createUiState, STATES, ACTIONS } from './ui-state.js';
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
    hud.setLevel(id);
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
    document.body.dataset.reduceFlashing = values.reduceFlashing ? 'on' : 'off';
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
    /** Level transition: theme the destination and show the loading screen until it loads. */
    enterLevel(id) {
      setLevel(id);
      return state.send(ACTIONS.ENTER_LEVEL);
    },
    setFuelCount: (count) => hud.setFuelCount(count),
    setOxygen: (fraction) => hud.setOxygen(fraction),
    setHealth: (fraction) => hud.setHealth(fraction),
    setPower: (percent) => hud.setPower(percent),
    setCaption: (text, options) => hud.setCaption(text, options),
    setWarning: (label, options) => hud.setWarning(label, options),
    setGraceWindow: (fraction) => hud.setGraceWindow(fraction),
    triggerAlarm: () => hud.triggerAlarm(),
    setHullBreach: (seconds) => hud.setHullBreach(seconds),
    setScrubbersOffline: (offline) => hud.setScrubbersOffline(offline),
    /** Lock the interaction prompt onto its object; call once a frame after the camera moves. */
    syncPrompt: (camera) => hud.syncInteractPrompt(camera),
  };
}
