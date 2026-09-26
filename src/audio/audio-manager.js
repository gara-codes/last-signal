// audio-manager.js
//
// Centralised audio controller — two buses (sfx, music) sitting under a master gain, driven
// directly by the Options screen's sfxVolume/musicVolume sliders (see src/ui/settings.js).
// Started from Natasha's scaffold (natasha/visual-improvements-l1); extended with a named
// buffer cache, a music/loop transport, and settings wiring so this closes wiring-tracker row 4.
//
//   const audio = new AudioManager();
//   window.addEventListener('pointerdown', () => audio.init(), { once: true }); // user gesture
//   audio.bindSettings(ui.settings);           // sfxVolume / musicVolume (0-100) applied live
//   await audio.preload('blip', 'assets/audio/sfx/_placeholder-blip.mp3');
//   audio.play('blip');
//   await audio.preload('l1-ambient', 'assets/audio/music/_placeholder-loop.mp3');
//   audio.playMusic('l1-ambient', { loop: true });

export class AudioManager {
  constructor() {
    this._ctx = null; // AudioContext, created on first user gesture
    this._masterGain = null;
    this._sfxGain = null;
    this._musicGain = null;
    this._musicSource = null; // currently-playing looped/one-shot music node, if any
    this._musicId = null; // id of what _musicSource is playing, for playMusic() no-ops
    this._buffers = new Map(); // id -> AudioBuffer, populated by preload()
    this._pending = new Map(); // id -> in-flight preload() promise, so callers can't double-fetch
    this._initialised = false;
    this._unsubscribeSettings = null;
  }

  /**
   * Lazily create the AudioContext. Browsers require a user gesture before allowing audio
   * playback, so this must be called from a click/keydown handler. Safe to call more than
   * once — later calls are a no-op once initialised.
   */
  init() {
    if (this._initialised) return;
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._masterGain = this._ctx.createGain();
      this._masterGain.connect(this._ctx.destination);
      this._sfxGain = this._ctx.createGain();
      this._sfxGain.connect(this._masterGain);
      this._musicGain = this._ctx.createGain();
      this._musicGain.connect(this._masterGain);
      this._initialised = true;
    } catch (e) {
      console.warn('AudioManager: Web Audio not available', e);
    }
  }

  /**
   * Subscribe to a settings instance (src/ui/settings.js) and keep sfxVolume/musicVolume
   * applied live, including the value already set at call time. Returns an unsubscribe
   * function; calling bindSettings() again replaces the previous subscription.
   * @param {{ get: () => object, subscribe: (fn: (values: object) => void) => () => void }} settings
   */
  bindSettings(settings) {
    this._unsubscribeSettings?.();
    const apply = (values) => {
      this.setSfxVolume(values.sfxVolume / 100);
      this.setMusicVolume(values.musicVolume / 100);
    };
    apply(settings.get());
    this._unsubscribeSettings = settings.subscribe(apply);
    return this._unsubscribeSettings;
  }

  /** Set the master volume. @param {number} value - 0 to 1 */
  setMasterVolume(value) {
    if (!this._masterGain) return;
    this._masterGain.gain.value = Math.max(0, Math.min(1, value));
  }

  /** Set the SFX bus volume. @param {number} value - 0 to 1 */
  setSfxVolume(value) {
    if (!this._sfxGain) return;
    this._sfxGain.gain.value = Math.max(0, Math.min(1, value));
  }

  /** Set the music bus volume. @param {number} value - 0 to 1 */
  setMusicVolume(value) {
    if (!this._musicGain) return;
    this._musicGain.gain.value = Math.max(0, Math.min(1, value));
  }

  /**
   * Load and decode an audio file, caching it under `id` for play()/playMusic(). Safe to call
   * before init() — the fetch runs regardless, decoding waits for an AudioContext to exist.
   * Concurrent preload() calls for the same id share one fetch.
   * @param {string} id
   * @param {string} url
   * @returns {Promise<AudioBuffer|null>}
   */
  async preload(id, url) {
    if (this._buffers.has(id)) return this._buffers.get(id);
    if (this._pending.has(id)) return this._pending.get(id);

    const task = (async () => {
      try {
        const response = await window.fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        if (!this._ctx) this.init();
        if (!this._ctx) return null; // Web Audio unavailable — warned in init()
        const buffer = await this._ctx.decodeAudioData(arrayBuffer);
        this._buffers.set(id, buffer);
        return buffer;
      } catch (e) {
        console.warn(`AudioManager: failed to load "${id}" from ${url}`, e);
        return null;
      } finally {
        this._pending.delete(id);
      }
    })();

    this._pending.set(id, task);
    return task;
  }

  /**
   * Play a one-shot sound effect already loaded via preload().
   * @param {string} id
   * @param {Object} [options]
   * @param {number} [options.volume] - 0-1, on top of the SFX bus
   */
  play(id, { volume = 1 } = {}) {
    const buffer = this._buffers.get(id);
    if (!this._ctx || !buffer) {
      if (!buffer) console.warn(`AudioManager: play("${id}") — not preloaded`);
      return;
    }
    const source = this._ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this._ctx.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volume));
    source.connect(gain);
    gain.connect(this._sfxGain);
    source.start();
  }

  /**
   * Play (or loop) a music/ambient bed already loaded via preload(). Replaces whatever music
   * is currently playing. Calling with the same id that's already playing is a no-op, so
   * level-theme switches can call this unconditionally each frame/transition.
   * @param {string} id
   * @param {Object} [options]
   * @param {boolean} [options.loop] - default true
   * @param {number} [options.volume] - 0-1, on top of the music bus
   */
  playMusic(id, { loop = true, volume = 1 } = {}) {
    if (this._musicId === id && this._musicSource) return; // already playing this track
    const buffer = this._buffers.get(id);
    if (!this._ctx || !buffer) {
      if (!buffer) console.warn(`AudioManager: playMusic("${id}") — not preloaded`);
      return;
    }
    this.stopMusic();
    const source = this._ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    const gain = this._ctx.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volume));
    source.connect(gain);
    gain.connect(this._musicGain);
    source.start();
    this._musicSource = source;
    this._musicId = id;
  }

  /** Stop whatever music/ambient bed is currently playing, if any. */
  stopMusic() {
    if (this._musicSource) {
      try {
        this._musicSource.stop();
      } catch {
        // already stopped — fine
      }
      this._musicSource.disconnect();
    }
    this._musicSource = null;
    this._musicId = null;
  }

  /** Teardown — call on level transition or page unload. */
  dispose() {
    this.stopMusic();
    this._unsubscribeSettings?.();
    this._unsubscribeSettings = null;
    if (this._ctx) {
      this._ctx.close();
      this._ctx = null;
    }
    this._buffers.clear();
    this._pending.clear();
    this._initialised = false;
  }
}
