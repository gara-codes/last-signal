// tests/settings.test.js
import { describe, it, expect } from 'vitest';
import {
  createSettings,
  normalizeSlider,
  brightnessToFactor,
  hudOpacityToCss,
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  SLIDERS,
  HINT_MAX_LENGTH,
  sliderMin,
} from '../src/ui/settings.js';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe('normalizeSlider', () => {
  it('snaps to steps of 5 and clamps to 0-100', () => {
    expect(normalizeSlider(52)).toBe(50);
    expect(normalizeSlider(53)).toBe(55);
    expect(normalizeSlider(-20)).toBe(0);
    expect(normalizeSlider(140)).toBe(100);
  });

  it('clamps to a per-slider minimum when one is given', () => {
    expect(normalizeSlider(0, 20)).toBe(20);
    expect(normalizeSlider(10, 20)).toBe(20);
    expect(normalizeSlider(45, 20)).toBe(45);
  });

  it('rejects non-numbers', () => {
    expect(normalizeSlider('loud')).toBeNull();
    expect(normalizeSlider(NaN)).toBeNull();
    expect(normalizeSlider(undefined)).toBeNull();
  });
});

describe('createSettings', () => {
  it('starts from defaults when nothing is saved', () => {
    const settings = createSettings({ storage: fakeStorage() });
    expect(settings.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('set() clamps, persists, and notifies only on a real change', () => {
    const storage = fakeStorage();
    const settings = createSettings({ storage });
    const calls = [];
    settings.subscribe((values, key) => calls.push([key, values[key]]));

    expect(settings.set('sfxVolume', 133)).toBe(true);
    expect(settings.get().sfxVolume).toBe(100);
    expect(settings.set('sfxVolume', 100)).toBe(false); // unchanged
    expect(calls).toEqual([['sfxVolume', 100]]);
    expect(JSON.parse(storage.data[SETTINGS_KEY]).sfxVolume).toBe(100);
  });

  it('step() moves one notch and stops at the ends', () => {
    const settings = createSettings({ storage: fakeStorage() });
    settings.set('musicVolume', 95);
    expect(settings.step('musicVolume', 1)).toBe(true);
    expect(settings.get().musicVolume).toBe(100);
    expect(settings.step('musicVolume', 1)).toBe(false);
    settings.set('musicVolume', 0);
    expect(settings.step('musicVolume', -1)).toBe(false);
  });

  it('only accepts booleans for captions and ignores unknown keys', () => {
    const settings = createSettings({ storage: fakeStorage() });
    expect(settings.set('captions', 'yes')).toBe(false);
    expect(settings.set('captions', false)).toBe(true);
    expect(settings.get().captions).toBe(false);
    expect(settings.set('difficulty', 3)).toBe(false);
    expect(settings.get()).not.toHaveProperty('difficulty');
  });

  it('loads saved values and repairs bad ones', () => {
    const storage = fakeStorage({
      [SETTINGS_KEY]: JSON.stringify({
        sfxVolume: 30,
        musicVolume: 'max',
        brightness: 999,
        hudOpacity: 42,
        captions: 'nope',
        extra: 1,
      }),
    });
    const values = createSettings({ storage }).get();
    expect(values.sfxVolume).toBe(30);
    expect(values.musicVolume).toBe(DEFAULT_SETTINGS.musicVolume);
    expect(values.brightness).toBe(100);
    expect(values.hudOpacity).toBe(40);
    expect(values.captions).toBe(DEFAULT_SETTINGS.captions);
    expect(values).not.toHaveProperty('extra');
  });

  it('survives corrupt JSON and storage that throws', () => {
    const corrupt = fakeStorage({ [SETTINGS_KEY]: '{not json' });
    expect(createSettings({ storage: corrupt }).get()).toEqual(DEFAULT_SETTINGS);

    const blocked = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    };
    const settings = createSettings({ storage: blocked });
    expect(settings.set('sfxVolume', 10)).toBe(true); // still works for this session
    expect(settings.get().sfxVolume).toBe(10);
  });

  it('works with no storage at all', () => {
    const settings = createSettings({ storage: null });
    settings.set('brightness', 70);
    expect(settings.get().brightness).toBe(70);
  });

  it('reset() restores defaults and notifies with a null key', () => {
    const settings = createSettings({ storage: fakeStorage() });
    settings.set('hudOpacity', 20);
    const keys = [];
    settings.subscribe((_values, key) => keys.push(key));
    settings.reset();
    expect(settings.get()).toEqual(DEFAULT_SETTINGS);
    expect(keys).toEqual([null]);
  });

  it('HUD Opacity cannot be set, stepped or loaded below 20%', () => {
    expect(sliderMin('hudOpacity')).toBe(20);
    expect(sliderMin('sfxVolume')).toBe(0);

    const settings = createSettings({ storage: fakeStorage() });
    settings.set('hudOpacity', 0);
    expect(settings.get().hudOpacity).toBe(20);
    expect(settings.step('hudOpacity', -1)).toBe(false); // already at the floor
    expect(settings.get().hudOpacity).toBe(20);

    const saved = fakeStorage({ [SETTINGS_KEY]: JSON.stringify({ hudOpacity: 5 }) });
    expect(createSettings({ storage: saved }).get().hudOpacity).toBe(20);
  });

  it('every slider has a one-line hint that says more than its label', () => {
    for (const slider of SLIDERS) {
      expect(slider.hint.length).toBeGreaterThan(slider.label.length);
      expect(slider.hint.toLowerCase()).not.toBe(slider.label.toLowerCase());
      expect(slider.hint.length).toBeLessThanOrEqual(HINT_MAX_LENGTH);
      expect(slider.hint).not.toMatch(/\n/);
    }
  });

  it('lists the four sliders in Options order', () => {
    expect(SLIDERS.map((s) => s.label)).toEqual([
      'SFX Volume',
      'Music Volume',
      'Brightness',
      'HUD Opacity',
    ]);
  });
});

describe('slider -> effect mappings', () => {
  it('brightness: 50% is the neutral look, range 0.5x-1.5x', () => {
    expect(brightnessToFactor(50)).toBe(1);
    expect(brightnessToFactor(0)).toBe(0.5);
    expect(brightnessToFactor(100)).toBe(1.5);
  });

  it('HUD opacity is the slider value, never below 20%', () => {
    expect(hudOpacityToCss(0)).toBe(0.2);
    expect(hudOpacityToCss(20)).toBe(0.2);
    expect(hudOpacityToCss(50)).toBe(0.5);
    expect(hudOpacityToCss(100)).toBe(1);
  });
});
