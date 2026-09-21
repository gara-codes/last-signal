// tests/interact-prompt.test.js
import { describe, it, expect } from 'vitest';
import { resolvePrompt, HIDDEN_PROMPT } from '../src/ui/interact-prompt.js';

describe('resolvePrompt', () => {
  it('hides for a missing, empty or non-string label', () => {
    expect(resolvePrompt(null)).toBe(HIDDEN_PROMPT);
    expect(resolvePrompt(undefined)).toBe(HIDDEN_PROMPT);
    expect(resolvePrompt('')).toBe(HIDDEN_PROMPT);
    expect(resolvePrompt('   ')).toBe(HIDDEN_PROMPT);
    expect(resolvePrompt(42)).toBe(HIDDEN_PROMPT);
    expect(resolvePrompt(null, { denied: true, detail: 'x' }).visible).toBe(false);
  });

  it('shows a plain prompt with no anchor, docked', () => {
    const view = resolvePrompt('Collect Fuel Cell');
    expect(view).toMatchObject({
      visible: true,
      label: 'Collect Fuel Cell',
      denied: false,
      detail: '',
      anchor: null,
    });
  });

  it('carries the denied state and its detail', () => {
    const view = resolvePrompt('Open Door', { denied: true, detail: '  2 / 4 Fuel Cells ' });
    expect(view.denied).toBe(true);
    expect(view.detail).toBe('2 / 4 Fuel Cells');
  });

  it('only treats denied === true as denied', () => {
    expect(resolvePrompt('Open Door', { denied: 'yes' }).denied).toBe(false);
    expect(resolvePrompt('Open Door', {}).denied).toBe(false);
  });

  it('rounds a valid anchor to whole pixels and rejects an invalid one', () => {
    expect(resolvePrompt('Interact', { anchor: { x: 100.6, y: 40.2 } }).anchor).toEqual({
      x: 101,
      y: 40,
    });
    expect(resolvePrompt('Interact', { anchor: { x: NaN, y: 40 } }).anchor).toBeNull();
    expect(resolvePrompt('Interact', { anchor: { x: '5', y: 40 } }).anchor).toBeNull();
    expect(resolvePrompt('Interact', { anchor: null }).anchor).toBeNull();
  });

  it('gives identical calls the same key, so per-frame calls can skip DOM writes', () => {
    const a = resolvePrompt('Interact', { anchor: { x: 10.2, y: 20.4 } });
    const b = resolvePrompt('Interact', { anchor: { x: 10.4, y: 19.6 } });
    expect(a.key).toBe(b.key); // same whole-pixel position
  });

  it('changes the key when anything visible changes', () => {
    const base = resolvePrompt('Open Door');
    expect(resolvePrompt('Open Door', { denied: true }).key).not.toBe(base.key);
    expect(resolvePrompt('Open Door', { detail: '1 / 4' }).key).not.toBe(base.key);
    expect(resolvePrompt('Open Door', { anchor: { x: 1, y: 2 } }).key).not.toBe(base.key);
    expect(resolvePrompt('Grab Handhold').key).not.toBe(base.key);
    expect(resolvePrompt(null).key).toBe('hidden');
  });
});
