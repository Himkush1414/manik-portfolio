# PLANET 1 BIBLE — ARDEN: FIRST LIGHT / THE MARROW ROUTE

Acceptance criteria for the PLANET 1 COMPLETION PROMPT (verbatim: `docs/PLANET1_PROMPT.md`, received
2026-10-03). This document WINS over `docs/CREATIVE_BIBLE.md`, the Phase 2R brief and the Control /
Camera / Boundary addendum wherever they conflict (prompt §0). Every `P1-x` line is something a test,
a frame strip, a still or a log must prove before its slice is called done. Decisions the prompt left
open are logged here as **DECISION** (no questions asked: decided and logged, prompt §0).

Priorities: [P0] ship flawless · [P1] should · [P2] stretch. Cut order if short (prompt §0): P2 ->
shootable-environment chains -> escape sequence -> difficulty selector. NEVER cut: §1 fixes, §2
realism pass, chapters 1-8, the boss.

---

## 0. What changes vs. the earlier documents

| Earlier rule | Now |
|---|---|
| Walls within +-140-160 u in every chapter (addendum, C1 piece 1) | Per-chapter bounds (§5 below): open chapters up to 500 u free half-width when the edge is REAL terrain that visibly frames the space |
| Ridge turbulence, climb-authority fade, forced descent, cloud-deck whiteout, HUD "TURBULENCE" (F1) | DELETED. Service ceiling >= 400 u = the edge of the atmosphere (visual + smooth climb decay over the last 80 u, no warning, no clamp) |
| Passive shield regeneration (Phase 1/2) | NOTHING regenerates. Scarce pickups placed at risk |
| Circular reticle | TACTICAL reticle (degrees, offset readout, heading tape, pitch ladder) |
| Level 1 = convoy escort, "easy first level", ~10 km | ARDEN = ONE big level, ~14 min / ~55 km, 8 chapters, the forest is the filter |
| Forest canopy is brush | The canopy is a SOLID roof (closed chapter) |
| L10 / L22, KHARAN / STORMWARD next | PARKED (implemented:false, "SIGNAL LOST" cards once Sortie Select exists). Planet 2 = KHARAN only after the Planet 1 Founder Playtest |

**DECISION (kept from earlier work):** keyboard steers / mouse aims (default), both camera attachments,
real terrain contact (slide / scrape / impact), the time-of-day sunrise, the sky events, keyframe probes,
the boundary validator (now per-chapter bounds), the chapter model (C1) — all reused.
**DECISION:** KESTREL-9 and the convoy are retired from Level 1 (name kept for a later level).

---

## 1. FIX PACK [P0] — slice A

### 1.1 Vertical freedom
| # | Acceptance criterion | Proof |
|---|---|---|
| P1-1.1a | No turbulence, climb fade, forced descent, whiteout or "TURBULENCE" text anywhere (code, tests, strings) | grep test in the unit suite (forbidden strings) |
| P1-1.1b | OPEN chapters: service ceiling = max(400 u above the local path baseline, tallest ridge within 600 u + 150 u); climb rate decays smoothly to 0 over the last 80 u — no shake, no label, no clamp event | sim tests (reach >= 400 u, decay curve, clampEvents 0) |
| P1-1.1c | Above ~300 u the sky darkens, stars + bodies grow, the horizon dips/curves, the engine note rises (edge of the atmosphere) | stills at 0 / 300 / 400 u |
| P1-1.1d | Cloud layers can be flown through AND above (a sunlit cloud sea is a reward view) | stills |
| P1-1.1e | CLOSED chapters (narrows, forest, cave, nest): geometry (roof / ceiling fields) is the limit | slices E-G |
| P1-1.1f | Altitude > 180 u above baseline for > 4 s summons AIR HUNTERS | sim test (trigger) — the hunters themselves ship with the first creature slice (C) |
| P1-1.1g | HUD: altitude + ground-clearance readouts | HUD QA |
| P1-1.1h | Fly straight up in every rig x attachment: >= 400 u, 0 clampEvents, 0 warnings, no camera clip; hold 60 s at 350 u stable; descend to a skim stable; bot soaks include high-altitude runs | qa-freedom (rewritten vertical phase), bot soak |

### 1.2 Barrel roll
| # | Acceptance criterion | Proof |
|---|---|---|
| P1-1.2a | The CAUSE of the "load + snap" is found with a performance trace (not a guess) and logged | trace + DEV_NOTES |
| P1-1.2b | theta 0 -> +-2 pi about the ship's LOCAL forward axis over 0.55 s (8 % wind-up, 77 % spin, 15 % settle), composed by QUATERNION with bank / pitch / yaw, unwrapped; timer independent of key state; no retrigger by key repeat; at 2 pi == 0: NO snap; bank blends from the actual orientation | unit tests: monotonic 0 -> 2 pi +-2 % in 0.55 +-0.03 s, no discontinuity > 3 deg / frame at the end |
| P1-1.2c | Camera: ATTACHED = wobble <= 25 deg x sin(theta); STEADY = no roll; COCKPIT = the world rolls with the view, eased, x roll strength, capped by reduce-motion; setting "Barrel-roll screen effect: SHIP ONLY / FULL" [P2] | rig tests |
| P1-1.2d | Zero frames > 20 ms across 50 consecutive rolls (production bot run); programs / geometries / textures unchanged; stable mid-turn / near walls; cooldown 1.1 s + i-frames unchanged; vapour ribbons, whoosh, small FOV kick, NO flash | qa-roll tool |

### 1.3 Tactical reticle
| # | Acceptance criterion | Proof |
|---|---|---|
| P1-1.3a | Styles TACTICAL (default) / MINIMAL / CLASSIC; size, brightness, degrees on/off (settings, persisted) | settings test + QA |
| P1-1.3b | Core: crosshair with centre gap + dot; inner ring with degree ticks every 5 deg (major 15) SCALED TO THE CAMERA FOV; lead pipper with time-to-impact; convergence marker (range m) | projection unit test (tick spacing = angle) + stills |
| P1-1.3c | Offset readout AZ / EL off boresight; boresight line + degree label when > 4 deg | stills |
| P1-1.3d | Target lock brackets (type, range, closure, hull %, weak-point arrows); charge-volley ring | with the combat slices |
| P1-1.3e | Flight data: heading tape 0-359 (N/E/S/W), pitch ladder (+-5/10/20/30) + bank arc, speed m/s, altitude + clearance; diegetic in the cockpit, overlay otherwise | stills per rig |
| P1-1.3f | Phase 1 HUD language, dark outlines legible over bright sky; transform-only at display rate, text <= 20 Hz, <= 60 nodes or ONE canvas overlay | qa-hud (nodes / perf), legibility stills 1280x720 / 1920x1080 / 3440x1440 |

### 1.4 ScarField (terrain scrape deformation)
| # | Acceptance criterion | Proof |
|---|---|---|
| P1-1.4a | 48-scar ring buffer (capsules from wing scrapes every ~6 u, craters from impacts), visual only (collision = pure TerrainField), uploaded as a small uniform array / data texture | unit tests (ring, capsule extension) |
| P1-1.4b | Terrain vertex shader carves a groove (<= 2.2 u, craters <= 6 u) with raised lips, normal perturbation, wet-dirt albedo + scorch, near LODs, fades over 45 s | stills (third / chase / cockpit) |
| P1-1.4c | Ejecta by surface (mud clods + grass tufts, rock chips + sparks, dust, steam over water); ballistic debris pool <= 128, ground-snapped; dust cloud; plough wake; head-on crater + big burst + rolling rocks + shake / hit-stop; grind + thump per surface | stills + audio log |
| P1-1.4d | Cost <= 0.3 ms; programs unchanged; zero hitches | perf |

### 1.5 Survival: nothing regenerates
| # | Acceptance criterion | Proof |
|---|---|---|
| P1-1.5a | No hull or shield regeneration ever; regen-delay stat removed; SHIELD MATRIX = capacity +12 % / tier + pickup efficiency +5 % / tier; save migration + tests | unit tests |
| P1-1.5b | Pickups: REPAIR KIT +20 % hull, SHIELD CELL +30 % shield; ~1 per 60-75 s of flight, placed AT RISK; kill drops <= 4 % outside nests | sim tests + level validator |
| P1-1.5c | Checkpoint retry restores hull / shield to max(value at checkpoint, 60 %), shown on the retry card | sim test + still |
| P1-1.5d | Visible damage [P1]: < 60 % smoke, < 35 % sparks / fire / canopy cracks / HUD glitch, < 15 % sputter (-8 % speed) + limp; damage mask on the model | stills |
| P1-1.5e | Cannons recoil, tracers, muzzle bloom, per-surface impacts; charge volley on hold-fire | capture |

### 1.6 DisturbanceField
| # | Acceptance criterion | Proof |
|---|---|---|
| P1-1.6a | <= 24 disturbers {pos, vel, radius, strength} feed grass / foliage / water / cloud shaders (shared uniforms) | unit test (ring + decay) |
| P1-1.6b | Downwash bends grass / bushes in a ~35 u wake, water ripples / wake rings, dust + leaf swirls, branches sway, birds / herds scatter, explosions blast foliage + scorch; plasma burns small trees [P1] | stills / strips |
| P1-1.6c | Shootable environment [P1] in designed set pieces | per chapter |
| P1-1.6d | <= 0.3 ms | perf |

---

## 2. REALISM PASS [P0] — slice B (then every chapter)
P1-2a Grass: three tiers (instanced blades / clumps <= 60-90 u with wind + disturbance + translucency;
tufts / cards to ~220 u; far albedo + normal + macro variation), preset-capped, LOW = cards.
P1-2b River: analytic depth (absorption turquoise -> teal), two-scale flow normals + turbulence, rapids
foam from slope, shoreline + rock foam, gravel bars / mud banks, reeds, caustics, submerged rocks, fresnel +
glint, 10-50 u meanders, visibly FLOWS; far river = bright ribbon.
P1-2c Mountain bases: fans, scree / talus, boulder fields, belts (grass -> shrub -> conifer -> rock ->
snow), forest lines, moss / wet streaks, streams + falls on faces, baked AO, triplanar cracks + streaks,
silhouette variety.
P1-2d Atmosphere: light shafts, morning ground fog, cloud shadows, motes, bloom, AP, gradient, grain, no
banding, one sun direction. No turbulence cues.
P1-2e Workflow per chapter: clay -> colour -> dress -> atmosphere, before / after stills in DEV_NOTES.
**Founder test:** a 1080p crop of river + meadow + mountain foot reads as a believable place.

## 3. SCALE [P0]
Ship 14 u; mountain relief 600-1500 u; open plains 600-1000 u wide; valleys 300-800 u; narrows 40-90 u
half-width; giant trees 14-40 u trunks, 280-500 u tall, limbs 6-14 u spanning 60-140 u, crown roof
300-420 u; waterfall 450-600 u tall, curtain 120-180 u; cave tube 40-110 u; rift gates ~60 u; nest
~900 x 600 u; boss head ~60 u; colossal wyrm 400-900 u. ~14 min / ~55 km. Streaming look-ahead
>= 12 s at the highest speed (lateTiles 0 at 150 u/s).

## 4. STORY [P0] — slices H (+ comms per chapter as chapters land)
Level FIRST LIGHT, subtitle THE MARROW ROUTE. MISSION 01 text verbatim (prompt §4). Holo-briefing in the
cockpit (rotating ARDEN hologram -> 3D route map of the 8 chapters lighting in sequence with Sato's
typed narration; skippable; disposed; <= 1 small extra render). 12-16 comms + STATIC whispers on the
chapter beats listed in the prompt. Environmental storytelling: Halcyon wrecks 1-6 with beacons, burnt
vehicles, memorials, toys, drag lines. The recorder recovered in the Nest ("EVIDENCE RECOVERED").

## 5. THE EIGHT CHAPTERS [P0] — bounds replace the old 140-160 u rule
| Ch | Name | Time @ speed | Free half-width | Difficulty | Wonder / new behaviour |
|---|---|---|---|---|---|
| 1 | THE APPROACH | 1:30 @ 75 u/s (~6.8 km) | 450 -> 300 u, OPEN (service ceiling) | 1.5 | cloud-break, river skim, ORRIN rising; REAVERs, skitterlings; tremor foreshadow ~1:10 |
| 2 | THE VALLEYS | 2:00 @ 80 (~9.6 km) | 300 -> 160 u, OPEN | 2.5 | first MOUNTAIN WYRM burst ~0:35 (+2); COLOSSAL SIGHTING #1 ~1:20 |
| 3 | THE NARROWS | 1:45 @ 85 (~8.9 km) | 90 -> 45 -> 28 u, CLOSED-ish | 3.5 | slot crack -> hidden valley; burst-hole tunnels; SIGHTING #2 (rolling coil bridge); hive maws, spore-bats, leech tendrils |
| 4 | THE GREAT FOREST | 3:00 @ 80 (~14.4 km) | ~260 u x <= 300 u under a SOLID roof | 5.0 FILTER | outer wood / Silklands / Hollow / Light wells; silkers, hornets, stalkers, serpents, thornboughs, pod mines |
| 5 | THE FALL | 0:45 @ 85 | waterfall, dive -35 deg | 2.5 | through the curtain into the plunge-pool cave |
| 6 | THE UNDERDEEP | 1:45, 85 -> 150 u/s | tube 40-110 u | 4.0 | speed ramp; echo worms, acid drippers, the LURKER |
| 7 | THE RIFT | ~12 s | open vortex (no pipe) | — | the only wormhole: fragments, 3 membrane gates, voices peak |
| 8 | THE NEST | ~3:00 | chamber 900 x 600 u | boss | THE MARROW QUEEN (3 phases), recorder recovered, ascent |
P1-5a Path rules: strong curves (S-bends, switchbacks, hairpins, helices), visual pitch up to +-35 deg,
min radius >= 1.25 x ribbon half-width (tighten by shrinking the TERRAIN ribbon there), validator updated.
P1-5b Every chapter: distinct landscape, one wonder, one new threat behaviour, a checkpoint, a difficulty
target; wonder every 25-40 s. Progress bar shows chapters + checkpoints; brief cinematic title cards.
**DECISION:** the per-chapter bounds validator (C1 `validateBounds`) gets per-chapter `maxEscape` (open
chapters up to 500 u, framed by real terrain; closed chapters by geometry incl. roofs).

## 6. NEW TECH (cheapest technique that holds the budgets) — logged per slice
Floor + ceiling fields (cave tube, forest crown roof) with collision; giant-tree system (hero trunks,
limbs with capsule-chain colliders incl. animated limbs, web strands as segment colliders, hollow trunks,
impostors); burst-hole prefabs + ScarField; colossal chain creatures (<= 64 bones, LODs, untargetable
sightings); waterfall system; speed-ramp system; rift transit (instanced shards + lensing post variant by
uniform); banked wing-tip hurtboxes (already in the sim from F1) + a wingtip-clearance cue.

## 7. BESTIARY — every monster: FORESHADOW -> ENTRANCE -> LEGIBLE ATTACK (>= 0.8 s) -> WEAKNESS ->
SPECTACULAR DEFEAT -> AFTERMATH; one new behaviour per chapter; no two encounters alike
Hostiles: REAVERS, SKITTERLINGS, MOUNTAIN WYRM, CLIFF CLINGERS, HIVE MAWS + BOMB-SPORES, SPORE-BATS,
WALL-LEECH TENDRILS, SILKERS, HORNET SWARMS + NESTS, CANOPY STALKERS, BRANCH SERPENTS, THORNBOUGH limbs,
SEED-POD MINES, ECHO WORMS, ACID DRIPPERS, the LURKER, AIR HUNTERS, the COLOSSAL MARROW QUEEN (sightings
x3, untargetable). Fauna (reactive): herds, sky-kites, fish, tree-gliders, fruit-bats, glowmoths, grazers,
glow-worms, crystal beetles. Attack taxonomy (all telegraphed, all with a safe line): lunge cone, acid
arc, body / limb sweep, web strand + glob, sonic ring, rock throw, bomb-spore burst, seed-pod drop,
stinger swarm, leap intercept, ambush burst, collapse / rockfall.

## 8. THE MARROW QUEEN — ch 8
Arena ~900 x 600 u (hive pillars, egg clusters, ACID LAKE floor, vein walls, skylights, the vault).
Entrance -> P1 BROOD (3 brood sacs ~600 HP, acid volleys 1.0 s tell, coil sweeps with a telegraphed gap,
egg bursts every 30 s) -> P2 BURROW (floor shockwave rings, erupt-charges 1.2 s, tail slams; 4 spine
plates ~450 HP; pillar drops ~800 [P1]) -> P3 RAGE (mouth core 3x only while screaming, sonic rings
1.4 s; pillars shatter; echo wyrms; flees < 20 %) -> DEATH (~8 s, recorder "EVIDENCE RECOVERED", rift
exit, ascent). HP tuned so a mid bot at the recommended rating needs ~160-220 s.

## 9. DIFFICULTY [P0] — balance-bot targets (first attempt)
CH4 filter: novice < 8 %, mid 25-35 %, expert 55-70 %. Mid bot: CH1 >= 95 %, CH2 >= 85 %, CH3 >= 65 %,
CH5 >= 90 %, CH6 >= 60 %, boss at the recommended rating 40-55 %. Retry < 2.5 s. Authored, learnable
layouts; every hazard has a safe line; no unavoidable damage; readability gate. DifficultyKnobs table per
planet (speed, density, token cap, gap multiplier, HP multiplier, filter chapter) built now.

## 10. PERFORMANCE
Budgets unchanged (Phase 2R). Production build, headed, BOTH GPUs, per slice. New worst cases: forest,
waterfall, cave, nest, rift, ScarField / DisturbanceField (<= 0.3 ms each), strong curvature at
150 u/s (lateTiles 0). No compile in play; constant light rig; zero allocation; constant resources.

## 11. BUILD ORDER
A fix pack -> B realism (CH1 terrain) -> C strong-curve paths + CH1 + CH2 + burst holes + mountain wyrm +
sighting #1 + scale -> D CH3 -> E CH4 forest (calibrated to the filter) -> F CH5 + CH6 -> G CH7 + CH8 +
Queen -> H story + polish + balance + perf + soak + QA + docs -> Founder Playtest -> Planet 2 plan.
Each slice: several small verified pushes (owner's cadence rule), DEV_NOTES after each.

## 12. FOUNDER PLAYTEST — the 13 checks of prompt §12, plus `npm run qa:planet1` and all earlier QA.
Stills scored 1-5 on depth layering, atmosphere, material believability, scale, readability,
spectacle; anything < 4 is fixed.
