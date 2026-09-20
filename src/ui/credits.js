// src/ui/credits.js
//
// Live, in-game credits screen (opened from the main menu; screen-manager.js owns when it
// shows). This file MUST stay in sync with /CREDITS.md —
// whoever adds a row to CREDITS.md adds the matching entry here, same commit.
// CREDITS.md is the source of truth for humans reading the repo; this file is
// the source of truth for what the player sees in-game.
//
// No build step assumptions here beyond ES modules (Vite handles that).
// Uses CSS variables from theme.css so it inherits the project's palette
// rather than hardcoding colours. Deliberately avoids red as decoration —
// red is reserved for the AI's signal color everywhere else in the game,
// so the credits screen (a meta/UI surface, not diegetic) stays in the
// neutral/blue space palette to not muddy that visual language.

import './credits.css';
import { el, cornerBrackets } from './dom.js';

// ---------------------------------------------------------------------------
// 1. DATA — mirror of CREDITS.md. Keep column names consistent with the .md
//    tables so a diff between the two is easy to eyeball.
//    Delete the "(example)" rows here the same day you delete them in the .md.
// ---------------------------------------------------------------------------

const CREDITS_DATA = {
  code: [
    {
      item: 'Three.js',
      source: 'Three.js contributors',
      url: 'https://threejs.org',
      license: 'MIT',
      usedFor: 'Core rendering',
    },
    {
      item: 'GLTFLoader (Three.js addon)',
      source: 'Three.js contributors',
      url: 'https://threejs.org/docs/#examples/en/loaders/GLTFLoader',
      license: 'MIT',
      usedFor: 'Loading the astronaut .glb model',
    },
  ],

  models: [
    {
      item: 'Horror Game Astronaut',
      source: 'JCastillo',
      url: 'https://sketchfab.com/...',
      license: 'Free Standard',
      usedFor: 'Main character',
    },
  ],

  textures: [
    {
      item: 'Old Worn Chipped Painted Metal — PBR0496',
      source: 'textures.com',
      url: 'https://www.textures.com/download/old-worn-chipped-painted-metal-pbr0496/138834',
      license: 'IP-Warranty',
      usedFor: 'Spaceship pillar',
    },
    {
      item: 'Concrete Energy Pole — PBR0283',
      source: 'textures.com',
      url: 'https://www.textures.com/download/concrete-energy-pole-pbr0283/136381',
      license: 'IP-Warranty',
      usedFor: 'Spaceship texture',
    },
  ],

  audio: [],

  fonts: [
    {
      item: 'Rajdhani',
      source: 'Google Fonts',
      url: 'https://fonts.google.com/specimen/Rajdhani',
      license: 'SIL Open Font License 1.1',
      usedFor: 'Headers & section labels (credits screen; planned HUD label font)',
    },
    {
      item: 'Source Sans 3',
      source: 'Google Fonts',
      url: 'https://fonts.google.com/specimen/Source+Sans+3',
      license: 'SIL Open Font License 1.1',
      usedFor: 'Body text (credits button & panel copy; planned UI body font)',
    },
    {
      item: 'IBM Plex Mono',
      source: 'Google Fonts',
      url: 'https://fonts.google.com/specimen/IBM+Plex+Mono',
      license: 'SIL Open Font License 1.1',
      usedFor: 'Data / numeric readouts (loaded now — applied once HUD is built)',
    },
  ],

  icons: [],

  tutorials: [],
};

const CATEGORY_META = [
  { key: 'code', label: 'Code & Libraries', columns: ['item', 'source', 'license', 'usedFor'] },
  { key: 'models', label: '3D Models', columns: ['item', 'source', 'license', 'usedFor'] },
  {
    key: 'textures',
    label: 'Textures & Materials',
    columns: ['item', 'source', 'license', 'usedFor'],
  },
  { key: 'audio', label: 'Audio — SFX & Music', columns: ['item', 'source', 'license', 'usedFor'] },
  { key: 'fonts', label: 'Fonts', columns: ['item', 'source', 'license', 'usedFor'] },
  { key: 'icons', label: 'Icons / HUD Art', columns: ['item', 'source', 'license', 'usedFor'] },
  {
    key: 'tutorials',
    label: 'Tutorials, Articles & Adapted Code',
    columns: ['covers', 'source', 'usedFor'],
  },
];

const LICENSE_QUICK_REFERENCE = [
  { license: 'CC0', note: 'No attribution legally required — listed anyway for transparency' },
  { license: 'CC BY', note: 'Must credit author + source' },
  { license: 'CC BY-SA', note: 'Credit required; share-alike if redistributed modified' },
  {
    license: 'MIT / Apache 2.0',
    note: 'Credit + licence notice available (this table satisfies that)',
  },
  { license: 'OFL (fonts)', note: 'Credit the font name + source' },
  {
    license: '"Free", no licence listed',
    note: 'Treated as free-to-use, credited, noted as unlicensed',
  },
];

// ---------------------------------------------------------------------------
// 2. RENDER — builds the screen once; screen-manager.js shows/hides it.
//    Data-driven: adding a row above is the only thing anyone should need
//    to touch to add a credit. Empty categories are skipped.
// ---------------------------------------------------------------------------

const COLUMN_LABELS = {
  item: 'Item',
  covers: 'Covers',
  source: 'Source',
  license: 'Licence',
  usedFor: 'Used for',
  note: 'What it requires', // licence quick-reference table only
};

// Relative column widths (matches the mockup's Item / Source / Licence / Used-for layout).
const COLUMN_WIDTHS = { item: 2.2, covers: 2.2, source: 2, license: 1.2, usedFor: 2, note: 4 };

const COLUMN_CLASS = {
  item: 'credits__cell--item',
  covers: 'credits__cell--item',
  source: 'credits__cell--meta',
  license: 'credits__cell--meta',
  usedFor: 'credits__cell--note',
  note: 'credits__cell--meta',
};

function gridColumns(columns) {
  return columns.map((column) => `${COLUMN_WIDTHS[column] ?? 2}fr`).join(' ');
}

function buildCell(column, entry) {
  const value = entry[column] ?? '—';
  const cell = el('div', { className: `credits__cell ${COLUMN_CLASS[column] ?? ''}`.trim() });
  if ((column === 'item' || column === 'covers') && entry.url) {
    cell.append(
      el('a', {
        text: value,
        attrs: { href: entry.url, target: '_blank', rel: 'noopener noreferrer' },
      })
    );
  } else {
    cell.textContent = value;
  }
  return cell;
}

/** One bordered panel: a header row of column names, then one row per entry. */
function buildTable(columns, rows) {
  const template = gridColumns(columns);
  const header = el(
    'div',
    { className: 'credits__row credits__row--head', attrs: { style: `--columns: ${template}` } },
    columns.map((column) =>
      el('div', { className: 'credits__head-cell', text: COLUMN_LABELS[column] })
    )
  );
  const body = rows.map((entry) =>
    el(
      'div',
      { className: 'credits__row', attrs: { style: `--columns: ${template}` } },
      columns.map((column) => buildCell(column, entry))
    )
  );
  return el('div', { className: 'credits__table ui-panel ui-chamfer-panel' }, header, body);
}

function buildCategory({ key, label, columns }) {
  const rows = CREDITS_DATA[key] || [];
  if (rows.length === 0) return null;
  return el(
    'section',
    { className: 'credits__category' },
    el(
      'div',
      { className: 'credits__category-head' },
      el('span', { className: 'credits__category-name ui-label', text: label }),
      el('div', { className: 'credits__rule' })
    ),
    buildTable(columns, rows)
  );
}

function buildLicenseReference() {
  return el(
    'section',
    { className: 'credits__category' },
    el(
      'div',
      { className: 'credits__category-head' },
      el('span', { className: 'credits__category-name ui-label', text: 'Licence Quick Reference' }),
      el('div', { className: 'credits__rule' })
    ),
    buildTable(['license', 'note'], LICENSE_QUICK_REFERENCE)
  );
}

export function createCreditsScreen(api) {
  const list = el(
    'div',
    { className: 'credits__list' },
    CATEGORY_META.map(buildCategory),
    buildLicenseReference()
  );

  const viewport = el(
    'div',
    {
      className: 'credits__viewport',
      attrs: { tabindex: 0, role: 'region', 'aria-label': 'Credits list' },
    },
    list
  );

  // Fades the bottom edge while there is more to scroll.
  const fade = el('div', { className: 'credits__fade', attrs: { 'aria-hidden': 'true' } });

  function updateFade() {
    const atEnd = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 2;
    fade.hidden = atEnd;
  }
  viewport.addEventListener('scroll', updateFade, { passive: true });

  const backButton = el('button', {
    className: 'ui-button ui-chamfer-row credits__back',
    text: 'Back',
    attrs: { type: 'button' },
    on: { click: () => api.back() },
  });

  const element = el(
    'section',
    {
      className: 'ui-screen ui-screen--pinned-clean ui-screen--credits',
      attrs: { hidden: true, 'aria-label': 'Credits' },
    },
    el(
      'div',
      { className: 'ui-stage' },
      el('h2', { className: 'credits__title', text: 'Credits' }),
      viewport,
      fade,
      backButton
    ),
    cornerBrackets()
  );

  return {
    id: 'credits',
    element,
    onShow() {
      viewport.scrollTop = 0;
      updateFade();
      backButton.focus({ preventScroll: true });
    },
    onHide() {},
  };
}
