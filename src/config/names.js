// src/config/names.js
//
// Ship / AI names and the other fixed title-screen copy, in one place so UI text, story
// content and future dialogue all import the same constants instead of retyping them.
//
// SHIP_NAME / AI_NAME are working titles (Halcyon / AEGIS) — lock them before final copy is
// written; changing them here updates every screen that shows them.

export const GAME_TITLE = 'LAST SIGNAL';
export const SHIP_NAME = 'HALCYON';
export const AI_NAME = 'AEGIS';

// Bottom-left build tag on the main menu ("LAST SIGNAL // BETA BUILD").
export const BUILD_LABEL = 'BETA BUILD';

// Flavour line on the main menu ("... LAST CONTACT 04:12:37 AGO").
export const LAST_CONTACT = '04:12:37';
