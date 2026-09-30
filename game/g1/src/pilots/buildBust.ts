// Procedural pilot bust (brief §13, <= 25k tris). Groups: `torso` (breathes),
// `head` (turns). Real geometry: helmet shell + visor segment with an inner
// HUD glow, crest or rear fin + antenna, cheek plates, mic boom, oxygen hose
// to the chest rig, neck seal ring, collar with the Halcyon patch, pauldrons
// with insignia, harness straps + metal buckles, fabric-weave normals.
import {
  BoxGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CylinderGeometry,
  DataTexture,
  ExtrudeGeometry,
  Group,
  LinearMipmapLinearFilter,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  CircleGeometry,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  UnsignedByteType,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import { heightToNormalData } from '../render/tex/bakeData';
import type { PilotSpec } from './specs';

export type Bust = {
  root: Group;
  torso: Group;
  head: Group;
  visorMat: MeshPhysicalMaterial;
  hudTex: CanvasTexture;
  tris: number;
  dispose(): void;
};

let weave: Texture | null = null;
/** Shared fabric weave normal map (tileable 2x2 twill), built once. */
function weaveNormal(): Texture {
  if (weave) return weave;
  const S = 128;
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const u = (x % 16) / 16, v = (y % 16) / 16;
      const warp = Math.sin(u * Math.PI * 2) * 0.5 + 0.5, weft = Math.sin(v * Math.PI * 2) * 0.5 + 0.5;
      const diag = ((Math.floor(x / 8) + Math.floor(y / 8)) & 1) === 0;
      h[y * S + x] = diag ? warp * 0.8 + weft * 0.2 : weft * 0.8 + warp * 0.2;
    }
  const t = new DataTexture(heightToNormalData(h, S, S, 0.9) as Uint8ClampedArray<ArrayBuffer>, S, S, RGBAFormat, UnsignedByteType);
  t.colorSpace = NoColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(22, 22);
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  t.needsUpdate = true;
  weave = t;
  return t;
}

/** Visor HUD: a few lines of telemetry drawn once; the shader scrolls it via offset. */
/** 2D canvas that works on the main thread AND inside the bust worker. */
function makeCanvas(w: number, h: number): { c: HTMLCanvasElement | OffscreenCanvas; g: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D } {
  const c = typeof document === 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  return { c, g: c.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D };
}

function hudTexture(callsign: string): CanvasTexture {
  const { c, g } = makeCanvas(256, 128);
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#ff8a3d';
  g.font = '500 11px "JetBrains Mono", monospace';
  const lines = [`${callsign} // LINK OK`, 'O2 98%  HR 062', 'SUIT PRESS 1.02', 'COMMS: MERIDIAN', 'HUD CAL ▮▮▮▮▯', 'VEIL 01/12'];
  lines.forEach((l, i) => g.fillText(l, 64, 22 + i * 17));
  g.strokeStyle = '#ff8a3d';
  g.strokeRect(58, 8, 150, 106);
  const t = new CanvasTexture(c as HTMLCanvasElement);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

function patchTexture(): CanvasTexture {
  const { c, g } = makeCanvas(128, 128);
  g.fillStyle = '#10131c';
  g.beginPath();
  g.arc(64, 64, 62, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ff5a1f';
  g.lineWidth = 5;
  g.stroke();
  // chevron wing mark
  g.fillStyle = '#e8ecff';
  g.beginPath();
  g.moveTo(20, 70);
  g.lineTo(64, 36);
  g.lineTo(108, 70);
  g.lineTo(94, 76);
  g.lineTo(64, 54);
  g.lineTo(34, 76);
  g.closePath();
  g.fill();
  g.font = '900 17px "Big Shoulders Display", sans-serif';
  g.textAlign = 'center';
  g.fillText('HALCYON', 64, 100);
  const t = new CanvasTexture(c as HTMLCanvasElement);
  t.colorSpace = SRGBColorSpace;
  return t;
}

const V = (x: number, y: number, z: number) => new Vector3(x, y, z);

export function buildBust(spec: PilotSpec): Bust {
  const disposables: { dispose(): void }[] = [];
  const own = <T extends BufferGeometry | Material | Texture>(x: T) => (disposables.push(x), x);
  const c = spec.colors;
  const suit = own(new MeshStandardMaterial({ color: c.suit, roughness: 0.86, metalness: 0.05, normalMap: weaveNormal(), normalScale: new Vector2(0.35, 0.35) }));
  const armour = own(new MeshPhysicalMaterial({ color: c.armour, roughness: 0.38, metalness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.25 }));
  const shell = own(new MeshPhysicalMaterial({ color: c.helmet, roughness: 0.3, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12 }));
  const trim = own(new MeshStandardMaterial({ color: c.trim, roughness: 0.45, metalness: 0.2 }));
  const strap = own(new MeshStandardMaterial({ color: c.strap, roughness: 0.75, metalness: 0.05, normalMap: weaveNormal(), normalScale: new Vector2(0.4, 0.4) }));
  const metal = own(new MeshStandardMaterial({ color: '#9aa2b1', roughness: 0.28, metalness: 1 }));
  const rubber = own(new MeshStandardMaterial({ color: '#0d0f14', roughness: 0.62, metalness: 0 }));
  const hudTex = own(hudTexture(spec.id.toUpperCase()));
  const visorMat = own(
    new MeshPhysicalMaterial({ color: '#07080c', roughness: 0.06, metalness: 0.9, clearcoat: 1, clearcoatRoughness: 0.03, emissive: '#ffffff', emissiveMap: hudTex, emissiveIntensity: 0.0 }),
  );
  const patchTex = own(patchTexture());
  const patchMat = own(new MeshStandardMaterial({ map: patchTex, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }));

  const root = new Group();
  const torso = new Group();
  const head = new Group();
  root.add(torso, head);
  const add = (parent: Group, g: BufferGeometry, m: Material, cast = true) => {
    const mesh = new Mesh(own(g), m);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // ---------------------------------------------------------------- torso
  const [cx, cy, cz] = spec.chest;
  add(torso, new SphereGeometry(1, 48, 32).scale(cx, cy, cz).translate(0, -0.3, 0), suit);
  // shoulder yoke: a flattened capsule across the shoulder line
  add(torso, new CylinderGeometry(0.13, 0.13, spec.shoulder * 2, 32, 1).rotateZ(Math.PI / 2).scale(1, 0.72, 1).translate(0, -0.06, -0.02), suit);
  // chest rig: bevelled plates (heavy = bigger + side pouches)
  const plate = (w: number, h: number, d: number) => {
    const s = new Shape();
    const r = 0.025;
    s.moveTo(-w / 2 + r, -h / 2);
    s.lineTo(w / 2 - r, -h / 2);
    s.lineTo(w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r * 2);
    s.lineTo(w / 2 - r * 2, h / 2);
    s.lineTo(-w / 2 + r * 2, h / 2);
    s.lineTo(-w / 2, h / 2 - r * 2);
    s.lineTo(-w / 2, -h / 2 + r);
    s.closePath();
    return new ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 });
  };
  const heavy = spec.rig === 'heavy';
  add(torso, plate(heavy ? 0.36 : 0.28, heavy ? 0.26 : 0.2, 0.04).rotateX(-0.18).translate(0, -0.26, cz - 0.03), armour);
  add(torso, plate(heavy ? 0.3 : 0.22, 0.08, 0.03).translate(0, -0.43, cz - 0.07), armour);
  if (heavy) {
    for (const sx of [-1, 1]) add(torso, plate(0.09, 0.12, 0.05).rotateY(sx * 0.5).translate(sx * 0.27, -0.36, cz - 0.1), armour);
  }
  // pauldrons: domed shells + an insignia bar (+ Ignition edge trim on EMBER)
  for (const sx of [-1, 1]) {
    const p = add(torso, new SphereGeometry(spec.pauldron, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.15, 0.7, 1), armour);
    p.position.set(sx * (spec.shoulder - 0.02), -0.02, 0);
    p.rotation.z = -sx * 0.35;
    const rim = add(torso, new TorusGeometry(spec.pauldron * 1.1, 0.012, 8, 40, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI / 2), spec.id === 'ember' ? trim : metal);
    rim.position.copy(p.position);
    rim.rotation.z = -sx * 0.35;
    rim.scale.set(1.12, 1, 1);
  }
  // Halcyon patch on the left pauldron
  const patch = add(torso, new CircleGeometry(0.055, 32), patchMat, false);
  patch.position.set(spec.shoulder - 0.05, 0.02, spec.pauldron * 0.78);
  patch.rotation.set(-0.5, 0.45, 0);
  // harness straps: flat strips over the shoulders into a chest buckle
  const stripShape = new Shape();
  stripShape.moveTo(-0.022, -0.004);
  stripShape.lineTo(0.022, -0.004);
  stripShape.lineTo(0.022, 0.004);
  stripShape.lineTo(-0.022, 0.004);
  stripShape.closePath();
  for (const sx of [-1, 1]) {
    const path = new CatmullRomCurve3([V(sx * 0.16, -0.2, -cz + 0.02), V(sx * 0.19, 0.06, -0.08), V(sx * 0.17, 0.06, 0.1), V(sx * 0.1, -0.12, cz + 0.02), V(sx * 0.03, -0.3, cz + 0.035)]);
    add(torso, new ExtrudeGeometry(stripShape, { steps: 40, extrudePath: path, bevelEnabled: false }), strap);
    add(torso, new BoxGeometry(0.05, 0.035, 0.018).translate(sx * 0.07, -0.2, cz + 0.035), metal);
  }
  add(torso, new BoxGeometry(0.075, 0.06, 0.025).translate(0, -0.31, cz + 0.045), metal);
  // collar + neck seal ring
  add(torso, new CylinderGeometry(0.14, 0.17, 0.09, 40, 1, true).translate(0, 0.06, 0), suit);
  add(torso, new TorusGeometry(0.128, 0.022, 12, 48).rotateX(Math.PI / 2).translate(0, 0.11, 0), metal);
  if (spec.id === 'ember') add(torso, new TorusGeometry(0.152, 0.01, 8, 48).rotateX(Math.PI / 2).translate(0, 0.07, 0), trim);
  // oxygen hose: helmet left jaw -> chest rig right side, ribbed by segments
  const hose = new CatmullRomCurve3([V(-0.15, 0.16, 0.05), V(-0.2, 0.02, 0.14), V(-0.1, -0.12, cz + 0.08), V(0.1, -0.18, cz + 0.07), V(0.16, -0.26, cz + 0.02)]);
  add(torso, new TubeGeometry(hose, 64, 0.022, 10, false), rubber);
  for (let i = 1; i < 12; i++) {
    const t = i / 12, pt = hose.getPointAt(t), tan = hose.getTangentAt(t);
    const ring = add(torso, new TorusGeometry(0.024, 0.005, 6, 14), rubber, false);
    ring.position.copy(pt);
    ring.lookAt(pt.clone().add(tan));
  }

  // ----------------------------------------------------------------- head
  head.position.set(0, 0.3, 0);
  // proportions: suited shoulders ~2.2 helmet widths (was ~3: tiny heads)
  head.scale.setScalar(1.28);
  torso.userData.base = [0.86, 1, 0.94];
  const [hx, hy, hz] = spec.helmet.scale;
  // helmet: shell + wrap-around visor band + brow plate + chin guard + ear pods.
  // Sphere segments share the shell's centre so every band sits flush.
  // (SphereGeometry phi = 0 faces -x; rotateY(+90deg) turns the band to face +z)
  const band = (r: number, phiLen: number, t0: number, t1: number, segs = 56) =>
    new SphereGeometry(r, segs, 20, -phiLen / 2, phiLen, t0 * Math.PI, (t1 - t0) * Math.PI).rotateY(Math.PI / 2).scale(hx, hy, hz);
  add(head, new SphereGeometry(0.19, 56, 40).scale(hx, hy, hz * 1.04).translate(0, 0, -0.008), shell);
  add(head, band(0.1945, Math.PI * 0.86, 0.3, 0.63), visorMat);
  add(head, band(0.199, Math.PI * 0.9, 0.235, 0.305), armour);
  add(head, band(0.197, Math.PI * 0.72, 0.625, 0.75), armour);
  for (const sx of [-1, 1]) add(head, new CylinderGeometry(0.058, 0.064, 0.05, 28).rotateZ(Math.PI / 2).translate(sx * 0.185 * hx, -0.02, -0.01), armour);
  // cheek plates below the ear pods
  for (const sx of [-1, 1]) add(head, plate(spec.helmet.cheek, 0.09, 0.018).rotateY(sx * 1.25).translate(sx * 0.172 * hx, -0.1, 0.05), shell);
  if (spec.helmet.crest === 'angular') {
    // ONYX: angular crest ridge along the crown
    const s = new Shape();
    s.moveTo(-0.16, 0);
    s.lineTo(0.14, 0);
    s.lineTo(0.1, 0.035);
    s.lineTo(-0.06, 0.05);
    s.lineTo(-0.17, 0.02);
    s.closePath();
    const crest = add(head, new ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 }), shell);
    crest.rotation.y = -Math.PI / 2;
    crest.position.set(-0.015, 0.172 * hy, 0);
    for (const sx of [-1, 1]) add(head, plate(0.05, 0.03, 0.012).rotateY(sx * 1.35).rotateZ(sx * 0.3).translate(sx * 0.12, 0.13, -0.02), armour);
  } else {
    // EMBER: swept rear fin + antenna + Ignition stripe
    const s = new Shape();
    s.moveTo(0, 0);
    s.lineTo(0.16, 0);
    s.lineTo(0.2, 0.07);
    s.lineTo(0.12, 0.05);
    s.closePath();
    const fin = add(head, new ExtrudeGeometry(s, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1 }), shell);
    fin.rotation.y = Math.PI / 2;
    fin.position.set(-0.007, 0.13 * hy, -0.02);
    add(head, new CylinderGeometry(0.004, 0.006, 0.16, 6).translate(0.1, 0.2, -0.1).rotateZ(-0.12), metal);
    add(head, band(0.1925, 0.07, 0.02, 0.24, 8), trim);
  }
  // mic boom
  const boom = new CatmullRomCurve3([V(-0.17, -0.05, 0.02), V(-0.16, -0.1, 0.12), V(-0.07, -0.12, 0.2)]);
  add(head, new TubeGeometry(boom, 16, 0.006, 6, false), metal);
  add(head, new CylinderGeometry(0.014, 0.014, 0.03, 12).rotateZ(Math.PI / 2).translate(-0.06, -0.12, 0.2), rubber);

  let tris = 0;
  root.traverse(o => {
    const m = o as Mesh;
    if (m.isMesh) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  });
  return {
    root,
    torso,
    head,
    visorMat,
    hudTex,
    tris,
    dispose() {
      disposables.forEach(d => d.dispose());
    },
  };
}
