// audio-manager.js
// Centralised audio controller — manages ambient loops, event-driven SFX,
// and per-level volume ramps. Scaffold: provides the API surface Shannon
// needs to wire real audio assets into later.

export class AudioManager {
  constructor() {
    this._ctx = null; // AudioContext, created on first user gesture
    this._masterGain = null;
    this._ambientSource = null;
    this._ambientGain = null;
    this._initialised = false;
  }

  /**
   * Lazily create the AudioContext. Browsers require a user gesture before
   * allowing audio playback, so this must be called from a click/keydown
   * handler (or after initMenu's start button).
   */
  init() {
    if (this._initialised) return;
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._masterGain = this._ctx.createGain();
      this._masterGain.connect(this._ctx.destination);
      this._ambientGain = this._ctx.createGain();
      this._ambientGain.connect(this._masterGain);
      this._initialised = true;
    } catch (e) {
      console.warn('AudioManager: Web Audio not available', e);
    }
  }

  /**
   * Set the master volume.
   * @param {number} value - 0 to 1
   */
  setMasterVolume(value) {
    if (!this._masterGain) return;
    this._masterGain.gain.value = Math.max(0, Math.min(1, value));
  }

  /**
   * Set the ambient loop volume (for level-specific ramps).
   * @param {number} value - 0 to 1
   */
  setAmbientVolume(value) {
    if (!this._ambientGain) return;
    this._ambientGain.gain.value = Math.max(0, Math.min(1, value));
  }

  /**
   * Play a one-shot sound effect.
   * @param {AudioBuffer} buffer - decoded audio data
   * @param {Object} [options]
   * @param {number} [options.volume] - 0-1 playback volume
   */
  playSFX(buffer, { volume = 1 } = {}) {
    if (!this._ctx || !buffer) return;
    const source = this._ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this._ctx.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volume));
    source.connect(gain);
    gain.connect(this._masterGain);
    source.start();
  }

  /**
   * Load and decode an audio file from a URL.
   * @param {string} url
   * @returns {Promise<AudioBuffer|null>}
   */
  async loadBuffer(url) {
    if (!this._ctx) return null;
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      return await this._ctx.decodeAudioData(arrayBuffer);
    } catch (e) {
      console.warn(`AudioManager: failed to load ${url}`, e);
      return null;
    }
  }

  /** Teardown — call on level transition */
  dispose() {
    if (this._ctx) {
      this._ctx.close();
      this._ctx = null;
    }
    this._initialised = false;
  }
}
