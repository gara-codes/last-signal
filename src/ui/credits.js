// src/ui/credits.js
//
// Live, in-game credits screen. This file MUST stay in sync with /CREDITS.md —
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
// 2. RENDER — builds the overlay once, toggles visibility after that.
//    Data-driven: adding a row above is the only thing anyone should need
//    to touch to add a credit.
// ---------------------------------------------------------------------------

let overlayEl = null;

function buildCategorySection({ key, label, columns }) {
  const rows = CREDITS_DATA[key] || [];
  if (rows.length === 0) return '';

  const header = columns
    .map((c) => `<th>${c === 'usedFor' ? 'Used for' : c[0].toUpperCase() + c.slice(1)}</th>`)
    .join('');

  const body = rows
    .map((entry) => {
      const tds = columns
        .map((col) => {
          const val = entry[col] ?? '—';
          if ((col === 'item' || col === 'covers') && entry.url) {
            return `<td><a href="${entry.url}" target="_blank" rel="noopener noreferrer">${val}</a></td>`;
          }
          return `<td>${val}</td>`;
        })
        .join('');
      return `<tr>${tds}</tr>`;
    })
    .join('');

  return `
    <section class="credits-category">
      <h3>${label}</h3>
      <table class="credits-table">
        <thead><tr>${header}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </section>
  `;
}

function buildLicenseReference() {
  const rows = LICENSE_QUICK_REFERENCE.map(
    (r) => `<tr><td>${r.license}</td><td>${r.note}</td></tr>`
  ).join('');
  return `
    <section class="credits-category credits-license-ref">
      <h3>Licence Quick Reference</h3>
      <table class="credits-table">
        <thead><tr><th>Licence</th><th>What it requires</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function buildOverlay() {
  const el = document.createElement('div');
  el.id = 'credits-overlay';
  el.className = 'credits-overlay';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Credits');
  el.setAttribute('aria-hidden', 'true');

  const sections = CATEGORY_META.map(buildCategorySection).join('');

  el.innerHTML = `
    <div class="credits-panel">
      <button class="credits-close" aria-label="Close credits">&times;</button>
      <h2 class="credits-title">Credits</h2>
      <p class="credits-intro">
        Everything below is something the team did not make itself.
      </p>
      <div class="credits-scroll">
        ${sections}
        ${buildLicenseReference()}
      </div>
    </div>
  `;

  el.querySelector('.credits-close').addEventListener('click', closeCredits);
  el.addEventListener('click', (e) => {
    if (e.target === el) closeCredits(); // click on backdrop closes
  });

  document.body.appendChild(el);
  return el;
}

export function openCredits() {
  if (!overlayEl) overlayEl = buildOverlay();
  overlayEl.setAttribute('aria-hidden', 'false');
  overlayEl.classList.add('is-open');
  document.addEventListener('keydown', handleEscape);
}

export function closeCredits() {
  if (!overlayEl) return;
  overlayEl.setAttribute('aria-hidden', 'true');
  overlayEl.classList.remove('is-open');
  document.removeEventListener('keydown', handleEscape);
}

export function toggleCredits() {
  if (overlayEl && overlayEl.classList.contains('is-open')) {
    closeCredits();
  } else {
    openCredits();
  }
}

function handleEscape(e) {
  if (e.key === 'Escape') closeCredits();
}

// ---------------------------------------------------------------------------
// 3. WIRING — call this once from main.js / menu.js to attach a button.
//    Example:
//      import { initCreditsButton } from './ui/credits.js';
//      initCreditsButton(document.querySelector('#menu-credits-btn'));
// ---------------------------------------------------------------------------

export function initCreditsButton(buttonEl) {
  console.log('initCreditsButton called with', buttonEl);
  if (!buttonEl) return;
  buttonEl.addEventListener('click', openCredits);
}

// For debugging purposes only:
// window.openCredits = openCredits;
