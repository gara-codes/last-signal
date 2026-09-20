// src/ui/screens/pause.js
//
// Pause overlay: Resume / Options / Restart Level / Quit to Main Menu. It is a scrim over the
// live game (the real HUD underneath is dimmed by hud.js), not a screen of its own, so it
// follows the current level's accent.

import './pause.css';
import { el, cornerBrackets } from '../dom.js';
import { createMenuNav, setRowEnabled } from '../menu-nav.js';

export function createPauseScreen(api) {
  const rows = {};

  const items = [
    { id: 'resume', label: 'Resume', run: () => api.resume() },
    { id: 'options', label: 'Options', run: () => api.openOptions() },
    { id: 'restart', label: 'Restart Level', run: () => api.restartLevel() },
    { id: 'quit', label: 'Quit to Main Menu', run: () => api.quitToMenu() },
  ];

  const menu = el(
    'nav',
    { className: 'ui-menu ui-menu--center', attrs: { 'aria-label': 'Pause menu' } },
    items.map((item) => {
      const row = el(
        'button',
        {
          className: 'ui-menu-item ui-chamfer-row',
          attrs: { type: 'button' },
          on: {
            click: () => {
              if (!row.classList.contains('is-disabled')) item.run();
            },
          },
        },
        el('span', { className: 'ui-menu-label', text: item.label })
      );
      rows[item.id] = row;
      return row;
    })
  );

  const nav = createMenuNav(menu);

  // Only true when the browser itself released the mouse (pointer lock), so the hint never
  // claims something that did not happen.
  const hint = el('div', {
    className: 'pause__hint',
    text: 'Mouse released — select Resume to re-lock',
    attrs: { hidden: true },
  });

  const element = el(
    'section',
    {
      className: 'ui-screen ui-screen--pause',
      attrs: { hidden: true, role: 'dialog', 'aria-label': 'Paused' },
    },
    el(
      'div',
      { className: 'ui-stage' },
      el(
        'div',
        { className: 'pause__panel' },
        el('h2', { className: 'pause__title', text: 'Paused' }),
        menu,
        hint
      )
    ),
    cornerBrackets()
  );

  return {
    id: 'pause',
    element,
    onShow() {
      // TODO(wire): Restart Level switches on once main.js registers resetLevel() — see the
      // WIRING notes at the top of src/ui/index.js.
      setRowEnabled(rows.restart, api.canReset(), 'Needs resetLevel() — not wired yet');
      hint.hidden = !api.mouseReleasedByBrowser();
      nav.selectFirstEnabled();
    },
    onHide() {},
  };
}
