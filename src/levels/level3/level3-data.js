// src/levels/level3/level3-data.js
//
// The single source of truth for the Level 3 docking-corridor blockout:
// every locked design number from the 24-decision interview lives here as
// data, so the kit/acts/hazards builders and the vitest suite all read the
// same tables. Nothing in this file touches THREE — it is plain objects and
// arrays, which is what lets tests/level3-*.test.js assert the design
// invariants without a renderer.
//
// COORDINATE SCHEME
// The route is a chain of axis-aligned segments joined by 90° turn chambers.
// Axis-alignment is not aesthetic caution: FlatPhysicsController resolves
// collision against axis-aligned boxes (wallAABBs/railAABBs), so a rotated
// spine could only ever be approximated by porous stair-stepped boxes. The
// 90° turns still deliver the locked reveal-curtain and culling-seam jobs of
// the "doglegs"; the 30–45° look is dressed inside turn chambers with angled
// panelling rather than carried in the collision math.
// Each segment: { id, act, axis: 'z'|'x', from, to, at, plane, tier }
//   axis 'z': the centreline runs along Z at x = at (from > to, route goes -Z)
//   axis 'x': the centreline runs along X at z = at (from < to, route goes +X)
//   plane: 'main' (y = MAIN_Y) or 'lower' (y = LOWER_Y)
//   tier: 'spine' | 'passage' | 'duct' | 'hall' | 'wound' | 'turn'

export const ENVELOPE = Object.freeze({
  capsuleRadius: 0.4,
  capsuleHeight: 1.8,
  walkSpeed: 6,
  runSpeed: 9.6,
  jumpApex: 1.6,
  jumpAirtime: 0.8,
  gapMandatory: 4, // jumpable walking (6 u/s * 0.8 s = 4.8, keep margin)
  gapSkill: 7, // jumpable running (9.6 u/s * 0.8 s = 7.7, keep margin)
  maxStep: 1.6, // taller needs a ramp, crate stack or ladder teleport
  minPassage: 1.0,
  comfortablePassage: 2.5,
});

// Section tiers = the camera contract (future 6u boom). Ratios bind; the
// absolutes assume astronaut scale 2.5.
export const TIERS = Object.freeze({
  spine: Object.freeze({ width: 9, height: 7 }),
  passage: Object.freeze({ width: 6, height: 5 }),
  duct: Object.freeze({ width: 3, height: 3, maxSegment: 15 }),
  hall: Object.freeze({ widthMin: 18, widthMax: 24, heightMin: 12, heightMax: 14 }),
});

export const BOOM_CONTRACT = 6;

// Exactly two storey planes — FlatPhysicsController's floorSpec limit.
export const MAIN_Y = 0;
export const LOWER_Y = -7;
export const SLAB = 0.6; // deck slab thickness; lower clear height = 6.4
export const LOWER_CLEAR = MAIN_Y - SLAB - LOWER_Y; // 6.4

export const SEGMENTS = Object.freeze([
  // ── Act 1: the refit (existing beats, enclosed) ──
  Object.freeze({ id: 'a1-spine', act: 1, axis: 'z', from: 8, to: -48, at: 0, plane: 'main', tier: 'spine' }),
  Object.freeze({ id: 'a1-cargo', act: 1, axis: 'z', from: -48, to: -73, at: 0, plane: 'main', tier: 'hall' }),
  Object.freeze({ id: 'a1-bypass', act: 1, axis: 'z', from: -73, to: -91, at: 0, plane: 'main', tier: 'duct' }),
  Object.freeze({ id: 't1', act: 1, axis: 'z', from: -91, to: -101, at: 0, plane: 'main', tier: 'turn' }),
  Object.freeze({ id: 'c1', act: 1, axis: 'x', from: 3, to: 40, at: -96, plane: 'main', tier: 'passage' }),
  // ── Act 2: the wound act ──
  Object.freeze({ id: 'a2-spine', act: 2, axis: 'z', from: -101, to: -150, at: 40, plane: 'main', tier: 'passage' }),
  Object.freeze({ id: 'a2-wound1', act: 2, axis: 'z', from: -150, to: -185, at: 40, plane: 'main', tier: 'wound' }),
  Object.freeze({ id: 'a2-field', act: 2, axis: 'z', from: -185, to: -235, at: 40, plane: 'main', tier: 'spine' }),
  Object.freeze({ id: 't2', act: 2, axis: 'z', from: -235, to: -245, at: 40, plane: 'main', tier: 'turn' }),
  Object.freeze({ id: 'c2', act: 2, axis: 'x', from: 40, to: 80, at: -240, plane: 'main', tier: 'passage' }),
  // ── Act 3: the belly (lower deck) ──
  Object.freeze({ id: 'a3-spine', act: 3, axis: 'z', from: -245, to: -300, at: 80, plane: 'lower', tier: 'spine' }),
  Object.freeze({ id: 'a3-core', act: 3, axis: 'z', from: -300, to: -330, at: 80, plane: 'lower', tier: 'hall' }),
  Object.freeze({ id: 'a3-purge', act: 3, axis: 'z', from: -330, to: -375, at: 80, plane: 'lower', tier: 'spine' }),
  Object.freeze({ id: 'a3-wound2', act: 3, axis: 'z', from: -375, to: -425, at: 80, plane: 'lower', tier: 'wound' }),
  Object.freeze({ id: 't3', act: 3, axis: 'z', from: -425, to: -435, at: 80, plane: 'lower', tier: 'turn' }),
  Object.freeze({ id: 'c3', act: 3, axis: 'x', from: 80, to: 120, at: -430, plane: 'lower', tier: 'passage' }),
  // ── Act 4: the finale (back up to starlight) ──
  Object.freeze({ id: 'a4-approach', act: 4, axis: 'z', from: -435, to: -470, at: 120, plane: 'main', tier: 'spine' }),
  Object.freeze({ id: 'a4-podbay', act: 4, axis: 'z', from: -470, to: -510, at: 120, plane: 'main', tier: 'hall' }),
]);

// World-space AABB per act: culling bands, camera bounds and the flycam's
// establishing shots all read these. Connectors belong to the act they leave.
export const ACT_BOUNDS = Object.freeze({
  1: Object.freeze({ minX: -12, maxX: 42, minY: -1, maxY: 14, minZ: -101, maxZ: 10 }),
  2: Object.freeze({ minX: 28, maxX: 82, minY: -1, maxY: 14, minZ: -245, maxZ: -91 }),
  3: Object.freeze({ minX: 68, maxX: 122, minY: -8, maxY: 1, minZ: -435, maxZ: -235 }),
  4: Object.freeze({ minX: 108, maxX: 132, minY: -8, maxY: 14, minZ: -515, maxZ: -425 }),
});

//export const ACTS = Object.freeze([1, 2, 3, 4]);
export const ACTS = Object.freeze([1]);
// Checkpoints sit at act boundaries, each after the act's signature crossing
// (Act 1's is after the collapse seal; Acts 2/3 after wounds 1/2).
export const CHECKPOINTS = Object.freeze([
  Object.freeze({ id: 'cp1', act: 2, after: 'act1-seal', position: Object.freeze([40, MAIN_Y, -103]) }),
  Object.freeze({ id: 'cp2', act: 3, after: 'wound1', position: Object.freeze([40, MAIN_Y, -190]) }),
  Object.freeze({ id: 'cp3', act: 4, after: 'wound2', position: Object.freeze([80, LOWER_Y, -432]) }),
]);

// Optional forward-exit alcoves: entry door, exit door strictly AHEAD of the
// entry along the route (smaller z on a -Z segment), depth <= 30.
export const ALCOVES = Object.freeze([
  Object.freeze({ id: 'al1', act: 1, side: -1, entryZ: -30, exitZ: -42, depth: 12, contents: ['keycard-spare-1'] }),
  Object.freeze({ id: 'al2', act: 2, side: 1, entryZ: -120, exitZ: -132, depth: 12, contents: ['keycard-spare-2', 'fuel-3'] }),
  Object.freeze({ id: 'al3', act: 3, side: -1, entryZ: -270, exitZ: -282, depth: 12, contents: ['keycard-spare-3', 'vista'] }),
  Object.freeze({ id: 'al4', act: 4, side: 1, entryZ: -445, exitZ: -455, depth: 10, contents: ['fuel-4', 'vista'] }),
]);

// Breach grammar. scripted: progress-triggered, AEGIS-caused, telegraphed,
// seals behind. pre: already torn at level start (identity + starlight).
// type: crown | deck | wound | viewport.
export const BREACHES = Object.freeze([
  // pre-breaches (6)
  Object.freeze({ id: 'p1', type: 'crown', act: 1, segment: 'a1-spine', z: -25, span: 14, scripted: false }),
  Object.freeze({ id: 'p2', type: 'viewport', act: 2, segment: 'a2-spine', z: -130, span: 20, scripted: false }),
  Object.freeze({ id: 'p3', type: 'deck', act: 2, segment: 'a2-field', z: -215, span: 30, scripted: false }),
  Object.freeze({ id: 'p4', type: 'crown', act: 3, segment: 'a3-spine', z: -275, span: 30, scripted: false }),
  Object.freeze({ id: 'w1', type: 'wound', act: 2, segment: 'a2-wound1', z: -167, span: 35, scripted: false }),
  Object.freeze({ id: 'w3', type: 'wound', act: 4, segment: 'a4-approach', z: -452, span: 35, scripted: false }),
  // scripted collapses (9): telegraph 3-5 s, eased animation, seal behind
  Object.freeze({ id: 'c-a1-crown', type: 'crown', act: 1, segment: 'a1-spine', z: -45, span: 8, scripted: true, telegraph: 4, sealBehind: true, demotesTo: 'duct' }),
  Object.freeze({ id: 'c-a1-bulkhead', type: 'crown', act: 1, segment: 'a1-cargo', z: -71, span: 6, scripted: true, telegraph: 3.5, sealBehind: true }),
  Object.freeze({ id: 'c-a2-viewport', type: 'viewport', act: 2, segment: 'a2-spine', z: -110, span: 6, scripted: true, telegraph: 3, sealBehind: false }),
  Object.freeze({ id: 'c-a2-deck', type: 'deck', act: 2, segment: 'a2-field', z: -195, span: 10, scripted: true, telegraph: 4, sealBehind: true }),
  Object.freeze({ id: 'c-a3-crown', type: 'crown', act: 3, segment: 'a3-spine', z: -295, span: 8, scripted: true, telegraph: 4, sealBehind: true }),
  Object.freeze({ id: 'c-a3-deck', type: 'deck', act: 3, segment: 'a3-wound2', z: -390, span: 10, scripted: true, telegraph: 5, sealBehind: true }),
  Object.freeze({ id: 'w2', type: 'wound', act: 3, segment: 'a3-wound2', z: -405, span: 40, scripted: true, telegraph: 5, sealBehind: true, doubleScale: true }),
  Object.freeze({ id: 'c-a4-crown', type: 'crown', act: 4, segment: 'a4-podbay', z: -475, span: 8, scripted: true, telegraph: 4, sealBehind: true }),
  Object.freeze({ id: 'c-a4-viewport', type: 'viewport', act: 4, segment: 'a4-approach', z: -442, span: 6, scripted: true, telegraph: 3, sealBehind: false }),
]);

// Nine-hazard ladder: introduce alone, then combine. role drives act pacing.
export const HAZARDS = Object.freeze([
  Object.freeze({ id: 'h1-debris', type: 'debris-fall', act: 1, role: 'teach', segment: 'a1-spine', z: -25, telegraph: 3, cycle: 6 }),
  Object.freeze({ id: 'h2-steam', type: 'steam-jet', act: 1, role: 'teach', segment: 'a1-spine', z: -38, telegraph: 1.2, cycle: 4 }),
  Object.freeze({ id: 'h3-shutter', type: 'shutter-cycle', act: 1, role: 'test', segment: 'a1-cargo', z: -60, telegraph: 2, cycle: 8, detour: 'duct' }),
  Object.freeze({ id: 'h4-crane', type: 'crane-sweep', act: 1, role: 'combine', segment: 'a1-cargo', z: -60, telegraph: 2, cycle: 9 }),
  Object.freeze({ id: 'h5-pad', type: 'electrified-pad', act: 2, role: 'teach', segment: 'a2-spine', z: -115, telegraph: 1, cycle: 3.5 }),
  Object.freeze({ id: 'h6-planks', type: 'collapsing-planks', act: 2, role: 'test', segment: 'a2-wound1', z: -167, telegraph: 0.8, cycle: 0 }),
  Object.freeze({ id: 'h7-fire', type: 'fire-vent', act: 2, role: 'combine', segment: 'a2-field', z: -205, telegraph: 0, cycle: 0 }),
  Object.freeze({ id: 'h8-purge', type: 'purge-chase', act: 3, role: 'chase', segment: 'a3-purge', z: -330, telegraph: 4, cycle: 0, frontSpeed: 7 }),
  Object.freeze({ id: 'h9-beams', type: 'beam-grid', act: 4, role: 'final', segment: 'a4-podbay', z: -478, telegraph: 1.5, cycle: 5 }),
]);

// Gate economy: NO fuel gates in L3. Keycards (currency, single-use),
// effort (hold-E console), courage (event gate), mastery (clamp exam),
// time (airlock breathing beats).
export const GATES = Object.freeze({
  keycards: Object.freeze([
    Object.freeze({ id: 'kc1', boundary: '1-2', doorSegment: 't1', doorZ: -96, routeCard: Object.freeze([0, MAIN_Y, -89]), spareAlcove: 'al1' }),
    Object.freeze({ id: 'kc2', boundary: '2-3', doorSegment: 't2', doorZ: -237, routeCard: Object.freeze([40, MAIN_Y, -232]), spareAlcove: 'al2' }),
    Object.freeze({ id: 'kc3', boundary: '3-4', doorSegment: 't3', doorZ: -427, routeCard: Object.freeze([80, LOWER_Y, -422]), spareAlcove: 'al3' }),
  ]),
  overrideConsole: Object.freeze({ id: 'override', act: 2, segment: 'a2-wound1', position: Object.freeze([43, MAIN_Y, -187]), stages: 3 }),
  eventGate: Object.freeze({ id: 'purge-door', act: 3, segment: 'a3-core', z: -330, opensOn: 'h8-purge' }),
  clamps: Object.freeze([
    Object.freeze({ id: 'clamp-1', position: Object.freeze([114, MAIN_Y, -478]), guard: 'h9-beams' }),
    Object.freeze({ id: 'clamp-2', position: Object.freeze([126, MAIN_Y, -478]), guard: 'steam-clamp' }),
    Object.freeze({ id: 'clamp-3', position: Object.freeze([120, MAIN_Y, -468]), guard: 'planks-clamp' }),
  ]),
  airlocks: Object.freeze([
    Object.freeze({ id: 'air1', act: 1, segment: 'a1-spine', z: -10, cycle: 6, contains: 'log-1' }),
    Object.freeze({ id: 'air2', act: 3, segment: 'a3-spine', z: -250, cycle: 6, contains: 'log-3' }),
  ]),
});

// Pickups. Fuel cells are live +8 s O2-reserve top-ups on pickup; the
// build-time conversion of unspent L2 fuel uses the same seconds-per-cell.
export const PICKUPS = Object.freeze({
  fuel: Object.freeze([
    Object.freeze({ id: 'fuel-1', act: 1, position: Object.freeze([0, MAIN_Y, -60]) }),
    Object.freeze({ id: 'fuel-2', act: 3, position: Object.freeze([80, LOWER_Y, -290]) }),
    Object.freeze({ id: 'fuel-3', act: 2, alcove: 'al2' }),
    Object.freeze({ id: 'fuel-4', act: 4, alcove: 'al4' }),
  ]),
  canisters: Object.freeze([
    Object.freeze({ id: 'o2-1', act: 2, position: Object.freeze([37, MAIN_Y, -148]) }),
    Object.freeze({ id: 'o2-2', act: 3, position: Object.freeze([77, LOWER_Y, -373]) }),
    Object.freeze({ id: 'o2-3', act: 4, position: Object.freeze([117, MAIN_Y, -433]) }),
  ]),
  logs: Object.freeze([
    Object.freeze({ id: 'log-1', act: 1, place: 'airlock air1' }),
    Object.freeze({ id: 'log-2', act: 2, position: Object.freeze([43, MAIN_Y, -140]) }),
    Object.freeze({ id: 'log-3', act: 3, place: 'airlock air2' }),
    Object.freeze({ id: 'log-4', act: 4, position: Object.freeze([123, MAIN_Y, -440]) }),
    Object.freeze({ id: 'log-5', act: 4, position: Object.freeze([120, MAIN_Y, -505]), content: 'aegis-motive' }),
  ]),
});

// Pressure model (data now; logic in the systems pass).
export const COUNTDOWN = Object.freeze({
  armsAtAct: 3,
  armsAtSegment: 'a3-core',
  seconds: 540, // ~9:00 initial tuning for the remaining ~350 u of route
  pausesWithUi: true,
  rearmsOnCheckpoint: true,
});

export const CARRYOVER = Object.freeze({
  oxygen: Object.freeze({ vacuumDrainMultiplier: 0.5 }),
  gravity: Object.freeze({ telegraphMultiplier: 1.5, fallDamageMultiplier: 0.5 }),
  comms: Object.freeze({ earlyWarningSecs: 2, commsAlcovePerAct: true, clampReadouts: true }),
  fuelToO2: Object.freeze({ secondsPerCell: 8, startingCapSecs: 25 }),
});

// The cue channel Gara's LightingRigL3 consumes; the blockout only emits.
export const LIGHTING_CUE_TYPES = Object.freeze([
  'telegraph',
  'collapse',
  'seal',
  'checkpoint',
  'act',
]);

// The one escalating visual countdown: pod-bay window row crack states.
export const CRACK_STATES = Object.freeze(['hairline', 'spiderweb', 'starred']);

export const SPAWN = Object.freeze({
  position: Object.freeze([0, 1.7, 7]),
  lookAt: Object.freeze([0, 2.5, -18]),
});

// The three-beat launch ending (win trigger = boarding interact). The fixed
// pod-window camera frames the collar receding; the systems pass reads this
// through win-loss-conditions.js — the blockout only marks the spot.
export const ENDING = Object.freeze({
  launchTrigger: Object.freeze({ id: 'pod-boarding', position: Object.freeze([120, MAIN_Y, -498]), radius: 3 }),
  winCamera: Object.freeze({
    position: Object.freeze([120, MAIN_Y + 2.2, -503]),
    lookAt: Object.freeze([120, MAIN_Y + 1.5, -560]),
  }),
  beats: Object.freeze(['collar-recede', 'meltdown-cascade', 'last-signal-card']),
});

// Vertical connections between the two planes (as-is verbs only).
export const PLANE_LINKS = Object.freeze([
  Object.freeze({ id: 'descent-shaft', at: Object.freeze([80, -240]), kind: 'ladder-teleport', from: 'main', to: 'lower' }),
  Object.freeze({ id: 'ascent-shaft', at: Object.freeze([120, -430]), kind: 'ladder-teleport', from: 'lower', to: 'main' }),
]);

export function getSegment(id) {
  return SEGMENTS.find((segment) => segment.id === id) ?? null;
}

export function segmentsOfAct(act) {
  return SEGMENTS.filter((segment) => segment.act === act);
}

/** Route length in units: sum of segment spans (turn chambers included). */
export function totalRouteLength() {
  return SEGMENTS.reduce((sum, segment) => sum + Math.abs(segment.from - segment.to), 0);
}

/** World position of a point on a segment's centreline, given a z or x coord. */
export function pointOnSegment(segment, coord, planeY) {
  const y = planeY ?? (segment.plane === 'lower' ? LOWER_Y : MAIN_Y);
  return segment.axis === 'z' ? [segment.at, y, coord] : [coord, y, segment.at];
}
