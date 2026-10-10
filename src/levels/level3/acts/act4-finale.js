// src/levels/level3/acts/act4-finale.js
//
// Act 4 — THE FINALE. The ascent shaft lifts the route back to starlight
// (main deck). W3 opens the pod-bay approach, guarded by the h9 security
// beam grid (the final-exam hazard). The pod bay itself holds the growing-
// crack motif on its window row, the empty cradles + one drifting pod, the
// escape pod + launch console (the win trigger), the three hazard-guarded
// pod-clamp consoles, the AEGIS-motive log (log-5), the planetrise reserved
// for the ending view, and the final c-a4 collapses.

import * as THREE from 'three';
import { ALCOVES, BREACHES, GATES, PICKUPS, MAIN_Y, LOWER_Y } from '../level3-data.js';
import { buildAlcoveDucts } from '../corridor-kit.js';
import { woundSection, viewportCrack, createCrackMotif } from '../breaches.js';
import {
  createFuelCell,
  createCanister,
  createConsole,
  createLogTerminal,
  createAegisEye,
  createStarfield,
  createDebrisField,
  createCradles,
  createPlanet,
  createPod,
} from '../props3.js';

const find = (id) => BREACHES.find((b) => b.id === id);

export function buildAct4(ctx) {
  const { kit, materials } = ctx;
  const al4 = ALCOVES[3];
  const w3 = find('w3');
  const cViewport = find('c-a4-viewport');
  const clamps = GATES.clamps;
  const y = MAIN_Y;

  // ── ascent shaft: the plane link from the belly back up to starlight ─
  const shaft = new THREE.Group();
  shaft.name = 'ascent-shaft';
  const shaftWell = new THREE.Mesh(new THREE.BoxGeometry(4, MAIN_Y - LOWER_Y, 4), materials.frame);
  shaftWell.position.set(120, (MAIN_Y + LOWER_Y) / 2, -432);
  shaft.add(shaftWell);
  ctx.add({ group: shaft });
  ctx.door('ascent-shaft', { id: 'ascent-shaft', kind: 'ladder-teleport', from: 'lower', to: 'main', position: [120, MAIN_Y, -432] });

  // ── a4-approach: the pod-bay approach (tier 1) with W3 ──────────────
  const approach = ctx.segment('a4-approach');
  const al4Build = buildAlcoveDucts(kit, al4, approach, y);
  kit.spineSection(approach, {
    y,
    doorways: al4Build.doorways,
  });
  // W3: the pod-bay-approach wound (one of exactly three).
  woundSection(kit, approach, w3, materials, y);
  ctx.add(createDebrisField([120, y + 2, w3.z], [16, 12, w3.span], 240));
  // Decorative viewport collapse on the approach (no seal).
  viewportCrack(kit, approach, cViewport, materials, y);
  ctx.rig(cViewport, { minX: 115, maxX: 125, minY: y - 2, maxY: y + 9, minZ: -445, maxZ: -441 }, 'c-a4-viewport');
  // Final-exam hazard: the security beam grid guarding clamp-1.
  ctx.hazard('h9-beams');
  // Canister + log at the bay mouth; fuel + vista in the al4 alcove.
  const o23 = createCanister(materials);
  o23.group.position.set(...PICKUPS.canisters[2].position);
  ctx.add(o23);
  const log4 = createLogTerminal(materials);
  log4.group.position.set(...PICKUPS.logs[3].position);
  log4.group.rotation.y = -Math.PI / 2;
  ctx.add(log4);
  const fuel4 = createFuelCell(materials);
  fuel4.group.position.set(...al4Build.anchor);
  ctx.add(fuel4);
  ctx.door('fuel-4-al4', { id: 'fuel-4', kind: 'pickup', alcove: 'al4', position: al4Build.anchor });

  // ── a4-podbay: the docking bay + escape pod finale ──────────────────
  const podbay = ctx.segment('a4-podbay');
  kit.hallShell(podbay, { width: 24, height: 14, y });

  // The ONE escalating crack motif: the pod-bay window row, hairline ->
  // spiderweb -> starred across act boundaries (setState driven by assembler).
  const motif = createCrackMotif(materials, [120 - 11.5, y + 3.5, -490], 4);
  motif.group.rotation.y = Math.PI / 2;
  ctx.add(motif);
  ctx.registerCrackMotif(motif);

  // Empty cradles + one drifting pod silhouette: "the crew already left".
  const cradles = createCradles(materials, [120, y, -485]);
  ctx.add(cradles);

  // The escape pod + launch console: boarding is the win trigger.
  const pod = createPod(materials);
  pod.group.position.set(120, y, -498);
  ctx.add(pod);
  ctx.door('pod-boarding', {
    id: 'pod-boarding',
    kind: 'win-trigger',
    position: [120, y, -498],
    board: () => pod.openHatch(),
  });
  const launchConsole = createConsole(materials, { stages: 1 });
  launchConsole.group.position.set(120 + 3, y, -496);
  launchConsole.group.rotation.y = -Math.PI / 2;
  ctx.add(launchConsole);

  // The three pod-clamp consoles (final exam, any order), each guarded by a
  // hazard: clamp-1 by the h9 beam grid, clamp-2 by steam, clamp-3 by planks.
  clamps.forEach((clamp) => {
    const consoleObj = createConsole(materials, { stages: 2 });
    consoleObj.group.position.set(...clamp.position);
    consoleObj.group.rotation.y = Math.PI;
    ctx.add(consoleObj);
    ctx.door(clamp.id, { id: clamp.id, kind: 'pod-clamp', guard: clamp.guard, position: [...clamp.position] });
    // Synthesise the two guard hazards that aren't in the ladder table.
    if (clamp.guard === 'steam-clamp') {
      ctx.hazard({ id: 'steam-clamp', type: 'steam-jet', act: 4, role: 'guard', segment: 'a4-podbay', z: -478, telegraph: 1.2, cycle: 4 });
    } else if (clamp.guard === 'planks-clamp') {
      ctx.hazard({ id: 'planks-clamp', type: 'collapsing-planks', act: 4, role: 'guard', segment: 'a4-podbay', z: -472, telegraph: 0.8, cycle: 0 });
    }
  });

  // AEGIS-motive log at the far bay wall; watching eyes going dark.
  const log5 = createLogTerminal(materials);
  log5.group.position.set(...PICKUPS.logs[4].position);
  log5.group.rotation.y = Math.PI;
  ctx.add(log5);
  const coreEye = createAegisEye(materials, 1.2);
  coreEye.group.position.set(120, y + 10, -508);
  ctx.add(coreEye);
  ctx.registerEye(coreEye); // darkens as the pod launches (AEGIS losing sight)

  // Final scripted crown collapse inside the bay (meltdown cascade read).
  ctx.rig(find('c-a4-crown'), { minX: 115, maxX: 125, minY: y - 2, maxY: y + 9, minZ: -472, maxZ: -470 }, 'c-a4-crown');

  // ── space dressing: starfield + planetrise for the ending view ───────
  ctx.add(createStarfield(2600, 900));
  ctx.add(createPlanet());
}
