import * as THREE from 'three';

const DEFAULT_EXPOSURE = 1.3;

// ?exposure=1.6 overrides the default for quick brightness comparisons.
function readExposure() {
  const raw = new window.URLSearchParams(window.location.search).get('exposure');
  const value = parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_EXPOSURE;
}

export class RendererSetup {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
    });

    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = readExposure();

    this.renderer.setSize(window.innerWidth, window.innerHeight);

    document.body.appendChild(this.renderer.domElement);
  }

  getRenderer() {
    return this.renderer;
  }

  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
