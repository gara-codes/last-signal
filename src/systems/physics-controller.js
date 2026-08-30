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
const TURN_SPEED = 10; // radians/sec the facing is allowed to turn toward input — tune to taste

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
    this._basis = {
      position: new THREE.Vector3(),
      up: new THREE.Vector3(),
      forward: new THREE.Vector3(),
    };

    // Persistent facing, expressed in the drum's flat local coordinates
    // (axial units, tangential arc-length units) rather than as a raw 3D
    // vector. A cylinder is developable, so this 2D direction stays valid
    // as-is even as theta changes — it's the thing that makes W/A/S/D
    // camera-relative: input is interpreted against THIS (last frame's
    // facing), not against fixed world axes, so the character/camera
    // keep turning smoothly instead of snapping back to a hardcoded axis
    // whenever you switch between axial and rim keys.
    // Starts matching the old default facing (pure +theta tangent at the
    // spawn theta), so the spawn orientation looks the same as before.
    this.facing2D = new THREE.Vector2(0, 1);

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

    // Camera-relative W/A/S/D: reinterpret the raw axial/tangent input
    // against the CURRENT facing (this.facing2D), not fixed world axes.
    // "Right" relative to a facing (a, t) in this orthonormal (axial,
    // tangent, up) frame is (t, -a) (right = forward × up, worked out
    // from the axial/tangent/up triad below being right-handed).
    const right2D = { a: this.facing2D.y, t: -this.facing2D.x };
    // InputManager encodes W as axialAxis = -1 (a leftover of the old
    // "W drives world -X" convention) — flip it so "forward" input is
    // +1 for W / -1 for S here. tangentAxis is already +1 for D / -1 for
    // A, which is exactly "strafe right" in this frame, so it's used as-is.
    const fwdInput = -axialAxis;
    const strafeInput = tangentAxis;
    let moveA = this.facing2D.x * fwdInput + right2D.a * strafeInput;
    let moveT = this.facing2D.y * fwdInput + right2D.t * strafeInput;
    const moveLen = Math.hypot(moveA, moveT);

    if (moveLen > 0.0001) {
      moveA /= moveLen;
      moveT /= moveLen;

      // Only turn the character/camera to face the movement direction
      // when that direction is forward-ish (within 90° of the current
      // facing — dot product with facing > 0), e.g. running diagonally
      // forward. Backpedaling (S) and pure strafing (A/D) keep the
      // current facing untouched and just translate, like a normal
      // strafe scheme — because "backward" is by definition always
      // 180° from wherever facing currently points, turning to face it
      // is a target that recedes as fast as facing chases it (it can
      // never converge), which made S oscillate in place instead of
      // actually walking backward, and made pure strafing spin. Only
      // rotating for forward-ish input avoids that self-chasing target
      // entirely.
      const forwardDot = moveA * this.facing2D.x + moveT * this.facing2D.y;
      if (forwardDot > 0) {
        const currentAngle = Math.atan2(this.facing2D.y, this.facing2D.x);
        const targetAngle = Math.atan2(moveT, moveA);
        let angleDiff = targetAngle - currentAngle;
        angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff)); // wrap to [-PI, PI]
        const maxStep = TURN_SPEED * delta;
        const step = clamp(angleDiff, -maxStep, maxStep);
        const newAngle = currentAngle + step;
        this.facing2D.set(Math.cos(newAngle), Math.sin(newAngle));
      }
    }

    // Always translate along the raw camera-relative direction (moveA,
    // moveT) rather than the (possibly-unchanged) facing, so backward/
    // strafe movement is instantly responsive even on frames where the
    // facing itself doesn't turn.

    // moveA is the resolved (camera-relative) movement along the drum's length.
    this.axial = clamp(this.axial + moveA * speed * delta, -AXIAL_CLAMP, AXIAL_CLAMP);

    // moveT is the resolved (camera-relative) movement around the rim. Angular
    // speed scaled by linearSpeed/WALK_RADIUS so it *feels* the same speed as
    // moving along the length, not oddly fast/slow.
    const angularSpeed = speed / WALK_RADIUS;
    this.theta += moveT * angularSpeed * delta;

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

    // Re-express the persistent facing2D (axial, tangent) in world space at
    // the new theta. Doesn't reset when input stops — facing2D only
    // changes when there's actual input (above), so this naturally holds
    // the last heading, same as the old _lastForward fallback did.
    const forward = new THREE.Vector3()
      .addScaledVector(new THREE.Vector3(1, 0, 0), this.facing2D.x)
      .addScaledVector(tangent, this.facing2D.y)
      .normalize();

    this._lookMatrix.lookAt(worldPosition, worldPosition.clone().add(forward), radialUp);
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
