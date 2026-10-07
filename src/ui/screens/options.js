// src/ui/screens/options.js
//
// Options: four pip sliders (SFX, Music, Brightness, HUD Opacity), the Graphics Quality stepper
// (Low / Medium / High), then the AI Voice Captions and Reduce Flashing switches. Always on the
// L1 blue, even when opened from the pause overlay.
//
// Each slider can be dragged (the pip track is the drag surface), stepped with the < > buttons,
// or driven from the keyboard. The hover/focus state — brightened border, a handle tick at the
// fill edge, and a caption under the row — is a real CSS state on whichever slider the player
// is on, not a special slider.

import './options.css';
import { el, cornerBrackets, createPips } from '../dom.js';
import { SLIDERS, SLIDER_MAX, SLIDER_STEP, sliderMin, CHOICES } from '../settings.js';

const PIP_COUNT = 20;

function buildSlider(def, settings) {
  const min = sliderMin(def.key);
  const pips = createPips(PIP_COUNT);
  const handle = el('div', {
    className: 'options-slider__handle',
    attrs: { 'aria-hidden': 'true' },
  });

  // A slider with a floor (HUD Opacity) shows it: the pips below the floor are drawn locked and
  // always lit, with a marker line where the movable part of the track begins.
  const floorMarker = min > 0 ? el('div', { className: 'options-slider__floor' }) : null;
  if (floorMarker) {
    floorMarker.setAttribute('aria-hidden', 'true');
    floorMarker.style.left = `calc(${min}% - 1px)`; // centred on the gap after the last locked pip
    Array.from(pips.element.children)
      .slice(0, Math.round(min / SLIDER_STEP))
      .forEach((pip) => pip.classList.add('is-locked'));
  }

  const track = el(
    'div',
    {
      className: 'options-slider__track',
      attrs: {
        role: 'slider',
        tabindex: 0,
        'aria-label': def.label,
        'aria-valuemin': min,
        'aria-valuemax': SLIDER_MAX,
      },
    },
    pips.element,
    floorMarker,
    handle
  );

  const readout = el('span', { className: 'options-slider__pct' });
  const stepButton = (symbol, direction, verb) =>
    el('button', {
      className: 'options-slider__step',
      text: symbol,
      attrs: { type: 'button', 'aria-label': `${verb} ${def.label}` },
      on: { click: () => settings.step(def.key, direction) },
    });
  const lessButton = stepButton('<', -1, 'Decrease');
  const moreButton = stepButton('>', 1, 'Increase');

  const row = el(
    'div',
    { className: 'options-slider' },
    el('div', { className: 'options-slider__label ui-label', text: def.label }),
    el('div', { className: 'options-slider__controls' }, track, readout, lessButton, moreButton),
    el('div', { className: 'options-slider__caption', text: def.hint })
  );

  function render(value) {
    pips.setFilled(Math.round(value / SLIDER_STEP));
    readout.textContent = `${value}%`;
    handle.style.left = `${value}%`;
    track.setAttribute('aria-valuenow', String(value));
    track.setAttribute('aria-valuetext', `${value}%`);
    // Dim the arrow that can't move any further (aria-disabled, not disabled, so keyboard focus
    // on it isn't dropped when the slider reaches an end).
    for (const [button, atLimit] of [
      [lessButton, value <= min],
      [moreButton, value >= SLIDER_MAX],
    ]) {
      button.classList.toggle('is-limit', atLimit);
      button.setAttribute('aria-disabled', String(atLimit));
    }
  }

  // --- mouse / touch drag on the track ---
  let dragging = false;

  function setFromPointer(event) {
    const rect = track.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    settings.set(def.key, ratio * SLIDER_MAX);
  }

  function endDrag(event) {
    if (!dragging) return;
    dragging = false;
    row.classList.remove('is-dragging');
    if (track.hasPointerCapture?.(event.pointerId)) track.releasePointerCapture(event.pointerId);
  }

  track.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    dragging = true;
    row.classList.add('is-dragging');
    track.setPointerCapture(event.pointerId);
    track.focus({ preventScroll: true });
    setFromPointer(event);
  });
  track.addEventListener('pointermove', (event) => {
    if (dragging) setFromPointer(event);
  });
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  // --- keyboard ---
  track.addEventListener('keydown', (event) => {
    let handled = true;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') settings.step(def.key, -1);
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') settings.step(def.key, 1);
    else if (event.key === 'Home') settings.set(def.key, min);
    else if (event.key === 'End') settings.set(def.key, SLIDER_MAX);
    else handled = false;
    if (handled) event.preventDefault();
  });

  return { row, track, render, key: def.key };
}

// Pick-one settings (Graphics Quality): a stepper that reuses the slider row — the value's name
// in a box with one mark per value, between the sliders' own < > buttons. Left/Right (or the
// buttons) step through the values; the caption under the row describes the current value.
function buildChoice(def, settings) {
  const name = el('span', { className: 'options-choice__name ui-label' });
  const marks = def.values.map(() => el('i'));
  const box = el(
    'div',
    {
      className: 'options-choice__value',
      attrs: { role: 'spinbutton', tabindex: 0, 'aria-label': def.label },
    },
    name,
    el('span', { className: 'options-choice__marks', attrs: { 'aria-hidden': 'true' } }, marks)
  );
  const stepButton = (symbol, direction, verb) =>
    el('button', {
      className: 'options-slider__step',
      text: symbol,
      attrs: { type: 'button', 'aria-label': `${verb} ${def.label}` },
      on: { click: () => settings.step(def.key, direction) },
    });
  const lessButton = stepButton('<', -1, 'Lower');
  const moreButton = stepButton('>', 1, 'Raise');
  const caption = el('div', { className: 'options-slider__caption' });

  const row = el(
    'div',
    { className: 'options-slider options-choice' },
    el('div', { className: 'options-slider__label ui-label', text: def.label }),
    el('div', { className: 'options-slider__controls' }, box, lessButton, moreButton),
    caption
  );

  box.addEventListener('keydown', (event) => {
    let handled = true;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') settings.step(def.key, -1);
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') settings.step(def.key, 1);
    else if (event.key === 'Home') settings.set(def.key, def.values[0]);
    else if (event.key === 'End') settings.set(def.key, def.values[def.values.length - 1]);
    else handled = false;
    if (handled) event.preventDefault();
  });

  function render(value) {
    const index = Math.max(0, def.values.indexOf(value));
    name.textContent = def.names[value] ?? value;
    caption.textContent = def.hints[value] ?? '';
    marks.forEach((mark, i) => mark.classList.toggle('is-on', i <= index));
    box.setAttribute('aria-valuemin', '1');
    box.setAttribute('aria-valuemax', String(def.values.length));
    box.setAttribute('aria-valuenow', String(index + 1));
    box.setAttribute('aria-valuetext', def.names[value] ?? value);
    for (const [button, atLimit] of [
      [lessButton, index === 0],
      [moreButton, index === def.values.length - 1],
    ]) {
      button.classList.toggle('is-limit', atLimit);
      button.setAttribute('aria-disabled', String(atLimit));
    }
  }

  return { row, render, key: def.key };
}

// On/off switches under the sliders. `caption` is a one-line note always shown under the row.
const TOGGLES = [
  { key: 'captions', label: 'AI Voice Captions' },
  {
    key: 'reduceFlashing',
    label: 'Reduce Flashing',
    caption: 'Warnings dim steadily instead of flashing.',
  },
];

function buildToggle(def, settings) {
  const labelId = `options-${def.key}-label`;
  const toggle = el(
    'button',
    {
      className: 'options-toggle',
      attrs: { type: 'button', role: 'switch', 'aria-labelledby': labelId },
      on: { click: () => settings.set(def.key, !settings.get()[def.key]) },
    },
    el('span', { className: 'options-toggle__knob' })
  );
  const row = el(
    'div',
    { className: 'options__toggle' },
    el(
      'div',
      { className: 'options__toggle-row' },
      el('span', {
        className: 'options__toggle-label ui-label',
        text: def.label,
        attrs: { id: labelId },
      }),
      toggle
    ),
    def.caption
      ? el('div', { className: 'options__toggle-caption ui-mono', text: def.caption })
      : null
  );
  return {
    row,
    render(value) {
      toggle.setAttribute('aria-checked', String(value));
    },
  };
}

export function createOptionsScreen(api) {
  const { settings } = api;
  const sliders = SLIDERS.map((def) => buildSlider(def, settings));
  const choices = CHOICES.map((def) => buildChoice(def, settings));
  const toggles = TOGGLES.map((def) => ({ key: def.key, ...buildToggle(def, settings) }));

  const backButton = el('button', {
    className: 'ui-button ui-chamfer-row',
    text: 'Back',
    attrs: { type: 'button' },
    on: { click: () => api.back() },
  });

  const element = el(
    'section',
    {
      className: 'ui-screen ui-screen--pinned-clean ui-screen--options',
      attrs: { hidden: true, 'aria-label': 'Options' },
    },
    el(
      'div',
      { className: 'ui-stage' },
      el(
        'div',
        { className: 'options__panel ui-panel ui-chamfer-panel' },
        el('h2', { className: 'options__title', text: 'Options' }),
        sliders.map((slider) => slider.row),
        choices.map((choice) => choice.row),
        el(
          'div',
          { className: 'options__toggles' },
          toggles.map((toggle) => toggle.row)
        ),
        el('div', { className: 'options__footer' }, backButton)
      )
    ),
    cornerBrackets()
  );

  function renderAll(values) {
    for (const slider of sliders) slider.render(values[slider.key]);
    for (const choice of choices) choice.render(values[choice.key]);
    for (const toggle of toggles) toggle.render(values[toggle.key]);
  }

  settings.subscribe(renderAll);
  renderAll(settings.get());

  return {
    id: 'options',
    element,
    onShow() {
      renderAll(settings.get());
      // Start on the first slider so the arrow keys work straight away.
      sliders[0].track.focus({ preventScroll: true });
    },
    onHide() {},
  };
}
