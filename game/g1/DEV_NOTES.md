# SPACE WAR: DARK EDITION — DEV NOTES

Source of truth for `/game/g1/`. A fresh session must be able to resume from
this file alone. Updated after every slice.

---

## 0. Status (update every slice)

| Slice | Status | Notes |
|---|---|---|
| Plan | DONE | this file |
| 1A Foundation | DONE | lookdev gate renders full post stack; 26 unit tests; prod build isolated |
| 1B Boot + BlastDoors | DONE | BlastDoors + full 5-beat boot timeline, honest loader, skip, reduced motion |
| 1C Ship pipeline | DONE | ShipFactory + bake worker, six ships (HALCYON 5 passes, others 3 / TEMPEST 1 — §8), hologram, dissolve swap, thumbnails, LOD tests, silhouette test PASS |
| 1D Hangar scene | DONE | bay, reflective deck, vista, pad, turntable + camera, bay life, parked fighters, contact shadow; six ships verified on the pad (`?ship=` deep link) |
| 1E Hangar UI + pilots + story | DONE | lore, HUD primitives, hangar overlay, purchase flow, live pilot busts (worker), hangar ambience, keyboard/a11y pass |
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

## 6b. Ship asset decision (brief §10 time-box) — 2026-09-30

Searched CC0 sources for an AAA-grade fighter: Quaternius (Spaceship pack,
Ultimate Space Kit — https://poly.pizza/m/Jqfed124pQ,
https://sketchfab.com/3d-models/ultimate-space-kit-84c108ff2bcf4d4cbf2adff74a942822),
Kenney space kits, OpenGameArt "LowPoly Spaceships Pack", Poly Haven (no ships).
All are stylised low-poly kits — explicitly disallowed as heroes. DECISION: all
six ships are built in code by the ShipFactory (lofted hulls, faceted wings,
lathed engines, real groove panel lines, CSM paint). CC0 only for textures /
HDRIs / kit parts if ever needed (none used so far).

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
  main EffectPass [CA, DOF, Bloom, Exposure, ToneMapping(AgX), Vignette, Noise].
  Transition blur runs BEFORE the main pass (HDR, pre-tone-map).
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
- **Case-insensitive FS, again:** `bootFx.ts` vs `BootFX.tsx` collided; params live in `scenes/boot/bootFxParams.ts`. Rule: never have two files differing only by case.
- **Double-encoded clear colour (critical, fixed in 1B):** with postprocessing,
  the RenderPass clears its linear HalfFloat buffer via `renderer.clear()`,
  which reuses the GL clear value three last set for the SCREEN (sRGB-encoded);
  the final pass encodes again → every empty pixel of `#04050A` rendered as
  `#050F2B` navy (measured: grey #808080 → #BBBBBB). Fix: the void colour is
  `scene.background` (cleared per target in the right space). Found by pixel
  probes (`tools/_probe.mjs` pattern: sample a 4×4 clip after `boot.seek`).
- **Tone mapping A/B (brief §2) — WINNER: AgX.** Compared by screenshot at boot
  t=2.0 and the hangar view AFTER the clear-colour fix (the earlier A/B was
  invalid — both were lifted by the double encode). Neutral keeps hue in
  highlights but pushes the Nebula/violet rim + floor to saturated purple (an
  art-bible anti-pattern); AgX gives restrained, filmic saturation and
  white-hot Ignition cores, matching "cold vacuum, one burning colour".
  Setting: `data/render.config.ts` POST.toneMapping.
- **Boot sequence (1B):** DOM layers `ui/screens/boot/BootSequence.tsx` (pure
  view) + master timeline `app/choreo/bootTimeline.ts` + WebGL FX
  `scenes/boot/BootFX.tsx` (params in `bootFxParams.ts`, layer 1). Rule: every
  visual state is a TWEENED property so `__G1__.boot.seek(t)` renders exactly
  (callbacks only for FSM beats/audio). The loading beat is an `addPause`
  resumed by the real loader (`core/loader.ts`). Nested tweens must NOT be
  created `paused` (a paused child never renders on parent seek). `stage.world`
  (tweened 0/1) switches the camera layer mask from boot-FX-only to the world.
  Measured: full run 12.15 s, skip → loading → doors at 1.25x, reduced motion
  5.7 s. QA: `tools/qa-boot.mjs` (15 seek frames), `tools/qa-bootflow.mjs`
  (real-time full / skip / reduced).
- **GSAP + CSS transforms:** never give an element a CSS transform that GSAP
  will also tween (GSAP folds it into px and the yPercent tween stacks on top);
  set the initial offset with gsap.set instead (letterbox bars).

- **Ship pipeline (1C):** `ships/ShipFactory.ts` (`build(id,{livery,lod})`,
  geometry cached per ship+LOD, built by the loader's geometry task),
  `ships/geom/` (loft = lofted super-ellipse hull with real groove panel
  lines; wing = faceted wing/canard/fin with flap + petal fold grooves; parts =
  lathed engines, canopy loft + frames + pilot, pods, intakes, greebles;
  finalize/curvature = baked edge wear + soot), `ships/materials/hullPaint.ts`
  (CSM paint: zones, 5 finishes, wear, soot, panel lines, repaint band,
  dissolve). QA: `tools/qa-ship.mjs <ship> <tag> [--livery n]` renders the 5
  iteration angles (3/4, side, top, rear, low front).
- **HALCYON iteration log:** p1 generic jet silhouette, floating wingtip guns,
  engines buried in a flat tail, chrome look → p2 strake-blended arrowhead,
  protruding engines, guns on the tip chord → p3 sunk canopy, taller spine,
  side intakes, narrower lightformer strips → p4 FIX: boxy super-ellipse gave
  the narrow ridge only 2-3 vertices (interpolated into a wide dome) — extra
  ring samples placed by x across the ridge; clearcoat roughness ≥ 0.1 kills
  point-light glint flares → p5 smoother ridge ramp, subtler wear + flake.
  44.9k tris, 12 draw calls for the ship.
- **Other five ships (1C):** extensions — `ShipSpec.bodies` (secondary lofted
  hulls, mirrored: TEMPEST booms), `hull.faceted` (flat-shaded loft, low
  radial count: NOCTURNE), `emissiveTrim: 'nebula-edges'` (tube strips on
  every wing leading/trailing edge), `'ember-fissures'` (hull-paint `uFissure`:
  ridged-noise veins gated by a low-frequency mask, pulsing), `shards`
  (OBSIDIAN orbiting obsidian fragments + ember mote Points), `wear` (per-spec
  edge-wear scale). Iteration log: VESPER p1 hidden nose guns + repulsors
  poking out of the thin nose → p2 guns at the wing roots, pods behind the
  leading edge → p3 single centreline nose repulsor (35.7k tris). BASILISK
  p1 vertex-resolution hazard stripes aliased, "toilet-bowl" white prow, buried
  canopy → p2 solid armour plates with an accent band, dark prow cap, lowered
  brow so the canopy reads, bigger wing pods → p3 accepted (40.0k). NOCTURNE p1
  wear blotches on the flat wing + notched trailing edge → p2 `wear: 0.35`,
  straight trailing edge; leads with the VOID livery (see below) (10.4k — the
  faceted hull is intentionally low-poly). TEMPEST p1 accepted after 5-view
  review: the boom gap + one huge ion drive read at every angle (37.3k).
  OBSIDIAN p1 fissures covered everything (lava lamp) → p2 masked too hard
  (gone) → p3 mask 0.36-0.58, pow 36: sparse cracks; shards darkened (37.8k).
- **Hologram + dissolve swap (1C):** `ships/materials/hologram.ts` (ice:
  fresnel + object-space scanlines + z sweep + flicker, additive). It MUST
  write depth: DOF reads depth, and a depth-less hologram was blurred as if
  it were the floor behind it (also hides inner surfaces — no milky
  overdraw). `BuiltShip.setHologram(on)` swaps every solid mesh to it (engine
  glow, nav lights, motes hidden; shadows off). Same dissolve noise as the hull
  paint. `ShipDisplay` swap: dissolve out 0.4 s → rebuild → dissolve in
  0.55 s; resumes from the current value on fast re-selection; instant under
  reduced motion; the dissolve-in flag survives StrictMode effect replays.
  Locked = `unlockState(ship, profile).unlocked === false`.
  QA: `tools/qa-holo.mjs [origin]`.
- **Thumbnails (1C):** `render/thumbnails.ts` `shipThumbnail(id,{livery,
  locked, silhouette})` → PNG blob URL, cached, queued one at a time. Main
  renderer (a second context would recompile every ship program), LOD1,
  HalfFloat MSAA target → AgX + sRGB fullscreen pass (unpremultiplies MSAA
  edges) → 8-bit target → readPixels (row flip) → PNG. Own key/rim/hemi
  lights + the world's PMREM environment; framing tightened from the
  projected bounding-box corners. ~0.4 s per ship incl. first compile — the
  hangar UI (1E) must request them from idle time, never on a click.
  QA: `tools/qa-thumbs.mjs` (sheet, locked sheet, silhouettes).
- **Silhouette test (brief §10) — PASS (2026-09-30):** all six from one 3/4
  view, flat black on white (`qa/1c-silhouettes.png`): HALCYON arrowhead +
  canards/twin fins, VESPER needle with a heavy tail, BASILISK wide block with
  pods, NOCTURNE flat bat/diamond, TEMPEST pod + booms with the gap, OBSIDIAN
  spike crown. Closest pair HALCYON / NOCTURNE (both deltas) still split by
  fins, canards and thickness.
- **LOD budgets (unit-tested, `tests/shiplod.test.ts`):** LOD0 ≤ 60k, LOD1 ≤
  60 % of LOD0. Measured LOD0/LOD1: HALCYON 44.9k/13.3k, VESPER 35.7k/10.4k,
  BASILISK 40.0k/13.5k, NOCTURNE 10.4k/5.8k, TEMPEST 37.3k/11.2k, OBSIDIAN
  37.8k/11.7k.
- **Per-ship livery order:** liveries are index-addressed per ship
  (`liveriesFor`). OBSIDIAN leads with its exclusive EMBER FORGE; NOCTURNE
  leads with VOID so the stealth ship is dark by default. Same five liveries,
  only the order differs.
- **Ship preload:** only the selected ship (both LODs) gates the boot loader;
  the other five are built one job per idle slot after the flow leaves boot.
  Running them straight after warm-up put 260 + 170 ms long tasks inside the
  door reveal (measured 9.2 s). QA display override: `?debug=1&ship=<id>`
  (World.tsx, never written to the save).

- **Boot performance (critical, fixed in 1C):** measured with
  `tools/perf-boot.mjs` (long tasks + `task:*` / `world:mounted` marks).
  (1) Texture bakes + ship geometry moved to a module Web Worker
  (`workers/bake.worker.ts` / `bakeClient.ts`; results transferred, not
  copied); decal text is drawn on the main thread, erosion runs in the worker.
  (2) `bakeWear` uses a numeric spatial hash (string keys were ~3 s).
  (3) `debug/shaderCheck.ts` must query `COMPLETION_STATUS_KHR` before
  `LINK_STATUS` — reading LINK_STATUS early forces synchronous links.
  (4) `compileAsync` must run with a HalfFloat render target bound: programs
  are keyed on output colour space, and compiling for the screen produced the
  wrong variants → a 3.3 s synchronous recompile on the first real frame.
  (5) World mount (~0.5-0.9 s of React/material work) is deferred to the
  credit card's static hold; the offscreen upload render + full post-chain
  warm-up (exposure 0) run under the black loading beat. Result (prod): boot
  timeline tracks wall-clock (12.15 s), zero stall during the logo sting.

- **Hangar (1D):** `scenes/hangar/` — `Hangar.tsx` composes `bay/Floor`
  (deck.ts canvas markings + tiled panel normals; drei MeshReflectorMaterial
  512/1024, plain PBR on LOW), `bay/Bay` (bayGeometry.ts: walls, ribs, ceiling
  trusses, catwalks + rails, pipes, sagging cable bundles, crane rails, back
  opening + door wall; merged to 5 draw calls, box-projected UVs 1/4 m, reuses
  the doors' gunmetal bake), `bay/SpaceVista` (star shell, nebula sphere,
  planet with night-side city lights + atmosphere fresnel, hex force field),
  `Pad` (stepped lathe plate, segmented Ignition ring, counter-rotating tick
  ring, 3 pylons, pulse ring + scan plane driven by `padFx`), turntable.ts
  (custom controller) and hangarCamera.ts (orbit + breathing + handheld +
  parallax; `HANGAR_ORBIT` in cameraDirector so VIEWS.hangar = rest pose).
  Pad view state: `ui.viewedShip` (may be locked) vs `profile.selectedShip`.
- **Hangar pitfalls (measured):** (1) MeshReflectorMaterial re-renders the
  whole scene with its OWN camera every frame, even while the boot hides the
  world — mounted before the parallel compile it linked every world program
  synchronously (2.3 s stall; the boot timeline ended at 9.0 s of 12.15). The
  deck stays plain PBR until the `shaders` task is done; warm-up recompiles.
  (2) The hangar mounts in 5 staged frames (`markContentReady` →
  `whenContentReady` gates the shader compile — compiling before all stages
  mounted cost a 3.4 s sync compile). (3) RingGeometry lies in local XY: after
  a -90 deg x rotation, spin it about local Z, not Y (it tilted under the pad).
  (4) LatheGeometry profiles listed centre-out face DOWN (culled) — reverse.
  (5) Directional rim lights graze the whole bay (lilac deck/walls): rims are
  steep narrow spots now. QA: `tools/qa-hangar.mjs`, `qa-bootlag.mjs`
  (timeline vs wall clock), `prof-boot.mjs` (CDP per-long-task profile).
- **Bay life + grounding (1D):** `bay/BayLife.tsx` (2 gantry cranes on the
  ceiling rails, 6 rotating beacon beams (instanced cards; hidden with
  reduce-flashing), 4 holo displays (canvas data + shader scroll/flicker),
  4 additive light-shaft cones + 420 dust motes, 3 steam vents, welding
  sparks every 3-8 s at the parked fighters), `bay/ParkedFighters.tsx`
  (`mergedShipGeometry('halcyon', 1)` instanced x4: 3 draw calls),
  `ContactShadow.tsx` (ship-only capture via `SHIP_LAYER` from below +
  separable blur, every other frame; strength = `padFx.shadow`), and
  `createHullDepth` (MeshDepthMaterial + injected dissolve discard as the
  paint mesh's customDepthMaterial — a CSM depth material did NOT write
  packed depth and the hull shadowed itself in blocks). Budget at the hangar
  rest view: 126 draw calls, 252k tris (brief: <=220 / <=700k).
- **Paint edge fixes (1D, visible at hangar distance):** zone weights are
  one-hot + argmax (interpolating the zone number put a band of zone 1
  between zones 0 and 2); wings take `zoneBreaks` (paired samples at the
  zone boundaries); the dorsal stripe is per-fragment (`ShipSpec.stripe`);
  bare-metal wear roughness 0.42 (mirror-sharp patches read as orange paint).
- **Lighting note:** HALCYON's canted fins face slightly DOWN, so they
  reflect the env's lower hemisphere — the Ignition floor-bounce card made
  them maroon once the rims became steep spots. Floor card 1.4 → 0.6, rims
  lower + more side-on (still spill onto the pad, not the deck).
- **NaN rule, again:** every `pow()` in the hangar shaders clamps its base
  or squares by multiplication — an unclamped pow in the beacon beam card
  turned the whole frame black through bloom (engine notes, doors).
- **QA:** `tools/qa-turntable.mjs` (drag/inertia, pitch spring, zoom clamps,
  reset, keys, auto-rotate rate), `qa-holo.mjs`, `qa-hangar.mjs`. QA ship
  views (`camera.view`) hide the bay (they sit outside its walls).
- **Ship links:** `/game/g1/?boot=0&ship=<id>` puts that ship on the pad
  (locked = hologram, as in the game; an unlocked one also becomes the
  selected ship). Add `&debug=1` to see a locked ship as the real craft
  (never saved). QA: `tools/qa-six.mjs [origin] [--debug]`.
- **Hangar UI (1E):** `ui/primitives` (HudPanel, HudButton, Tooltip,
  SegBar, RadarChart, Swatch, Tabs, CurrencyChip, ScrambleText, Keycap,
  HoldButton, Toasts), `ui/icons`, `ui/screens/hangar/*` (layout in
  hangar.module.css, all sizes var(--u); panels anchor to viewport edges).
  Enters on the boot's `hangarUi:enter` beat (letterbox retract) or any
  hangar entry. `hangarActions.ts` holds the only store writes. Pad view =
  `ui.viewedShip`; unlocked selections also set `profile.selectedShip`.
  Canvas turntable keys yield to any focused control. `settings.briefingSeen`
  (typewriter on first view only). `app/domSettings.ts` mirrors
  reduce-motion / reduce-flashing / UI scale onto <html>. DEV cheats on
  `__G1__.cheats` (debug only). START MISSION / Upgrades / Settings show a
  toast until 1F/1G. PITFALL: never centre a GSAP-animated element with the
  CSS `translate` property — GSAP folds it into x and the tween zeroes it.
  QA: `tools/qa-ui.mjs` (6 resolutions + locked/codex/livery),
  `qa-purchase.mjs`.
- **Pilot busts (1E):** `pilots/` — `buildBust.ts` (procedural, ONYX 23.7k /
  EMBER 24.5k tris), `bustRenderer.ts` (DOM-free core: two scenes, own
  lights, scissored into the card slots at 30 fps, compileAsync first),
  `bust.worker.ts` (OffscreenCanvas via transferControlToOffscreen) and
  `PilotBusts.tsx` (host: forwards slot rects / pointer / selection; main-
  thread fallback when OffscreenCanvas WebGL is missing). On the main thread
  the second context + first-render links were 165 + ~700 ms long tasks at the
  UI's entrance. A FRESH canvas per mount (StrictMode: a force-lost or
  transferred canvas never yields a context again — Chrome's sad-face).
- **Post-boot long tasks (measured, 1E):** `hasWebGL2()` probed a new WebGL
  context on every App render (66 ms each) → cached. Thumbnails: async PBO
  readback (`readRenderTargetPixelsAsync`) + PNG row-flip/encode in the bake
  worker (`bakeClient.png`, OffscreenCanvas.convertToBlob). Remaining: one
  ~120-210 ms task per session from the first thumbnail readback + a one-off
  program link — candidate for 1H: render thumbnails fully in a worker.
- **Keyboard / a11y (1E):** DOM order = Tab order (top bar -> inventory ->
  ship block -> START MISSION -> pilot -> briefing); radio groups (liveries,
  pilots) are one Tab stop with arrow keys (`radioKeys`); inventory arrows
  move the pad selection; Enter with nothing focused = START MISSION. Hangar
  ambience bed (`audio/synth/ambience.ts`) runs while in the hangar once
  audio is unlocked. QA: `tools/qa-keys.mjs`.
- **QA GPU:** headless Chrome defaults to the Intel UHD 770 iGPU (well below
  the brief's GTX 1660 target: HIGH preset 16 fps). `G1_DGPU=1` (+
  `WSLENV=G1_DGPU`) adds `--force_high_performance_gpu` → RTX 3050: HIGH
  51-60 fps at 1080p. AO is the biggest post cost, then DOF (1H perf pass).

## 9. Known issues

- After boot, the first hangar seconds still show one 120-210 ms long task
  (first thumbnail readback + a program link); brief budget is 50 ms. 1H.


- Temporary deck under the ship reads lilac (Nebula rim light at grazing
  angles on a plain rough plane) — replaced by the tuned reflector floor in 1D.
