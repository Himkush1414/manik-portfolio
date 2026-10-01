// Cockpit interior (brief §15), real geometry + PBR, cockpit-local metres
// (eye at origin, forward -z). Canopy frame (bows, sills, rivets, warning
// labels) + tinted glass; dashboard with glare shield, 3 MFDs in bezels with
// OSB buttons, analog gauges, toggle rows with LEDs, backlit stencils; side
// consoles, throttle quadrant, flight stick; gloved hands, thighs, lap belt;
// combiner glass for the HUD. Trim follows the livery, glove trim the pilot.
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  CircleGeometry,
  SphereGeometry,
  SRGBColorSpace,
  RepeatWrapping,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import { COCKPIT, type CockpitVariant } from './cockpitSpec';
import type { Displays } from './displays';
import { fist, legsSteps, type BodyKit } from './cockpitBody';
import { runNow } from '../../core/slicer';

export type BuiltCockpit = {
  group: Group;
  needles: Mesh[];
  ledMat: MeshStandardMaterial;
  ledAmberMat: MeshStandardMaterial;
  screenMats: MeshBasicMaterial[];
  hudMat: MeshBasicMaterial;
  stencilMat: MeshBasicMaterial;
  setAccent(hex: string): void;
  setGloveTrim(hex: string): void;
  tris: number;
  dispose(): void;
};

const V = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** Curve a panel around the pilot: z += k * x^2 (sides come closer). */
function bend(g: BufferGeometry, k: number): BufferGeometry {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + k * p.getX(i) * p.getX(i));
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

function labelTexture(lines: string[], opts: { w: number; h: number; bg?: string; fg: string; font: string; hazard?: boolean }): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = opts.w;
  c.height = opts.h;
  const g = c.getContext('2d')!;
  if (opts.hazard) {
    g.fillStyle = '#d7a21c';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#111';
    for (let x = -c.height; x < c.width; x += 24) {
      g.beginPath();
      g.moveTo(x, c.height);
      g.lineTo(x + 12, c.height);
      g.lineTo(x + 12 + c.height * 0.4, c.height * 0.6);
      g.lineTo(x + c.height * 0.4, c.height * 0.6);
      g.fill();
    }
  } else if (opts.bg) {
    g.fillStyle = opts.bg;
    g.fillRect(0, 0, c.width, c.height);
  }
  g.fillStyle = opts.fg;
  g.font = opts.font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, c.width / 2, ((i + 0.5) / lines.length) * c.height * (opts.hazard ? 0.6 : 1)));
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Flight-suit fabric: a tiling twill bump (the suit must not read as plastic). */
function weaveTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 4) {
    for (let x = 0; x < 64; x += 4) {
      const up = ((x + y) / 4) % 4 < 2;
      g.fillStyle = up ? '#a0a0a0' : '#606060';
      g.fillRect(x, y, 4, 4);
    }
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(10, 10);
  return t;
}

/** Side-console top: dark panel with screwed plates, switch legends, panel lines. */
function consoleTexture(side: 1 | -1): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 640;
  const g = c.getContext('2d')!;
  g.fillStyle = '#101218';
  g.fillRect(0, 0, c.width, c.height);
  const plates = side < 0 ? ['LIGHTS', 'RADIO', 'IFF', 'EXT PWR'] : ['ECS', 'O2 REG', 'NAV', 'DEFOG'];
  plates.forEach((name, i) => {
    const y = 12 + i * 156;
    g.fillStyle = '#181b23';
    g.fillRect(10, y, c.width - 20, 144);
    g.strokeStyle = 'rgba(140,154,192,0.28)';
    g.lineWidth = 2;
    g.strokeRect(10, y, c.width - 20, 144);
    g.fillStyle = 'rgba(232,236,255,0.62)';
    g.font = '600 17px "JetBrains Mono", monospace';
    g.textAlign = 'center';
    g.fillText(name, c.width / 2, y + 26);
    g.fillStyle = 'rgba(232,236,255,0.32)';
    g.font = '500 12px "JetBrains Mono", monospace';
    ['OFF', 'ON', 'AUTO'].forEach((l, k) => g.fillText(l, 40 + k * 56, y + 128));
    g.fillStyle = '#2a2f3a';
    for (const [sx, sy] of [[18, y + 8], [c.width - 18, y + 8], [18, y + 136], [c.width - 18, y + 136]]) {
      g.beginPath();
      g.arc(sx, sy, 4, 0, Math.PI * 2);
      g.fill();
    }
  });
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function gaugeFace(label: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#05070b';
  g.beginPath();
  g.arc(128, 128, 126, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#c9d2e6';
  for (let i = 0; i <= 40; i++) {
    const a = Math.PI * 0.75 + (i / 40) * Math.PI * 1.5;
    const r0 = i % 5 ? 104 : 94;
    g.lineWidth = i % 5 ? 2 : 4;
    g.beginPath();
    g.moveTo(128 + Math.cos(a) * r0, 128 + Math.sin(a) * r0);
    g.lineTo(128 + Math.cos(a) * 116, 128 + Math.sin(a) * 116);
    g.stroke();
  }
  g.strokeStyle = '#ff5a1f';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(128, 128, 110, Math.PI * 1.95, Math.PI * 2.25);
  g.stroke();
  g.fillStyle = '#c9d2e6';
  g.font = '600 26px "JetBrains Mono", monospace';
  g.textAlign = 'center';
  g.fillText(label, 128, 190);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Synchronous build (fallback; the pre-warm path uses buildCockpitSteps sliced). */
export function buildCockpit(variant: CockpitVariant, displays: Displays): BuiltCockpit {
  return runNow(buildCockpitSteps(variant, displays));
}

/**
 * The cockpit build as small steps (brief §4 rule 4): the hangar's pre-warm
 * runs it through core/slicer in <= 4 ms slices — built in one go it was a
 * ~60 ms main-thread task ~3 s after the hangar settled (Phase 1 known issue).
 */
export function* buildCockpitSteps(variant: CockpitVariant, displays: Displays): Generator<void, BuiltCockpit, void> {
  const S = COCKPIT[variant];
  const own: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (own.push(x), x);
  const group = new Group();
  group.name = 'cockpit';
  const add = (parent: Group, g: BufferGeometry, m: Material, cast = false) => {
    const mesh = new Mesh(keep(g), m);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // ---------------------------------------------------------------- materials
  const frameMat = keep(new MeshStandardMaterial({ color: '#232834', roughness: 0.48, metalness: 0.75, envMapIntensity: 0.6 }));
  const panelMat = keep(new MeshStandardMaterial({ color: '#15181f', roughness: 0.72, metalness: 0.35, envMapIntensity: 0.45 }));
  const rubber = keep(new MeshStandardMaterial({ color: '#0b0c10', roughness: 0.85, metalness: 0.05 }));
  const bright = keep(new MeshStandardMaterial({ color: '#8f97a6', roughness: 0.3, metalness: 1, envMapIntensity: 0.9 }));
  const accent = keep(new MeshStandardMaterial({ color: '#ff5a1f', roughness: 0.45, metalness: 0.3 }));
  const weave = keep(weaveTexture());
  yield;
  const suit = keep(new MeshStandardMaterial({ color: '#232835', roughness: 0.88, metalness: 0.02, bumpMap: weave, bumpScale: 0.9 }));
  const glove = keep(new MeshStandardMaterial({ color: '#2b2622', roughness: 0.52, metalness: 0.04, envMapIntensity: 0.7 })); // dark leather: form must read
  const gloveTrim = keep(new MeshStandardMaterial({ color: '#8c9ac0', roughness: 0.5, metalness: 0.2 }));
  const glass = keep(
    new MeshPhysicalMaterial({ color: '#a8b8d6', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.06, side: BackSide, depthWrite: false, envMapIntensity: 1.1, clearcoat: 1, clearcoatRoughness: 0.08 }),
  );
  const ledMat = keep(new MeshStandardMaterial({ color: '#000000', emissive: new Color('#4dffb0'), emissiveIntensity: 0, toneMapped: false }));
  const ledAmberMat = keep(new MeshStandardMaterial({ color: '#000000', emissive: new Color('#ff8a3d'), emissiveIntensity: 0, toneMapped: false }));
  const screenMats = [displays.mfdL, displays.mfdC, displays.mfdR].map(t => keep(new MeshBasicMaterial({ map: t, color: new Color(0, 0, 0), toneMapped: false })));
  const hudMat = keep(new MeshBasicMaterial({ map: displays.hud, color: new Color(0, 0, 0), transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false }));
  // backlit stencils: one label per toggle bank (aspect-correct, clear of the stick)
  const stencilTex = [keep(labelTexture(['FUEL · COMM'], { w: 512, h: 64, fg: '#e8ecff', font: '600 40px "JetBrains Mono", monospace' })), keep(labelTexture(['ECM · O2'], { w: 512, h: 64, fg: '#e8ecff', font: '600 40px "JetBrains Mono", monospace' }))];
  yield;
  const stencilMat = keep(new MeshBasicMaterial({ map: stencilTex[0], color: new Color(0, 0, 0), transparent: true, depthWrite: false, toneMapped: false }));
  const stencilMat2 = stencilMat.clone();
  stencilMat2.map = stencilTex[1];
  stencilMat2.color = stencilMat.color; // one power level drives both
  keep(stencilMat2);
  const warnTex = keep(labelTexture(['CANOPY JETTISON'], { w: 512, h: 96, fg: '#111', font: '800 34px "JetBrains Mono", monospace', hazard: true }));
  yield;
  const warnMat = keep(new MeshStandardMaterial({ map: warnTex, roughness: 0.6, metalness: 0.1 }));
  const combinerGlass = keep(new MeshPhysicalMaterial({ color: '#c8a888', roughness: 0.02, metalness: 0, transparent: true, opacity: 0.08, depthWrite: false, side: DoubleSide }));

  yield;
  // ------------------------------------------------------------------ canopy
  const { w: cw, h: ch, sill, len, bowZ } = S.canopy;
  const zc = -0.15;
  const H = ch - sill;
  const kz = (z: number) => Math.sqrt(Math.max(0, 1 - ((z - zc) / len) ** 2));
  add(group, new SphereGeometry(1, 56, 28, 0, Math.PI * 2, 0, Math.PI / 2).scale(cw, H, len).translate(0, sill, zc), glass).renderOrder = 20;
  const bow = (z: number, r: number) => {
    const k = kz(z);
    const pts: Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI;
      pts.push(V(cw * k * Math.cos(a) * 0.995, sill + H * k * Math.sin(a) * 0.995, z));
    }
    return new TubeGeometry(new CatmullRomCurve3(pts), 48, r, 10, false);
  };
  yield;
  add(group, bow(bowZ, 0.022), frameMat);
  add(group, bow(bowZ - 0.03, 0.01), accent);
  add(group, bow(0.12, 0.026), frameMat);
  yield;
  // sills
  for (const sx of [-1, 1]) {
    const pts: Vector3[] = [];
    for (let z = zc - len * 0.93; z <= 0.35; z += 0.05) pts.push(V(sx * cw * kz(z) * 0.99, sill, z));
    add(group, new TubeGeometry(new CatmullRomCurve3(pts), 40, 0.03, 10, false), frameMat);
    // warning label on the sill
    const warn = add(group, new PlaneGeometry(0.13, 0.024), warnMat);
    const zl = -0.48;
    warn.position.set(sx * (cw * kz(zl) - 0.035), sill + 0.034, zl);
    warn.rotation.set(-Math.PI / 2 + 0.9, sx * 0.3, 0);
  }
  yield;
  // rivets along the windscreen bow (instanced)
  {
    const k = kz(bowZ);
    const riv = keep(new SphereGeometry(0.005, 8, 6));
    const n = 30;
    const im = new InstancedMesh(riv, bright, n);
    const m = new Matrix4();
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) / n) * Math.PI;
      m.makeTranslation(cw * k * Math.cos(a) * 0.96, sill + H * k * Math.sin(a) * 0.96, bowZ + 0.02);
      im.setMatrixAt(i, m);
    }
    group.add(im);
    own.push(im);
  }

  yield;
  // --------------------------------------------------------------- dashboard
  const D = S.dash;
  const dash = new Group();
  dash.position.set(0, D.y, D.z);
  dash.rotation.x = -D.tilt;
  group.add(dash);
  const bk = 0.32;
  add(dash, bend(new BoxGeometry(D.w, D.h, 0.05, 24, 4, 1), bk), panelMat);
  // glare shield: a curved hood over the MFDs + accent edge
  const hood = add(dash, bend(new BoxGeometry(D.w + 0.08, 0.022, 0.2, 24, 1, 4), bk), frameMat);
  hood.position.set(0, D.h / 2 + 0.01, 0.07);
  hood.rotation.x = D.tilt * 0.8;
  const lip = add(dash, bend(new BoxGeometry(D.w + 0.08, 0.008, 0.012, 24, 1, 1), bk), accent);
  lip.position.set(0, D.h / 2 + 0.03, 0.17);
  yield;
  // MFDs: screen + bezel + OSB buttons
  const mfdX = D.w * 0.31;
  const osb = keep(new BoxGeometry(0.018, 0.011, 0.008));
  const osbMesh = new InstancedMesh(osb, rubber, 3 * 10);
  own.push(osbMesh);
  let oi = 0;
  const mm = new Matrix4();
  [-mfdX, 0, mfdX].forEach((x, i) => {
    const z = 0.028 + bk * x * x;
    const sw = 0.19, sh = 0.142;
    const scr = add(dash, new PlaneGeometry(sw, sh), screenMats[i]);
    scr.position.set(x, 0.03, z + 0.004);
    scr.rotation.y = -Math.atan(2 * bk * x);
    const bez = add(dash, new BoxGeometry(sw + 0.04, sh + 0.05, 0.014), frameMat);
    bez.position.set(x, 0.03, z - 0.004);
    bez.rotation.y = scr.rotation.y;
    for (let k = 0; k < 5; k++) {
      for (const yy of [sh / 2 + 0.016, -sh / 2 - 0.016]) {
        mm.makeRotationY(scr.rotation.y).setPosition(x + (k - 2) * 0.034 * Math.cos(scr.rotation.y), 0.03 + yy, z + 0.006 - (k - 2) * 0.034 * Math.sin(scr.rotation.y));
        osbMesh.setMatrixAt(oi++, mm);
      }
    }
  });
  dash.add(osbMesh);
  yield;
  // gauges
  const needles: Mesh[] = [];
  const needleGeo = keep(new BoxGeometry(0.003, 0.03, 0.002).translate(0, 0.012, 0));
  (['ALT', 'THR'] as const).forEach((label, i) => {
    const x = (i ? 1 : -1) * 0.135;
    const face = keep(gaugeFace(label));
    const fm = keep(new MeshStandardMaterial({ map: face, roughness: 0.4, emissive: '#ffffff', emissiveMap: face, emissiveIntensity: 0.25 }));
    const gm = add(dash, new CircleGeometry(0.036, 40), fm);
    gm.position.set(x, -0.1, 0.029 + bk * x * x);
    const ring = add(dash, new CylinderGeometry(0.04, 0.04, 0.012, 40, 1, true).rotateX(Math.PI / 2), bright);
    ring.position.copy(gm.position);
    const nd = add(dash, needleGeo, keep(new MeshBasicMaterial({ color: '#ff8a3d', toneMapped: false })));
    nd.position.set(x, -0.1, gm.position.z + 0.003);
    needles.push(nd);
  });
  yield;
  // toggle row + LEDs under the MFDs
  {
    // two banks either side of the gauges (clear of them)
    const xs: number[] = [];
    for (let i = 0; i < 16; i++) {
      const x = (i - 7.5) * 0.045;
      if (Math.abs(x) > 0.19 || Math.abs(x) < 0.08) xs.push(x);
    }
    const n = xs.length - (xs.length % 2);
    const lever = keep(new CylinderGeometry(0.0035, 0.0035, 0.024, 8).translate(0, 0.012, 0));
    const base = keep(new CylinderGeometry(0.008, 0.008, 0.006, 12).rotateX(Math.PI / 2));
    const led = keep(new SphereGeometry(0.004, 8, 6));
    const levers = new InstancedMesh(lever, bright, n), bases = new InstancedMesh(base, frameMat, n);
    const ledsG = new InstancedMesh(led, ledMat, n / 2), ledsA = new InstancedMesh(led, ledAmberMat, n / 2);
    own.push(levers, bases, ledsG, ledsA);
    for (let i = 0; i < n; i++) {
      const x = xs[i];
      const z = 0.03 + bk * x * x;
      mm.makeRotationX(0.6 + (i % 3) * 0.3).setPosition(x, -0.125, z);
      levers.setMatrixAt(i, mm);
      mm.makeTranslation(x, -0.125, z);
      bases.setMatrixAt(i, mm);
      mm.makeTranslation(x, -0.098, z + 0.002);
      (i % 2 ? ledsA : ledsG).setMatrixAt(Math.floor(i / 2), mm);
    }
    dash.add(levers, bases, ledsG, ledsA);
  }
  yield;
  // backlit stencil strip along the bottom of the panel
  [-1, 1].forEach((sx, i) => {
    const x = sx * 0.27;
    const st = add(dash, new PlaneGeometry(0.15, 0.019), i ? stencilMat2 : stencilMat);
    st.position.set(x, -0.146, 0.031 + bk * x * x);
    st.rotation.y = -Math.atan(2 * bk * x);
  });

  yield;
  // ------------------------------------------------------------ side consoles
  const C = S.console;
  for (const sx of [-1, 1]) {
    yield;
    const len2 = C.z0 - C.z1;
    const ctex = keep(consoleTexture(sx as 1 | -1));
    const top = add(group, new BoxGeometry(C.w, 0.03, len2), keep(new MeshStandardMaterial({ map: ctex, roughness: 0.74, metalness: 0.3, envMapIntensity: 0.35 })));
    top.position.set(sx * C.x, C.y, (C.z0 + C.z1) / 2);
    top.rotation.z = sx * 0.12;
    const wall = add(group, new BoxGeometry(0.02, 0.2, len2), frameMat);
    wall.position.set(sx * (C.x - C.w / 2), C.y - 0.1, (C.z0 + C.z1) / 2);
    const edge = add(group, new BoxGeometry(0.006, 0.006, len2), accent);
    edge.position.set(sx * (C.x - C.w / 2 + 0.004), C.y + 0.017, (C.z0 + C.z1) / 2);
    // switch banks on the console
    const sw = keep(new BoxGeometry(0.012, 0.01, 0.02));
    const im = new InstancedMesh(sw, bright, 12);
    own.push(im);
    for (let i = 0; i < 12; i++) {
      mm.makeRotationZ(sx * 0.12).setPosition(sx * (C.x + ((i % 3) - 1) * 0.035), C.y + 0.02, C.z1 + 0.06 + Math.floor(i / 3) * 0.05);
      im.setMatrixAt(i, mm);
    }
    group.add(im);
  }
  yield;
  // tub: knee-well face under the dash, footwell side walls + floor (closes the
  // cockpit: without it the tunnel floor's hazard bands showed through)
  const tubMat = keep(new MeshStandardMaterial({ color: '#0d0f14', roughness: 0.8, metalness: 0.3 }));
  const kneeWell = add(group, bend(new BoxGeometry(D.w, 0.6, 0.03, 16, 1, 1), bk), tubMat);
  kneeWell.position.set(0, D.y - D.h / 2 - 0.28, D.z + 0.03);
  for (const sx of [-1, 1]) {
    const side = add(group, new BoxGeometry(0.02, 0.62, 1.0), tubMat);
    side.position.set(sx * (C.x - C.w / 2 - 0.01), C.y - 0.31, -0.42);
  }
  add(group, new BoxGeometry(2 * C.x, 0.02, 1.1).translate(0, -1.08, -0.4), tubMat);

  yield;
  // throttle quadrant (left console)
  const thr = new Group();
  thr.position.set(-C.x, C.y + 0.015, C.z1 + 0.12); // forward, inside the eye's frame
  group.add(thr);
  add(thr, new BoxGeometry(0.07, 0.03, 0.16), frameMat);
  const lever = add(thr, new BoxGeometry(0.018, 0.12, 0.022).translate(0, 0.06, 0), bright);
  lever.rotation.x = -0.35;
  const handle = add(thr, new CapsuleGeometry(0.024, 0.05, 6, 12).rotateZ(Math.PI / 2), rubber);
  handle.position.set(0.01, 0.115, -0.04);
  yield;
  // flight stick
  const stick = new Group();
  stick.position.set(0, -0.78, -0.5);
  group.add(stick);
  add(stick, new ConeGeometry(0.07, 0.1, 16).translate(0, 0.05, 0), rubber);
  add(stick, new CylinderGeometry(0.012, 0.014, 0.3, 12).translate(0, 0.2, 0), bright);
  const grip = add(stick, new CapsuleGeometry(0.026, 0.07, 6, 14), rubber);
  grip.position.set(0, 0.38, -0.01);
  grip.rotation.x = -0.18;
  add(stick, new BoxGeometry(0.012, 0.012, 0.012).translate(0, 0.43, 0.012), frameMat); // hat

  yield;
  // ------------------------------------------------------------- body framing
  const kit: BodyKit = { keep, mats: { suit, glove, gloveTrim, bright } };
  // right fist on the stick grip (grip axis = local Y); sleeve runs down-back-right
  const rFist = fist(kit, 0.026, new Vector3(0.36, -0.52, 0.78).normalize());
  rFist.position.copy(grip.position);
  rFist.rotation.copy(grip.rotation);
  stick.add(rFist);
  yield;
  // left fist on the throttle handle (axis along x): rotate so the back of the hand faces up
  const lFist = fist(kit, 0.024, new Vector3(-0.2, 0.2, 0.96).normalize());
  lFist.position.copy(handle.position);
  lFist.rotation.set(0, 0, Math.PI / 2);
  thr.add(lFist);
  yield;
  yield* legsSteps(kit, group);
  add(group, new BoxGeometry(0.4, 0.035, 0.05).translate(0, -0.66, -0.06), rubber); // lap belt
  add(group, new BoxGeometry(0.06, 0.05, 0.02).translate(0, -0.65, -0.09), bright); // buckle

  yield;
  // ------------------------------------------------------------------ combiner
  const comb = new Group();
  comb.position.set(0, -0.03, D.z + 0.14);
  comb.rotation.x = -0.22;
  group.add(comb);
  const glassPane = add(comb, new PlaneGeometry(0.54, 0.38), combinerGlass);
  glassPane.renderOrder = 21;
  const hudPane = add(comb, new PlaneGeometry(0.54, 0.38), hudMat);
  hudPane.position.z = 0.001;
  hudPane.renderOrder = 22;
  for (const sx of [-1, 1]) add(comb, new BoxGeometry(0.008, 0.39, 0.012).translate(sx * 0.274, 0, 0), frameMat);

  yield;
  let tris = 0;
  group.traverse(o => {
    const me = o as Mesh;
    if (!me.isMesh) return;
    const g = me.geometry;
    const t = (g.index ? g.index.count : g.attributes.position.count) / 3;
    tris += (o as InstancedMesh).isInstancedMesh ? t * (o as InstancedMesh).count : t;
  });

  return {
    group,
    needles,
    ledMat,
    ledAmberMat,
    screenMats,
    hudMat,
    stencilMat,
    setAccent(hex) {
      accent.color.set(hex);
    },
    setGloveTrim(hex) {
      gloveTrim.color.set(hex);
    },
    tris,
    dispose() {
      own.forEach(o => o.dispose());
    },
  };
}

export type { Texture };
