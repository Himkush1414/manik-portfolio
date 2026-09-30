// Bay architecture meshes (merged per material, see bayGeometry.ts). Steel
// reuses the doors' worn-gunmetal bake (already resident after boot).
import { useEffect, useMemo } from 'react';
import { MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, Color } from 'three';
import { buildBayGeometry } from './bayGeometry';
import { getDoorAssets } from '../../shared/doors/doorAssets';
import { hdr } from '../../../render/palette';

export function Bay() {
  const b = useMemo(() => {
    const geo = buildBayGeometry();
    const set = getDoorAssets()?.frameMetal;
    const steel = new MeshPhysicalMaterial({
      color: new Color('#5b6376'),
      envMapIntensity: 0.22,
      map: set?.map ?? null,
      normalMap: set?.normal ?? null,
      roughnessMap: set?.orm ?? null,
      metalnessMap: set?.orm ?? null,
      aoMap: set?.orm ?? null,
      roughness: 1,
      metalness: 0.9,
    });
    const bare = new MeshStandardMaterial({ color: '#6f7889', metalness: 1, roughness: 0.34, envMapIntensity: 0.55, normalMap: set?.normal ?? null });
    const dark = new MeshStandardMaterial({ color: '#0b0d13', metalness: 0.4, roughness: 0.7 });
    const glowCool = new MeshBasicMaterial({ color: hdr('ice', 0.7), toneMapped: false, fog: false });
    const glowWarm = new MeshBasicMaterial({ color: hdr('core', 3.2), toneMapped: false, fog: false });
    return { geo, steel, bare, dark, glowCool, glowWarm };
  }, []);
  useEffect(
    () => () => {
      Object.values(b.geo).forEach(g => (Array.isArray(g) ? null : g.dispose()));
      [b.steel, b.bare, b.dark, b.glowCool, b.glowWarm].forEach(m => m.dispose());
    },
    [b],
  );
  return (
    <group name="bay">
      <mesh geometry={b.geo.steel} material={b.steel} receiveShadow />
      <mesh geometry={b.geo.bare} material={b.bare} receiveShadow />
      <mesh geometry={b.geo.dark} material={b.dark} />
      <mesh geometry={b.geo.glowCool} material={b.glowCool} />
      <mesh geometry={b.geo.glowWarm} material={b.glowWarm} />
    </group>
  );
}
