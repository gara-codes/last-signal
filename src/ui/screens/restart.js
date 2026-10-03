// src/ui/screens/restart.js
//
// Restart ("Signal Lost") screen — shown on death (STATES.DEAD). From the final mockup:
// wifi-off glyph, flickering "Signal Lost", run stats, a systems row (L2 onwards), the last
// sector reached, and two buttons. The primary button is "Restart Level", or "Restart From
// Checkpoint" once the one L2 checkpoint has been passed (the only checkpoint in the game).
//
// The systems row uses the repair consoles' language: each system in its own colour with the
// same three-cell Untouched / Partial / Full strip, Untouched outlined in the shared red.
//
// Fed by main.js through ui.showRestart(info) — see restart-model.js for `info`.

import './restart.css';
import { el, svg } from '../dom.js';
import { restartView } from './restart-model.js';

function signalLostIcon() {
  const path = (d) => svg('path', { d });
  return svg(
    'svg',
    {
      class: 'restart__icon',
      width: 46,
      height: 46,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.6,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    },
    path('M16.72 11.06A10.94 10.94 0 0 1 19 12.55'),
    path('M5 12.55a10.94 10.94 0 0 1 5.17-2.39'),
    path('M10.71 5.05A16 16 0 0 1 22.58 9'),
    path('M1.42 9a15.91 15.91 0 0 1 4.7-2.88'),
    path('M8.53 16.11a6 6 0 0 1 6.95 0'),
    svg('line', { x1: 12, y1: 20, x2: 12.01, y2: 20 }),
    svg('line', { class: 'restart__icon-slash', x1: 1, y1: 1, x2: 23, y2: 23 })
  );
}

export function createRestartScreen(api) {
  const statValues = {};
  const stats = el(
    'div',
    { className: 'restart__stats' },
    [
      ['cells', 'Fuel Cells'],
      ['systems', 'Systems Repaired'],
      ['sectors', 'Sectors Cleared'],
    ].map(([id, label]) => {
      statValues[id] = el('div', {
        className: `restart__stat-value restart__stat-value--${id} ui-mono`,
      });
      return el(
        'div',
        { className: 'restart__stat' },
        statValues[id],
        el('div', { className: 'restart__stat-label ui-label', text: label })
      );
    })
  );

  const systemsRow = el('div', { className: 'restart__systems', attrs: { hidden: true } });
  const lastSector = el('span', { className: 'restart__sector-name' });

  const restartButton = el('button', {
    className: 'restart__button restart__button--primary ui-label',
    attrs: { type: 'button' },
    on: {
      click: () => {
        if (!restartButton.disabled) api.restartLevel();
      },
    },
  });
  const menuButton = el('button', {
    className: 'restart__button restart__button--secondary ui-label',
    text: 'Return to Main Menu',
    attrs: { type: 'button' },
    on: { click: () => api.quitToMenu() },
  });

  const element = el(
    'section',
    {
      className: 'ui-screen ui-screen--restart',
      attrs: { hidden: true, role: 'dialog', 'aria-label': 'Signal lost' },
    },
    el('div', { className: 'restart__scan', attrs: { 'aria-hidden': 'true' } }, el('div')),
    el(
      'div',
      { className: 'ui-stage' },
      signalLostIcon(),
      el(
        'div',
        { className: 'restart__heading' },
        el('h2', { className: 'restart__title ui-label', text: 'Signal Lost' }),
        el('div', {
          className: 'restart__subtitle ui-mono',
          text: 'Connection to relay terminated',
        })
      ),
      stats,
      systemsRow,
      el('div', { className: 'restart__sector ui-mono' }, 'Last transmission: ', lastSector),
      el('div', { className: 'restart__actions' }, restartButton, menuButton),
      el('div', {
        className: 'restart__note ui-mono',
        text: 'Progress within this sector is not retained',
      })
    )
  );

  // Arrow keys move between the two buttons; Enter/Space press the focused one natively.
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const buttons = [restartButton, menuButton].filter((b) => !b.disabled);
    const index = buttons.indexOf(document.activeElement);
    const next =
      buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length];
    next?.focus({ preventScroll: true });
  });

  function renderSystems(systems) {
    systemsRow.hidden = !systems;
    if (!systems) return;
    systemsRow.replaceChildren(
      ...systems.map((s) =>
        el(
          'div',
          {
            className: `restart__system restart__system--${s.theme}`,
            attrs: { 'data-step': s.step },
          },
          el('span', { className: 'restart__system-name ui-label', text: s.name }),
          el(
            'span',
            {
              className: 'restart__strip',
              attrs: { 'aria-label': ['Untouched', 'Partial', 'Full'][s.step] },
            },
            [0, 1, 2].map((i) => {
              let cls = '';
              if (s.step === 0 && i === 0) cls = 'bad';
              else if (i < s.step) cls = 'done';
              else if (i === s.step) cls = 'now';
              return el('i', { className: cls });
            })
          )
        )
      )
    );
  }

  return {
    id: 'restart',
    element,
    /** @param {Parameters<typeof restartView>[0]} info */
    setInfo(info) {
      const view = restartView(info);
      for (const stat of view.stats) statValues[stat.id].textContent = stat.value;
      renderSystems(view.systems);
      lastSector.textContent = view.lastSector;
      restartButton.textContent = view.restartLabel;
    },
    onShow() {
      // TODO(wire): restarting needs resetLevel() — see the WIRING notes in src/ui/index.js.
      const canRestart = api.canReset();
      restartButton.disabled = !canRestart;
      restartButton.title = canRestart ? '' : 'Needs resetLevel() — not wired yet';
      (canRestart ? restartButton : menuButton).focus({ preventScroll: true });
    },
    onHide() {},
  };
}
