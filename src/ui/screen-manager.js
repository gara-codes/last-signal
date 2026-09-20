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

  const api = {
    settings,
    hasSession: () => state.hasSession(),
    canReset: () => typeof hooks.resetLevel === 'function',
    getLevelId,
    pickTip: () => tipPicker.next(getLevelId()),
    getLoadProgress: () => progress.getProgress(),
    isLoaded: () => progress.isDone(),
    mouseReleasedByBrowser: () => mouseReleasedByBrowser,

    newGame() {
      // Starting over while a run exists needs resetLevel() (main-menu.js disables the row
      // when it isn't registered).
      if (state.hasSession()) hooks.resetLevel?.();
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
      hooks.resetLevel();
      api.resume();
    },
  };

  const screens = {
    [STATES.MAIN_MENU]: createMainMenuScreen(api),
    [STATES.LOADING]: createLoadingScreen(api),
    [STATES.PAUSED]: createPauseScreen(api),
    [STATES.OPTIONS]: createOptionsScreen(api),
    [STATES.CREDITS]: createCreditsScreen(api),
  };

  root.append(hud.element);
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
    if (state.send(ACTIONS.ESCAPE)) event.preventDefault();
  });

  // Mouse-look uses pointer lock; the browser force-releases it on Escape whatever we do,
  // so losing it mid-game has to open the pause overlay.
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement || state.getState() !== STATES.PLAYING) return;
    // Set before the state change so the pause screen's hint is right the first time it shows.
    mouseReleasedByBrowser = true;
    lastLockLossAt = window.performance.now();
    state.send(ACTIONS.POINTER_LOCK_LOST);
  });

  render(state.getState());

  return { root, api };
}
