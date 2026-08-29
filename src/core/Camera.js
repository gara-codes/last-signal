import * as THREE from 'three';

const WALK_RADIUS = 31 - 1.2; // RADIUS - 1.2, per the movement brief

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

    getSurfaceBasisStub(axial, theta) {
        const position = new THREE.Vector3(
            axial,
            WALK_RADIUS * Math.cos(theta),
            WALK_RADIUS * Math.sin(theta),
        );

        // "up" points INWARD, toward the drum's center axis — like standing
        // on the rim of the 2001 centrifuge with your head toward the hub.
        const up = new THREE.Vector3(0, -Math.cos(theta), -Math.sin(theta));

        const forward = new THREE.Vector3(0, -Math.sin(theta), Math.cos(theta));

        return { position, up, forward };
    }

    update(basis) {
        this.camera.up.copy(basis.up);

        // up is now inward, so a positive scalar pulls the camera away from
        // the wall toward the center — correct direction for clearance.
       const offset = basis.up.clone().multiplyScalar(8)
            .add(basis.forward.clone().multiplyScalar(-7));

        const desiredPosition = basis.position.clone().add(offset);
        this.camera.position.copy(desiredPosition);
        this.camera.lookAt(basis.position);
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }
}