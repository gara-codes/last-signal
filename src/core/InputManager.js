// InputManager.js
// Minimal keyboard state tracker — feeds PhysicsController.update().
// Expand later for gamepad support if needed.

export class InputManager {
  constructor() {
    this._keys = new Set();
    this._jumpQueued = false;
    this._interactQueued = false;

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
  }

  /**
   * @returns {{axialAxis:number, tangentAxis:number, running:boolean, jump:boolean, interact:boolean}}
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

    return { axialAxis, tangentAxis, running, jump, interact };
  }
}
