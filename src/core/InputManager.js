// InputManager.js
// Keyboard state tracker + mouse-look capture — feeds PhysicsController.update()
// and Camera.applyLookDelta(). Expand later for gamepad support if needed.

export class InputManager {
  /**
   * @param {HTMLElement} lockTarget - element that requests Pointer Lock on
   *   click (typically the renderer's canvas). Mouse-look deltas only
   *   accumulate while this element holds the lock.
   */
  constructor(lockTarget) {
    this._keys = new Set();
    this._jumpQueued = false;
    this._interactQueued = false;

    this._lockTarget = lockTarget;
    this._mouseDX = 0;
    this._mouseDY = 0;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !this._keys.has('Space')) {
        this._jumpQueued = true;
      }
      if(e.code === 'KeyE' && !this._keys.has('KeyE')){
        this._interactQueued = true;
      }
      this._keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this._keys.delete(e.code));

    if (this._lockTarget) {
      // Click-to-activate: browsers require a user gesture before granting
      // Pointer Lock, so it can't just be requested on load.
      this._lockTarget.addEventListener('click', () => {
        this._lockTarget.requestPointerLock();
      });

      // movementX/Y are already deltas since the last event — accumulate
      // between getInput() calls in case multiple mousemove events land
      // within one animation frame.
      document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement !== this._lockTarget) return;
        this._mouseDX += e.movementX;
        this._mouseDY += e.movementY;
      });
    }
  }

  /**
   * @returns {{axialAxis:number, tangentAxis:number, running:boolean, jump:boolean, interact:boolean, mouseDX:number, mouseDY:number}}
   *   jump/interact are edge-triggered: true only on the frame the key is
   *   first pressed, so each press fires exactly once.
   */
  getInput() {
    let axialAxis = 0;
    let tangentAxis = 0;

    if (this._keys.has('KeyW')) axialAxis -= 1;
    if (this._keys.has('KeyS')) axialAxis += 1;
    if (this._keys.has('KeyD')) tangentAxis += 1;
    if (this._keys.has('KeyA')) tangentAxis -= 1;

    const running = this._keys.has('ShiftLeft') || this._keys.has('ShiftRight');

    const jump = this._jumpQueued;
    this._jumpQueued = false;

    const interact = this._interactQueued;
    this._interactQueued = false;

    const mouseDX = this._mouseDX;
    const mouseDY = this._mouseDY;
    this._mouseDX = 0;
    this._mouseDY = 0;

    return { axialAxis, tangentAxis, running, jump, interact, mouseDX, mouseDY };
  }
}
