// src/core/FlyCam.js
//
// Free-flying camera for the L2 blockout validation. Not a gameplay
// controller — it exists so we can walk the maze before Alex's flat
// controller lands. Mouse-look via Pointer Lock (same mechanism as the
// drum camera), WASD for horizontal movement, Space/C for vertical, Shift
// for boost.
//
// The flashlight (always-on SpotLight) is attached here so the blockout's
// scale and mood can be judged correctly — design doc: flashlight is a
// camera spotlight, not a resource.

import * as THREE from 'three';

const LOOK_SENSITIVITY = 0.0025;
const MAX_PITCH = Math.PI / 2 - 0.15; // stop short of gimbal flip
const MOVE_SPEED = 12; // units/second at base
const BOOST_MULTIPLIER = 2.5; // held Shift

export class FlyCam {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.yaw = 0;
    this.pitch = 0;

    // Reusable vectors — never allocated inside the per-frame loop.
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._move = new THREE.Vector3();

    // Flashlight — always-on SpotLight parented to the camera.
    this._flashlight = new THREE.SpotLight(0xffe8c0, 8, 80, Math.PI / 4, 0.5, 1);
    this._flashlight.position.set(0, 0, 0); // at the camera's eye
    this._flashlight.target.position.set(0, 0, -1); // along -Z (camera forward)
    this.camera.add(this._flashlight);
    this.camera.add(this._flashlight.target);
  }

  getCamera() {
    return this.camera;
  }

  /**
   * Feeds raw Pointer Lock mouse deltas into the camera's look state.
   * Call once per frame, before update().
   */
  applyLookDelta(deltaX, deltaY) {
    this.yaw -= deltaX * LOOK_SENSITIVITY;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - deltaY * LOOK_SENSITIVITY,
      -MAX_PITCH,
      MAX_PITCH
    );
  }

  /**
   * Places the camera at a world position, looking at a target.
   * Recomputes yaw/pitch from the direction vector so subsequent
   * applyLookDelta calls orbit from the new orientation.
   */
  setPositionAndLook(position, lookAt) {
    this.camera.position.copy(position);
    const direction = new THREE.Vector3().subVectors(lookAt, position).normalize();
    this.yaw = Math.atan2(direction.x, -direction.z);
    this.pitch = Math.asin(direction.y);
  }

  /**
   * Advances the camera position from the frame's input.
   * @param {number} delta - seconds since last frame
   * @param {object} input - from InputManager.getInput()
   *   axialAxis: -1 (forward/W) .. +1 (back/S)
   *   tangentAxis: -1 (left/A) .. +1 (right/D)
   *   vertical: -1 (down/C) .. +1 (up/Space)
   *   running: Shift held
   */
  update(delta, input) {
    // Apply yaw/pitch to the camera orientation.
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);

    // Movement direction in camera-local space, then rotated to world.
    const speed = MOVE_SPEED * (input.running ? BOOST_MULTIPLIER : 1);
    this._forward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this._right.set(1, 0, 0).applyQuaternion(this.camera.quaternion);

    this._move.set(0, 0, 0);
    this._move.addScaledVector(this._forward, -input.axialAxis); // -1 = forward
    this._move.addScaledVector(this._right, input.tangentAxis);
    this._move.y += input.vertical ?? 0;

    if (this._move.lengthSq() > 0) {
      this._move.normalize().multiplyScalar(speed * delta);
      this.camera.position.add(this._move);
    }
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
