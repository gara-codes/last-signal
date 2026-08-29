// InputManager.js
// Minimal keyboard state tracker — feeds PhysicsController.update().
// Expand later for gamepad support if needed.

export class InputManager {
    constructor() {
        this._keys = new Set();
        this._jumpQueued = false;

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !this._keys.has('Space')) {
                this._jumpQueued = true;
            }
            this._keys.add(e.code);
        });
        window.addEventListener('keyup', (e) => this._keys.delete(e.code));
    }

    /** @returns {{axialAxis:number, tangentAxis:number, running:boolean}} */
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

        return { axialAxis, tangentAxis, running, jump };
    }
}