// src/ui/screen-manager.js
//
// The thin DOM layer over ui-state.js: mounts every screen once, shows the one that matches the
// current state, and turns browser events (Escape, pointer-lock release) into state actions.
// Screens never touch the state machine directly — they call the small `api` object below.

import { ACTIONS, STATES } from './ui-state.js';
import { el } from './dom.js';
import { createMainMenuScreen } from './screens/main-menu.js';
import { createOptionsScreen } from './screens/options.js';
import { createPauseScreen } from './screens/pause.js';
import { createLoadingScreen } from './screens/loading.js';
import { createCreditsScreen } from './credits.js';
import { createRepairConsole } from './screens/repair-console/repair-console.js';
import { createRestartScreen } from './screens/restart.js';
import { createLogOverlay } from './screens/log-overlay.js';
import { createShipStatus } from './ship-status.js';

// The browser releases the mouse on Escape and then may ALSO deliver the Escape keydown. If the
// lock-release already paused the game, that keydown must not immediately resume it.
const ESCAPE_AFTER_LOCK_LOSS_MS = 250;

export function createScreenManager({
  state,
  settings,
  hooks,
  progress,
  tipPicker,
  hud,
  getLevelId,
  setLevel,
  firstLevelId,
}) {
  const root = el('div', { className: 'ui-root', attrs: { id: 'ui-root' } });
  let mouseReleasedByBrowser = false;
  let lastLockLossAt = -Infinity;
  // After a death the world is left dead even once the run is dropped, so starting again needs
  // resetLevel() just like starting over a live run does.
  let worldSpent = false;

  const api = {
    settings,
    hasSession: () => state.hasSession(),
    /** True when New Game must reset the world first: a run exists, or the last one died. */
    needsReset: () => state.hasSession() || worldSpent,
    canReset: () => typeof hooks.resetLevel === 'function',
    getLevelId,
    pickTip: () => tipPicker.next(getLevelId()),
    getLoadProgress: () => progress.getProgress(),
    isLoaded: () => progress.isDone(),
    mouseReleasedByBrowser: () => mouseReleasedByBrowser,

    newGame() {
      // Starting over while a run exists needs resetLevel() (main-menu.js disables the row
      // when it isn't registered). A full wipe: back to L1, zero fuel, no repairs, no checkpoint.
      if (api.needsReset()) hooks.resetLevel?.({ full: true });
      worldSpent = false;
      setLevel(firstLevelId); // the loading screen takes the destination level's theme
      state.send(ACTIONS.NEW_GAME);
    },
    continueGame: () => state.send(ACTIONS.CONTINUE),
    openOptions: () => state.send(ACTIONS.OPEN_OPTIONS),
    openCredits: () => state.send(ACTIONS.OPEN_CREDITS),
    back: () => state.send(ACTIONS.BACK),
    finishLoading: () => state.send(ACTIONS.LOADED),
    quitToMenu: () => state.send(ACTIONS.QUIT_TO_MENU),

    // Resume/Restart come from a click, which is the user gesture browsers require before the
    // mouse can be locked again.
    resume() {
      if (state.send(ACTIONS.RESUME)) hooks.lockPointer?.();
    },
    restartLevel() {
      if (typeof hooks.resetLevel !== 'function') return;
      // Mid-run recovery: the current level again, from its checkpoint if one has been passed.
      // Shown through the loading screen; the mouse is re-locked now, while we still have the
      // click (browsers only allow pointer lock from a user gesture).
      hooks.resetLevel({ full: false });
      if (state.send(ACTIONS.RESTART_LEVEL)) {
        worldSpent = false;
        hooks.lockPointer?.();
      }
    },
    /** Log overlay: E (a key press, so the mouse can be re-locked) or Esc / the Close button. */
    closeLog({ relock = false } = {}) {
      if (state.send(ACTIONS.CLOSE_LOG) && relock) hooks.lockPointer?.();
    },
  };

  const screens = {
    [STATES.MAIN_MENU]: createMainMenuScreen(api),
    [STATES.LOADING]: createLoadingScreen(api),
    [STATES.PAUSED]: createPauseScreen(api),
    [STATES.OPTIONS]: createOptionsScreen(api),
    [STATES.CREDITS]: createCreditsScreen(api),
    [STATES.DEAD]: createRestartScreen(api),
    [STATES.READING]: createLogOverlay(api),
  };

  // L2 repair consoles: an overlay during play (the world keeps running), above the HUD and
  // under pause/menus. Opened by the level; closed here on Esc and when play ends.
  const repairConsole = createRepairConsole();
  // TAB Ship Status: hold to view during play (not over an open repair console).
  const shipStatus = createShipStatus({
    canOpen: () => state.getState() === STATES.PLAYING && !repairConsole.isOpen(),
    getLevelId,
    getRepairFlags: () => hooks.getRepairFlags?.() ?? null,
  });
  root.append(hud.element, repairConsole.element, shipStatus.element);
  for (const screen of Object.values(screens)) root.append(screen.element);

  let active = null;

  function render(current) {
    const next = screens[current] ?? null;

    if (active && active !== next) {
      active.element.hidden = true;
      active.onHide();
    }
    if (next && next !== active) {
      next.element.hidden = false;
      next.onShow();
    }
    active = next;

    hud.setVisible(current === STATES.PLAYING || current === STATES.PAUSED);
    hud.setDimmed(current === STATES.PAUSED);
    repairConsole.setVisible(current === STATES.PLAYING || current === STATES.PAUSED);
    repairConsole.setPaused(current === STATES.PAUSED);
    if (current !== STATES.PLAYING) shipStatus.hide();
    if (current !== STATES.PLAYING && current !== STATES.PAUSED && current !== STATES.OPTIONS) {
      repairConsole.close();
    }
    document.body.dataset.uiState = current;
  }

  state.subscribe((current, previous) => {
    if (current === STATES.PLAYING) mouseReleasedByBrowser = false;
    // Whatever had keyboard focus (a menu button) is going away; don't leave it holding
    // Space/Enter presses meant for the game.
    if (previous !== STATES.PLAYING && current === STATES.PLAYING) document.activeElement?.blur();
    render(current);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.repeat) return;
    if (window.performance.now() - lastLockLossAt < ESCAPE_AFTER_LOCK_LOSS_MS) return;
    // Esc backs out of an open repair console first, instead of pausing.
    if (state.getState() === STATES.PLAYING && repairConsole.isOpen()) {
      repairConsole.close();
      event.preventDefault();
      return;
    }
    if (state.send(ACTIONS.ESCAPE)) event.preventDefault();
  });

  // Mouse-look uses pointer lock; the browser force-releases it on Escape whatever we do,
  // so losing it mid-game has to open the pause overlay.
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement || state.getState() !== STATES.PLAYING) return;
    // Esc at a repair console: the browser drops the mouse first. Treat it as closing the console,
    // not as pausing; a click on the game grabs the mouse again.
    if (repairConsole.isOpen()) {
      repairConsole.close();
      lastLockLossAt = window.performance.now();
      return;
    }
    // Set before the state change so the pause screen's hint is right the first time it shows.
    mouseReleasedByBrowser = true;
    lastLockLossAt = window.performance.now();
    state.send(ACTIONS.POINTER_LOCK_LOST);
  });

  render(state.getState());

  return {
    root,
    api,
    /** Death: show the Restart screen with this run's summary (see screens/restart-model.js). */
    showRestart(info) {
      screens[STATES.DEAD].setInfo(info);
      if (!state.send(ACTIONS.DIE)) return false;
      worldSpent = true;
      document.exitPointerLock?.(); // the buttons need the mouse
      return true;
    },
    /** Open the log overlay on entries[index]; pauses the world and frees the mouse. */
    openLog(entries, index = 0) {
      screens[STATES.READING].setEntries(entries, index);
      if (!state.send(ACTIONS.OPEN_LOG)) return false;
      document.exitPointerLock?.();
      return true;
    },
  };
}
