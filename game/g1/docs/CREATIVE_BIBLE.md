# SPACE WAR: DARK EDITION — CREATIVE BIBLE

Binding creative direction for /game/g1 (Founder's Vision Addendum to Phase
2R, 2026-10-02). This file turns the vision into **acceptance criteria**:
every line marked `AC` is something a test, a frame strip or a still must
prove before the owning slice is called done. Where this file conflicts with
the Phase 2R brief, THIS FILE WINS. Earlier hard rules still hold
(isolation, git, process hygiene, zero-hitch contract, no shader compile
during play, honest reporting).

The founder's prompt is a FLOOR, not a ceiling (it is "about 30 % of the
vision"). Sections marked **[BEYOND]** are additions made in that spirit;
each one serves a pillar, fits the budgets and is logged in DEV_NOTES.

---

## 0. The five pillars (every feature must serve at least one)

1. **FREEDOM** — the whole screen is mine; the world slides past me, I am
   never in a pipe.
2. **AWE** — every 25-40 s something makes me stop and stare: a planet
   rising, a crack bursting into a lit valley, a mountain that moves.
3. **A LIVING WORLD** — the land, the light and the weather never stand
   still; things react to me (birds scatter, rock falls, villages burn).
4. **SPECTACLE WITH CLARITY** — monsters arrive as events and die as
   spectacles, but every attack is readable and fair.
5. **A STORY THAT EARNS ITS ENDING** — restraint, dread, humanity. I know
   who I fly for and slowly learn what the voices are.

The test for anything new: *does a game-of-the-year team ship this, and does
it still run at 60 fps on the RTX 3050 and >= 40 fps on the iGPU?* If the
experience threatens the budget, find the cheaper TECHNIQUE; never cut the
EXPERIENCE.

---

## 1. The movie (the reference experience)

I fall through cloud; a planet opens under me (plains, a river far below,
ranges both sides, a ringed giant in the sky). I sweep from one screen edge
to the other and the land slides. A far range is a smudge; thirty seconds
later it is a wall. The valley narrows; rock rushes in; trees whip past my
wings and I weave the trunks. A crack opens in the mountain, barely wider
than my ship — I commit — dark, tight, stone streaking — and I burst into a
hidden valley flooded with gold, something the size of a hill moving on the
far ridge. The sun has lowered, the sky gone copper, cloud rolling in. A
cave mouth dilates and spits monsters and glowing bombs; a tear in the air
pours ships; the mountain splits and a colossus climbs out. I know who I fly
for and what the voices in the static are. When the boss comes, the whole
world takes part.

---

## 2. FREEDOM OF FLIGHT [P0]

| # | Acceptance criterion | Proof |
|---|---|---|
| AC2.1 | Third + chase: ship reaches >= 92 % of the horizontal half-width and >= 85 % of the vertical half-height of the screen at the envelope extremes | `qa-freedom` flies to all 8 extremes (4 edges + 4 corners) per camera, projects the ship's centre, asserts; stills saved |
| AC2.2 | The reticle spans the ENTIRE screen in every camera (incl. cockpit) | same tool moves the cursor to the 4 screen corners, asserts the reticle reaches them |
| AC2.3 | CURSOR-FLIGHT is the default control model: pointer-lock relative motion drives a screen-bounded virtual cursor; ship target = cursor NDC x (a, b); snappy critically damped follow; cannons converge on the reticle; WASD/arrows nudge the same target; AIM (legacy) selectable; optional idle auto-centre | settings test + sim test (target tracking, convergence) |
| AC2.4 | Envelope per chapter archetype (a / b in u): plains 70/38, foothills 48/30, forest 34/22, gorge 26/18, slot 12/18, pass 60/45, arena 60/34; blended across transitions | LevelDef validator + sim test |
| AC2.5 | Lateral speed = clamp(1.1 a, 30, 80) x AGI: a full plain crossing <= 1.8 s; slot reaction < 0.8 s | sim test measures both |
| AC2.6 | Camera follow is COMPUTED: lateral clamp(1 - 0.92 W/a, 0.25, 0.9), vertical clamp(1 - 0.85 H/b, 0.25, 0.9), W/H = frustum half-extents at the ship's depth; cockpit: strong lateral view translation + sway | unit test of the formula; AC2.1 proves the result |
| AC2.7 | Bank up to +-70 deg, reached in 0.18 s, nose into the motion | attitude test (time to 90 % of target) |
| AC2.8 | 30 s of flying with zero enemies is already fun | founder review of a capture; `qa-freedom --showreel` |
| AC2.9 | Terrain inside the envelope is real: soft push + sparks in the margin, scrape damage past it; edge-hugging pays (close calls, wall-run) | sim tests (push, scrape, wall-run timer) |

**[BEYOND]** Flight feel extras: (a) *wingtip vapour* trails when banking
hard at speed; (b) *ground-effect* — below 15 u the ship's shadow appears on
the terrain and dust/water rooster-tails kick up behind it; (c) *G-onset* —
hard reversals add a short vignette pulse + creak (reduce-motion off);
(d) *air-brake flare* — brake fans the flaps and dips the nose.

---

## 3. A LANDSCAPE THAT NEVER STANDS STILL [P0]

Every level is a JOURNEY of 5-8 **chapters**, blended along the path
(TerrainField parameters interpolate over 200-500 u: the land morphs, never
seams). Never the same archetype twice in a row.

**Archetypes** (from the brief): OPEN PLAINS | ROLLING FOOTHILLS | RIVER
VALLEY | FOREST VALLEY (slalom) | GORGE | SLOT CRACK | RIDGE CROSSING /
PASS CLIMB | HIDDEN-VALLEY REVEAL | per-world specials | ARENA BASIN.

**[BEYOND] extra archetypes** (each world gets its own mix):
- **TERRACED STEPS** — giant natural/farmed terraces stepping down like a
  staircase of light (ARDEN farms, KHARAN quarries).
- **WATERFALL CANYON** — the valley ends in a cliff of falls; fly up the
  cascade through spray rainbows (ARDEN Marrow Falls).
- **MESA FIELD** — isolated flat-topped towers to weave like pillars (KHARAN).
- **DUNE SEA** — rolling sand waves with things moving under them (KHARAN).
- **FJORD NARROWS + SEA STACKS** — flooded cliffs, stacks to thread (STORMWARD).
- **STORM WALL** — flying INTO a cloud wall: visibility collapses, lightning
  silhouettes the next obstacle (STORMWARD).
- **RUIN FIELD** — collapsed colony/ancient structures as the near-field.
- **SINKHOLE DIVE** — the floor opens; dive into a round pit and out a
  side cave (P1, authored mesh + collider).

| # | Acceptance criterion | Proof |
|---|---|---|
| AC3.1 | Each level: 5-8 chapters, no archetype twice in a row, blends 200-500 u | validator |
| AC3.2 | Valley half-width + wall height + steepness are authored CURVES (e.g. 400 -> 25 u over 600 u): walls physically close in | terrain tests (width at s), frame strip |
| AC3.3 | BARRIER MASSIFS span the valley with 1-3 fissures; the crack is visible from >= 2 km and grows for ~25 s | approach strip (angular size log) |
| AC3.4 | SLOT CRACKS: 10-14 u wide, walls up to 300 u, slope cap 82 deg, lateral columns <= 1 u in the slot (<= 1.5 u within corridor half-width + 40 u), triplanar rock, light shafts, falling pebbles | tiles test (column spacing), stills |
| AC3.5 | The dark-tight -> huge-luminous reveal happens at least once per level | level validator (reveal beat present) |
| AC3.6 | FORKS [P1]: 2-3 cracks at a massif; lateral position picks the crack (left narrow + secret + bonus, right wide + monsters); all reconverge; LevelDef.forks[] | validator (reconvergence), sim test |
| AC3.7 | Trees are obstacles in forest chapters: trunks = solid capsule colliders (instance-derived, spatial grid, near the line only); canopy = brush (leaves, shake, no damage); designed patterns (slalom lines, gate rows, staggered columns, fallen-log gates); forgiving in L1 | sim tests, stills |
| AC3.8 | Ground, flora, light and weather change with chapters (grass -> rock -> moss -> snow line) | stills per chapter |
| AC3.9 | Arches / tunnels / overhangs = authored meshes with matching colliders [P1] | collider test |

---

## 4. APPROACH, SCALE & SPEED [P0]

| # | Acceptance criterion | Proof |
|---|---|---|
| AC4.1 | Three layers always on screen: far massif growing over 30-40 s; mid ridges/outcrops every ~8 s; near-field objects every ~1 s at 20-120 u from my line | per-chapter density check in the placement tool + stills |
| AC4.2 | Dense near-field detail + strongly textured ground; skim moments at 8-15 u | stills |
| AC4.3 | Scale references (colony buildings, vehicles, birds, trees, spray) make a mountain read as a kilometre | stills |
| AC4.4 | Speed cues: streaks, dust / pollen / mist rushing past, FOV widening, light edge radial blur, micro-shake, banking; cruise raised 20-40 % if perceived speed is low (balance bot retuned) | showreel capture |
| AC4.5 | 5-second frame strips approaching a massif from 2000 u to 300 u with its angular size logged; growth convincing | `qa-approach` strip + log |

---

## 5. TIME AND CLIMATE ARE ALIVE [P0]

| # | Acceptance criterion | Proof |
|---|---|---|
| AC5.1 | LevelDef.todTimeline keys (sun az/el, sky / fog / haze colours, grade, exposure) move DURING the mission | stills at 3 points per level |
| AC5.2 | LevelDef.weatherTimeline (clear -> haze -> overcast -> storm; dust gusts; mist banks; rain ramps) + chapter-local climate (cold gorge mist, warm meadow haze) | stills |
| AC5.3 | Zero hitch: everything by uniforms; tiles bake shadows for sunAt(s of tile); ambient = lerped SH (or keyframe probes); reflections = keyframe probes baked time-sliced in prepare and blended in the shared chunk; light rig fixed; no compile | programs/textures constant across a full run |
| AC5.4 | Sky events: eclipse (world dims), aurora curtains, shooting stars, planet-rise over a ridge | stills |

Per level: L1 pre-dawn blue -> sunrise gold -> bright morning. L10 afternoon
-> copper sunset at the boss, twin suns sinking toward the dam. L22 dusk ->
storm night, lightning, bioluminescent sea glow.

**[BEYOND]** *God rays through the crack and canopy* (screen-space radial
from the sun, masked by depth; P1); *rainbow* in waterfall spray when the sun
is behind me; *heat shimmer* over KHARAN dunes at noon; *frost on the canopy
edges* in cold gorge mist (cockpit only).

---

## 6. PLANETS AND SKY ARE HERO ART [P0]

| # | Acceptance criterion | Proof |
|---|---|---|
| AC6.1 | Ringed giants (bands, ring shadow, terminator), moons (phases, craters, rims), second suns, nebula bands + stars on dark skies | stills (W2a delivered the dome; nebula + phases complete it) |
| AC6.2 | ICS Meridian visible in orbit or descending through cloud for scale | still |
| AC6.3 | Ridge occlusion for depth (bodies behind real ridges) | still (W2a: ORRIN behind the left range) |
| AC6.4 | Each world's sky memorable at THUMBNAIL size | 3 thumbnails side by side |
| AC6.5 | Authored composition moments per level: planet-rise over a ridge, a moon framed in the crack, an eclipse over the boss arena | stills at those s |

---

## 7. MONSTERS, SPAWNERS AND HOW THEY DIE [P0]

**ENCOUNTER GRAMMAR** (every monster, every time):
FORESHADOW (tremor, shadow, birds scatter, rock dust, a comm line) ->
ENTRANCE (spectacle) -> LEGIBLE ATTACKS (telegraph >= 0.8 s: glow + sound)
-> CLEAR WEAKNESS (shootable, rewarded) -> DEFEAT (a spectacle that changes
the landscape) -> AFTERMATH (wreck burning, rockfall, wildlife returning).
First contact teaches itself with a SAFE first telegraph.

### 7.1 Bestiary (Umbra) — **[BEYOND]** expanded roster

| Family | Member | Behaviour / entrance | Weakness | Death changes the world |
|---|---|---|---|---|
| Swarm | **Skitterling** | spat by maws, chain-flock in ribbons | anything (1-2 hits) | chain pops ripple through the flock |
| Swarm | **Needler** | dart in from the haze in V-wedges, strafe | glowing abdomen | tumbles, burning streak to the ground |
| Bomb | **Bomb-spore** | arcing lobs from maws / spires, fuse glow | shootable mid-air | shrapnel cloud (hurts enemies too) |
| Flyer | **Manta hunter** | dives OUT OF THE SUN from behind peaks | gill vents open on the pull-up | crashes into a slope, gouge + dust |
| Flyer | **Kite** | hangs in updrafts over ridges, drops spores | membrane tear (wing limbs severable) | drifts down like burning paper |
| Clinger | **Cliff-clinger** | peels off the gorge wall, leaps across the valley | belly plates break -> core | falls, smashing ledges (rockfall) |
| Burrower | **Burrow mound / Sandwyrm** | mounds on plains erupt; the WYRM bores out of a mountainside | mouth core when it roars (telegraph) | body crashes across the valley, thrashes, becomes terrain |
| Structure | **HIVE MAW** | organic cave mouth, dilates in cycles, spits skitterlings + bomb-spores; core exposed only while open | core (2-3x) | the cliff section collapses (rockfall), final burst, bonus |
| Structure | **Membrane plug** | seals a crack; must be burned open | the whole membrane (burn-through bar) | tears open with wind roaring through |
| Structure | **Spore spire** | ridgeline towers venting spore clouds | root bulbs | topples down the slope |
| Rift | **RIFT [P1]** | unstable wormhole tear in the air, spawns ships/monsters in waves, anchor core | anchor core | collapses in a shockwave (wormholes are ENEMIES now) |
| Lost | **Husk [BEYOND]** | Halcyon fighters taken by the Umbra — our ships, wrong colours, flying OUR formations, calling in Halcyon voices | exposed cockpit growth | the voice cuts mid-word |
| Colossus | **THE MOUNTAIN THAT MOVES [P1]** | a cliff face splits; a colossus climbs out, throws rock | weak points glowing through cracks | collapses into a new ridge |
| Pursuer | **PURSUIT [P1]** | something enormous chases me through the gorge, visible in my mirrors | its eyes (shoot back while boosting / rolling) | wedges in the narrows; the walls fall on it |
| Sea | **Eels / Kraken / Manta (L22)** | rise from the fjord; lightning silhouettes | tentacle tips severable, eye cores | sinks, glow fading in the water |

**ENTRANCE PATTERNS [BEYOND]** (a level never repeats one back to back):
from the haze ahead | out of the sun | from behind (mirror first) | out of a
cliff / cave | dropping out of cloud | rift wave | ground burst | from the
water | convoy ambush (they target the transports) | fake-out (a flock of
birds turns out to be skitterlings) | lightning reveal | across the screen
(a wyrm crossing the valley in front of me).

| # | Acceptance criterion | Proof |
|---|---|---|
| AC7.1 | Every monster follows the grammar; telegraph >= 0.8 s (glow + sound) | encounter validator + sim tests |
| AC7.2 | Weak points do 2-3x with a distinct spark + sound; armour plates break; severed limbs remove attacks | sim tests (part damage) |
| AC7.3 | Swarms die in chains; finishers get brief slow-mo + camera angle; kills reshape the world | capture |
| AC7.4 | HIVE MAWS, bomb-spores, rifts [P1], cliff-clingers, wyrm, mountain-emergence [P1], pursuit [P1] built | stills + sim tests |
| AC7.5 | Every level introduces ONE new monster behaviour; no two encounters alike | level validator (behaviour list) |

---

## 8. BOSSES ARE EVENTS [P0]

FORESHADOW (tremors, birds flee, comms go quiet) -> ARRIVAL (the landscape
participates) -> PHASES with a mid-fight TWIST that changes the rules ->
CLIMAX -> DEATH AS A LANDSCAPE EVENT -> RELEASE (comms, music, light).

**L10 THE WARDEN.** The Great Cut's far wall is not rock: the dreadnought is
docked inside the mesa. The cliff cracks and sheds, dam statues topple, the
sky darkens under its shadow, twin suns rim-light the hull. It is the ICS
WARDEN, the Meridian's lost sister ship and Sato's old command; the Umbra
voices call Sato by name. The arena is used (dam-wall cover, falling statues,
canal spray). Phases: (1) broadside batteries along the hull (break plates);
(2) TWIST — it undocks fully, rises and the arena envelope opens upward
(60/34 -> pass-like 60/45): fight under its belly, the shadow is the
telegraph; (3) the bridge — the old ICS markings, Sato's voice cracking.
Death: it crashes into the dam, the flood roars down the canal, I race the
wave, then climb to orbit through spray and cloud (the dive in reverse).

**L22 BULWARK STACK (STORMWARD).** A tide-fortress of fused hulls on the
fjord split, lit by lightning; phases rise out of the sea as the tide turns;
mid-fight the storm cell arrives and lightning becomes a hazard the boss
uses (the strike telegraphs by charging the sea).

**L1 mini-boss [BEYOND]: THE MARROW WYRM.** It bores out of the waterfall
cliff, crosses the valley ahead of the convoy, and must be broken at its
mouth core before it reaches the transports. Its body falls across the river
and becomes a bridge I fly UNDER on the way out.

| # | Acceptance criterion | Proof |
|---|---|---|
| AC8.1 | Each boss: foreshadow, landscape arrival, >= 2 phases with a rule-changing twist, death as a landscape event, release | capture + boss script validator |
| AC8.2 | Boss arena envelope 60/34 (L10 phase 2 opens to 60/45) | sim test |
| AC8.3 | Bigger than the screen, readable, fair (every lethal attack telegraphs >= 0.8 s) | fairness tests |

---

## 9. SHOOTING AND FLIGHT CRAFT

| # | Acceptance criterion | Proof |
|---|---|---|
| AC9.1 [P0] | One-frame input-to-motion latency; critically damped follow; bank/pitch coupling; recoil; muzzle bloom; hit markers; per-surface impact FX; every shot has sound + light | latency test, capture |
| AC9.2 [P0] | Feedback hierarchy: small hit -> medium -> kill -> boss (escalating flash, sound, shake, hit-stop) | capture |
| AC9.3 [P1] | CHARGE LOCK-ON: hold fire to charge, paint up to 6 targets, release a homing volley with tracers | sim test |
| AC9.4 [P1] | NOVA BOMB: 2 per mission from pickups; screen-clearing, slow-mo | sim test |
| AC9.5 [P2] | BARREL-ROLL DEFLECT of slow bolts | sim test |
| AC9.6 [P0] | CLOSE CALLS: near-miss within 3 u of rock / trunk / bolt -> score + shield tick + whoosh; water-skim + wall-run bonuses | sim tests |

---

## 10. THE STORY [P0]

**Spine.** The Umbra is not invading; it is RETURNING. The Veil was opened
by the Meridian's own experiment eleven years ago; it swallowed ships and
crews. The voices in the static are the lost — Halcyon 1-6 and the crew of
the ICS Warden — absorbed and used, not dead. Sato knows more than he says.
The deeper I go, the clearer the voices.

**[BEYOND] the lost have names** (used sparingly, on wreck beacons,
memorial stones and in the static): Halcyon-1 *Ilse Varga* (lead), Halcyon-3
*Tomas Reyes* (begs to be silenced at the L22 beacon), Halcyon-6 *Wren
Adeyemi* (the first whisper: "...seven... you came back..."; Seven's wingmate
in the academy). The Warden's captain was Sato himself before the
experiment; he took command of the Meridian the day the Veil opened.

**Telling it:** Sato's comms, STATIC whispers (text distortion + audio
granular), environmental storytelling (a crashed Halcyon fighter with its
beacon still pulsing, convoy debris, burning villages, memorial stones,
abandoned toys), short cinematics. Every level: a cinematic descent in, a
designed exit (landing or ascent), 8-12 comm lines timed to chapters, one
memorable character moment.

- **L1 FIRST LIGHT** — survival and the first whisper (Halcyon-6). A
  Halcyon wreck with a pulsing beacon in the forest. LANDING FINALE: I
  descend into the basin as the convoy touches down; eleven thousand lights
  come on; Sato's quiet line. Character moment **[BEYOND]**: KESTREL's
  captain asks Seven to fly low over transport 3 "so the kids can see you".
- **L10 THE WARDEN** — the reveal; Sato breaks, then gives the order. Ascent
  through flood spray and cloud.
- **L22 STORMFRONT** — the beacon broadcasts the chorus; Halcyon-3 begs to
  be silenced; destroying it is mercy; Sato admits part of the Veil truth.
- Hooks: the Veil's origin; the Hollow Crown as the source; an endgame
  choice (silence the chorus forever, or bring them home).

| # | Acceptance criterion | Proof |
|---|---|---|
| AC10.1 | Each level: descent in, designed exit, 8-12 comm lines on chapters, one character moment, environmental-story props | level validator + stills |
| AC10.2 | The static escalates in clarity L1 -> L10 -> L22 (text legibility + audio) | review |

---

## 11. LEVELS ESCALATE, RANK AND REPLAY [P1]

- Each level adds ONE new wonder and ONE new mechanic / monster behaviour.
  Difficulty rises through composition (narrower corridors, denser
  obstacles, overlapping threats), tension waves and valleys of calm.
  Threat tiers LOW / MODERATE / HIGH / SEVERE / EXTREME.
- WONDER BEATS every 25-40 s (validator): cloud-break reveal; crack
  burst-through; the mountain moves; planet-rise; waterfall tunnel; dam
  burst; eclipse; aurora over a canyon; lightning silhouetting a leviathan;
  skimming through a flock; the Meridian descending overhead; convoy lights
  at dusk.
- Results: S/A/B/C stamps with medals (accuracy, no-damage, close calls,
  skim time, secrets, transports saved), new-best flags, pilot ranks
  (Ensign -> Lieutenant -> Captain) [P2]. Secrets (hidden cracks, bonus
  nests, memorial sites) and forks give replay value.

---

## 12. The three built levels, chapter by chapter

Time = at cruise. Speeds are re-measured in the freedom slice (AC4.4).

### L1 FIRST LIGHT — ARDEN (pre-dawn blue -> sunrise gold -> bright morning)
| # | Chapter | Archetype | Envelope | Light / weather | Beats |
|---|---|---|---|---|---|
| 0 | Cloud break | dive | — | pre-dawn blue, ORRIN half-lit | WONDER: the planet opens; Sato: "Atmosphere in five." |
| 1 | Marrow plains | plains + river skim | 70/38 | blue hour, ground mist | first flight freedom, birds over the river; skitterling ribbons from the haze |
| 2 | Foothills + falls | foothills | 48/30 | first gold on the peaks | WONDER: Marrow Falls; THE MARROW WYRM bores out of the falls cliff (mini-boss) |
| 3 | Thornwood | forest slalom | 34/22 | sunrise through trunks (shafts) | Halcyon wreck, beacon pulsing; first whisper (Halcyon-6) |
| 4 | Narrowing | gorge 260 -> 55 u | 26/18 | cold gorge mist | cliff-clingers; HIVE MAW + bomb-spores |
| 5 | Greyhorn barrier | barrier massif, FORK (left slot secret / right crack + maw) | 12/18 slot | dark, a shaft of light | WONDER: the crack grows for 25 s; the dive into the dark |
| 6 | Hidden valley | reveal | 60/45 | golden light, ORRIN rising | WONDER: burst-through; something huge on the far ridge (foreshadow of later worlds); convoy lights |
| 7 | Landing basin | arena basin | 60/34 | bright morning | final escort wave; LANDING FINALE; eleven thousand lights |

### L10 THE WARDEN — KHARAN (afternoon -> copper sunset, twin suns)
Dune sea (wyrm-under-sand foreshadow) -> canal run (aqueduct special, spray)
-> mesa field (pillar weave) -> colonnade (stone gate rows = slalom) ->
the Great Cut gorge (dust gusts) -> slot through the dam abutment (fork) ->
ARENA: the Warden in the mesa -> flood escape -> ascent to orbit.
New behaviour: HUSKS (lost Halcyon fighters). New wonder: twin-sun sunset +
dam burst.

### L22 STORMFRONT — STORMWARD (dusk -> storm night)
Coast cliffs at dusk -> fjord narrows + sea stacks -> STORM WALL (visibility
collapse, lightning reveals) -> drowned village (environmental story) ->
fork at the fjord split (left: sea-cave secret) -> BULWARK STACK boss ->
headland beacon (mercy) -> climb above the storm into stars.
New behaviour: things from the water (eels / kraken). New wonder: lightning
silhouetting a leviathan; bioluminescent sea.

---

## 13. Founder playtest (all must pass; evidence in DEV_NOTES)

1. First 10 s after the dive: both screen edges reached in every camera;
   the landscape visibly slides. (`qa-freedom`)
2. Within 45 s: >= 3 distinct landscape types; a mountain ahead visibly grew.
   (`qa-approach` strip)
3. Each level: forest slalom / narrow-obstacle chapter, narrowing gorge, slot
   crack with a luminous reveal; L1 + L22 at least one fork. (validator)
4. A monster comes out of a mountain and I know how to beat it without a
   tutorial. (capture)
5. Time of day visibly changes in every level; weather rolls in during L22.
   (stills)
6. The boss entrance gives goosebumps; the story reveal lands. (capture)
7. The three worlds are unmistakable from stills alone. (thumbnails)
8. Three consecutive full runs of each level: zero hitches, zero console
   errors, programs / geometries / textures constant. (soak)

---

## 14. Performance stance

All Phase 2R budgets stay (>= 60 fps RTX HIGH, >= 40 fps iGPU LOW with DRS,
calls <= 170, tris <= 550k, terrain <= 180k, no compile in play, constant
resources). Worst cases are re-measured per archetype (forest slalom, slot
crack with shafts, storm + rain + sea, boss arena) on BOTH GPUs. Cheaper
techniques we reach for first: impostors + instancing for trees, analytic
sky events, SH ambient, keyframe probes, baked per-tile shadows, screen-space
god rays at quarter resolution, colliders only near the flight line.
