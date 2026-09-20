// level2-engineering-core.js
// Layer 2 blockout — Engineering Core.
// Scaffolding: empty level group with the same interface as L1.
// Yannis fills in geometry; Alex wires oxygen/gravity/repair systems.

import * as THREE from 'three';

/**
 * @returns {{ group: THREE.Group, dispose: () => void, update: (delta: number) => void }}
 */
export function createLevel2() {
  const level2Group = new THREE.Group();
  level2Group.name = 'level-2';

  // TODO (Yannis): blockout geometry — environment, command-center door,
  // backtrack path, repair terminals, resource management area.

  function dispose() {
    level2Group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((mat) => mat.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }

  function update(_delta) {
    // TODO: advance shader uniforms, door animations, etc.
  }

  return { group: level2Group, dispose, update };
}
