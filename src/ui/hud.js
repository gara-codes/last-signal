// hud.js
// In-game HUD overlay — displays fuel cell count, oxygen bar, countdown timer,
// and interaction prompts. Pure DOM, no Three.js dependency.

export class HUD {
  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'game-hud';
    this.root.innerHTML = `
      <div class="hud-bar hud-top-left">
        <div class="hud-item" id="hud-fuel">
          <span class="hud-label">FUEL CELLS</span>
          <span class="hud-value" id="hud-fuel-count">0</span>
        </div>
        <div class="hud-item" id="hud-oxygen">
          <span class="hud-label">OXYGEN</span>
          <div class="hud-bar-track">
            <div class="hud-bar-fill" id="hud-oxygen-fill"></div>
          </div>
        </div>
      </div>
      <div class="hud-bar hud-top-right">
        <div class="hud-item" id="hud-countdown" style="display:none">
          <span class="hud-label">ESCAPE IN</span>
          <span class="hud-value" id="hud-countdown-time">0:00</span>
        </div>
      </div>
      <div class="hud-bar hud-bottom-center">
        <div class="hud-item" id="hud-prompt" style="display:none">
          <span class="hud-value" id="hud-prompt-text"></span>
        </div>
      </div>
    `;
    document.body.appendChild(this.root);

    // Cache DOM references
    this._fuelCount = this.root.querySelector('#hud-fuel-count');
    this._oxygenFill = this.root.querySelector('#hud-oxygen-fill');
    this._countdown = this.root.querySelector('#hud-countdown');
    this._countdownTime = this.root.querySelector('#hud-countdown-time');
    this._prompt = this.root.querySelector('#hud-prompt');
    this._promptText = this.root.querySelector('#hud-prompt-text');
  }

  /** @param {number} count - current fuel cell bank */
  setFuelCount(count) {
    this._fuelCount.textContent = count;
  }

  /** @param {number} fraction - 0 to 1 */
  setOxygenFraction(fraction) {
    const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
    this._oxygenFill.style.width = `${pct}%`;
    // Visual warning: bar turns red below 25%
    this._oxygenFill.classList.toggle('hud-critical', pct < 25);
  }

  /**
   * Show/hide the countdown timer.
   * @param {boolean} visible
   * @param {number} [seconds] - remaining seconds
   */
  setCountdown(visible, seconds = 0) {
    this._countdown.style.display = visible ? '' : 'none';
    if (visible) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      this._countdownTime.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Show an interaction prompt (e.g. "Press E to open door").
   * @param {string} text
   */
  showPrompt(text) {
    this._promptText.textContent = text;
    this._prompt.style.display = '';
  }

  hidePrompt() {
    this._prompt.style.display = 'none';
  }

  /** Removes the HUD from the DOM entirely */
  dispose() {
    this.root.remove();
  }
}
