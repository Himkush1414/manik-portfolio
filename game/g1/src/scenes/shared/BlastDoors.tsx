// Blast doors (brief §9) — mount-point agnostic: boot gate (in-world), launch
// bulkhead (camera-attached, 1G) and later level transitions. Pure view: all
// motion state lives in the DoorController passed in.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, BoxGeometry, Object3D, type Group, type Mesh } from 'three';
import { getDoorAssets } from './doors/doorAssets';
import { DOOR } from './doors/doorSpec';
import { DECAL } from '../../render/tex/decalAtlas';
import { decalGeometry } from './doors/decal';
import { DoorFX } from './doors/DoorFX';
import type { DoorController } from './doors/DoorController';
import { hdr } from '../../render/palette';

type Props = {
  controller: DoorController;
  position?: [number, number, number];
  particles?: number;
  reduceFlashing?: boolean;
  reduceMotion?: boolean;
};

const LED = { sealed: hdr('danger', 1), moving: hdr('hot', 1), open: hdr('ok', 1) };

export function BlastDoors({ controller, position = [0, 0, 0], particles = 1, reduceFlashing = false, reduceMotion = false }: Props) {
  const assets = getDoorAssets();
  const right = useRef<Group>(null);
  const left = useRef<Group>(null);
  const rods = useRef<Mesh[]>([]);

  const built = useMemo(() => {
    if (!assets) return null;
    const { geo, mats } = assets;
    const led = mats.led.clone();
    const makeRivets = (list: typeof geo.right.rivets) => {
      const im = new InstancedMesh(geo.rivet, mats.rivet, list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = false;
      return im;
    };
    const decals = {
      hazardR: decalGeometry(DECAL.hazard, DOOR.hazard.x1 - DOOR.hazard.x0, 5.7),
      bay07: decalGeometry(DECAL.bay07, 4.3, 1.62),
      obstruct: decalGeometry(DECAL.obstruct, 5.2, 0.46),
      chevR: decalGeometry(DECAL.chevrons, 2.6, 0.98),
      chevL: decalGeometry(DECAL.chevrons, 2.6, 0.98, true),
      pressure: decalGeometry(DECAL.pressure, 5.2, 0.72),
      warning: decalGeometry(DECAL.warning, 1.3, 1.17),
      wing: decalGeometry(DECAL.wing, 8.2, 0.92),
      numerals: decalGeometry(DECAL.numerals, 5.6, 0.82),
    };
    const bracket = new BoxGeometry(0.24, 1.5, 0.32);
    const corridorTarget = new Object3D();
    return { corridorTarget, led, rivetsR: makeRivets(geo.right.rivets), rivetsL: makeRivets(geo.left.rivets), decals, bracket };
  }, [assets]);

  useEffect(
    () => () => {
      if (!built) return;
      built.led.dispose();
      built.rivetsR.dispose();
      built.rivetsL.dispose();
      Object.values(built.decals).forEach(g => g.dispose());
      built.bracket.dispose();
    },
    [built],
  );

  useFrame(() => {
    if (!built) return;
    const x = DOOR.travel * Math.max(0, controller.progress);
    if (right.current) right.current.position.x = x;
    if (left.current) left.current.position.x = -x;
    // piston rods: sleeve ends at |x| = 4.5, rod reaches the bracket at 4.8 + travel
    rods.current.forEach(r => {
      if (!r) return;
      r.scale.x = Math.max(0.05, 0.3 + x);
    });
    const s = controller.state;
    const target = s === 'sealed' ? LED.sealed : s === 'open' ? LED.open : LED.moving;
    built.led.emissive.lerp(target, 0.2);
  });

  if (!assets || !built) return null;
  const { geo, mats } = assets;
  const zFace = DOOR.D / 2 + DOOR.bevel;
  const zPlate = zFace + DOOR.plates.depth + DOOR.plates.bevel + 0.004;
  const hazardX = (DOOR.hazard.x0 + DOOR.hazard.x1) / 2;
  const F = DOOR.frame;

  return (
    <group position={position}>
      {/* frame + wall pockets (panels slide behind it) */}
      <mesh geometry={geo.frame} material={mats.frame} receiveShadow />
      <mesh geometry={geo.frameTrim} material={mats.trim} />
      <mesh geometry={built.decals.wing} material={mats.decal} position={[0, F.holeTop + 1.15, F.depth + 0.67]} />
      <mesh geometry={built.decals.numerals} material={mats.decal} position={[0, F.bottom + 0.6, F.depth + 0.47]} />

      {/* pistons: sleeves fixed above the seam, rods reach each panel's bracket */}
      {DOOR.pistonY.map((y, i) =>
        [1, -1].map(sx => (
          <group key={`${y}-${sx}`} position={[0, y, 0.05]} scale={[sx, 1, 1]}>
            <mesh geometry={geo.pistonSleeve} material={mats.sleeve} position={[0.5, 0, 0]} scale={[4, 1, 1]} />
            <mesh
              ref={el => { if (el) rods.current[i * 2 + (sx > 0 ? 0 : 1)] = el; }}
              geometry={geo.pistonRod}
              material={mats.rod}
              position={[4.5, 0, 0]}
            />
          </group>
        )),
      )}

      <group ref={right}>
        <mesh geometry={geo.right.body} material={mats.panel} castShadow receiveShadow />
        <mesh geometry={geo.right.plates} material={mats.plate} castShadow receiveShadow />
        <mesh geometry={geo.right.ledStrip} material={built.led} />
        <primitive object={built.rivetsR} />
        <mesh geometry={built.bracket} material={mats.trim} position={[4.8, DOOR.H + 0.72, 0.05]} />
        <mesh geometry={built.decals.hazardR} material={mats.decal} position={[hazardX, 3.15, zFace + 0.004]} />
        <mesh geometry={built.decals.hazardR} material={mats.decal} position={[hazardX, 8.85, zFace + 0.004]} />
        <mesh geometry={built.decals.bay07} material={mats.decal} position={[4.1, 7.25, zPlate]} />
        <mesh geometry={built.decals.chevR} material={mats.decal} position={[5.3, 2.2, zPlate]} />
        <mesh geometry={built.decals.obstruct} material={mats.decal} position={[5.2, 1.05, zPlate]} />
      </group>

      <group ref={left}>
        <mesh geometry={geo.left.body} material={mats.panel} castShadow receiveShadow />
        <mesh geometry={geo.left.plates} material={mats.plate} castShadow receiveShadow />
        <mesh geometry={geo.left.ledStrip} material={built.led} />
        <primitive object={built.rivetsL} />
        <mesh geometry={built.bracket} material={mats.trim} position={[-4.8, DOOR.H + 0.72, 0.05]} />
        <mesh geometry={built.decals.hazardR} material={mats.decal} position={[-hazardX, 3.15, zFace + 0.004]} />
        <mesh geometry={built.decals.hazardR} material={mats.decal} position={[-hazardX, 8.85, zFace + 0.004]} />
        <mesh geometry={built.decals.pressure} material={mats.decal} position={[-5.2, 7.25, zPlate]} />
        <mesh geometry={built.decals.warning} material={mats.decal} position={[-5.2, 9.35, zPlate]} />
        <mesh geometry={built.decals.chevL} material={mats.decal} position={[-5.3, 2.2, zPlate]} />
        <mesh geometry={built.decals.obstruct} material={mats.decal} position={[-5.2, 1.05, zPlate]} />
      </group>

      {/* cold overhead corridor light: gives the plate bevels a highlight */}
      <primitive object={built.corridorTarget} position={[0, 5, 0]} />
      <spotLight position={[0, 19, 16]} angle={0.62} penumbra={0.9} intensity={60} distance={40} decay={1.4} color="#cfdcff" target={built.corridorTarget} />
      <DoorFX controller={controller} particles={particles} reduceFlashing={reduceFlashing} reduceMotion={reduceMotion} />
    </group>
  );
}
