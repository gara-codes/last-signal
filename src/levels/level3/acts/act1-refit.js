// src/levels/level3/acts/act1-refit.js
//
// Act 1 — THE REFIT. The five original beats (spine, cargo hall, bulkhead
// collapse, docking collar run) enclosed in the new kit and extended to a
// full act: teach hazards (debris, steam), the shutter/crane combine in the
// cargo hall, the first scripted crown collapse demoting the spine to a
// duct crawl, airlock breathing beat, alcove al1, and the kc1 reader door.
//
// ctx contract (provided by the assembler):
//   ctx.kit        KitBuilder for this act
//   ctx.materials  shared material palette
//   ctx.add(obj)         register { group, update? } — group added to the act
//   ctx.hazard(spec)     build + place + register a HAZARDS entry
//   ctx.rig(breach, triggerBox)  collapse rig + fire-once viewer trigger
//   ctx.trigger(box, fn, id)     generic fire-once viewer trigger
//   ctx.cue(type, position)      push a lightingCues entry
//   ctx.segment(id) / ctx.baseY(segment)
//   ctx.door(id, obj, position)  register an animating door + its data entry

import * as THREE from 'three';
import { ALCOVES, ACTS, BREACHES, GATES, PICKUPS, TIERS, MAIN_Y } from '../level3-data.js';
import { buildAlcoveDucts } from '../corridor-kit.js';
import { dressCrown, createCollapseRig } from '../breaches.js';
import {
  createFuelCell,
  createKeycard,
  createReaderDoor,
  createAirlockDoor,
  createLogTerminal,
  createAegisEye,
  createDebrisField,
} from '../props3.js';

export function buildAct1(ctx) {
  const { kit, materials } = ctx;
  const al1 = ALCOVES[0];
  const p1 = BREACHES.find((b) => b.id === 'p1');
  const cCrown = BREACHES.find((b) => b.id === 'c-a1-crown');
  const cBulkhead = BREACHES.find((b) => b.id === 'c-a1-bulkhead');
  const air1 = GATES.airlocks[0];
  const kc1 = GATES.keycards[0];

  // ── a1-spine: the enclosed docking spine (tier 1, 9×7) ──────────────
  const spine = ctx.segment('a1-spine');
  const al1Build = buildAlcoveDucts(kit, al1, spine, MAIN_Y);
  kit.spineSection(spine, {
    y: MAIN_Y,
    openCeiling: [[p1.z - p1.span / 2, p1.z + p1.span / 2]], // pre-breached crown: starlight from frame one
    doorways: [...al1Build.doorways, { side: -1, along: air1.z, width: 6, height: 5 }], // 5 = airlock vestibule height
  });
  dressCrown(kit, spine, p1, materials, MAIN_Y);
  ctx.add(createDebrisField([0, 9, p1.z], [10, 8, p1.span], 140));

  // Airlock breathing door (west wall) + enclosed vestibule with vista + log.
  const airVestibuleDepth = 4;
  const airVestibuleWidth = 6;
  const airVestibuleHeight = 5;
  const airWallX = -TIERS.spine.width / 2;
  const airOuterX = airWallX - airVestibuleDepth;
  // Vestibule floor + ceiling
  kit.addStatic(new THREE.BoxGeometry(airVestibuleDepth, 0.6, airVestibuleWidth), 'floor', new THREE.Matrix4().makeTranslation(airOuterX + airVestibuleDepth / 2, MAIN_Y - 0.3, air1.z));
  kit.addStatic(new THREE.BoxGeometry(airVestibuleDepth, 0.6, airVestibuleWidth), 'frame', new THREE.Matrix4().makeTranslation(airOuterX + airVestibuleDepth / 2, MAIN_Y + airVestibuleHeight + 0.3, air1.z));
  // Vestibule side walls (north/south)
  for (const side of [-1, 1]) {
    const z = air1.z + side * airVestibuleWidth / 2;
    kit.addStatic(new THREE.BoxGeometry(airVestibuleDepth, airVestibuleHeight, 0.4), 'frame', new THREE.Matrix4().makeTranslation(airOuterX + airVestibuleDepth / 2, MAIN_Y + airVestibuleHeight / 2, z));
  }
  // Outer wall with viewport crack (the vista)
  kit.addStatic(new THREE.BoxGeometry(0.4, airVestibuleHeight, airVestibuleWidth), 'frame', new THREE.Matrix4().makeTranslation(airOuterX, MAIN_Y + airVestibuleHeight / 2, air1.z));
  const airViewport = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3, 4), materials.glass);
  airViewport.position.set(airOuterX - 0.1, MAIN_Y + 2.5, air1.z);
  ctx.add({ group: airViewport });
  // Airlock door on the inner wall
  const airDoor = createAirlockDoor(materials, air1.cycle, 6, 5);
  airDoor.group.position.set(airWallX - 0.2, MAIN_Y, air1.z);
  airDoor.group.rotation.y = Math.PI / 2;
  ctx.add(airDoor);
  ctx.door('air1', { id: air1.id, kind: 'airlock', cycle: air1.cycle, position: [airWallX - 0.2, MAIN_Y, air1.z], contains: air1.contains });
  // Log terminal inside the vestibule
  const log1 = createLogTerminal(materials);
  log1.group.position.set(airOuterX + 1, MAIN_Y, air1.z - 1.4);
  log1.group.rotation.y = Math.PI / 2;
  ctx.add(log1);

  // Route fuel cell + the two teach hazards, alone and in sequence.
  const fuel1 = createFuelCell(materials);
  fuel1.group.position.set(...PICKUPS.fuel[0].position);
  ctx.add(fuel1);
  ctx.hazard('h1-debris');
  ctx.hazard('h2-steam');

  // Scripted collapse 1: the crown AEGIS tears down behind the player,
  // demoting the spine to a duct crawl (the tier demotion is the seal pile).
  ctx.rig(cCrown, { minX: -4.5, maxX: 4.5, minY: -2, maxY: 10, minZ: -34, maxZ: -30 }, 'c-a1-crown');

  // AEGIS eyes: watching from the wall ribs, darkening once sealed behind.
  // eye1 rides the spine east wall, watching the corridor.
  const eye1 = createAegisEye(materials, 0.5);
  eye1.group.position.set(TIERS.spine.width / 2 - 0.4, 4.6, -60);
  eye1.group.rotation.y = -Math.PI / 2;
  ctx.add(eye1);
  // eye2 rides the CARGO HALL west wall (the hall is 22 wide — x=-10.5 is
  // the same wall-embedded mount eye1 uses on the spine).
  const eye2 = createAegisEye(materials, 0.5);
  eye2.group.position.set(-10.5, 4.6, -55);
  eye2.group.rotation.y = Math.PI / 2;
  ctx.add(eye2);

  // Alcove al1: forward-exit duct spur holding the spare keycard.
  const spare1 = createKeycard(materials);
  spare1.group.position.set(...al1Build.anchor);
  ctx.add(spare1);
  ctx.door('kc1-spare-al1', { id: 'keycard-spare-1', kind: 'pickup', alcove: 'al1', position: al1Build.anchor });

  // ── a1-cargo: the cargo hall (tier 4) ───────────────────────────────
  const cargo = ctx.segment('a1-cargo');
  kit.hallShell(cargo, { width: 22, height: 13, y: MAIN_Y });
  // Container stacks dressing the hall walls (solids via crateStack steps).
  kit.crateStack([-8, MAIN_Y, -52], 3);
  kit.crateStack([8, MAIN_Y, -55], 2);
  kit.crateStack([-7, MAIN_Y, -68], 2);
  kit.crateStack([7.5, MAIN_Y, -66], 3);
  // The test/combine pair: miss the shutter cycle -> the duct detour below.
  ctx.hazard('h3-shutter');
  ctx.hazard('h4-crane');
  // eye3 watches from the hall ceiling above the bulkhead collapse.
  const eye3 = createAegisEye(materials, 0.7);
  eye3.group.position.set(0, 12.4, -71.5);
  ctx.add(eye3);

  // Transition end-walls: close every tier change down to the continuing
  // cross-section (solid cap behind the spawn; sized openings everywhere
  // else) so no void leaks to the starfield around a junction.
  kit.endWall(spine, { at: spine.from, width: TIERS.spine.width, height: TIERS.spine.height, y: MAIN_Y });
  kit.endWall(cargo, { at: cargo.from, width: 22, height: 13, openingWidth: TIERS.spine.width, openingHeight: TIERS.spine.height, y: MAIN_Y });
  kit.endWall(cargo, { at: cargo.to, width: 22, height: 13, openingWidth: TIERS.duct.width, openingHeight: TIERS.duct.height, y: MAIN_Y });

  // ── a1-bypass: the duct detour + the bulkhead collapse ─────────────
  const bypass = ctx.segment('a1-bypass');
  kit.ductSection(bypass, { y: MAIN_Y });
  // Scripted collapse 2 fires as the player leaves the cargo hall for the
  // duct: the original bulkhead beat, now sealing the hall behind (forward-only).
  const bulkheadRig = createCollapseRig(cBulkhead, cargo, materials, (type, position) => ctx.cue(type, position));
  ctx.add(bulkheadRig);
  ctx.trigger({ minX: -1.5, maxX: 1.5, minY: -2, maxY: 5, minZ: -70, maxZ: -66 }, () => bulkheadRig.begin(), 'c-a1-bulkhead');

  // ── t1 + c1: the 90° turn and the collar run to Act 2 ──────────────
  const t1 = ctx.segment('t1');
  // c1 branches east off the turn at z=-96: cut its mouth in the east wall
  // (full 6×5 bay) so the room shows its exit, and cap the north stub past
  // the junction — it leads nowhere and would leak straight out to the
  // starfield.
  kit.turnChamber(t1, { y: MAIN_Y, doorways: [{ side: 1, along: -96, width: TIERS.passage.width, height: TIERS.passage.height }] });
  kit.endWall(t1, { at: t1.from, width: TIERS.passage.width, height: TIERS.passage.height, openingWidth: TIERS.duct.width, openingHeight: TIERS.duct.height, y: MAIN_Y });
  kit.endWall(t1, { at: t1.to, width: TIERS.passage.width, height: TIERS.passage.height, y: MAIN_Y });
  // kc1 reader door at the act boundary; the route card sits just before it.
  // The door guards the c1 mouth in t1's east wall, perpendicular to the
  // passage (not parallel to t1's length). Rotated 90° so the slab faces
  // east-west, spanning the mouth's z-range (-99 to -93).
  const door1 = createReaderDoor(materials, 6, 5);
  door1.group.position.set(3, MAIN_Y, -96);
  door1.group.rotation.y = Math.PI / 2;
  ctx.add(door1);
  ctx.door('kc1', {
    id: kc1.id,
    kind: 'keycard-reader',
    boundary: kc1.boundary,
    position: [3, MAIN_Y, -96],
    routeCard: kc1.routeCard,
    spareAlcove: kc1.spareAlcove,
  });
  const card1 = createKeycard(materials);
  card1.group.position.set(...kc1.routeCard);
  ctx.add(card1);

  const c1 = ctx.segment('c1');
  kit.passageSection(c1, { y: MAIN_Y });
  // Act 2 isn't in the build scope yet (ACTS = [1]): cap the collar run so
  // the corridor reads as finished space instead of open void. When act 2
  // lands, its own junction wall replaces this cap at the a2-spine corner.
  if (!ACTS.includes(2)) kit.endWall(c1, { at: c1.to, width: TIERS.passage.width, height: TIERS.passage.height, y: MAIN_Y });
}
