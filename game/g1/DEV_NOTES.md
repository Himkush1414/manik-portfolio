# SPACE WAR: DARK EDITION — DEV NOTES

Source of truth for `/game/g1/`. A fresh session must be able to resume from
this file alone. Updated after every slice.

**Layout:** Phase 2 lives in the `P2.*` sections directly below; the frozen
Phase 1 record follows (sections 0-10, unchanged except where a "Phase 1
amendment" is logged in P2.4).

---

## P2.0 Phase 2 status (update every slice)

Brief: "PHASE 2 OF 4 — THE WORMHOLE" (§0-§23), received 2026-10-01.
Slices 2A-2J (brief §20). Push gate per slice: typecheck, unit tests,
production build, QA script with 0 console errors/warnings, then commit
(game/g1 paths staged explicitly) + push + `git ls-remote` == HEAD.

| Slice | Status | Push | Notes |
|---|---|---|---|
| Baseline | DONE | — | qa:phase1 green, build/tests clean (P2.6) |
| 2A Foundation | IN PROGRESS | 562274a (a), c9dd224 (b) | (a)(b)(c) carry-overs DONE; next: sim core push, then input / FSM / perf / bot / empty mission scene as separate pushes |
| 2B Wormhole + launch | TODO | | |
| 2C Flight + rigs + HUD | TODO | | |
| 2D Hazards + damage + pause/fail | TODO | | |
| 2E Umbra ships + AI + bestiary | TODO | | |
| 2F Voidspawn monsters | TODO | | |
| 2G Level 1 + results + Sortie Select | TODO | | |
| 2H Level 22 + BULWARK | TODO | | |
| 2I Level 10 + THE WARDEN | TODO | | |
| 2J Audio, balance, soak, final QA | TODO | | |

**Next step:** 2A (see P2.2).

## P2.1 Architecture (brief §3, decided)

```
src/game/        pure-TS deterministic sim (NO three / react / DOM; unit test scans imports)
  core/          fixed step, RNG streams, event ring, pools (SoA), math
  sim.ts         Sim: step order input->player->spawner->AI->projectiles->collisions->damage->pickups->scoring->events->HUD bus
  rail.ts        rail frame (s double, x, y), envelope, speed curve
  collide.ts     swept sphere / capsule / segment tests, s-sorted broadphase
  player.ts weapons.ts hazards.ts pickups.ts scoring.ts difficulty.ts
  enemies/ creatures/ boss/   AI + per-type behaviour (data from data/*.ts)
  patterns/      PatternLib: pure (t, params, seed) -> rail offset
  bot/           scripted bot (novice / mid / expert)
src/levels/      LevelDef types, validator, intensity estimator, levels 1 / 10 / 22, sortie registry
src/input/       InputManager (DOM: pointer lock, stuck-input clearing, late-latched reticle)
src/render/mission/  Mission scene: tunnel, entity views (InstancedMesh), VFX, camera rigs, DRS governor, MissionPostFX
src/creatures/   CreatureFactory (voidspawn meshes)
src/ui/screens/mission/  HUD, pause, failed, results, sortie select, comms, tutorial
tools/qa-phase2.mjs, tools/balance.mjs (bundles the sim with esbuild, runs N seeds per skill)
```

Decisions (2026-10-01, before code):
1. **Mission frame at `MISSION_ORIGIN = (0, -3000, 0)`**: 3000 u below the
   hangar and ~4 km from the cockpit (beyond the 1000 u far plane of both).
   Render uses `d = s - playerS`: the player stays near the frame origin, the
   tunnel scrolls in its shader, everything else is placed relative. float32
   ulp at 3000 u = 0.24 mm (was 1 mm at 9000 u).
2. **Fog stays the ONE linear `Fog`** (type switch = recompile of every
   material). The mission writes near/far/colour (uniforms). The tunnel shader
   does its own exp2-style depth grade.
3. **No new scene lights.** Light count/type changes recompile every program
   (Phase 1 pitfall). The mission BORROWS the existing rig while active
   (`render/lightRig.ts`): studio key spot (forward key, from behind the
   player), the two rim spots (core backlight + Nebula rim), hemisphere (level
   ambient), cockpit directional + dash point (cockpit rig), door-FX point
   lights (pooled explosion lights). Originals restored on exit. Shadow map
   auto-update is OFF in missions (no casters; castShadow flags never toggled).
4. **Post:** a separate mission composer (built + warmed during prepare,
   last pass rendered off-screen once) instead of rebuilding the Phase 1
   composer (a rebuild = synchronous EffectPass compile at the launch).
   `PostFX` yields while `stage.mission` is on.
5. **Brake default moves off Ctrl** (`ControlLeft` -> `KeyF`): holding Ctrl
   (brake) + W (move up) = Ctrl+W, which closes the tab and cannot be
   prevented. Ctrl/Alt/Meta are never gameplay keys (InputManager ignores
   them; rebinding refuses them). Save v2 migration remaps an untouched
   `ControlLeft` brake. (Phase 1 amendment, P2.4.)
6. **Launch wiring:** STANDBY -> `LAUNCH` is only reachable via QA params
   until the mission is presentable (2C); from then the standby beat
   auto-launches.
7. **TS CLI** (balance harness): `tools/balance.mjs` bundles
   `src/game/bot/cli.ts` with the installed esbuild (Vite's) and runs it on
   Node 24 — no new dependency.
8. **Coordinates:** rail `s` forward (+), `x` right, `y` up; render
   `z = -(s - playerS)`. Ship nose = -z in the mission frame.

## P2.2 Slice plan (brief §20)

- **2A Foundation:** carry-over (a) post-hangar stall, (b) first-gesture
  audio, (c) iGPU hangar >= 30 fps via the DRS governor; sim core (fixed 60 Hz
  step + accumulator, max 5 steps, render alpha; RNG streams sim/ai/spawn vs
  vfx; SoA pools; rail frame; swept collision; event ring; HudBus 20 Hz);
  InputManager; FSM mission states; mission quality presets + DRS governor;
  perf instrumentation (marks, long-task observer, `perf.table()`); debug
  overlays; bot skeleton; unit tests (determinism, import boundary, pools,
  collision, FSM, input clearing, DRS). GATE: empty mission scene at 60 fps,
  perf tables, programs-constant test.
- **2B** Wormhole tunnel shader + quality tiers, launch catapult, Veil Gate,
  breach, speed FX, set pieces.
- **2C** Player flight, 3 camera rigs, live mirrors, reticle/aim/fire, weapon
  VFX, overlay + combiner HUD, live MFDs.
- **2D** Hazards (asteroids, wreckage, mines), damage model, feedback, pause,
  fail/retry.
- **2E** REAVER / LANCER / SPORE-CARRIER / BULWARK, AI + PatternLib, health
  bars, explosions, `?screen=bestiary`.
- **2F** SKITTERLING / TENDRILLER / HOLLOW MANTA + telegraphs.
- **2G** Level 1 + tutorial + KESTREL-9 + results + Sortie Select +
  `profile.awardMission` (save v2).
- **2H** Level 22 + BULWARK mini-boss + storms + collapse.
- **2I** Level 10 + THE WARDEN + difficulty gate + cinematics.
- **2J** Combat audio + adaptive music, balance report, soak, final QA, docs,
  Phase 3 handoff.

## P2.3 Risk register (Phase 2)

| Risk | Impact | Mitigation |
|---|---|---|
| Shader compile mid-play | hitch | everything compiled in prepare (compileHdr + warm render of every instanced mesh at zero scale); programs/geometries/textures counted before vs after a bot run (gate) |
| Cockpit rig draw calls (cockpit alone = 111) | > 150 budget | merge static cockpit meshes by material in mission; mirrors on a reduced layer set |
| iGPU fill rate (tunnel + additive VFX) | < 40 fps LOW | DRS governor (5 quantised scales), 1-layer tunnel on LOW, explosion overdraw cap, quarter-res bloom |
| GC spikes | frame spikes | SoA pools, module scratch objects, no per-frame closures; heap sawtooth checked |
| Sim / render drift (interpolation) | jitter | prev/cur state per entity, render alpha; dt clamp + accumulator resync after tab switch |
| Bot not representative | bad balance | three skill tiers with explicit reaction/aim/dodge parameters, logged; manual playtests noted honestly |
| Pointer lock edge cases | stuck input / no lock | pointerlockchange-driven pause, clear-all on blur/visibility/modal, absolute-cursor fallback |
| Fog / env / light state leaking between hangar and mission | wrong look or recompiles | lightRig borrow/restore + fog writer owned by the active scene; programs-constant test across round trips |
| Scope (23 sections) | unfinished P0 | cut order P2 -> MANTA -> adaptive music -> boss cinematic polish; never P0 |

## P2.4 Phase 1 amendments (minimal, logged)

1. **Carry-over (a), post-boot stalls (2026-10-01).** Traced with
   `tools/trace-window.mjs` (Chrome trace + V8 samples on the same clock) /
   `tools/prof-idle.mjs`. The "~55 ms stall" was three main-thread tasks after
   the boot handed over (prod, RTX 3050): **61-66 ms HangarUI entrance** (GSAP
   `fromTo` read every panel's computed style -> ~30 ms forced style/layout),
   **~64 ms cockpit pre-warm mount** (buildCockpit + fists/legs + kneeboard
   canvas text inside one React commit) and **~59 ms cockpit compileHdr**
   (sync part of `gl.compile` for the whole subtree); plus a 30-60 ms
   thumbnail `getBufferSubData`. Fixes: `core/slicer.ts` (generator jobs in
   <= 4 ms idle slices, per-job failure isolation, `WAIT` to end a polling
   slice); `buildCockpitSteps` / `legsSteps` / `buildLaunchTunnelSteps`
   (sync `buildCockpit` kept as a drain wrapper — API unchanged);
   `scenes/cockpit/cockpitPrebuild.ts` (`warmCockpit()` pre-builds sliced,
   then `cockpitMount.want()`; `<Cockpit/>` / `<LaunchTunnel/>` peek the
   pre-built objects); `render/compileSliced.ts` (one compile per
   (material, object kind), polled parallel link, one texture upload per
   step) replaces the cockpit's compileHdr; HangarUI mounts its five panels
   one per frame and enters them with WAAPI keyframes (no style reads);
   thumbnails read back in row strips (see amendment 2 for the final size). Result (prod,
   2 runs, full boot): **0 tasks > 30 ms after 11 s** (boot-masked tasks
   unchanged); qa:phase1 hangar + cockpit groups on prod: 43 shots, console
   clean. Pushed `562274a`.
2. **Carry-over (b), first-gesture audio (2026-10-01).** Measured: the first
   `new AudioContext()` in a browser process blocks the main thread 15-280 ms
   on this machine (synchronous audio-service/output setup; later contexts
   < 1 ms), plus 2-10 ms of noise synthesis — all inside the first click
   (prod: 261-292 ms gesture task). A pre-gesture context would make Chrome
   log its autoplay warning (zero-warnings rule), so: `AudioBus.prewarm()`
   calls the async, permission-free `enumerateDevices()` at load (some runs
   then construct in ~15 ms) and synthesises the shared noise in idle slices;
   the context is created in the task AFTER the gesture (sticky activation),
   never inside it. Result (prod x3): **gesture task 1.5-8 ms**; the one-off
   audio-init task (230-270 ms here) still follows it — known issue P2.7.
   Audio verified: context running, hangar bed RMS 0.018 (Phase 1: 0.017),
   hint gone, console clean. Also fixed a regression from (a): 48-row strips
   with an idle wait each delayed thumbnails to ~25 s; now 2 strips of 192
   rows without idle waits — all six by ~16 s (Phase 1 ~12 s), 0 tasks > 30 ms.
   Pushed `c9dd224`.
3. **Carry-over (c), integrated-GPU hangar >= 30 fps (2026-10-01).**
   Findings: `detectPreset()` existed but was never called (every first run
   got HIGH = 16-18 fps on the UHD 770); drei's PerformanceMonitor degrade
   toggled AO/DOF (composer rebuild = 77-224 ms recompile tasks) and clamped a
   degraded DPR UP to 0.75 (overriding resScale 0.5); postprocessing's
   BloomEffect ignores `resolutionScale` in mipmap mode (bloom = the largest
   post cost on the iGPU). Changes: `render/drs.ts` DRS governor (p95 over 90
   frames, quantised scales 1/.85/.72/.6/.5, rate-limited, then AO -> DOF ->
   reflections -> particles; unit-tested) driven by `render/DrsDriver.tsx`
   (replaces PerformanceMonitor; no sampling in boot / hidden tab; window reset
   per flow change; profile `menu` vs `mission`, tunables in
   `data/render.config.ts` DRS); first-run pick wired (MEDIAN frame time over
   2 s after the hangar settles + detect-gpu; > 22 ms steps down once, > 40 ms
   twice; only replaces the untouched default); one-time integrated-GPU toast
   (`settings.gpuHintShown`, additive field; Toast gained an optional
   duration and wraps at a max width); `scaleBloom` runs bloom at the preset's
   resolution (LOW 1/4, MED/HIGH 1/2, ULTRA full; levels 5/6/8/8);
   `resolveQuality` = base DPR x resScale x DRS scale (floor 0.4).
   QA harness: `qa-phase1` seeds HIGH as already picked + `?drs=0` (new QA
   param: governor frozen) so its scored captures stay at HIGH.
   Result (prod, 1080p): iGPU fresh profile -> LOW + toast, governor settles
   at 0.72 (1382x777) **36-37 fps, 0 long tasks** (Phase 1: 16-23 fps);
   dGPU fresh -> HIGH, 60 fps, scale 1.0 (look unchanged); full qa:phase1 on
   prod: 84 shots, console clean, layout clean, dGPU hangar 60 / cockpit 59.8.
   Unreproduced once: one iGPU run logged 36 console messages (not captured);
   10 reruns incl. forced HIGH were clean — the QA console gate remains.

### P2 perf table — hangar (prod build, 1920x1080)

| GPU | preset | DRS scale | avg fps | p95 ms | long tasks |
|---|---|---|---|---|---|
| UHD 770 (iGPU) | LOW | 1.0 / .85 / .72 / .6 / .5 (pinned) | 25 / 28 / 38 / 47 / 55 | 83 / 67 / 50 / 50 / 33 | 0 |
| UHD 770 (iGPU) | LOW (auto) | 0.72 (governor) | 36.5 | 50 | 0 |
| UHD 770 (iGPU) | MEDIUM | 0.5 + AO off | 33.6 | 67 | 1 (96 ms, DRS step) |
| UHD 770 (iGPU) | HIGH | 0.5 + AO/DOF/refl off (after ~60 s) | 35 | 45 | DRS steps only |
| RTX 3050 | HIGH (auto) | 1.0 | 60 | 16.8 | 0 |

## P2.7 Known issues (Phase 2)

- First-click audio init: the browser's one-off AudioContext setup
  (230-270 ms in headless Chrome on this machine, 15 ms on some warm runs) runs
  in the task right after the first gesture. Unavoidable without a
  pre-gesture context (Chrome autoplay warning). It happens once, in the
  boot/hangar, never in a mission (a mission is always entered by clicks).
- Thumbnails appear ~4 s later than Phase 1 (2-strip readback, fences).

## P2.5 Design intent — Phase 2 assets (written before modelling)

**Wormhole (L1 clean corridor):** a living throat, not a texture: three
swirl layers at different scales and speeds give parallax, ridged filaments
read as energy threads, travelling rings rush at the camera with speed, and
the vanishing-point core is HDR so bloom makes it the brightest thing on
screen. Navy near -> Indigo -> Violet mid -> warm Core light at the exit.
**L22 infested:** Indigo-black walls with Nebula -> magenta veins pulsing, a
10 % Danger heartbeat, Ice lightning storms, organic ridges. **L10 chamber:**
black void, dark red-violet energy, giant Ignition-amber ring structures, the
Warden's Danger-red eye as the focal point.

**REAVER (~4 u):** hammerhead arrowhead; two splayed mandible prongs forward
frame a single eye-cannon; scavenged hull plates bolted over violet chitin;
tail flagella trail behind. Reads at 64 px as "a hammer with fangs" — the
widest point is FORWARD (player ships are widest at the wings/rear).
**LANCER (~9 u):** long spear hull, two outrigger gun arms on struts give a
trident silhouette; ribbed chitin spine; muzzle glow at both arm tips.
**SPORE-CARRIER (~12 u):** bulbous pod, dorsal sacs that swell and glow
before release, short stubby bio-thrusters; the only round silhouette among
the ships. **BULWARK (~52 u):** a salvaged frigate fused into a ribbed
carapace; broad armoured prow visor; two dorsal turret clusters; ventral
heavy cannon; two engine pods; bio-membrane shield bubble. **THE WARDEN
(~120 u):** crescent hull with exposed ribbing, central organic eye core, two
pylon arms with turrets, underbelly hangar maw, dorsal beam lance.
Umbra rule: asymmetry, scorched human plating + violet-black chitin + sinew,
emissive veins Nebula -> Danger. Never clean lines.

**SKITTERLING (2.5 u span):** bat/ray: membrane wings flapping in the vertex
shader, long whip tail, glowing belly sac, two eyes. **TENDRILLER (core 16 u
+ 8 x 14 u tentacles):** a ribbed bell-like core with an eye and a maw; tapered
tentacles with suckers and barbs on spring-damped bone chains. **HOLLOW MANTA
(14 u span):** ray body with rippling wing edges, dorsal glowing weak spot.
Voidspawn rule: wet chitin (clearcoat), wrap + rim lighting, bioluminescent
veins that SWELL 0.6-0.8 s before any attack.

**Hazards:** asteroids backlit by the core (strong rim) with craters and
fracture lines; Meridian wing fragments (Halcyon steel + Ignition stripe,
torn) tumbling and sparking; mines with a fuse glow ring.
**KESTREL-9 transports:** blocky industrial hulls, warm lit windows, dead
engines — the only warm-lit human things in the corridor.

## P2.6 Baseline (2026-10-01, before Phase 2 code)

- `npm run typecheck` clean; `vitest` 41/41; root `npm run build` clean
  apart from the two PRE-EXISTING portfolio warnings (dotlottie "use client",
  portfolio `three.module` chunk > 500 kB) — the game's own build emits none.
- `npm run qa:phase1` (dev, port 5199, G1_DGPU=1): 84 shots, 0 group errors,
  console clean in all 7 groups; max 187 draw calls / 295k tris; perf
  (RTX 3050, 1080p HIGH): hangar 60.1 fps (min 59.8), 124 calls, 252k tris,
  91 programs, 22.1 MB heap; cockpit 60.0 fps, 130 calls, 36k tris,
  23.8 MB, mirrors 28.6 refreshes/s (iGPU 14.5/s).
- Spot-checked `res-1920x1080-hangar.png`, `cockpit-8-standby.png`: correct.

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
| 1F Upgrades / Settings / Save | DONE | Upgrades modal (hold-to-install, callouts, rating gauge), Settings (5 tabs, rebinding w/ conflicts, live + persisted), reset progress, debug cheats, FPS overlay |
| 1G Cockpit + camera select | DONE | bulkhead, cockpit (interior, tub, tunnel + deep-space mouth, 3 live mirrors), body framing (fists, knees, kneeboard), systems boot, combiner briefing, camera selector, standby, ESC return; MirrorRig + BlurDissolve; light/heavy variants verified; 20-round-trip soak flat |
| 1H QA / polish / perf | DONE | §16 audio, §17 a11y/resilience, §18 full QA protocol + perf, §19 handoff contract |

**Phase 1 step map** (the owner counts the brief's numbered sections §0-§20 as
"the ~20 steps"; slices are how they were built):

| Step (brief §) | Slice | Status |
|---|---|---|
| 0-7 role, rules, stack, art + story bibles, architecture, budgets, build order | plan + 1A | DONE |
| 8 boot sequence, 9 blast doors | 1B | DONE |
| 10 ship pipeline + six ships | 1C | DONE |
| 11 hangar scene | 1D | DONE |
| 12 hangar UI, 13 pilot select | 1E | DONE |
| 14 upgrades / settings / profile | 1F | DONE |
| 15 cockpit entry + camera select | 1G | DONE |
| 16 audio | 1H | DONE (cockpit voices + bed, audio-map audit) |
| 17 accessibility, resilience, pitfalls | 1H | DONE (axe 0 violations, focus rings, retry UI, context restore) |
| 18 QA protocol (qa:phase1) | 1H | DONE (84 shots scored >= 4, budgets met, console clean) |
| 19 handoff contract | 1H | DONE (§7 below, exact signatures) |
| 20 final report | — | DONE (§10 below) — PHASE 1 COMPLETE |

**Next step:** Phase 1 is complete and frozen. Wait for the Phase 2 brief; Phase 2 starts from the §7 contract (see §10 "Next step for Phase 2").

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

## 7. Phase 1 → Phase 2 handoff contract (brief §19 — STABLE; Phase 2 consumes, never edits)

Phase 1 is frozen: later phases feed these APIs data. Signatures are exact.

**Ships** — `ships/ShipFactory.ts`
- `ShipFactory.build(shipId: ShipId, { livery?: number; lod?: 0 | 1; hologram?: boolean }) -> BuiltShip`
- `BuiltShip = { group: Group; hardpoints: Hardpoint[]; paint; tris; setLivery(i, animate?); setDissolve(0..1); setHologram(on); readonly hologram; setEngineLevel(0..1); update(t); dispose() }`
- `Hardpoint = { id; kind: 'cannon' | 'engine' | 'shield' | 'thruster' | 'hull'; pos: [x, y, z] }` (ship-local, nose +z)
- `preloadShipGeometry(id, lod)` (worker bake, cached), `mergedShipGeometry(id, lod)` (instancing), `SHIP_LAYER`
- Specs (shape, stats, hardpoints) live ONLY in `ships/specs/*.ts`; stats/unlocks/cockpit variant in `data/ships.ts`.

**Blast doors** — `scenes/shared/doors/DoorController.ts` (+ view `scenes/shared/BlastDoors.tsx`, mount-point agnostic)
- `new DoorController(id)`: `open(duration = 1.65): Promise<void>`, `close(duration = 1.0): Promise<void>`, `seek(t, 'open' | 'close')`, `set(0 | 1)`, `progress`, `state`, `dispose()`
- events on `core/bus`: `doors:unlock {id}`, `doors:move {id, velocity}`, `doors:slam {id}` (audio + shake hooks; `app/choreo/doorFeedback.ts`)
- instances: `sceneBridge.bootDoors` (boot, in-world), `sceneBridge.launchDoors` (camera-attached bulkhead). ONE live tween per controller: start each move at its beat.

**Flow FSM** — `app/flow.ts`
- `flow.send(event): boolean` (false = not accepted here = double-trigger guard), `flow.state`, `useFlow(s => s.state)`
- events incl. `START_MISSION`, `CAMERA_CHOSEN`, `LAUNCH`, `ABORT_TO_HANGAR` (+ `BRIEFING_ACK`, `RETURNED`, modal events); selectors `isBoot / isHangar / isLaunch`
- Phase 2 entry: add mission states to `TRANSITIONS['launch.standby'].LAUNCH` and call `flow.send('LAUNCH')`.
- choreography: `app/choreo/launchTimeline.ts` `launch() / briefingAck() / chooseCamera(mode) / returnToHangar() / jumpTo(target)`

**Stores** — `state/*.store.ts` (zustand + persist, key `spacewar.darkedition.save.v1`, versioned migrations in `state/save.ts`)
- `useSettings`: `controls { bindings, sensitivity, invertY, deadzone, smoothing }`, `camera { mode, fov, shake, helmetFrame }`, `graphics { preset, toggles, resScale, fpsCap, showFps }`, `audio`, `accessibility`, `bootSeen`, `briefingSeen`
- `useProfile`: `credits, highestLevelCleared, bossesDefeated, unlockedShips, upgrades{track: tier}, selectedShip, liveryByShip, pilot`; atomic `purchaseShip(id)` / `purchaseUpgrade(track) -> TxResult`; `grantCredits`, `setLevelCleared`, `reset`

**Input** — `input/actions.ts` `enum InputAction`; `input/bindings.ts` `DEFAULT_BINDINGS`, `findConflict(b, code, self)`, `assignBinding(b, target, code, 'swap' | 'clear')`, `actionsFor(b, code)`; `input/keyLabels.ts` `keyLabel(code)`. Bindings store `KeyboardEvent.code`; no key codes hard-coded elsewhere (Phase 2's InputManager reads these).

**Audio** — `audio/AudioBus.ts` `AudioBus { init(), ctx, running, buses: { music, sfx, ui } }` (gains from settings, ducks when hidden); `audio/sfx.ts` `sfx.play(name: SfxName)`: hover, confirm, deny, locked, purchase, livery, materialise, sting, zing, whoosh, loaderTick, clunk, clunkHeavy, hiss, powerUp, mfdBlip0-2, hudOn. Beds: `startHangarAmbience/stop…`, `startCockpitBed/stop…`.

**Post / camera** — `render/fxController.ts` `postfx.pulse({ ca, shake, vignette, duration })`, `postfx.setTransitionBlur(0..1)`, `postfx.setExposure(v, duration?)`; `render/CameraShaker.ts` `CameraShaker.addTrauma(0..1)`, `setRumble(level, hz)`; `render/BlurDissolve.ts` `dissolveEnterVars/ExitVars`, `dissolveIn/Out(el)`, `blurDissolve(swap)`; `render/MirrorRig.ts` `new MirrorRig(defs)`, `setSource(obj)` (Phase 2: the wormhole scene), `attach(parent)`, `render(gl, dt)`, `resize`, `fps`, `textures`.
- `render/cameraRig.ts` `type CameraMode = 'third' | 'chase' | 'cockpit'`, `interface CameraRig { mode; attach(camera, target); update(dt); detach() }` — Phase 2 implements the three rigs; the selected mode is `useSettings().camera.mode`.

**Data** — `data/lore.ts` (bible, MISSION_01, CODEX, PILOTS), `ships.ts` (stats, unlock reqs, cockpit variant), `upgrades.ts` (`TRACKS`, tier costs, `computeCombatRating(profile, ship)`, `recommendedRating(level)` — numbers provisional), `unlocks.ts` (`unlockState(ship, profile)`), `liveries.ts` (`liveriesFor(ship)`), `boot.config.ts`, `render.config.ts`.

**QA surface** (`?debug=1`): `window.__G1__` — `boot.seek(t)`, `setShip`, `setLivery`, `setPilot`, `openScreen(hangar|upgrades|settings|briefing|camera|cockpit)`, `grantCredits`, `unlockAll`, `fps()`, `info()`, plus `doors`, `camera`, `launch`, `cheats`, `audio`, `mirrors`, `cockpit` namespaces. Query params: `?boot=0 ?screen= ?ship= ?livery= ?pilot= ?unlock=all ?credits= ?seed= ?debug=1`.

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
- **Modals (1F):** `ui/primitives` Modal (focus trap, Esc, blur-dissolve;
  `seeThrough` keeps the left third clear), Slider, Toggle, Segmented.
  Opening goes through the FSM (`OPEN_UPGRADES` / `OPEN_SETTINGS`;
  `send()` returns false = double-open guard); hangar panels fade (not
  unmount). Upgrades shifts the hangar camera (`hangarCam.shift`) so the ship
  sits left of the tracks; hovering a track draws a hologram callout to its
  hardpoints (`scenes/hangar/shipBridge.ts`, projected per frame; points under
  the panel are skipped). Rebinding captures keydown/mousedown in the capture
  phase (Esc cancels; reserved codes refused), conflicts offer SWAP/CANCEL.
  PITFALL: an absolutely positioned <svg> with only `inset: 0` stays 300x150 —
  give replaced elements explicit width/height. QA: `tools/qa-modals.mjs`.
- **Cockpit entry (1G):** `app/choreo/launchTimeline.ts` (launch / briefingAck /
  chooseCamera / returnToHangar; every step a flow event). Bulkhead =
  `scenes/cockpit/Bulkhead.tsx`: the same BlastDoors (shared assets, `fx=false`
  => no extra lights => no program recompiles) attached to the director pose at
  0.32 m, scaled so the view sits INSIDE the panels' travel (closed: covered;
  open: toothed edges clear). The world swaps while sealed (`stage.cockpit`).
  Cockpit at `COCKPIT_ORIGIN` (-2600 z: outside every hangar light cone, past
  the far plane from the bay) = `buildCockpit.ts` (interior, variants from
  `cockpitSpec.ts`), `LaunchTunnel.tsx`, own ship on MIRROR_LAYER (mirrors
  only), `Mirrors.tsx` (3 HalfFloat RTs, 30 fps, surfaces on their own layer),
  `displays.ts` (MFD + combiner canvases). `CockpitLights` live in the World
  from boot (constant light count), dark until needed. Pre-warm: the hangar
  asks for the cockpit 2.5 s after it settles (`cockpitMount`), the cockpit
  compiles hidden (force-visible) and reports ready; START MISSION waits on
  it behind the sealed doors. Cockpit post: `postfx.ao/aoRadius/dof` (AO
  near-field scale, DOF ~off so the combiner text stays crisp).
- **Handoff primitives (1G):** `render/MirrorRig.ts` — N cameras + HalfFloat
  targets, capped refresh (`fps`, LOW preset 20), `setSource(obj)` = what the
  mirrors see (Phase 2: the wormhole scene), `attach(parent)`, `render(gl,dt)`;
  `Mirrors.tsx` only owns the convex surfaces + bezels. `render/BlurDissolve.ts`
  — the §8 dissolve tokens in one place: `dissolveEnterVars/ExitVars` (seek-safe
  vars for master timelines; the boot beats use them), `dissolveIn/Out(el)`,
  and `blurDissolve(swap)` (WebGL twin: blur + dim, swap at the peak).
- **1G pitfalls (measured):** (1) N8AO intensity 0 => NaN => black frame:
  disable the pass instead. (2) DoorController keeps ONE live tween: building
  the open tween up front killed the close tween (doors never closed) —
  start each move at its beat. (3) three's compileAsync throws (uncaught) if
  a material is disposed while it polls and never resolves — use
  `render/compile.ts safeCompileAsync` everywhere. (4) renderer.compile uses
  traverseVisible: hidden subtrees must be force-visible to pre-compile.
  (5) combiner text: no mipmaps + anisotropy, under the bloom threshold.
  QA: `tools/qa-launch.mjs` (beat-polled round trip).
- **QA GPU:** headless Chrome defaults to the Intel UHD 770 iGPU (well below
  the brief's GTX 1660 target: HIGH preset 16 fps). `G1_DGPU=1` (+
  `WSLENV=G1_DGPU`) adds `--force_high_performance_gpu` → RTX 3050: HIGH
  51-60 fps at 1080p. AO is the biggest post cost, then DOF (1H perf pass).

- **1G polish (measured):** eye pitch is -0.1 rad (5.7 deg), so at the default
  75 deg FOV the frame bottom is ~43 deg below the eye and the dash's lower edge
  ~36 deg: the body framing lives in that band (`scenes/cockpit/cockpitBody.ts`:
  `fist()` closed on the stick and on the throttle — moved forward to
  `C.z1 + 0.12` so it is in frame — raised knees/thighs, G-suit, garters,
  kneeboard with the mission card). Fists + legs are merged per material
  (`mergeByMaterial`): cockpit 168 -> 111 draw calls. DECISION: no shoulder
  harness / headrest geometry — they sit behind/below the eye at every
  allowed FOV (60-100) and only cost triangles; the helmet rim is the DOM frame.
  The cockpit needed a TUB (knee-well, footwell walls, floor): the tunnel
  floor's hazard bands showed through as ochre wedges. Tunnel mouth: zEnd
  -190 -> -84 (it was a ~100 px patch) and one opaque deep-space window
  shader (2 procedural star layers + log-spiral Veil with its core outside
  the opening) replaced a star sphere (~3 stars landed in the opening) and a
  far Veil plane (its flat core filled the mouth).
- **Inline ref callbacks (bug, fixed):** `<group ref={el => ...}>` is re-called
  (null, el) on EVERY render; Cockpit stored it in state, so each re-render
  flipped `rootObj` and re-ran the Mirrors effect, whose cleanup disposed the
  mirror materials (then reused) — live programs deleted mid-compile ->
  intermittent `GL_INVALID_VALUE: glGetProgramiv`. Rule: stable ref callbacks
  (useCallback); dispose GPU resources only in an unmount-only effect.
- **HudButton fill (bug, fixed):** the edge colour paints the whole button box
  and the ::before fill was translucent, so the edge bled across the face
  (primary looked pink, focused buttons pale blue). The fill now composites
  over an opaque `--abyss` base.
- **QA entry points:** `?screen=upgrades|settings|briefing|camera|cockpit`
  (cockpit states run the REAL launch flow with GSAP's clock x6),
  `?livery=n ?pilot=onyx|ember`, and with `?debug=1` only: `?unlock=all
  ?credits=n`. `__G1__.launch.jump(t) / back() / rate(r)`. Pitfall: a debug
  fn must not RETURN a GSAP timeline — Playwright hangs serialising it.
- **Leak soak (brief §17):** `tools/qa-soak.mjs [origin] [trips] [rate] [warm]`.
  Result (`qa/1g-soak-20.json`, iGPU): first cockpit visit uploads +97
  geometries / +21 textures once; trips 1 -> 20 exactly flat (220 / 73 / 80
  programs), heap 23.2 -> 24.2 MB (GC'd, noise). PASS.
- **QA env pitfall:** `node.exe` (Windows) does not see WSL env vars unless
  listed in `WSLENV` (e.g. `export WSLENV=G1_DGPU`). `node` in WSL is a shim to
  node.exe, so stopping a backgrounded `npx vite` can orphan the Windows
  process on :5199 — stop it by PID after checking its command line.

- **Audio (§16, 1H):** `audio/synth/cockpit.ts` — `powerUp` (saw rise + sub
  swell), `mfdBlip(i)` (per-display pitch), `hudOn` (glassy fifth) and the
  cockpit bed (avionics hum + inverter whine + ventilation air + relay clicks
  scheduled on the audio clock). Launch: power-up at 3.5 s, blips per MFD,
  `hudOn` with the HUD; the hangar bed stops on START_MISSION (hangar effect),
  the cockpit bed starts at power-up and stops at the sealed swap on return;
  unlocking audio while seated starts the cockpit bed. QA (`?debug=1`):
  `__G1__.audio.log()/clear()/state()/level(bus)` — sfx.play records names
  even before unlock; `level` is an RMS meter on a bus (prime it once: a new
  analyser reads 0). `tools/qa-audio.mjs`: hovers all 153 interactive
  elements (hangar, Upgrades, 5 Settings tabs, camera select) -> 0 silent;
  cockpit beat order verified (`qa/16-audio-map.json`). Measured RMS (music
  bus): hangar 0.017 -> cockpit 0.011 -> hangar 0.016; slam 0.38 on sfx.
  Headless audio needs a real CDP click (a relaxed autoplay flag alone does
  not create the context: it is created on the first gesture).

- **Resilience (§17, 1H):** `tools/qa-resilience.mjs [origin] [outDir] [--only n]`.
  (1) Loader faults: a failed task is NO LONGER counted as done (dependents
  wait in `whenDone`); `ui/screens/FaultPanel.tsx` (alertdialog, RETRY
  focused, RELOAD) -> `retryFailed()` re-runs only failed tasks. The bake
  client drops a dead worker on `onerror` (a retry used to post into it and
  hang). Verified: worker blocked once -> panel -> Enter -> full hangar.
  (2) Storage throwing -> boots on the in-memory save. (3) No WebGL -> styled
  fallback. (4) Context loss: restore IN PLACE (three rebuilds its GL state
  and re-uploads lazily); remounting the Canvas created a second renderer
  while module caches held the first one's objects. The shader watchdog skips
  while the context is lost (every query returns null).
- **Thumbnail queue (bug, fixed):** `queue = queue.then(render)` meant ONE
  failed render rejected the chain and every later thumbnail was skipped for
  the session; failures were also cached. Now the queue never rejects, failures
  are not cached, the inventory retries (x4), and three's reason-less fence
  rejection becomes a real Error.
- **Accessibility (§17):** `tools/qa-a11y.mjs [origin] --axe <axe.min.js>`
  (axe-core is QA-only, not a dependency): WCAG 2 A/AA on hangar, Upgrades,
  every Settings tab, briefing, camera select -> 0 violations
  (`qa/17-a11y.json`); focus trapped in both modals, Esc closes both; every Tab
  stop shows a visible focus change (styles compared focused vs blurred
  AFTER transitions settle — reading mid-transition gave false positives).
  Fixed: aria-label on role-less spans/divs (ScrambleText, briefing body ->
  visually-hidden text; threat gauge -> role=img); Settings tablist held
  non-tab buttons; livery swatch focus hidden by the later equal-specificity
  `[aria-checked]` rule (roving radio = the focused swatch IS the checked one);
  range sliders get a track outline, not only a thumb colour.
  NOT TESTED: Firefox / Safari (no browsers here; downloading Playwright's
  would write to the user's cache — out of scope). Code uses no
  Chromium-only APIs on the critical path except OffscreenCanvas (pilot
  busts fall back to the main thread) and KHR_parallel_shader_compile
  (optional).

- **QA protocol (§18, 1H):** `npm run qa:phase1 -- [origin] [--only groups]
  [--out qa/phase1] [--merge]` (`tools/qa-phase1.mjs`) — groups boot (15
  seeked frames), doors (0/25/50/75/100 %), hangar (6 ships x 2 liveries, 3
  turntable angles each, mid-dissolve swap, both pilots, locked hologram),
  modals (Upgrades empty / mid-purchase / maxed; Settings tabs, rebinding
  capture, conflict prompt), cockpit (every launch beat + live centre mirror;
  choreography at 0.3x so 0.5 s beats are never missed), res (1280x720,
  1366x768, 1920x1080, 2560x1440, 3440x1440 hangar + camera select, overlap /
  overflow / out-of-view check; 800x600 notice), perf (discrete GPU).
  `qa/phase1/manifest.json` = per-shot renderer info, checks, console logs.
  PNGs are not versioned (qa/.gitignore) — regenerate with the command.
  RESULT (2026-10-01): 84 shots, every one inspected and scored 1-5 on premium
  feel / hierarchy / materials / lighting / motion intent; all >= 4 after
  fixes. Fixed during the pass: `?screen=doors` showed the hangar (regressed
  when 1D/1E landed; the door view now forces `boot.doors`); the 3-angle
  captures used lookdev cameras outside the bay (scored 2-3; now the player's
  turntable, frozen); Upgrades kicker over a bay lamp (text halo). Console:
  ZERO errors/warnings in every group. Budgets over all frames: max 187 draw
  calls (<= 220), max 295k triangles (<= 700k). Layout: no overflow / overlap
  / clipping at any resolution. Checks: locked = hologram; maxed = 5/5 on all
  tracks via the real atomic purchase; conflict prompt shown; mirrors idle in
  the hangar, 28.6 refreshes/s in the cockpit (discrete GPU).
- **Perf (discrete RTX 3050, 1080p, HIGH):** hangar 60 fps (min
  59.6), cockpit 60 fps (min 59.9); heap 22 / 23.7 MB (GC'd); 20-trip soak
  flat. Integrated UHD 770 (well under the brief's GTX 1660 target): ~16-23
  fps with the runtime degrade (DPR -> AO -> DOF) engaging as designed.
  Long tasks: launch on the discrete GPU = one 49 ms task (first-gesture
  AudioContext creation, browser-inherent, only once per session); hangar
  idle after the full boot = one ~55 ms task (~4 ms JS; the rest is the main
  thread inside GL driver calls while the cockpit pre-warm's resources land).
  Tools: `tools/prof-launch.mjs` (long tasks -> top self + first app frame).

## 9. Known issues

- One ~55 ms main-thread task ~2 s after the hangar first settles (discrete
  GPU; was 120-210 ms): ~4 ms JS, the rest inside GL driver calls as the
  cockpit pre-warm's textures/programs land. Brief budget is 50 ms. Next
  lever if it matters: spread the cockpit's canvas-texture uploads over
  several idle frames (`renderer.initTexture` per frame).
- First user gesture: ~49 ms creating the AudioContext (browser cost; it may
  not be created before a gesture without a console autoplay warning).
- Integrated GPUs (UHD 770 class) run the HIGH preset at ~16-23 fps; the
  runtime degrade drops DPR/AO/DOF. The brief's target is GTX 1660 class.
- Firefox / Safari not tested in this environment (no browsers installed).

## 10. Phase 1 final report (brief §20) — 2026-10-01

**Live:** `/game/g1/` (dev: `npx vite` at the portfolio root; prod: `npm run
build` -> `dist/game/g1/`, a separate build graph, portfolio bundle unchanged).
Boot (12.15 s, skippable, reduced-motion 5.7 s) -> blast doors -> hangar (six
ships, liveries, pilots, purchase, upgrades, settings) -> START MISSION ->
bulkhead -> cockpit (systems boot, combiner briefing, camera select, standby,
ESC back). **Test:** `?boot=0` skip boot; `?screen=doors|upgrades|settings|
briefing|camera|cockpit`; `?ship=<id>`, `?livery=n`, `?pilot=onyx|ember`;
with `?debug=1`: `?unlock=all`, `?credits=n`, `window.__G1__` (§7). Full QA:
`npm run qa:phase1` (+ `qa-a11y`, `qa-resilience`, `qa-soak`, `qa-audio`).

**Slices:** 1A-1H all DONE (table at the top). Brief steps §0-§20 all DONE.

**QA scores:** 84 captures across all six §18 groups, each inspected and
scored; all >= 4 after fixes (boot 4-5, doors 5, ships x liveries 4-5,
angles 4-5, swap / pilots / locked 5, modals 4-5, cockpit 4-5, resolutions
4-5). Console: zero errors / warnings in every group, dev and prod. axe WCAG
2 A/AA: 0 violations. Unit tests: 41 passing (save migration, unlocks,
atomic purchase, combat rating, binding conflicts, FSM guards, ShipSpec,
LOD budgets, loader retry).

**Perf vs budgets (brief §6):** draw calls max 187 (<= 220); triangles max
295k incl. reflection pass (<= 700k); ships 10-45k LOD0 (HALCYON 44.9k <=
60k); cockpit 29.7k (<= 220k); 60 fps hangar + cockpit at 1080p HIGH on an
RTX 3050; heap 22-24 MB, flat over 20 hangar <-> cockpit round trips. Over
budget: one ~55 ms post-boot task and the one-off ~49 ms AudioContext
creation (§9).

**Assets:** none downloaded — fonts only (SIL OFL 1.1, @fontsource; ASSETS.md).

**Deviations from the brief (and why):** git checkpoint pushes despite "no
git" (owner's later Direction Guide, §1.1); nested package + peer-shared
React/three (§1.2); `vite.config.js` touched for the separate game build +
dev route (§1.3, the only file outside game/g1/); R3F 8 / drei 9 instead of
latest (React 18.3.1 match, §1.4); TypeScript 5.9 (§1.5); ships fully
procedural (§6b); no shoulder-harness / headrest geometry (outside the eye's
frustum, §8 1G polish); Firefox / Safari untested here.

**Known issues:** §9.

**Next step for Phase 2:** implement the three `CameraRig`s (third / chase /
cockpit) against `render/cameraRig.ts`, add the mission states behind
`flow.send('LAUNCH')` from `launch.standby`, feed `MirrorRig.setSource()` the
wormhole scene, and build L1 / mid / L10 on the frozen Phase 1 APIs (§7).

