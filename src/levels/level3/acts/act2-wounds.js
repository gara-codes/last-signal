// src/levels/level3/acts/act2-wounds.js
//
// Act 2 — THE WOUNDS. The passage tier narrows the refit spine into the
// chamfered collar, then W1 (the refit catwalk chamber wound) opens the hull
// for the 270° panorama crossing. Teaches the electrified pad, tests the
// collapsing planks over the wound, combines the fire/plasma vent across the
// deck-breach field. Holds the 3-stage hold-E override console, the al2
// alcove (spare card + fuel), pre-breaches p2/p3, the c-a2 collapses, and
// the kc2 reader door into the belly.

import { ALCOVES, BREACHES, GATES, PICKUPS, TIERS, MAIN_Y } from '../level3-data.js';
import { buildAlcoveDucts } from '../corridor-kit.js';
import { dressDeck, woundSection, viewportCrack } from '../breaches.js';
import {
  createFuelCell,
  createKeycard,
  createCanister,
  createReaderDoor,
  createConsole,
  createLogTerminal,
  createAegisEye,
  createDebrisField,
} from '../props3.js';

const find = (id) => BREACHES.find((b) => b.id === id);

export function buildAct2(ctx) {
  const { kit, materials } = ctx;
  const al2 = ALCOVES[1];
  const p2 = find('p2');
  const p3 = find('p3');
  const w1 = find('w1');
  const cViewport = find('c-a2-viewport');
  const cDeck = find('c-a2-deck');
  const kc2 = GATES.keycards[1];
  const override = GATES.overrideConsole;

  // ── a2-spine: chamfered passage (tier 2) with a viewport pre-breach ──
  const spine = ctx.segment('a2-spine');
  const al2Build = buildAlcoveDucts(kit, al2, spine, MAIN_Y);
  kit.passageSection(spine, {
    y: MAIN_Y,
    doorways: al2Build.doorways,
  });
  viewportCrack(kit, spine, p2, materials, MAIN_Y); // pre-breached p2
  ctx.add(createDebrisField([TIERS.passage.width / 2, 4, p2.z], [4, 5, p2.span], 90));
  // Scripted viewport collapse (no seal — decorative, keeps the route open).
  ctx.rig(cViewport, { minX: 35, maxX: 45, minY: -2, maxY: 8, minZ: -104, maxZ: -100 }, 'c-a2-viewport');
  // Teach the electrified condensate pad.
  ctx.hazard('h5-pad');

  // al2 contents: the spare kc2 card + a live fuel-cell O2 top-up.
  const spare2 = createKeycard(materials);
  spare2.group.position.set(al2Build.anchor[0], al2Build.anchor[1], al2Build.anchor[2] - 1.5);
  ctx.add(spare2);
  const fuel3 = createFuelCell(materials);
  fuel3.group.position.set(al2Build.anchor[0], al2Build.anchor[1], al2Build.anchor[2] + 1.5);
  ctx.add(fuel3);
  ctx.door('kc2-spare-al2', { id: 'keycard-spare-2', kind: 'pickup', alcove: 'al2', position: spare2.group.position.toArray() });

  // Route log + canister at the wound mouth.
  const log2 = createLogTerminal(materials);
  log2.group.position.set(...PICKUPS.logs[1].position);
  log2.group.rotation.y = -Math.PI / 2;
  ctx.add(log2);
  const o21 = createCanister(materials);
  o21.group.position.set(...PICKUPS.canisters[0].position);
  ctx.add(o21);
  const eyeA = createAegisEye(materials, 0.5);
  eyeA.group.position.set(TIERS.passage.width / 2 - 0.3, 3.4, -140);
  eyeA.group.rotation.y = -Math.PI / 2;
  ctx.add(eyeA);

  // ── a2-wound1: W1, the refit catwalk chamber wound (exactly 3 total) ──
  const wound1 = ctx.segment('a2-wound1');
  woundSection(kit, wound1, w1, materials, MAIN_Y);
  ctx.add(createDebrisField([40, 2, w1.z], [16, 12, w1.span], 240));
  // Test: collapsing planks laid across the wound bridge.
  ctx.hazard('h6-planks');
  // The 3-stage hold-E override console on the far lip of the wound.
  const consoleObj = createConsole(materials, { stages: override.stages });
  consoleObj.group.position.set(...override.position);
  consoleObj.group.rotation.y = Math.PI;
  ctx.add(consoleObj);
  ctx.door('override', {
    id: override.id,
    kind: 'hold-e-console',
    stages: override.stages,
    position: [...override.position],
  });
  const eyeB = createAegisEye(materials, 0.6);
  eyeB.group.position.set(40 - 6.8, 5, w1.z + 10);
  eyeB.group.rotation.y = Math.PI / 2;
  ctx.add(eyeB);

  // ── a2-field: the deck-breach field (tier 1) ─────────────────────────
  const field = ctx.segment('a2-field');
  const p3Half = p3.span / 2;
  kit.spineSection(field, {
    y: MAIN_Y,
    openFloor: [[p3.z - p3Half, p3.z + p3Half]], // pre-breached deck: gap crossings + girder walkway
  });
  dressDeck(kit, field, p3, materials, MAIN_Y);
  ctx.add(createDebrisField([40, -3, p3.z], [10, 6, p3.span], 160));
  // Scripted deck collapse ahead of the pre-breach; seals the field behind.
  ctx.rig(cDeck, { minX: 35, maxX: 45, minY: -2, maxY: 8, minZ: -189, maxZ: -185 }, 'c-a2-deck');
  // Combine: fire/plasma vent shaping a narrow safe line across the deck.
  ctx.hazard('h7-fire');
  const fuelEye = createAegisEye(materials, 0.5);
  fuelEye.group.position.set(40 + TIERS.spine.width / 2 - 0.4, 4.6, -225);
  fuelEye.group.rotation.y = -Math.PI / 2;
  ctx.add(fuelEye);

  // ── t2 + c2: the 90° turn and the descent collar to the belly ────────
  const t2 = ctx.segment('t2');
  kit.turnChamber(t2, { y: MAIN_Y });
  const door2 = createReaderDoor(materials, 6, 5);
  door2.group.position.set(40, MAIN_Y, kc2.doorZ);
  ctx.add(door2);
  ctx.door('kc2', {
    id: kc2.id,
    kind: 'keycard-reader',
    boundary: kc2.boundary,
    position: [40, MAIN_Y, kc2.doorZ],
    routeCard: kc2.routeCard,
    spareAlcove: kc2.spareAlcove,
  });
  const card2 = createKeycard(materials);
  card2.group.position.set(...kc2.routeCard);
  ctx.add(card2);

  const c2 = ctx.segment('c2');
  kit.passageSection(c2, { y: MAIN_Y });
}
