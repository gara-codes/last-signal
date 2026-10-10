// src/levels/level3/acts/act3-belly.js
//
// Act 3 — THE BELLY. The whole act runs on the lower deck (y = -7), reached
// by the descent shaft at the top of a3-spine. This is where the meltdown
// countdown ARMS: the AEGIS core chamber (giant eye + physical countdown
// screen) is the reveal beat, and its door is the purge event gate that only
// opens when the h8 chase initiates. Pre-breach p4 (crown), the c-a3
// collapses, W2 (the double-scale wound at the act's end), airlock air2 +
// log-3, the al3 alcove, fuel-2, o2-2, and the kc3 reader door back up.

import * as THREE from 'three';
import { ALCOVES, BREACHES, GATES, PICKUPS, COUNTDOWN, TIERS, MAIN_Y, LOWER_Y } from '../level3-data.js';
import { buildAlcoveDucts } from '../corridor-kit.js';
import { dressCrown, woundSection } from '../breaches.js';
import {
  createFuelCell,
  createKeycard,
  createCanister,
  createReaderDoor,
  createAirlockDoor,
  createLogTerminal,
  createAegisEye,
  createCountdownScreen,
  createDebrisField,
} from '../props3.js';

const find = (id) => BREACHES.find((b) => b.id === id);

export function buildAct3(ctx) {
  const { kit, materials } = ctx;
  const al3 = ALCOVES[2];
  const p4 = find('p4');
  const w2 = find('w2');
  const cCrown = find('c-a3-crown');
  const cDeck = find('c-a3-deck');
  const air2 = GATES.airlocks[1];
  const kc3 = GATES.keycards[2];
  const eventGate = GATES.eventGate;
  const y = LOWER_Y;

  // ── descent shaft: the plane link from the main deck down to the belly ─
  const shaft = new THREE.Group();
  shaft.name = 'descent-shaft';
  const shaftWell = new THREE.Mesh(new THREE.BoxGeometry(4, MAIN_Y - LOWER_Y, 4), materials.frame);
  shaftWell.position.set(80, (MAIN_Y + LOWER_Y) / 2, -242);
  shaft.add(shaftWell);
  ctx.add({ group: shaft });
  // The shaft is a reserved teleport volume; the systems pass wires the drop.
  ctx.door('descent-shaft', { id: 'descent-shaft', kind: 'ladder-teleport', from: 'main', to: 'lower', position: [80, LOWER_Y, -242] });

  // ── a3-spine: the belly corridor (tier 1, lower deck) ───────────────
  const spine = ctx.segment('a3-spine');
  const al3Build = buildAlcoveDucts(kit, al3, spine, y);
  const p4Half = p4.span / 2;
  kit.spineSection(spine, {
    y,
    openCeiling: [[p4.z - p4Half, p4.z + p4Half]], // pre-breached crown: the deck above is torn, starlight falls in
    doorways: [...al3Build.doorways, { side: -1, along: air2.z, width: 6, height: 5 }], // 5 = airlock vestibule height
  });
  dressCrown(kit, spine, p4, materials, y);
  ctx.add(createDebrisField([80, y + 9, p4.z], [10, 8, p4.span], 150));

  // Airlock breathing door + enclosed vestibule with vista + log.
  const airVestibuleDepth = 4;
  const airVestibuleWidth = 6;
  const airVestibuleHeight = 5;
  const airWallX = 80 - TIERS.spine.width / 2;
  const airOuterX = airWallX - airVestibuleDepth;
  // Vestibule floor + ceiling
  kit.addStatic(new THREE.BoxGeometry(airVestibuleDepth, 0.6, airVestibuleWidth), 'floor', new THREE.Matrix4().makeTranslation(airOuterX + airVestibuleDepth / 2, y - 0.3, air2.z));
  kit.addStatic(new THREE.BoxGeometry(airVestibuleDepth, 0.6, airVestibuleWidth), 'frame', new THREE.Matrix4().makeTranslation(airOuterX + airVestibuleDepth / 2, y + airVestibuleHeight + 0.3, air2.z));
  // Vestibule side walls (north/south)
  for (const side of [-1, 1]) {
    const z = air2.z + side * airVestibuleWidth / 2;
    kit.addStatic(new THREE.BoxGeometry(airVestibuleDepth, airVestibuleHeight, 0.4), 'frame', new THREE.Matrix4().makeTranslation(airOuterX + airVestibuleDepth / 2, y + airVestibuleHeight / 2, z));
  }
  // Outer wall with viewport crack (the vista)
  kit.addStatic(new THREE.BoxGeometry(0.4, airVestibuleHeight, airVestibuleWidth), 'frame', new THREE.Matrix4().makeTranslation(airOuterX, y + airVestibuleHeight / 2, air2.z));
  const airViewport = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3, 4), materials.glass);
  airViewport.position.set(airOuterX - 0.1, y + 2.5, air2.z);
  ctx.add({ group: airViewport });
  // Airlock door on the inner wall
  const airDoor = createAirlockDoor(materials, air2.cycle, 6, 5);
  airDoor.group.position.set(airWallX - 0.2, y, air2.z);
  airDoor.group.rotation.y = Math.PI / 2;
  ctx.add(airDoor);
  ctx.door('air2', { id: air2.id, kind: 'airlock', cycle: air2.cycle, position: [airWallX - 0.2, y, air2.z], contains: air2.contains });
  // Log terminal inside the vestibule
  const log3 = createLogTerminal(materials);
  log3.group.position.set(airOuterX + 1, y, air2.z - 1.4);
  log3.group.rotation.y = Math.PI / 2;
  ctx.add(log3);

  // Belly-route fuel cell + the scripted crown collapse that seals behind.
  const fuel2 = createFuelCell(materials);
  fuel2.group.position.set(...PICKUPS.fuel[1].position);
  ctx.add(fuel2);
  ctx.rig(cCrown, { minX: 75, maxX: 85, minY: y - 2, maxY: y + 9, minZ: -289, maxZ: -285 }, 'c-a3-crown');

  // al3 contents: spare kc3 card + a vista panel (the belly's one window).
  const spare3 = createKeycard(materials);
  spare3.group.position.set(al3Build.anchor[0], al3Build.anchor[1], al3Build.anchor[2] - 1.4);
  ctx.add(spare3);
  ctx.door('kc3-spare-al3', { id: 'keycard-spare-3', kind: 'pickup', alcove: 'al3', position: spare3.group.position.toArray() });
  const bellyEye = createAegisEye(materials, 0.5);
  bellyEye.group.position.set(al3Build.anchor[0], al3Build.anchor[1] + 2, al3Build.anchor[2] + 1.4);
  ctx.add(bellyEye);

  // ── a3-core: the AEGIS core chamber (countdown arms here) ───────────
  const core = ctx.segment('a3-core');
  kit.hallShell(core, { width: 24, height: 14, y });
  kit.crateStack([80 - 9, y, -305], 3);
  kit.crateStack([80 + 9, y, -308], 2);
  kit.crateStack([80 - 8, y, -322], 2);
  // The giant watching eye — AEGIS's physical presence, and the reveal beat.
  const giantEye = createAegisEye(materials, 2.4);
  giantEye.group.position.set(80, y + 9, -328);
  giantEye.group.name = 'aegis-core-eye';
  ctx.add(giantEye);
  // The physical countdown screen: digits first become visible here.
  const screen = createCountdownScreen(materials);
  screen.group.position.set(80, y + 4.5, -329);
  ctx.add(screen);
  ctx.door('countdown-arms', {
    id: 'countdown',
    kind: 'countdown-arming',
    segment: COUNTDOWN.armsAtSegment,
    seconds: COUNTDOWN.seconds,
    position: [80, y + 4.5, -329],
  });
  // The purge event gate: the core-chamber door that opens only on h8 start.
  const gateDoor = createReaderDoor(materials, 8, 6);
  gateDoor.group.position.set(80, y, eventGate.z);
  ctx.add(gateDoor);
  ctx.door('purge-door', {
    id: eventGate.id,
    kind: 'event-gate',
    opensOn: eventGate.opensOn,
    position: [80, y, eventGate.z],
    setOpen: (v) => gateDoor.setOpen(v),
  });

  // ── a3-purge: the chase setpiece corridor ───────────────────────────
  const purge = ctx.segment('a3-purge');
  kit.spineSection(purge, { y });
  const purgeHazard = ctx.hazard('h8-purge');
  // Crossing the core-chamber threshold begins the purge chase and opens the
  // event gate behind it (fire-once, via the assembler's trigger channel).
  ctx.trigger({ minX: 75, maxX: 85, minY: y - 2, maxY: y + 9, minZ: -332, maxZ: -330 }, () => {
    purgeHazard.begin?.();
    gateDoor.setOpen(true);
    ctx.cue('act', [80, y + 3, -330]);
  }, 'purge-start');

  // ── a3-wound2: W2, the double-scale wound (end of Act 3) ────────────
  const wound2 = ctx.segment('a3-wound2');
  woundSection(kit, wound2, w2, materials, y);
  ctx.add(createDebrisField([80, y + 2, w2.z], [22, 16, w2.span], 320));
  // W2 is a scripted collapse: telegraph, then the wound opens, sealing the belly behind.
  ctx.rig(w2, { minX: 75, maxX: 85, minY: y - 2, maxY: y + 9, minZ: -425, maxZ: -420 }, 'w2');
  // Scripted deck collapse on the approach to W2; seals the belly behind.
  ctx.rig(cDeck, { minX: 75, maxX: 85, minY: y - 2, maxY: y + 9, minZ: -384, maxZ: -380 }, 'c-a3-deck');
  const o22 = createCanister(materials);
  o22.group.position.set(...PICKUPS.canisters[1].position);
  ctx.add(o22);

  // ── t3 + c3: the 90° turn and the ascent collar to Act 4 ────────────
  const t3 = ctx.segment('t3');
  kit.turnChamber(t3, { y });
  const door3 = createReaderDoor(materials, 6, 5);
  door3.group.position.set(80, y, kc3.doorZ);
  ctx.add(door3);
  ctx.door('kc3', {
    id: kc3.id,
    kind: 'keycard-reader',
    boundary: kc3.boundary,
    position: [80, y, kc3.doorZ],
    routeCard: kc3.routeCard,
    spareAlcove: kc3.spareAlcove,
  });
  const card3 = createKeycard(materials);
  card3.group.position.set(...kc3.routeCard);
  ctx.add(card3);

  const c3 = ctx.segment('c3');
  kit.passageSection(c3, { y });
}
