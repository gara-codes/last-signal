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
//   resetLevel()   Wired (main.js) — restarts without location.reload(). The UI calls it only
//                  after the state machine has moved to LOADING, so the world is rebuilt while
//                  nothing is drawn. One hook, told which kind of reset by its argument:
//                    resetLevel({ full: true })   New Game over an existing run (or after a
//                                                 death): back to L1, zero fuel, no repairs,
//                                                 no checkpoint.
//                    resetLevel({ full: false })  Pause > Restart Level and the Restart screen's
//                                                 Restart Level: the current level again (L2
//                                                 fresh, with the fuel carried in from L1).
//                    resetLevel({ full: false, fromCheckpoint: true })  the Restart screen's
//                                                 Restart From Checkpoint (L2, once the override
//                                                 is collected): L2 rebuilt as it was there
//                                                 (createLevel2({ checkpoint })).
//                  L3 needs a branch in main.js's resetLevel() once it exists.
//   lockPointer()  Wired (main.js): requestPointerLock on the canvas. Resume, Restart and closing
//                  a log with E call it from their click / key press, as browsers require.
//   fuel count     Wired: main.js reads level1.group.userData.fuelSystem.banked every frame and
//                  calls ui.setFuelCount() (which ignores repeats). If the level ever stops
//                  exposing fuelSystem there, main.js warns and the panel reads 00.
//   fuel total     Wired: on each level load main.js calls ui.setFuelTotal(carried in + cells
//                  placed), read from level.group.userData.fuelCellsPlaced. Fixed for the
//                  level; L3 should set it the same way (or null to hide it).
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
//   sfx / music    Wired: src/audio/audio-manager.js subscribes via ui.settings and applies
//                  sfxVolume / musicVolume (0-100) to its two buses live. Still needs real
//                  assets in place of the placeholder tones preloaded in main.js.
//   captions       Whoever plays an AI voice line calls ui.setCaption('line') and
//                  ui.setCaption(null) when it ends. Options > AI Voice Captions hides the bar
//                  (body[data-captions]).
//   flashing       Options > Reduce Flashing sets body[data-reduce-flashing]; hud.css and the
//                  repair consoles handle it, nothing to wire.
//   graphics       Options > Graphics Quality: 'low' | 'medium' | 'high' (default 'high' until the
//                  benchmark says otherwise). Natasha's PostFx applies it — once it is created
//                  in main.js:  postFx.setQuality(ui.settings.get().graphicsQuality);
//                               ui.settings.subscribe((s) => postFx.setQuality(s.graphicsQuality));
//                  Also mirrored to body[data-graphics-quality].
//   death          Wired (L2): main.js calls ui.showRestart({ levelId, fuelCells, repairs,
//                  checkpointReached }) once per death when oxygenSystem.isDead. L3 should call
//                  it the same way.
//   logs           ui.openLog([{ id, title, body: ['line', { redacted: 16 }, ...], corrupted }],
//                  index) from whatever the player reads (no logs are placed yet). Pauses the
//                  world; E / Esc closes.
//   ship status    Hold TAB in play (ui/ship-status.js). Wired: main.js registers
//                  ui.registerHooks({ getRepairFlags }) — L2's live repairs.exportFlags(); L3
//                  should return the flags L2 handed over. L1 needs none (all nominal).
//   repair console Wired (L2): E at a station opens its console (props.js), E again repairs a
//                  step, Esc / walking away closes it. API: ui/screens/repair-console/.
//   level theme    Level-transition code calls ui.setLevel('l2' | 'l3') so the accent/backdrop,
//                  pause overlay and loading screen follow the level.
//   Continue       Whether "Quit to Main Menu" keeps the run is Alex's call — flip
//                  keepSessionOnQuit below.
// ---------------------------------------------------------------------------------------------

import './ui.css';
import { installStageScaling } from './stage.js';
import { createUiState, STATES } from './ui-state.js';
import { createSettings, brightnessToFactor, hudOpacityLayers } from './settings.js';
import { createTipPicker } from './tips.js';
import { trackAssetProgress } from './asset-progress.js';
import { createHud } from './hud.js';
import { createScreenManager } from './screen-manager.js';
import { FIRST_LEVEL_ID } from '../config/levels.js';

export { STATES };

/**
 * @param {object} [options]
 * @param {HTMLCanvasElement} [options.canvas] the game canvas (Brightness is applied to it)
 * @param {string} [options.initialLevelId] the level New Game starts on and the HUD opens with —
 *   L1 normally; main.js passes 'l2' for the ?level=l2 dev start.
 */
export function initUI({ canvas = null, initialLevelId = FIRST_LEVEL_ID } = {}) {
  // Must run before the level and player start loading so their assets are counted.
  const progress = trackAssetProgress();

  installStageScaling();

  const settings = createSettings();
  const state = createUiState({ keepSessionOnQuit: true });
  const hooks = {};
  const hud = createHud();

  let levelId = initialLevelId;
  function setLevel(id) {
    levelId = id;
    document.body.dataset.level = id;
    hud.setLevel(id);
  }
  setLevel(levelId);

  function applySettings(values) {
    // HUD Opacity: boxes fade to the slider value, text/icons fade far less (settings.js).
    const hudLayers = hudOpacityLayers(values.hudOpacity);
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--hud-opacity', String(hudLayers.box));
    rootStyle.setProperty('--hud-content-opacity', String(hudLayers.content));
    rootStyle.setProperty('--hud-box-factor', String(hudLayers.boxFactor));
    if (canvas) {
      const factor = brightnessToFactor(values.brightness);
      canvas.style.filter = factor === 1 ? '' : `brightness(${factor})`;
    }
    document.body.dataset.captions = values.captions ? 'on' : 'off';
    document.body.dataset.reduceFlashing = values.reduceFlashing ? 'on' : 'off';
    document.body.dataset.graphicsQuality = values.graphicsQuality;
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
    firstLevelId: initialLevelId,
  });
  document.body.append(manager.root);

  return {
    settings,
    getState: () => state.getState(),
    subscribe: (listener) => state.subscribe(listener),
    registerHooks: (partial) => Object.assign(hooks, partial),
    setLevel,
    setFuelCount: (count) => hud.setFuelCount(count),
    /** The level's total fuel cells (carried in + placed), shown as "/ 11"; null hides it. */
    setFuelTotal: (total) => hud.setFuelTotal(total),
    setOxygen: (fraction) => hud.setOxygen(fraction),
    setHealth: (fraction) => hud.setHealth(fraction),
    setPower: (percent) => hud.setPower(percent),
    setCaption: (text, options) => hud.setCaption(text, options),
    setWarning: (label, options) => hud.setWarning(label, options),
    setGraceWindow: (fraction) => hud.setGraceWindow(fraction),
    triggerAlarm: () => hud.triggerAlarm(),
    setHullBreach: (seconds) => hud.setHullBreach(seconds),
    setScrubbersOffline: (offline) => hud.setScrubbersOffline(offline),
    /** Death: the Restart ("Signal Lost") screen. See screens/restart-model.js for `info`. */
    showRestart: (info) => manager.showRestart(info),
    /** Open the log reading overlay (pauses the world). See screens/log-overlay.js. */
    openLog: (entries, index) => manager.openLog(entries, index),
    /** Lock the interaction prompt onto its object; call once a frame after the camera moves. */
    syncPrompt: (camera) => hud.syncInteractPrompt(camera),
  };
}
