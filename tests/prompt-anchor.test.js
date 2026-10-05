import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { projectToWindow, worldAnchorOf, EDGE_MARGIN } from '../src/ui/prompt-anchor.js';

function camera() {
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 100);
  cam.position.set(0, 0, 10);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  return cam;
}

describe('projectToWindow', () => {
  it('puts a point straight ahead in the middle of the window', () => {
    expect(projectToWindow(new THREE.Vector3(0, 0, 0), camera(), 1600, 900)).toEqual({
      x: 800,
      y: 450,
    });
  });

  it('returns null behind the camera', () => {
    expect(projectToWindow(new THREE.Vector3(0, 0, 20), camera(), 1600, 900)).toBeNull();
  });

  it('clamps off-screen points to the margins', () => {
    const p = projectToWindow(new THREE.Vector3(500, -500, 0), camera(), 1600, 900);
    expect(p).toEqual({ x: 1600 - EDGE_MARGIN.x, y: 900 - EDGE_MARGIN.bottom });
  });
});

describe('worldAnchorOf', () => {
  it('uses the bounding-box centre, or a custom anchor', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    mesh.position.set(3, 1, 0);
    mesh.updateMatrixWorld();
    expect(worldAnchorOf(mesh).toArray()).toEqual([3, 1, 0]);

    mesh.userData.promptAnchor = new THREE.Vector3(0, 5, 0);
    expect(worldAnchorOf(mesh).toArray()).toEqual([0, 5, 0]);
  });

  it('returns null for an empty object', () => {
    expect(worldAnchorOf(new THREE.Group())).toBeNull();
  });
});
