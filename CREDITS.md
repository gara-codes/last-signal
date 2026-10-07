# Credits

Everything in this file is something we did not make ourselves. The brief's rule is simple:
**if you didn't make it, list it — the day you use it, not at the end.** Uncredited third-party
work presented as our own is treated as plagiarism, not just a missing line on a screen.

This file is the source of truth. `src/ui/credits.js` must mirror it, since the brief requires
the credits screen to be accessible from _inside_ the game, not just in the repo.

## What needs an entry

Anything that isn't original team work, including:

- 3D models, textures, materials
- Sound effects, music
- Fonts
- Icons / HUD art
- Code libraries, Three.js add-ons or loaders, physics/audio/UI libraries
- Any tutorial, article, video, or code sample you learned from or adapted — even if you
  rewrote most of it yourself

**Gut check:** if you'd feel awkward being asked about it in the demo, credit it. Building on a
library (a physics engine, a loader) is expected and totally fine — it just still needs a line
here, and it won't count toward the Innovation mark the way something we built ourselves would.

## How to add an entry

1. The moment you drop in an asset, install a package, or lean on a tutorial — add a row below.
2. Fill in every column. If a licence doesn't apply (e.g. you can't find one), write "none
   listed" rather than leaving it blank. Don't guess.
3. Whoever added the row also updates `credits.js` in the same commit.

Don't batch this for later. "I'll add it before beta" is how this file goes stale.

---

## Code & libraries

| Item                        | Source / author       | URL                                                      | Licence | Used for                         | Added by (date) |
| --------------------------- | --------------------- | -------------------------------------------------------- | ------- | -------------------------------- | --------------- |
| Three.js                    | Three.js contributors | https://threejs.org                                      | MIT     | Core rendering                   | —               |
| GLTFLoader (Three.js addon) | Three.js contributors | https://threejs.org/docs/#examples/en/loaders/GLTFLoader | MIT     | Loading the astronaut .glb model | —               |

## 3D models

| Item                  | Source / author | URL                                                                                    | Licence       | Used for       | Added by (date) |
| --------------------- | --------------- | -------------------------------------------------------------------------------------- | ------------- | -------------- | --------------- |
| Horror game Astronaut | JCastillo       | https://sketchfab.com/3d-models/horror-game-astronaut-d6ac4001ad4f45aeab498bdde1b7ec5f | Free Standard | Main character | 26-08-2026      |

## Textures & materials

| Item                                     | Source / author | URL                                                                             | Licence     | Used for          | Added by (date) |
| ---------------------------------------- | --------------- | ------------------------------------------------------------------------------- | ----------- | ----------------- | --------------- |
| Old Worn Chipped Painted Metal - PBR0496 | textures.com    | https://www.textures.com/download/old-worn-chipped-painted-metal-pbr0496/138834 | IP-Warranty | Spaceship pillar  | —               |
| Concrete Energy Pole - PBR0283           | textures.com    | https://www.textures.com/download/concrete-energy-pole-pbr0283/136381           | IP-Warranty | Spaceship texture |

## Audio — sound effects & music

| Item | Source / author | URL | Licence | Used for | Added by (date) |
| ---- | --------------- | --- | ------- | -------- | --------------- |
| —    | —               | —   | —       | —        | —               |

## Fonts

| Item          | Source / author | URL                                             | Licence                   | Used for                                                          | Added by (date) |
| ------------- | --------------- | ----------------------------------------------- | ------------------------- | ----------------------------------------------------------------- | --------------- |
| Rajdhani      | Google Fonts    | https://fonts.google.com/specimen/Rajdhani      | SIL Open Font License 1.1 | Headers & section labels (credits screen; planned HUD label font) | 30-08-2026      |
| Source Sans 3 | Google Fonts    | https://fonts.google.com/specimen/Source+Sans+3 | SIL Open Font License 1.1 | Body text (credits button & panel copy; planned UI body font)     | 30-08-2026      |
| IBM Plex Mono | Google Fonts    | https://fonts.google.com/specimen/IBM+Plex+Mono | SIL Open Font License 1.1 | Data / numeric readouts (loaded now — applied once HUD is built)  | 30-08-2026      |

## Icons / HUD art

| Item | Source / author | URL | Licence | Used for | Added by (date) |
| ---- | --------------- | --- | ------- | -------- | --------------- |
| —    | —               | —   | —       | —        | —               |

## Design references (inspiration only — nothing copied into the game)

Artwork we studied while designing our own UI. None of it ships with the game: every panel was
redrawn from our own wireframes. Listed because it shaped the look.

| Item                              | Source / author         | URL                                       | Licence                                           | Used for                                                                                                   | Added by (date)      |
| --------------------------------- | ----------------------- | ----------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------- |
| HUD - Relativity (preview images) | RD Studios (ArtStation) | https://www.artstation.com/artwork/8l3AlR | None listed — paid template; previews viewed only | Visual reference for the L2 repair consoles, log overlay tabs and Comms waveform (own wireframes, redrawn) | Shannon (03-10-2026) |

## Tutorials, articles, videos & adapted code

| What it covers | Source / author | URL | Used for | Added by (date) |
| -------------- | --------------- | --- | -------- | --------------- |
| GLSL sin/fract hash and 2D value noise (chapters 10 and 11) | The Book of Shaders — Patricio Gonzalez Vivo & Jen Lowe | https://thebookofshaders.com/11/ | rand() hash in the project's custom shaders; valueNoise() for the dissolve threshold (technique learned, code our own) | Natasha (06-10-2026) |

---

## Licence quick reference

| Licence                                    | What it requires                                                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| CC0                                        | No attribution legally required — list it anyway for transparency                                                           |
| CC BY                                      | Must credit author + source, as done above                                                                                  |
| CC BY-SA                                   | Credit required; if you redistribute a modified version separately, it must carry the same licence (unlikely to apply here) |
| MIT / Apache 2.0                           | Credit + keep the licence notice available (this table satisfies that)                                                      |
| OFL (fonts)                                | Credit the font name + source; no need to embed the licence text itself                                                     |
| "Free" on itch.io with no explicit licence | Treat as "all rights reserved, free to use" — credit it and note "no licence listed"                                        |

If you can't tell which licence applies, don't guess — ask in the group chat before using the asset.

---

_Shannon owns this file's upkeep and the in-game credits screen, but everyone adds their own
entries as they go — don't hand this off to be reconstructed from memory at the end._
