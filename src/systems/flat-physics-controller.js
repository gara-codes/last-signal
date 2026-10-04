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
//
// Exposes the same player.userData.getSurfaceBasis() shape the L1 drum
// controller does — { position, up, forward } — so Camera.js and any other
// code reading that interface doesn't need level-specific branching. `up`
// is always THREE's world-up (0,1,0) here, never rotated.

import * as THREE from 'three';

const LINEAR_SPEED = 6; // units/sec — matches L1's base walking speed
const RUN_MULTIPLIER = 1.6; // matches physics-controller.js's running multiplier
const TURN_SPEED = 10; // radians/sec the facing is allowed to turn toward input

const JUMP_SPEED = 8;
const GRAVITY = 20;

// Player capsule footprint, used for the swept-AABB collision check against
// wallAABBs/railAABBs. Half-extents in X/Z; full height in Y.
// Scaled ×1.5 to match the revised blockout (CELL_SIZE 4 → 6).
const PLAYER_RADIUS = 0.6;
const PLAYER_HEIGHT = 2.7;

export class FlatPhysicsController {
  /**
   * @param {THREE.Object3D} playerGroup - outer THREE.Group wrapping the
   *   loaded astronaut GLTF (same convention as PlayerController: keep the
   *   GLTF at local origin inside it, drive this group's transform instead).
   * @param {{wallAABBs:object[], railAABBs:object[], rampSurfaces:object[], floorSpec:object}} collisionData
   */
  constructor(playerGroup, collisionData) {
    this.player = playerGroup;
    this.collisionData = collisionData ?? { wallAABBs: [], railAABBs: [], rampSurfaces: [], floorSpec: { groundY: 0, deckY: 8 } };

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

    this.player.userData.getSurfaceBasis = () => this._basis;
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
    this._syncBasis();
  }

  /**
   * @param {number} delta - seconds since last frame
   * @param {{axialAxis:number, tangentAxis:number, running:boolean, jump:boolean, cameraYaw?:number}} input
   *   axialAxis: -1..1 from S/W, tangentAxis: -1..1 from A/D (same encoding
   *   InputManager already produces for L1: W -> axialAxis -1, S -> +1).
   *   cameraYaw: the camera's current yaw (radians), used to make WASD
   *   camera-relative. Defaults to this.facingYaw when omitted, so the
   *   controller degrades gracefully if no camera is wired yet.
   */
  update(delta, input) {
    const { axialAxis = 0, tangentAxis = 0, running = false, jump = false } = input;
    this.isRunning = running;
    const speed = running ? LINEAR_SPEED * RUN_MULTIPLIER : LINEAR_SPEED;
    const cameraYaw = input.cameraYaw ?? this.facingYaw;

    // W/S (axialAxis) is forward/back, A/D (tangentAxis) is strafe — both
    // relative to the camera's yaw, same camera-relative approach as L1
    // but against a single world yaw instead of a developable-surface frame.
    const fwdInput = -axialAxis; // InputManager's W -> axialAxis -1 convention
    const strafeInput = tangentAxis;

    const sinYaw = Math.sin(cameraYaw);
    const cosYaw = Math.cos(cameraYaw);
    // Camera-space forward is (sin(yaw), cos(yaw)) in (x, z) for yaw=0 -> +Z;
    // right is forward rotated -90°.
    let moveX = sinYaw * fwdInput + cosYaw * strafeInput;
    let moveZ = cosYaw * fwdInput - sinYaw * strafeInput;
    const moveLen = Math.hypot(moveX, moveZ);

    if (moveLen > 0.0001) {
      moveX /= moveLen;
      moveZ /= moveLen;

      const targetAngle = Math.atan2(moveX, moveZ);
      let angleDiff = targetAngle - this.facingYaw;
      angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff)); // wrap to [-PI, PI]
      const maxStep = TURN_SPEED * delta;
      const step = THREE.MathUtils.clamp(angleDiff, -maxStep, maxStep);
      this.facingYaw += step;
    }

    // Jump arc — same launch-velocity/gravity pattern as physics-controller.js,
    // but against a fixed world floor height instead of a computed radius.
    if (jump && this.isGrounded) {
      this.jumpVelocity = JUMP_SPEED;
      this.isGrounded = false;
    }
    this.jumpVelocity -= GRAVITY * delta;

    const deltaX = moveX * speed * delta;
    const deltaZ = moveZ * speed * delta;
    const deltaY = this.jumpVelocity * delta;

    this._moveWithCollision(deltaX, deltaY, deltaZ);
    this._syncBasis();
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
      this.position.y = floorY;
      this.jumpVelocity = 0;
      this.isGrounded = true;
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
    const forward = new THREE.Vector3(Math.sin(this.facingYaw), 0, Math.cos(this.facingYaw));
    // + PI: the astronaut model's front faces the group's -Z (L1's lookAt-based
    // controller makes -Z the heading; AssetLoader rotates the model to match),
    // so without it the character walks facing away from its heading here.
    this.player.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.facingYaw + Math.PI);
    this.player.position.copy(this.position);

    this._basis.position.copy(this.position);
    this._basis.up.set(0, 1, 0);
    this._basis.forward.copy(forward);
  }
}
