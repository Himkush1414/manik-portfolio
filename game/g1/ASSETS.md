# ASSETS — SPACE WAR: DARK EDITION (/game/g1/)

Every shipped third-party asset, with licence. Nothing ships unverified.
Procedural/in-code assets (ship geometry, textures baked at runtime, synthesised
audio) are original work and not listed.

| Asset | Source / URL | Author | Licence | Verified | Used in |
|---|---|---|---|---|---|
| Big Shoulders Display 700/900 | npm `@fontsource/big-shoulders-display` (https://fontsource.org/fonts/big-shoulders-display) | Patric King | SIL OFL 1.1 | 2026-09-30 | title face (logo, ship names) |
| Oxanium 500/600/700 | npm `@fontsource/oxanium` (https://fontsource.org/fonts/oxanium) | Severin Meyer | SIL OFL 1.1 | 2026-09-30 | UI headings |
| JetBrains Mono 400/500 | npm `@fontsource/jetbrains-mono` (https://fontsource.org/fonts/jetbrains-mono) | JetBrains | SIL OFL 1.1 | 2026-09-30 | data / mono labels |
| IBM Plex Sans 400/500 | npm `@fontsource/ibm-plex-sans` (https://fontsource.org/fonts/ibm-plex-sans) | IBM / Mike Abbink | SIL OFL 1.1 | 2026-09-30 | body copy |
| Mr Dafoe 400 | npm `@fontsource/mr-dafoe` (https://fontsource.org/fonts/mr-dafoe) | Sudtipos | SIL OFL 1.1 | 2026-09-30 | signature script |
| Unbounded, Archivo (variable) | npm `@fontsource/unbounded`, `@fontsource-variable/archivo` | NaN / Omnibus-Type | SIL OFL 1.1 | 2026-09-30 | title-face A/B candidates only (not loaded unless chosen) |

Downloaded textures / HDRIs / models / audio: **none** — final for Phase 1
(2026-10-01). Ships, doors, hangar, cockpit and pilots are built in code; every
texture is baked at runtime (canvas / bake worker); every sound is Web Audio
synthesis. CC0 sources reviewed and rejected for the ships: DEV_NOTES §6b.
QA-only tools (not shipped, not dependencies): axe-core (MPL-2.0), passed to
`tools/qa-a11y.mjs` by path.
