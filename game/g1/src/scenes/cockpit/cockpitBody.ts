// Pilot body framing (brief §15), cockpit-local metres (eye at the origin,
// forward -z). Built for what the eye ACTUALLY sees at the bottom of frame:
// the band between the dash's lower edge (~36 deg below the eye) and the
// frame edge (~47 deg at the default 75 deg FOV, ~56 deg at 100): gloved fists
// closed on the stick and the throttle, raised knees + thighs in a G-suit with
// leg-restraint garters, and a kneeboard carrying the mission card. The
// shoulder harness and headrest sit behind/below the eye at every allowed FOV
// (DEV_NOTES §8), so they are not modelled; the helmet rim is the DOM frame.
import {
  CanvasTexture,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  BoxGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MISSION_01 } from '../../data/lore';

export type BodyKit = {
  /** registers a disposable, returns it */
  keep: <T extends { dispose(): void }>(x: T) => T;
  mats: { suit: Material; glove: Material; gloveTrim: Material; bright: Material };
};

const Y = new Vector3(0, 1, 0);

/** Bakes every mesh under `root` into ONE mesh per material (brief §10: merge
 *  per material) — a fist is ~20 parts, 3 draw calls after this. */
function mergeByMaterial(root: Group, keep: BodyKit['keep']): Group {
  root.updateMatrixWorld(true);
  const buckets = new Map<Material, BufferGeometry[]>();
  root.traverse(o => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    const list = buckets.get(m.material as Material) ?? [];
    list.push(g);
    buckets.set(m.material as Material, list);
  });
  const out = new Group();
  buckets.forEach((geos, mat) => {
    const merged = keep(mergeGeometries(geos)!);
    geos.forEach(g => g.dispose());
    const mesh = new Mesh(merged, mat);
    mesh.receiveShadow = true;
    out.add(mesh);
  });
  return out;
}

/** Orients a Y-aligned mesh along `dir`, centred `along` metres from `from`. */
function alongDir(mesh: Mesh, from: Vector3, dir: Vector3, along: number): Mesh {
  mesh.quaternion.setFromUnitVectors(Y, dir);
  mesh.position.copy(from).addScaledVector(dir, along);
  return mesh;
}

/**
 * A gloved fist closed around a cylindrical grip of radius `r` whose axis is
 * local +Y (centred on the origin). Back of the hand on +X, fingers wrapping
 * round the front (-Z) to the far side, thumb over the top, gauntlet + trim
 * ring at the wrist, sleeve running off along `armDir` (local, normalised).
 */
export function fist(kit: BodyKit, r: number, armDir: Vector3): Group {
  const { keep, mats } = kit;
  const g = new Group();
  const mesh = (geo: BufferGeometry, m: Material) => {
    const me = new Mesh(keep(geo), m);
    me.castShadow = false;
    me.receiveShadow = true;
    g.add(me);
    return me;
  };
  // fingers: four stacked partial tori, index on top, little finger smallest
  const fingers = [
    { y: 0.031, t: 0.0105, arc: 172 },
    { y: 0.01, t: 0.0108, arc: 178 },
    { y: -0.011, t: 0.0104, arc: 174 },
    { y: -0.03, t: 0.0092, arc: 162 },
  ];
  const onRing = (a: number, R: number, y: number) => new Vector3(Math.cos(a) * R, y, -Math.sin(a) * R);
  for (const f of fingers) {
    // three phalanges along the wrap; overlapping capsule ends read as joints
    const R = r + f.t * 0.95;
    const a0 = (12 * Math.PI) / 180;
    const span = (f.arc * Math.PI) / 180;
    const cuts = [0, 0.4, 0.72, 1];
    for (let k = 0; k < 3; k++) {
      const A = onRing(a0 + span * cuts[k], R, f.y);
      const B = onRing(a0 + span * cuts[k + 1], R, f.y);
      const d = B.clone().sub(A);
      const len = d.length();
      const rad = f.t * (1 - k * 0.07);
      alongDir(mesh(new CapsuleGeometry(rad, Math.max(0.001, len - rad * 0.4), 4, 10), mats.glove), A, d.normalize(), len / 2);
    }
  }
  // knuckle ridge + back of the hand
  const kn = (12 * Math.PI) / 180;
  mesh(new CapsuleGeometry(0.0125, 0.058, 4, 10), mats.glove).position.set(Math.cos(kn) * (r + 0.012), 0, -Math.sin(kn) * (r + 0.012));
  const back = mesh(new SphereGeometry(1, 20, 14), mats.glove);
  back.scale.set(0.02, 0.046, 0.047);
  back.position.set(r + 0.014, 0, 0.026);
  // palm heel on the near side: the curled fingertips tuck into it
  const heelA = (196 * Math.PI) / 180;
  const heel = mesh(new SphereGeometry(1, 16, 12), mats.glove);
  heel.scale.set(0.024, 0.045, 0.022);
  heel.position.set(Math.cos(heelA) * (r + 0.013), -0.004, -Math.sin(heelA) * (r + 0.013) + 0.006);
  // thumb over the top toward the hat switch
  const thumbDir = new Vector3(-0.55, 0.25, -0.8).normalize();
  alongDir(mesh(new CapsuleGeometry(0.0112, 0.032, 4, 10), mats.glove), new Vector3(r + 0.006, 0.05, 0.016), thumbDir, 0.022);
  // gauntlet + trim ring + sleeve
  const wrist = new Vector3(r + 0.016, -0.004, 0.064);
  alongDir(mesh(new CylinderGeometry(0.03, 0.035, 0.055, 18), mats.glove), wrist, armDir, 0.022);
  alongDir(mesh(new CylinderGeometry(0.0362, 0.0362, 0.009, 18), mats.gloveTrim), wrist, armDir, 0.05);
  alongDir(mesh(new CylinderGeometry(0.043, 0.056, 0.46, 18), mats.suit), wrist, armDir, 0.28);
  return mergeByMaterial(g, keep);
}

function kneeboardTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 384;
  c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c9ccc4'; // paper under the light
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(20,24,32,0.55)';
  g.lineWidth = 2;
  g.strokeRect(14, 14, c.width - 28, c.height - 28);
  g.fillStyle = '#14171f';
  g.font = '700 30px "JetBrains Mono", monospace';
  g.fillText(`MSN ${MISSION_01.number}`, 30, 62);
  g.font = '800 40px "Oxanium", sans-serif';
  g.fillText(MISSION_01.title, 30, 112);
  g.fillStyle = '#c2410c';
  g.fillRect(30, 128, 140, 5);
  g.fillStyle = '#14171f';
  g.font = '500 22px "JetBrains Mono", monospace';
  const rows = [`CORRIDOR  ${MISSION_01.corridor}`, `SORTIE    ${MISSION_01.sortie}`, `THREAT    ${MISSION_01.threat}`, 'TGT       KESTREL-9', 'WINDOW    09:00', ''];
  rows.forEach((t, i) => g.fillText(t, 30, 176 + i * 34));
  g.font = '600 20px "JetBrains Mono", monospace';
  MISSION_01.objectives.forEach((o, i) => {
    g.strokeRect(30, 368 + i * 40 - 16, 18, 18);
    g.fillText(o.toUpperCase(), 60, 368 + i * 40);
  });
  // pencil marks
  g.strokeStyle = 'rgba(30,30,40,0.6)';
  g.beginPath();
  g.moveTo(250, 250);
  g.lineTo(330, 236);
  g.moveTo(250, 262);
  g.lineTo(312, 252);
  g.stroke();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Raised knees + thighs (G-suit, garters) and the kneeboard on the right thigh. */
export function legs(kit: BodyKit, target: Group): void {
  const parent = new Group();
  const { keep, mats } = kit;
  const gsuit = keep(new MeshStandardMaterial({ color: '#262c31', roughness: 0.82, metalness: 0.03 }));
  const strap = keep(new MeshStandardMaterial({ color: '#0b0c0f', roughness: 0.7, metalness: 0.05 }));
  const add = (geo: BufferGeometry, m: Material) => {
    const me = new Mesh(keep(geo), m);
    me.receiveShadow = true;
    parent.add(me);
    return me;
  };
  for (const sx of [-1, 1]) {
    const hip = new Vector3(sx * 0.11, -0.74, -0.1);
    const knee = new Vector3(sx * 0.165, -0.497, -0.57); // knee tops sit just under the dash's lower edge
    const axis = knee.clone().sub(hip);
    const L = axis.length();
    axis.normalize();
    // top of the thigh, perpendicular to its axis
    const up = new Vector3(0, -axis.z, axis.y).normalize();
    // thigh (narrows toward the knee) + G-suit panel over its middle
    alongDir(add(new CylinderGeometry(0.064, 0.086, L, 22, 4), mats.suit), hip, axis, L / 2);
    alongDir(add(new CylinderGeometry(0.069, 0.085, L * 0.5, 22, 1), gsuit), hip, axis, L * 0.45);
    // knee + shin dropping toward the rudder pedals (mostly under the dash)
    const kneeM = add(new SphereGeometry(0.066, 20, 14), mats.suit);
    kneeM.position.copy(knee);
    kneeM.scale.set(1, 0.92, 1.06);
    const shin = new Vector3(sx * 0.03, -0.62, -0.78).normalize();
    alongDir(add(new CylinderGeometry(0.055, 0.066, 0.42, 18), mats.suit), knee, shin, 0.21);
    // leg-restraint garter just above the knee, with its D-ring on the outside
    const gp = hip.clone().addScaledVector(axis, L * 0.84);
    alongDir(add(new CylinderGeometry(0.0735, 0.0745, 0.022, 22, 1, true), strap), gp, axis, 0);
    const ring = add(new TorusGeometry(0.012, 0.0028, 6, 14), mats.bright);
    ring.position.copy(gp).add(new Vector3(sx * 0.076, 0.004, 0));
    ring.rotation.set(0, Math.PI / 2, 0.4 * sx);
    // G-suit zip along the outer-top line
    const zip = add(new BoxGeometry(0.004, 0.003, L * 0.48), mats.bright);
    zip.quaternion.setFromUnitVectors(new Vector3(0, 0, -1), axis);
    zip.position.copy(hip).addScaledVector(axis, L * 0.45).addScaledVector(up, 0.082).add(new Vector3(sx * 0.03, 0, 0));
    if (sx > 0) {
      // kneeboard: board + mission card + clip + elastic strap, on the right thigh near the knee
      const at = hip.clone().addScaledVector(axis, L * 0.8).addScaledVector(up, 0.074);
      const kb = new Group();
      kb.matrixAutoUpdate = false;
      const side = new Vector3(1, 0, 0);
      const fwd = new Vector3().crossVectors(up, side); // = the thigh axis: card text reads 'up' toward the knee
      kb.matrix.copy(new Matrix4().makeBasis(side, fwd, up).setPosition(at));
      parent.add(kb);
      const board = new Mesh(keep(new BoxGeometry(0.135, 0.17, 0.006)), mats.suit);
      board.position.z = -0.003;
      const tex = keep(kneeboardTexture());
      const paper = new Mesh(keep(new PlaneGeometry(0.118, 0.152)), keep(new MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 })));
      paper.position.set(0, -0.004, 0.0004);
      const clip = new Mesh(keep(new BoxGeometry(0.07, 0.018, 0.008)), mats.bright);
      clip.position.set(0, 0.078, 0.003);
      const band = new Mesh(keep(new BoxGeometry(0.15, 0.026, 0.004)), strap);
      band.position.set(0, -0.05, 0.001);
      kb.add(board, paper, clip, band);
    }
  }
  target.add(mergeByMaterial(parent, keep));
}
