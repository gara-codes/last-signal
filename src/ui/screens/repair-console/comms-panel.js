// src/ui/screens/repair-console/comms-panel.js
//
// Comms Array console panel (final mockup), built on Shannon's terminal wireframe: a message panel
// with the live jagged signal and slowly corrupting typed text, a row of transmission chips that
// go in-flight -> failed / delivered, a contact feed (static / unstable / live), antennas and a
// dish readout. Green per-system colour.
//
// The relay name (Kestrel-7), message copy, timestamps and band names are placeholders; only the
// step (untouched / partial / full) is real.

import { staticMarkup, collectRefs } from '../../dom.js';

const ACC = '#74e0a6';
const HI = '#9ff0c3';
const DIM = '#3c7358';
const RED = '#ff5252';
const AMBER = '#f2a93c';
const MUT = '#7fa592';

const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const pad = (n, w = 2) => String(n).padStart(w, '0');

const WAVE_W = 612;
const WAVE_H = 104;
const FEED_W = 230;
const FEED_H = 226;
const BANDS = ['COMM_BAND.3_OUT', 'COMM_BAND.1_IN', 'COMM_BAND.2_OUT', 'COMM_BAND.4_IN'];
const MESSAGE =
  'RELAY KESTREL-7 > STATION BEACON\nHANDSHAKE ACKNOWLEDGED. CHANNEL OPEN.\nAWAITING STATUS REPORT FROM ENGINEERING CORE.';
const GLYPHS = '▒░█#%/\\<>?';

// ---- static layout (author-written markup only; runtime values go in via textContent) ----
const ICONS = `<span class="ic-spin"><svg class="spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 3 A9 9 0 1 1 3 12" stroke-linecap="round"/></svg></span>
  <span class="ic-fail"><svg width="22" height="20" viewBox="0 0 24 22" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 L22.5 20 H1.5 Z" stroke-linejoin="round"/><line x1="12" y1="8" x2="12" y2="13.5"/><circle cx="12" cy="16.6" r="1.1" fill="currentColor" stroke="none"/></svg></span>
  <span class="ic-ok"><svg width="22" height="20" viewBox="0 0 24 22" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 11.5 L10 17 L20 5" stroke-linejoin="round" stroke-linecap="round"/></svg></span>`;
const txMarkup = (i, left, width) =>
  `<div class="ab tx" style="left:${left}px; top:392px; width:${width}px;" data-r="tx${i}"><div class="body"><span class="t1 ui-mono"></span><span class="t2 ui-mono"></span><span class="t3 ui-mono"></span></div><div class="ic">${ICONS}</div></div>`;
const hexMarkup = (ref, inner) =>
  `<span data-r="${ref}"><svg class="hex" viewBox="0 0 30 34" fill="none"><path d="M15 1.5 L28 9 V25 L15 32.5 L2 25 V9 Z" stroke="currentColor" stroke-width="1.6"/>${inner}</svg></span>`;
const antMarkup = (ref, left, top, width, s1, v) =>
  `<div class="ab ant" style="left:${left}px; top:${top}px; width:${width}px;" data-r="${ref}"><span class="s1 ui-mono">${s1}</span><span class="v ui-mono">${v}</span><span class="s2 ui-mono"></span></div>`;

const MARKUP = `<div class="rc-unit rc-cx">
  <div class="ab toprow" style="left:0; top:0; width:440px; height:38px;"><span class="ui-label">Communications_Terminal &gt; </span><span class="ui-label" data-r="access"></span><div class="uline"></div></div>
  <div class="ab filter" style="left:470px; top:0; width:160px;"><span class="ui-label">Filter by date</span><div class="uline"></div></div>
  <div class="ab filter" style="left:655px; top:0; width:160px;"><span class="ui-label">Filter by ID</span><div class="uline"></div></div>
  <div class="ab filter" style="left:840px; top:0; width:170px;"><span class="ui-label">Filter by destination</span><div class="uline"></div></div>

  <div class="ab msghead" style="left:0; top:62px;"><span class="ui-label">Message:</span> <span class="ui-label" data-r="msgstate"></span></div>
  <div class="ab blk msgpanel" style="left:0; top:98px; width:650px; height:232px;">
    <div class="msgmeta ui-mono"><span data-r="carrier"></span><span data-r="snr"></span></div>
    <canvas data-r="wave" width="${WAVE_W}" height="${WAVE_H}"></canvas>
    <div class="msgtext" data-r="msg"></div>
  </div>
  <div class="ab rule" style="left:0; top:346px; width:650px;"></div>

  <div class="ab stamp" style="left:0; top:358px;"><span data-r="ts0a">--</span><br><span data-r="ts0b">--</span></div>
  <div class="ab stamp" style="left:193px; top:358px;"><span data-r="ts1a">--</span><br><span data-r="ts1b">--</span></div>
  <div class="ab stamp" style="left:386px; top:358px;"><span data-r="ts2a">--</span><br><span data-r="ts2b">--</span></div>
  ${txMarkup(0, 0, 170)}
  ${txMarkup(1, 193, 170)}
  ${antMarkup('antrow', 386, 392, 70, 'VIA', 'ANT-1')}
  ${txMarkup(2, 479, 171)}
  <div class="ab totals ui-mono" style="left:0; top:466px; width:650px;"><span data-r="sent"></span><span data-r="queue"></span></div>

  <div class="ab menu ui-label" style="left:690px; top:150px; width:84px;">
    <span class="on">Contact</span><span>Audio</span><span>Video</span><span>History</span><span>Settings</span>
  </div>
  <div class="ab blk feed" style="left:780px; top:62px; width:230px; height:226px;">
    <canvas data-r="feed" width="${FEED_W}" height="${FEED_H}"></canvas>
  </div>
  <div class="ab rule rule--thick" style="left:690px; top:288px; width:90px;"></div>
  <div class="ab stamp" style="left:690px; top:300px;"><span data-r="feedtsa">--</span><br><span data-r="feedtsb">--</span></div>
  <div class="ab namebar" style="left:780px; top:288px; width:230px; height:58px;">
    <span class="ui-label" data-r="name"></span><span class="ui-mono" data-r="namesub"></span>
  </div>
  <div class="ab rule rule--dim" style="left:690px; top:343px; width:90px;"></div>
  <div class="ab hexes" style="left:690px; top:362px;">
    ${hexMarkup('hexA', '<path d="M10 17 L15 9 L20 17 Z" fill="currentColor"/>')}
    ${hexMarkup('hexB', '<rect x="10" y="12" width="10" height="10" stroke="currentColor" stroke-width="1.6"/><path d="M12 12 V9.5 A3 3 0 0 1 18 9.5 V12" stroke="currentColor" stroke-width="1.6"/>')}
  </div>
  ${antMarkup('ant1', 850, 362, 74, 'ANTENNA', 'ANT-1')}
  ${antMarkup('ant2', 936, 362, 74, 'ANTENNA', 'ANT-2')}
  <div class="ab totals ui-mono" style="left:690px; top:430px; width:320px;"><span>DISH AZ <span data-r="az"></span>°</span><span>EL <span data-r="el"></span>°</span><span data-r="lock"></span></div>
</div>`;

export function createCommsPanel() {
  const element = staticMarkup(MARKUP);
  const R = collectRefs(element);
  const wave = R.wave.getContext('2d');
  const feed = R.feed.getContext('2d');
  const chips = [0, 1, 2].map((i) => {
    const chip = R[`tx${i}`];
    return {
      chip,
      t1: chip.querySelector('.t1'),
      t2: chip.querySelector('.t2'),
      t3: chip.querySelector('.t3'),
      spin: chip.querySelector('.ic-spin'),
      spinSvg: chip.querySelector('.ic-spin svg'),
      fail: chip.querySelector('.ic-fail'),
      ok: chip.querySelector('.ic-ok'),
      tsA: R[`ts${i}a`],
      tsB: R[`ts${i}b`],
    };
  });

  let step = 0;
  let t = 0;
  let readT = 0;

  // ---- transmissions: [oldest, previous, current]; current is "live" while in flight ----
  let seq = 441;
  let sent = 0;
  let failed = 0;
  let slots = [null, null, null];
  let txT = 0;
  const clock = (s) => {
    const v = 15157 + s;
    return `${pad(Math.floor(v / 3600))}:${pad(Math.floor(v / 60) % 60)}:${pad(Math.floor(v % 60))}`;
  };
  function newTx() {
    slots = [
      slots[1],
      slots[2],
      {
        seq: seq++,
        band: BANDS[rint(0, 3)],
        start: t,
        dur: rnd(1.4, 2.2),
        result: null,
        retry: 0,
        loss: 0,
        at: clock(t),
      },
    ];
  }
  function resolveTx(x) {
    const failChance = [1, 0.5, 0][step];
    x.result = Math.random() < failChance ? 'fail' : 'ok';
    x.retry = x.result === 'fail' ? rint(1, 4) : 0;
    x.loss = step === 1 && x.result === 'ok' ? rint(18, 46) : 0;
    if (x.result === 'ok') sent++;
    else failed++;
  }
  function renderTx(c, x) {
    if (!x) {
      c.chip.className = 'ab tx empty';
      c.t1.textContent = '—';
      c.t2.textContent = '—';
      c.t3.textContent = 'NO DATA';
      c.spin.hidden = c.fail.hidden = c.ok.hidden = true;
      c.tsA.textContent = '--';
      c.tsB.textContent = '--';
      return;
    }
    const live = !x.result;
    const pct = live ? Math.min(99, Math.floor(((t - x.start) / x.dur) * 100)) : 100;
    c.chip.className = `ab tx${live ? ' live' : x.result === 'fail' ? ' fail' : ' ok'}`;
    c.t1.textContent = `TX ${pad(x.seq, 4)} · ${x.band.endsWith('IN') ? 'IN' : 'OUT'}`;
    c.t2.textContent = x.band;
    c.t3.textContent = live
      ? `TRANSMITTING ${pad(pct)}%`
      : x.result === 'fail'
        ? `FAILED · RETRY ${x.retry}`
        : x.loss
          ? `DELIVERED · LOSS ${x.loss}%`
          : 'DELIVERED';
    c.spin.hidden = !live;
    c.fail.hidden = live || x.result !== 'fail';
    c.ok.hidden = live || x.result !== 'ok';
    if (live) c.spinSvg.style.transform = `rotate(${(t * 360) % 360}deg)`;
    c.tsA.textContent = `${x.at}_TX`;
    c.tsB.textContent = `SEQ_${pad(x.seq, 4)}`;
  }

  // ---- message text: typed out, re-garbled ~3x a second (slowed per Shannon) ----
  let typed = 0;
  let msgT = 0;
  let rollT = 0;
  let mask = [];
  function renderMessage(dt) {
    typed = Math.min(MESSAGE.length, typed + dt * [12, 14, 30][step]);
    const corrupt = [0.72, 0.24, 0][step];
    rollT -= dt;
    if (rollT <= 0 || mask.length !== MESSAGE.length) {
      rollT = 0.34;
      mask = [...MESSAGE].map((c) =>
        c !== '\n' && c !== ' ' && Math.random() < corrupt
          ? GLYPHS[rint(0, GLYPHS.length - 1)]
          : null
      );
    }
    let out = '';
    for (let i = 0; i < Math.floor(typed); i++) out += mask[i] || MESSAGE[i];
    if (typed >= MESSAGE.length) {
      msgT += dt;
      if (step === 0 && msgT > 0.8) out = `${out.split('\n')[0]}\n— CARRIER LOST —\nRETRYING…`;
      if (msgT > [3.5, 4.5, 6][step]) {
        typed = 0;
        msgT = 0;
      }
    } else if (Math.floor(t * 2.5) % 2) out += '▌';
    R.msg.textContent = out;
  }

  // ---- waveform: jagged live signal over a ghost of the clean one ----
  const hashAt = (x, seed, mult) => {
    const k = Math.floor((x + t * 160) / 6);
    const h = Math.sin(k * seed) * mult;
    return h - Math.floor(h);
  };
  function drawWave() {
    const c = wave;
    c.clearRect(0, 0, WAVE_W, WAVE_H);
    c.strokeStyle = 'rgba(116, 224, 166, 0.12)';
    c.lineWidth = 1;
    for (let y = 13; y < WAVE_H; y += 26) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(WAVE_W, y);
      c.stroke();
    }
    c.strokeStyle = 'rgba(226, 245, 234, 0.16)';
    c.beginPath();
    for (let x = 0; x <= WAVE_W; x += 3) {
      const y = WAVE_H / 2 - 30 * Math.sin(x * 0.035 - t * 3) * Math.cos(x * 0.006);
      if (x) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.stroke();

    const noise = [26, 12, 2.5][step];
    const clean = [0.15, 0.7, 1][step];
    c.strokeStyle = ACC;
    c.lineWidth = 2;
    c.lineJoin = 'miter';
    c.beginPath();
    let pen = false;
    for (let x = 0; x <= WAVE_W; x += 6) {
      const r = hashAt(x, 12.9898, 43758.5453);
      const r2 = hashAt(x, 4.1414, 15731.743);
      const gap = step === 0 ? r2 < 0.22 : step === 1 ? r2 < 0.07 : false;
      let y =
        WAVE_H / 2 -
        clean * 30 * Math.sin(x * 0.035 - t * 3) * Math.cos(x * 0.006) +
        (r - 0.5) * 2 * noise;
      if (step === 0 && r2 > 0.94) y += (r2 > 0.97 ? -1 : 1) * rnd(20, 40);
      if (gap) {
        pen = false;
        continue;
      }
      if (pen) c.lineTo(x, y);
      else c.moveTo(x, y);
      pen = true;
    }
    c.stroke();
    if (step < 2) {
      c.fillStyle = RED; // dropout markers
      for (let x = 0; x <= WAVE_W; x += 6) {
        const r2 = hashAt(x, 4.1414, 15731.743);
        if ((step === 0 && r2 < 0.22) || (step === 1 && r2 < 0.07)) c.fillRect(x, WAVE_H - 6, 5, 3);
      }
    }
  }

  // ---- contact feed: ~12 fps "video" ----
  let feedT = 0;
  function emblem(alpha) {
    const c = feed;
    c.save();
    c.strokeStyle = HI;
    c.lineWidth = 2;
    const cx = FEED_W / 2;
    const cy = 98;
    [26, 44, 62].forEach((r, i) => {
      c.beginPath();
      c.arc(cx, cy, r, Math.PI * 1.15, Math.PI * 1.85);
      c.globalAlpha = alpha * (1 - i * 0.25);
      c.stroke();
    });
    c.globalAlpha = alpha;
    c.fillStyle = HI;
    c.beginPath();
    c.moveTo(cx, cy - 6);
    c.lineTo(cx - 14, cy + 40);
    c.lineTo(cx + 14, cy + 40);
    c.closePath();
    c.fill();
    c.font = "600 12px 'IBM Plex Mono', monospace";
    c.textAlign = 'center';
    c.fillText('KESTREL-7', cx, 170);
    c.font = "500 9px 'IBM Plex Mono', monospace";
    c.fillStyle = MUT;
    c.fillText('RELAY STATION · BAND 3', cx, 186);
    c.restore();
  }
  function snow(amount) {
    const cell = 5;
    for (let y = 0; y < FEED_H; y += cell) {
      for (let x = 0; x < FEED_W; x += cell) {
        const v = Math.random();
        if (v < amount) {
          feed.fillStyle = `rgba(160, 230, 190, ${(v / amount) * 0.32})`;
          feed.fillRect(x, y, cell, cell);
        }
      }
    }
  }
  function drawFeed(dt) {
    feedT -= dt;
    if (feedT > 0) return;
    feedT = 1 / 12;
    const c = feed;
    c.fillStyle = '#06100b';
    c.fillRect(0, 0, FEED_W, FEED_H);
    if (step === 0) snow(0.55);
    else if (step === 1) {
      const up = Math.sin(t * 1.7) + Math.sin(t * 4.3) * 0.5 > -0.2;
      if (up) {
        emblem(0.75);
        const ty = (t * 70) % FEED_H;
        c.fillStyle = 'rgba(6, 16, 11, 0.85)';
        c.fillRect(0, ty, FEED_W, 10);
        snow(0.12);
      } else snow(0.5);
    } else emblem(1);
    c.fillStyle = 'rgba(255, 255, 255, 0.035)';
    for (let y = 0; y < FEED_H; y += 3) c.fillRect(0, y, FEED_W, 1);
    c.font = "500 9px 'IBM Plex Mono', monospace";
    c.fillStyle = step === 0 ? RED : MUT;
    c.textAlign = 'left';
    c.fillText(['● NO SIGNAL', '● FEED UNSTABLE', '● LIVE'][step], 10, 16);
  }

  function readouts() {
    R.carrier.textContent = ['CARRIER — NONE', 'CARRIER — INTERMITTENT', 'CARRIER — LOCKED'][step];
    R.snr.textContent = `SNR ${[rint(-9, -2), rint(4, 9), rint(21, 24)][step]} dB`;
    R.az.textContent = (step === 2 ? 212.4 : 212.4 + rnd(-6, 6) * (step === 0 ? 1 : 0.3)).toFixed(
      1
    );
    R.el.textContent = (step === 2 ? 18.0 : 18 + rnd(-3, 3) * (step === 0 ? 1 : 0.3)).toFixed(1);
    R.sent.textContent = `SENT ${pad(sent, 3)} · FAILED ${pad(failed, 3)}`;
    R.queue.textContent = `QUEUE ${pad([rint(9, 14), rint(3, 6), 0][step])}`;
    R.feedtsa.textContent = `${clock(t)}_RX`;
    R.feedtsb.textContent = ['LINK DOWN', 'LINK 61%', 'LINK 100%'][step];
  }

  function setAntenna(ant, online, onText, offText) {
    ant.classList.toggle('down', !online);
    ant.querySelector('.s2').textContent = online ? onText : offText;
  }

  function setStep(next) {
    step = next;
    element.dataset.step = String(step);
    R.msgstate.textContent = ['<Failed>', '<Partial>', '<Received>'][step];
    R.msgstate.style.color = [RED, AMBER, HI][step];
    R.access.textContent = ['Accessed · link down', 'Accessed · degraded', 'Accessed'][step];
    R.access.style.color = step === 0 ? RED : ACC;
    R.name.textContent = ['No carrier', 'Kestrel-7', 'Kestrel-7 relay'][step];
    R.namesub.textContent = [
      'CONTACT UNREACHABLE',
      'SIGNAL WEAK · PACKET LOSS',
      'CHANNEL OPEN · ENCRYPTED',
    ][step];
    R.lock.textContent = ['NO LOCK', 'HUNTING', 'LOCKED'][step];
    R.hexA.style.color = step ? ACC : DIM;
    R.hexB.style.color = step === 2 ? ACC : DIM;
    setAntenna(R.ant1, step >= 1, 'ONLINE', 'OFFLINE');
    setAntenna(R.ant2, step === 2, 'ONLINE', 'OFFLINE');
    setAntenna(R.antrow, step >= 1, 'TX', 'NO TX');
    typed = 0;
    msgT = 0;
    feedT = 0;
    mask = [];
    readouts();
  }

  function update(dt) {
    t += dt;
    const cur = slots[2];
    if (cur && !cur.result && t - cur.start >= cur.dur) {
      resolveTx(cur);
      txT = t + rnd(0.5, 1.1);
    }
    if ((!cur || cur.result) && t >= txT) newTx();
    chips.forEach((c, i) => renderTx(c, slots[i]));
    drawWave();
    drawFeed(dt);
    renderMessage(dt);
    if (t > readT) {
      readT = t + 0.4;
      readouts();
    }
  }

  function reset() {
    // a little history so the transmission row isn't empty when it opens
    slots = [null, null, null];
    for (let i = 0; i < 2; i++) {
      newTx();
      resolveTx(slots[2]);
    }
    typed = 0;
    msgT = 0;
  }

  reset();
  setStep(0);
  update(0.016);
  return { element, setStep, update, reset };
}
