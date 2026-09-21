// src/ui/screens/options.js
//
// Options: four pip sliders (SFX, Music, Brightness, HUD Opacity) plus the AI Voice Captions
// toggle. Always on the L1 blue, even when opened from the pause overlay.
//
// Each slider can be dragged (the pip track is the drag surface), stepped with the < > buttons,
// or driven from the keyboard. The hover/focus state — brightened border, a handle tick at the
// fill edge, and a caption under the row — is a real CSS state on whichever slider the player
// is on, not a special slider.

import './options.css';
import { el, cornerBrackets, createPips } from '../dom.js';
import { SLIDERS, SLIDER_MAX, SLIDER_STEP, sliderMin } from '../settings.js';

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

export function createOptionsScreen(api) {
  const { settings } = api;
  const sliders = SLIDERS.map((def) => buildSlider(def, settings));

  const captionsLabel = el('span', {
    className: 'options__toggle-label ui-label',
    text: 'AI Voice Captions',
    attrs: { id: 'options-captions-label' },
  });
  const captionsToggle = el(
    'button',
    {
      className: 'options-toggle',
      attrs: { type: 'button', role: 'switch', 'aria-labelledby': 'options-captions-label' },
      on: { click: () => settings.set('captions', !settings.get().captions) },
    },
    el('span', { className: 'options-toggle__knob' })
  );

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
        el('div', { className: 'options__toggle-row' }, captionsLabel, captionsToggle),
        el('div', { className: 'options__footer' }, backButton)
      )
    ),
    cornerBrackets()
  );

  function renderAll(values) {
    for (const slider of sliders) slider.render(values[slider.key]);
    captionsToggle.setAttribute('aria-checked', String(values.captions));
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
