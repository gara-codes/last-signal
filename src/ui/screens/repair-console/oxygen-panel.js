// src/ui/screens/repair-console/oxygen-panel.js
//
// Oxygen Scrubbers console panel (final mockup), from Shannon's two wireframes: the cryo-pod list
// (Yannis: up to three crewmates in cryosleep from L1, fed by this scrubber), the CO2 scrubber-bed
// manifold, the intake fans and the O2 reserve bar. Icy blue per-system colour (the HUD's oxygen
// colour). Untouched: everything failing. Partial: pods 01-02 stable, 03 failing. Full: all
// sustained.
//
// Crew names, bed/fan labels, log lines and percentages are placeholders; only the step is real.

import { staticMarkup, collectRefs } from '../../dom.js';

const ACC = '#8fd0ff';
const HI = '#cfe8ff';
const DIM = '#3d6580';
const RED = '#ff5252';
const AMBER = '#f2a93c';
const MUT = '#7f97aa';
const OFF = 'rgba(143, 208, 255, 0.16)';

const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));

const TANK_X = [30, 98, 166, 234, 302]; // scrubber bed x positions inside the 360-wide manifold
const BAR_H = 360;
const BAR_PITCH = 10;
const EKG_W = 110;
const EKG_H = 30;

// per step: which beds work (stuck beds stay saturated), fan output, pod feeds
const WORKING_BEDS = [
  [0, 0, 0, 0, 0],
  [1, 0, 1, 1, 0],
  [1, 1, 1, 1, 1],
];
const FAN_OUTPUT = [
  [0, 0.14, 0],
  [1, 0.48, 0],
  [1, 1, 1],
];
const PODS = [
  [
    { feed: 24, hr: 41, ok: false },
    { feed: 19, hr: 38, ok: false },
    { feed: 27, hr: 43, ok: false },
  ],
  [
    { feed: 78, hr: 52, ok: true },
    { feed: 74, hr: 50, ok: true },
    { feed: 31, hr: 40, ok: false },
  ],
  [
    { feed: 97, hr: 50, ok: true },
    { feed: 98, hr: 48, ok: true },
    { feed: 96, hr: 51, ok: true },
  ],
];
const POD_LABELS = [
  ['Cryo pod 01 · Crew 01', 'CRYO_POD.01'],
  ['Cryo pod 02 · Crew 02', 'CRYO_POD.02'],
  ['Cryo pod 03 · Crew 03', 'CRYO_POD.03'],
];
const LOG = [
  [
    () => `POD 0${rint(1, 3)} O₂ FEED BELOW MINIMUM`,
    () => `CO₂ ${(3.6 + rnd(0, 0.6)).toFixed(1)}% — ABOVE LIMIT`,
    () => `FAN 0${rint(1, 3)} STALL DETECTED`,
    () => 'CRYO BAY: VITALS DECLINING',
    () => `BED ${rint(1, 5)} SATURATED — NO PURGE`,
  ],
  [
    () => 'POD 03 O₂ FEED BELOW MINIMUM',
    () => 'PODS 01–02 FEED RESTORED',
    () => `BED ${[2, 5][rint(0, 1)]} VALVE STUCK — SHUT`,
    () => `CO₂ ${(1.2 + rnd(0, 0.4)).toFixed(1)}% — FALLING`,
    () => 'O₂ RESERVE HOLDING',
  ],
  [
    () => 'CRYO BAY: ALL PODS SUSTAINED',
    () => `BED ${rint(1, 5)} PURGE CYCLE OK`,
    () => `CO₂ 0.${rint(3, 5)}% — NOMINAL`,
    () => 'ALL FANS 100%',
    () => 'O₂ RESERVE RECOVERING',
  ],
];

// ---- static layout (author-written markup only; runtime values go in via textContent) ----
function manifoldMarkup() {
  let tanks = '';
  let valves = '';
  TANK_X.forEach((x, i) => {
    tanks += `<line x1="${x + 22}" y1="54" x2="${x + 22}" y2="74" stroke="var(--ln)" stroke-width="2"/>
      <rect x="${x}" y="74" width="44" height="86" fill="none" stroke="var(--ln)" stroke-width="2"/>
      <rect data-tf="${i}" x="${x + 2}" y="158" width="40" height="0" fill="${ACC}"/>
      <rect data-tb="${i}" x="${x}" y="74" width="44" height="86" fill="none" stroke="transparent" stroke-width="2"/>`;
    valves += `<rect x="${x}" y="176" width="44" height="17" fill="none" stroke="var(--ln)" stroke-width="1.5"/><text data-tv="${i}" x="${x + 22}" y="188" text-anchor="middle" class="svg-mono" fill="${MUT}">SHUT</text>
      <rect x="${x}" y="198" width="44" height="17" fill="none" stroke="var(--ln)" stroke-width="1.5"/><text data-tp="${i}" x="${x + 22}" y="210" text-anchor="middle" class="svg-mono" fill="${MUT}">98%</text>`;
  });
  return `<svg width="360" height="220" viewBox="0 0 360 220" aria-hidden="true" class="manifold">
    <line x1="52" y1="54" x2="324" y2="54" stroke="var(--ln)" stroke-width="2"/>
    <line x1="188" y1="34" x2="188" y2="54" stroke="var(--ln)" stroke-width="2"/>
    <path data-r="flow" d="M188 34 V54 M52 54 H324 M52 54 V74 M120 54 V74 M188 54 V74 M256 54 V74 M324 54 V74" fill="none" stroke="${HI}" stroke-width="2" stroke-dasharray="4 10"/>
    ${tanks}${valves}
    <text x="0" y="122" class="svg-label" fill="${MUT}">BED</text>
    <text x="0" y="188" class="svg-label" fill="${MUT}">VLV</text>
    <text x="0" y="210" class="svg-label" fill="${MUT}">CO₂</text>
  </svg>`;
}

const podMarkup = ([title, id], i) => `<div class="ent"><span class="t ui-label">${title}</span>
  <div class="pod"><div class="val"><div class="f" data-cf="${i}"></div><span class="ui-mono">${id}</span></div><canvas data-ekg="${i}" width="${EKG_W}" height="${EKG_H}"></canvas><span class="bpm" data-bpm="${i}"></span></div>
  <span class="cap ui-mono" data-cc="${i}"></span></div>`;

const fanMarkup = (n) =>
  `<div class="fan"><div class="box"><span class="nm ui-mono">INTAKE<br>FAN 0${n + 1}</span><div class="ticks" data-fan="${n}">${'<i><b></b></i>'.repeat(24)}</div></div><span class="pct ui-mono" data-fp="${n}">0%</span></div>`;

const MARKUP = `<div class="rc-unit rc-ox">
  <div class="ab blk hb" style="left:44px; top:0; width:396px; height:68px;">
    <div class="t ui-label">Primary scrubber</div>
    <div class="b"><span class="ui-mono">SCRUB_UNIT.02</span><span class="ui-label" data-r="unitst"></span></div>
  </div>
  <div class="ab tabs" data-r="tabs" style="left:0; top:122px;"><i></i><i></i><i></i></div>
  <div class="ab blk cart" style="left:44px; top:82px; width:396px; height:438px;">
    <div class="carthead ui-mono"><span>CRYO BAY // L1 HABITATION</span><span data-r="podsum"></span></div>
    ${POD_LABELS.map(podMarkup).join('')}
    <div class="clog" data-r="clog"></div>
  </div>

  <div class="ab" style="left:472px; top:0; width:376px;">
    <div class="blk bedhead">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 2 L17 6 V14 L10 18 L3 14 V6 Z"/><path d="M3 6 L10 10 L17 6 M10 10 V18"/></svg>
      <span class="ui-label">CO₂ Scrubber beds</span><span class="ui-mono bedcount" data-r="beds"></span>
    </div>
    <div class="manifold-wrap">${manifoldMarkup()}</div>
  </div>
  <div class="ab fans" style="left:472px; top:296px; width:376px;">
    <div class="blk ftitle"><span class="ui-label">Air handling · intake</span><span class="ui-mono" data-r="fanst"></span></div>
    ${[0, 1, 2].map(fanMarkup).join('')}
  </div>

  <div class="ab o2col" style="left:880px; top:0; width:130px; height:520px;">
    <div class="o2pct ui-mono" data-r="o2pct">31%</div>
    <div class="ui-label o2sub">Remaining</div>
    <div class="ab" style="left:66px; top:4px;"><div class="o2bar"><div class="core"></div><div class="fill" data-r="fill"></div><div class="edge" data-r="edge"></div></div></div>
    <div class="arrow" data-ar="0" style="left:44px; top:150px;"></div>
    <div class="arrow" data-ar="1" style="left:44px; top:178px;"></div>
    <div class="arrow" data-ar="2" style="left:44px; top:206px;"></div>
    <div class="ab" style="left:0; top:296px;">
      <div class="o2big ui-mono">O<span>2</span></div>
      <div class="ui-label o2sub">Levels</div>
      <div class="dots" data-r="o2dots"><i></i><i></i></div>
    </div>
    <div class="ab rule" style="left:0; top:378px; width:130px;"></div>
    <div class="ab supply ui-mono" data-r="supply" style="left:0; top:392px; width:130px; height:28px;"></div>
    <div class="ab rates ui-mono" style="left:0; top:430px; width:130px;"><span data-r="rate"></span><br><span data-r="co2"></span></div>
  </div>
</div>`;

export function createOxygenPanel() {
  const element = staticMarkup(MARKUP);
  const R = collectRefs(element);
  const all = (selector) => [...element.querySelectorAll(selector)];
  const tankFill = all('[data-tf]');
  const tankBorder = all('[data-tb]');
  const valveText = all('[data-tv]');
  const satText = all('[data-tp]');
  const podFill = all('[data-cf]');
  const podCaption = all('[data-cc]');
  const podBpm = all('[data-bpm]');
  const tabs = [...R.tabs.children];
  const arrows = all('[data-ar]');
  const ekgs = all('[data-ekg]').map((canvas) => ({
    ctx: canvas.getContext('2d'),
    buf: new Array(55).fill(15),
    phase: Math.random(),
    acc: 0,
  }));
  const fans = all('[data-fan]').map((row) =>
    [...row.children].map((tick) => tick.firstElementChild)
  );
  const fanPct = all('[data-fp]');
  const [dotA, dotB] = R.o2dots.children;

  let step = 0;
  let t = 0;
  let readT = 0;
  let logT = 0;
  let tabT = 0;
  let tab = 0;
  let o2 = 31;
  let flowOffset = 0;
  const beds = TANK_X.map(() => ({ sat: rnd(0.86, 0.98) }));
  const logLines = [];

  function drawEkg(i, dt) {
    const e = ekgs[i];
    const pod = PODS[step][i];
    e.acc += dt;
    while (e.acc > 0.06) {
      // advance the trace ~16 samples a second
      e.acc -= 0.06;
      e.phase += 0.06 * (pod.hr / 60) * (pod.ok ? 1 : rnd(0.7, 1.3));
      const f = e.phase % 1;
      const amp = pod.ok ? 1 : 0.55;
      let y = 15 + rnd(-0.6, 0.6) * (pod.ok ? 0.5 : 1.6);
      if (f < 0.06) y = 15 - 12 * amp;
      else if (f < 0.1) y = 15 + 6 * amp;
      else if (f > 0.35 && f < 0.45) y = 15 - 3 * amp;
      e.buf.push(y);
      e.buf.shift();
    }
    const c = e.ctx;
    c.clearRect(0, 0, EKG_W, EKG_H);
    c.strokeStyle = pod.ok ? ACC : RED;
    c.lineWidth = 1.6;
    c.beginPath();
    e.buf.forEach((y, k) => (k ? c.lineTo(k * 2, y) : c.moveTo(0, y)));
    c.stroke();
  }

  function pushLog() {
    const pool = LOG[step];
    logLines.push(pool[rint(0, pool.length - 1)]());
    while (logLines.length > 4) logLines.shift();
    R.clog.replaceChildren(
      ...logLines.map((text, i) => {
        const line = document.createElement('div');
        line.textContent = text;
        line.style.opacity = String(0.45 + i * 0.18);
        return line;
      })
    );
  }

  function readouts() {
    R.o2pct.textContent = `${Math.round(o2)}%`;
    PODS[step].forEach((pod, i) => {
      const v = Math.min(100, Math.max(0, pod.feed + rint(-1, 1)));
      podFill[i].style.width = `${v}%`;
      podFill[i].classList.toggle('is-bad', !pod.ok);
      podCaption[i].textContent = `O₂ FEED ${v}% · VITALS ${pod.ok ? 'STABLE' : 'WEAK'}`;
      podCaption[i].style.color = pod.ok ? MUT : RED;
      podBpm[i].textContent = `${pod.hr + rint(-1, 1)} BPM`;
      podBpm[i].style.color = pod.ok ? '' : RED;
    });
    const sustained = PODS[step].filter((p) => p.ok).length;
    R.podsum.textContent = `${sustained}/3 SUSTAINED`;
    R.podsum.style.color = sustained < 3 ? RED : MUT;
    FAN_OUTPUT[step].forEach((out, f) => {
      const v = out === 0 ? 0 : Math.round(out * 100 + (out < 1 ? rint(-3, 3) : 0));
      fanPct[f].textContent = `${v}%`;
      fanPct[f].style.color = v === 0 ? RED : '';
    });
    R.rate.textContent = [
      'RATE −0.9%/MIN',
      `RATE ${Math.random() < 0.5 ? '+' : '−'}0.${rint(0, 1)}%/MIN`,
      'RATE +1.4%/MIN',
    ][step];
    R.co2.textContent = `CO₂ ${[3.6 + rnd(0, 0.6), 1.2 + rnd(0, 0.3), 0.3 + rnd(0, 0.2)][step].toFixed(1)}%`;
  }

  function setStep(next) {
    step = next;
    element.dataset.step = String(step);
    R.unitst.textContent = ['Offline', 'Degraded', 'Online'][step];
    R.unitst.style.color = [RED, AMBER, HI][step];
    R.supply.textContent = ['DRAINING', 'HOLDING', 'RECOVERING'][step];
    R.supply.classList.toggle('is-bad', step === 0);
    R.fanst.textContent = ['E3 · 1/3 SPINNING', 'E2 · 2/3 SPINNING', 'OK · 3/3 SPINNING'][step];
    readouts();
  }

  function update(dt, { reduceFlashing = false } = {}) {
    t += dt;
    // O2 reserve: drains when untouched, holds when partial, refills when full
    if (step === 0) {
      o2 -= dt * 0.9;
      if (o2 < 22) o2 = 34;
    } else {
      const target = step === 1 ? 58 : 99;
      o2 +=
        (target - o2) * Math.min(1, dt * 0.6) + Math.sin(t * 1.3) * dt * (step === 1 ? 1.2 : 0.3);
    }
    const h = Math.max(BAR_PITCH, Math.round(((o2 / 100) * BAR_H) / BAR_PITCH) * BAR_PITCH);
    R.fill.style.height = `${h}px`;
    R.edge.style.bottom = `${h - 2}px`;
    R.fill.style.opacity = step === 0 ? '0.7' : '1';

    // intake arrows chase while air is moving
    const speed = [0, 1.2, 3][step];
    arrows.forEach((a, i) => {
      const on = speed > 0 && Math.floor(t * speed * 3 - i) % 3 === 0;
      a.style.borderLeftColor = speed === 0 ? DIM : on ? HI : ACC;
      a.style.opacity = speed === 0 ? '0.5' : on ? '1' : '0.45';
    });

    // small status lights blink ~1.4 Hz; steady with Reduce Flashing
    const blink = reduceFlashing || Math.sin(t * 8.8) > 0;
    dotA.style.background = step === 0 ? (blink ? RED : OFF) : ACC;
    dotB.style.background = step === 2 ? ACC : OFF;

    // beds: working beds absorb slowly and purge one at a time; stuck beds stay saturated
    const work = WORKING_BEDS[step];
    const purging = Math.floor(t / 2.4) % 5;
    let cycling = 0;
    beds.forEach((b, i) => {
      if (!work[i]) b.sat += (0.97 - b.sat) * dt * 0.8;
      else {
        cycling++;
        if (i === purging) b.sat += (0.08 - b.sat) * dt * 2.2;
        else b.sat = Math.min(0.9, b.sat + dt * 0.05);
      }
      const hh = Math.round(b.sat * 82);
      tankFill[i].setAttribute('height', hh);
      tankFill[i].setAttribute('y', 158 - hh);
      tankFill[i].setAttribute('fill', work[i] ? ACC : DIM);
      tankBorder[i].setAttribute('stroke', work[i] || !blink ? 'transparent' : RED);
      valveText[i].textContent = !work[i] ? 'STUCK' : i === purging ? 'PURGE' : 'OPEN';
      valveText[i].setAttribute('fill', !work[i] ? RED : i === purging ? HI : MUT);
      satText[i].textContent = `${Math.round(b.sat * 100)}%`;
    });
    flowOffset -= dt * [0, 14, 34][step];
    R.flow.setAttribute('stroke-dashoffset', flowOffset.toFixed(1));
    R.flow.style.opacity = step === 0 ? '0' : '1';
    R.beds.textContent = `${cycling}/5 CYCLING`;

    // fans: ripple across the ticks, amplitude by fan output
    fans.forEach((row, f) => {
      const out = FAN_OUTPUT[step][f];
      const stutter = step === 0 && f === 1 ? (Math.sin(t * 3) > 0.2 ? 1 : 0.2) : 1;
      const amp = out * stutter;
      row.forEach((tick, k) => {
        const hgt = 4 + amp * (12 + 12 * Math.abs(Math.sin(t * (4 + f) + k * 0.55)));
        tick.style.height = `${hgt.toFixed(1)}px`;
        tick.style.background = amp > 0.05 ? ACC : DIM;
      });
    });

    // cryo pods: the side tabs scan through the pods, vitals traces run continuously
    if (t > tabT) {
      tabT = t + 1.6;
      tab = (tab + 1) % 3;
      tabs.forEach((el, i) => el.classList.toggle('on', i === tab));
    }
    ekgs.forEach((_, i) => drawEkg(i, dt));

    if (t > readT) {
      readT = t + 0.3;
      readouts();
    }
    logT -= dt;
    if (logT <= 0) {
      pushLog();
      logT = [0.9, 1.4, 2.2][step] * rnd(0.8, 1.2);
    }
  }

  function reset() {
    logLines.length = 0;
    for (let i = 0; i < 4; i++) pushLog();
  }

  setStep(0);
  reset();
  update(0.016);
  return { element, setStep, update, reset };
}
