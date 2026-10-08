// src/ui/screens/repair-console/gravity-panel.js
//
// Gravity Stabilizers console panel (final mockup): two node banks of six bars around a field
// monitor (spinning node ring, field vectors, local-g readout, phase/spin/coil rows and a log).
// Violet per-system colour. Broken nodes' bars stay a muted violet and never flicker; only the
// small red status lights blink (held steady with Reduce Flashing).
//
// Readouts and log copy are decorative placeholders; only the step (untouched / partial / full)
// is real.

import { staticMarkup, collectRefs } from '../../dom.js';

const ACC = '#b39dff';
const HI = '#c9b6ff';
const INK = '#e6e1ff';
const BROKEN = '#5d4f93';
const OFF = 'rgba(179, 157, 255, 0.16)';
const RED = '#ff5252';

const NODE_COUNT = 12;
const PARTIAL_STABLE = new Set([0, 2, 3, 7, 8, 10]); // nodes already back in phase at Partial
const BAR_H = 144;
const PITCH = 12;
const LOG_LINES = 9;

const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const pad = (n, w = 2) => String(n).padStart(w, '0');

// ---- static layout (author-written markup only; runtime values go in via textContent) ----
const nodeMarkup = (i) =>
  `<div class="node" data-i="${i}"><div class="bar"><div class="fill"></div></div><div class="n ui-mono">225</div><div class="dots"><i></i><i></i></div></div>`;

function sideMarkup(side) {
  const start = side === 'l' ? [0, 3] : [6, 9];
  const big =
    side === 'l'
      ? [
          ['Field', 'field'],
          ['Nodes', 'nodes'],
        ]
      : [
          ['Drift', 'drift'],
          ['Load', 'load'],
        ];
  const cluster = (from) => [0, 1, 2].map((k) => nodeMarkup(from + k)).join('');
  return `<div class="side">
    <div class="blk nhdr"><span class="ui-label">${side === 'l' ? 'Bank A · Port' : 'Bank B · Stbd'}</span><span class="ui-mono" data-r="hdr${side}">00/06</span></div>
    <div class="cluster">${cluster(start[0])}</div>
    <div class="mid">
      <div class="big"><span class="ui-label">${big[0][0]}</span><span class="v ui-mono"><span data-r="${big[0][1]}">0</span><small data-r="${big[0][1]}U"></small></span></div>
      <div class="big r"><span class="ui-label">${big[1][0]}</span><span class="v ui-mono"><span data-r="${big[1][1]}">0</span><small data-r="${big[1][1]}U"></small></span></div>
    </div>
    <div class="cluster cluster--low">${cluster(start[1])}</div>
  </div>`;
}

function schematicMarkup() {
  let nodes = '';
  for (let i = 0; i < NODE_COUNT; i++) {
    const a = (i / NODE_COUNT) * Math.PI * 2 - Math.PI / 2;
    const x = (150 + Math.cos(a) * 104 - 5).toFixed(1);
    const y = (150 + Math.sin(a) * 104 - 5).toFixed(1);
    nodes += `<rect data-sn="${i}" x="${x}" y="${y}" width="10" height="10"/>`;
  }
  let vecs = '';
  for (let i = 0; i < 16; i++) {
    vecs += `<line data-vec="${i}" x1="150" y1="80" x2="150" y2="46" stroke="${HI}" stroke-width="2.5" stroke-linecap="square"/>`;
  }
  return `<svg width="196" height="196" viewBox="0 0 300 300" aria-hidden="true">
    <g data-r="outer" class="spin-origin"><circle cx="150" cy="150" r="138" fill="none" stroke="var(--ln)" stroke-width="1.5" stroke-dasharray="3 7"/></g>
    <circle cx="150" cy="150" r="118" fill="none" stroke="var(--ln)" stroke-width="1.5"/>
    <circle cx="150" cy="150" r="90" fill="none" stroke="var(--ln)" stroke-width="1.5"/>
    <line x1="150" y1="16" x2="150" y2="284" stroke="var(--ln)" stroke-dasharray="2 6"/>
    <line x1="16" y1="150" x2="284" y2="150" stroke="var(--ln)" stroke-dasharray="2 6"/>
    <g data-r="spin" class="spin-origin">${nodes}</g>
    <g>${vecs}</g>
    <circle data-r="hub" cx="150" cy="150" r="22" fill="none" stroke="${HI}" stroke-width="2"/>
    <circle data-r="hubdot" cx="150" cy="150" r="4" fill="${HI}"/></svg>`;
}

const readoutRow = (name, ref, stRef) => `<div class="brow">
    <div class="chip ui-mono">${name}</div>
    <div class="brk"><span class="b">[</span><span class="in ui-mono" data-r="${ref}"></span><span class="b">]</span></div>
    <div class="chip ui-mono" data-r="${stRef}"></div>
  </div>`;

const MARKUP = `<div class="rc-unit rc-gs">
  ${sideMarkup('l')}
  <div class="blk core">
    <div class="cap ui-mono"><span>FIELD MONITOR</span><span>GS-CORE · 12 NODES</span></div>
    <div class="band">${schematicMarkup()}
      <div class="gread">
        <span class="ui-label">Local gravity</span>
        <div class="g ui-mono" data-r="gwrap"><span data-r="g">0.62</span><small>g</small></div>
        <div class="scale"><div class="trk"></div><div class="tick"></div><div class="mk" data-r="gmk"></div>
          <span class="ax ax--start ui-mono">0.0</span><span class="ax ax--one ui-mono">1.00</span><span class="ax ax--end ui-mono">1.5</span></div>
      </div>
    </div>
    ${readoutRow('PHASE', 'phase', 'phasest')}
    <div class="log"><div class="lines" data-r="lines"></div></div>
    ${readoutRow('SPIN', 'spin2', 'spinst')}
    ${readoutRow('COIL', 'coil', 'coilst')}
  </div>
  ${sideMarkup('r')}
</div>`;

// Log pools per step; lines matching WARN_RE are shown in red.
const LOG = [
  [
    () => `NODE ${pad(rint(1, 12))} PHASE DRIFT +${rnd(2, 14).toFixed(1)}°`,
    () => `INERTIAL DAMPER ${pad(rint(1, 8))} — NO RESPONSE`,
    () => `FIELD COHERENCE ${rint(28, 44)}% — BELOW THRESHOLD`,
    () => `WARN: LOCAL g VARIANCE ±0.${rint(12, 31)}`,
    () => `RESYNC ATTEMPT ${rint(3, 48)} FAILED`,
    () => `SPIN RATE 1.${rint(60, 99)} RPM — CORRECTING`,
    () => 'HANDHOLD ADVISORY ISSUED // SEC 2',
  ],
  [
    () => `NODE ${pad(rint(1, 12))} RESYNC OK`,
    () => `NODE ${pad(rint(1, 12))} PHASE DRIFT +${rnd(1, 5).toFixed(1)}°`,
    () => `FIELD COHERENCE ${rint(66, 76)}%`,
    () => `DAMPER BANK ${['A', 'B'][rint(0, 1)]} PARTIAL`,
    () => `CALIBRATING EMITTER ${pad(rint(1, 12))}…`,
    () => `LOCAL g VARIANCE ±0.0${rint(3, 7)}`,
  ],
  [
    () => 'ALL NODES IN PHASE',
    () => 'FIELD COHERENCE 100%',
    () => 'LOCAL g 1.00 ± 0.00',
    () => `COIL ${pad(rint(1, 6))} TEMP ${rint(39, 42)}K — NOMINAL`,
    () => 'IDLE // MONITORING',
    () => 'SPIN RATE 1.92 RPM — LOCKED',
  ],
];
const WARN_RE = /FAILED|NO RESPONSE|WARN|BELOW/;

export function createGravityPanel() {
  const element = staticMarkup(MARKUP);
  const R = collectRefs(element);
  const nodes = [...element.querySelectorAll('.node')]
    .sort((a, b) => a.dataset.i - b.dataset.i)
    .map((node) => ({
      node,
      fill: node.querySelector('.fill'),
      num: node.querySelector('.n'),
      dots: node.querySelectorAll('.dots i'),
      lvl: rnd(0.1, 0.4),
      tgt: 0.3,
      next: 0,
      value: rint(100, 999),
      numT: 0,
    }));
  const ringNodes = [...element.querySelectorAll('[data-sn]')].sort(
    (a, b) => a.dataset.sn - b.dataset.sn
  );
  const vectors = [...element.querySelectorAll('[data-vec]')];
  const vectorPhase = vectors.map(() => [rnd(0.8, 2.4), rnd(0, 6.28)]);

  let step = 0;
  let t = 0;
  let readT = 0;
  let logT = 0;

  const stableAt = (i) => step === 2 || (step === 1 && PARTIAL_STABLE.has(i));

  function pushLog() {
    const pool = LOG[step];
    const text = pool[rint(0, pool.length - 1)]();
    const secs = 15157 + t;
    const ts = `${pad(Math.floor(secs / 3600))}:${pad(Math.floor(secs / 60) % 60)}:${pad(Math.floor(secs % 60))}`;
    const warn = WARN_RE.test(text);
    const line = document.createElement('div');
    line.className = 'ln';
    const tsEl = document.createElement('span');
    tsEl.className = 'ts';
    tsEl.textContent = ts;
    const msg = document.createElement('span');
    msg.className = warn ? 'is-warn' : '';
    msg.textContent = text;
    line.append(tsEl, msg);
    R.lines.append(line);
    while (R.lines.children.length > LOG_LINES) R.lines.firstChild.remove();
  }

  function readouts() {
    let online = 0;
    for (let i = 0; i < NODE_COUNT; i++) if (stableAt(i)) online++;
    const g = [
      0.42 + 0.16 * Math.sin(t * 0.9) + rnd(-0.04, 0.04),
      0.81 + 0.04 * Math.sin(t * 0.7) + rnd(-0.01, 0.01),
      1 + rnd(-0.003, 0.003),
    ][step];
    R.g.textContent = g.toFixed(2);
    R.gmk.style.left = `${Math.max(0, Math.min(100, (g / 1.5) * 100))}%`;
    R.field.textContent = String([rint(29, 41), rint(68, 74), rint(99, 100)][step]);
    R.fieldU.textContent = '%';
    R.nodes.textContent = pad(online);
    R.nodesU.textContent = '/12';
    R.drift.textContent = [rnd(11, 17), rnd(4, 5.6), rnd(0, 0.1)][step].toFixed(1);
    R.driftU.textContent = '°';
    R.load.textContent = String([rint(88, 97), rint(61, 67), rint(40, 42)][step]);
    R.loadU.textContent = '%';
    R.spin2.textContent = `${[rnd(1.6, 1.99), rnd(1.88, 1.95), 1.92][step].toFixed(2)} RPM`;
    R.coil.textContent = `${[rint(52, 71), rint(44, 50), rint(39, 42)][step]} K`;
    const bank = (from) => [0, 1, 2, 3, 4, 5].filter((k) => stableAt(from + k)).length;
    R.hdrl.textContent = `${pad(bank(0))}/06`;
    R.hdrr.textContent = `${pad(bank(6))}/06`;
    R.phase.textContent = `±${[rnd(11, 17), rnd(4, 5.6), rnd(0, 0.1)][step].toFixed(1)}°`;
  }

  function setStep(next) {
    step = next;
    element.dataset.step = String(step);
    R.phasest.textContent = ['DRIFTING', 'SYNCING', 'LOCKED'][step];
    R.spinst.textContent = ['HUNTING', 'TRIMMING', 'LOCKED'][step];
    R.coilst.textContent = ['HIGH', 'WARM', 'NOMINAL'][step];
    const red = step === 0; // untouched: more red — warning chips, g readout, hub ring
    R.hub.setAttribute('stroke', red ? RED : HI);
    R.hubdot.setAttribute('fill', red ? RED : HI);
    readouts();
  }

  function update(dt, { reduceFlashing = false } = {}) {
    t += dt;
    // ~1.4 Hz blink for the small status lights only; steady red with Reduce Flashing
    nodes.forEach((n, i) => {
      const stable = stableAt(i);
      if (stable) {
        n.tgt = 0.92 + 0.06 * Math.sin(t * 0.9 + i * 0.7);
        n.lvl += (n.tgt - n.lvl) * Math.min(1, dt * 3);
      } else {
        if (t > n.next) {
          // wander, occasional surge, then stall and drain — no flicker
          const r = Math.random();
          n.tgt = r < 0.12 ? rnd(0.55, 0.72) : rnd(0.06, 0.42);
          n.next = t + (r < 0.12 ? rnd(0.3, 0.5) : rnd(0.5, 1.4));
        }
        n.lvl += (n.tgt - n.lvl) * Math.min(1, dt * 4);
      }
      const h = Math.max(PITCH, Math.round((Math.min(1, n.lvl) * BAR_H) / PITCH) * PITCH);
      n.node.style.setProperty('--c', stable ? ACC : BROKEN);
      n.fill.style.height = `${h}px`;
      if (t > n.numT) {
        n.value = stable ? Math.max(100, Math.min(999, n.value + rint(-2, 2))) : rint(100, 999);
        n.numT = t + (stable ? 0.7 : 0.2);
        n.num.textContent = String(n.value);
        n.num.style.color = stable ? INK : RED; // broken nodes' readouts in red (bars stay muted)
      }
      const blink = reduceFlashing || Math.sin(t * 8.8 + i) > 0;
      n.dots[0].style.background = stable ? ACC : blink ? RED : OFF;
      n.dots[1].style.background = stable ? ACC : OFF;
      ringNodes[i].setAttribute('fill', stable ? HI : blink ? RED : BROKEN);
    });

    R.spin.style.transform = `rotate(${(t * 8) % 360}deg)`;
    R.outer.style.transform = `rotate(${(-t * 4) % 360}deg)`;
    const wobble = [24, 8, 0.5][step];
    vectors.forEach((v, i) => {
      const [f, ph] = vectorPhase[i];
      const a = i * 22.5 + wobble * Math.sin(t * f + ph);
      const len = step === 2 ? 0 : (1 - (0.75 + 0.25 * Math.sin(t * f * 1.3 + ph))) * 20;
      v.setAttribute('transform', `rotate(${a.toFixed(2)} 150 150) translate(0 ${len.toFixed(1)})`);
    });

    if (t > readT) {
      readT = t + 0.25;
      readouts();
    }
    logT -= dt;
    if (logT <= 0) {
      pushLog();
      logT = [0.6, 1, 1.9][step] * rnd(0.7, 1.3);
    }
  }

  function reset() {
    R.lines.replaceChildren();
    for (let i = 0; i < 7; i++) pushLog();
  }

  setStep(0);
  reset();
  update(0.016);
  return { element, setStep, update, reset };
}
