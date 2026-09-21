// tests/ui-state.test.js
import { describe, it, expect } from 'vitest';
import { createUiState, STATES, ACTIONS } from '../src/ui/ui-state.js';

function startedRun(options) {
  const ui = createUiState(options);
  ui.send(ACTIONS.NEW_GAME);
  ui.send(ACTIONS.LOADED);
  return ui;
}

describe('ui-state: starting a run', () => {
  it('starts on the main menu with no run in progress', () => {
    const ui = createUiState();
    expect(ui.getState()).toBe(STATES.MAIN_MENU);
    expect(ui.hasSession()).toBe(false);
  });

  it('New Game goes through loading and then into play', () => {
    const ui = createUiState();
    expect(ui.send(ACTIONS.NEW_GAME)).toBe(true);
    expect(ui.getState()).toBe(STATES.LOADING);
    expect(ui.send(ACTIONS.LOADED)).toBe(true);
    expect(ui.getState()).toBe(STATES.PLAYING);
    expect(ui.hasSession()).toBe(true);
  });

  it('Continue only works once a run exists', () => {
    const ui = createUiState();
    expect(ui.send(ACTIONS.CONTINUE)).toBe(false);
    expect(ui.getState()).toBe(STATES.MAIN_MENU);
  });

  it('ignores LOADED unless loading', () => {
    const ui = createUiState();
    expect(ui.send(ACTIONS.LOADED)).toBe(false);
    expect(ui.getState()).toBe(STATES.MAIN_MENU);
  });
});

describe('ui-state: pause and resume', () => {
  it('Escape pauses while playing and resumes while paused', () => {
    const ui = startedRun();
    expect(ui.send(ACTIONS.ESCAPE)).toBe(true);
    expect(ui.getState()).toBe(STATES.PAUSED);
    expect(ui.send(ACTIONS.ESCAPE)).toBe(true);
    expect(ui.getState()).toBe(STATES.PLAYING);
  });

  it('losing pointer lock pauses, and only while playing', () => {
    const ui = startedRun();
    expect(ui.send(ACTIONS.POINTER_LOCK_LOST)).toBe(true);
    expect(ui.getState()).toBe(STATES.PAUSED);
    // A second release event (or one on the menu) must not flip anything.
    expect(ui.send(ACTIONS.POINTER_LOCK_LOST)).toBe(false);
    expect(ui.getState()).toBe(STATES.PAUSED);

    const menu = createUiState();
    expect(menu.send(ACTIONS.POINTER_LOCK_LOST)).toBe(false);
    expect(menu.getState()).toBe(STATES.MAIN_MENU);
  });

  it('Escape does nothing on the main menu or while loading', () => {
    const ui = createUiState();
    expect(ui.send(ACTIONS.ESCAPE)).toBe(false);
    ui.send(ACTIONS.NEW_GAME);
    expect(ui.send(ACTIONS.ESCAPE)).toBe(false);
    expect(ui.getState()).toBe(STATES.LOADING);
  });
});

describe('ui-state: options and credits return to where they were opened', () => {
  it('options opened from the main menu goes back to the main menu', () => {
    const ui = createUiState();
    ui.send(ACTIONS.OPEN_OPTIONS);
    expect(ui.getState()).toBe(STATES.OPTIONS);
    expect(ui.send(ACTIONS.BACK)).toBe(true);
    expect(ui.getState()).toBe(STATES.MAIN_MENU);
  });

  it('options opened from pause goes back to pause, also via Escape', () => {
    const ui = startedRun();
    ui.send(ACTIONS.PAUSE);
    ui.send(ACTIONS.OPEN_OPTIONS);
    expect(ui.getState()).toBe(STATES.OPTIONS);
    expect(ui.send(ACTIONS.ESCAPE)).toBe(true);
    expect(ui.getState()).toBe(STATES.PAUSED);
  });

  it('credits only open from the main menu, and Escape closes them', () => {
    const ui = startedRun();
    ui.send(ACTIONS.PAUSE);
    expect(ui.send(ACTIONS.OPEN_CREDITS)).toBe(false);
    ui.send(ACTIONS.RESUME);
    ui.send(ACTIONS.PAUSE);
    ui.send(ACTIONS.QUIT_TO_MENU);
    expect(ui.send(ACTIONS.OPEN_CREDITS)).toBe(true);
    expect(ui.getState()).toBe(STATES.CREDITS);
    expect(ui.send(ACTIONS.ESCAPE)).toBe(true);
    expect(ui.getState()).toBe(STATES.MAIN_MENU);
  });

  it('BACK is a no-op outside options/credits', () => {
    const ui = startedRun();
    expect(ui.send(ACTIONS.BACK)).toBe(false);
    expect(ui.getState()).toBe(STATES.PLAYING);
  });
});

describe('ui-state: quitting to the menu', () => {
  it('keeps the run by default so Continue can resume it', () => {
    const ui = startedRun();
    ui.send(ACTIONS.PAUSE);
    ui.send(ACTIONS.QUIT_TO_MENU);
    expect(ui.getState()).toBe(STATES.MAIN_MENU);
    expect(ui.hasSession()).toBe(true);
    expect(ui.send(ACTIONS.CONTINUE)).toBe(true);
    expect(ui.getState()).toBe(STATES.PLAYING);
  });

  it('drops the run when keepSessionOnQuit is off', () => {
    const ui = startedRun({ keepSessionOnQuit: false });
    ui.send(ACTIONS.PAUSE);
    ui.send(ACTIONS.QUIT_TO_MENU);
    expect(ui.hasSession()).toBe(false);
    expect(ui.send(ACTIONS.CONTINUE)).toBe(false);
  });

  it('only quits from the pause overlay', () => {
    const ui = startedRun();
    expect(ui.send(ACTIONS.QUIT_TO_MENU)).toBe(false);
    expect(ui.getState()).toBe(STATES.PLAYING);
  });
});

describe('ui-state: subscribers', () => {
  it('are told the new and previous state, and can unsubscribe', () => {
    const ui = createUiState();
    const seen = [];
    const off = ui.subscribe((next, previous) => seen.push([previous, next]));
    ui.send(ACTIONS.NEW_GAME);
    off();
    ui.send(ACTIONS.LOADED);
    expect(seen).toEqual([[STATES.MAIN_MENU, STATES.LOADING]]);
  });
});
