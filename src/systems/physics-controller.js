// physics-controller.js
// Layer 1 "Base movement" task, rebuilt against the rotating-drum
// brief (Movement & Camera Brief) instead of flat walk/jump — the drum shape
// makes flat ground movement wrong for this level, so this supersedes that
// task rather than sitting alongside it.
//
// Geometry note: theta/up/position below are verified against the real
// pod-bay placement in level1-habitation-ring.js and the astronaut's actual
// spawn point in AssetLoader.js (y = -30.9), not the brief's example formula
// — the brief used a different axis/sign convention that didn't match the
// built level. Credit to Nikki for catching both mismatches while wiring
// the camera against a test marker.

import * as THREE from 'three';

// Drum geometry constants — mirror level1.js. If Yannis changes drum size,
// only these two need updating (per the brief's "definition of done" note).
const RADIUS = 31;
const HEIGHT_HALF = 10; // drum spans x: -10 to 10
const WALK_RADIUS = RADIUS - 1.2; // feet sit on the surface, not inside the wall mesh
const AXIAL_CLAMP = 9; // leave margin inside the ±10 hull ends until doors/thresholds exist

const LINEAR_SPEED = 6; // units/sec along the drum's length — tune once playable

const JUMP_SPEED = 8;
const GRAVITY = 20;

export class PlayerController {
    /**
    * @param {THREE.Object3D} playerGroup - the outer THREE.Group wrapping the
    *   loaded astronaut GLTF (per brief: keep the GLTF at local origin inside it,
    *   drive this group's position/quaternion instead).
    */
    constructor(playerGroup) {
        this.player = playerGroup;

        // Player state = two scalars, not a free 3D position.
        this.axial = 0; // position along drum length (world X)
        // theta = Math.PI matches the drum's actual "bottom" per the real
        // pod-bay placement (centerAngle = Math.PI in level1-habitation-ring.js),
        // and lines up with the astronaut's spawn at y = -30.9 in AssetLoader.js.
        this.theta = Math.PI;

        // Cached each frame; getSurfaceBasis() just returns this so camera code
        // and movement code never duplicate the trig.
        this._basis = { position: new THREE.Vector3(), up: new THREE.Vector3(), forward: new THREE.Vector3() };
        // Holds the last non-zero forward so the model doesn't snap to a default
        // direction when the player stops moving. Tangent direction (derivative
        // of position w.r.t. theta).
        this._lastForward = new THREE.Vector3(0, -Math.sin(this.theta), Math.cos(this.theta));

        this.isRunning = false; // read by the oxygen system in Layer 2

        this.jumpOffset = 0;
        this.jumpVelocity = 0;
        this.isGrounded = true;

        this._lookMatrix = new THREE.Matrix4();

        this.player.userData.getSurfaceBasis = () => this._basis;
    }

    /**
    * @param {number} delta - seconds since last frame
    * @param {{axialAxis:number, tangentAxis:number, running:boolean}} input
    *   axialAxis: -1..1 from S/W (or gamepad), tangentAxis: -1..1 from A/D
    */
    update(delta, input) {
        const { axialAxis = 0, tangentAxis = 0, running = false, jump = false } = input;
        this.isRunning = running;
        const speed = running ? LINEAR_SPEED * 1.6 : LINEAR_SPEED;

        if (jump && this.isGrounded) {
            this.jumpVelocity = JUMP_SPEED;
            this.isGrounded = false;
        }
        this.jumpVelocity -= GRAVITY * delta;
        this.jumpOffset += this.jumpVelocity * delta;
        if (this.jumpOffset <= 0) {
            this.jumpOffset = 0;
            this.jumpVelocity = 0;
            this.isGrounded = true;
        }

        // W/S — moves along the drum's length, behaves like normal flat-ground movement.
        this.axial = clamp(this.axial + axialAxis * speed * delta, -AXIAL_CLAMP, AXIAL_CLAMP);

        // A/D — walking around the rim. Angular speed scaled by linearSpeed/WALK_RADIUS
        // so it *feels* the same speed as moving along the length, not oddly fast/slow.
        const angularSpeed = speed / WALK_RADIUS;
        this.theta += tangentAxis * angularSpeed * delta;

        // Circular cross-section position — verified against the real level
        // geometry (pod-bay placement), not the brief's example.
        const worldPosition = new THREE.Vector3(
            this.axial,
            WALK_RADIUS * Math.cos(this.theta),
            WALK_RADIUS * Math.sin(this.theta)
        );

        // "up" (feet -> head) points INWARD, toward the central X-axis — we're
        // standing on the inside of the outer wall (2001-centrifuge style), not
        // on top of it. This is what changes as theta changes, and it's the
        // whole trick. (Confirmed by Nikki: the outward sign renders upside-down.)
        const radialUp = new THREE.Vector3(0, -Math.cos(this.theta), -Math.sin(this.theta));

        if (this.jumpOffset > 0) {
            worldPosition.addScaledVector(radialUp, this.jumpOffset);
        }

        // Tangential direction — derivative of worldPosition w.r.t. theta.
        const tangent = new THREE.Vector3(0, -Math.sin(this.theta), Math.cos(this.theta));

        let forward;
        if (axialAxis !== 0 || tangentAxis !== 0) {
            forward = new THREE.Vector3()
                .addScaledVector(new THREE.Vector3(1, 0, 0), axialAxis)
                .addScaledVector(tangent, tangentAxis)
                .normalize();
            this._lastForward.copy(forward);
        } else {
            forward = this._lastForward;
        }

        this._lookMatrix.lookAt(
            worldPosition,                        
            worldPosition.clone().add(forward),   
            radialUp                              
        );
        this.player.quaternion.setFromRotationMatrix(this._lookMatrix);
        this.player.position.copy(worldPosition);

        this._basis.position.copy(worldPosition);
        this._basis.up.copy(radialUp);
        this._basis.forward.copy(forward);
    }
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}