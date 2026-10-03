// src/ui/hud.js
//
// Always-on HUD overlay for L1/L2/L3, built from the final HUD mockup (Version 22).
//
//   top-left      Fuel Cells (every level), then Oxygen + Health meters (L2, L3)
//   top-centre    warning banner ("Life Support Fault Detected", "Gravity Field Destabilizing")
//                 with the gravity grace-window bar under it, plus a full-screen alarm flash
//   top-right     sector readout ("ENGINEERING CORE // SEC. 2", "POWER 61%")
//                 L3 only: Active Threats column (Hull Breach countdown, O2 Scrubbers Offline)
//   bottom-left   AI link chip (PASSIVE -> TRACKING -> HOSTILE, follows the level)
//   bottom-centre AI-voice caption bar (hidden when Options > AI Voice Captions is off)
//   anywhere      the object-anchored interaction prompt
//
// Panels are edge-anchored (see .ui-anchor in ui.css): they hug the real screen edges at any
// window size or aspect ratio, and scale with the window like the menus do.
//
// Every setter is safe to call every frame: each one only touches the DOM when what it shows
// actually changes. Flashing/pulsing is CSS-only and switched off by Options > Reduce Flashing
// (body[data-reduce-flashing], see hud.css).
//
// The interaction prompt is fed by the level, not by the UI state machine (copy for every kind
// of object lives in prompt-copy.js):
//
//   import { setInteractPrompt } from '../ui/hud.js';
//   setInteractPrompt('Open Door', { detail: '2 Fuel Cells', target: door });     // locked on
//   setInteractPrompt('Open Door', { detail: '2 Fuel Cells', denied: true, target: door });
//   setInteractPrompt('Collect Fuel Cell', { hint: true, target: cell });  // no [E] badge
//   setInteractPrompt('Grab Handhold', { tone: 'hazard', target: handhold });
//   setInteractPrompt(null);                                                       // hide
//
// With a `target` (any THREE.Object3D) the prompt is drawn by syncInteractPrompt(camera), which
// main.js calls once a frame after the camera moves: the brackets frame the object and the label
// hangs under them. Without one it docks bottom-centre. `anchor: { x, y }` (window px) still
// works for callers that project for themselves.
//
// It lives inside the HUD element, so it hides with the menus, dims under the pause scrim and
// follows the HUD Opacity slider along with the rest of the HUD.

import './hud.css';
import { el, svg, cornerBrackets, createPips } from './dom.js';
import { resolvePrompt, HIDDEN_PROMPT } from './interact-prompt.js';
import { anchorOnScreen } from './prompt-anchor.js';
import {
  METER_PIPS,
  OXYGEN_THRESHOLDS,
  HEALTH_THRESHOLDS,
  meterView,
  splitCountdown,
  powerText,
} from './hud-readouts.js';
import { getLevel, FIRST_LEVEL_ID } from '../config/levels.js';

// Per-level HUD content. `power` is the readout shown until something calls setPower() (there
// is no live power value yet — see power-allocation.js). `vitals`: show Oxygen + Health.
const HUD_LEVELS = {
  l1: { sector: 1, power: 100, aiLink: 'PASSIVE', vitals: false, threats: false },
  l2: { sector: 2, power: 61, aiLink: 'TRACKING', vitals: true, threats: false },
  l3: { sector: 3, power: 19, aiLink: 'HOSTILE', vitals: true, threats: true },
};

// ---- icons (paths straight from the mockup) ----
function icon(className, size, strokeWidth, ...children) {
  return svg(
    'svg',
    {
      class: className,
      width: size,
      height: size,
      viewBox: '0 0 20 20',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': strokeWidth,
      'aria-hidden': 'true',
    },
    ...children
  );
}

const fuelIcon = () =>
  icon(
    'hud-fuel__icon',
    22,
    1.6,
    svg('rect', { x: 7, y: 1.5, width: 6, height: 3 }),
    svg('rect', { x: 5, y: 4.5, width: 10, height: 13.5, rx: 1 }),
    svg('line', { x1: 5, y1: 9.5, x2: 15, y2: 9.5, 'stroke-opacity': 0.5 })
  );

const oxygenIcon = () =>
  icon(
    'hud-meter__icon',
    16,
    1.6,
    svg('path', { d: 'M3 8c2 0 2-3 4-3s2 3 4 3 2-3 4-3 2 3 4 3', 'stroke-opacity': 0.9 }),
    svg('path', { d: 'M3 13c2 0 2-3 4-3s2 3 4 3 2-3 4-3 2 3 4 3', 'stroke-opacity': 0.55 })
  );

const healthIcon = () =>
  icon(
    'hud-meter__icon',
    16,
    1.6,
    svg('polygon', { points: '10,1.5 18,6 18,14 10,18.5 2,14 2,6', 'stroke-opacity': 0.9 }),
    svg('line', { x1: 10, y1: 6.5, x2: 10, y2: 13.5, 'stroke-opacity': 0.7 }),
    svg('line', { x1: 6.5, y1: 10, x2: 13.5, y2: 10, 'stroke-opacity': 0.7 })
  );

const faultIcon = () =>
  icon(
    'hud-banner__icon is-fault',
    16,
    1.8,
    svg('polygon', { points: '10,2 19,17 1,17', 'stroke-linejoin': 'round' }),
    svg('line', { x1: 10, y1: 8, x2: 10, y2: 12.5 }),
    svg('circle', { cx: 10, cy: 14.7, r: 0.9, fill: 'currentColor', stroke: 'none' })
  );

const gravityIcon = () =>
  icon(
    'hud-banner__icon is-gravity',
    16,
    1.8,
    svg('path', { d: 'M10 2 V12', 'stroke-linecap': 'round' }),
    svg('path', {
      d: 'M5.5 8 L10 12.5 L14.5 8',
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
    }),
    svg('line', { x1: 4, y1: 17, x2: 16, y2: 17, 'stroke-linecap': 'round' })
  );

const breachIcon = () =>
  icon(
    'hud-breach__icon',
    15,
    1.8,
    svg('path', { d: 'M3 10 H17', 'stroke-linecap': 'round' }),
    svg('path', { d: 'M11 4 L17 10 L11 16', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })
  );

// oxygen wave with the "off" slash, like the Restart Screen's wifi-off glyph
const scrubbersOffIcon = () =>
  icon(
    'hud-scrubbers__icon',
    15,
    1.6,
    svg('path', { d: 'M3 8c2 0 2-3 4-3s2 3 4 3 2-3 4-3 2 3 4 3', 'stroke-opacity': 0.7 }),
    svg('line', { x1: 2, y1: 2, x2: 18, y2: 18, 'stroke-opacity': 0.9 })
  );

// ---- small helpers ----

/** Set textContent only when it changes. */
function textSetter(node) {
  let shown = null;
  return (text) => {
    if (text === shown) return;
    shown = text;
    node.textContent = text;
  };
}

/** Restart a one-shot CSS animation by re-adding its class. */
function replayClass(node, className) {
  node.classList.remove(className);
  void node.offsetWidth; // force a reflow so the browser sees the class as new
  node.classList.add(className);
}

// ---- panels ----

function createFuelPanel() {
  const count = el('div', { className: 'hud-fuel__count' });
  const element = el(
    'div',
    { className: 'hud-fuel hud-panel ui-chamfer-panel' },
    fuelIcon(),
    el(
      'div',
      { className: 'hud-fuel__body' },
      el('div', { className: 'hud-fuel__label ui-label', text: 'Fuel Cells' }),
      count
    )
  );
  const setText = textSetter(count);
  return {
    element,
    set(value) {
      const n = Math.max(0, Math.floor(Number(value) || 0));
      setText(String(n).padStart(2, '0'));
    },
  };
}

/** Oxygen / Health: icon + label + percent, over a row of 10 pips. */
function createMeter(kind, label, iconNode, thresholds) {
  const pct = el('span', { className: 'hud-meter__pct ui-mono' });
  const pips = createPips(METER_PIPS, 'hud-meter__pips');
  const element = el(
    'div',
    { className: `hud-meter hud-meter--${kind} hud-panel ui-chamfer-panel` },
    el(
      'div',
      { className: 'hud-meter__head' },
      el(
        'div',
        { className: 'hud-meter__title' },
        iconNode,
        el('span', { className: 'hud-meter__label ui-label', text: label })
      ),
      pct
    ),
    pips.element
  );

  let shownKey = '';
  return {
    element,
    set(fraction) {
      const view = meterView(fraction, thresholds);
      const key = `${view.pct}|${view.pips}|${view.tone}`;
      if (key === shownKey) return;
      shownKey = key;
      pct.textContent = `${view.pct}%`;
      pips.setFilled(view.pips);
      element.dataset.tone = view.tone;
    },
  };
}

function createSectorReadout() {
  const name = el('div', { className: 'hud-sector__name' });
  const power = el('div', { className: 'hud-sector__power' });
  const element = el(
    'div',
    { className: 'hud-sector ui-anchor ui-anchor--tr ui-mono' },
    name,
    power
  );
  return { element, setName: textSetter(name), setPower: textSetter(power) };
}

function createAiChip() {
  const text = el('span', { className: 'hud-ai__text ui-mono' });
  const element = el(
    'div',
    { className: 'hud-ai ui-anchor ui-anchor--bl' },
    el('div', { className: 'hud-ai__dot' }),
    text
  );
  const setText = textSetter(text);
  return { element, setStatus: (status) => setText(`AI LINK: ${status}`) };
}

function createCaptionBar() {
  const speaker = el('span', { className: 'hud-caption__speaker ui-mono' });
  const line = el('span', { className: 'hud-caption__line' });
  const element = el(
    'div',
    { className: 'hud-caption ui-anchor ui-anchor--b-mid', attrs: { hidden: true } },
    speaker,
    line
  );
  const setSpeaker = textSetter(speaker);
  const setLine = textSetter(line);
  return {
    element,
    set(text, { speaker: who = 'AI' } = {}) {
      const clean = typeof text === 'string' ? text.trim() : '';
      element.hidden = clean === '';
      if (clean === '') return;
      setSpeaker(who);
      setLine(clean);
    },
  };
}

/**
 * The one shared warning-banner slot (L2 and L3 use the same slot) plus the grace-window bar
 * that sits 6px under it. The banner follows the level: amber on L2, critical red on L3.
 */
function createBanner() {
  const label = el('span', { className: 'hud-banner__label ui-label' });
  const fill = el('div', { className: 'hud-grace__fill' });
  const grace = el('div', { className: 'hud-grace', attrs: { hidden: true } }, fill);
  const element = el(
    'div',
    { className: 'hud-banner-slot ui-anchor ui-anchor--t-mid', attrs: { hidden: true } },
    el(
      'div',
      { className: 'hud-banner' },
      el('div', { className: 'hud-banner__icons' }, faultIcon(), gravityIcon()),
      label
    ),
    grace
  );
  const setLabel = textSetter(label);

  let shownGrace = null;
  return {
    element,
    /**
     * @param {string|null} text  banner copy, or null to hide the banner (and its grace bar)
     * @param {{icon?:'fault'|'gravity', pulse?:boolean}} [options]
     *   pulse: the label flashes (1.1s) — used while a hazard is live. Reduce Flashing holds it.
     */
    set(text, { icon: kind = 'fault', pulse = false } = {}) {
      const clean = typeof text === 'string' ? text.trim() : '';
      element.hidden = clean === '';
      if (clean === '') return;
      setLabel(clean);
      element.dataset.icon = kind;
      label.classList.toggle('hud-pulse', pulse);
    },
    /** 0-1 of the grace window left (bar drains as it falls), or null to hide the bar. */
    setGrace(fraction) {
      if (fraction === null || fraction === undefined) {
        grace.hidden = true;
        shownGrace = null;
        return;
      }
      grace.hidden = false;
      const pct = Math.round(Math.min(1, Math.max(0, Number(fraction) || 0)) * 1000) / 10;
      if (pct === shownGrace) return;
      shownGrace = pct;
      fill.style.width = `${pct}%`;
    },
  };
}

/** L3: Hull Breach countdown + the static "O2 Scrubbers Offline" consequence marker. */
function createThreats() {
  const min = el('span', { className: 'hud-breach__digits' });
  const sec = el('span', { className: 'hud-breach__digits' });
  const bracket = (ch) => el('span', { className: 'hud-breach__bracket', text: ch });
  const breach = el(
    'div',
    { className: 'hud-breach hud-panel ui-chamfer-panel', attrs: { hidden: true } },
    el(
      'div',
      { className: 'hud-breach__head' },
      breachIcon(),
      el('span', { className: 'hud-breach__label ui-label', text: 'Hull Breach' })
    ),
    el(
      'div',
      { className: 'hud-breach__time ui-mono' },
      bracket('['),
      min,
      bracket(']'),
      el('span', { className: 'hud-breach__colon', text: ':' }),
      bracket('['),
      sec,
      bracket(']')
    )
  );
  const scrubbers = el(
    'div',
    { className: 'hud-scrubbers hud-panel ui-chamfer-panel', attrs: { hidden: true } },
    scrubbersOffIcon(),
    el('span', { className: 'hud-scrubbers__text ui-mono', text: 'O2 SCRUBBERS OFFLINE' })
  );
  const element = el(
    'div',
    { className: 'hud-threats ui-anchor ui-anchor--tr', attrs: { hidden: true } },
    breach,
    scrubbers
  );
  const setMin = textSetter(min);
  const setSec = textSetter(sec);
  return {
    element,
    setBreach(seconds) {
      breach.hidden = seconds === null || seconds === undefined;
      if (breach.hidden) return;
      const parts = splitCountdown(seconds);
      setMin(parts.min);
      setSec(parts.sec);
    },
    setScrubbersOffline(offline) {
      scrubbers.hidden = !offline;
    },
  };
}

// Four corner brackets that frame the object the prompt belongs to (from the mockup).
function reticle() {
  const bracket = (d) =>
    svg('path', { d, 'stroke-width': 1.6, fill: 'none', stroke: 'currentColor' });
  return el(
    'div',
    { className: 'hud-prompt__reticle', attrs: { 'aria-hidden': 'true' } },
    svg(
      'svg',
      { width: 40, height: 40, viewBox: '0 0 40 40' },
      bracket('M2 12 V2 H12'),
      bracket('M28 2 H38 V12'),
      bracket('M2 28 V38 H12'),
      bracket('M38 28 V38 H28')
    ),
    el('div', { className: 'hud-prompt__stem' })
  );
}

function createInteractPrompt() {
  const keyEl = el('span', { className: 'hud-prompt__key ui-mono', text: 'E' });
  const labelEl = el('span', { className: 'hud-prompt__label ui-label' });
  const detailEl = el('span', { className: 'hud-prompt__detail ui-mono', attrs: { hidden: true } });
  const box = el(
    'div',
    { className: 'hud-prompt__box ui-panel ui-chamfer-row' },
    keyEl,
    labelEl,
    detailEl
  );
  const element = el(
    'div',
    { className: 'hud-prompt ui-anchor ui-anchor--b-mid', attrs: { hidden: true } },
    reticle(),
    box
  );

  let shownKey = HIDDEN_PROMPT.key;

  function show(view) {
    if (view.key === shownKey) return; // called every frame — only touch the DOM on change
    shownKey = view.key;

    element.hidden = !view.visible;
    if (!view.visible) return;

    labelEl.textContent = view.label;
    detailEl.textContent = view.detail;
    detailEl.hidden = view.detail === '';
    element.classList.toggle('is-denied', view.denied);
    element.classList.toggle('is-hint', view.hint);
    element.classList.toggle('is-hazard', view.tone === 'hazard');
    keyEl.hidden = view.hint;

    // Anchored: brackets + stem, positioned on the object. Otherwise docked bottom-centre.
    const anchored = view.anchor !== null;
    element.classList.toggle('is-anchored', anchored);
    element.classList.toggle('ui-anchor--b-mid', !anchored);
    if (anchored) {
      element.style.setProperty('--px', `${view.anchor.x}px`);
      element.style.setProperty('--py', `${view.anchor.y}px`);
    } else {
      element.style.removeProperty('--px');
      element.style.removeProperty('--py');
    }
  }

  return { element, show };
}

// The prompt of the HUD created most recently. The level imports setInteractPrompt() directly
// (it has no handle on the UI), so this is the one piece of module-level state in the HUD.
let activePrompt = null;
// A prompt waiting for syncInteractPrompt() to place it on its target object.
let pending = null;

/**
 * Show, update or hide the interaction prompt. See the header of this file for the options.
 * Safe to call every frame.
 * @param {string|null} label  action label ("Open Door"), or null to hide the prompt
 * @param {import('./interact-prompt.js').PromptOptions & {target?: object}} [options]
 */
export function setInteractPrompt(label, options) {
  if (label && options?.target) {
    pending = { label, options };
    return;
  }
  pending = null;
  activePrompt?.show(resolvePrompt(label, options));
}

/**
 * Place a targeted prompt on its object through the camera. main.js calls this once a frame,
 * after the camera update. Hides the prompt when the object is behind the camera.
 * @param {import('three').Camera} camera
 */
export function syncInteractPrompt(camera) {
  if (!pending || !activePrompt) return;
  const { label, options } = pending;
  let anchor = null;
  if (camera) {
    camera.updateMatrixWorld(); // the camera just moved; the renderer hasn't refreshed it yet
    anchor = anchorOnScreen(options.target, camera, window.innerWidth, window.innerHeight);
    if (!anchor) {
      activePrompt.show(HIDDEN_PROMPT); // behind the camera
      return;
    }
  }
  activePrompt.show(resolvePrompt(label, { ...options, anchor }));
}

export function createHud() {
  const fuel = createFuelPanel();
  const oxygen = createMeter('oxygen', 'Oxygen', oxygenIcon(), OXYGEN_THRESHOLDS);
  const health = createMeter('health', 'Health', healthIcon(), HEALTH_THRESHOLDS);
  const vitals = el('div', { className: 'hud-vitals' }, oxygen.element, health.element);
  const status = el(
    'div',
    { className: 'hud-status ui-anchor ui-anchor--tl' },
    fuel.element,
    vitals
  );

  const sector = createSectorReadout();
  const ai = createAiChip();
  const caption = createCaptionBar();
  const banner = createBanner();
  const threats = createThreats();

  // Full-screen layer for the gravity alarm's light drop. (Room tint and any L3 red wash belong
  // to the lighting/shader pass, not the HUD.)
  const alarm = el('div', { className: 'hud-alarm' });

  const prompt = createInteractPrompt();
  activePrompt = prompt;

  const element = el(
    'div',
    { className: 'ui-hud', attrs: { hidden: true, 'aria-label': 'Heads-up display' } },
    cornerBrackets(),
    status,
    sector.element,
    threats.element,
    banner.element,
    ai.element,
    prompt.element,
    caption.element,
    alarm
  );

  let levelId = null;
  let powerOverride = null;

  function setLevel(id) {
    const level = getLevel(id);
    const hudLevel = HUD_LEVELS[level.id] ?? HUD_LEVELS[FIRST_LEVEL_ID];
    if (level.id === levelId) return;
    levelId = level.id;

    vitals.hidden = !hudLevel.vitals;
    threats.element.hidden = !hudLevel.threats;
    threats.setBreach(null);
    threats.setScrubbersOffline(false);
    banner.set(null);
    banner.setGrace(null);
    ai.setStatus(hudLevel.aiLink);
    sector.setName(`${level.name.toUpperCase()} // SEC. ${hudLevel.sector}`);
    powerOverride = null;
    sector.setPower(powerText(hudLevel.power));
  }

  setLevel(FIRST_LEVEL_ID);
  fuel.set(0);
  oxygen.set(1);
  health.set(1);

  return {
    element,
    setLevel,
    setFuelCount: fuel.set,
    // main.js reads level.group.userData.oxygenSystem each frame and calls these.
    setOxygen: oxygen.set,
    setHealth: health.set,
    /** Power readout under the sector name (0-100), or null for the level's default. */
    setPower(percent) {
      powerOverride = percent ?? null;
      const fallback = (HUD_LEVELS[levelId] ?? HUD_LEVELS[FIRST_LEVEL_ID]).power;
      sector.setPower(powerText(powerOverride ?? fallback));
    },
    setCaption: caption.set,
    setWarning: banner.set,
    setGraceWindow: banner.setGrace,
    /** Two short light drops (or one slow dim with Reduce Flashing). Plays once per call. */
    triggerAlarm() {
      replayClass(alarm, 'is-playing');
    },
    setHullBreach: threats.setBreach,
    setScrubbersOffline: threats.setScrubbersOffline,
    setInteractPrompt,
    syncInteractPrompt,
    setVisible(visible) {
      element.hidden = !visible;
    },
    /** Pause dims the HUD (35% opacity, desaturated) under the scrim. */
    setDimmed(dimmed) {
      element.classList.toggle('is-dimmed', dimmed);
    },
  };
}
