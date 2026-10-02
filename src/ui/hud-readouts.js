// src/ui/hud-readouts.js
//
// Pure logic behind the HUD's readouts (no DOM, so it is unit-tested in
// tests/hud-readouts.test.js). hud.js turns the results into markup.

export const METER_PIPS = 10;

/**
 * Thresholds for the two vitals meters (fractions 0-1). Oxygen has a low "warn" step (amber,
 * the L3 mockup's 22%) before it goes critical; Health goes straight to critical (red, flashing
 * border — the L3 mockup's 14%).
 */
export const OXYGEN_THRESHOLDS = Object.freeze({ warnBelow: 0.35, criticalBelow: 0.1 });
export const HEALTH_THRESHOLDS = Object.freeze({ warnBelow: 0, criticalBelow: 0.25 });

/**
 * @param {number} fraction 0-1 (clamped; non-numbers read as 0)
 * @param {{warnBelow:number, criticalBelow:number}} thresholds
 * @returns {{pct:number, pips:number, tone:'normal'|'warn'|'critical'}}
 *   pips: lit pips out of METER_PIPS. Anything above 0% keeps at least one pip lit, so a
 *   nearly-empty meter never looks the same as an empty one.
 */
export function meterView(fraction, { warnBelow, criticalBelow }) {
  const n = Number(fraction);
  const f = Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
  const pct = Math.round(f * 100);
  const pips = pct === 0 ? 0 : Math.max(1, Math.round(f * METER_PIPS));
  let tone = 'normal';
  if (f < criticalBelow) tone = 'critical';
  else if (f < warnBelow) tone = 'warn';
  return { pct, pips, tone };
}

/**
 * Hull Breach countdown, split for the "[ MM ]:[ SS ]" readout. Rounds up, so the timer only
 * shows 00:00 once time has actually run out.
 * @param {number} seconds
 * @returns {{min:string, sec:string}}
 */
export function splitCountdown(seconds) {
  const n = Number(seconds);
  const total = Number.isFinite(n) ? Math.max(0, Math.ceil(n)) : 0;
  const min = Math.min(99, Math.floor(total / 60));
  const sec = total >= 6000 ? 59 : total % 60;
  return { min: String(min).padStart(2, '0'), sec: String(sec).padStart(2, '0') };
}

/** Power readout: whole percent, clamped to 0-100. */
export function powerText(percent) {
  const n = Number(percent);
  const p = Number.isFinite(n) ? Math.round(Math.min(100, Math.max(0, n))) : 0;
  return `POWER ${p}%`;
}
