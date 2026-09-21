// src/ui/screens/main-menu.js
//
// Main menu: Continue / New Game / Options / Credits / Quit, plus the title lockup.
// Stays on the L1 blue whatever level is loaded (ui-screen--pinned-clean).

import './main-menu.css';
import { el, cornerBrackets } from '../dom.js';
import { createMenuNav, setRowEnabled } from '../menu-nav.js';
import { GAME_TITLE, SHIP_NAME, AI_NAME, BUILD_LABEL, LAST_CONTACT } from '../../config/names.js';

// Non-breaking spaces around a middle dot, as in the mockup's meta line.
const SEP = '\u00A0\u00B7\u00A0';

export function createMainMenuScreen(api) {
  const rows = {};

  const items = [
    { id: 'continue', label: 'Continue', run: () => api.continueGame() },
    { id: 'new-game', label: 'New Game', run: () => api.newGame() },
    { id: 'options', label: 'Options', run: () => api.openOptions() },
    { id: 'credits', label: 'Credits', run: () => api.openCredits() },
    { id: 'quit', label: 'Quit', run: () => quit() },
  ];

  const status = el('div', {
    className: 'main-menu__status',
    attrs: { role: 'status', 'aria-live': 'polite' },
  });

  const menu = el(
    'nav',
    { className: 'ui-menu', attrs: { 'aria-label': 'Main menu' } },
    items.map((item, index) => {
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
        el('span', { className: 'ui-menu-num', text: String(index + 1).padStart(2, '0') }),
        el('span', { className: 'ui-menu-label', text: item.label })
      );
      rows[item.id] = row;
      return row;
    })
  );

  const nav = createMenuNav(menu);

  // Browsers only let a script close a window that a script opened, so in a normal tab
  // window.close() does nothing. Say what the player can do instead of leaving a dead button.
  function quit() {
    window.close();
    status.textContent = api.hasSession()
      ? 'You can close this tab now. Your current run will be lost when you do.'
      : 'You can close this tab now.';
  }

  const element = el(
    'section',
    {
      className: 'ui-screen ui-screen--pinned-clean ui-screen--main-menu',
      attrs: { hidden: true, 'aria-label': 'Main menu' },
    },
    el('div', {
      className: 'main-menu__tag ui-anchor ui-anchor--bl',
      text: `${GAME_TITLE} // ${BUILD_LABEL}`,
    }),
    el(
      'div',
      { className: 'main-menu__title ui-anchor ui-anchor--l-mid' },
      el('h1', { className: 'main-menu__name', text: GAME_TITLE }),
      el('div', {
        className: 'main-menu__meta',
        text: `VESSEL: ${SHIP_NAME} ${SEP} AI: ${AI_NAME} ${SEP} LAST CONTACT ${LAST_CONTACT} AGO`,
      })
    ),
    el('div', { className: 'main-menu__panel ui-anchor ui-anchor--r-mid' }, menu, status),
    cornerBrackets()
  );

  return {
    id: 'main-menu',
    element,
    onShow() {
      status.textContent = '';

      // Continue resumes the in-memory run, so it only works once one exists.
      setRowEnabled(rows.continue, api.hasSession(), 'No run in progress');

      // Starting over while a run exists needs resetLevel(); until that is wired, New Game is
      // only available for a fresh session.
      const canStart = !api.hasSession() || api.canReset();
      setRowEnabled(rows['new-game'], canStart, 'Restarting needs resetLevel() — not wired yet');

      nav.selectFirstEnabled();
    },
    onHide() {},
  };
}
