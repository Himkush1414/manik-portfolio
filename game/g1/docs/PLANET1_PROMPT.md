# PLANET 1 COMPLETION PROMPT (verbatim, received 2026-10-03)

The owner's binding brief for finishing ARDEN, stored verbatim so any session can resume from the repo.
Acceptance criteria derived from it: `docs/PLANET1_BIBLE.md`. Progress: DEV_NOTES.md `P1.*`.

```
==============================================================================
SPACE WAR: DARK EDITION
PLANET 1 COMPLETION PROMPT - ARDEN: THE FULL JOURNEY + FEEL FIXES
(binding; extends Phase 2R, the Founder's Vision Addendum and the Control/Camera/Boundary Addendum)
==============================================================================

0. HOW TO USE THIS
- Read DEV_NOTES.md and docs/CREATIVE_BIBLE.md first, then re-plan the remaining slices around this prompt and write docs/PLANET1_BIBLE.md (chapters, bestiary, story, targets as acceptance criteria). No questions: decide and log. All earlier rules stay: isolation, git workflow (verified slices, explicit paths, push), process hygiene, honest reporting, the zero-hitch performance contract, no shader compiles during play, constant light rig.
- ANSWER TO YOUR PENDING QUESTION (chapter bounds): YES, plains may open wide. Free half-width up to 500u in open chapters, provided the edge is REAL terrain you can fly into that visibly frames the space (cliff line, rock fins, foothills, forest wall). Never an invisible wall. The old "walls within 140-160u" rule is replaced by the per-chapter bounds in section 5. Variety comes from BOTH width and wall character.
- SCOPE ORDER: finish PLANET 1 (ARDEN) completely first, as ONE big level (for now one planet = one level). Planet 2 (KHARAN, per the World Bible) starts only after Planet 1 passes the Founder Playtest (section 12). Park, do not delete: Level 10 / Level 22, STORMWARD and the 50-level pipeline; flag them implemented:false and show "SIGNAL LOST" cards in Sortie Select.
- THIS WINS over earlier text on: ridge turbulence, forced descent and the TURBULENCE HUD; shield/hull regeneration; Level 1 content (the KESTREL-9 convoy weave, "easy first level" rules); the circular reticle; the "forest canopy is brush" rule; level length and chapter list. Keep the name KESTREL-9 for a later level.
- PRIORITY: [P0] must ship flawless | [P1] should | [P2] stretch. Cut order if short: P2 -> shootable-environment chains -> escape sequence -> optional difficulty selector. Never cut: section 1 fixes, section 2 realism pass, chapters 1-8, the boss.
- EFFORT: peak. Use your deepest reasoning before each slice and review your own output like a hostile creative director. When performance bites, find a cleverer TECHNIQUE; never cut the EXPERIENCE. Add what a game-of-the-year team would add where it serves these pillars, fits the budgets and is logged.

==============================================================================
1. FIXES FIRST [P0] (slice A; each has acceptance tests; push before moving on)
==============================================================================
1.1 VERTICAL FREEDOM ("the area is short, turbulence stops me")
- DELETE (code, tests, strings): ridge turbulence, climb-authority fade, forced descent, cloud-deck whiteout-descent, the "TURBULENCE" HUD warning. Nothing may warn about or block climbing.
- OPEN CHAPTERS: free from ground contact up to a SERVICE CEILING >= 400u above the local path baseline (and >= tallest ridge within 600u + 150u, whichever is higher). The ceiling is the EDGE OF THE ATMOSPHERE, not a wall: above ~300u the sky darkens, stars and planets grow, the horizon curves, the engine note rises, and climb rate decays smoothly to 0 over the last 80u (no shake, no label, no clamp event). Cloud layers can be flown through AND above (a sunlit cloud sea with sky bodies is a reward view).
- CLOSED CHAPTERS (narrows, forest, cave, nest): geometry is the limit (roofs, ceilings).
- Gameplay uses the whole volume: spawn/hazard offsets are fractions of the measured free width AND free height. Altitude has consequences, not walls: climbing >180u above baseline for >4s summons AIR HUNTERS (winged monsters diving out of the sun).
- HUD: small altitude + ground-clearance readouts. Camera handles any altitude without clipping or jitter.
- TESTS: from baseline fly straight up in every rig and attachment mode: reach >=400u with zero clampEvents, zero warnings, no camera clip; hold 60s at 350u stable; descend to a skim stable; bot soaks include high-altitude runs.

1.2 BARREL ROLL (Q/E): the flip is broken: the screen "loads" and the ship snaps straight instead of a clear 360.
- Implement the roll as an explicit angle theta 0 -> +-2pi about the ship's LOCAL forward axis over 0.55s (8% wind-up, 77% spin, 15% settle), composed by QUATERNION multiplication with bank/pitch/yaw (never Euler lerp), accumulated unwrapped during the roll. The roll timer is independent of key state (release does not cancel it; key repeat cannot retrigger). At completion 2pi equals 0, so there is NO snap; bank then blends from the actual orientation.
- CAMERA: FULLY ATTACHED = a smooth wobble (<=25 deg * sin(theta)), never a 360 whirl, never a snap. STEADY = no camera roll. COCKPIT = the world rolls with the view (a flip is a flip), eased, scaled by roll strength and capped by reduceMotion. Setting "Barrel-roll screen effect: SHIP ONLY (default) | FULL" [P2].
- FIND THE CAUSE WITH A PERFORMANCE TRACE, not a guess. Suspects: first-use shader compile (roll trail VFX, i-frame flicker or transparency material swap, post-FX variant), camera blend reset, a state machine returning bank to 0 mid-roll, double-trigger on key repeat, a GC spike. Fix by prewarming programs and driving effects with uniforms only.
- TESTS: roll angle monotonic 0 -> 2pi (+-2%) in 0.55s (+-0.03) in all rigs; zero frames >20ms across 50 consecutive rolls in a production bot run; programs/geometries/textures counts unchanged; no orientation discontinuity >3 deg/frame at the end; stable when rolling mid-turn or near walls. Cooldown 1.1s and i-frames unchanged. Feel: wingtip vapour ribbons, whoosh, subtle FOV kick, NO screen flash.

1.3 TACTICAL RETICLE (replaces the circle)
- Styles in Settings: TACTICAL (default) | MINIMAL | CLASSIC; size, brightness, degrees on/off.
- CORE: thin crosshair with centre gap and dot; inner ring with DEGREE ticks every 5 deg (major every 15) scaled to the camera FOV so it truly measures angle; lead pipper with time-to-impact; a slim convergence marker showing where the twin cannons converge (range in m).
- OFFSET: small mono readout beside the reticle, AZ +12.4 / EL -3.1 (degrees off ship boresight), plus a thin boresight line from the ship pipper to the reticle with a degree label when the offset >4 deg.
- TARGET LOCK: corner brackets scaled to target size with type, range (m), closure (m/s), hull %, weak-point arrows; charge-volley lock ring.
- FLIGHT DATA (diegetic in the cockpit, overlay otherwise): heading tape 0-359 with N/E/S/W top-centre; pitch ladder (+-5/10/20/30 deg) with a bank-angle arc; speed (m/s); altitude + ground clearance.
- Phase 1 HUD language (angular, thin lines, Ignition/Ice), with dark outline/back-plates so it is legible over bright sky. Transform-only updates at display rate, text <=20Hz, <=60 nodes or one canvas overlay. Hit/kill markers stay. The reticle still spans the whole screen with the mouse-aims default.

1.4 TERRAIN SCRAPE DEFORMATION ("the wing should drag the mud out of the mountain")
- SCARFIELD (visual only; collision stays the pure TerrainField so the sim never changes): ring buffer of 48 scars (capsule {a,b,radius,depth,age,surface} or crater sphere), fed by the contact model (a wingtip scrape extends a capsule every ~6u of travel; impacts add craters), uploaded as a small data texture/uniform array. The terrain vertex shader carves a groove (wing scrape up to 2.2u deep, crater up to 6u) with raised lips, normal perturbation, darker wet-dirt albedo and scorch; near LODs only; fades over 45s.
- EJECTA by surface: mud clods + torn grass tufts, rock chips + sparks, dust plumes, steam over water. Ballistic debris pool <=128 instances (TerrainField ground-snap), a lingering dust cloud, and a visible "plough" wake behind the wing. Head-on crash: crater + big debris burst + rocks rolling downslope + shake/hit-stop; sound: grinding + thump layers per surface.
- Reuse for: wyrm burst holes, explosions (scorch), crash landings of killed creatures.
- ACCEPTANCE: a wing scraping a grass bank carves a visible furrow with flying mud for >=2s in third-person, chase and cockpit; craters visible on head-on hits; cost <=0.3ms; programs unchanged; zero hitches.

1.5 SURVIVAL: NOTHING REGENERATES
- NO regeneration of hull OR shield, ever. Remove passive shield regen and the regen-delay stat (stats.ts, upgrades.ts, the Phase 1 Upgrades text: SHIELD MATRIX becomes capacity +12%/tier and pickup efficiency +5%/tier; save migration + tests). Recovery only from scarce pickups: REPAIR KIT (+20% hull), SHIELD CELL (+30% shield). About one recovery pickup per 60-75s of flight, placed AT RISK (next to hazards, inside webs, over water), never as free gifts. Kill drops are rare (<=4%) outside designated nests.
- Checkpoint retry restores hull/shield to max(value at checkpoint, 60%); show it in the retry card.
- Damage persists visibly [P1]: hull <60% light smoke; <35% sparks, trailing fire, canopy cracks, HUD glitch; <15% engine sputter (speed -8%) and a visible limp. Panel loss, scorch and dents on the model via a damage mask; third-person/chase show it, the cockpit gets cracks, sparks, HUD static. Penalties are small, telegraphed and cosmetic-leaning.
- Shooting feel: twin cannons visibly recoil, tracers, muzzle bloom, per-surface impact FX; charge-volley on hold-fire (if not already done).

1.6 THE WORLD REACTS TO ME ("it is good but not interactive")
- DISTURBANCEFIELD: up to 24 disturbers (ship, bolts, explosions, big creatures) {pos, vel, radius, strength} feed the grass, foliage, water and cloud shaders. My downwash bends grass, bushes and leaves in a wake behind the ship (~35u), water gets ripples/wake rings, terrain kicks up dust and leaf swirls, branches sway as I pass, birds and herds scatter, explosions blast foliage and leave scorch (via scars). Small trees can be burnt by plasma (fire, charred state) [P1].
- SHOOTABLE ENVIRONMENT [P1]: brittle rock pillars, hanging boulders, collapsing arches/bridges, web strands, nests, fuel pods; rockslides that clear or block a lane; each used in designed set pieces and logged.

==============================================================================
2. REALISM PASS [P0] (grass, river, mountain bases, atmosphere)
==============================================================================
Founder test: a 1080p crop of river + meadow + mountain foot must read as a believable place, not flat CG.
GRASS: ground is LUSH GRASS, never flat green. Three tiers: near-field instanced blades/clumps within 60-90u (wind + disturbance + backlit translucency + per-instance colour), mid-field tufts/cards to ~220u, far-field terrain shader with grass albedo + normal + macro colour variation (greens, dry yellow patches, clover, wildflowers, dirt trails, animal paths, rocks), wind shimmer. Preset-capped; LOW swaps to cards.
RIVER: analytic water depth from the same height textures (no depth buffer needed): colour absorption (turquoise shallows -> deep teal), two-scale flowing normals + turbulence around rocks, foam on rapids (from river slope), shoreline foam and foam behind rocks, wet pebbles/gravel bars and mud banks, reeds and overhanging grass, caustics on shallow beds, submerged rocks visible through depth fade, sky fresnel + sun glint, widths 10-50u with real meanders. It must visibly FLOW. Distant river = a bright reflective ribbon with shimmer.
MOUNTAIN BASES: alluvial fans and scree aprons (talus gradient), boulder fields, transition belts (grass -> shrub -> conifers -> bare rock -> snow), forest lines creeping up slopes with believable density falloff, moss and wet streaks, streams and waterfalls running down faces, baked AO/shadow at cliff bases, triplanar rock with large cracks + vertical iron/water streaks + plants in cracks, silhouette variety (spires, saddles, glacial bowls).
ATMOSPHERE: volumetric-looking light shafts (sprites + fog-density modulation) in gorge and forest, valley-floor ground fog in the morning, cloud shadows crossing terrain, birds and motes in sunbeams, sun bloom, aerial perspective, quality sky gradient, subtle grain, no banding, consistent sun direction. No turbulence cues anywhere.
WORKFLOW per chapter (mandatory): clay -> colour -> dress -> atmosphere, before/after stills in DEV_NOTES.

==============================================================================
3. THE SCALE RULE: EVERYTHING BIGGER [P0]
==============================================================================
The ship is 14u. Mountains 600-1500u of relief; open plains 600-1000u wide; valleys 300-800u; narrows 40-90u half-width; giant trees 14-40u trunk diameter, 280-500u tall, branch limbs 6-14u thick spanning 60-140u, crown roof at 300-420u; waterfall 450-600u tall with a 120-180u curtain; cave tube 40-110u across; rift gates ~60u; nest chamber ~900u across x 600u high; boss head ~60u; colossal wyrm 400-900u long. Planet 1 runs ~14 minutes (about 55km): chapters in section 5 give times. Terrain/vegetation streaming must hold at the highest speeds (look-ahead >= 12s).

==============================================================================
4. PLANET 1: ARDEN - STORY & THE LAUNCH-PAD HOLOGRAM [P0]
==============================================================================
Keep the name ARDEN (log if you improve it). Level name FIRST LIGHT, subtitle THE MARROW ROUTE. Retire the convoy premise.
STORY SPINE: Eleven years ago Halcyon-6 went down in the Marrow Valley on Arden, the first world the Veil opened onto. Her flight recorder never stopped transmitting. Last night it began to speak. It holds the only record of what came out of the first gate, and of what the Meridian sent in. The Umbra built a nest around it deep inside the mountain. The only road is the valley, the forest, the fall, and the cave beneath it. The giant thing seen in pieces along the way (mountains splitting, a body crossing the sky) is THE MARROW QUEEN; you finally meet all of her in the Nest.
MISSION 01 text (use verbatim; polish rhythm only):
  CLASSIFIED // HALCYON WING // PILOT EYES ONLY
  Halcyon-7,
  Arden. Eleven thousand colonists, and the first world the Veil ever opened onto. Eleven years ago Halcyon-6 went down in the Marrow Valley. Her flight recorder never stopped transmitting.
  Last night it started talking.
  Command wants that recorder. It holds the only record of what came out of the first gate - and what we sent in. The Umbra have built a nest around it, deep inside the mountain. The road in is the valley, the forest, the fall, and the cave beneath it. Nobody has flown it and come back.
  You will. Fly low. Break anything that moves. If the static speaks, do not answer.
  Bring her home, Seven.
  - Commander I. Sato, ICS Meridian
  OBJECTIVES: Fly the Marrow Route | Recover the Halcyon-6 recorder | Stay alive: nothing repairs itself   THREAT: SEVERE   REWARD: 2,500 CR
HOLO-BRIEFING (cockpit, before LET'S GO; replaces the flat panel): a dash projector beam casts a rotating HOLOGRAM of ARDEN (procedural planet, Ice hologram shader, scanlines, flicker, orbit rings, the Meridian marker, a pin on Marrow Valley) with callouts: PLANET: ARDEN | CLASS: temperate colony world | POPULATION: 11,204 | STATUS: UMBRA INFESTATION - NEST CLUSTER "MARROW" | MISSION: RECOVER HALCYON-6 FLIGHT RECORDER (EVIDENCE). It then zooms to a 3D ROUTE MAP of the 8 chapters (icons, names, threat pips) that light in sequence as Sato narrates; his text types beside it (subtitled, UI beeps). Skippable; disposed afterwards; one small extra render at most.
COMMS: 12-16 lines in Sato's voice + STATIC whispers (Halcyon-6: "...seven... under the mountain..."), timed to chapters: launch clear; seismic spike before the first burst ("that is not an animal, that is the mountain moving"); first colossal sighting ("size... I can't read it. Do not engage."); Halcyon-3's wing hanging in a tree with its beacon still on; webs ("it has been feeding for years"); "the recorder is below the falls"; the static clearing in the cave; the rift ("that is a Veil rift. Ours. Eleven years old."); after the Queen: Sato plays the recorder and the truth lands ("We opened it. We sent them in."), then the order to leave.
ENVIRONMENTAL STORYTELLING: crashed Halcyon fighters (1-6) with pulsing beacons, burnt colony vehicles, memorial markers, abandoned toys, drag lines where something huge passed.

==============================================================================
5. PLANET 1: THE JOURNEY - EIGHT CHAPTERS [P0]
==============================================================================
PATH RULES: STRONG CURVES, not straight lines. Turns left and right, long S-bends, switchbacks, hairpins, helical descents, steep dives and climbs (visual pitch up to +-35 deg), banking cameras. Min curvature radius >= 1.25 x ribbon half-width; to tighten a bend, shrink the TERRAIN ribbon half-width there (not the gameplay width), and far backdrop mountains carry the rest. Update the PathDef validator (pitch limit +-35, min radius, clearance).
FREE SPACE per chapter is bounded by real terrain only. Each chapter has: a distinct landscape, one new wonder, one new threat behaviour, a checkpoint, and a difficulty target. Wonder cadence: one every 25-40s.

CH1 THE APPROACH - 1:30 @75u/s (~6.8km) - difficulty 1.5/5 - checkpoint at start
 Path: two long S-bends (turn 50-70 deg, radius 900-1400u), rolling pitch +-12 deg. Free half-width 450 -> 300u. Lush grass plains, meandering river 20-45u wide, flower meadows, tree copses, ruined farms; the mountain range grows from a smudge to a wall; foothills (scree, boulders, tree line) from ~1:00. Wonder: cloud-break reveal, river skim, ORRIN rising. Threat: REAVER x2 -> x3, a skitterling flock; MOVE/AIM prompts. At ~1:10 TREMORS: birds scatter, dust plume on a distant peak (foreshadow).
CH2 THE VALLEYS - 2:00 @80u/s (~9.6km) - 2.5/5 - checkpoint at start
 Path: valley switchbacks (turn 70-110 deg, radius 450-700u), pitch -10 to +18 deg. Free half-width 300 -> 160u. Small trees appear on slopes, then the valley floor; meadows and waterfalls on the walls. Wonder: the FIRST MOUNTAIN WYRM bursts out of a cliff (~0:35), two more by 1:35; COLOSSAL SIGHTING #1 at ~1:20: a mountainside erupts and an immense body arches over the valley 250u up, debris shadows telegraph the rockfall. Threat: REAVER squads, CLIFF CLINGERS, skitterlings.
CH3 THE NARROWS - 1:45 @85u/s (~8.9km) - 3.5/5 - checkpoints at start and after the crack
 Path: tight terrain. Free half-width 90 -> 45 -> 28u; hairpins radius 130-200u at 55 deg bank; dives -30 deg, climbs +32 deg. Wing-scrape deformation is most visible here. Wonder: the SLOT CRACK then the HIDDEN VALLEY (golden light, a small lake, ORRIN), burst-hole tunnels through walls, COLOSSAL SIGHTING #2: a coil of the immense body slides across the canyon ahead like a rolling bridge and you thread the gap by timing. Threat: HIVE MAWS with bomb-spores, spore-bat swarms, wall-leech tendrils, wyrm ambush through the wall, falling rock.
CH4 THE GREAT FOREST - 3:00 @80u/s (~14.4km) - 5/5, THE FILTER - checkpoints at entry and after the Silklands
 Free-flight 3D volume ~260u wide x up to ~300u tall under a SOLID canopy roof (interlocking crowns; no flying over it; a few light wells); forest floor (roots, ferns, rivers) is real ground. Left, right, high, low, through hollows and between limbs: any route. 4a OUTER WOOD (0:00-0:50): trunk slalom, sweeping THORNBOUGH limbs, first webs. 4b THE SILKLANDS (0:50-1:50, hardest): web fields (shootable strands), SILKERS abseiling, hornet nests. 4c THE HOLLOW (1:50-2:40): flyable hollow-trunk tunnels, CANOPY STALKERS leaping between trunks, BRANCH SERPENTS striking from limbs, seed-pod mines. 4d LIGHT WELLS (2:40-3:00): god-ray shafts, a vista over the canopy sea, one repair kit, the calm before the fall.
 Layout is AUTHORED and learnable (no random layout), difficulty from composition: staggered gaps narrower than the wingspan (knife-edge banking slips through), moving limbs, overlapping threats, dim light with readable rim-lit trunks. Wildlife below and around: giant grazers on the forest floor, tree-gliders, fruit-bats, glowmoth clouds, birds; they scatter and react.
CH5 THE FALL - 0:45 @85u/s - 2.5/5 - checkpoint at the cliff top
 The forest breaks at a monumental cliff; the river drops 450-600u. Path dives (-35 deg) along the falls and THROUGH the water curtain into the plunge-pool cave mouth. Wet-lens droplets, spray whiteout (inside the flash budget), muffled audio, rock/log debris, leaping river-eels.
CH6 THE UNDERDEEP - 1:45, speed ramps 85 -> 150u/s - 4/5 - checkpoints at start and mid
 A winding cave tube (40-110u across) with corkscrews, climbs, stalactite/stalagmite colliders, bioluminescent crystals, an underground rapid, bat flocks, ECHO WORMS bursting from walls, ACID DRIPPERS, a LURKER (anglerfish lure) in the underground river, cave-ins, speed-gate rings. The speed increase is a designed ramp (FOV widening, streaks, audio rise); obstacle spacing keeps >=0.5s reaction time at peak speed. Ends at the rift: a torn glowing fissure.
CH7 THE RIFT - ~12s transit. The ONLY wormhole in the game, a transition set piece, NOT an environment and NOT a pipe: no cylindrical wall. A violent tear: the cave rock unspools into ribbons of light, a storm of fragments (rock shards, trees, ghost-silhouettes of Halcyon fighters and ICS ships) flows past in an open vortex with lensing warp and chromatic streaks, three membrane "gates" to thread, the voices in the static peak. Light steering stays active. Prewarmed, hitch-free.
CH8 THE NEST - ~3:00 boss (section 8). Checkpoint at the chamber start; supplies at the entrance (3 recovery pickups).
PROGRESS BAR shows chapters and checkpoints; each chapter title card is brief and cinematic.

==============================================================================
6. NEW TECH THIS REQUIRES (cheapest technique that holds the budgets; log choices)
==============================================================================
- FLOOR + CEILING FIELDS: TerrainField gains ceiling(s,u) so tiles can have a roof. Cave = floor/ceiling pair meeting at +-w(s) (tube cross-section), forest roof = crownField. Ceiling mesh from the same tile pipeline; collision for both; sim queries stay pure and cacheable.
- GIANT TREE SYSTEM: a few hero trunk species (LOD0 <=15k tris, LOD1, impostors beyond), limb meshes with capsule-chain colliders, ANIMATED limb colliders (sweeping), web strands as segment colliders, hollow trunks as tube profiles, wind + disturbance, placement lists from the worker, spatial grid for near-line collision only. Background forest = impostors and merged meshes.
- BURST-HOLE PREFABS (steep-wall mouth mesh aligned to the terrain normal + broken-rim debris + dark interior) + ScarField carve + particles for every wyrm exit.
- CHAIN CREATURES at colossal scale: skinned mesh <=64 bones, LODs, chain sim; scripted sightings use the same rig with camera-director framing; non-killable (shots ricochet with sparks and an UNTARGETABLE tag).
- WATERFALL SYSTEM: animated curtain with transparency, mist, wet-lens droplets, cave mouth visible through the water.
- SPEED-RAMP SYSTEM: speed multiplier events with FOV, streaks and audio coupling, authored per chapter.
- RIFT TRANSIT: instanced shards/ribbons, lensing warp via a precompiled post variant toggled by uniform.
- Wing-tip hurtboxes follow the ship's banked orientation, so banking narrows the silhouette; a wingtip-clearance cue appears near walls.
- PathDef/ribbon changes for strong curvature; ScarField; DisturbanceField; Reticle (section 1).

==============================================================================
7. ARDEN BESTIARY & ATTACKS (every monster: FORESHADOW -> ENTRANCE -> LEGIBLE ATTACK (telegraph >=0.8s) -> CLEAR WEAKNESS -> SPECTACULAR DEFEAT -> AFTERMATH; each chapter introduces one new behaviour; no two encounters alike)
==============================================================================
HOSTILES
- REAVERS (ships) and SKITTERLINGS (leaf-bat swarms): existing; used as rhythm fillers.
- MOUNTAIN WYRM (killable, 80-120u visible): bursts out of a cliff in a rock shower. Attacks: lunging bite along a telegraphed cone, acid-glob spit (arcing), body sweep across the lane. Weak: the maw interior + two glowing sacs behind the head. Dies thrashing, crashing into the valley (dust shockwave, rockfall from its hole), body lying as a temporary obstacle for ~6s.
- CLIFF CLINGERS: crab-like wall climbers hurling rocks; shot off they fall and splash.
- HIVE MAWS + BOMB-SPORES: dilating cliff mouths spit skitterlings and arcing shootable bomb-spores (fuse glow, shrapnel burst). The core is exposed only while open; destroying it collapses that cliff section, pays a bonus. Some plug a crack with a membrane to burn open.
- SPORE-BATS (fast, erratic, small, cracks only). WALL-LEECH TENDRILS (extend across the lane with a telegraph, retract when shot).
- SILKERS (giant spiders abseiling on silk): spit web globs (slow + damage), string web strands across gaps; legs break off; killable.
- HORNET SWARMS + NESTS: swarm tracks the ship; pop the nest to disperse.
- CANOPY STALKERS (big climbing cats): leap trunk to trunk to intercept (roar tell).
- BRANCH SERPENTS (draped on limbs, strike on a lunge). THORNBOUGH limbs (infected limbs that sweep, glowing knots retract them when shot). SEED-POD MINES (drop from the crown and burst into spore clouds).
- ECHO WORMS (small wyrms through cave walls with a sonic ping), ACID DRIPPERS (ceiling pustules), the LURKER (river-cave ambusher with a light lure), AIR HUNTERS (winged diving predators, altitude-triggered).
- COLOSSAL MARROW QUEEN SIGHTINGS x3 (see section 5/8): untargetable spectacle with hazards only from debris/shockwaves (telegraphed).
AMBIENT FAUNA (non-hostile, reactive): meadow herds, sky-kites, river fish and jumpers, tree-gliders, fruit-bats, glowmoth clouds, forest-floor grazers, cave glow-worms and crystal beetles.
ATTACK TAXONOMY (all telegraphed, all learnable, every one has a safe line): lunge cone, acid arc, body/limb sweep, web strand and glob, sonic ring, rock throw, bomb-spore burst, seed-pod drop, stinger swarm tracking, leap intercept, ambush burst, collapse/rockfall.
DEFEAT: armour plates break to expose flesh, limbs/tips sever attacks, weak points take 2-3x with a distinct spark and sound, swarms die in chains, finishers get a brief slow-mo angle; kills reshape the world (rockfall, burning trails, bodies crossing the valley).

==============================================================================
8. THE MARROW QUEEN (Chapter 8 boss; the same colossal creature, finally fightable; wounded by the Meridian's rift anchor)
==============================================================================
ARENA: THE NEST, ~900u across x 600u high: hive pillars (cover), hanging egg clusters (shootable; hatch drones if ignored), an ACID LAKE floor (damage + slow), glowing vein walls, skylights, the vault in the far wall holding the recorder (pulsing beacon). Real walls, full freedom inside.
ENTRANCE: the rift spits me in; silence; the walls pulse; Sato goes quiet; the lake ripples; the Queen rises head-first (60u across); roar shockwave ring, shake; boss bar fills.
PHASE 1 BROOD: coiled around pillars; acid volleys (3 globs, 1.0s tell), body-coil sweeps (the body is a moving wall with a telegraphed gap), egg bursts (drones x6 every 30s). Weak: 3 BROOD SACS on the neck (each ~600 HP, glowing); mouth shielded by membrane.
PHASE 2 BURROW: she dives and attacks from below: floor shockwave rings (clear them by altitude or roll i-frames), erupt-charges (floor bulges 1.2s, then she bursts out scattering debris), tail slams from the walls. Weak: 4 SPINE PLATES (~450 HP) exposed when she erupts; shooting pillars down onto her does environment damage (~800) [P1].
PHASE 3 RAGE: the mouth membrane tears; the MOUTH CORE (3x damage) is exposed only while she screams (sonic ring series, 1.4s telegraph; dodge by altitude or roll); she shatters pillars and spawns echo wyrms from the walls; below 20% core she tries to flee into the rift.
DEATH (~8s): thrashing, the chamber convulses, the anchor flares, chain explosions along her body, the acid lake ignites, slow-mo; the vault opens and the recorder drifts to the ship ("EVIDENCE RECOVERED"); Sato's reaction; the rift reopens as the exit and the ship ascends to orbit.
DIFFICULTY GATE and bossScaling stay (computeCombatRating, recommended rating tuned by the sim). Choose HP so a mid-skill bot at the recommended rating needs ~160-220s. Camera director frames entrance and death.

==============================================================================
9. DIFFICULTY, SURVIVAL, FAIRNESS [P0]
==============================================================================
- FOREST FILTER: ~70% of players fail Chapter 4 on a first attempt. Targets for the balance bot over many seeds: first-attempt clear of CH4: novice <8%, mid 25-35%, expert 55-70%. Other chapters (mid bot, first attempt): CH1 >=95%, CH2 >=85%, CH3 >=65%, CH5 >=90%, CH6 >=60%, boss at the recommended rating 40-55%. Full-planet first-attempt clear stays low by design; checkpoints make retries quick (<2.5s) and fair.
- FAIRNESS RULES: layouts are authored and learnable; every attack telegraphs; every hazard has at least one safe line; no unavoidable damage; readability is a release gate (enemy contrast per chapter palette, HDR bolt cores + dark halo); difficulty comes from composition (tight gaps, overlap, moving obstacles), not hidden HP walls.
- DIFFICULTY LADDER for future planets (data-driven DifficultyKnobs per planet): speed multiplier, obstacle density, attack-token cap, gap-width multiplier (tighter), enemy HP multiplier, new mechanics per planet (one new filter chapter each), and a falling first-attempt pass rate for each planet's filter (Planet 2 harder than Planet 1 by every knob). Build the table now; tune Planet 2 later.
- OPTIONAL DIFFICULTY SELECTOR [P2]: STORY / NORMAL / VETERAN; NORMAL = the targets above.
- No health regeneration, ever (section 1.5).

==============================================================================
10. PERFORMANCE (budgets unchanged; this prompt adds worst cases)
==============================================================================
Measure on the PRODUCTION build, headed on BOTH GPUs, per slice, with the perf table in DEV_NOTES. New worst cases to profile and optimise first: the Great Forest (instanced giant trunks, limbs, web strands, fog, shafts), the waterfall (transparency overdraw, mist), the cave (floor + ceiling meshes, crystals), the nest (colossal chain creature, particles), the rift transit (warp variant), ScarField/DisturbanceField cost (<=0.3ms each), terrain with strong curvature (lateTiles must be 0 at 150u/s). If a chapter misses budget, find a cheaper technique (impostors for background forest, merged trunk meshes, baked AO, fewer large transparents), not a smaller ambition. All Phase 2R rules hold: no compile during play (prewarm every program including rift/wet-lens/scar/disturbance variants), constant light rig, zero allocation in hot loops, programs/geometries/textures counts constant across full runs, heap flat.

==============================================================================
11. BUILD ORDER (slices; QA + perf gate + push after each; DEV_NOTES update after each)
==============================================================================
 A  Fix pack: section 1 (vertical freedom, barrel roll, reticle, ScarField, survival, DisturbanceField).
 B  Realism pass (section 2) on Chapter 1 terrain; before/after stills.
 C  Strong-curve paths + CH1 + CH2 + burst holes + mountain wyrm + colossal sighting #1 + scale.
 D  CH3 Narrows (hairpins, slot crack, hidden valley, hive maws, sighting #2).
 E  CH4 Great Forest (giant tree system, roof, webs, limbs, fauna) and calibrate it to the filter target.
 F  CH5 Waterfall + CH6 Underdeep (cave fields, speed ramp).
 G  CH7 Rift + CH8 Nest + the Marrow Queen.
 H  Story and polish: holo-briefing, comms, environmental storytelling, cinematics, results, balance bot to section 9 targets, perf pass, soak tests, full QA, docs.
 Then and only then: Founder Playtest, report, and the Planet 2 (KHARAN) plan.

==============================================================================
12. FOUNDER PLAYTEST + QA (all must pass; evidence = stills, frame strips, logs in DEV_NOTES)
==============================================================================
 1. I can climb and dive freely (>=400u of vertical room), with no turbulence warning anywhere.
 2. The Q/E flip is a clean full 360 with no hitch or snap in every camera.
 3. The reticle is a professional tactical reticle with degrees, heading tape and pitch ladder.
 4. Scraping a mountain or bank visibly carves a furrow and throws mud/rock; crashes leave craters.
 5. Grass, river, mountain bases and atmosphere pass the Founder test crop.
 6. The world reacts to the ship (grass, water, leaves, birds, herds).
 7. The path visibly curves, climbs and dives; chapters appear in order: plains, valleys, narrows, forest, waterfall, cave, rift, nest.
 8. Wyrms burst out of mountains; the colossal creature is seen in pieces three times; killable ones die spectacularly.
 9. The forest is the filter (bot targets met) and still looks awe-inspiring.
 10. The cave speeds up; the rift transit is spectacular and short; the Nest boss is an event.
 11. Nothing regenerates; pickups are scarce and placed at risk.
 12. The hologram briefing at the launch pad tells the planet and the evidence story.
 13. Three consecutive full runs: zero hitches, zero console errors/warnings, programs/geometries/textures constant, clampEvents 0, lateTiles 0, budgets met on both GPUs.
 npm run qa:planet1 (bot per chapter with frame captures every 5s, beauty shots, ScarField and roll sequences, HUD legibility at 1280x720 / 1920x1080 / 3440x1440) plus all earlier QA must pass. Score each still 1-5 on depth layering, atmosphere, material believability, scale, readability, spectacle; fix anything <4.

==============================================================================
13. FINAL MANDATE
==============================================================================
Go all out. Do not hold back and do not ship "normal". Make Planet 1 a journey people retell: a planet that opens under me, mountains that grow, valleys that bend, mountains that split open, a forest that eats most players, a fall into the dark, a cave that accelerates, a tear in space, and a Queen that earns her entrance. Report honestly what reached the bar and what did not.
```
