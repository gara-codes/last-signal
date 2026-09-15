# Yannis — Gameplay / Level Design

**Supported by Alex (Controls & Physics), Nikki (Camera)**  
**Alpha: 1 September · Beta: 16 October**

---

## Documentation

**Level differentiators** (one sentence each, per the brief):

- **L1 – Habitation Ring:** A safe exploration tutorial where the player learns the fuel-cell and door mechanics under clean, sterile lighting while the AI watches passively as a static camera — no threats, no timers, just atmosphere and a single subtle flicker that something is off.
- **L2 – Engineering Core:** A resource-management gauntlet under constant pressure — oxygen drains continuously, gravity snap-backs strike on a telegraph-and-react cycle, and the AI actively tracks the player — where the real choice is which ship systems to repair with scarce fuel cells, and those choices carry consequences into Level 3.
- **L3 – Docking Corridor:** A reactive obstacle course against a meltdown countdown — the AI is openly hostile and weaponises hull breaches to flip gravity on the player, debris is scripted and telegraphed, and the only objective is reaching the escape pod before time runs out.

**L1 design spec:** The player wakes to a garbled transmission, then explores the cylindrical habitation ring. The core loop is: find fuel cells → activate a power panel → unlock a blast door → interact to open it → progress deeper. The AI terminal (HAL 9000) sits on the wall past the pod bays with its emergency-lighting shader eye flickering as the player approaches — the only "something's off" tell. Three environmental storytelling props reward exploration (corrupted logbook, glitch door, wall status log). The level has no fail state; the player cannot die here. Blast door one is gated by a `DoorGate` fuel cost. The transit room at the bottom of the ring houses the L2 exit door. Unspent fuel cells are banked and persist into L2 as the player's starting power reserve.

**Key systems owned:**

| System | File | Role |
|---|---|---|
| Door system | `door-system.js` | `createDoor(id, onOpen)` — locked → unlocked → opening → open state machine, slides panel up over 1.2s. `createPowerPanel(id, linkedDoors)` — activates and unlocks linked doors. `updateInteractables(list, delta)` — drives all per-frame updates. |
| Door gate | `door-gate.js` | `DoorGate(id, cost)` — wraps `fuelSystem.spend(cost)` to gate progression. Same pattern reused in L1 and L2. |
| Fuel system | `fuel-system.js` | `FuelSystem(startingReserve)` — `pickup(amount)`, `spend(amount)`, `canAfford(amount)`, `banked` getter for cross-level persistence. |
| Power allocation | `power-allocation.js` | Empty — Layer 2 design task. Player allocates a shared power budget across competing ship systems. Alex implements; you own the design. |
| Win/loss conditions | `win-loss-conditions.js` | Empty — needs L1 win trigger (reach L2 exit door) and eventually L3 countdown/escape-pod condition. |

**L1 → L2 transition beat (4 steps):**
1. Door opens; hum/static gets louder (Shannon — audio)
2. Brief power dip on L1 lights as door draws current (Gara — lighting)
3. Camera holds or slow-pans into darker space (Nikki — camera)
4. Optional one-line alert about life-support fault (text or audio)

**Open decisions to lock in (per design doc):**
1. Ship name (Halcyon) and AI name (AEGIS) — or team's picks
2. AI-glitch messaging timing: confirm no tracking/hazards in L1, ambiguous tonal shift in L2, full reveal only in L2→L3 transition
3. L3 target tier for beta: Tier 1 is the floor — commit to Tier 2?
4. Backstory fragments: fully written vs. left ambiguous

---

## Planning — build order

| Step | Task | Est. |
|---|---|---|
| 1 | L1 blockout — outer ring, pillar, pod bays, HAL 9000, blast doors, transit room | done |
| 2 | Fuel cell pickups — place collectable meshes in ring, tutorial cell near spawn + extras off-path | 2–3h |
| 3 | Wire blast door one to DoorGate — replace static mesh with `createDoor()` + fuel cost | 1–2h |
| 4 | Power panel integration — place `createPowerPanel()` near locked doors | 1–2h |
| 5 | Update loop — collect interactables, call `updateInteractables()` in `level1.update()` | 30min |
| 6 | Input interact binding — E key triggers `userData.interact()` on nearest interactable (with Alex) | 1–2h |
| 7 | Win condition — reach L2 exit door = level complete, implement in `win-loss-conditions.js` | 1–2h |
| 8 | Fuel bank persistence — capture `fuelSystem.banked` on L1 complete, pass to L2 init | 1h |
| 9 | Environmental storytelling props — logbook, glitch door, wall status log | 2h |
| 10 | L1→L2 transition beat — orchestrate lights/camera/audio dip (with Gara, Nikki, Shannon) | 2h |
| 11 | Power allocation design — trade-off system spec for L2 (you design, Alex implements) | 4–6h |
| 12 | System repair allocation design — 3-slot repair system (Oxygen/Gravity/Comms) flags for L3 | 3–4h |
| 13 | L2 blockout — Engineering Core geometry, amber lighting identity | 6h |
| 14 | L2 progression door gate — reuse `DoorGate`, same pattern as L1 | 1h |
| 15 | L2 system repair stations — 3 interactable terminals in the environment | 3h |

**Alpha commitment (steps 1–7):** playable L1 loop where the player explores, collects fuel, opens doors, and reaches the exit.

**Beta target (steps 8–15):** L1 polished with persistence and storytelling, L2 blockout with resource management choice layer.

---

## Sketch

```
                        L1 — Habitation Ring (top-down cross-section)
                        ─────────────────────────────────────────────

                                    ╭──── Outer Ring Wall ────╮
                                    │    (R=31, H=20, textured)│
                                    │                          │
                              pod   │   ★ fuel cell (off-path) │
                              bays  │                          │
                             ◉ ◉ ◉ │                          │
                                    │                          │
                                    │     HAL 9000  ◉          │
                                    │   (wall-mounted,         │
                                    │    flicker shader eye)   │
                                    │                          │
              ┌─────────┐          │                          │
              │ Transit │          │   ★ fuel cell            │
              │  Room   │          │                          │
              │ (exit   │          │                          │
              │  door)  │◄─────────┤   BLAST DOOR ONE         │
              │         │          │   (DoorGate, fuel cost)  │
              └────┬────┘          │                          │
                   │               │                          │
              exit door            │   ◈ power panel          │
              (→ L2)              │                          │
                                    │                          │
                                    │       ╭───╮              │
                                    │       │ P │ Central      │
                                    │       │ I │ Pillar       │
                                    │       │ L │ (R≈6)        │
                                    │       │ L │              │
                                    │       │ A │              │
                                    │       ╰───╯              │
                                    │                          │
                              ★ fuel cell (tutorial, near spawn)
                                    │                          │
                                    ╰──────────────────────────╯

  Legend:  ◉ = pod bay / interactable    ★ = fuel cell pickup
          ◈ = power panel               ╭╮ = structural element
```

```
                        L1 Escalation Context (all three levels)
                        ────────────────────────────────────────

          L1 Habitation Ring      L2 Engineering Core     L3 Docking Corridor
          ─────────────────       ───────────────────     ───────────────────
          AI: static, passive     AI: tracks player       AI: openly hostile
          Light: white/clean      Light: amber/dark       Light: red/strobe
          Move: standard          Move: low-g + zero-g    Move: grounded + chaos
          Threat: none            Threat: O2 + gravity    Threat: countdown + debris
          Challenge: exploration  Challenge: resource mgmt Challenge: reactive survival
          Objective: reach L2     Objective: cmd center    Objective: escape pod
```

---

## Logic Flow

**Door / fuel-cell interaction loop (L1 core mechanic):**

```
   Player approaches
   interactable (E key)
          │
          ▼
   ┌──────────────┐     no      ┌──────────────┐
   │ Is it a fuel  ├────────────►│ Is it a power │
   │ cell pickup?  │             │ panel?        │
   └──────┬───────┘             └──────┬───────┘
          │ yes                        │ yes
          ▼                            ▼
   fuelSystem.pickup(1)         panel.activated = true
   remove mesh from scene       panel material → active (green)
          │                     linked doors → unlock()
          │                     door material → unlocked (green)
          ▼                            │
   return to play                      │
                                       ▼
                              Player approaches
                              unlocked door (E key)
                                       │
                                       ▼
                              door.state = 'opening'
                              slide panel up (1.2s)
                                       │
                                       ▼
                              ┌────────────────┐
                              │ onOpen callback │
                              │ (if registered) │
                              └────────┬───────┘
                                       │
                                       ▼
                              ┌────────────────────┐     no     ┌───────────┐
                              │ Is this the L2 exit ├────────────►│ Continue  │
                              │ door?               │             │ playing   │
                              └────────┬────────────┘             └───────────┘
                                       │ yes
                                       ▼
                              Trigger L1→L2 transition:
                              1. Audio hum/static louder
                              2. L1 lights power-dip
                              3. Camera slow-pan
                              4. Bank fuelSystem.banked → L2
```

**Fuel-cell economy across levels:**

```
   L1 pickups                L1 doors              L1→L2
   (collect N cells) ──────► (spend to open) ──────► bank remainder
                                                         │
                                                         ▼
                                                  L2 starting reserve
                                                         │
                                          ┌──────────────┼──────────────┐
                                          ▼              ▼              ▼
                                   L2 progression   System repairs  L2→L3 carry
                                   doors (mandatory) (O2/Grav/Comms) (flags)
```
