# SPACE WAR: DARK EDITION — DEV NOTES

Source of truth for `/game/g1/`. A fresh session must be able to resume from
this file alone. Updated after every slice.

---

## 0. Status (update every slice)

| Slice | Status | Notes |
|---|---|---|
| Plan | DONE | this file |
| 1A Foundation | DONE | lookdev gate renders full post stack; 26 unit tests; prod build isolated |
| 1B Boot + BlastDoors | IN PROGRESS | BlastDoors DONE (geometry, PBR bakes, motion, FX, API, ?screen=doors); boot timeline next |
| 1C Ship pipeline | — | |
| 1D Hangar scene | — | |
| 1E Hangar UI + pilots + story | — | |
| 1F Upgrades / Settings / Save | — | |
| 1G Cockpit + camera select | — | |
| 1H QA / polish / perf | — | |

**Next step:** see the first slice not marked DONE above; its sub-steps are in §5.

---

## 1. Process decisions (logged per brief §1 "decide, then log")

1. **Git: checkpoint pushes are ON.** The Phase 1 brief says "no git of any
   kind", but the owner's standing *Direction Guide* (sent before Phase 1,
   covering every phase) requires a push to `origin main` after every real,
   verified checkpoint, with a mandatory gate (build/typecheck clean →
   load `/game/g1/` + screenshot the new thing → confirm nothing outside
   `game/g1/` changed → commit → verify SHA). The guide is the more specific,
   explicitly cross-phase instruction, so it wins. Author identity is the
   repo's existing `Himkush1414 <light.dark14143@gmail.com>`.
2. **Isolation: nested package.** `game/g1/package.json` owns every game-only
   dependency (installed into `game/g1/node_modules`, git-ignored by the root
   `node_modules` rule). The portfolio's `package.json` / lockfile are
   untouched. **Exception, by necessity:** `react`, `react-dom`, `three`,
   `gsap`, `@gsap/react` are declared as *peerDependencies* and resolve to the
   portfolio's already-installed copies (identical versions). A nested second
   physical copy broke the dev server: Vite's single dep-optimizer loaded two
   React instances ("Invalid hook call") and two three.js instances. With
   `legacy-peer-deps=true` (game/g1/.npmrc) npm never re-installs them nested,
   and `overrides: { stats-gl: ^4 }` stops drei's old stats-gl from pulling a
   private three@0.170. Result: exactly one copy of each on every page. Read-only
   use of installed packages; no portfolio file is imported or modified.
3. **Shared edit: root `vite.config.js`** (logged exception) —
   (a) `/game/g1/` added to the dev redirect list so the slash-less URL doesn't
   fall through to the portfolio's SPA fallback; (b) a 10-line `gameG1Build`
   plugin that, after the portfolio build, runs `game/g1/vite.config.ts` as a
   SEPARATE build into `dist/game/g1/`. First attempt registered the page as a
   rollup input instead, but then the game and portfolio shared one three.js
   chunk and the portfolio's grew 505 KB → 684 KB (verified); separate graphs
   keep the portfolio byte-identical. Dev needs nothing (Vite serves
   `game/g1/index.html` at `/game/g1/`).
4. **Versions matched to the portfolio, not "latest".** The brief says match
   R3F/React/three peer ranges to the portfolio's React (18.3.1). R3F 9 /
   drei 10 require React 19, so the R3F 8 line is used. Pinning the exact same
   `react`, `react-dom`, `three`, `gsap`, `@gsap/react` versions as the root also
   neutralises a real dev-server hazard: Vite's dep optimizer keys pre-bundled
   deps by bare id (`react`, `three`), so two different versions under one root
   dev server could cross-contaminate the portfolio and the game in dev.
   Identical versions make any collision benign.
5. **TypeScript 5.9.3** (same as root) rather than npm-latest 7.x (native Go
   port): tooling (vitest, @types) is validated against 5.x; no feature needed.
6. **Playwright uses the system Chrome** (`channel: 'chrome'`,
   `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`) — no 150 MB browser download; headless
   software WebGL (SwiftShader) is used for visuals only (brief §18).
7. **Vitest** needs Vite ≥ 6 as a peer; a nested `vite` devDependency serves
   only the test runner. The app itself always runs on the portfolio's Vite 5.

## 2. Stack (installed versions)

| Area | Package | Version | Why |
|---|---|---|---|
| UI runtime | react / react-dom | 18.3.1 | = portfolio |
| 3D | three | 0.169.0 | = portfolio; WebGL2 |
| 3D | @react-three/fiber | 8.18.0 | React-18 line |
| 3D | @react-three/drei | 9.122.0 | R3F-8 line (Lightformer, Environment, MeshReflectorMaterial, View, PerformanceMonitor) |
| Post | @react-three/postprocessing | 2.19.1 | R3F-8 line; ships N8AO |
| Post | postprocessing | ^6.39 | HalfFloat HDR, mipmap Bloom, SMAA |
| Shading | three-custom-shader-material | 6.4.0 | livery/dissolve/hologram on MeshPhysicalMaterial |
| Geometry | three-bvh-csg / three-mesh-bvh | 0.0.17 / 0.9.x | boolean cuts |
| Motion | gsap + @gsap/react | 3.15.0 / 2.1.2 | master timeline, SplitText (free since 3.13) |
| Motion | motion | 13.x | React UI presence |
| Motion | maath | 0.10.x | damped springs, noise |
| State | zustand | 5.x | stores + persist |
| Dev | leva, stats-gl, detect-gpu | latest | tuning (dev only), fps, tiering |
| Test | vitest, playwright | latest | unit + visual QA |
| Fonts | @fontsource/* | 5.x | self-hosted |

(Exact resolved versions: `game/g1/package-lock.json`.)

## 3. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Headless SwiftShader too slow for full post stack | QA screenshots time out | QA drives `boot.seek(t)` + fixed frames; perf judged from `renderer.info` budgets |
| Procedural ships look "code-art" | P0 visual failure | 3-pass iteration per ship with 5-angle renders + checklist; lofted super-ellipse hulls, CSG detail, real PBR + studio lightformers |
| CSG cost at load | boot hitch | build all ships during boot beats 1–3 (honest loading), cache geometry, merge per material |
| Transparency sorting (glass/holo/particles) | artefacts | explicit renderOrder, depthWrite false, separate passes |
| Memory leaks across hangar↔cockpit | heap growth | disposables registry per scene; soak test 20 round-trips |
| Colour-space / double tone mapping | washed or crushed image | ONE tone map in the post chain; renderer NoToneMapping; emissive toneMapped=false |
| Font swap reflow during SplitText | broken letter reveal | await `document.fonts.ready` before t=0 |
| Dev-server dep collision with portfolio | cross-app breakage | identical shared versions (§1.4); verify THREE.REVISION on both apps in dev |

## 4. Architecture (brief §5, implemented)

```
game/g1/
  index.html  DEV_NOTES.md  ASSETS.md  package.json  tsconfig.json  vitest.config.ts
  public/     qa/ (screens)  tools/ (qa scripts)
  src/ main.tsx | app/ core/ state/ input/ audio/ render/ scenes/ ships/ pilots/ ui/ data/ debug/ tests/
```
Rules: render never imports UI; UI reads stores only; stores never import
components; tunables in `data/*.ts`; per-frame logic in refs + `useFrame`.

## 5. Slice plan

- **1A Foundation** — scaffold, deps, isolation check (dev + build), tokens.css,
  palette.ts, core (bus, rng, disposables), stores (settings, profile + persist
  + migrations), FSM, AudioBus, CanvasRoot + PostFX + quality manager, debug API
  `window.__G1__`, QA harness. GATE: lit scene + full post stack, screenshot.
- **1B** Boot timeline (5 beats, honest loader) + BlastDoors (geometry, material,
  motion, FX, API).
- **1C** ShipFactory (loft, wings, CSG, greebles, engines, canopy, paint CSM)
  → HALCYON hero (3 passes) → 5 others → hologram / dissolve / thumbnails.
- **1D** Hangar bay, pad, lighting, reflector floor, turntable controller.
- **1E** Hangar UI (top bar, inventory, under-ship block, briefing/codex,
  START MISSION), pilots (busts), lore.
- **1F** Upgrades modal, Settings modal (5 tabs, rebinding), save/reset.
- **1G** Cockpit (interior, MFDs, mirrors, tunnel), bulkhead transition,
  briefing hologram, camera selector, standby, ESC back.
- **1H** Full QA protocol §18, perf pass, final report.

## 6. Ship design intent (6 lines each, written before modelling)

**01 HALCYON — Multirole (hero).** Wide arrowhead delta read from above as a
single confident chevron; shark nose + chin cannon pod give it a face.
Tall ridged dorsal spine carrying the Ignition stripe = its signature line.
Forward-swept canards + twin canted rudders break the delta so the side view
is never a slab. Twin annular nozzles, iridescent heat rings. Petal fold-lines
on the wings create panel rhythm. ~14u long, ~13u span; balanced mass.

**02 VESPER — Interceptor.** A needle: longest nose-to-length ratio of the six.
Narrow, hard-swept wings with triangular cut-outs; nothing wider than it has to
be. One oversized central engine with a long exhaust ring — the tail is the
heaviest part. Wing pylons. Lowest profile of all; reads as "fast and fragile".

**03 BASILISK — Heavy gunship.** A wide, flat armoured wedge; blunt prow with a
heavy brow ridge over the canopy. Thick straight wings carrying big weapon pods.
2×2 engine cluster, dorsal turret. Hazard-striped armour plates. Reads heavy
from any angle: tallest, widest, least swept.

**04 NOCTURNE — Stealth striker.** Faceted flying wing — every surface planar,
no curvature. Buried slit engines, weapon-bay seams, Nebula-violet emissive
edge strips tracing the facets. Silhouette = a flattened diamond/bat.

**05 TEMPEST — Strike racer.** Pod-and-boom: compact cockpit pod forward, twin
booms sweeping back to one huge rear annular ion drive; short forward-swept
wings. Negative space between the booms is its signature.

**06 OBSIDIAN CROWN — Dark flagship.** Black obsidian-glass spear fuselage with
molten Ignition fissures; a crown of five swept spikes (wings + tail fins)
radiating from the centre; floating shard fragments orbiting slowly; ember motes.

## 7. Phase 1 → Phase 2 handoff contract

(Kept stable; filled in with exact signatures as slices land.)
- `ShipFactory.build(shipId, { livery, lod })` → `{ group, hardpoints, dispose() }`
- `BlastDoors { open(), close(), progress, seek(t), events }`
- flow FSM events `START_MISSION`, `CAMERA_CHOSEN`, `LAUNCH`, `ABORT_TO_HANGAR`
- `useSettings` / `useProfile`; `InputAction` + default bindings + conflicts
- `AudioBus` + sfx names; `postfx.pulse / setTransitionBlur / setExposure`
- `CameraShaker`, `BlurDissolve`, `MirrorRig`; `CameraMode` + `CameraRig`
- `data/lore.ts, ships.ts, upgrades.ts, unlocks.ts, liveries.ts`

## 8. Engine notes (things a future session must know)

- **Shader log handling:** three's `checkShaderErrors` is OFF (three's own
  production advice) because ANGLE/D3D prints benign compiler notes for N8AO's
  shader (X3595) that three dumps as console warnings. `debug/shaderCheck.ts`
  replaces it: checks LINK_STATUS once per new program and logs real failures.
- **Post chain order:** RenderPass → N8AO → TransitionBlur (disabled at 0) →
  main EffectPass [DOF, Bloom, CA, Exposure, ToneMapping(AgX), Vignette, Noise].
  The main pass must stay LAST: postprocessing only sends the final pass to
  screen, and a disabled last pass = black frame (hit in 1A).
- **Case-insensitive FS (Windows):** `postfx.ts` vs `PostFX.tsx` collided; the
  controller lives in `render/fxController.ts` (export `postfx`).
- **@fontsource imports** use `@fontsource/<family>/<weight>` (no `.css`; the
  package exports map appends it).
- **QA tooling:** `tools/shot.mjs <url> <out.png> [--gpu] [--save '{"ao":false}']`
  — Playwright + system Chrome. `--gpu` runs headless on the real GPU via
  ANGLE/D3D11 (this machine: Intel UHD 770), so fps/draw-call numbers are real.
- **Dev port for QA:** 5199 (5173 left free for the owner's own dev server).
- **Perf (1A lookdev, 1920×1080, HIGH, Intel UHD 770 iGPU):** 35 draw calls,
  18.4k tris, 45–60 fps with AO + DOF + bloom.

- **Blast doors (1B):** `scenes/shared/BlastDoors.tsx` (view) + `doors/DoorController.ts`
  (motion/events, nestable tweens, `seek`) + `doors/doorAssets.ts` (built by the
  loader's `geometry` task; canvas bakes: `render/tex/metalSet.ts`,
  `render/tex/decalAtlas.ts`). ~44k tris. Door at z=38 (`sceneBridge.DOOR_Z`).
  QA: `?screen=doors` + `__G1__.doors.seek(p)`.
- **GLSL rule:** clamp every `pow()` base derived from varyings. With MSAA the
  GPU can extrapolate varyings just outside a triangle; `pow(negative, y)` is
  NaN on D3D and bloom spreads a single NaN pixel to a full black frame (hit
  in 1B by the god-ray shader).
- **Rivet mirroring:** never mirror instance matrices with negative scale (the
  instance gets back-face culled); mirror the translation only.
- **Spot-light targets** must be in the scene graph (`<primitive object={t}/>` +
  `target={t}`), otherwise they silently aim at the world origin.
- **Audio:** the AudioContext is created on the first gesture (or at load if
  `navigator.getAutoplayPolicy('audiocontext') === 'allowed'`) — creating it
  earlier logs a Chrome autoplay warning.
- **Key light is a SpotLight** aimed at the pad, not directional, so it never
  lights the bay doors' outer face (doors are lit by beacons + corridor light).

## 9. Known issues

- Lookdev deck still reads slightly blue from IBL irradiance — irrelevant (the
  real hangar floor is a tuned reflector in 1D).
