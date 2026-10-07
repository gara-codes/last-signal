import * as THREE from 'three';

const LOOK_SENSITIVITY = 0.0025;
const MAX_PITCH = Math.PI / 2 - 0.15; // stop just short of straight up/down, avoids gimbal flip

// Camera-vs-geometry: how far the camera keeps off a blocking surface (a bit more than the
// 0.1 near plane, so the surface itself never clips into view).
const BLOCKER_PADDING = 0.3;
const HEAD_HEIGHT = 4; // lookAt point above the player's base — also the ray's origin

// Scratch values for the per-frame blocker test — module-level so it never allocates.
const rayOrigin = new THREE.Vector3();
const rayDirection = new THREE.Vector3();

/**
 * Distance along the ray (origin + t*dir, t >= 0) at which it first enters `box` grown by
 * `pad` on every side, or Infinity if it never does. Returns -1 when the origin already
 * starts inside the grown box. Standard slab test; a ray parallel to a slab misses unless
 * its origin lies between that slab's planes.
 */
function rayEntersBox(origin, dir, box, pad) {
  slabEnter = -Infinity;
  slabExit = Infinity;
  if (!clipSlab(origin.x, dir.x, box.minX - pad, box.maxX + pad)) return Infinity;
  if (!clipSlab(origin.y, dir.y, box.minY - pad, box.maxY + pad)) return Infinity;
  if (!clipSlab(origin.z, dir.z, box.minZ - pad, box.maxZ + pad)) return Infinity;

  if (slabExit < 0) return Infinity; // box is behind the origin
  if (slabEnter < 0) return -1; // origin inside the grown box
  return slabEnter;
}

// Running enter/exit distances for rayEntersBox — module-level so the per-frame test has no
// per-call allocation (no tuple return, no array of axes).
let slabEnter = 0;
let slabExit = 0;

/** Narrows [slabEnter, slabExit] by one axis' slab; false once the ray can't hit the box. */
function clipSlab(origin, dir, min, max) {
  if (Math.abs(dir) < 1e-9) return origin >= min && origin <= max;
  const t1 = (min - origin) / dir;
  const t2 = (max - origin) / dir;
  slabEnter = Math.max(slabEnter, Math.min(t1, t2));
  slabExit = Math.min(slabExit, Math.max(t1, t2));
  return slabEnter <= slabExit;
}

export class Camera {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    // Free mouse-look state — the camera's own, independent of the
    // player's movement-driven facing (physics-controller.js's facing2D).
    // yaw orbits the camera around the player's local up; pitch tilts it
    // above/below their local horizon. Both are angles, not vectors, so
    // they stay meaningful as basis.up itself keeps rotating on this
    // level — a fixed world-axis version (à la OrbitControls) doesn't.
    this.yaw = 0;
    this.pitch = 0;

    // Level-specific containment — null means no clamping at all, which
    // is wrong for every real level, so every call site must set this
    // once after construction. See setBounds() for the two shapes.
    this._bounds = null;

    // Solid boxes the camera must not pass through — see setBlockers(). null = none (L1).
    this._blockers = null;

    // Flashlight — always-on SpotLight parented to the camera (design doc:
    // a camera spotlight, not a resource). Same settings as FlyCam's, so
    // the blockout validated there looks the same in play. Light children
    // only render once the camera is in the scene graph — main.js adds it.
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
   * Configures wall/ceiling containment for the current level. The two
   * levels have genuinely different geometry (L1 is a cylinder around the
   * world X-axis; L2 is an axis-aligned box), so this takes a shape
   * descriptor instead of hardcoding one level's numbers:
   *
   *   { type: 'cylinder', radius, axialHalfLength, margin }
   *     L1's drum — clamps radial distance from the X-axis (the curved
   *     wall) and the axial position (the flat end caps).
   *
   *   { type: 'box', minX, maxX, minY, maxY, minZ, maxZ, margin }
   *     L2's maze — clamps each axis independently against the hull/
   *     floor/ceiling bounds.
   *
   * Previously these were hardcoded module-level constants mirroring
   * L1's drum (WALL_RADIUS=31, AXIAL_HALF_LENGTH=10) and applied
   * unconditionally — harmless on L1, but silently wrong on L2: its
   * axial extent is ±32, not ±10, and its "radial" Y/Z bound doesn't
   * correspond to anything (L2's actual bounds are a floor/ceiling on Y
   * and walls on Z), so the camera had no real containment there at all.
   */
  setBounds(bounds) {
    this._bounds = bounds;
  }

  /**
   * Solid geometry the camera can't see through or pass through, as plain
   * { minX, maxX, minY, maxY, minZ, maxZ } boxes (L2's walls and deck slabs). Each frame the
   * camera is pulled in along its line to the player so it stops at the first one in the way
   * — the walls of the maze, and the deck slab when pitching up from the ground floor.
   * Pass null to disable (L1: the drum has no interior geometry to hide behind).
   * setBounds() still applies on top as the outer hull limit.
   */
  setBlockers(boxes) {
    this._blockers = boxes && boxes.length > 0 ? boxes : null;
  }

  /**
   * Feeds raw Pointer Lock mouse deltas (InputManager) into the camera's
   * own look state. Call once per frame, before update().
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
   * The camera's current horizontal facing as a world-space angle, in the
   * convention FlatPhysicsController expects: atan2(x, z), 0 = world +Z.
   * Used to make flat-level movement (L2) camera-relative. this.yaw on its
   * own isn't this angle — it's an orbit offset relative to the player's
   * own basis.forward (see update() below), not an absolute world angle —
   * so this re-derives the actual direction the same way update() does,
   * minus pitch (vertical look shouldn't steer horizontal movement).
   * L1 doesn't need this: its own movement is relative to the player's own
   * facing, not the camera's, so physics-controller.js never reads it.
   */
  getWorldYaw(basis) {
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(basis.up, this.yaw);
    const direction = basis.forward.clone().applyQuaternion(yawQuat);
    return Math.atan2(direction.x, direction.z);
  }

  update(basis) {
    this.camera.up.copy(basis.up);

    // Camera distance: how far back + how far off the wall
    const baseOffset = basis.up.clone().multiplyScalar(9).add(basis.forward.clone().multiplyScalar(-9));

    // Orbit that offset by the mouse-look yaw/pitch, both expressed
    // relative to the player's own local axes (not world ones): yaw spins
    // around basis.up, pitch tilts around the resulting (already-yawed)
    // right axis, so it stays "up/down relative to the player" regardless
    // of where they are on the drum.
    const right = new THREE.Vector3().crossVectors(basis.forward, basis.up).normalize();
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(basis.up, this.yaw);
    const yawedRight = right.applyQuaternion(yawQuat);
    const pitchQuat = new THREE.Quaternion().setFromAxisAngle(yawedRight, this.pitch);
    const lookRotation = pitchQuat.multiply(yawQuat); // yaw first, then pitch

    const offset = baseOffset.applyQuaternion(lookRotation);

    const desiredPosition = basis.position.clone().add(offset);

    // Aim slightly ABOVE the player's base — less than before, just enough
    // to center the body, not overshoot past the head.
    const lookTarget = basis.position.clone().add(basis.up.clone().multiplyScalar(HEAD_HEIGHT));

    this._pullInFromBlockers(lookTarget, desiredPosition);

    // Flagged by Yannis during Alpha: the offset above can occasionally
    // push the camera outside the level's hull. Clamp position only —
    // basis.up / lookAt (orientation) stay untouched — using whichever
    // shape setBounds() configured for the current level.
    this._clampToBounds(desiredPosition);

    this.camera.position.copy(desiredPosition);
    this.camera.lookAt(lookTarget);
  }

  /**
   * Shortens the line from `head` (the player) to `position` (where the camera wants to be) so
   * it ends at the first blocker in the way, kept BLOCKER_PADDING off the surface. Mutates
   * `position` in place. A blocker the head already sits inside (the player pressed against a
   * wall) is tested at its true size instead of the padded one, so the camera still can't
   * pass through the wall right behind them.
   */
  _pullInFromBlockers(head, position) {
    const blockers = this._blockers;
    if (!blockers) return;

    rayOrigin.copy(head);
    rayDirection.subVectors(position, head);
    const length = rayDirection.length();
    if (length < 1e-6) return;
    rayDirection.divideScalar(length);

    let nearest = length;
    for (const box of blockers) {
      let t = rayEntersBox(rayOrigin, rayDirection, box, BLOCKER_PADDING);
      if (t === -1) t = rayEntersBox(rayOrigin, rayDirection, box, 0);
      if (t >= 0 && t < nearest) nearest = t;
    }

    if (nearest < length) {
      position.copy(rayOrigin).addScaledVector(rayDirection, nearest);
    }
  }

  /** Mutates `position` in place to stay inside this._bounds, if set. */
  _clampToBounds(position) {
    const b = this._bounds;
    if (!b) return;

    if (b.type === 'cylinder') {
      const radialDist = Math.hypot(position.y, position.z);
      const maxRadius = b.radius - b.margin;
      if (radialDist > maxRadius) {
        const scale = maxRadius / radialDist;
        position.y *= scale;
        position.z *= scale;
      }
      const maxAxial = b.axialHalfLength - b.margin;
      position.x = THREE.MathUtils.clamp(position.x, -maxAxial, maxAxial);
    } else if (b.type === 'box') {
      position.x = THREE.MathUtils.clamp(position.x, b.minX + b.margin, b.maxX - b.margin);
      position.y = THREE.MathUtils.clamp(position.y, b.minY + b.margin, b.maxY - b.margin);
      position.z = THREE.MathUtils.clamp(position.z, b.minZ + b.margin, b.maxZ - b.margin);
    }
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
