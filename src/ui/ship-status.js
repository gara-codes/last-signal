// src/ui/ship-status.js
//
// TAB Ship Status (the upgraded Command Center view) — final design, side panel on the right
// (team decision, Oct 2026). Hold TAB to view; it closes on release. The world stays live and
// only lightly dimmed, and the left of the screen stays clear so the HUD's own Fuel Cells /
// Oxygen / Health panels remain readable (fuel is never shown twice).
//
// Each system gets one uniform box: name, location, status word, one simplified animation and
// the Untouched / Partial / Full strip. The animations: a horizontal field schematic (Gravity
// Stabilizers), the signal wave (Comms Array) and a horizontal O2 bar with the three cryo pods
// (Oxygen Scrubbers). Content per level is in ship-status-model.js.
//
// Repair states come from a hook main.js registers:
//   ui.registerHooks({ getRepairFlags: () => repairs.exportFlags() });   // null on L1
//
// Reduce Flashing (Options) holds the blinking red node and pod lights steady.

import './ship-status.css';
import { el, svg } from './dom.js';
import { shipStatusView, SHIP_SYSTEMS } from './ship-status-model.js';

const RED = '#ff5252';
const L1_COLOURS = { c: '#cfe8ff', hi: '#eef2f4', dim: '#3d6580' };
// Canvas colours per system; keep in step with --sys-* in theme.css.
const COLOURS = {
  gravity: { c: '#b39dff', hi: '#c9b6ff', dim: '#5d4f93' },
  comms: { c: '#74e0a6', hi: '#9ff0c3', dim: '#3c7358' },
  oxygen: { c: '#8fd0ff', hi: '#cfe8ff', dim: '#3d6580' },
};
const PANEL_W = 452;
const CANVAS_W = PANEL_W - 32;
const MAX_FRAME_DT = 0.05;

const rnd = (a, b) => a + Math.random() * (b - a);

const ICON_PATHS = {
  gravity: () => [
    svg('path', { d: 'M10 2 V12', 'stroke-linecap': 'round' }),
    svg('path', {
      d: 'M5.5 8 L10 12.5 L14.5 8',
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
    }),
    svg('line', { x1: 4, y1: 17, x2: 16, y2: 17, 'stroke-linecap': 'round' }),
  ],
  comms: () => [
    svg('path', { d: 'M5 13 L10 4 L15 13', 'stroke-linejoin': 'round' }),
    svg('path', { d: 'M3 16 Q10 10 17 16', 'stroke-opacity': 0.7 }),
  ],
  oxygen: () => [
    svg('path', { d: 'M3 8c2 0 2-3 4-3s2 3 4 3 2-3 4-3 2 3 4 3' }),
    svg('path', { d: 'M3 13c2 0 2-3 4-3s2 3 4 3 2-3 4-3 2 3 4 3', 'stroke-opacity': 0.55 }),
  ],
};

function buildBox(system) {
  const word = el('span', { className: 'ship-box__word ui-label' });
  const canvas = el('canvas', {
    attrs: { width: CANVAS_W, height: system.theme === 'oxygen' ? 52 : 60, 'aria-hidden': 'true' },
  });
  const note =
    system.theme === 'oxygen' ? el('div', { className: 'ship-box__note ui-mono' }) : null;
  const segs = [0, 1, 2].map(() => el('span'));
  const element = el(
    'div',
    { className: `ship-box ship-box--${system.theme}` },
    el(
      'div',
      { className: 'ship-box__head' },
      el(
        'div',
        { className: 'ship-box__icon' },
        svg(
          'svg',
          {
            width: 14,
            height: 14,
            viewBox: '0 0 20 20',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': 1.8,
            'aria-hidden': 'true',
          },
          ...ICON_PATHS[system.theme]()
        )
      ),
      el(
        'div',
        {},
        el('div', { className: 'ship-box__name ui-label', text: system.name }),
        el('div', { className: 'ship-box__where ui-mono', text: system.where })
      ),
      word
    ),
    canvas,
    note,
    el('div', { className: 'ship-box__segs ui-mono' }, segs)
  );
  return { element, word, canvas, ctx: canvas.getContext('2d'), note, segs, theme: system.theme };
}

// ---- strip drawings (simplified versions of the repair consoles) ----

function drawGravity(c, W, H, t, step, col, blinkOn) {
  c.clearRect(0, 0, W, H);
  c.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  c.lineWidth = 1;
  c.strokeRect(0.5, 0.5, W - 1, H - 1);
  c.setLineDash([2, 5]);
  c.beginPath();
  c.moveTo(0, H / 2);
  c.lineTo(W, H / 2);
  c.stroke();
  c.setLineDash([]);
  const wobble = [9, 3.5, 0.3][step];
  const bob = [7, 3, 0.2][step];
  const n = Math.floor(W / 22);
  c.strokeStyle = col.hi;
  c.lineWidth = 2;
  for (let k = 1; k < n; k++) {
    // field lines stay vertical, sway side to side and bob up and down
    const x = k * (W / n) + wobble * Math.sin(t * (1.3 + (k % 5) * 0.37) + k);
    const y0 = 10 + bob * Math.sin(t * (1.7 + (k % 3) * 0.5) + k * 1.9);
    const y1 = H - 10 + bob * Math.sin(t * (1.1 + (k % 4) * 0.4) + k);
    c.globalAlpha = step === 0 ? 0.45 + 0.55 * Math.abs(Math.sin(t * 1.4 + k)) : 1;
    c.beginPath();
    c.moveTo(x, y0);
    c.lineTo(x, y1);
    c.stroke();
  }
  c.globalAlpha = 1;
  const brokenAtPartial = [1, 4, 5, 6, 9, 11];
  for (let k = 0; k < 12; k++) {
    // nodes travel across the strip on the centre rail
    const x = ((k / 12) * W + t * 26) % W;
    const broken = step === 0 || (step === 1 && brokenAtPartial.includes(k));
    c.fillStyle = broken ? (blinkOn ? RED : col.dim) : col.c;
    c.fillRect(x - 4, H / 2 - 4, 8, 8);
  }
}

function drawWave(c, W, H, t, step, col) {
  c.clearRect(0, 0, W, H);
  c.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  c.lineWidth = 1;
  c.strokeRect(0.5, 0.5, W - 1, H - 1);
  c.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  c.beginPath();
  for (let x = 0; x <= W; x += 3) {
    const y = H / 2 - 16 * Math.sin(x * 0.04 - t * 3);
    if (x) c.lineTo(x, y);
    else c.moveTo(x, y);
  }
  c.stroke();
  const noise = [16, 7, 1.5][step];
  const clean = [0.15, 0.7, 1][step];
  c.strokeStyle = col.c;
  c.lineWidth = 2;
  c.beginPath();
  let pen = false;
  for (let x = 0; x <= W; x += 6) {
    const k = Math.floor((x + t * 140) / 6);
    const h1 = Math.sin(k * 12.9898) * 43758.5453;
    const r = h1 - Math.floor(h1);
    const h2 = Math.sin(k * 4.1414) * 15731.743;
    const r2 = h2 - Math.floor(h2);
    if ((step === 0 && r2 < 0.22) || (step === 1 && r2 < 0.07)) {
      pen = false;
      continue;
    }
    let y = H / 2 - clean * 16 * Math.sin(x * 0.04 - t * 3) + (r - 0.5) * 2 * noise;
    if (step === 0 && r2 > 0.95) y += (r2 > 0.975 ? -1 : 1) * 14;
    if (pen) c.lineTo(x, y);
    else c.moveTo(x, y);
    pen = true;
  }
  c.stroke();
}

function drawOxygen(c, W, H, t, step, col, blinkOn, o2) {
  c.clearRect(0, 0, W, H);
  const podW = 92;
  const barW = W - podW - 16;
  // horizontal segmented O2 bar: cells are vertical stripes filling left to right
  const cell = 6;
  const gap = 4;
  const n = Math.floor(barW / (cell + gap));
  const fill = Math.round((n * o2) / 100);
  for (let k = 0; k < n; k++) {
    c.fillStyle = k < fill ? (step === 0 ? col.dim : col.c) : 'rgba(255, 255, 255, 0.08)';
    c.fillRect(k * (cell + gap), 8, cell, H - 16);
  }
  c.fillStyle = 'rgba(255, 255, 255, 0.10)';
  c.fillRect(0, H / 2 - 5, n * (cell + gap) - gap, 10);
  c.fillStyle = col.hi;
  c.fillRect(fill * (cell + gap) - 3, 3, 3, H - 6);
  // the three cryo pods: lit when sustained, red and blinking when failing
  const ok = step === 2 ? [1, 1, 1] : step === 1 ? [1, 1, 0] : [0, 0, 0];
  for (let p = 0; p < 3; p++) {
    const x = barW + 16 + p * 31;
    const y = 6;
    const w = 24;
    const h = H - 12;
    c.strokeStyle = ok[p] ? col.c : RED;
    c.lineWidth = 1.6;
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, 10);
    else c.rect(x, y, w, h);
    c.stroke();
    c.fillStyle = ok[p] ? col.c : RED;
    c.globalAlpha = ok[p] ? 0.55 + 0.25 * Math.sin(t * 2 + p) : blinkOn ? 0.9 : 0.15;
    c.fillRect(x + 7, y + 8, w - 14, h - 16);
    c.globalAlpha = 1;
  }
}

// L3: the strip becomes a glitched "ACCESS DENIED" — bands of the text slip sideways; no
// brightness flashing, so nothing here needs Reduce Flashing.
function drawDenied(c, W, H, t, g) {
  if (!g.next || t > g.next) {
    g.next = t + rnd(0.08, 0.16);
    g.calm = Math.random() < 0.45;
    g.bands = Array.from({ length: Math.ceil(H / 5) }, () =>
      !g.calm && Math.random() < 0.3 ? rnd(-18, 18) : 0
    );
    g.ghost = !g.calm && Math.random() < 0.5 ? rnd(-6, 6) : 0;
    g.code = `0x${Math.floor(rnd(4096, 65535)).toString(16).toUpperCase()}`;
  }
  c.clearRect(0, 0, W, H);
  c.fillStyle = 'rgba(255, 82, 82, 0.05)';
  c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(255, 82, 82, 0.35)';
  c.lineWidth = 1;
  c.strokeRect(0.5, 0.5, W - 1, H - 1);
  const text = 'ACCESS DENIED';
  c.font = "700 22px Rajdhani, 'Arial Narrow', sans-serif";
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  if ('letterSpacing' in c) c.letterSpacing = '6px';
  if (g.ghost) {
    c.fillStyle = 'rgba(255, 82, 82, 0.28)';
    c.fillText(text, W / 2 + g.ghost, H / 2 - 4);
  }
  g.bands.forEach((offset, k) => {
    c.save();
    c.beginPath();
    c.rect(0, k * 5, W, 5);
    c.clip();
    c.fillStyle = RED;
    c.fillText(text, W / 2 + offset, H / 2 - 4);
    c.restore();
  });
  if ('letterSpacing' in c) c.letterSpacing = '0px';
  c.font = "500 9px 'IBM Plex Mono', monospace";
  c.fillStyle = 'rgba(255, 155, 155, 0.7)';
  c.fillText(`LINK REVOKED · ERR ${g.code}`, W / 2, H - 9);
  c.fillStyle = 'rgba(255, 255, 255, 0.035)';
  for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1);
}

/**
 * @param {object} deps
 * @param {() => boolean} deps.canOpen   TAB only works while this is true (playing, no console)
 * @param {() => string} deps.getLevelId
 * @param {() => (Object<string,string>|null)} deps.getRepairFlags
 */
export function createShipStatus({ canOpen, getLevelId, getRepairFlags }) {
  const location = el('div', { className: 'ship__location ui-mono' });
  const objective = el('span', { className: 'ship__objective-text' });
  const aiLine = el(
    'div',
    { className: 'ship__ai', attrs: { hidden: true } },
    el('span', { className: 'ship__ai-tag ui-mono', text: 'AI' }),
    el('span', { className: 'ship__ai-text' })
  );
  const boxes = SHIP_SYSTEMS.map(buildBox);

  const element = el(
    'div',
    { className: 'ship', attrs: { hidden: true, role: 'dialog', 'aria-label': 'Ship status' } },
    el('div', { className: 'ship__dim' }),
    el(
      'div',
      { className: 'ship__panel ui-anchor ui-anchor--tr' },
      el(
        'div',
        { className: 'ship__title' },
        location,
        el('div', { className: 'ship__name ui-label', text: 'Ship status' })
      ),
      el(
        'div',
        { className: 'ship__objective' },
        el('span', { className: 'ship__objective-key ui-label', text: 'Objective' }),
        objective
      ),
      boxes.map((b) => b.element),
      aiLine,
      el(
        'div',
        { className: 'ship__hint ui-mono' },
        el('span', { className: 'ship__key', text: 'TAB' }),
        'Hold to view'
      )
    )
  );

  let view = null;
  let open = false;
  let frame = 0;
  let last = null;
  let t = 0;
  const o2Level = [30, 58, 90]; // per step, eased each frame
  const glitch = boxes.map(() => ({}));

  function render() {
    view = shipStatusView(getLevelId(), getRepairFlags?.() ?? null);
    element.dataset.level = view.levelId;
    location.textContent = view.location;
    objective.textContent = view.objective;
    aiLine.hidden = !view.aiLine;
    aiLine.lastChild.textContent = view.aiLine ?? '';
    view.systems.forEach((s, i) => {
      const box = boxes[i];
      box.word.textContent = s.word;
      box.word.dataset.tone = s.tone;
      s.segments.forEach((cls, k) => {
        box.segs[k].className = cls;
        box.segs[k].textContent = s.segLabels[k];
      });
      if (box.note) {
        box.note.textContent = view.pods.text;
        box.note.classList.toggle('is-bad', view.pods.bad);
      }
    });
  }

  function draw(dt) {
    t += dt;
    const reduce = document.body.dataset.reduceFlashing === 'on';
    const blinkOn = reduce || Math.sin(t * 8.8) > 0;
    view.systems.forEach((s, i) => {
      const box = boxes[i];
      const W = box.canvas.width;
      const H = box.canvas.height;
      if (view.denied) {
        drawDenied(box.ctx, W, H, t, glitch[i]);
        return;
      }
      const col = view.levelId === 'l1' ? L1_COLOURS : COLOURS[s.theme];
      if (s.theme === 'gravity') drawGravity(box.ctx, W, H, t, s.step, col, blinkOn);
      else if (s.theme === 'comms') drawWave(box.ctx, W, H, t, s.step, col);
      else {
        // O2 reserve: drains when untouched, holds at partial, recovers when full
        if (s.step === 0) {
          o2Level[0] -= dt * 3;
          if (o2Level[0] < 20) o2Level[0] = 34;
        } else {
          const target = s.step === 1 ? 58 : 99;
          o2Level[s.step] += (target - o2Level[s.step]) * Math.min(1, dt * 0.6);
        }
        drawOxygen(box.ctx, W, H, t, s.step, col, blinkOn, o2Level[s.step]);
      }
    });
  }

  function tick(now) {
    if (!open) return;
    const dt = last === null ? 0.016 : Math.min(MAX_FRAME_DT, (now - last) / 1000);
    last = now;
    draw(dt);
    frame = window.requestAnimationFrame(tick);
  }

  function show() {
    if (open || !canOpen()) return;
    open = true;
    render();
    draw(0.016);
    element.hidden = false;
    document.body.dataset.shipStatus = 'open';
    last = null;
    frame = window.requestAnimationFrame(tick);
  }

  function hide() {
    if (!open) return;
    open = false;
    element.hidden = true;
    delete document.body.dataset.shipStatus;
    window.cancelAnimationFrame(frame);
  }

  // Hold to view: keydown opens, keyup (or losing the window) closes. TAB's default (moving
  // focus) is blocked while playing so it can't wander into the hidden menus.
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Tab' || !canOpen()) return;
    event.preventDefault();
    if (!event.repeat) show();
  });
  window.addEventListener('keyup', (event) => {
    if (event.code === 'Tab') hide();
  });
  window.addEventListener('blur', hide);

  return { element, hide, isOpen: () => open };
}
