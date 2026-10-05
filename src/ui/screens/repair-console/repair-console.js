// src/ui/screens/repair-console/repair-console.js
//
// The full-screen L2 repair console (final mockup, Version 22): one shared shell — location line,
// system icon + name, the system's animated panel, a Fuel Cells block, the System state block and
// the repair prompt — around one of three panels (gravity-panel.js, comms-panel.js,
// oxygen-panel.js).
//
// Flow (Shannon, Oct 2026): E at a station opens its console; E again repairs one step; Esc or
// walking away closes it. The world keeps running underneath — this is an overlay in the PLAYING
// state, not a menu state, so movement and oxygen drain carry on.
//
// The level drives it through module-level functions, like setInteractPrompt():
//
//   import { openRepairConsole, closeRepairConsole, isRepairConsoleOpen } from '...';
//   openRepairConsole({
//     systemId: 'gravity-stabilizers',
//     getState: () => repairs.getState('gravity-stabilizers'),   // read every frame
//     getBanked: () => fuelSystem.banked,
//     cost: REPAIR_COST,
//   });
//   isRepairConsoleOpen('gravity-stabilizers');  // E while open -> repairs.repair(...)
//   closeRepairConsole();                        // walked away / level disposed
//
// screen-manager.js closes it on Esc (and when the browser drops pointer lock, which Esc also
// does) instead of pausing, and whenever the game leaves play for the menus.

import './repair-console.css';
import { el, svg, cornerBrackets } from '../../dom.js';
import { consoleView } from './console-model.js';
import { createGravityPanel } from './gravity-panel.js';
import { createCommsPanel } from './comms-panel.js';
import { createOxygenPanel } from './oxygen-panel.js';

// Per system: CSS theme class, location line, heading, icon paths and panel factory.
const SYSTEMS = {
  'gravity-stabilizers': {
    theme: 'rc--gravity',
    location: 'ENGINEERING CORE // DECK 2',
    name: 'Gravity Stabilizers',
    icon: () => [
      svg('path', { d: 'M10 2 V12', 'stroke-linecap': 'round' }),
      svg('path', {
        d: 'M5.5 8 L10 12.5 L14.5 8',
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round',
      }),
      svg('line', { x1: 4, y1: 17, x2: 16, y2: 17, 'stroke-linecap': 'round' }),
    ],
    createPanel: createGravityPanel,
  },
  'comms-array': {
    theme: 'rc--comms',
    location: 'SIGNAL // EXT. HULL',
    name: 'Comms Array',
    icon: () => [
      svg('path', { d: 'M5 13 L10 4 L15 13', 'stroke-linejoin': 'round' }),
      svg('path', { d: 'M3 16 Q10 10 17 16', 'stroke-opacity': 0.7 }),
    ],
    createPanel: createCommsPanel,
  },
  'oxygen-scrubbers': {
    theme: 'rc--oxygen',
    location: 'LIFE SUPPORT // BAY 2',
    name: 'Oxygen Scrubbers',
    icon: () => [
      svg('path', { d: 'M3 8c2 0 2-3 4-3s2 3 4 3 2-3 4-3 2 3 4 3', 'stroke-opacity': 0.9 }),
      svg('path', { d: 'M3 13c2 0 2-3 4-3s2 3 4 3 2-3 4-3 2 3 4 3', 'stroke-opacity': 0.55 }),
    ],
    createPanel: createOxygenPanel,
  },
};

export const CONSOLE_SYSTEM_IDS = Object.freeze(Object.keys(SYSTEMS));

const MAX_FRAME_DT = 0.05; // seconds; a tab switch must not fast-forward the animations

function fuelIcon() {
  return svg(
    'svg',
    {
      width: 22,
      height: 22,
      viewBox: '0 0 20 20',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.6,
      'aria-hidden': 'true',
    },
    svg('rect', { x: 7, y: 1.5, width: 6, height: 3 }),
    svg('rect', { x: 5, y: 4.5, width: 10, height: 13.5, rx: 1 }),
    svg('line', { x1: 5, y1: 9.5, x2: 15, y2: 9.5, 'stroke-opacity': 0.5 })
  );
}

/** One system's console: shell + panel, built once and reused every time it opens. */
function buildConsole(systemId) {
  const def = SYSTEMS[systemId];
  const panel = def.createPanel();

  const fuelCount = el('div', { className: 'rc-fuel__count ui-mono' });
  const stateName = el('span', { className: 'rc-state__name ui-label' });
  const segs = ['UNTOUCHED', 'PARTIAL', 'FULL'].map((text) => el('span', { text }));
  const promptKey = el('span', { className: 'rc-prompt__key ui-mono', text: 'E' });
  const promptLabel = el('span', { className: 'rc-prompt__label ui-label' });
  const prompt = el('div', { className: 'rc-prompt ui-chamfer-row' }, promptKey, promptLabel);

  const element = el(
    'section',
    {
      className: `rc ${def.theme}`,
      attrs: { hidden: true, 'aria-label': `${def.name} console`, role: 'dialog' },
    },
    el('div', { className: 'rc__grid' }),
    el('div', { className: 'rc__vignette' }),
    cornerBrackets(),
    el(
      'div',
      { className: 'ui-stage' },
      el(
        'div',
        { className: 'rc-head' },
        el('div', { className: 'rc-head__location ui-mono', text: def.location }),
        el(
          'div',
          { className: 'rc-head__title' },
          el(
            'div',
            { className: 'rc-head__icon' },
            svg(
              'svg',
              {
                width: 18,
                height: 18,
                viewBox: '0 0 20 20',
                fill: 'none',
                stroke: 'currentColor',
                'stroke-width': 1.6,
                'aria-hidden': 'true',
              },
              ...def.icon()
            )
          ),
          el('h2', { className: 'rc-head__name ui-label', text: def.name })
        )
      ),
      panel.element,
      el(
        'div',
        { className: 'rc-fuel ui-panel ui-chamfer-panel' },
        fuelIcon(),
        el(
          'div',
          { className: 'rc-fuel__body' },
          el('div', { className: 'rc-fuel__label ui-label', text: 'Fuel Cells' }),
          fuelCount
        )
      ),
      el(
        'div',
        { className: 'rc-state ui-panel ui-chamfer-panel' },
        el(
          'div',
          { className: 'rc-state__top' },
          el('span', { className: 'rc-state__label ui-label', text: 'System state' }),
          stateName
        ),
        el('div', { className: 'rc-state__segs ui-mono' }, segs)
      ),
      prompt
    )
  );

  let shownKey = '';
  function render(view, banked) {
    const key = `${view.step}|${banked}|${view.prompt.label}`;
    if (key === shownKey) return;
    shownKey = key;
    fuelCount.textContent = String(banked).padStart(2, '0');
    stateName.textContent = view.stepName;
    element.dataset.step = String(view.step);
    view.segments.forEach((cls, i) => {
      segs[i].className = cls;
    });
    promptLabel.textContent = view.prompt.label;
    prompt.classList.toggle('is-denied', view.prompt.denied);
    prompt.classList.toggle('is-done', view.prompt.done);
    promptKey.hidden = view.prompt.done;
    panel.setStep(view.step);
  }

  return {
    element,
    render,
    update: panel.update,
    reset() {
      shownKey = '';
      panel.reset?.();
    },
  };
}

// The console of the screen manager created most recently (module-level, like the HUD prompt,
// because the level opens it without a handle on the UI).
let active = null;

/** Open a system's console. See the file header for the options. */
export function openRepairConsole(options) {
  active?.open(options);
}

/** Close whichever console is open (no-op when none is). */
export function closeRepairConsole() {
  active?.close();
}

/** True when a console is open — for `systemId` specifically, if given. */
export function isRepairConsoleOpen(systemId) {
  return active?.isOpen(systemId) ?? false;
}

export function createRepairConsole() {
  const consoles = {};
  const element = el('div', { className: 'rc-root' });

  let current = null; // { systemId, view, getState, getBanked, cost }
  let frame = 0;
  let last = null;
  let visible = true;
  let paused = false;

  function getConsole(systemId) {
    if (!consoles[systemId]) {
      consoles[systemId] = buildConsole(systemId);
      element.append(consoles[systemId].element);
    }
    return consoles[systemId];
  }

  function draw() {
    const banked = Math.max(0, Math.floor(Number(current.getBanked()) || 0));
    current.view.render(consoleView(current.getState(), banked, current.cost), banked);
  }

  function tick(now) {
    if (!current) return;
    const dt = last === null ? 0.016 : Math.min(MAX_FRAME_DT, (now - last) / 1000);
    last = now;
    draw();
    // Reduce Flashing (Options) holds the small red status lights steady instead of blinking.
    current.view.update(dt, { reduceFlashing: document.body.dataset.reduceFlashing === 'on' });
    frame = window.requestAnimationFrame(tick);
  }

  function stopLoop() {
    window.cancelAnimationFrame(frame);
    last = null;
  }

  function startLoop() {
    stopLoop();
    if (current && visible && !paused) frame = window.requestAnimationFrame(tick);
  }

  const api = {
    element,
    open({ systemId, getState, getBanked, cost }) {
      if (!SYSTEMS[systemId]) return;
      if (current?.systemId === systemId) return;
      if (current) api.close();
      const view = getConsole(systemId);
      current = { systemId, view, getState, getBanked, cost };
      draw(); // puts the panel on the right step first...
      view.reset(); // ...so its freshly seeded log lines match it
      view.element.hidden = false;
      startLoop();
    },
    close() {
      if (!current) return;
      current.view.element.hidden = true;
      current = null;
      stopLoop();
    },
    isOpen(systemId) {
      if (!current) return false;
      return systemId === undefined || current.systemId === systemId;
    },
    /** Hidden while the menus are up; the animation loop only runs while shown. */
    setVisible(show) {
      visible = show;
      element.hidden = !show;
      startLoop();
    },
    /** Paused game: the console stays on screen under the pause scrim but stops animating. */
    setPaused(isPaused) {
      paused = isPaused;
      startLoop();
    },
  };

  active = api;
  return api;
}
