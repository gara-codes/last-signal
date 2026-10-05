// tests/level1-decor.test.js
//
// Geometry checks for the L1 visual pass: every wall prop stands inside
// the drum, out of the player's reach, clear of the pods/HAL/door/chamber,
// and upright on the deck. Runs DOM-free: decor.js skips its canvas
// textures when there is no `document`.

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createLevel1Decor,
  layoutEndWallProps,
  isExcluded,
  placeOnEndWall,
  DECK_RADIUS,
  MAX_PROP_DEPTH,
} from '../src/levels/level1/decor.js';

const RADIUS = 31;
const HALF_HEIGHT = 10;
const AXIAL_CLAMP = 9; // physics-controller.js

function wallProps() {
  const { group } = createLevel1Decor();
  group.updateMatrixWorld(true);
  return group.getObjectByName('l1-wall-props').children;
}

describe('L1 decor layout', () => {
  it('places props on both end caps', () => {
    const props = layoutEndWallProps();
    expect(props.some((p) => p.side === 1)).toBe(true);
    expect(props.some((p) => p.side === -1)).toBe(true);
    expect(wallProps()).toHaveLength(props.length);
  });

  it('keeps every prop footprint out of the exclusion ranges', () => {
    for (const p of layoutEndWallProps()) {
      expect(isExcluded(p.side, p.phi, p.width / 2 / DECK_RADIUS)).toBe(false);
    }
  });

  it('keeps every prop inside the drum and beyond the player clamp', () => {
    const box = new THREE.Box3();
    for (const prop of wallProps()) {
      box.setFromObject(prop);
      for (const corner of [box.min, box.max]) {
        expect(Math.abs(corner.y)).toBeLessThanOrEqual(HALF_HEIGHT + 1e-6);
      }
      // Each prop hugs one cap: its nearest face stays past the clamp
      const nearest = Math.min(Math.abs(box.min.y), Math.abs(box.max.y));
      expect(nearest).toBeGreaterThan(AXIAL_CLAMP);
      expect(HALF_HEIGHT - nearest).toBeLessThanOrEqual(MAX_PROP_DEPTH + 1e-6);

      // Every vertex stays inside the hull. A flat-bottomed prop on the
      // curved deck dips slightly into it at its ends (hidden, no gap).
      prop.traverse((obj) => {
        if (!obj.isMesh) return;
        const pos = obj.geometry.attributes.position;
        const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld);
          expect(Math.hypot(v.x, v.z)).toBeLessThan(RADIUS);
        }
      });
    }
  });
});

describe('placeOnEndWall', () => {
  it('stands +Y toward the axis and faces +Z into the room on both caps', () => {
    for (const side of [1, -1]) {
      for (const phi of [0, 1, Math.PI, 4.5]) {
        const obj = new THREE.Object3D();
        placeOnEndWall(obj, phi, side);
        obj.updateMatrixWorld(true);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(obj.quaternion);
        const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(obj.quaternion);
        expect(up.x).toBeCloseTo(-Math.cos(phi));
        expect(up.z).toBeCloseTo(-Math.sin(phi));
        expect(facing.y).toBeCloseTo(-side);
        expect(obj.position.y).toBe(side * HALF_HEIGHT);
        expect(Math.hypot(obj.position.x, obj.position.z)).toBeCloseTo(DECK_RADIUS);
      }
    }
  });
});
