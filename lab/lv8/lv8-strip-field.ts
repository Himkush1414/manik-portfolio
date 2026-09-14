// /lab/lv8 — hero background: a field of thin vertical strips tiled edge
// to edge. At rest every strip sits at its darkest resting tone; as the
// cursor approaches, nearby strips physically ROTATE (around their own
// vertical axis) toward the cursor, and rotating is what reveals a
// brighter face underneath — not a flat colour swap synced to a fake
// rotation. Each strip is a thin box: front/back faces carry the
// palette's darkest tone, the two side faces carry its brightest tone, so
// turning a strip is genuinely what brings that brighter face into view.
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

if (canvas && container) {
  const DARK = new THREE.Color('#15100D');
  const LIT = new THREE.Color('#A83421');

  const STRIP_WIDTH = 5; // CSS px, per spec — edge-to-edge, no gaps
  const STRIP_DEPTH = 7;
  const MAX_INSTANCES = 900; // comfortably covers even a 4500px-wide screen
  const MAX_ROTATION = THREE.MathUtils.degToRad(74);
  const PROXIMITY_RADIUS = 130; // px — how far a strip's reach extends from the cursor
  const EASE_RATE = 6; // higher = snaps toward target proximity faster

  function buildStripGeometry(width: number, height: number, depth: number) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    // BoxGeometry's 24 vertices are laid out one face at a time, in the
    // fixed order +X, -X, +Y, -Y, +Z, -Z (4 vertices each) — the two side
    // faces (+X/-X) get the LIT colour, everything else stays DARK, so
    // only rotating the box brings the lit faces into view.
    const colors = new Float32Array(24 * 3);
    const paint = (faceIndex: number, c: THREE.Color) => {
      for (let i = 0; i < 4; i++) {
        const o = (faceIndex * 4 + i) * 3;
        colors[o] = c.r;
        colors[o + 1] = c.g;
        colors[o + 2] = c.b;
      }
    };
    paint(0, LIT); // +X side
    paint(1, LIT); // -X side
    paint(2, DARK); // +Y top
    paint(3, DARK); // -Y bottom
    paint(4, DARK); // +Z front
    paint(5, DARK); // -Z back
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x15100d, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 0, 0, 0, 0.1, 500);
  camera.position.z = 200;

  // Unlit on purpose: the dark/lit reveal already comes entirely from the
  // geometry's own baked-in vertex colours (dark front/back, lit sides —
  // see buildStripGeometry), so a lit material would only add shading on
  // top of that for a small nicety at a real per-frame cost across
  // hundreds of instances. Kept simple for headroom given how many
  // strips a wide viewport needs.
  const material = new THREE.MeshBasicMaterial({ vertexColors: true });
  const geometry = buildStripGeometry(STRIP_WIDTH, 100, STRIP_DEPTH); // height rebuilt on resize
  const mesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES);
  mesh.count = 0;
  scene.add(mesh);

  let width = 0;
  let height = 0;
  let count = 0;
  const proximity = new Float32Array(MAX_INSTANCES);
  const stripX = new Float32Array(MAX_INSTANCES);
  const dummy = new THREE.Object3D();

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

    count = Math.min(Math.ceil(width / STRIP_WIDTH), MAX_INSTANCES);
    mesh.count = count;

    // rebuild geometry only when the height actually changed enough to
    // matter (viewport height rarely changes as often as width) — cheap
    // either way, but no reason to churn a new BufferGeometry every resize
    if (Math.abs((geometry.parameters.height as number) - height) > 4) {
      mesh.geometry.dispose();
      mesh.geometry = buildStripGeometry(STRIP_WIDTH, height, STRIP_DEPTH);
    }

    for (let i = 0; i < count; i++) {
      stripX[i] = -width / 2 + STRIP_WIDTH * (i + 0.5);
    }
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

  let lastTime = performance.now();
  function frame(time: number) {
    requestAnimationFrame(frame);
    if (!active || width <= 0) return;

    const dt = Math.min((time - lastTime) / 1000, 1 / 20);
    lastTime = time;
    const easeAmount = 1 - Math.exp(-EASE_RATE * dt);

    for (let i = 0; i < count; i++) {
      const dist = mouseActive ? Math.abs(stripX[i] - mouseWorldX) : Infinity;
      const target = smoothstep(1 - dist / PROXIMITY_RADIUS);
      proximity[i] += (target - proximity[i]) * easeAmount;

      dummy.position.set(stripX[i], 0, 0);
      dummy.rotation.set(0, proximity[i] * MAX_ROTATION, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}
