// src/ui/screens/loading.js
//
// Loading screen: sector name, a 30-pip progress bar driven by real asset progress
// (asset-progress.js), and one tip. It follows the DESTINATION level's accent and backdrop,
// so the manager sets the level theme before this is shown.

import './loading.css';
import { el, cornerBrackets, createPips } from '../dom.js';
import { getLevel } from '../../config/levels.js';

const PIP_COUNT = 30;
// Long enough to read the sector name even when everything is already cached.
const MIN_VISIBLE_MS = 700;

export function createLoadingScreen(api) {
  const pips = createPips(PIP_COUNT);
  pips.element.classList.add('loading__bar');

  const sector = el('div', { className: 'loading__sector' });
  const percent = el('div', { className: 'loading__pct' });
  const tip = el('div', { className: 'loading__tip' });

  const element = el(
    'section',
    {
      className: 'ui-screen ui-screen--loading',
      attrs: { hidden: true, 'aria-label': 'Loading' },
    },
    el(
      'div',
      { className: 'ui-stage' },
      el(
        'div',
        { className: 'loading__block' },
        el('div', { className: 'loading__kicker', text: 'ENTERING SECTOR' }),
        sector,
        pips.element,
        percent,
        tip
      )
    ),
    cornerBrackets()
  );

  let frame = 0;
  let startedAt = 0;

  function render(progress) {
    const value = Math.round(progress * 100);
    pips.setFilled(Math.round(progress * PIP_COUNT));
    percent.textContent = `${value}%`;
  }

  function tick(now) {
    const progress = api.getLoadProgress();
    render(progress);
    if (api.isLoaded() && now - startedAt >= MIN_VISIBLE_MS) {
      render(1);
      api.finishLoading();
      return;
    }
    frame = window.requestAnimationFrame(tick);
  }

  return {
    id: 'loading',
    element,
    onShow() {
      sector.textContent = getLevel(api.getLevelId()).name;
      tip.textContent = `Tip: ${api.pickTip()}`;
      render(api.getLoadProgress());
      startedAt = window.performance.now();
      frame = window.requestAnimationFrame(tick);
    },
    onHide() {
      window.cancelAnimationFrame(frame);
    },
  };
}
