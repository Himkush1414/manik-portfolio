// Polished deck with blurred planar reflections (brief §11 FLOOR): drei
// MeshReflectorMaterial at reduced resolution + blur; plain PBR deck on LOW
// (reflections 'off'). Painted markings + panel normals from deck.ts.
import { useEffect, useMemo } from 'react';
import { Vector2 } from 'three';
import { MeshReflectorMaterial } from '@react-three/drei';
import { createDeckTextures, DECK } from './deck';
import { useLoader } from '../../../core/loader';

export function Floor({ reflections: wanted }: { reflections: 'off' | 'half' | 'full' }) {
  // The reflector re-renders the WHOLE scene with its own camera every frame,
  // even while the boot beats hide the world — mounted before the parallel
  // shader compile it forced every world program to link synchronously
  // (measured: a 2.3 s main-thread stall at world mount). Plain deck until
  // the 'shaders' task is done; warm-up then compiles the reflector itself.
  const compiled = useLoader(s => s.completed.includes('shaders'));
  const reflections = compiled ? wanted : 'off';
  const tex = useMemo(() => createDeckTextures(), []);
  const ns = useMemo(() => new Vector2(0.4, 0.4), []);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, DECK.z]} receiveShadow name="deck">
      <planeGeometry args={[DECK.w, DECK.l]} />
      {reflections === 'off' ? (
        <meshStandardMaterial map={tex.map} roughnessMap={tex.rough} normalMap={tex.normal} normalScale={ns} metalness={0.4} roughness={1} envMapIntensity={0.3} />
      ) : (
        <MeshReflectorMaterial
          map={tex.map}
          roughnessMap={tex.rough}
          normalMap={tex.normal}
          normalScale={ns}
          metalness={0.4}
          roughness={1}
          envMapIntensity={0.3}
          resolution={reflections === 'full' ? 1024 : 512}
          blur={[380, 110]}
          mixBlur={1}
          mixStrength={0.9}
          mixContrast={1}
          mirror={0.45}
          depthScale={1.1}
          minDepthThreshold={0.35}
          maxDepthThreshold={1.3}
        />
      )}
    </mesh>
  );
}
