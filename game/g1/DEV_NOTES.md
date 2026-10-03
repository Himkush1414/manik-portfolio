# SPACE WAR: DARK EDITION — DEV NOTES

Source of truth for `/game/g1/`. A fresh session must be able to resume from
this file alone. Updated after every slice.

**Layout:** Phase 2R (current) lives in the `P2R.*` sections directly below, then Phase 2 in `P2.*`; the frozen
Phase 1 record follows (sections 0-10, unchanged except where a "Phase 1
amendment" is logged in P2.4).

---

## P2R PHASE 2R — WORLD OVERHAUL (current phase; read this first)

Brief "PHASE 2R - WORLD OVERHAUL: REAL PLANETS, REAL VALLEYS (REPLACES THE
WORMHOLE)", sections §0-§21, received 2026-10-02 from the owner after the
founder test of the wormhole ("it looks like I'm going through a pipe").
The brief text is not in the repo: it is in the session transcript
`~/.claude/projects/-mnt-d-Manik-Work-Portfolio/e39902c3-a346-417d-a75b-80bac953a50a.jsonl`
(search "PHASE 2R"). Everything after the launch tunnel is rebuilt as
fly-throughs of real-looking alien planet valleys. The wormhole is DELETED
in W1. Unfinished Phase 2 work (2C cp9, 2D-2J) is finished INSIDE this plan
on the new worlds (merge rule). Phase 1 stays frozen (amendments logged in
P2.4). A passed perf gate is NOT a visual sign-off: the founder judges the
look (§19 founder test, side-by-side stills).

### P2R.0 Status (update every slice)

| Slice | Scope (brief §17) | Status | Push |
|---|---|---|---|
| W0 | plan, baseline, schemas (WorldDef/TerrainDef/SkyDef/PathDef) + tests, world bible (12), canon rewrite, tunnel-removal plan | DONE | 407b0fb, 5f8a7d0 |
| W1 | path + rail frame + TerrainField + worker pipeline + ribbon renderer + ARDEN terrain material + camera/sim adaptation; DELETE the tunnel | DONE — GATE PASSED (60 fps fly-through, lateTiles 0, no hitch) | ec5fc39, 5c58aac, b3fb796, c438325 |
| W2a | sky dome + bodies, aerial perspective, env probe, cumulus + cloud shadows, terrain geomorph | DONE — GATE PASSED | 47446da |
| F1 | **FREEDOM OF FLIGHT, re-scoped by the CONTROL / CAMERA / BOUNDARY ADDENDUM** (see P2R.0w): keyboard steers + mouse aims (default), optional keyboard+mouse steering, full-screen reticle, two camera attachments, NO invisible limits (terrain contact + diegetic ceilings), settings v2 | DONE — GATE PASSED (controls + save v2, real boundaries, both camera attachments, contact feedback, HUD flight layer + tutorial, terrain soak); deferrals listed in P2R.0d | 362bbb8, e34b66a, 521869c, + 2c |
| W2b | **living sky (§5, §6)**: TODTimeline + WeatherTimeline (uniform-only), keyframe env probes time-sliced in prepare + blend, per-world grade, horizon ridge layers, sky events (eclipse, shooting stars, planet-rise, aurora), nebula / moon phases, the Meridian in orbit, two depth ranges decision | IN PROGRESS — piece 1 (TOD + grade + black-frame fix) + piece 2 (visible cloud deck + lightning glow, horizon ridges) + piece 3 (keyframe env probes) pushed; next: sky events (shooting stars, aurora, eclipse, planet-rise), moon phases, the Meridian, weather timeline — P2R.0e | (see git log) |
| C1 | **chapters (§3, §4)**: chapter timeline in TerrainField (width / wall height / steepness / floor type curves, 200-500 u blends), barrier massifs + fissures, slot cracks (<= 1 u columns, 82 deg cap), dense corridor columns, forks (lane profiles), envelope + speed from chapters, `qa-approach` strips, LevelDef v3 + validator | TODO | |
| W3 | water, rocks/cliffs (triplanar CC0), near-field detail, arches / tunnels meshes + colliders, set-piece framework | TODO | |
| W4 | vegetation (kits, LOD, impostors, wind) + TRUNK COLLIDERS + slalom patterns + brush + birds / wildlife reacting | TODO | |
| E1 | **encounters (§7, §9) = old 2D-2J merged**: enemy registry + parts / weak points, AI behaviours, spawner + entrance patterns, encounter grammar, hive maws + bomb-spores, cliff-clingers, wyrm, husks, rifts [P1], feedback hierarchy, charge lock-on [P1], nova [P1], HUD additions, results + medals | TODO | |
| W5 | dive / landing / ascent cinematics + camera director (FOV / letterbox / flare), planet generator, cockpit bay tweak | TODO | |
| W6 | LEVEL 1 full authoring (8 chapters, TOD, comms, wonders every 25-40 s, Marrow Wyrm, landing finale, narrative props) + founder playtest evidence | TODO | |
| W7 | KHARAN + L10 + THE WARDEN event | TODO | |
| W8 | STORMWARD + L22 + storm / rain / lightning + sea monsters + BULWARK STACK + beacon | TODO | |
| W9 | polish, audio per world, balance, soak (3 full runs / level), final QA on both GPUs, docs, Phase 3 handoff | TODO | |

### P2R.0a W0 log (2026-10-02)
- W0a `407b0fb`: this plan, baseline, `src/data/worlds/` (types, ARDEN /
  KHARAN / STORMWARD in full, 9 designed worlds, registry with
  world = ceil(level*12/50), validator), `src/game/world/pathDef.ts`.
- W0b: canon (§2) — `lore.ts`: MISSION_01 verbatim (dashes typeset as em
  dashes), MISSION_10 THE WARDEN + MISSION_22 STORMFRONT briefings (80-110
  words, tested), `MISSIONS` by level id, codex rewritten (the Veil = a chain
  of twelve gates above worlds; Umbra seeds worlds with hive-spires; the
  Meridian holds orbit and drops fighters into the atmosphere), `COMMS`
  scripts l01 / l10 / l22 (Sato + STATIC, atM from the §12 beat sheets at
  cruise speed; wired into the LevelDefs in W6-W8), launch lines release /
  retry. `Mission.corridor` -> `world` ('01/12') + `worldName`. UI: hangar
  top bar "WORLD 01/12", mission panel "ARDEN · 01/12 / MARROW VALLEY",
  kneeboard "WORLD", HUD progress "ROUTE", MFDs "ROUTE" + "NAV // <WORLD>"
  (`cockpitFx.worldName`), test level "TEST VALLEY", hangar ambient screen
  words. Deferred to W1 (still on screen until then): LAUNCH_LINES.gate
  ("Veil Gate ahead") — the gate itself is deleted in W1. Kept: the ship
  tagline "Forged from the Veil itself" (the Veil survives as lore).
  Phase 1 amendment (strings only): TopBar / RightPanel / kneeboard /
  BayLife words. qa:phase1 res + cockpit groups: layout clean at 5 sizes,
  console clean.
- NEXT: W1 (see P2R.3 / P2R.4).

### P2R.0b W1 log
- W1a `src/game/world/path.ts` (FlightPath): horizontal centripetal
  Catmull-Rom (Barry-Goldman, alpha 0.5, reflected phantom end points)
  sampled with <= 0.25 u chords (coarser chords aliased the heading:
  piecewise-constant -> curvature spikes / camera jitter), vertical =
  floor profile + clearance profile eased (smoothstep) between waypoints by
  horizontal arc length, resampled to a 1 u 3D arc-length table (x, y, z,
  floor, clearance, envA, envB, bank, heading, curvature over +-10 u).
  `frameAt(s)` (T, R = T x up, U = R x T; no roll), `toWorld(s, x, y)`,
  `waypointS`. `PathWaypoint.floor?` (additive): valley-floor altitude
  (default datum) — breaks the path<->terrain cycle: path y = floor +
  clearance, terrain floor built to the same profile. `validatePath(p,
  ground?)`: continuity (1 u steps), curvature radius >= 1125 u, pitch <=
  20 deg, envelope (8 ellipse points every 45 deg) >= 3 u above terrain.
  Authoring note: an arc that ENDS on a waypoint bends harder in its last
  segment (reflected end condition) — give paths straight lead-in / lead-out
  waypoints. 21 km path builds in < 400 ms (test).
- W1b `src/game/world/noise.ts` (seeded simplex with analytic
  derivatives, fBm, ridged multifractal, domain warp, derivative-damped
  "erosion" fBm) + `terrain.ts` TerrainField: WORLD Y at (s, u); per-row
  cache (frame, floor, half-width from widthKeys or noise, valley centre
  meander <= min(0.15 W, 28), wall heights per side, river half-width);
  cross-section = rolling floodplain + bank rise - river channel ->
  scree apron -> wall face (length from cliffs.sharpen) with world-space
  buttress wobble -> strata / terrace modifiers -> ridged mountain massing
  beyond the wall top (+ far peaks) -> eroded gullies on slopes. Detail
  noise in WORLD (x, z) (isotropic around bends). `sample()` adds water
  (surface = floor - 0.6), depth, river distance, rock, moisture, wall.
  `HeightGrid` (5 u, ring of rows, bilinear of corner heights, miss =
  direct eval -> deterministic regardless of cache). Tests: determinism
  hash, valley property, river wet / walls dry, envelope >= 3 u on a test
  path, grid == uncached, < 6 us per height. LOOK NOT YET JUDGED (W1c).
- W1c terrain on screen + look-dev:
  * `src/game/world/tiles.ts` (pure): tile = 128 u x +-900 u, columns 2 u
    to +-120 then x1.06 per column up to 24 u (243 cols LOD0; LOD1/2 keep
    every 2nd / 4th), rows 2 / 4 / 8 u; positions relative to the tile
    origin (path point at s0, floor height), normals from world-space
    central differences over a 1-sample apron (edges bit-identical with the
    neighbour tile, tested), skirt ring dropped 24 u, attrib RGBA8 = rock,
    moisture, wet, wall. Vertex-vs-field parity < 0.05 u (tested).
  * `src/levels/paths/arden01.ts`: the Level 1 path (17 waypoints, straight
    lead-in / lead-out, skim at 12 u with envB 7.5, two vista climbs to
    120 / 140 u) + valley half-width keys (gorge 66-95 at s 4100-5400,
    basin 300). Passes the validator incl. envelope vs ARDEN terrain.
  * `src/render/world/terrain.worker.ts` + `TerrainStreamer.ts`: RENDER
    DECISION — pooled BufferGeometry per LOD (fixed vertex count, shared
    index), worker buffers copied into the attributes (<= 1 upload / frame,
    measured <= 0.6 ms) instead of vertex-texture fetch: it meets the upload
    + triangle budgets, so the VTF prototype was not needed (revisit only if
    a budget fails). Buffers recycled to the worker as Transferables, old LOD
    kept until the new one lands (no holes), floating origin per frame,
    `stats.lateTiles` (wanted within 640 u, not resident).
  * `src/render/world/terrainMaterial.ts`: MeshStandardMaterial +
    onBeforeCompile (keeps the light rig + fog): grass / meadow by moisture
    + macro noise, soil on steeper grass, limestone + strata bands (world-y
    bands) on rock exposure / steep slopes, scree aprons, snow above
    snowLine (altitude over the floor), wet banks; all colours uniforms;
    world-space noise via `uOrigin` (floating origin). No texture yet —
    DEVIATION (sequencing): CC0 detail layers come with the rock kit in W3.
  * `?screen=worldlab` (`src/scenes/worldlab/WorldLab.tsx`): streamed world
    on its own, sun on the borrowed cockpit-key DirectionalLight (decision 5
    validated: no new light), hemisphere fill, fog, mission post chain,
    camera on the path (s, u, alt, yaw, pitch; keys W/S A/D R/F arrows,
    SPACE). `__G1__.worldlab.{set, fly, cam, stats, settled}`. App/World
    skip hangar / launch / mission UI in this mode.
  * `tools/qa-worldlab.mjs`: 6 ARDEN beauty shots (river skim, valley,
    gorge, panorama, wall side, look back) after streaming settles + a
    cruise fly measuring fps / tiles.
  * LOOK-DEV LOG: clay1 = two parallel near-vertical walls of constant
    height (a trench — the founder's "pipe" again: rubric depth 1, skyline
    1). Root cause: floor + wall-function + mountains-behind gives every
    cross-section the same shape. Rewrote: a world-space mountain field
    (ridged + warped, amplitude growing to the peaks) with the valley CARVED
    into it, valley edge perturbed per side in world space (spurs / bays),
    slope steepness from a rock mask (gentle hillsides vs cliff bands),
    strata only on cliff bands. clay2 good massing; clay3 removed needle
    peaks (62 % ridged + 38 % smooth shoulders) and comb gullies (warped
    domain) but distance-from-river "benches" drew ploughed stripes ->
    removed (rule: never make anything a pure function of the distance to
    the river). clay4/5: gorge factor from the half-width -> steep rock
    rising from the floor edge in the narrows. col1/col2: colour pass.
    OPEN (later passes): near ground lacks surface detail (W3 textures, W4
    vegetation); shadow side too dark (W2 env probe + sky ambient); vista
    climbs stay below the ridgelines -> author PASSES (saddles) for vista
    beats in W6; the world beyond the ribbon is empty fog (W2 horizon
    layers + far ridges).
  * PERF (RTX 3050, HIGH, worldlab cruise 58 u/s): 60 fps, p95 16.9,
    terrain 178k tris (budget 180k, LOD0 <= 150 u, LOD1 <= 700 u, ahead
    2600, behind 800), 40-42 calls, lateTiles 0, tile gen avg 5.7 ms / max
    35.7 ms (target 25 ms: max likely the JIT-cold first tiles — measure
    steady state in W1d; 2nd worker if needed), upload <= 0.6 ms,
    programs / geometries / textures constant, console clean.
- W1d THE MISSION FLIES THE WORLD; THE WORMHOLE IS DELETED.
  * Mission space (`render/world/missionSpace.ts`): the mission root's
    axes = the path frame at the player (R, U, -T), origin = the player's
    path point (floating origin). local = B^T (world - P). Player, camera
    rigs, ship attitude, HUD unchanged (local frame); world objects are
    placed with `placeWorld` (position + B^T rotation) every frame; rail
    things map EXACTLY through the path: CPU `railToLocal` / `railDirToLocal`
    (bolts, orbs), GPU `PATH_GLSL railToLocal()` reading a static path
    texture (world P, R, U per metre, RGBA32F 1024 wide, built at bind)
    + shared uniforms (uPathP0, uPathB = B^T, uPathLen) — particles and
    ribbons. (A rigid rotation alone would misplace things 300 u ahead by
    up to ~40 u on the tightest legal bend.)
  * `render/world/MissionWorld.ts`: per level + preset — FlightPath,
    TerrainField + HeightGrid (sim ground), TerrainStreamer (+ material),
    sun (borrowed cockpit-key DirectionalLight = THE SUN in missions, incl.
    the cockpit interior; dash point stays the cockpit's own), streak
    tint; `prestream(0)` in prepare, `update(ps)`, `applySun`, `groundY`.
    WORLD_VIEW per preset (LOW 1300 u ahead + LOD bias, MED 2000, HIGH /
    ULTRA 2600). Terrain meshes on MIRROR_WORLD_LAYER (mirrors see the
    valley behind). WorldLab now runs on MissionWorld too.
  * LevelDef v2 (`LEVEL_DEF_VERSION = 2`): + worldId, path (PathDef),
    widthKeys, terrainSeed; - mood / TunnelMood, pathParams, radius. Level 1
    flies ARDEN on ARDEN_01_PATH (lengthM 10200 incl. lead-in / lead-out);
    the test level = a 4 km ARDEN valley (validated).
  * Sim (`SimConfig.world = { path, ground }`, optional): envelope from the
    path; soft floor (< 10 u clearance: push up 70 u/s^2 per u), scrape (< 3
    u: never through, vy >= 14, 6 damage, 0.5 s cooldown, Ev.GroundScrape);
    player AND enemy bolts burst on the ground (Ev.Spark b = 1 = terrain);
    HeightGrid filled ahead each step (0 misses in play). Without a world
    (unit tests) the old envelope segments apply. Tests: level paths valid
    vs terrain, floor push / scrape never through, bolts burst on terrain,
    determinism with terrain.
  * MissionDriver: world.update(ps) -> streaming + placement + sun; speed
    FX re-tuned for open air (SPEED_FX.airBase 0.16 at cruise + airBoost
    0.55 with boost — the tube density read as a hyperspace starfield);
    camera bank from path curvature (RIGS.sway.bankPerCurv 80, cap 4 deg);
    gust rumble from the world weather; terrain-aware camera (>= 2 u above
    the ground). missionFlow: world lights (studio spots off, hemisphere =
    world fill), world haze fog + sky colour background (W2 replaces),
    camera near 0.25 / far 6500 (restored on exit). GROUND + MISSION_VIEW in
    data/mission.ts.
  * DELETED: render/mission/tunnel/ (Tunnel, tunnelMaterial, tunnelNoise),
    data/tunnel.ts (TUNNEL, TUNNEL_TIERS, MOODS, STORM_FX — lightning
    returns with STORMWARD weather in W8), render/mission/launch/VeilGate.ts,
    LAUNCH.gateZ / gateRadius, MISSION_LIGHTS, COCKPIT_LIGHTS.key, RAIL
    .tunnelRadius, Tunnel.mirrorShell, mission.qa mood / storm. SPEED_FX +
    SPEED_REF moved to data/speedfx.ts. Launch: catapult -> flash cut into
    the valley (W5 builds the orbit dive + cloud break); LAUNCH_LINES.gate =
    "Atmosphere in five. Hold her steady."
  * GATE (prod build, RTX 3050 HIGH, qa-flight all 3 rigs + qa-prodlaunch
    x1 + qa-camera --hangar): 60 fps, p95 16.9, lateTiles 0, grid misses 0
    (~11k queries / run), programs / geometries / textures constant from
    play start, 0 GL allocations after play start (prod path), 0 long
    tasks, console clean; third 68 calls / 258k tris, cockpit 125 calls /
    240k tris (budgets 170 / 550k). UHD 770 LOW, DRS live (settles 0.5):
    third 53.9 fps, cockpit 44.7 fps (target >= 40). Phase 1 cockpit group
    clean; mission -> hangar restores fog / background / camera range.
    138 unit tests.
  * OPEN: tile gen max 32-37 ms (cold tiles in prepare; avg 6.5-7.5 ms;
    target 25 ms -> 2nd worker if in-play max exceeds it); sky is a flat
    colour + linear fog (W2); near ground has no surface detail (W3/W4);
    vista passes not authored yet (W6); two depth ranges (W2, with the sky).

### P2R.0w HANDOFF (2026-10-02, end of session) — READ THIS FIRST ON RESUME
**Pushed + verified:** W2a `47446da` (sky dome + bodies, aerial perspective, env probe, cumulus + cloud
shadows, terrain geomorph; gate passed on the RTX 3050 + qa:phase1 green), Creative Bible + re-plan
`a6f953e` (`docs/CREATIVE_BIBLE.md`). HEAD on origin/main = a6f953e + this handoff commit.

**Three binding founder documents now stack (latest wins where they conflict):**
1. Phase 2R brief (worlds replace the wormhole) — P2R.* below.
2. FOUNDER'S VISION ADDENDUM — captured as acceptance criteria in `docs/CREATIVE_BIBLE.md` (P2R.0v).
3. CONTROL, CAMERA & BOUNDARY ADDENDUM (arrived mid-F1; overrides 1 + 2): it is NOT yet in the
   bible — first resume action is to add it there. Its content (verbatim intent):
   - CONTROLS: default "KEYBOARD STEERS / MOUSE AIMS": the mouse moves ONLY the reticle (never the ship,
     never the camera; reticle look-ahead OFF by default; the old 15 % mouse nudge removed). Ship moves
     only with movement keys (+ roll, boost, brake). Fire = Mouse1 or Space. Reticle spans the whole
     screen in every camera (2 % margin), pointer lock + relative motion x sensitivity; aim ray = camera
     through the reticle, cannons converge on the aim point (assist target, else 120 u). Mouse never
     moved -> reticle centred. Reticle auto-centre: setting, default OFF. OPTIONAL scheme "KEYBOARD +
     MOUSE STEERS" = cursor-flight (target over the measured free space, >= 4 u inside terrain,
     keyboard additive). Settings (Controls tab, persisted, live): "Ship steering: KEYBOARD | KEYBOARD +
     MOUSE", "Reticle auto-centre", "Reticle look-ahead". BUMP SAVE VERSION (src/core/constants.ts
     SAVE_VERSION 1 -> 2) with a migration (existing saves -> defaults) + unit test. Tutorial prompts
     from real bindings ("MOVE: <keys>", "AIM: MOUSE"). Re-run the balance bot. TEST: 20 s of pure mouse
     motion -> reticle covers the screen, ship position + camera pose change by exactly 0.
   - CAMERA ATTACHMENT (Settings > Camera, persisted, all 3 rigs, 0.5 s blend): (A) FULLY ATTACHED
     (default): rigid mount, follow 1.0, smoothing <= 0.05 s, ship drift <= 3 % of screen; camera roll =
     ship bank x roll strength (default 100 %, lateral bank up to +-40 deg), pitch + nose-yaw follow;
     barrel roll: camera takes 40 %; cockpit: whole view rolls. (B) STEADY HORIZON: translates with the
     ship, no roll / pitch / yaw bend (<= 2 deg sway), ship banks alone up to +-70 deg; lateral follow =
     clamp(1 - 0.85 W / min(freeHalfWidth, 60), 0.35, 0.9), vertical same with H; cockpit: eye level,
     shell / hands / dash roll around the view (<= 25 deg). "Roll strength 0-100 %" (reduce-motion caps
     30 %). Camera collision changes distance / height only, never lateral (reduced rig 1.6 up / 8 back
     in cracks). TESTS: attached ship offset <= 3 %, roll tracks bank x strength within 5 %; steady
     horizon roll <= 2 deg, ship >= 80 % of half-width at the widest free section, never out of frame,
     camera lateral displacement correlates >= 0.55 with the ship's; no camera clip within 2 u.
   - REAL BOUNDARIES: delete EVERY invisible limit (envelope clamp, spring-back, soft boundary,
     soft-floor push, screen-edge clamp, cursor-mapped limit); envelope numbers = design targets +
     validator inputs only; `clampEvents` must be 0 across 3 full runs per level. Contact: swept sphere
     vs heightfield (ring >= 8 samples + gradient normal, no tunnelling at boost), wing-tip spheres
     (r 1.2, ShipSpec span), hull r 1.8; push out along the normal + project velocity to the tangent
     plane (SLIDE); scrape = sparks + dust/chips by surface + grind sound + shake, shield-first 3/s;
     head-on 6-25 by closing speed + 30 % bounce + 0.6 s immunity; water: splash + drag + 8 dmg +
     bounce; <= 0.15 ms / frame, zero allocation. Walls within +-140 u in EVERY chapter (plains framed by
     escarpments / ridges / rock fins / forest walls at 60-140 u) -> C1. CEILINGS ARE DIEGETIC: overhangs,
     arches, rock bridges, hanging roots; open-top canyons = RIDGE TURBULENCE from ~30 u below the rim
     (shear, dust plumes, howl, shake, HUD "TURBULENCE", climb authority -> 0 at the rim); open sky = a
     visible dense CLOUD DECK (whiteout, heavy turbulence, lightning, forced descent). Spawner lanes =
     fractions of measured freeHalfWidth(s) (cap 90 u), enemies target the real position, wall-huggers
     draw flankers + rockfall. VALIDATOR: >= 40 lateral / vertical probes per s; fail if a probe escapes
     > 160 u without a diegetic cap, if the path centre is within 6 u of terrain, or if a wall cannot be
     reached within 2 u without camera clipping.
   - DONE WHEN: (1) default: mouse never moves ship or camera; (2) both attachments pass in all 3 rigs;
     (3) fly within 2 u of a wall, scrape + slide, no invisible stop (clampEvents 0, 3 runs / level);
     (4) every ceiling is turbulence / cloud / overhang; (5) enemies + hazards use the full width; (6) no
     new hitches, all gates green, perf budgets unchanged. Evidence (stills + logs) in DEV_NOTES.

**F1 status: DONE (2026-10-03; full log + deferrals in P2R.0d).** Next slice: W2b.

**FIRST ACTIONS ON RESUME (in order):**
1. Read P2R.0d (F1 log) and this section; `git status` + `git log -3` == `git ls-remote origin main`.
   `export WSLENV=G1_DGPU G1_DGPU=1` before ANY QA; tools/gpu.mjs assertGpu must say RTX 3050.
2. W2b — living sky (§5, §6): TOD / weather timelines (uniform-only), keyframe env probes time-sliced
   in prepare + blended, per-world grade (`src/render/world/grade.ts` is written but NOT wired into
   MissionPostFX, still untracked), far horizon ridge layers, the VISIBLE cloud deck (the sim's deck +
   HUD whiteout already exist: F1) + lightning, sky events, nebula / moon phases, the Meridian in orbit.
   Push in 2-3 gated pieces.
3. Then C1 (chapters + walls within +-140 u + slots / barriers / forks + 40-probe validator + approach
   strips) -> W3 -> W4 -> E1 -> W5-W9.

**PROVISIONAL / COMING NEXT (owner's note):** a reworked, go-overboard version of the post-launchpad
world (landscape, levels, enemies, story) is coming next from the owner. Treat everything after the
launch pad as provisional: the old Phase 2 §6 wormhole (already deleted in W1d) is NOT the reference,
and the current ARDEN valley / Level 1 path are placeholders until C1 re-authors them. Briefs are a FLOOR
("~30 % of the vision"): expand deliberately and log the additions.

**Processes:** the Vite preview server for QA (port 5198, Windows PID 14556, serving `dist/`) was
stopped by PID at the end of this session; restart it for QA exactly as in the "Start preview for QA" step of the run
book (search "Start preview for QA") and record its PID. Port 5173 is the owner's dev server: never touch.

### P2R.0v FOUNDER'S VISION ADDENDUM (2026-10-02) — binding, wins over 2R
Source of truth for the look/feel: `docs/CREATIVE_BIBLE.md` (acceptance
criteria AC2.x-AC10.x, the 13-point founder playtest, the three levels
chapter by chapter, [BEYOND] additions). The owner's prompts are a FLOOR
("~30 % of the vision"): expansions are deliberate and logged there.
Known conflicts fixed by the re-plan: (a) envelope + camera too tight -> F1;
(b) fixed time of day -> W2b TODTimeline; (c) one biome / valley-only ->
C1 chapters; (d) trees optional -> W4 trunk colliders + slaloms; (e) mouse =
small aim cone -> F1 cursor-flight; (f) boss arena too small -> 60/34 (F1
data, E1/W7 bosses). Order rationale: FREEDOM first (every later slice is
judged while flying; it is sim + camera + input, no render risk), then the
living sky (finishes W2 with TOD built in rather than retrofitted), then
chapters (terrain shape language the dressing slices W3/W4 sit on), then
encounters on top of a world that already feels right.

### P2R.0c W2 log
- W2a look review of W1 found (sky1 shots): stars in a full-day sky; ORRIN's
  rings drawn as thin concentric lines; its night side painted dark over the
  day sky; and a RIVER SEAM where a LOD0 tile meets a LOD1 tile (4 u columns
  re-sample the 8-10 u channel -> the bank steps sideways). Fixed:
  * GEOMORPH (`tiles.ts`, `terrainMaterial.ts` terrain-v4): every vertex
    carries its next-LOD target (dy, packed s + LOD, target normal x/z,
    target attribs) taken from the LOD + 1 grid sampled by the SAME function
    (bit-identical to that tile's own vertices) and interpolated over its
    triangles exactly as the rasterizer does; the vertex shader blends by
    path distance. A tile is fully its coarser self by `lodDist - 64` (the
    nearest point a coarser tile can begin), so LOD borders and LOD switches
    are seamless (test: fully morphed LOD0 == LOD1 at shared vertices +
    on the border edge). Ranges in `uMorph` per preset (HIGH 40-86 / 476-636).
    Cost: +25 % tile gen (coarse grid), +20 B / vertex -> uploads now land
    over TWO frames (main attributes, then morph targets; shown after both).
  * `render/world/SkyDome.ts`: one dome shader (depth off, camera-centred,
    world-space via transpose(uPathB)): gradient + haze band, HDR sun disc +
    glow, optional 2nd sun, stars (only below daylight), cirrus, up to 3
    ray-cast bodies (banded / cratered / icy / rocky / cloudy / void), lit
    by the sun (terminator, ring shadow on the planet, planet shadow on the
    rings, atmosphere limb). Rings: radial density profile (faint inner,
    dense middle, Cassini-like gap, narrow outer gap, coarse ringlets — fine
    ringlets alias into lines). DAYLIGHT: the atmosphere is in front of a
    body, so in day the body's light ADDS over the sky and its night side
    lets the sky through (lit side ~0.9 occlusion, night ~0.45) — reads as a
    real daytime giant, not a sticker. ORRIN moved to el 24 / az -55 (gibbous
    against the ARDEN sun at az 78; behind the left range in the opening).
  * `render/world/atmosphere.ts`: shared AP chunk `aerial(worldP)` (exp2 haze
    with analytic height falloff from the valley floor, near -> far colour,
    sun in-scatter) on terrain + clouds; actors keep the linear Fog.
  * `render/world/envProbe.ts`: the world sky (probe mode: ground bounce
    below the horizon, sun glow without the 40x disc) captured once in
    prepare into a 256 cube -> PMREM in WORLD axes — same size as the studio
    env, so assigning it changes no program key (programs constant, QA'd).
    Per frame `scene.environmentRotation` turns it into the path frame (three
    negates the Euler: e = ZYX angles of B^T stored as XYZ -> envMapRotation
    = B; unit-tested). Mission start saves / sets / restores environment,
    rotation, intensity (`LightingDef.envIntensity`, default 1). ARDEN: hemi
    fill 0.55 -> 0.18 (the probe is the sky ambient now), env 0.75; terrain
    keeps the probe's irradiance but only 20 % of its mirror term (a rough
    ground's sky reflection veiled the grass blue) except on wet banks.
    KHARAN / STORMWARD fills get the same retune in W7 / W8.
  * `render/world/clouds.ts`: cumulus banks = ONE instanced draw (slots x 9
    puffs: LOW 10 .. ULTRA 22 slots), soft fbm-eroded billboards lit toward
    the sun with flat darker bases, placed by hash in WORLD space along the
    path (lateral +-2850, altitude = floor + layer altitude) and recycled
    through a fixed slot ring (k mod slots; spacing never lets the window
    exceed the slots); AP-hazed. Cloud SHADOWS: the terrain dims the sun's
    direct term by the same coverage projected along the sun onto the layer
    and drifting with the wind.
  * GATE W2a (prod build, RTX 3050 HIGH): worldlab fly 60 fps, p95 16.9,
    lateTiles 0, programs 28 constant, console clean; qa-flight third /
    chase / cockpit: 60 fps, p95 16.9, calls 70 / 70 / 127, tris 260k / 260k
    / 242k, programs 106, textures 102, geometries constant, 0 long tasks,
    grid misses 0, console clean; qa:phase1 (all 7 groups) green. Tile gen avg 7-10 ms (max 38-63 ms, cold
    tiles in prepare). OPEN: tile upload copy max 0.7-1.0 ms against the
    0.6 ms target even split in halves (timer granularity 0.1 ms + prepare
    load; no long task / frame spike in play) — revisit with Int8 normals if
    an iGPU run shows frame spikes on uploads.
  * OPEN for W2b: per-world grade, far horizon ridge layers (the valley end
    is empty haze), two depth ranges (or measured proof they're unneeded),
    cloud look (reads a little "cotton ball"), near-ground detail (W3).

### P2R.0d F1 log (Control / Camera / Boundary addendum)
Session 2026-10-03. Addendum 3 is now in `docs/CREATIVE_BIBLE.md` §2 as AC2.1-AC2.16 (it replaced the
cursor-flight default + computed follow).
- **Controls (save v2).** `SAVE_VERSION` 2; migration 1 -> 2 drops every v1 control-model / aim / roll
  field (and the pre-release v2 names) so they restart from the v2 defaults; bindings + everything else
  kept (save.test: shipped v1 save, pre-release cursor fields, v2 round trip, bad values).
  `controls.steering: 'keyboard' | 'keyboardMouse'` (default keyboard), `reticleAutoCentre` (off),
  `reticleLookAhead` (off); `camera.attachment: 'attached' | 'steady'` (default attached),
  `camera.rollStrength` 0-1 (reduce-motion caps 0.3). Deadzone / smoothing settings removed (they
  only fed the 15 % mouse nudge, which is gone). `InputState`: the mouse moves ONLY the reticle (NDC
  cursor, `INPUT.reticleEdge` 0.96 = 2 % margin); KEYBOARD: keys -> moveX / moveY, never the reticle;
  KEYBOARD + MOUSE: sim `cursor` steering toward the reticle's point of the measured free space, keys
  nudge the reticle. The aim is always the camera ray through the reticle (MissionDriver `cursorAim`
  -> `setCursorAim`, no smoothing). `SimInput.aimSteer` + PLAYER.aim.steer / noseYaw + FEEL.aimFollow
  deleted: the reticle never turns the ship (nose yaw comes from the motion only).
- **Sim boundaries** (from the WIP, verified): no envelope clamp / spring / soft floor; swept contact
  (hull ring 8 + centre, wing tips), slide / scrape / impact, water, measured free space, diegetic
  ceilings (rim turbulence, cloud deck), `clampEvents`. New this session: `wingHalfSpan` passed by
  MissionLoader (`wingContactSpan(spec)` = widest wing tip - wingR, halcyon ~5.3 u); `HeightGrid.water`
  (per-row river surface / centre / reach from `TerrainField.riverAt`, nearest row) feeds `waterPass`.
  **Perf regression found + fixed:** the WIP had dropped the per-step `ground.fill(s - 60, s + 700)`,
  so beyond the 400 u prefill EVERY grid query missed into the noise field (45 k misses / s once the
  ship roams, sim 1.38 ms / frame vs 0.12 in W2a). Restored (+ prefill to 700, grid half-width 240 ->
  320 so rim probes / a roaming ship stay cached): misses 0, sim 0.06-0.2 ms.
- **Camera attachments** (`CAMERA_ATTACH`, `FollowRig` rewritten, `CockpitRig`): one weight
  `rigFlight.attach` (0 steady .. 1 attached) eased over 0.5 s by MissionDriver blends everything.
  ATTACHED = a rigid boom: pos = ship + q (0, up, back), q = ship pitch + nose yaw + bank x strength
  (+ 40 % barrel roll), so the ship is fixed on screen (drift measured 0-0.3 %); the ship's lateral bank
  is capped at 40 deg in this mode (`ShipAttitude.bankLimit`). STEADY = no boom rotation (cosmetic bend
  sway <= 2 deg), follow from the measured free space on the ship's side, eased 0.35 s, position lag
  per rig, and an EXACT frame keep for the tilted boom (a high ship is shallower: the linear keep let it
  reach NDC 0.98). Cockpit: attached = view rides the attitude (+ full barrel roll unless reduce-
  motion); steady = level eye, `root` (shell / hands / dash) rolls <= 25 deg around it; the combiner
  horizon now reads `rigFlight.interiorRoll / interiorPitch`. Camera collision: `rigFlight.clearAt`
  (terrain clearance of a mission-local point) -> pull in to the reduced rig (1.6 up / 8 back x ship
  scale) with hysteresis; MissionDriver's push-up stays as the last resort. Look-ahead toward the aim
  only with the setting (default off: the mouse never moves the camera).
- **Tests:** 170 green (input: mouse-only / keys-only / KEYBOARD + MOUSE / auto-centre / aim; freedom:
  20 s mouse -> ship 0, no envelope clamp, wall slide within 2 u, head-on impact 6-25 + immunity +
  no tunnelling at boost, water, cloud deck, canyon rim; simworld: grid water == terrain sample, river
  dive splash + never under, wing tips touch first; camera: attached drift / roll x strength, steady
  roll / reach / frame / correlation, mouse never moves the camera, collision pull-in, cockpit modes).
- **`tools/qa-freedom.mjs` rewritten** (L1, every rig x attachment): real pointer-locked mouse sweep
  (20 s attached, 6 s steady), keyboard strafes, wall, ceiling, stills `qa/f1/freedom-*`, JSON
  `qa/f1/freedom.json`. `qa-settings-p2` now seeds a v1 save and checks the in-browser migration and
  the v2 rows. `qa-flight` beats are keyboard again (the WIP had switched them to cursor forces).
- **Part 1 pushed `362bbb8`** (2026-10-03). Gate (prod build, RTX 3050, preview 5198): typecheck +
  170 tests; qa-freedom third / chase / cockpit x attached / steady ALL PASS — mouse-only 20 s (real
  pointer lock): ship offset 0, camera move 0, reticle +-0.96 both axes; attached drift <= 0.33 %, roll
  error 1.4-2.6 %; steady roll <= 1.19 deg, reach 0.90, worst frame 0.93, lateral corr 0.99, cockpit
  shell 25 deg; wall: contact + 11 scrapes / 5 impacts in 7 s, min forward 34-40 u/s (no stall), camera
  >= 2 u, clampEvents 0; ceiling: turb 1.0, never above it; strafing 60 fps, sim 0.05-0.08 ms. qa-flight
  3 rigs: 60 fps, p95 16.8-16.9, programs 106 constant, 0 long tasks, late tiles 0. qa-settings-p2
  (v1 -> v2 in the browser) + qa:phase1 (all 7 groups, 84 shots) green; consoles clean.
- **Part 2a (contact feedback).** `Player.contactNu / contactNy` (last contact normal). MissionVfx:
  GroundScrape -> sparks off the contact point (impact: bigger + flash puff) + a surface puff (rock
  chips vs soil dust from `TerrainField.sample().rock`, bound by MissionLoader as `vfx.surfaceAt`), a
  continuous spark + dust stream while `contact > 0` (SCRAPE_STREAM), Splash -> a water sheet;
  bolt-on-ground sparks now spray up + kick dust / chips (the tunnel-era radial spray is gone); the
  dead "shield presses the envelope" Graze branch removed. New ramps dust / chips / water (additive:
  earth reads as a lit haze — alpha dust + ground-effect rooster tails belong to W3 near-field).
  `scenes/mission/flightFeedback.ts`: own event cursor -> grind / impact / impactHeavy / splash /
  closeCall voices (`audio/synth/flight.ts`, synthesis) + camera trauma (FLIGHT_FX), sustained rumble
  from turbulence + contact added to the gust rumble, the wind howl follows `turb` (silent when not
  live; reset on enter / retry / hangar). Input: single pointer-locked motion events > 500 counts are
  dropped (Chrome's movementX spikes; headless pointer lock even dispatches -541 / -536 on a
  screenshot). qa-freedom: the wall phase asserts voices + particles; the reticle-drift check fails
  only if the reticle moves with ZERO mousemove events (browser-generated ones are counted).
  **Exploit found + fixed (sim):** the contact response projected the velocity onto the tangent plane
  INCLUDING the rail speed, so a wall receding ahead (normal with a forward component) added forward
  speed — holding into it reached 131 u/s (2.3x cruise; seen as 838 on the HUD). A contact now only
  ever removes rail speed (test: "contact never adds forward speed", red before / green after).
  Gate 2a (prod, RTX 3050): 172 tests; qa-freedom 6 / 6 (wall: 15 voices, ~880 particles, min forward
  33-37 u/s, camera >= 2 u, clampEvents 0); qa-flight 3 rigs 60 fps, p95 16.8-16.9, programs constant;
  qa-settings-p2 + qa:phase1 green (before the sim fix; neither touches the sim); consoles clean.
  Pushed `e34b66a`.
- **Part 2b (HUD flight layer).** `scenes/mission/hudFlight.ts` (called by MissionHudDriver):
  TURBULENCE alert (fades in from turb 0.2, pulses above 0.7, reduce-flash: no pulse) which reads
  "CLOUD DECK — DESCEND" in the deck's base; whiteout (opacity deck x 0.92) + lightning flashes in the
  deck (never under reduce-flashing); CLOSE CALL +score callout rising off the reticle; SKIM / WALL RUN
  streak (sim `player.streakWall`); tutorial prompt. Sim: `player.deck` now builds over the last
  `CEILING.deckFog` (12 u) BELOW the deck (it only counted above it, where climb authority is already 0,
  so the whiteout could never show). Tutorial: `input/prompts.ts` builds "MOVE  W A S D / ↑ ← ↓ →",
  "AIM  MOUSE", "FIRE  SPACE / MOUSE 1", "ROLL  Q E", "BOOST  L-SHIFT" (KEYBOARD + MOUSE: "STEER  MOUSE +
  ...") from the live bindings; `app/mission/tutorial.ts` TutorialTracker shows a hint from atM until
  performed / untilM and retires actions performed earlier; Level 1 hints move 60, aim 320, fire 560,
  boost 900, roll 1300 (m). Bots / QA-forced input never get prompts. qa-freedom: tutorial phase (prompt
  shows the real keys, a real KeyD retires it), ceiling phase asserts the HUD alert + whiteout. qa-hud
  now finds the reticle / pipper by class (it used child order; the flight layer sits under them).
  Gate 2b (prod, RTX 3050): 177 tests; qa-freedom 6 / 6 (alert 1.0, whiteout 0.92, tutorial ok);
  qa-flight 3 rigs 60 fps, p95 16.8-17.0, programs constant; qa-hud 3 rigs (65 nodes, reticle follows
  the aim, programs constant); consoles clean. Pushed `521869c`.
- **Part 2c (balance on terrain + wing-aware scoring).** `runLevel` now flies the level's REAL terrain by
  default (FlightPath + TerrainField + HeightGrid, wing span; `--world 0` = envelope-only) and reports
  scrapes / impacts / splashes / close calls / skim / wall-run / clampEvents. New bot style `hugger`
  (`--style hugger`, `BOT.hug`): cycles wall-left / floor / wall-right / open air, aiming its wing tip
  0.8 u off the MEASURED surface — the addendum's "fly within 2 u of a wall" as a soak. It found that
  wall-run could never score for a winged ship (the probe measured from the centre: a 5.3 u half-span
  keeps it 6.5 u off the wall) -> close-call + wall-run probes now measure from the OUTERMOST point
  (wing tip + wingR, else the hull); closeRock 4.5 -> 3 u (AC9.6 "within 3 u"), wallProbe 6 -> 4.5 u
  beyond the tip. Balance (halcyon, tier 0, prod sim): lanes bots 10 runs x 3 skills x 2 levels — win
  100 %, no terrain contact (lanes stay inside the design envelope; no enemies until E1); hugger 3 full
  runs x 3 skills x 2 levels — win 100 %, clampEvents 0 in all 18 runs, L1 per run ~150-166 scrapes,
  30-33 impacts, 10-13 splashes, 41-44 close calls, skim 21-23 s, wall run 11-14 s, hull lost <= 2.4 %
  (shield first). Unit test: hugger soak of the test level (contact, wall run, skim, close calls,
  clampEvents 0). Gate 2c (prod, RTX 3050): 178 tests; qa-freedom 6 / 6; qa-flight 3 rigs 60 fps, p95
  16.9, programs constant; consoles clean.
- **F1 DONE** against the addendum's DONE WHEN: (1) default: the mouse never moves the ship or camera
  (unit + qa-freedom 20 s real pointer lock, 3 rigs); (2) both attachments pass in all 3 rigs; (3) wall
  within 2 u, scrape + slide, no invisible stop, clampEvents 0 (qa-freedom + 18 full hugger runs);
  (4) ceilings: rim turbulence + cloud deck (HUD alert, whiteout, howl, shake); (6) no new hitches,
  gates green, perf budgets unchanged (sim 0.15-0.24 ms). DEFERRED to their owning slices: (5) enemies
  + hazards using the full measured width -> E1 (no enemies exist yet; AC2.12); the VISIBLE cloud-deck
  layer + lightning bolts -> W2b; alpha-blended dust / ground-effect rooster tails -> W3; overhang /
  arch / root ceilings -> W3 meshes; walls within +-140 u + the 40-probe validator -> C1; in-browser
  3-full-runs-per-level soak -> W9 (the `?bot=` URL bot is still style 'lanes').
- Notes: Level 1's valley is far wider than C1's target (a held strafe reached x ~ 476 u before the
  wall) — C1 brings walls within +-140 u. Holding INTO a wall at full lateral speed is a series of
  impacts (closing speed > 12 u/s), not a scrape — by design (head-on rule); brushing it is a slide.

### P2R.0e W2b log (living sky)
- **Piece 1: time of day + per-world grade (2026-10-03).** `LevelDef.todTimeline` (`TodKey`: atM, sun
  el / az, optional sun colour, zenith / mid / horizon, haze near / far, in-scatter, key colour +
  intensity, exposure, stars; missing fields fall back to the world def). `render/world/tod.ts`
  TodTimeline: smoothstep blend between keys, preallocated state; MissionWorld applies it per frame to the
  SHARED uniforms (sky dome gradient / sun colour / stars, AP haze + in-scatter + sun dir, cloud lit /
  shade, the sun light colour x intensity x daylight(el)), the actors' linear fog colour and
  `missionGrade.tod` exposure: a sunrise is uniforms only (programs 106 constant across the level).
  `GradeEffect` (written in the W2 session) is now in the mission chain after the ONE AgX tone-map;
  exposure = postfx x world grade x time of day. Level 1: pre-dawn (el 1.5, stars 1, exposure 1.25)
  -> sunrise gold (el 6 @ 2600 m) -> morning (el 14 @ 6000) -> bright (el 22 @ 10200). OPEN (piece 3):
  the env probe is still captured ONCE (at the dawn state) — keyframe probes + blend come next.
- **Pre-existing bug found + fixed: black frames in late Level 1.** Every gate so far flew the TEST
  level; the new TOD stills flew L1 to 9800 m and got all-black frames (8500-9800, flickering). One
  NaN / Inf pixel in the HalfFloat HDR buffer is smeared over the whole frame by bloom's mip chain.
  Two sources: (1) three r169's GGX `normalize(lightDir + viewDir)` is NaN for the fragment exactly on
  the camera -> sun line (0 x NaN stays NaN even when unlit) — `render/shaderFixes.ts` (imported FIRST
  by main.tsx, before anything compiles) swaps all 4 sites for `safeHalfDir()`; unit-tested; (2) a far
  LOD2 terrain fragment (isolated on a frozen frame: hiding only the LOD2 tiles clears it; tile
  buffers are NaN-free; isnan() is folded away by the D3D compiler and stage instrumentation perturbs
  codegen enough to hide the op) -> the terrain output is guarded with a bit-pattern NaN / Inf test
  (-> haze colour), terrain program key terrain-v5. Result: 0 / 60 black on the frozen sequence that was
  56 / 60, all of L1 clean. `tools/qa-tod.mjs` (new): stills at 3 TOD points + a WHOLE-LEVEL sweep
  (every 500 m, 4 frames each) that fails on any black frame; third + cockpit: 80 frames swept, 0 black,
  60 fps, p95 16.8-16.9, programs constant, console clean. Gate piece 1 (prod, RTX 3050): 182 tests;
  qa-tod third + cockpit; qa-freedom 6 / 6; qa-flight 3 rigs 60 fps, p95 16.8-17.0, programs 106
  constant; qa-settings-p2; qa:phase1 (all 7 groups — the chunk fix touches every program); consoles
  clean.

- **Piece 2: the visible cloud deck + far horizon ridges.** `render/world/cloudDeck.ts`: the sim's
  open-sky ceiling is now SEEN — one world-horizontal plane at `cloudDeckOffset(envB)` above the path
  (the function now lives in sim.ts and both sides use it), world-space fbm (never swims), dense over the
  corridor (coverage 0.58 within 180 u of the line) easing to 0.06 by 620 u so peaks rise through it
  (reads as a valley inversion cloud, not an overcast lid: the sky + ORRIN stay visible), alpha capped
  0.82, underside darker where thick, tinted by the time of day (cool-white; the first warm pass read as
  sepia overcast in the gorge and was reworked), aerial perspective, depth-tested; lightning from the HUD's
  deck flashes (`deckFx`, never under reduce-flashing) lights it from within. Sky dome: two far ridge
  bands at the horizon (periodic noise on the azimuth circle, <= ~3 deg, coloured from the TOD haze /
  horizon; the first pass was a flat dark band that read as sea and was reworked), view only (never the
  probe). One new program (the deck): 106 -> 107, constant across the run. The deck fades at grazing
  angles (edge-on it drew a bright line across the valley). Gate piece 2 (prod, RTX 3050): 182 tests;
  qa-freedom 6 / 6; qa-flight 3 rigs 60 fps, p95 16.8-17.0, render +0.2 ms, programs 107 constant;
  qa-tod third + cockpit (160 frames swept, 0 black); consoles clean.

- **Piece 3: keyframe environment probes.** The sky probe (all reflections + sky ambient of ship,
  cockpit, terrain) was captured once at the dawn state, so the late morning was lit by a dawn sky.
  `WorldEnvProbe` now keeps its capture rig alive (cube target, cube camera, PMREM generator, a probe sky
  material that SHARES the live sky's uniforms so a capture always sees the current time of day) and two
  ping-pong PMREMs, both allocated in prepare (the generator only allocates its ping-pong buffer on a
  target-less call: prepare makes two). When the sun has moved > 1 deg since the last capture,
  MissionWorld starts a recapture; MissionDriver advances it ONE cube face per frame, then the prefilter
  into the spare target, then rebinds `scene.environment` (same size + format: no program key change).
  Chosen over blending two env maps in the BRDF (would need uniform injection into three's built-in
  programs). Measured (qa-tod, 12 s of flight through the sunrise with a recapture in it): 60 fps, p95
  16.8, p99 16.9, 0 long tasks; programs 108 constant (the persistent probe material is compiled in
  prepare). Note (pre-existing, for C1 / W3): distant terraced / strata cliff walls moiré at LOD2.
  Gate piece 3 (prod, RTX 3050): 182 tests; qa-freedom 6 / 6; qa-flight 3 rigs 60 fps, p95 16.8-16.9,
  p99 <= 17.1, programs 108 + textures 105 constant; qa-tod third + cockpit (0 black, flight 0 long
  tasks); consoles clean.

### P2R.1 State at handover (2026-10-02, before any 2R code)

Phase 2 pushed: 2A (foundation, sim core, input, DRS, perf), 2B (wormhole —
now being deleted), 2C cp1 (weapon VFX + flight feel), cp3-cp8 (camera
rigs + blends, cockpit view + live mirrors + hands, DOM HUD, live MFDs +
combiner, settings rows, production launch path to Level 1 with auto
launch) — SHAs in P2.0. NOT done (merged into 2R): 2C cp9 close-out (flight
feel review, 20 hangar<->mission round trips, perf rows) -> W6/W9; 2D
(hazards, damage feedback, pause menu, fail/retry screens) -> W3/W6; 2E
(Umbra ships, AI, PatternLib, health bars, explosions, bestiary) -> W6/W7;
2F (voidspawn) -> W7/W8; 2G (Level 1 content, tutorial, KESTREL-9,
results, Sortie Select, save v2) -> W6; 2H (L22 + BULWARK) -> W8; 2I (L10 +
WARDEN + difficulty gate) -> W7; 2J (audio, balance, soak, qa:phase2,
handoff) -> W9.

Survives unchanged (environment-agnostic): src/game sim core (rail space,
pools, collision, events, HUD bus, bot), FSM, InputManager, DRS governor +
presets, perf instrumentation, camera rig switcher + 3 rigs (adapted in W1
to the path frame), cockpit view + mirrors (shared render), DOM HUD + MFDs
+ combiner, launch catapult + launch tunnel (Phase 1/2B), weapon VFX,
settings, QA tools (gpu.mjs guard, qa-flight/-camera/-hud/-mission/
-prodlaunch/-settings-p2/-launch-seq).

**Baseline** (prod build 35d854c, Level 1 = straight wormhole corridor,
bot mid, cockpit view, qa-mission 25 s, DRS frozen):
| GPU | preset | fps | p95 ms | p99 | calls | tris | programs | long tasks |
|---|---|---|---|---|---|---|---|---|
| RTX 3050 | HIGH | 60 | 16.9 | 17.0 | 101 | 98k | 111 (constant) | 0 |
| UHD 770 | LOW | 26.9 | 50.2 | 66.6 | 93 | 82k | 91 (constant) | 0 |
(UHD 770 LOW with DRS live: 59 fps at scale 0.85, P2 table.)

### P2R.2 Step map (brief §0-§21)
§0 directive | §1 hard rules (followed every push) | §2 canon -> W0b | §3
world bible -> W0a (data), worlds built W1-W8 | §4 path + world space -> W1
| §5 terrain -> W1 (+ dressing W3/W4) | §6 sky/atmosphere -> W2 | §7 water
-> W3 | §8 vegetation/rocks -> W3/W4 | §9 life/set pieces/weather -> W3-W8
| §10 creatures/enemies -> W6-W8 | §11 launch + arrival -> W5 | §12 three
levels -> W6/W7/W8 | §13 sim/camera/HUD/mirror/hazard adaptation -> W1,
W6 | §14 perf contract v2 -> every slice | §15 assets/licences -> ASSETS.md
every slice | §16 audio -> W9 (+ per world) | §17 workflow + build order |
§18 pitfalls | §19 QA protocol (qa:phase2) -> every slice, aggregate W9 |
§20 Phase 3 handoff -> W9 | §21 final report -> end.

### P2R.3 Architecture decisions (2026-10-02, before code)
1. **Sim stays in rail space** (s double, x right, y up); gameplay, AI,
   collision, determinism unchanged. The PATH (src/game/world/path.ts, pure
   TS) maps rail space to world: centripetal Catmull-Rom through authored
   waypoints {x, z, clearance, envA, envB, bank} -> 1 u arc-length LUT ->
   parallel-transport frame (T, R = norm(T x worldUp), U = R x T); world =
   P(s) + R x + U y. Visual bank (camera/ship) from curvature + lateral
   velocity; the sim envelope uses the unbanked frame.
2. **TerrainField is path-relative**: height(s, u) where u is the lateral
   offset along R(s) ("unrolled ribbon", +-900 u). Pure deterministic TS in
   src/game/world/terrain.ts (import-boundary test covers it), shared by
   sim, bot, workers, tests. World Y of a ground point = P(s).y_datum + h.
   The path's own altitude is datum + clearance profile, so the path always
   flies the valley. Ribbon self-overlap is prevented by the curvature rule
   (radius >= 1.25 x ribbon half-width = 1125 u); tighter visual meanders
   come from the valley/river meandering INSIDE the ribbon.
3. **Terrain render (to be measured in W1)**: worker pool (1-2) generates
   per-tile vertex data (positions relative to the tile origin + packed
   normals + splat weights + baked shadow/AO) into Transferable buffers
   recycled back; the main thread uploads into POOLED float textures by
   sub-image (<= 1 tile / frame, 0.6 ms budget); shared static ribbon grid
   meshes (3 LODs) fetch positions in the vertex shader. Prototype vs
   pooled BufferGeometry, keep what measures best (log both).
4. **Floating origin**: the mission root is re-centred on the player's path
   point each frame (world objects are placed relative to it); per-tile
   origins are uploaded as uniforms relative to that centre.
5. **Light rig unchanged in count/type** (Phase 2 rule): the world sun =
   a DIRECTIONAL light already in the rig (cockpit key DirectionalLight is
   the only directional; W2 decides between borrowing it for the sun —
   cockpit interior then lit by the sun, physically right — or keeping it
   and driving the sun through the studio key spot at a far distance). Sky
   ambient = the hemisphere. Shadow maps stay OFF in missions; terrain
   shadow is baked per tile (heightfield march toward the sun).
6. **Two depth ranges** (W1/W2): world pass near 1 / far 6000; cockpit +
   own-ship pass near 0.05 / far 40 after a depth clear.
7. **Programs**: every terrain / vegetation / water / sky / cloud variant
   compiled in prepare (existing compileSteps + uploadSteps + screen-variant
   link); LOD / preset changes are uniform-driven.
8. **Determinism of queries**: sim/bot/camera/creatures read terrain via
   CPU height grids (5 u, bilinear) filled from the same pure function; a
   miss evaluates directly (identical); never GPU tiles.

### P2R.4 Tunnel removal plan (W1, after the fly-through exists) — DONE in W1d
DELETE: src/render/mission/tunnel/ (Tunnel.ts, tunnelMaterial.ts,
tunnelNoise.ts), src/data/tunnel.ts (TUNNEL, TUNNEL_TIERS, MOODS, SPEED_FX
tunnel parts, STORM_FX), src/render/mission/launch/VeilGate.ts (+ its
launchSequence beats), Tunnel.mirrorShell + MIRROR_WORLD_LAYER content
(replaced by the reduced world pass), LevelDef.mood / pathParams / radius,
RAIL.tunnelRadius (bolt-vs-wall -> TerrainField), testLevel radius set
pieces, MissionDriver tunnel/storm block, qa-mission --loopAt corridor
specifics, tunnel references in rigState (swayX/Y from pathAt), SpeedStreaks
coupling to the tunnel filament colour (streaks stay, coloured per world).
KEEP: launch tunnel (Phase 1 cockpit bay), LaunchSky (until W5 replaces
the deep-space view with the planet), speed FX post (radial blur / CA).

### P2R.5 Risk register (2R)
| Risk | Impact | Mitigation |
|---|---|---|
| Terrain looks like noise ("rubber hills") | founder test fails | look-dev workflow (§17) with clay/colour/dress/atmosphere passes, 5 beauty shots per world, critique rubric >= 4; valley composition + strata + cliff sharpening, not raw fBm |
| Worker tile generation > 25 ms or late tiles | hitch / holes | look-ahead 1800 u, priority queue, coarse LOD + fog cover, lateTiles metric = 0 gate |
| Texture creation per tile / GC churn | hitches | pooled textures + sub-image upload, Transferable recycling |
| CPU/GPU height mismatch | ships clip terrain | one pure function; sample-vs-vertex parity test < 0.05 u |
| Vegetation overdraw / tri budget on iGPU | < 40 fps LOW | LOD0 off on LOW, impostors, density lever in DRS |
| Light rig change -> recompiles | hitches | sun on an existing directional, uniforms only |
| Scope (3 full worlds + 3 levels + Phase 2 remainder) | unfinished P0 | cut order P2 -> TITANS -> dam flood -> volumetric extras; never cut terrain/sky/atmosphere/water/vegetation/dive/identity/zero-hitch |
| Asset licences | cannot ship | procedural first; CC0 only (Poly Haven / ambientCG) logged in ASSETS.md |
| iGPU noise in measurements (owner's desktop shares it) | wrong conclusions | GPU timer queries for pass costs; alternate A/B windows; medians |

---

## P2.0 Phase 2 status (update every slice)

Brief: "PHASE 2 OF 4 — THE WORMHOLE" (§0-§23), received 2026-10-01.
Slices 2A-2J (brief §20). Push gate per slice: typecheck, unit tests,
production build, QA script with 0 console errors/warnings, then commit
(game/g1 paths staged explicitly) + push + `git ls-remote` == HEAD.

| Slice | Status | Push | Notes |
|---|---|---|---|
| Baseline | DONE | — | qa:phase1 green, build/tests clean (P2.6) |
| 2A Foundation | DONE | 562274a, c9dd224, ceb9559, 08a2298, 2a78216, 53f3701, 4fd4243, 76946db | carry-overs (a)(b)(c), sim core, flow + input, bot + balance CLI, perf instrumentation, empty mission scene: GATE passed (60 fps both GPUs, programs constant) |
| 2B Wormhole + launch | DONE | 6c06350, b6ef2fe, 80f637d, 2cd09be, (close-out) | tunnel, tiers, moods, speed FX, launch + Veil Gate, radius set pieces (chamber/collapse), storm flashes; GATE: 5-min in-mission heap trend flat (+0.09 MB/min, sawtooth 1.45 MB), 60 fps for 5 min. Storm-bolt readability judged in 2H |
| 2C Flight + rigs + HUD | IN PROGRESS (cp1, cp3-cp8 done; cp2 + cp9 left) | ba206d5, 06054d8, d1d5d93, 6601722, 84bb284, a4e2a48, 5b33c80, 838d28b, (cp8) | cp1 weapon VFX + flight feel; cp3 rig switching (third/chase blend, Cycle Camera, saved mode; cockpit falls back to third until cp4 registers the cockpit root); cp4a cockpit interior in the mission + live mirrors (reduced set) + iGPU/compile fixes; cp2, cp4b-cp9 TODO (see HANDOFF) |
| 2D Hazards + damage + pause/fail | TODO | | |
| 2E Umbra ships + AI + bestiary | TODO | | |
| 2F Voidspawn monsters | TODO | | |
| 2G Level 1 + results + Sortie Select | TODO | | |
| 2H Level 22 + BULWARK | TODO | | |
| 2I Level 10 + THE WARDEN | TODO | | |
| 2J Audio, balance, soak, final QA | TODO | | |

**HANDOFF (2026-10-01, paused by the owner mid-2C) — read this first.**

*Where we are.* Brief = "PHASE 2 OF 4", sections §0-§23 (the owner's "steps";
a session's brief text is NOT in the repo — the last session recovered it
from `~/.claude/projects/-mnt-d-Manik-Work-Portfolio/91b9452b-...jsonl`;
the slice plan below + P2.2 are enough to continue). **Current step: §7
(player ship / input / weapons), inside slice 2C** (2C = §7 + §8 + §9).

*Step map (§ = brief section):*
| § | topic | status |
|---|---|---|
| 0-2 | role / hard rules / scope | DONE (rules, followed) |
| 3 | architecture (sim/render split, pools, event bus) | DONE + pushed (2A) |
| 4 | zero-hitch contract: carry-overs, DRS, instrumentation, heap | DONE + pushed (2A; 5-min heap 2B close) |
| 5 | world, rail, sim core | DONE + pushed (2A) |
| 6 | wormhole + speed FX + set pieces | DONE + pushed (2B) |
| 7 | player ship, input, weapons | IN PROGRESS: sim + input (2A), weapon VFX + attitude feel (cp1), cockpit hands/recoil (cp4b-2) done; LEFT: shield-hit ripple + low-hull smoke/decals (2D), flight-feel review write-up (cp9) |
| 8 | 3 camera rigs + live mirrors | DONE (2C cp3 + cp4, 2026-10-02): third / chase / cockpit wired with 0.6 s blends, Cycle Camera, live mirrors (shared render), hands |
| 9 | HUD + in-mission UI | IN PROGRESS: overlay HUD DONE (cp5); combiner + MFDs (cp6), settings rows (cp7); pause menu / failed (2D); results, sortie select, comms, tutorial (2G) |
| 10 | combat systems (damage, pickups, hazards, scoring, juice) | partial (sim damage/scoring 2A); rest 2D |
| 11 | Umbra ships + AI + PatternLib + health bars | TODO 2E |
| 12 | Voidspawn monsters | TODO 2F |
| 13 | VFX library (explosions S/M/L/boss, dissolve, telegraphs, ?screen=vfxlab) | partial (particle system + weapon VFX in cp1); rest 2D-2F |
| 14 | LevelDef + levels 1/10/22 + boss + launch + prepare | partial: launch sequence + prepare DONE (2B); validator, levels, Warden TODO 2G-2I |
| 15 | difficulty gate + balance | partial (bot skeleton + CLI 2A); TODO 2I/2J |
| 16 | audio | TODO 2J |
| 17 | flow FSM | DONE + pushed (2A) |
| 18 | accessibility & safety | ongoing (reduce-motion/flash honoured in all new code) |
| 19 | pitfalls | ongoing |
| 20 | build order | ongoing (slices) |
| 21 | QA protocol (`qa:phase2`) | partial tools (qa-mission, qa-flight, qa-input, qa-launch-seq); `qa:phase2` aggregate TODO 2J |
| 22 | Phase 3 handoff contract | TODO 2J |
| 23 | final message | TODO end of Phase 2 |
Fully complete + pushed: §0, §1, §2, §3, §4, §5, §6, §17 = **8 of the 24
sections (§0-§23)**; substantive build steps complete: §3, §4, §5, §6, §17.

*Pushes this session (2026-10-01, resumed):* `578b7df` (2B close-out: 5-min
heap trend, qa-mission --loopAt), `ba206d5` (2C cp1). Earlier Phase 2 pushes:
562274a, c9dd224, ceb9559, 08a2298, 2a78216, 53f3701, 4fd4243, 76946db,
6c06350, b6ef2fe, 80f637d, 2cd09be. (+ the commit carrying this handoff.)

*Working tree at pause:* clean build at HEAD. TWO UNCOMMITTED WIP files,
intentionally not pushed (they compile; nothing imports them yet):
`src/scenes/mission/missionCamera.ts` (cockpit view on/off: ship to
MIRROR_LAYER, cockpit lights placed on the eye each frame, `cycleCamera()`,
`setCockpitEye()`) and `src/ui/screens/mission/hudView.ts` (`hudView.cockpit`
flag for the HUD layout). They belong to cp3/cp4 — review, then use or
delete. Data already pushed for them: `COCKPIT_RIG`, `COCKPIT_LIGHTS` in
`data/mission.ts`; `cockpitInMission` in `scenes/sceneBridge.ts`.

*2C remaining checkpoints (push each once gated):*
- **cp2** (small): flight-feel tuning pass with the bot + manual notes —
  watch `qa/p2c/flight-third-*.png`; consider tracer presence vs the busy
  tunnel (data/vfx.ts TRACER), muzzle size, chase framing. Optional; can fold
  into cp9.
- **cp3 DONE (2026-10-02)** rig switching: `missionCamera.ts` / `hudView.ts`
  committed and wired. `missionMode()` maps `cockpit` -> `third` while
  `cockpitInMission.root` is null (cp4 registers it, which enables the view).
  `followCameraSetting()` subscribes to `camera.mode` (Cycle Camera = KeyC,
  Settings) -> `rig.set()` 0.6 s blend; unsubscribed in `endFrame`.
  `RIGS.streakGain` (chase x1.3) eased in MissionDriver. `__G1__.mission.rig()`
  debug read. QA: `tools/qa-camera.mjs` (real KeyC presses, blend frames,
  programs constant) — RTX 3050: 60 fps, p95 16.8, 0 long tasks, logs [].
  NOTE: with `launch=skip` the first key press is the page's first gesture
  and carries the P2.7 AudioContext init (traced: `createContext` 194 ms);
  qa-camera primes with an unbound key (KeyJ) before measuring.
  Original plan for reference: in `missionFlow.beginFrame` attach with
  `useSettings.getState().camera.mode` instead of the hard-coded `'third'`;
  set `mission.rig.onView = applyCockpitView` (missionCamera.ts) BEFORE
  attach; call `setCockpitEye(shipId)` in MissionLoader when the ship
  changes; wire `InputManager.hooks.cycleCamera = cycleCamera` and subscribe
  to `camera.mode` changes -> `mission.rig.set(mode)` (0.6 s blend);
  `endFrame` -> `mission.rig.detach()` already clears `director.quat`. Chase
  rig: `RIGS.chase`, streak amount x1.3 in chase. Capture with
  `tools/qa-flight.mjs --modes third,chase` + a blend sequence.
- **cp4a DONE (2026-10-02)** cockpit view in the mission: `<Cockpit/>` registers
  `cockpitInMission.root`; while `cockpitInMission.on` the interior shows, the
  own ship + launch bay hide, the root is restored to COCKPIT_ORIGIN on exit.
  `CockpitRig.placeRoot()` is called by the switcher ONLY while the interior
  shows (the outgoing rig used to drag the root during a blend-out -> root
  stranded at the mission frame). Cockpit key/dash lights follow the eye
  (`updateCockpitLights`). Combiner `hudMode = 'off'` at the breach (cp6 adds
  'mission'). Mirrors in mission: `MirrorRig.setLayers` -> MIRROR_LAYER +
  MIRROR_WORLD_LAYER (5) where `Tunnel.mirrorShell` (LOW variant, same
  geometry/program) lives; every scene light enables layer 5 (three only
  collects lights sharing a camera layer: without it every lit material
  compiled a no-light variant on the first cockpit switch = 1.1 s task).
  Perf fixes found on the way (all measured, see perf table): (1) mission
  composer now resizes on DPR change — DRS never reduced mission fill
  before; (2) display canvases software-backed on integrated GPUs
  (`render/gpuClass.ts`; accelerated 2D -> texImage2D synced two contexts:
  ~15 fps lost on the UHD 770), accelerated on discrete (software cost ~3 ms
  main thread on the RTX); (3) one canvas redraw+upload per frame (combiner
  first, then the most overdue MFD; MFDs ~10 Hz each); (4) `uploadSteps`
  (compileSliced.ts) uploads every mission/cockpit geometry in the prepare
  (compile() uploads none; the cockpit eye framed a cone mid-flight); (5) the
  mission post's on-screen EffectMaterial variant is linked in the prepare
  (`gl.compile` with the screen bound) — it used to compile on the first
  mission frame = the breach (pre-existing since 2B).
  QA: `qa-flight`/`qa-camera` now snapshot resources AT `mission.playing`
  (the old snapshot 2.5 s later hid start-of-mission compiles).
- **cp4b-1 DONE (2026-10-02)** shared mirror render: the 3-target path
  measured 2.56 ms GPU per refresh on the UHD 770 MEDIUM (> the brief's 1.2 ms
  rule), so in the mission `MirrorRig.setShared(true)`: ONE rear camera (the
  centre mirror's, symmetric frustum = union of the 3 mirrors' corner rays)
  into one target, each surface samples its `uWin` UV window; no MSAA on that
  target (the multisampled HalfFloat resolve was most of the cost). GPU timer
  queries (`.scratch/mirgpu.mjs`, EXT_disjoint_timer_query_webgl2), ms GPU per
  refresh, 3 targets -> shared: UHD 770 MEDIUM 2.56 -> 1.32, LOW 2.39 -> 1.04,
  RTX 3050 HIGH 0.78 -> 0.37. Frame-time deltas on the iGPU are too noisy for
  this (the owner's desktop shares it) — use the timer queries. Phase 1 bay
  keeps its 3 multisampled cameras. Phase 1 cockpit A/B on the iGPU (old
  build 06054d8 vs new, back to back): new 10.5-13.6 fps vs old 7.7-10.3 —
  no regression (absolute numbers below the Phase 1 record = machine load).
- **cp4b-2 DONE (2026-10-02)** hands: `BuiltCockpit.stick` / `.throttle`
  (additive) registered as `cockpitInMission.hands`; `scenes/mission/
  cockpitHands.ts` (data `COCKPIT_HANDS`) tilts the stick with the input the
  sim consumed (pitch moveY, roll moveX; bot / QA input shows too), throttle
  rides boost / brake, recoil kick per shot (shotsFired delta; x0.3 with
  reduce-motion); reset when the view ends AND in `endFrame` (the driver stops
  with the frame). `__G1__.cockpit.hands()`; qa-camera --hangar checks the
  hands deflect in flight and are at rest in the hangar. Envelope corners in
  the cockpit view: no clipping (qa-flight cockpit corner beats).
  **cp4 COMPLETE.**
  Original plan for reference: in `scenes/cockpit/Cockpit.tsx`
  register `cockpitInMission.root = root.current`; visible when
  `stage.cockpit >= 0.5 || cockpitInMission.on`; while on: force
  `built.group.visible = true`, hide `own.group` and the LaunchTunnel group,
  keep drawing displays; on off: restore position to COCKPIT_ORIGIN,
  identity rotation, reset `viewApplied`. Call
  `updateCockpitLights(cockpitFx.power.dash)` each frame in MissionDriver
  while on (lights are borrowed: applyLights zeroes them). `Mirrors.tsx`
  useFrame gate -> `stage.cockpit < 0.5 && !cockpitInMission.on`. Mirrors
  must use a reduced layer set + the cheapest tunnel variant (second LOW
  tunnel mesh on MIRROR_LAYER, main tunnel on a main-only layer); MEASURE:
  > 1.2 ms GPU on MEDIUM for 3 targets -> one shared wide rear render
  sampled through 3 UV windows (same MirrorRig API). Hands: expose `stick` /
  throttle groups from buildCockpit (additive), tilt with input, recoil on
  PlayerFire. Draw-call budget <= 150 (cockpit alone ~111 in Phase 1: merge
  static meshes by material if over). Check no clipping at envelope corners.
- **cp5 DONE (2026-10-02)** DOM HUD: `ui/screens/mission/MissionHUD.tsx` (static
  DOM, 57 nodes) + `hud.module.css` + `hudDom.ts` refs; written by
  `scenes/mission/MissionHudDriver.tsx` (useFrame 0.5: after the director,
  before the shaken render): reticle = guns' convergence point (aim
  rigAim, C = 120) projected, pipper = C along the nose; transforms only
  when moved > 0.25 px; 20 Hz data on `hud.seq` change (scaleX bars, cached
  text, danger / locked flags, SVG rings); Hit / Kill markers from its own
  event reader; 8 pooled threat chevrons (HudThreat.angle documented: screen
  direction from the reticle, 0 = up, clockwise). Cockpit view = light
  overlay (panels hidden; the MFDs carry them in cp6). Data `HUD`. QA hooks
  `__G1__.sim.vitals/threat/event`; `tools/qa-hud.mjs` (nodes <= 120,
  reticle tracks aim, pipper sane, danger flags, programs, perf, console).
  RTX 3050 both views: 60 fps, 0 long tasks. GOTCHA fixed: an individual CSS
  `rotate` applies BEFORE `transform` -> the pipper's translate was swung
  45 deg; rotate a pseudo-element instead. Target panel + real hit/kill
  markers: verify with enemies in 2E.
  Original plan: DOM HUD (brief §9, <= 120 nodes, 20 Hz from `sim.hud`, reticle via
  rAF transform only, late-latched `InputManager.state.yaw/pitch`; bars via
  transform scaleX; no backdrop-filter): reticle ring + dot + ship pipper +
  hit/kill markers (Ev.Hit/Ev.Kill), SHIELD/HULL segbars (Danger pulse < 25 %),
  boost energy + speed + roll-cooldown ring, score + combo ring, progress bar,
  credits, target panel (when `hud.targetSlot >= 0`), 8 pooled threat
  chevrons. Phase 1 primitives/tokens (ui/primitives, ui/tokens.css).
  Cockpit: light overlay + combiner (`hudView.cockpit`).
- **cp6 DONE (2026-10-02)** live MFDs + combiner: `cockpitFx.hudMode 'mission'`
  (set at the breach, 'off' in endFrame) + `cockpitFx.mission` data written by
  MissionHudDriver at the 20 Hz refresh (attitude per frame). Left MFD SYS //
  VITALS (shield / hull red < 25 %, boost + LOCKED, roll ready, transit);
  centre: ship wireframe + live HULL / SHLD / combo, or TGT // CONTACT +
  health when targeting (2E verifies); right: radar + transit route with the
  ship marker. Combiner: world-level pitch ladder (rotates +camera roll,
  reduce-motion = RIGS.reduceRoll share), live speed box, boost bar, score
  + combo, HULL CRITICAL / SHIELD LOW (blink unless reduce-flashing). The
  mission combiner redraws + uploads ONLY when its quantised content
  signature changes. UHD 770 LOW cockpit, bot mid, DRS live: 59 fps at
  scale 0.85 (cp4a: 50.8 at 0.5); main-thread render ~5.5 ms avg (software
  canvases while the bot manoeuvres) — fits; revisit only if 2E's load
  pushes it. Original plan: live MFDs + combiner: `scenes/cockpit/displays.ts` new
  `hudMode 'mission'`: left shield/hull/energy/roll cd, right radar + progress,
  centre target wireframe/health or ship status; combiner flight symbology.
- **cp7 DONE (2026-10-02)** settings rows in SettingsModal: Controls > Flight
  assists (aim assist OFF/LOW/MED/HIGH — read at sim creation, "applies
  from the next launch"; auto-fire), Camera > roll coupling (0-140 %),
  Graphics > speed lines (0-100 %), Accessibility > Subtitles (on/off +
  SMALL/MEDIUM/LARGE). `tools/qa-settings-p2.mjs`: real clicks / slider keys,
  values reach the save, survive a reload, console clean.
  Original plan: settings rows (fields already in `state/schema.ts`):
  controls.aimAssist, controls.autoFire, accessibility.subtitles +
  subtitleSize, camera.rollCoupling (0-1.4), graphics.speedLines — in
  `ui/screens/settings/SettingsModal.tsx` with the existing row components.
- **cp8 DONE (2026-10-02)** production launch path: `levels/level01.ts`
  (`l01` FIRST LIGHT skeleton: corridor 1, 58 u/s, 9300 m, mood l1,
  checkpoints 3100 / 6200, empty timeline until 2G) + `DEFAULT_LEVEL` in the
  registry; `app/mission/autoLaunch.ts` (installed by App, off when a QA
  `?level=` drives): briefing -> `prewarmMission(l01)`, standby ->
  `enterMission(l01)` after `LAUNCH.standbyBeat` 2.4 s unless the flow left
  standby (Esc) or `__G1__.launch.holdStandby(true)` (QA). MissionLoader:
  an in-flight prepare is shared only for the SAME level (a different one
  queues behind it). `tools/qa-prodlaunch.mjs`: page-level clicks only
  (START MISSION -> LET'S GO x2 -> camera card -> standby -> auto launch ->
  playing on l01), then REAL keyboard flight (D / A / W move the ship, no
  bot), GL allocation trace after play start; x3 cameras on the RTX 3050:
  60 fps, 0 long tasks, 0 allocations after play start, console clean.
  Found + fixed on the way (Phase 1 amendment 8): the hangar floor's
  reflector leaked 4 render targets on every Floor re-render (inline
  `blur` array -> drei rebuilt its FBOs, never disposed) and, like the
  pad contact shadow, re-rendered the WHOLE scene every frame in the
  cockpit + missions (UHD 770 MEDIUM mission: 41.1 -> 44.1 fps without it).
  Original plan: production launch path: standby auto-LAUNCH after a beat (today only
  QA `?level=` launches) + `levels/level01.ts` skeleton LevelDef (corridor 1,
  58 u/s, ~9300 m, mood l1, empty timeline until 2G) in `levels/registry.ts`;
  prewarm at briefing start. Verify hangar -> START MISSION -> cockpit ->
  LET'S GO -> camera -> standby -> launch -> playing with page-level clicks.
- **cp9** 2C close: flight-feel review (bot recording + manual notes, honest),
  re-run `tools/qa-input.mjs` (input robustness), qa-flight all 3 rigs,
  qa-mission perf rows on both GPUs, 20 hangar<->mission round trips
  (memory), qa:phase1 cockpit group still green, DEV_NOTES 2C table row DONE.

*Then:* 2D (§10 hazards + damage + feedback, pause menu, fail/retry), 2E
(§11 Umbra + AI + PatternLib + health bars + explosions + bestiary), 2F (§12
monsters), 2G (§14 Level 1 + tutorial + KESTREL-9 + results + Sortie Select +
awardMission/save v2), 2H (Level 22 + BULWARK + storms/collapse), 2I (Level 10
+ THE WARDEN + §15 difficulty gate), 2J (§16 audio, balance report, soak,
`qa:phase2`, §22 handoff, §23 report). Details per slice: P2.2.

*First actions on resume (exact):*
1. `git status` (expect only the two WIP files above) and `git log --oneline
   -3` == `git ls-remote origin main`.
2. `cd game/g1 && npm run typecheck && npx vitest run` (102 tests) and, at the
   repo root, `npm run build` (only the two pre-existing portfolio warnings).
3. Start preview for QA: repo root `npx vite preview --port 5198
   --strictPort` (run in background with the MAX timeout; the WSL shim can be
   killed while the Windows node keeps serving — record its Windows PID via
   `Get-NetTCPConnection -LocalPort 5198` and stop exactly that at the end).
   Port 5173 belongs to the owner's own dev server — never touch it.
4. GPU: `export WSLENV=G1_DGPU G1_DGPU=1` before every `node tools/...`,
   else the run is on the integrated GPU (re-confirmed 2026-10-02: without
   WSLENV the renderer is the UHD 770 even with G1_DGPU=1 set).
   `node tools/gpu.mjs` prints the renderer. `tools/gpu.mjs` `assertGpu(page)`
   (wired into qa-flight, qa-mission, qa-camera, qa-launch-seq,
   trace-window) reads WEBGL_debug_renderer_info in the page and THROWS when
   the GPU does not match G1_DGPU; perf rows carry the verified `gpu` label.
5. Sanity: `node tools/qa-flight.mjs --modes third --out qa/p2c` -> 60 fps,
   programs constant, logs []; open a few `qa/p2c/flight-third-*.png`.
6. Continue with **cp3** above.

*Gate before every push (unchanged):* typecheck, all unit tests, production
build clean, QA script with 0 console errors/warnings + screenshots actually
inspected, `git diff --cached` only game/g1 paths staged explicitly (never
`git add -A`/`.`), author `Himkush1414 <light.dark14143@gmail.com>`, push,
`git ls-remote origin main` == HEAD. Cadence: ~2-3 verified pushes per step.

*Known open items:* storm bolts subtle (L22, 2H); test level's chamber reads
as a bright "doorway" from the narrow tube (expected); iGPU numbers vary
with the owner's editor using the iGPU; the sim's bolt-vs-wall test uses the
constant 46 u radius, so in the chamber (visual radius 110) wall sparks
appear mid-air — make the wall radius follow `level.radius` (sim, 2D);
ghost-echo silhouettes / Meridian fragments planned for 2G.

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
   Pushed `ceb9559`.
4. **Flow + input (2A, 2026-10-01).** `app/flow.ts` gains the brief §17
   mission states (`mission.preparing|launching|playing|paused|bossIntro|
   dying|failed|completing|results`) and events (PREPARED, LAUNCHED, PAUSE,
   RESUME, BOSS_INTRO(_DONE), PLAYER_DIED, DEATH_DONE, RETRY, RESTART,
   LEVEL_COMPLETE, COMPLETE_DONE, NEXT, HANGAR); `launch.standby` accepts
   LAUNCH; HANGAR exits through `launch.returning`; `isMission`, `isSimLive`
   selectors. HangarUI stays retracted in mission.*. Bindings: **Brake
   ControlLeft -> KeyF** (Ctrl+W = brake + move up closed the tab); Ctrl /
   Alt / Meta added to RESERVED_CODES; the settings sanitizer repairs a
   saved modifier binding (default if free, else cleared) — no save version
   bump needed. Settings fields added (brief §9, rows ship in 2C):
   `controls.aimAssist` (low), `controls.autoFire`, `camera.rollCoupling`,
   `graphics.speedLines`, `accessibility.subtitles` / `subtitleSize`.
   Pushed `2a78216`.
6. **Camera director quaternion (2C, 2026-10-01).** `director.quat`
   (additive, default null): when set, CameraDirector copies it instead of
   lookAt(look) + roll. Mission rigs set it (the cockpit interior rides the
   same orientation, no swimming); `RigSwitcher.detach()` clears it, so the
   hangar / cockpit / launch paths are untouched. Cockpit launch third /
   chase views scale their offsets by ship length like the mission rigs.
7. **Cockpit in the mission (2C cp4a, 2026-10-02).** `Cockpit.tsx` registers
   its root in `cockpitInMission` and shows/hides the interior for the mission
   cockpit view (root restored to COCKPIT_ORIGIN after); `Mirrors.tsx` runs
   while `cockpitInMission.on` and switches its cameras' layers (`MirrorRig.
   setLayers`, additive); `displays.ts` canvases are software-backed on
   integrated GPUs and redraw at most one canvas per frame (MFDs ~10 Hz
   instead of 15 — visually equivalent; the combiner keeps 30 Hz).
   `MirrorRig` gains a shared mode (`setShared`, `sharedCamera/Target`,
   `windows`) and the mirror surface shader a `uWin` window (whole texture
   in the bay = unchanged look). Phase 1
   cockpit QA group re-run: clean, mirrors 28.6 refresh/s, 60 fps.
8. **Hangar floor + pad shadow + standby (2C cp8, 2026-10-02).**
   `bay/FloorReflector.tsx` replaces drei's MeshReflectorMaterial wrapper
   (same material + BlurPass classes, same defines / look): `active` gate
   (no reflection render while the hall is hidden: cockpit, missions) and
   disposal of its targets on unmount; `blur` is a module constant (the
   inline array rebuilt + leaked 4 render targets per re-render).
   ContactShadow skips its capture while the hall is hidden. Verified: in
   the hangar the reflector + shadow still render (1 + 5 blur, 3 shadow
   passes per frame), in a mission 0; Phase 1 hangar + cockpit groups
   clean. STANDBY now auto-launches after 2.4 s (P2.1 decision 6); the
   Phase 1 cockpit QA group calls `launch.holdStandby(true)` first.
5. **Mission frame hooks (2A, 2026-10-01).** `stage.mission` flag (Stage);
   `MISSION_ORIGIN` (sceneBridge); Hangar hall hidden while a mission is
   live; Cockpit stops writing fog and its lights while borrowed;
   StudioLights + CockpitLights register with `render/lightRig.ts`; PostFX
   yields to `MissionPostFX` while `stage.mission` is on (+ perfMon hooks);
   launchTimeline `returnToHangar()` split into the flow guard +
   exported `returnSequence(onSealed?)` (same choreography; the mission
   exits through it). qa:phase1 cockpit group re-run on prod: clean.

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

### P2 perf table — missions (prod build, 1920x1080, bot mid, ?drs=0)

| scenario | GPU | preset | avg fps | p95 ms | sim ms avg/p95 | render ms avg/p95 | long tasks | calls | tris | programs const | heap delta |
|---|---|---|---|---|---|---|---|---|---|---|---|
| empty mission (2A), 30 s | RTX 3050 | HIGH | 60 | 16.8 | 0.04 / 0.1 | 1.7 / 2.9 | 0 | 34 | 48k | yes (93) | +0.3 MB |
| empty mission (2A), 20 s | UHD 770 | LOW | 60 | 16.8 | 0.05 / 0.1 | 2.4 / 3.6 | 0 | 28 | 48k | yes | +6 MB (check) |
| tunnel L1 (2B), 20 s | RTX 3050 | HIGH | 60 | 16.8 | 0.03 | 1.4 / 2.7 | 0 | 37 | 79k | yes (99) | -7.9 MB (GC) |
| tunnel L1 (2B), 20 s | RTX 3050 | MEDIUM | 60 | 16.8 | 0.03 | 1.3 / 2.6 | 0 | 32 | 72k | yes | +0.3 MB |
| tunnel L1 (2B), 20 s | UHD 770 | LOW | 60 | 16.8 | 0.04 | 2.0 / 3.5 | 0 | 30 | 72k | yes | -3.6 MB (GC) |
| tunnel L1 (2B), 20 s | UHD 770 | MEDIUM (DRS frozen) | 41.9 | 33.6 | 0.05 | 1.7 / 3.3 | 0 | 32 | 72k | yes | -0.4 MB |
| + speed FX (2B), 20 s | RTX 3050 | HIGH / ULTRA | 60 / 60 | 16.8 | 0.03 | 0.73 / 1.4 | 0 | 38 | 79k | yes (101) | — |
| + speed FX (2B), 20 s | UHD 770 | LOW | 60 | 16.8 | 0.04 | 1.1 / 1.8 | 0 | 31 | 73k | yes (81) | — |
| 2C cp1 weapons + feel: qa-flight, sustained fire 6 s | RTX 3050 | HIGH | 60 | 16.9 (p99 17.1) | 0.05 | 1.75 / 3.1 | 0 | 43 | 91k | yes (109) | — |
| 2C cp4a cockpit view: qa-flight, sustained fire | RTX 3050 | HIGH | 60 | 16.9 | 0.05 | 1.97 / 3.4 | 0 | 101 | 98k | yes from play start (111) | — |
| 2C cp4a camera cycle third>chase>cockpit>third>chase + hangar | RTX 3050 | HIGH | 60 | 16.9 | — | — | 0 | 100 | — | yes (111) | — |
| 2C cp4a cockpit view, bot mid, DRS live (before -> after fixes) | UHD 770 | LOW | 20.7 -> 50.8 | 33.4 | — | 5.5 / 11 | 0 | 93 | — | — | — |
| 2C cp4a third view, bot mid, DRS live (before -> after DRS fix) | UHD 770 | LOW | 54.1 -> 57.3 | 17.3 | — | 1.8 / 3.2 | 0 | 36 | — | — | — |
| 2C cp4a cockpit view, DRS live (settling at 0.6) | UHD 770 | MEDIUM | 26.8 | 66.6 | — | 5.0 / 11 | 0 | 95 | — | — | — |
| 2C cp6 cockpit view (live MFDs, gated combiner), bot mid, DRS live (0.85) | UHD 770 | LOW | 59.0 | 17 | — | 5.6 / 14.8 | 0 | 93 | — | — | — |
| 2C cp8 third view, bot mid, DRS frozen: floor reflector rendering (before) vs gated (after) | UHD 770 | MEDIUM | 41.1 -> 44.1 | — | — | — | — | — | — | — | — |
| 2C cp8 production path (clicks, auto launch, l01, keyboard flight) x3 cameras | RTX 3050 | HIGH | 60 | 16.8 | — | — | 0 | 43 / 100 | 116k | yes, 0 GL allocations after play start | — |
| 2B close: 5-min soak (test corridor looped x5, bot mid), 300 s | RTX 3050 | HIGH | 60 (every 14 s window 59.6-60) | 16.8-16.9 | 0.03 / 0.1 | 1.6 / 3.9 | 0 | 38 | 79k | yes (104) | +0.09 MB/min, sawtooth 1.45 MB (rule 8: < 8 MB, flat) |

## P2.8 Engine notes (Phase 2)

- **Sim core (2A):** `src/game/core/` — `step.ts` FixedStepper (1/60 s,
  max 5 steps/frame, 0.1 s frame clamp, epsilon so 0.5 + 0.5 steps = 1;
  time scale stretches REAL time, presentation only), `rng.ts` (mulberry32
  with snapshot-able state; `createStreams(seed)` -> independent sim / ai /
  spawn streams; the renderer owns its own vfx stream), `events.ts`
  (EventRing: typed arrays, per-consumer readers, lost-count when a reader
  falls a ring behind, `Ev` codes), `pool.ts` (ProjectilePool SoA with
  swap-remove — render position = pos - vel * (1 - alpha) * STEP, no
  previous arrays; SlotPool for enemies/hazards: stable slots for instance
  mapping + dense alive list). `game/collide.ts`: allocation-free swept
  segment vs sphere / capsule / box (slab state at module scope — no
  closures). `game/rail.ts`: curve lookup, ellipse radius, envelope segments.
  `game/sim.ts` Sim: player flight (velocity command, accel 120 / decel =
  lateralSpeed / 0.18 s, soft ellipse spring + graze events, mouse fine
  positioning = 15 % of the reticle offset at 120 u over tau 0.25 s), roll
  (linearly decaying impulse integrating to 6 u, i-frames 0.10-0.40 s vs
  projectiles only), boost / brake / energy / lockout, shields + regen
  delay, twin alternating cannons converging at 120 u, aim assist (3 deg
  cone, steer capped at 4-6 deg, lead), swept bolt-vs-enemy with an
  s-sorted broadphase + binary search, damage model (shield first, 0.6 s
  hull immunity, combo reset, death event, ?god=1), combo scoring, 20 Hz HUD
  bus (`game/hud.ts`). `data/mission.ts` (every sim tunable), `data/stats.ts`
  (brief §7 stat formulas), `levels/types.ts` (LevelDef / SpawnEvent / ...),
  `levels/testLevel.ts`. Tests: simcore, collide (a 380 u/s bolt cannot
  tunnel through a 1 u target), sim (3000-step determinism, envelope, stop
  time, roll, boost, fire rate, kill, damage, god), gameBoundary (transitive
  import scan of src/game + src/levels: no three/React/DOM/stores, no
  window/document/performance.now/Date.now/Math.random).
- **Input (2A):** `input/inputState.ts` (pure, unit-tested: bindings ->
  actions with per-action hold counts, repeat + modifiers ignored, clear-all,
  roll / camera / pause edges, reticle in the aim cone at
  `INPUT.radPerCount` x sensitivity, invert-Y, idle recentre after 0.8 s,
  smoothing for the sim while the HUD reads the raw value = late latching,
  fine positioning only while the mouse is active and outside the deadzone)
  + `input/InputManager.ts` (DOM: pointer lock with unadjustedMovement ->
  plain -> absolute-cursor fallback; clear + pause on blur / hidden /
  pointer-lock loss; while playing preventDefault game keys, Tab, Enter,
  Space, wheel (passive: false), context menu; Ctrl/Meta combos never
  touched). `tools/qa-input.mjs`: 8 checks on prod via page-level input
  (held key moves, lock, mouse fire, reticle, blur clears fire + pauses,
  wheel prevented, Ctrl+W untouched) — all pass.
- **Bot + balance harness (2A skeleton):** `data/bot.ts` tiers (reaction,
  aim error with correction toward a residual + periodic re-roll, dodge
  probability, roll use, boost use, wander); `game/bot/bot.ts` (own RNG
  stream; sticky target, under-leading by tier, threat scan of enemy
  projectiles inside a 1.2 s horizon after the perception delay, roll vs
  strafe dodges, envelope margin); `game/bot/run.ts` headless runLevel;
  `levels/registry.ts`; `src/cli/balance.ts` + `tools/balance.mjs`
  (bundles with Vite's esbuild into `.cache/`, git-ignored; ms per run).
  Strafing-drone gallery (4 seeds x 40 s): novice 24 kills / 48 % acc, mid
  30.8 / 59 %, expert 33 / 63 % (unit-tested ordering). Sim gained the
  enemy-projectile vs player hurtbox layer (swept, r 1.6, roll i-frames).
- **Perf instrumentation (2A):** `render/perfMon.ts` — section timers
  (`sim`, `render` = composer submit, `hud`, `audio`) and frame cadence in
  fixed Float32 rings (no per-frame allocation), long-task observer,
  renderer.info + heap once a second; `__G1__.perf.reset(label)` /
  `perf.table()` -> scenario, seconds, avgFps, p95, p99, maxFrame,
  longTasks, per-section stats, draw calls, triangles, programs,
  geometries, textures, heapMB, heapDeltaMB. FRAME TIME = rAF timestamp
  deltas (frame START, vsync-aligned): end-of-frame performance.now()
  folded the varying render cost into every delta (p95 19-24 ms at a steady
  60 fps) — the DRS driver reads the same clock. `performance.mark/measure`
  only with `?trace=1` (they allocate an entry per call); stats-gl overlay
  (CPU + GPU timer panels) with `?debug=1&stats=1` (not plain debug=1, so
  scored captures stay clean). Hangar idle, RTX 3050 1080p HIGH: 60 fps, p95
  16.8, render submit 3.4-3.6 ms avg / 6.2-6.7 p95, GPU ~7 ms (stats-gl),
  124 calls, 0 long tasks.
- **DRS menu profile = mean frame time** (down > 30 ms, up < 20 ms): a p95
  sits on the vsync quanta and flipped scales. Missions keep the brief's p95
  rule. iGPU note: UHD 770 timings vary +-20 % with other load on the iGPU
  (another process held ~12 % of its 3D engine during one re-measure: 0.72
  scale 38 -> 29 fps, 0.5 55 -> 45); the governor then settles one step
  lower and still holds >= 30 fps (36-43 fps measured).
- **Empty mission scene (2A gate):** `scenes/mission/missionRuntime.ts`
  (mission root at MISSION_ORIGIN, player attitude wrapper, stepper, rig),
  `MissionLoader.prepare(level, opts)` (player ship, sliced compile of the
  hidden mission root against the real lights + fog, mission composer warmed
  off-screen, new Sim + optional Bot; `mission.progress` = SYSTEMS SYNC),
  `MissionDriver` (useFrame -3: input -> fixed steps -> events -> flow ->
  interpolated ship attitude: bank -k vx, pitch k vy, 30 % nose yaw to the
  reticle, 2 pi barrel roll -> camera rig), `render/rigs/ThirdPersonRig.ts`
  (CameraRig: offset (0, 3.2, 12), FOV 70 x settings/75, lags 0.08 / 0.12 s,
  25 % look-ahead; writes the camera director), `render/MissionPostFX.tsx`
  (separate composer: bloom at preset res, CA, exposure, AgX, vignette,
  grain), `app/mission/missionFlow.ts` (LAUNCH -> prepare -> frame swap ->
  playing; lights borrowed + fog + shadow auto-update off; pause on Esc /
  blur / lock loss, click resumes; death / complete auto-continue until 2D /
  2G screens; HANGAR via the bulkhead sequence with the mission torn down
  while sealed). QA: `?level=<id>&debug=1[&bot=&god=1&seed=]`,
  `__G1__.mission.start/pause/resume/retry/hangar/state`,
  `__G1__.sim.state/step`, `tools/qa-mission.mjs` (programs / geometries /
  textures identical after warm-up vs after the run, long tasks, perf table,
  exit to the hangar).
- **Wormhole (2B):** `render/mission/tunnel/` — `tunnelNoise.ts` (seamless
  periodic-fbm RGBA 256^2, 4 channel frequencies, baked in idle slices),
  `tunnelMaterial.ts` (shell: depth grade near -> mid -> far, big swirl banks
  for volume + indigo/violet gas by depth, 1-4 layers of THIN ISO-LINE
  threads masked into patches, storm arcs (ARCS define), rail-locked
  travelling rings fading in with distance, infestation veins (iso-lines in
  patches) over darker tissue ridges + Danger heartbeat, HDR core haze,
  limb darkening, IGN dither; veil shell (HIGH+, additive wisps); core disc
  (HDR glow + analytic rays, same path offset as the tube end)),
  `Tunnel.ts` (tier materials share ONE uniform object; hidden warm-up
  holders make every tier compile in prepare; rail phases fract-ed / mod-ed
  in double on the CPU; cosmetic path offset relative to the player).
  `data/tunnel.ts`: geometry, tiers, MOODS l1 / l22 / l10. LevelDef mood =
  `{ preset, overrides?, storm }`. LESSONS: (1) a ridged transform of fbm
  lights the whole wall (fbm clusters at 0.5) -> threads are iso-lines
  `1 - |n - 0.5| * W`, cubed, W 18-40; (2) isotropic texture = marble ->
  stretch along the rail (220 m per repeat, 8 around) so it reads as flow;
  (3) uv.x from the geometry (duplicated seam column), never atan: no seam.
  QA: `&mood=l1|l22|l10&storm=0..1` with `?level=`.
- **Speed sensation (2B):** `render/mission/vfx/SpeedStreaks.ts` (one
  InstancedMesh, per-instance (angle, radius, phase, seed); placement +
  rail-locked scroll + speed stretch entirely in the vertex shader; count per
  preset 140 / 260 / 420 / 600; `graphics.speedLines` scales it); FOV kick
  in the rig (+12 % per +100 % over cruise, +9 deg boost, critically damped,
  off under reduce-motion); `RadialBlurEffect` (CONVOLUTION -> its own pass
  before the main pass, HIGH / ULTRA only, enabled above a visible strength;
  compiled in the warm render); edge CA scaled with speed (`missionPost.ca`);
  turbulence micro-shake via `CameraShaker.setRumble` (mood turbulence x
  speed; 25 % under reduce-motion). QA: `__G1__.sim.force({ boost: true })`
  forces input fields over any pilot. BUGS FOUND: (1) streak quads face
  radially OUT and the camera sits on the axis -> FrontSide culled every one
  (DoubleSide); (2) `smoothstep(hi, lo, x)` is undefined in GLSL — always
  write `1.0 - smoothstep(lo, hi, x)` (fixed in the streaks and the rings).
- **Launch sequence (2B):** `app/mission/launchSequence.ts` — one GSAP
  timeline: 3-2-1 (1 s each; combiner in the cockpit view = new hudMode
  'launch', DOM `LaunchOverlay` in third / chase) with Sato lines
  (`LAUNCH_LINES`, subtitled, size setting honoured) -> clamps release
  (clunk + trauma, rumble) -> 3.3 s power2.in catapult: the launch-tunnel
  GROUP slides +z (the ship is static in the cockpit frame), strip lights
  stretch by velocity (per-instance matrix, only during the run), FOV punch
  +16 deg, catapult speed on the combiner -> out of the mouth the Phase 1
  window plane hides and `LaunchSky` (direction-hashed stars + Veil glow,
  sphere fixed to the cockpit frame = skybox) shows -> `VeilGate` (rotating
  ring + fins + Ignition lamps, counter-rotating Ice emitter, log-spiral
  vortex over the corridor noise, HDR core, additive halo) -> breach:
  chromatic burst + exposure flash x7 -> `beginFrame()` at the flash peak
  (lights borrowed, fog, mission frame, input) -> flash clears on the
  corridor -> LAUNCHED. Retries: `runFastLaunch()` (~1.6 s flash + settle
  in the corridor). `cockpitFx.view` = eye / third / chase: launch views
  watch the own ship from its CENTRE (it sits canopy-on-eye), interior
  hidden; layer toggles only on view change. `MissionLoader.prepare` builds
  the gate + sky and compiles them with the mission root; QA `?level=` now
  runs the REAL path (prewarm at load, jumpTo('cockpit'), LAUNCH; `&launch=
  skip` cuts straight in). `tools/qa-launch-seq.mjs` (GSAP clock x0.25, 12
  beats per camera mode). Phase 1 amendments: cockpitFx gains count /
  launchSpeed / fovKick / view; Cockpit applies view + fovKick and stops
  driving the camera in missions; LaunchTunnel exposes `launchTunnelRef`.
- **iGPU measurement caveat:** the UHD 770 drives the display; when the
  owner's editor (Cursor) renders heavily it took ~88 % of a 3D engine and
  every iGPU number dropped ~25 % (mission LOW 60 -> 44 fps, both launch
  paths identical). iGPU tables are only comparable within one session.
- **Set pieces + storms (2B):** LevelDef `radius` keys [atM, scale] -> the
  shell / veil / core disc follow the NEXT ramp ahead (`uRadius` = scale at
  the player, scale after, ramp start/end d): chamber 46 -> 110 u, collapse
  narrowing. Storm: lightning iso-line bolts (ARCS tiers) + a CPU flash
  envelope from a render-side vfx RNG (`STORM_FX`: rate x storm, >= 0.34 s
  apart = flash budget, off under reduce-flashing). Core haze ramps over
  180-900 m (`coreHdr` 3.6): a short ramp tone-mapped into a hard white
  disc. QA: `__G1__.mission.jump(m)` warps the sim to rail position m;
  `qa-mission.mjs --heapEvery n` samples heap + slope.
- **2B close-out (2026-10-01, resumed session):** the first 5-min heap run
  was invalid — the 4 km test corridor completes in ~69 s, so the run spent
  4 min in the hangar. `qa-mission.mjs --loopAt <m>` now warps the sim back
  to 0 past rail m so a soak stays IN the mission. Result (prod, dGPU, HIGH,
  `--seconds 300 --heapEvery 10 --loopAt 3000`): 5 loops, heap 79.6-81.0 MB,
  slope +0.09 MB/min, sawtooth 1.45 MB, programs / geometries / textures
  identical, console clean. A per-14 s fps probe over another 5 min: 60 fps in
  every window (max frame <= 18 ms, 0 long tasks). UNREPRODUCED: two long
  runs showed slow tails (hangar 8 fps after 4 min idle; mission 22 fps in
  the last 54 s, render submit still ~2 ms = not JS). Neither reproduced in
  a 3-min idle-hangar soak, the 5-min fps probe, a level-complete -> hangar
  probe, or a screenshot-mid-run probe; the second coincided with heavy
  tsc / vitest runs on the same machine. Treated as external contention;
  the 2C round-trip soak re-checks it. **CORRECTION (same day):** those two
  runs (and every `G1_DGPU=1 node ...` QA run this session until the fix)
  ran on the INTEGRATED GPU: `node` is a symlink to Windows `node.exe` and
  WSL forwards no env vars unless listed in `WSLENV`. The slow tails were
  the UHD 770 at HIGH with DRS frozen — expected, not contention. The heap
  numbers stand (GPU-independent); the 5-min 60 fps probe stands (it
  hard-coded the dGPU flag). **Always:** `export WSLENV=G1_DGPU
  G1_DGPU=1 && node tools/...` (check: `node -e
  "console.log(process.env.G1_DGPU)"` prints 1).
- **Weapon VFX (2C, checkpoint 1):** `render/mission/vfx/` — `Particles`
  (THE GPU particle system: InstancedBufferGeometry ring of spawn records
  x, y, s, t0 | velocity, life | size, ramp, drag, stretch; the vertex shader
  integrates exponential drag and ages by the presentation clock; sparks
  stretch along view-space velocity; colour ramps in `data/vfx.ts`; ring
  1500 / 3000 / 6000 / 9000 per preset; partial uploads of only the records
  written this frame via preallocated `updateRanges` objects — three's
  `addUpdateRange` allocates), `Bolts` (player tracers = elongated
  camera-facing ribbons, white-hot core + Ignition body, tail grows from the
  muzzle at the bolt's speed RELATIVE to the ship; enemy orbs = round
  Nebula->Danger rim + white core; written from the sim SoA pools each frame,
  interpolated by alpha), `MuzzleFlash` (two star quads on the real cannon
  hardpoints, child of the attitude group), `Ribbons` (wing-tip contrails:
  rail-space history, camera-facing strip in the shader, ~0.22 s, fade near
  the camera), `MissionVfx` (own event reader: PlayerFire -> flash, Hit /
  weak -> sparks + puff, Kill -> burst, Spark -> wall spray, Graze -> Ice
  sparks on the boundary side or roll-dodge flicker, BoostOn -> engine puff).
  `scenes/mission/shipMounts.ts`: per-ship cannon muzzles (outermost
  off-centre cannon pair, mirrored if single) -> `SimConfig.muzzles`
  (additive; sim default unchanged), wing tips, engines. QA: `__G1__.vfx.stats()`,
  `tools/qa-flight.mjs` (12 beats per rig + sustained-fire perf +
  programs-constant). BUGS FOUND: (1) every frame with fire was BLACK —
  `pow(1.0 - along, 1.6)` with along a hair above 1 = NaN on ANGLE/D3D, bloom
  spreads it to the whole frame: never `pow()` a possibly-negative base
  (clamp, or `x * x`), guard `atan(0, 0)`; (2) the ribbon passed the
  third-person camera as a screen-wide white band: short trails + camera
  fade; (3) at HDR 8 / 4.6 AgX turned the tracers WHITE, reading as speed
  streaks — body 2.4 / core 4.2 keeps them Ignition orange; boost ribbons
  stay Ice (orange streaks mean player fire).
- **Flight feel (2C, checkpoint 1):** `render/mission/shipAttitude.ts` springs
  (data `FEEL`: bank max 38 deg, pitch 15 deg, omega 14, zeta 0.68, a lead
  from lateral acceleration so a tap banks before velocity builds, release
  swings through a small counter-bank; eased front-loaded barrel roll from
  the interpolated roll time; bob + roll / pitch life noise, 25 % under
  reduce-motion; shudder while the shield presses the envelope) — unit-tested
  (`tests/attitude.test.ts`: convergence, lead, bounded overshoot < 35 %,
  stability at 0.1 s and 240 Hz frames, full eased roll). Camera:
  `render/rigs/FollowRig.ts` follows 84 % / 80 % of the ship's lateral offset
  (the ship moves across the screen; the tunnel does not swing 1:1), rolls
  0.2 x bank x settings roll coupling (<= 30 % under reduce-motion), leans
  into the tunnel's cosmetic bend (`Tunnel.pathAt`, CPU twin of the shader).
  DEVIATION: brief offsets assume a ~7.5 u fighter; ours are 11-17 u, so
  follow offsets scale by max(1, length / 7.5) (HALCYON 1.87: third person
  (0, 6, 22.4)) — at (0, 3.2, 12) the ship filled 70 % of the frame and cut
  the wing tips; the launch views use the same scale (no framing jump at the
  breach). `RigSwitcher` (render/rigs) owns the rigs + 0.6 s blend and writes
  the director through the new additive `director.quat` (Phase 1
  amendment 6); the mission flies third person until checkpoint 3.
- **QA screen `?screen=simlab&debug=1`** (`debug/SimLab.tsx`, lazy chunk,
  debug builds/flag only): the real Sim + FixedStepper with a scripted pilot
  vs target drones, top + front views, HUD values, event counts;
  `__G1__.simlab.state()`. `&manual=1`: the real InputManager drives it;
  `&bot=novice|mid|expert`: the balance bot flies, drones fire lab-scripted
  orbs (until the Umbra AI in 2E).

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

