import * as THREE from 'three';

export class Camera {
    constructor() {
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000,
        );
    }

    getCamera() {
        return this.camera;
    }

update(basis) {
    this.camera.up.copy(basis.up);

    // Camera distance: how far back + how far off the wall
    const offset = basis.up.clone().multiplyScalar(9)
        .add(basis.forward.clone().multiplyScalar(-9));

    const desiredPosition = basis.position.clone().add(offset);
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