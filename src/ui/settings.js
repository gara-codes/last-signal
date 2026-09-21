// src/ui/settings.js
//
// Player settings behind the Options screen: the four sliders plus the AI-voice captions
// toggle. Pure logic (no DOM) so it is unit-tested in tests/settings.test.js; storage is
// injected, defaulting to localStorage when the browser has one.
//
// This module only holds and persists the values. Who reacts to them is wired elsewhere:
//   - hudOpacity / brightness  -> applied in src/ui/index.js (CSS var / canvas filter)
//   - sfxVolume / musicVolume  -> TODO(wire): src/audio/audio-manager.js should subscribe()
//   - captions                 -> exposed as body[data-captions]; the caption bar is not built yet

export const SETTINGS_KEY = 'last-signal.settings.v1';

export const SLIDER_MIN = 0;
export const SLIDER_MAX = 100;
export const SLIDER_STEP = 5;

// Order here is the order on the Options screen.
//   min:  lowest value the slider allows (default 0). HUD Opacity stops at 20% so the HUD can
//         never be slid fully invisible; the Options screen draws that floor on the track.
//   hint: one plain-language line shown under the slider while it is hovered or focused. Keep
//         it to what the slider does for the player, in one line (tests/settings.test.js
//         checks the length).
export const HINT_MAX_LENGTH = 80;

export const SLIDERS = [
  {
    key: 'sfxVolume',
    label: 'SFX Volume',
    hint: 'How loud sound effects are, such as footsteps and doors.',
  },
  {
    key: 'musicVolume',
    label: 'Music Volume',
    hint: 'How loud the background music is, separate from sound effects.',
  },
  {
    key: 'brightness',
    label: 'Brightness',
    hint: 'How light the game world looks. Raise it if dark areas are hard to see.',
  },
  {
    key: 'hudOpacity',
    label: 'HUD Opacity',
    min: 20,
    hint: 'How solid on-screen info, like your fuel count, looks. Lowest is 20%.',
  },
];

export const DEFAULT_SETTINGS = Object.freeze({
  sfxVolume: 80,
  musicVolume: 60,
  brightness: 50, // 50% is the neutral, unfiltered look
  hudOpacity: 100,
  captions: true,
});

const SLIDER_KEYS = new Set(SLIDERS.map((s) => s.key));

/** Lowest value a slider allows (0 unless its definition sets a floor). */
export function sliderMin(key) {
  return SLIDERS.find((s) => s.key === key)?.min ?? SLIDER_MIN;
}

/** Snap to the slider step and clamp to [min, 100]. Returns null for non-numbers. */
export function normalizeSlider(value, min = SLIDER_MIN) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const snapped = Math.round(n / SLIDER_STEP) * SLIDER_STEP;
  return Math.min(SLIDER_MAX, Math.max(min, snapped));
}

/** Brightness slider (0-100) -> CSS brightness() factor on the game canvas: 0.5x to 1.5x. */
export function brightnessToFactor(percent) {
  return Math.round((0.5 + percent / 100) * 1000) / 1000;
}

/**
 * HUD Opacity slider (20-100) -> CSS opacity. The slider itself stops at 20% (see SLIDERS), so
 * the HUD can never be slid fully invisible, which would strand a player with no fuel/health
 * readout; the clamp here is a second line of defence.
 */
export function hudOpacityToCss(percent) {
  const floor = sliderMin('hudOpacity');
  return Math.min(SLIDER_MAX, Math.max(floor, percent)) / 100;
}

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // storage can throw when blocked (private mode, sandboxed iframes)
  }
}

function sanitize(raw) {
  const clean = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return clean;
  for (const key of SLIDER_KEYS) {
    const value = normalizeSlider(raw[key], sliderMin(key));
    if (value !== null) clean[key] = value;
  }
  if (typeof raw.captions === 'boolean') clean.captions = raw.captions;
  return clean;
}

export function createSettings({ storage = defaultStorage(), key = SETTINGS_KEY } = {}) {
  let values = { ...DEFAULT_SETTINGS };
  const listeners = new Set();

  try {
    const saved = storage?.getItem(key);
    if (saved) values = sanitize(JSON.parse(saved));
  } catch {
    values = { ...DEFAULT_SETTINGS }; // corrupt or unreadable: start from defaults
  }

  function persist() {
    try {
      storage?.setItem(key, JSON.stringify(values));
    } catch {
      // quota / blocked storage: settings still work for this session
    }
  }

  function notify(changedKey) {
    const snapshot = { ...values };
    for (const listener of listeners) listener(snapshot, changedKey);
  }

  function set(name, value) {
    let next;
    if (SLIDER_KEYS.has(name)) {
      next = normalizeSlider(value, sliderMin(name));
    } else if (name === 'captions' && typeof value === 'boolean') {
      next = value;
    }
    if (next === undefined || next === null) return false;
    if (values[name] === next) return false;
    values = { ...values, [name]: next };
    persist();
    notify(name);
    return true;
  }

  return {
    get: () => ({ ...values }),
    set,
    /** Move a slider one step: direction is -1 or +1. */
    step: (name, direction) => set(name, values[name] + direction * SLIDER_STEP),
    reset() {
      values = { ...DEFAULT_SETTINGS };
      persist();
      notify(null);
    },
    /** Listener gets (allSettings, changedKey); changedKey is null after reset(). */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
