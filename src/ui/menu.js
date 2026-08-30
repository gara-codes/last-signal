import { initCreditsButton } from './credits.js';
import './credits.css';

export function initMenu() {
  initCreditsButton(document.querySelector('#menu-credits-btn'));
}