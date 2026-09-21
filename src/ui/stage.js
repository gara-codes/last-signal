// src/ui/stage.js
//
// Every screen is authored against the mockup's 1600x900 frame. This keeps --ui-scale (read by
// .ui-stage in ui.css) at "how many times bigger than 1600x900 fits in the window", so a screen
// looks the same at 1366x768, 1920x1080 or a 4K monitor. Wider/taller windows letterbox the
// content while the backdrop still fills the whole viewport.

export const DESIGN_WIDTH = 1600;
export const DESIGN_HEIGHT = 900;

export function computeScale(width, height) {
  return Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
}

export function installStageScaling() {
  function update() {
    const scale = computeScale(window.innerWidth, window.innerHeight);
    document.documentElement.style.setProperty('--ui-scale', String(scale));
  }
  update();
  window.addEventListener('resize', update);
  return () => window.removeEventListener('resize', update);
}
