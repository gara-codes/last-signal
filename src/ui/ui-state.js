// src/ui/ui-state.js
//
// Pure state machine for which UI screen is up. No DOM in here, so it is unit-tested in
// tests/ui-state.test.js; screen-manager.js is the thin layer that turns state into visible
// screens and turns browser events (Escape, pointer-lock release) into actions.

export const STATES = {
  MAIN_MENU: 'main-menu',
  LOADING: 'loading',
  PLAYING: 'playing',
  PAUSED: 'paused',
  OPTIONS: 'options',
  CREDITS: 'credits',
};

export const ACTIONS = {
  NEW_GAME: 'new-game', // main menu -> loading
  CONTINUE: 'continue', // main menu -> playing (only with a session in progress)
  LOADED: 'loaded', // loading -> playing
  PAUSE: 'pause', // playing -> paused
  RESUME: 'resume', // paused -> playing
  OPEN_OPTIONS: 'open-options', // main menu | paused -> options
  OPEN_CREDITS: 'open-credits', // main menu -> credits
  BACK: 'back', // options | credits -> wherever they were opened from
  QUIT_TO_MENU: 'quit-to-menu', // paused -> main menu
  ESCAPE: 'escape', // the Escape key, meaning depends on the current state
  POINTER_LOCK_LOST: 'pointer-lock-lost', // browser released the mouse (Escape does this too)
};

/**
 * @param {object} [options]
 * @param {string} [options.initial] starting state (default: main menu)
 * @param {boolean} [options.keepSessionOnQuit] whether "Quit to Main Menu" keeps the run in
 *   memory so Continue can resume it. Pending Alex's answer on what quitting preserves — this
 *   is the one place to flip it.
 */
export function createUiState({ initial = STATES.MAIN_MENU, keepSessionOnQuit = true } = {}) {
  let state = initial;
  let returnTo = null;
  let sessionActive = initial === STATES.PLAYING || initial === STATES.PAUSED;
  const listeners = new Set();

  function move(next, { back = null } = {}) {
    const previous = state;
    state = next;
    returnTo = back;
    for (const listener of listeners) listener(state, previous);
    return true;
  }

  function send(action) {
    switch (action) {
      case ACTIONS.NEW_GAME:
        if (state !== STATES.MAIN_MENU) return false;
        sessionActive = false;
        return move(STATES.LOADING);

      case ACTIONS.CONTINUE:
        if (state !== STATES.MAIN_MENU || !sessionActive) return false;
        return move(STATES.PLAYING);

      case ACTIONS.LOADED:
        if (state !== STATES.LOADING) return false;
        sessionActive = true;
        return move(STATES.PLAYING);

      case ACTIONS.PAUSE:
      case ACTIONS.POINTER_LOCK_LOST:
        if (state !== STATES.PLAYING) return false;
        return move(STATES.PAUSED);

      case ACTIONS.RESUME:
        if (state !== STATES.PAUSED) return false;
        return move(STATES.PLAYING);

      case ACTIONS.OPEN_OPTIONS:
        if (state !== STATES.MAIN_MENU && state !== STATES.PAUSED) return false;
        return move(STATES.OPTIONS, { back: state });

      case ACTIONS.OPEN_CREDITS:
        if (state !== STATES.MAIN_MENU) return false;
        return move(STATES.CREDITS, { back: state });

      case ACTIONS.BACK:
        if ((state !== STATES.OPTIONS && state !== STATES.CREDITS) || !returnTo) return false;
        return move(returnTo);

      case ACTIONS.QUIT_TO_MENU:
        if (state !== STATES.PAUSED) return false;
        if (!keepSessionOnQuit) sessionActive = false;
        return move(STATES.MAIN_MENU);

      case ACTIONS.ESCAPE:
        if (state === STATES.PLAYING) return send(ACTIONS.PAUSE);
        if (state === STATES.PAUSED) return send(ACTIONS.RESUME);
        if (state === STATES.OPTIONS || state === STATES.CREDITS) return send(ACTIONS.BACK);
        return false;

      default:
        return false;
    }
  }

  return {
    send,
    getState: () => state,
    getReturnTo: () => returnTo,
    hasSession: () => sessionActive,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
