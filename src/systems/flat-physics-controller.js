// flat-physics-controller.js
// Layer 2 "Base movement" — the Engineering Core is a flat two-storey maze
// (grid-data.js/maze-builder.js), not the L1 drum, so this is new code
// rather than an extension of physics-controller.js. World Y is always
// "up" here; no surface-basis trig is needed the way the drum needs it.
//
// Collision contract consumed (see maze-builder.js's header comment):
//   collisionData.wallAABBs    solid boxes { minX..maxZ, name }
//   collisionData.railAABBs    atrium railings (solid, full height of deck)
//   collisionData.rampSurfaces walkable slopes { minX, maxX, minZ, maxZ, lowSide }
//   collisionData.floorSpec    { groundY, deckY, cellSize, hall }
//   collisionData.pocketBounds zero-g pocket AABB, or null — see below
//
// Exposes the same player.userData.getSurfaceBasis() shape the L1 drum
// controller does — { position, up, forward } — so Camera.js and any other
// code reading that interface doesn't need level-specific branching. `up`
// is always THREE's world-up (0,1,0) here, never rotated.
//
// Zero-g pocket (design doc: "low-g + contained zero-g pockets"): while the
// player's position is inside collisionData.pocketBounds, movement switches
// from grounded walk/jump/gravity to full 3D free-float (thrust + damping +
// soft containment). A randomized "gravity snap-back" timer runs while
// floating; when it fires, the player is forcibly ejected (knockback +
// brief stun) and falls under normal gravity, taking fall damage on
// landing if they hit hard enough. This file owns the physics and exposes
// plain state (player.userData.zeroG = { inPocket, timeUntilSnap, isWarning })
// for someone else's code to drive an actual visual/audio telegraph later —
// no flicker/light/sound is built here, by design.

import * as THREE from 'three';
import { crossfadeAction } from '../core/AssetLoader.js';

const LINEAR_SPEED = 6; // units/sec — matches L1's base walking speed
const RUN_MULTIPLIER = 2; // matches physics-controller.js's running multiplier
const TURN_SPEED = 4; // radians/sec the facing is allowed to turn toward input

const JUMP_SPEED = 8;
const GRAVITY = 8;

// Player capsule footprint, used for the swept-AABB collision check against
// wallAABBs/railAABBs. Half-extents in X/Z; full height in Y.
const PLAYER_RADIUS = 0.4;
const PLAYER_HEIGHT = 1.6;

// ---------------------------------------------------------------------------
// Zero-g pocket tuning — all "tune once playable" starting values.
// ---------------------------------------------------------------------------

const FLOAT_THRUST = 14; // units/sec^2 of acceleration from input while floating
const FLOAT_DAMPING = 1.5; // per-second exponential velocity decay, so drift settles
const FLOAT_CONTAINMENT_MARGIN = 2; // units from a pocket edge where soft push-back starts
const FLOAT_CONTAINMENT_ACCEL = 20; // units/sec^2 push-back accel at the edge (scales with depth into the margin)

const SNAP_INTERVAL_MIN = 6; // seconds — shortest possible time-to-snap, randomized each float
const SNAP_INTERVAL_MAX = 14; // seconds — longest possible time-to-snap
const SNAP_WARNING_DURATION = 2; // seconds before the snap where isWarning reads true
const SNAP_KNOCKBACK_SPEED = 6; // units/sec downward velocity applied the instant the snap fires
const SNAP_STUN_DURATION = 0.6; // seconds of ignored/dampened movement input right after a snap

const FALL_DAMAGE_MIN_SPEED = 8; // units/sec impact speed below which a snap-back landing is harmless
const FALL_DAMAGE_PER_SPEED = 3; // HP per unit/sec of impact speed above the threshold

export class FlatPhysicsController {
  /**
   * @param {THREE.Object3D} playerGroup - outer THREE.Group wrapping the
   *   loaded astronaut GLTF (same convention as PlayerController: keep the
   *   GLTF at local origin inside it, drive this group's transform instead).
   * @param {{wallAABBs:object[], railAABBs:object[], rampSurfaces:object[], floorSpec:object}} collisionData
   */
  constructor(playerGroup, collisionData) {
    this.player = playerGroup;
    this.collisionData = collisionData ?? { wallAABBs: [], railAABBs: [], rampSurfaces: [], pocketBounds: null, floorSpec: { groundY: 0, deckY: 8 } };

    // Player state = a free 3D world position (unlike the drum's two
    // scalars) + a facing yaw angle, since the floor here really is flat.
    this.position = new THREE.Vector3(0, this.collisionData.floorSpec.groundY, 0);
    this.facingYaw = 0; // radians, world-space (0 = looking down +Z)

    this._basis = {
      position: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      forward: new THREE.Vector3(0, 0, 1),
    };

    this.isRunning = false; // read by the oxygen system

    this.jumpVelocity = 0;
    this.isGrounded = true;

    // Zero-g pocket state — see the file header. floatVelocity is real
    // physics velocity (unlike grounded movement, which is instantaneous
    // position += speed*delta with no momentum); _snapTarget/_floatTime
    // drive the randomized snap-back timer.
    this.floatVelocity = new THREE.Vector3();
    this._inFreeFloat = false;
    this._freeFloatLocked = false; // true from a snap-back until the player lands — blocks re-entering mid-fall
    this._stunTimer = 0;
    this._floatTime = 0;
    this._snapTarget = 0;
    this._fallDamageArmed = false; // only snap-back-triggered falls deal fall damage
    this._pendingFallDamage = 0;

    this.player.userData.getSurfaceBasis = () => this._basis;
    this.player.userData.consumeFallDamage = () => this.consumeFallDamage();
    this.player.userData.zeroG = { inPocket: false, timeUntilSnap: null, isWarning: false };
  }

  /**
   * Places the controller at a spawn point without any collision resolution
   * or smoothing — used once, at level start. y is the floor height for
   * whichever storey the spawn point sits on (see grid-data.js storeyFloorY).
   */
  setSpawn(x, y, z, yaw = 0) {
    this.position.set(x, y, z);
    this.facingYaw = yaw;
    this.jumpVelocity = 0;
    this.isGrounded = true;
    this.floatVelocity.set(0, 0, 0);
    this._inFreeFloat = false;
    this._freeFloatLocked = false;
    this._stunTimer = 0;
    this._fallDamageArmed = false;
    this._pendingFallDamage = 0;
    this._syncBasis();
    this._syncZeroGUserData();
  }

  /**
   * One-shot fall-damage event — non-zero only on the frame a snap-back-
   * triggered fall lands hard enough to hurt (see FALL_DAMAGE_MIN_SPEED).
   * Cleared after being read, so callers can safely poll every frame.
   * @returns {number} pending fall damage (0 if none)
   */
  consumeFallDamage() {
    const dmg = this._pendingFallDamage;
    this._pendingFallDamage = 0;
    return dmg;
  }

  /**
   * @param {number} delta - seconds since last frame
   * @param {{axialAxis:number, tangentAxis:number, running:boolean, jump:boolean, cameraYaw?:number}} input
   *   axialAxis: -1..1 from S/W, tangentAxis: -1..1 from A/D (same encoding
   *   InputManager already produces for L1: W -> axialAxis -1, S -> +1).
   *   cameraYaw: optional override (radians). Nothing currently supplies
   *   it — Camera.js's mouse-look yaw/pitch is separate orbit state that
   *   isn't fed in here — so in practice this always falls back to
   *   this.facingYaw, making movement relative to the player's own
   *   persistent facing rather than an actual camera reading.
   */
  update(delta, input) {
    const { axialAxis = 0, tangentAxis = 0, running = false, jump = false, vertical = 0 } = input;
    this.isRunning = running;
    const speed = running ? LINEAR_SPEED * RUN_MULTIPLIER : LINEAR_SPEED;
    const cameraYaw = input.cameraYaw ?? this.facingYaw;

    // W/S (axialAxis) is forward/back, A/D (tangentAxis) is strafe. Both are
    // resolved against `cameraYaw` below, which in practice always equals
    // this.facingYaw: `input.cameraYaw` is never supplied anywhere in this
    // codebase (checked — no InputManager field, nothing set in main.js),
    // and Camera.js's own mouse-look yaw/pitch is independent orbit state
    // that's never fed into this controller. So "camera-relative" here
    // really means "relative to the player's own persistent facing," same
    // role as L1's facing2D, not a literal read of the camera.
    //
    // W/S and A/D are each negated relative to the raw axis values
    // (InputManager.js: W -> axialAxis -1, S -> axialAxis +1, D ->
    // tangentAxis +1, A -> tangentAxis -1) per direct user report that both
    // pairs were inverted on screen — this swaps W<->S and A<->D at the
    // input-consumption point rather than touching InputManager.js itself.
    const fwdInput = -axialAxis;
    const strafeInput = -tangentAxis;

    const sinYaw = Math.sin(cameraYaw);
    const cosYaw = Math.cos(cameraYaw);
    let moveX = sinYaw * fwdInput + cosYaw * strafeInput;
    let moveZ = cosYaw * fwdInput - sinYaw * strafeInput;
    const moveLen = Math.hypot(moveX, moveZ);

    if (moveLen > 0.0001) {
      moveX /= moveLen;
      moveZ /= moveLen;

      // Only turn facingYaw toward movement that's "forward-ish", same
      // reasoning as L1's facing2D: turning to face a target that's
      // ~180°/90° away from current facing never converges, it just spins.
      //
      // With fwdInput/strafeInput now negated above, pure W dots to exactly
      // +1 against the facing vector (sin(facingYaw), cos(facingYaw)) and
      // pure S to exactly -1 — W is aligned (walks face-first), S is
      // anti-aligned (backpedals), for any facingYaw. So the gate triggers
      // on forwardDot > 0: W-diagonals (dot > 0, strafe != 0) turn the body
      // toward the movement direction; pure W (strafe == 0) is excluded even
      // though already aligned (no-op anyway); pure S and S-diagonals
      // (dot <= 0) never turn, matching third-person backpedal convention.
      const facingX = Math.sin(this.facingYaw);
      const facingZ = Math.cos(this.facingYaw);
      const forwardDot = moveX * facingX + moveZ * facingZ;
      if (forwardDot > 0 && strafeInput !== 0) {
        this._turnToward(moveX, moveZ, delta);
      }
    } else {
      moveX = 0;
      moveZ = 0;
    }

    // A snap-back briefly ignores/dampens movement input (the stun), but
    // gravity/falling still happens underneath it — see _triggerSnapBack().
    if (this._stunTimer > 0) {
      this._stunTimer = Math.max(0, this._stunTimer - delta);
    }
    const inputLive = this._stunTimer <= 0;

    // _freeFloatLocked keeps a snap-back fall fully grounded-physics (so it
    // actually falls to the floor) even though the pocket's Y range spans
    // the whole shaft and the player is still geometrically inside it while
    // falling — cleared on landing (_moveWithCollision).
    const inPocket = !this._freeFloatLocked && this._isInPocket();

    if (inPocket) {
      if (!this._inFreeFloat) this._enterFreeFloat();
      this._updateFreeFloat(
        delta,
        inputLive ? moveX : 0,
        inputLive ? moveZ : 0,
        inputLive ? vertical : 0
      );
    } else {
      if (this._inFreeFloat) this._exitFreeFloat();
      this._updateGrounded(delta, inputLive ? moveX : 0, inputLive ? moveZ : 0, speed, jump && inputLive);
    }

    this._syncBasis();
    this._syncZeroGUserData();

    // Animation state purely from input magnitude + running — same rule as
    // physics-controller.js's L1 switch, applied here regardless of
    // grounded vs. zero-g float so thrust input animates too. Airborne under
    // normal grounded-physics gravity (jump arc or a snap-back fall) plays
    // one of the two jump clips instead — "jump" (moving) or "jump1"
    // (standing still) — but NOT while actually free-floating in a pocket,
    // since drifting isn't a jump and has no "grounded" to be false against.
    const inputMagnitude = Math.hypot(axialAxis, tangentAxis);
    const isMoving = inputMagnitude > 0.0001;
    const animState = !this.isGrounded && !this._inFreeFloat
      ? (isMoving ? 'jump' : 'jump1')
      : isMoving
        ? (this.isRunning ? 'run' : 'walk')
        : 'idle';
    crossfadeAction(this.player, animState);
  }

  _turnToward(moveX, moveZ, delta) {
    const targetAngle = Math.atan2(moveX, moveZ);
    let angleDiff = targetAngle - this.facingYaw;
    angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff)); // wrap to [-PI, PI]
    const maxStep = TURN_SPEED * delta;
    const step = THREE.MathUtils.clamp(angleDiff, -maxStep, maxStep);
    this.facingYaw += step;
  }

  /** Grounded walk/jump/gravity — unchanged from before the zero-g pocket existed. */
  _updateGrounded(delta, moveX, moveZ, speed, jumpPressed) {
    // Jump arc — same launch-velocity/gravity pattern as physics-controller.js,
    // but against a fixed world floor height instead of a computed radius.
    if (jumpPressed && this.isGrounded) {
      this.jumpVelocity = JUMP_SPEED;
      this.isGrounded = false;
    }
    this.jumpVelocity -= GRAVITY * delta;

    const deltaX = moveX * speed * delta;
    const deltaZ = moveZ * speed * delta;
    const deltaY = this.jumpVelocity * delta;

    this._moveWithCollision(deltaX, deltaY, deltaZ);
  }

  /** @returns {boolean} true if the player's position is inside collisionData.pocketBounds */
  _isInPocket() {
    const b = this.collisionData.pocketBounds;
    if (!b) return false;
    const { x, y, z } = this.position;
    return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY && z >= b.minZ && z <= b.maxZ;
  }

  /** Seeds float velocity from whatever vertical speed the player entered with, so the
   * transition from a jump/fall into the pocket doesn't feel like a sudden stop. */
  _enterFreeFloat() {
    this._inFreeFloat = true;
    this.floatVelocity.set(0, this.jumpVelocity, 0);
    this._floatTime = 0;
    this._snapTarget = SNAP_INTERVAL_MIN + Math.random() * (SNAP_INTERVAL_MAX - SNAP_INTERVAL_MIN);
  }

  /** Organic exit (flew/drifted out) — a snap-back exits via _triggerSnapBack() instead. */
  _exitFreeFloat() {
    this._inFreeFloat = false;
    // Grounded movement has no momentum, so there's nothing to carry over
    // horizontally; keep the vertical speed so falling back out the bottom
    // continues smoothly into normal gravity instead of snapping to zero.
    this.jumpVelocity = this.floatVelocity.y;
    this.floatVelocity.set(0, 0, 0);
  }

  /** Thrust + damping + soft containment, then integrate position directly (true 3D movement). */
  _updateFreeFloat(delta, moveX, moveZ, vertical) {
    this._floatTime += delta;
    if (this._floatTime >= this._snapTarget) {
      this._triggerSnapBack();
      return;
    }

    this.floatVelocity.x += moveX * FLOAT_THRUST * delta;
    this.floatVelocity.z += moveZ * FLOAT_THRUST * delta;
    this.floatVelocity.y += vertical * FLOAT_THRUST * delta;

    // Exponential damping so drift settles instead of continuing forever.
    this.floatVelocity.multiplyScalar(Math.exp(-FLOAT_DAMPING * delta));

    this._applyContainment(delta);

    this.position.addScaledVector(this.floatVelocity, delta);
  }

  /**
   * Soft containment: within FLOAT_CONTAINMENT_MARGIN of a pocket edge,
   * nudges velocity back toward the centre, scaling with how far into the
   * margin the player is — a spring, not a hard clip, so it doesn't feel
   * like hitting a wall.
   */
  _applyContainment(delta) {
    const b = this.collisionData.pocketBounds;
    if (!b) return;

    const axisPush = (pos, min, max) => {
      const intoMin = min + FLOAT_CONTAINMENT_MARGIN - pos; // > 0 once inside the margin near the min edge
      if (intoMin > 0) return FLOAT_CONTAINMENT_ACCEL * (intoMin / FLOAT_CONTAINMENT_MARGIN);
      const intoMax = pos - (max - FLOAT_CONTAINMENT_MARGIN); // > 0 once inside the margin near the max edge
      if (intoMax > 0) return -FLOAT_CONTAINMENT_ACCEL * (intoMax / FLOAT_CONTAINMENT_MARGIN);
      return 0;
    };

    this.floatVelocity.x += axisPush(this.position.x, b.minX, b.maxX) * delta;
    this.floatVelocity.y += axisPush(this.position.y, b.minY, b.maxY) * delta;
    this.floatVelocity.z += axisPush(this.position.z, b.minZ, b.maxZ) * delta;
  }

  /**
   * Fires when the snap-back timer runs out: ejects the player from
   * free-float with a downward knockback and a brief stun, then leaves
   * normal grounded gravity (_updateGrounded/_moveWithCollision) to carry
   * them the rest of the way down. Arms fall damage for that landing.
   */
  _triggerSnapBack() {
    this._inFreeFloat = false;
    this._freeFloatLocked = true; // cleared on landing, in _moveWithCollision
    this._fallDamageArmed = true;
    this._stunTimer = SNAP_STUN_DURATION;
    this.jumpVelocity = -SNAP_KNOCKBACK_SPEED;
    this.floatVelocity.set(0, 0, 0);
    this.isGrounded = false;
  }

  _syncZeroGUserData() {
    const timeUntilSnap = this._inFreeFloat ? Math.max(0, this._snapTarget - this._floatTime) : null;
    this.player.userData.zeroG = {
      inPocket: this._inFreeFloat,
      timeUntilSnap,
      isWarning: this._inFreeFloat && timeUntilSnap <= SNAP_WARNING_DURATION,
    };
  }

  /**
   * Sweeps the player's AABB against wallAABBs/railAABBs one axis at a time
   * (X, then Z, then Y), clamping whichever axis would penetrate a solid
   * rather than blocking the whole move — slide-along-wall behaviour.
   * Y is resolved against ramp surfaces / floor height, not swept as a wall.
   */
  _moveWithCollision(deltaX, deltaY, deltaZ) {
    const solids = [...this.collisionData.wallAABBs, ...this.collisionData.railAABBs];

    // X axis
    if (deltaX !== 0) {
      const next = this.position.x + deltaX;
      if (!this._collidesAt(next, this.position.y, this.position.z, solids)) {
        this.position.x = next;
      }
    }

    // Z axis
    if (deltaZ !== 0) {
      const next = this.position.z + deltaZ;
      if (!this._collidesAt(this.position.x, this.position.y, next, solids)) {
        this.position.z = next;
      }
    }

    // Y axis — ramps first (they define the walking surface underfoot),
    // then fall back to the storey floor height. Jump/gravity move freely
    // above the resolved floor.
    const floorY = this._floorHeightAt(this.position.x, this.position.z);
    const nextY = this.position.y + deltaY;
    if (nextY <= floorY) {
      const impactSpeed = Math.abs(this.jumpVelocity); // before reset — fall speed at the moment of landing
      const wasAirborne = !this.isGrounded;

      this.position.y = floorY;
      this.jumpVelocity = 0;
      this.isGrounded = true;
      this._freeFloatLocked = false; // landed — free to re-enter the pocket again

      if (wasAirborne && this._fallDamageArmed) {
        this._fallDamageArmed = false;
        const over = impactSpeed - FALL_DAMAGE_MIN_SPEED;
        if (over > 0) this._pendingFallDamage += over * FALL_DAMAGE_PER_SPEED;
      }
    } else {
      this.position.y = nextY;
      this.isGrounded = false;
    }
  }

  /** True if a PLAYER_RADIUS/PLAYER_HEIGHT box centred at (x,y,z) overlaps any solid. */
  _collidesAt(x, y, z, solids) {
    const minX = x - PLAYER_RADIUS;
    const maxX = x + PLAYER_RADIUS;
    const minY = y;
    const maxY = y + PLAYER_HEIGHT;
    const minZ = z - PLAYER_RADIUS;
    const maxZ = z + PLAYER_RADIUS;

    for (const box of solids) {
      if (
        minX < box.maxX &&
        maxX > box.minX &&
        minY < box.maxY &&
        maxY > box.minY &&
        minZ < box.maxZ &&
        maxZ > box.minZ
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Resolves the walking-surface height under (x, z): a ramp slope if the
   * point sits inside a ramp footprint, otherwise the storey floor (ground
   * or deck) implied by floorSpec — chosen by whichever is closer to the
   * player's current Y, so standing near a ramp mouth doesn't snap the
   * player through the deck above/below.
   */
  _floorHeightAt(x, z) {
    const { groundY, deckY } = this.collisionData.floorSpec;
    for (const ramp of this.collisionData.rampSurfaces) {
      if (x >= ramp.minX && x <= ramp.maxX && z >= ramp.minZ && z <= ramp.maxZ) {
        return this._rampHeightAt(ramp, x, z);
      }
    }
    // The zero-g pocket's footprint has no deck slab at all (that's what
    // makes it a void) — resolve straight to the ground floor there instead
    // of the "whichever is closer" heuristic below, which would otherwise
    // treat the open air at deck height as if it were walkable and strand a
    // falling player on phantom flooring over the void. This only matters
    // once something (the snap-back) can actually put a grounded-physics
    // fall inside that footprint — previously unreachable.
    const pocket = this.collisionData.pocketBounds;
    if (pocket && x >= pocket.minX && x <= pocket.maxX && z >= pocket.minZ && z <= pocket.maxZ) {
      return groundY;
    }
    // No ramp underfoot — pick whichever storey floor is closer to where
    // the player already is, so ground-level and deck-level cells (which
    // overlap in X/Z but not Y) don't fight each other.
    return Math.abs(this.position.y - deckY) < Math.abs(this.position.y - groundY) ? deckY : groundY;
  }

  /** Linear interpolation of height across a ramp footprint, low edge -> deck edge. */
  _rampHeightAt(ramp, x, z) {
    const { deckY } = this.collisionData.floorSpec;
    let t;
    switch (ramp.lowSide) {
      case 'S':
        t = (ramp.maxZ - z) / (ramp.maxZ - ramp.minZ); // low at south (+Z), rises north
        break;
      case 'N':
        t = (z - ramp.minZ) / (ramp.maxZ - ramp.minZ); // low at north (-Z), rises south
        break;
      case 'E':
        t = (ramp.maxX - x) / (ramp.maxX - ramp.minX); // low at east (+X), rises west
        break;
      case 'W':
      default:
        t = (x - ramp.minX) / (ramp.maxX - ramp.minX); // low at west (-X), rises east
        break;
    }
    return THREE.MathUtils.clamp(t, 0, 1) * deckY;
  }

  _syncBasis() {
    // The player MESH's own quaternion needs a +pi correction: confirmed by
    // an independent top-down screenshot that the loaded astronaut model's
    // actual visible front is offset by pi from the raw
    // (sin(facingYaw), cos(facingYaw)) formula (see AssetLoader.js's
    // `model.rotation.y = Math.PI` on the inner GLTF — a correction for the
    // mesh's own authored orientation that this formula doesn't account for
    // on its own). This offset is strictly cosmetic, for the body mesh only.
    //
    // The camera basis is NOT part of this correction — Camera.js drives the
    // chase-cam's position offset and mouse-look right-vector directly off
    // basis.forward (see Camera.js update()), so it must keep using the raw,
    // un-rotated facing vector. Applying the mesh's visual offset there too
    // would silently rotate the camera along with the body-orientation fix,
    // which is a separate concern this correction must not touch.
    const visualYaw = this.facingYaw + Math.PI;
    const forward = new THREE.Vector3(Math.sin(this.facingYaw), 0, Math.cos(this.facingYaw));
    this.player.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), visualYaw);
    this.player.position.copy(this.position);

    this._basis.position.copy(this.position);
    this._basis.up.set(0, 1, 0);
    this._basis.forward.copy(forward);
  }
}
