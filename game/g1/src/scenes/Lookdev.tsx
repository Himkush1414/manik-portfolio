// Engine lookdev (slice 1A gate): a turned annular nozzle under the studio rig
// — exercises PBR (anisotropic brushed metal, iridescent heat ring, clearcoat
// deck), HDR emissive → bloom, one soft shadow, AO and tone mapping together.
// Reachable later with ?screen=lookdev for lighting work.
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { LatheGeometry, Vector2, Vector3, MeshPhysicalMaterial, MeshStandardMaterial, Color, DoubleSide, type Group } from 'three';
import { StudioEnvironment } from '../render/env/StudioEnvironment';
import { StudioLights } from '../render/env/StudioLights';
import { PostFX } from '../render/PostFX';
import { hdr, HEX } from '../render/palette';

function nozzleProfile(): Vector2[] {
  // radius, height pairs — flared bell, throat, collar steps, mount flange
  const pts: [number, number][] = [
    [0.0, -1.9], [1.1, -1.9], [1.18, -1.84], [1.18, -1.6], [1.34, -1.56], [1.36, -1.3],
    [1.22, -1.24], [1.2, -0.9], [1.08, -0.62], [0.98, -0.2], [0.96, 0.3], [1.04, 0.9],
    [1.24, 1.55], [1.5, 2.2], [1.8, 2.8], [2.02, 3.2], [2.06, 3.3], [1.98, 3.34],
    [1.74, 2.96], [1.46, 2.4], [1.2, 1.8], [1.0, 1.2], [0.88, 0.6], [0.8, 0.2], [0.0, 0.2],
  ];
  return pts.map(([r, h]) => new Vector2(r, h));
}

export function Lookdev() {
  const group = useRef<Group>(null);
  const camera = useThree(s => s.camera);
  const focus = useMemo(() => new Vector3(0, 1.6, 0), []);

  const { geo, ringGeo, coreGeo, metal, ring, core, deck, padRing } = useMemo(() => {
    const geo = new LatheGeometry(nozzleProfile(), 160);
    geo.computeVertexNormals();
    const ringGeo = new LatheGeometry(
      [new Vector2(1.36, -0.5), new Vector2(1.42, -0.46), new Vector2(1.42, 0.46), new Vector2(1.36, 0.5)],
      160,
    );
    const coreGeo = new LatheGeometry([new Vector2(0.001, 0.22), new Vector2(0.78, 0.22), new Vector2(0.9, 0.9), new Vector2(0.001, 0.9)], 96);
    const metal = new MeshPhysicalMaterial({
      color: new Color('#9aa2b4'),
      metalness: 1,
      roughness: 0.32,
      anisotropy: 0.85,
      anisotropyRotation: Math.PI / 2,
      side: DoubleSide,
    });
    const ring = new MeshPhysicalMaterial({
      color: new Color('#3a3040'),
      metalness: 1,
      roughness: 0.22,
      iridescence: 1,
      iridescenceIOR: 1.7,
      iridescenceThicknessRange: [240, 820],
    });
    const core = new MeshStandardMaterial({ color: '#000000', emissive: hdr('hot', 1), emissiveIntensity: 5, toneMapped: false });
    const deck = new MeshPhysicalMaterial({ color: new Color('#06080d'), metalness: 0.1, roughness: 0.78 });
    const padRing = new MeshStandardMaterial({ color: '#000000', emissive: new Color(HEX.ignition), emissiveIntensity: 2.6, toneMapped: false });
    return { geo, ringGeo, coreGeo, metal, ring, core, deck, padRing };
  }, []);

  useFrame((state, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.12;
    camera.position.set(Math.sin(state.clock.elapsedTime * 0.07) * 1.5 + 10.5, 4.6, 15.5);
    camera.lookAt(focus);
  });

  return (
    <>
      <StudioEnvironment />
      <StudioLights />
      <group ref={group} position={[0, 1.95, 0]} rotation={[0.16, 0, 0.05]}>
        <mesh geometry={geo} material={metal} castShadow receiveShadow />
        <mesh geometry={ringGeo} material={ring} castShadow />
        <mesh geometry={coreGeo} material={core} />
      </group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow material={deck}>
        <circleGeometry args={[40, 96]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.005} material={padRing}>
        <ringGeometry args={[4.6, 4.68, 192]} />
      </mesh>
      <fog attach="fog" args={['#04050A', 14, 46]} />
      <PostFX ao dofTarget={focus} dofRange={6} />
    </>
  );
}
