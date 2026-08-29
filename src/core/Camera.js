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

        const offset = basis.up.clone().multiplyScalar(8)
            .add(basis.forward.clone().multiplyScalar(-10));

        const desiredPosition = basis.position.clone().add(offset);
        this.camera.position.copy(desiredPosition);
        this.camera.lookAt(basis.position);
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }
}