// /lab/lv8 — hero background: a curtain of vertical strips tiled edge to
// edge, each independently randomised (width, resting tone, depth) so the
// field reads as folded fabric rather than a flat, uniform grid. As the
// cursor approaches, nearby strips physically ROTATE (around their own
// vertical axis) toward the cursor, and rotating is what reveals a darker
// face underneath — not a flat colour swap synced to a fake rotation.
//
// Per-strip variation, all seeded at layout() time:
//  - width: random in [STRIP_WIDTH_MIN, STRIP_WIDTH_MAX], strips still
//    tile with zero gaps (only occasional slight overlap, never a gap).
//  - resting tone: each strip independently samples a point along the
//    5-stop warm-palette gradient (see GRADIENT_STOPS) via THREE's
//    InstancedMesh.instanceColor, so neighbours sit at visibly different
//    points on the palette instead of all glowing the same red.
//  - depth: a small random Z offset plus a few px of X overlap with the
//    previous strip gives genuine layered depth (some strips sit slightly
//    in front of/behind their neighbour, like folded panels) rather than
//    everything flush on one plane. This used to also modulate each
//    strip's brightness by that same Z offset to sell the fold, but that
//    read as a fake specular sheen across the field — removed so every
//    strip shows its sampled palette colour completely flat/matte, no
//    per-strip lighting cue at all; the geometric overlap alone still
//    carries the depth read.
//
// The hover reveal itself is still a genuine geometry trick, not a colour
// tween: each strip's box has its front/back faces baked WHITE and its
// two side faces baked to a fixed DARK/LIT ratio (see REVEAL_RATIO). Both
// get multiplied by that instance's own sampled resting colour, so the
// front face reads as exactly that strip's resting tone, and rotating to
// reveal the side face always lands strictly darker than that same tone
// — proximity darkens every strip relative to its own resting shade,
// never brightens, regardless of where on the gradient it started.
//
// Three.js, loaded eagerly — this IS the hero background, visible before
// any interaction, so deferring it would just show an empty section until
// it loaded. Still isolated to lab/lv8's own bundle only; nothing here is
// imported by (or affects) any other route. See main.ts for how this
// pauses (setHeroActive(false)) the instant the game overlay takes over,
// the same way the old cursor-trail used to.
import * as THREE from 'three';

const canvas = document.getElementById('lv8-strip-field') as HTMLCanvasElement | null;
const container = document.getElementById('lv8-hero') as HTMLElement | null;

// called from main.ts — pauses the rAF loop entirely while the game
// overlay is up (a hidden [display:none] section wouldn't otherwise stop
// a JS-driven rAF loop the way it stops a CSS animation).
let active = true;
export function setHeroActive(v: boolean) {
  active = v;
}

// called from main.ts on "Move Next" — flips every strip on its own
// vertical axis out to 90deg (edge-on to the camera, effectively
// invisible width-wise), staggered left-to-right so it reads as a wave
// sweeping across rather than everything flipping at once. Reuses the
// exact same InstancedMesh/geometry as the hover-bend effect above — no
// separate transition layer. The renderer is transparent (see below) so
// page 2, sitting behind this canvas in the DOM, shows through the gaps
// each strip leaves as it turns away. Not reversible yet (see main.ts).
let triggerFlip: ((onDone: () => void) => void) | null = null;
export function triggerFlipReveal(onDone: () => void) {
  triggerFlip?.(onDone);
}

if (canvas && container) {
  // Warm palette, darkest to brightest — each strip samples a random
  // point along this at rest instead of every strip using the same stop.
  const GRADIENT_STOPS = ['#15100D', '#3A1912', '#4B1D15', '#6F2417', '#A83421'].map(
    h => new THREE.Color(h)
  );
  const DARK = GRADIENT_STOPS[0];
  const LIT = GRADIENT_STOPS[GRADIENT_STOPS.length - 1];
  // Every channel increases monotonically from DARK to LIT across the
  // palette, so this ratio is <=1 on every channel for any resting colour
  // sampled from the gradient — multiplying by it can only darken. The
  // extra DARKEN_BOOST pushes the revealed face further still (strips at
  // the brightest end no longer just bottom out at DARK, they go past
  // it, toward near-black) — pushed hard a third time now (0.55 -> 0.18
  // -> 0.09), each prior round still reading as too subtle.
  const DARKEN_BOOST = 0.09;
  const REVEAL_RATIO = new THREE.Color(
    (DARK.r / LIT.r) * DARKEN_BOOST,
    (DARK.g / LIT.g) * DARKEN_BOOST,
    (DARK.b / LIT.b) * DARKEN_BOOST
  );

  function sampleGradient(t: number) {
    const segments = GRADIENT_STOPS.length - 1;
    const scaled = THREE.MathUtils.clamp(t, 0, 1) * segments;
    const idx = Math.min(Math.floor(scaled), segments - 1);
    return GRADIENT_STOPS[idx].clone().lerp(GRADIENT_STOPS[idx + 1], scaled - idx);
  }

  const STRIP_WIDTH_MIN = 40; // CSS px — per-strip width is randomised across this range
  const STRIP_WIDTH_MAX = 50;
  const OVERLAP_MAX = 6; // px a strip may occasionally tuck under its neighbour
  const STRIP_DEPTH = 7;
  const DEPTH_JITTER = 14; // px of random Z offset per strip — the "folded panel" cue
  const MAX_INSTANCES = 900; // comfortably covers even a 4500px-wide screen
  // Pushed close to the practical ceiling (90deg would edge-on the box
  // into an invisible sliver) so a fully-proximate strip reads as almost
  // entirely its dark side face, not a blended sliver of it.
  const MAX_ROTATION = THREE.MathUtils.degToRad(88);
  // Widened again (130 -> 180 -> 540 -> now 1080) — rotation is already
  // near its practical ceiling (see MAX_ROTATION above) so this round's
  // "stronger" mostly has to come from DARKEN_BOOST and reach; at 1080px
  // most of a typical desktop hero is within range whenever the cursor
  // is anywhere over it, which is the point — a broad, obviously dramatic
  // reaction rather than a localised one.
  const PROXIMITY_RADIUS = 1080; // px — how far a strip's reach extends from the cursor
  // Tuned back up from an earlier pass that over-corrected into sluggish/
  // laggy territory — this is a middle ground between that and the
  // original too-sharp snap (tracks the cursor closely, still has a
  // touch of smoothing so it doesn't teleport). Likely still needs a
  // live micro-adjustment once seen on the real page.
  const EASE_RATE = 3.2; // bend/darken response — ~310ms to settle
  const MOUSE_EASE_RATE = 8; // cursor-position smoothing — light, ~125ms

  function buildStripGeometry(height: number, depth: number) {
    // Unit width — actual per-instance width comes from dummy.scale.x in
    // layout(), since InstancedMesh shares one geometry across instances.
    const geo = new THREE.BoxGeometry(1, height, depth);
    // BoxGeometry's 24 vertices are laid out one face at a time, in the
    // fixed order +X, -X, +Y, -Y, +Z, -Z (4 vertices each). Front/back are
    // baked WHITE (a no-op multiplier) so the resting face shows exactly
    // this instance's own sampled colour; the two side faces are baked to
    // REVEAL_RATIO so turning the strip always reveals a darker version
    // of that same colour, not an unrelated flat tone.
    const colors = new Float32Array(24 * 3);
    const paint = (faceIndex: number, c: THREE.Color) => {
      for (let i = 0; i < 4; i++) {
        const o = (faceIndex * 4 + i) * 3;
        colors[o] = c.r;
        colors[o + 1] = c.g;
        colors[o + 2] = c.b;
      }
    };
    paint(0, REVEAL_RATIO); // +X side
    paint(1, REVEAL_RATIO); // -X side
    paint(2, new THREE.Color(1, 1, 1)); // +Y top
    paint(3, new THREE.Color(1, 1, 1)); // -Y bottom
    paint(4, new THREE.Color(1, 1, 1)); // +Z front
    paint(5, new THREE.Color(1, 1, 1)); // -Z back
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }

  // alpha:true (clear alpha 0 below) so the flip-reveal can expose page 2
  // sitting behind this canvas — at rest this looks identical to a fully
  // opaque canvas since strips always tile edge-to-edge with zero gaps
  // and never rotate past MAX_ROTATION (88deg) during normal hover, so
  // there's never an actual transparent gap until triggerFlipReveal.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x15100d, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 0, 0, 0, 0.1, 500);
  camera.position.z = 200;

  // Unlit on purpose: the dark/lit reveal already comes entirely from the
  // geometry's own baked-in vertex colours combined with each instance's
  // own colour (see buildStripGeometry / instanceColor), so a lit
  // material would only add shading on top of that for a small nicety at
  // a real per-frame cost across hundreds of instances. Kept simple for
  // headroom given how many strips a wide viewport needs.
  const material = new THREE.MeshBasicMaterial({ vertexColors: true });
  const geometry = buildStripGeometry(100, STRIP_DEPTH); // height rebuilt on resize
  const mesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES);
  mesh.count = 0;
  scene.add(mesh);

  let width = 0;
  let height = 0;
  let count = 0;
  const proximity = new Float32Array(MAX_INSTANCES);
  const stripX = new Float32Array(MAX_INSTANCES);
  const stripZ = new Float32Array(MAX_INSTANCES);
  const stripWidthPx = new Float32Array(MAX_INSTANCES);
  const dummy = new THREE.Object3D();
  const tintColor = new THREE.Color();

  function layout() {
    width = container!.clientWidth;
    height = container!.clientHeight;
    if (width <= 0 || height <= 0) return;

    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);

    // rebuild geometry only when the height actually changed enough to
    // matter (viewport height rarely changes as often as width) — cheap
    // either way, but no reason to churn a new BufferGeometry every resize
    if (Math.abs((geometry.parameters.height as number) - height) > 4) {
      mesh.geometry.dispose();
      mesh.geometry = buildStripGeometry(height, STRIP_DEPTH);
    }

    // Cumulative tiling: each strip gets a random width in range, an
    // occasional few px of overlap with the previous strip (never a gap),
    // a random Z offset for layered depth, and a resting colour sampled
    // independently from the palette gradient.
    let x = -width / 2;
    let i = 0;
    while (x < width / 2 && i < MAX_INSTANCES) {
      const w = STRIP_WIDTH_MIN + Math.random() * (STRIP_WIDTH_MAX - STRIP_WIDTH_MIN);
      const overlap = Math.random() * OVERLAP_MAX;
      const z = (Math.random() * 2 - 1) * DEPTH_JITTER;

      stripWidthPx[i] = w;
      stripX[i] = x + w / 2;
      stripZ[i] = z;

      // No per-strip brightness modulation here on purpose (see the
      // depth note up top) — every strip shows its sampled palette
      // colour exactly, completely flat/matte.
      tintColor.copy(sampleGradient(Math.random()));
      mesh.setColorAt(i, tintColor);

      x += w - overlap;
      i++;
    }
    count = i;
    mesh.count = count;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  layout();

  let resizeTimer: number | undefined;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(layout, 150);
  });

  // ---- cursor tracking ----
  // Listened on window (not the canvas) so hovering the headline/kicker/
  // watermark sitting visually on top of the canvas still updates the
  // strips underneath them — those elements would otherwise occlude a
  // canvas-only listener.
  const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  let mouseActive = false;
  let mouseWorldX = 0;
  let smoothMouseX = 0;

  if (!coarsePointer) {
    window.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      const withinX = e.clientX >= rect.left && e.clientX <= rect.right;
      const withinY = e.clientY >= rect.top && e.clientY <= rect.bottom;
      mouseActive = withinX && withinY;
      if (mouseActive) mouseWorldX = e.clientX - rect.left - width / 2;
    });
    window.addEventListener('mouseleave', () => {
      mouseActive = false;
    });
  }

  function smoothstep(t: number) {
    const c = Math.min(Math.max(t, 0), 1);
    return c * c * (3 - 2 * c);
  }
  function easeOutCubic(t: number) {
    return 1 - Math.pow(1 - t, 3);
  }

  // ---- flip-reveal (triggered by "Move Next", see triggerFlipReveal above) ----
  const FLIP_ANGLE = THREE.MathUtils.degToRad(90); // edge-on — see triggerFlip's own comment
  const FLIP_STAGGER_MS = 14; // per-strip delay, left to right — the "sweeping wave"
  const FLIP_DURATION_MS = 900; // slow/deliberate per the brief, not a snap
  let flipping = false;
  let flipStartTime = 0;
  let flipDoneCallback: (() => void) | null = null;
  let flipFired = false;
  triggerFlip = onDone => {
    if (flipping) return;
    flipping = true;
    flipFired = false;
    flipDoneCallback = onDone;
    flipStartTime = performance.now();
  };

  let lastTime = performance.now();
  function frame(time: number) {
    requestAnimationFrame(frame);
    if (!active || width <= 0) return;

    const dt = Math.min((time - lastTime) / 1000, 1 / 20);
    lastTime = time;

    if (flipping) {
      const elapsed = time - flipStartTime;
      let allDone = true;
      for (let i = 0; i < count; i++) {
        const localT = (elapsed - i * FLIP_STAGGER_MS) / FLIP_DURATION_MS;
        const clamped = Math.min(Math.max(localT, 0), 1);
        if (clamped < 1) allDone = false;
        const angle = easeOutCubic(clamped) * FLIP_ANGLE;

        dummy.position.set(stripX[i], 0, stripZ[i]);
        dummy.rotation.set(0, angle, 0);
        dummy.scale.set(stripWidthPx[i], 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      renderer.render(scene, camera);
      if (allDone && !flipFired) {
        flipFired = true;
        flipDoneCallback?.();
      }
      return;
    }

    const easeAmount = 1 - Math.exp(-EASE_RATE * dt);
    const mouseEaseAmount = 1 - Math.exp(-MOUSE_EASE_RATE * dt);

    if (mouseActive) smoothMouseX += (mouseWorldX - smoothMouseX) * mouseEaseAmount;

    for (let i = 0; i < count; i++) {
      const dist = mouseActive ? Math.abs(stripX[i] - smoothMouseX) : Infinity;
      const target = smoothstep(1 - dist / PROXIMITY_RADIUS);
      proximity[i] += (target - proximity[i]) * easeAmount;

      dummy.position.set(stripX[i], 0, stripZ[i]);
      dummy.rotation.set(0, proximity[i] * MAX_ROTATION, 0);
      dummy.scale.set(stripWidthPx[i], 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}
