// Polished deck with blurred planar reflections (brief §11 FLOOR): drei
// MeshReflectorMaterial at reduced resolution + blur; plain PBR deck on LOW
// (reflections 'off'). Painted markings + panel normals from deck.ts.
import { useEffect, useMemo } from 'react';
import { Vector2 } from 'three';
import { FloorReflector } from './FloorReflector';
import { stage } from '../../Stage';
import { createDeckTextures, DECK } from './deck';
import { useLoader } from '../../../core/loader';

/** module constant: the reflector rebuilds its FBOs + blur pass when `blur` changes identity (with
 *  drei's wrapper an inline array leaked 4 render targets on every Floor re-render, e.g. a DRS step
 *  re-rendering the Hangar at mission start) */
const BLUR: [number, number] = [380, 110];
/** the hall is hidden in the cockpit and in missions: no reflection render there */
const hallShown = () => stage.cockpit < 0.5 && stage.mission < 0.5;

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
        <FloorReflector map={tex.map} roughnessMap={tex.rough} normalMap={tex.normal} normalScale={ns} resolution={reflections === 'full' ? 1024 : 512} blur={BLUR} active={hallShown} />
      )}
    </mesh>
  );
}
