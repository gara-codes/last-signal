import * as THREE from 'three';

// Drum geometry — mirrors level1-habitation-ring.js / physics-controller.js.
// Used only to keep the camera from rendering outside the hull; if Yannis
// changes drum size, update this alongside those two copies.
const WALL_RADIUS = 31;
const WALL_MARGIN = 1.5; // minimum clearance kept between camera and the curved wall

// The drum is a closed cylinder (flat end caps), spanning x: -10..10 —
// mirrors physics-controller.js's HEIGHT_HALF. AXIAL_CLAMP there keeps the
// player within ±9, but the camera's own axial offset (-9 * facing.x) can
// still add up to another 9 units on top of that — e.g. walking to one end
// of the corridor and turning around pushes facing.x negative while axial
// is still near +9, sending the camera straight through the end cap.
const AXIAL_HALF_LENGTH = 10;
const AXIAL_MARGIN = 1.5;

export class Camera {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
  }

  getCamera() {
    return this.camera;
  }

  update(basis) {
    this.camera.up.copy(basis.up);

    // Camera distance: how far back + how far off the wall
    const offset = basis.up.clone().multiplyScalar(9).add(basis.forward.clone().multiplyScalar(-9));

    const desiredPosition = basis.position.clone().add(offset);

    // Flagged by Yannis during Alpha: the offset above can occasionally
    // push the camera's radial distance from the drum's central (X) axis
    // past the hull wall, rendering from outside it. Clamp the radial
    // component back to a safe radius before assigning to camera.position
    // — position only, so basis.up / lookAt (orientation) stay untouched.
    const radialDist = Math.hypot(desiredPosition.y, desiredPosition.z);
    const maxRadius = WALL_RADIUS - WALL_MARGIN;
    if (radialDist > maxRadius) {
      const scale = maxRadius / radialDist;
      desiredPosition.y *= scale;
      desiredPosition.z *= scale;
    }

    // Same idea along the drum's length, against the flat end caps.
    const maxAxial = AXIAL_HALF_LENGTH - AXIAL_MARGIN;
    desiredPosition.x = THREE.MathUtils.clamp(desiredPosition.x, -maxAxial, maxAxial);

    this.camera.position.copy(desiredPosition);

    // Aim slightly ABOVE the player's base — less than before, just enough
    // to center the body, not overshoot past the head.
    const lookTarget = basis.position.clone().add(basis.up.clone().multiplyScalar(4));
    this.camera.lookAt(lookTarget);
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
