// src/ui/screens/log-overlay.js
//
// Log / text reading overlay (final mockup). Opening one pauses the world (STATES.READING) and
// frees the mouse so the tabs and arrows can be clicked.
//
//   ui.openLog(entries, index)   entries: [{ id, title, body, corrupted }]
//     id         small header, e.g. 'LOG // CREW MANIFEST 04'
//     title      e.g. 'Personal Logbook' — shown as 'LOG 02 - Personal Logbook'
//     body       array of lines; { redacted: n } in place of a line draws an n-character
//                corrupted bar
//     corrupted  shows the '[ PARTIALLY CORRUPTED ]' tag
//
// Tabs above the panel jump straight to an entry (TAB the key is reserved for Ship Status, so
// there is no tab-cycling); the < > buttons and the arrow keys step to the neighbour. E or Esc
// closes and play resumes. Follows the level accent.

import './log-overlay.css';
import { el, cornerBrackets } from '../dom.js';

const shortLabel = (i) => `LOG ${String(i + 1).padStart(2, '0')}`;

function cleanText(value) {
  return typeof value === 'string' ? value : '';
}

export function createLogOverlay(api) {
  let entries = [];
  let index = 0;

  const tabs = el('div', { className: 'log__tabs', attrs: { role: 'tablist' } });
  const logId = el('span', { className: 'log__id ui-mono' });
  const corruptTag = el('span', {
    className: 'log__corrupt-tag ui-mono',
    text: '[ PARTIALLY CORRUPTED ]',
  });
  const title = el('h2', { className: 'log__title ui-label' });
  const body = el('div', { className: 'log__body', attrs: { role: 'tabpanel' } });
  const position = el('span', { className: 'log__position ui-mono' });

  const step = (delta) => {
    if (entries.length === 0) return;
    show((index + delta + entries.length) % entries.length);
  };
  const arrow = (text, delta, label) =>
    el('button', {
      className: 'log__arrow ui-mono',
      text,
      attrs: { type: 'button', 'aria-label': label },
      on: { click: () => step(delta) },
    });

  const panel = el(
    'div',
    { className: 'log__panel' },
    el('div', { className: 'log__meta' }, logId, corruptTag),
    title,
    body,
    el(
      'div',
      { className: 'log__footer' },
      el(
        'button',
        {
          className: 'log__close',
          attrs: { type: 'button' },
          on: { click: () => api.closeLog({ relock: false }) },
        },
        el('span', { className: 'log__key ui-mono', text: 'E' }),
        el('span', { className: 'log__close-label ui-label', text: 'Close' })
      ),
      el(
        'div',
        { className: 'log__nav' },
        position,
        arrow('<', -1, 'Previous log'),
        arrow('>', 1, 'Next log')
      )
    )
  );

  const element = el(
    'section',
    {
      className: 'ui-screen ui-screen--log',
      attrs: { hidden: true, role: 'dialog', 'aria-label': 'Log' },
    },
    el('div', { className: 'ui-stage' }, el('div', { className: 'log__frame' }, tabs, panel)),
    cornerBrackets()
  );

  function renderBody(lines) {
    body.replaceChildren(
      ...lines.map((line) => {
        if (line && typeof line === 'object' && Number(line.redacted) > 0) {
          const bar = el('span', {
            className: 'log__redacted',
            text: '█'.repeat(Math.min(80, Math.floor(line.redacted))),
            attrs: { 'aria-label': 'corrupted' },
          });
          return el('div', { className: 'log__line' }, bar);
        }
        return el('div', { className: 'log__line', text: cleanText(line) });
      })
    );
  }

  function show(i) {
    index = i;
    const entry = entries[index] ?? {};
    const heading = `${shortLabel(index)} - ${cleanText(entry.title)}`;
    logId.textContent = cleanText(entry.id);
    corruptTag.hidden = !entry.corrupted;
    title.textContent = heading;
    renderBody(Array.isArray(entry.body) ? entry.body : [entry.body]);
    position.textContent = `LOG ${index + 1} / ${entries.length}`;
    tabs.replaceChildren(
      ...entries.map((_, k) => {
        const selected = k === index;
        return el(
          'button',
          {
            className: `log__tab${selected ? ' is-selected' : ''}`,
            attrs: { type: 'button', role: 'tab', 'aria-selected': String(selected) },
            on: { click: () => show(k) },
          },
          el('span', {
            className: 'log__tab-label ui-label',
            text: selected ? heading : shortLabel(k),
          }),
          el('span', { className: 'log__tab-line' })
        );
      })
    );
  }

  element.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.code === 'KeyE') {
      event.preventDefault();
      api.closeLog({ relock: true }); // a key press counts as the gesture pointer lock needs
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    }
  });

  return {
    id: 'log',
    element,
    /** Called by ui.openLog() just before the screen shows. */
    setEntries(list, start = 0) {
      entries = Array.isArray(list) ? list : [];
      show(Math.min(Math.max(0, Math.floor(start) || 0), Math.max(0, entries.length - 1)));
    },
    onShow() {
      element.tabIndex = -1;
      element.focus({ preventScroll: true }); // so E and the arrow keys reach the keydown above
    },
    onHide() {},
  };
}
