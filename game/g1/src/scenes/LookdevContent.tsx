// Engine-nozzle lookdev object + deck (1A gate). Content only — no camera or
// post (the World owns those). Stands in for the hangar until slice 1D.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { LatheGeometry, Vector2, MeshPhysicalMaterial, MeshStandardMaterial, Color, DoubleSide, type Group } from 'three';
import { hdr, HEX } from '../render/palette';

function nozzleProfile(): Vector2[] {
  const pts: [number, number][] = [
    [0.0, -1.9], [1.1, -1.9], [1.18, -1.84], [1.18, -1.6], [1.34, -1.56], [1.36, -1.3],
    [1.22, -1.24], [1.2, -0.9], [1.08, -0.62], [0.98, -0.2], [0.96, 0.3], [1.04, 0.9],
    [1.24, 1.55], [1.5, 2.2], [1.8, 2.8], [2.02, 3.2], [2.06, 3.3], [1.98, 3.34],
    [1.74, 2.96], [1.46, 2.4], [1.2, 1.8], [1.0, 1.2], [0.88, 0.6], [0.8, 0.2], [0.0, 0.2],
  ];
  return pts.map(([r, h]) => new Vector2(r, h));
}

export function LookdevContent() {
  const group = useRef<Group>(null);
  const built = useMemo(() => {
    const geo = new LatheGeometry(nozzleProfile(), 160);
    geo.computeVertexNormals();
    const ringGeo = new LatheGeometry([new Vector2(1.36, -0.5), new Vector2(1.42, -0.46), new Vector2(1.42, 0.46), new Vector2(1.36, 0.5)], 160);
    const coreGeo = new LatheGeometry([new Vector2(0.001, 0.22), new Vector2(0.78, 0.22), new Vector2(0.9, 0.9), new Vector2(0.001, 0.9)], 96);
    return {
      geo,
      ringGeo,
      coreGeo,
      metal: new MeshPhysicalMaterial({ color: new Color('#9aa2b4'), metalness: 1, roughness: 0.32, anisotropy: 0.85, anisotropyRotation: Math.PI / 2, side: DoubleSide }),
      ring: new MeshPhysicalMaterial({ color: new Color('#3a3040'), metalness: 1, roughness: 0.22, iridescence: 1, iridescenceIOR: 1.7, iridescenceThicknessRange: [240, 820] }),
      core: new MeshStandardMaterial({ color: '#000000', emissive: hdr('hot', 1), emissiveIntensity: 5, toneMapped: false }),
      deck: new MeshPhysicalMaterial({ color: new Color('#06080d'), metalness: 0.1, roughness: 0.78 }),
      padRing: new MeshStandardMaterial({ color: '#000000', emissive: new Color(HEX.ignition), emissiveIntensity: 2.6, toneMapped: false }),
    };
  }, []);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.12;
  });
  return (
    <>
      <group ref={group} position={[0, 1.95, 0]} rotation={[0.16, 0, 0.05]}>
        <mesh geometry={built.geo} material={built.metal} castShadow receiveShadow />
        <mesh geometry={built.ringGeo} material={built.ring} castShadow />
        <mesh geometry={built.coreGeo} material={built.core} />
      </group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow material={built.deck}>
        <circleGeometry args={[60, 96]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.005} material={built.padRing}>
        <ringGeometry args={[4.6, 4.68, 192]} />
      </mesh>
    </>
  );
}
