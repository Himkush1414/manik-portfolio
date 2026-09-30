// Parked background fighters (brief §11: 4-6, ShipFactory LOD1, dark, out of
// focus): Halcyon Wing's spare HALCYON airframes on maintenance cradles —
// two behind the pad (the welding happens there), two flanking the doors
// (seen as the boot dolly passes through). One merged LOD1 craft, instanced:
// all four draw in 3 calls (hull, standby lights, cradles).
import { useEffect, useMemo } from 'react';
import { BoxGeometry, Euler, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mergedShipGeometry } from '../../../ships/ShipFactory';
import { SPECS } from '../../../ships/specs';
import { hdr } from '../../../render/palette';

export const PARKED: { pos: [number, number, number]; yaw: number }[] = [
  { pos: [-10.4, 1.35, -15.2], yaw: 0.34 },
  { pos: [10.4, 1.35, -15.6], yaw: -0.3 },
  { pos: [-10.6, 1.35, 27.5], yaw: 2.7 },
  { pos: [10.6, 1.35, 27.5], yaw: -2.7 },
];

export function ParkedFighters() {
  const b = useMemo(() => {
    const { solid, glow } = mergedShipGeometry('halcyon', 1);
    const hullMat = new MeshStandardMaterial({ color: '#1a1f2a', metalness: 0.7, roughness: 0.42, envMapIntensity: 0.35 });
    const glowMat = new MeshBasicMaterial({ color: hdr('ice', 0.8), toneMapped: false });
    const cradleMat = new MeshStandardMaterial({ color: '#2a303c', metalness: 0.8, roughness: 0.5, envMapIntensity: 0.3 });
    const len = SPECS.halcyon.length;
    const cradle = mergeGeometries([
      new BoxGeometry(2.2, 0.35, len * 0.55).translate(0, 0.18, -0.6),
      new BoxGeometry(0.35, 0.9, 0.35).translate(-0.8, 0.8, 1.6),
      new BoxGeometry(0.35, 0.9, 0.35).translate(0.8, 0.8, 1.6),
      new BoxGeometry(0.35, 0.9, 0.35).translate(-0.8, 0.8, -3.2),
      new BoxGeometry(0.35, 0.9, 0.35).translate(0.8, 0.8, -3.2),
      new BoxGeometry(4.8, 0.25, 0.4).translate(0, 0.45, -1.2),
    ])!;
    const n = PARKED.length;
    const hulls = new InstancedMesh(solid, hullMat, n);
    const lights = glow ? new InstancedMesh(glow, glowMat, n) : null;
    const cradles = new InstancedMesh(cradle, cradleMat, n);
    const m = new Matrix4(), q = new Quaternion(), one = new Vector3(1, 1, 1);
    PARKED.forEach((p, i) => {
      q.setFromEuler(new Euler(0, p.yaw, 0));
      m.compose(new Vector3(...p.pos), q, one);
      hulls.setMatrixAt(i, m);
      lights?.setMatrixAt(i, m);
      m.compose(new Vector3(p.pos[0], 0, p.pos[2]), q, one);
      cradles.setMatrixAt(i, m);
    });
    hulls.castShadow = true;
    hulls.receiveShadow = true;
    cradles.receiveShadow = true;
    return { solid, glow, cradle, hullMat, glowMat, cradleMat, hulls, lights, cradles };
  }, []);
  useEffect(
    () => () => {
      [b.solid, b.glow, b.cradle].forEach(g => g?.dispose());
      [b.hullMat, b.glowMat, b.cradleMat].forEach(m => m.dispose());
      [b.hulls, b.lights, b.cradles].forEach(x => x?.dispose());
    },
    [b],
  );
  return (
    <group name="parked-fighters">
      <primitive object={b.hulls} />
      {b.lights && <primitive object={b.lights} />}
      <primitive object={b.cradles} />
    </group>
  );
}
