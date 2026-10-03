// src/ui/prompt-anchor.js
//
// Locks the interaction prompt onto its object: world position -> window pixels through the
// game camera. hud.js calls this once a frame from syncInteractPrompt(), after the camera has
// moved, so the brackets never trail the object by a frame. Tested in tests/prompt-anchor.test.js.

import * as THREE from 'three';

// Keep the brackets and the label under them fully on screen (window px).
export const EDGE_MARGIN = Object.freeze({ x: 80, top: 40, bottom: 120 });

const scratchBox = new THREE.Box3();
const scratchPoint = new THREE.Vector3();
const scratchAnchor = new THREE.Vector3();

/**
 * Where the brackets should frame an object: its userData.promptAnchor (a world-space
 * THREE.Vector3, or a function returning one) if it has one, else the centre of its world
 * bounding box. Writes into `out` and returns it, or null if the object has no geometry yet.
 */
export function worldAnchorOf(object, out = new THREE.Vector3()) {
  const custom = object.userData?.promptAnchor;
  if (typeof custom === 'function') return out.copy(custom());
  if (custom?.isVector3) return out.copy(custom);
  scratchBox.setFromObject(object);
  if (scratchBox.isEmpty()) return null;
  return scratchBox.getCenter(out);
}

/**
 * worldAnchorOf + projectToWindow in one step (reuses scratch vectors): the window-px point the prompt
 * brackets should centre on, or null if the object is behind the camera or has no geometry.
 */
export function anchorOnScreen(object, camera, width, height) {
  const world = worldAnchorOf(object, scratchAnchor);
  return world ? projectToWindow(world, camera, width, height) : null;
}

/**
 * Project a world point to window pixels. Returns null when the point is behind the camera;
 * otherwise clamps it inside EDGE_MARGIN so a prompt for something just off-screen still shows
 * at the nearest edge.
 * @param {THREE.Vector3} world
 * @param {THREE.Camera} camera
 * @param {number} width   window width (px)
 * @param {number} height  window height (px)
 * @returns {{x:number, y:number}|null}
 */
export function projectToWindow(world, camera, width, height) {
  scratchPoint.copy(world).project(camera);
  // z outside [-1, 1] means behind the camera or past the far plane.
  if (scratchPoint.z < -1 || scratchPoint.z > 1) return null;
  const x = ((scratchPoint.x + 1) / 2) * width;
  const y = ((1 - scratchPoint.y) / 2) * height;
  return {
    x: Math.min(width - EDGE_MARGIN.x, Math.max(EDGE_MARGIN.x, x)),
    y: Math.min(height - EDGE_MARGIN.bottom, Math.max(EDGE_MARGIN.top, y)),
  };
}
