// level3-docking-corridor.js
// Layer 3 blockout — Docking Corridor.
// Scaffolding: empty level group with the same interface as L1/L2.
// Yannis fills in geometry; Alex wires gravity-flip + debris triggers.

import * as THREE from 'three';

/**
 * @returns {{ group: THREE.Group, dispose: () => void, update: (delta: number) => void }}
 */
export function createLevel3() {
  const level3Group = new THREE.Group();
  level3Group.name = 'level-3';

  // TODO (Yannis): blockout geometry — collapsing corridor, hull-breach zones,
  // escape pod visible as the objective.

  function dispose() {
    level3Group.traverse((obj) => {
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
    // TODO: advance dissolve shader uniforms, debris triggers, etc.
  }

  return { group: level3Group, dispose, update };
}
