// src/ui/asset-progress.js
//
// Real loading progress for the loading screen, read from Three's shared LoadingManager.
// GLTFLoader / TextureLoader instances created without their own manager (as in
// core/AssetLoader.js) report to THREE.DefaultLoadingManager, so anything loaded through them
// is counted here without touching the loader code.
//
// Install it BEFORE the level / player are created so their loads are tracked from the start.

import * as THREE from 'three';

/**
 * @param {THREE.LoadingManager} [manager]
 * @returns {{ getProgress: () => number, isDone: () => boolean }} progress is 0..1
 */
export function trackAssetProgress(manager = THREE.DefaultLoadingManager) {
  let loaded = 0;
  let total = 0;
  let loading = false;

  // Chain rather than replace, in case something else already listens.
  const { onStart, onProgress, onLoad } = manager;

  manager.onStart = (url, itemsLoaded, itemsTotal) => {
    loading = true;
    loaded = itemsLoaded;
    total = itemsTotal;
    onStart?.(url, itemsLoaded, itemsTotal);
  };
  manager.onProgress = (url, itemsLoaded, itemsTotal) => {
    loaded = itemsLoaded;
    total = itemsTotal;
    onProgress?.(url, itemsLoaded, itemsTotal);
  };
  // Loaders call itemEnd() after a failed request too, so onLoad still fires and the loading
  // screen cannot hang on a missing asset.
  manager.onLoad = () => {
    loading = false;
    loaded = total;
    onLoad?.();
  };

  return {
    getProgress: () => (total === 0 ? 1 : Math.min(1, loaded / total)),
    isDone: () => !loading,
  };
}
